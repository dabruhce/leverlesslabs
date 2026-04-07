import { describe, it, expect } from 'vitest';
import { TekkenParser } from './TekkenParser';
import { InputEvent, InputState, createEmptyInputState } from '../types';

function makeEvent(overrides: Partial<InputState>, timestamp: number): InputEvent {
  return { state: { ...createEmptyInputState(), ...overrides }, timestamp };
}

function dirEvent(dirs: Record<string, boolean>, ts: number): InputEvent {
  return makeEvent(dirs, ts);
}

describe('TekkenParser', () => {
  const parser = new TekkenParser();

  describe('WD (Wavedash): f, n, d, df', () => {
    it('detects a clean wavedash', () => {
      const buffer: InputEvent[] = [
        dirEvent({ right: true }, 100),
        dirEvent({}, 150),                           // neutral
        dirEvent({ down: true }, 200),
        dirEvent({ down: true, right: true }, 250),  // df
      ];
      const result = parser.detect(buffer);
      expect(result).not.toBeNull();
      expect(result!.motion).toBe('WD');
    });

    it('rejects incomplete wavedash (missing df)', () => {
      const buffer: InputEvent[] = [
        dirEvent({ right: true }, 100),
        dirEvent({}, 150),
        dirEvent({ down: true }, 200),
      ];
      const result = parser.detect(buffer);
      // Should not detect WD (might detect SS_DOWN: d, n is not present here)
      expect(result?.motion).not.toBe('WD');
    });
  });

  describe('KBD (Korean Backdash): b, n, b', () => {
    it('detects KBD via b, n, b', () => {
      const buffer: InputEvent[] = [
        dirEvent({ left: true }, 100),
        dirEvent({}, 200),
        dirEvent({ left: true }, 300),
      ];
      const result = parser.detect(buffer);
      expect(result).not.toBeNull();
      expect(result!.motion).toBe('KBD');
    });

    it('detects KBD via b, db, b', () => {
      const buffer: InputEvent[] = [
        dirEvent({ left: true }, 100),
        dirEvent({ down: true, left: true }, 200),
        dirEvent({ left: true }, 300),
      ];
      const result = parser.detect(buffer);
      expect(result).not.toBeNull();
      expect(result!.motion).toBe('KBD');
    });
  });

  describe('EWGF: f, n, d, df+rp within 16ms', () => {
    it('detects EWGF with on-time rp press', () => {
      const buffer: InputEvent[] = [
        dirEvent({ right: true }, 100),
        dirEvent({}, 150),
        dirEvent({ down: true }, 200),
        makeEvent({ down: true, right: true, mp: true }, 250), // df + rp at same time
      ];
      const result = parser.detect(buffer);
      expect(result).not.toBeNull();
      expect(result!.motion).toBe('EWGF');
    });

    it('detects EWGF with rp pressed within 16ms of df', () => {
      const buffer: InputEvent[] = [
        dirEvent({ right: true }, 100),
        dirEvent({}, 150),
        dirEvent({ down: true }, 200),
        dirEvent({ down: true, right: true }, 250),  // df
        makeEvent({ down: true, right: true, mp: true }, 260), // rp 10ms later
      ];
      const result = parser.detect(buffer);
      expect(result).not.toBeNull();
      expect(result!.motion).toBe('EWGF');
    });

    it('rejects EWGF with late rp press (>16ms)', () => {
      const buffer: InputEvent[] = [
        dirEvent({ right: true }, 100),
        dirEvent({}, 150),
        dirEvent({ down: true }, 200),
        dirEvent({ down: true, right: true }, 250),  // df
        makeEvent({ down: true, right: true, mp: true }, 290), // rp 40ms later — too late
      ];
      const result = parser.detect(buffer);
      // Should detect WD instead of EWGF
      expect(result?.motion).not.toBe('EWGF');
    });

    it('rejects EWGF with early rp press (>16ms before df)', () => {
      const buffer: InputEvent[] = [
        dirEvent({ right: true }, 100),
        dirEvent({}, 150),
        makeEvent({ down: true, mp: true }, 200),     // rp pressed too early
        dirEvent({ down: true, right: true }, 250),    // df 50ms later
      ];
      const result = parser.detect(buffer);
      expect(result?.motion).not.toBe('EWGF');
    });
  });

  describe('SS_UP (Sidestep Up): u, n', () => {
    it('detects sidestep up', () => {
      const buffer: InputEvent[] = [
        dirEvent({ up: true }, 100),
        dirEvent({}, 200),
      ];
      const result = parser.detect(buffer);
      expect(result).not.toBeNull();
      expect(result!.motion).toBe('SS_UP');
    });
  });

  describe('SS_DOWN (Sidestep Down): d, n', () => {
    it('detects sidestep down', () => {
      const buffer: InputEvent[] = [
        dirEvent({ down: true }, 100),
        dirEvent({}, 200),
      ];
      const result = parser.detect(buffer);
      expect(result).not.toBeNull();
      expect(result!.motion).toBe('SS_DOWN');
    });
  });

  describe('QCF: d, df, f', () => {
    it('detects quarter circle forward', () => {
      const buffer: InputEvent[] = [
        dirEvent({ down: true }, 100),
        dirEvent({ down: true, right: true }, 150),
        dirEvent({ right: true }, 200),
      ];
      const result = parser.detect(buffer);
      expect(result).not.toBeNull();
      expect(result!.motion).toBe('QCF');
    });
  });

  describe('buffer window', () => {
    it('ignores inputs outside the 400ms window', () => {
      const buffer: InputEvent[] = [
        dirEvent({ right: true }, 100),  // too old
        dirEvent({}, 150),
        dirEvent({ down: true }, 200),
        dirEvent({ down: true, right: true }, 600), // 500ms gap — f,n,d are outside window
      ];
      const result = parser.detect(buffer);
      expect(result?.motion).not.toBe('WD');
    });
  });
});
