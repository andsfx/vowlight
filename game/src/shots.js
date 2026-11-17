// The four deterministic scenes behind ?shot=title|play|victory|defeat, each staged by the same loop
// so a given ?seed=N renders the same frame every time.

import { WAVES, FIELD } from './config.js';
import { beginWave, spawnEnemy, placeEnemy } from './swarm.js';
import { spawnBurst } from './effects.js';

/** The autopilot's steer: aim at the closest incoming bolt, hold the ward's centre on the field. */
function driftToCentre(keeper, strength) {
  const dx = FIELD.width / 2 - keeper.x;
  const dy = FIELD.height / 2 - keeper.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 30) return { moveX: 0, moveY: 0 };
  return { moveX: (dx / distance) * Math.min(1, distance / 120) * strength, moveY: (dy / distance) * Math.min(1, distance / 120) * strength };
}

/**
 * The mind the screenshots play with: on default it braces inside 260 px and aims the ward at the
 * nearest hostile bolt; with aimAway it points the ward away instead, which is how the flame is lost.
 */
export function autopilotControl(world, options = {}) {
  const keeper = world.keeper;
  const brace = options.brace ?? true;
  const aimAway = options.aimAway ?? false;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const bolt of world.bolts) {
    if (bolt.dead || bolt.friendly) continue;
    const dx = keeper.x - bolt.x;
    const dy = keeper.y - bolt.y;
    const closing = dx * bolt.vx + dy * bolt.vy > 0;
    if (!closing) continue;
    const distance = Math.hypot(dx, dy);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = bolt;
    }
  }
  let aimX = keeper.x + Math.cos(keeper.wardAngle) * 80;
  let aimY = keeper.y + Math.sin(keeper.wardAngle) * 80;
  let braced = false;
  if (nearest !== null) {
    if (aimAway) {
      aimX = keeper.x - (nearest.x - keeper.x);
      aimY = keeper.y - (nearest.y - keeper.y);
    } else {
      aimX = nearest.x + nearest.vx * 0.12;
      aimY = nearest.y + nearest.vy * 0.12;
    }
    braced = brace && nearestDistance < 260;
  }
  const drift = driftToCentre(keeper, 0.8);
  return { moveX: drift.moveX, moveY: drift.moveY, aimActive: true, aimX, aimY, braced };
}

/** Whether the play frame has everything it needs: a return in flight, a chain, and husks still up. */
export function playFrameIsReady(world) {
  const bolts = world.bolts.filter((bolt) => !bolt.dead);
  const reflected = bolts.some((bolt) => bolt.friendly);
  const inFlight = bolts.length;
  return reflected && inFlight >= 3 && world.combo >= 5 && world.enemies.length >= 2;
}

/** The title: forty frames of the ash drifting, then the panel over a live arena. */
export function stageTitleShot(world) {
  world.state = 'title';
  for (let step = 0; step < 40; step++) world.step(1 / 60);
}

/** Wave 4 with the autopilot, held on a frame with a reflection in flight and a x5 chain. */
export function stagePlayShot(world, beginRun) {
  for (let attempt = 0; attempt < 5; attempt++) {
    beginRun(world);
    world.wave.index = 3;
    beginWave(world);
    world.wave.banner = null;
    world.score = 1180;
    world.bestCombo = 5;
    world.elapsed = 96;
    for (let step = 0; step < 60 * 45; step++) {
      world.control = autopilotControl(world, { brace: true });
      world.step(1 / 60);
      if (world.state !== 'play') break;
      if (world.time > 6 && playFrameIsReady(world)) return true;
    }
  }
  // Could not hold a live chain: hand back the last playable frame rather than a wrong screen.
  world.state = 'play';
  return false;
}

/** A won run seeded directly: ten waves cleared, a deep score, the kept vow's panel. */
export function stageVictoryShot(world, beginRun) {
  beginRun(world);
  world.state = 'victory';
  world.score = 12640;
  world.best = 12640;
  world.bestCombo = 7;
  world.elapsed = 372;
  world.kills = 46;
  world.wave.index = WAVES.total;
  world.wave.cleared = WAVES.total;
  world.wave.phase = 'done';
  world.wave.banner = null;
  world.keeper.flames = 2;
  for (let i = 0; i < 8; i++) spawnBurst(world.effects, world.rng.range(200, 1080), world.rng.range(180, 520), '255, 179, 71', 6, 90, 2);
  for (let step = 0; step < 24; step++) world.step(1 / 60);
}

/** The flame lost the hard way: the autopilot points the ward away and never braces, until the dark wins. */
export function stageDefeatShot(world, beginRun) {
  beginRun(world);
  world.wave.index = 4;
  beginWave(world);
  world.wave.banner = null;
  world.score = 2140;
  world.bestCombo = 4;
  for (let step = 0; step < 60 * 90; step++) {
    world.control = autopilotControl(world, { brace: false, aimAway: true });
    world.step(1 / 60);
    if (world.state === 'defeat') break;
  }
  if (world.state !== 'defeat') {
    world.keeper.flames = 0;
    world.state = 'defeat';
  }
  world.best = Math.max(world.best, world.score);
  world.elapsed = 179;
  for (let step = 0; step < 20; step++) world.step(1 / 60);
}

/** Route a scene name to its stager. */
export function stageShot(world, scene, beginRun) {
  const name = String(scene ?? 'play');
  if (name === 'title') stageTitleShot(world);
  else if (name === 'victory') stageVictoryShot(world, beginRun);
  else if (name === 'defeat') stageDefeatShot(world, beginRun);
  else stagePlayShot(world, beginRun);
  return name;
}