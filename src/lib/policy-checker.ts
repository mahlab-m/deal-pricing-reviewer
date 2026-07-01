import type {
  Deal,
  DealPolicyResult,
  PolicyBreach,
  RateCardCell,
  Shipper,
  ShipperPolicyResult,
} from "./types";
import { lookupCell } from "./rate-card";

const TAKE_RATE_FLOOR = 0.05;
const AR_DAYS_LIMIT = 60;
const OVERDUE_RATIO_LIMIT = 0.20;
const MARGIN_FLOOR = 0.05;

export function checkDeal(
  deal: Deal,
  rateCard: RateCardCell[]
): DealPolicyResult {
  const breaches: PolicyBreach[] = [];

  // 1. Required fields check
  const requiredFields: (keyof Deal)[] = [
    "deal_id",
    "shipper_id",
    "lane",
    "tonnage_tier",
    "vehicle_type",
    "carrier_cost_usd",
    "proposed_price_usd",
    "segment",
    "vertical",
  ];
  const missingFields = requiredFields.filter(
    (f) => deal[f] === null || deal[f] === undefined || deal[f] === ""
  );
  if (missingFields.length > 0) {
    breaches.push({
      rule: "fields_check",
      detail: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  // 2. Rate card lookup - if cell not found, treat as unrateable
  const cell = lookupCell(
    rateCard,
    deal.lane,
    deal.tonnage_tier,
    deal.vehicle_type
  );

  if (!cell) {
    breaches.push({
      rule: "band_check",
      detail: `No rate card cell found for lane=${deal.lane}, tier=${deal.tonnage_tier}, vehicle=${deal.vehicle_type}`,
    });
  } else {
    // 3. Band check
    const price = deal.proposed_price_usd;
    if (price < cell.band_lower_usd || price > cell.band_upper_usd) {
      breaches.push({
        rule: "band_check",
        detail: `Price $${price.toFixed(2)}/ton outside band [$${cell.band_lower_usd.toFixed(2)}, $${cell.band_upper_usd.toFixed(2)}]`,
      });
    }

    // 4. Margin check
    const margin =
      (deal.proposed_price_usd - deal.carrier_cost_usd) /
      deal.proposed_price_usd;
    const absoluteMargin = deal.proposed_price_usd - deal.carrier_cost_usd;
    if (margin < MARGIN_FLOOR || absoluteMargin < 0) {
      breaches.push({
        rule: "margin_check",
        detail: `Margin ${(margin * 100).toFixed(1)}% below floor ${MARGIN_FLOOR * 100}% (absolute: $${absoluteMargin.toFixed(2)})`,
      });
    }
  }

  return {
    deal_id: deal.deal_id,
    shipper_id: deal.shipper_id,
    status: breaches.length === 0 ? "IN_POLICY" : "FLAGGED",
    breaches,
  };
}

export function checkShipper(shipper: Shipper): ShipperPolicyResult {
  const breaches: PolicyBreach[] = [];

  // Data quality gate - if metrics are null, flag as unscored
  if (
    shipper.take_rate_pct === null &&
    shipper.ar_days === null &&
    shipper.overdue_ratio === null
  ) {
    breaches.push({
      rule: "data_quality",
      detail: "take_rate_pct, ar_days, overdue_ratio all null - cannot score",
    });
    return { shipper_id: shipper.shipper_id, status: "FLAGGED", breaches };
  }

  if (
    shipper.take_rate_pct !== null &&
    shipper.take_rate_pct < TAKE_RATE_FLOOR * 100
  ) {
    breaches.push({
      rule: "take_rate_check",
      detail: `Take-rate ${shipper.take_rate_pct.toFixed(1)}% below floor ${TAKE_RATE_FLOOR * 100}%`,
    });
  }

  if (shipper.ar_days !== null && shipper.ar_days > AR_DAYS_LIMIT) {
    breaches.push({
      rule: "ar_days_check",
      detail: `AR days ${shipper.ar_days} exceeds limit ${AR_DAYS_LIMIT}`,
    });
  }

  if (
    shipper.overdue_ratio !== null &&
    shipper.overdue_ratio > OVERDUE_RATIO_LIMIT * 100
  ) {
    breaches.push({
      rule: "overdue_check",
      detail: `Overdue ratio ${shipper.overdue_ratio.toFixed(1)}% exceeds limit ${OVERDUE_RATIO_LIMIT * 100}%`,
    });
  }

  return {
    shipper_id: shipper.shipper_id,
    status: breaches.length === 0 ? "HEALTHY" : "FLAGGED",
    breaches,
  };
}

export function runAllChecks(
  deals: Deal[],
  shippers: Shipper[],
  rateCard: RateCardCell[]
): {
  dealResults: DealPolicyResult[];
  shipperResults: ShipperPolicyResult[];
} {
  return {
    dealResults: deals.map((d) => checkDeal(d, rateCard)),
    shipperResults: shippers.map((s) => checkShipper(s)),
  };
}
