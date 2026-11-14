import { readFileSync } from 'node:fs';
import { BANNED, COPY } from '../src/data/copy';
import { REWARDS } from '../src/game/config';
import { applyNightResult, DEFAULT_PROGRESS, dragonStage, loadProgress, saveProgress, type KeyValueStore } from '../src/game/progress';

function memory(): KeyValueStore & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k] };
}

describe('saving progress', () => {
  it('round-trips through storage', () => {
    const st = memory();
    const p = { ...DEFAULT_PROGRESS, name: 'Wolf', pet: 'owl' as const, crystals: 7 };
    expect(saveProgress(st, p)).toBe(true);
    expect(loadProgress(st)).toEqual(p);
  });
  it('still works when storage throws', () => {
    const broken: KeyValueStore = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    expect(loadProgress(broken)).toEqual(DEFAULT_PROGRESS);
    expect(saveProgress(broken, DEFAULT_PROGRESS)).toBe(false);
  });
  it('ignores junk and keeps names short', () => {
    const st = memory();
    st.setItem('adventurey.progress', JSON.stringify({ name: 'A very very long name', pet: 'unicorn', crystals: -4, dragonPower: 99 }));
    const p = loadProgress(st);
    expect(p.name.length).toBeLessThanOrEqual(12);
    expect(p.pet).toBe('dragon');
    expect(p.crystals).toBe(0);
    expect(p.dragonPower).toBe(REWARDS.dragonPowerMax);
  });
  it('adds a saved night, crystals and dragon power', () => {
    const p = applyNightResult(DEFAULT_PROGRESS, { crystals: 3, dragonPower: 1, saved: true });
    expect(p).toMatchObject({ nightsSaved: 1, crystals: 3, dragonPower: 1 });
    const lost = applyNightResult(p, { crystals: 1, dragonPower: 0, saved: false });
    expect(lost).toMatchObject({ nightsSaved: 1, crystals: 4, dragonPower: 1 });
  });
  it('the dragon grows with power', () => {
    expect(dragonStage(0)).toBe('Baby Dragon');
    expect(dragonStage(5)).toBe('Young Dragon');
    expect(dragonStage(10)).toBe('Big Dragon');
  });
});

describe('words on screen', () => {
  it('use no banned words', () => {
    const all = JSON.stringify(COPY).toLowerCase();
    for (const w of BANNED) expect(all).not.toMatch(new RegExp(`\\b${w}\\b`));
  });
  it('the screens get their words from COPY, not typed in place', () => {
    const ui = readFileSync('src/ui/screens.ts', 'utf8');
    expect(ui).not.toMatch(/You saved the camp/);
  });
});
