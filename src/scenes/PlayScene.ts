import Phaser from 'phaser';
import { sound } from '../audio/sound';
import { COPY } from '../data/copy';
import { ANIMALS, CAMP_AMBIENT, MONSTERS, REGIONS, SWORD, TILE, WORLD, type AnimalKind, type RegionId } from '../game/config';
import { animalToBefriend, createNight, friendCount, headHome, newFriends, nightRewards, stepNight, type Crystal, type Input, type Loadout, type Mode, type MonsterSize, type NightEvent, type NightState } from '../game/night';
import type { Controls, Hud } from '../ui/hud';
import { regionById, toWorld, worldBounds } from '../game/world';

export interface PlayResult {
  mode: Mode;
  saved: boolean;
  bonks: number;
  crystals: number;
  given: number;
  dragonPower: number;
  newFriends: AnimalKind[];
}

export interface PlayInit {
  loadout: Loadout;
  nightNumber: number;
  seed: number;
  mode: Mode;
  /** Saved crystals, which can be given to animals. */
  gems: number;
  /** Friends from the pet box who come along. */
  friends: AnimalKind[];
  hud: Hud;
  controls: Controls;
  onEnd(result: PlayResult): void;
  onPauseKey(): void;
}

const STEP = 1 / 60;
const AMBIENT_NIGHT = CAMP_AMBIENT;
// Crystal colors in each wild area.
const GEM_TINT: Record<Exclude<RegionId, 'camp'>, number> = { snow: 0x9fe0ff, forest: 0x7ff0d8, cave: 0xd09cff, mountain: 0xf0f4ff };
// Walk-cycle sprite sheets (4 frames each). Hero and pack mates are drawn facing left; pets face right.
const SHEETS = {
  hero: { file: 'hero-walk.png', w: 135, h: 258, fps: 9, scale: 0.46, facesLeft: true },
  staff: { file: 'ally1-walk.png', w: 152, h: 248, fps: 8, scale: 0.43, facesLeft: true },
  shield: { file: 'ally2-walk.png', w: 123, h: 258, fps: 8, scale: 0.44, facesLeft: true },
  dragon: { file: 'dragon-walk.png', w: 215, h: 178, fps: 10, scale: 0.42, facesLeft: false },
  wolf: { file: 'pup-walk.png', w: 142, h: 168, fps: 11, scale: 0.42, facesLeft: false },
  owl: { file: 'owl-walk.png', w: 211, h: 198, fps: 8, scale: 0.36, facesLeft: false },
  // Animal friends, all drawn facing right.
  fox: { file: 'fox-walk.png', w: 211, h: 138, fps: 11, scale: 0.42, facesLeft: false },
  bunny: { file: 'bunny-walk.png', w: 114, h: 158, fps: 8, scale: 0.44, facesLeft: false },
  cub: { file: 'cub-walk.png', w: 194, h: 138, fps: 8, scale: 0.46, facesLeft: false },
  bat: { file: 'bat-walk.png', w: 160, h: 128, fps: 10, scale: 0.4, facesLeft: false },
  goat: { file: 'goat-walk.png', w: 155, h: 158, fps: 9, scale: 0.44, facesLeft: false },
  penguin: { file: 'penguin-walk.png', w: 100, h: 128, fps: 8, scale: 0.44, facesLeft: false },
  hedgehog: { file: 'hedgehog-walk.png', w: 122, h: 103, fps: 9, scale: 0.42, facesLeft: false },
  mushroom: { file: 'mushroom-walk.png', w: 97, h: 128, fps: 8, scale: 0.48, facesLeft: false },
} as const;
const TREE_SCALE = 1.25;
type SheetKey = keyof typeof SHEETS;
const SWING_SEC = 0.18;
const QUEUE_SEC = 0.9; // a tap during reload still fires if the bow is ready within this long (game time)
const SWORD_COOLDOWN = SWORD.cooldownSec;
const MONSTER_TINT: Record<MonsterSize, number> = { small: 0xb4cdf0, normal: 0xc4bce0, big: 0xd0bcf0 };

interface MonsterView { spr: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; size: MonsterSize; seed: number; tint: number; lastX: number }

export class PlayScene extends Phaser.Scene {
  private cfg!: PlayInit;
  private s!: NightState;
  private acc = 0;
  private running = false;
  private paused = false;
  private ending = false;
  private lit = false;

  private hero!: Phaser.GameObjects.Sprite;
  private heroShadow!: Phaser.GameObjects.Image;
  private pet!: Phaser.GameObjects.Sprite;
  private sword!: Phaser.GameObjects.Image;
  private allyViews: { spr: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image }[] = [];
  private animalViews = new Map<number, { spr: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Image; last: { x: number; y: number } }>();
  private giveTag!: Phaser.GameObjects.Text;
  private apples: Phaser.GameObjects.Image[] = [];
  private startFriends: AnimalKind[] = [];
  private lastPetPos = { x: 0, y: 0 };
  private petShadow!: Phaser.GameObjects.Image;
  private monsters = new Map<number, MonsterView>();
  private arrows = new Map<number, Phaser.GameObjects.Image>();
  private fireLight?: Phaser.GameObjects.Light;
  private heroLight?: Phaser.GameObjects.Light;
  private fx!: Record<'poof' | 'frost' | 'snack' | 'dust' | 'feather' | 'spark', Phaser.GameObjects.Particles.ParticleEmitter>;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private queuedShot: { x: number; y: number } | null = null;
  /** When the queued tap was made; a tap during reload waits this long, then fires. */
  private queuedAt = 0;
  private dizzyText?: Phaser.GameObjects.Text;
  private gems = new Map<number, { spr: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; seed: number }>();
  private staticLights = 0;
  private ambient = AMBIENT_NIGHT;
  private ambientTween?: Phaser.Tweens.Tween;
  private campPointer!: Phaser.GameObjects.Container;
  private seenGuardNote = false;
  /** -1 facing left, +1 facing right; it glides between them so the hero turns smoothly. */
  private turn = -1;
  private lastT = 0;
  private padStartWas = false;

  constructor() {
    super('play');
  }

  init(data: PlayInit) {
    this.cfg = data;
    this.s = createNight(data.loadout, data.seed, data.nightNumber, { mode: data.mode, gems: data.gems, friends: data.friends });
    this.startFriends = this.s.animals.filter((a) => a.friend).map((a) => a.kind);
    this.animalViews = new Map();
    this.apples = [];
    this.acc = 0;
    this.running = false;
    this.paused = false;
    this.ending = false;
    this.monsters = new Map();
    this.arrows = new Map();
    this.queuedShot = null;
    this.gems = new Map();
    this.ambient = AMBIENT_NIGHT;
    this.seenGuardNote = false;
  }

  preload() {
    this.load.image('map', 'art/camp-map.jpg');
    for (const r of REGIONS) this.load.image(`region-${r.id}`, `art/${r.image}`);
    this.load.image('gloom', 'art/sprite-gloom.png');
    this.load.image('tree', 'art/tree.png');
    this.load.image('apple', 'art/apple.png');
    for (const [key, sh] of Object.entries(SHEETS)) this.load.spritesheet(`sheet-${key}`, `art/${sh.file}`, { frameWidth: sh.w, frameHeight: sh.h });
  }

  /** Small textures drawn once in code: soft light dots, shadows, the sword swoosh, arrows, the vignette. */
  private makeTextures() {
    const canvas = (key: string, w: number, hgt: number, draw: (c: CanvasRenderingContext2D) => void) => {
      if (this.textures.exists(key)) return;
      const t = this.textures.createCanvas(key, w, hgt)!;
      draw(t.getContext());
      t.refresh();
    };
    canvas('soft', 64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
    });
    canvas('shadow', 128, 48, (c) => {
      const g = c.createRadialGradient(64, 24, 0, 64, 24, 64);
      g.addColorStop(0, 'rgba(0,0,8,.75)');
      g.addColorStop(0.6, 'rgba(0,0,8,.35)');
      g.addColorStop(1, 'rgba(0,0,8,0)');
      c.fillStyle = g;
      c.save();
      c.scale(1, 48 / 128);
      c.beginPath();
      c.arc(64, 64, 64, 0, Math.PI * 2);
      c.restore();
      c.fill();
    });
    canvas('slash', 160, 160, (c) => {
      c.translate(80, 80);
      const g = c.createLinearGradient(-70, 0, 70, 0);
      g.addColorStop(0, 'rgba(159,211,242,0)');
      g.addColorStop(0.5, 'rgba(232,246,255,.95)');
      g.addColorStop(1, 'rgba(182,245,200,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 70, -1.2, 1.2);
      c.arc(14, 0, 54, 1.1, -1.1, true);
      c.closePath();
      c.fill();
    });
    canvas('sword', 26, 120, (c) => {
      // Blade pointing up; the grip is at the bottom.
      const blade = c.createLinearGradient(6, 0, 20, 0);
      blade.addColorStop(0, '#9aa7c4');
      blade.addColorStop(0.5, '#f4f8ff');
      blade.addColorStop(1, '#8592b2');
      c.fillStyle = blade;
      c.beginPath(); c.moveTo(13, 0); c.lineTo(20, 12); c.lineTo(19, 86); c.lineTo(7, 86); c.lineTo(6, 12); c.closePath(); c.fill();
      c.fillStyle = '#c9a24a'; c.fillRect(0, 86, 26, 7);
      c.fillStyle = '#5a3b2a'; c.fillRect(9, 93, 8, 20);
      c.fillStyle = '#c9a24a'; c.beginPath(); c.arc(13, 115, 4, 0, Math.PI * 2); c.fill();
    });
    canvas('arrow', 64, 12, (c) => {
      c.fillStyle = '#c9a26a';
      c.fillRect(6, 5, 46, 2);
      c.fillStyle = '#e8eefc';
      c.beginPath(); c.moveTo(64, 6); c.lineTo(50, 1); c.lineTo(52, 6); c.lineTo(50, 11); c.closePath(); c.fill();
      c.fillStyle = '#c9b8f2';
      c.fillRect(0, 2, 10, 2); c.fillRect(0, 8, 10, 2);
    });
    canvas('gem', 64, 80, (c) => {
      // A small cluster of three crystals, white so it can be tinted per area.
      const shard = (x: number, w: number, hgt: number, lean: number) => {
        const g = c.createLinearGradient(x - w, 0, x + w, 0);
        g.addColorStop(0, 'rgba(200,210,255,.85)');
        g.addColorStop(0.5, 'rgba(255,255,255,1)');
        g.addColorStop(1, 'rgba(170,180,230,.85)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(x - w, 78); c.lineTo(x - w * 0.9 + lean, 78 - hgt * 0.75); c.lineTo(x + lean, 78 - hgt); c.lineTo(x + w * 0.9 + lean, 78 - hgt * 0.75); c.lineTo(x + w, 78);
        c.closePath(); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.5; c.stroke();
      };
      shard(18, 9, 44, -6);
      shard(46, 9, 40, 6);
      shard(32, 12, 72, 0);
    });
    canvas('pointer', 64, 64, (c) => {
      c.fillStyle = '#ffd9b0';
      c.strokeStyle = '#2a1c22';
      c.lineWidth = 4;
      c.beginPath(); c.moveTo(60, 32); c.lineTo(14, 10); c.lineTo(24, 32); c.lineTo(14, 54); c.closePath();
      c.stroke(); c.fill();
    });
    canvas('vignette', 1280, 800, (c) => {
      const g = c.createRadialGradient(640, 400, 260, 640, 400, 820);
      g.addColorStop(0, 'rgba(4,6,20,0)');
      g.addColorStop(1, 'rgba(4,6,20,.78)');
      c.fillStyle = g;
      c.fillRect(0, 0, 1280, 800);
    });
  }

  create() {
    this.makeTextures();
    for (const [key, sh] of Object.entries(SHEETS)) {
      if (this.anims.exists(`walk-${key}`)) continue;
      // The owl's first frame faces the other way, so its flap uses frames 1, 2, 3, 2.
      const frames = key === 'owl' ? [1, 2, 3, 2] : [0, 1, 2, 3];
      this.anims.create({ key: `walk-${key}`, frames: this.anims.generateFrameNumbers(`sheet-${key}`, { frames }), frameRate: sh.fps, repeat: -1 });
    }
    this.lit = this.renderer.type === Phaser.WEBGL;
    const lit = <T extends Phaser.GameObjects.Image>(o: T): T => (this.lit ? (o.setPipeline('Light2D') as T) : o);

    // The painted camp in the middle, with the four wild areas around it, lit by moonlight and the fire.
    lit(this.add.image(0, 0, 'map').setOrigin(0, 0).setDepth(-10000));
    for (const r of REGIONS) lit(this.add.image(r.offset.x, r.offset.y, `region-${r.id}`).setOrigin(0, 0).setDepth(-10000));
    if (this.lit) {
      this.lights.enable().setAmbientColor(AMBIENT_NIGHT);
      // The magic tree glows a warm gold.
      this.fireLight = this.lights.addLight(WORLD.fire.x, WORLD.fire.y - 60, 480, 0xffd98a, 1.9);
      this.heroLight = this.lights.addLight(0, 0, 230, 0xb8d4ff, 0.85);
      // Glowing ice, mushrooms and cave crystals.
      for (const r of REGIONS) for (const l of r.lights) { const p = toWorld(r, l); this.lights.addLight(p.x, p.y, l.radius, l.color, l.intensity); }
      this.staticLights = this.lights.getLightCount();
    }
    this.cameras.main.setBackgroundColor('#02030a');
    this.wildWeather();

    // Crystals to find out in the wild.
    for (const c of this.s.crystals) this.addGem(c);

    // The magic tree, with one golden apple for every apple left to guard.
    const tx = WORLD.fire.x;
    const ty = WORLD.fire.y + 70;
    lit(this.add.image(tx, ty, 'tree').setOrigin(0.5, 0.92).setScale(TREE_SCALE).setDepth(ty));
    const canopy = { x: tx, y: ty - 300 * 0.92 * TREE_SCALE + 92 * TREE_SCALE, rx: 74 * TREE_SCALE, ry: 50 * TREE_SCALE };
    for (let i = 0; i < this.s.maxCampHealth; i++) {
      const ang = i * 2.399963; // spread evenly, like seeds in a sunflower
      const r = Math.sqrt((i + 0.6) / this.s.maxCampHealth);
      const ax = canopy.x + Math.cos(ang) * r * canopy.rx;
      const ay = canopy.y + Math.sin(ang) * r * canopy.ry;
      this.apples.push(this.add.image(ax, ay, 'apple').setScale(0.36).setDepth(ty + 2));
    }
    this.add.particles(tx, ty - 200, 'soft', {
      x: { min: -130, max: 130 }, y: { min: -90, max: 120 }, speedY: { min: -20, max: -6 }, speedX: { min: -8, max: 8 },
      scale: { start: 0.12, end: 0 }, lifespan: 2400, frequency: 90, blendMode: 'ADD', tint: [0xffe08a, 0xb6f5c8],
    }).setDepth(ty + 3);

    // Fireflies drifting over the clearing.
    this.add.particles(0, 0, 'soft', {
      x: { min: 120, max: 1420 }, y: { min: 140, max: 920 }, speedX: { min: -14, max: 14 }, speedY: { min: -12, max: 10 },
      scale: 0.14, lifespan: 4200, frequency: 140, blendMode: 'ADD', tint: 0xd8ffe4,
      alpha: { onUpdate: (_p: unknown, _k: string, t: number) => Math.sin(Math.PI * t) },
    }).setDepth(5000);

    // Burst effects, fired on events.
    const burst = (tint: number | number[], extra: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {}) =>
      this.add.particles(0, 0, 'soft', { emitting: false, speed: { min: 60, max: 220 }, scale: { start: 0.45, end: 0 }, alpha: { start: 1, end: 0 }, lifespan: 600, blendMode: 'ADD', tint, ...extra }).setDepth(6000);
    this.fx = {
      poof: burst([0xc9b8f2, 0xb6f5c8, 0x8a6fd1], { speed: { min: 40, max: 170 }, scale: { start: 0.24, end: 0 }, lifespan: 650 }),
      frost: burst([0x7fc8ff, 0xcfeaff], { speed: { min: 10, max: 50 }, scale: { start: 0.17, end: 0 }, alpha: { start: 0.8, end: 0 }, lifespan: 420 }),
      snack: burst([0xffb86b, 0xffe08a], { speed: { min: 80, max: 260 } }),
      dust: burst(0xb8a890, { blendMode: 'NORMAL', alpha: { start: 0.6, end: 0 }, speed: { min: 30, max: 110 }, lifespan: 500 }),
      feather: burst(0xffffff, { blendMode: 'NORMAL', speed: { min: 40, max: 140 }, gravityY: 120, scale: { start: 0.22, end: 0.1 }, lifespan: 900 }),
      spark: burst([0xe8f6ff, 0xb6f5c8], { speed: { min: 100, max: 260 }, scale: { start: 0.14, end: 0 }, lifespan: 300 }),
    };

    // Hero and pet, each with a soft shadow on the ground.
    const sheetSprite = (key: SheetKey, x: number, y: number) =>
      lit(this.add.sprite(x, y, `sheet-${key}`, 0).setOrigin(0.5, 0.97).setScale(SHEETS[key].scale));
    this.heroShadow = this.add.image(0, 0, 'shadow').setScale(0.62, 0.7).setAlpha(0.7);
    this.hero = sheetSprite('hero', this.s.hero.pos.x, this.s.hero.pos.y);
    this.sword = lit(this.add.image(0, 0, 'sword').setOrigin(0.5, 0.86).setScale(0.62));
    const petKind = this.cfg.loadout.pet;
    this.petShadow = this.add.image(0, 0, 'shadow').setScale(0.6, 0.6).setAlpha(0.6);
    this.pet = sheetSprite(petKind, this.s.pet.pos.x, this.s.pet.pos.y);
    if (petKind === 'owl') this.pet.setOrigin(0.5, 0.5).play('walk-owl');
    this.lastPetPos = { ...this.s.pet.pos };
    this.allyViews = this.s.allies.map((a) => ({
      shadow: this.add.image(a.pos.x, a.pos.y, 'shadow').setScale(0.58, 0.66).setAlpha(0.65),
      spr: sheetSprite(a.kind, a.pos.x, a.pos.y),
    }));
    // Animals: wild ones roam their areas; friends wear a soft green ring.
    for (const a of this.s.animals) {
      const spr = sheetSprite(a.kind, a.pos.x, a.pos.y);
      if (a.kind === 'bat') spr.setOrigin(0.5, 0.5);
      this.animalViews.set(a.id, {
        spr,
        shadow: this.add.image(a.pos.x, a.pos.y, 'shadow').setScale(0.45, 0.5).setAlpha(0.6),
        ring: this.add.image(a.pos.x, a.pos.y, 'soft').setBlendMode(Phaser.BlendModes.ADD).setTint(0x8ef0b0).setScale(1.1, 0.4).setAlpha(0),
        last: { ...a.pos },
      });
    }
    this.giveTag = this.add.text(0, 0, COPY.hud.give, { fontFamily: 'Nunito', fontStyle: '800', fontSize: '20px', color: '#060914', backgroundColor: '#b6f5c8', padding: { x: 12, y: 6 } })
      .setOrigin(0.5, 1).setDepth(7200).setVisible(false);

    this.add.image(0, 0, 'vignette').setOrigin(0, 0).setScrollFactor(0).setDepth(100000);

    // An arrow at the screen edge that points home when camp is out of sight.
    this.campPointer = this.add.container(0, 0, [
      this.add.image(0, 0, 'pointer').setScale(0.8),
      this.add.text(0, 34, COPY.campArrow, { fontFamily: 'Nunito', fontStyle: '800', fontSize: '18px', color: '#ffd9b0', stroke: '#0b1028', strokeThickness: 5 }).setOrigin(0.5),
    ]).setScrollFactor(0).setDepth(100001).setVisible(false);

    const cam = this.cameras.main;
    const wb = worldBounds();
    cam.setBounds(wb.x, wb.y, wb.w, wb.h);
    cam.startFollow(this.hero, true, 0.08, 0.08);
    cam.setFollowOffset(0, 70); // show a bit more above the hero, so tall things like the tree fit
    cam.fadeIn(600, 4, 6, 20);

    // Keyboard and mouse.
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,K,E,ESC,P') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-ESC', () => this.cfg.onPauseKey());
    this.input.keyboard!.on('keydown-P', () => this.cfg.onPauseKey());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const wp = cam.getWorldPoint(p.x, p.y);
      this.queuedShot = { x: wp.x, y: wp.y };
      this.queuedAt = this.s.t;
      this.markTap(wp.x, wp.y);
    });

    this.syncViews(0);
    this.cfg.hud.update(this.s);
  }

  begin() {
    this.running = true;
    sound.startAmbient();
  }

  /** For automated checks only: run the night forward quickly with a simple input. */
  advance(seconds: number, input: Input = { move: { x: 0, y: 0 }, swing: false, shoot: null }) {
    for (let i = 0; i < Math.round(seconds / STEP) && !this.ending; i++) this.handle(stepNight(this.s, STEP, input));
    this.cfg.hud.update(this.s);
  }
  setPaused(p: boolean) {
    this.paused = p;
    sound.pause(p);
  }

  shutdownSound() {
    sound.stopAmbient();
  }

  private readInput(): Input {
    const k = this.keys;
    let x = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let y = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (x === 0 && y === 0) ({ x, y } = this.cfg.controls.move);
    // A game controller works too: left stick or pad to walk, A (or RB) to swing, X (or RT) to shoot.
    const pad = navigator.getGamepads?.().find((g) => g && g.connected) ?? null;
    let padSwing = false;
    let padShoot = false;
    let padGive = false;
    if (pad) {
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      const btn = (i: number) => !!pad.buttons[i]?.pressed;
      if (x === 0 && y === 0) {
        if (Math.hypot(ax, ay) > 0.2) ({ x, y } = { x: ax, y: ay });
        else ({ x, y } = { x: (btn(15) ? 1 : 0) - (btn(14) ? 1 : 0), y: (btn(13) ? 1 : 0) - (btn(12) ? 1 : 0) });
      }
      padSwing = btn(0) || btn(5);
      padShoot = btn(2) || btn(7);
      padGive = btn(3);
      if (btn(9) && !this.padStartWas) this.cfg.onPauseKey();
      this.padStartWas = btn(9);
    }
    let shoot = this.queuedShot;
    const p = this.input.activePointer;
    if (!shoot && p.isDown && !p.wasTouch) {
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      shoot = { x: wp.x, y: wp.y };
    }
    if (!shoot && (k.K.isDown || padShoot)) {
      const f = this.s.hero.facing;
      shoot = { x: this.s.hero.pos.x + f.x * 300, y: this.s.hero.pos.y - 30 + f.y * 300 };
    }
    const tapped = !!this.cfg.controls.swingTap;
    this.cfg.controls.swingTap = false;
    const give = !!this.cfg.controls.giveTap || k.E.isDown || padGive;
    this.cfg.controls.giveTap = false;
    return { move: { x, y }, swing: k.SPACE.isDown || k.J.isDown || this.cfg.controls.swing || tapped || padSwing, shoot, give };
  }

  update(time: number, delta: number) {
    const t = time / 1000;
    if (this.fireLight) {
      this.fireLight.intensity = 1.8 + Math.sin(t * 1.6) * 0.15;
      this.fireLight.radius = 470 + Math.sin(t * 1.1) * 12;
    }
    if (this.running && !this.paused && !this.ending) {
      this.acc = Math.min(0.25, this.acc + delta / 1000);
      while (this.acc >= STEP && !this.ending) {
        this.acc -= STEP;
        const input = this.readInput();
        const events = stepNight(this.s, STEP, input);
        // Keep a tap made during reload until the shot goes out, so no tap is wasted.
        if (events.some((e) => e.type === 'shoot') || this.s.t - this.queuedAt > QUEUE_SEC) this.queuedShot = null;
        this.handle(events);
      }
      this.cfg.hud.update(this.s);
    }
    this.syncViews(t);
  }

  /** A little ring where the player tapped, so they see where the shot will go. */
  private markTap(x: number, y: number) {
    const ring = this.add.circle(x, y, 20).setStrokeStyle(4, 0xffd9b0, 0.95).setDepth(7500);
    this.tweens.add({ targets: ring, scale: 1.6, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }

  private floatText(x: number, y: number, text: string, color = '#ffffff', size = 26) {
    const tx = this.add.text(x, y, text, { fontFamily: 'Nunito', fontStyle: '800', fontSize: `${size}px`, color, stroke: '#0b1028', strokeThickness: 6 })
      .setOrigin(0.5).setDepth(7000);
    this.tweens.add({ targets: tx, y: y - 50, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => tx.destroy() });
  }

  private flash(x: number, y: number, color: number, radius = 160, intensity = 1.6) {
    if (!this.lit || this.lights.getLightCount() > this.staticLights + 5) return;
    const light = this.lights.addLight(x, y, radius, color, intensity);
    this.tweens.add({ targets: light, intensity: 0, duration: 380, onComplete: () => this.lights.removeLight(light) });
  }

  private handle(events: NightEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'spawn': {
          const st = MONSTERS[e.size];
          const shadow = this.add.image(e.at.x, e.at.y, 'shadow').setScale(st.scale * 1.5, st.scale * 1.4).setAlpha(0);
          const wild = this.s.monsters.find((m) => m.id === e.id)?.wild;
          const tint = wild ? regionById(this.s.wild[wild.slot].region)!.tint : MONSTER_TINT[e.size];
          const spr = this.add.image(e.at.x, e.at.y, 'gloom').setOrigin(0.5, 0.92).setScale(st.scale * 0.2).setAlpha(0).setTint(tint);
          // Monsters stay unlit on purpose, so kids can always spot them in the dark woods.
          const glow = this.add.image(e.at.x, e.at.y, 'soft').setBlendMode(Phaser.BlendModes.ADD).setTint(0xc9b8f2).setScale(st.scale * 1.9, st.scale * 1.1).setAlpha(0);
          this.tweens.add({ targets: spr, scale: st.scale, alpha: 1, duration: 500, ease: 'Back.easeOut' });
          this.tweens.add({ targets: shadow, alpha: 0.75, duration: 500 });
          this.tweens.add({ targets: glow, alpha: 0.95, duration: 500 });
          this.monsters.set(e.id, { spr, shadow, glow, size: e.size, seed: e.id * 1.7, tint, lastX: e.at.x });
          if (Math.hypot(e.at.x - this.s.hero.pos.x, e.at.y - this.s.hero.pos.y) < 700) sound.play('spawn');
          break;
        }
        case 'shoot':
          sound.play(this.cfg.loadout.ranged === 'crossbow' ? 'crossbow' : 'bow');
          break;
        case 'swing': {
          sound.play('swing');
          const ang = Math.atan2(e.dir.y, e.dir.x);
          const sl = this.add.image(e.at.x + e.dir.x * 50, e.at.y - 34 + e.dir.y * 40, 'slash').setRotation(ang)
            .setBlendMode(Phaser.BlendModes.ADD).setScale(0.8).setDepth(e.at.y + 40);
          this.tweens.add({ targets: sl, scale: 1.35, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => sl.destroy() });
          this.tweens.add({ targets: this.hero, angle: { from: -8 * Math.sign(e.dir.x || 1), to: 0 }, duration: 180 });
          break;
        }
        case 'hit': {
          this.fx.spark.explode(e.by === 'sword' ? 8 : 4, e.at.x, e.at.y - 30);
          const hv = this.monsters.get(e.id);
          if (hv) {
            const sc = MONSTERS[hv.size].scale;
            this.tweens.add({ targets: hv.spr, scaleX: sc * 1.25, scaleY: sc * 0.78, duration: 70, yoyo: true, onComplete: () => hv.spr.setScale(sc) });
          }
          if (e.by === 'sword') this.floatText(e.at.x, e.at.y - 80, COPY.bonk, '#b6f5c8', 24);
          sound.play(e.by === 'sword' ? 'bonk' : 'hit');
          break;
        }
        case 'poof': {
          const v = this.monsters.get(e.id);
          const n = e.size === 'big' ? 40 : e.size === 'small' ? 14 : 24;
          this.fx.poof.explode(n, e.at.x, e.at.y - 30);
          sound.play(e.size === 'big' ? 'bigPoof' : 'poof');
          this.flash(e.at.x, e.at.y - 30, 0xc9b8f2, 110, 0.8);
          if (e.size === 'big') this.floatText(e.at.x, e.at.y - 110, COPY.poof, '#c9b8f2', 30);
          if (v) {
            this.monsters.delete(e.id);
            this.tweens.add({ targets: [v.spr, v.glow, v.shadow], alpha: 0, scale: 0.01, duration: 260, onComplete: () => { v.spr.destroy(); v.glow.destroy(); v.shadow.destroy(); } });
          }
          break;
        }
        case 'snack': {
          const v = this.monsters.get(e.id);
          this.fx.snack.explode(20, e.at.x, e.at.y - 20);
          sound.play('snack');
          this.floatText(WORLD.fire.x, WORLD.fire.y - 120, COPY.snack, '#ffd9b0', 24);
          // Apples drop off the tree and the monster runs off with them.
          for (let i = this.apples.length - 1; i >= e.campHealth; i--) {
            const ap = this.apples[i];
            if (!ap.visible || ap.getData('gone')) continue;
            ap.setData('gone', true);
            this.tweens.add({ targets: ap, x: e.at.x, y: e.at.y - 40, scale: 0.3, duration: 420, ease: 'Quad.easeIn', onComplete: () => ap.setVisible(false) });
          }
          this.cameras.main.shake(140, 0.004);
          this.cfg.hud.flashCamp();
          if (v) {
            this.monsters.delete(e.id);
            // The monster grabs a snack and scurries back to the woods.
            const away = { x: e.at.x + (e.at.x - WORLD.fire.x) * 4, y: e.at.y + (e.at.y - WORLD.fire.y) * 4 };
            const held = this.add.image(e.at.x, e.at.y - 50, 'apple').setScale(0.36).setDepth(e.at.y + 5);
            this.tweens.add({ targets: held, x: away.x, y: away.y - 50, alpha: 0, duration: 900, onComplete: () => held.destroy() });
            this.tweens.add({ targets: [v.spr, v.glow, v.shadow], x: away.x, y: away.y, alpha: 0, duration: 900, onComplete: () => { v.spr.destroy(); v.glow.destroy(); v.shadow.destroy(); } });
          }
          break;
        }
        case 'dizzy': {
          this.floatText(e.at.x, e.at.y - 130, COPY.dizzy, '#ffe08a', 24);
          sound.play('dizzy');
          this.cameras.main.shake(100, 0.003);
          break;
        }
        case 'allyAttack': {
          sound.play(e.kind === 'staff' ? 'staff' : 'bonk');
          const av = this.allyViews[this.s.allies.findIndex((x) => x.kind === e.kind)];
          if (av) this.tweens.add({ targets: av.spr, y: av.spr.y - 14, duration: 90, yoyo: true });
          if (e.kind === 'staff') {
            for (let i = 1; i <= 8; i++) {
              const k = i / 8;
              this.time.delayedCall(i * 22, () => this.fx.spark.explode(2, e.from.x + (e.to.x - e.from.x) * k, e.from.y - 70 + (e.to.y - 30 - (e.from.y - 70)) * k));
            }
            this.flash(e.to.x, e.to.y - 30, 0x7fc8ff, 110, 0.9);
          } else {
            this.fx.dust.explode(8, e.to.x, e.to.y);
          }
          break;
        }
        case 'petAttack': {
          sound.play(e.kind === 'dragon' ? 'frost' : e.kind === 'wolf' ? 'yip' : 'hoot');
          if (e.kind === 'dragon') {
            for (let i = 1; i <= 10; i++) {
              const k = i / 10;
              this.time.delayedCall(i * 18, () => this.fx.frost.explode(3, e.from.x + (e.to.x - e.from.x) * k + 20, e.from.y - 40 + (e.to.y - 30 - (e.from.y - 40)) * k));
            }
            this.flash(e.to.x, e.to.y - 30, 0x9fd3f2, 140, 1.0);
          } else if (e.kind === 'wolf') {
            this.fx.dust.explode(10, e.to.x, e.to.y);
          } else {
            this.fx.feather.explode(10, e.to.x, e.to.y - 40);
          }
          break;
        }
        case 'befriend': {
          const v = this.animalViews.get(e.id);
          this.fx.spark.explode(26, e.at.x, e.at.y - 40);
          this.flash(e.at.x, e.at.y - 30, 0xb6f5c8, 180, 1.4);
          sound.play('chime');
          this.floatText(e.at.x, e.at.y - 110, COPY.newFriend, '#b6f5c8', 30);
          if (v) this.tweens.add({ targets: v.spr, y: v.spr.y - 40, duration: 220, yoyo: true, ease: 'Quad.easeOut' });
          break;
        }
        case 'needCrystal':
          this.floatText(e.at.x, e.at.y - 100, friendCount(this.s) >= ANIMALS.maxFriends ? COPY.tooManyFriends : COPY.needCrystal, '#ffe08a', 22);
          break;
        case 'bonusCrystal':
          this.floatText(e.at.x, e.at.y - 130, COPY.crystalBonus, '#d8c8ff', 22);
          break;
        case 'crystalBack': {
          const c = this.s.crystals.find((x) => x.id === e.id);
          if (c) this.addGem(c);
          break;
        }
        case 'animalAttack': {
          const v = this.animalViews.get(e.id);
          if (v && e.kind !== 'bat' && e.kind !== 'bunny' && e.kind !== 'mushroom') this.tweens.add({ targets: v.spr, angle: { from: e.to.x > e.from.x ? 18 : -18, to: 0 }, duration: 200 });
          if (e.kind === 'mushroom') {
            // A purple spell ring bursts out and scatters the monsters.
            sound.play('staff');
            const ring = this.add.circle(e.to.x, e.to.y - 20, 30).setStrokeStyle(8, 0xc89bff, 0.95).setDepth(e.to.y + 50);
            this.tweens.add({ targets: ring, scale: 7, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
            this.flash(e.to.x, e.to.y - 20, 0xc89bff, 240, 1.4);
            for (let i = 1; i <= 8; i++) {
              const k = i / 8;
              this.time.delayedCall(i * 20, () => this.fx.spark.explode(2, e.from.x + (e.to.x - e.from.x) * k, e.from.y - 50 + (e.to.y - e.from.y) * k));
            }
          } else if (e.kind === 'bunny') {
            sound.play('bow');
          } else if (e.kind === 'bat') {
            sound.play('hoot');
            this.fx.feather.explode(6, e.to.x, e.to.y - 40);
          } else {
            sound.play(e.kind === 'fox' ? 'yip' : 'bonk');
            this.fx.dust.explode(10, e.to.x, e.to.y);
          }
          break;
        }
        case 'crystal': {
          const g = this.gems.get(e.id);
          this.fx.spark.explode(18, e.at.x, e.at.y - 30);
          this.flash(e.at.x, e.at.y - 30, 0xd8c8ff, 160, 1.2);
          sound.play('chime');
          this.floatText(e.at.x, e.at.y - 90, COPY.crystalPlus, '#d8c8ff', 26);
          if (g) {
            this.gems.delete(e.id);
            this.tweens.add({ targets: g.spr, y: g.spr.y - 60, alpha: 0, scale: 0.9, duration: 500, ease: 'Cubic.easeOut', onComplete: () => g.spr.destroy() });
            this.tweens.add({ targets: g.glow, alpha: 0, duration: 400, onComplete: () => g.glow.destroy() });
          }
          break;
        }
        case 'region': {
          const info = COPY.regions[e.region];
          const out = e.region !== 'camp';
          this.cfg.hud.banner(info.name, out && !this.seenGuardNote && this.s.mode === 'camp' ? COPY.packGuarding : info.line);
          if (out) this.seenGuardNote = true;
          sound.play('whoosh');
          this.fadeAmbient(out ? regionById(e.region)!.ambient : AMBIENT_NIGHT);
          break;
        }
        case 'sunrise':
          this.finish('sunrise');
          break;
        case 'campFell':
          this.finish('fell');
          break;
        default:
          break;
      }
    }
  }

  /** Explore: go home now with what you found. */
  goHome() {
    if (this.ending || this.s.mode !== 'explore') return;
    headHome(this.s);
    this.finish('home');
  }

  private finish(how: 'sunrise' | 'fell' | 'home') {
    if (this.ending) return;
    this.ending = true;
    const saved = how !== 'fell';
    sound.stopAmbient();
    sound.play(saved ? 'sunrise' : 'campFell');
    const r = nightRewards(this.s);
    const done = () => this.cfg.onEnd({
      mode: this.s.mode, saved: how === 'sunrise', bonks: this.s.bonks, crystals: r.crystals, given: r.given,
      dragonPower: r.dragonPower, newFriends: newFriends(this.s, this.startFriends),
    });
    if (how === 'sunrise' && this.lit) {
      this.ambientTween?.stop();
      const from = Phaser.Display.Color.ValueToColor(this.ambient);
      const to = Phaser.Display.Color.ValueToColor(0xffd2b0);
      this.tweens.addCounter({
        from: 0, to: 100, duration: 2200,
        onUpdate: (tw) => {
          const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, tw.getValue() ?? 0);
          this.lights.setAmbientColor(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
        },
      });
      this.time.delayedCall(2400, () => { this.cameras.main.fadeOut(700, 255, 233, 210); });
      this.time.delayedCall(3200, done);
    } else {
      this.cameras.main.fadeOut(1400, 4, 6, 20);
      this.time.delayedCall(1500, done);
    }
  }

  private addGem(c: Crystal) {
    const tint = GEM_TINT[c.region];
    const glow = this.add.image(c.pos.x, c.pos.y - 18, 'soft').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(1.5, 1.1).setAlpha(0.8).setDepth(c.pos.y - 1);
    const spr = this.add.image(c.pos.x, c.pos.y, 'gem').setOrigin(0.5, 1).setTint(tint).setScale(0.62).setDepth(c.pos.y);
    this.gems.set(c.id, { spr, glow, seed: c.id * 2.3 });
  }

  /** Falling snow, drifting cave sparkles and forest fireflies, each only in its own area. */
  private wildWeather() {
    const area = (id: RegionId, pad = 120) => {
      const r = regionById(id)!;
      return { x: { min: r.offset.x + pad, max: r.offset.x + TILE.w - pad }, y: { min: r.offset.y + pad, max: r.offset.y + TILE.h - pad } };
    };
    const twinkle = { onUpdate: (_p: unknown, _k: string, t: number) => Math.sin(Math.PI * t) };
    this.add.particles(0, 0, 'soft', { ...area('snow', 40), speedY: { min: 30, max: 60 }, speedX: { min: -20, max: 10 }, scale: { min: 0.05, max: 0.11 }, lifespan: 5000, frequency: 40, tint: 0xeef6ff, alpha: twinkle }).setDepth(5000);
    this.add.particles(0, 0, 'soft', { ...area('cave'), speedY: { min: -18, max: -6 }, speedX: { min: -8, max: 8 }, scale: 0.1, lifespan: 4000, frequency: 160, blendMode: 'ADD', tint: [0xd09cff, 0x7fffb0], alpha: twinkle }).setDepth(5000);
    this.add.particles(0, 0, 'soft', { ...area('forest'), speedX: { min: -14, max: 14 }, speedY: { min: -12, max: 10 }, scale: 0.13, lifespan: 4200, frequency: 150, blendMode: 'ADD', tint: 0xd8ffe4, alpha: twinkle }).setDepth(5000);
  }

  private fadeAmbient(to: number) {
    if (!this.lit) return;
    this.ambientTween?.stop();
    const from = Phaser.Display.Color.ValueToColor(this.ambient);
    const target = Phaser.Display.Color.ValueToColor(to);
    this.ambient = to;
    this.ambientTween = this.tweens.addCounter({
      from: 0, to: 100, duration: 1200,
      onUpdate: (tw) => {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, target, 100, tw.getValue() ?? 0);
        this.lights.setAmbientColor(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      },
    });
  }

  /** Point to camp from the edge of the screen while camp is out of sight. */
  private pointHome() {
    const cam = this.cameras.main;
    const fx = WORLD.fire.x - cam.scrollX;
    const fy = WORLD.fire.y - cam.scrollY;
    const W = cam.width, H = cam.height;
    const onScreen = fx > 60 && fx < W - 60 && fy > 60 && fy < H - 60;
    this.campPointer.setVisible(!onScreen && !this.ending);
    if (onScreen) return;
    const cx = W / 2, cy = H / 2;
    const ang = Math.atan2(fy - cy, fx - cx);
    // Sit on an ellipse inside the screen edge, clear of the top and bottom bars.
    const px = cx + Math.cos(ang) * (W / 2 - 90);
    const py = cy + Math.sin(ang) * (H / 2 - 150);
    this.campPointer.setPosition(px, py);
    (this.campPointer.list[0] as Phaser.GameObjects.Image).setRotation(ang);
  }

  private animate(spr: Phaser.GameObjects.Sprite, key: SheetKey, moving: boolean) {
    if (moving) spr.play(`walk-${key}`, true);
    else if (spr.anims.isPlaying) {
      spr.anims.stop();
      spr.setFrame(0);
    }
  }

  private syncViews(t: number) {
    if (!this.hero?.active) return; // the scene is closing
    const s = this.s;
    const h = s.hero;
    const breathe = h.moving ? 0 : Math.sin(t * 2) * 1.2;
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    this.hero.setPosition(h.pos.x, h.pos.y - breathe).setDepth(h.pos.y);
    this.animate(this.hero, 'hero', h.moving);
    // Turn smoothly toward where the hero is heading, like spinning around, instead of snapping.
    const want = h.facing.x > 0.15 ? 1 : h.facing.x < -0.15 ? -1 : Math.sign(this.turn) || -1;
    this.turn = Phaser.Math.Clamp(this.turn + Math.sign(want - this.turn) * Math.min(Math.abs(want - this.turn), dt * 9), -1, 1);
    const shown = Math.sign(this.turn || want) * Math.max(0.18, Math.abs(this.turn));
    this.hero.setFlipX(false).setScale(-SHEETS.hero.scale * shown, SHEETS.hero.scale);
    // Lean a little into the walk; wobble when dizzy.
    const lean = h.moving ? h.facing.x * 0.07 : 0;
    this.hero.setRotation(h.dizzy > 0 ? Math.sin(t * 24) * 0.12 : Phaser.Math.Linear(this.hero.rotation, lean, 0.2));

    // The sword: held low and forward, then a big sweep when the hero swings.
    const side = this.turn >= 0 ? 1 : -1;
    const since = SWORD_COOLDOWN - h.swordCd;
    let ang = 140;
    if (h.swordCd > 0 && since < SWING_SEC) {
      const k = Phaser.Math.Easing.Cubic.Out(since / SWING_SEC);
      ang = -75 + (150 + 75) * k;
    }
    this.sword.setPosition(h.pos.x + this.turn * 20, h.pos.y - 50 - breathe).setAngle(ang * side).setDepth(h.pos.y + (h.facing.y < -0.5 ? -1 : 1));
    this.sword.setFlipX(side < 0);
    this.heroShadow.setPosition(h.pos.x, h.pos.y - 2).setDepth(h.pos.y - 1);
    if (this.heroLight) this.heroLight.setPosition(h.pos.x, h.pos.y - 40);

    if (h.dizzy > 0) {
      if (!this.dizzyText) this.dizzyText = this.add.text(0, 0, '★ ★ ★', { fontSize: '20px', color: '#ffe08a', stroke: '#0b1028', strokeThickness: 4 }).setOrigin(0.5).setDepth(7000);
      this.dizzyText.setPosition(h.pos.x + Math.sin(t * 10) * 14, h.pos.y - 132);
    } else if (this.dizzyText) {
      this.dizzyText.destroy();
      this.dizzyText = undefined;
    }

    const p = s.pet;
    const flying = p.kind === 'owl';
    const lift = flying ? 70 + Math.sin(t * 3) * 8 : 0;
    this.pet.setPosition(p.pos.x, p.pos.y - lift).setDepth(p.pos.y + (flying ? 200 : 0));
    this.pet.setFlipX(p.facing < 0);
    if (!flying) {
      const petMoving = Math.hypot(p.pos.x - this.lastPetPos.x, p.pos.y - this.lastPetPos.y) > 0.3;
      this.animate(this.pet, p.kind, petMoving);
    }
    this.lastPetPos = { ...p.pos };

    s.allies.forEach((a, i) => {
      const v = this.allyViews[i];
      if (!v) return;
      v.spr.setPosition(a.pos.x, a.pos.y).setDepth(a.pos.y).setFlipX(a.facing > 0);
      this.animate(v.spr, a.kind, a.moving);
      v.shadow.setPosition(a.pos.x, a.pos.y - 2).setDepth(a.pos.y - 1);
    });
    this.petShadow.setPosition(p.pos.x, p.pos.y).setDepth(p.pos.y - 1).setAlpha(flying ? 0.35 : 0.6);

    for (const a of s.animals) {
      const v = this.animalViews.get(a.id);
      if (!v || !v.spr.active) continue;
      const flyer = a.kind === 'bat';
      const lift = flyer ? 60 + Math.sin(t * 4 + a.id) * 8 : 0;
      v.spr.setPosition(a.pos.x, a.pos.y - lift).setDepth(a.pos.y + (flyer ? 200 : 0)).setFlipX(a.facing < 0);
      const moved = Math.hypot(a.pos.x - v.last.x, a.pos.y - v.last.y) > 0.3;
      if (flyer) { if (!v.spr.anims.isPlaying) v.spr.play('walk-bat'); } else this.animate(v.spr, a.kind, moved);
      v.last = { ...a.pos };
      v.shadow.setPosition(a.pos.x, a.pos.y).setDepth(a.pos.y - 1).setAlpha(flyer ? 0.3 : 0.6);
      v.ring.setPosition(a.pos.x, a.pos.y).setDepth(a.pos.y - 2).setAlpha(a.friend ? 0.45 + Math.sin(t * 3 + a.id) * 0.15 : 0);
    }
    const near = this.running && !this.ending ? animalToBefriend(s) : null;
    this.giveTag.setVisible(!!near);
    if (near) this.giveTag.setPosition(near.pos.x, near.pos.y - (near.kind === 'bat' ? 130 : 80) + Math.sin(t * 4) * 3);

    for (const m of s.monsters) {
      const v = this.monsters.get(m.id);
      if (!v) continue;
      const wob = Math.sin(t * 5 + v.seed) * 4;
      const sc = MONSTERS[m.size].scale;
      v.spr.setPosition(m.pos.x, m.pos.y + wob).setDepth(m.pos.y);
      if (Math.abs(m.pos.x - v.lastX) > 0.2) v.spr.setFlipX(m.pos.x < v.lastX);
      v.lastX = m.pos.x;
      v.spr.setAngle(Math.sin(t * 3 + v.seed) * 5);
      if (m.hitFlash > 0) v.spr.setTint(0xfff0c8);
      else if (m.slow > 0) v.spr.setTint(0x9fd3f2);
      else v.spr.setTint(v.tint);
      v.glow.setPosition(m.pos.x, m.pos.y + wob - 200 * sc * 0.42).setDepth(m.pos.y + 1);
      v.shadow.setPosition(m.pos.x, m.pos.y).setDepth(m.pos.y - 1);
    }

    for (const [, g] of this.gems) {
      g.spr.setScale(0.62 + Math.sin(t * 2.2 + g.seed) * 0.03);
      g.glow.setAlpha(0.55 + Math.sin(t * 3 + g.seed) * 0.25);
    }
    this.pointHome();

    const live = new Set<number>();
    for (const a of s.arrows) {
      live.add(a.id);
      let spr = this.arrows.get(a.id);
      if (!spr) {
        spr = this.add.image(a.pos.x, a.pos.y, 'arrow').setScale(a.byAnimal ? 0.5 : this.cfg.loadout.ranged === 'crossbow' ? 0.9 : 0.75);
        if (a.byAnimal) spr.setTint(0xb6f5c8);
        this.arrows.set(a.id, spr);
      }
      spr.setPosition(a.pos.x, a.pos.y).setRotation(Math.atan2(a.vel.y, a.vel.x)).setDepth(a.pos.y + 30);
    }
    for (const [id, spr] of this.arrows) {
      if (!live.has(id)) {
        spr.destroy();
        this.arrows.delete(id);
      }
    }
  }
}
