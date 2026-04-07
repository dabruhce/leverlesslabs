// ── Direction & Input types ──

export type DirectionId = 'up' | 'down' | 'left' | 'right';

export type ButtonId = 'lp' | 'mp' | 'hp' | 'lk' | 'mk' | 'hk';

export type InputKey = string; // keyboard key or gamepad button index

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  lp: boolean;
  mp: boolean;
  hp: boolean;
  lk: boolean;
  mk: boolean;
  hk: boolean;
}

export interface InputEvent {
  state: InputState;
  timestamp: number; // performance.now()
}

export function createEmptyInputState(): InputState {
  return {
    up: false, down: false, left: false, right: false,
    lp: false, mp: false, hp: false, lk: false, mk: false, hk: false,
  };
}

// ── Motion types ──

export type MotionId =
  // Tekken motions
  | 'WD' | 'KBD' | 'EWGF' | 'SS_UP' | 'SS_DOWN'
  // Shared
  | 'QCF' | 'QCB'
  // SF motions
  | 'DP' | 'CHARGE_B_F' | 'CHARGE_D_U';

export interface DetectedMotion {
  motion: MotionId;
  completedAt: number; // performance.now() timestamp
}

// ── Game Definition types ──

export type GameId = 'tekken' | 'sf';

export interface MotionParser {
  detect(buffer: InputEvent[]): DetectedMotion | null;
  supportedMotions: MotionId[];
}

export interface GameDefinition {
  id: GameId;
  label: string;
  buttons: ButtonId[];
  laneLabels: string[];               // FGC notation per lane, e.g. ['b','d','u','f','1','2','3','4']
  laneInputMap: (keyof InputState)[];  // which InputState field each lane maps to
  defaultKeyMap: Record<InputKey, ButtonId | DirectionId>;
  defaultLeverlessMap: Record<InputKey, ButtonId | DirectionId>;
  parser: MotionParser;
}

// ── Beat Map types ──

export interface BeatNote {
  time: number;       // ms from song start (start of window)
  endTime: number;    // ms from song start (end of window)
  lane: number;       // which input lane (index into GameDefinition.laneLabels)
  label?: string;     // optional display label for grouping (e.g. "EWGF")
  justFrame?: boolean; // must be hit on the exact frame — stricter grading, visual indicator
}

export interface BeatMap {
  id: string;
  title: string;
  game: GameId;
  fps: number;
  audioFile: string;  // path relative to assets/
  notes: BeatNote[];
}

// ── Score types ──

export type HitGrade = 'Perfect' | 'Close' | 'Late' | 'Sloppy' | 'Miss';

export interface ScoreState {
  perfects: number;
  closes: number;
  lates: number;
  sloppies: number;
  misses: number;
  combo: number;
  maxCombo: number;
}

export function createInitialScoreState(): ScoreState {
  return { perfects: 0, closes: 0, lates: 0, sloppies: 0, misses: 0, combo: 0, maxCombo: 0 };
}

// Frame-based timing windows (at 60fps, 1 frame = ~16.67ms)
export const FRAME_MS = 1000 / 60;
export const GRADE_WINDOWS = {
  Perfect: 1 * FRAME_MS,   // exact frame (~17ms)
  Close: 3 * FRAME_MS,     // 1-3 frames (~50ms)
  Late: 10 * FRAME_MS,     // 3-10 frames (~167ms)
  Sloppy: 20 * FRAME_MS,   // 10-20 frames (~333ms)
  // beyond 20 frames = Miss
} as const;

// Just-frame notes have tighter windows
export const JF_GRADE_WINDOWS = {
  Perfect: 1 * FRAME_MS,   // exact frame
  Close: 2 * FRAME_MS,     // 1-2 frames
  Late: 4 * FRAME_MS,      // 2-4 frames
  Sloppy: 8 * FRAME_MS,    // 4-8 frames
  // beyond 8 frames = Miss
} as const;

export interface ResolvedNote {
  note: BeatNote;
  grade: HitGrade;
  delta: number; // ms offset from perfect timing
}

// ── Session tracking ──

export interface SessionRun {
  id: string;
  chartId: string;
  chartTitle: string;
  game: GameId;
  timestamp: number;     // Date.now()
  score: ScoreState;
  totalNotes: number;
  accuracy: number;      // 0-100
  grade: string;         // S/A/B/C/F
  loopCount: number;     // 1 for single run, >1 for looped
}

// ── Input device ──

export type InputDevice = 'keyboard' | 'leverless' | 'controller';

// Gamepad button index → input mapping
export type GamepadButtonMap = Record<number, ButtonId | DirectionId>;

// ── App state ──

export type AppScreen = 'chart-select' | 'playing' | 'results' | 'settings' | 'chart-editor' | 'stats' | 'chart-recorder';
