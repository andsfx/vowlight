// The in-play heads-up: score and combo chip, the wave counter, the flame pips, the brace hint and
// the best score, plus the small type and plate helpers the title and result panels share.

import { FIELD, PALETTE, TYPE, TEXT, COMBO, WAVES } from './config.js';

/** A rounded rectangle path, drawn the same way in every browser. */
export function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** A score with thin spaces between thousands, so a six-digit number still reads at a glance. */
export function formatScore(value) {
  const whole = Math.max(0, Math.round(value));
  const digits = String(whole);
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
    out += digits[i];
  }
  return out;
}

/** A clock reading for the victory panel: 4:24. */
export function formatClock(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/**
 * Text with its letters spread apart, which is most of the game's display type. Returns the drawn
 * width so a caller can centre or rule around it.
 */
export function drawTrackedText(ctx, text, x, y, options = {}) {
  const size = options.size ?? 20;
  const weight = options.weight ?? 700;
  const tracking = options.tracking ?? 0;
  const family = options.family ?? TYPE.ui;
  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = options.baseline ?? 'alphabetic';
  const chars = Array.from(text);
  let width = 0;
  for (const ch of chars) width += ctx.measureText(ch).width + tracking;
  width = Math.max(0, width - tracking);
  const align = options.align ?? 'left';
  let cursor = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  if (options.halo) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = options.haloWidth ?? Math.max(6, size * 0.16);
    ctx.strokeStyle = options.halo;
    for (const ch of chars) {
      ctx.strokeText(ch, cursor, y);
      cursor += ctx.measureText(ch).width + tracking;
    }
    cursor = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  }
  ctx.fillStyle = options.colour ?? PALETTE.text;
  for (const ch of chars) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + tracking;
  }
  ctx.restore();
  return width;
}

/** A dark plate behind a cluster of hud text, with an optional accent bar down its left edge. */
export function drawPlate(ctx, x, y, width, height, options = {}) {
  ctx.save();
  roundedRectPath(ctx, x, y, width, height, options.radius ?? 10);
  ctx.fillStyle = options.fill ?? 'rgba(5, 10, 15, 0.58)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = options.edge ?? 'rgba(233, 241, 242, 0.09)';
  ctx.stroke();
  if (options.accent) {
    ctx.fillStyle = options.accent;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x + 1, y + height * 0.3, 3, height * 0.4);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** A key cap like the ones on the title legend: a bordered box with its key set inside. */
export function drawKeyCap(ctx, label, x, y, options = {}) {
  const size = options.size ?? 14;
  ctx.save();
  ctx.font = `600 ${size}px ${TYPE.ui}`;
  const width = Math.max(34, ctx.measureText(label).width + 20);
  const height = size + 16;
  roundedRectPath(ctx, x, y, width, height, 6);
  ctx.fillStyle = options.fill ?? 'rgba(233, 241, 242, 0.06)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = options.edge ?? 'rgba(233, 241, 242, 0.22)';
  ctx.stroke();
  ctx.fillStyle = options.colour ?? PALETTE.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + width / 2, y + height / 2 + 1);
  ctx.restore();
  return width;
}

/** The combo multiplier pill: the number, a chip behind it, and a bar showing the window left. */
export function drawComboChip(ctx, world, x, y) {
  const live = world.combo > 1 || world.comboTimer > 0;
  if (!live) return;
  const width = 74;
  const height = 32;
  const fill = world.combo > 1 ? 'rgba(255, 179, 71, 0.16)' : 'rgba(233, 241, 242, 0.07)';
  const edge = world.combo > 1 ? 'rgba(255, 179, 71, 0.65)' : 'rgba(233, 241, 242, 0.2)';
  roundedRectPath(ctx, x, y, width, height, 8);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = edge;
  ctx.stroke();
  drawTrackedText(ctx, `x${world.combo}`, x + width / 2, y + 22, {
    size: 19,
    weight: 800,
    tracking: 1,
    align: 'center',
    colour: world.combo > 1 ? PALETTE.flame : PALETTE.muted,
  });
  const window = Math.max(0, Math.min(1, world.comboTimer / COMBO.windowSeconds));
  ctx.fillStyle = 'rgba(255, 179, 71, 0.16)';
  ctx.fillRect(x + 6, y + height - 5, width - 12, 2);
  if (window > 0) {
    ctx.fillStyle = 'rgba(255, 179, 71, 0.9)';
    ctx.fillRect(x + 6, y + height - 5, (width - 12) * window, 2);
  }
}

/** Score on the left, with the combo chip riding beside it. */
export function drawScoreReadout(ctx, world) {
  drawPlate(ctx, 32, 20, 296, 78, { accent: 'rgba(255, 179, 71, 0.7)' });
  drawTrackedText(ctx, TEXT.score, 54, 46, { size: 11, weight: 700, tracking: 4, colour: PALETTE.muted });
  drawTrackedText(ctx, formatScore(world.score), 54, 82, { size: 34, weight: 800, tracking: 1, colour: PALETTE.text });
  drawComboChip(ctx, world, 232, 44);
}

/** The wave number and ten ticks showing how far into the vow the run is. */
export function drawWaveReadout(ctx, world) {
  const index = world.wave.index;
  const right = FIELD.width - 54;
  drawPlate(ctx, FIELD.width - 328, 20, 296, 78, { accent: 'rgba(87, 224, 216, 0.6)' });
  drawTrackedText(ctx, TEXT.wave, right, 46, { size: 11, weight: 700, tracking: 4, colour: PALETTE.muted, align: 'right' });
  drawTrackedText(ctx, `${index} / ${WAVES.total}`, right, 84, { size: 32, weight: 800, tracking: 2, colour: PALETTE.text, align: 'right' });
  const tickWidth = 12;
  const gap = 6;
  const startX = right - (WAVES.total * (tickWidth + gap) - gap);
  for (let i = 0; i < WAVES.total; i++) {
    const x = startX + i * (tickWidth + gap);
    const done = i < index - 1;
    const current = i === index - 1;
    ctx.fillStyle = current ? PALETTE.ward : done ? 'rgba(87, 224, 216, 0.45)' : 'rgba(233, 241, 242, 0.14)';
    ctx.fillRect(x, 92, tickWidth, 3);
  }
}

/** Three flame pips; lit ones burn amber, lost ones are only an outline. */
export function drawFlamePips(ctx, world) {
  const keeper = world.keeper;
  const baseX = 54;
  const baseY = FIELD.height - 72;
  drawPlate(ctx, 32, FIELD.height - 96, 286, 66, { accent: 'rgba(255, 179, 71, 0.45)' });
  drawTrackedText(ctx, TEXT.flame, baseX, baseY + 6, { size: 11, weight: 700, tracking: 4, colour: PALETTE.muted });
  for (let i = 0; i < keeper.maxFlames; i++) {
    const cx = 132 + i * 40;
    const cy = baseY + 4;
    const lit = i < keeper.flames;
    const draining = lit && keeper.invulnerable > 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    if (lit) {
      const pulse = draining ? 0.5 + 0.5 * Math.sin(keeper.invulnerable * 40) : 1;
      ctx.fillStyle = `rgba(255, 179, 71, ${0.22 * pulse})`;
      ctx.fillRect(-17, -17, 34, 34);
      ctx.fillStyle = PALETTE.flame;
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = PALETTE.flameHot;
      ctx.fillRect(-4, -4, 8, 8);
    } else {
      ctx.strokeStyle = 'rgba(125, 140, 150, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-9, -9, 18, 18);
    }
    ctx.restore();
  }
}

/** The bottom-centre brace reminder, which turns cyan and reads BRACED while the ward is held open. */
export function drawBraceHint(ctx, world) {
  const keeper = world.keeper;
  const centreX = FIELD.width / 2;
  const y = FIELD.height - 46;
  const label = keeper.braced ? TEXT.bracedLabel : TEXT.braceLabel;
  const colour = keeper.braced ? PALETTE.ward : PALETTE.muted;
  drawTrackedText(ctx, TEXT.braceHint, centreX - 30, y, { size: 11, weight: 700, tracking: 3, colour: 'rgba(125, 140, 150, 0.85)', align: 'right' });
  drawTrackedText(ctx, label, centreX + 30, y, { size: 15, weight: 800, tracking: 2, colour, align: 'left' });
  ctx.fillStyle = keeper.braced ? PALETTE.ward : 'rgba(125, 140, 150, 0.4)';
  ctx.fillRect(centreX - 6, y - 12, 1, 14);
}

/** The persisted best, bottom right. */
export function drawBestReadout(ctx, world) {
  drawTrackedText(ctx, `${TEXT.best}  ${formatScore(world.best)}`, FIELD.width - 44, FIELD.height - 40, {
    size: 12,
    weight: 700,
    tracking: 3,
    colour: 'rgba(125, 140, 150, 0.9)',
    align: 'right',
  });
}

/** The WAVE N banner between waves: a number, letter-spaced, fading in and out over two thin rules. */
export function drawWaveBanner(ctx, world) {
  const banner = world.wave.banner;
  if (!banner) return;
  const life = banner.timer / 2.4;
  const fade = Math.min(1, life * 2.4) * Math.min(1, (1 - life) * 5 + 0.25);
  const alpha = Math.max(0, Math.min(1, fade));
  if (alpha <= 0.01) return;
  const centreX = FIELD.width / 2;
  const y = 196;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'rgba(87, 224, 216, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centreX - 240, y - 26);
  ctx.lineTo(centreX - 120, y - 26);
  ctx.moveTo(centreX + 120, y - 26);
  ctx.lineTo(centreX + 240, y - 26);
  ctx.stroke();
  drawTrackedText(ctx, TEXT.wave, centreX, y - 52, { size: 13, weight: 700, tracking: 9, colour: 'rgba(87, 224, 216, 0.8)', align: 'center' });
  drawTrackedText(ctx, banner.text, centreX, y + 34, {
    size: 78,
    weight: 800,
    tracking: 10,
    align: 'center',
    colour: PALETTE.text,
    halo: 'rgba(87, 224, 216, 0.22)',
    haloWidth: 14,
  });
  ctx.restore();
}

/** Every in-play readout, in the order it sits on the field. */
export function drawHud(ctx, world) {
  drawScoreReadout(ctx, world);
  drawWaveReadout(ctx, world);
  drawFlamePips(ctx, world);
  drawBraceHint(ctx, world);
  drawBestReadout(ctx, world);
  drawWaveBanner(ctx, world);
}
