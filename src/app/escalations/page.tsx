import NavBar from "@/components/NavBar";
import ActionQueue from "@/components/ActionQueue";
import { runAllChecks } from "@/lib/policy-checker";
import { deriveActionQueue } from "@/lib/dashboard";
import type { Deal, RateCardCell, Shipper } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const rateCard: RateCardCell[] = require("@/data/rate-card.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shippers: Shipper[] = require("@/data/shippers.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const deals: Deal[] = require("@/data/deals.json");

export default function EscalationsPage() {
  const { dealResults, shipperResults } = runAllChecks(deals, shippers, rateCard);
  const queue = deriveActionQueue(shipperResults, dealResults, shippers, deals);

  const flaggedDealCount = dealResults.filter((r) => r.status === "FLAGGED").length;

  return (
    <div className="min-h-screen bg-slate-950">
      <NavBar />
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-white">Action Queue</h1>
          <p className="text-sm text-slate-500 mt-1">
            Derived from deterministic policy checks ·{" "}
            <span className="text-red-400">{flaggedDealCount} deals</span> flagged ·
            Enriched by AI review when a live API key is configured
          </p>
        </div>

        {/* AI Review callout */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg px-5 py-4 mb-8 flex items-start gap-4">
          <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
          <div>
            <div className="text-sm font-medium text-slate-200">
              Running on deterministic rules only
            </div>
            <div className="text-xs text-slate-500 mt-1 leading-relaxed">
              The queue below was built without the AI agent — policy rules alone are enough for 70–80% of decisions.
              Swap in a real Anthropic API key and call <code className="font-mono bg-slate-800 px-1 rounded text-slate-400">POST /api/review</code> to
              layer Claude on top of the {flaggedDealCount} flagged deals and get a written rationale for each one.
            </div>
          </div>
        </div>

        <ActionQueue initialEntries={queue} />

        {/* Breach routing reference */}
        <div className="mt-10 border-t border-slate-800 pt-6">
          <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">
            Escalation Routing Reference
          </h2>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <RoutingCard
              owner="Vertical Lead"
              triggers={["Pricing / margin breach", "Band check violation", "Data quality gaps"]}
              color="slate"
            />
            <RoutingCard
              owner="Collections Owner"
              triggers={["AR days > 60", "Overdue ratio > 20%", "Dual-risk accounts"]}
              color="amber"
            />
            <RoutingCard
              owner="Commercial Manager"
              triggers={["Strategic account exceptions", "Tolerate-strategic decisions", "High-value approve/reject"]}
              color="blue"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function RoutingCard({
  owner,
  triggers,
  color,
}: {
  owner: string;
  triggers: string[];
  color: "slate" | "amber" | "blue";
}) {
  const headerColor = {
    slate: "text-slate-300",
    amber: "text-amber-400",
    blue: "text-blue-400",
  }[color];

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <div className={`font-medium mb-3 ${headerColor}`}>{owner}</div>
      <ul className="space-y-1.5">
        {triggers.map((t) => (
          <li key={t} className="text-slate-500 flex items-start gap-1.5">
            <span className="text-slate-700 mt-0.5">·</span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
