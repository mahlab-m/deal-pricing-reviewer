import type { RateCardCell, TonnageTier, VehicleType } from "./types";

const BASE_DIESEL_RATE_PKR = 310;
const PKR_PER_USD = 280;

export function lookupCell(
  rateCard: RateCardCell[],
  lane: string,
  tonnageTier: TonnageTier,
  vehicleType: VehicleType
): RateCardCell | undefined {
  return rateCard.find(
    (c) =>
      c.lane === lane &&
      c.tonnage_tier === tonnageTier &&
      c.vehicle_type === vehicleType
  );
}

// Adjusts only the 45% fuel component when diesel rate changes.
// Returns adjusted floor in USD.
export function adjustedFloor(
  cell: RateCardCell,
  dieselRatePkr: number
): number {
  const ratio = dieselRatePkr / BASE_DIESEL_RATE_PKR;
  const floorPkr = cell.carrier_cost_floor_usd * PKR_PER_USD;
  const fuelComponent = floorPkr * 0.45;
  const fixedComponent = floorPkr * 0.55;
  const adjustedPkr = fuelComponent * ratio + fixedComponent;
  return adjustedPkr / PKR_PER_USD;
}
