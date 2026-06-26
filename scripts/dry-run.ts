import * as path from "path";
import type { Deal, RateCardCell, Shipper, AgentReview } from "../src/lib/types";
import { runAllChecks } from "../src/lib/policy-checker";
import { routeToActionQueue, shouldEscalate } from "../src/lib/escalation-router";

function load<T>(file: string): T {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(path.join(__dirname, "../src/data", file)) as T;
}

const rateCard = load<RateCardCell[]>("rate-card.json");
const shippers = load<Shipper[]>("shippers.json");
const deals = load<Deal[]>("deals.json");

const { dealResults } = runAllChecks(deals, shippers, rateCard);
const flagged = dealResults.filter((r) => r.status === "FLAGGED");

console.log("=".repeat(60));
console.log("  Block 2 Dry Run — Escalation Routing (no API calls)");
console.log("=".repeat(60));
console.log(`\nFlagged deals that would go to agent: ${flagged.length}`);
console.log("In-policy (never touch agent):       ", deals.length - flagged.length);

// Simulate realistic agent verdicts based on archetype and breach type
function simulateReview(
  dealId: string,
  shipperId: string,
  breachRules: string[],
  capacityScarce: boolean,
  isStrategic: boolean
): AgentReview {
  const hasNegativeMargin = breachRules.includes("margin_check") && breachRules.includes("band_check");
  const isMissingFields = breachRules.includes("fields_check");
  const isThinsMarginOnly = breachRules.includes("margin_check") && !breachRules.includes("band_check");

  if (isMissingFields) {
    return {
      verdict: "escalate",
      breached_policies: breachRules,
      rationale: "Missing required fields — cannot score deal without segment and vertical context.",
      recommended_action: "replace_or_remove",
      confidence: "low",
      escalate: true,
      human_review_reason: "Data quality issue: segment and vertical are blank. Data ops must resolve before commercial review.",
    };
  }

  if (isThinsMarginOnly && isStrategic && capacityScarce) {
    return {
      verdict: "approve_exception",
      breached_policies: breachRules,
      rationale: "Margin is thin (3–4.9%) but deal is within band. Strategic account with high volume share and capacity scarcity on this lane — exception is defensible for this cycle.",
      recommended_action: "tolerate_strategic",
      confidence: "high",
      escalate: false,
      human_review_reason: null,
    };
  }

  if (isThinsMarginOnly && isStrategic && !capacityScarce) {
    return {
      verdict: "escalate",
      breached_policies: breachRules,
      rationale: "Margin below floor. Account is strategic but capacity is not scarce — borderline defensibility. Escalate for Commercial Manager review.",
      recommended_action: "take_rate_enhancement",
      confidence: "medium",
      escalate: true,
      human_review_reason: "Strategic account with thin margin and no capacity scarcity. Commercial Manager to assess whether volume justifies continued tolerance.",
    };
  }

  if (hasNegativeMargin && !isStrategic) {
    return {
      verdict: "reject",
      breached_policies: breachRules,
      rationale: "Price is below carrier cost floor and margin is negative. Non-strategic account with no capacity scarcity — indefensible.",
      recommended_action: "price_up",
      confidence: "high",
      escalate: false,
      human_review_reason: null,
    };
  }

  // Default: escalate for borderline cases
  return {
    verdict: "escalate",
    breached_policies: breachRules,
    rationale: "Borderline case — breach severity and account context do not clearly support approval or rejection.",
    recommended_action: "price_up",
    confidence: "medium",
    escalate: true,
    human_review_reason: "Requires Vertical Lead review before proceeding.",
  };
}

console.log("\n── Sample routing for first 8 flagged deals ──────────────\n");

const actionEntries = flagged.map((result) => {
  const deal = deals.find((d) => d.deal_id === result.deal_id)!;
  const shipper = shippers.find((s) => s.shipper_id === deal.shipper_id)!;
  const breachRules = result.breaches.map((b) => b.rule);
  const review = simulateReview(
    result.deal_id,
    deal.shipper_id,
    breachRules,
    deal.capacity_scarce,
    shipper.strategic
  );
  return { result, deal, shipper, review, entry: routeToActionQueue(result, review, deal.shipper_id) };
});

actionEntries.slice(0, 8).forEach(({ result, deal, shipper, review, entry }) => {
  console.log(`${result.deal_id} | ${deal.shipper_id} | ${deal.lane}`);
  console.log(`  Breaches:  ${result.breaches.map((b) => b.rule).join(", ")}`);
  console.log(`  Verdict:   ${review.verdict}   confidence: ${review.confidence}`);
  console.log(`  Action:    ${entry.recommended_action}   owner: ${entry.owner}   priority: ${entry.priority}`);
  console.log(`  Escalated: ${shouldEscalate(review)}`);
  console.log();
});

// Summary of all routing
const byVerdict = {
  approve_exception: actionEntries.filter((e) => e.review.verdict === "approve_exception").length,
  reject: actionEntries.filter((e) => e.review.verdict === "reject").length,
  escalate: actionEntries.filter((e) => e.review.verdict === "escalate").length,
};
const byOwner = {
  "Vertical Lead": actionEntries.filter((e) => e.entry.owner === "Vertical Lead").length,
  "Collections Owner": actionEntries.filter((e) => e.entry.owner === "Collections Owner").length,
  "Commercial Manager": actionEntries.filter((e) => e.entry.owner === "Commercial Manager").length,
};

console.log("── Simulated routing summary (mock verdicts) ─────────────\n");
console.log("Verdicts:");
console.log(`  approve_exception: ${byVerdict.approve_exception}`);
console.log(`  reject:            ${byVerdict.reject}`);
console.log(`  escalate:          ${byVerdict.escalate}`);
console.log("\nRouted to owner:");
console.log(`  Vertical Lead:      ${byOwner["Vertical Lead"]}`);
console.log(`  Collections Owner:  ${byOwner["Collections Owner"]}`);
console.log(`  Commercial Manager: ${byOwner["Commercial Manager"]}`);
console.log(`\n✓ Block 2 wiring verified. Swap in a real ANTHROPIC_API_KEY to run live agent calls via POST /api/review`);
