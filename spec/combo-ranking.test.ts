import { describe, expect, it } from "vitest";
import {
  PERFORMANCE_RANKS,
  performanceRankForCombo,
  registerComboHit,
  resetCombo,
} from "../combo-ranking";

describe("shield-block combo ranking", () => {
  it("progresses through seven increasingly demanding ranks", () => {
    expect(PERFORMANCE_RANKS.map(({ label }) => label)).toEqual([
      "D",
      "C",
      "B",
      "A",
      "S",
      "S+",
      "SS",
    ]);
    expect(performanceRankForCombo(0).label).toBe("D");
    expect(performanceRankForCombo(2).label).toBe("C");
    expect(performanceRankForCombo(7).label).toBe("A");
    expect(performanceRankForCombo(24).label).toBe("SS");
  });

  it("increments the live combo and preserves the best combo", () => {
    expect(registerComboHit(6, 12)).toEqual({
      combo: 7,
      bestCombo: 12,
      rank: PERFORMANCE_RANKS[3],
      rankedUp: true,
    });
    expect(registerComboHit(7, 12)).toMatchObject({
      combo: 8,
      bestCombo: 12,
      rankedUp: false,
    });
  });

  it("keeps SS as the maximum rank for long infinite rounds", () => {
    expect(performanceRankForCombo(10_000).label).toBe("SS");
  });

  it("breaks the live combo without losing the round's best result", () => {
    expect(resetCombo(18)).toEqual({
      combo: 0,
      bestCombo: 18,
      rank: PERFORMANCE_RANKS[0],
      rankedUp: false,
    });
  });
});
