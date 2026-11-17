// Particles, burst rings, screen shake, the hit flash and the drifting ash the arena breathes.

import { FIELD, EFFECTS } from './config.js';

/** The empty field of effects: no particles, no rings, no shake, and ash seeded from the run's rng. */
export function createEffectField(rng) {
  const ash = [];
  for (let i = 0; i < EFFECTS.ashCount; i++) {
    ash.push({
      x: rng.range(0, FIELD.width),
      y: rng.range(0, FIELD.height),
      size: rng.range(0.6, 2.1),
      speed: rng.range(6, 22),
      drift: rng.range(4, 16),
      phase: rng.angle(),
      alpha: rng.range(0.08, 0.3),
    });
  }
  return {
    rng,
    time: 0,
    particles: [],
    rings: [],
    ash,
    shake: 0,
    shakePhase: rng.angle(),
    flash: { time: 0, duration: 0, strength: 0, colour: '255, 226, 180' },
  };
}

/** Keep the particle list inside its budget by dropping the oldest first. */
function trim(field) {
  const over = field.particles.length - EFFECTS.particleLimit;
  if (over > 0) field.particles.splice(0, over);
}

/** A burst of sparks flying out from a point, used for kills, reflections and bolt deaths. */
export function spawnBurst(field, x, y, colour, count = EFFECTS.burstParticles, speed = 190, size = 2.4) {
  for (let i = 0; i < count; i++) {
    const angle = field.rng.angle();
    const velocity = field.rng.range(speed * 0.25, speed);
    field.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: field.rng.range(0.24, 0.6),
      maxLife: 0.6,
      size: field.rng.range(size * 0.5, size),
      colour,
      kind: 'spark',
    });
  }
  trim(field);
}

/** A heavier burst for a husk coming apart: sparks plus a handful of slow embers. */
export function spawnDeathBurst(field, x, y, colour, radius) {
  spawnBurst(field, x, y, colour, 22, 240 + radius * 4, 3);
  for (let i = 0; i < 10; i++) {
    const angle = field.rng.angle();
    const velocity = field.rng.range(20, 80);
    field.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - 26,
      life: field.rng.range(0.5, 1.1),
      maxLife: 1.1,
      size: field.rng.range(1.4, 3.2),
      colour,
      kind: 'ember',
    });
  }
  trim(field);
}

/** The cyan ring that snaps out of the ward when a bolt is returned. */
export function spawnReflectRing(field, x, y, radius, colour = '87, 224, 216') {
  field.rings.push({ x, y, radius: radius * 0.6, maxRadius: radius * 3.4, life: 0.42, maxLife: 0.42, colour, width: 3 });
}

/** A shockwave ring for a bolt that burst into splash. */
export function spawnSplashRing(field, x, y, radius, colour = '159, 252, 244') {
  field.rings.push({ x, y, radius: radius * 0.3, maxRadius: radius, life: 0.3, maxLife: 0.3, colour, width: 2.5 });
}

/** A short camera shake; the largest beats a smaller one, so a big kill is never lost in noise. */
export function addShake(field, amount) {
  field.shake = Math.min(EFFECTS.shakeMax, Math.max(field.shake, amount));
}

/** The 90 ms wash of pale amber over the whole field when the flame is struck. */
export function flashScreen(field, strength = 0.5, colour = '255, 226, 180') {
  field.flash.time = EFFECTS.hitFlashSeconds;
  field.flash.duration = EFFECTS.hitFlashSeconds;
  field.flash.strength = strength;
  field.flash.colour = colour;
}

/** Advance every particle, ring, mote and the shake and flash clocks. */
export function updateEffects(field, dt) {
  field.time += dt;
  const drag = 1 - Math.min(0.9, 3.2 * dt);
  for (let i = field.particles.length - 1; i >= 0; i--) {
    const p = field.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      field.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= drag;
    p.vy *= drag;
    if (p.kind === 'ember') p.vy -= 12 * dt;
  }
  for (let i = field.rings.length - 1; i >= 0; i--) {
    const ring = field.rings[i];
    ring.life -= dt;
    if (ring.life <= 0) {
      field.rings.splice(i, 1);
      continue;
    }
    const t = 1 - ring.life / ring.maxLife;
    ring.radius += (ring.maxRadius - ring.radius) * Math.min(1, 9 * dt) + t * 40 * dt;
  }
  for (const mote of field.ash) {
    mote.y -= mote.speed * dt;
    mote.x += Math.sin(field.time * 0.6 + mote.phase) * mote.drift * dt;
    if (mote.y < -8) {
      mote.y = FIELD.height + 8;
      mote.x = field.rng.range(0, FIELD.width);
    }
    if (mote.x < -8) mote.x = FIELD.width + 8;
    if (mote.x > FIELD.width + 8) mote.x = -8;
  }
  field.shake = Math.max(0, field.shake - field.shake * EFFECTS.shakeDecay * dt - 6 * dt);
  field.shakePhase += dt * 60;
  if (field.flash.time > 0) field.flash.time = Math.max(0, field.flash.time - dt);
}

/** The camera's offset for this frame, from the decaying shake. */
export function shakeOffset(field) {
  if (field.shake <= 0.05) return { x: 0, y: 0 };
  return {
    x: Math.sin(field.shakePhase * 1.7) * field.shake,
    y: Math.cos(field.shakePhase * 2.3) * field.shake * 0.7,
  };
}

/** The drifting ash motes, drawn behind everything else. */
export function drawAsh(ctx, field, alphaScale = 1) {
  ctx.save();
  for (const mote of field.ash) {
    const twinkle = 0.6 + 0.4 * Math.sin(field.time * 1.4 + mote.phase);
    ctx.globalAlpha = mote.alpha * twinkle * alphaScale;
    ctx.fillStyle = '#cfe6ea';
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Sparks, embers and shards, with a wide translucent pass then a crisp one. */
export function drawParticles(ctx, field) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of field.particles) {
    const fade = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.strokeStyle = `rgba(${p.colour}, ${0.16 * fade})`;
    ctx.lineWidth = p.size * 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.014, p.y - p.vy * 0.014);
    ctx.stroke();
  }
  for (const p of field.particles) {
    const fade = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.strokeStyle = `rgba(${p.colour}, ${0.85 * fade})`;
    ctx.lineWidth = p.size;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.012, p.y - p.vy * 0.012);
    ctx.stroke();
  }
  ctx.restore();
}

/** The expanding rings: reflections, splash and the warden's plate ringing off. */
export function drawRings(ctx, field) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const ring of field.rings) {
    const fade = Math.max(0, ring.life / ring.maxLife);
    ctx.strokeStyle = `rgba(${ring.colour}, ${0.55 * fade})`;
    ctx.lineWidth = ring.width;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** The full-field wash of the hit flash. */
export function drawFlash(ctx, field) {
  if (field.flash.time <= 0 || field.flash.strength <= 0) return;
  const fade = field.flash.time / Math.max(field.flash.duration, 0.0001);
  ctx.save();
  ctx.fillStyle = `rgba(${field.flash.colour}, ${field.flash.strength * fade})`;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.restore();
}
