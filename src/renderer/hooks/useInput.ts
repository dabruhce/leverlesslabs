import { useEffect, useRef, useCallback, useMemo } from 'react';
import { InputState, InputEvent, InputDevice, GamepadButtonMap, createEmptyInputState, ButtonId, DirectionId } from '@shared/types';

export type KeyMap = Record<string, ButtonId | DirectionId>;

function applyMapping(key: string, keyMap: KeyMap, state: InputState, pressed: boolean): InputState {
  const mapped = keyMap[key];
  if (!mapped) return state;
  const next = { ...state };
  (next as Record<string, boolean>)[mapped] = pressed;
  return next;
}

const DEFAULT_GAMEPAD_MAP: GamepadButtonMap = {
  // D-pad
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
  // Face buttons
  0: 'lp',
  1: 'mp',
  2: 'hp',
  3: 'lk',
  4: 'mk',
  5: 'hk',
};

export interface InputSystemHandle {
  getBuffer: () => InputEvent[];
  getState: () => InputState;
  clearBuffer: () => void;
}

export function useInput(keyMap: KeyMap, device: InputDevice, gamepadMap?: GamepadButtonMap): InputSystemHandle {
  const stateRef = useRef<InputState>(createEmptyInputState());
  const bufferRef = useRef<InputEvent[]>([]);

  // Keyboard input
  useEffect(() => {
    if (device !== 'keyboard' && device !== 'leverless') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const next = applyMapping(e.key, keyMap, stateRef.current, true);
      if (next !== stateRef.current) {
        stateRef.current = next;
        bufferRef.current.push({ state: { ...next }, timestamp: performance.now() });
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const next = applyMapping(e.key, keyMap, stateRef.current, false);
      if (next !== stateRef.current) {
        stateRef.current = next;
        bufferRef.current.push({ state: { ...next }, timestamp: performance.now() });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [keyMap, device]);

  // Controller (gamepad) input
  useEffect(() => {
    if (device !== 'controller') return;

    const btnMap = gamepadMap ?? DEFAULT_GAMEPAD_MAP;
    let rafId: number;

    const poll = () => {
      const gamepads = navigator.getGamepads?.() ?? [];
      for (const gp of gamepads) {
        if (!gp) continue;
        const next = createEmptyInputState();

        // Apply button map
        for (const [btnIdxStr, inputId] of Object.entries(btnMap)) {
          const btnIdx = parseInt(btnIdxStr);
          if (gp.buttons[btnIdx]?.pressed) {
            (next as unknown as Record<string, boolean>)[inputId] = true;
          }
        }

        // Analog stick fallback for directions (if not mapped via buttons)
        if (Math.abs(gp.axes[0]) > 0.5) {
          if (gp.axes[0] < -0.5 && !next.left) next.left = true;
          if (gp.axes[0] > 0.5 && !next.right) next.right = true;
        }
        if (Math.abs(gp.axes[1]) > 0.5) {
          if (gp.axes[1] < -0.5 && !next.up) next.up = true;
          if (gp.axes[1] > 0.5 && !next.down) next.down = true;
        }

        const changed = (Object.keys(next) as (keyof InputState)[]).some(
          k => next[k] !== stateRef.current[k]
        );
        if (changed) {
          stateRef.current = next;
          bufferRef.current.push({ state: { ...next }, timestamp: performance.now() });
        }
        break; // First connected gamepad
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [device, gamepadMap]);

  const getBuffer = useCallback(() => bufferRef.current, []);
  const getState = useCallback(() => stateRef.current, []);
  const clearBuffer = useCallback(() => { bufferRef.current = []; }, []);

  return useMemo(() => ({ getBuffer, getState, clearBuffer }), [getBuffer, getState, clearBuffer]);
}
