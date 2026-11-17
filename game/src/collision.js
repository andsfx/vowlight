// Circle, arc and swept-segment hit tests plus the reflection maths the ward's rim uses.

const TAU = Math.PI * 2;

/** The signed short way round from b to a, in -PI..PI. */
export function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

/** Whether two circles overlap, by their radii. */
export function circlesTouch(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const reach = ar + br;
  return dx * dx + dy * dy <= reach * reach;
}

/** Whether a point sits on a ward arc: inside the arc's band of radii and within its half angle. */
export function pointWithinArc(px, py, cx, cy, facing, halfArc, radius, band) {
  const dx = px - cx;
  const dy = py - cy;
  const distance = Math.hypot(dx, dy);
  if (distance < radius - band || distance > radius + band) return false;
  return Math.abs(angleDelta(Math.atan2(dy, dx), facing)) <= halfArc;
}

/**
 * Whether a bolt that moved from (x0, y0) to (x1, y1) touched the ward arc. The path is sampled, so a
 * 260 px/s bolt cannot tunnel through a 9 px band in one 1/60 s step.
 */
export function segmentTouchesArc(x0, y0, x1, y1, cx, cy, facing, halfArc, radius, band) {
  const length = Math.hypot(x1 - x0, y1 - y0);
  const samples = Math.min(48, Math.max(2, Math.ceil(length / 4) + 1));
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    if (pointWithinArc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, cx, cy, facing, halfArc, radius, band)) return true;
  }
  return false;
}

/**
 * A velocity mirrored off the ward's surface: v - 2(v.n)n, where n is the outward normal at the contact
 * point. A bolt flying straight at the keeper leaves straight back along its own path.
 */
export function reflectVelocityOffRadial(vx, vy, nx, ny) {
  const dot = vx * nx + vy * ny;
  return { x: vx - 2 * dot * nx, y: vy - 2 * dot * ny };
}

/** The unit vector from one point to another; a zero-length pair returns (1, 0). */
export function unitFromTo(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return { x: 1, y: 0 };
  return { x: dx / length, y: dy / length };
}

/** A speed from a velocity pair. */
export function speedOf(vx, vy) {
  return Math.hypot(vx, vy);
}

/** A point held inside the field by `margin` on every side. */
export function clampPointToField(x, y, margin, width, height) {
  return {
    x: Math.min(width - margin, Math.max(margin, x)),
    y: Math.min(height - margin, Math.max(margin, y)),
  };
}

/** The angle of the shortest way from one angle to another, for smooth turning. */
export function turnToward(current, target, maxStep) {
  const delta = angleDelta(target, current);
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}
