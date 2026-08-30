import { describe, expect, it } from "vitest";
import {
  advanceProjectileMotion,
  advanceSpiralDynamics,
  INITIAL_SPIRAL_CENTRIPETAL_FORCE,
  nearestViewportEdgeAngle,
  previousProjectileMotion,
  spiralAngularSpeed,
  spiralInwardSpeed,
} from "../projectile-motion";

describe("spiralling projectile motion", () => {
  it("rotates around the core while continuously moving inward", () => {
    const next = advanceProjectileMotion(
      { angle: 0, progress: 1 },
      0.14,
      1.18,
      1,
    );

    expect(next.angle).toBeCloseTo(1.18);
    expect(next.progress).toBeCloseTo(0.86);
  });

  it("reconstructs the curved trail behind the current position", () => {
    const current = { angle: 2.4, progress: 0.52 };
    const earlier = previousProjectileMotion(current, 0.14, 1.18, 0.5);

    expect(earlier.angle).toBeLessThan(current.angle);
    expect(earlier.progress).toBeGreaterThan(current.progress);
  });

  it("gains centripetal force, inward speed and angular speed gradually", () => {
    const initialForce = INITIAL_SPIRAL_CENTRIPETAL_FORCE;
    const initial = {
      angle: 0,
      progress: 1,
      centripetalForce: initialForce,
      speed: spiralInwardSpeed(initialForce),
      angularVelocity: spiralAngularSpeed(initialForce, 1),
    };
    const afterOneSecond = advanceSpiralDynamics(initial, 1, 1);
    const closerToCore = advanceSpiralDynamics(afterOneSecond, 0.45, 1);

    expect(afterOneSecond.centripetalForce).toBeGreaterThan(initialForce);
    expect(afterOneSecond.speed).toBeGreaterThan(initial.speed);
    expect(afterOneSecond.angularVelocity).toBeGreaterThan(
      initial.angularVelocity,
    );
    expect(closerToCore.angularVelocity).toBeGreaterThan(
      afterOneSecond.angularVelocity,
    );
    expect(closerToCore.progress).toBeLessThan(afterOneSecond.progress);
  });

  it("starts at the closest physical screen edge on desktop", () => {
    expect(
      nearestViewportEdgeAngle(
        { width: 1920, height: 1080, centreX: 960, centreY: 577.8 },
        0,
      ),
    ).toBeCloseTo(Math.PI / 2);
  });

  it("alternates between equally close portrait edges", () => {
    const viewport = { width: 390, height: 844, centreX: 195, centreY: 451.54 };
    expect(nearestViewportEdgeAngle(viewport, 0)).toBe(0);
    expect(nearestViewportEdgeAngle(viewport, 1)).toBeCloseTo(Math.PI);
  });
});
