import * as fs from "fs";
import * as path from "path";
import type {
  Deal,
  MonthlySnapshot,
  RateCardCell,
  Shipper,
  TonnageTier,
  VehicleType,
} from "../src/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const DIESEL_RATE_PKR = 310;
const PKR_PER_USD = 280;
const LITERS_PER_KM = 0.35;

const LANES: { name: string; km: number }[] = [
  { name: "Karachi → Lahore", km: 1210 },
  { name: "Lahore → Karachi", km: 1210 },
  { name: "Karachi → Multan", km: 850 },
  { name: "Multan → Karachi", km: 850 },
  { name: "Lahore → Islamabad", km: 370 },
  { name: "Islamabad → Lahore", km: 370 },
  { name: "Karachi → Hyderabad", km: 155 },
  { name: "Karachi → Faisalabad", km: 1050 },
];

const TONNAGE_TIERS: TonnageTier[] = ["<5T", "5-10T", "10-20T", "20T+"];
const VEHICLE_TYPES: VehicleType[] = ["20 Ft", "40 Ft", "Mazda 17ft"];

// Tonnage multipliers — heavier loads cost more per ton due to loading/unloading
const TONNAGE_MULTIPLIERS: Record<TonnageTier, number> = {
  "<5T": 1.6,
  "5-10T": 1.25,
  "10-20T": 1.0,
  "20T+": 0.85,
};

// Vehicle size adjustments (larger vehicles spread fixed costs across more tons)
const VEHICLE_MULTIPLIERS: Record<VehicleType, number> = {
  "Mazda 17ft": 1.35,
  "20 Ft": 1.0,
  "40 Ft": 0.80,
};

// Driver allowance + tolls + misc per trip (PKR), by distance bucket
function driverTollMisc(km: number): number {
  if (km < 200) return 3500;
  if (km < 500) return 6000;
  if (km < 900) return 9000;
  return 13000;
}

function buildFloorPkr(km: number, tonnageMult: number, vehicleMult: number): number {
  const fuelCostPerTrip = km * LITERS_PER_KM * DIESEL_RATE_PKR;
  const fixedCosts = driverTollMisc(km);
  const totalTripCost = fuelCostPerTrip + fixedCosts;
  // Per-ton cost, adjusted for load type and vehicle
  return (totalTripCost / 10) * tonnageMult * vehicleMult; // assume 10-ton base load
}

// ─── Rate Card ────────────────────────────────────────────────────────────────

function buildRateCard(): RateCardCell[] {
  const cells: RateCardCell[] = [];

  for (const lane of LANES) {
    for (const tier of TONNAGE_TIERS) {
      for (const vehicle of VEHICLE_TYPES) {
        const floorPkr = buildFloorPkr(
          lane.km,
          TONNAGE_MULTIPLIERS[tier],
          VEHICLE_MULTIPLIERS[vehicle]
        );
        const floorUsd = floorPkr / PKR_PER_USD;
        cells.push({
          lane: lane.name,
          tonnage_tier: tier,
          vehicle_type: vehicle,
          carrier_cost_floor_usd: round(floorUsd, 2),
          band_lower_usd: round(floorUsd * 1.05, 2),
          band_upper_usd: round(floorUsd * 1.35, 2),
        });
      }
    }
  }

  return cells;
}

// ─── Shippers ─────────────────────────────────────────────────────────────────

function buildShippers(): Shipper[] {
  return [
    {
      shipper_id: "shipper-01",
      name: "Shipper 01",
      archetype: "volume-strategic-pricing-thin",
      volume_share_pct: 22,
      strategic: true,
      take_rate_pct: 3.8,
      ar_days: 40,
      overdue_ratio: 10,
      credit_terms_days: 45,
    },
    {
      shipper_id: "shipper-02",
      name: "Shipper 02",
      archetype: "collection-risk-viable-pricing",
      volume_share_pct: 7,
      strategic: false,
      take_rate_pct: 7.5,
      ar_days: 82,
      overdue_ratio: 58,
      credit_terms_days: 30,
    },
    {
      shipper_id: "shipper-03",
      name: "Shipper 03",
      archetype: "dual-risk-pricing-collection",
      volume_share_pct: 8,
      strategic: false,
      take_rate_pct: 2.1,
      ar_days: 78,
      overdue_ratio: 55,
      credit_terms_days: 60,
    },
    {
      shipper_id: "shipper-04",
      name: "Shipper 04",
      archetype: "lane-specific-loss",
      volume_share_pct: 5,
      strategic: false,
      take_rate_pct: 6.8,
      ar_days: 30,
      overdue_ratio: 5,
      credit_terms_days: 30,
    },
    // Healthy shippers 05–11
    {
      shipper_id: "shipper-05",
      name: "Shipper 05",
      archetype: "healthy",
      volume_share_pct: 7,
      strategic: false,
      take_rate_pct: 9.2,
      ar_days: 28,
      overdue_ratio: 4,
      credit_terms_days: 30,
    },
    {
      shipper_id: "shipper-06",
      name: "Shipper 06",
      archetype: "healthy",
      volume_share_pct: 6,
      strategic: false,
      take_rate_pct: 11.5,
      ar_days: 22,
      overdue_ratio: 3,
      credit_terms_days: 15,
    },
    {
      shipper_id: "shipper-07",
      name: "Shipper 07",
      archetype: "healthy",
      volume_share_pct: 5,
      strategic: false,
      take_rate_pct: 8.0,
      ar_days: 45,
      overdue_ratio: 8,
      credit_terms_days: 45,
    },
    {
      shipper_id: "shipper-08",
      name: "Shipper 08",
      archetype: "healthy",
      volume_share_pct: 4,
      strategic: false,
      take_rate_pct: 10.3,
      ar_days: 35,
      overdue_ratio: 6,
      credit_terms_days: 30,
    },
    {
      shipper_id: "shipper-09",
      name: "Shipper 09",
      archetype: "healthy",
      volume_share_pct: 4,
      strategic: false,
      take_rate_pct: 7.8,
      ar_days: 50,
      overdue_ratio: 14,
      credit_terms_days: 45,
    },
    {
      shipper_id: "shipper-10",
      name: "Shipper 10",
      archetype: "healthy",
      volume_share_pct: 3,
      strategic: false,
      take_rate_pct: 12.1,
      ar_days: 18,
      overdue_ratio: 2,
      credit_terms_days: 15,
    },
    {
      shipper_id: "shipper-11",
      name: "Shipper 11",
      archetype: "healthy",
      volume_share_pct: 3,
      strategic: false,
      take_rate_pct: 6.5,
      ar_days: 42,
      overdue_ratio: 11,
      credit_terms_days: 30,
    },
    {
      shipper_id: "shipper-12",
      name: "Shipper 12",
      archetype: "unscored-incomplete-data",
      volume_share_pct: 4,
      strategic: false,
      take_rate_pct: null,
      ar_days: null,
      overdue_ratio: null,
      credit_terms_days: null,
    },
  ];
}

// ─── Deals ────────────────────────────────────────────────────────────────────

let dealCounter = 0;
function dealId(): string {
  dealCounter++;
  return `deal-${String(dealCounter).padStart(3, "0")}`;
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

function makeDeal(
  shipperId: string,
  lane: string,
  tier: TonnageTier,
  vehicle: VehicleType,
  cell: RateCardCell,
  type: "clean" | "thin" | "bad",
  extras: Partial<Deal> = {}
): Deal {
  let proposedPrice: number;
  let carrierCost: number;

  const floor = cell.carrier_cost_floor_usd;
  const lower = cell.band_lower_usd;
  const upper = cell.band_upper_usd;

  if (type === "clean") {
    // Price within band, margin ≥ 6%
    proposedPrice = round(lower + Math.random() * (upper - lower) * 0.8 + (upper - lower) * 0.1, 2);
    carrierCost = round(proposedPrice * (1 - 0.06 - Math.random() * 0.06), 2);
  } else if (type === "thin") {
    // Price within band but margin only 3–4.9% — fails margin_check, passes band_check
    // Represents a deal where price was negotiated inside the band but margin was squeezed
    proposedPrice = round(lower + Math.random() * (upper - lower) * 0.5, 2);
    const margin = 0.03 + Math.random() * 0.019; // 3.0–4.9%
    carrierCost = round(proposedPrice * (1 - margin), 2);
  } else {
    // bad: price below floor, negative or near-zero margin — indefensible
    proposedPrice = round(floor * (0.75 + Math.random() * 0.15), 2);
    carrierCost = round(floor * (0.85 + Math.random() * 0.12), 2);
  }

  const marginPct = round((proposedPrice - carrierCost) / proposedPrice, 4);

  return {
    deal_id: dealId(),
    shipper_id: shipperId,
    lane,
    tonnage_tier: tier,
    vehicle_type: vehicle,
    carrier_cost_usd: carrierCost,
    proposed_price_usd: proposedPrice,
    segment: "domestic",
    vertical: "manufacturing",
    capacity_scarce: false,
    margin_pct: marginPct,
    ...extras,
  };
}

function buildDeals(rateCard: RateCardCell[]): Deal[] {
  const deals: Deal[] = [];

  function getCell(lane: string, tier: TonnageTier, vehicle: VehicleType): RateCardCell {
    const c = rateCard.find(
      (r) => r.lane === lane && r.tonnage_tier === tier && r.vehicle_type === vehicle
    );
    if (!c) throw new Error(`No cell for ${lane} ${tier} ${vehicle}`);
    return c;
  }

  // ── shipper-01: 14 clean + 6 thin-margin deals ───────────────────────────────
  // Portfolio take-rate is 3.8% (fails shipper-level check) but individual deals
  // can still be priced within band. The thin-margin deals (margin 3–4.9%) flag
  // at deal level via margin_check; the clean deals pass entirely.
  // capacity_scarce=true on first 8 gives the agent a defensibility signal.
  const s01CleanLanes = [
    "Karachi → Lahore", "Karachi → Lahore", "Karachi → Lahore",
    "Lahore → Karachi", "Lahore → Karachi",
    "Karachi → Multan", "Karachi → Multan",
    "Karachi → Faisalabad", "Karachi → Faisalabad",
    "Multan → Karachi", "Multan → Karachi",
    "Lahore → Islamabad", "Islamabad → Lahore", "Karachi → Hyderabad",
  ];
  s01CleanLanes.forEach((lane, i) => {
    const tier: TonnageTier = "20T+";
    const vehicle: VehicleType = "40 Ft";
    const cell = getCell(lane, tier, vehicle);
    deals.push(
      makeDeal("shipper-01", lane, tier, vehicle, cell, "clean", {
        deal_id: dealId(),
        capacity_scarce: i < 8,
        vertical: "FMCG",
      })
    );
  });
  // 6 thin-margin deals — within band but margin 3–4.9%, triggers margin_check
  const s01ThinLanes = [
    "Karachi → Lahore", "Karachi → Lahore",
    "Lahore → Karachi", "Karachi → Multan",
    "Karachi → Faisalabad", "Multan → Karachi",
  ];
  s01ThinLanes.forEach((lane) => {
    const tier: TonnageTier = "20T+";
    const vehicle: VehicleType = "40 Ft";
    const cell = getCell(lane, tier, vehicle);
    deals.push(
      makeDeal("shipper-01", lane, tier, vehicle, cell, "thin", {
        deal_id: dealId(),
        capacity_scarce: true,
        vertical: "FMCG",
      })
    );
  });

  // ── shipper-02: 8 clean deals ─────────────────────────────────────────────
  // Collection risk but pricing is fine
  const s02Lanes = [
    "Karachi → Lahore", "Karachi → Lahore",
    "Lahore → Karachi", "Lahore → Karachi",
    "Karachi → Multan",
    "Multan → Karachi",
    "Karachi → Faisalabad",
    "Lahore → Islamabad",
  ];
  s02Lanes.forEach((lane) => {
    const tier: TonnageTier = "10-20T";
    const vehicle: VehicleType = "20 Ft";
    const cell = getCell(lane, tier, vehicle);
    deals.push(makeDeal("shipper-02", lane, tier, vehicle, cell, "clean", { vertical: "retail" }));
  });

  // ── shipper-03: 10 bad deals ─────────────────────────────────────────────
  // Dual-risk: pricing below floor + overdue
  const s03Lanes = [
    "Karachi → Lahore", "Karachi → Lahore", "Karachi → Lahore",
    "Lahore → Karachi", "Lahore → Karachi",
    "Karachi → Multan", "Karachi → Multan",
    "Karachi → Faisalabad",
    "Multan → Karachi",
    "Islamabad → Lahore",
  ];
  s03Lanes.forEach((lane) => {
    const tier: TonnageTier = "5-10T";
    const vehicle: VehicleType = "20 Ft";
    const cell = getCell(lane, tier, vehicle);
    deals.push(makeDeal("shipper-03", lane, tier, vehicle, cell, "bad", { vertical: "construction" }));
  });

  // ── shipper-04: 5 bad deals on Karachi→Hyderabad + 5 clean on other lanes ──
  // Lane-specific loss on K→H, fine everywhere else
  ["<5T", "<5T", "5-10T", "5-10T", "10-20T"].forEach((tier) => {
    const cell = getCell("Karachi → Hyderabad", tier as TonnageTier, "Mazda 17ft");
    deals.push(
      makeDeal("shipper-04", "Karachi → Hyderabad", tier as TonnageTier, "Mazda 17ft", cell, "bad", {
        vertical: "perishables",
      })
    );
  });
  ["Karachi → Lahore", "Lahore → Karachi", "Karachi → Multan", "Lahore → Islamabad", "Islamabad → Lahore"].forEach(
    (lane) => {
      const cell = getCell(lane, "10-20T", "20 Ft");
      deals.push(makeDeal("shipper-04", lane, "10-20T", "20 Ft", cell, "clean", { vertical: "perishables" }));
    }
  );

  // ── shipper-12: 3 deals with missing fields (fields_check breach) ──────────
  // Carrier cost and proposed price present but segment/vertical missing
  ["Karachi → Lahore", "Lahore → Karachi", "Karachi → Multan"].forEach((lane) => {
    const cell = getCell(lane, "10-20T", "20 Ft");
    const floor = cell.carrier_cost_floor_usd;
    const price = round(cell.band_lower_usd + (cell.band_upper_usd - cell.band_lower_usd) * 0.4, 2);
    const cost = round(price * 0.88, 2);
    deals.push({
      deal_id: dealId(),
      shipper_id: "shipper-12",
      lane,
      tonnage_tier: "10-20T",
      vehicle_type: "20 Ft",
      carrier_cost_usd: cost,
      proposed_price_usd: price,
      segment: "",       // deliberately blank
      vertical: "",      // deliberately blank
      capacity_scarce: false,
      margin_pct: round((price - cost) / price, 4),
    });
    void floor; // used implicitly via band construction
  });

  // ── shipper-05 to shipper-11: 54 clean deals spread across them ─────────────
  const healthyShippers = ["shipper-05", "shipper-06", "shipper-07", "shipper-08", "shipper-09", "shipper-10", "shipper-11"];
  const cleanLanePool: Array<{ lane: string; tier: TonnageTier; vehicle: VehicleType }> = [
    { lane: "Karachi → Lahore", tier: "20T+", vehicle: "40 Ft" },
    { lane: "Karachi → Lahore", tier: "10-20T", vehicle: "20 Ft" },
    { lane: "Lahore → Karachi", tier: "20T+", vehicle: "40 Ft" },
    { lane: "Lahore → Karachi", tier: "5-10T", vehicle: "20 Ft" },
    { lane: "Karachi → Multan", tier: "10-20T", vehicle: "20 Ft" },
    { lane: "Multan → Karachi", tier: "20T+", vehicle: "40 Ft" },
    { lane: "Lahore → Islamabad", tier: "<5T", vehicle: "Mazda 17ft" },
    { lane: "Islamabad → Lahore", tier: "5-10T", vehicle: "Mazda 17ft" },
    { lane: "Karachi → Faisalabad", tier: "20T+", vehicle: "40 Ft" },
    { lane: "Karachi → Hyderabad", tier: "<5T", vehicle: "Mazda 17ft" },
  ];

  const verticals = ["FMCG", "retail", "manufacturing", "pharma", "textiles", "auto-parts", "chemicals"];
  let poolIdx = 0;
  for (let s = 0; s < healthyShippers.length; s++) {
    const shipperId = healthyShippers[s];
    const count = s < 3 ? 9 : 8; // first 3 healthy shippers get 9 deals each, rest 8 → 9×3 + 8×4 = 59 — trim to 54
    const actualCount = s < 5 ? 8 : 7;
    for (let d = 0; d < actualCount; d++) {
      const laneConfig = cleanLanePool[poolIdx % cleanLanePool.length];
      poolIdx++;
      const cell = getCell(laneConfig.lane, laneConfig.tier, laneConfig.vehicle);
      deals.push(
        makeDeal(shipperId, laneConfig.lane, laneConfig.tier, laneConfig.vehicle, cell, "clean", {
          vertical: verticals[(s + d) % verticals.length],
          capacity_scarce: false,
        })
      );
    }
  }

  return deals;
}

// ─── History ──────────────────────────────────────────────────────────────────

function buildHistory(shippers: Shipper[]): MonthlySnapshot[] {
  const months = [
    "2025-10", "2025-11", "2025-12",
    "2026-01", "2026-02", "2026-03",
    "2026-04", "2026-05", "2026-06",
  ];

  const snapshots: MonthlySnapshot[] = [];

  // Archetype-driven trend generators
  function jitter(base: number, range: number): number {
    return round(base + (Math.random() - 0.5) * range, 2);
  }

  for (const shipper of shippers) {
    months.forEach((month, idx) => {
      let margin_pct: number;
      let take_rate_pct: number;
      let overdue_ratio: number;

      switch (shipper.archetype) {
        case "volume-strategic-pricing-thin":
          // Steadily thin, slight downward drift
          take_rate_pct = jitter(4.2 - idx * 0.04, 0.3);
          margin_pct = jitter(4.5 - idx * 0.05, 0.4);
          overdue_ratio = jitter(9, 2);
          break;
        case "collection-risk-viable-pricing":
          // Good pricing, worsening overdue over time
          take_rate_pct = jitter(7.5, 0.4);
          margin_pct = jitter(8.2, 0.6);
          overdue_ratio = jitter(35 + idx * 2.8, 4); // 35 → 57 over 9 months
          break;
        case "dual-risk-pricing-collection":
          // Deteriorating on both dimensions
          take_rate_pct = jitter(3.0 - idx * 0.1, 0.3);
          margin_pct = jitter(2.5 - idx * 0.1, 0.5);
          overdue_ratio = jitter(38 + idx * 2.5, 5);
          break;
        case "lane-specific-loss":
          // Healthy overall, but margin lower than peers (K→H drag)
          take_rate_pct = jitter(6.8, 0.4);
          margin_pct = jitter(5.2, 0.5);
          overdue_ratio = jitter(5, 1.5);
          break;
        case "healthy":
          // Stable healthy metrics, slight natural variation
          take_rate_pct = jitter(shipper.take_rate_pct ?? 8.0, 0.8);
          margin_pct = jitter(9.0, 1.0);
          overdue_ratio = jitter(shipper.overdue_ratio ?? 6, 2);
          break;
        case "unscored-incomplete-data":
          // Can't build history either — use proxy estimates
          take_rate_pct = jitter(6.0, 1.0);
          margin_pct = jitter(7.5, 1.2);
          overdue_ratio = jitter(8, 2);
          break;
      }

      snapshots.push({
        shipper_id: shipper.shipper_id,
        month,
        margin_pct: Math.max(margin_pct, -15),
        take_rate_pct: Math.max(take_rate_pct, 0),
        overdue_ratio: Math.min(Math.max(overdue_ratio, 0), 100),
      });
    });
  }

  return snapshots;
}

// ─── Write files ──────────────────────────────────────────────────────────────

function writeJson(filename: string, data: unknown): void {
  const filePath = path.join(__dirname, "../src/data", filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function main(): void {
  console.log("Generating seed data...\n");

  const rateCard = buildRateCard();
  writeJson("rate-card.json", rateCard);
  console.log(`✓ Rate card: ${rateCard.length} cells (${LANES.length} lanes × ${TONNAGE_TIERS.length} tonnage tiers × ${VEHICLE_TYPES.length} vehicle types)`);

  const shippers = buildShippers();
  writeJson("shippers.json", shippers);
  console.log(`✓ Shippers: ${shippers.length}`);

  const deals = buildDeals(rateCard);
  writeJson("deals.json", deals);
  console.log(`✓ Deals: ${deals.length}`);

  const history = buildHistory(shippers);
  writeJson("history.json", history);
  console.log(`✓ History: ${history.length} monthly snapshots (${shippers.length} shippers × 9 months)`);

  console.log("\nSeed complete. Run `npm run check` to validate policy split.");
}

main();
