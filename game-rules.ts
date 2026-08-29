/**
 * The shield rule is deliberately independent from rendering and game state.
 * Angles are degrees so fixtures can describe readable, literal situations.
 */
export function shieldBlocks(
  projectileAngle: number,
  shieldAngle: number,
  shieldHalfArc: number,
): boolean {
  const wrappedDifference =
    ((projectileAngle - shieldAngle + 540) % 360) - 180;

  return Math.abs(wrappedDifference) <= shieldHalfArc;
}

export type ShieldContactState =
  | "approaching"
  | "overlapping"
  | "blocked"
  | "passed";

interface ShieldContact {
  previousDistance: number;
  distance: number;
  projectileAngle: number;
  shieldAngle: number;
  shieldRadius: number;
  projectileRadius: number;
  shieldHalfWidth: number;
  shieldHalfArc: number;
}

/**
 * Treat contact as a radial window, not a single checkpoint. This keeps a
 * projectile blockable for every frame in which its painted body intersects
 * the shield, and the swept segment prevents a low frame rate tunnelling
 * across that window.
 */
export function shieldContactState({
  previousDistance,
  distance,
  projectileAngle,
  shieldAngle,
  shieldRadius,
  projectileRadius,
  shieldHalfWidth,
  shieldHalfArc,
}: ShieldContact): ShieldContactState {
  const radialReach = projectileRadius + shieldHalfWidth;
  const outerEdge = shieldRadius + radialReach;
  const innerEdge = shieldRadius - radialReach;
  const segmentNearest = Math.min(previousDistance, distance);
  const segmentFarthest = Math.max(previousDistance, distance);

  if (segmentNearest > outerEdge) return "approaching";

  const crossesShieldBand =
    segmentNearest <= outerEdge && segmentFarthest >= innerEdge;
  if (
    crossesShieldBand &&
    shieldBlocks(projectileAngle, shieldAngle, shieldHalfArc)
  ) {
    return "blocked";
  }

  return distance < innerEdge ? "passed" : "overlapping";
}
