import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/800.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './styles/ui.css';
import Phaser from 'phaser';
import { sound } from './audio/sound';
import { COPY } from './data/copy';
import { applyNightResult, loadProgress, saveProgress, type Progress } from './game/progress';
import { PlayScene, type PlayResult } from './scenes/PlayScene';
import type { Mode } from './game/night';
import { h } from './ui/dom';
import { createHud, type Controls } from './ui/hud';
import { gearScreen, packScreen, petBoxScreen, resultScreen, titleScreen, type AppCtx } from './ui/screens';

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
const isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

// Sound may only start after a tap. iPad Safari counts touchend and click, so listen to all of them.
for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, () => sound.unlock(), { capture: true, passive: true });

// iPad Safari ignores "no zoom" in the page settings. Holding the joystick while tapping Sword
// looks like a pinch, and two quick taps look like a double-tap, so Safari zoomed the page and the
// game seemed to freeze. Block both here.
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  // Buttons and the joystick are safe already (CSS touch-action), and kids tap them fast.
  if ((e.target as Element | null)?.closest?.('button, a, input, .stick')) return;
  const now = performance.now();
  if (now - lastTouchEnd < 350 && e.cancelable) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 && e.cancelable) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

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
    if (screen === 'pets') show(petBoxScreen(ctx));
  },
  startNight: () => startNight('camp'),
  startExplore: () => startNight('explore'),
  toast,
};

function stopGame() {
  scene()?.shutdownSound();
  sound.pause(false);
  if (game && game.scene.isActive('play')) game.scene.stop('play');
  gameEl.style.visibility = 'hidden';
}

function scene(): PlayScene | null {
  return (game?.scene.getScene('play') as PlayScene) ?? null;
}

function startNight(mode: Mode = 'camp') {
  const exploring = mode === 'explore';
  const controls: Controls = { move: { x: 0, y: 0 }, swing: false };
  // The layer lets taps and clicks reach the game; only its panels catch them.
  const layer = h('div', { style: 'position:absolute;inset:0;pointer-events:none' });
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
    pausedPanel = h('div', { class: 'overlay', style: 'pointer-events:auto', role: 'dialog', 'aria-label': COPY.paused },
      h('div', { class: 'panel' },
        h('h2', {}, COPY.paused),
        h('div', { style: 'display:flex;gap:16px' },
          exploring
            ? h('button', { class: 'btn btn-alt', type: 'button', onclick: () => { pausedPanel?.remove(); pausedPanel = null; sc.setPaused(false); sc.goHome(); } }, COPY.hud.headHome)
            : h('button', { class: 'btn btn-alt', type: 'button', onclick: () => ctx.go('title') }, COPY.leave),
          h('button', { class: 'btn btn-main', type: 'button', onclick: togglePause }, COPY.resume))));
    layer.append(pausedPanel);
    (pausedPanel.querySelector('.btn-main') as HTMLElement).focus();
  };

  const hud = createHud({ name: progress.name, pack: progress.pack, ranged: progress.ranged, nightNumber, mode, controls, touch: isTouch, onPause: togglePause, onHeadHome: () => scene()?.goHome() });
  layer.append(hud.el);

  const introTitle = exploring ? COPY.explore : `Night ${nightNumber}`;
  const intro = h('div', { class: 'overlay', style: 'pointer-events:auto', role: 'dialog', 'aria-label': introTitle },
    h('div', { class: 'panel' },
      h('h2', {}, introTitle),
      h('p', {}, exploring ? COPY.exploreIntro : COPY.nightIntro),
      h('div', { class: 'keys' }, ...(isTouch ? [h('span', { class: 'key' }, COPY.howToTouch)] : [
        h('span', { class: 'key' }, 'Move: WASD or arrows'),
        h('span', { class: 'key' }, 'Sword: Space'),
        h('span', { class: 'key' }, 'Shoot: click where you aim'),
        h('span', { class: 'key' }, 'Give a crystal: E'),
        h('span', { class: 'key' }, 'Pause: Esc'),
      ])),
      h('button', { class: 'btn btn-main', type: 'button', onclick: () => { intro.remove(); scene()?.begin(); } }, exploring ? COPY.startExplore : COPY.start)));
  layer.append(intro);
  show(layer);
  (intro.querySelector('.btn-main') as HTMLElement).focus();

  const data = {
    loadout: { pet: progress.pet, ranged: progress.ranged, pack: progress.pack },
    nightNumber,
    mode,
    gems: progress.crystals,
    friends: progress.team,
    seed: Math.floor(Math.random() * 1e9),
    hud,
    controls,
    onPauseKey: () => { if (!intro.isConnected) togglePause(); },
    onEnd: (r: PlayResult) => {
      progress = applyNightResult(progress, r);
      saveProgress(store, progress);
      const played = nightNumber;
      if (r.saved && r.mode === 'camp') nightNumber += 1;
      stopGame();
      show(resultScreen(
        { saved: r.saved, explore: r.mode === 'explore', nightNumber: played, bonks: r.bonks, crystals: r.crystals, dragonPower: r.dragonPower, totalPower: progress.dragonPower, newFriends: r.newFriends },
        () => startNight(r.mode),
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
