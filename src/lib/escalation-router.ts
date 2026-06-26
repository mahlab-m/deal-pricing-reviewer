import type {
  ActionQueueEntry,
  AgentReview,
  DealPolicyResult,
  EscalationOwner,
  Priority,
} from "./types";

let entryCounter = 0;
function nextEntryId(): string {
  entryCounter++;
  return `aq-${String(entryCounter).padStart(3, "0")}`;
}

function determineOwner(
  review: AgentReview,
  result: DealPolicyResult
): EscalationOwner {
  const breachRules = result.breaches.map((b) => b.rule);

  // Collection breaches route to Collections Owner regardless of other factors
  if (
    breachRules.includes("ar_days_check") ||
    breachRules.includes("overdue_check")
  ) {
    return "Collections Owner";
  }

  // Strategic-account exceptions need Commercial Manager sign-off
  if (
    review.verdict === "approve_exception" ||
    review.recommended_action === "tolerate_strategic"
  ) {
    return "Commercial Manager";
  }

  // Pricing and margin breaches go to Vertical Lead
  return "Vertical Lead";
}

function determinePriority(review: AgentReview): Priority {
  // P0: escalated with low confidence, or money materially at risk
  if (review.verdict === "escalate" && review.confidence === "low") return "P0";
  if (review.verdict === "escalate") return "P0";
  return "P1";
}

export function routeToActionQueue(
  result: DealPolicyResult,
  review: AgentReview,
  shipperId: string
): ActionQueueEntry {
  return {
    entry_id: nextEntryId(),
    deal_id: result.deal_id,
    shipper_id: shipperId,
    recommended_action: review.recommended_action,
    owner: determineOwner(review, result),
    priority: determinePriority(review),
    status: "not started",
    rationale: review.rationale,
    created_at: new Date().toISOString(),
  };
}

export function shouldEscalate(review: AgentReview): boolean {
  return review.escalate || review.verdict === "escalate";
}
