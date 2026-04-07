import { describe, it, expect } from 'vitest';
import { detectButtonBuffer } from './detectButtonBuffer';
import { createEmptyInputState, InputState } from '../types';

function makeState(overrides: Partial<InputState>): InputState {
  return { ...createEmptyInputState(), ...overrides };
}

describe('detectButtonBuffer', () => {
  it('returns null when no new buttons pressed', () => {
    const prev = makeState({ lp: true });
    const curr = makeState({ lp: true }); // still held, nothing new
    expect(detectButtonBuffer(prev, curr)).toBeNull();
  });

  it('returns null when new press but nothing held', () => {
    const prev = makeState({});
    const curr = makeState({ mp: true }); // fresh press, nothing held
    expect(detectButtonBuffer(prev, curr)).toBeNull();
  });

  it('detects held 1 + new 2 → game sees 1+2', () => {
    const prev = makeState({ lp: true });           // holding 1
    const curr = makeState({ lp: true, mp: true }); // press 2 while holding 1
    const result = detectButtonBuffer(prev, curr);
    expect(result).not.toBeNull();
    expect(result!.isBuffered).toBe(true);
    expect(result!.heldButtons).toEqual(['lp']);
    expect(result!.newButtons).toEqual(['mp']);
    expect(result!.effectiveButtons).toEqual(['lp', 'mp']);
    expect(result!.effectiveNotation).toBe('1+2');
  });

  it('detects held 1 + new f+2 → effective is 1+2 (direction not in button list)', () => {
    const prev = makeState({ lp: true });
    const curr = makeState({ lp: true, mp: true, right: true });
    const result = detectButtonBuffer(prev, curr);
    expect(result).not.toBeNull();
    expect(result!.effectiveNotation).toBe('1+2');
  });

  it('detects held 1+3 + new 2 → effective is 1+2+3', () => {
    const prev = makeState({ lp: true, lk: true });
    const curr = makeState({ lp: true, mp: true, lk: true });
    const result = detectButtonBuffer(prev, curr);
    expect(result).not.toBeNull();
    expect(result!.heldButtons).toEqual(['lp', 'lk']);
    expect(result!.newButtons).toEqual(['mp']);
    expect(result!.effectiveButtons).toEqual(['lp', 'mp', 'lk']);
    expect(result!.effectiveNotation).toBe('1+2+3');
  });

  it('returns null on first frame (prev is null) since nothing was "held"', () => {
    const curr = makeState({ lp: true, mp: true });
    expect(detectButtonBuffer(null, curr)).toBeNull();
  });

  it('detects held 2 + new 1 → effective is 1+2', () => {
    const prev = makeState({ mp: true });
    const curr = makeState({ lp: true, mp: true });
    const result = detectButtonBuffer(prev, curr);
    expect(result).not.toBeNull();
    expect(result!.effectiveNotation).toBe('1+2');
  });
});
