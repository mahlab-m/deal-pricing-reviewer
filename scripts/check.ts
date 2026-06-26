import * as path from "path";
import type { Deal, RateCardCell, Shipper } from "../src/lib/types";
import { runAllChecks } from "../src/lib/policy-checker";

function loadJson<T>(filename: string): T {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(path.join(__dirname, "../src/data", filename)) as T;
}

function main(): void {
  const rateCard = loadJson<RateCardCell[]>("rate-card.json");
  const shippers = loadJson<Shipper[]>("shippers.json");
  const deals = loadJson<Deal[]>("deals.json");

  const { dealResults, shipperResults } = runAllChecks(deals, shippers, rateCard);

  const inPolicy = dealResults.filter((r) => r.status === "IN_POLICY");
  const flagged = dealResults.filter((r) => r.status === "FLAGGED");
  const pct = ((inPolicy.length / dealResults.length) * 100).toFixed(1);
  const flaggedPct = ((flagged.length / dealResults.length) * 100).toFixed(1);

  console.log("=".repeat(50));
  console.log("  DEAL & PRICING GOVERNANCE REVIEWER");
  console.log("  Policy Check Summary");
  console.log("=".repeat(50));
  console.log();
  console.log(`Total deals:   ${dealResults.length}`);
  console.log(
    `In-policy:     ${inPolicy.length}  (${pct}%)${
      parseFloat(pct) >= 70 && parseFloat(pct) <= 80 ? "  ✓ target met" : "  ✗ outside 70–80% target"
    }`
  );
  console.log(`Flagged:       ${flagged.length}  (${flaggedPct}%)`);
  console.log();

  // Breakdown by breach type
  const bandOnly = flagged.filter(
    (r) =>
      r.breaches.some((b) => b.rule === "band_check") &&
      !r.breaches.some((b) => b.rule === "margin_check") &&
      !r.breaches.some((b) => b.rule === "fields_check")
  );
  const marginOnly = flagged.filter(
    (r) =>
      r.breaches.some((b) => b.rule === "margin_check") &&
      !r.breaches.some((b) => b.rule === "band_check") &&
      !r.breaches.some((b) => b.rule === "fields_check")
  );
  const bandAndMargin = flagged.filter(
    (r) =>
      r.breaches.some((b) => b.rule === "band_check") &&
      r.breaches.some((b) => b.rule === "margin_check")
  );
  const fieldsOnly = flagged.filter((r) =>
    r.breaches.some((b) => b.rule === "fields_check")
  );

  console.log("Flagged breakdown:");
  console.log(`  band_check only:          ${bandOnly.length}`);
  console.log(`  margin_check only:        ${marginOnly.length}`);
  console.log(`  band + margin:            ${bandAndMargin.length}`);
  console.log(`  fields_check (missing):   ${fieldsOnly.length}`);
  console.log();

  // Shipper-level flags
  const shipperFlags = shipperResults.filter((s) => s.status === "FLAGGED");
  console.log(`Shipper-level flags: ${shipperFlags.length} of ${shipperResults.length}`);
  for (const result of shipperFlags) {
    const shipper = shippers.find((s) => s.shipper_id === result.shipper_id)!;
    const breachSummary = result.breaches.map((b) => b.detail).join(" | ");
    const strategicTag = shipper.strategic ? " [strategic]" : "";
    console.log(`  ${result.shipper_id}${strategicTag}  — ${breachSummary}`);
  }

  console.log();

  // Sample flagged deals (first 3)
  console.log("Sample flagged deals:");
  for (const r of flagged.slice(0, 3)) {
    const deal = deals.find((d) => d.deal_id === r.deal_id)!;
    const rateCell = rateCard.find(
      (c) =>
        c.lane === deal.lane &&
        c.tonnage_tier === deal.tonnage_tier &&
        c.vehicle_type === deal.vehicle_type
    );
    const breachLabels = r.breaches.map((b) => b.rule).join(", ");
    console.log(
      `  ${r.deal_id} | ${r.shipper_id} | ${deal.lane} | ${deal.tonnage_tier} | ${deal.vehicle_type}`
    );
    console.log(
      `    price: $${deal.proposed_price_usd}/ton  cost: $${deal.carrier_cost_usd}/ton  margin: ${(deal.margin_pct * 100).toFixed(1)}%`
    );
    if (rateCell) {
      console.log(
        `    floor: $${rateCell.carrier_cost_floor_usd}  band: [$${rateCell.band_lower_usd}, $${rateCell.band_upper_usd}]`
      );
    }
    console.log(`    BREACH: ${breachLabels}`);
    console.log();
  }

  // Exit with error if target not met — useful for CI
  if (parseFloat(pct) < 70 || parseFloat(pct) > 80) {
    console.error(
      `\n✗ In-policy rate ${pct}% is outside the 70–80% target. Re-tune seed data spread before Block 2.`
    );
    process.exit(1);
  }

  console.log(`✓ Policy split is within target. Ready for Block 2 sign-off.`);
}

main();
