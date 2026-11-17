// The keeper: WASD movement, the ward's aim and brace, the flame pips and the invulnerability flicker.

import { KEEPER, WARD, FLAME, FIELD } from './config.js';
import { angleDelta, clampPointToField, turnToward } from './collision.js';

const DEG = Math.PI / 180;

/** A keeper at the arena centre with a full flame and the ward facing up. */
export function createKeeper() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    wardAngle: -Math.PI / 2,
    braced: false,
    flames: FLAME.pips,
    maxFlames: FLAME.pips,
    invulnerable: 0,
    trail: [],
  };
}

/** The ward's current reach: 90 degrees at 46 px, or 150 degrees at 54 px while braced. */
export function wardGeometry(keeper) {
  if (keeper.braced) {
    return {
      radius: WARD.braceRadius,
      halfArc: (WARD.braceArcDegrees * DEG) / 2,
      arcDegrees: WARD.braceArcDegrees,
      band: WARD.band,
    };
  }
  return {
    radius: WARD.idleRadius,
    halfArc: (WARD.idleArcDegrees * DEG) / 2,
    arcDegrees: WARD.idleArcDegrees,
    band: WARD.band,
  };
}

/** Hold the ward open (space or the right mouse button) or let it narrow. */
export function setKeeperBrace(keeper, braced) {
  keeper.braced = Boolean(braced);
}

/** Point the ward at a field position. */
export function aimWardAtPoint(keeper, x, y) {
  const dx = x - keeper.x;
  const dy = y - keeper.y;
  if (Math.hypot(dx, dy) < 0.5) return;
  keeper.wardAngle = Math.atan2(dy, dx);
}

/** The angle of the closest threat: the nearest enemy bolt still on its way in, or null. */
export function aimWardAtNearestBolt(keeper, bolts) {
  let best = null;
  let bestDistance = Infinity;
  for (const bolt of bolts) {
    if (bolt.dead || bolt.friendly) continue;
    const dx = bolt.x - keeper.x;
    const dy = bolt.y - keeper.y;
    const distance = Math.hypot(dx, dy);
    const closing = dx * bolt.vx + dy * bolt.vy < 0;
    if (!closing && distance > 120) continue;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = Math.atan2(dy, dx);
    }
  }
  return best;
}

/** Turn the ward toward a target angle at the keeper's turn rate. */
function turnWardTo(keeper, target, dt) {
  keeper.wardAngle = turnToward(keeper.wardAngle, target, KEEPER.wardTurnRate * dt);
}

/** Accelerate along the steer vector, halving the top speed while the ward is braced. */
export function steerKeeper(keeper, control, dt) {
  const topSpeed = keeper.braced ? KEEPER.speed * 0.5 : KEEPER.speed;
  const targetX = (control?.moveX ?? 0) * topSpeed;
  const targetY = (control?.moveY ?? 0) * topSpeed;
  const maxStep = KEEPER.acceleration * dt;
  keeper.vx += Math.max(-maxStep, Math.min(maxStep, targetX - keeper.vx));
  keeper.vy += Math.max(-maxStep, Math.min(maxStep, targetY - keeper.vy));
  keeper.x += keeper.vx * dt;
  keeper.y += keeper.vy * dt;
  const held = clampPointToField(keeper.x, keeper.y, KEEPER.margin, FIELD.width, FIELD.height);
  if (held.x !== keeper.x) keeper.vx = 0;
  if (held.y !== keeper.y) keeper.vy = 0;
  keeper.x = held.x;
  keeper.y = held.y;
  keeper.trail.push({ x: keeper.x, y: keeper.y });
  while (keeper.trail.length > KEEPER.trailLength) keeper.trail.shift();
}

/** Count the invulnerability down, so the flicker ends on its own. */
export function tickKeeperTimers(keeper, dt) {
  if (keeper.invulnerable > 0) keeper.invulnerable = Math.max(0, keeper.invulnerable - dt);
}

/** Whether the keeper is still untouchable from the last hit. */
export function keeperIsInvulnerable(keeper) {
  return keeper.invulnerable > 0;
}

/**
 * One enemy bolt landing on the keeper: no effect while invulnerable, otherwise a pip and 1.6 s of
 * flicker. Returns 'shielded', 'hurt' or 'out'.
 */
export function absorbBoltHit(keeper) {
  if (keeper.invulnerable > 0) return 'shielded';
  keeper.flames = Math.max(0, keeper.flames - 1);
  keeper.invulnerable = FLAME.invulnerableSeconds;
  return keeper.flames === 0 ? 'out' : 'hurt';
}

/** Restore the flame to full when a run starts. */
export function refillFlame(keeper) {
  keeper.flames = keeper.maxFlames;
  keeper.invulnerable = 0;
}

/** The keeper's whole step: brace, steer, aim, timers. */
export function updateKeeper(world, dt) {
  const keeper = world.keeper;
  const control = world.control ?? {};
  setKeeperBrace(keeper, control.braced);
  steerKeeper(keeper, control, dt);
  if (control.aimActive) {
    // A pointer aim only turns the ward; a slow ease keeps the arc readable frame to frame.
    const before = keeper.wardAngle;
    aimWardAtPoint(keeper, control.aimX, control.aimY);
    keeper.wardAngle = turnToward(before, keeper.wardAngle, KEEPER.wardTurnRate * 2 * dt);
  } else {
    const threat = aimWardAtNearestBolt(keeper, world.bolts ?? []);
    if (threat !== null) turnWardTo(keeper, threat, dt);
  }
  tickKeeperTimers(keeper, dt);
}

/** How far round the ward its arc now covers, in radians, for the renderer. */
export function wardHalfArc(keeper) {
  return wardGeometry(keeper).halfArc;
}

/** The signed angle a point is off the ward's centre line, for the renderer's highlights. */
export function wardOffsetOf(keeper, x, y) {
  return angleDelta(Math.atan2(y - keeper.y, x - keeper.x), keeper.wardAngle);
}
