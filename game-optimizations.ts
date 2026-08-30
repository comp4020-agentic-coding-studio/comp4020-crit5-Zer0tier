export const CORE_DAMAGE_RECOVERY_SECONDS = 0.72;

export interface VisualQualityProfile {
  pixelRatioCap: number;
  starDensity: number;
  warpStreakCount: number;
  spiralTrailSegments: number;
  projectileTrailDots: number;
  particleDensity: number;
  shadowScale: number;
}

const FULL_QUALITY: VisualQualityProfile = {
  pixelRatioCap: 2,
  starDensity: 1,
  warpStreakCount: 18,
  spiralTrailSegments: 9,
  projectileTrailDots: 3,
  particleDensity: 1,
  shadowScale: 1,
};

const COMPACT_QUALITY: VisualQualityProfile = {
  pixelRatioCap: 1.5,
  starDensity: 0.78,
  warpStreakCount: 11,
  spiralTrailSegments: 6,
  projectileTrailDots: 2,
  particleDensity: 0.72,
  shadowScale: 0.72,
};

export function visualQualityForViewport(
  width: number,
  height: number,
): VisualQualityProfile {
  const compact = Math.min(width, height) <= 520 || width * height <= 480_000;
  return compact ? COMPACT_QUALITY : FULL_QUALITY;
}

export function advanceDamageRecovery(
  remainingSeconds: number,
  deltaSeconds: number,
): number {
  return Math.max(0, remainingSeconds - Math.max(0, deltaSeconds));
}

export function coreCanTakeDamage(recoveryRemaining: number): boolean {
  return recoveryRemaining <= 0;
}

export function threatCueStrength(
  projectileDistance: number,
  shieldRadius: number,
): number {
  const cueStart = shieldRadius * 2.75;
  const cueEnd = shieldRadius * 1.04;
  const range = Math.max(1, cueStart - cueEnd);
  return Math.max(0, Math.min(1, (cueStart - projectileDistance) / range));
}
