import { NextRequest, NextResponse } from "next/server";
import type { Deal, RateCardCell, Shipper } from "@/lib/types";
import { runAllChecks } from "@/lib/policy-checker";
import { reviewException } from "@/lib/agent";
import { routeToActionQueue, shouldEscalate } from "@/lib/escalation-router";

// Loaded once at cold start — these are static seed files
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rateCard: RateCardCell[] = require("@/data/rate-card.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shippers: Shipper[] = require("@/data/shippers.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const allDeals: Deal[] = require("@/data/deals.json");

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { deal_ids?: string[] };
    const requestedIds = body.deal_ids;

    const targetDeals = requestedIds
      ? allDeals.filter((d) => requestedIds.includes(d.deal_id))
      : allDeals;

    // Deterministic layer — only flagged deals proceed to the agent
    const { dealResults } = runAllChecks(targetDeals, shippers, rateCard);
    const inPolicy = dealResults.filter((r) => r.status === "IN_POLICY");
    const flagged = dealResults.filter((r) => r.status === "FLAGGED");

    // Agent layer — runs only on exceptions
    const reviewed = await Promise.all(
      flagged.map(async (result) => {
        const deal = allDeals.find((d) => d.deal_id === result.deal_id)!;
        const shipper = shippers.find((s) => s.shipper_id === deal.shipper_id)!;

        const agentReview = await reviewException(
          deal,
          result,
          shipper,
          rateCard
        );
        const actionEntry = routeToActionQueue(
          result,
          agentReview,
          deal.shipper_id
        );

        return {
          deal_id: result.deal_id,
          shipper_id: deal.shipper_id,
          policy_result: result,
          agent_review: agentReview,
          action_entry: actionEntry,
          is_escalated: shouldEscalate(agentReview),
        };
      })
    );

    const summary = {
      total_deals: targetDeals.length,
      in_policy: inPolicy.length,
      flagged: flagged.length,
      agent_reviewed: reviewed.length,
      verdicts: {
        approve_exception: reviewed.filter(
          (r) => r.agent_review.verdict === "approve_exception"
        ).length,
        reject: reviewed.filter((r) => r.agent_review.verdict === "reject")
          .length,
        escalate: reviewed.filter(
          (r) => r.agent_review.verdict === "escalate"
        ).length,
      },
      escalated: reviewed.filter((r) => r.is_escalated).length,
    };

    return NextResponse.json({ summary, results: reviewed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
