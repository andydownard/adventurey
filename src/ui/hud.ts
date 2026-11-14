import { COPY } from '../data/copy';
import { RANGED, SWORD } from '../game/config';
import type { NightState } from '../game/night';
import type { Vec } from '../game/world';
import { h, ICONS, svgIcon } from './dom';

/** Shared between the touch controls and the play scene. */
export interface Controls {
  move: Vec;
  swing: boolean;
}

export interface Hud {
  el: HTMLElement;
  update(s: NightState): void;
  flashCamp(): void;
}

const PACK_ART = { wolf: 'art/wolf.jpg', dragon: 'art/packdragon.jpg' } as const;
const RANGED_ART = { bow: 'art/bow.jpg', crossbow: 'art/xbow.jpg' } as const;

export function createHud(opts: { name: string; pack: 'wolf' | 'dragon'; ranged: 'bow' | 'crossbow'; nightNumber: number; controls: Controls; touch: boolean; onPause(): void }): Hud {
  const timeText = h('span', {}, '');
  const timeFill = h('div', { style: 'width:0%;background:linear-gradient(90deg,#8a6fd1,#ffd9b0)' });
  const campText = h('span', { style: 'color:var(--green)' }, '');
  const campFill = h('div', { style: 'width:100%;background:linear-gradient(90deg,#9fd3f2,#8ef0b0)' });
  const campBox = h('div', { class: 'camp-box' },
    h('div', { style: 'display:flex;justify-content:space-between;font-weight:800;font-size:18px' }, h('span', {}, COPY.hud.camp), campText),
    h('div', { class: 'bar', role: 'progressbar', 'aria-label': 'Camp health' }, campFill));
  const bonkText = h('b', { style: 'font:800 26px Cinzel,serif;color:var(--green)' }, '0');
  const swordCool = h('div', { class: 'cool', style: 'height:0%' });
  const shotCool = h('div', { class: 'cool', style: 'height:0%' });

  const top = h('div', { class: 'hud-top' },
    h('div', { class: 'pill' },
      h('div', { class: 'badge' }, h('img', { src: PACK_ART[opts.pack], alt: '' })),
      h('div', { style: 'display:flex;flex-direction:column' },
        h('span', { style: 'font:800 20px Cinzel,serif' }, COPY.packs[opts.pack].name),
        h('span', { style: 'font-size:15px;color:var(--lav)' }, opts.name || COPY.moonDefault))),
    h('div', { class: 'time-box' },
      h('div', { style: 'display:flex;align-items:center;gap:10px;font:800 22px Cinzel,serif' }, svgIcon(ICONS.moon, '#c9b8f2', 22), `Night ${opts.nightNumber}`),
      h('div', { style: 'display:flex;gap:6px;font-weight:800;font-size:16px;color:var(--lav)' }, timeText, COPY.hud.untilSunrise),
      h('div', { class: 'bar', style: 'width:260px;height:10px', role: 'progressbar', 'aria-label': 'Time until sunrise' }, timeFill)),
    h('div', { style: 'display:flex;gap:12px;align-items:flex-start' }, campBox,
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': COPY.hud.pause, style: 'position:static', onclick: opts.onPause }, svgIcon(ICONS.pause))));

  const bottom = h('div', { class: 'hud-bottom' },
    h('div', { class: 'pill', style: 'flex-direction:column;align-items:flex-start;gap:0;border-radius:20px;padding:10px 18px' },
      h('span', { style: 'font-size:15px;font-weight:800;color:var(--lav)' }, COPY.hud.bonks), bonkText),
    h('div', { style: 'display:flex;gap:12px;padding:10px;border-radius:24px;background:rgba(6,9,20,.55)' },
      h('div', { class: 'slot' }, swordCool, h('img', { src: 'art/iron.jpg', alt: '' }), COPY.hud.sword, opts.touch ? null : h('kbd', {}, 'Space')),
      h('div', { class: 'slot' }, shotCool, h('img', { src: RANGED_ART[opts.ranged], alt: '' }), COPY.hud[opts.ranged], opts.touch ? null : h('kbd', {}, 'Click'))),
    h('div', { style: 'width:150px' }));

  const el = h('div', { class: 'hud' }, top, bottom);

  if (opts.touch) {
    const nub = h('div', { class: 'nub' });
    const stick = h('div', { class: 'stick', 'aria-label': 'Move' }, nub);
    let pid: number | null = null;
    const setFrom = (e: PointerEvent) => {
      const r = stick.getBoundingClientRect();
      const scale = r.width / 160;
      let dx = (e.clientX - (r.left + r.width / 2)) / scale;
      let dy = (e.clientY - (r.top + r.height / 2)) / scale;
      const len = Math.hypot(dx, dy);
      if (len > 55) { dx = (dx / len) * 55; dy = (dy / len) * 55; }
      nub.style.transform = `translate(${dx}px, ${dy}px)`;
      opts.controls.move = { x: dx / 55, y: dy / 55 };
    };
    stick.addEventListener('pointerdown', (e) => { pid = e.pointerId; stick.setPointerCapture(e.pointerId); setFrom(e); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === pid) setFrom(e); });
    const end = (e: PointerEvent) => { if (e.pointerId !== pid) return; pid = null; nub.style.transform = ''; opts.controls.move = { x: 0, y: 0 }; };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    const sword = h('button', { class: 'btn btn-main touch-sword', type: 'button' }, COPY.hud.sword);
    sword.addEventListener('pointerdown', (e) => { e.preventDefault(); opts.controls.swing = true; });
    const up = () => { opts.controls.swing = false; };
    sword.addEventListener('pointerup', up);
    sword.addEventListener('pointercancel', up);
    sword.addEventListener('pointerleave', up);
    el.append(stick, sword);
  }

  let lastCamp = -1;
  return {
    el,
    flashCamp() {
      campBox.classList.remove('hurt');
      void campBox.offsetWidth;
      campBox.classList.add('hurt');
    },
    update(s) {
      const left = Math.max(0, Math.ceil(s.length - s.t));
      const text = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      if (timeText.textContent !== text) timeText.textContent = text;
      timeFill.style.width = `${Math.min(100, (s.t / s.length) * 100).toFixed(1)}%`;
      if (s.campHealth !== lastCamp) {
        lastCamp = s.campHealth;
        campText.textContent = `${s.campHealth} / ${s.maxCampHealth}`;
        campFill.style.width = `${(s.campHealth / s.maxCampHealth) * 100}%`;
      }
      const b = String(s.bonks);
      if (bonkText.textContent !== b) bonkText.textContent = b;
      swordCool.style.height = `${Math.min(100, (s.hero.swordCd / SWORD.cooldownSec) * 100)}%`;
      const shotMax = RANGED[s.loadout.ranged].cooldownSec;
      shotCool.style.height = `${Math.min(100, (s.hero.shotCd / shotMax) * 100)}%`;
    },
  };
}
