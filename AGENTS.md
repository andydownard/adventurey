<!-- AGENT INSTRUCTIONS — read and obey before writing any code. -->
# Adventure-y: guard your pack's camp from cute-spooky monsters until sunrise

> **Global engineering contract:** https://github.com/rallytasks/agents/blob/main/AGENTS.md
> Every rule there applies to this repo. `GLOBAL_AGENTS.md` is a local copy of it. This file adds only project specifics and any `Override <ID>:` lines.
@GLOBAL_AGENTS.md

`CLAUDE.md` is a symlink to this file. Edit `AGENTS.md` only.

**Read first:** [docs/HOW_WE_BUILD_GAMES.md](./docs/HOW_WE_BUILD_GAMES.md) → this file. Worked examples from Time Clash are in [docs/time_clash_reference/](./docs/time_clash_reference/).

## What this is
Jack's game. You pick a pet (baby dragon, wolf pup or snow owl), a bow or crossbow, and a pack (Wolf, Dragon, Snow Fox or Bunny Pack). Then you guard the magic apple tree through a 2-minute night, and can run out to explore four wild areas while your pack holds camp. Cute-spooky monsters walk in from the woods to steal golden apples; if they take them all, the night is lost. Give crystals to animals out in the wild to make friends who follow and fight. Bonk them with the sword, shoot them, and your pet helps. Save the camp until sunrise to earn crystals and dragon power. Ideas and design decisions: [docs/JACKS_IDEA.md](./docs/JACKS_IDEA.md). Design canvas and art: `design/`.

Owner: Andy Downard. Built for and with his family. Stack choices favor simple, free, and fast to change.

## Stack
TypeScript · Vite · Phaser 3.90 (WebGL with Light2D lighting) · plain DOM and CSS for menus and the in-game display · Vitest · Playwright for a smoke check. Fonts self-hosted (@fontsource). Art made with Figma AI (files "Adventure-y concept art" and "Adventure-y open world regions", which also holds the animals, the tree, the apple and the new pack emblems). Screens are designed first on the Adventure-y canvas in Claude Design. No server, no network calls, progress saved in localStorage.

## Commands
test: `npm test` · lint: `npm run lint` (types + banned-word check) · typecheck: `npm run typecheck` · build: `npm run build` · run: `npm run dev` · browser smoke: `npm run smoke` (with `npx vite preview --port 4173` running)

## Current state (2026-11-19)
Phase 1 is built. It is hosted on Railway at https://adventurey.rallytasks.com (project "Games", service "adventurey"), which rebuilds from `main` on every push (`railway.json`: `npm run build`, then `npm start` serves `dist/`). Do not host it on GitHub Pages.
- Start screen: moon name, Play, Explore, Choose your gear, Choose your pack, Pet box, sound on/off. Play with friends still says "Coming soon" (next: online rooms with a 4-letter code, see the design canvas).
- The camp guards a magic apple tree (`public/art/tree.png`) that stands over the painted fire ring. One golden apple shows on the tree per apple left (`campHealth` in code). "Apples" in the HUD.
- Explore mode (`mode: 'explore'`): no tree to guard and no sunrise. Monsters come out off screen around the hero and chase; it gets harder over 8 minutes (`EXPLORE` in config). Crystals grow back after 45 s. Head home any time (HUD button or pause) to keep crystals and new friends.
- Animal friends (`ANIMALS` in config): 8 animals live in the wild (Snow Fox, Penguin, Bunny Archer, Bear Cub, Mushroom Wizard, Cave Bat, Hedgehog, Mountain Goat). Stand next to one and tap Give a crystal (E key, Y on a controller). Friends follow, fight, and are saved in the Pet box; up to 7 come along each night (`Progress.friends` and `Progress.team`). The bunny shoots arrows; the mushroom's spell scatters every monster near its target.
- Crystals: saved ones can be spent on animals. You earn them by picking them up, by shooting them with an arrow, and one for every 3 monsters sent home.
- Packs: Wolf (run faster), Dragon (pet hits harder), Snow Fox (crystals jump to you from farther away), Bunny (bow reloads faster). `PACK_PERKS` in config.
- Every night is harder than the last up to night 12 (`LEVELS` in config, `levelFor()` in night.ts): fewer apples, faster and tougher monsters, more at once, more big ones, more wild monsters (`fromNight` on wanderers). Camp helpers attack about every 2 seconds; an empty camp loses a few apples on night 1, can fall by night 6, and always falls by night 9.
- A 2-minute night of camp defense with walking sprites for the hero, pet, and two pack mates (staff and shield). Pack mates guard the fire but only help a little; the hero is the main fighter.
- The sword is its own sprite and sweeps on Space or the Sword button.
- Sound is made in code (`src/audio/sound.ts`, no files). It starts only after a tap or key press. The mute choice is saved.
- iPad: joystick and Sword button, tap anywhere on the game to shoot the bow or crossbow there (a ring marks the tap; a tap during reload fires as soon as it is ready), no zoom or text selection, and a "turn sideways" message in portrait. Safari ignores the page's no-zoom setting, so `src/main.ts` blocks pinch (gesture events) and double-tap zoom itself. Checked by `scripts/smoke-ipad.mjs` (Chrome) and `scripts/smoke-webkit.mjs` (Safari's engine; run `npx playwright install webkit` once).
- Rules live in `src/game/` with no Phaser imports; every balance number is in `src/game/config.ts`.
- Open world: four painted areas join the camp at its trails: Snow Land (left), Crystal Caves (right), Mountain Range (top), Old Forest (bottom). The hero can walk out any time. Each area has crystals to pick up, wild monsters that roam and chase, its own glow and moonlight color, and a title banner on arrival. An arrow points back to camp.
- Night 1 balance (2026-11-14, after "way too hard" on iPad): 20 apples, slow monsters, only 4 at once, 2 wild monsters per area, a big fast sword swing. Later nights climb from there (see LEVELS).
- The hero turns smoothly (spins around and leans into the walk) instead of snapping left and right.
- A game controller works: left stick or d-pad to walk, A or RB to swing, X or RT to shoot, Start to pause.
- Area shapes, lights, crystals and wild monsters are in `REGIONS` in `src/game/config.ts`, in each picture's own coordinates. Map edges are darkened into the pictures by `bake_edges.py` (kept outside the repo with the original art), leaving trail crossings lit.

## Vocabulary
| User sees | Code uses | NEVER say in UI |
|---|---|---|
| Monster (cute-spooky) | `gloom` sprite, `Monster` | enemy, zombie |
| Sent home, Poof! | `poof`, `bonks` | kill, die, dead, defeat |
| Apple stolen! | `snack` | damage, hurt |
| Dizzy! | `dizzy` | hit, wounded |
| Apples (on the magic tree) | `campHealth` | lives, base HP |
| Crystals | `gems` (in hand), `crystals` (saved) | gems, currency, coins |
| Animal friends, Pet box | `Animal`, `friends`, `team` | units, recruits |

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
| 7 | The Back button on the gear, pack and pet box screens could not be tapped: the title strip lay on top of it | The title strip uses `pointer-events:none`; `smoke-friends.mjs` taps Back on the pet box |
| 8 | Heading home from Explore played the 3-second sunrise, so a quick reload could lose new friends | Only a real sunrise plays it; `smoke-friends.mjs` heads home and checks the fox is saved |
| 6 | iPad crossbow: taps during reload were thrown away, the bottom Sword/Crossbow pictures blocked taps, and the intro said to tap a Shoot button that does not exist | Taps wait up to 0.9 s of game time for reload; only real controls catch taps in the display; `smoke-crossbow.mjs` (Safari engine) picks the crossbow and checks each tap shoots toward the spot |

## Doc index
| Topic | File |
|---|---|
| How we build games | [docs/HOW_WE_BUILD_GAMES.md](./docs/HOW_WE_BUILD_GAMES.md) |
| Time Clash docs (worked examples) | [docs/time_clash_reference/](./docs/time_clash_reference/) |
| Global rules (copy) | [GLOBAL_AGENTS.md](./GLOBAL_AGENTS.md) |
| Backlog and inbox | [BACKLOG.md](./BACKLOG.md), [INBOX.md](./INBOX.md) |
