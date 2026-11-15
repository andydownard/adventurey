<!-- AGENT INSTRUCTIONS — read and obey before writing any code. -->
# Adventure-y: guard your pack's camp from cute-spooky monsters until sunrise

> **Global engineering contract:** https://github.com/rallytasks/agents/blob/main/AGENTS.md
> Every rule there applies to this repo. `GLOBAL_AGENTS.md` is a local copy of it. This file adds only project specifics and any `Override <ID>:` lines.
@GLOBAL_AGENTS.md

`CLAUDE.md` is a symlink to this file. Edit `AGENTS.md` only.

**Read first:** [docs/HOW_WE_BUILD_GAMES.md](./docs/HOW_WE_BUILD_GAMES.md) → this file. Worked examples from Time Clash are in [docs/time_clash_reference/](./docs/time_clash_reference/).

## What this is
Jack's game. You pick a pet (baby dragon, wolf pup or snow owl), a bow or crossbow, and a pack (Wolf Pack or Dragon Pack). Then you guard the campfire through a 2-minute night, and can run out to explore four wild areas while your pack holds camp. Cute-spooky monsters walk in from the woods to steal snacks. Bonk them with the sword, shoot them, and your pet helps. Save the camp until sunrise to earn crystals and dragon power. Ideas and design decisions: [docs/JACKS_IDEA.md](./docs/JACKS_IDEA.md). Design canvas and art: `design/`.

Owner: Andy Downard. Built for and with his family. Stack choices favor simple, free, and fast to change.

## Stack
TypeScript · Vite · Phaser 3.90 (WebGL with Light2D lighting) · plain DOM and CSS for menus and the in-game display · Vitest · Playwright for a smoke check. Fonts self-hosted (@fontsource). Art made with Figma AI (files "Adventure-y concept art" and "Adventure-y open world regions"). No server, no network calls, progress saved in localStorage.

## Commands
test: `npm test` · lint: `npm run lint` (types + banned-word check) · typecheck: `npm run typecheck` · build: `npm run build` · run: `npm run dev` · browser smoke: `npm run smoke` (with `npx vite preview --port 4173` running)

## Current state (2026-11-14)
Phase 1 is built. It is hosted on Railway at https://adventurey.rallytasks.com (project "Games", service "adventurey"), which rebuilds from `main` on every push (`railway.json`: `npm run build`, then `npm start` serves `dist/`). Do not host it on GitHub Pages.
- Start screen: moon name, Play, Choose your gear, Choose your pack, sound on/off. Explore and Play with friends carry a "Coming soon" tag.
- A 2-minute night of camp defense with walking sprites for the hero, pet, and two pack mates (staff and shield). Pack mates guard the fire but only help a little; the hero is the main fighter.
- The sword is its own sprite and sweeps on Space or the Sword button.
- Sound is made in code (`src/audio/sound.ts`, no files). It starts only after a tap or key press. The mute choice is saved.
- iPad: joystick and Sword button, tap anywhere on the game to shoot the bow or crossbow there (a ring marks the tap; a tap during reload fires as soon as it is ready), no zoom or text selection, and a "turn sideways" message in portrait. Safari ignores the page's no-zoom setting, so `src/main.ts` blocks pinch (gesture events) and double-tap zoom itself. Checked by `scripts/smoke-ipad.mjs` (Chrome) and `scripts/smoke-webkit.mjs` (Safari's engine; run `npx playwright install webkit` once).
- Rules live in `src/game/` with no Phaser imports; every balance number is in `src/game/config.ts`.
- Open world: four painted areas join the camp at its trails: Snow Land (left), Crystal Caves (right), Mountain Range (top), Old Forest (bottom). The hero can walk out any time. Each area has crystals to pick up, wild monsters that roam and chase, its own glow and moonlight color, and a title banner on arrival. An arrow points back to camp.
- Balance (2026-11-14, after "way too hard" and "too many monsters at once" on iPad): camp has 20 snacks; monsters are slower and come less often; only 4 may head for camp at once on night 1 (one more each night, up to 8); 2 wild monsters per area with a short chase range; a bigger, faster sword swing. While the hero is out, monsters reach camp 1.3x more slowly. An empty camp still loses snacks every night, more on later nights.
- The hero turns smoothly (spins around and leans into the walk) instead of snapping left and right.
- A game controller works: left stick or d-pad to walk, A or RB to swing, X or RT to shoot, Start to pause.
- Area shapes, lights, crystals and wild monsters are in `REGIONS` in `src/game/config.ts`, in each picture's own coordinates. Map edges are darkened into the pictures by `bake_edges.py` (kept outside the repo with the original art), leaving trail crossings lit.

## Vocabulary
| User sees | Code uses | NEVER say in UI |
|---|---|---|
| Monster (cute-spooky) | `gloom` sprite, `Monster` | enemy, zombie |
| Sent home, Poof! | `poof`, `bonks` | kill, die, dead, defeat |
| Snack stolen! | `snack` | damage, hurt |
| Dizzy! | `dizzy` | hit, wounded |
| Camp | `campHealth` | lives, base HP |

## Top damage risks
To be written. Start from the Time Clash list: nothing gory or mean, no data collected from children, sound that autoplays or cannot be skipped, hard-to-use controls, and rules drifting from art.

## Shipping gates
To be written (three gates, see the playbook).

## Project rules & overrides
To be written.

## Regressions
| # | What broke | Rule/test that prevents it |
|---|---|---|
| 1 | The night's overlay layer covered the game, so taps and clicks on the field did nothing | Layer uses `pointer-events:none`; `smoke-ipad.mjs` checks a tap shoots |
| 2 | Space swung in the rules but nothing moved on screen | Separate sword sprite; `smoke-ipad.mjs` checks the sweep is seen |
| 3 | Wild monsters waited at trail entrances, so a hero arriving got dizzy at once | Test "do not wait right at a trail entrance" in `tests/night.test.ts` |
| 4 | On a real iPad, holding the joystick while tapping Sword (a pinch) or double-tapping zoomed the page; the game looked frozen, the joystick stopped working, and the hero slid off screen | Gesture and double-tap blocks in `src/main.ts`; `smoke-webkit.mjs` checks pinch is blocked and zoom stays 1 |
| 5 | Blocking quick double-taps also swallowed fast taps on menu buttons | Buttons and the joystick are exempt; `smoke-ipad.mjs` taps through the menus quickly |
| 6 | iPad crossbow: taps during reload were thrown away, the bottom Sword/Crossbow pictures blocked taps, and the intro said to tap a Shoot button that does not exist | Taps wait up to 0.9 s of game time for reload; only real controls catch taps in the display; `smoke-crossbow.mjs` (Safari engine) picks the crossbow and checks each tap shoots toward the spot |

## Doc index
| Topic | File |
|---|---|
| How we build games | [docs/HOW_WE_BUILD_GAMES.md](./docs/HOW_WE_BUILD_GAMES.md) |
| Time Clash docs (worked examples) | [docs/time_clash_reference/](./docs/time_clash_reference/) |
| Global rules (copy) | [GLOBAL_AGENTS.md](./GLOBAL_AGENTS.md) |
| Backlog and inbox | [BACKLOG.md](./BACKLOG.md), [INBOX.md](./INBOX.md) |
