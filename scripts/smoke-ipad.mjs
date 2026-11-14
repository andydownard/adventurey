// iPad check: landscape and portrait, touch taps, joystick drag, sword button.
import { chromium, devices } from 'playwright';
const out = 'test-results/'; (await import('node:fs')).mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ipad = devices['iPad Pro 11 landscape'] ?? { viewport: { width: 1194, height: 834 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const ctx = await browser.newContext({ ...ipad, defaultBrowserType: undefined });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:4173/');
await page.waitForTimeout(1200);
await page.screenshot({ path: out + 'ipad-1-title.png' });
await page.getByRole('button', { name: 'Choose your pack' }).tap();
await page.getByRole('button', { name: /Wolf Pack/ }).tap();
await page.getByRole('button', { name: 'Go to camp' }).tap();
await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'Start the night' }).tap();
await page.waitForTimeout(500);
const stick = await page.locator('.stick').boundingBox();
const sword = await page.locator('.touch-sword').boundingBox();
console.log('STICK', JSON.stringify(stick), 'SWORD', JSON.stringify(sword));
const before = await page.evaluate(() => ({ ...window.__adventurey.scene().s.hero.pos }));
// Drag the joystick to the right with a real touch.
const cdp = await ctx.newCDPSession(page);
const cx = stick.x + stick.width / 2, cy = stick.y + stick.height / 2;
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + i * 7, y: cy, id: 1 }] }); await page.waitForTimeout(30); }
await page.waitForTimeout(700);
await page.screenshot({ path: out + 'ipad-2-walk.png' });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const after = await page.evaluate(() => ({ ...window.__adventurey.scene().s.hero.pos }));
console.log('HERO MOVED', (after.x - before.x).toFixed(0), (after.y - before.y).toFixed(0));
// Tap the sword button.
let swings = 0;
await page.evaluate(() => { window.__swings = 0; const sc = window.__adventurey.scene(); const orig = sc.onSwingSeen; });
await page.locator('.touch-sword').tap();
await page.waitForFunction(() => window.__adventurey.scene().s.hero.swordCd > 0, null, { timeout: 8000 });
await page.waitForFunction(() => { const sc = window.__adventurey.scene(); return Math.abs(sc.sword.angle) < 120; }, null, { timeout: 8000, polling: 'raf' }).then(() => console.log('SWORD SWEEP seen'), () => console.log('SWORD SWEEP not seen'));
await page.screenshot({ path: out + 'ipad-3-swing.png' });
// Tap to shoot on the field.
await page.waitForFunction(() => window.__adventurey.scene().s.hero.shotCd <= 0, null, { timeout: 8000 });
await page.touchscreen.tap(900, 250);
await page.waitForFunction(() => window.__adventurey.scene().s.arrows.length > 0, null, { timeout: 8000 });
const shot = await page.evaluate(() => { const s = window.__adventurey.scene().s; const a = s.arrows[0]; return { hero: s.hero.pos, vel: a.vel }; });
console.log('SHOT goes', shot.vel.x > 0 ? 'right' : 'left', shot.vel.y < 0 ? 'up' : 'down');
await page.waitForTimeout(150);
await page.screenshot({ path: out + 'ipad-2b-shot.png' });
// Portrait.
await page.setViewportSize({ width: 834, height: 1194 });
await page.waitForTimeout(300);
await page.screenshot({ path: out + 'ipad-4-portrait.png' });
console.log('ROTATE VISIBLE', await page.locator('.rotate').isVisible());
console.log('ERRORS', errors.length, errors.slice(0, 10).join('\n'));
await browser.close();
