import { COPY } from '../data/copy';
import { dragonStage, type Progress } from '../game/progress';
import type { PackKind, PetKind, RangedKind } from '../game/night';
import { REWARDS } from '../game/config';
import { fireflies, h, ICONS, svgIcon } from './dom';

export interface AppCtx {
  progress: Progress;
  update(p: Partial<Progress>): void;
  go(screen: 'title' | 'gear' | 'pack'): void;
  startNight(): void;
  toast(msg: string): void;
}

const ART = 'art/';

function backButton(onClick: () => void) {
  return h('button', { class: 'icon-btn', type: 'button', 'aria-label': COPY.back, style: 'left:32px;top:28px', onclick: onClick }, svgIcon(ICONS.back));
}

function blurredForest() {
  return [
    h('img', { class: 'bg', src: ART + 'forest.jpg', alt: '', 'aria-hidden': 'true', style: 'left:-90px;top:-100px;width:1460px;height:1000px;filter:blur(5px) brightness(.62) saturate(1.1)' }),
    h('div', { class: 'shade', 'aria-hidden': 'true' }),
    ...fireflies(8, 3),
  ];
}

function header(title: string, sub: string) {
  return h('div', { style: 'position:absolute;left:0;right:0;top:32px;display:flex;flex-direction:column;align-items:center;gap:6px' },
    h('h1', { style: 'font-size:50px;color:#f4f1ff;text-shadow:0 0 22px rgba(142,240,176,.55)' }, title),
    h('p', { class: 'sub' }, sub));
}

// ---------------- Title ----------------
export function titleScreen(ctx: AppCtx): HTMLElement {
  const p = ctx.progress;
  const moonWrap = h('div', { style: 'position:absolute;left:988px;top:103px;transform:translateX(-50%);display:flex;flex-direction:column-reverse;align-items:center;gap:10px' });
  const renderMoon = (editing: boolean) => {
    moonWrap.replaceChildren();
    if (editing) {
      const input = h('input', { id: 'player-name', type: 'text', maxlength: 12, placeholder: COPY.moonDefault, value: ctx.progress.name, 'aria-label': 'Your name' }) as HTMLInputElement;
      const done = () => { ctx.update({ name: input.value.trim().slice(0, 12) }); renderMoon(false); };
      input.addEventListener('blur', done);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
      moonWrap.append(h('div', { class: 'moon' }, input));
      setTimeout(() => input.focus(), 0);
    } else {
      moonWrap.append(h('button', { class: 'moon', type: 'button', 'aria-label': `Your name: ${ctx.progress.name || COPY.moonDefault}. Tap to change it.`, onclick: () => renderMoon(true) }, ctx.progress.name || COPY.moonDefault));
    }
    moonWrap.append(h('span', { style: 'font-size:16px;font-weight:700;color:var(--lav);text-shadow:0 2px 6px var(--night)' }, COPY.moonHint));
  };
  renderMoon(false);

  const stage = dragonStage(p.dragonPower);
  return h('section', { class: 'screen', 'aria-label': COPY.title },
    h('img', { class: 'bg', src: ART + 'forest.jpg', alt: '', 'aria-hidden': 'true', style: 'left:-60px;top:-66px;width:1400px;height:933px' }),
    h('div', { class: 'shade', 'aria-hidden': 'true' }),
    h('div', { 'aria-hidden': 'true', style: 'position:absolute;left:240px;top:380px;width:800px;height:260px;border-radius:50%;background:radial-gradient(closest-side,rgba(5,8,23,.55),rgba(5,8,23,0))' }),
    ...fireflies(16, 1),
    h('div', { style: 'position:absolute;left:0;right:0;top:150px;display:flex;flex-direction:column;align-items:center;gap:14px' },
      h('h1', { class: 'title' }, COPY.title),
      h('p', { class: 'sub', style: 'font-size:24px;letter-spacing:1px' }, COPY.tagline)),
    h('button', { class: 'circle', type: 'button', style: 'position:absolute;left:96px;top:56px', onclick: () => ctx.toast(COPY.comingSoon) }, COPY.playFriends),
    moonWrap,
    h('nav', { 'aria-label': 'Main', style: 'position:absolute;left:0;right:0;top:420px;display:flex;flex-direction:column;align-items:center;gap:18px' },
      h('div', { style: 'display:flex;gap:18px' },
        h('button', { class: 'btn btn-main', type: 'button', style: 'width:300px', onclick: () => ctx.go('gear') }, svgIcon(ICONS.play, '#060914'), COPY.play),
        h('button', { class: 'btn btn-glow', type: 'button', style: 'width:300px', onclick: () => ctx.toast(COPY.comingSoon) }, svgIcon(ICONS.compass, '#b6f5c8'), COPY.explore)),
      h('div', { style: 'display:flex;gap:18px' },
        h('button', { class: 'btn btn-alt', type: 'button', style: 'width:280px', onclick: () => ctx.go('gear') }, svgIcon(ICONS.sword, '#b6f5c8'), COPY.chooseGear),
        h('button', { class: 'btn btn-alt', type: 'button', style: 'width:280px', onclick: () => ctx.go('pack') }, svgIcon(ICONS.paw, '#b6f5c8'), COPY.choosePack))),
    h('div', { class: 'pill', style: 'position:absolute;left:50%;bottom:26px;transform:translateX(-50%);font-weight:800;font-size:18px' },
      `${COPY.nightsSaved}: ${p.nightsSaved}`, h('span', { style: 'opacity:.5' }, '·'),
      `${COPY.crystals}: ${p.crystals}`, h('span', { style: 'opacity:.5' }, '·'),
      `${stage} (${p.dragonPower}/${REWARDS.dragonPowerMax})`),
  );
}

// ---------------- Gear ----------------
function card(img: string, label: string, line: string, pressed: boolean, onClick: () => void, tall = false) {
  return h('button', { class: 'card', type: 'button', 'aria-pressed': String(pressed), onclick: onClick },
    h('img', { src: ART + img, alt: '', class: tall ? 'tall' : '' }),
    h('span', {}, label, h('small', {}, line)));
}

export function gearScreen(ctx: AppCtx): HTMLElement {
  const root = h('section', { class: 'screen', 'aria-label': COPY.gearTitle });
  const render = () => {
    const p = ctx.progress;
    const pet = (k: PetKind, img: string) => card(img, COPY.pets[k], COPY.petLines[k], p.pet === k, () => { ctx.update({ pet: k }); render(); });
    const ranged = (k: RangedKind, img: string) => card(img, COPY.ranged[k], COPY.rangedLines[k], p.ranged === k, () => { ctx.update({ ranged: k }); render(); }, true);
    const locked = (img: string, label: string) => {
      const b = card(img, label, COPY.unlockLater, false, () => {}, true);
      (b as HTMLButtonElement).disabled = true;
      return b;
    };
    root.replaceChildren(
      ...blurredForest(),
      backButton(() => ctx.go('title')),
      header(COPY.gearTitle, COPY.gearSub),
      h('div', { class: 'picker-cols' },
        h('section', { class: 'col', 'aria-label': 'Pet' }, h('h2', {}, 'Pet'), pet('dragon', 'babydragon.jpg'), pet('wolf', 'pup.jpg'), pet('owl', 'owl.jpg')),
        h('section', { class: 'col', 'aria-label': 'Bow' }, h('h2', {}, 'Bow'), ranged('bow', 'bow.jpg'), ranged('crossbow', 'xbow.jpg')),
        h('section', { class: 'col', 'aria-label': 'Sword' }, h('h2', {}, 'Sword'),
          card('iron.jpg', COPY.swords.iron, 'Bonks the monsters in front of you.', true, () => {}, true),
          locked('crystal.jpg', COPY.swords.crystal), locked('aurora.jpg', COPY.swords.aurora))),
      h('button', { class: 'btn btn-main', type: 'button', style: 'position:absolute;right:40px;bottom:30px;width:260px', onclick: () => ctx.go('pack') },
        `${COPY.next}: ${COPY.choosePack.toLowerCase()}`, svgIcon(ICONS.next, '#060914')),
    );
  };
  render();
  return root;
}

// ---------------- Pack ----------------
export function packScreen(ctx: AppCtx): HTMLElement {
  const root = h('section', { class: 'screen', 'aria-label': COPY.packTitle });
  const render = () => {
    const p = ctx.progress;
    const packCard = (k: PackKind, img: string) => {
      const on = p.pack === k;
      return h('button', { class: 'card pack-card', type: 'button', 'aria-pressed': String(on), onclick: () => { ctx.update({ pack: k }); render(); } },
        h('img', { src: ART + img, alt: '' }),
        h('span', { class: 'display' }, COPY.packs[k].name),
        h('small', {}, COPY.packs[k].line),
        on ? h('span', { class: 'tag' }, COPY.yourPack) : null);
    };
    root.replaceChildren(
      ...blurredForest(),
      backButton(() => ctx.go('gear')),
      header(COPY.packTitle, COPY.packSub),
      h('div', { class: 'pack-cards' }, packCard('wolf', 'wolf.jpg'), packCard('dragon', 'packdragon.jpg')),
      h('button', { class: 'btn btn-main', type: 'button', style: 'position:absolute;right:40px;bottom:30px;width:260px', onclick: () => ctx.startNight() },
        COPY.goToCamp, svgIcon(ICONS.next, '#060914')),
    );
  };
  render();
  return root;
}

// ---------------- Results ----------------
export interface NightResult {
  saved: boolean;
  nightNumber: number;
  bonks: number;
  crystals: number;
  dragonPower: number;
  totalPower: number;
}

export function resultScreen(r: NightResult, onNext: () => void, onForest: () => void): HTMLElement {
  const bg = r.saved
    ? h('img', { class: 'bg', src: ART + 'sunrise.jpg', alt: '', 'aria-hidden': 'true', style: 'left:0;top:-27px;width:1280px;height:853px' })
    : h('img', { class: 'bg', src: ART + 'camp.jpg', alt: '', 'aria-hidden': 'true', style: 'left:0;top:-27px;width:1280px;height:853px;filter:brightness(.55) saturate(.8)' });
  const reward = (value: string | number, label: string) => h('div', { class: 'reward' }, h('b', {}, String(value)), label);
  return h('section', { class: 'screen', 'aria-label': r.saved ? COPY.sunriseTitle : COPY.fellTitle },
    bg,
    h('div', { class: 'shade', 'aria-hidden': 'true' }),
    h('div', { class: 'result-head' },
      h('span', { class: 'kicker' }, r.saved ? `${COPY.sunriseKicker.toUpperCase()} NIGHT ${r.nightNumber}` : `NIGHT ${r.nightNumber}`),
      h('h1', {}, r.saved ? COPY.sunriseTitle : COPY.fellTitle),
      h('p', {}, r.saved ? COPY.sunriseLine : COPY.fellLine)),
    h('div', { class: 'rewards' },
      reward(r.bonks, COPY.hud.bonks),
      reward(`+${r.crystals}`, COPY.crystals),
      reward(`${r.totalPower}/${REWARDS.dragonPowerMax}`, `${COPY.dragonPower}${r.dragonPower ? ' (+1)' : ''}`)),
    h('div', { class: 'result-actions' },
      h('button', { class: 'btn btn-alt', type: 'button', style: 'width:260px', onclick: onForest }, COPY.toForest),
      h('button', { class: 'btn btn-main', type: 'button', style: 'width:260px', onclick: onNext }, r.saved ? COPY.nextNight : COPY.tryAgain)),
  );
}
