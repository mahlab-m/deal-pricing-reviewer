# Deal & Pricing Governance — AI Agent Evaluation
## What the agent gets right, where it fails, and how the system is designed around that

---

### What this document is

The AI agent in this tool (Claude, via the Anthropic SDK) runs on ~25% of deals —
the ones the deterministic rules engine flags but cannot resolve on its own.
This document defines how we would evaluate that agent, what accuracy to expect
by case type, where it is likely to fail, and what guardrails exist.

No real API key was used in this demo build. Accuracy estimates below are
synthetic — derived from the structure of the problem, not live runs.
To measure real accuracy: set ANTHROPIC_API_KEY and call POST /api/review,
then compare agent verdicts to the ground-truth outcomes in the deals JSON.

---

### What the agent is asked to do

For each flagged deal, the agent receives:
- The deal details (lane, tonnage tier, vehicle type, proposed price, carrier cost)
- The shipper account context (take rate, AR days, overdue ratio, strategic flag)
- Access to one tool: lookup_rate_card_cell(lane, tier, vehicle)

It runs up to 3 turns (look up the rate card, reason about the context,
produce a verdict) and returns:

```json
{
  "deal_id": "D-021",
  "verdict": "reject",
  "action": "price_up",
  "rationale": "Proposed $165 is 8.3% below the $180 band floor for CAI-ALX flatbed 5-10t. Strategic flag does not override margin floor on standard lanes.",
  "confidence": 0.87
}
```

Verdicts are typed: approve_exception / reject / escalate.
Escalate is the safe default for genuine ambiguity.

---

### Evaluation dimensions (what we would measure)

| Dimension | Question | Method |
|-----------|----------|--------|
| Verdict accuracy | Does the agent verdict match what a human reviewer would decide? | Hand-label 20–30 flagged deals, compare |
| Tool use rate | Does the agent always call lookup_rate_card_cell before deciding? | Count tool calls in response JSON |
| Escalation calibration | Are escalations genuinely ambiguous, or is the agent over-escalating? | Review escalated deals manually |
| Rationale quality | Is the rationale specific (cites numbers, lane, rule) vs. generic? | Qualitative review |
| Consistency | Does the same deal flagged twice get the same verdict? | Re-run same inputs 3x |

---

### Expected accuracy by case type

| Case type | Description | Expected accuracy | Why |
|-----------|-------------|-------------------|-----|
| Clear violation | Price well below floor, margin negative, no strategic flag | ~95% | Unambiguous — rules and AI agree |
| Clear pass exception | Strategic account, price marginally below floor, strong take rate | ~85% | Context is clear enough |
| Strategic + sub-floor | Strategic flag present but pricing significantly below floor | ~75% | Tradeoff between volume logic and margin discipline is judgment-dependent |
| Borderline take rate | Account take rate 5–7% (yellow zone, not a hard fail) | ~65% | Inherently subjective — right answer depends on commercial priorities |
| Multi-breach | Deal fails two or more checks simultaneously | ~80% | Agent may prioritise one signal inconsistently |
| Missing rate card cell | Lane/tier/vehicle combination not in the rate card | ~50% | Tool returns null; agent has no anchor and is guessing |
| Data quality deals | Shipper missing take_rate, AR days, or overdue ratio | ~90% | Easy reject — deterministic layer should catch these first |

Overall expected accuracy on flagged deals: **~80–85%** on clear cases,
**~65–75%** on edge cases. This is consistent with what you would expect
from a well-prompted LLM agent with a single tool, no fine-tuning,
and no retrieval beyond the rate card.

---

### Failure modes

**1. Strategic account over-tolerance**
The agent sees "strategic: true" and a rationale for thin pricing and
approves an exception that a human CM would reject. The strategic flag is
binary in the data — the agent cannot distinguish between a genuinely
strategic account (high growth, locked in) and one that was flagged
opportunistically by a sales rep. Risk: false approvals on bad accounts.

**2. Rate card hallucination**
If the agent skips the tool call and reasons from memory about what a
rate card "should" look like, it produces a verdict anchored on a
fabricated number. The 3-turn loop is designed to require the tool call,
but this is a latent risk in any tool-use agent. Mitigation: the response
schema requires the rate card values to be populated; if they are null,
the verdict is flagged for human review.

**3. Inconsistent borderline verdicts**
For deals in the 5–7% margin zone or AR days 45–60 (both yellow),
the same deal submitted twice may get different verdicts. LLMs are not
deterministic at temperature > 0. The action queue would show conflicting
entries for the same shipper if the agent is re-run without caching.
Mitigation: set temperature to 0 in production; cache verdicts by deal_id.

**4. Rationale without numbers**
Occasionally the agent produces a rationale that is directionally correct
but non-specific: "pricing is below acceptable levels." This fails the
audit trail requirement — a reviewer cannot act on it. Mitigation: the
system prompt requires the rationale to cite the specific proposed price,
the rate card band, and the delta. If it doesn't, the output is invalid.

**5. Multi-breach prioritisation error**
When a deal fails both a band check and the account fails an AR days check,
the agent must decide which owner to route to: Vertical Lead (pricing) or
Collections Owner (AR). It sometimes picks the wrong owner because it
treats the deal-level breach as higher priority than the account-level one.
Mitigation: the deterministic layer pre-assigns routing logic; the agent
can override but must flag it explicitly.

**6. Missing lane handling**
If a deal references a lane that does not exist in the rate card
(e.g., a new corridor being piloted), lookup_rate_card_cell returns null.
The agent then has no price anchor and tends to escalate — which is
the correct safe default. But in practice, a human reviewer receiving
an escalation for a missing lane needs different context than one
receiving an escalation for a marginal deal. The verdicts are not
distinguishable in the current output format.

---

### What is out of scope for the agent

- **Volume forecasting** — the agent cannot assess whether thin pricing
  on a high-volume shipper is justified by forward growth. It sees today's
  take rate, not the trajectory.
- **Contract terms** — the agent does not know whether a deal is locked in
  or renegotiable. A reject verdict on a locked deal is noise.
- **Market pricing** — the rate card is internal. The agent cannot compare
  against what competitors are charging or what the market will bear.
- **Relationship context** — it does not know if the shipper is in
  commercial negotiations, on a trial period, or at risk of churning.

These are the cases where the agent correctly escalates to Commercial Manager
and a human makes the call.

---

### Guardrails already built in

| Guardrail | How it works |
|-----------|-------------|
| Deterministic first | Agent never sees clear-pass or clear-fail deals — only the ambiguous 25% |
| Typed output | Verdict must be one of three values; free-text verdicts are rejected by the schema |
| Escalate default | When confidence is low or context is missing, the agent is instructed to escalate, not decide |
| Tool requirement | System prompt requires the rate card cell to be looked up before any verdict; null tool output = auto-escalate |
| Human review layer | All verdicts appear in the action queue for human sign-off before any commercial action is taken |
| Audit trail | Every queue entry carries the rationale, the rate card values used, and the deal context at time of verdict |

---

### What this means for the portfolio

This tool is not a decision-maker. It is a **triage assistant** that handles
the mechanical cases (clear violations) and surfaces the ambiguous ones
with context that helps a human decide faster. The ~80% accuracy on clear
cases means the agent is useful. The ~65% accuracy on borderline cases means
human review is non-negotiable. The architecture is designed around that split.

The honest version of this: without the deterministic layer, an AI-only
tool would need ~95%+ accuracy to be trusted in a commercial pricing context.
With the deterministic layer, you only need the agent to be accurate on
the genuinely hard cases — and you can tolerate more errors because the
escalation path exists and the human always has final say.

---

*Synthetic evaluation — no real API calls made in this build.*
*To run a real eval: set ANTHROPIC_API_KEY, call POST /api/review,*
*compare agent verdicts against ground truth in deals.json.*
