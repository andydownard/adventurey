// Fails when a banned word shows up in the player-facing copy or the screen code.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const banned = ['kill', 'die', 'dead', 'death', 'blood', 'gore', 'defeat', 'murder', 'buy', 'price', 'war'];
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => {
  const p = join(d, f);
  if (statSync(p).isDirectory()) walk(p);
  else if (/\.(ts|html|css)$/.test(f)) files.push(p);
});
walk('src');
files.push('index.html');

let bad = 0;
for (const f of files) {
  if (f.endsWith('copy.ts')) {
    // Only the strings inside COPY, not the BANNED list itself.
    const text = readFileSync(f, 'utf8').split('export const BANNED')[0];
    check(f, text);
  } else if (f.includes('/ui/') || f.endsWith('index.html')) {
    check(f, readFileSync(f, 'utf8'));
  }
}
function check(f, text) {
  const strings = text.match(/(['"`])(?:(?!\1).)*\1/g) || [];
  for (const s of strings) {
    for (const w of banned) {
      if (new RegExp(`\\b${w}\\b`, 'i').test(s)) {
        console.error(`${f}: banned word "${w}" in ${s}`);
        bad++;
      }
    }
  }
}
if (bad) process.exit(1);
console.log(`copy check passed (${files.length} files)`);
