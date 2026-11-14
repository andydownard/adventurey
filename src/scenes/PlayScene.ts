import Phaser from 'phaser';
import { COPY } from '../data/copy';
import { MONSTERS, WORLD } from '../game/config';
import { createNight, nightRewards, stepNight, type Input, type Loadout, type MonsterSize, type NightEvent, type NightState } from '../game/night';
import type { Controls, Hud } from '../ui/hud';

export interface PlayInit {
  loadout: Loadout;
  nightNumber: number;
  seed: number;
  hud: Hud;
  controls: Controls;
  onEnd(result: { saved: boolean; bonks: number; crystals: number; dragonPower: number }): void;
  onPauseKey(): void;
}

const STEP = 1 / 60;
const AMBIENT_NIGHT = 0x4a5384;
const PET_SCALE = { dragon: 0.44, wolf: 0.42, owl: 0.36 } as const;
const PET_TEX = { dragon: 'pet-dragon', wolf: 'pet-wolf', owl: 'pet-owl' } as const;
const MONSTER_TINT: Record<MonsterSize, number> = { small: 0xb4cdf0, normal: 0xc4bce0, big: 0xd0bcf0 };

interface MonsterView { spr: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; size: MonsterSize; seed: number }

export class PlayScene extends Phaser.Scene {
  private cfg!: PlayInit;
  private s!: NightState;
  private acc = 0;
  private running = false;
  private paused = false;
  private ending = false;
  private lit = false;

  private hero!: Phaser.GameObjects.Image;
  private heroShadow!: Phaser.GameObjects.Image;
  private pet!: Phaser.GameObjects.Image;
  private petShadow!: Phaser.GameObjects.Image;
  private monsters = new Map<number, MonsterView>();
  private arrows = new Map<number, Phaser.GameObjects.Image>();
  private fireLight?: Phaser.GameObjects.Light;
  private heroLight?: Phaser.GameObjects.Light;
  private fx!: Record<'poof' | 'frost' | 'snack' | 'dust' | 'feather' | 'spark', Phaser.GameObjects.Particles.ParticleEmitter>;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private queuedShot: { x: number; y: number } | null = null;
  private dizzyText?: Phaser.GameObjects.Text;

  constructor() {
    super('play');
  }

  init(data: PlayInit) {
    this.cfg = data;
    this.s = createNight(data.loadout, data.seed, data.nightNumber);
    this.acc = 0;
    this.running = false;
    this.paused = false;
    this.ending = false;
    this.monsters = new Map();
    this.arrows = new Map();
    this.queuedShot = null;
  }

  preload() {
    this.load.image('map', 'art/camp-map.jpg');
    this.load.image('hero', 'art/sprite-hero.png');
    this.load.image('gloom', 'art/sprite-gloom.png');
    this.load.image('pet-dragon', 'art/sprite-dragon.png');
    this.load.image('pet-wolf', 'art/sprite-pup.png');
    this.load.image('pet-owl', 'art/sprite-owl.png');
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
    canvas('arrow', 64, 12, (c) => {
      c.fillStyle = '#c9a26a';
      c.fillRect(6, 5, 46, 2);
      c.fillStyle = '#e8eefc';
      c.beginPath(); c.moveTo(64, 6); c.lineTo(50, 1); c.lineTo(52, 6); c.lineTo(50, 11); c.closePath(); c.fill();
      c.fillStyle = '#c9b8f2';
      c.fillRect(0, 2, 10, 2); c.fillRect(0, 8, 10, 2);
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
    this.lit = this.renderer.type === Phaser.WEBGL;
    const lit = <T extends Phaser.GameObjects.Image>(o: T): T => (this.lit ? (o.setPipeline('Light2D') as T) : o);

    // The painted camp, lit by moonlight and the fire.
    lit(this.add.image(0, 0, 'map').setOrigin(0, 0).setDepth(-10000));
    if (this.lit) {
      this.lights.enable().setAmbientColor(AMBIENT_NIGHT);
      this.fireLight = this.lights.addLight(WORLD.fire.x, WORLD.fire.y, 460, 0xffa45c, 2.2);
      this.heroLight = this.lights.addLight(0, 0, 230, 0xb8d4ff, 0.85);
    }

    // Fire: flames, embers and smoke.
    const fx = WORLD.fire.x;
    const fy = WORLD.fire.y + 6;
    this.add.particles(fx, fy, 'soft', {
      x: { min: -18, max: 18 }, speedY: { min: -150, max: -60 }, speedX: { min: -18, max: 18 },
      scale: { start: 0.75, end: 0 }, alpha: { start: 0.95, end: 0 }, lifespan: { min: 420, max: 820 },
      frequency: 14, blendMode: 'ADD', tint: [0xffe08a, 0xffa94a, 0xff6b2b],
    }).setDepth(fy + 2);
    this.add.particles(fx, fy - 20, 'soft', {
      x: { min: -14, max: 14 }, speedY: { min: -60, max: -30 }, speedX: { min: -12, max: 16 },
      scale: { start: 0.6, end: 1.8 }, alpha: { start: 0.18, end: 0 }, lifespan: 2600, frequency: 120, tint: 0x9aa0b8,
    }).setDepth(fy + 1);
    this.add.particles(fx, fy, 'soft', {
      speedY: { min: -220, max: -90 }, speedX: { min: -50, max: 50 }, gravityY: 40,
      scale: { start: 0.12, end: 0 }, lifespan: { min: 900, max: 1600 }, frequency: 90, blendMode: 'ADD', tint: 0xffc06a,
    }).setDepth(fy + 3);

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
    this.heroShadow = this.add.image(0, 0, 'shadow').setScale(0.62, 0.7).setAlpha(0.7);
    this.hero = lit(this.add.image(this.s.hero.pos.x, this.s.hero.pos.y, 'hero').setOrigin(0.5, 0.94).setScale(0.46));
    const petKind = this.cfg.loadout.pet;
    this.petShadow = this.add.image(0, 0, 'shadow').setScale(0.6, 0.6).setAlpha(0.6);
    this.pet = lit(this.add.image(this.s.pet.pos.x, this.s.pet.pos.y, PET_TEX[petKind]).setOrigin(0.5, 0.92).setScale(PET_SCALE[petKind]));

    this.add.image(0, 0, 'vignette').setOrigin(0, 0).setScrollFactor(0).setDepth(100000);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD.width, WORLD.height);
    cam.startFollow(this.hero, true, 0.08, 0.08);
    cam.fadeIn(600, 4, 6, 20);

    // Keyboard and mouse.
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,K,ESC,P') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-ESC', () => this.cfg.onPauseKey());
    this.input.keyboard!.on('keydown-P', () => this.cfg.onPauseKey());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const wp = cam.getWorldPoint(p.x, p.y);
      this.queuedShot = { x: wp.x, y: wp.y };
    });

    this.syncViews(0);
    this.cfg.hud.update(this.s);
  }

  begin() { this.running = true; }

  /** For automated checks only: run the night forward quickly with a simple input. */
  advance(seconds: number, input: Input = { move: { x: 0, y: 0 }, swing: false, shoot: null }) {
    for (let i = 0; i < Math.round(seconds / STEP) && !this.ending; i++) this.handle(stepNight(this.s, STEP, input));
    this.cfg.hud.update(this.s);
  }
  setPaused(p: boolean) { this.paused = p; }

  private readInput(): Input {
    const k = this.keys;
    let x = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let y = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (x === 0 && y === 0) ({ x, y } = this.cfg.controls.move);
    let shoot = this.queuedShot;
    const p = this.input.activePointer;
    if (!shoot && p.isDown && !p.wasTouch) {
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      shoot = { x: wp.x, y: wp.y };
    }
    if (!shoot && k.K.isDown) {
      const f = this.s.hero.facing;
      shoot = { x: this.s.hero.pos.x + f.x * 300, y: this.s.hero.pos.y - 30 + f.y * 300 };
    }
    return { move: { x, y }, swing: k.SPACE.isDown || k.J.isDown || this.cfg.controls.swing, shoot };
  }

  update(time: number, delta: number) {
    const t = time / 1000;
    if (this.fireLight) {
      this.fireLight.intensity = 2.05 + Math.sin(t * 11) * 0.12 + Math.sin(t * 23.7) * 0.08 + Math.random() * 0.1;
      this.fireLight.radius = 450 + Math.sin(t * 7.3) * 14;
    }
    if (this.running && !this.paused && !this.ending) {
      this.acc = Math.min(0.25, this.acc + delta / 1000);
      while (this.acc >= STEP && !this.ending) {
        this.acc -= STEP;
        const input = this.readInput();
        this.queuedShot = null;
        this.handle(stepNight(this.s, STEP, input));
      }
      this.cfg.hud.update(this.s);
    }
    this.syncViews(t);
  }

  private floatText(x: number, y: number, text: string, color = '#ffffff', size = 26) {
    const tx = this.add.text(x, y, text, { fontFamily: 'Nunito', fontStyle: '800', fontSize: `${size}px`, color, stroke: '#0b1028', strokeThickness: 6 })
      .setOrigin(0.5).setDepth(7000);
    this.tweens.add({ targets: tx, y: y - 50, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => tx.destroy() });
  }

  private flash(x: number, y: number, color: number, radius = 160, intensity = 1.6) {
    if (!this.lit || this.lights.getLightCount() > 14) return;
    const light = this.lights.addLight(x, y, radius, color, intensity);
    this.tweens.add({ targets: light, intensity: 0, duration: 380, onComplete: () => this.lights.removeLight(light) });
  }

  private handle(events: NightEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'spawn': {
          const st = MONSTERS[e.size];
          const shadow = this.add.image(e.at.x, e.at.y, 'shadow').setScale(st.scale * 1.5, st.scale * 1.4).setAlpha(0);
          const spr = this.add.image(e.at.x, e.at.y, 'gloom').setOrigin(0.5, 0.92).setScale(st.scale * 0.2).setAlpha(0).setTint(MONSTER_TINT[e.size]);
          // Monsters stay unlit on purpose, so kids can always spot them in the dark woods.
          const glow = this.add.image(e.at.x, e.at.y, 'soft').setBlendMode(Phaser.BlendModes.ADD).setTint(0xc9b8f2).setScale(st.scale * 1.9, st.scale * 1.1).setAlpha(0);
          this.tweens.add({ targets: spr, scale: st.scale, alpha: 1, duration: 500, ease: 'Back.easeOut' });
          this.tweens.add({ targets: shadow, alpha: 0.75, duration: 500 });
          this.tweens.add({ targets: glow, alpha: 0.95, duration: 500 });
          this.monsters.set(e.id, { spr, shadow, glow, size: e.size, seed: e.id * 1.7 });
          break;
        }
        case 'swing': {
          const ang = Math.atan2(e.dir.y, e.dir.x);
          const sl = this.add.image(e.at.x + e.dir.x * 50, e.at.y - 34 + e.dir.y * 40, 'slash').setRotation(ang)
            .setBlendMode(Phaser.BlendModes.ADD).setScale(0.7).setDepth(e.at.y + 40);
          this.tweens.add({ targets: sl, scale: 1.15, alpha: 0, duration: 220, ease: 'Quad.easeOut', onComplete: () => sl.destroy() });
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
          break;
        }
        case 'poof': {
          const v = this.monsters.get(e.id);
          const n = e.size === 'big' ? 40 : e.size === 'small' ? 14 : 24;
          this.fx.poof.explode(n, e.at.x, e.at.y - 30);
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
          this.floatText(WORLD.fire.x, WORLD.fire.y - 90, COPY.snack, '#ffd9b0', 24);
          this.cameras.main.shake(140, 0.004);
          this.cfg.hud.flashCamp();
          if (v) {
            this.monsters.delete(e.id);
            // The monster grabs a snack and scurries back to the woods.
            const away = { x: e.at.x + (e.at.x - WORLD.fire.x) * 4, y: e.at.y + (e.at.y - WORLD.fire.y) * 4 };
            this.tweens.add({ targets: [v.spr, v.glow, v.shadow], x: away.x, y: away.y, alpha: 0, duration: 900, onComplete: () => { v.spr.destroy(); v.glow.destroy(); v.shadow.destroy(); } });
          }
          break;
        }
        case 'dizzy': {
          this.floatText(e.at.x, e.at.y - 130, COPY.dizzy, '#ffe08a', 24);
          this.cameras.main.shake(100, 0.003);
          break;
        }
        case 'petAttack': {
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
        case 'sunrise':
          this.finish(true);
          break;
        case 'campFell':
          this.finish(false);
          break;
        default:
          break;
      }
    }
  }

  private finish(saved: boolean) {
    this.ending = true;
    const r = nightRewards(this.s);
    const done = () => this.cfg.onEnd({ saved, bonks: this.s.bonks, crystals: r.crystals, dragonPower: r.dragonPower });
    if (saved && this.lit) {
      const from = Phaser.Display.Color.ValueToColor(AMBIENT_NIGHT);
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

  private syncViews(t: number) {
    const s = this.s;
    const h = s.hero;
    const bob = h.moving ? Math.abs(Math.sin(t * 12)) * 5 : Math.sin(t * 2) * 1.2;
    this.hero.setPosition(h.pos.x, h.pos.y - bob).setDepth(h.pos.y);
    if (Math.abs(h.facing.x) > 0.15) this.hero.setFlipX(h.facing.x < 0);
    this.hero.setRotation(h.dizzy > 0 ? Math.sin(t * 24) * 0.12 : this.hero.rotation * 0.8);
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
    this.pet.setPosition(p.pos.x, p.pos.y - lift - (flying ? 0 : Math.abs(Math.sin(t * 9)) * 2)).setDepth(p.pos.y + (flying ? 200 : 0));
    this.pet.setFlipX(p.facing < 0);
    if (flying) this.pet.setScale(PET_SCALE.owl, PET_SCALE.owl * (0.92 + Math.abs(Math.sin(t * 8)) * 0.1));
    this.petShadow.setPosition(p.pos.x, p.pos.y).setDepth(p.pos.y - 1).setAlpha(flying ? 0.35 : 0.6);

    for (const m of s.monsters) {
      const v = this.monsters.get(m.id);
      if (!v) continue;
      const wob = Math.sin(t * 5 + v.seed) * 4;
      const sc = MONSTERS[m.size].scale;
      v.spr.setPosition(m.pos.x, m.pos.y + wob).setDepth(m.pos.y);
      v.spr.setFlipX(m.pos.x > WORLD.fire.x);
      v.spr.setAngle(Math.sin(t * 3 + v.seed) * 5);
      if (m.hitFlash > 0) v.spr.setTint(0xfff0c8);
      else if (m.slow > 0) v.spr.setTint(0x9fd3f2);
      else v.spr.setTint(MONSTER_TINT[m.size]);
      v.glow.setPosition(m.pos.x, m.pos.y + wob - 200 * sc * 0.42).setDepth(m.pos.y + 1);
      v.shadow.setPosition(m.pos.x, m.pos.y).setDepth(m.pos.y - 1);
    }

    const live = new Set<number>();
    for (const a of s.arrows) {
      live.add(a.id);
      let spr = this.arrows.get(a.id);
      if (!spr) {
        spr = this.add.image(a.pos.x, a.pos.y, 'arrow').setScale(this.cfg.loadout.ranged === 'crossbow' ? 0.9 : 0.75);
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
