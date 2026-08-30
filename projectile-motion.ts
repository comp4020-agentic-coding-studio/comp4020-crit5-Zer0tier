export interface ProjectileMotion {
  angle: number;
  progress: number;
}

export interface SpiralDynamics extends ProjectileMotion {
  speed: number;
  angularVelocity: number;
  centripetalForce: number;
}

export const INITIAL_SPIRAL_CENTRIPETAL_FORCE = 0.18;

export function spiralInwardSpeed(centripetalForce: number): number {
  return Math.min(0.135, 0.04 + centripetalForce * 0.16);
}

export function spiralAngularSpeed(
  centripetalForce: number,
  radiusRatio: number,
): number {
  return Math.min(
    1.85,
    Math.sqrt(centripetalForce / Math.max(0.12, radiusRatio)) * 0.9,
  );
}

export function advanceSpiralDynamics(
  dynamics: SpiralDynamics,
  radiusRatio: number,
  delta: number,
): SpiralDynamics {
  const direction = Math.sign(dynamics.angularVelocity) || 1;
  const centripetalForce = Math.min(
    0.62,
    dynamics.centripetalForce + delta * 0.035,
  );
  const speed = spiralInwardSpeed(centripetalForce);
  const angularVelocity =
    direction * spiralAngularSpeed(centripetalForce, radiusRatio);
  const motion = advanceProjectileMotion(
    dynamics,
    (dynamics.speed + speed) / 2,
    (dynamics.angularVelocity + angularVelocity) / 2,
    delta,
  );

  return {
    ...motion,
    speed,
    angularVelocity,
    centripetalForce,
  };
}

export interface ViewportCentre {
  width: number;
  height: number;
  centreX: number;
  centreY: number;
}

export function nearestViewportEdgeAngle(
  viewport: ViewportCentre,
  spawnIndex: number,
): number {
  const edges = [
    { angle: 0, distance: viewport.width - viewport.centreX },
    { angle: Math.PI / 2, distance: viewport.height - viewport.centreY },
    { angle: Math.PI, distance: viewport.centreX },
    { angle: -Math.PI / 2, distance: viewport.centreY },
  ];
  const minimumDistance = Math.min(...edges.map((edge) => edge.distance));
  const nearestEdges = edges.filter(
    (edge) => Math.abs(edge.distance - minimumDistance) < 0.5,
  );
  return nearestEdges[spawnIndex % nearestEdges.length].angle;
}

export function advanceProjectileMotion(
  motion: ProjectileMotion,
  speed: number,
  angularVelocity: number,
  delta: number,
): ProjectileMotion {
  return {
    angle: motion.angle + angularVelocity * delta,
    progress: motion.progress - speed * delta,
  };
}

export function previousProjectileMotion(
  motion: ProjectileMotion,
  speed: number,
  angularVelocity: number,
  secondsBehind: number,
): ProjectileMotion {
  return {
    angle: motion.angle - angularVelocity * secondsBehind,
    progress: motion.progress + speed * secondsBehind,
  };
}
