import { ANIMALS, ANIMAL_KINDS, REWARDS, type AnimalKind } from './config';
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
  /** Every animal friend collected so far: the pet box. */
  friends: AnimalKind[];
  /** The friends from the pet box who come along (up to 7). */
  team: AnimalKind[];
}

export const DEFAULT_PROGRESS: Progress = {
  name: '',
  pet: 'dragon',
  ranged: 'bow',
  pack: 'wolf',
  nightsSaved: 0,
  crystals: 0,
  dragonPower: 0,
  friends: [],
  team: [],
};

const KEY = 'adventurey.progress';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PETS: PetKind[] = ['dragon', 'wolf', 'owl'];
const RANGED: RangedKind[] = ['bow', 'crossbow'];
const PACKS: PackKind[] = ['wolf', 'dragon', 'fox', 'bunny'];

function animalList(v: unknown, allowed: AnimalKind[] = ANIMAL_KINDS): AnimalKind[] {
  return Array.isArray(v) ? [...new Set(v.filter((k): k is AnimalKind => allowed.includes(k as AnimalKind)))] : [];
}

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
      friends: animalList(d.friends),
      team: animalList(d.team, animalList(d.friends)).slice(0, ANIMALS.maxFriends),
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

export interface NightResult {
  crystals: number;
  dragonPower: number;
  saved: boolean;
  /** Crystals given to animals this night. */
  given?: number;
  /** Animals that became friends this night. */
  newFriends?: AnimalKind[];
}

export function applyNightResult(p: Progress, result: NightResult): Progress {
  const friends = [...new Set([...p.friends, ...(result.newFriends ?? [])])];
  const team = [...p.team];
  for (const k of result.newFriends ?? []) if (!team.includes(k) && team.length < ANIMALS.maxFriends) team.push(k);
  return {
    ...p,
    nightsSaved: p.nightsSaved + (result.saved ? 1 : 0),
    crystals: Math.max(0, p.crystals + result.crystals - (result.given ?? 0)),
    dragonPower: Math.min(REWARDS.dragonPowerMax, p.dragonPower + result.dragonPower),
    friends,
    team,
  };
}

/** Add or remove a friend from the team that comes along. At most 7 come. */
export function toggleTeam(p: Progress, kind: AnimalKind): Progress {
  if (!p.friends.includes(kind)) return p;
  if (p.team.includes(kind)) return { ...p, team: p.team.filter((k) => k !== kind) };
  if (p.team.length >= ANIMALS.maxFriends) return p;
  return { ...p, team: [...p.team, kind] };
}

/** The dragon's stage, from its power. */
export function dragonStage(power: number): 'Baby Dragon' | 'Young Dragon' | 'Big Dragon' {
  if (power >= REWARDS.dragonPowerMax) return 'Big Dragon';
  if (power >= 5) return 'Young Dragon';
  return 'Baby Dragon';
}
