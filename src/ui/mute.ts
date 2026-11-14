import { sound } from '../audio/sound';
import { COPY } from '../data/copy';
import { h, ICONS, svgIcon } from './dom';

/** A sound on/off button. The choice is remembered on this device. */
export function muteButton(style: string): HTMLElement {
  const icon = () => (sound.muted ? ICONS.soundOff : ICONS.soundOn);
  const btn = h('button', { class: 'icon-btn', type: 'button', style, 'aria-pressed': String(sound.muted), 'aria-label': COPY.mute }, svgIcon(icon()));
  btn.addEventListener('click', () => {
    sound.unlock();
    sound.setMuted(!sound.muted);
    btn.setAttribute('aria-pressed', String(sound.muted));
    btn.replaceChildren(svgIcon(icon()));
  });
  return btn;
}
