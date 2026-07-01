import NavBar from "@/components/NavBar";

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">How It Works</h1>
        <p className="text-sm text-gray-500 mb-10">
          A walkthrough of the governance logic, data model, and AI layer.
        </p>

        <Section title="What problem does this solve?">
          <p>
            In freight, pricing decisions happen fast — a sales rep quotes a rate, ops confirms a
            carrier cost, and a deal is live. Without a governance layer, two things go wrong:
            deals get priced below carrier cost (margin goes negative) and high-risk shippers
            get extended credit they can&apos;t service.
          </p>
          <p className="mt-3">
            This tool runs a deterministic policy check on every deal and every shipper account in
            the portfolio. Deals that breach the rate card or margin floor get flagged. Shippers
            with high AR days or overdue ratios get flagged. The output is an action queue, routed
            by owner and sorted by priority.
          </p>
        </Section>

        <Section title="The two-layer architecture">
          <div className="space-y-4">
            <Layer
              number="1"
              label="Deterministic policy engine"
              color="emerald"
              description="Runs on every deal and shipper on page load. No API key needed. Covers ~75% of decisions automatically by comparing prices to the rate card and checking account health metrics against thresholds."
            />
            <Layer
              number="2"
              label="AI triage agent (Claude)"
              color="blue"
              description="Runs only on FLAGGED deals, via POST /api/review. Uses one tool (rate card lookup) and a 3-turn reasoning loop. Returns a structured verdict — approve exception, reject, or escalate — plus a written rationale. Requires a real Anthropic API key."
            />
          </div>
        </Section>

        <Section title="Deal checks (per deal)">
          <CheckTable
            rows={[
              {
                rule: "Band check",
                what: "Is the proposed price within the rate card band?",
                pass: "Price ≥ band_lower and ≤ band_upper",
                fail: "Price is outside the approved corridor for this lane / tonnage / vehicle",
              },
              {
                rule: "Margin check",
                what: "Is the gross margin acceptable?",
                pass: "Margin ≥ 5% and carrier cost > 0",
                fail: "Margin below 5% or negative (price below carrier cost)",
              },
              {
                rule: "Fields check",
                what: "Are required fields present?",
                pass: "Lane, tonnage tier, vehicle type, carrier cost all populated",
                fail: "One or more required fields is missing",
              },
            ]}
          />
        </Section>

        <Section title="Shipper account checks (per account)">
          <CheckTable
            rows={[
              {
                rule: "Take rate",
                what: "Is portfolio-level margin healthy?",
                pass: "Take rate ≥ 5% across all active deals",
                fail: "Account-wide margin is too thin — even if individual deals pass",
              },
              {
                rule: "AR days",
                what: "Is the shipper paying on time?",
                pass: "Average days to pay ≤ 60",
                fail: "Money is sitting in receivables too long — collections risk",
              },
              {
                rule: "Overdue ratio",
                what: "What share of invoices are overdue?",
                pass: "≤ 20% of invoice value is overdue",
                fail: "Too much of the book is past due — active collections needed",
              },
            ]}
          />
        </Section>

        <Section title="Health lenses">
          <p className="mb-4">
            Each shipper gets three independent health scores, derived from the checks above.
            The portfolio view shows them as traffic lights.
          </p>
          <div className="rounded border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-800">
                  <th className="text-left px-3 py-2 text-white font-medium uppercase tracking-wide w-40">Lens</th>
                  <th className="text-left px-3 py-2 text-white font-medium uppercase tracking-wide">Logic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-gray-700 font-medium">Pricing Health</td>
                  <td className="px-3 py-2.5 text-gray-500">Red if take rate fails or more than 30% of deals are flagged. Yellow if take rate is borderline (5–7%) or some deals are flagged. Green otherwise.</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-gray-700 font-medium">Collection Health</td>
                  <td className="px-3 py-2.5 text-gray-500">Red if AR days &gt; 60 or overdue ratio &gt; 20%. Yellow if AR days &gt; 45 or overdue ratio &gt; 12%. Green otherwise.</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-gray-700 font-medium">Capacity Health</td>
                  <td className="px-3 py-2.5 text-gray-500">Red if the shipper has flagged deals and is not strategic. Yellow if strategic with flagged deals (tolerated). Green if no flagged deals.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Shipper archetypes">
          <p className="mb-4">
            Each shipper is tagged with an archetype that describes the primary risk pattern.
            Archetypes are mutually exclusive and exhaustive.
          </p>
          <div className="rounded border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-800">
                  <th className="text-left px-3 py-2 text-white font-medium uppercase tracking-wide w-52">Archetype</th>
                  <th className="text-left px-3 py-2 text-white font-medium uppercase tracking-wide">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { key: "Healthy", desc: "Passes all deal and account checks. No action required." },
                  { key: "Volume-strategic, thin pricing", desc: "Large volume share, flagged as strategic, but portfolio take rate is below 5%. Needs Commercial Manager review — exceptions may be justified." },
                  { key: "Collection risk, viable pricing", desc: "Pricing is fine, but AR days or overdue ratio is breached. Collections Owner action needed." },
                  { key: "Dual risk: pricing + collection", desc: "Both pricing and collection checks fail. Highest-severity account type." },
                  { key: "Lane-specific loss", desc: "Most deals pass, but one or more specific lanes are priced below floor. Surgical repricing needed." },
                  { key: "Unscored — incomplete data", desc: "Missing take rate, AR days, or overdue ratio. Cannot be assessed until data is filled in." },
                ].map((a) => (
                  <tr key={a.key} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-700 font-medium">{a.key}</td>
                    <td className="px-3 py-2.5 text-gray-500">{a.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Action queue — what the codes mean">
          <div className="rounded border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-800">
                  <th className="text-left px-3 py-2 text-white font-medium uppercase tracking-wide w-48">Action</th>
                  <th className="text-left px-3 py-2 text-white font-medium uppercase tracking-wide">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { action: "Price Up", desc: "Proposed price is below the rate card band. Reprice to at least band_lower." },
                  { action: "Take Rate Enhancement", desc: "Account-level margin is thin. Negotiate better rates across the shipper's lanes." },
                  { action: "Volume Cap", desc: "Strategic account with deteriorating terms. Cap new bookings until pricing is fixed." },
                  { action: "Collection Sprint", desc: "AR days or overdue ratio breached. Ops and finance to clear outstanding invoices." },
                  { action: "Reduce Credit Terms", desc: "Credit window is too long relative to payment behaviour. Tighten terms on renewal." },
                  { action: "Tolerate (Strategic)", desc: "Breach exists but the account is flagged strategic. Commercial Manager approved toleration." },
                  { action: "Replace / Remove", desc: "Account fails multiple checks with no strategic justification. Off-board or replace." },
                ].map((r) => (
                  <tr key={r.action} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-700 font-medium">{r.action}</td>
                    <td className="px-3 py-2.5 text-gray-500">{r.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Rate card model">
          <p>
            The rate card has 96 cells: 8 lanes × 4 tonnage tiers (1–5 t, 5–10 t, 10–20 t,
            20+ t) × 3 vehicle types (flatbed, curtainsider, reefer). Each cell defines:
          </p>
          <div className="rounded border border-gray-200 overflow-hidden mt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-800">
                  <th className="text-left px-3 py-2 text-white font-medium uppercase tracking-wide w-52">Field</th>
                  <th className="text-left px-3 py-2 text-white font-medium uppercase tracking-wide">Definition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="hover:bg-gray-50">
                  <td className="px-3 py-2.5"><code className="font-mono bg-gray-100 px-1 rounded text-gray-700">carrier_cost_floor_usd</code></td>
                  <td className="px-3 py-2.5 text-gray-500">Minimum carrier cost — fuel cost (PKR) + fixed costs, converted at 280 PKR/USD. A 45% fuel component means fuel price swings shift only part of the floor.</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-3 py-2.5"><code className="font-mono bg-gray-100 px-1 rounded text-gray-700">band_lower_usd</code></td>
                  <td className="px-3 py-2.5 text-gray-500">floor × 1.05 — minimum viable price with 5% margin</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-3 py-2.5"><code className="font-mono bg-gray-100 px-1 rounded text-gray-700">band_upper_usd</code></td>
                  <td className="px-3 py-2.5 text-gray-500">floor × 1.35 — ceiling above which we are over-priced vs. market</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Make automation scenario">
          <p className="mb-4">
            The <strong className="text-gray-700">Weekly Report</strong> tab shows what a Make scenario
            would send every Monday. Here is the exact module sequence to wire it up:
          </p>
          <div className="space-y-3 mb-5">
            {[
              {
                n: "1",
                label: "Schedule",
                desc: 'Set to "Every week" → Monday → 09:00. This is the trigger — no webhook needed.',
              },
              {
                n: "2",
                label: "HTTP › Make a request",
                desc: 'Method: GET. URL: https://your-domain.com/api/weekly-report. Parse response: Yes. The module returns the full JSON report object.',
              },
              {
                n: "3",
                label: "Router",
                desc: "Split into three branches — one per escalation owner. Filter condition per branch: {{2.action_queue.by_owner.`Vertical Lead`.length}} > 0 (and same for the other owners).",
              },
              {
                n: "4a",
                label: "Gmail › Send an email  (Vertical Lead branch)",
                desc: "To: vertical-lead@company.com. Subject: [{{2.period_label}}] Your pricing actions. Body: map {{2.markdown}} or build a custom HTML body using the by_owner array.",
              },
              {
                n: "4b",
                label: "Gmail › Send an email  (Collections Owner branch)",
                desc: "Same pattern — different recipient, filtered to Collections Owner items from the JSON.",
              },
              {
                n: "4c",
                label: "Gmail › Send an email  (Commercial Manager branch)",
                desc: "Same pattern for Commercial Manager items.",
              },
              {
                n: "5",
                label: "Gmail › Send summary",
                desc: "Final module (outside the router). Always runs. Sends the full {{2.markdown}} to yourself as the weekly governance digest.",
              },
            ].map((m) => (
              <div key={m.n} className="bg-white rounded border border-gray-200 px-4 py-3 flex gap-3">
                <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {m.n}
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-700">{m.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{m.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-200">
        {title}
      </h2>
      <div className="text-sm text-gray-500 leading-relaxed">{children}</div>
    </section>
  );
}

function Layer({
  number,
  label,
  color,
  description,
}: {
  number: string;
  label: string;
  color: "emerald" | "blue";
  description: string;
}) {
  const dotColor = color === "emerald" ? "bg-emerald-600" : "bg-blue-600";
  const textColor = color === "emerald" ? "text-emerald-700" : "text-blue-700";
  return (
    <div className="bg-white rounded border border-gray-200 px-4 py-3 flex gap-3">
      <div className={`w-5 h-5 rounded-full ${dotColor} text-slate-950 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5`}>
        {number}
      </div>
      <div>
        <div className={`text-xs font-semibold ${textColor}`}>{label}</div>
        <div className="text-xs text-gray-400 mt-1">{description}</div>
      </div>
    </div>
  );
}

function CheckTable({
  rows,
}: {
  rows: { rule: string; what: string; pass: string; fail: string }[];
}) {
  return (
    <div className="rounded border border-gray-200 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-800">
            <th className="text-left px-3 py-2 text-white font-medium uppercase tracking-wide w-32">Rule</th>
            <th className="text-left px-3 py-2 text-white font-medium uppercase tracking-wide">What it checks</th>
            <th className="text-left px-3 py-2 text-white font-medium uppercase tracking-wide">Pass</th>
            <th className="text-left px-3 py-2 text-white font-medium uppercase tracking-wide">Fail</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.rule} className="hover:bg-gray-50">
              <td className="px-3 py-2.5 text-gray-700 font-medium">{r.rule}</td>
              <td className="px-3 py-2.5 text-gray-500">{r.what}</td>
              <td className="px-3 py-2.5 text-emerald-600">{r.pass}</td>
              <td className="px-3 py-2.5 text-red-600">{r.fail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

