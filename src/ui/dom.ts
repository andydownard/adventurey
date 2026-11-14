type Attrs = Record<string, string | number | boolean | EventListener | undefined>;
type Child = Node | string | null | undefined | false;

/** Build a DOM element. Keys starting with "on" become event listeners. */
export function h(tag: string, attrs: Attrs = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'style') el.setAttribute('style', String(v));
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export function svgIcon(paths: string, color = 'currentColor', size = 22): SVGElement {
  const wrap = document.createElement('span');
  wrap.innerHTML = `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return wrap.firstElementChild as SVGElement;
}

export const ICONS = {
  play: '<polygon points="7 4 20 12 7 20 7 4"></polygon>',
  compass: '<circle cx="12" cy="12" r="10"></circle><polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9 16.2 7.8"></polygon>',
  sword: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"></path><path d="M13 19l6-6"></path><path d="M16 16l4 4"></path><path d="M19 21l2-2"></path>',
  paw: '<circle cx="5.5" cy="10" r="2"></circle><circle cx="9.5" cy="5.5" r="2"></circle><circle cx="14.5" cy="5.5" r="2"></circle><circle cx="18.5" cy="10" r="2"></circle><path d="M12 11c-3 0-5.5 3.5-5.5 6 0 2 1.5 3 3 3 1 0 1.5-.5 2.5-.5s1.5.5 2.5.5c1.5 0 3-1 3-3 0-2.5-2.5-6-5.5-6z"></path>',
  back: '<path d="M15 6l-6 6 6 6"></path>',
  next: '<path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path>',
  soundOn: '<path d="M11 5 6 9H3v6h3l5 4z"></path><path d="M15.5 8.5a5 5 0 0 1 0 7"></path><path d="M18.5 5.5a9 9 0 0 1 0 13"></path>',
  soundOff: '<path d="M11 5 6 9H3v6h3l5 4z"></path><path d="M22 9l-6 6"></path><path d="M16 9l6 6"></path>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path>',
  fire: '<path d="M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-4 3-6 6-10z"></path><path d="M12 13a2 2 0 0 0-2 2"></path>',
};

export function fireflies(count: number, seed = 1): HTMLElement[] {
  let a = seed;
  const r = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: count }, () => {
    const s = [4, 5, 6][Math.floor(r() * 3)];
    return h('div', {
      class: 'firefly',
      'aria-hidden': 'true',
      style: `left:${Math.round(r() * 1280)}px;top:${Math.round(420 + r() * 360)}px;width:${s}px;height:${s}px;animation-delay:${(r() * -6).toFixed(2)}s;animation-duration:${(4 + r() * 4).toFixed(1)}s`,
    });
  });
}
