import { shieldBlocks } from "./game-rules";

type ProjectileKind = "meteor" | "energy";
type GamePhase = "playing" | "won" | "lost";
type SoundKind = "block" | "damage" | "repel" | "absorb" | "win";

interface Projectile {
  id: number;
  kind: ProjectileKind;
  angle: number;
  progress: number;
  speed: number;
  radius: number;
  spawnDistance: number;
  shieldResolved: boolean;
  alive: boolean;
  spin: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  duration: number;
  size: number;
  colour: string;
}

interface Ripple {
  x: number;
  y: number;
  age: number;
  duration: number;
  maxRadius: number;
  colour: string;
}

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
}

const canvas = requiredElement<HTMLCanvasElement>("#game-canvas");
const stage = requiredElement<HTMLElement>("#game-stage");
const integrityMeter = requiredElement<HTMLElement>("#integrity-meter");
const chargeMeter = requiredElement<HTMLElement>("#charge-meter");
const impactVignette = requiredElement<HTMLElement>("#impact-vignette");
const endScreen = requiredElement<HTMLElement>("#end-screen");
const endTitle = requiredElement<HTMLElement>("#end-title");
const endScore = requiredElement<HTMLElement>("#end-score");
const restartButton = requiredElement<HTMLButtonElement>("#restart-button");

const context = canvas.getContext("2d")!;
if (!context) throw new Error("Canvas 2D is unavailable");

const TAU = Math.PI * 2;
const TARGET_ENERGY = 10;
const MAX_INTEGRITY = 3;
const VISUAL_SHIELD_HALF_ARC_DEGREES = 24;
// The meteor body and rounded shield cap overlap beyond the centre-line arc.
// Seven extra degrees make the collision agree with what the player sees.
const COLLISION_SHIELD_HALF_ARC_DEGREES = 31;
const GOLDEN_ANGLE = 2.399963229728653;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let viewWidth = 1;
let viewHeight = 1;
let pixelRatio = 1;
let centreX = 0;
let centreY = 0;
let coreRadius = 30;
let shieldRadius = 100;
let projectileRadius = 9;
let stars: Star[] = [];
let animationFrame = 0;
let lastFrameTime = performance.now();
let audioContext: AudioContext | null = null;
let nextId = 1;

const heldKeys = new Set<string>();

const game = {
  phase: "playing" as GamePhase,
  elapsed: 0,
  integrity: MAX_INTEGRITY,
  energy: 0,
  blocks: 0,
  shieldAngle: -Math.PI / 2,
  targetAngle: -Math.PI / 2,
  nextMeteorAt: 0.65,
  nextEnergyAt: 30,
  meteorIndex: 0,
  energyIndex: 0,
  pressureWaveIndex: 0,
  projectiles: [] as Projectile[],
  particles: [] as Particle[],
  ripples: [] as Ripple[],
  shake: 0,
  corePulse: 0,
  shieldPulse: 0,
};

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function angleDifference(target: number, current: number): number {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

function resizeCanvas(): void {
  const rect = stage.getBoundingClientRect();
  viewWidth = Math.max(1, rect.width);
  viewHeight = Math.max(1, rect.height);
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.round(viewWidth * pixelRatio);
  canvas.height = Math.round(viewHeight * pixelRatio);
  canvas.style.width = `${viewWidth}px`;
  canvas.style.height = `${viewHeight}px`;

  centreX = viewWidth / 2;
  centreY = viewHeight * (viewHeight < 560 ? 0.55 : 0.535);
  const shortSide = Math.min(viewWidth, viewHeight);
  coreRadius = clamp(shortSide * 0.061, 23, 43);
  shieldRadius = clamp(shortSide * 0.22, 78, 154);
  projectileRadius = clamp(shortSide * 0.019, 7.5, 13);
  stars = createStars(Math.round(clamp((viewWidth * viewHeight) / 14000, 38, 110)));
}

function createStars(count: number): Star[] {
  let seed = 0x4f524249;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  return Array.from({ length: count }, () => ({
    x: random() * viewWidth,
    y: random() * viewHeight,
    size: 0.35 + random() * 1.15,
    alpha: 0.18 + random() * 0.46,
  }));
}

function restart(): void {
  game.phase = "playing";
  game.elapsed = 0;
  game.integrity = MAX_INTEGRITY;
  game.energy = 0;
  game.blocks = 0;
  game.shieldAngle = -Math.PI / 2;
  game.targetAngle = -Math.PI / 2;
  game.nextMeteorAt = 0.65;
  game.nextEnergyAt = 30;
  game.meteorIndex = 0;
  game.energyIndex = 0;
  game.pressureWaveIndex = 0;
  game.projectiles = [];
  game.particles = [];
  game.ripples = [];
  game.shake = 0;
  game.corePulse = 0;
  game.shieldPulse = 0;
  endScreen.hidden = true;
  delete endScreen.dataset.result;
  updateMeters();
  lastFrameTime = performance.now();
}

function updateMeters(): void {
  const integrityPips = integrityMeter.querySelectorAll("i");
  integrityPips.forEach((pip, index) => {
    pip.classList.toggle("is-filled", index < game.integrity);
  });
  integrityMeter.setAttribute(
    "aria-label",
    `Core integrity: ${game.integrity} of ${MAX_INTEGRITY}`,
  );

  const chargePips = chargeMeter.querySelectorAll("i");
  chargePips.forEach((pip, index) => {
    pip.classList.toggle("is-filled", index < game.energy);
  });
  chargeMeter.setAttribute(
    "aria-label",
    `Core charge: ${game.energy} of ${TARGET_ENERGY}`,
  );
}

function setEndState(result: Exclude<GamePhase, "playing">): void {
  if (game.phase !== "playing") return;
  game.phase = result;
  endScreen.dataset.result = result;
  endTitle.textContent = result === "won" ? "Orbit stable" : "Core lost";
  endScore.textContent = `${String(game.energy).padStart(2, "0")} / ${TARGET_ENERGY}`;
  endScreen.hidden = false;
  restartButton.focus({ preventScroll: true });
  if (result === "won") playSound("win");
}

function spawnProjectile(
  kind: ProjectileKind,
  angle: number,
  speedBoost = 0,
): void {
  game.projectiles.push({
    id: nextId++,
    kind,
    angle,
    progress: 1,
    speed: 0.205 + Math.min(game.elapsed / 240, 0.08) + speedBoost,
    radius: kind === "meteor" ? projectileRadius : projectileRadius * 0.84,
    spawnDistance: distanceToViewportEdge(angle) + projectileRadius * 5,
    shieldResolved: false,
    alive: true,
    spin: (nextId % 2 === 0 ? 1 : -1) * (0.9 + (nextId % 5) * 0.17),
  });
}

function distanceToViewportEdge(angle: number): number {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const horizontalDistance = cosine >= 0
    ? (viewWidth - centreX) / Math.max(cosine, 0.0001)
    : centreX / Math.max(-cosine, 0.0001);
  const verticalDistance = sine >= 0
    ? (viewHeight - centreY) / Math.max(sine, 0.0001)
    : centreY / Math.max(-sine, 0.0001);

  return Math.min(horizontalDistance, verticalDistance);
}

function spawnMeteor(): void {
  const angle = game.meteorIndex === 0 ? 0 : (game.meteorIndex * GOLDEN_ANGLE + 0.23) % TAU;
  game.meteorIndex += 1;
  spawnProjectile("meteor", angle);
}

function spawnEnergy(): void {
  const angle = (game.energyIndex * GOLDEN_ANGLE + Math.PI * 0.73) % TAU;
  game.energyIndex += 1;
  spawnProjectile("energy", angle, -0.035);
}

function spawnPressureWave(): void {
  const base = (game.pressureWaveIndex * 0.91 + 0.4) % TAU;
  game.pressureWaveIndex += 1;
  for (let index = 0; index < 3; index += 1) {
    spawnProjectile("meteor", base + (index * TAU) / 3, 0.07);
  }
}

function scheduleProjectiles(): void {
  if (game.elapsed >= game.nextMeteorAt) {
    if (game.elapsed >= 72) {
      spawnPressureWave();
      game.nextMeteorAt = game.elapsed + 3.7;
    } else {
      spawnMeteor();
      const interval = clamp(4.25 - game.elapsed * 0.052, 1.85, 4.25);
      game.nextMeteorAt = game.elapsed + interval;
    }
  }

  if (game.elapsed >= game.nextEnergyAt) {
    spawnEnergy();
    game.nextEnergyAt = game.elapsed + 3.25;
  }
}

function projectileDistance(projectile: Projectile): number {
  return coreRadius + projectile.progress * (projectile.spawnDistance - coreRadius);
}

function projectilePosition(projectile: Projectile): { x: number; y: number } {
  const distance = projectileDistance(projectile);
  return {
    x: centreX + Math.cos(projectile.angle) * distance,
    y: centreY + Math.sin(projectile.angle) * distance,
  };
}

function updateProjectiles(delta: number): void {
  for (const projectile of game.projectiles) {
    if (!projectile.alive) continue;

    const previousDistance = projectileDistance(projectile);
    projectile.progress -= projectile.speed * delta;
    const distance = projectileDistance(projectile);
    const shieldThreshold = shieldRadius + projectile.radius * 0.35;

    if (
      !projectile.shieldResolved &&
      previousDistance > shieldThreshold &&
      distance <= shieldThreshold
    ) {
      projectile.shieldResolved = true;
      const blocked = shieldBlocks(
        toDegrees(projectile.angle),
        toDegrees(game.shieldAngle),
        COLLISION_SHIELD_HALF_ARC_DEGREES,
      );

      if (blocked) resolveShieldContact(projectile);
    }

    if (!projectile.alive) continue;

    if (distance <= coreRadius + projectile.radius * 0.46) {
      projectile.alive = false;
      if (projectile.kind === "meteor") damageCore();
      else absorbEnergy();
    }
  }

  game.projectiles = game.projectiles.filter(
    (projectile) => projectile.alive && projectile.progress > -0.1,
  );
}

function resolveShieldContact(projectile: Projectile): void {
  projectile.alive = false;
  const position = projectilePosition(projectile);

  if (projectile.kind === "meteor") {
    game.blocks += 1;
    game.shieldPulse = 1;
    createBurst(position.x, position.y, "#ff6174", 13, projectile.angle);
    createRipple(position.x, position.y, "rgba(248, 251, 255, 0.82)", 56);
    playSound("block");
  } else {
    game.shieldPulse = -1;
    createBurst(position.x, position.y, "#bb74ff", 17, projectile.angle);
    createRipple(position.x, position.y, "rgba(187, 116, 255, 0.8)", 68);
    playSound("repel");
  }
}

function damageCore(): void {
  if (game.phase !== "playing") return;
  game.integrity = Math.max(0, game.integrity - 1);
  game.corePulse = -1;
  game.shake = reducedMotion ? 0 : 1;
  createBurst(centreX, centreY, "#ff465d", 24);
  createRipple(centreX, centreY, "rgba(255, 70, 93, 0.88)", shieldRadius * 0.84);
  updateMeters();
  flashImpact();
  playSound("damage");

  if (game.integrity === 0) setEndState("lost");
}

function absorbEnergy(): void {
  if (game.phase !== "playing") return;
  game.energy = Math.min(TARGET_ENERGY, game.energy + 1);
  game.corePulse = 1;
  createBurst(centreX, centreY, "#56f6a9", 18);
  createRipple(centreX, centreY, "rgba(86, 246, 169, 0.84)", shieldRadius * 0.72);
  updateMeters();
  playSound("absorb");

  if (game.energy >= TARGET_ENERGY) setEndState("won");
}

function createBurst(
  x: number,
  y: number,
  colour: string,
  count: number,
  biasAngle?: number,
): void {
  if (reducedMotion) return;
  for (let index = 0; index < count; index += 1) {
    const angle =
      biasAngle === undefined
        ? (index / count) * TAU + (index % 3) * 0.21
        : biasAngle + Math.PI + (index / Math.max(1, count - 1) - 0.5) * 1.65;
    const velocity = 35 + ((index * 29) % 76);
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      age: 0,
      duration: 0.36 + (index % 5) * 0.055,
      size: 1.2 + (index % 4) * 0.8,
      colour,
    });
  }
}

function createRipple(
  x: number,
  y: number,
  colour: string,
  maxRadius: number,
): void {
  if (reducedMotion) return;
  game.ripples.push({ x, y, colour, maxRadius, age: 0, duration: 0.5 });
}

function updateEffects(delta: number): void {
  for (const particle of game.particles) {
    particle.age += delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= Math.pow(0.035, delta);
    particle.vy *= Math.pow(0.035, delta);
  }
  game.particles = game.particles.filter((particle) => particle.age < particle.duration);

  for (const ripple of game.ripples) ripple.age += delta;
  game.ripples = game.ripples.filter((ripple) => ripple.age < ripple.duration);

  game.shake = Math.max(0, game.shake - delta * 4.8);
  game.corePulse += (0 - game.corePulse) * Math.min(1, delta * 5.5);
  game.shieldPulse += (0 - game.shieldPulse) * Math.min(1, delta * 7);
}

function updateInput(delta: number): void {
  const left = heldKeys.has("ArrowLeft") || heldKeys.has("a");
  const right = heldKeys.has("ArrowRight") || heldKeys.has("d");
  if (left !== right) {
    const direction = right ? 1 : -1;
    game.targetAngle += direction * delta * 3.15;
  }

  const response = 1 - Math.exp(-delta * 18);
  game.shieldAngle += angleDifference(game.targetAngle, game.shieldAngle) * response;
}

function update(delta: number): void {
  updateEffects(delta);
  updateInput(delta);
  if (game.phase !== "playing") return;
  game.elapsed += delta;
  scheduleProjectiles();
  updateProjectiles(delta);
}

function draw(): void {
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, viewWidth, viewHeight);
  drawStars();

  const shakeStrength = game.shake * 7;
  context.save();
  if (shakeStrength > 0.01) {
    context.translate(
      Math.sin(game.elapsed * 91) * shakeStrength,
      Math.cos(game.elapsed * 73) * shakeStrength * 0.74,
    );
  }

  drawArena();
  for (const projectile of game.projectiles) drawProjectile(projectile);
  drawShield();
  drawCore();
  drawRipples();
  drawParticles();
  context.restore();
}

function drawStars(): void {
  context.save();
  context.fillStyle = "#dce8ff";
  for (const star of stars) {
    const twinkle = reducedMotion
      ? 1
      : 0.74 + Math.sin(game.elapsed * 0.72 + star.x) * 0.16;
    context.globalAlpha = star.alpha * twinkle;
    context.fillRect(star.x, star.y, star.size, star.size);
  }
  context.restore();
}

function drawArena(): void {
  context.save();
  context.translate(centreX, centreY);
  context.strokeStyle = "rgba(139, 169, 221, 0.1)";
  context.lineWidth = 1;
  context.setLineDash([2, 10]);
  context.beginPath();
  context.arc(0, 0, shieldRadius, 0, TAU);
  context.stroke();

  context.setLineDash([]);
  for (let index = 0; index < 4; index += 1) {
    const angle = game.elapsed * 0.025 + (index * TAU) / 4;
    context.beginPath();
    context.moveTo(
      Math.cos(angle) * (shieldRadius + 18),
      Math.sin(angle) * (shieldRadius + 18),
    );
    context.lineTo(
      Math.cos(angle) * (shieldRadius + 26),
      Math.sin(angle) * (shieldRadius + 26),
    );
    context.stroke();
  }
  context.restore();
}

function drawShield(): void {
  const halfArc = (VISUAL_SHIELD_HALF_ARC_DEGREES * Math.PI) / 180;
  const pulse = Math.abs(game.shieldPulse);
  const colour = game.shieldPulse < -0.05 ? "#cf96ff" : "#f8fbff";

  context.save();
  context.translate(centreX, centreY);
  context.rotate(game.shieldAngle);
  context.lineCap = "round";
  context.shadowColor = colour;
  context.shadowBlur = 13 + pulse * 18;
  context.strokeStyle = colour;
  context.lineWidth = 7 + pulse * 3;
  context.beginPath();
  context.arc(0, 0, shieldRadius, -halfArc, halfArc);
  context.stroke();

  context.shadowBlur = 0;
  context.strokeStyle = "rgba(248, 251, 255, 0.32)";
  context.lineWidth = 1;
  context.beginPath();
  context.arc(0, 0, shieldRadius - 7, -halfArc * 0.92, halfArc * 0.92);
  context.stroke();

  for (const end of [-halfArc, halfArc]) {
    context.fillStyle = colour;
    context.beginPath();
    context.arc(
      Math.cos(end) * shieldRadius,
      Math.sin(end) * shieldRadius,
      3.2 + pulse,
      0,
      TAU,
    );
    context.fill();
  }
  context.restore();
}

function drawCore(): void {
  const healthRatio = game.integrity / MAX_INTEGRITY;
  const chargeRatio = game.energy / TARGET_ENERGY;
  const pulseScale = 1 + game.corePulse * 0.075;

  context.save();
  context.translate(centreX, centreY);
  context.scale(pulseScale, pulseScale);

  context.strokeStyle = `rgba(183, 205, 245, ${0.16 + healthRatio * 0.18})`;
  context.lineWidth = 1;
  context.beginPath();
  context.arc(
    0,
    0,
    coreRadius * 1.55,
    game.elapsed * -0.15,
    game.elapsed * -0.15 + Math.PI * 1.45,
  );
  context.stroke();

  context.strokeStyle = `rgba(86, 246, 169, ${0.28 + chargeRatio * 0.65})`;
  context.lineWidth = 2.5;
  context.lineCap = "round";
  context.beginPath();
  context.arc(
    0,
    0,
    coreRadius * 1.28,
    -Math.PI / 2,
    -Math.PI / 2 + Math.max(0.018, chargeRatio * TAU),
  );
  context.stroke();

  const coreGradient = context.createRadialGradient(
    -coreRadius * 0.25,
    -coreRadius * 0.28,
    coreRadius * 0.08,
    0,
    0,
    coreRadius,
  );
  const coreAlpha = 0.34 + healthRatio * 0.66;
  coreGradient.addColorStop(0, `rgba(246, 251, 255, ${coreAlpha})`);
  coreGradient.addColorStop(0.32, `rgba(118, 170, 255, ${0.46 * coreAlpha})`);
  coreGradient.addColorStop(0.72, `rgba(33, 69, 131, ${0.4 * coreAlpha})`);
  coreGradient.addColorStop(1, "rgba(9, 16, 34, 0.92)");
  context.fillStyle = coreGradient;
  context.shadowColor = game.corePulse > 0 ? "#56f6a9" : "#7ca9ff";
  context.shadowBlur = 18 + chargeRatio * 19;
  context.beginPath();
  context.arc(0, 0, coreRadius, 0, TAU);
  context.fill();

  context.shadowBlur = 0;
  context.strokeStyle = `rgba(222, 235, 255, ${0.35 + healthRatio * 0.38})`;
  context.lineWidth = 1;
  context.stroke();

  const diamondSize = coreRadius * 0.22;
  context.rotate(Math.PI / 4 + game.elapsed * 0.08);
  context.strokeStyle =
    game.energy > 0
      ? "rgba(86, 246, 169, 0.85)"
      : "rgba(238, 246, 255, 0.72)";
  context.strokeRect(-diamondSize, -diamondSize, diamondSize * 2, diamondSize * 2);
  context.restore();
}

function drawProjectile(projectile: Projectile): void {
  const position = projectilePosition(projectile);
  const tailLength =
    projectile.kind === "meteor" ? projectile.radius * 4.2 : projectile.radius * 2.4;
  const outwardX = Math.cos(projectile.angle);
  const outwardY = Math.sin(projectile.angle);

  context.save();
  context.lineCap = "round";
  context.strokeStyle =
    projectile.kind === "meteor"
      ? "rgba(255, 70, 93, 0.5)"
      : "rgba(86, 246, 169, 0.3)";
  context.lineWidth = projectile.kind === "meteor" ? 2.2 : 1.3;
  context.beginPath();
  context.moveTo(
    position.x + outwardX * projectile.radius * 0.7,
    position.y + outwardY * projectile.radius * 0.7,
  );
  context.lineTo(
    position.x + outwardX * tailLength,
    position.y + outwardY * tailLength,
  );
  context.stroke();

  context.translate(position.x, position.y);
  context.rotate(game.elapsed * projectile.spin);

  if (projectile.kind === "meteor") {
    context.fillStyle = "#ff465d";
    context.shadowColor = "#ff2444";
    context.shadowBlur = 15;
    context.beginPath();
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * TAU;
      const radius = projectile.radius * (index % 2 === 0 ? 1 : 0.69);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = "rgba(255, 231, 233, 0.8)";
    context.fillRect(
      -projectile.radius * 0.22,
      -projectile.radius * 0.22,
      projectile.radius * 0.44,
      projectile.radius * 0.44,
    );
  } else {
    context.fillStyle = "rgba(86, 246, 169, 0.24)";
    context.shadowColor = "#56f6a9";
    context.shadowBlur = 18;
    context.beginPath();
    context.arc(0, 0, projectile.radius * 1.55, 0, TAU);
    context.fill();
    context.fillStyle = "#56f6a9";
    context.beginPath();
    context.arc(0, 0, projectile.radius * 0.7, 0, TAU);
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = "rgba(225, 255, 241, 0.9)";
    context.lineWidth = 1.2;
    context.beginPath();
    context.arc(0, 0, projectile.radius, 0, TAU);
    context.stroke();
  }
  context.restore();
}

function drawRipples(): void {
  context.save();
  for (const ripple of game.ripples) {
    const progress = ripple.age / ripple.duration;
    context.globalAlpha = Math.max(0, 1 - progress);
    context.strokeStyle = ripple.colour;
    context.lineWidth = 2 * (1 - progress) + 0.5;
    context.beginPath();
    context.arc(ripple.x, ripple.y, ripple.maxRadius * progress, 0, TAU);
    context.stroke();
  }
  context.restore();
}

function drawParticles(): void {
  context.save();
  for (const particle of game.particles) {
    const progress = particle.age / particle.duration;
    context.globalAlpha = Math.max(0, 1 - progress);
    context.fillStyle = particle.colour;
    context.fillRect(
      particle.x - particle.size / 2,
      particle.y - particle.size / 2,
      particle.size,
      particle.size,
    );
  }
  context.restore();
}

function flashImpact(): void {
  impactVignette.classList.remove("is-hit");
  void impactVignette.offsetWidth;
  impactVignette.classList.add("is-hit");
}

function ensureAudio(): void {
  if (audioContext) {
    if (audioContext.state === "suspended") void audioContext.resume();
    return;
  }

  audioContext = new AudioContext();
}

function playSound(kind: SoundKind): void {
  if (!audioContext || audioContext.state !== "running") return;

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const settings: Record<Exclude<SoundKind, "win">, [OscillatorType, number, number, number]> = {
    block: ["triangle", 220, 610, 0.11],
    damage: ["sawtooth", 95, 42, 0.28],
    repel: ["square", 118, 72, 0.2],
    absorb: ["sine", 330, 660, 0.18],
  };

  if (kind === "win") {
    for (const [index, frequency] of [392, 523.25, 659.25].entries()) {
      const note = audioContext.createOscillator();
      const noteGain = audioContext.createGain();
      note.type = "sine";
      note.frequency.value = frequency;
      noteGain.gain.setValueAtTime(0, now + index * 0.08);
      noteGain.gain.linearRampToValueAtTime(0.055, now + index * 0.08 + 0.015);
      noteGain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 0.62 + index * 0.08,
      );
      note.connect(noteGain).connect(audioContext.destination);
      note.start(now + index * 0.08);
      note.stop(now + 0.7 + index * 0.08);
    }
    return;
  }

  const [wave, startFrequency, endFrequency, duration] = settings[kind];
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.075, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function updatePointer(clientX: number, clientY: number): void {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  game.targetAngle = Math.atan2(y - centreY, x - centreX);
}

function frame(now: number): void {
  const delta = Math.min(0.05, Math.max(0, (now - lastFrameTime) / 1000));
  lastFrameTime = now;
  if (!document.hidden) update(delta);
  draw();
  animationFrame = requestAnimationFrame(frame);
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("pointermove", (event) => {
  if (game.phase === "playing") updatePointer(event.clientX, event.clientY);
});
window.addEventListener("pointerdown", (event) => {
  ensureAudio();
  if (game.phase === "playing") {
    updatePointer(event.clientX, event.clientY);
    canvas.focus({ preventScroll: true });
  }
});
window.addEventListener("keydown", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (["ArrowLeft", "ArrowRight", "a", "d"].includes(key)) {
    heldKeys.add(key);
    ensureAudio();
    event.preventDefault();
  }
  if (game.phase !== "playing" && ["Enter", " "].includes(event.key)) {
    restart();
    event.preventDefault();
  }
});
window.addEventListener("keyup", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  heldKeys.delete(key);
});
document.addEventListener("visibilitychange", () => {
  lastFrameTime = performance.now();
});
restartButton.addEventListener("click", restart);

resizeCanvas();
restart();
cancelAnimationFrame(animationFrame);
animationFrame = requestAnimationFrame(frame);
