import { ALLIES, HERO, MONSTERS, NIGHT, PETS, RANGED, REWARDS, SWORD, WORLD } from './config';
import { makeRng, pick, type Rng } from './rng';
import { dist, moveHero, norm, type Vec } from './world';

export type PetKind = 'dragon' | 'wolf' | 'owl';
export type RangedKind = 'bow' | 'crossbow';
export type PackKind = 'wolf' | 'dragon';
export type MonsterSize = keyof typeof MONSTERS;

export interface Loadout {
  pet: PetKind;
  ranged: RangedKind;
  pack: PackKind;
}

export interface Hero {
  pos: Vec;
  facing: Vec;
  dizzy: number;
  swordCd: number;
  shotCd: number;
  moving: boolean;
}

export interface Monster {
  id: number;
  size: MonsterSize;
  pos: Vec;
  hp: number;
  maxHp: number;
  slow: number;
  hitFlash: number;
}

export interface Arrow {
  id: number;
  pos: Vec;
  vel: Vec;
  life: number;
  damage: number;
  pierce: number;
  hit: number[];
}

export interface Pet {
  kind: PetKind;
  pos: Vec;
  cd: number;
  orbit: number;
  facing: number; // 1 right, -1 left
}

export type AllyKind = (typeof ALLIES.kinds)[number];

export interface Ally {
  kind: AllyKind;
  pos: Vec;
  post: Vec;
  cd: number;
  facing: number;
  moving: boolean;
}

export interface Input {
  /** Joystick or keys, each axis from -1 to 1. */
  move: Vec;
  swing: boolean;
  /** A point in the world to shoot at, or null. */
  shoot: Vec | null;
}

export type Outcome = 'playing' | 'sunrise' | 'campFell';

export type NightEvent =
  | { type: 'swing'; at: Vec; dir: Vec }
  | { type: 'shoot'; at: Vec; dir: Vec }
  | { type: 'spawn'; id: number; at: Vec; size: MonsterSize }
  | { type: 'hit'; id: number; at: Vec; by: 'sword' | 'arrow' | 'pet' | 'ally' }
  | { type: 'poof'; id: number; at: Vec; size: MonsterSize }
  | { type: 'snack'; id: number; at: Vec; campHealth: number }
  | { type: 'dizzy'; at: Vec }
  | { type: 'petAttack'; kind: PetKind; from: Vec; to: Vec }
  | { type: 'allyAttack'; kind: AllyKind; from: Vec; to: Vec }
  | { type: 'arrowGone'; id: number }
  | { type: 'sunrise' }
  | { type: 'campFell' };

export interface NightState {
  t: number;
  length: number;
  campHealth: number;
  maxCampHealth: number;
  hero: Hero;
  pet: Pet;
  allies: Ally[];
  monsters: Monster[];
  arrows: Arrow[];
  nextSpawn: number;
  /** Multiplies the time between monsters: above 1 is gentler. */
  paceScale: number;
  nextId: number;
  bonks: number;
  outcome: Outcome;
  loadout: Loadout;
  rng: Rng;
}

export function createNight(loadout: Loadout, seed = 1, nightNumber = 1): NightState {
  const paceScale = Math.max(NIGHT.fastestScale, NIGHT.firstNightSlower - NIGHT.slowerDropPerNight * (nightNumber - 1));
  return {
    t: 0,
    length: NIGHT.lengthSec,
    campHealth: NIGHT.campHealth,
    maxCampHealth: NIGHT.campHealth,
    hero: { pos: { ...WORLD.heroStart }, facing: { x: 1, y: 0 }, dizzy: 0, swordCd: 0, shotCd: 0, moving: false },
    pet: { kind: loadout.pet, pos: { x: WORLD.heroStart.x - 60, y: WORLD.heroStart.y + 10 }, cd: 1, orbit: 0, facing: 1 },
    allies: ALLIES.posts.map((p, i) => ({ kind: ALLIES.kinds[i % ALLIES.kinds.length], pos: { ...p }, post: { ...p }, cd: 1 + i * 0.7, facing: 1, moving: false })),
    monsters: [],
    arrows: [],
    nextSpawn: 2,
    paceScale,
    nextId: 1,
    bonks: 0,
    outcome: 'playing',
    loadout,
    rng: makeRng(seed + nightNumber * 7919),
  };
}

export const progress = (s: NightState) => Math.min(1, s.t / s.length);

export function spawnInterval(p: number): number {
  const { start, end } = NIGHT.spawnEverySec;
  return start + (end - start) * Math.min(1, Math.max(0, p));
}

function heroSpeed(s: NightState) {
  return s.loadout.pack === 'wolf' ? HERO.wolfPackSpeed : HERO.speed;
}

function damage(s: NightState, m: Monster, amount: number, by: 'sword' | 'arrow' | 'pet' | 'ally', ev: NightEvent[]) {
  m.hp -= amount;
  m.hitFlash = 0.15;
  ev.push({ type: 'hit', id: m.id, at: { ...m.pos }, by });
  if (m.hp <= 0) {
    s.monsters = s.monsters.filter((x) => x !== m);
    s.bonks += 1;
    ev.push({ type: 'poof', id: m.id, at: { ...m.pos }, size: m.size });
  }
}

/** Monsters the sword reaches: close enough and inside the swing arc in front of the hero. */
export function swordTargets(hero: Hero, monsters: Monster[]): Monster[] {
  const half = (SWORD.arcDeg / 2) * (Math.PI / 180);
  const f = norm(hero.facing);
  return monsters.filter((m) => {
    const dx = m.pos.x - hero.pos.x;
    const dy = m.pos.y - hero.pos.y;
    const d = Math.hypot(dx, dy);
    if (d > SWORD.reach + MONSTERS[m.size].radius) return false;
    if (d < HERO.radius + MONSTERS[m.size].radius) return true; // touching counts
    const cos = (dx * f.x + dy * f.y) / d;
    return cos >= Math.cos(half);
  });
}

function pickSize(s: NightState): MonsterSize {
  const r = s.rng();
  if (progress(s) >= NIGHT.bigAfter && r < NIGHT.bigChance) return 'big';
  if (r > 1 - NIGHT.smallChance) return 'small';
  return 'normal';
}

function spawn(s: NightState, ev: NightEvent[]) {
  const size = pickSize(s);
  const base = pick(s.rng, WORLD.spawns);
  const at = { x: base.x + (s.rng() - 0.5) * 60, y: base.y + (s.rng() - 0.5) * 60 };
  const stats = MONSTERS[size];
  const m: Monster = { id: s.nextId++, size, pos: at, hp: stats.hp, maxHp: stats.hp, slow: 0, hitFlash: 0 };
  s.monsters.push(m);
  ev.push({ type: 'spawn', id: m.id, at: { ...at }, size });
}

function nearestMonster(from: Vec, monsters: Monster[], range: number): Monster | null {
  let best: Monster | null = null;
  let bestD = range;
  for (const m of monsters) {
    const d = dist(from, m.pos);
    if (d <= bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

function moveToward(p: Vec, target: Vec, step: number): Vec {
  const d = dist(p, target);
  if (d <= step || d === 0) return { ...target };
  return { x: p.x + ((target.x - p.x) / d) * step, y: p.y + ((target.y - p.y) / d) * step };
}

function stepPet(s: NightState, dt: number, ev: NightEvent[]) {
  const pet = s.pet;
  const bonus = s.loadout.pack === 'dragon' ? PETS.dragonPackBonus : 0;
  pet.cd -= dt;
  const hero = s.hero.pos;
  const oldX = pet.pos.x;

  if (pet.kind === 'owl') {
    const st = PETS.owl;
    pet.orbit += dt * 1.6;
    const home = { x: hero.x + Math.cos(pet.orbit) * 80, y: hero.y - 70 + Math.sin(pet.orbit) * 30 };
    pet.pos = moveToward(pet.pos, home, st.speed * dt);
    const target = nearestMonster(hero, s.monsters, st.range);
    if (target && pet.cd <= 0) {
      pet.cd = st.everySec;
      ev.push({ type: 'petAttack', kind: 'owl', from: { ...pet.pos }, to: { ...target.pos } });
      pet.pos = { x: target.pos.x, y: target.pos.y - 40 };
      damage(s, target, st.damage + bonus, 'pet', ev);
    }
  } else if (pet.kind === 'wolf') {
    const st = PETS.wolf;
    const target = nearestMonster(hero, s.monsters, st.range);
    if (target) {
      pet.pos = moveToward(pet.pos, target.pos, st.speed * dt);
      if (dist(pet.pos, target.pos) < MONSTERS[target.size].radius + 24 && pet.cd <= 0) {
        pet.cd = st.everySec;
        ev.push({ type: 'petAttack', kind: 'wolf', from: { ...pet.pos }, to: { ...target.pos } });
        damage(s, target, st.damage + bonus, 'pet', ev);
      }
    } else if (dist(pet.pos, hero) > PETS.followDistance) {
      pet.pos = moveToward(pet.pos, { x: hero.x - 50, y: hero.y + 16 }, st.speed * dt);
    }
  } else {
    const st = PETS.dragon;
    if (dist(pet.pos, hero) > PETS.followDistance) {
      pet.pos = moveToward(pet.pos, { x: hero.x - 60, y: hero.y + 12 }, st.speed * dt);
    }
    const target = nearestMonster(pet.pos, s.monsters, st.range);
    if (target && pet.cd <= 0) {
      pet.cd = st.everySec;
      target.slow = st.slowSec;
      ev.push({ type: 'petAttack', kind: 'dragon', from: { ...pet.pos }, to: { ...target.pos } });
      pet.facing = target.pos.x >= pet.pos.x ? 1 : -1;
      damage(s, target, st.damage + bonus, 'pet', ev);
      return;
    }
  }
  if (Math.abs(pet.pos.x - oldX) > 0.5) pet.facing = pet.pos.x > oldX ? 1 : -1;
}

function stepAllies(s: NightState, dt: number, ev: NightEvent[]) {
  const fire = WORLD.fire;
  for (const a of s.allies) {
    a.cd -= dt;
    const st = ALLIES[a.kind];
    // Only monsters that come close to camp are worth leaving the post for.
    const near = s.monsters.filter((m) => dist(m.pos, fire) <= ALLIES.guardRadius);
    let target: Monster | null = null;
    let best = Infinity;
    for (const m of near) {
      const d = dist(a.pos, m.pos);
      if (d < best) { best = d; target = m; }
    }
    const old = { ...a.pos };
    if (target) {
      const reach = st.range + MONSTERS[target.size].radius;
      if (best > reach) a.pos = moveToward(a.pos, target.pos, ALLIES.speed * dt);
      else if (a.cd <= 0) {
        a.cd = st.everySec;
        a.facing = target.pos.x >= a.pos.x ? 1 : -1;
        ev.push({ type: 'allyAttack', kind: a.kind, from: { ...a.pos }, to: { ...target.pos } });
        damage(s, target, st.damage, 'ally', ev);
      }
    } else if (dist(a.pos, a.post) > 4) {
      a.pos = moveToward(a.pos, a.post, ALLIES.speed * 0.7 * dt);
    }
    a.moving = dist(old, a.pos) > 0.01;
    if (Math.abs(a.pos.x - old.x) > 0.01) a.facing = a.pos.x > old.x ? 1 : -1;
  }
}

export function stepNight(s: NightState, dt: number, input: Input): NightEvent[] {
  const ev: NightEvent[] = [];
  if (s.outcome !== 'playing') return ev;
  s.t += dt;
  const hero = s.hero;

  // Hero
  hero.dizzy = Math.max(0, hero.dizzy - dt);
  hero.swordCd = Math.max(0, hero.swordCd - dt);
  hero.shotCd = Math.max(0, hero.shotCd - dt);
  const mx = Math.max(-1, Math.min(1, input.move.x));
  const my = Math.max(-1, Math.min(1, input.move.y));
  const mag = Math.min(1, Math.hypot(mx, my));
  hero.moving = mag > 0.05 && hero.dizzy <= 0;
  if (hero.moving) {
    const dir = norm({ x: mx, y: my });
    hero.facing = dir;
    const step = heroSpeed(s) * mag * dt;
    hero.pos = moveHero(hero.pos, { x: hero.pos.x + dir.x * step, y: hero.pos.y + dir.y * step }, HERO.radius);
  }
  if (hero.dizzy <= 0 && input.shoot && hero.shotCd <= 0) {
    const r = RANGED[s.loadout.ranged];
    let dir = norm({ x: input.shoot.x - hero.pos.x, y: input.shoot.y - hero.pos.y });
    if (dir.x === 0 && dir.y === 0) dir = norm(hero.facing);
    hero.facing = dir;
    hero.shotCd = r.cooldownSec;
    const at = { x: hero.pos.x + dir.x * 30, y: hero.pos.y - 30 + dir.y * 30 };
    s.arrows.push({ id: s.nextId++, pos: at, vel: { x: dir.x * r.speed, y: dir.y * r.speed }, life: r.life, damage: r.damage, pierce: r.pierce, hit: [] });
    ev.push({ type: 'shoot', at, dir });
  }
  if (hero.dizzy <= 0 && input.swing && hero.swordCd <= 0) {
    hero.swordCd = SWORD.cooldownSec;
    ev.push({ type: 'swing', at: { ...hero.pos }, dir: norm(hero.facing) });
    for (const m of swordTargets(hero, s.monsters)) {
      const away = norm({ x: m.pos.x - hero.pos.x, y: m.pos.y - hero.pos.y });
      m.pos = { x: m.pos.x + away.x * SWORD.knockback, y: m.pos.y + away.y * SWORD.knockback };
      damage(s, m, SWORD.damage, 'sword', ev);
    }
  }

  // New monsters
  while (s.t >= s.nextSpawn && s.t < s.length - 3) {
    spawn(s, ev);
    if (progress(s) >= NIGHT.pairAfter && s.rng() < NIGHT.pairChance) spawn(s, ev);
    s.nextSpawn += spawnInterval(progress(s)) * s.paceScale;
  }

  // Monsters walk toward the campfire
  const fire = WORLD.fire;
  for (const m of [...s.monsters]) {
    const st = MONSTERS[m.size];
    m.hitFlash = Math.max(0, m.hitFlash - dt);
    const speed = st.speed * (m.slow > 0 ? PETS.dragon.slowFactor : 1);
    m.slow = Math.max(0, m.slow - dt);
    m.pos = moveToward(m.pos, fire, speed * dt);
    if (dist(m.pos, fire) <= fire.radius + st.radius * 0.5) {
      s.campHealth = Math.max(0, s.campHealth - st.campDamage);
      s.monsters = s.monsters.filter((x) => x !== m);
      ev.push({ type: 'snack', id: m.id, at: { ...m.pos }, campHealth: s.campHealth });
      continue;
    }
    if (hero.dizzy <= 0 && dist(m.pos, hero.pos) < HERO.radius + st.radius) {
      hero.dizzy = HERO.dizzySec;
      const away = norm({ x: m.pos.x - hero.pos.x, y: m.pos.y - hero.pos.y });
      m.pos = { x: m.pos.x + away.x * 40, y: m.pos.y + away.y * 40 };
      ev.push({ type: 'dizzy', at: { ...hero.pos } });
    }
  }

  // Arrows
  for (const a of [...s.arrows]) {
    a.pos = { x: a.pos.x + a.vel.x * dt, y: a.pos.y + a.vel.y * dt };
    a.life -= dt;
    let gone = a.life <= 0 || a.pos.x < -50 || a.pos.y < -50 || a.pos.x > WORLD.width + 50 || a.pos.y > WORLD.height + 50;
    for (const m of [...s.monsters]) {
      if (gone) break;
      if (a.hit.includes(m.id)) continue;
      // Arrows fly at chest height, so compare with the monster's middle.
      if (dist(a.pos, { x: m.pos.x, y: m.pos.y - 30 }) < MONSTERS[m.size].radius + 14) {
        a.hit.push(m.id);
        damage(s, m, a.damage, 'arrow', ev);
        a.pierce -= 1;
        if (a.pierce < 0) gone = true;
      }
    }
    if (gone) {
      s.arrows = s.arrows.filter((x) => x !== a);
      ev.push({ type: 'arrowGone', id: a.id });
    }
  }

  stepPet(s, dt, ev);
  stepAllies(s, dt, ev);

  if (s.campHealth <= 0) {
    s.outcome = 'campFell';
    ev.push({ type: 'campFell' });
  } else if (s.t >= s.length) {
    s.outcome = 'sunrise';
    for (const m of s.monsters) ev.push({ type: 'poof', id: m.id, at: { ...m.pos }, size: m.size });
    s.monsters = [];
    ev.push({ type: 'sunrise' });
  }
  return ev;
}

export function nightRewards(s: NightState) {
  return {
    crystals: Math.floor(s.bonks / REWARDS.crystalsPerBonks),
    dragonPower: s.outcome === 'sunrise' ? REWARDS.dragonPowerPerNight : 0,
  };
}
