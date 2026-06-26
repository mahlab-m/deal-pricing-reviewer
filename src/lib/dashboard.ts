import type {
  ActionQueueEntry,
  Deal,
  DealPolicyResult,
  EscalationOwner,
  Shipper,
  ShipperPolicyResult,
} from "./types";

export type HealthStatus = "green" | "yellow" | "red" | "unscored";

export interface ShipperHealth {
  shipper_id: string;
  pricing: HealthStatus;
  collection: HealthStatus;
  capacity: HealthStatus;
  overall: HealthStatus;
}

function worst(...s: HealthStatus[]): HealthStatus {
  if (s.includes("red")) return "red";
  if (s.includes("unscored")) return "unscored";
  if (s.includes("yellow")) return "yellow";
  return "green";
}

export function computePricingHealth(
  shipper: Shipper,
  shipperResult: ShipperPolicyResult,
  dealResults: DealPolicyResult[]
): HealthStatus {
  if (shipperResult.breaches.some((b) => b.rule === "data_quality"))
    return "unscored";

  const hasTakeRateBreach = shipperResult.breaches.some(
    (b) => b.rule === "take_rate_check"
  );
  if (hasTakeRateBreach) return "red";

  const hasNegativeMarginDeal = dealResults.some((r) =>
    r.breaches.some(
      (b) => b.rule === "margin_check" && b.detail.includes("negative")
    )
  );
  if (hasNegativeMarginDeal) return "red";

  const hasThinMarginDeal = dealResults.some((r) =>
    r.breaches.some((b) => b.rule === "margin_check")
  );
  const isTightTakeRate =
    shipper.take_rate_pct !== null && shipper.take_rate_pct < 7;
  if (hasThinMarginDeal || isTightTakeRate) return "yellow";

  return "green";
}

export function computeCollectionHealth(
  shipper: Shipper,
  shipperResult: ShipperPolicyResult
): HealthStatus {
  if (shipperResult.breaches.some((b) => b.rule === "data_quality"))
    return "unscored";

  const hasArBreach = shipperResult.breaches.some(
    (b) => b.rule === "ar_days_check"
  );
  const hasOverdueBreach = shipperResult.breaches.some(
    (b) => b.rule === "overdue_check"
  );
  if (hasArBreach || hasOverdueBreach) return "red";

  const arTight = shipper.ar_days !== null && shipper.ar_days > 45;
  const overdueTight =
    shipper.overdue_ratio !== null && shipper.overdue_ratio > 12;
  if (arTight || overdueTight) return "yellow";

  return "green";
}

export function computeCapacityHealth(
  dealResults: DealPolicyResult[],
  deals: Deal[]
): HealthStatus {
  const dealById = new Map(deals.map((d) => [d.deal_id, d]));
  const flagged = dealResults.filter((r) => r.status === "FLAGGED");

  // Flagged deals on non-scarce lanes = capacity given away cheaply, no justification
  const unjustifiedFlagged = flagged.filter((r) => {
    const deal = dealById.get(r.deal_id);
    return deal && !deal.capacity_scarce;
  });

  if (unjustifiedFlagged.length > 2) return "red";

  // Any flagged deals or capacity-scarce lanes = watch
  const anyScarce = deals
    .filter((d) => dealResults.some((r) => r.deal_id === d.deal_id))
    .some((d) => d.capacity_scarce);
  if (flagged.length > 0 || anyScarce) return "yellow";

  return "green";
}

export function computeShipperHealth(
  shipper: Shipper,
  shipperResult: ShipperPolicyResult,
  dealResults: DealPolicyResult[],
  deals: Deal[]
): ShipperHealth {
  const shipperDeals = deals.filter((d) => d.shipper_id === shipper.shipper_id);
  const shipperDealResults = dealResults.filter(
    (r) => r.shipper_id === shipper.shipper_id
  );

  const pricing = computePricingHealth(shipper, shipperResult, shipperDealResults);
  const collection = computeCollectionHealth(shipper, shipperResult);
  const capacity = computeCapacityHealth(shipperDealResults, shipperDeals);

  return {
    shipper_id: shipper.shipper_id,
    pricing,
    collection,
    capacity,
    overall: worst(pricing, collection, capacity),
  };
}

// ─── Deterministic action queue ───────────────────────────────────────────────
// Derived from policy checker results without agent. Enriched by agent in Block 2.

let queueCounter = 0;
function nextQueueId(): string {
  queueCounter++;
  return `aq-${String(queueCounter).padStart(3, "0")}`;
}

export function deriveActionQueue(
  shipperResults: ShipperPolicyResult[],
  dealResults: DealPolicyResult[],
  shippers: Shipper[],
  deals: Deal[]
): ActionQueueEntry[] {
  const entries: ActionQueueEntry[] = [];
  const now = new Date().toISOString();

  for (const result of shipperResults) {
    if (result.status !== "FLAGGED") continue;
    const shipper = shippers.find((s) => s.shipper_id === result.shipper_id)!;

    // Data quality — operational flag, not commercial routing
    if (result.breaches.some((b) => b.rule === "data_quality")) {
      entries.push({
        entry_id: nextQueueId(),
        deal_id: null,
        shipper_id: result.shipper_id,
        recommended_action: "replace_or_remove",
        owner: "Vertical Lead",
        priority: "P1",
        status: "not started",
        rationale: `${result.shipper_id} is missing account data — cannot assess pricing or collection health. Finance needs to fill in take rate, receivables days, and overdue ratio before this account can be reviewed.`,
        created_at: now,
      });
      continue;
    }

    // Collection breach — highest priority, routes to Collections Owner
    if (
      result.breaches.some(
        (b) => b.rule === "ar_days_check" || b.rule === "overdue_check"
      )
    ) {
      const owner: EscalationOwner = "Collections Owner";
      const isAlsoPricingBad = result.breaches.some(
        (b) => b.rule === "take_rate_check"
      );
      entries.push({
        entry_id: nextQueueId(),
        deal_id: null,
        shipper_id: result.shipper_id,
        recommended_action: isAlsoPricingBad ? "volume_cap" : "collection_sprint",
        owner,
        priority: "P0",
        status: "not started",
        rationale: result.breaches
          .filter((b) => b.rule === "ar_days_check" || b.rule === "overdue_check")
          .map((b) => b.detail)
          .join("; "),
        created_at: now,
      });
    }

    // Pricing breach only (no collection breach handled above)
    if (
      result.breaches.some((b) => b.rule === "take_rate_check") &&
      !result.breaches.some(
        (b) => b.rule === "ar_days_check" || b.rule === "overdue_check"
      )
    ) {
      const owner: EscalationOwner = shipper.strategic
        ? "Commercial Manager"
        : "Vertical Lead";
      entries.push({
        entry_id: nextQueueId(),
        deal_id: null,
        shipper_id: result.shipper_id,
        recommended_action: shipper.strategic
          ? "tolerate_strategic"
          : "take_rate_enhancement",
        owner,
        priority: "P1",
        status: "not started",
        rationale: result.breaches
          .find((b) => b.rule === "take_rate_check")!.detail,
        created_at: now,
      });
    }
  }

  // Deal-level flags — group by shipper, create one entry per shipper per breach type
  const dealsByShipper = new Map<string, DealPolicyResult[]>();
  for (const r of dealResults.filter((r) => r.status === "FLAGGED")) {
    const existing = dealsByShipper.get(r.shipper_id) ?? [];
    existing.push(r);
    dealsByShipper.set(r.shipper_id, existing);
  }

  for (const [shipperId, flaggedDeals] of Array.from(dealsByShipper.entries())) {
    // Skip if shipper already has a shipper-level entry above
    const hasShipperEntry = entries.some((e) => e.shipper_id === shipperId);

    const bandOrMarginBreaches = flaggedDeals.filter((r) =>
      r.breaches.some(
        (b) => b.rule === "band_check" || b.rule === "margin_check"
      )
    );
    const fieldBreaches = flaggedDeals.filter((r) =>
      r.breaches.some((b) => b.rule === "fields_check")
    );

    if (bandOrMarginBreaches.length > 0 && !hasShipperEntry) {
      const shipper = shippers.find((s) => s.shipper_id === shipperId)!;
      const hasNegativeMargin = bandOrMarginBreaches.some((r) =>
        r.breaches.some(
          (b) => b.rule === "margin_check" && b.detail.includes("negative")
        )
      );
      // Check if these deals are on the Karachi→Hyderabad lane (lane-specific issue)
      const dealsOnKH = bandOrMarginBreaches.filter((r) => {
        const deal = deals.find((d) => d.deal_id === r.deal_id);
        return deal?.lane === "Karachi → Hyderabad";
      });
      const isLaneSpecific =
        dealsOnKH.length === bandOrMarginBreaches.length && dealsOnKH.length > 0;

      entries.push({
        entry_id: nextQueueId(),
        deal_id: null,
        shipper_id: shipperId,
        recommended_action: hasNegativeMargin
          ? "price_up"
          : isLaneSpecific
          ? "price_up"
          : "take_rate_enhancement",
        owner: shipper.strategic ? "Commercial Manager" : "Vertical Lead",
        priority: hasNegativeMargin ? "P0" : "P1",
        status: "not started",
        rationale: `${bandOrMarginBreaches.length} deal(s) flagged for pricing breach${isLaneSpecific ? " on Karachi → Hyderabad lane" : ""}. ${hasNegativeMargin ? "Negative margin detected." : ""}`,
        created_at: now,
      });
    }

    if (fieldBreaches.length > 0 && !hasShipperEntry) {
      entries.push({
        entry_id: nextQueueId(),
        deal_id: null,
        shipper_id: shipperId,
        recommended_action: "replace_or_remove",
        owner: "Vertical Lead",
        priority: "P1",
        status: "not started",
        rationale: `${fieldBreaches.length} deal(s) missing required fields (segment, vertical). Cannot route to agent without complete data.`,
        created_at: now,
      });
    }
  }

  // Sort: P0 first, then by owner
  return entries.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "P0" ? -1 : 1;
    return a.owner.localeCompare(b.owner);
  });
}
