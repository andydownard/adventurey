// All sound is made in the browser with WebAudio: no files, no network.
// Nothing plays until the player taps (browsers and iPads require it), and Mute always works.

const MUTE_KEY = 'adventurey.muted';

type Sfx =
  | 'swing' | 'bow' | 'crossbow' | 'hit' | 'poof' | 'bigPoof' | 'snack' | 'dizzy'
  | 'frost' | 'yip' | 'hoot' | 'staff' | 'bonk' | 'spawn' | 'sunrise' | 'campFell' | 'click' | 'chime' | 'whoosh';

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambientBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timers: number[] = [];
  private ambientOn = false;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  /** Call from a tap or click. Safe to call many times. */
  unlock() {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.8;
        // A gentle limiter so nothing is ever loud.
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.ratio.value = 6;
        this.master.connect(comp).connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = 0.55;
        this.sfxBus.connect(this.master);
        this.ambientBus = this.ctx.createGain();
        this.ambientBus.gain.value = 0.35;
        this.ambientBus.connect(this.master);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      /* storage can refuse */
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  pause(p: boolean) {
    if (!this.ctx) return;
    if (p) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  // ---------- building blocks ----------
  private tone(freq: number, dur: number, opts: { type?: OscillatorType; to?: number; vol?: number; attack?: number; at?: number; bus?: GainNode | null } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (opts.at ?? 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const v = opts.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (opts.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(opts.bus ?? this.sfxBus!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private hiss(dur: number, opts: { freq?: number; to?: number; q?: number; vol?: number; type?: BiquadFilterType; at?: number; bus?: GainNode | null } = {}) {
    if (!this.ctx || !this.noise) return;
    const t = this.ctx.currentTime + (opts.at ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.Q.value = opts.q ?? 1;
    f.frequency.setValueAtTime(opts.freq ?? 1000, t);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(opts.bus ?? this.sfxBus!);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  play(name: Sfx) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'swing': this.hiss(0.18, { freq: 700, to: 3200, q: 1.2, vol: 0.5 }); break;
      case 'bow':
        this.tone(330, 0.16, { type: 'triangle', to: 150, vol: 0.35 });
        this.hiss(0.12, { freq: 4000, to: 1500, vol: 0.12, type: 'highpass' });
        break;
      case 'crossbow':
        this.tone(160, 0.12, { type: 'square', to: 70, vol: 0.25 });
        this.hiss(0.08, { freq: 2000, vol: 0.25 });
        break;
      case 'hit': this.tone(180, 0.1, { type: 'sine', to: 90, vol: 0.4 }); break;
      case 'bonk':
        this.tone(220, 0.12, { type: 'triangle', to: 110, vol: 0.45 });
        this.hiss(0.06, { freq: 900, vol: 0.2 });
        break;
      case 'poof':
        this.tone(520, 0.25, { to: 1400, vol: 0.18 });
        this.tone(1560, 0.2, { vol: 0.08, at: 0.06 });
        this.hiss(0.25, { freq: 6000, vol: 0.06, type: 'highpass' });
        break;
      case 'bigPoof':
        this.tone(330, 0.4, { to: 990, vol: 0.22 });
        [1320, 1660, 1980].forEach((f, i) => this.tone(f, 0.25, { vol: 0.07, at: 0.08 + i * 0.06 }));
        break;
      case 'snack':
        this.tone(420, 0.28, { type: 'triangle', to: 180, vol: 0.3 });
        this.hiss(0.2, { freq: 1500, vol: 0.12, at: 0.05 });
        break;
      case 'dizzy':
        for (let i = 0; i < 4; i++) this.tone(900 - i * 90, 0.12, { type: 'sine', vol: 0.12, at: i * 0.09 });
        break;
      case 'frost':
        this.hiss(0.35, { freq: 7000, to: 3000, vol: 0.12, type: 'highpass' });
        this.tone(1760, 0.3, { vol: 0.05 });
        break;
      case 'yip': this.tone(900, 0.07, { type: 'square', to: 1300, vol: 0.08 }); this.tone(1100, 0.07, { type: 'square', to: 1500, vol: 0.06, at: 0.09 }); break;
      case 'hoot': this.tone(392, 0.18, { attack: 0.04, vol: 0.18 }); this.tone(349, 0.3, { attack: 0.05, vol: 0.18, at: 0.22 }); break;
      case 'staff': this.tone(880, 0.18, { to: 1760, vol: 0.08 }); this.hiss(0.15, { freq: 5000, vol: 0.05, type: 'highpass' }); break;
      case 'spawn': [262, 311, 277].forEach((f, i) => this.tone(f, 0.09, { type: 'sine', vol: 0.05, at: i * 0.08 })); break;
      case 'sunrise': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.9, { type: 'triangle', vol: 0.12, attack: 0.03, at: i * 0.14 })); break;
      case 'campFell': [392, 330, 262].forEach((f, i) => this.tone(f, 0.5, { type: 'triangle', vol: 0.12, at: i * 0.22 })); break;
      case 'click': this.tone(1200, 0.04, { type: 'sine', vol: 0.06 }); break;
      case 'chime': [1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.35, { type: 'sine', vol: 0.1, attack: 0.005, at: i * 0.07 })); break;
      case 'whoosh': this.hiss(0.6, { freq: 400, to: 1200, q: 0.8, vol: 0.18 }); break;
    }
  }

  // ---------- night ambience ----------
  startAmbient() {
    if (!this.ctx || this.ambientOn) return;
    this.ambientOn = true;
    const ctx = this.ctx;
    const bus = this.ambientBus!;

    // The magic tree: soft, high shimmers, like leaves full of tiny bells.
    const shimmer = () => {
      const base = 2600 + Math.random() * 1400;
      for (let i = 0; i < 2; i++) this.tone(base * (1 + i * 0.5), 0.5, { type: 'sine', vol: 0.012, attack: 0.08, at: i * 0.09, bus });
    };
    // Crickets: quick high chirps in little groups.
    const crickets = () => {
      const base = 4200 + Math.random() * 600;
      for (let i = 0; i < 3; i++) this.tone(base, 0.035, { vol: 0.025, at: i * 0.06, bus });
    };
    // A soft, slow tune of bell notes over a low drone, like the Northern Lights.
    const drone = ctx.createGain();
    drone.gain.value = 0.0001;
    drone.gain.setTargetAtTime(0.06, ctx.currentTime, 2);
    drone.connect(bus);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 600;
    filt.connect(drone);
    const oscs = [146.83, 220, 293.66].map((f) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 8;
      o.connect(filt);
      o.start();
      return o;
    });
    const scale = [587, 659, 784, 880, 988, 1175];
    const bell = () => this.tone(scale[Math.floor(Math.random() * scale.length)], 2.2, { type: 'sine', vol: 0.05, attack: 0.02, bus });

    const every = (fn: () => void, min: number, max: number) => {
      const loop = () => {
        if (!this.ambientOn) return;
        fn();
        this.timers.push(window.setTimeout(loop, min + Math.random() * (max - min)));
      };
      loop();
    };
    every(shimmer, 1800, 4200);
    every(crickets, 700, 1600);
    every(bell, 1400, 3200);
    this.stopDrone = () => {
      drone.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
      oscs.forEach((o) => o.stop(ctx.currentTime + 2));
    };
  }

  private stopDrone: () => void = () => {};

  stopAmbient() {
    this.ambientOn = false;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    this.stopDrone();
    this.stopDrone = () => {};
  }
}

export const sound = new SoundManager();
