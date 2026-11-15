// Safari-engine (WebKit) iPad check: zoom stays blocked, the joystick walks, fast menu taps work.
import { webkit, devices } from 'playwright';
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices['iPad Pro 11 landscape'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.goto(process.argv[2] ?? 'http://localhost:4173/');
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Choose your pack' }).tap();
await page.getByRole('button', { name: /Wolf Pack/ }).tap();
await page.getByRole('button', { name: 'Go to camp' }).tap();
await page.waitForTimeout(3000);
await page.getByRole('button', { name: 'Start the night' }).tap();
const fps = async () => page.evaluate(() => { const g = window.__adventurey.scene().game; return { fps: Math.round(g.loop.actualFps), t: window.__adventurey.scene().s.t.toFixed(2), webgl: g.renderer.type === 2, lost: g.renderer.contextLost ?? null }; });
await page.waitForTimeout(2000);
console.log('after 2s', JSON.stringify(await fps()));
const before = await page.evaluate(() => ({ ...window.__adventurey.scene().s.hero.pos }));
const box = await page.locator('.stick').boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
await page.mouse.move(cx, cy); await page.mouse.down();
for (let i = 1; i <= 8; i++) { await page.mouse.move(cx + i * 7, cy); await page.waitForTimeout(30); }
await page.waitForTimeout(1500);
await page.mouse.up();
const after = await page.evaluate(() => ({ ...window.__adventurey.scene().s.hero.pos }));
console.log('stick moved hero', Math.round(after.x - before.x), Math.round(after.y - before.y));
await page.waitForTimeout(3000);
console.log('after 6s', JSON.stringify(await fps()));
// Pinch (Safari gesture events) and double-taps must not zoom the page.
const pinchBlocked = await page.evaluate(() => { const e = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(e); return e.defaultPrevented; });
await page.touchscreen.tap(700, 300); await page.waitForTimeout(80); await page.touchscreen.tap(700, 300);
await page.waitForTimeout(600);
const zoom = await page.evaluate(() => window.visualViewport ? window.visualViewport.scale : 1);
console.log('PINCH BLOCKED', pinchBlocked, 'ZOOM', zoom);
await page.screenshot({ path: 'test-results/wk-ipad.png' });
if (!pinchBlocked || zoom !== 1 || errors.length) process.exitCode = 1;
console.log('ERRORS', errors.length, errors.slice(0, 12).join('\n'));
await browser.close();
