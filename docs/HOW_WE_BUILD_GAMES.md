# How we build games

This is the playbook we took from Time Clash (`~/projects/time_clash`, last commit 2026-11-04). It keeps the parts that apply to any family game and drops the Time Clash details. The full Time Clash docs are in [time_clash_reference/](./time_clash_reference/) as worked examples. The global engineering contract is [GLOBAL_AGENTS.md](../GLOBAL_AGENTS.md), and every rule in it applies here.

## 1. Who the game is for

- Andy builds the game for and with his family. The players are children.
- The game is free. No ads, no accounts, no purchases, no tracking, no analytics, no third-party scripts, no cookies.
- Progress stays in the browser (`localStorage`). Children's names never leave the device.
- The tone is slapstick. Nobody is hurt. No gore, no blood, nothing scary or mean.
- A copy lint blocks banned words in every UI string (Time Clash bans words like `kill`, `die`, `dead`, `blood`, `buy`, `price`, `army`, `war`).
- A vocabulary table maps what the player sees, what the code calls it, and what the UI must never say.

## 2. The workflow

1. **Brainstorm.** Talk the idea through and write it into `docs/GAME_SPEC.md`.
2. **Plan.** For any nontrivial change, post 3 to 10 numbered steps. Each step names its files and the failing test that gates it. Wait for Andy's GO. (`PLAN`)
3. **Test first.** Write the failing test, make it pass, then clean up. (`TDD`)
4. **Verify.** "Done" needs fresh proof in the same message: the commands run and their output, plus screenshots for any visual change. (`VERIFY`)
5. **Ship.** Open a pull request into `main`. Merge only with green CI. Confirm the deployed build shows its SHA.

A trivial change (typo, copy fix, one-line fix, docs only) skips the plan and the panel. Make it, test it, ship it.

## 3. The doc set every game starts with

| File | What it holds |
|---|---|
| `AGENTS.md` (with `CLAUDE.md` as a symlink to it) | Project rules, vocabulary, damage risks, shipping gates, regressions, current state, doc index |
| `GLOBAL_AGENTS.md` | Local copy of the global contract |
| `QUICKSTART.md` | Get running in 10 minutes |
| `ARCHITECTURE.md` | Folders, data shapes, how the parts talk |
| `docs/GAME_SPEC.md` | What the game is and every rule of play |
| `docs/BUILD.md` | Phased build plan, the start prompt to paste into Claude Code, and "Done means" |
| `docs/DESIGN_BRIEF.md` | A standalone brief to paste into Claude Design |
| `docs/DESIGN_SYSTEM.md` | Tokens and rules taken from the Claude Design handoff |
| `docs/DESIGN_GUIDANCE.md` | Notes from the design canvas comments (Andy's and the kids') |
| `docs/NARRATION.md` | Voice script, caption rules, and how the audio is made |
| `docs/CONTRACTS.md` | Shared types, who owns which functions, and dated decisions |
| `SECURITY.md` | Privacy and child safety |
| `INBOX.md`, `BACKLOG.md` | The only two tracking files |

## 4. Build in phases

- **Phase 1** is the local core loop (the MVP): one device, the smallest version that is fun. It lists screens, features with acceptance criteria, starting balance numbers, and the tests to write first.
- **Look and feel** comes next: swap placeholder shapes for the Claude Design art.
- Later phases add a hub, progression, crafting, and multiplayer, one at a time.
- Each phase in `docs/BUILD.md` ends with a clear "Done means".

## 5. How the code is shaped

- **Stack (Time Clash):** TypeScript, Vite, Phaser 3 for the game canvas, plain DOM and CSS for menus, Vitest for unit tests, Playwright for browser tests, and one small Node server on Railway.
- **Rules live apart from the engine.** Game rules sit in `src/game/` as plain TypeScript with no Phaser imports, and they are unit tested. Phaser only draws and plays sound. This stops rules and art from drifting apart.
- **Randomness is seeded** in all game logic, so tests repeat.
- **All balance numbers live in one config file** (`src/game/config.ts`). No magic numbers anywhere else.
- **New features ship behind a flag** in the config, with tests for both settings. Andy turns a flag on with a dated decision.
- **`localStorage` reads are wrapped in `try/catch`.** Storage can throw or come back empty.
- **The pace is a rule with a test.** Time Clash pins "a perfect player needs at least five turns to win" and plays simulated matches to prove it.

## 6. Design

1. Write `docs/DESIGN_BRIEF.md` so it stands alone, then paste it into Claude Design.
2. Andy and the kids comment on the canvas. Capture those comments in `docs/DESIGN_GUIDANCE.md`. A comment never overrides `AGENTS.md` unless Andy says so.
3. Turn the handoff into tokens (`src/styles/tokens.css`) and rules (`docs/DESIGN_SYSTEM.md`). Any color or font that drifts from the tokens is a bug.
4. Keep controls to three kinds: Button, Selector, and Link.
5. Self-host fonts. Load nothing from other sites.
6. All art is original. All sound is original or CC0, listed in `public/audio/CREDITS.md`. No real brands or copyrighted characters.

## 7. Accessibility floors

- Tap targets are at least 56px. Text is at least 20px.
- Contrast is at least 4.5:1 for body text and 3:1 for large UI.
- No meaning carried by color alone.
- Keyboard play works.
- Every spoken line has a caption.
- Reduced-motion settings swap big motion for fades.
- Text a child must read is at a third-grade reading level.
- Time Clash targets iPad landscape and laptop. Every visual change gets screenshots at 1280x800 and 1024x768.

## 8. Sound and voice

- Sound starts only after the first tap. Nothing autoplays.
- Skip, Replay, and Mute always work.
- Voice lines are recorded with the Kokoro text-to-speech model (voice `am_michael`). If a clip fails, the browser voice reads the line and the caption still shows.
- All audio is normalized to one volume. It is never loud.
- Tests run silent.

## 9. Shipping gates

Each game names three gates that every feature must pass. Time Clash uses:

1. **First five minutes.** A new family starts a match in 60 seconds, and the intro teaches the rules.
2. **Always fun.** A mistake never blocks play.
3. **The core idea is the game.** Do not add features that skip or shrink the heart of the loop unless Andy approves.

## 10. Panel review

- Every user-facing change gets a panel pass sized to its impact: micro (typo) is an automatic GO, small takes about 2 minutes, medium about 10, and large about 30.
- The Time Clash panel is a 6-year-old, a 12-year-old, a parent, a teacher, and a slapstick comedy writer, moderated by a staff game designer. Pick a panel that fits the new game.
- Each voice says GO, GO WITH CHANGES, or BLOCK. Only Andy can override a parent's or teacher's BLOCK on safety, privacy, or learning.
- The moderator checks facts (tap sizes, contrast, reading level, pace math) instead of assuming them.
- Large reviews are saved in `docs/panel/`. A separate adversarial review asks "what can we cut?" and cuts only the clearly safe items. Riskier cuts become questions for Andy.

## 11. Testing and CI

- Every bug fix adds a row to the regression table in `AGENTS.md` and a test that pins it.
- Browser tests check layout as geometry: nothing overlaps, everything fits on screen, at every supported size.
- Tests wait on conditions, not sleeps.
- CI stays small to save Actions minutes. A pull request runs lint, typecheck, unit tests, build, and one Chromium browser job. The full browser matrix runs only when started by hand before a release.
- A test that passes only on retry is flaky. Fix it, do not ignore it.

## 12. Parallel work

Split independent work into pieces and run them at the same time in separate git worktrees. Split by file ownership (for example: rules, content, UI, art wiring). Name the model in each dispatch.

## 13. Tracking and decisions

- New ideas go in `INBOX.md` (raw, 30-day expiry). Triage moves them to `BACKLOG.md` (P0 to P3). Never create other tracking files.
- Record each owner decision with its date, for example "(owner, 2026-10-24)". The `AGENTS.md` "Refactoring constraints" list names what nobody may remove without Andy.

## 14. Writing

Plain English. Short sentences, common words, active verbs. Third-grade level for anything a child reads. Strunk and White for docs and commits. No em dashes as asides.
