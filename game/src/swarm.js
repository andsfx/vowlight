// The husk roster: the four enemy kinds and their ai, the ten-wave director, kills, score and combo.

import { ENEMY_KINDS, WAVES, COMBO, FIELD } from './config.js';
import { angleDelta, clampPointToField, turnToward } from './collision.js';
import { spawnDeathBurst, spawnBurst, addShake } from './effects.js';
import { playKillPop, playWaveGong } from './audio.js';
import { spawnEnemyBolt } from './bolts.js';

const DEG = Math.PI / 180;

/** A director that has not opened wave one yet: a short intro, then the first banner. */
export function createWaveDirector() {
  return {
    index: 0,
    phase: 'intro',
    timer: WAVES.introSeconds,
    clock: 0,
    queue: [],
    spawned: 0,
    cleared: 0,
    banner: null,
  };
}

/** Wave N brings 3 + N husks. */
export function waveEnemyCount(index) {
  return WAVES.firstCount + index;
}

/** Which kinds a wave is made of; the warden closes waves 4, 7 and 10. */
function weightedKind(index, rng) {
  if (index <= 1) return 'wisp';
  const roll = rng.next();
  const splitChance = index >= 3 ? 0.18 + Math.min(0.12, index * 0.012) : 0;
  const lancerChance = 0.3 + Math.min(0.14, index * 0.015);
  if (roll < splitChance) return 'splitter';
  if (roll < splitChance + lancerChance) return 'lancer';
  return 'wisp';
}

/** The full roster of one wave, in spawn order, the warden last. */
export function waveComposition(index, rng) {
  const count = waveEnemyCount(index);
  const escort = WAVES.wardenWaves.includes(index) ? count - 1 : count;
  const kinds = [];
  for (let i = 0; i < escort; i++) kinds.push(weightedKind(index, rng));
  if (escort < count) kinds.push('warden');
  return kinds;
}

/** Open the next wave: bump the index, build the spawn queue and raise the banner. */
export function beginWave(world) {
  const director = world.wave;
  director.index += 1;
  director.phase = 'spawning';
  director.clock = 0;
  director.spawned = 0;
  director.queue = [];
  let at = 0.35;
  for (const kind of waveComposition(director.index, world.rng)) {
    director.queue.push({ kind, at });
    at += world.rng.range(WAVES.spawnGapMin, WAVES.spawnGapMax);
  }
  director.banner = { text: `${director.index}`, timer: WAVES.bannerSeconds };
  playWaveGong(world.audio);
}

/** A spot on the field for a husk to arrive at: a ring around the keeper, nudged back inside the arena. */
export function placeEnemy(world, rng) {
  const keeper = world.keeper;
  const distance = rng.range(WAVES.spawnRadiusMin, WAVES.spawnRadiusMax);
  let x = keeper.x + Math.cos(rng.angle()) * distance;
  let y = keeper.y + Math.sin(rng.angle()) * distance;
  for (let attempt = 0; attempt < 10; attempt++) {
    if (x > 84 && x < FIELD.width - 84 && y > 84 && y < FIELD.height - 84) break;
    x = keeper.x + Math.cos(rng.angle()) * distance;
    y = keeper.y + Math.sin(rng.angle()) * distance;
  }
  return clampPointToField(x, y, 76, FIELD.width, FIELD.height);
}

/** Add one husk to the roster, with the timers its kind needs. */
export function spawnEnemy(world, kind, x, y) {
  const spec = ENEMY_KINDS[kind];
  const keeper = world.keeper;
  world.swarmSerial += 1;
  const enemy = {
    id: world.swarmSerial,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    health: spec.health,
    maxHealth: spec.health,
    radius: spec.radius,
    facing: Math.atan2(keeper.y - y, keeper.x - x),
    fireTimer: spec.fireEvery ? spec.fireEvery * world.rng.range(0.45, 0.95) : 0,
    telegraph: 0,
    aimAngle: 0,
    phase: world.rng.angle(),
    orbitSign: world.rng.sign(),
    flash: 0,
    age: 0,
    dead: false,
  };
  world.enemies.push(enemy);
  return enemy;
}

/** Velocity eased toward a target speed along a direction, so husks never snap. */
function steerEnemyToward(enemy, x, y, speed, dt) {
  const dx = x - enemy.x;
  const dy = y - enemy.y;
  const distance = Math.hypot(dx, dy);
  const wantX = distance < 5 ? 0 : (dx / distance) * speed;
  const wantY = distance < 5 ? 0 : (dy / distance) * speed;
  const blend = Math.min(1, 5 * dt);
  enemy.vx += (wantX - enemy.vx) * blend;
  enemy.vy += (wantY - enemy.vy) * blend;
}

/** Wisps circle the flame on a wide ring, drifting slowly round it. */
function moveWisp(world, enemy, dt) {
  const spec = ENEMY_KINDS.wisp;
  enemy.phase += enemy.orbitSign * dt * 0.5;
  const target = clampPointToField(
    world.keeper.x + Math.cos(enemy.phase) * spec.orbitRadius,
    world.keeper.y + Math.sin(enemy.phase) * spec.orbitRadius,
    54,
    FIELD.width,
    FIELD.height,
  );
  steerEnemyToward(enemy, target.x, target.y, spec.speed, dt);
}

/** Lancers plant themselves and hold their line, backing off only if the keeper closes in. */
function holdLancer(world, enemy, dt) {
  const spec = ENEMY_KINDS.lancer;
  const keeper = world.keeper;
  const distance = Math.hypot(keeper.x - enemy.x, keeper.y - enemy.y);
  if (distance < spec.preferredRange - 90) {
    const awayX = enemy.x + (enemy.x - keeper.x);
    const awayY = enemy.y + (enemy.y - keeper.y);
    steerEnemyToward(enemy, awayX, awayY, 90, dt);
  } else {
    enemy.vx *= 1 - Math.min(1, 6 * dt);
    enemy.vy *= 1 - Math.min(1, 6 * dt);
  }
}

/** Splitters walk the flame down slowly and stop just short of touching it. */
function chaseSplitter(world, enemy, dt) {
  const spec = ENEMY_KINDS.splitter;
  const keeper = world.keeper;
  const distance = Math.hypot(keeper.x - enemy.x, keeper.y - enemy.y);
  if (distance > spec.standoff) steerEnemyToward(enemy, keeper.x, keeper.y, spec.speed, dt);
  else {
    enemy.vx *= 1 - Math.min(1, 4 * dt);
    enemy.vy *= 1 - Math.min(1, 4 * dt);
  }
}

/** Wardens keep their distance, strafing slowly so their plate is never a sitting target. */
function moveWarden(world, enemy, dt) {
  const spec = ENEMY_KINDS.warden;
  const keeper = world.keeper;
  const dx = keeper.x - enemy.x;
  const dy = keeper.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  const nx = dx / distance;
  const ny = dy / distance;
  const push = distance > spec.preferredRange + 50 ? 1 : distance < spec.preferredRange - 50 ? -1 : 0;
  const strafe = Math.sin(enemy.age * 0.7 + enemy.phase) * 0.7;
  const wantX = nx * push * spec.speed + -ny * strafe * spec.speed;
  const wantY = ny * push * spec.speed + nx * strafe * spec.speed;
  const blend = Math.min(1, 3 * dt);
  enemy.vx += (wantX - enemy.vx) * blend;
  enemy.vy += (wantY - enemy.vy) * blend;
}

/** Husks turn to face the flame, which is what the warden's front plate follows. */
function faceKeeperSlowly(world, enemy, dt) {
  const target = Math.atan2(world.keeper.y - enemy.y, world.keeper.x - enemy.x);
  enemy.facing = turnToward(enemy.facing, target, 2.4 * dt);
}

/** Nothing leaves the arena: husks bounce gently off the inset edge. */
function keepInsideArena(enemy, inset) {
  const held = clampPointToField(enemy.x, enemy.y, inset, FIELD.width, FIELD.height);
  if (held.x !== enemy.x) {
    enemy.x = held.x;
    enemy.vx *= -0.4;
  }
  if (held.y !== enemy.y) {
    enemy.y = held.y;
    enemy.vy *= -0.4;
  }
}

/** A husk that walks into the flame is pushed back out, so bodies never stack on the keeper. */
function separateFromKeeper(world, enemy) {
  const keeper = world.keeper;
  const dx = enemy.x - keeper.x;
  const dy = enemy.y - keeper.y;
  const distance = Math.hypot(dx, dy) || 1;
  const wanted = enemy.radius + 16;
  if (distance >= wanted) return;
  const push = (wanted - distance) / distance;
  enemy.x += dx * push;
  enemy.y += dy * push;
}

/** A wisp or warden bolt aimed at the flame, with a little spread so the ward still has to work. */
function fireAtKeeper(world, enemy, spec) {
  const keeper = world.keeper;
  const angle = Math.atan2(keeper.y - enemy.y, keeper.x - enemy.x) + world.rng.spread(spec.aimSpread ?? 0.035);
  const muzzle = enemy.radius + 7;
  spawnEnemyBolt(world, enemy.x + Math.cos(angle) * muzzle, enemy.y + Math.sin(angle) * muzzle, angle, spec.boltSpeed, enemy.kind);
}

/** The warden's three-bolt fan. */
function fireWardenSpread(world, enemy) {
  const spec = ENEMY_KINDS.warden;
  const keeper = world.keeper;
  const base = Math.atan2(keeper.y - enemy.y, keeper.x - enemy.x);
  const muzzle = enemy.radius + 8;
  for (let i = 0; i < spec.spread; i++) {
    const offset = (i - (spec.spread - 1) / 2) * spec.spreadArc;
    const angle = base + offset;
    spawnEnemyBolt(world, enemy.x + Math.cos(angle) * muzzle, enemy.y + Math.sin(angle) * muzzle, angle, spec.boltSpeed, enemy.kind);
  }
}

/** A lancer's 1 s telegraph: the aim tracks, then locks, then a fast bolt leaves along the line. */
function updateLancerFire(world, enemy, dt) {
  const spec = ENEMY_KINDS.lancer;
  const keeper = world.keeper;
  if (enemy.telegraph > 0) {
    enemy.telegraph -= dt;
    if (enemy.telegraph > 0.18) enemy.aimAngle = Math.atan2(keeper.y - enemy.y, keeper.x - enemy.x);
    if (enemy.telegraph <= 0) {
      const muzzle = enemy.radius + 8;
      spawnEnemyBolt(world, enemy.x + Math.cos(enemy.aimAngle) * muzzle, enemy.y + Math.sin(enemy.aimAngle) * muzzle, enemy.aimAngle, spec.boltSpeed, 'lancer');
      enemy.telegraph = 0;
      enemy.fireTimer = spec.fireEvery;
    }
    return;
  }
  enemy.fireTimer -= dt;
  if (enemy.fireTimer <= 0) {
    enemy.telegraph = spec.telegraphSeconds;
    enemy.fireTimer = 0;
    enemy.aimAngle = Math.atan2(keeper.y - enemy.y, keeper.x - enemy.x);
  }
}

/** Each kind's firing rhythm, or none for the splitter. */
function updateEnemyFire(world, enemy, dt) {
  const spec = ENEMY_KINDS[enemy.kind];
  if (!spec.fireEvery) return;
  if (enemy.kind === 'lancer') {
    updateLancerFire(world, enemy, dt);
    return;
  }
  enemy.fireTimer -= dt;
  if (enemy.fireTimer > 0) return;
  enemy.fireTimer = spec.fireEvery * world.rng.range(0.85, 1.15);
  if (enemy.kind === 'warden') fireWardenSpread(world, enemy);
  else fireAtKeeper(world, enemy, spec);
}

/** The whole roster's step: behaviour, movement, facing, firing, then the dead are swept out. */
export function updateSwarm(world, dt) {
  if (world.state !== 'play') return;
  for (const enemy of world.enemies) {
    if (enemy.dead) continue;
    enemy.age += dt;
    enemy.flash = Math.max(0, enemy.flash - dt);
    switch (enemy.kind) {
      case 'wisp':
        moveWisp(world, enemy, dt);
        break;
      case 'lancer':
        holdLancer(world, enemy, dt);
        break;
      case 'splitter':
        chaseSplitter(world, enemy, dt);
        break;
      case 'warden':
        moveWarden(world, enemy, dt);
        break;
      default:
        break;
    }
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    keepInsideArena(enemy, enemy.radius + 14);
    separateFromKeeper(world, enemy);
    faceKeeperSlowly(world, enemy, dt);
    updateEnemyFire(world, enemy, dt);
  }
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    if (world.enemies[i].dead) world.enemies.splice(i, 1);
  }
}

/** Whether the warden's front plate turns a bolt away: only a hit from behind gets through. */
export function armourBlocksBolt(enemy, bolt) {
  if (enemy.kind !== 'warden') return false;
  const travel = Math.atan2(bolt.vy, bolt.vx);
  const halfArc = ENEMY_KINDS.warden.armourHalfArcDegrees * DEG;
  return Math.abs(angleDelta(travel, enemy.facing)) < halfArc;
}

/** Take health off a husk; a husk brought to zero dies at once. */
export function damageEnemy(world, enemy, amount) {
  if (enemy.dead) return false;
  enemy.health -= amount;
  enemy.flash = 0.14;
  if (enemy.health <= 0) {
    killEnemy(world, enemy);
    return true;
  }
  spawnBurst(world.effects, enemy.x, enemy.y, '139, 123, 240', 7, 130, 2);
  return false;
}

/** Points times the combo multiplier, the chain window restarted, and the best chain remembered. */
export function registerKill(world, enemy) {
  const points = ENEMY_KINDS[enemy.kind].points;
  const chained = world.comboTimer > 0;
  world.combo = chained ? Math.min(world.combo + 1, COMBO.maxMultiplier) : 1;
  world.comboTimer = COMBO.windowSeconds;
  world.bestCombo = Math.max(world.bestCombo, world.combo);
  world.score += points * world.combo;
  world.kills += 1;
}

/** A splitter comes apart into two wisps that fly out from where it died. */
export function splitEnemy(world, enemy) {
  const count = ENEMY_KINDS.splitter.splitInto;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + enemy.phase;
    const wisp = spawnEnemy(world, 'wisp', enemy.x + Math.cos(angle) * 26, enemy.y + Math.sin(angle) * 26);
    wisp.vx = Math.cos(angle) * 150;
    wisp.vy = Math.sin(angle) * 150;
    wisp.fireTimer = 1.1 + i * 0.4;
  }
}

/** A husk dies: score, burst, shake, sound, and the splitter's parting gift. */
export function killEnemy(world, enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  registerKill(world, enemy);
  const bright = enemy.kind === 'warden';
  spawnDeathBurst(world.effects, enemy.x, enemy.y, bright ? '221, 216, 255' : '139, 123, 240', enemy.radius);
  addShake(world.effects, bright ? 9 : 3.5);
  playKillPop(world.audio);
  if (enemy.kind === 'splitter') splitEnemy(world, enemy);
}

/** The chain window runs out and the multiplier falls back to x1. */
export function updateCombo(world, dt) {
  if (world.comboTimer <= 0) return;
  world.comboTimer = Math.max(0, world.comboTimer - dt);
  if (world.comboTimer === 0) world.combo = 1;
}

/** How many husks are standing. */
export function livingEnemies(world) {
  return world.enemies.length;
}

/**
 * The wave director's step: open waves after the intro or a breather, release queued husks while the
 * field has room, and call the wave cleared when the queue and the roster are both empty.
 */
export function advanceWaves(world, dt) {
  if (world.state !== 'play') return;
  const director = world.wave;
  if (director.banner) {
    director.banner.timer -= dt;
    if (director.banner.timer <= 0) director.banner = null;
  }
  if (director.phase === 'intro' || director.phase === 'breather') {
    director.timer -= dt;
    if (director.timer <= 0) beginWave(world);
    return;
  }
  if (director.phase !== 'spawning') return;
  director.clock += dt;
  while (director.queue.length > 0 && director.queue[0].at <= director.clock && world.enemies.length < WAVES.aliveCap) {
    const entry = director.queue.shift();
    const spot = placeEnemy(world, world.rng);
    spawnEnemy(world, entry.kind, spot.x, spot.y);
    director.spawned += 1;
  }
  if (director.queue.length > 0 || world.enemies.length > 0) return;
  director.cleared = director.index;
  if (director.index >= WAVES.total) {
    world.state = 'victory';
    return;
  }
  director.phase = 'breather';
  director.timer = WAVES.breatherSeconds;
}

/** A fresh roster and director for a new run. */
export function resetSwarm(world) {
  world.enemies.length = 0;
  world.wave = createWaveDirector();
  world.swarmSerial = 0;
}
