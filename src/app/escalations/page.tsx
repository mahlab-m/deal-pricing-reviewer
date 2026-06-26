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
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-900">Action Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            Derived from deterministic policy checks ·{" "}
            <span className="text-red-600">{flaggedDealCount} deals</span> flagged ·
            Enriched by AI review when a live API key is configured
          </p>
        </div>

        <ActionQueue initialEntries={queue} />

        {/* Escalation routing reference */}
        <div className="mt-10 border-t border-gray-200 pt-6">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
            Escalation Routing Reference
          </h2>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <RoutingCard owner="Vertical Lead"      triggers={["Pricing / margin breach", "Band check violation", "Data quality gaps"]}                            color="gray"  />
            <RoutingCard owner="Collections Owner"  triggers={["AR days > 60", "Overdue ratio > 20%", "Dual-risk accounts"]}                                      color="amber" />
            <RoutingCard owner="Commercial Manager" triggers={["Strategic account exceptions", "Tolerate-strategic decisions", "High-value approve/reject"]}       color="blue"  />
          </div>
        </div>
      </main>
    </div>
  );
}

function RoutingCard({ owner, triggers, color }: {
  owner: string; triggers: string[]; color: "gray" | "amber" | "blue";
}) {
  const headerColor = { gray: "text-gray-700", amber: "text-amber-600", blue: "text-blue-700" }[color];
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className={`font-medium mb-3 ${headerColor}`}>{owner}</div>
      <ul className="space-y-1.5">
        {triggers.map((t) => (
          <li key={t} className="text-gray-400 flex items-start gap-1.5">
            <span className="text-gray-300 mt-0.5">·</span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
