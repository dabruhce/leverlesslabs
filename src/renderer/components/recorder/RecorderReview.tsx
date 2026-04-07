import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { BeatNote, GameId } from '@shared/types';
import { GameRegistry } from '@shared/registry/GameRegistry';

interface RecorderReviewProps {
  notes: BeatNote[];
  durationMs: number;
  gameId: GameId;
  title: string;
  bpm: number;
  onSave: (notes: BeatNote[], durationMs: number) => void;
  onReRecord: () => void;
  onBack: () => void;
}

function quantizeNotes(notes: BeatNote[], bpm: number, subdivision: number): BeatNote[] {
  const gridMs = 60000 / (bpm * subdivision);
  return notes.map(n => ({
    ...n,
    time: Math.round(n.time / gridMs) * gridMs,
    endTime: Math.round(n.endTime / gridMs) * gridMs,
  }));
}

export const RecorderReview: React.FC<RecorderReviewProps> = ({
  notes: rawNotes, durationMs, gameId, title, bpm,
  onSave, onReRecord, onBack,
}) => {
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(durationMs);
  const [deletedIndices, setDeletedIndices] = useState<Set<number>>(new Set());
  const [quantized, setQuantized] = useState(false);
  const [subdivision, setSubdivision] = useState(4);

  const game = GameRegistry.getGame(gameId);

  const activeNotes = useMemo(() => {
    let result = rawNotes.filter((_, i) => !deletedIndices.has(i));
    if (quantized && bpm > 0) {
      result = quantizeNotes(result, bpm, subdivision);
    }
    return result;
  }, [rawNotes, deletedIndices, quantized, bpm, subdivision]);

  const trimmedNotes = useMemo(() => {
    return activeNotes
      .filter(n => n.time >= trimStart && n.time <= trimEnd)
      .map(n => ({
        ...n,
        time: Math.max(0, n.time - trimStart),
        endTime: Math.max(0, n.endTime - trimStart),
      }));
  }, [activeNotes, trimStart, trimEnd]);

  const handleDeleteNote = useCallback((originalIdx: number) => {
    setDeletedIndices(prev => new Set(prev).add(originalIdx));
  }, []);

  const handleSave = useCallback(() => {
    onSave(trimmedNotes, trimEnd - trimStart);
  }, [trimmedNotes, trimStart, trimEnd, onSave]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: 'monospace', background: '#0a0a1a', color: '#ccc',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid #222',
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onBack} style={btnStyle}>Back</button>
          <button onClick={onReRecord} style={btnStyle}>Re-record</button>
        </div>
        <span style={{ color: '#888', fontSize: 13 }}>
          {title} - {trimmedNotes.length} notes, {((trimEnd - trimStart) / 1000).toFixed(1)}s
        </span>
        <button
          onClick={handleSave}
          disabled={trimmedNotes.length === 0}
          style={{
            ...btnStyle,
            color: trimmedNotes.length > 0 ? '#0f8' : '#555',
            border: trimmedNotes.length > 0 ? '1px solid #0f8' : '1px solid #333',
          }}
        >
          Save Chart
        </button>
      </div>

      {/* Timeline */}
      <div style={{ padding: '16px', borderBottom: '1px solid #222' }}>
        <TimelineCanvas
          notes={activeNotes}
          durationMs={durationMs}
          laneLabels={game.laneLabels}
          trimStart={trimStart}
          trimEnd={trimEnd}
          onChangeTrimStart={setTrimStart}
          onChangeTrimEnd={setTrimEnd}
        />
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#666' }}>
          <label>
            Trim start:
            <input
              type="number"
              value={Math.round(trimStart)}
              onChange={e => setTrimStart(Math.max(0, parseInt(e.target.value) || 0))}
              style={numInputStyle}
            /> ms
          </label>
          <label>
            Trim end:
            <input
              type="number"
              value={Math.round(trimEnd)}
              onChange={e => setTrimEnd(Math.min(durationMs, parseInt(e.target.value) || durationMs))}
              style={numInputStyle}
            /> ms
          </label>
          {bpm > 0 && (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="checkbox"
                  checked={quantized}
                  onChange={() => setQuantized(q => !q)}
                />
                Quantize to grid
              </label>
              <label>
                Subdivision:
                <select
                  value={subdivision}
                  onChange={e => setSubdivision(parseInt(e.target.value))}
                  style={numInputStyle}
                >
                  <option value={1}>1 (whole)</option>
                  <option value={2}>2 (half)</option>
                  <option value={4}>4 (quarter)</option>
                  <option value={8}>8 (eighth)</option>
                  <option value={16}>16 (sixteenth)</option>
                </select>
              </label>
            </>
          )}
        </div>
      </div>

      {/* Note list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: '#555', borderBottom: '1px solid #222' }}>
              <th style={thStyle}>Lane</th>
              <th style={thStyle}>Start (ms)</th>
              <th style={thStyle}>End (ms)</th>
              <th style={thStyle}>Duration</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {rawNotes.map((note, i) => {
              if (deletedIndices.has(i)) return null;
              const inTrim = note.time >= trimStart && note.time <= trimEnd;
              return (
                <tr
                  key={i}
                  style={{
                    borderBottom: '1px solid #1a1a2e',
                    opacity: inTrim ? 1 : 0.3,
                  }}
                >
                  <td style={tdStyle}>
                    <span style={{ color: '#88aaff' }}>
                      {game.laneLabels[note.lane] ?? note.lane}
                    </span>
                  </td>
                  <td style={tdStyle}>{Math.round(note.time)}</td>
                  <td style={tdStyle}>{Math.round(note.endTime)}</td>
                  <td style={tdStyle}>{Math.round(note.endTime - note.time)}ms</td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => handleDeleteNote(i)}
                      style={{ ...btnStyle, padding: '2px 8px', fontSize: 11, color: '#f66' }}
                    >
                      Del
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Timeline Canvas ---

interface TimelineCanvasProps {
  notes: BeatNote[];
  durationMs: number;
  laneLabels: string[];
  trimStart: number;
  trimEnd: number;
  onChangeTrimStart: (ms: number) => void;
  onChangeTrimEnd: (ms: number) => void;
}

const TIMELINE_HEIGHT = 120;
const HANDLE_WIDTH = 8;

const TimelineCanvas: React.FC<TimelineCanvasProps> = ({
  notes, durationMs, laneLabels, trimStart, trimEnd,
  onChangeTrimStart, onChangeTrimEnd,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'start' | 'end' | null>(null);

  const width = 700;
  const laneCount = laneLabels.length;
  const laneH = Math.floor((TIMELINE_HEIGHT - 20) / laneCount);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = TIMELINE_HEIGHT;

    ctx.fillStyle = '#111128';
    ctx.fillRect(0, 0, width, TIMELINE_HEIGHT);

    if (durationMs <= 0) return;

    const toX = (ms: number) => (ms / durationMs) * width;

    // Lane labels
    ctx.fillStyle = '#333';
    ctx.font = '9px monospace';
    for (let i = 0; i < laneCount; i++) {
      ctx.fillText(laneLabels[i], 2, 12 + i * laneH + laneH / 2);
    }

    // Notes
    for (const note of notes) {
      const x = toX(note.time);
      const w = Math.max(2, toX(note.endTime) - x);
      const y = 8 + note.lane * laneH;
      const inTrim = note.time >= trimStart && note.time <= trimEnd;
      ctx.fillStyle = inTrim ? '#4466cc' : '#222';
      ctx.fillRect(x, y, w, laneH - 1);
    }

    // Trim overlay
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, toX(trimStart), TIMELINE_HEIGHT);
    ctx.fillRect(toX(trimEnd), 0, width - toX(trimEnd), TIMELINE_HEIGHT);

    // Trim handles
    ctx.fillStyle = '#0f8';
    ctx.fillRect(toX(trimStart) - HANDLE_WIDTH / 2, 0, HANDLE_WIDTH, TIMELINE_HEIGHT);
    ctx.fillStyle = '#f44';
    ctx.fillRect(toX(trimEnd) - HANDLE_WIDTH / 2, 0, HANDLE_WIDTH, TIMELINE_HEIGHT);
  }, [notes, durationMs, laneCount, laneLabels, trimStart, trimEnd, width]);

  useEffect(() => { draw(); }, [draw]);

  const getMs = useCallback((clientX: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const x = clientX - rect.left;
    return Math.max(0, Math.min(durationMs, (x / width) * durationMs));
  }, [durationMs, width]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const ms = getMs(e.clientX);
    const toX = (val: number) => (val / durationMs) * width;
    const startX = toX(trimStart);
    const endX = toX(trimEnd);

    if (Math.abs(e.clientX - (canvasRef.current?.getBoundingClientRect().left ?? 0) - startX) < 12) {
      draggingRef.current = 'start';
    } else if (Math.abs(e.clientX - (canvasRef.current?.getBoundingClientRect().left ?? 0) - endX) < 12) {
      draggingRef.current = 'end';
    }
  }, [getMs, durationMs, trimStart, trimEnd, width]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const ms = getMs(e.clientX);
      if (draggingRef.current === 'start') {
        onChangeTrimStart(Math.min(ms, trimEnd - 100));
      } else {
        onChangeTrimEnd(Math.max(ms, trimStart + 100));
      }
    };
    const onUp = () => { draggingRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [getMs, trimStart, trimEnd, onChangeTrimStart, onChangeTrimEnd]);

  return (
    <div ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={width}
        height={TIMELINE_HEIGHT}
        style={{ borderRadius: 4, cursor: 'ew-resize', display: 'block' }}
        onMouseDown={onMouseDown}
      />
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: '6px 14px', fontSize: 12, fontFamily: 'monospace',
  background: '#1a1a2e', color: '#aac', border: '1px solid #333',
  borderRadius: 4, cursor: 'pointer',
};

const numInputStyle: React.CSSProperties = {
  padding: '2px 6px', fontSize: 12, fontFamily: 'monospace',
  background: '#111128', color: '#ccc', border: '1px solid #333',
  borderRadius: 3, width: 80, marginLeft: 4,
};

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '6px 8px' };
const tdStyle: React.CSSProperties = { padding: '4px 8px' };
