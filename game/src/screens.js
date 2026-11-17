// The three full-screen states: the title with its lantern wordmark, the kept vow and the cold defeat
// panel, each with the run's numbers and the same restart prompt.

import { FIELD, PALETTE, TEXT, WAVES, TYPE } from './config.js';
import { drawTrackedText, drawPlate, drawKeyCap, roundedRectPath, formatScore, formatClock } from './hud.js';

/** The pulse every prompt breathes with. */
function promptPulse(world) {
  return 0.58 + 0.42 * Math.sin(world.time * 3.1);
}

/** A lantern: a hooded flame in a ring of light, the game's mark. */
export function drawLanternGlyph(ctx, x, y, radius, colour) {
  ctx.save();
  ctx.translate(x, y);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 2.6);
  glow.addColorStop(0, `rgba(255, 179, 71, 0.30)`);
  glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -radius - 10);
  ctx.lineTo(0, -radius);
  ctx.moveTo(0, radius);
  ctx.lineTo(0, radius + 10);
  ctx.stroke();
  ctx.fillStyle = PALETTE.flame;
  ctx.beginPath();
  ctx.moveTo(0, -radius * 0.86);
  ctx.quadraticCurveTo(radius * 0.52, radius * 0.08, 0, radius * 0.72);
  ctx.quadraticCurveTo(-radius * 0.52, radius * 0.08, 0, -radius * 0.86);
  ctx.fill();
  ctx.fillStyle = PALETTE.flameHot;
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.16, radius * 0.17, radius * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A hairline rule broken by a diamond, used under the title and either side of a headline. */
export function drawRule(ctx, x, y, width, colour) {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  const half = width / 2;
  ctx.beginPath();
  ctx.moveTo(x - half, y);
  ctx.lineTo(x - 10, y);
  ctx.moveTo(x + 10, y);
  ctx.lineTo(x + half, y);
  ctx.stroke();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x + 4, y);
  ctx.lineTo(x, y + 4);
  ctx.lineTo(x - 4, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The control legend: four key caps with their action set beneath. */
export function drawControlLegend(ctx, centreX, y) {
  ctx.save();
  const itemWidths = TEXT.legend.map(([key, action]) => {
    ctx.font = `600 14px ${TYPE.ui}`;
    const cap = Math.max(34, ctx.measureText(key).width + 20);
    ctx.font = `700 11px ${TYPE.ui}`;
    return Math.max(cap, ctx.measureText(action).width + 6);
  });
  const gap = 42;
  const total = itemWidths.reduce((sum, w) => sum + w, 0) + gap * (itemWidths.length - 1);
  let cursor = centreX - total / 2;
  for (let i = 0; i < TEXT.legend.length; i++) {
    const [key, action] = TEXT.legend[i];
    const width = itemWidths[i];
    const capWidth = Math.max(34, (() => {
      ctx.font = `600 14px ${TYPE.ui}`;
      return ctx.measureText(key).width + 20;
    })());
    drawKeyCap(ctx, key, cursor + (width - capWidth) / 2, y);
    drawTrackedText(ctx, action, cursor + width / 2, y + 40, {
      size: 11,
      weight: 700,
      tracking: 2.5,
      align: 'center',
      colour: 'rgba(125, 140, 150, 0.95)',
    });
    cursor += width + gap;
  }
  ctx.restore();
}

/** The title: a dim arena behind, a lantern, the wordmark, the legend and a breathing prompt. */
export function drawTitleScreen(ctx, world) {
  const centreX = FIELD.width / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(3, 8, 12, 0.62)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const warm = ctx.createRadialGradient(centreX, 250, 20, centreX, 300, 620);
  warm.addColorStop(0, 'rgba(255, 179, 71, 0.13)');
  warm.addColorStop(0.55, 'rgba(255, 140, 43, 0.05)');
  warm.addColorStop(1, 'rgba(7, 13, 18, 0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  drawLanternGlyph(ctx, centreX, 132, 30, 'rgba(255, 179, 71, 0.55)');

  drawTrackedText(ctx, TEXT.title, centreX, 268, {
    size: 112,
    weight: 800,
    tracking: 20,
    align: 'center',
    colour: PALETTE.text,
    halo: 'rgba(255, 179, 71, 0.30)',
    haloWidth: 18,
  });
  drawRule(ctx, centreX, 300, 470, 'rgba(255, 179, 71, 0.45)');
  drawTrackedText(ctx, TEXT.tagline, centreX, 348, {
    size: 23,
    weight: 500,
    tracking: 1.5,
    align: 'center',
    colour: 'rgba(233, 241, 242, 0.78)',
  });

  drawControlLegend(ctx, centreX, 448);

  ctx.globalAlpha = promptPulse(world);
  drawTrackedText(ctx, TEXT.startPrompt, centreX, 592, {
    size: 27,
    weight: 800,
    tracking: 8,
    align: 'center',
    colour: PALETTE.flame,
    halo: 'rgba(255, 179, 71, 0.22)',
    haloWidth: 12,
  });
  ctx.globalAlpha = 1;

  drawTrackedText(ctx, `${TEXT.best}  ${formatScore(world.best)}`, centreX, 654, {
    size: 12,
    weight: 700,
    tracking: 4,
    align: 'center',
    colour: 'rgba(125, 140, 150, 0.9)',
  });
  ctx.restore();
}

/** The warm ring of a ward that saw the vow through, behind the victory panel. */
function drawKeptRing(ctx, world) {
  const centreX = FIELD.width / 2;
  const centreY = 360;
  const radius = 300;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const breathe = 1 + 0.012 * Math.sin(world.time * 1.4);
  const passes = [
    { width: 26, colour: 'rgba(255, 179, 71, 0.10)' },
    { width: 12, colour: 'rgba(255, 179, 71, 0.20)' },
    { width: 4, colour: 'rgba(255, 233, 201, 0.72)' },
  ];
  for (const pass of passes) {
    ctx.beginPath();
    ctx.arc(centreX, centreY, radius * breathe, 0, Math.PI * 2);
    ctx.strokeStyle = pass.colour;
    ctx.lineWidth = pass.width;
    ctx.stroke();
  }
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * Math.PI * 2;
    const long = i % 4 === 0;
    ctx.beginPath();
    ctx.moveTo(centreX + Math.cos(angle) * (radius + 10), centreY + Math.sin(angle) * (radius + 10));
    ctx.lineTo(centreX + Math.cos(angle) * (radius + (long ? 26 : 17)), centreY + Math.sin(angle) * (radius + (long ? 26 : 17)));
    ctx.strokeStyle = long ? 'rgba(255, 179, 71, 0.55)' : 'rgba(255, 179, 71, 0.22)';
    ctx.lineWidth = long ? 2 : 1;
    ctx.stroke();
  }
  ctx.restore();
}

/** A row of labelled figures inside a panel: the run's numbers. */
function drawStatRow(ctx, centreX, y, stats) {
  const columns = stats.length;
  const span = 660;
  const step = span / columns;
  for (let i = 0; i < columns; i++) {
    const x = centreX - span / 2 + step * (i + 0.5);
    drawTrackedText(ctx, stats[i][0], x, y, { size: 11, weight: 700, tracking: 3, align: 'center', colour: 'rgba(125, 140, 150, 0.95)' });
    drawTrackedText(ctx, stats[i][1], x, y + 46, { size: 34, weight: 800, tracking: 1, align: 'center', colour: PALETTE.text });
    if (i > 0) {
      ctx.fillStyle = 'rgba(233, 241, 242, 0.10)';
      ctx.fillRect(x - step / 2, y - 18, 1, 62);
    }
  }
}

/** The victory panel: the headline, the four figures of the run, and the way back in. */
export function drawVictoryScreen(ctx, world) {
  const centreX = FIELD.width / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(8, 12, 14, 0.58)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const warm = ctx.createRadialGradient(centreX, 340, 40, centreX, 340, 700);
  warm.addColorStop(0, 'rgba(255, 179, 71, 0.16)');
  warm.addColorStop(1, 'rgba(7, 13, 18, 0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.restore();

  drawKeptRing(ctx, world);

  drawLanternGlyph(ctx, centreX, 96, 22, 'rgba(255, 233, 201, 0.8)');
  drawTrackedText(ctx, TEXT.victoryTitle, centreX, 212, {
    size: 74,
    weight: 800,
    tracking: 12,
    align: 'center',
    colour: PALETTE.flameHot,
    halo: 'rgba(255, 179, 71, 0.35)',
    haloWidth: 20,
  });
  drawRule(ctx, centreX, 244, 560, 'rgba(255, 179, 71, 0.5)');

  drawPlate(ctx, centreX - 400, 300, 800, 150, { fill: 'rgba(6, 11, 16, 0.82)', edge: 'rgba(255, 179, 71, 0.28)' });
  const stats = [
    [TEXT.victoryStats[0], formatScore(world.score)],
    [TEXT.victoryStats[1], `${WAVES.total}`],
    [TEXT.victoryStats[2], `x${world.bestCombo}`],
    [TEXT.victoryStats[3], formatClock(world.elapsed)],
  ];
  drawStatRow(ctx, centreX, 340, stats);

  ctx.globalAlpha = promptPulse(world);
  drawTrackedText(ctx, TEXT.againPrompt, centreX, 552, {
    size: 22,
    weight: 800,
    tracking: 6,
    align: 'center',
    colour: PALETTE.flame,
  });
  ctx.globalAlpha = 1;
  drawTrackedText(ctx, `THE ARENA IS QUIET FOR NOW.  ${TEXT.best} ${formatScore(world.best)}`, centreX, 616, {
    size: 12,
    weight: 600,
    tracking: 3,
    align: 'center',
    colour: 'rgba(125, 140, 150, 0.9)',
  });
}

/** The cold ring of a ward that lost its flame. */
function drawColdRing(ctx, world) {
  const centreX = FIELD.width / 2;
  const centreY = 360;
  ctx.save();
  ctx.beginPath();
  ctx.arc(centreX, centreY, 300, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(125, 156, 176, 0.16)';
  ctx.lineWidth = 3;
  ctx.stroke();
  for (let i = 0; i < 32; i++) {
    if (i % 3 === 0) continue;
    const angle = (i / 32) * Math.PI * 2 + world.time * 0.02;
    ctx.beginPath();
    ctx.moveTo(centreX + Math.cos(angle) * 308, centreY + Math.sin(angle) * 308);
    ctx.lineTo(centreX + Math.cos(angle) * 318, centreY + Math.sin(angle) * 318);
    ctx.strokeStyle = 'rgba(125, 156, 176, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

/** The defeat panel: cold, dim, the run's score and how far the flame got. */
export function drawDefeatScreen(ctx, world) {
  const centreX = FIELD.width / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(3, 7, 11, 0.74)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const cold = ctx.createRadialGradient(centreX, 380, 60, centreX, 380, 720);
  cold.addColorStop(0, 'rgba(44, 74, 92, 0.16)');
  cold.addColorStop(1, 'rgba(3, 7, 11, 0)');
  ctx.fillStyle = cold;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.restore();

  drawColdRing(ctx, world);

  drawLanternGlyph(ctx, centreX, 108, 22, 'rgba(125, 140, 150, 0.45)');
  ctx.save();
  ctx.globalAlpha = 0.9;
  drawTrackedText(ctx, TEXT.defeatTitle, centreX, 236, {
    size: 68,
    weight: 800,
    tracking: 10,
    align: 'center',
    colour: '#ffb3bf',
    halo: 'rgba(255, 77, 109, 0.28)',
    haloWidth: 18,
  });
  ctx.restore();
  drawRule(ctx, centreX, 268, 520, 'rgba(255, 77, 109, 0.35)');

  drawPlate(ctx, centreX - 380, 316, 760, 148, { fill: 'rgba(5, 9, 13, 0.84)', edge: 'rgba(255, 77, 109, 0.22)' });
  const stats = [
    [TEXT.defeatStats[0], formatScore(world.score)],
    [TEXT.defeatStats[1], `${Math.max(1, world.wave.index)}`],
    [TEXT.defeatStats[2], `x${world.bestCombo}`],
    [TEXT.defeatStats[3], formatClock(world.elapsed)],
  ];
  drawStatRow(ctx, centreX, 356, stats);

  ctx.globalAlpha = promptPulse(world);
  drawTrackedText(ctx, TEXT.againPrompt, centreX, 556, {
    size: 22,
    weight: 800,
    tracking: 6,
    align: 'center',
    colour: 'rgba(233, 241, 242, 0.9)',
  });
  ctx.globalAlpha = 1;
  drawTrackedText(ctx, `${TEXT.best} ${formatScore(world.best)}`, centreX, 616, {
    size: 12,
    weight: 700,
    tracking: 4,
    align: 'center',
    colour: 'rgba(125, 140, 150, 0.9)',
  });
}
