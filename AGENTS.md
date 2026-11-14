<!-- AGENT INSTRUCTIONS — read and obey before writing any code. -->
# Adventure-y: guard your pack's camp from cute-spooky monsters until sunrise

> **Global engineering contract:** https://github.com/rallytasks/agents/blob/main/AGENTS.md
> Every rule there applies to this repo. `GLOBAL_AGENTS.md` is a local copy of it. This file adds only project specifics and any `Override <ID>:` lines.
@GLOBAL_AGENTS.md

`CLAUDE.md` is a symlink to this file. Edit `AGENTS.md` only.

**Read first:** [docs/HOW_WE_BUILD_GAMES.md](./docs/HOW_WE_BUILD_GAMES.md) → this file. Worked examples from Time Clash are in [docs/time_clash_reference/](./docs/time_clash_reference/).

## What this is
Jack's game. You pick a pet (baby dragon, wolf pup or snow owl), a bow or crossbow, and a pack (Wolf Pack or Dragon Pack). Then you guard the campfire through a 90-second night. Cute-spooky monsters walk in from the woods to steal snacks. Bonk them with the sword, shoot them, and your pet helps. Save the camp until sunrise to earn crystals and dragon power. Ideas and design decisions: [docs/JACKS_IDEA.md](./docs/JACKS_IDEA.md). Design canvas and art: `design/`.

Owner: Andy Downard. Built for and with his family. Stack choices favor simple, free, and fast to change.

## Stack
TypeScript · Vite · Phaser 3.90 (WebGL with Light2D lighting) · plain DOM and CSS for menus and the in-game display · Vitest · Playwright for a smoke check. Fonts self-hosted (@fontsource). Art made with Figma AI (file "Adventure-y concept art"). No server, no network calls, progress saved in localStorage.

## Commands
test: `npm test` · lint: `npm run lint` (types + banned-word check) · typecheck: `npm run typecheck` · build: `npm run build` · run: `npm run dev` · browser smoke: `npm run smoke` (with `npx vite preview --port 4173` running)

## Current state (2026-11-13)
Phase 1 is built: start screen (moon name, Play, Choose your gear, Choose your pack; Explore and Play with friends say "Coming soon"), gear and pack pickers, one night of camp defense, sunrise and try-again screens, saved progress. Nights get harder each time. Rules live in `src/game/` with no Phaser imports; every balance number is in `src/game/config.ts`. Playable copy: https://claude.ai/artifact/WYth2gUXe3xxJTWkTUntL5

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

## Doc index
| Topic | File |
|---|---|
| How we build games | [docs/HOW_WE_BUILD_GAMES.md](./docs/HOW_WE_BUILD_GAMES.md) |
| Time Clash docs (worked examples) | [docs/time_clash_reference/](./docs/time_clash_reference/) |
| Global rules (copy) | [GLOBAL_AGENTS.md](./GLOBAL_AGENTS.md) |
| Backlog and inbox | [BACKLOG.md](./BACKLOG.md), [INBOX.md](./INBOX.md) |
