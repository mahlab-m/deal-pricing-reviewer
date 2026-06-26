import Link from "next/link";
import NavBar from "@/components/NavBar";
import TrafficLight from "@/components/TrafficLight";
import { runAllChecks } from "@/lib/policy-checker";
import { computeShipperHealth } from "@/lib/dashboard";
import type { Deal, RateCardCell, Shipper } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const rateCard: RateCardCell[] = require("@/data/rate-card.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shippers: Shipper[] = require("@/data/shippers.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const deals: Deal[] = require("@/data/deals.json");

export default function PortfolioPage() {
  const { dealResults, shipperResults } = runAllChecks(deals, shippers, rateCard);

  const inPolicyCount = dealResults.filter((r) => r.status === "IN_POLICY").length;
  const flaggedCount = dealResults.filter((r) => r.status === "FLAGGED").length;
  const inPolicyPct = ((inPolicyCount / dealResults.length) * 100).toFixed(1);

  const healthRows = shippers.map((shipper) => {
    const shipperResult = shipperResults.find((r) => r.shipper_id === shipper.shipper_id)!;
    const health = computeShipperHealth(shipper, shipperResult, dealResults, deals);
    const shipperDeals = dealResults.filter((r) => r.shipper_id === shipper.shipper_id);
    const flagged = shipperDeals.filter((r) => r.status === "FLAGGED").length;
    return { shipper, shipperResult, health, flagged, total: shipperDeals.length };
  });

  const sorted = [...healthRows].sort((a, b) => {
    const order = { red: 0, unscored: 1, yellow: 2, green: 3 };
    return order[a.health.overall] - order[b.health.overall];
  });

  const redCount = healthRows.filter((r) => r.health.overall === "red").length;
  const yellowCount = healthRows.filter((r) => r.health.overall === "yellow").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-900">Deal &amp; Pricing Governance</h1>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Deterministic policy engine that checks every deal against a USD rate card and flags
            exceptions for AI triage. Built on Trella&apos;s freight-pricing framework — synthetic
            data, real logic.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {shippers.length} shippers · {deals.length} deals · Click a row to drill down
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="In-Policy"       value={`${inPolicyPct}%`}    sub={`${inPolicyCount} / ${dealResults.length} deals`} color="emerald" />
          <StatCard label="Flagged Deals"   value={String(flaggedCount)}  sub="sent to AI review"              color="red"    />
          <StatCard label="Shippers at Risk" value={String(redCount)}     sub="one or more red lens"           color="red"    />
          <StatCard label="Watch List"       value={String(yellowCount)}  sub="yellow on at least one lens"   color="amber"  />
        </div>

        {/* Portfolio table */}
        <div className="rounded-lg border border-gray-200 overflow-x-auto bg-white">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Shipper</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Archetype</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide" title="Pricing Health — based on deal take rate and band compliance">Pricing</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide" title="Collection Health — based on AR days and overdue ratio">Collection</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide" title="Capacity Health — based on deal volume and strategic flag">Capacity</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Deals</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map(({ shipper, health, flagged, total }) => (
                <tr key={shipper.shipper_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 font-medium">{shipper.name}</span>
                      {shipper.strategic && (
                        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                          Strategic
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {shipper.shipper_id} · {shipper.volume_share_pct}% vol share
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {ARCHETYPE_LABEL[shipper.archetype] ?? shipper.archetype}
                  </td>
                  <td className="px-4 py-3 text-center"><TrafficLight status={health.pricing} /></td>
                  <td className="px-4 py-3 text-center"><TrafficLight status={health.collection} /></td>
                  <td className="px-4 py-3 text-center"><TrafficLight status={health.capacity} /></td>
                  <td className="px-4 py-3 text-center">
                    {flagged > 0 ? (
                      <span className="text-red-600 font-medium">
                        {flagged}<span className="text-gray-300 font-normal">/{total}</span>
                      </span>
                    ) : (
                      <span className="text-gray-400">{total}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/shipper/${shipper.shipper_id}`}
                      className="text-xs text-gray-400 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

const ARCHETYPE_LABEL: Record<string, string> = {
  "volume-strategic-pricing-thin":   "Volume-strategic, thin pricing",
  "collection-risk-viable-pricing":  "Collection risk, viable pricing",
  "dual-risk-pricing-collection":    "Dual risk: pricing + collection",
  "lane-specific-loss":              "Lane-specific loss",
  healthy:                           "Healthy",
  "unscored-incomplete-data":        "Unscored — incomplete data",
};

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: "emerald" | "red" | "amber";
}) {
  const valueColor = { emerald: "text-emerald-600", red: "text-red-600", amber: "text-amber-600" }[color];
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
      <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}
