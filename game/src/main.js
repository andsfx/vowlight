// Boot, the screen flow and the fixed-step loop: build the world, read input, step at 1/60 s, draw.

import { STORAGE_KEY, TEXT, FIELD } from './config.js';
import { createRandom, seedFromText } from './random.js';
import { createInput, setInputViewport, readControl, consumeKeyPress, clearInputFrame } from './input.js';
import { createKeeper, refillFlame, updateKeeper } from './core.js';
import { createWaveDirector, updateSwarm, advanceWaves, updateCombo } from './swarm.js';
import { createBoltPool, updateBolts, clearBolts } from './bolts.js';
import { createEffectField, updateEffects } from './effects.js';
import {
  createAudioBank,
  unlockAudio,
  startDrone,
  stopDrone,
  toggleMute,
  playVictoryChord,
  playDefeatFall,
} from './audio.js';
import { computeViewport, resizeCanvas, drawFrame } from './render.js';
import { stageShot } from './shots.js';

/** The simulation runs at a fixed 60 steps a second, whatever the display does. */
const STEP_SECONDS = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;

/** The best score this browser has seen, or zero when storage is unavailable. */
function readBestScore() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

/** Write the best score back, but only when this run beat it. */
function saveBestScore(world) {
  if (world.score <= world.best) return;
  world.best = world.score;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, String(world.best));
  } catch {
    // A browser with storage blocked still plays; only the record is lost.
  }
}

/** A world at the title, with a seeded rng and every subsystem empty. */
export function createWorld(seed) {
  const rng = createRandom(seed);
  const world = {
    seed,
    rng,
    time: 0,
    elapsed: 0,
    state: 'title',
    lastState: 'title',
    keeper: createKeeper(),
    bolts: createBoltPool(),
    enemies: [],
    wave: createWaveDirector(),
    swarmSerial: 0,
    effects: createEffectField(rng),
    audio: createAudioBank(),
    control: { moveX: 0, moveY: 0, aimActive: false, aimX: FIELD.width / 2, aimY: FIELD.height / 2, braced: false },
    score: 0,
    best: readBestScore(),
    combo: 1,
    comboTimer: 0,
    bestCombo: 1,
    kills: 0,
    reflections: 0,
    framesPainted: 0,
    paused: false,
  };
  world.step = (dt) => stepSimulation(world, dt);
  return world;
}

/** One fixed step of the whole simulation, in the order the rules depend on. */
export function stepSimulation(world, dt) {
  world.time += dt;
  if (world.state === 'play') {
    updateKeeper(world, dt);
    updateSwarm(world, dt);
    updateBolts(world, dt);
    if (world.state === 'play') {
      updateCombo(world, dt);
      advanceWaves(world, dt);
      world.elapsed += dt;
    }
  }
  updateEffects(world.effects, dt);
}

/** A fresh run: a full flame, an empty field, wave one a breath away. */
export function startRun(world) {
  world.state = 'play';
  world.keeper = createKeeper();
  refillFlame(world.keeper);
  world.enemies.length = 0;
  clearBolts(world);
  world.wave = createWaveDirector();
  world.time = 0;
  world.elapsed = 0;
  world.score = 0;
  world.combo = 1;
  world.comboTimer = 0;
  world.bestCombo = 1;
  world.kills = 0;
  world.reflections = 0;
  world.swarmSerial = 0;
  world.control = { moveX: 0, moveY: 0, aimActive: false, aimX: FIELD.width / 2, aimY: FIELD.height / 2, braced: false };
  world.effects.particles.length = 0;
  world.effects.rings.length = 0;
  world.effects.shake = 0;
  world.effects.flash.time = 0;
  startDrone(world.audio);
}

/** The line the page's live region reads out. */
function statusText(world) {
  if (world.state === 'play') {
    return `${TEXT.playStatusPrefix} ${world.wave.index}. Flame ${world.keeper.flames} of ${world.keeper.maxFlames}. Score ${world.score}.`;
  }
  if (world.state === 'victory') return TEXT.victoryStatus;
  if (world.state === 'defeat') return TEXT.defeatStatus;
  return TEXT.titleStatus;
}

/** The one-shot keys: start, restart, mute. */
function handleKeyPresses(world, input) {
  if (consumeKeyPress(input, 'KeyM')) {
    unlockAudio(world.audio);
    toggleMute(world.audio);
  }
  const start = consumeKeyPress(input, 'Space') || consumeKeyPress(input, 'Enter');
  const restart = consumeKeyPress(input, 'KeyR');
  if (world.state === 'title' && start) {
    unlockAudio(world.audio);
    startRun(world);
    return;
  }
  if ((world.state === 'victory' || world.state === 'defeat') && (start || restart)) {
    unlockAudio(world.audio);
    startRun(world);
    return;
  }
  if (world.state === 'play' && restart) startRun(world);
}

/** Side effects of entering a new screen: the record, the cue, the drone, the live region. */
function settleScreenChange(world, updateStatus) {
  if (world.lastState === world.state) return;
  world.lastState = world.state;
  if (world.state === 'victory') {
    saveBestScore(world);
    stopDrone(world.audio);
    playVictoryChord(world.audio);
  } else if (world.state === 'defeat') {
    saveBestScore(world);
    stopDrone(world.audio);
    playDefeatFall(world.audio);
  }
  updateStatus(statusText(world));
}

/** The page: canvas, input, a seeded world, and the accumulator loop that drives it. */
export function boot() {
  const canvas = document.getElementById('field');
  const statusLine = document.getElementById('status');
  const context = canvas.getContext('2d', { alpha: false });
  const updateStatus = (line) => {
    if (statusLine !== null) statusLine.textContent = line;
  };

  const params = new URLSearchParams(globalThis.location?.search ?? '');
  const seed = seedFromText(params.get('seed') ?? '7');
  const scene = params.get('shot');
  const world = createWorld(seed);
  const input = createInput(canvas);

  if (scene) {
    stageShot(world, scene, startRun);
    world.paused = true;
  }
  updateStatus(statusText(world));

  const unlock = () => unlockAudio(world.audio);
  globalThis.addEventListener('pointerdown', unlock);
  globalThis.addEventListener('keydown', unlock);

  let previous = globalThis.performance.now();
  let accumulator = 0;

  const frame = (now) => {
    const viewport = computeViewport(canvas);
    resizeCanvas(canvas, viewport);
    setInputViewport(input, viewport.scale, viewport.offsetX, viewport.offsetY);
    if (!world.paused) {
      const delta = Math.min(0.25, (now - previous) / 1000);
      previous = now;
      accumulator += delta;
      let steps = 0;
      while (accumulator >= STEP_SECONDS && steps < MAX_STEPS_PER_FRAME) {
        world.control = readControl(input);
        world.step(STEP_SECONDS);
        accumulator -= STEP_SECONDS;
        steps += 1;
      }
      if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;
      handleKeyPresses(world, input);
      clearInputFrame(input);
      settleScreenChange(world, updateStatus);
    }
    drawFrame(context, world, viewport);
    if (scene && world.framesPainted >= 2) globalThis.__shotReady = true;
    globalThis.requestAnimationFrame(frame);
  };
  globalThis.requestAnimationFrame(frame);
}

if (typeof document !== 'undefined') boot();
