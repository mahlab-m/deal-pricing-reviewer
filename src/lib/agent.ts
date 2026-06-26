import Anthropic from "@anthropic-ai/sdk";
import type { AgentReview, Deal, DealPolicyResult, RateCardCell, Shipper } from "./types";
import { lookupCell } from "./rate-card";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a freight pricing exception reviewer for a logistics freight brokerage operating across Pakistan.
You receive deals that have already failed at least one deterministic policy check. Your job: decide whether to approve the exception, reject the deal, or escalate for human review.

## Policy rules (deterministic checks already ran before you receive this)
- Band check: proposed price must be within [band_lower, band_upper] per lane/tonnage/vehicle
- Margin check: (price − carrier_cost) / price ≥ 5% AND absolute margin ≥ 0
- Take-rate check: portfolio take-rate ≥ 5%
- AR days check: ≤ 60 days outstanding
- Overdue check: overdue ratio ≤ 20%

## Decision framework
REJECT when ALL of the following are true: absolute margin ≤ 0 (or margin < 0%), shipper is NOT strategic, capacity is NOT scarce on this lane. This is indefensible — no competitive or strategic case exists.

APPROVE_EXCEPTION when: defensibility factors are strong — capacity is scarce on this lane AND (shipper is strategic with ≥ 15% volume share OR there is clear competitive pressure retaining the load) AND the breach is minor (margin 3–4.9% or price just below band_lower by < 5%).

ESCALATE in all other cases: borderline defensibility, high-value account at risk, low confidence, any deal where money is materially at risk. When uncertain → escalate. Never auto-approve a money-at-risk deal.

## Fallback rule
If you cannot determine a clear verdict from the information provided → escalate with confidence: "low".

## Output format
Return ONLY a single valid JSON object. No prose, no markdown code fences, no text outside the JSON braces:
{
  "verdict": "approve_exception" | "reject" | "escalate",
  "breached_policies": string[],
  "rationale": string,
  "recommended_action": "price_up" | "take_rate_enhancement" | "volume_cap" | "collection_sprint" | "reduce_credit_terms" | "tolerate_strategic" | "replace_or_remove",
  "confidence": "high" | "medium" | "low",
  "escalate": boolean,
  "human_review_reason": string | null
}

recommended_action guide:
- price_up → price below band or floor; reprice this deal
- take_rate_enhancement → portfolio take-rate thin; negotiate volume-linked rate improvement
- volume_cap → dual-risk or non-strategic account with worsening profile; cap volume exposure
- collection_sprint → AR days or overdue exceeded; accelerate collections
- reduce_credit_terms → overdue risk; shorten payment window
- tolerate_strategic → strategic account where exception is commercially justified this cycle
- replace_or_remove → indefensible relationship, recommend exit`;

const RATE_CARD_TOOL: Anthropic.Tool = {
  name: "lookup_rate_card_cell",
  description:
    "Look up the reference rate card for a specific lane, tonnage tier, and vehicle type. Returns the carrier cost floor and the pricing band in USD/ton. Use this to verify pricing context or compare similar lanes.",
  input_schema: {
    type: "object" as const,
    properties: {
      lane: {
        type: "string",
        description:
          "Lane name exactly as in the rate card, e.g. 'Karachi → Lahore'",
      },
      tonnage_tier: {
        type: "string",
        enum: ["<5T", "5-10T", "10-20T", "20T+"],
      },
      vehicle_type: {
        type: "string",
        enum: ["20 Ft", "40 Ft", "Mazda 17ft"],
      },
    },
    required: ["lane", "tonnage_tier", "vehicle_type"],
  },
};

function buildUserMessage(
  deal: Deal,
  result: DealPolicyResult,
  shipper: Shipper,
  rateCell: RateCardCell | undefined
): string {
  const breachLines = result.breaches
    .map((b) => `  - ${b.rule}: ${b.detail}`)
    .join("\n");

  const cellLines = rateCell
    ? `  carrier_cost_floor_usd: $${rateCell.carrier_cost_floor_usd}/ton\n  band_lower_usd: $${rateCell.band_lower_usd}/ton\n  band_upper_usd: $${rateCell.band_upper_usd}/ton`
    : "  (no rate card cell found for this lane/tier/vehicle combination)";

  return `Review this flagged freight deal and return a JSON verdict.

## Deal
  deal_id: ${deal.deal_id}
  lane: ${deal.lane}
  tonnage_tier: ${deal.tonnage_tier}
  vehicle_type: ${deal.vehicle_type}
  carrier_cost_usd: $${deal.carrier_cost_usd}/ton
  proposed_price_usd: $${deal.proposed_price_usd}/ton
  margin_pct: ${(deal.margin_pct * 100).toFixed(2)}%
  segment: ${deal.segment || "(missing)"}
  vertical: ${deal.vertical || "(missing)"}
  capacity_scarce: ${deal.capacity_scarce}

## Rate card reference for this lane/tier/vehicle
${cellLines}

## Policy breaches detected
${breachLines}

## Account context (${deal.shipper_id})
  archetype: ${shipper.archetype}
  volume_share_pct: ${shipper.volume_share_pct}%
  strategic_flag: ${shipper.strategic}
  portfolio_take_rate_pct: ${shipper.take_rate_pct ?? "null (data missing)"}%
  ar_days: ${shipper.ar_days ?? "null (data missing)"}
  overdue_ratio_pct: ${shipper.overdue_ratio ?? "null (data missing)"}%
  credit_terms_days: ${shipper.credit_terms_days ?? "null (data missing)"}

Return your verdict as a single JSON object.`;
}

const FALLBACK_REVIEW: AgentReview = {
  verdict: "escalate",
  breached_policies: ["parse_error"],
  rationale:
    "Agent output could not be parsed or was malformed. Defaulting to escalate for human review.",
  recommended_action: "replace_or_remove",
  confidence: "low",
  escalate: true,
  human_review_reason: "Malformed agent output — requires manual review before any action.",
};

function parseAgentOutput(text: string): AgentReview {
  try {
    const cleaned = text
      .replace(/^```(?:json)?/m, "")
      .replace(/```$/m, "")
      .trim();
    const parsed = JSON.parse(cleaned) as Partial<AgentReview>;

    const validVerdicts = ["approve_exception", "reject", "escalate"];
    const validActions = [
      "price_up",
      "take_rate_enhancement",
      "volume_cap",
      "collection_sprint",
      "reduce_credit_terms",
      "tolerate_strategic",
      "replace_or_remove",
    ];
    const validConfidence = ["high", "medium", "low"];

    if (
      !parsed.verdict ||
      !validVerdicts.includes(parsed.verdict) ||
      !parsed.recommended_action ||
      !validActions.includes(parsed.recommended_action) ||
      !parsed.confidence ||
      !validConfidence.includes(parsed.confidence)
    ) {
      return FALLBACK_REVIEW;
    }

    return {
      verdict: parsed.verdict,
      breached_policies: Array.isArray(parsed.breached_policies)
        ? parsed.breached_policies
        : [],
      rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
      recommended_action: parsed.recommended_action,
      confidence: parsed.confidence,
      escalate: parsed.escalate ?? parsed.verdict === "escalate",
      human_review_reason:
        parsed.human_review_reason ?? null,
    };
  } catch {
    return FALLBACK_REVIEW;
  }
}

export async function reviewException(
  deal: Deal,
  result: DealPolicyResult,
  shipper: Shipper,
  rateCard: RateCardCell[]
): Promise<AgentReview> {
  const rateCell = lookupCell(
    rateCard,
    deal.lane,
    deal.tonnage_tier,
    deal.vehicle_type
  );
  const userMessage = buildUserMessage(deal, result, shipper, rateCell);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  // Agentic loop — agent may optionally call lookup_rate_card_cell once
  for (let turn = 0; turn < 3; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [RATE_CARD_TOOL],
      messages,
    });

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text");
      return textBlock?.type === "text"
        ? parseAgentOutput(textBlock.text)
        : FALLBACK_REVIEW;
    }

    if (response.stop_reason === "tool_use") {
      const toolUse = response.content.find((b) => b.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") return FALLBACK_REVIEW;

      const input = toolUse.input as {
        lane: string;
        tonnage_tier: string;
        vehicle_type: string;
      };
      const cell = lookupCell(
        rateCard,
        input.lane,
        input.tonnage_tier as Deal["tonnage_tier"],
        input.vehicle_type as Deal["vehicle_type"]
      );
      const toolResult = cell
        ? {
            carrier_cost_floor_usd: cell.carrier_cost_floor_usd,
            band_lower_usd: cell.band_lower_usd,
            band_upper_usd: cell.band_upper_usd,
          }
        : { error: "No rate card cell found for this combination" };

      messages.push(
        { role: "assistant", content: response.content },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: JSON.stringify(toolResult),
            },
          ],
        }
      );
      continue;
    }

    break;
  }

  return FALLBACK_REVIEW;
}
