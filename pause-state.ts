export type GameSessionPhase =
  | "ready"
  | "playing"
  | "paused"
  | "won"
  | "lost";

export function toggledPausePhase(
  phase: GameSessionPhase,
): GameSessionPhase {
  if (phase === "playing") return "paused";
  if (phase === "paused") return "playing";
  return phase;
}

export function gameSessionIsFrozen(phase: GameSessionPhase): boolean {
  return phase === "paused";
}
