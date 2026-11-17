// The projectile pool: enemy bolts, their arm and flight, the ward's reflection, friendly bolts,
// the husks they strike and the splash a burst leaves behind.

import { BOLT, SPLASH, KEEPER, FIELD } from './config.js';
import { circlesTouch, reflectVelocityOffRadial, segmentTouchesArc } from './collision.js';
import { wardGeometry, absorbBoltHit } from './core.js';
import { damageEnemy, armourBlocksBolt } from './swarm.js';
import { spawnBurst, spawnReflectRing, spawnSplashRing, addShake, flashScreen } from './effects.js';
import { playWardPing, playHurtThud } from './audio.js';

const OFF_FIELD = 70;

/** An empty pool: every slot is drawn from this array and reused after its bolt retires. */
export function createBoltPool() {
  return [];
}

/** A free slot from the pool, or a new one when every slot is still in flight. */
function takeBolt(world) {
  let bolt = null;
  for (const candidate of world.bolts) {
    if (candidate.dead) {
      bolt = candidate;
      break;
    }
  }
  if (bolt === null) {
    bolt = { trail: [] };
    world.bolts.push(bolt);
  }
  bolt.dead = false;
  bolt.trail.length = 0;
  return bolt;
}

/** Send a bolt out of a husk: it charges at the muzzle for a beat, then flies. */
export function spawnEnemyBolt(world, x, y, angle, speed, owner) {
  const bolt = takeBolt(world);
  bolt.x = x;
  bolt.y = y;
  bolt.px = x;
  bolt.py = y;
  bolt.vx = Math.cos(angle) * speed;
  bolt.vy = Math.sin(angle) * speed;
  bolt.angle = angle;
  bolt.radius = BOLT.radius;
  bolt.armed = BOLT.armSeconds;
  bolt.life = 7;
  bolt.friendly = false;
  bolt.owner = owner;
  bolt.phase = world.rng.angle();
}

/** Put a bolt back in the pool. */
function retireBolt(bolt) {
  bolt.dead = true;
}

/** Remember where the bolt just was, for the renderer's trail. */
function rememberTrail(bolt) {
  bolt.trail.push({ x: bolt.x, y: bolt.y });
  while (bolt.trail.length > BOLT.trailLength) bolt.trail.shift();
}

/**
 * A bolt that reached the ward comes back as the keeper's own: mirrored off the ward's radial normal,
 * 1.35x faster, alive for 3 s, and no longer able to hurt the flame.
 */
export function reflectBolt(world, bolt, keeper) {
  const dx = bolt.x - keeper.x;
  const dy = bolt.y - keeper.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = dx / length;
  const ny = dy / length;
  const mirrored = reflectVelocityOffRadial(bolt.vx, bolt.vy, nx, ny);
  const speed = Math.hypot(mirrored.x, mirrored.y) * BOLT.friendlySpeedScale;
  const direction = Math.hypot(mirrored.x, mirrored.y) || 1;
  bolt.vx = (mirrored.x / direction) * speed;
  bolt.vy = (mirrored.y / direction) * speed;
  const geometry = wardGeometry(keeper);
  const rim = geometry.radius + bolt.radius + 3;
  bolt.x = keeper.x + nx * rim;
  bolt.y = keeper.y + ny * rim;
  bolt.px = bolt.x;
  bolt.py = bolt.y;
  bolt.friendly = true;
  bolt.radius = BOLT.friendlyRadius;
  bolt.life = BOLT.friendlyLifeSeconds;
  bolt.armed = 0;
  bolt.trail.length = 0;
  world.reflections += 1;
  spawnReflectRing(world.effects, bolt.x, bolt.y, geometry.radius);
  spawnBurst(world.effects, bolt.x, bolt.y, '159, 252, 244', 10, 190, 2.2);
  addShake(world.effects, 2.4);
  playWardPing(world.audio);
}

/** The burst a friendly bolt leaves: 46 px of splash that also counts toward the chain. */
export function burstFriendlyBolt(world, bolt) {
  spawnSplashRing(world.effects, bolt.x, bolt.y, SPLASH.radius);
  const targets = world.enemies.slice();
  for (const enemy of targets) {
    if (enemy.dead) continue;
    if (circlesTouch(bolt.x, bolt.y, SPLASH.radius, enemy.x, enemy.y, enemy.radius)) damageEnemy(world, enemy, SPLASH.damage);
  }
}

/** The first husk a friendly bolt touches, or null; the warden's plate is checked by the caller. */
function firstEnemyTouched(world, bolt) {
  for (const enemy of world.enemies) {
    if (enemy.dead) continue;
    if (circlesTouch(bolt.x, bolt.y, bolt.radius, enemy.x, enemy.y, enemy.radius)) return enemy;
  }
  return null;
}

/** What a friendly bolt does when it lands: armour rings it off, otherwise damage then splash. */
function strikeEnemyWithBolt(world, bolt, enemy) {
  if (armourBlocksBolt(enemy, bolt)) {
    spawnBurst(world.effects, bolt.x, bolt.y, '221, 216, 255', 9, 150, 2);
    addShake(world.effects, 1.6);
    retireBolt(bolt);
    return;
  }
  damageEnemy(world, enemy, BOLT.damage);
  burstFriendlyBolt(world, bolt);
  retireBolt(bolt);
}

/** An enemy bolt reaching the flame: a pip gone, the combo gone, the screen washed pale amber. */
function strikeKeeperWithBolt(world, bolt) {
  const keeper = world.keeper;
  const result = absorbBoltHit(keeper);
  retireBolt(bolt);
  if (result === 'shielded') return;
  world.combo = 1;
  world.comboTimer = 0;
  spawnBurst(world.effects, keeper.x, keeper.y, '255, 179, 71', 20, 230, 3);
  addShake(world.effects, 12);
  flashScreen(world.effects, 0.5);
  playHurtThud(world.audio);
  if (result === 'out') world.state = 'defeat';
}

/** Whether a bolt is past the arena's edge. */
function boltLeftTheField(bolt) {
  return bolt.x < -OFF_FIELD || bolt.x > FIELD.width + OFF_FIELD || bolt.y < -OFF_FIELD || bolt.y > FIELD.height + OFF_FIELD;
}

/**
 * The pool's whole step: charge timers, flight, the ward's arc, husks for a friendly bolt, the flame for
 * an enemy one, and the fade of anything that leaves the arena.
 */
export function updateBolts(world, dt) {
  if (world.state !== 'play') return;
  const keeper = world.keeper;
  const geometry = wardGeometry(keeper);
  for (const bolt of world.bolts) {
    if (bolt.dead) continue;
    if (bolt.armed > 0) {
      bolt.armed -= dt;
      continue;
    }
    bolt.life -= dt;
    if (bolt.life <= 0) {
      retireBolt(bolt);
      continue;
    }
    bolt.px = bolt.x;
    bolt.py = bolt.y;
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
    rememberTrail(bolt);
    if (bolt.friendly) {
      const hit = firstEnemyTouched(world, bolt);
      if (hit !== null) strikeEnemyWithBolt(world, bolt, hit);
    } else {
      if (circlesTouch(bolt.x, bolt.y, bolt.radius, keeper.x, keeper.y, KEEPER.radius)) {
        strikeKeeperWithBolt(world, bolt);
        if (world.state !== 'play') return;
        continue;
      }
      const touchingWard = segmentTouchesArc(
        bolt.px,
        bolt.py,
        bolt.x,
        bolt.y,
        keeper.x,
        keeper.y,
        keeper.wardAngle,
        geometry.halfArc,
        geometry.radius,
        geometry.band + bolt.radius,
      );
      if (touchingWard) {
        reflectBolt(world, bolt, keeper);
        continue;
      }
    }
    if (boltLeftTheField(bolt)) retireBolt(bolt);
  }
}

/** Empty the pool between runs, while keeping its slots. */
export function clearBolts(world) {
  for (const bolt of world.bolts) bolt.dead = true;
}

/** How many hostile bolts are in the air (charging ones included). */
export function enemyBoltsInFlight(world) {
  let count = 0;
  for (const bolt of world.bolts) if (!bolt.dead && !bolt.friendly) count += 1;
  return count;
}

/** How many reflected bolts are in the air. */
export function friendlyBoltsInFlight(world) {
  let count = 0;
  for (const bolt of world.bolts) if (!bolt.dead && bolt.friendly) count += 1;
  return count;
}
