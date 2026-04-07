import { MotionParser, InputEvent, DetectedMotion, MotionId, InputState } from '../types';

const BUFFER_WINDOW = 500; // ms
const CHARGE_MIN = 40; // ms

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

export class SFParser implements MotionParser {
  supportedMotions: MotionId[] = ['QCF', 'QCB', 'DP', 'CHARGE_B_F', 'CHARGE_D_U'];

  detect(buffer: InputEvent[]): DetectedMotion | null {
    if (buffer.length < 2) return null;

    const now = buffer[buffer.length - 1].timestamp;
    const windowStart = now - BUFFER_WINDOW;
    const recent = buffer.filter(e => e.timestamp >= windowStart);
    if (recent.length < 2) return null;

    const seq = getDirectionalSequence(recent);

    // DP: f, d, df
    const dp = findSequence(seq, ['f', 'd', 'df']);
    if (dp !== null) return { motion: 'DP', completedAt: dp };

    // QCF: d, df, f
    const qcf = findSequence(seq, ['d', 'df', 'f']);
    if (qcf !== null) return { motion: 'QCF', completedAt: qcf };

    // QCB: d, db, b
    const qcb = findSequence(seq, ['d', 'db', 'b']);
    if (qcb !== null) return { motion: 'QCB', completedAt: qcb };

    // CHARGE_B_F: hold b >= 40ms, then f
    const chargeBF = this.detectCharge(seq, 'b', 'f');
    if (chargeBF) return { motion: 'CHARGE_B_F', completedAt: chargeBF };

    // CHARGE_D_U: hold d >= 40ms, then u
    const chargeDU = this.detectCharge(seq, 'd', 'u');
    if (chargeDU) return { motion: 'CHARGE_D_U', completedAt: chargeDU };

    return null;
  }

  private detectCharge(seq: { dir: Dir; timestamp: number }[], holdDir: Dir, releaseDir: Dir): number | null {
    for (let i = seq.length - 1; i >= 1; i--) {
      if (seq[i].dir === releaseDir) {
        // Look for preceding hold of holdDir
        for (let j = i - 1; j >= 0; j--) {
          if (seq[j].dir === holdDir) {
            const holdDuration = seq[j + 1].timestamp - seq[j].timestamp;
            if (holdDuration >= CHARGE_MIN) {
              return seq[i].timestamp;
            }
          }
        }
      }
    }
    return null;
  }
}
