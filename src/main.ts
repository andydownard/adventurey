import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/800.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './styles/ui.css';
import Phaser from 'phaser';
import { COPY } from './data/copy';
import { applyNightResult, loadProgress, saveProgress, type Progress } from './game/progress';
import { PlayScene } from './scenes/PlayScene';
import { h } from './ui/dom';
import { createHud, type Controls } from './ui/hud';
import { gearScreen, packScreen, resultScreen, titleScreen, type AppCtx } from './ui/screens';

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const store = safeStorage();
const stage = document.getElementById('stage')!;
const ui = document.getElementById('ui')!;
const gameEl = document.getElementById('game')!;
const isTouch = window.matchMedia('(pointer: coarse)').matches;

// Fit the 1280 x 800 stage to any window, keeping its shape.
function fit() {
  const s = Math.min(window.innerWidth / 1280, window.innerHeight / 800);
  stage.style.transform = `scale(${s})`;
  game?.scale.refresh();
}
window.addEventListener('resize', fit);

let progress: Progress = loadProgress(store);
let game: Phaser.Game | null = null;
let nightNumber = progress.nightsSaved + 1;

function show(el: HTMLElement) {
  ui.replaceChildren(el);
}

function toast(msg: string) {
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  ui.append(t);
  setTimeout(() => t.remove(), 1800);
}

const ctx: AppCtx = {
  get progress() { return progress; },
  update(p) {
    progress = { ...progress, ...p };
    saveProgress(store, progress);
  },
  go(screen) {
    stopGame();
    if (screen === 'title') show(titleScreen(ctx));
    if (screen === 'gear') show(gearScreen(ctx));
    if (screen === 'pack') show(packScreen(ctx));
  },
  startNight,
  toast,
};

function stopGame() {
  if (game && game.scene.isActive('play')) game.scene.stop('play');
  gameEl.style.visibility = 'hidden';
}

function scene(): PlayScene | null {
  return (game?.scene.getScene('play') as PlayScene) ?? null;
}

function startNight() {
  const controls: Controls = { move: { x: 0, y: 0 }, swing: false };
  const layer = h('div', { style: 'position:absolute;inset:0' });
  let pausedPanel: HTMLElement | null = null;

  const togglePause = () => {
    const sc = scene();
    if (!sc) return;
    if (pausedPanel) {
      pausedPanel.remove();
      pausedPanel = null;
      sc.setPaused(false);
      return;
    }
    sc.setPaused(true);
    pausedPanel = h('div', { class: 'overlay', role: 'dialog', 'aria-label': COPY.paused },
      h('div', { class: 'panel' },
        h('h2', {}, COPY.paused),
        h('div', { style: 'display:flex;gap:16px' },
          h('button', { class: 'btn btn-alt', type: 'button', onclick: () => ctx.go('title') }, COPY.leave),
          h('button', { class: 'btn btn-main', type: 'button', onclick: togglePause }, COPY.resume))));
    layer.append(pausedPanel);
    (pausedPanel.querySelector('.btn-main') as HTMLElement).focus();
  };

  const hud = createHud({ name: progress.name, pack: progress.pack, ranged: progress.ranged, nightNumber, controls, touch: isTouch, onPause: togglePause });
  layer.append(hud.el);

  const intro = h('div', { class: 'overlay', role: 'dialog', 'aria-label': `Night ${nightNumber}` },
    h('div', { class: 'panel' },
      h('h2', {}, `Night ${nightNumber}`),
      h('p', {}, 'Monsters come out of the woods and try to steal snacks from the campfire. Keep them away until sunrise!'),
      h('div', { class: 'keys' }, ...(isTouch ? [h('span', { class: 'key' }, COPY.howToTouch)] : [
        h('span', { class: 'key' }, 'Move: WASD or arrows'),
        h('span', { class: 'key' }, 'Sword: Space'),
        h('span', { class: 'key' }, 'Shoot: click where you aim'),
        h('span', { class: 'key' }, 'Pause: Esc'),
      ])),
      h('button', { class: 'btn btn-main', type: 'button', onclick: () => { intro.remove(); scene()?.begin(); } }, COPY.start)));
  layer.append(intro);
  show(layer);
  (intro.querySelector('.btn-main') as HTMLElement).focus();

  const data = {
    loadout: { pet: progress.pet, ranged: progress.ranged, pack: progress.pack },
    nightNumber,
    seed: Math.floor(Math.random() * 1e9),
    hud,
    controls,
    onPauseKey: () => { if (!intro.isConnected) togglePause(); },
    onEnd: (r: { saved: boolean; bonks: number; crystals: number; dragonPower: number }) => {
      progress = applyNightResult(progress, r);
      saveProgress(store, progress);
      const played = nightNumber;
      if (r.saved) nightNumber += 1;
      stopGame();
      show(resultScreen(
        { saved: r.saved, nightNumber: played, bonks: r.bonks, crystals: r.crystals, dragonPower: r.dragonPower, totalPower: progress.dragonPower },
        () => startNight(),
        () => ctx.go('title'),
      ));
    },
  };

  gameEl.style.visibility = 'visible';
  if (!game) {
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: gameEl,
      width: 1280,
      height: 800,
      backgroundColor: '#070b22',
      scale: { mode: Phaser.Scale.NONE },
      input: { activePointers: 3 },
      render: { antialias: true, maxLights: 16 } as Phaser.Types.Core.RenderConfig,
      scene: [],
      banner: false,
    });
    game.scene.add('play', PlayScene, true, data);
  } else {
    game.scene.start('play', data);
  }
  fit();
}

// Expose a tiny hook for automated checks (not used by players).
(window as unknown as { __adventurey?: unknown }).__adventurey = { scene, get progress() { return progress; } };

fit();
ctx.go('title');
