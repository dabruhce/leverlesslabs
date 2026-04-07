# Leverless Controller Trainer

A desktop training app for fighting game motion inputs. Practice execution timing on leverless controllers (hitbox-style), keyboard, or gamepad with a scrolling note chart, frame-accurate grading, and session analytics.

Built with Electron + React + TypeScript.

## Features

- **Scrolling note charts** with frame-accurate hit detection and timing feedback
- **Tekken 8 & Street Fighter 6** motion parsers (EWGF, KBD, wavedash, QCF, DP, charge moves)
- **Just-frame detection** with tighter timing windows and audio/visual feedback
- **Button buffering detection** (Tekken) — warns when held buttons stack with new presses (e.g. holding 1 while pressing f+2 gives the game f+1+2)
- **Three input modes** — keyboard, leverless (WASD + buttons), gamepad
- **Remappable controls** per game with live input feedback
- **Chart editor** with manual, recording, and YAML editing modes
- **Chart import** from URL, GitHub repos, or pasted YAML
- **Session tracking** with per-chart stats, accuracy trends, and activity history
- **Loop mode** for continuous practice
- **BPM-synced audio** — charts can be matched to music tracks

## Quick Start

```bash
npm install
npm run dev          # Vite dev server (port 5173)
npm start            # Build + launch Electron app
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | TypeScript check + Vite production build |
| `npm start` | Build + launch Electron |
| `npm run dist` | Build + package Windows executable (NSIS installer + portable) |
| `npm test` | Run all tests (Vitest) |
| `npm run test:watch` | Watch mode tests |
| `npm run typecheck` | TypeScript check only |

## Supported Motions

### Tekken 8

| Motion | Input | Notes |
|--------|-------|-------|
| WD (Wavedash) | f, n, d, df | |
| KBD (Korean Backdash) | b, n, b or b, db, b | |
| EWGF | f, n, d, df+2 | 2 must be pressed within 1 frame (16ms) of df |
| QCF | d, df, f | |
| Sidestep Up | u, n | |
| Sidestep Down | d, n | |

Detection window: 400ms

### Street Fighter 6

| Motion | Input | Notes |
|--------|-------|-------|
| QCF | d, df, f | |
| QCB | d, db, b | |
| DP (Shoryuken) | f, d, df | |
| Charge Back-Forward | hold b (40ms+), then f | |
| Charge Down-Up | hold d (40ms+), then u | |

Detection window: 500ms

## Grading System

Timing is measured from the note's target window. Grades at 60 FPS:

**Standard notes:**

| Grade | Window | Frames |
|-------|--------|--------|
| Perfect | 16.7ms | 1f |
| Close | 50ms | 3f |
| Late | 167ms | 10f |
| Sloppy | 333ms | 20f |
| Miss | >333ms | >20f |

**Just-frame notes** (tighter windows):

| Grade | Window | Frames |
|-------|--------|--------|
| Perfect | 16.7ms | 1f |
| Close | 33ms | 2f |
| Late | 67ms | 4f |
| Sloppy | 133ms | 8f |
| Miss | >133ms | >8f |

Sloppy breaks combo. Miss breaks combo. Perfect/Close/Late maintain combo.

**Letter grades:** S (95%+), A (85%+), B (70%+), C (50%+), F (<50%)

Accuracy = (perfects + closes + lates) / total notes

## Charts

Charts are YAML files in `assets/charts/`. Example:

```yaml
id: tekken-kbd-training
title: "KBD Training - P1 (b,b, db,b repeat)"
game: tekken
fps: 60
audioFile: audio/kbd-track.mp3
notes:
  # b (back = lane 0), d (down = lane 1)
  # Simultaneous inputs share the same time/endTime
  - { time: 2667, endTime: 2717, lane: 0, label: "KBD Slow" }
  - { time: 2833, endTime: 2883, lane: 0 }
  - { time: 3000, endTime: 3050, lane: 0 }
  - { time: 3000, endTime: 3050, lane: 1 }   # db (back + down together)
  - { time: 3167, endTime: 3217, lane: 0 }
```

### Lane mapping

**Tekken** (8 lanes): `b(0) d(1) u(2) f(3) 1(4) 2(5) 3(6) 4(7)`

**Street Fighter** (10 lanes): `b(0) d(1) u(2) f(3) LP(4) MP(5) HP(6) LK(7) MK(8) HK(9)`

### BeatNote fields

| Field | Type | Description |
|-------|------|-------------|
| `time` | number | Start of input window (ms from song start) |
| `endTime` | number | End of input window (ms) |
| `lane` | number | Which input lane |
| `label` | string? | Display label for note grouping |
| `justFrame` | boolean? | Enables stricter grading and JF feedback |

### Creating charts

Use the built-in chart editor (Chart Select > New Chart):

- **Notes tab** — add/edit/delete notes manually
- **Record tab** — tap inputs in real time to a timer
- **YAML tab** — edit raw YAML directly

Charts can also be imported from URLs, GitHub repos, or pasted YAML.

### Audio sync

Charts reference an audio file via `audioFile`. The game clock runs on `performance.now()`, not audio position, so audio is decorative. To sync charts to music, align note timings to BPM subdivisions. For example, the KBD training chart syncs to a 90 BPM boom bap track using 2x/3x/4x subdivisions (180/270/360 BPM).

## Button Buffering Detection (Tekken)

In Tekken, held buttons combine with new presses. If you hold 1 and press f+2, the game reads f+1+2. The trainer detects this and shows the effective input in the input history panel:

```
→ +2  [1+2]    ← orange bracket shows what the game actually sees
```

This is Tekken-specific. Street Fighter does not stack held buttons this way.

## Input Devices

**Keyboard** — arrow keys for directions, letter keys for buttons.

**Leverless** — WASD for directions, letter keys for buttons. Matches hitbox-style controllers.

**Gamepad** — D-pad/analog stick for directions, face buttons for attacks. Uses first connected gamepad.

Default bindings are configurable per game in Settings.

| | Directions | Buttons (Tekken) | Buttons (SF) |
|---|---|---|---|
| **Keyboard** | Arrow keys | U/I/J/K → 1/2/3/4 | U/I/O/J/K/L → LP-HK |
| **Leverless** | W/A/S/D | U/I/J/K → 1/2/3/4 | U/I/O/J/K/L → LP-HK |
| **Gamepad** | D-pad / left stick | Buttons 0-3 | Buttons 0-5 |

## Architecture

```
Keyboard/Gamepad → useInput hook (InputEvent buffer + performance.now() timestamps)
    → MotionParser.detect(buffer) → DetectedMotion { motion, completedAt }
    → GameScreen matches inputs to nearest unresolved BeatNote by timing delta
    → ScoreState updated → grade, combo, timing popup rendered
```

### GameRegistry pattern

`GameRegistry` is a singleton map of `GameId -> GameDefinition`. Every system queries it — the renderer, hit detection, input mapper, and chart loader never branch on GameId directly. Adding a new game means:

1. Create a `MotionParser` in `src/shared/parsers/`
2. Define a `GameDefinition` in `src/shared/registry/registerGames.ts`
3. Add chart YAML files to `assets/charts/`
4. Extend `GameId` and `MotionId` types in `src/shared/types.ts`

The UI auto-discovers games from the registry.

### Key modules

| Module | Path | Purpose |
|--------|------|---------|
| Types | `src/shared/types.ts` | All type definitions. InputState is a 10-button superset |
| Tekken parser | `src/shared/parsers/TekkenParser.ts` | Sequential pattern matching, 400ms window |
| SF parser | `src/shared/parsers/SFParser.ts` | Sequential pattern matching + charge detection, 500ms window |
| Buffer detection | `src/shared/parsers/detectButtonBuffer.ts` | Tekken button stacking detection |
| Input hook | `src/renderer/hooks/useInput.ts` | Keyboard events + gamepad polling at 60fps |
| Audio engine | `src/renderer/context/AudioEngine.ts` | Web Audio API playback, performance.now() clock |
| Game screen | `src/renderer/components/GameScreen.tsx` | Main gameplay loop via requestAnimationFrame |
| Session store | `src/shared/SessionStore.ts` | localStorage persistence, stats computation |
| Chart loader | `src/shared/BeatMapLoader.ts` | YAML parsing and validation |

### Path aliases

`@shared/*` → `src/shared/*`, `@renderer/*` → `src/renderer/*`

## Building

### Development

```bash
npm run dev           # Vite dev server at localhost:5173
npm run dev:electron  # Build + launch Electron (no hot reload)
```

### Production

```bash
npm run dist          # TypeScript check + Vite build + electron-builder
```

Outputs to `release/`:
- `Leverless Trainer Setup 1.0.0.exe` — Windows installer
- `Leverless Trainer 1.0.0.exe` — Portable executable

**Note:** Windows Developer Mode must be enabled for the NSIS installer build (Settings > For developers > Developer Mode).

## Testing

```bash
npm test                        # All tests
npm run test:watch              # Watch mode
npx vitest run src/shared/parsers/TekkenParser.test.ts  # Single file
```

Parser tests construct `InputEvent[]` arrays with explicit timestamps, call `parser.detect(buffer)`, and assert on returned `MotionId`. Tests cover valid inputs, edge cases (EWGF early/late just-frame press), and invalid sequences.

## Tech Stack

- **Frontend:** React 19, TypeScript 6, Vite 5
- **Desktop:** Electron 41
- **Audio:** Web Audio API
- **Data:** YAML charts, localStorage persistence
- **Testing:** Vitest
- **Packaging:** electron-builder (NSIS + portable)
