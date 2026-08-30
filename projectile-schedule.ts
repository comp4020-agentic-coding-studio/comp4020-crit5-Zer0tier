export type ProjectileSpawnKind = "meteor" | "energy" | "repair";
export type ProjectileScheduleMode = "standard" | "infinite";

export interface ProjectileSchedule {
  elapsed: number;
  mode: ProjectileScheduleMode;
  nextMeteorAt: number;
  nextEnergyAt: number;
  nextRepairAt: number;
  lastProjectileSpawnAt: number;
}

// A short global gap makes separate threats readable, including when a pickup
// and a meteor happen to become due on the same frame.
export const MIN_PROJECTILE_SPAWN_GAP = 0.4;
export const MAX_ACTIVE_PROJECTILES = 8;

export function activeProjectileLimit(elapsed: number): number {
  return Math.min(MAX_ACTIVE_PROJECTILES, 1 + Math.floor(elapsed / 30));
}

export function nextScheduledProjectile(
  schedule: ProjectileSchedule,
  activeProjectileCount: number,
): ProjectileSpawnKind | null {
  if (activeProjectileCount >= activeProjectileLimit(schedule.elapsed)) {
    return null;
  }
  if (
    schedule.elapsed <
    schedule.lastProjectileSpawnAt + MIN_PROJECTILE_SPAWN_GAP - 1e-9
  ) {
    return null;
  }

  const candidates: Array<{ kind: ProjectileSpawnKind; dueAt: number }> = [
    { kind: "meteor", dueAt: schedule.nextMeteorAt },
  ];
  candidates.push(
    schedule.mode === "standard"
      ? { kind: "energy", dueAt: schedule.nextEnergyAt }
      : { kind: "repair", dueAt: schedule.nextRepairAt },
  );

  let next: (typeof candidates)[number] | undefined;
  for (const candidate of candidates) {
    if (schedule.elapsed < candidate.dueAt) continue;
    if (!next || candidate.dueAt < next.dueAt) next = candidate;
  }
  return next?.kind ?? null;
}
