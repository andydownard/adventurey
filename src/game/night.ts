import { ALLIES, ANIMALS, CRYSTALS, EXPLORE, HERO, LEVELS, MONSTERS, NIGHT, PACK_PERKS, PETS, RANGED, REGIONS, REWARDS, SWORD, WILD, WORLD, type AnimalKind, type RegionId } from './config';
import { makeRng, pick, type Rng } from './rng';
import { dist, isWalkable, moveHero, norm, regionAt, toWorld, type Vec } from './world';

export type PetKind = 'dragon' | 'wolf' | 'owl';
export type RangedKind = 'bow' | 'crossbow';
export type PackKind = 'wolf' | 'dragon' | 'fox' | 'bunny';
export type MonsterSize = keyof typeof MONSTERS;
export type Mode = 'camp' | 'explore';

/** How hard a night is. Night 1 is gentle; each night after it is harder, up to LEVELS.hardestNight. */
export interface Level {
  campHealth: number;
  pace: number;
  monsterSpeed: number;
  extraHp: number;
  bigChance: number;
  bigAfter: number;
  pairChance: number;
  pairAfter: number;
  maxRaiders: number;
  awayGentler: number;
  wildChase: number;
}

/** The numbers for a night. Fractional nights (used by Explore) slide smoothly. */
export function levelFor(night: number): Level {
  const k = Math.min(1, Math.max(0, (night - 1) / (LEVELS.hardestNight - 1)));
  const at = (p: { first: number; hardest: number }) => p.first + (p.hardest - p.first) * k;
  return {
    campHealth: Math.round(at(LEVELS.campHealth)),
    pace: at(LEVELS.pace),
    monsterSpeed: at(LEVELS.monsterSpeed),
    extraHp: Math.floor(at(LEVELS.extraHp) + 1e-9),
    bigChance: at(LEVELS.bigChance),
    bigAfter: at(LEVELS.bigAfter),
    pairChance: at(LEVELS.pairChance),
    pairAfter: at(LEVELS.pairAfter),
    maxRaiders: Math.round(at(LEVELS.maxRaiders)),
    awayGentler: at(LEVELS.awayGentler),
    wildChase: at(LEVELS.wildChase),
  };
}

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
  /** Set for monsters that live out in the wild instead of raiding camp. */
  wild?: { slot: number; home: Vec; target: Vec };
  /** Set for Explore monsters that come out to chase the hero. */
  hunt?: boolean;
}

/** A friendly animal. Give it a crystal and it becomes a friend that follows and helps. */
export interface Animal {
  id: number;
  kind: AnimalKind;
  region: Exclude<RegionId, 'camp'>;
  home: Vec;
  pos: Vec;
  target: Vec;
  friend: boolean;
  /** Its place in the line of friends, so they don't all stand in one spot. */
  slot: number;
  cd: number;
  facing: number;
  moving: boolean;
}

/** A place out in the wild where one monster lives. It comes back a while after being sent home. */
export interface WildSlot {
  region: Exclude<RegionId, 'camp'>;
  home: Vec;
  size: MonsterSize;
  monsterId: number | null;
  backAt: number;
}

export interface Crystal {
  id: number;
  region: Exclude<RegionId, 'camp'>;
  pos: Vec;
  taken: boolean;
  /** Explore only: when a taken crystal grows back. */
  backAt?: number;
}

export interface Arrow {
  id: number;
  pos: Vec;
  vel: Vec;
  life: number;
  damage: number;
  pierce: number;
  /** Shot by the bunny archer instead of the hero. */
  byAnimal?: boolean;
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
  /** Give a crystal to the animal the hero is standing next to. */
  give?: boolean;
}

export type Outcome = 'playing' | 'sunrise' | 'campFell' | 'home';

export type NightEvent =
  | { type: 'swing'; at: Vec; dir: Vec }
  | { type: 'shoot'; at: Vec; dir: Vec }
  | { type: 'spawn'; id: number; at: Vec; size: MonsterSize }
  | { type: 'hit'; id: number; at: Vec; by: HitBy }
  | { type: 'poof'; id: number; at: Vec; size: MonsterSize }
  | { type: 'snack'; id: number; at: Vec; campHealth: number }
  | { type: 'dizzy'; at: Vec }
  | { type: 'petAttack'; kind: PetKind; from: Vec; to: Vec }
  | { type: 'allyAttack'; kind: AllyKind; from: Vec; to: Vec }
  | { type: 'arrowGone'; id: number }
  | { type: 'crystal'; id: number; at: Vec; found: number; byArrow: boolean }
  | { type: 'crystalBack'; id: number }
  | { type: 'bonusCrystal'; at: Vec }
  | { type: 'befriend'; id: number; kind: AnimalKind; at: Vec }
  | { type: 'needCrystal'; at: Vec }
  | { type: 'animalAttack'; id: number; kind: AnimalKind; from: Vec; to: Vec }
  | { type: 'region'; region: RegionId }
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
  /** Crystals picked up out in the wild this night. */
  crystalsFound: number;
  /** Crystals the hero has right now: saved ones, plus found and earned, minus given away. */
  gems: number;
  /** Crystals given to animals this night. */
  given: number;
  crystals: Crystal[];
  animals: Animal[];
  mode: Mode;
  level: Level;
  needNoteAt: number;
  wild: WildSlot[];
  /** Where the hero is right now. */
  region: RegionId;
  nightNumber: number;
  outcome: Outcome;
  loadout: Loadout;
  rng: Rng;
}

export interface NightOptions {
  /** Crystals the player already has saved; they can give these to animals. */
  gems?: number;
  /** Animals from the pet box that come along as friends from the start. */
  friends?: AnimalKind[];
  mode?: Mode;
}

export function createNight(loadout: Loadout, seed = 1, nightNumber = 1, opts: NightOptions = {}): NightState {
  const mode = opts.mode ?? 'camp';
  const level = levelFor(nightNumber);
  let id = 1;
  const animals: Animal[] = ANIMALS.spots.map((sp) => {
    const r = REGIONS.find((x) => x.id === sp.region)!;
    const home = toWorld(r, sp);
    return { id: 10000 + id++, kind: sp.kind, region: sp.region, home, pos: { ...home }, target: { ...home }, friend: false, slot: 0, cd: 0, facing: 1, moving: false };
  });
  // Friends from the pet box start next to the hero.
  const bring = [...new Set(opts.friends ?? [])].slice(0, ANIMALS.maxFriends);
  bring.forEach((k, i) => {
    const a = animals.find((x) => x.kind === k);
    if (!a) return;
    a.friend = true;
    a.slot = i;
    a.pos = { x: WORLD.heroStart.x - 70 - (i % 4) * 34, y: WORLD.heroStart.y + 30 + Math.floor(i / 4) * 40 };
  });
  return {
    t: 0,
    length: mode === 'explore' ? Infinity : NIGHT.lengthSec,
    campHealth: level.campHealth,
    maxCampHealth: level.campHealth,
    hero: { pos: { ...WORLD.heroStart }, facing: { x: 1, y: 0 }, dizzy: 0, swordCd: 0, shotCd: 0, moving: false },
    pet: { kind: loadout.pet, pos: { x: WORLD.heroStart.x - 60, y: WORLD.heroStart.y + 10 }, cd: 1, orbit: 0, facing: 1 },
    allies: ALLIES.posts.map((p, i) => ({ kind: ALLIES.kinds[i % ALLIES.kinds.length], pos: { ...p }, post: { ...p }, cd: 1 + i * 0.7, facing: 1, moving: false })),
    monsters: [],
    arrows: [],
    nextSpawn: mode === 'explore' ? EXPLORE.everySec.first : 2,
    paceScale: level.pace,
    nextId: 1,
    bonks: 0,
    crystalsFound: 0,
    gems: Math.max(0, Math.floor(opts.gems ?? 0)),
    given: 0,
    crystals: REGIONS.flatMap((r) => r.crystals.map((c) => ({ id: 0, region: r.id, pos: toWorld(r, c), taken: false }))).map((c, i) => ({ ...c, id: i + 1 })),
    animals,
    wild: REGIONS.flatMap((r) => r.wanderers.filter((w) => (w.fromNight ?? 1) <= nightNumber).map((w) => ({ region: r.id, home: toWorld(r, w), size: w.size, monsterId: null, backAt: 0 }))),
    region: 'camp',
    nightNumber,
    mode,
    level,
    needNoteAt: -10,
    outcome: 'playing',
    loadout,
    rng: makeRng(seed + nightNumber * 7919),
  };
}

/** The animal close enough to get a crystal right now, if any. */
export function animalToBefriend(s: NightState): Animal | null {
  let best: Animal | null = null;
  let bestD: number = ANIMALS.giveRange;
  for (const a of s.animals) {
    if (a.friend) continue;
    const d = dist(a.pos, s.hero.pos);
    if (d <= bestD) { best = a; bestD = d; }
  }
  return best;
}

export const friendCount = (s: NightState) => s.animals.filter((a) => a.friend).length;

/** Animals that became friends during this night (to add to the pet box). */
export function newFriends(s: NightState, had: AnimalKind[] = []): AnimalKind[] {
  return s.animals.filter((a) => a.friend && !had.includes(a.kind)).map((a) => a.kind);
}

/** Explore: end the trip and go home with what you found. */
export function headHome(s: NightState): void {
  if (s.outcome === 'playing') s.outcome = 'home';
}

export const progress = (s: NightState) => Math.min(1, s.t / s.length);

export function spawnInterval(p: number): number {
  const { start, end } = NIGHT.spawnEverySec;
  return start + (end - start) * Math.min(1, Math.max(0, p));
}

function heroSpeed(s: NightState) {
  return s.loadout.pack === 'wolf' ? HERO.wolfPackSpeed : HERO.speed;
}

export type HitBy = 'sword' | 'arrow' | 'pet' | 'ally' | 'animal';

function damage(s: NightState, m: Monster, amount: number, by: HitBy, ev: NightEvent[]) {
  m.hp -= amount;
  m.hitFlash = 0.15;
  ev.push({ type: 'hit', id: m.id, at: { ...m.pos }, by });
  if (m.hp <= 0) {
    s.monsters = s.monsters.filter((x) => x !== m);
    if (m.wild) {
      const slot = s.wild[m.wild.slot];
      slot.monsterId = null;
      slot.backAt = s.t + WILD.respawnSec;
    }
    s.bonks += 1;
    ev.push({ type: 'poof', id: m.id, at: { ...m.pos }, size: m.size });
    if (s.bonks % REWARDS.crystalsPerBonks === 0) {
      s.gems += 1;
      ev.push({ type: 'bonusCrystal', at: { ...m.pos } });
    }
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
  const late = s.mode === 'explore' ? 1 : progress(s);
  if (late >= s.level.bigAfter && r < s.level.bigChance) return 'big';
  if (r > 1 - NIGHT.smallChance) return 'small';
  return 'normal';
}

function spawn(s: NightState, ev: NightEvent[]) {
  const size = pickSize(s);
  const base = pick(s.rng, WORLD.spawns);
  const at = { x: base.x + (s.rng() - 0.5) * 60, y: base.y + (s.rng() - 0.5) * 60 };
  const hp = monsterHp(s, size);
  const m: Monster = { id: s.nextId++, size, pos: at, hp, maxHp: hp, slow: 0, hitFlash: 0 };
  s.monsters.push(m);
  ev.push({ type: 'spawn', id: m.id, at: { ...at }, size });
}

/** Small monsters always pop in one bonk; others get tougher on later nights. */
function monsterHp(s: NightState, size: MonsterSize): number {
  return MONSTERS[size].hp + (size === 'small' ? 0 : s.level.extraHp);
}

/** Explore: a monster comes out of the dark somewhere around the hero, off screen. */
function spawnHunter(s: NightState, ev: NightEvent[]) {
  for (let i = 0; i < 12; i++) {
    const a = s.rng() * Math.PI * 2;
    const r = EXPLORE.spawnFrom + s.rng() * (EXPLORE.spawnTo - EXPLORE.spawnFrom);
    const at = { x: s.hero.pos.x + Math.cos(a) * r, y: s.hero.pos.y + Math.sin(a) * r * 0.75 };
    if (!isWalkable(at)) continue;
    const size = pickSize(s);
    const hp = monsterHp(s, size);
    const m: Monster = { id: s.nextId++, size, pos: at, hp, maxHp: hp, slow: 0, hitFlash: 0, hunt: true };
    s.monsters.push(m);
    ev.push({ type: 'spawn', id: m.id, at: { ...at }, size });
    return;
  }
}

function spawnWild(s: NightState, i: number, ev: NightEvent[]) {
  const slot = s.wild[i];
  const hp = monsterHp(s, slot.size);
  const m: Monster = { id: s.nextId++, size: slot.size, pos: { ...slot.home }, hp, maxHp: hp, slow: 0, hitFlash: 0, wild: { slot: i, home: { ...slot.home }, target: { ...slot.home } } };
  slot.monsterId = m.id;
  s.monsters.push(m);
  ev.push({ type: 'spawn', id: m.id, at: { ...m.pos }, size: m.size });
}

/** A new spot to roam to, near home and on open ground. */
function roamTarget(s: NightState, home: Vec): Vec {
  for (let i = 0; i < 8; i++) {
    const a = s.rng() * Math.PI * 2;
    const r = s.rng() * WILD.roamRadius;
    const p = { x: home.x + Math.cos(a) * r, y: home.y + Math.sin(a) * r * 0.7 };
    if (isWalkable(p)) return p;
  }
  return { ...home };
}

/** How many monsters may head for camp at the same time on this night. */
export function maxRaiders(nightNumber: number): number {
  return levelFor(nightNumber).maxRaiders;
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
    hero.shotCd = r.cooldownSec * (s.loadout.pack === 'bunny' ? PACK_PERKS.bunnyReloadScale : 1);
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

  // Which area is the hero in?
  const here = regionAt(hero.pos) ?? s.region;
  if (here !== s.region) {
    s.region = here;
    ev.push({ type: 'region', region: here });
  }

  // Crystals out in the wild
  for (const c of s.crystals) {
    const reach = CRYSTALS.pickupRadius * (s.loadout.pack === 'fox' ? PACK_PERKS.foxPickupScale : 1);
    if (!c.taken && dist(c.pos, hero.pos) <= reach) takeCrystal(s, c, false, ev);
    if (c.taken && c.backAt !== undefined && s.t >= c.backAt) {
      c.taken = false;
      c.backAt = undefined;
      ev.push({ type: 'crystalBack', id: c.id });
    }
  }

  // Give a crystal to the animal next to the hero.
  if (input.give) giveCrystal(s, ev);

  if (s.mode === 'explore') {
    // Explore gets harder the longer you stay out.
    const k = Math.min(1, s.t / EXPLORE.hardestAfterSec);
    s.level = levelFor(1 + (LEVELS.hardestNight - 1) * k);
    const cap = s.level.maxRaiders;
    while (s.t >= s.nextSpawn) {
      if (s.monsters.filter((m) => m.hunt).length < cap) spawnHunter(s, ev);
      s.nextSpawn += EXPLORE.everySec.first + (EXPLORE.everySec.hardest - EXPLORE.everySec.first) * k;
    }
  } else {
    // New monsters. While the hero is out exploring, the pack holds camp and they come more slowly.
    const away = s.region !== 'camp';
    const cap = s.level.maxRaiders;
    const raiders = () => s.monsters.filter((m) => !m.wild).length;
    while (s.t >= s.nextSpawn && s.t < s.length - 3) {
      if (raiders() < cap) spawn(s, ev);
      if (progress(s) >= s.level.pairAfter && s.rng() < s.level.pairChance && raiders() < cap) spawn(s, ev);
      s.nextSpawn += spawnInterval(progress(s)) * s.paceScale * (away ? s.level.awayGentler : 1);
    }
  }
  s.wild.forEach((slot, i) => {
    if (slot.monsterId === null && s.t >= slot.backAt && s.t < s.length - 3) spawnWild(s, i, ev);
  });

  // Monsters walk toward the campfire
  const fire = WORLD.fire;
  for (const m of [...s.monsters]) {
    const st = MONSTERS[m.size];
    m.hitFlash = Math.max(0, m.hitFlash - dt);
    const speed = st.speed * s.level.monsterSpeed * (m.slow > 0 ? PETS.dragon.slowFactor : 1);
    m.slow = Math.max(0, m.slow - dt);
    if (m.wild) {
      // Wild monsters roam near home, and chase the hero who wanders close.
      const w = m.wild;
      const chasing = dist(m.pos, hero.pos) <= s.level.wildChase && dist(hero.pos, w.home) <= WILD.leash;
      const goal = chasing ? hero.pos : w.target;
      const next = moveToward(m.pos, goal, (chasing ? speed : WILD.roamSpeed) * dt);
      if (isWalkable(next)) m.pos = next;
      else if (!chasing) w.target = roamTarget(s, w.home);
      if (!chasing && dist(m.pos, w.target) < 6) w.target = roamTarget(s, w.home);
    } else if (m.hunt) {
      // Explore monsters chase the hero, walking around rocks and trees.
      const next = moveToward(m.pos, hero.pos, speed * dt);
      if (isWalkable(next)) m.pos = next;
      else {
        const sx = { x: next.x, y: m.pos.y };
        const sy = { x: m.pos.x, y: next.y };
        if (isWalkable(sx)) m.pos = sx;
        else if (isWalkable(sy)) m.pos = sy;
      }
    } else {
      m.pos = moveToward(m.pos, fire, speed * dt);
    }
    if (!m.wild && !m.hunt && dist(m.pos, fire) <= fire.radius + st.radius * 0.5) {
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
    let gone = a.life <= 0;
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
    // The hero's arrows pick up crystals they fly past.
    if (!a.byAnimal) {
      for (const c of s.crystals) {
        if (!c.taken && dist(a.pos, { x: c.pos.x, y: c.pos.y - 25 }) <= CRYSTALS.arrowRadius) takeCrystal(s, c, true, ev);
      }
    }
    if (gone) {
      s.arrows = s.arrows.filter((x) => x !== a);
      ev.push({ type: 'arrowGone', id: a.id });
    }
  }

  stepPet(s, dt, ev);
  stepAllies(s, dt, ev);
  stepAnimals(s, dt, ev);

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
    // Crystals earned this night (found plus one for every few monsters sent home).
    crystals: Math.floor(s.bonks / REWARDS.crystalsPerBonks) + s.crystalsFound,
    // Crystals handed to animal friends this night.
    given: s.given,
    dragonPower: s.outcome === 'sunrise' ? REWARDS.dragonPowerPerNight : 0,
  };
}

function takeCrystal(s: NightState, c: Crystal, byArrow: boolean, ev: NightEvent[]) {
  c.taken = true;
  if (s.mode === 'explore') c.backAt = s.t + EXPLORE.crystalBackSec;
  s.crystalsFound += 1;
  s.gems += 1;
  ev.push({ type: 'crystal', id: c.id, at: { ...c.pos }, found: s.crystalsFound, byArrow });
}

function giveCrystal(s: NightState, ev: NightEvent[]) {
  const a = animalToBefriend(s);
  if (!a) return;
  if (s.gems <= 0 || friendCount(s) >= ANIMALS.maxFriends) {
    if (s.t - s.needNoteAt > 1.5) {
      s.needNoteAt = s.t;
      ev.push({ type: 'needCrystal', at: { ...a.pos } });
    }
    return;
  }
  s.gems -= 1;
  s.given += 1;
  a.friend = true;
  a.slot = friendCount(s) - 1;
  a.cd = 0.6;
  ev.push({ type: 'befriend', id: a.id, kind: a.kind, at: { ...a.pos } });
}

/** Where a friend stands near the hero: a loose half-ring behind them. */
function friendSpot(s: NightState, a: Animal): Vec {
  const h = s.hero;
  const back = h.facing.x >= 0 ? -1 : 1;
  const ang = (a.slot - 3) * 0.45;
  const r = ANIMALS.followDistance + (a.slot % 2) * 30;
  const y = a.kind === 'bat' ? -70 : 0;
  return { x: h.pos.x + back * Math.cos(ang) * r, y: h.pos.y + Math.sin(ang) * r * 0.6 + y };
}

function stepAnimals(s: NightState, dt: number, ev: NightEvent[]) {
  for (const a of s.animals) {
    const old = { ...a.pos };
    a.cd -= dt;
    if (!a.friend) {
      // Wild animals wander near home. They stop and look when the hero comes close.
      if (dist(a.pos, s.hero.pos) < ANIMALS.giveRange + 90) {
        a.facing = s.hero.pos.x >= a.pos.x ? 1 : -1;
      } else {
        const next = moveToward(a.pos, a.target, ANIMALS.roamSpeed * dt);
        if (isWalkable(next) || a.kind === 'bat') a.pos = next;
        if (dist(a.pos, a.target) < 4 || !isWalkable(next)) {
          for (let i = 0; i < 6; i++) {
            const ang = s.rng() * Math.PI * 2;
            const p = { x: a.home.x + Math.cos(ang) * ANIMALS.roamRadius * s.rng(), y: a.home.y + Math.sin(ang) * ANIMALS.roamRadius * 0.6 * s.rng() };
            if (isWalkable(p)) { a.target = p; break; }
          }
        }
      }
    } else {
      const st = ANIMALS[a.kind];
      const target = nearestMonster(s.hero.pos, s.monsters, st.range);
      if (target && st.reach > 0) {
        // Runs up to the monster, then bonks, nips, head-butts or rolls into it.
        if (dist(a.pos, target.pos) > MONSTERS[target.size].radius + st.reach) {
          a.pos = moveToward(a.pos, target.pos, ANIMALS.speed * dt);
        } else if (a.cd <= 0) {
          a.cd = st.everySec;
          ev.push({ type: 'animalAttack', id: a.id, kind: a.kind, from: { ...a.pos }, to: { ...target.pos } });
          if (st.push > 0) {
            const away = norm({ x: target.pos.x - a.pos.x, y: target.pos.y - a.pos.y });
            const pushed = { x: target.pos.x + away.x * st.push, y: target.pos.y + away.y * st.push };
            if (isWalkable(pushed)) target.pos = pushed;
          }
          damage(s, target, st.damage, 'animal', ev);
        }
      } else {
        if (dist(a.pos, s.hero.pos) > 40) a.pos = moveToward(a.pos, friendSpot(s, a), ANIMALS.speed * dt);
        if (target && a.cd <= 0) {
          a.cd = st.everySec;
          a.facing = target.pos.x >= a.pos.x ? 1 : -1;
          ev.push({ type: 'animalAttack', id: a.id, kind: a.kind, from: { ...a.pos }, to: { ...target.pos } });
          if (st.scatter > 0) {
            // The mushroom reads a spell: every monster near the target is knocked back and scattered.
            for (const m of [...s.monsters]) {
              const d = dist(m.pos, target.pos);
              if (d > st.scatter) continue;
              const away = d < 1 ? { x: s.rng() - 0.5, y: s.rng() - 0.5 } : { x: m.pos.x - a.pos.x, y: m.pos.y - a.pos.y };
              const n = norm(away);
              // Push as far as open ground allows.
              for (const f of [1, 0.6, 0.3]) {
                const pushed = { x: m.pos.x + n.x * st.push * f, y: m.pos.y + n.y * st.push * f };
                if (isWalkable(pushed)) { m.pos = pushed; break; }
              }
              m.slow = Math.max(m.slow, 0.8);
              damage(s, m, st.damage, 'animal', ev);
            }
          } else if (a.kind === 'bunny') {
            // The bunny archer shoots a little arrow.
            const dir = norm({ x: target.pos.x - a.pos.x, y: target.pos.y - 30 - (a.pos.y - 30) });
            const at = { x: a.pos.x + dir.x * 20, y: a.pos.y - 30 };
            s.arrows.push({ id: s.nextId++, pos: at, vel: { x: dir.x * st.arrowSpeed, y: dir.y * st.arrowSpeed }, life: 0.9, damage: st.damage, pierce: 0, hit: [], byAnimal: true });
          } else {
            // The bat swoops down on it.
            a.pos = { x: target.pos.x, y: target.pos.y - 50 };
            damage(s, target, st.damage, 'animal', ev);
          }
        }
      }
    }
    a.moving = dist(old, a.pos) > 0.01;
    if (Math.abs(a.pos.x - old.x) > 0.3) a.facing = a.pos.x > old.x ? 1 : -1;
  }
}
