import { chromium } from 'playwright';
const out = 'test-results/'; (await import('node:fs')).mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:4173/');
await page.waitForTimeout(1200);
await page.screenshot({ path: out + '1-title.png' });
await page.getByRole('button', { name: 'Choose your pack' }).click();
await page.getByRole('button', { name: /Dragon Pack/ }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: out + '3-pack.png' });
await page.getByRole('button', { name: 'Go to camp' }).click();
await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'Start the night' }).click();
await page.evaluate(() => window.__adventurey.scene().advance(38));
await page.waitForTimeout(900);
await page.screenshot({ path: out + '8-monsters.png' });
// swing at the nearest monster and shoot another
await page.evaluate(() => {
  const sc = window.__adventurey.scene(); const s = sc.s;
  const m = s.monsters.sort((a, b) => Math.hypot(a.pos.x - 768, a.pos.y - 456) - Math.hypot(b.pos.x - 768, b.pos.y - 456))[0];
  if (m) { s.hero.pos = { x: m.pos.x - 70, y: m.pos.y }; s.hero.facing = { x: 1, y: 0 }; }
  const other = s.monsters[1];
  sc.advance(1 / 60, { move: { x: 0, y: 0 }, swing: true, shoot: null });
  if (other) sc.advance(1 / 60, { move: { x: 0, y: 0 }, swing: false, shoot: { x: other.pos.x, y: other.pos.y - 30 } });
});
await page.waitForTimeout(250);
await page.screenshot({ path: out + '9-action.png' });
const st = await page.evaluate(() => { const s = window.__adventurey.scene().s; return { t: s.t.toFixed(1), camp: s.campHealth, monsters: s.monsters.length, bonks: s.bonks }; });
console.log('STATE', JSON.stringify(st));
await page.evaluate(() => window.__adventurey.scene().advance(60));
await page.waitForTimeout(5000);
await page.screenshot({ path: out + '10-end.png' });
console.log('ERRORS', errors.length, errors.slice(0, 10).join('\n'));
await browser.close();
