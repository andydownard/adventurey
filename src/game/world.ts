import { REGIONS, TILE, WORLD, type Circle, type Region, type RegionId } from './config';

export interface Vec {
  x: number;
  y: number;
}

export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

export function norm(v: Vec): Vec {
  const len = Math.hypot(v.x, v.y);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

const inTile = (p: Vec, ox: number, oy: number) => p.x >= ox && p.x < ox + TILE.w && p.y >= oy && p.y < oy + TILE.h;

/** The area a point is in: the camp, one of the four wild areas, or null for the dark between them. */
export function regionAt(p: Vec): RegionId | null {
  if (inTile(p, 0, 0)) return 'camp';
  for (const r of REGIONS) if (inTile(p, r.offset.x, r.offset.y)) return r.id;
  return null;
}

export const regionById = (id: RegionId): Region | undefined => REGIONS.find((r) => r.id === id);

/** A point inside an area, in that area's picture coordinates. */
export const toLocal = (r: Region, p: Vec): Vec => ({ x: p.x - r.offset.x, y: p.y - r.offset.y });
export const toWorld = (r: Region, p: Vec): Vec => ({ x: p.x + r.offset.x, y: p.y + r.offset.y });

function campWalkable(p: Vec): boolean {
  const c = WORLD.clearing;
  const dx = (p.x - c.x) / c.rx;
  const dy = (p.y - c.y) / c.ry;
  if (dx * dx + dy * dy <= 1) return true;
  return WORLD.trails.some((t) => p.x >= t.x && p.x <= t.x + t.w && p.y >= t.y && p.y <= t.y + t.h);
}

function regionWalkable(r: Region, p: Vec): boolean {
  const l = toLocal(r, p);
  if (r.walk.boxes.some((b) => l.x >= b.x && l.x <= b.x + b.w && l.y >= b.y && l.y <= b.y + b.h)) return true;
  return r.walk.ellipses.some((e) => {
    const dx = (l.x - e.x) / e.rx;
    const dy = (l.y - e.y) / e.ry;
    return dx * dx + dy * dy <= 1;
  });
}

/** True when a point is somewhere the hero may stand: open ground in camp or out in the wild. */
export function isWalkable(p: Vec): boolean {
  const id = regionAt(p);
  if (id === null) return false;
  if (id === 'camp') return campWalkable(p);
  return regionWalkable(regionById(id)!, p);
}

/** Things to bump into near a point (in world coordinates). */
function blockersNear(p: Vec): Circle[] {
  const id = regionAt(p);
  if (id === 'camp' || id === null) return [...WORLD.obstacles, { x: WORLD.fire.x, y: WORLD.fire.y, r: WORLD.fire.radius - 10 }];
  const r = regionById(id)!;
  return r.obstacles.map((o) => ({ x: o.x + r.offset.x, y: o.y + r.offset.y, r: o.r }));
}

/** Move from `from` toward `to`, but never into thick woods, rock walls, a tent, a log or the fire. */
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
  for (const o of blockersNear(next)) {
    const d = Math.hypot(next.x - o.x, next.y - o.y);
    const min = o.r + radius;
    if (d < min) {
      const n = d === 0 ? { x: 0, y: 1 } : { x: (next.x - o.x) / d, y: (next.y - o.y) / d };
      const pushed = { x: o.x + n.x * min, y: o.y + n.y * min };
      next = isWalkable(pushed) ? pushed : { ...from };
    }
  }
  return next;
}

/** The whole world's edges, for the camera. */
export function worldBounds() {
  const xs = [0, ...REGIONS.map((r) => r.offset.x)];
  const ys = [0, ...REGIONS.map((r) => r.offset.y)];
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) + TILE.w - minX, h: Math.max(...ys) + TILE.h - minY };
}
