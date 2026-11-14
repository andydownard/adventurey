import { HERO, MONSTERS, NIGHT, RANGED, SWORD, WORLD } from '../src/game/config';
import { createNight, nightRewards, spawnInterval, stepNight, swordTargets, type Input, type Loadout, type Monster, type NightState } from '../src/game/night';
import { makeRng } from '../src/game/rng';
import { isWalkable, moveHero } from '../src/game/world';

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
