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
  lengthSec: 90,
  campHealth: 12,
  // Night 1 is gentle. Each night after it brings monsters a bit faster, down to a floor.
  firstNightSlower: 1.4,
  slowerDropPerNight: 0.1,
  fastestScale: 0.85,
  // Seconds between monsters, from the start of the night to the end.
  spawnEverySec: { start: 2.4, end: 0.75 },
  // Late in the night, monsters sometimes come two at a time from different trails.
  pairAfter: 0.5,
  pairChance: 0.4,
  // Big monsters start showing up after this share of the night.
  bigAfter: 0.45,
  bigChance: 0.25,
  smallChance: 0.3,
} as const;

export const HERO = {
  speed: 230,
  wolfPackSpeed: 265,
  radius: 22,
  dizzySec: 0.7,
} as const;

export const SWORD = {
  cooldownSec: 0.35,
  reach: 105,
  arcDeg: 130,
  damage: 2,
  knockback: 60,
} as const;

export const RANGED = {
  bow: { cooldownSec: 0.42, speed: 760, damage: 1, pierce: 0, life: 0.9 },
  crossbow: { cooldownSec: 0.85, speed: 980, damage: 2, pierce: 1, life: 0.9 },
} as const;

export const MONSTERS = {
  small: { hp: 1, speed: 92, radius: 18, scale: 0.32, campDamage: 1 },
  normal: { hp: 2, speed: 68, radius: 24, scale: 0.42, campDamage: 1 },
  big: { hp: 5, speed: 46, radius: 36, scale: 0.62, campDamage: 2 },
} as const;

export const PETS = {
  dragon: { range: 270, everySec: 1.6, damage: 1, slowSec: 2, slowFactor: 0.45, speed: 240 },
  wolf: { range: 320, everySec: 1.0, damage: 1, speed: 290 },
  owl: { range: 420, everySec: 2.0, damage: 2, speed: 340 },
  // The Dragon Pack makes every pet hit a little harder.
  dragonPackBonus: 1,
  followDistance: 70,
} as const;

export const REWARDS = {
  crystalsPerBonks: 3, // one crystal for every 3 monsters sent home
  dragonPowerPerNight: 1,
  dragonPowerMax: 10,
} as const;
