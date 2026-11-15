// iPad (Safari engine): pick the crossbow, then tap the screen to shoot where you tap,
// including over the pictures at the bottom and during reload.
import { webkit, devices } from 'playwright';
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices['iPad Pro 11 landscape'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(process.argv[2] ?? 'http://localhost:4173/');
await page.waitForTimeout(1200);
await page.getByRole('button', { name: 'Choose your gear' }).tap();
await page.getByRole('button', { name: /Crossbow/ }).tap();
await page.getByRole('button', { name: /Next/ }).tap();
await page.getByRole('button', { name: /Wolf Pack/ }).tap();
await page.getByRole('button', { name: 'Go to camp' }).tap();
await page.waitForTimeout(3000);
await page.getByRole('button', { name: 'Start the night' }).tap();
await page.waitForTimeout(500);
const ranged = await page.evaluate(() => window.__adventurey.scene().s.loadout.ranged);
console.log('RANGED', ranged);
const scene = (fn) => page.evaluate(fn);
// Screen point -> where it lands in the world, to check the arrow heads the right way.
const aim = async (sx, sy) => {
  await page.touchscreen.tap(sx, sy);
  return scene(() => { const sc = window.__adventurey.scene(); return sc.queuedShot; });
};
// Wait until a new arrow appears (arrows get ids from the same counter as monsters).
const fired = async (since) => page.waitForFunction((n) => window.__adventurey.scene().s.arrows.some((a) => a.id >= n), since, { timeout: 20000 }).then(() => true, () => false);
let ok = true;
const check = async (label, sx, sy) => {
  const n = await scene(() => window.__adventurey.scene().s.nextId);
  const target = await aim(sx, sy);
  const got = await fired(n);
  const res = await page.evaluate((n) => { const s = window.__adventurey.scene().s; const a = s.arrows.find((x) => x.id >= n); return a ? { from: { x: a.pos.x - a.vel.x * 0.05, y: a.pos.y - a.vel.y * 0.05 }, vel: a.vel, hero: s.hero.pos } : null; }, n);
  let right = false;
  if (got && res && target) {
    const want = { x: target.x - res.hero.x, y: target.y - res.hero.y };
    const cos = (want.x * res.vel.x + want.y * res.vel.y) / (Math.hypot(want.x, want.y) * Math.hypot(res.vel.x, res.vel.y));
    right = cos > 0.9;
  }
  console.log(label.padEnd(34), got ? 'SHOT' : 'NO SHOT', right ? 'toward the tap' : 'WRONG WAY');
  ok &&= got && right;
};
await check('tap up-right', 950, 200);
// Tap again right away, during the crossbow's reload: it should still fire, once ready.
await check('tap left during reload', 150, 420);
await page.waitForTimeout(1500);
// Tap over the crossbow picture at the bottom of the screen.
const slot = await page.locator('.slot').nth(1).boundingBox();
await check('tap on the bottom crossbow picture', slot.x + slot.width / 2, slot.y + slot.height / 2);
await page.screenshot({ path: 'test-results/wk-crossbow.png' });
console.log('ERRORS', errors.length, errors.join('\n'));
if (!ok || ranged !== 'crossbow' || errors.length) process.exitCode = 1;
await browser.close();
