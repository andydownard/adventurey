import { WORLD } from './config';

export interface Vec {
  x: number;
  y: number;
}

export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

export function norm(v: Vec): Vec {
  const len = Math.hypot(v.x, v.y);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

/** True when a point is somewhere the hero may stand (the clearing or a trail). */
export function isWalkable(p: Vec): boolean {
  const c = WORLD.clearing;
  const dx = (p.x - c.x) / c.rx;
  const dy = (p.y - c.y) / c.ry;
  if (dx * dx + dy * dy <= 1) return true;
  return WORLD.trails.some((t) => p.x >= t.x && p.x <= t.x + t.w && p.y >= t.y && p.y <= t.y + t.h);
}

/** Move from `from` toward `to`, but never into the woods or through a tent, log or the fire. */
export function moveHero(from: Vec, to: Vec, radius: number): Vec {
  let next = { ...to };
  if (!isWalkable(next)) {
    // Try sliding along one axis before giving up.
    const slideX = { x: to.x, y: from.y };
    const slideY = { x: from.x, y: to.y };
    if (isWalkable(slideX)) next = slideX;
    else if (isWalkable(slideY)) next = slideY;
    else next = { ...from };
  }
  const blockers = [...WORLD.obstacles, { x: WORLD.fire.x, y: WORLD.fire.y, r: WORLD.fire.radius - 10 }];
  for (const o of blockers) {
    const d = Math.hypot(next.x - o.x, next.y - o.y);
    const min = o.r + radius;
    if (d < min) {
      const n = d === 0 ? { x: 0, y: 1 } : { x: (next.x - o.x) / d, y: (next.y - o.y) / d };
      next = { x: o.x + n.x * min, y: o.y + n.y * min };
    }
  }
  next.x = Math.max(0, Math.min(WORLD.width, next.x));
  next.y = Math.max(0, Math.min(WORLD.height, next.y));
  return next;
}
