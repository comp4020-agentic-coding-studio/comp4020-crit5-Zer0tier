import { randomShieldBlockFlashColour } from "./background-feedback";
import {
  classicalPianoVoicing,
  CLASSICAL_PIANO_STEP_MILLISECONDS,
  midiNoteFrequency,
} from "./classical-music";
import {
  performanceRankForCombo,
  registerComboHit,
  resetCombo,
} from "./combo-ranking";
import {
  advanceDamageRecovery,
  CORE_DAMAGE_RECOVERY_SECONDS,
  coreCanTakeDamage,
  threatCueStrength,
  visualQualityForViewport,
  type VisualQualityProfile,
} from "./game-optimizations";
import { shieldContactState } from "./game-rules";
import { collectRepairPickup } from "./infinite-rules";
import {
  MIN_PROJECTILE_SPAWN_GAP,
  nextScheduledProjectile,
} from "./projectile-schedule";
import {
  advanceProjectileMotion,
  advanceSpiralDynamics,
  INITIAL_SPIRAL_CENTRIPETAL_FORCE,
  nearestViewportEdgeAngle,
  previousProjectileMotion,
  spiralAngularSpeed,
  spiralInwardSpeed,
} from "./projectile-motion";
import {
  gameSessionIsFrozen,
  toggledPausePhase,
  type GameSessionPhase,
} from "./pause-state";

type ProjectileKind = "meteor" | "spiral" | "energy" | "repair";
type GamePhase = GameSessionPhase;
type GameMode = "standard" | "infinite";
type SoundKind = "block" | "damage" | "repel" | "absorb" | "repair" | "win";

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
  angularVelocity: number;
  centripetalForce: number;
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
const hud = requiredElement<HTMLElement>(".hud");
const integrityMeter = requiredElement<HTMLElement>("#integrity-meter");
const chargeMeter = requiredElement<HTMLElement>("#charge-meter");
const chargeLabel = requiredElement<HTMLElement>("#charge-label");
const modeChip = requiredElement<HTMLElement>("#mode-chip");
const musicButton = requiredElement<HTMLButtonElement>("#music-button");
const performanceHud = requiredElement<HTMLElement>("#performance-hud");
const rankDisplay = requiredElement<HTMLElement>("#rank-display");
const rankValue = requiredElement<HTMLElement>("#rank-value");
const comboDisplay = requiredElement<HTMLElement>("#combo-display");
const comboValue = requiredElement<HTMLElement>("#combo-value");
const gameStatus = requiredElement<HTMLElement>("#game-status");
const impactVignette = requiredElement<HTMLElement>("#impact-vignette");
const startScreen = requiredElement<HTMLElement>("#start-screen");
const startButton = requiredElement<HTMLButtonElement>("#start-button");
const modeButtons = document.querySelectorAll<HTMLButtonElement>("[data-mode]");
const pauseScreen = requiredElement<HTMLElement>("#pause-screen");
const resumeButton = requiredElement<HTMLButtonElement>("#resume-button");
const endScreen = requiredElement<HTMLElement>("#end-screen");
const endTitle = requiredElement<HTMLElement>("#end-title");
const endScore = requiredElement<HTMLElement>("#end-score");
const endPerformance = requiredElement<HTMLElement>("#end-performance");
const restartButton = requiredElement<HTMLButtonElement>("#restart-button");
const modeButton = requiredElement<HTMLButtonElement>("#mode-button");

const context = canvas.getContext("2d")!;
if (!context) throw new Error("Canvas 2D is unavailable");

const TAU = Math.PI * 2;
const TARGET_ENERGY = 10;
const MAX_INTEGRITY = 3;
const VISUAL_SHIELD_HALF_ARC_DEGREES = 24;
// The meteor body and rounded shield cap overlap beyond the centre-line arc.
// Seven extra degrees make the collision agree with what the player sees.
const COLLISION_SHIELD_HALF_ARC_DEGREES = 31;
// The shield can pulse to a ten-pixel stroke; collisions include that body.
const COLLISION_SHIELD_HALF_WIDTH = 5;
const GOLDEN_ANGLE = 2.399963229728653;
const PIANO_SCHEDULER_INTERVAL_MILLISECONDS = 25;
const PIANO_SCHEDULE_AHEAD_SECONDS = 0.12;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let viewWidth = 1;
let viewHeight = 1;
let viewLeft = 0;
let viewTop = 0;
let pixelRatio = 1;
let centreX = 0;
let centreY = 0;
let coreRadius = 30;
let shieldRadius = 100;
let projectileRadius = 9;
let stars: Star[] = [];
let visualQuality: VisualQualityProfile = visualQualityForViewport(1, 1);
let animationFrame = 0;
let lastFrameTime = performance.now();
let resizeFrame = 0;
let audioContext: AudioContext | null = null;
let backgroundMusicBus: GainNode | null = null;
let backgroundMusicTimer = 0;
let backgroundMusicStep = 0;
let backgroundMusicNextStepTime = 0;
let backgroundMusicEnabled = true;
let backgroundMusicPianoInput: GainNode | null = null;
let backgroundMusicRoomImpulse: AudioBuffer | null = null;
let nextId = 1;

const heldKeys = new Set<string>();

const game = {
  phase: "ready" as GamePhase,
  mode: "standard" as GameMode,
  elapsed: 0,
  integrity: MAX_INTEGRITY,
  energy: 0,
  repairCharge: 0,
  blocks: 0,
  combo: 0,
  bestCombo: 0,
  damageRecovery: 0,
  shieldAngle: -Math.PI / 2,
  targetAngle: -Math.PI / 2,
  nextMeteorAt: 0.65,
  nextEnergyAt: 30,
  nextRepairAt: 8,
  lastProjectileSpawnAt: Number.NEGATIVE_INFINITY,
  meteorIndex: 0,
  energyIndex: 0,
  repairIndex: 0,
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
  viewLeft = rect.left;
  viewTop = rect.top;
  visualQuality = visualQualityForViewport(viewWidth, viewHeight);
  pixelRatio = Math.min(
    window.devicePixelRatio || 1,
    visualQuality.pixelRatioCap,
  );

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
  stars = createStars(
    Math.round(
      clamp((viewWidth * viewHeight) / 14000, 38, 110) *
        visualQuality.starDensity,
    ),
  );
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

function resetRoundState(): void {
  game.elapsed = 0;
  game.integrity = MAX_INTEGRITY;
  game.energy = 0;
  game.repairCharge = 0;
  game.blocks = 0;
  game.combo = 0;
  game.bestCombo = 0;
  game.damageRecovery = 0;
  game.shieldAngle = -Math.PI / 2;
  game.targetAngle = -Math.PI / 2;
  game.nextMeteorAt = 0.65;
  game.nextEnergyAt = 30;
  game.nextRepairAt = 8;
  game.lastProjectileSpawnAt = Number.NEGATIVE_INFINITY;
  game.meteorIndex = 0;
  game.energyIndex = 0;
  game.repairIndex = 0;
  game.projectiles = [];
  game.particles = [];
  game.ripples = [];
  game.shake = 0;
  game.corePulse = 0;
  game.shieldPulse = 0;
  pauseScreen.hidden = true;
  hud.inert = false;
  endScreen.hidden = true;
  delete endScreen.dataset.result;
  gameStatus.textContent = "";
  updateMeters();
  updatePerformanceHud();
  lastFrameTime = performance.now();
}

function setGameMode(mode: GameMode): void {
  if (game.phase !== "ready") return;
  game.mode = mode;
  document.body.dataset.gameMode = mode;
  modeChip.textContent = mode === "infinite" ? "Infinite" : "";
  startButton.setAttribute(
    "aria-label",
    mode === "infinite"
      ? "Start Orbital Shield in Infinite mode"
      : "Start Orbital Shield in Standard mode",
  );
  modeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  });
  updateMeters();
}

function showStartScreen(): void {
  stopBackgroundMusic(0.35);
  resetRoundState();
  game.phase = "ready";
  document.body.dataset.gameState = "ready";
  startScreen.hidden = false;
  startScreen.classList.remove("is-leaving");
  startButton.disabled = false;
  modeButtons.forEach((button) => {
    button.disabled = false;
  });
}

function startGame(): void {
  if (game.phase !== "ready") return;
  ensureAudio();
  resetRoundState();
  game.phase = "playing";
  document.body.dataset.gameState = "playing";
  startBackgroundMusic();
  startButton.disabled = true;
  modeButtons.forEach((button) => {
    button.disabled = true;
  });
  startScreen.classList.add("is-leaving");
  window.setTimeout(() => {
    startScreen.hidden = true;
    startScreen.classList.remove("is-leaving");
    startButton.disabled = false;
    modeButtons.forEach((button) => {
      button.disabled = false;
    });
  }, 230);
}

function restart(): void {
  ensureAudio();
  resetRoundState();
  game.phase = "playing";
  document.body.dataset.gameState = "playing";
  startScreen.hidden = true;
  startBackgroundMusic();
}

function pauseGame(): void {
  if (game.phase !== "playing") return;
  game.phase = "paused";
  document.body.dataset.gameState = "paused";
  heldKeys.clear();
  pauseScreen.hidden = false;
  hud.inert = true;
  stopBackgroundMusic(0.12);
  gameStatus.textContent = "Game paused. Press Escape or Resume to continue.";
  resumeButton.focus({ preventScroll: true });
}

function resumeGame(): void {
  if (game.phase !== "paused") return;
  game.phase = "playing";
  document.body.dataset.gameState = "playing";
  pauseScreen.hidden = true;
  hud.inert = false;
  lastFrameTime = performance.now();
  gameStatus.textContent = "Game resumed.";
  ensureAudio();
  startBackgroundMusic();
  canvas.focus({ preventScroll: true });
}

function togglePause(): void {
  const nextPhase = toggledPausePhase(game.phase);
  if (nextPhase === "paused") pauseGame();
  else if (nextPhase === "playing" && game.phase === "paused") resumeGame();
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
  const filledChargePips =
    game.mode === "infinite" ? game.repairCharge * 2 : game.energy;
  chargePips.forEach((pip, index) => {
    pip.classList.toggle("is-filled", index < filledChargePips);
  });
  if (game.mode === "infinite") {
    chargeLabel.textContent = "Repair";
    chargeMeter.setAttribute(
      "aria-label",
      `Repair charge: ${game.repairCharge} of 1`,
    );
  } else {
    chargeLabel.textContent = "Charge";
    chargeMeter.setAttribute(
      "aria-label",
      `Core charge: ${game.energy} of ${TARGET_ENERGY}`,
    );
  }
}

type PerformanceAnimation = "combo-hit" | "rank-up" | "combo-broken";

function updatePerformanceHud(animation?: PerformanceAnimation): void {
  const rank = performanceRankForCombo(game.combo);
  rankValue.textContent = rank.label;
  performanceHud.dataset.rank = rank.label;
  rankDisplay.dataset.rank = rank.label;
  rankDisplay.setAttribute("aria-label", `Rank ${rank.label}, ${rank.name}`);
  comboValue.textContent = String(game.combo);
  comboDisplay.setAttribute(
    "aria-label",
    `Combo: ${game.combo} successful ${game.combo === 1 ? "block" : "blocks"}`,
  );

  performanceHud.classList.remove(
    "is-combo-hit",
    "is-rank-up",
    "is-combo-broken",
  );
  if (!animation) return;
  void performanceHud.offsetWidth;
  performanceHud.classList.add(`is-${animation}`);
}

function addComboHit(): void {
  const progress = registerComboHit(game.combo, game.bestCombo);
  game.combo = progress.combo;
  game.bestCombo = progress.bestCombo;
  updatePerformanceHud(progress.rankedUp ? "rank-up" : "combo-hit");

  if (progress.rankedUp) {
    gameStatus.textContent =
      `Rank ${progress.rank.label}, ${progress.rank.name}. ` +
      `${progress.combo} hit combo.`;
  }
}

function breakCombo(): void {
  if (game.combo === 0) return;
  const brokenCombo = game.combo;
  const reset = resetCombo(game.bestCombo);
  game.combo = reset.combo;
  game.bestCombo = reset.bestCombo;
  updatePerformanceHud("combo-broken");
  gameStatus.textContent = `Combo broken after ${brokenCombo} successful ${
    brokenCombo === 1 ? "block" : "blocks"
  }.`;
}

function formatDuration(seconds: number): string {
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function setEndState(result: "won" | "lost"): void {
  if (game.phase !== "playing") return;
  game.phase = result;
  document.body.dataset.gameState = result;
  endScreen.dataset.result = result;
  endTitle.textContent = result === "won" ? "Orbit stable" : "Core lost";
  endScore.textContent =
    game.mode === "infinite"
      ? `${formatDuration(game.elapsed)} · ${game.blocks} blocks`
      : `${String(game.energy).padStart(2, "0")} / ${TARGET_ENERGY}`;
  const bestRank = performanceRankForCombo(game.bestCombo);
  endPerformance.textContent =
    `Rank ${bestRank.label} · Best ×${game.bestCombo}`;
  endPerformance.dataset.rank = bestRank.label;
  endScreen.hidden = false;
  restartButton.focus({ preventScroll: true });
  stopBackgroundMusic(0.8);
  if (result === "won") playSound("win");
}

function spawnProjectile(
  kind: ProjectileKind,
  angle: number,
  speedBoost = 0,
): void {
  const isSpiral = kind === "spiral";
  game.projectiles.push({
    id: nextId++,
    kind,
    angle,
    progress: 1,
    speed: isSpiral
      ? spiralInwardSpeed(INITIAL_SPIRAL_CENTRIPETAL_FORCE) + speedBoost
      : 0.205 + Math.min(game.elapsed / 240, 0.08) + speedBoost,
    radius: kind === "meteor" || isSpiral
      ? projectileRadius
      : projectileRadius * (kind === "repair" ? 0.96 : 0.84),
    spawnDistance: isSpiral
      ? Math.max(
          shieldRadius + projectileRadius * 4,
          distanceToViewportEdge(angle) - projectileRadius * 1.15,
        )
      : distanceToViewportEdge(angle) + projectileRadius * 5,
    shieldResolved: false,
    alive: true,
    spin: (nextId % 2 === 0 ? 1 : -1) * (0.9 + (nextId % 5) * 0.17),
    angularVelocity: isSpiral
      ? (nextId % 2 === 0 ? 1 : -1) *
        spiralAngularSpeed(INITIAL_SPIRAL_CENTRIPETAL_FORCE, 1)
      : 0,
    centripetalForce: isSpiral ? INITIAL_SPIRAL_CENTRIPETAL_FORCE : 0,
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
  const isSpiral = game.meteorIndex % 3 === 2;
  const angle = isSpiral
    ? nearestViewportEdgeAngle(
        { width: viewWidth, height: viewHeight, centreX, centreY },
        Math.floor(game.meteorIndex / 3),
      )
    : game.meteorIndex === 0
      ? 0
      : (game.meteorIndex * GOLDEN_ANGLE + 0.23) % TAU;
  const kind: ProjectileKind = isSpiral ? "spiral" : "meteor";
  game.meteorIndex += 1;
  spawnProjectile(kind, angle);
}

function spawnEnergy(): void {
  const angle = (game.energyIndex * GOLDEN_ANGLE + Math.PI * 0.73) % TAU;
  game.energyIndex += 1;
  spawnProjectile("energy", angle, -0.035);
}

function spawnRepair(): void {
  const angle = (game.repairIndex * GOLDEN_ANGLE + Math.PI * 1.27) % TAU;
  game.repairIndex += 1;
  spawnProjectile("repair", angle, -0.018);
}

function scheduleProjectiles(): void {
  const nextProjectile = nextScheduledProjectile(game, game.projectiles.length);
  if (!nextProjectile) return;

  if (nextProjectile === "meteor") {
    spawnMeteor();
    game.nextMeteorAt = game.elapsed + MIN_PROJECTILE_SPAWN_GAP;
  } else if (nextProjectile === "energy") {
    spawnEnergy();
    game.nextEnergyAt = game.elapsed + 3.25;
  } else {
    spawnRepair();
    game.nextRepairAt = game.elapsed + clamp(9 - game.elapsed * 0.012, 6.5, 9);
  }
  game.lastProjectileSpawnAt = game.elapsed;
}

function projectileDistance(projectile: Projectile): number {
  return coreRadius + projectile.progress * (projectile.spawnDistance - coreRadius);
}

function projectilePosition(projectile: Projectile): { x: number; y: number } {
  return projectilePositionFromMotion(projectile, projectile);
}

function projectilePositionFromMotion(
  projectile: Projectile,
  motion: { angle: number; progress: number },
): { x: number; y: number } {
  const distance =
    coreRadius + motion.progress * (projectile.spawnDistance - coreRadius);
  return {
    x: centreX + Math.cos(motion.angle) * distance,
    y: centreY + Math.sin(motion.angle) * distance,
  };
}

function updateProjectiles(delta: number): void {
  for (const projectile of game.projectiles) {
    if (!projectile.alive) continue;

    const previousDistance = projectileDistance(projectile);
    if (projectile.kind === "spiral") {
      const dynamics = advanceSpiralDynamics(
        projectile,
        previousDistance / projectile.spawnDistance,
        delta,
      );
      projectile.progress = dynamics.progress;
      projectile.angle = dynamics.angle;
      projectile.speed = dynamics.speed;
      projectile.angularVelocity = dynamics.angularVelocity;
      projectile.centripetalForce = dynamics.centripetalForce;
    } else {
      const motion = advanceProjectileMotion(
        projectile,
        projectile.speed,
        projectile.angularVelocity,
        delta,
      );
      projectile.progress = motion.progress;
      projectile.angle = motion.angle;
    }
    const distance = projectileDistance(projectile);
    if (!projectile.shieldResolved) {
      const contact = shieldContactState({
        previousDistance,
        distance,
        projectileAngle: toDegrees(projectile.angle),
        shieldAngle: toDegrees(game.shieldAngle),
        shieldRadius,
        projectileRadius: projectile.radius,
        shieldHalfWidth: COLLISION_SHIELD_HALF_WIDTH,
        shieldHalfArc: COLLISION_SHIELD_HALF_ARC_DEGREES,
      });

      if (contact === "blocked") {
        projectile.shieldResolved = true;
        resolveShieldContact(projectile);
      } else if (contact === "passed") {
        projectile.shieldResolved = true;
      }
    }

    if (!projectile.alive) continue;

    if (distance <= coreRadius + projectile.radius * 0.46) {
      projectile.alive = false;
      if (projectile.kind === "meteor" || projectile.kind === "spiral") {
        damageCore();
      } else if (projectile.kind === "energy") absorbEnergy();
      else absorbRepair();
    }
  }

  let activeProjectileCount = 0;
  for (const projectile of game.projectiles) {
    if (!projectile.alive || projectile.progress <= -0.1) continue;
    game.projectiles[activeProjectileCount] = projectile;
    activeProjectileCount += 1;
  }
  game.projectiles.length = activeProjectileCount;
}

function resolveShieldContact(projectile: Projectile): void {
  projectile.alive = false;
  const position = projectilePosition(projectile);

  if (projectile.kind === "meteor" || projectile.kind === "spiral") {
    game.blocks += 1;
    addComboHit();
    game.shieldPulse = 1;
    const colour = projectile.kind === "spiral" ? "#ffd84d" : "#ff6174";
    createBurst(position.x, position.y, colour, 13, projectile.angle);
    createRipple(position.x, position.y, "rgba(248, 251, 255, 0.82)", 56);
    flashBackground("blocked");
    playSound("block");
  } else if (projectile.kind === "energy") {
    game.shieldPulse = -1;
    createBurst(position.x, position.y, "#bb74ff", 17, projectile.angle);
    createRipple(position.x, position.y, "rgba(187, 116, 255, 0.8)", 68);
    playSound("repel");
  } else {
    game.shieldPulse = -1;
    createBurst(position.x, position.y, "#49b8ff", 17, projectile.angle);
    createRipple(position.x, position.y, "rgba(73, 184, 255, 0.82)", 68);
    playSound("repel");
  }
}

function damageCore(): void {
  if (game.phase !== "playing") return;
  if (!coreCanTakeDamage(game.damageRecovery)) {
    game.corePulse = 0.24;
    createRipple(
      centreX,
      centreY,
      "rgba(141, 183, 255, 0.62)",
      shieldRadius * 0.48,
    );
    return;
  }

  breakCombo();
  game.damageRecovery = CORE_DAMAGE_RECOVERY_SECONDS;
  game.integrity = Math.max(0, game.integrity - 1);
  game.corePulse = -1;
  game.shake = reducedMotion ? 0 : 1;
  createBurst(centreX, centreY, "#ff465d", 24);
  createRipple(centreX, centreY, "rgba(255, 70, 93, 0.88)", shieldRadius * 0.84);
  updateMeters();
  flashBackground("hit");
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

function absorbRepair(): void {
  if (game.phase !== "playing" || game.mode !== "infinite") return;
  const repair = collectRepairPickup(
    game.repairCharge,
    game.integrity,
    MAX_INTEGRITY,
  );
  game.repairCharge = repair.charge;
  game.integrity = repair.integrity;
  game.corePulse = 1;
  createBurst(centreX, centreY, "#49b8ff", repair.repaired ? 28 : 18);
  createRipple(
    centreX,
    centreY,
    "rgba(73, 184, 255, 0.88)",
    shieldRadius * (repair.repaired ? 0.92 : 0.72),
  );
  updateMeters();
  flashRepairMeter(repair.repaired);
  gameStatus.textContent = repair.repaired
    ? `Core repaired: ${game.integrity} of ${MAX_INTEGRITY}`
    : game.repairCharge === 0.5
      ? "Repair charge half full"
      : "Core integrity already full";
  playSound("repair");
}

function createBurst(
  x: number,
  y: number,
  colour: string,
  count: number,
  biasAngle?: number,
): void {
  if (reducedMotion) return;
  const visualCount = Math.max(5, Math.round(count * visualQuality.particleDensity));
  for (let index = 0; index < visualCount; index += 1) {
    const angle =
      biasAngle === undefined
        ? (index / visualCount) * TAU + (index % 3) * 0.21
        : biasAngle +
          Math.PI +
          (index / Math.max(1, visualCount - 1) - 0.5) * 1.65;
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
  const drag = Math.pow(0.035, delta);
  let activeParticleCount = 0;
  for (const particle of game.particles) {
    particle.age += delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= drag;
    particle.vy *= drag;
    if (particle.age >= particle.duration) continue;
    game.particles[activeParticleCount] = particle;
    activeParticleCount += 1;
  }
  game.particles.length = activeParticleCount;

  let activeRippleCount = 0;
  for (const ripple of game.ripples) {
    ripple.age += delta;
    if (ripple.age >= ripple.duration) continue;
    game.ripples[activeRippleCount] = ripple;
    activeRippleCount += 1;
  }
  game.ripples.length = activeRippleCount;

  game.damageRecovery = advanceDamageRecovery(game.damageRecovery, delta);
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
  if (gameSessionIsFrozen(game.phase)) return;
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
  drawWarpStreaks();

  const shakeStrength = game.shake * 7;
  context.save();
  if (shakeStrength > 0.01) {
    context.translate(
      Math.sin(game.elapsed * 91) * shakeStrength,
      Math.cos(game.elapsed * 73) * shakeStrength * 0.74,
    );
  }

  drawArena();
  if (game.phase !== "ready") {
    drawThreatIndicators();
    for (const projectile of game.projectiles) drawProjectile(projectile);
    drawShield();
    drawCore();
  }
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

function drawWarpStreaks(): void {
  if (reducedMotion || game.phase !== "playing") return;
  const fieldRadius = Math.max(viewWidth, viewHeight) * 0.58;
  const speed = 0.13 + Math.min(game.elapsed / 480, 0.11);

  context.save();
  context.translate(centreX, centreY);
  context.lineCap = "round";
  for (let index = 0; index < visualQuality.warpStreakCount; index += 1) {
    const phase =
      (game.elapsed * speed + index / visualQuality.warpStreakCount) % 1;
    const angle = index * GOLDEN_ANGLE + Math.sin(index * 2.7) * 0.18;
    const radius = shieldRadius * 1.45 + phase * fieldRadius;
    const length = 4 + phase * 22;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    context.globalAlpha = Math.sin(phase * Math.PI) * 0.16;
    context.strokeStyle = index % 4 === 0 ? "#bb74ff" : "#8db7ff";
    context.lineWidth = 0.55 + phase * 0.9;
    context.beginPath();
    context.moveTo(cosine * radius, sine * radius);
    context.lineTo(cosine * (radius + length), sine * (radius + length));
    context.stroke();
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

function drawThreatIndicators(): void {
  context.save();
  context.translate(centreX, centreY);
  context.lineCap = "round";

  for (const projectile of game.projectiles) {
    if (
      projectile.shieldResolved ||
      (projectile.kind !== "meteor" && projectile.kind !== "spiral")
    ) {
      continue;
    }

    const strength = threatCueStrength(
      projectileDistance(projectile),
      shieldRadius,
    );
    if (strength <= 0) continue;

    const pulse = reducedMotion
      ? 1
      : 0.88 + Math.sin(game.elapsed * 8 + projectile.id) * 0.12;
    const radius = shieldRadius + 14 + strength * 3;
    const halfArc = 0.028 + strength * 0.052;
    const colour = projectile.kind === "spiral" ? "255, 216, 77" : "255, 97, 116";
    context.globalAlpha = (0.2 + strength * 0.62) * pulse;
    context.strokeStyle = `rgb(${colour})`;
    context.lineWidth = 1.2 + strength * 2.2;
    context.beginPath();
    context.arc(
      0,
      0,
      radius,
      projectile.angle - halfArc,
      projectile.angle + halfArc,
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

  if (!reducedMotion) {
    const movementLag = clamp(
      angleDifference(game.targetAngle, game.shieldAngle),
      -0.48,
      0.48,
    );
    if (Math.abs(movementLag) > 0.012) {
      const echoCount = visualQuality.projectileTrailDots;
      for (let index = echoCount; index >= 1; index -= 1) {
        context.save();
        context.rotate(-movementLag * index * 0.24);
        context.strokeStyle = `rgba(139, 183, 255, ${0.04 + index * 0.035})`;
        context.lineWidth = Math.max(1, 6 - index);
        context.beginPath();
        context.arc(0, 0, shieldRadius, -halfArc, halfArc);
        context.stroke();
        context.restore();
      }
    }
  }

  context.shadowColor = colour;
  context.shadowBlur = (13 + pulse * 18) * visualQuality.shadowScale;
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
  const chargeRatio =
    game.mode === "infinite" ? game.repairCharge : game.energy / TARGET_ENERGY;
  const chargeColour =
    game.mode === "infinite" ? "73, 184, 255" : "86, 246, 169";
  const pulseScale = 1 + game.corePulse * 0.075;

  context.save();
  context.translate(centreX, centreY);

  if (game.damageRecovery > 0) {
    const recoveryRatio = game.damageRecovery / CORE_DAMAGE_RECOVERY_SECONDS;
    context.globalAlpha = 0.18 + recoveryRatio * 0.48;
    context.strokeStyle = "#8db7ff";
    context.lineWidth = 1.4 + recoveryRatio * 1.5;
    context.setLineDash([3, 6]);
    context.lineDashOffset = reducedMotion ? 0 : -game.elapsed * 18;
    context.beginPath();
    context.arc(0, 0, coreRadius * 1.82, 0, TAU);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 1;
  }

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

  for (let index = 0; index < 3; index += 1) {
    const orbitAngle = reducedMotion
      ? (index * TAU) / 3
      : game.elapsed * (0.42 + index * 0.13) + (index * TAU) / 3;
    const orbitRadius = coreRadius * (1.42 + index * 0.08);
    context.fillStyle =
      index === 1
        ? `rgba(${chargeColour}, ${0.35 + chargeRatio * 0.5})`
        : "rgba(183, 205, 245, 0.5)";
    context.shadowColor = index === 1 ? `rgb(${chargeColour})` : "#8db7ff";
    context.shadowBlur = 7 * visualQuality.shadowScale;
    context.beginPath();
    context.arc(
      Math.cos(orbitAngle) * orbitRadius,
      Math.sin(orbitAngle) * orbitRadius,
      1.2 + index * 0.35,
      0,
      TAU,
    );
    context.fill();
  }
  context.shadowBlur = 0;

  context.strokeStyle = `rgba(${chargeColour}, ${0.28 + chargeRatio * 0.65})`;
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
  context.shadowColor =
    game.corePulse > 0
      ? game.mode === "infinite"
        ? "#49b8ff"
        : "#56f6a9"
      : "#7ca9ff";
  context.shadowBlur =
    (18 + chargeRatio * 19) * visualQuality.shadowScale;
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
    chargeRatio > 0
      ? `rgba(${chargeColour}, 0.85)`
      : "rgba(238, 246, 255, 0.72)";
  context.strokeRect(-diamondSize, -diamondSize, diamondSize * 2, diamondSize * 2);
  context.restore();
}

function drawProjectile(projectile: Projectile): void {
  const position = projectilePosition(projectile);
  const spiralForceRatio =
    projectile.kind === "spiral"
      ? clamp(
          (projectile.centripetalForce - INITIAL_SPIRAL_CENTRIPETAL_FORCE) /
            (0.62 - INITIAL_SPIRAL_CENTRIPETAL_FORCE),
          0,
          1,
        )
      : 0;
  const tailLength =
    projectile.radius *
    (projectile.kind === "meteor"
      ? 4.2
      : projectile.kind === "spiral"
        ? 5.2
        : projectile.kind === "repair"
          ? 3.4
          : 2.4);
  const outwardX = Math.cos(projectile.angle);
  const outwardY = Math.sin(projectile.angle);

  context.save();
  context.lineCap = "round";
  context.strokeStyle =
    projectile.kind === "meteor"
      ? "rgba(255, 70, 93, 0.5)"
      : projectile.kind === "spiral"
        ? `rgba(255, 216, 77, ${0.5 + spiralForceRatio * 0.34})`
        : projectile.kind === "repair"
          ? "rgba(73, 184, 255, 0.48)"
          : "rgba(86, 246, 169, 0.3)";
  context.lineWidth =
    projectile.kind === "meteor"
      ? 2.2
      : projectile.kind === "spiral"
        ? 1.5 + spiralForceRatio * 1.2
        : projectile.kind === "repair"
          ? 1.8
          : 1.3;
  context.beginPath();
  if (projectile.kind === "spiral") {
    context.moveTo(position.x, position.y);
    for (
      let index = 1;
      index <= visualQuality.spiralTrailSegments;
      index += 1
    ) {
      const trailMotion = previousProjectileMotion(
        projectile,
        projectile.speed,
        projectile.angularVelocity,
        (index / visualQuality.spiralTrailSegments) * 0.55,
      );
      const trailPosition = projectilePositionFromMotion(projectile, trailMotion);
      context.lineTo(trailPosition.x, trailPosition.y);
    }
  } else {
    context.moveTo(
      position.x + outwardX * projectile.radius * 0.7,
      position.y + outwardY * projectile.radius * 0.7,
    );
    context.lineTo(
      position.x + outwardX * tailLength,
      position.y + outwardY * tailLength,
    );
  }
  context.stroke();

  if (!reducedMotion) {
    const trailColour =
      projectile.kind === "meteor"
        ? "255, 70, 93"
        : projectile.kind === "spiral"
          ? "255, 216, 77"
          : projectile.kind === "repair"
            ? "73, 184, 255"
            : "86, 246, 169";
    for (let index = 0; index < visualQuality.projectileTrailDots; index += 1) {
      const phase =
        (game.elapsed * 3.4 +
          index / visualQuality.projectileTrailDots +
          projectile.id * 0.17) %
        1;
      const offset = projectile.radius + phase * (tailLength - projectile.radius);
      const trailPosition =
        projectile.kind === "spiral"
          ? projectilePositionFromMotion(
              projectile,
              previousProjectileMotion(
                projectile,
                projectile.speed,
                projectile.angularVelocity,
                phase * 0.5,
              ),
            )
          : {
              x: position.x + outwardX * offset,
              y: position.y + outwardY * offset,
            };
      context.globalAlpha = (1 - phase) * 0.6;
      context.fillStyle = `rgb(${trailColour})`;
      context.beginPath();
      context.arc(
        trailPosition.x,
        trailPosition.y,
        0.8 + (1 - phase) * 1.1,
        0,
        TAU,
      );
      context.fill();
    }
    context.globalAlpha = 1;
  }

  context.translate(position.x, position.y);
  context.rotate(
    projectile.kind === "repair" ? projectile.angle : game.elapsed * projectile.spin,
  );

  if (projectile.kind === "meteor") {
    context.fillStyle = "#ff465d";
    context.shadowColor = "#ff2444";
    context.shadowBlur = 15 * visualQuality.shadowScale;
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
  } else if (projectile.kind === "spiral") {
    const pulse = reducedMotion
      ? 1
      : 1 + Math.sin(game.elapsed * 9 + projectile.id) * 0.12;
    context.fillStyle = "rgba(255, 216, 77, 0.2)";
    context.shadowColor = "#ffd84d";
    context.shadowBlur =
      (18 + spiralForceRatio * 18) * visualQuality.shadowScale;
    context.beginPath();
    context.arc(
      0,
      0,
      projectile.radius * (1.55 + spiralForceRatio * 0.35) * pulse,
      0,
      TAU,
    );
    context.fill();

    context.fillStyle = "#ffd84d";
    context.beginPath();
    context.arc(0, 0, projectile.radius * 0.78, 0, TAU);
    context.fill();
    context.shadowBlur = 0;

    context.strokeStyle = "rgba(255, 248, 204, 0.92)";
    context.lineWidth = 1.2 + spiralForceRatio * 0.8;
    context.beginPath();
    context.arc(0, 0, projectile.radius * 1.18, -Math.PI * 0.72, Math.PI * 0.42);
    context.stroke();
    context.fillStyle = "#fff8cc";
    context.beginPath();
    context.arc(
      Math.cos(Math.PI * 0.42) * projectile.radius * 1.18,
      Math.sin(Math.PI * 0.42) * projectile.radius * 1.18,
      1.8,
      0,
      TAU,
    );
    context.fill();
  } else if (projectile.kind === "energy") {
    context.fillStyle = "rgba(86, 246, 169, 0.24)";
    context.shadowColor = "#56f6a9";
    context.shadowBlur = 18 * visualQuality.shadowScale;
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
  } else {
    const radius = projectile.radius;
    context.fillStyle = "rgba(73, 184, 255, 0.26)";
    context.shadowColor = "#49b8ff";
    context.shadowBlur = 20 * visualQuality.shadowScale;
    context.beginPath();
    context.ellipse(0, 0, radius * 1.65, radius * 1.1, 0, 0, TAU);
    context.fill();

    context.fillStyle = "#49b8ff";
    context.beginPath();
    context.moveTo(-radius * 1.35, 0);
    context.lineTo(-radius * 0.58, -radius * 0.72);
    context.lineTo(radius * 0.82, -radius * 0.72);
    context.quadraticCurveTo(radius * 1.22, 0, radius * 0.82, radius * 0.72);
    context.lineTo(-radius * 0.58, radius * 0.72);
    context.closePath();
    context.fill();

    context.shadowBlur = 0;
    context.strokeStyle = "rgba(232, 248, 255, 0.94)";
    context.lineWidth = 1.2;
    context.stroke();
    context.beginPath();
    context.moveTo(0, -radius * 0.6);
    context.lineTo(0, radius * 0.6);
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

function flashBackground(kind: "hit" | "blocked"): void {
  impactVignette.classList.remove("is-hit", "is-blocked");

  if (kind === "blocked") {
    impactVignette.style.setProperty(
      "--feedback-colour",
      randomShieldBlockFlashColour(),
    );
  } else {
    impactVignette.style.removeProperty("--feedback-colour");
  }

  void impactVignette.offsetWidth;
  impactVignette.classList.add(kind === "hit" ? "is-hit" : "is-blocked");
}

function flashRepairMeter(repaired: boolean): void {
  const target = repaired ? integrityMeter : chargeMeter;
  target.classList.remove("is-restored", "is-charging");
  void target.offsetWidth;
  target.classList.add(repaired ? "is-restored" : "is-charging");
}

function ensureAudio(): void {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") {
    void audioContext
      .resume()
      .then(() => {
        if (game.phase === "playing") startBackgroundMusic();
      })
      .catch(() => {
        // The next pointer or keyboard gesture will try again.
      });
  }
}

function createPianoRoomImpulse(): AudioBuffer | null {
  if (!audioContext) return null;
  const duration = 1.7;
  const buffer = audioContext.createBuffer(
    2,
    Math.floor(audioContext.sampleRate * duration),
    audioContext.sampleRate,
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (let index = 0; index < samples.length; index += 1) {
      const progress = index / samples.length;
      const decay = (1 - progress) ** 3.4;
      samples[index] = (Math.random() * 2 - 1) * decay;
    }
  }

  return buffer;
}

function playPianoNote(
  midi: number,
  startsAt: number,
  duration: number,
  velocity: number,
): void {
  if (!audioContext || !backgroundMusicPianoInput) return;

  const frequency = midiNoteFrequency(midi);
  const envelope = audioContext.createGain();
  const tone = audioContext.createBiquadFilter();
  const pan = audioContext.createStereoPanner();
  const endsAt = startsAt + Math.max(0.34, duration);
  const peak = Math.max(0.0001, velocity);

  envelope.gain.setValueAtTime(0.0001, startsAt);
  envelope.gain.linearRampToValueAtTime(peak, startsAt + 0.007);
  envelope.gain.exponentialRampToValueAtTime(peak * 0.34, startsAt + 0.15);
  envelope.gain.exponentialRampToValueAtTime(0.0001, endsAt);
  tone.type = "lowpass";
  tone.frequency.setValueAtTime(Math.min(6200, 3300 + frequency * 2.2), startsAt);
  tone.frequency.exponentialRampToValueAtTime(1450, endsAt);
  tone.Q.setValueAtTime(0.55, startsAt);
  pan.pan.setValueAtTime(clamp((midi - 60) / 50, -0.38, 0.38), startsAt);
  envelope.connect(tone).connect(pan).connect(backgroundMusicPianoInput);

  const partials: Array<[number, number, OscillatorType, number]> = [
    [1, 0.74, "triangle", -0.4],
    [2.006, 0.2, "sine", 0.3],
    [3.014, 0.075, "sine", -0.2],
    [4.028, 0.028, "sine", 0.5],
  ];

  for (const [ratio, level, type, detune] of partials) {
    const oscillator = audioContext.createOscillator();
    const partialGain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency * ratio, startsAt);
    oscillator.detune.setValueAtTime(detune, startsAt);
    partialGain.gain.setValueAtTime(level, startsAt);
    oscillator.connect(partialGain).connect(envelope);
    oscillator.start(startsAt);
    oscillator.stop(endsAt + 0.04);
  }
}

function scheduleBackgroundMusicStep(noteTime: number, step: number): void {
  const stepDuration = CLASSICAL_PIANO_STEP_MILLISECONDS / 1000;
  const humanizedNoteTime = noteTime + Math.sin(step * 0.7) * 0.004;
  const voicing = classicalPianoVoicing(step);
  const barAccent = step % 8 === 0 ? 1 : 0.88;

  if (voicing.bass !== null) {
    playPianoNote(
      voicing.bass,
      humanizedNoteTime,
      stepDuration * 3.7,
      0.34 * barAccent,
    );
  }

  playPianoNote(
    voicing.harmony,
    humanizedNoteTime + 0.008,
    stepDuration * 2.45,
    0.21 * barAccent,
  );

  if (voicing.melody) {
    playPianoNote(
      voicing.melody.midi,
      humanizedNoteTime + 0.018,
      stepDuration * (voicing.melody.durationSteps + 0.8),
      0.5 * barAccent,
    );
  }
}

function fillBackgroundMusicSchedule(): void {
  if (
    !audioContext ||
    audioContext.state !== "running" ||
    !backgroundMusicBus ||
    !backgroundMusicEnabled
  ) {
    return;
  }

  const stepDuration = CLASSICAL_PIANO_STEP_MILLISECONDS / 1000;
  const scheduleUntil =
    audioContext.currentTime + PIANO_SCHEDULE_AHEAD_SECONDS;
  while (backgroundMusicNextStepTime < scheduleUntil) {
    scheduleBackgroundMusicStep(
      backgroundMusicNextStepTime,
      backgroundMusicStep,
    );
    backgroundMusicNextStepTime += stepDuration;
    backgroundMusicStep += 1;
  }
}

function startBackgroundMusic(): void {
  if (
    !backgroundMusicEnabled ||
    game.phase !== "playing" ||
    !audioContext ||
    audioContext.state !== "running" ||
    backgroundMusicBus
  ) {
    return;
  }

  const now = audioContext.currentTime;
  const bus = audioContext.createGain();
  const pianoInput = audioContext.createGain();
  const dryGain = audioContext.createGain();
  const room = audioContext.createConvolver();
  const roomGain = audioContext.createGain();
  const compressor = audioContext.createDynamicsCompressor();

  bus.gain.setValueAtTime(0.0001, now);
  bus.gain.exponentialRampToValueAtTime(0.105, now + 0.7);
  pianoInput.gain.setValueAtTime(0.92, now);
  dryGain.gain.setValueAtTime(0.88, now);
  roomGain.gain.setValueAtTime(0.19, now);
  compressor.threshold.setValueAtTime(-18, now);
  compressor.knee.setValueAtTime(12, now);
  compressor.ratio.setValueAtTime(3, now);
  compressor.attack.setValueAtTime(0.008, now);
  compressor.release.setValueAtTime(0.24, now);
  backgroundMusicRoomImpulse ??= createPianoRoomImpulse();
  room.buffer = backgroundMusicRoomImpulse;

  pianoInput.connect(dryGain).connect(bus);
  pianoInput.connect(room).connect(roomGain).connect(bus);
  bus.connect(compressor).connect(audioContext.destination);

  backgroundMusicBus = bus;
  backgroundMusicPianoInput = pianoInput;
  backgroundMusicStep = 0;
  backgroundMusicNextStepTime = now + 0.05;
  musicButton.dataset.playing = "true";
  fillBackgroundMusicSchedule();
  backgroundMusicTimer = window.setInterval(
    fillBackgroundMusicSchedule,
    PIANO_SCHEDULER_INTERVAL_MILLISECONDS,
  );
}

function stopBackgroundMusic(fadeDuration = 0.5): void {
  musicButton.dataset.playing = "false";
  if (backgroundMusicTimer) {
    window.clearInterval(backgroundMusicTimer);
    backgroundMusicTimer = 0;
  }
  if (!audioContext || !backgroundMusicBus) return;

  const now = audioContext.currentTime;
  const bus = backgroundMusicBus;
  backgroundMusicBus = null;
  backgroundMusicPianoInput = null;
  backgroundMusicNextStepTime = 0;
  bus.gain.cancelScheduledValues(now);
  bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
  bus.gain.exponentialRampToValueAtTime(0.0001, now + fadeDuration);
  window.setTimeout(() => bus.disconnect(), (fadeDuration + 0.1) * 1000);
}

function updateMusicButton(): void {
  musicButton.dataset.muted = String(!backgroundMusicEnabled);
  musicButton.setAttribute("aria-pressed", String(backgroundMusicEnabled));
  musicButton.title = backgroundMusicEnabled
    ? "Mute background music"
    : "Play background music";
}

function toggleBackgroundMusic(): void {
  backgroundMusicEnabled = !backgroundMusicEnabled;
  updateMusicButton();
  if (!backgroundMusicEnabled) {
    stopBackgroundMusic(0.2);
    return;
  }

  ensureAudio();
  startBackgroundMusic();
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
    repair: ["sine", 440, 880, 0.22],
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
  const x = clientX - viewLeft;
  const y = clientY - viewTop;
  game.targetAngle = Math.atan2(y - centreY, x - centreX);
}

function frame(now: number): void {
  const delta = Math.min(0.05, Math.max(0, (now - lastFrameTime) / 1000));
  lastFrameTime = now;
  if (!document.hidden && !gameSessionIsFrozen(game.phase)) {
    update(delta);
    draw();
  }
  animationFrame = requestAnimationFrame(frame);
}

window.addEventListener("resize", () => {
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    resizeCanvas();
    if (gameSessionIsFrozen(game.phase)) draw();
  });
});
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
  if (event.key === "Escape" && !event.repeat) {
    const nextPhase = toggledPausePhase(game.phase);
    if (nextPhase !== game.phase) {
      togglePause();
      event.preventDefault();
    }
    return;
  }

  if (game.phase === "paused") {
    if (event.key === "Tab") {
      resumeButton.focus({ preventScroll: true });
      event.preventDefault();
    }
    return;
  }

  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (["ArrowLeft", "ArrowRight", "a", "d"].includes(key)) {
    heldKeys.add(key);
    ensureAudio();
    event.preventDefault();
  }
  const targetIsButton = event.target instanceof HTMLButtonElement;
  if (
    !targetIsButton &&
    game.phase === "ready" &&
    ["Enter", " "].includes(event.key)
  ) {
    startGame();
    event.preventDefault();
  } else if (
    !targetIsButton &&
    (game.phase === "won" || game.phase === "lost") &&
    ["Enter", " "].includes(event.key)
  ) {
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
  if (document.hidden) stopBackgroundMusic(0.2);
  else startBackgroundMusic();
});
restartButton.addEventListener("click", restart);
resumeButton.addEventListener("click", resumeGame);
musicButton.addEventListener("click", toggleBackgroundMusic);
modeButton.addEventListener("click", () => {
  showStartScreen();
  const selectedMode = document.querySelector<HTMLButtonElement>(
    `[data-mode="${game.mode}"]`,
  );
  selectedMode?.focus({ preventScroll: true });
});
modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;
    if (mode === "standard" || mode === "infinite") setGameMode(mode);
  });
});
performanceHud.addEventListener("animationend", () => {
  performanceHud.classList.remove(
    "is-combo-hit",
    "is-rank-up",
    "is-combo-broken",
  );
});
startButton.addEventListener("click", startGame);

resizeCanvas();
showStartScreen();
setGameMode("standard");
updateMusicButton();
cancelAnimationFrame(animationFrame);
animationFrame = requestAnimationFrame(frame);
