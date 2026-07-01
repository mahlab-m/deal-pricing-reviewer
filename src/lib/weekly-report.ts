import type {
  ActionQueueEntry,
  Deal,
  MonthlySnapshot,
  RateCardCell,
  Shipper,
} from "./types";
import { runAllChecks } from "./policy-checker";
import { computeShipperHealth, deriveActionQueue } from "./dashboard";
import type { HealthStatus } from "./dashboard";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthDelta {
  shipper_id: string;
  name: string;
  health: HealthStatus;
  trend: "improving" | "stable" | "deteriorating";
  current: { month: string; margin_pct: number; take_rate_pct: number; overdue_ratio: number };
  previous: { month: string; margin_pct: number; take_rate_pct: number; overdue_ratio: number } | null;
  deltas: { margin_pct: number | null; take_rate_pct: number | null; overdue_ratio: number | null };
}

export interface WeeklyReport {
  generated_at: string;
  period_label: string;
  summary: {
    total_deals: number;
    in_policy: number;
    flagged: number;
    in_policy_pct: number;
    shippers_total: number;
    shippers_red: number;
    shippers_yellow: number;
    shippers_green: number;
    shippers_unscored: number;
  };
  action_queue: {
    total: number;
    p0: number;
    p1: number;
    by_owner: {
      "Vertical Lead": ActionQueueEntry[];
      "Collections Owner": ActionQueueEntry[];
      "Commercial Manager": ActionQueueEntry[];
    };
  };
  health_deltas: HealthDelta[];
  markdown: string;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildWeeklyReport(
  shippers: Shipper[],
  deals: Deal[],
  history: MonthlySnapshot[],
  rateCard: RateCardCell[]
): WeeklyReport {
  const { dealResults, shipperResults } = runAllChecks(deals, shippers, rateCard);
  const queue = deriveActionQueue(shipperResults, dealResults, shippers, deals);

  const inPolicy = dealResults.filter((r) => r.status === "IN_POLICY").length;
  const flagged = dealResults.filter((r) => r.status === "FLAGGED").length;

  const healthCounts = { red: 0, yellow: 0, green: 0, unscored: 0 };
  for (const shipper of shippers) {
    const sr = shipperResults.find((r) => r.shipper_id === shipper.shipper_id)!;
    const h = computeShipperHealth(shipper, sr, dealResults, deals);
    healthCounts[h.overall]++;
  }

  const byOwner: WeeklyReport["action_queue"]["by_owner"] = {
    "Vertical Lead": queue.filter((e) => e.owner === "Vertical Lead"),
    "Collections Owner": queue.filter((e) => e.owner === "Collections Owner"),
    "Commercial Manager": queue.filter((e) => e.owner === "Commercial Manager"),
  };

  const healthDeltas = computeHealthDeltas(shippers, history, shipperResults, dealResults, deals);

  const generatedAt = new Date().toISOString();
  const periodLabel = `Week of ${new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;

  const summary: WeeklyReport["summary"] = {
    total_deals: deals.length,
    in_policy: inPolicy,
    flagged,
    in_policy_pct: +((inPolicy / deals.length) * 100).toFixed(1),
    shippers_total: shippers.length,
    shippers_red: healthCounts.red,
    shippers_yellow: healthCounts.yellow,
    shippers_green: healthCounts.green,
    shippers_unscored: healthCounts.unscored,
  };

  return {
    generated_at: generatedAt,
    period_label: periodLabel,
    summary,
    action_queue: {
      total: queue.length,
      p0: queue.filter((e) => e.priority === "P0").length,
      p1: queue.filter((e) => e.priority === "P1").length,
      by_owner: byOwner,
    },
    health_deltas: healthDeltas,
    markdown: buildMarkdown(periodLabel, summary, queue, byOwner, healthDeltas),
  };
}

// ─── Health deltas ────────────────────────────────────────────────────────────

function computeHealthDeltas(
  shippers: Shipper[],
  history: MonthlySnapshot[],
  shipperResults: ReturnType<typeof runAllChecks>["shipperResults"],
  dealResults: ReturnType<typeof runAllChecks>["dealResults"],
  deals: Deal[]
): HealthDelta[] {
  return shippers.map((shipper) => {
    const sorted = history
      .filter((h) => h.shipper_id === shipper.shipper_id)
      .sort((a, b) => b.month.localeCompare(a.month));

    const current = sorted[0] ?? null;
    const previous = sorted[1] ?? null;

    const sr = shipperResults.find((r) => r.shipper_id === shipper.shipper_id)!;
    const health = computeShipperHealth(shipper, sr, dealResults, deals).overall;

    const deltas = current && previous
      ? {
          margin_pct: +(current.margin_pct - previous.margin_pct).toFixed(1),
          take_rate_pct: +(current.take_rate_pct - previous.take_rate_pct).toFixed(1),
          overdue_ratio: +(current.overdue_ratio - previous.overdue_ratio).toFixed(1),
        }
      : { margin_pct: null, take_rate_pct: null, overdue_ratio: null };

    const pos = [
      (deltas.margin_pct ?? 0) > 0.5,
      (deltas.take_rate_pct ?? 0) > 0.5,
      (deltas.overdue_ratio ?? 0) < -2,
    ].filter(Boolean).length;
    const neg = [
      (deltas.margin_pct ?? 0) < -0.5,
      (deltas.take_rate_pct ?? 0) < -0.5,
      (deltas.overdue_ratio ?? 0) > 2,
    ].filter(Boolean).length;

    const trend: HealthDelta["trend"] =
      pos > neg ? "improving" : neg > pos ? "deteriorating" : "stable";

    return {
      shipper_id: shipper.shipper_id,
      name: shipper.name,
      health,
      trend,
      current: current
        ? { month: current.month, margin_pct: current.margin_pct, take_rate_pct: current.take_rate_pct, overdue_ratio: current.overdue_ratio }
        : { month: "-", margin_pct: 0, take_rate_pct: 0, overdue_ratio: 0 },
      previous: previous
        ? { month: previous.month, margin_pct: previous.margin_pct, take_rate_pct: previous.take_rate_pct, overdue_ratio: previous.overdue_ratio }
        : null,
      deltas,
    };
  });
}

// ─── Markdown builder ─────────────────────────────────────────────────────────

function buildMarkdown(
  periodLabel: string,
  summary: WeeklyReport["summary"],
  queue: ActionQueueEntry[],
  byOwner: WeeklyReport["action_queue"]["by_owner"],
  deltas: HealthDelta[]
): string {
  const ACTION_LABELS: Record<string, string> = {
    price_up: "Price Up",
    take_rate_enhancement: "Take Rate Enhancement",
    volume_cap: "Volume Cap",
    collection_sprint: "Collection Sprint",
    reduce_credit_terms: "Reduce Credit Terms",
    tolerate_strategic: "Tolerate (Strategic)",
    replace_or_remove: "Replace / Remove",
  };

  const p0Items = queue.filter((e) => e.priority === "P0");
  const trendIcon = (t: HealthDelta["trend"]) =>
    t === "improving" ? "↑" : t === "deteriorating" ? "↓" : "→";
  const healthIcon = (h: HealthStatus) =>
    h === "red" ? "🔴" : h === "yellow" ? "🟡" : h === "green" ? "🟢" : "⚪";

  const lines: string[] = [
    `# Pricing Governance - ${periodLabel}`,
    "",
    "## Portfolio Summary",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Deals in policy | ${summary.in_policy} / ${summary.total_deals} (${summary.in_policy_pct}%) |`,
    `| Flagged deals | ${summary.flagged} |`,
    `| Shippers at risk (red) | ${summary.shippers_red} |`,
    `| Shippers on watch (yellow) | ${summary.shippers_yellow} |`,
    `| Shippers healthy | ${summary.shippers_green} |`,
    "",
  ];

  if (p0Items.length > 0) {
    lines.push("## 🚨 P0 Escalations - Action Required", "");
    for (const e of p0Items) {
      lines.push(`**${e.shipper_id}** → ${ACTION_LABELS[e.recommended_action] ?? e.recommended_action} (${e.owner})`);
      lines.push(`> ${e.rationale}`);
      lines.push("");
    }
  }

  lines.push("## Actions by Owner", "");
  for (const [owner, items] of Object.entries(byOwner)) {
    if (items.length === 0) continue;
    lines.push(`### ${owner} (${items.length})`);
    lines.push("");
    for (const e of items) {
      lines.push(`- [${e.priority}] **${e.shipper_id}** - ${ACTION_LABELS[e.recommended_action] ?? e.recommended_action}`);
      lines.push(`  ${e.rationale}`);
    }
    lines.push("");
  }

  lines.push("## Portfolio Health - Month-on-Month", "");
  lines.push("| Shipper | Health | Trend | Margin Δ | Take Rate Δ | Overdue Δ |");
  lines.push("|---------|--------|-------|----------|-------------|-----------|");
  for (const d of deltas) {
    const m = d.deltas.margin_pct !== null ? `${d.deltas.margin_pct > 0 ? "+" : ""}${d.deltas.margin_pct}pp` : "-";
    const t = d.deltas.take_rate_pct !== null ? `${d.deltas.take_rate_pct > 0 ? "+" : ""}${d.deltas.take_rate_pct}pp` : "-";
    const o = d.deltas.overdue_ratio !== null ? `${d.deltas.overdue_ratio > 0 ? "+" : ""}${d.deltas.overdue_ratio}pp` : "-";
    lines.push(`| ${d.name} | ${healthIcon(d.health)} | ${trendIcon(d.trend)} | ${m} | ${t} | ${o} |`);
  }

  lines.push("");
  lines.push("---");
  lines.push(`*Generated automatically by the Deal & Pricing Governance tool.*`);

  return lines.join("\n");
}
