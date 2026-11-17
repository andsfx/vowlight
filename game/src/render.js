// The draw order: arena haze and rings, drifting ash, husks, the keeper and its ward, bolts, particles,
// the vignette, the hud and whichever full screen the run is on.

import { FIELD, PALETTE, WARD, KEEPER, FLAME, BOLT, ENEMY_KINDS } from './config.js';
import { wardGeometry } from './core.js';
import { shakeOffset, drawAsh, drawParticles, drawRings, drawFlash } from './effects.js';
import { drawHud } from './hud.js';
import { drawTitleScreen, drawVictoryScreen, drawDefeatScreen } from './screens.js';

const TAU = Math.PI * 2;

/** Where the 1280x720 field sits inside the window: a scale and a letterbox offset, in css pixels. */
export function computeViewport(canvas) {
  const width = canvas.clientWidth || FIELD.width;
  const height = canvas.clientHeight || FIELD.height;
  const scale = Math.min(width / FIELD.width, height / FIELD.height);
  return {
    scale,
    offsetX: (width - FIELD.width * scale) / 2,
    offsetY: (height - FIELD.height * scale) / 2,
    dpr: Math.min(2, globalThis.devicePixelRatio || 1),
    pixelWidth: width,
    pixelHeight: height,
  };
}

/** Size the backing store to the window, once per change. */
export function resizeCanvas(canvas, viewport) {
  const width = Math.round(viewport.pixelWidth * viewport.dpr);
  const height = Math.round(viewport.pixelHeight * viewport.dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

/** A regular polygon path, the base shape of every husk. */
function polygonPath(ctx, x, y, radius, sides, rotation) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (i / sides) * TAU;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** The arena floor: a deep radial haze, a faint ring grid marking the ward's reach, and a horizon. */
export function drawArena(ctx, world) {
  const centreX = FIELD.width / 2;
  const centreY = FIELD.height / 2;
  const floor = ctx.createRadialGradient(centreX, centreY - 60, 30, centreX, centreY, 760);
  floor.addColorStop(0, '#132630');
  floor.addColorStop(0.32, '#0d1a23');
  floor.addColorStop(0.68, '#091118');
  floor.addColorStop(1, PALETTE.background);
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  const haze = ctx.createLinearGradient(0, FIELD.height - 240, 0, FIELD.height);
  haze.addColorStop(0, 'rgba(13, 23, 32, 0)');
  haze.addColorStop(1, 'rgba(26, 44, 58, 0.35)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, FIELD.height - 240, FIELD.width, 240);

  ctx.save();
  ctx.strokeStyle = 'rgba(87, 224, 216, 0.055)';
  ctx.lineWidth = 1;
  for (const radius of [90, 180, 270, 360, 450, 540, 630]) {
    ctx.beginPath();
    ctx.arc(centreX, centreY, radius, 0, TAU);
    ctx.stroke();
  }
  for (let i = 0; i < 32; i++) {
    const angle = (i / 32) * TAU;
    const inner = i % 4 === 0 ? 612 : 622;
    ctx.beginPath();
    ctx.moveTo(centreX + Math.cos(angle) * inner, centreY + Math.sin(angle) * inner);
    ctx.lineTo(centreX + Math.cos(angle) * 638, centreY + Math.sin(angle) * 638);
    ctx.strokeStyle = i % 4 === 0 ? 'rgba(87, 224, 216, 0.11)' : 'rgba(87, 224, 216, 0.05)';
    ctx.stroke();
  }
  ctx.restore();

  const warm = ctx.createRadialGradient(centreX, centreY, 0, centreX, centreY, 220);
  warm.addColorStop(0, 'rgba(255, 179, 71, 0.05)');
  warm.addColorStop(1, 'rgba(255, 179, 71, 0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

/** The title's attract layer: two husk silhouettes drifting the ring the husks keep. */
export function drawAttractLayer(ctx, world) {
  const centreX = FIELD.width / 2;
  const centreY = FIELD.height / 2;
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 2; i++) {
    const angle = world.time * (0.22 + i * 0.08) + i * Math.PI;
    const radius = 300 + i * 60;
    const x = centreX + Math.cos(angle) * radius;
    const y = centreY + Math.sin(angle) * radius * 0.72;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * 0.6);
    polygonPath(ctx, 0, 0, 34 - i * 8, i === 0 ? 4 : 6, 0);
    ctx.fillStyle = 'rgba(139, 123, 240, 0.35)';
    ctx.fill();
    ctx.strokeStyle = PALETTE.enemy;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** The soft shadow every husk and the keeper cast on the floor. */
function drawGroundShadow(ctx, x, y, radius, alpha) {
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y + radius * 0.62, radius * 1.05, radius * 0.42, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** A wisp: a spinning diamond with a bright core, the lightest thing the dark sends. */
function drawWispBody(ctx, enemy) {
  const spin = enemy.age * 1.7 + enemy.phase;
  ctx.save();
  ctx.strokeStyle = 'rgba(139, 123, 240, 0.16)';
  ctx.lineWidth = 11;
  polygonPath(ctx, 0, 0, enemy.radius, 4, spin);
  ctx.stroke();
  polygonPath(ctx, 0, 0, enemy.radius, 4, spin);
  ctx.fillStyle = 'rgba(139, 123, 240, 0.26)';
  ctx.fill();
  ctx.strokeStyle = PALETTE.enemy;
  ctx.lineWidth = 2;
  ctx.stroke();
  polygonPath(ctx, 0, 0, enemy.radius * 0.42, 4, -spin * 1.6);
  ctx.fillStyle = PALETTE.enemyHot;
  ctx.fill();
  ctx.restore();
}

/** A lancer: a blade pointed at the flame, its tip brightening as it charges. */
function drawLancerBody(ctx, enemy) {
  const charge = enemy.telegraph > 0 ? 1 - enemy.telegraph / ENEMY_KINDS.lancer.telegraphSeconds : 0;
  const r = enemy.radius;
  ctx.save();
  ctx.strokeStyle = 'rgba(139, 123, 240, 0.16)';
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(r * 1.7, 0);
  ctx.lineTo(-r * 0.7, r * 0.8);
  ctx.lineTo(-r * 0.25, 0);
  ctx.lineTo(-r * 0.7, -r * 0.8);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = 'rgba(139, 123, 240, 0.28)';
  ctx.fill();
  ctx.strokeStyle = PALETTE.enemy;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = `rgba(255, 93, 115, ${0.35 + 0.65 * charge})`;
  ctx.beginPath();
  ctx.arc(r * 1.15, 0, 2.6 + charge * 2.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** A splitter: a slow, wobbling hexagon that will not stay one body for long. */
function drawSplitterBody(ctx, enemy) {
  const r = enemy.radius;
  const wobble = 1 + Math.sin(enemy.age * 2.6 + enemy.phase) * 0.09;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = enemy.phase + (i / 6) * TAU;
    const radius = r * wobble * (1 + Math.sin(enemy.age * 1.7 + i) * 0.06);
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.strokeStyle = 'rgba(139, 123, 240, 0.16)';
  ctx.lineWidth = 13;
  ctx.stroke();
  ctx.fillStyle = 'rgba(139, 123, 240, 0.24)';
  ctx.fill();
  ctx.strokeStyle = PALETTE.enemy;
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const angle = enemy.phase * 1.4 + (i / 3) * TAU;
    ctx.fillStyle = 'rgba(221, 216, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * r * 0.42, Math.sin(angle) * r * 0.42, 2.4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** A warden: an eight-sided body behind a bright front plate that turns bolts away. */
function drawWardenBody(ctx, enemy) {
  const r = enemy.radius;
  const halfArc = (ENEMY_KINDS.warden.armourHalfArcDegrees * Math.PI) / 180;
  ctx.save();
  ctx.strokeStyle = 'rgba(139, 123, 240, 0.16)';
  ctx.lineWidth = 17;
  polygonPath(ctx, 0, 0, r, 8, enemy.facing);
  ctx.stroke();
  ctx.fillStyle = 'rgba(139, 123, 240, 0.22)';
  ctx.fill();
  ctx.strokeStyle = PALETTE.enemy;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  polygonPath(ctx, 0, 0, r * 0.44, 4, enemy.facing + Math.PI / 4);
  ctx.strokeStyle = 'rgba(221, 216, 255, 0.7)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // The plate: a thick lit arc across the front, unmistakable as the armour.
  const plate = [
    { width: 18, colour: 'rgba(221, 216, 255, 0.14)' },
    { width: 9, colour: 'rgba(221, 216, 255, 0.55)' },
    { width: 3.5, colour: '#ffffff' },
  ];
  for (const pass of plate) {
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.02, enemy.facing - halfArc, enemy.facing + halfArc);
    ctx.strokeStyle = pass.colour;
    ctx.lineWidth = pass.width;
    ctx.stroke();
  }
  ctx.restore();
}

/** A lancer's telegraph line, which thickens over its one second of warning. */
function drawLancerTelegraph(ctx, enemy) {
  if (enemy.telegraph <= 0) return;
  const charge = 1 - enemy.telegraph / ENEMY_KINDS.lancer.telegraphSeconds;
  const length = 900;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255, 93, 115, ${0.10 + charge * 0.30})`;
  ctx.lineWidth = 1 + charge * 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(enemy.aimAngle - enemy.facing) * length, Math.sin(enemy.aimAngle - enemy.facing) * length);
  ctx.stroke();
  ctx.restore();
}

/** Every husk on the field, with its spawn-in, its hurt flash and its health ticks. */
export function drawEnemies(ctx, world) {
  for (const enemy of world.enemies) {
    if (enemy.dead) continue;
    const grow = Math.min(1, enemy.age * 3.4);
    drawGroundShadow(ctx, enemy.x, enemy.y, enemy.radius * grow, 0.3);
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.globalAlpha = grow;
    if (enemy.kind === 'lancer') {
      ctx.save();
      ctx.rotate(enemy.facing);
      drawLancerTelegraph(ctx, enemy);
      drawLancerBody(ctx, enemy);
      ctx.restore();
    } else if (enemy.kind === 'wisp') {
      drawWispBody(ctx, enemy);
    } else if (enemy.kind === 'splitter') {
      drawSplitterBody(ctx, enemy);
    } else {
      drawWardenBody(ctx, enemy);
    }
    if (enemy.flash > 0) {
      ctx.globalAlpha = grow * Math.min(1, enemy.flash * 7);
      polygonPath(ctx, 0, 0, enemy.radius * 1.05, 6, enemy.facing);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.globalAlpha = grow;
    }
    ctx.restore();
    if (enemy.maxHealth > 1) {
      const width = enemy.radius * 1.9;
      const x = enemy.x - width / 2;
      const y = enemy.y - enemy.radius - 16;
      ctx.fillStyle = 'rgba(233, 241, 242, 0.16)';
      ctx.fillRect(x, y, width, 3);
      ctx.fillStyle = PALETTE.enemyHot;
      ctx.fillRect(x, y, width * Math.max(0, enemy.health / enemy.maxHealth), 3);
    }
  }
}

/** The keeper's shadow, drawn under the husks so nothing overlaps it oddly. */
export function drawKeeperShadow(ctx, world) {
  drawGroundShadow(ctx, world.keeper.x, world.keeper.y, KEEPER.radius * 1.4, 0.42);
}

/** The lantern itself: a burnt trail, a wide amber glow, the orb and a breathing flame tongue. */
export function drawKeeper(ctx, world) {
  const keeper = world.keeper;
  const flicker = keeper.invulnerable > 0 ? 0.45 + 0.55 * Math.abs(Math.sin(keeper.invulnerable * FLAME.flickerRate)) : 1;
  ctx.save();
  for (let i = 0; i < keeper.trail.length; i++) {
    const point = keeper.trail[i];
    const fade = (i / keeper.trail.length) * 0.22;
    ctx.fillStyle = `rgba(255, 179, 71, ${fade})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, KEEPER.radius * 0.55 * (i / keeper.trail.length), 0, TAU);
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(keeper.x, keeper.y, 0, keeper.x, keeper.y, 132);
  glow.addColorStop(0, 'rgba(255, 179, 71, 0.34)');
  glow.addColorStop(0.4, 'rgba(255, 140, 43, 0.12)');
  glow.addColorStop(1, 'rgba(255, 140, 43, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(keeper.x, keeper.y, 132, 0, TAU);
  ctx.fill();

  ctx.globalAlpha = flicker;
  const sway = Math.sin(world.time * 8.5) * 2.4 + Math.sin(world.time * 21.3) * 1.1;
  ctx.fillStyle = PALETTE.flame;
  ctx.beginPath();
  ctx.moveTo(keeper.x - 8, keeper.y - 8);
  ctx.quadraticCurveTo(keeper.x - 3 + sway * 0.4, keeper.y - 34 - sway, keeper.x + sway * 0.5, keeper.y - 40 - sway);
  ctx.quadraticCurveTo(keeper.x + 5 + sway * 0.3, keeper.y - 22, keeper.x + 8, keeper.y - 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.flameHot;
  ctx.beginPath();
  ctx.moveTo(keeper.x - 3.5, keeper.y - 9);
  ctx.quadraticCurveTo(keeper.x + sway * 0.25, keeper.y - 24, keeper.x + 3.5, keeper.y - 9);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = PALETTE.flame;
  ctx.beginPath();
  ctx.arc(keeper.x, keeper.y, KEEPER.radius, 0, TAU);
  ctx.fill();
  ctx.fillStyle = PALETTE.flameHot;
  ctx.beginPath();
  ctx.arc(keeper.x, keeper.y, KEEPER.radius * 0.52, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(keeper.x - 2.5, keeper.y - 3, 2.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** The ward: a lit arc of the current reach, its halo, its rim and, while braced, the brace ring. */
export function drawWard(ctx, world) {
  const keeper = world.keeper;
  const geometry = wardGeometry(keeper);
  const start = keeper.wardAngle - geometry.halfArc;
  const end = keeper.wardAngle + geometry.halfArc;
  const hot = keeper.braced;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  ctx.beginPath();
  ctx.arc(keeper.x, keeper.y, geometry.radius, start, end);
  ctx.arc(keeper.x, keeper.y, geometry.radius * 0.72, end, start, true);
  ctx.closePath();
  ctx.fillStyle = hot ? 'rgba(87, 224, 216, 0.12)' : 'rgba(87, 224, 216, 0.05)';
  ctx.fill();

  const passes = [
    { width: hot ? 30 : 22, colour: 'rgba(87, 224, 216, 0.10)' },
    { width: hot ? 16 : 12, colour: 'rgba(87, 224, 216, 0.22)' },
  ];
  for (const pass of passes) {
    ctx.beginPath();
    ctx.arc(keeper.x, keeper.y, geometry.radius, start, end);
    ctx.strokeStyle = pass.colour;
    ctx.lineWidth = pass.width;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(keeper.x, keeper.y, geometry.radius, start, end);
  ctx.strokeStyle = hot ? PALETTE.wardHot : PALETTE.ward;
  ctx.lineWidth = WARD.rimWidth * (hot ? 1.15 : 1);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(keeper.x, keeper.y, geometry.radius - 7, start, end);
  ctx.strokeStyle = hot ? 'rgba(234, 255, 255, 0.75)' : 'rgba(87, 224, 216, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  for (const angle of [start, end]) {
    ctx.fillStyle = hot ? PALETTE.wardHot : PALETTE.ward;
    ctx.beginPath();
    ctx.arc(keeper.x + Math.cos(angle) * geometry.radius, keeper.y + Math.sin(angle) * geometry.radius, 3.4, 0, TAU);
    ctx.fill();
  }
  if (hot) {
    ctx.beginPath();
    ctx.arc(keeper.x, keeper.y, WARD.braceRingRadius, 0, TAU);
    ctx.strokeStyle = 'rgba(87, 224, 216, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * TAU + world.time * 0.4;
      ctx.beginPath();
      ctx.moveTo(keeper.x + Math.cos(angle) * (WARD.braceRingRadius - 4), keeper.y + Math.sin(angle) * (WARD.braceRingRadius - 4));
      ctx.lineTo(keeper.x + Math.cos(angle) * (WARD.braceRingRadius + 2), keeper.y + Math.sin(angle) * (WARD.braceRingRadius + 2));
      ctx.strokeStyle = 'rgba(87, 224, 216, 0.18)';
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Bolts: a magenta streak on its way in, or a cyan-white streak on its way back out. */
export function drawBolts(ctx, world) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const bolt of world.bolts) {
    if (bolt.dead) continue;
    if (bolt.armed > 0) {
      const charge = 1 - bolt.armed / BOLT.armSeconds;
      ctx.strokeStyle = `rgba(255, 93, 115, ${0.5 * charge})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, 4 + (1 - charge) * 12, 0, TAU);
      ctx.stroke();
      continue;
    }
    const trail = bolt.trail;
    if (trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
      ctx.lineTo(bolt.x, bolt.y);
      ctx.strokeStyle = bolt.friendly ? 'rgba(159, 252, 244, 0.12)' : 'rgba(255, 93, 115, 0.16)';
      ctx.lineWidth = bolt.friendly ? 11 : 9;
      ctx.stroke();
      ctx.strokeStyle = bolt.friendly ? 'rgba(159, 252, 244, 0.55)' : 'rgba(255, 93, 115, 0.55)';
      ctx.lineWidth = bolt.friendly ? 3.2 : 2.6;
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(bolt.x, bolt.y, 0, bolt.x, bolt.y, 26);
    glow.addColorStop(0, bolt.friendly ? 'rgba(159, 252, 244, 0.55)' : 'rgba(255, 93, 115, 0.45)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, 26, 0, TAU);
    ctx.fill();
    ctx.fillStyle = bolt.friendly ? PALETTE.friendly : PALETTE.bolt;
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, bolt.radius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, bolt.radius * 0.45, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** The darkened corners that make the arena feel like a room with one light in it. */
export function drawVignette(ctx) {
  const vignette = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2 - 30, 240, FIELD.width / 2, FIELD.height / 2, 740);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(0.72, 'rgba(0, 0, 0, 0.34)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.72)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

/** The warm wash a kept vow lays over the arena. */
function drawWarmWash(ctx) {
  const wash = ctx.createRadialGradient(FIELD.width / 2, 330, 80, FIELD.width / 2, 360, 640);
  wash.addColorStop(0, 'rgba(255, 179, 71, 0.14)');
  wash.addColorStop(1, 'rgba(255, 140, 43, 0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

/** The cold wash a lost flame lays over the arena. */
function drawColdWash(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(8, 16, 24, 0.45)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.restore();
}

/** One frame: the letterboxed field, the world in draw order, then the hud or the full screen. */
export function drawFrame(ctx, world, viewport) {
  const scale = viewport.scale * viewport.dpr;
  const shake = shakeOffset(world.effects);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#03070a';
  ctx.fillRect(0, 0, Math.round(viewport.pixelWidth * viewport.dpr), Math.round(viewport.pixelHeight * viewport.dpr));
  ctx.setTransform(
    scale,
    0,
    0,
    scale,
    viewport.dpr * viewport.offsetX + shake.x * scale,
    viewport.dpr * viewport.offsetY + shake.y * scale,
  );
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, FIELD.width, FIELD.height);
  ctx.clip();

  drawArena(ctx, world);
  drawAsh(ctx, world.effects, world.state === 'defeat' ? 0.4 : 1);
  if (world.state === 'title' || world.state === 'victory' || world.state === 'defeat') drawAttractLayer(ctx, world);
  drawEnemies(ctx, world);
  drawKeeperShadow(ctx, world);
  drawKeeper(ctx, world);
  drawWard(ctx, world);
  drawBolts(ctx, world);
  drawRings(ctx, world.effects);
  drawParticles(ctx, world.effects);
  drawVignette(ctx);

  if (world.state === 'victory') drawWarmWash(ctx);
  if (world.state === 'defeat') drawColdWash(ctx);
  if (world.state === 'play') drawHud(ctx, world);
  if (world.state === 'title') drawTitleScreen(ctx, world);
  if (world.state === 'victory') drawVictoryScreen(ctx, world);
  if (world.state === 'defeat') drawDefeatScreen(ctx, world);

  drawFlash(ctx, world.effects);
  ctx.restore();
  world.framesPainted += 1;
}
