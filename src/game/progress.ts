import { REWARDS } from './config';
import type { PackKind, PetKind, RangedKind } from './night';

// Everything is saved on this device only. Names never leave it.
export interface Progress {
  name: string;
  pet: PetKind;
  ranged: RangedKind;
  pack: PackKind;
  nightsSaved: number;
  crystals: number;
  dragonPower: number;
}

export const DEFAULT_PROGRESS: Progress = {
  name: '',
  pet: 'dragon',
  ranged: 'bow',
  pack: 'wolf',
  nightsSaved: 0,
  crystals: 0,
  dragonPower: 0,
};

const KEY = 'adventurey.progress';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PETS: PetKind[] = ['dragon', 'wolf', 'owl'];
const RANGED: RangedKind[] = ['bow', 'crossbow'];
const PACKS: PackKind[] = ['wolf', 'dragon'];

function count(v: unknown, max = 1e6) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
}

export function loadProgress(store: KeyValueStore | null | undefined): Progress {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const d = JSON.parse(raw) as Partial<Progress>;
    return {
      name: typeof d.name === 'string' ? d.name.slice(0, 12) : '',
      pet: PETS.includes(d.pet as PetKind) ? (d.pet as PetKind) : DEFAULT_PROGRESS.pet,
      ranged: RANGED.includes(d.ranged as RangedKind) ? (d.ranged as RangedKind) : DEFAULT_PROGRESS.ranged,
      pack: PACKS.includes(d.pack as PackKind) ? (d.pack as PackKind) : DEFAULT_PROGRESS.pack,
      nightsSaved: count(d.nightsSaved),
      crystals: count(d.crystals),
      dragonPower: count(d.dragonPower, REWARDS.dragonPowerMax),
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveProgress(store: KeyValueStore | null | undefined, p: Progress): boolean {
  try {
    store?.setItem(KEY, JSON.stringify(p));
    return !!store;
  } catch {
    return false;
  }
}

export function clearProgress(store: KeyValueStore | null | undefined) {
  try {
    store?.removeItem(KEY);
  } catch {
    /* storage can refuse; nothing else to do */
  }
}

export function applyNightResult(p: Progress, result: { crystals: number; dragonPower: number; saved: boolean }): Progress {
  return {
    ...p,
    nightsSaved: p.nightsSaved + (result.saved ? 1 : 0),
    crystals: p.crystals + result.crystals,
    dragonPower: Math.min(REWARDS.dragonPowerMax, p.dragonPower + result.dragonPower),
  };
}

/** The dragon's stage, from its power. */
export function dragonStage(power: number): 'Baby Dragon' | 'Young Dragon' | 'Big Dragon' {
  if (power >= REWARDS.dragonPowerMax) return 'Big Dragon';
  if (power >= 5) return 'Young Dragon';
  return 'Baby Dragon';
}
