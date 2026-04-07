import React, { useEffect, useRef } from 'react';
import { BeatNote, HitGrade } from '@shared/types';

interface BeatMapRendererProps {
  notes: BeatNote[];
  currentTime: number;
  scrollSpeed: number;
  fps: number;
  resolvedNotes: Map<number, HitGrade>;
  hitFlash: { grade: HitGrade; time: number } | null;
  laneLabels: string[];
  activeLanes: Set<number>;
}

const LANE_WIDTH = 80;
const HIT_ZONE_Y = 500;
const CANVAS_HEIGHT = 600;
const PADDING = 20;

const GRADE_COLORS: Record<HitGrade, string> = {
  Perfect: '#00ff88',
  Close: '#44ddff',
  Late: '#ffdd00',
  Sloppy: '#ff8844',
  Miss: '#ff3344',
};

const GRADE_BG: Record<HitGrade, string> = {
  Perfect: '#004422',
  Close: '#0a2233',
  Late: '#332200',
  Sloppy: '#331a00',
  Miss: '#333',
};

// Lane colors cycle — vibrant, distinct per lane
const LANE_COLORS = [
  { base: '#00ccff', dim: '#004466', glow: 'rgba(0,204,255,' },    // cyan
  { base: '#ff44cc', dim: '#550033', glow: 'rgba(255,68,204,' },   // magenta
  { base: '#00ff66', dim: '#003322', glow: 'rgba(0,255,102,' },    // green
  { base: '#ffaa00', dim: '#443300', glow: 'rgba(255,170,0,' },    // amber
  { base: '#6644ff', dim: '#1a0055', glow: 'rgba(102,68,255,' },   // purple
  { base: '#ff3366', dim: '#440011', glow: 'rgba(255,51,102,' },   // red-pink
  { base: '#44ffcc', dim: '#004433', glow: 'rgba(68,255,204,' },   // teal
  { base: '#ffcc00', dim: '#443300', glow: 'rgba(255,204,0,' },    // yellow
  { base: '#ff6644', dim: '#441a00', glow: 'rgba(255,102,68,' },   // orange
  { base: '#44aaff', dim: '#001a44', glow: 'rgba(68,170,255,' },   // sky blue
];

function getLaneColor(laneIdx: number) {
  return LANE_COLORS[laneIdx % LANE_COLORS.length];
}

export const BeatMapRenderer: React.FC<BeatMapRendererProps> = ({
  notes, currentTime, scrollSpeed, fps, resolvedNotes, hitFlash, laneLabels, activeLanes,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const laneCount = laneLabels.length;
  const canvasWidth = laneCount * LANE_WIDTH + PADDING * 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasWidth;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const laneAreaLeft = PADDING;
    const laneAreaRight = PADDING + laneCount * LANE_WIDTH;

    // Background
    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, canvasWidth, CANVAS_HEIGHT);

    // Lane column backgrounds with subtle color
    for (let i = 0; i < laneCount; i++) {
      const lx = PADDING + i * LANE_WIDTH;
      const col = getLaneColor(i);
      const active = activeLanes.has(i);

      // Column fill — subtle tint
      const colGrad = ctx.createLinearGradient(lx, 0, lx, CANVAS_HEIGHT - 24);
      colGrad.addColorStop(0, active ? col.glow + '0.12)' : col.glow + '0.03)');
      colGrad.addColorStop(0.5, active ? col.glow + '0.08)' : col.glow + '0.02)');
      colGrad.addColorStop(1, active ? col.glow + '0.20)' : col.glow + '0.04)');
      ctx.fillStyle = colGrad;
      ctx.fillRect(lx, 0, LANE_WIDTH, CANVAS_HEIGHT - 24);

      // Lane borders
      ctx.strokeStyle = active ? col.glow + '0.4)' : col.glow + '0.12)';
      ctx.lineWidth = active ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, CANVAS_HEIGHT - 24);
      ctx.stroke();
    }
    // Right edge
    ctx.strokeStyle = getLaneColor(laneCount - 1).glow + '0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(laneAreaRight, 0);
    ctx.lineTo(laneAreaRight, CANVAS_HEIGHT - 24);
    ctx.stroke();

    // Frame tick marks
    const frameDuration = 1000 / fps;
    const topTime = currentTime + HIT_ZONE_Y / scrollSpeed;
    const bottomTime = currentTime - (CANVAS_HEIGHT - HIT_ZONE_Y) / scrollSpeed;
    const firstFrame = Math.floor(bottomTime / frameDuration);
    const lastFrame = Math.ceil(topTime / frameDuration);

    for (let f = firstFrame; f <= lastFrame; f++) {
      if (f < 0) continue;
      const frameTime = f * frameDuration;
      const y = HIT_ZONE_Y - (frameTime - currentTime) * scrollSpeed;
      if (y < 0 || y > CANVAS_HEIGHT - 24) continue;

      const isMajor = f % 10 === 0;
      const isMid = f % 5 === 0;

      ctx.strokeStyle = isMajor ? 'rgba(255,255,255,0.08)' : isMid ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)';
      ctx.lineWidth = isMajor ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(laneAreaLeft, y);
      ctx.lineTo(laneAreaRight, y);
      ctx.stroke();

      if (isMajor) {
        ctx.fillStyle = '#335';
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${f}f`, laneAreaLeft - 4, y);
      }
    }

    // Active lane glow at hit zone
    for (const laneIdx of activeLanes) {
      if (laneIdx < 0 || laneIdx >= laneCount) continue;
      const lx = PADDING + laneIdx * LANE_WIDTH;
      const col = getLaneColor(laneIdx);

      // Glow pulse at hit zone
      const glowGrad = ctx.createRadialGradient(
        lx + LANE_WIDTH / 2, HIT_ZONE_Y, 2,
        lx + LANE_WIDTH / 2, HIT_ZONE_Y, LANE_WIDTH,
      );
      glowGrad.addColorStop(0, col.glow + '0.4)');
      glowGrad.addColorStop(1, col.glow + '0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(lx, HIT_ZONE_Y - LANE_WIDTH, LANE_WIDTH, LANE_WIDTH * 2);
    }

    // Separator between directions and buttons
    if (laneCount >= 8) {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      const sepX = PADDING + 4 * LANE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(sepX, 0);
      ctx.lineTo(sepX, CANVAS_HEIGHT - 24);
      ctx.stroke();
    }

    // Hit zone line
    const flashAge = hitFlash ? currentTime - hitFlash.time : 999;
    if (hitFlash && flashAge < 200) {
      const alpha = 1 - flashAge / 200;
      ctx.fillStyle = GRADE_COLORS[hitFlash.grade] + Math.round(alpha * 60).toString(16).padStart(2, '0');
      ctx.fillRect(PADDING, HIT_ZONE_Y - 25, laneCount * LANE_WIDTH, 50);
    }

    // Glowing hit zone line
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(PADDING, HIT_ZONE_Y);
    ctx.lineTo(PADDING + laneCount * LANE_WIDTH, HIT_ZONE_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Collect labels for simultaneous notes
    const labelsByY = new Map<number, { label: string; x: number }>();

    // Notes
    notes.forEach((note, idx) => {
      const grade = resolvedNotes.get(idx);
      const yStart = HIT_ZONE_Y - (note.time - currentTime) * scrollSpeed;
      const yEnd = HIT_ZONE_Y - (note.endTime - currentTime) * scrollSpeed;
      const yTop = Math.min(yStart, yEnd);
      const yBot = Math.max(yStart, yEnd);

      if (yBot < -60 || yTop > CANVAS_HEIGHT + 60) return;
      const lane = Math.min(note.lane, laneCount - 1);
      const col = getLaneColor(lane);
      const x = PADDING + lane * LANE_WIDTH + LANE_WIDTH / 2;

      const noteW = LANE_WIDTH - 10;
      const noteH = Math.max(yBot - yTop, 10);
      const nx = x - noteW / 2;
      const ny = yTop - (noteH === 10 ? 5 : 0);

      const isJF = !!note.justFrame;

      // Note glow
      if (!grade) {
        const midTime = (note.time + note.endTime) / 2;
        const dist = Math.abs(midTime - currentTime);
        if (dist < 800) {
          const glowAlpha = (1 - dist / 800) * 0.6;
          ctx.shadowColor = isJF ? '#ff44aa' : col.base;
          ctx.shadowBlur = 12 * glowAlpha;
        }
      }

      ctx.beginPath();
      ctx.roundRect(nx, ny, noteW, noteH, 6);

      if (grade) {
        ctx.fillStyle = GRADE_BG[grade];
        ctx.fill();
        ctx.strokeStyle = grade === 'Miss' ? '#555' : GRADE_COLORS[grade];
        ctx.lineWidth = 2;
      } else if (isJF) {
        ctx.fillStyle = '#661144';
        ctx.fill();
        ctx.strokeStyle = '#ff44aa';
        ctx.lineWidth = 3;
      } else {
        // Colorful note matching lane
        ctx.fillStyle = col.dim;
        ctx.fill();
        ctx.strokeStyle = col.base;
        ctx.lineWidth = 2;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Just-frame diamond marker
      if (isJF && !grade) {
        const dy = ny + noteH / 2;
        ctx.fillStyle = '#ff44aa';
        ctx.beginPath();
        ctx.moveTo(nx + 4, dy);
        ctx.lineTo(nx + 8, dy - 4);
        ctx.lineTo(nx + 12, dy);
        ctx.lineTo(nx + 8, dy + 4);
        ctx.closePath();
        ctx.fill();
      }

      // Lane label inside note
      const labelY = ny + noteH / 2;
      if (grade === 'Miss') {
        ctx.fillStyle = '#666';
      } else if (isJF && !grade) {
        ctx.fillStyle = '#ffaadd';
      } else if (grade) {
        ctx.fillStyle = '#fff';
      } else {
        ctx.fillStyle = '#fff';
      }
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(laneLabels[lane] ?? '', x, labelY);

      // Group labels
      if (note.label) {
        const yKey = Math.round(ny + noteH / 2);
        if (!labelsByY.has(yKey)) {
          labelsByY.set(yKey, { label: note.label, x: laneAreaRight + 6 });
        }
      }
    });

    // Group labels
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const [yKey, { label, x }] of labelsByY) {
      ctx.fillStyle = '#558';
      ctx.fillText(label, x, yKey);
    }

    // Lane labels at bottom — colored buttons
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < laneCount; i++) {
      const col = getLaneColor(i);
      const active = activeLanes.has(i);
      const cx = PADDING + i * LANE_WIDTH + LANE_WIDTH / 2;
      const cy = CANVAS_HEIGHT - 10;

      // Button background
      const btnW = LANE_WIDTH - 8;
      const btnH = 20;
      ctx.beginPath();
      ctx.roundRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 4);
      ctx.fillStyle = active ? col.base : col.dim;
      ctx.fill();
      if (active) {
        ctx.shadowColor = col.base;
        ctx.shadowBlur = 10;
      }
      ctx.strokeStyle = active ? col.base : col.glow + '0.4)';
      ctx.lineWidth = active ? 2 : 1;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Label text
      ctx.fillStyle = active ? '#000' : col.base;
      ctx.fillText(laneLabels[i], cx, cy + 1);
    }
  }, [notes, currentTime, scrollSpeed, fps, resolvedNotes, hitFlash, laneLabels, laneCount, canvasWidth, activeLanes]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={CANVAS_HEIGHT}
      style={{ borderRadius: 8 }}
    />
  );
};
