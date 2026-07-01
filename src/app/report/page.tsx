import NavBar from "@/components/NavBar";
import { buildWeeklyReport } from "@/lib/weekly-report";
import type { Deal, MonthlySnapshot, RateCardCell, Shipper } from "@/lib/types";
import type { HealthDelta } from "@/lib/weekly-report";
import type { HealthStatus } from "@/lib/dashboard";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const rateCard: RateCardCell[] = require("@/data/rate-card.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shippers: Shipper[] = require("@/data/shippers.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const deals: Deal[] = require("@/data/deals.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const history: MonthlySnapshot[] = require("@/data/history.json");

export default function ReportPage() {
  const report = buildWeeklyReport(shippers, deals, history, rateCard);
  const { summary, action_queue, health_deltas, period_label, markdown } = report;

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-900">Weekly Report</h1>
          <p className="text-sm text-gray-500 mt-1">{period_label}</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="In-Policy" value={`${summary.in_policy_pct}%`}   sub={`${summary.in_policy} / ${summary.total_deals} deals`} color="emerald" />
          <StatCard label="Flagged"   value={String(summary.flagged)}        sub="need action"        color="red"    />
          <StatCard label="At Risk"   value={String(summary.shippers_red)}   sub="red on any lens"   color="red"    />
          <StatCard label="On Watch"  value={String(summary.shippers_yellow)} sub="yellow on any lens" color="amber" />
        </div>

        {/* Actions by owner */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Actions by Owner</h2>
          <div className="grid grid-cols-1 gap-4">
            {(["Vertical Lead", "Collections Owner", "Commercial Manager"] as const).map((owner) => {
              const items = action_queue.by_owner[owner];
              return (
                <div key={owner} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">{owner}</span>
                    <span className="text-xs text-gray-400">{items.length} action{items.length !== 1 ? "s" : ""}</span>
                  </div>
                  {items.length === 0 ? (
                    <p className="text-xs text-gray-300">No actions this week.</p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((e) => (
                        <div key={e.entry_id} className="flex items-start gap-3 text-xs">
                          <span className={`shrink-0 font-bold px-1.5 py-0.5 rounded border ${
                            e.priority === "P0"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-gray-100 text-gray-500 border-gray-200"
                          }`}>
                            {e.priority}
                          </span>
                          <div>
                            <span className="text-gray-800 font-medium">{e.shipper_id}</span>
                            <span className="text-gray-300 mx-1">-</span>
                            <span className="text-gray-600">{ACTION_LABELS[e.recommended_action] ?? e.recommended_action}</span>
                            <p className="text-gray-400 mt-0.5 leading-relaxed">{e.rationale}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Health deltas */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Portfolio Health - Month-on-Month</h2>
          <div className="rounded-lg border border-gray-200 overflow-x-auto bg-white">
            <table className="w-full min-w-[600px] text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-800">
                  {["Shipper", "Health", "Trend", "Margin Δ", "Take Rate Δ", "Overdue Δ"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-white font-medium uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {health_deltas.map((d) => <DeltaRow key={d.shipper_id} delta={d} />)}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  price_up: "Price Up", take_rate_enhancement: "Take Rate Enhancement",
  volume_cap: "Volume Cap", collection_sprint: "Collection Sprint",
  reduce_credit_terms: "Reduce Credit Terms", tolerate_strategic: "Tolerate (Strategic)",
  replace_or_remove: "Replace / Remove",
};

function DeltaRow({ delta }: { delta: HealthDelta }) {
  const fmt = (n: number | null, invert = false) => {
    if (n === null) return <span className="text-gray-300">-</span>;
    const positive = invert ? n < 0 : n > 0;
    const neutral = Math.abs(n) <= 0.5;
    const color = neutral ? "text-gray-400" : positive ? "text-emerald-600" : "text-red-600";
    return <span className={color}>{n > 0 ? "+" : ""}{n}pp</span>;
  };
  const trendColor = delta.trend === "improving" ? "text-emerald-600" : delta.trend === "deteriorating" ? "text-red-600" : "text-gray-400";
  const trendLabel = delta.trend === "improving" ? "Improving" : delta.trend === "deteriorating" ? "Declining" : "Stable";
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-2.5 text-gray-700">{delta.name}</td>
      <td className="px-4 py-2.5"><HealthDot status={delta.health} /></td>
      <td className={`px-4 py-2.5 font-medium ${trendColor}`}>{trendLabel}</td>
      <td className="px-4 py-2.5">{fmt(delta.deltas.margin_pct)}</td>
      <td className="px-4 py-2.5">{fmt(delta.deltas.take_rate_pct)}</td>
      <td className="px-4 py-2.5">{fmt(delta.deltas.overdue_ratio, true)}</td>
    </tr>
  );
}

function HealthDot({ status }: { status: HealthStatus }) {
  const color = { green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-500", unscored: "bg-gray-300" }[status];
  return <span className={`inline-block w-3 h-3 rounded-full ${color}`} />;
}

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: "emerald" | "red" | "amber";
}) {
  const valueColor = { emerald: "text-emerald-600", red: "text-red-600", amber: "text-amber-600" }[color];
  const bgColor = { emerald: "bg-emerald-50 border-emerald-100", red: "bg-red-50 border-red-100", amber: "bg-amber-50 border-amber-100" }[color];
  return (
    <div className={`rounded-lg border px-4 py-4 shadow-sm ${bgColor}`}>
      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
    </div>
  );
}
