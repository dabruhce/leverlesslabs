import { describe, it, expect } from 'vitest';
import { SFParser } from './SFParser';
import { InputEvent, InputState, createEmptyInputState } from '../types';

function makeEvent(overrides: Partial<InputState>, timestamp: number): InputEvent {
  return { state: { ...createEmptyInputState(), ...overrides }, timestamp };
}

function dirEvent(dirs: Record<string, boolean>, ts: number): InputEvent {
  return makeEvent(dirs, ts);
}

describe('SFParser', () => {
  const parser = new SFParser();

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

    it('rejects incomplete QCF', () => {
      const buffer: InputEvent[] = [
        dirEvent({ down: true }, 100),
        dirEvent({ right: true }, 200),  // skipped df
      ];
      const result = parser.detect(buffer);
      expect(result?.motion).not.toBe('QCF');
    });
  });

  describe('QCB: d, db, b', () => {
    it('detects quarter circle back', () => {
      const buffer: InputEvent[] = [
        dirEvent({ down: true }, 100),
        dirEvent({ down: true, left: true }, 150),
        dirEvent({ left: true }, 200),
      ];
      const result = parser.detect(buffer);
      expect(result).not.toBeNull();
      expect(result!.motion).toBe('QCB');
    });

    it('rejects incomplete QCB', () => {
      const buffer: InputEvent[] = [
        dirEvent({ down: true }, 100),
        dirEvent({ left: true }, 200),
      ];
      const result = parser.detect(buffer);
      expect(result?.motion).not.toBe('QCB');
    });
  });

  describe('DP: f, d, df', () => {
    it('detects dragon punch motion', () => {
      const buffer: InputEvent[] = [
        dirEvent({ right: true }, 100),
        dirEvent({ down: true }, 150),
        dirEvent({ down: true, right: true }, 200),
      ];
      const result = parser.detect(buffer);
      expect(result).not.toBeNull();
      expect(result!.motion).toBe('DP');
    });

    it('rejects backwards DP', () => {
      const buffer: InputEvent[] = [
        dirEvent({ down: true, right: true }, 100),
        dirEvent({ down: true }, 150),
        dirEvent({ right: true }, 200),
      ];
      const result = parser.detect(buffer);
      expect(result?.motion).not.toBe('DP');
    });
  });

  describe('CHARGE_B_F: hold b >= 40ms, then f', () => {
    it('detects valid charge', () => {
      const buffer: InputEvent[] = [
        dirEvent({ left: true }, 100),
        dirEvent({ left: true }, 150), // still holding
        dirEvent({ right: true }, 200), // release after 100ms hold
      ];
      const result = parser.detect(buffer);
      expect(result).not.toBeNull();
      expect(result!.motion).toBe('CHARGE_B_F');
    });

    it('rejects insufficient charge time', () => {
      const buffer: InputEvent[] = [
        dirEvent({ left: true }, 100),
        dirEvent({ right: true }, 120), // only 20ms hold
      ];
      const result = parser.detect(buffer);
      expect(result?.motion).not.toBe('CHARGE_B_F');
    });
  });

  describe('CHARGE_D_U: hold d >= 40ms, then u', () => {
    it('detects valid down-up charge', () => {
      const buffer: InputEvent[] = [
        dirEvent({ down: true }, 100),
        dirEvent({ down: true }, 160), // hold 60ms
        dirEvent({ up: true }, 200),
      ];
      const result = parser.detect(buffer);
      expect(result).not.toBeNull();
      expect(result!.motion).toBe('CHARGE_D_U');
    });

    it('rejects insufficient charge time', () => {
      const buffer: InputEvent[] = [
        dirEvent({ down: true }, 100),
        dirEvent({ up: true }, 125), // only 25ms
      ];
      const result = parser.detect(buffer);
      expect(result?.motion).not.toBe('CHARGE_D_U');
    });
  });

  describe('buffer window', () => {
    it('ignores inputs outside the 500ms window', () => {
      const buffer: InputEvent[] = [
        dirEvent({ down: true }, 100),
        dirEvent({ down: true, right: true }, 150),
        dirEvent({ right: true }, 700), // 600ms gap
      ];
      const result = parser.detect(buffer);
      expect(result?.motion).not.toBe('QCF');
    });
  });
});
