import { MotionParser, InputEvent, DetectedMotion, MotionId, InputState } from '../types';

const BUFFER_WINDOW = 400; // ms
const EWGF_JUST_FRAME = 16; // ms

type Dir = 'f' | 'b' | 'd' | 'u' | 'df' | 'db' | 'uf' | 'ub' | 'n';

function getDirection(s: InputState): Dir {
  const { up, down, left, right } = s;
  if (down && right) return 'df';
  if (down && left) return 'db';
  if (up && right) return 'uf';
  if (up && left) return 'ub';
  if (right) return 'f';
  if (left) return 'b';
  if (down) return 'd';
  if (up) return 'u';
  return 'n';
}

function getDirectionalSequence(buffer: InputEvent[]): { dir: Dir; timestamp: number }[] {
  const seq: { dir: Dir; timestamp: number }[] = [];
  let lastDir: Dir | null = null;
  for (const evt of buffer) {
    const dir = getDirection(evt.state);
    if (dir !== lastDir) {
      seq.push({ dir, timestamp: evt.timestamp });
      lastDir = dir;
    }
  }
  return seq;
}

function findSequence(seq: { dir: Dir; timestamp: number }[], pattern: Dir[]): number | null {
  for (let i = seq.length - pattern.length; i >= 0; i--) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (seq[i + j].dir !== pattern[j]) { match = false; break; }
    }
    if (match) return seq[i + pattern.length - 1].timestamp;
  }
  return null;
}

export class TekkenParser implements MotionParser {
  supportedMotions: MotionId[] = ['WD', 'KBD', 'EWGF', 'SS_UP', 'SS_DOWN', 'QCF'];

  detect(buffer: InputEvent[]): DetectedMotion | null {
    if (buffer.length < 2) return null;

    const now = buffer[buffer.length - 1].timestamp;
    const windowStart = now - BUFFER_WINDOW;
    const recent = buffer.filter(e => e.timestamp >= windowStart);
    if (recent.length < 2) return null;

    const seq = getDirectionalSequence(recent);

    // EWGF: f, n, d, df+rp with rp within 16ms of df
    const ewgf = this.detectEWGF(recent, seq);
    if (ewgf) return ewgf;

    // WD: f, n, d, df
    const wd = findSequence(seq, ['f', 'n', 'd', 'df']);
    if (wd !== null) return { motion: 'WD', completedAt: wd };

    // KBD: b, b (via b, n, b or b, db, b)
    const kbd = this.detectKBD(seq);
    if (kbd) return kbd;

    // QCF: d, df, f
    const qcf = findSequence(seq, ['d', 'df', 'f']);
    if (qcf !== null) return { motion: 'QCF', completedAt: qcf };

    // SS_UP: u, n
    const ssUp = findSequence(seq, ['u', 'n']);
    if (ssUp !== null) return { motion: 'SS_UP', completedAt: ssUp };

    // SS_DOWN: d, n
    const ssDown = findSequence(seq, ['d', 'n']);
    if (ssDown !== null) return { motion: 'SS_DOWN', completedAt: ssDown };

    return null;
  }

  private detectEWGF(recent: InputEvent[], seq: { dir: Dir; timestamp: number }[]): DetectedMotion | null {
    // Look for f, n, d, df pattern
    for (let i = seq.length - 1; i >= 3; i--) {
      if (seq[i].dir === 'df' && seq[i - 1].dir === 'd' && seq[i - 2].dir === 'n' && seq[i - 3].dir === 'f') {
        const dfTimestamp = seq[i].timestamp;
        // Check if rp (mp in superset) was pressed within EWGF_JUST_FRAME of df
        for (const evt of recent) {
          if (evt.state.mp && Math.abs(evt.timestamp - dfTimestamp) <= EWGF_JUST_FRAME) {
            return { motion: 'EWGF', completedAt: dfTimestamp };
          }
        }
      }
    }
    return null;
  }

  private detectKBD(seq: { dir: Dir; timestamp: number }[]): DetectedMotion | null {
    // KBD: b, n, b or b, db, b pattern
    for (let i = seq.length - 1; i >= 2; i--) {
      if (seq[i].dir === 'b') {
        if ((seq[i - 1].dir === 'n' || seq[i - 1].dir === 'db') && seq[i - 2].dir === 'b') {
          return { motion: 'KBD', completedAt: seq[i].timestamp };
        }
      }
    }
    return null;
  }
}
