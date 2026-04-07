\# PRD: Hitbox Rhythm Trainer (MVP)



\## Introduction



A desktop rhythm game that trains fighting game motion inputs. Players execute real controller inputs (keyboard, hitbox, arcade stick, or gamepad) in sync with a beat map. Each "note" on the map corresponds to a motion or technique specific to a fighting game that must be completed within a precise timing window.



The architecture is \*\*multi-game from day one\*\*: a game registry decouples input layouts, motion parsers, and charts so new games (SF, Guilty Gear, etc.) are purely additive in future versions. MVP ships Tekken and Street Fighter as the two supported games, with Tekken charts only — SF charts are a v2 deliverable.



Built with Electron + React + TypeScript.



\---



\## Goals



\- Detect raw inputs from keyboard, hitbox (digital buttons), arcade stick, and gamepad via the Web Gamepad API and keyboard events

\- Expose a `GameRegistry` that maps each `GameId` to its button schema, motion parser, and motion icon set

\- Parse raw directional + button sequences through per-game motion parsers (Tekken and SF implemented for MVP)

\- Render a scrolling beat map timeline showing upcoming required inputs

\- Evaluate each executed motion against a timing window and score it (Perfect / Good / Miss)

\- Display a results screen with accuracy breakdown after each chart

\- Ship with 4 built-in Tekken charts; SF charts are v2



\---



\## User Stories



\### US-001: Electron + React/TS Project Scaffold

\*\*Description:\*\* As a developer, I need the base Electron app with React and TypeScript so all subsequent stories have a working runtime.



\*\*Acceptance Criteria:\*\*

\- \[ ] `electron` + `vite` + `react` + `typescript` project initializes and runs via `npm start`

\- \[ ] Main process and renderer process are separated correctly

\- \[ ] Hot reload works in development

\- \[ ] Typecheck passes



\---



\### US-002: Input Detection Layer

\*\*Description:\*\* As a player, I want my keyboard and gamepad inputs captured in real time so the game can respond to my controller.



\*\*Acceptance Criteria:\*\*

\- \[ ] Keyboard events captured globally in renderer (keydown/keyup)

\- \[ ] Gamepad inputs polled via Web Gamepad API at 60fps

\- \[ ] Raw input state exposed as a \*\*superset\*\* `InputState` object covering all supported games:

&#x20; ```ts

&#x20; { up, down, left, right, lp, mp, hp, lk, mk, hk }

&#x20; ```

&#x20; Tekken uses `{ lp, rp(=mp), lk, rk(=hk) }`; unused slots remain `false`

\- \[ ] Input events timestamped with `performance.now()`

\- \[ ] A debug overlay shows live raw input state (can be toggled off in prod)

\- \[ ] Typecheck passes



\---



\### US-003: Game Definition Registry

\*\*Description:\*\* As a developer, I need a central registry that maps each supported game to its button schema and parser so adding new games requires no changes to core systems.



\*\*Acceptance Criteria:\*\*

\- \[ ] `GameId` type defined: `'tekken' | 'sf'`

\- \[ ] `GameDefinition` type defined:

&#x20; ```ts

&#x20; {

&#x20;   id: GameId

&#x20;   label: string                        // e.g. "Tekken 8", "Street Fighter 6"

&#x20;   buttons: ButtonId\[]                  // ordered list of buttons for this game

&#x20;   defaultKeyMap: Record<InputKey, ButtonId | DirectionId>

&#x20;   parser: MotionParser                 // interface (see US-004, US-005)

&#x20; }

&#x20; ```

\- \[ ] `MotionParser` interface defined:

&#x20; ```ts

&#x20; interface MotionParser {

&#x20;   detect(buffer: InputEvent\[]): DetectedMotion | null

&#x20;   supportedMotions: MotionId\[]

&#x20; }

&#x20; ```

\- \[ ] `GameRegistry` singleton exports `getGame(id: GameId): GameDefinition`

\- \[ ] Both `'tekken'` and `'sf'` entries registered (parsers injected in US-004 and US-005)

\- \[ ] Typecheck passes



\---



\### US-004: Tekken Motion Parser

\*\*Description:\*\* As a player, I want the game to recognize Tekken motions from my raw inputs so it can score my execution.



\*\*Acceptance Criteria:\*\*

\- \[ ] Implements `MotionParser` interface from US-003

\- \[ ] Detects the following motions from an `InputEvent\[]` buffer:

&#x20; - `WD` (Wavedash) — `f, n, d, df` executed as a single unit; minimum 1 rep

&#x20; - `KBD` (Korean Backdash) — `b, b, n, b` pattern; minimum 1 rep

&#x20; - `EWGF` (Electric Wind God Fist) — `f, n, d, df+rp` with `rp` pressed within 16ms of reaching `df`

&#x20; - `SS\_UP` (Sidestep Up) — `u, n`

&#x20; - `SS\_DOWN` (Sidestep Down) — `d, n`

&#x20; - `QCF` — `d, df, f`

\- \[ ] `EWGF` uses an independent just-frame checker (≤16ms window) separate from the main leniency buffer

\- \[ ] Each detected motion resolves to `{ motion: MotionId, completedAt: number }`

\- \[ ] Sliding input buffer with configurable leniency (default 400ms)

\- \[ ] Registered into `GameRegistry` under `'tekken'`

\- \[ ] Unit tests cover all 6 motions including EWGF early/late press

\- \[ ] Typecheck passes



\---



\### US-005: Street Fighter Motion Parser

\*\*Description:\*\* As a developer, I want the SF parser registered so SF charts can be added in v2 without any architectural work.



\*\*Acceptance Criteria:\*\*

\- \[ ] Implements `MotionParser` interface from US-003

\- \[ ] Detects the following motions from an `InputEvent\[]` buffer:

&#x20; - `QCF` (↓ ↘ →)

&#x20; - `QCB` (↓ ↙ ←)

&#x20; - `DP` (→ ↓ ↘)

&#x20; - `CHARGE\_B\_F` (hold ← ≥ 40ms, then →)

&#x20; - `CHARGE\_D\_U` (hold ↓ ≥ 40ms, then ↑)

\- \[ ] Each detected motion resolves to `{ motion: MotionId, completedAt: number }`

\- \[ ] Sliding input buffer with configurable leniency (default 500ms)

\- \[ ] Registered into `GameRegistry` under `'sf'`

\- \[ ] Unit tests cover all 5 motions with valid and invalid input sequences

\- \[ ] Typecheck passes



\---



\### US-006: Beat Map Data Schema

\*\*Description:\*\* As a developer, I need a JSON schema for beat maps that includes a game identifier so the correct parser and button layout are loaded automatically.



\*\*Acceptance Criteria:\*\*

\- \[ ] Schema defined in TypeScript as `BeatMap`:

&#x20; ```ts

&#x20; {

&#x20;   id: string

&#x20;   title: string

&#x20;   game: GameId                 // 'tekken' | 'sf' — drives parser + button layout

&#x20;   bpm: number

&#x20;   audioFile: string            // path relative to assets/

&#x20;   notes: BeatNote\[]

&#x20; }

&#x20; ```

\- \[ ] `BeatNote` schema:

&#x20; ```ts

&#x20; {

&#x20;   time: number                 // ms from song start

&#x20;   motion: MotionId             // must be valid for the chart's GameId

&#x20;   button?: ButtonId            // optional, must be valid for the chart's GameId

&#x20;   lane: number                 // visual lane 0–3

&#x20; }

&#x20; ```

\- \[ ] Loader validates that all `motion` and `button` values in notes are legal for the declared `game`; throws on mismatch

\- \[ ] At least 1 valid example chart JSON file exists in `assets/charts/`

\- \[ ] Typecheck passes



\---



\### US-007: Audio Playback Engine with Timing Clock

\*\*Description:\*\* As a player, I want music to play during a chart so my inputs are anchored to a beat.



\*\*Acceptance Criteria:\*\*

\- \[ ] Audio plays via Web Audio API (low-latency, not HTML `<audio>`)

\- \[ ] A master timing clock exposes `currentTime(): number` in ms from song start

\- \[ ] Clock accounts for Web Audio API latency offset

\- \[ ] `play()`, `pause()`, and `stop()` controls work correctly

\- \[ ] Timing clock accessible as a React context / singleton for use by other systems

\- \[ ] Typecheck passes



\---



\### US-008: Scrolling Beat Map Renderer

\*\*Description:\*\* As a player, I want to see upcoming inputs on a scrolling timeline so I know what to execute and when.



\*\*Acceptance Criteria:\*\*

\- \[ ] Beat map rendered as vertical scrolling lanes (top = future, bottom = hit zone)

\- \[ ] Note icons resolved from the active game's icon set via `GameRegistry` — no hardcoded icon mappings in renderer

\- \[ ] Notes scroll at a speed derived from BPM and a configurable "scroll speed" multiplier

\- \[ ] A horizontal "hit zone" bar is visually distinct at the bottom of the lane area

\- \[ ] Notes that have passed the hit zone without input turn gray/missed

\- \[ ] Typecheck passes

\- \[ ] Verify changes work in browser



\---



\### US-009: Hit Detection and Timing Window Scoring

\*\*Description:\*\* As a player, I want my motions graded against the beat map so I get feedback on my timing accuracy.



\*\*Acceptance Criteria:\*\*

\- \[ ] Active game's `MotionParser` sourced from `GameRegistry` — no hardcoded parser references in this system

\- \[ ] When a motion is completed, it is matched against the nearest unresolved `BeatNote` of that `MotionId`

\- \[ ] Timing delta = `|motionCompletedAt - note.time|`

\- \[ ] Grade thresholds (configurable):

&#x20; - `Perfect`: delta ≤ 50ms

&#x20; - `Good`: delta ≤ 120ms

&#x20; - `Miss`: delta > 120ms or note scrolls past with no input

\- \[ ] Each resolved note updates a `ScoreState`: `{ perfects, goods, misses, combo, maxCombo }`

\- \[ ] Hit flash visual feedback on the hit zone (green = Perfect, yellow = Good, red = Miss)

\- \[ ] Typecheck passes

\- \[ ] Verify changes work in browser



\---



\### US-010: HUD Score Display

\*\*Description:\*\* As a player, I want to see my current score and combo while playing so I can track my performance in real time.



\*\*Acceptance Criteria:\*\*

\- \[ ] HUD displays: current combo, max combo, and a running accuracy % (perfects+goods / total resolved)

\- \[ ] Combo counter resets to 0 on Miss and shows a "MISS" flash

\- \[ ] HUD is non-intrusive (corner position, doesn't overlap hit zone)

\- \[ ] Typecheck passes

\- \[ ] Verify changes work in browser



\---



\### US-011: Results Screen

\*\*Description:\*\* As a player, I want a results screen at the end of a chart so I can see how I did overall.



\*\*Acceptance Criteria:\*\*

\- \[ ] Results screen shows: chart title, game label, Perfect count, Good count, Miss count, max combo, final accuracy %

\- \[ ] Letter grade displayed: S (≥95%), A (≥85%), B (≥70%), C (≥50%), F (<50%)

\- \[ ] "Retry" button restarts the same chart from the beginning

\- \[ ] "Menu" button returns to chart select

\- \[ ] Typecheck passes

\- \[ ] Verify changes work in browser



\---



\### US-012: Chart Select Screen

\*\*Description:\*\* As a player, I want to browse and launch available charts, organized by game, so I can choose what to practice.



\*\*Acceptance Criteria:\*\*

\- \[ ] Chart select screen loads all charts from `assets/charts/` and groups them by `game` field

\- \[ ] Game tabs or sections displayed (e.g., "Tekken", "Street Fighter") — only games with ≥1 chart shown

\- \[ ] Each chart entry shows: title, BPM, note count

\- \[ ] Clicking a chart starts the game flow: loads correct parser + button layout from `GameRegistry` → countdown → audio → beat map

\- \[ ] 3-second countdown overlay before audio starts

\- \[ ] Typecheck passes

\- \[ ] Verify changes work in browser



\---



\### US-013: Built-in Tekken Chart Pack

\*\*Description:\*\* As a player, I want several built-in Tekken practice charts so I can immediately train core movement and execution.



\*\*Acceptance Criteria:\*\*

\- \[ ] 4 charts ship in `assets/charts/` with `"game": "tekken"`:

&#x20; 1. `tekken-wavedash-drill.json` — repeating WD notes at moderate tempo

&#x20; 2. `tekken-kbd-drill.json` — KBD drill with increasing BPM across sections

&#x20; 3. `tekken-ewgf-drill.json` — EWGF just-frame drill at slower BPM

&#x20; 4. `tekken-movement-flow.json` — mixed WD, KBD, SS, EWGF at higher BPM

\- \[ ] Each chart has a corresponding royalty-free audio file (≥60 seconds)

\- \[ ] All charts validate against the BeatMap schema including game-scoped motion validation

\- \[ ] Typecheck passes



\---



\### US-014: Configurable Input Mapping Screen

\*\*Description:\*\* As a player, I want to remap buttons to my controller, with the button list driven by the selected game, so hitbox, keyboard, and pad players all get the correct layout.



\*\*Acceptance Criteria:\*\*

\- \[ ] Settings screen includes a game selector (Tekken / Street Fighter)

\- \[ ] Button list rendered dynamically from `GameRegistry.getGame(id).buttons` — no hardcoded button lists

\- \[ ] Tekken shows 8 inputs; SF shows 10 inputs

\- \[ ] Player can click any input slot and press a key/button to assign it

\- \[ ] Mappings stored per-game and persist via Electron config file

\- \[ ] Default key maps ship pre-configured per game (sourced from `GameDefinition.defaultKeyMap`)

\- \[ ] Typecheck passes

\- \[ ] Verify changes work in browser



\---



\## Non-Goals



\- No online multiplayer or leaderboards

\- No custom chart import (file picker, .sm/.osu parsers) — that's v2

\- No Street Fighter charts in MVP — parser ships, charts are v2

\- No character sprites or animations — icons only for MVP

\- No games beyond Tekken and SF in MVP (registry supports future additions without code changes)

\- No audio waveform/BPM detection — charts are manually authored

\- No mobile or web deployment for MVP



\---



\## Technical Considerations



\- \*\*Superset InputState:\*\* SF's 10-button layout is the superset; Tekken maps its 4 buttons onto LP, MP, LK, HK slots. The raw `InputState` always has all 10 fields; the Tekken parser simply ignores MP, HP, and MK.

\- \*\*Registry as the seam:\*\* `GameRegistry` is the only place game-specific knowledge lives. Renderer, hit detection, and input mapper all call into it — they never branch on `GameId` directly. Adding a new game means implementing `MotionParser`, defining a `GameDefinition`, and calling `register()`. Zero changes to core systems.

\- \*\*Input polling:\*\* Gamepad API requires polling inside `requestAnimationFrame`; keyboard events alone are sufficient for keyboard/hitbox users.

\- \*\*Audio latency:\*\* Web Audio API `AudioContext.currentTime` is the reference clock; calibrate against `performance.now()` at audio start.

\- \*\*Electron IPC:\*\* Chart JSON and audio files loaded from `assets/` via Electron's file protocol; no Node `fs` calls in renderer.

\- \*\*Motion parser buffer:\*\* Each parser instance maintains its own rolling input buffer. EWGF uses an independent just-frame checker alongside the main 400ms buffer.

\- \*\*EWGF just-frame:\*\* At 60fps, one frame ≈ 16.6ms. Must evaluate against raw `performance.now()` timestamps, not frame-quantized input.

\- \*\*Wavedash/KBD repetition:\*\* WD and KBD are repeating patterns; parser emits one motion event per rep so charts can require N reps in sequence.

\- \*\*Chart authoring:\*\* For MVP, charts are hand-authored in JSON; a future story can add a visual chart editor.

