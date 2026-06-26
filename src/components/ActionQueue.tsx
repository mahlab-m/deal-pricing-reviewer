"use client";

import { useState } from "react";
import type { ActionQueueEntry, EscalationOwner } from "@/lib/types";

const OWNER_OPTIONS: Array<"All" | EscalationOwner> = [
  "All",
  "Vertical Lead",
  "Collections Owner",
  "Commercial Manager",
];

const ACTION_LABELS: Record<string, string> = {
  price_up: "Price Up",
  take_rate_enhancement: "Take Rate Enhancement",
  volume_cap: "Volume Cap",
  collection_sprint: "Collection Sprint",
  reduce_credit_terms: "Reduce Credit Terms",
  tolerate_strategic: "Tolerate (Strategic)",
  replace_or_remove: "Replace / Remove",
};

const STATUS_CYCLE: Record<
  ActionQueueEntry["status"],
  ActionQueueEntry["status"]
> = {
  "not started": "in progress",
  "in progress": "done",
  done: "not started",
};

const STATUS_STYLE: Record<ActionQueueEntry["status"], string> = {
  "not started": "text-slate-500 border-slate-700",
  "in progress": "text-amber-400 border-amber-800",
  done: "text-emerald-400 border-emerald-900",
};

interface Props {
  initialEntries: ActionQueueEntry[];
}

export default function ActionQueue({ initialEntries }: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [ownerFilter, setOwnerFilter] = useState<"All" | EscalationOwner>("All");

  const visible =
    ownerFilter === "All"
      ? entries
      : entries.filter((e) => e.owner === ownerFilter);

  const counts = {
    All: entries.length,
    "Vertical Lead": entries.filter((e) => e.owner === "Vertical Lead").length,
    "Collections Owner": entries.filter((e) => e.owner === "Collections Owner")
      .length,
    "Commercial Manager": entries.filter(
      (e) => e.owner === "Commercial Manager"
    ).length,
  };

  const p0Count = entries.filter((e) => e.priority === "P0").length;

  function cycleStatus(entryId: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.entry_id === entryId
          ? { ...e, status: STATUS_CYCLE[e.status] }
          : e
      )
    );
  }

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center gap-6 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{entries.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Total actions</div>
        </div>
        <div className="w-px h-8 bg-slate-800" />
        <div className="text-center">
          <div className="text-2xl font-bold text-red-400">{p0Count}</div>
          <div className="text-xs text-slate-500 mt-0.5">P0 priority</div>
        </div>
        <div className="w-px h-8 bg-slate-800" />
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-400">
            {entries.filter((e) => e.status === "done").length}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Done</div>
        </div>
      </div>

      {/* Owner filter tabs */}
      <div className="flex gap-1 mb-4">
        {OWNER_OPTIONS.map((owner) => (
          <button
            key={owner}
            onClick={() => setOwnerFilter(owner)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              ownerFilter === owner
                ? "bg-slate-700 text-white"
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
            }`}
          >
            {owner}
            {counts[owner] !== undefined && (
              <span className="ml-1.5 text-slate-600">
                {counts[owner as keyof typeof counts]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-800 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/60">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide w-20">
                Priority
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Shipper
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Recommended Action
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Owner
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide w-32">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-600 text-sm">
                  No actions for this owner.
                </td>
              </tr>
            )}
            {visible.map((entry) => (
              <tr
                key={entry.entry_id}
                className="hover:bg-slate-800/40 transition-colors group"
              >
                <td className="px-4 py-3">
                  <span
                    className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded ${
                      entry.priority === "P0"
                        ? "bg-red-950 text-red-400 border border-red-900"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}
                  >
                    {entry.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-slate-200 font-medium">
                    {entry.shipper_id}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5 max-w-xs truncate">
                    {entry.rationale}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {ACTION_LABELS[entry.recommended_action] ??
                    entry.recommended_action}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {entry.owner}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => cycleStatus(entry.entry_id)}
                    className={`text-xs border rounded px-2 py-0.5 cursor-pointer transition-colors ${STATUS_STYLE[entry.status]}`}
                  >
                    {entry.status}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-700 mt-3">
        Click a status badge to cycle: not started → in progress → done.
      </p>
    </div>
  );
}
