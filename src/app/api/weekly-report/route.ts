import { NextResponse } from "next/server";
import { buildWeeklyReport } from "@/lib/weekly-report";
import type { Deal, MonthlySnapshot, RateCardCell, Shipper } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const rateCard: RateCardCell[] = require("@/data/rate-card.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shippers: Shipper[] = require("@/data/shippers.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const deals: Deal[] = require("@/data/deals.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const history: MonthlySnapshot[] = require("@/data/history.json");

export async function GET() {
  const report = buildWeeklyReport(shippers, deals, history, rateCard);
  return NextResponse.json(report);
}
