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
