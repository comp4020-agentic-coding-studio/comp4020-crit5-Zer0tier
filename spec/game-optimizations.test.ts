import { describe, expect, it } from "vitest";
import {
  advanceDamageRecovery,
  CORE_DAMAGE_RECOVERY_SECONDS,
  coreCanTakeDamage,
  threatCueStrength,
  visualQualityForViewport,
} from "../game-optimizations";

describe("adaptive game optimisations", () => {
  it("reduces expensive canvas effects on compact screens", () => {
    const desktop = visualQualityForViewport(1920, 1080);
    const mobile = visualQualityForViewport(390, 844);

    expect(mobile.pixelRatioCap).toBeLessThan(desktop.pixelRatioCap);
    expect(mobile.warpStreakCount).toBeLessThan(desktop.warpStreakCount);
    expect(mobile.particleDensity).toBeLessThan(desktop.particleDensity);
    expect(mobile.shadowScale).toBeLessThan(desktop.shadowScale);
  });

  it("provides a short recovery window after real core damage", () => {
    expect(coreCanTakeDamage(0)).toBe(true);
    expect(coreCanTakeDamage(CORE_DAMAGE_RECOVERY_SECONDS)).toBe(false);
    expect(advanceDamageRecovery(CORE_DAMAGE_RECOVERY_SECONDS, 0.2)).toBeCloseTo(
      0.52,
    );
    expect(advanceDamageRecovery(0.1, 0.2)).toBe(0);
  });

  it("fades threat cues in only as hazards approach the shield", () => {
    expect(threatCueStrength(300, 100)).toBe(0);
    expect(threatCueStrength(190, 100)).toBeGreaterThan(0);
    expect(threatCueStrength(104, 100)).toBe(1);
  });
});
