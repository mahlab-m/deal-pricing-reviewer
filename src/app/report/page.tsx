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
    <div className="min-h-screen bg-slate-950">
      <NavBar />
      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">Weekly Report</h1>
              <p className="text-sm text-slate-500 mt-1">{period_label}</p>
            </div>
            <div className="text-xs text-slate-600 bg-slate-900 border border-slate-800 rounded px-3 py-2">
              <span className="text-slate-500">Endpoint:</span>{" "}
              <code className="font-mono text-slate-400">GET /api/weekly-report</code>
            </div>
          </div>
        </div>

        {/* Make callout */}
        <div className="bg-slate-900 border border-blue-900 rounded-lg px-5 py-4 mb-8 flex items-start gap-4">
          <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
          <div>
            <div className="text-sm font-medium text-slate-200">Make scenario target</div>
            <div className="text-xs text-slate-500 mt-1 leading-relaxed">
              In Make, an HTTP module calls{" "}
              <code className="font-mono bg-slate-800 px-1 rounded text-slate-400">GET /api/weekly-report</code>{" "}
              on a Monday 09:00 schedule. The JSON response below is what Make receives and routes
              to email or Slack per owner. See the Guide tab for the full scenario spec.
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="In-Policy" value={`${summary.in_policy_pct}%`} sub={`${summary.in_policy} / ${summary.total_deals} deals`} color="emerald" />
          <StatCard label="Flagged" value={String(summary.flagged)} sub="need action" color="red" />
          <StatCard label="At Risk" value={String(summary.shippers_red)} sub="red on any lens" color="red" />
          <StatCard label="On Watch" value={String(summary.shippers_yellow)} sub="yellow on any lens" color="amber" />
        </div>

        {/* Action queue by owner */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Actions by Owner</h2>
          <div className="grid grid-cols-1 gap-4">
            {(["Vertical Lead", "Collections Owner", "Commercial Manager"] as const).map((owner) => {
              const items = action_queue.by_owner[owner];
              return (
                <div key={owner} className="bg-slate-900 rounded-lg border border-slate-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-300">{owner}</span>
                    <span className="text-xs text-slate-600">{items.length} action{items.length !== 1 ? "s" : ""}</span>
                  </div>
                  {items.length === 0 ? (
                    <p className="text-xs text-slate-700">No actions this week.</p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((e) => (
                        <div key={e.entry_id} className="flex items-start gap-3 text-xs">
                          <span className={`shrink-0 font-bold px-1.5 py-0.5 rounded border ${
                            e.priority === "P0"
                              ? "bg-red-950 text-red-400 border-red-900"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}>
                            {e.priority}
                          </span>
                          <div>
                            <span className="text-slate-300 font-medium">{e.shipper_id}</span>
                            <span className="text-slate-600 mx-1">—</span>
                            <span className="text-slate-400">{ACTION_LABELS[e.recommended_action] ?? e.recommended_action}</span>
                            <p className="text-slate-600 mt-0.5 leading-relaxed">{e.rationale}</p>
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
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Portfolio Health — Month-on-Month</h2>
          <div className="rounded-lg border border-slate-800 overflow-x-auto">
            <table className="w-full min-w-[600px] text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60">
                  {["Shipper", "Health", "Trend", "Margin Δ", "Take Rate Δ", "Overdue Δ"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-slate-500 font-medium uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {health_deltas.map((d) => (
                  <DeltaRow key={d.shipper_id} delta={d} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Markdown preview */}
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">
            Email / Slack body{" "}
            <span className="text-slate-600 font-normal">— what Make sends</span>
          </h2>
          <pre className="bg-slate-900 border border-slate-800 rounded-lg px-5 py-4 text-xs text-slate-400 leading-relaxed overflow-x-auto whitespace-pre-wrap">
            {markdown}
          </pre>
        </div>

      </main>
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  price_up: "Price Up",
  take_rate_enhancement: "Take Rate Enhancement",
  volume_cap: "Volume Cap",
  collection_sprint: "Collection Sprint",
  reduce_credit_terms: "Reduce Credit Terms",
  tolerate_strategic: "Tolerate (Strategic)",
  replace_or_remove: "Replace / Remove",
};

function DeltaRow({ delta }: { delta: HealthDelta }) {
  const fmt = (n: number | null, invert = false) => {
    if (n === null) return <span className="text-slate-700">—</span>;
    const positive = invert ? n < 0 : n > 0;
    const neutral = Math.abs(n) <= 0.5;
    const color = neutral
      ? "text-slate-500"
      : positive
      ? "text-emerald-400"
      : "text-red-400";
    const sign = n > 0 ? "+" : "";
    return <span className={color}>{sign}{n}pp</span>;
  };

  const trendIcon = delta.trend === "improving" ? "↑" : delta.trend === "deteriorating" ? "↓" : "→";
  const trendColor =
    delta.trend === "improving"
      ? "text-emerald-400"
      : delta.trend === "deteriorating"
      ? "text-red-400"
      : "text-slate-500";

  return (
    <tr className="hover:bg-slate-800/30 transition-colors">
      <td className="px-4 py-2.5 text-slate-300">{delta.name}</td>
      <td className="px-4 py-2.5">
        <HealthDot status={delta.health} />
      </td>
      <td className={`px-4 py-2.5 font-medium ${trendColor}`}>{trendIcon}</td>
      <td className="px-4 py-2.5">{fmt(delta.deltas.margin_pct)}</td>
      <td className="px-4 py-2.5">{fmt(delta.deltas.take_rate_pct)}</td>
      <td className="px-4 py-2.5">{fmt(delta.deltas.overdue_ratio, true)}</td>
    </tr>
  );
}

function HealthDot({ status }: { status: HealthStatus }) {
  const color = {
    green: "bg-emerald-500",
    yellow: "bg-amber-400",
    red: "bg-red-500",
    unscored: "bg-slate-600",
  }[status];
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function StatCard({
  label, value, sub, color,
}: {
  label: string; value: string; sub: string; color: "emerald" | "red" | "amber";
}) {
  const valueColor = { emerald: "text-emerald-400", red: "text-red-400", amber: "text-amber-400" }[color];
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 px-4 py-4">
      <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</div>
      <div className="text-xs text-slate-600 mt-0.5">{sub}</div>
    </div>
  );
}
