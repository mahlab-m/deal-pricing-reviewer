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
  price_up:               "Price Up",
  take_rate_enhancement:  "Take Rate Enhancement",
  volume_cap:             "Volume Cap",
  collection_sprint:      "Collection Sprint",
  reduce_credit_terms:    "Reduce Credit Terms",
  tolerate_strategic:     "Tolerate (Strategic)",
  replace_or_remove:      "Replace / Remove",
};

const STATUS_CYCLE: Record<ActionQueueEntry["status"], ActionQueueEntry["status"]> = {
  "not started": "in progress",
  "in progress": "done",
  done:          "not started",
};

const STATUS_STYLE: Record<ActionQueueEntry["status"], string> = {
  "not started": "text-gray-500 border-gray-300",
  "in progress": "text-amber-600 border-amber-300",
  done:          "text-emerald-600 border-emerald-300",
};

interface Props {
  initialEntries: ActionQueueEntry[];
}

export default function ActionQueue({ initialEntries }: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [ownerFilter, setOwnerFilter] = useState<"All" | EscalationOwner>("All");

  const visible = ownerFilter === "All" ? entries : entries.filter((e) => e.owner === ownerFilter);

  const counts = {
    All:                 entries.length,
    "Vertical Lead":     entries.filter((e) => e.owner === "Vertical Lead").length,
    "Collections Owner": entries.filter((e) => e.owner === "Collections Owner").length,
    "Commercial Manager":entries.filter((e) => e.owner === "Commercial Manager").length,
  };

  const p0Count = entries.filter((e) => e.priority === "P0").length;

  function cycleStatus(entryId: string) {
    setEntries((prev) =>
      prev.map((e) => e.entry_id === entryId ? { ...e, status: STATUS_CYCLE[e.status] } : e)
    );
  }

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center gap-6 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{entries.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">Total actions</div>
        </div>
        <div className="w-px h-8 bg-gray-200" />
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{p0Count}</div>
          <div className="text-xs text-gray-400 mt-0.5">P0 priority</div>
        </div>
        <div className="w-px h-8 bg-gray-200" />
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-600">
            {entries.filter((e) => e.status === "done").length}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">Done</div>
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
                ? "bg-gray-900 text-white"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            {owner}
            {counts[owner] !== undefined && (
              <span className="ml-1.5 text-gray-400">{counts[owner as keyof typeof counts]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-x-auto bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-800">
              <th className="text-left px-4 py-3 text-xs font-medium text-white uppercase tracking-wide w-24">Priority</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white uppercase tracking-wide">Shipper</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white uppercase tracking-wide">Recommended Action</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white uppercase tracking-wide">Owner</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white uppercase tracking-wide w-32">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No actions for this owner.
                </td>
              </tr>
            )}
            {visible.map((entry) => (
              <tr key={entry.entry_id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <span className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded border ${
                    entry.priority === "P0"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-gray-100 text-gray-500 border-gray-200"
                  }`}>
                    {entry.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-gray-900 font-medium">{entry.shipper_id}</div>
                  <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{entry.rationale}</div>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {ACTION_LABELS[entry.recommended_action] ?? entry.recommended_action}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{entry.owner}</td>
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
      <p className="text-xs text-gray-400 mt-3">
        Click a status badge to cycle: not started → in progress → done.
      </p>
    </div>
  );
}
