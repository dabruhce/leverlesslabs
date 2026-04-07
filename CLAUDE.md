# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Vite dev server with hot reload (port 5173)
npm run build         # Typecheck + Vite production build
npm start             # Build + launch Electron app
npm run typecheck     # TypeScript check only (tsc --noEmit)
npm test              # Run all tests (Vitest)
npm run test:watch    # Watch mode tests
npx vitest run src/shared/parsers/TekkenParser.test.ts  # Single test file
```

## Architecture

Leverless Controller Trainer — an Electron + React + TypeScript app that trains fighting game motion inputs. Players execute real controller inputs in sync with a scrolling note chart.

### GameRegistry Pattern (the core seam)

`GameRegistry` (`src/shared/registry/GameRegistry.ts`) is a singleton map of `GameId → GameDefinition`. Every system queries it — the renderer, hit detection, input mapper, and chart loader never branch on `GameId` directly. Adding a new game means:

1. Create a `MotionParser` implementation in `src/shared/parsers/`
2. Define a `GameDefinition` with button layout and default key map in `src/shared/registry/registerGames.ts`
3. Add chart JSON files to `assets/charts/` with the new game ID
4. Extend `GameId` and `MotionId` types in `src/shared/types.ts`

The UI auto-discovers games from the registry and shows tabs for any game with charts.

### Data Flow

```
Keyboard/Gamepad → useInput hook (InputEvent[] buffer with performance.now() timestamps)
    → MotionParser.detect(buffer) → DetectedMotion { motion, completedAt }
    → GameScreen matches to nearest unresolved BeatNote by timing delta
    → ScoreState updated (Perfect ≤50ms, Good ≤120ms, Miss >120ms)
```

### Key Modules

- **`src/shared/types.ts`** — All type definitions. `InputState` is a 10-button superset (Tekken uses 4, SF uses 6; unused slots stay false).
- **`src/shared/parsers/`** — Motion parsers convert directional sequences from `InputEvent[]` into `DetectedMotion`. No state machines; purely sequential pattern matching scanning backward through recent buffer (Tekken: 400ms window, SF: 500ms window). EWGF has an independent 16ms just-frame checker.
- **`src/renderer/hooks/useInput.ts`** — Captures keyboard events + polls Gamepad API at 60fps. Returns `{ getBuffer(), getState(), clearBuffer() }`.
- **`src/renderer/context/AudioEngine.ts`** — Web Audio API playback. `currentTime()` returns ms from song start via `performance.now() - startTimestamp`. Gracefully handles missing audio files.
- **`src/renderer/components/GameScreen.tsx`** — Main gameplay loop via requestAnimationFrame. Runs parser, matches motions to notes, manages scoring, detects misses.
- **`src/renderer/App.tsx`** — Screen router and global state. Loads all charts via `import.meta.glob('/assets/charts/*.json')`. Key maps persisted to localStorage.

### Path Aliases

`@shared/*` → `src/shared/*`, `@renderer/*` → `src/renderer/*` (configured in both tsconfig.json and vite.config.ts).

### Charts

JSON files in `assets/charts/` with `"game": "tekken" | "sf"`. The loader validates that all `motion` and `button` values are legal for the declared game's parser. Charts reference audio files relative to `assets/`.

## Testing

Parser tests use a helper pattern: construct `InputEvent[]` with explicit timestamps, call `parser.detect(buffer)`, assert on returned `MotionId`. Tests cover valid inputs, edge cases (EWGF early/late press), and invalid sequences.
