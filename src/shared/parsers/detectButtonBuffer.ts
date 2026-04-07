import { InputState, ButtonId } from '../types';

/** Tekken button IDs in notation order (1-4) */
const TEKKEN_BUTTONS: ButtonId[] = ['lp', 'mp', 'lk', 'hk'];

/** Tekken notation: lp=1, mp=rp=2, lk=3, hk=rk=4 */
const TEKKEN_LABELS: Partial<Record<ButtonId, string>> = {
  lp: '1', mp: '2', lk: '3', hk: '4',
};

export interface ButtonBufferResult {
  /** Buttons that were newly pressed this frame */
  newButtons: ButtonId[];
  /** Buttons that were already held from a previous input */
  heldButtons: ButtonId[];
  /** What the game actually sees: newButtons + heldButtons combined */
  effectiveButtons: ButtonId[];
  /** Tekken notation of the effective input (e.g. "1+2") */
  effectiveNotation: string;
  /** True if held buttons changed the effective input vs what was just pressed */
  isBuffered: boolean;
}

/**
 * Detect Tekken-style button buffering: when a new press occurs while other
 * buttons are held, the game reads all held buttons as simultaneous input.
 * This is Tekken-specific — SF does not stack held buttons this way.
 *
 * @param prev Previous InputState (null if first frame)
 * @param current Current InputState
 * @param buttons Which buttons to check (defaults to Tekken's 1-4)
 */
export function detectButtonBuffer(
  prev: InputState | null,
  current: InputState,
  buttons: ButtonId[] = TEKKEN_BUTTONS,
): ButtonBufferResult | null {
  const newButtons: ButtonId[] = [];
  const heldButtons: ButtonId[] = [];

  for (const btn of buttons) {
    const wasPressed = prev ? prev[btn] : false;
    const isPressed = current[btn];

    if (isPressed && !wasPressed) {
      newButtons.push(btn);
    } else if (isPressed && wasPressed) {
      heldButtons.push(btn);
    }
  }

  // No new presses — nothing to report
  if (newButtons.length === 0) return null;

  // No held buttons — no buffering happening
  if (heldButtons.length === 0) return null;

  const effectiveButtons = [...heldButtons, ...newButtons].sort(
    (a, b) => buttons.indexOf(a) - buttons.indexOf(b),
  );

  const effectiveNotation = effectiveButtons
    .map(b => (TEKKEN_LABELS as Record<string, string>)[b] ?? b)
    .join('+');

  return {
    newButtons,
    heldButtons,
    effectiveButtons,
    effectiveNotation,
    isBuffered: true,
  };
}
