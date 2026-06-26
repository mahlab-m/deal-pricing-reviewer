"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { MonthlySnapshot } from "@/lib/types";

interface Props {
  history: MonthlySnapshot[];
}

const MONTH_SHORT: Record<string, string> = {
  "2025-10": "Oct",
  "2025-11": "Nov",
  "2025-12": "Dec",
  "2026-01": "Jan",
  "2026-02": "Feb",
  "2026-03": "Mar",
  "2026-04": "Apr",
  "2026-05": "May",
  "2026-06": "Jun",
};

export default function TrendChart({ history }: Props) {
  const data = history.map((s) => ({
    month: MONTH_SHORT[s.month] ?? s.month,
    "Margin %": parseFloat(s.margin_pct.toFixed(1)),
    "Take Rate %": parseFloat(s.take_rate_pct.toFixed(1)),
    "Overdue %": parseFloat(s.overdue_ratio.toFixed(1)),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="month"
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          axisLine={{ stroke: "#e5e7eb" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          unit="%"
        />
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            fontSize: 12,
            color: "#6b7280",
          }}
          labelStyle={{ color: "#111827", fontWeight: 600 }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af", paddingTop: 8 }} />
        <Line type="monotone" dataKey="Margin %"    stroke="#10b981" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
        <Line type="monotone" dataKey="Take Rate %" stroke="#3b82f6" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
        <Line type="monotone" dataKey="Overdue %"   stroke="#ef4444" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
