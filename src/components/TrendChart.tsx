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
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="month"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={{ stroke: "#1e293b" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          unit="%"
        />
        <Tooltip
          contentStyle={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 6,
            fontSize: 12,
            color: "#94a3b8",
          }}
          labelStyle={{ color: "#e2e8f0", fontWeight: 600 }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#64748b", paddingTop: 8 }}
        />
        <Line
          type="monotone"
          dataKey="Margin %"
          stroke="#34d399"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="Take Rate %"
          stroke="#60a5fa"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="Overdue %"
          stroke="#f87171"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
