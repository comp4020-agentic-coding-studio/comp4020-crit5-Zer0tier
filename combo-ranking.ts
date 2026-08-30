export const PERFORMANCE_RANKS = [
  { minimumCombo: 0, label: "D", name: "Cadet" },
  { minimumCombo: 2, label: "C", name: "Sentinel" },
  { minimumCombo: 4, label: "B", name: "Guardian" },
  { minimumCombo: 7, label: "A", name: "Vanguard" },
  { minimumCombo: 11, label: "S", name: "Stellar" },
  { minimumCombo: 16, label: "S+", name: "Nova" },
  { minimumCombo: 24, label: "SS", name: "Eclipse" },
] as const;

export type PerformanceRank = (typeof PERFORMANCE_RANKS)[number];

export interface ComboProgress {
  combo: number;
  bestCombo: number;
  rank: PerformanceRank;
  rankedUp: boolean;
}

export function performanceRankForCombo(combo: number): PerformanceRank {
  const safeCombo = Math.max(0, Math.floor(combo));
  let rank: PerformanceRank = PERFORMANCE_RANKS[0];

  for (const candidate of PERFORMANCE_RANKS) {
    if (safeCombo < candidate.minimumCombo) break;
    rank = candidate;
  }

  return rank;
}

export function registerComboHit(
  combo: number,
  bestCombo: number,
): ComboProgress {
  const previousRank = performanceRankForCombo(combo);
  const nextCombo = Math.max(0, Math.floor(combo)) + 1;
  const rank = performanceRankForCombo(nextCombo);

  return {
    combo: nextCombo,
    bestCombo: Math.max(Math.floor(bestCombo), nextCombo),
    rank,
    rankedUp: rank.label !== previousRank.label,
  };
}

export function resetCombo(bestCombo: number): ComboProgress {
  return {
    combo: 0,
    bestCombo: Math.max(0, Math.floor(bestCombo)),
    rank: PERFORMANCE_RANKS[0],
    rankedUp: false,
  };
}
