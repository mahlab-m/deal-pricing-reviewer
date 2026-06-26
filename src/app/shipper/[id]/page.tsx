import { notFound } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import TrafficLight from "@/components/TrafficLight";
import TrendChart from "@/components/TrendChart";
import { runAllChecks } from "@/lib/policy-checker";
import { computeShipperHealth } from "@/lib/dashboard";
import type { Deal, MonthlySnapshot, RateCardCell, Shipper } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const rateCard: RateCardCell[] = require("@/data/rate-card.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shippers: Shipper[] = require("@/data/shippers.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const allDeals: Deal[] = require("@/data/deals.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const history: MonthlySnapshot[] = require("@/data/history.json");

const ARCHETYPE_LABEL: Record<string, string> = {
  "volume-strategic-pricing-thin":  "Volume-strategic, thin pricing",
  "collection-risk-viable-pricing": "Collection risk, viable pricing",
  "dual-risk-pricing-collection":   "Dual risk: pricing + collection",
  "lane-specific-loss":             "Lane-specific loss",
  healthy:                          "Healthy",
  "unscored-incomplete-data":       "Unscored — incomplete data",
};

export default async function ShipperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shipper = shippers.find((s) => s.shipper_id === id);
  if (!shipper) notFound();

  const { dealResults, shipperResults } = runAllChecks(allDeals, shippers, rateCard);
  const shipperResult = shipperResults.find((r) => r.shipper_id === id)!;
  const health = computeShipperHealth(shipper, shipperResult, dealResults, allDeals);

  const shipperDeals = allDeals.filter((d) => d.shipper_id === id);
  const shipperDealResults = dealResults.filter((r) => r.shipper_id === id);
  const shipperHistory = history.filter((h) => h.shipper_id === id).sort((a, b) => a.month.localeCompare(b.month));
  const flaggedDeals = shipperDealResults.filter((r) => r.status === "FLAGGED");
  const breachMap = new Map(shipperDealResults.map((r) => [r.deal_id, r.breaches]));

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Back */}
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-700 transition-colors mb-6 inline-flex items-center gap-1">
          ← Portfolio
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-6 mt-2">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">{shipper.name}</h1>
              {shipper.strategic && (
                <span
                  className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded cursor-default"
                  title="Strategic account — pricing exceptions may be tolerated at Commercial Manager discretion."
                >
                  Strategic
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {ARCHETYPE_LABEL[shipper.archetype]} · {shipper.volume_share_pct}% volume share
            </div>
          </div>
          <div className="flex gap-3">
            <LensChip label="Pricing"    status={health.pricing}    />
            <LensChip label="Collection" status={health.collection} />
            <LensChip label="Capacity"   status={health.capacity}   />
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <MetricCard
            label="Take Rate"
            value={shipper.take_rate_pct !== null ? `${shipper.take_rate_pct}%` : "—"}
            floor="Floor: 5.0%"
            status={shipper.take_rate_pct === null ? "unscored" : shipper.take_rate_pct < 5 ? "red" : shipper.take_rate_pct < 7 ? "yellow" : "green"}
          />
          <MetricCard
            label="Accounts Receivable Days (AR Days)"
            value={shipper.ar_days !== null ? `${shipper.ar_days}d` : "—"}
            floor="Limit: 60 days"
            status={shipper.ar_days === null ? "unscored" : shipper.ar_days > 60 ? "red" : shipper.ar_days > 45 ? "yellow" : "green"}
          />
          <MetricCard
            label="Overdue Ratio"
            value={shipper.overdue_ratio !== null ? `${shipper.overdue_ratio}%` : "—"}
            floor="Limit: 20%"
            status={shipper.overdue_ratio === null ? "unscored" : shipper.overdue_ratio > 20 ? "red" : shipper.overdue_ratio > 12 ? "yellow" : "green"}
          />
        </div>

        {/* 9-month trend */}
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 mb-8">
          <h2 className="text-sm font-medium text-gray-700 mb-4">9-Month Trend</h2>
          {shipperHistory.length > 0 ? (
            <TrendChart history={shipperHistory} />
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">No history available</p>
          )}
        </div>

        {/* Deal table */}
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            Deals in current book ({shipperDeals.length}){" "}
            {flaggedDeals.length > 0 && (
              <span className="text-red-600 font-normal">· {flaggedDeals.length} flagged</span>
            )}
          </h2>
          <div className="rounded-lg border border-gray-200 overflow-x-auto bg-white">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Deal", "Lane", "Tonnage", "Vehicle", "Price", "Cost", "Margin", "Status"].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shipperDeals.map((deal) => {
                  const breaches = breachMap.get(deal.deal_id) ?? [];
                  const isFlagged = breaches.length > 0;
                  return (
                    <tr key={deal.deal_id} className={`text-xs hover:bg-gray-50 transition-colors ${isFlagged ? "bg-red-50/50" : ""}`}>
                      <td className="px-3 py-2.5 font-mono text-gray-400">{deal.deal_id}</td>
                      <td className="px-3 py-2.5 text-gray-700">{deal.lane}</td>
                      <td className="px-3 py-2.5 text-gray-500">{deal.tonnage_tier}</td>
                      <td className="px-3 py-2.5 text-gray-500">{deal.vehicle_type}</td>
                      <td className="px-3 py-2.5 text-gray-700">${deal.proposed_price_usd.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-gray-500">${deal.carrier_cost_usd.toFixed(2)}</td>
                      <td className={`px-3 py-2.5 font-medium ${
                        deal.margin_pct < 0 ? "text-red-600" : deal.margin_pct < 0.05 ? "text-amber-600" : "text-emerald-600"
                      }`}>
                        {(deal.margin_pct * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-2.5">
                        {isFlagged ? (
                          <span
                            className="text-red-500 text-sm cursor-default"
                            title={breaches.map((b) => `${b.rule}: ${b.detail}`).join("\n")}
                          >
                            ⚑
                          </span>
                        ) : (
                          <span className="text-emerald-500 text-xs">✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function LensChip({ label, status }: { label: string; status: import("@/lib/dashboard").HealthStatus }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-white border border-gray-200 rounded px-3 py-2">
      <span className="text-xs text-gray-400">{label}</span>
      <TrafficLight status={status} showLabel />
    </div>
  );
}

function MetricCard({ label, value, floor, status }: {
  label: string; value: string; floor: string; status: import("@/lib/dashboard").HealthStatus;
}) {
  const valueColor = { green: "text-emerald-600", yellow: "text-amber-600", red: "text-red-600", unscored: "text-gray-400" }[status];
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
      <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${valueColor}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{floor}</div>
      <div className="mt-2"><TrafficLight status={status} /></div>
    </div>
  );
}
