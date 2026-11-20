// Every balance number lives here. No magic numbers anywhere else.

export const WORLD = {
  width: 1536,
  height: 1024,
  fire: { x: 768, y: 456, radius: 62 },
  // The open clearing the hero can walk in (an ellipse), plus the four trails.
  clearing: { x: 768, y: 470, rx: 560, ry: 360 },
  trails: [
    { x: 770, y: 0, w: 90, h: 260 }, // top
    { x: 0, y: 490, w: 300, h: 90 }, // left
    { x: 1236, y: 490, w: 300, h: 90 }, // right
    { x: 770, y: 764, w: 90, h: 260 }, // bottom
  ],
  // Things the hero bumps into (circles at their base).
  obstacles: [
    { x: 632, y: 228, r: 58 }, // tent, top
    { x: 500, y: 540, r: 62 }, // tent, left
    { x: 1092, y: 392, r: 60 }, // tent, right
    { x: 828, y: 362, r: 26 }, // log
    { x: 622, y: 498, r: 24 }, // log
    { x: 904, y: 540, r: 26 }, // log
    { x: 1072, y: 578, r: 34 }, // woodpile
  ],
  spawns: [
    { x: 815, y: -40 },
    { x: -40, y: 535 },
    { x: 1576, y: 535 },
    { x: 815, y: 1064 },
    { x: 200, y: 120 },
    { x: 1340, y: 140 },
    { x: 220, y: 920 },
    { x: 1330, y: 900 },
  ],
  heroStart: { x: 768, y: 600 },
} as const;

export const NIGHT = {
  // Long enough to run out and explore while the pack holds camp.
  lengthSec: 120,
  // Camp snacks, how fast monsters come and how tough they are change night by night: see LEVELS.
  // Seconds between monsters, from the start of the night to the end.
  spawnEverySec: { start: 3.6, end: 1.6 },
  smallChance: 0.4,
} as const;

// Every night is harder than the one before, until `hardestNight`. Each pair is { night 1, hardest night };
// nights in between slide evenly from one to the other.
export const LEVELS = {
  hardestNight: 12,
  campHealth: { first: 20, hardest: 14 },
  pace: { first: 1.6, hardest: 0.7 }, // multiplies the time between monsters: lower is busier
  monsterSpeed: { first: 1, hardest: 1.65 },
  extraHp: { first: 0, hardest: 3 }, // added to normal and big monsters (rounded down)
  bigChance: { first: 0.12, hardest: 0.4 },
  bigAfter: { first: 0.6, hardest: 0.1 }, // share of the night before big ones show up
  pairChance: { first: 0.2, hardest: 0.55 }, // two at once from different trails
  pairAfter: { first: 0.7, hardest: 0.25 },
  maxRaiders: { first: 4, hardest: 12 }, // most heading for camp at the same time
  awayGentler: { first: 1.3, hardest: 1 }, // while the hero explores, monsters come this much more slowly
  wildChase: { first: 210, hardest: 330 }, // how close wild monsters notice the hero
} as const;

// Each pack gives the hero a different strength.
export const PACK_PERKS = {
  foxPickupScale: 2.5, // Snow Fox Pack: crystals jump to you from farther away
  bunnyReloadScale: 0.65, // Bunny Pack: the bow or crossbow reloads faster
} as const;

export const HERO = {
  speed: 230,
  wolfPackSpeed: 265,
  radius: 22,
  dizzySec: 0.45,
} as const;

export const SWORD = {
  cooldownSec: 0.28,
  reach: 130,
  arcDeg: 170,
  damage: 2,
  knockback: 60,
} as const;

export const RANGED = {
  bow: { cooldownSec: 0.36, speed: 760, damage: 1, pierce: 0, life: 0.9 },
  crossbow: { cooldownSec: 0.7, speed: 980, damage: 2, pierce: 1, life: 0.9 },
} as const;

export const MONSTERS = {
  small: { hp: 1, speed: 70, radius: 18, scale: 0.32, campDamage: 1 },
  normal: { hp: 2, speed: 52, radius: 24, scale: 0.42, campDamage: 1 },
  big: { hp: 4, speed: 38, radius: 36, scale: 0.62, campDamage: 2 },
} as const;

export const PETS = {
  dragon: { range: 300, everySec: 1.2, damage: 1, slowSec: 2, slowFactor: 0.45, speed: 240 },
  wolf: { range: 340, everySec: 0.8, damage: 1, speed: 290 },
  owl: { range: 440, everySec: 1.5, damage: 2, speed: 340 },
  // The Dragon Pack makes every pet hit a little harder.
  dragonPackBonus: 1,
  followDistance: 70,
} as const;

// Pack mates guard the campfire. They help, but only a little: the hero is the main fighter.
export const ALLIES = {
  posts: [
    { x: 700, y: 560 },
    { x: 860, y: 380 },
  ],
  kinds: ['staff', 'shield'] as const,
  guardRadius: 340, // how far from the fire they go to meet a monster
  speed: 175,
  staff: { range: 270, everySec: 2.4, damage: 1 }, // a magic bolt, about every 2 seconds
  shield: { range: 64, everySec: 2.0, damage: 1 }, // a bonk with the club
} as const;

export const REWARDS = {
  crystalsPerBonks: 3, // one crystal for every 3 monsters sent home
  dragonPowerPerNight: 1,
  dragonPowerMax: 10,
} as const;

// ---------------------------------------------------------------------------
// The open world. The camp map sits at (0, 0). Four painted areas join it at its trails.
// Every area is 1536 x 1024; `offset` places its top-left corner in the world.
// Shapes inside an area use the area's own picture coordinates.

export type RegionId = 'camp' | 'snow' | 'forest' | 'cave' | 'mountain';
export interface Ellipse { x: number; y: number; rx: number; ry: number }
export interface Box { x: number; y: number; w: number; h: number }
export interface Circle { x: number; y: number; r: number }
export interface RegionLight { x: number; y: number; color: number; radius: number; intensity: number }
export interface Wanderer { x: number; y: number; size: 'small' | 'normal' | 'big'; fromNight?: number }
export interface Region {
  id: Exclude<RegionId, 'camp'>;
  image: string;
  offset: { x: number; y: number };
  ambient: number; // moonlight color while the hero is here
  tint: number; // monster color here
  walk: { ellipses: Ellipse[]; boxes: Box[] };
  obstacles: Circle[];
  lights: RegionLight[];
  crystals: { x: number; y: number }[];
  wanderers: Wanderer[];
}

export const TILE = { w: 1536, h: 1024 } as const;
export const CAMP_AMBIENT = 0x4a5384;

export const REGIONS: Region[] = [
  {
    id: 'snow', image: 'region-snow.jpg', offset: { x: -1536, y: 100 }, ambient: 0x7684b8, tint: 0xb9e2ff,
    walk: { ellipses: [{ x: 800, y: 500, rx: 640, ry: 330 }], boxes: [{ x: 1350, y: 380, w: 186, h: 100 }] },
    obstacles: [
      { x: 880, y: 330, r: 110 }, { x: 565, y: 235, r: 45 }, { x: 1045, y: 705, r: 70 },
      { x: 290, y: 500, r: 55 }, { x: 650, y: 640, r: 60 },
    ],
    lights: [
      { x: 965, y: 425, color: 0x7fc8ff, radius: 220, intensity: 1.3 },
      { x: 1150, y: 745, color: 0x7fc8ff, radius: 200, intensity: 1.1 },
      { x: 240, y: 760, color: 0x7fc8ff, radius: 200, intensity: 1.0 },
    ],
    crystals: [{ x: 470, y: 330 }, { x: 1180, y: 560 }, { x: 720, y: 770 }, { x: 400, y: 640 }, { x: 1180, y: 280 }],
    wanderers: [{ x: 600, y: 450, size: 'normal' }, { x: 400, y: 350, size: 'small' }, { x: 700, y: 250, size: 'small', fromNight: 3 }, { x: 1100, y: 450, size: 'big', fromNight: 6 }],
  },
  {
    id: 'forest', image: 'region-forest.jpg', offset: { x: 25, y: 1024 }, ambient: 0x3f5c6c, tint: 0xb6f5c8,
    walk: { ellipses: [{ x: 800, y: 450, rx: 560, ry: 380 }], boxes: [{ x: 740, y: 0, w: 120, h: 120 }] },
    obstacles: [
      { x: 500, y: 470, r: 120 }, { x: 490, y: 170, r: 100 }, { x: 1110, y: 290, r: 130 }, { x: 1090, y: 620, r: 100 },
    ],
    lights: [
      { x: 650, y: 210, color: 0x5fe0d0, radius: 190, intensity: 1.1 },
      { x: 990, y: 345, color: 0x7fb8ff, radius: 180, intensity: 1.0 },
      { x: 610, y: 580, color: 0x5fe0d0, radius: 180, intensity: 1.0 },
      { x: 1030, y: 715, color: 0x7fb8ff, radius: 180, intensity: 1.0 },
    ],
    crystals: [{ x: 700, y: 330 }, { x: 950, y: 500 }, { x: 360, y: 620 }, { x: 1250, y: 520 }, { x: 850, y: 780 }],
    wanderers: [{ x: 560, y: 720, size: 'small' }, { x: 1000, y: 450, size: 'normal' }, { x: 700, y: 700, size: 'normal', fromNight: 3 }, { x: 1250, y: 450, size: 'big', fromNight: 6 }],
  },
  {
    id: 'cave', image: 'region-cave.jpg', offset: { x: 1536, y: 85 }, ambient: 0x4a4274, tint: 0xd8b8ff,
    walk: {
      ellipses: [{ x: 760, y: 520, rx: 680, ry: 340 }, { x: 380, y: 190, rx: 110, ry: 90 }, { x: 1210, y: 200, rx: 110, ry: 90 }],
      boxes: [{ x: 0, y: 400, w: 160, h: 100 }],
    },
    obstacles: [
      { x: 545, y: 350, r: 85 }, { x: 980, y: 375, r: 55 }, { x: 150, y: 530, r: 45 }, { x: 930, y: 560, r: 50 }, { x: 690, y: 735, r: 50 },
    ],
    lights: [
      { x: 230, y: 120, color: 0xb070ff, radius: 240, intensity: 1.5 },
      { x: 560, y: 90, color: 0xb070ff, radius: 200, intensity: 1.3 },
      { x: 1000, y: 90, color: 0x50ff90, radius: 220, intensity: 1.3 },
      { x: 1300, y: 140, color: 0x50ff90, radius: 220, intensity: 1.3 },
      { x: 330, y: 660, color: 0xb070ff, radius: 200, intensity: 1.2 },
      { x: 1350, y: 770, color: 0x50ff90, radius: 220, intensity: 1.2 },
    ],
    crystals: [{ x: 330, y: 330 }, { x: 760, y: 620 }, { x: 1150, y: 450 }, { x: 1210, y: 250 }, { x: 520, y: 820 }],
    wanderers: [{ x: 700, y: 420, size: 'normal' }, { x: 650, y: 800, size: 'small' }, { x: 1100, y: 620, size: 'big', fromNight: 3 }, { x: 400, y: 620, size: 'normal', fromNight: 6 }],
  },
  {
    id: 'mountain', image: 'region-mountain.jpg', offset: { x: 65, y: -1024 }, ambient: 0x5a6a94, tint: 0xe0e6f8,
    walk: { ellipses: [{ x: 760, y: 600, rx: 620, ry: 400 }], boxes: [{ x: 700, y: 900, w: 120, h: 124 }] },
    obstacles: [
      { x: 980, y: 320, r: 70 }, { x: 1110, y: 330, r: 85 }, { x: 1250, y: 340, r: 85 }, { x: 1380, y: 330, r: 60 },
      { x: 430, y: 680, r: 65 }, { x: 890, y: 615, r: 45 }, { x: 755, y: 450, r: 55 }, { x: 540, y: 850, r: 65 }, { x: 640, y: 380, r: 50 },
    ],
    lights: [{ x: 1150, y: 330, color: 0x8fb8ff, radius: 280, intensity: 0.9 }],
    crystals: [{ x: 420, y: 450 }, { x: 1160, y: 520 }, { x: 620, y: 720 }, { x: 330, y: 860 }, { x: 1000, y: 800 }],
    wanderers: [{ x: 500, y: 500, size: 'normal' }, { x: 300, y: 700, size: 'small' }, { x: 1050, y: 600, size: 'big', fromNight: 3 }, { x: 1200, y: 800, size: 'normal', fromNight: 6 }],
  },
];

// Monsters that live out in the wild. They roam near home and chase the hero who comes close.
export const WILD = {
  leash: 420, // and give up when the hero is this far from their home
  roamRadius: 200,
  roamSpeed: 38,
  respawnSec: 40, // a wild monster sent home comes back after this long
} as const;

export const CRYSTALS = {
  pickupRadius: 48,
  arrowRadius: 46, // an arrow flying this close to a crystal picks it up
} as const;

// Friendly animals out in the wild. Give one a crystal and it follows you and helps until you go home.
export type AnimalKind = 'fox' | 'bunny' | 'cub' | 'bat' | 'goat' | 'penguin' | 'hedgehog' | 'mushroom';
export const ANIMAL_KINDS: AnimalKind[] = ['bunny', 'fox', 'mushroom', 'cub', 'bat', 'goat', 'penguin', 'hedgehog'];
export interface AnimalSpot { kind: AnimalKind; region: Exclude<RegionId, 'camp'>; x: number; y: number }
export const ANIMALS = {
  // Where each one lives, in its area's picture coordinates.
  spots: [
    { kind: 'fox', region: 'snow', x: 850, y: 560 },
    { kind: 'penguin', region: 'snow', x: 1150, y: 600 },
    { kind: 'bunny', region: 'forest', x: 760, y: 280 },
    { kind: 'cub', region: 'forest', x: 850, y: 620 },
    { kind: 'mushroom', region: 'forest', x: 620, y: 640 },
    { kind: 'bat', region: 'cave', x: 1050, y: 500 },
    { kind: 'hedgehog', region: 'cave', x: 380, y: 560 },
    { kind: 'goat', region: 'mountain', x: 880, y: 760 },
  ] as AnimalSpot[],
  maxFriends: 7,
  giveRange: 130, // stand this close to give a crystal
  roamRadius: 110,
  roamSpeed: 34,
  speed: 280, // keeping up with the hero
  followDistance: 95,
  // How each one helps. `reach` 0 means it attacks from where it is.
  fox: { range: 280, everySec: 0.9, damage: 1, reach: 26, push: 0, arrowSpeed: 0, scatter: 0 }, // quick nips
  bunny: { range: 420, everySec: 1.1, damage: 1, reach: 0, push: 0, arrowSpeed: 700, scatter: 0 }, // a bunny archer
  cub: { range: 240, everySec: 1.5, damage: 2, reach: 34, push: 0, arrowSpeed: 0, scatter: 0 }, // a big bear bonk
  bat: { range: 380, everySec: 1.2, damage: 1, reach: 0, push: 0, arrowSpeed: 0, scatter: 0 }, // swoops from the air
  goat: { range: 260, everySec: 1.3, damage: 1, reach: 30, push: 110, arrowSpeed: 0, scatter: 0 }, // head-butt
  penguin: { range: 300, everySec: 1.4, damage: 1, reach: 28, push: 60, arrowSpeed: 0, scatter: 0 }, // belly slide
  hedgehog: { range: 260, everySec: 1.6, damage: 2, reach: 28, push: 40, arrowSpeed: 0, scatter: 0 }, // spiky roll
  // A spell from its book: every monster near the target is knocked back and scattered.
  mushroom: { range: 340, everySec: 2.6, damage: 1, reach: 0, push: 170, arrowSpeed: 0, scatter: 230 },
} as const;

// Explore: no camp to guard. Monsters come out around the hero, more and more the longer you stay.
export const EXPLORE = {
  hardestAfterSec: 480, // reaches the hardest night's numbers after 8 minutes
  everySec: { first: 5, hardest: 1.6 },
  spawnFrom: 520, // monsters appear this far from the hero (off screen)
  spawnTo: 760,
  crystalBackSec: 45, // a picked crystal grows back after this long
} as const;
