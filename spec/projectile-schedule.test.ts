import { describe, expect, it } from "vitest";
import {
  activeProjectileLimit,
  MAX_ACTIVE_PROJECTILES,
  MIN_PROJECTILE_SPAWN_GAP,
  nextScheduledProjectile,
  type ProjectileSchedule,
} from "../projectile-schedule";

describe("projectile spawn pacing", () => {
  it("stages projectiles that become due at the same time", () => {
    const schedule: ProjectileSchedule = {
      elapsed: 72,
      mode: "standard",
      nextMeteorAt: 72,
      nextEnergyAt: 72,
      nextRepairAt: 80,
      lastProjectileSpawnAt: Number.NEGATIVE_INFINITY,
    };

    expect(nextScheduledProjectile(schedule, 0)).toBe("meteor");

    schedule.lastProjectileSpawnAt = schedule.elapsed;
    schedule.nextMeteorAt = schedule.elapsed + MIN_PROJECTILE_SPAWN_GAP;
    schedule.elapsed += MIN_PROJECTILE_SPAWN_GAP / 2;
    expect(nextScheduledProjectile(schedule, 1)).toBeNull();

    schedule.elapsed = 72 + MIN_PROJECTILE_SPAWN_GAP;
    expect(nextScheduledProjectile(schedule, 1)).toBe("energy");
  });

  it("adds one active-projectile slot every 30 seconds, up to eight", () => {
    expect(activeProjectileLimit(0)).toBe(1);
    expect(activeProjectileLimit(29.99)).toBe(1);
    expect(activeProjectileLimit(30)).toBe(2);
    expect(activeProjectileLimit(60)).toBe(3);
    expect(activeProjectileLimit(210)).toBe(MAX_ACTIVE_PROJECTILES);
    expect(activeProjectileLimit(600)).toBe(MAX_ACTIVE_PROJECTILES);
  });

  it("also separates an infinite-mode repair pickup from a meteor", () => {
    const schedule: ProjectileSchedule = {
      elapsed: 20,
      mode: "infinite",
      nextMeteorAt: 20,
      nextEnergyAt: 30,
      nextRepairAt: 19.5,
      lastProjectileSpawnAt: 19.7,
    };

    expect(nextScheduledProjectile(schedule, 0)).toBeNull();
    schedule.elapsed = 20.3;
    expect(nextScheduledProjectile(schedule, 0)).toBe("repair");
  });

  it.each(["standard", "infinite"] as const)(
    "keeps every %s-mode spawn staggered throughout a long round",
    (mode) => {
      const schedule: ProjectileSchedule = {
        elapsed: 0,
        mode,
        nextMeteorAt: 0.65,
        nextEnergyAt: 30,
        nextRepairAt: 8,
        lastProjectileSpawnAt: Number.NEGATIVE_INFINITY,
      };
      const spawnTimes: number[] = [];
      let activeSpawnTimes: number[] = [];
      const reachedLimits = new Set<number>();

      for (let elapsed = 0; elapsed <= 240; elapsed += 0.01) {
        schedule.elapsed = elapsed;
        activeSpawnTimes = activeSpawnTimes.filter(
          (spawnedAt) => elapsed - spawnedAt < 3.5,
        );
        const nextProjectile = nextScheduledProjectile(
          schedule,
          activeSpawnTimes.length,
        );
        if (!nextProjectile) continue;

        spawnTimes.push(elapsed);
        activeSpawnTimes.push(elapsed);
        expect(activeSpawnTimes.length).toBeLessThanOrEqual(
          activeProjectileLimit(elapsed),
        );
        if (activeSpawnTimes.length === activeProjectileLimit(elapsed)) {
          reachedLimits.add(activeSpawnTimes.length);
        }
        schedule.lastProjectileSpawnAt = elapsed;
        if (nextProjectile === "meteor") {
          schedule.nextMeteorAt = elapsed + MIN_PROJECTILE_SPAWN_GAP;
        } else if (nextProjectile === "energy") {
          schedule.nextEnergyAt = elapsed + 3.25;
        } else {
          const repairInterval = Math.min(
            9,
            Math.max(6.5, 9 - elapsed * 0.012),
          );
          schedule.nextRepairAt = elapsed + repairInterval;
        }
      }

      expect(reachedLimits).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
      for (let index = 1; index < spawnTimes.length; index += 1) {
        expect(spawnTimes[index] - spawnTimes[index - 1]).toBeGreaterThanOrEqual(
          MIN_PROJECTILE_SPAWN_GAP - 0.001,
        );
      }
    },
  );
});
