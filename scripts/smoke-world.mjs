// Open-world check: walk out of camp on each trail and take a picture of each area.
import { chromium } from 'playwright';
const out = 'test-results/'; (await import('node:fs')).mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:4173/');
await page.waitForTimeout(1200);
await page.getByRole('button', { name: 'Choose your pack' }).click();
await page.getByRole('button', { name: /Wolf Pack/ }).click();
await page.getByRole('button', { name: 'Go to camp' }).click();
await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'Start the night' }).click();
await page.waitForTimeout(300);

const trips = [
  ['snow', { x: 200, y: 535 }, { x: -1, y: 0 }],
  ['cave', { x: 1340, y: 535 }, { x: 1, y: 0 }],
  ['mountain', { x: 815, y: 150 }, { x: 0, y: -1 }],
  ['forest', { x: 815, y: 880 }, { x: 0, y: 1 }],
];
for (const [name, start, dir] of trips) {
  // Put the hero at the trail head, then really walk out using the game's own controls.
  await page.evaluate(([p]) => { const sc = window.__adventurey.scene(); sc.s.hero.pos = { ...p }; }, [start]);
  const reached = await page.evaluate(([d, name]) => {
    const sc = window.__adventurey.scene();
    sc.advance(3.2, { move: d, swing: false, shoot: null });
    sc.cameras.main.centerOn(sc.s.hero.pos.x, sc.s.hero.pos.y);
    return sc.s.region === name;
  }, [dir, name]);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}world-${name}.png` });
  console.log(name.padEnd(9), reached ? 'reached' : 'NOT REACHED', JSON.stringify(await page.evaluate(() => { const s = window.__adventurey.scene().s; return { hero: { x: Math.round(s.hero.pos.x), y: Math.round(s.hero.pos.y) }, wild: s.monsters.filter((m) => m.wild).length, camp: s.campHealth }; })));
}
// Pick up a crystal.
const got = await page.evaluate(() => {
  const sc = window.__adventurey.scene(); const c = sc.s.crystals.find((x) => x.region === 'forest');
  sc.s.hero.pos = { x: c.pos.x - 30, y: c.pos.y };
  sc.advance(0.2, { move: { x: 0, y: 0 }, swing: false, shoot: null });
  return sc.s.crystalsFound;
});
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}world-crystal.png` });
console.log('crystals found', got);
console.log('ERRORS', errors.length, errors.slice(0, 10).join('\n'));
await browser.close();
