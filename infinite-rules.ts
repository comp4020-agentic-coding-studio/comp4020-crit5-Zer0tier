export interface RepairState {
  charge: number;
  integrity: number;
  repaired: boolean;
}

const REPAIR_PICKUP_CHARGE = 0.5;

/**
 * Blue pickups fill half of the repair charge. Completing the charge restores
 * one integrity point, up to the core's normal maximum, then empties it.
 */
export function collectRepairPickup(
  currentCharge: number,
  integrity: number,
  maxIntegrity: number,
): RepairState {
  const nextCharge = Math.min(1, currentCharge + REPAIR_PICKUP_CHARGE);
  if (nextCharge < 1) {
    return { charge: nextCharge, integrity, repaired: false };
  }

  const nextIntegrity = Math.min(maxIntegrity, integrity + 1);
  return {
    charge: 0,
    integrity: nextIntegrity,
    repaired: nextIntegrity > integrity,
  };
}
