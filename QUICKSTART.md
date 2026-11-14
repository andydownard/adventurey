# QUICKSTART

Adventure-y is a browser game. Guard the pack camp from cute-spooky monsters until sunrise.

Play it online: https://andydownard.github.io/adventurey/ (works on an iPad held sideways).

## 1. Set up (one time)
You need Node 20 or newer.
```bash
npm install
```

## 2. Play it
```bash
npm run dev
```
Then open the link it prints (usually http://localhost:5173).

## 3. Everyday commands
| What | Command |
|---|---|
| Unit tests | `npm test` |
| Type check | `npm run typecheck` |
| Type check + word check | `npm run lint` |
| Build the site into `dist/` | `npm run build` |
| Browser checks, desktop and iPad (start `npx vite preview --port 4173` first) | `npm run smoke` |
| Publish online | Push to `main`. GitHub Actions builds and publishes it. |

## 4. Where things live
- `src/game/` Game rules in plain TypeScript, no Phaser. Every number is in `src/game/config.ts`.
- `src/scenes/PlayScene.ts` The night: drawing, lights, particles, input.
- `src/ui/` The menus and the in-game display (plain HTML and CSS).
- `src/data/copy.ts` Every word a player reads.
- `public/art/` Pictures made with Figma AI ("Adventure-y concept art" file).
- `tests/` Unit tests for the rules and saving.
