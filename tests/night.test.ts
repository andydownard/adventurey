import { CRYSTALS, HERO, MONSTERS, NIGHT, RANGED, REGIONS, REWARDS, SWORD, WILD, WORLD } from '../src/game/config';
import { createNight, nightRewards, spawnInterval, stepNight, swordTargets, type Input, type Loadout, type Monster, type NightState } from '../src/game/night';
import { makeRng } from '../src/game/rng';
import type { Vec } from '../src/game/world';
import { isWalkable, moveHero, regionAt, toWorld, worldBounds } from '../src/game/world';

const idle: Input = { move: { x: 0, y: 0 }, swing: false, shoot: null };
const loadout: Loadout = { pet: 'dragon', ranged: 'bow', pack: 'wolf' };

function monster(s: NightState, x: number, y: number, size: Monster['size'] = 'normal'): Monster {
  const m: Monster = { id: s.nextId++, size, pos: { x, y }, hp: MONSTERS[size].hp, maxHp: MONSTERS[size].hp, slow: 0, hitFlash: 0 };
  s.monsters.push(m);
  return m;
}

/** A night where nothing spawns and the pet sleeps, so a test controls everything. */
function quiet(l = loadout): NightState {
  const s = createNight({ ...l }, 3);
  s.nextSpawn = 1e9;
  s.pet.cd = 1e9;
  s.wild = []; // no wild monsters unless a test adds them
  return s;
}

describe('random numbers', () => {
  it('repeat for the same seed', () => {
    const a = makeRng(42), b = makeRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('walking', () => {
  it('the camp start spot and the fire ring edge are walkable, the deep woods are not', () => {
    expect(isWalkable(WORLD.heroStart)).toBe(true);
    expect(isWalkable({ x: 60, y: 60 })).toBe(false);
  });
  it('the hero cannot walk into the fire or a tent', () => {
    const p = moveHero({ x: WORLD.fire.x, y: WORLD.fire.y + 120 }, { x: WORLD.fire.x, y: WORLD.fire.y + 10 }, HERO.radius);
    expect(Math.hypot(p.x - WORLD.fire.x, p.y - WORLD.fire.y)).toBeGreaterThanOrEqual(WORLD.fire.radius - 10 + HERO.radius - 0.001);
  });
  it('moves the hero at Wolf Pack speed', () => {
    const s = quiet();
    const x0 = s.hero.pos.x;
    stepNight(s, 0.1, { ...idle, move: { x: 1, y: 0 } });
    expect(s.hero.pos.x - x0).toBeCloseTo(HERO.wolfPackSpeed * 0.1, 3);
  });
  it('a Dragon Pack hero walks at normal speed', () => {
    const s = quiet({ ...loadout, pack: 'dragon' });
    const x0 = s.hero.pos.x;
    stepNight(s, 0.1, { ...idle, move: { x: 1, y: 0 } });
    expect(s.hero.pos.x - x0).toBeCloseTo(HERO.speed * 0.1, 3);
  });
});

describe('the sword', () => {
  it('reaches a monster in front, not one behind', () => {
    const s = quiet();
    s.hero.facing = { x: 1, y: 0 };
    const front = monster(s, s.hero.pos.x + 70, s.hero.pos.y);
    const behind = monster(s, s.hero.pos.x - 90, s.hero.pos.y);
    const hits = swordTargets(s.hero, s.monsters);
    expect(hits).toContain(front);
    expect(hits).not.toContain(behind);
  });
  it('sends a normal monster home in one swing and counts the bonk', () => {
    const s = quiet();
    monster(s, s.hero.pos.x + 60, s.hero.pos.y);
    const ev = stepNight(s, 0.016, { ...idle, swing: true });
    expect(ev.some((e) => e.type === 'poof')).toBe(true);
    expect(s.monsters).toHaveLength(0);
    expect(s.bonks).toBe(1);
  });
  it('cannot swing again before the cooldown ends', () => {
    const s = quiet();
    stepNight(s, 0.016, { ...idle, swing: true });
    const ev = stepNight(s, 0.016, { ...idle, swing: true });
    expect(ev.filter((e) => e.type === 'swing')).toHaveLength(0);
    expect(s.hero.swordCd).toBeGreaterThan(0);
    expect(s.hero.swordCd).toBeLessThanOrEqual(SWORD.cooldownSec);
  });
});

describe('arrows', () => {
  it('fly toward the aim point and hit a monster in the way', () => {
    const s = quiet();
    const m = monster(s, s.hero.pos.x + 200, s.hero.pos.y, 'big');
    stepNight(s, 0.016, { ...idle, shoot: { x: s.hero.pos.x + 400, y: s.hero.pos.y - 30 } });
    expect(s.arrows).toHaveLength(1);
    for (let i = 0; i < 30; i++) stepNight(s, 0.016, idle);
    expect(m.hp).toBe(MONSTERS.big.hp - RANGED.bow.damage);
  });
  it('a crossbow bolt goes through one monster and hits the next', () => {
    const s = quiet({ ...loadout, ranged: 'crossbow' });
    const a = monster(s, s.hero.pos.x + 150, s.hero.pos.y, 'big');
    const b = monster(s, s.hero.pos.x + 260, s.hero.pos.y, 'big');
    stepNight(s, 0.016, { ...idle, shoot: { x: s.hero.pos.x + 400, y: s.hero.pos.y - 30 } });
    for (let i = 0; i < 30; i++) stepNight(s, 0.016, idle);
    expect(a.hp).toBe(MONSTERS.big.hp - RANGED.crossbow.damage);
    expect(b.hp).toBe(MONSTERS.big.hp - RANGED.crossbow.damage);
  });
});

describe('the camp', () => {
  it('loses health when a monster reaches the fire, and the monster runs off', () => {
    const s = quiet();
    monster(s, WORLD.fire.x + WORLD.fire.radius + 5, WORLD.fire.y);
    const ev = stepNight(s, 0.2, idle);
    expect(ev.some((e) => e.type === 'snack')).toBe(true);
    expect(s.campHealth).toBe(NIGHT.campHealth - MONSTERS.normal.campDamage);
    expect(s.monsters).toHaveLength(0);
  });
  it('falls when its health reaches zero', () => {
    const s = quiet();
    s.campHealth = 1;
    monster(s, WORLD.fire.x + WORLD.fire.radius + 5, WORLD.fire.y);
    const ev = stepNight(s, 0.2, idle);
    expect(s.outcome).toBe('campFell');
    expect(ev.some((e) => e.type === 'campFell')).toBe(true);
    expect(stepNight(s, 0.2, idle)).toEqual([]);
  });
  it('is saved at sunrise, and leftover monsters go home', () => {
    const s = quiet();
    monster(s, 100, 500);
    s.t = s.length - 0.01;
    const ev = stepNight(s, 0.05, idle);
    expect(s.outcome).toBe('sunrise');
    expect(ev.some((e) => e.type === 'sunrise')).toBe(true);
    expect(s.monsters).toHaveLength(0);
    expect(nightRewards(s).dragonPower).toBe(1);
  });
});

describe('monsters', () => {
  it('make the hero dizzy on touch instead of hurting', () => {
    const s = quiet();
    monster(s, s.hero.pos.x + 10, s.hero.pos.y);
    const ev = stepNight(s, 0.016, idle);
    expect(ev.some((e) => e.type === 'dizzy')).toBe(true);
    expect(s.hero.dizzy).toBeGreaterThan(0);
    const x0 = s.hero.pos.x;
    stepNight(s, 0.1, { ...idle, move: { x: 1, y: 0 } });
    expect(s.hero.pos.x).toBe(x0); // a dizzy hero cannot walk
  });
  it('come more often as the night goes on', () => {
    expect(spawnInterval(0)).toBeGreaterThan(spawnInterval(0.5));
    expect(spawnInterval(0.5)).toBeGreaterThan(spawnInterval(1));
  });
  it('the same seed spawns the same night', () => {
    const run = () => {
      const s = createNight({ ...loadout }, 99);
      s.pet.cd = 1e9;
      const spawns: string[] = [];
      for (let i = 0; i < 600; i++) {
        for (const e of stepNight(s, 0.05, idle)) if (e.type === 'spawn') spawns.push(`${e.size}@${e.at.x.toFixed(1)},${e.at.y.toFixed(1)}`);
      }
      return spawns;
    };
    const a = run();
    expect(a.length).toBeGreaterThan(5);
    expect(run()).toEqual(a);
  });
  it('a camp with nobody guarding it falls before sunrise', () => {
    const s = createNight({ ...loadout }, 5);
    s.pet.cd = 1e9;
    s.hero.pos = { x: 768, y: 980 }; // standing far down the trail
    for (let i = 0; i < 2000 && s.outcome === 'playing'; i++) stepNight(s, 0.05, idle);
    expect(s.outcome).toBe('campFell');
  });
});

describe('pets', () => {
  for (const pet of ['dragon', 'wolf', 'owl'] as const) {
    it(`the ${pet} helps send a monster home`, () => {
      const s = createNight({ ...loadout, pet }, 4);
      s.nextSpawn = 1e9;
      s.pet.cd = 0;
      monster(s, s.hero.pos.x + 120, s.hero.pos.y + 40, 'small');
      let attacked = false;
      for (let i = 0; i < 120 && !attacked; i++) attacked = stepNight(s, 0.05, idle).some((e) => e.type === 'petAttack' && e.kind === pet);
      expect(attacked).toBe(true);
      expect(s.bonks).toBe(1);
    });
  }
  it('the Dragon Pack makes the pet hit harder', () => {
    const s = createNight({ ...loadout, pack: 'dragon' }, 4);
    s.nextSpawn = 1e9;
    s.pet.cd = 0;
    const m = monster(s, s.pet.pos.x + 100, s.pet.pos.y, 'big');
    stepNight(s, 0.016, idle);
    expect(m.hp).toBe(MONSTERS.big.hp - 2);
  });
});

describe('nights get harder', () => {
  it('night 1 brings monsters more slowly than night 4, with a floor', () => {
    const one = createNight({ ...loadout }, 1, 1).paceScale;
    const four = createNight({ ...loadout }, 1, 4).paceScale;
    const twenty = createNight({ ...loadout }, 1, 20).paceScale;
    expect(one).toBeGreaterThan(four);
    expect(twenty).toBe(NIGHT.fastestScale);
  });
});

describe('pack mates', () => {
  it('start at their posts by the fire', () => {
    const s = quiet();
    expect(s.allies).toHaveLength(2);
    for (const a of s.allies) expect(Math.hypot(a.pos.x - WORLD.fire.x, a.pos.y - WORLD.fire.y)).toBeLessThan(250);
  });
  it('send a monster near camp home, even when the hero is away', () => {
    const s = quiet();
    s.hero.pos = { x: 768, y: 980 };
    monster(s, WORLD.fire.x - 160, WORLD.fire.y + 60, 'small');
    let attacked = false;
    for (let i = 0; i < 200 && !attacked; i++) attacked = stepNight(s, 0.05, idle).some((e) => e.type === 'allyAttack');
    expect(attacked).toBe(true);
    expect(s.bonks).toBe(1);
  });
  it('ignore monsters far from camp', () => {
    const s = quiet();
    monster(s, 60, 60, 'big').pos = { x: 60, y: 60 };
    const ev = stepNight(s, 0.05, idle);
    expect(ev.some((e) => e.type === 'allyAttack')).toBe(false);
  });
  it('only help a little: an empty camp still falls on a busy night', () => {
    const s = createNight({ ...loadout }, 5, 4);
    s.pet.cd = 1e9;
    s.hero.pos = { x: 768, y: 1000 };
    for (let i = 0; i < 3000 && s.outcome === 'playing'; i++) stepNight(s, 0.05, idle);
    expect(s.outcome).toBe('campFell');
  });
});

const right: Input = { move: { x: 1, y: 0 }, swing: false, shoot: null };
const left: Input = { move: { x: -1, y: 0 }, swing: false, shoot: null };
const up: Input = { move: { x: 0, y: -1 }, swing: false, shoot: null };
const down: Input = { move: { x: 0, y: 1 }, swing: false, shoot: null };

function walk(s: NightState, input: Input, seconds: number) {
  const events = [];
  for (let i = 0; i < seconds * 60; i++) events.push(...stepNight(s, 1 / 60, input));
  return events;
}

describe('the open world', () => {
  it('each wild area has open ground in the middle, and the dark between areas is not walkable', () => {
    for (const r of REGIONS) {
      const e = r.walk.ellipses[0];
      expect(isWalkable(toWorld(r, { x: e.x, y: e.y }))).toBe(true);
    }
    expect(isWalkable({ x: -800, y: -600 })).toBe(false); // the dark corner above Snow Land
    expect(regionAt({ x: -800, y: -600 })).toBe(null);
  });

  const trips: [string, Vec, Input, string][] = [
    ['Snow Land, down the left trail', { x: 200, y: 535 }, left, 'snow'],
    ['the Crystal Caves, down the right trail', { x: 1340, y: 535 }, right, 'cave'],
    ['the Mountains, up the top trail', { x: 815, y: 150 }, up, 'mountain'],
    ['the Old Forest, down the bottom trail', { x: 815, y: 880 }, down, 'forest'],
  ];
  for (const [name, start, input, region] of trips) {
    it(`the hero can walk from camp to ${name}`, () => {
      const s = quiet();
      s.hero.pos = { ...start };
      const events = walk(s, input, 2.5);
      expect(s.region).toBe(region);
      expect(events.some((e) => e.type === 'region' && e.region === region)).toBe(true);
    });
  }

  it('the hero bumps into a big rock out in the wild', () => {
    const cave = REGIONS.find((r) => r.id === 'cave')!;
    const rock = toWorld(cave, cave.obstacles[0]);
    const p = moveHero({ x: rock.x, y: rock.y + 140 }, { x: rock.x, y: rock.y + 20 }, HERO.radius);
    expect(Math.hypot(p.x - rock.x, p.y - rock.y)).toBeGreaterThanOrEqual(cave.obstacles[0].r + HERO.radius - 0.001);
  });

  it('the world is big enough for all five areas', () => {
    const b = worldBounds();
    expect(b.w).toBeGreaterThanOrEqual(1536 * 3);
    expect(b.h).toBeGreaterThanOrEqual(1024 * 3);
  });
});

describe('crystals in the wild', () => {
  it('are picked up by walking over them and add to the night\'s crystals', () => {
    const s = quiet();
    const c = s.crystals[0];
    s.hero.pos = { x: c.pos.x - CRYSTALS.pickupRadius + 5, y: c.pos.y };
    const events = walk(s, idle, 0.1);
    expect(c.taken).toBe(true);
    expect(s.crystalsFound).toBe(1);
    expect(events.filter((e) => e.type === 'crystal')).toHaveLength(1);
    // Standing there longer does not count it twice.
    walk(s, idle, 0.5);
    expect(s.crystalsFound).toBe(1);
    expect(nightRewards(s).crystals).toBe(1);
  });
  it('every wild area has some to find', () => {
    for (const r of REGIONS) expect(s0().crystals.filter((c) => c.region === r.id).length).toBeGreaterThanOrEqual(3);
  });
  it('sit on open ground the hero can reach', () => {
    for (const c of s0().crystals) expect(isWalkable(c.pos)).toBe(true);
  });
});

function s0() {
  return createNight({ ...loadout }, 3);
}

describe('wild monsters', () => {
  it('do not wait right at a trail entrance, so a hero arriving is not swarmed', () => {
    const entrances = [{ x: -20, y: 535 }, { x: 1556, y: 535 }, { x: 815, y: -20 }, { x: 815, y: 1044 }];
    for (const slot of s0().wild) for (const e of entrances) expect(Math.hypot(slot.home.x - e.x, slot.home.y - e.y)).toBeGreaterThan(WILD.chaseRange + 60);
  });
  it('appear in every area at the start of the night, and never go for the campfire', () => {
    const s = quiet();
    s.wild = s0().wild;
    walk(s, idle, 5);
    const wild = s.monsters.filter((m) => m.wild);
    expect(wild.length).toBe(s.wild.length);
    for (const r of REGIONS) expect(wild.some((m) => regionAt(m.pos) === r.id)).toBe(true);
    expect(s.campHealth).toBe(s.maxCampHealth);
  });
  it('live on open ground', () => {
    for (const slot of s0().wild) expect(isWalkable(slot.home)).toBe(true);
  });
  it('chase the hero who comes close', () => {
    const s = quiet();
    s.wild = s0().wild.slice(0, 1);
    walk(s, idle, 0.1);
    const m = s.monsters[0];
    s.hero.pos = { x: m.pos.x + WILD.chaseRange - 40, y: m.pos.y };
    s.hero.pos = isWalkable(s.hero.pos) ? s.hero.pos : { x: m.pos.x - WILD.chaseRange + 40, y: m.pos.y };
    const before = Math.hypot(m.pos.x - s.hero.pos.x, m.pos.y - s.hero.pos.y);
    walk(s, idle, 0.5);
    expect(Math.hypot(m.pos.x - s.hero.pos.x, m.pos.y - s.hero.pos.y)).toBeLessThan(before - 15);
  });
  it('come back a while after being sent home', () => {
    const s = quiet();
    s.wild = s0().wild.slice(0, 1);
    walk(s, idle, 0.1);
    const m = s.monsters[0];
    s.hero.pos = { x: m.pos.x - 60, y: m.pos.y };
    s.hero.facing = { x: 1, y: 0 };
    stepNight(s, 1 / 60, { ...idle, swing: true });
    expect(s.monsters.some((x) => x.wild)).toBe(m.hp > 0);
    if (m.hp > 0) return;
    s.hero.pos = { x: WORLD.heroStart.x, y: WORLD.heroStart.y };
    walk(s, idle, WILD.respawnSec - 1);
    expect(s.monsters.some((x) => x.wild)).toBe(false);
    walk(s, idle, 2);
    expect(s.monsters.some((x) => x.wild)).toBe(true);
  });
});

describe('the pack holds camp while the hero explores', () => {
  function raidersAfter(heroAt: Vec) {
    const s = createNight({ ...loadout }, 11);
    s.wild = [];
    s.pet.cd = 1e9;
    s.hero.pos = { ...heroAt };
    let raiders = 0;
    for (let i = 0; i < 60 * 60; i++) for (const e of stepNight(s, 1 / 60, idle)) if (e.type === 'spawn') raiders++;
    return raiders;
  }
  it('fewer monsters come to camp while the hero is away', () => {
    const snow = REGIONS.find((r) => r.id === 'snow')!;
    const home = raidersAfter(WORLD.heroStart);
    const out = raidersAfter(toWorld(snow, { x: 800, y: 500 }));
    expect(out).toBeLessThan(home);
    expect(out).toBeGreaterThan(0); // they still come, so camp still needs the hero
  });
  it('the night is long enough to explore', () => {
    expect(NIGHT.lengthSec).toBeGreaterThanOrEqual(120);
    expect(REWARDS.crystalsPerBonks).toBeGreaterThan(0);
  });
});
