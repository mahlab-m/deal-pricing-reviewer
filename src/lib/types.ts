// ─── Rate Card ───────────────────────────────────────────────────────────────

export type TonnageTier = "<5T" | "5-10T" | "10-20T" | "20T+";
export type VehicleType = "20 Ft" | "40 Ft" | "Mazda 17ft";

export interface RateCardCell {
  lane: string;
  tonnage_tier: TonnageTier;
  vehicle_type: VehicleType;
  band_lower_usd: number;
  band_upper_usd: number;
  carrier_cost_floor_usd: number;
}

// ─── Shippers ─────────────────────────────────────────────────────────────────

export type ShipperArchetype =
  | "volume-strategic-pricing-thin"
  | "collection-risk-viable-pricing"
  | "dual-risk-pricing-collection"
  | "lane-specific-loss"
  | "healthy"
  | "unscored-incomplete-data";

export interface Shipper {
  shipper_id: string;
  name: string;
  archetype: ShipperArchetype;
  volume_share_pct: number;
  strategic: boolean;
  take_rate_pct: number | null;
  ar_days: number | null;
  overdue_ratio: number | null;
  credit_terms_days: number | null;
}

// ─── Deals ────────────────────────────────────────────────────────────────────

export interface Deal {
  deal_id: string;
  shipper_id: string;
  lane: string;
  tonnage_tier: TonnageTier;
  vehicle_type: VehicleType;
  carrier_cost_usd: number;
  proposed_price_usd: number;
  segment: string;
  vertical: string;
  capacity_scarce: boolean;
  margin_pct: number;
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface MonthlySnapshot {
  shipper_id: string;
  month: string;
  margin_pct: number;
  take_rate_pct: number;
  overdue_ratio: number;
}

// ─── Policy Checker ───────────────────────────────────────────────────────────

export type PolicyBreachRule =
  | "band_check"
  | "margin_check"
  | "fields_check"
  | "take_rate_check"
  | "ar_days_check"
  | "overdue_check"
  | "data_quality";

export interface PolicyBreach {
  rule: PolicyBreachRule;
  detail: string;
}

export interface DealPolicyResult {
  deal_id: string;
  shipper_id: string;
  status: "IN_POLICY" | "FLAGGED";
  breaches: PolicyBreach[];
}

export interface ShipperPolicyResult {
  shipper_id: string;
  status: "HEALTHY" | "FLAGGED";
  breaches: PolicyBreach[];
}

// ─── Agent (Block 2) ──────────────────────────────────────────────────────────

export type AgentVerdict = "approve_exception" | "reject" | "escalate";
export type RecommendedAction =
  | "price_up"
  | "take_rate_enhancement"
  | "volume_cap"
  | "collection_sprint"
  | "reduce_credit_terms"
  | "tolerate_strategic"
  | "replace_or_remove";

export interface AgentReview {
  verdict: AgentVerdict;
  breached_policies: string[];
  rationale: string;
  recommended_action: RecommendedAction;
  confidence: "high" | "medium" | "low";
  escalate: boolean;
  human_review_reason: string | null;
}

// ─── Escalation Routing (Block 2) ─────────────────────────────────────────────

export type EscalationOwner =
  | "Vertical Lead"
  | "Collections Owner"
  | "Commercial Manager";
export type Priority = "P0" | "P1";
export type ActionStatus = "not started" | "in progress" | "done";

export interface ActionQueueEntry {
  entry_id: string;
  deal_id: string | null;
  shipper_id: string;
  recommended_action: RecommendedAction;
  owner: EscalationOwner;
  priority: Priority;
  status: ActionStatus;
  rationale: string;
  created_at: string;
}
