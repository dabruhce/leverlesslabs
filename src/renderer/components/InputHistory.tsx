import React, { useRef, useEffect } from 'react';
import { InputState } from '@shared/types';

export interface InputHistoryEntry {
  id: number;
  direction: string;   // numpad notation: 1-9 or arrow glyph
  buttons: string[];   // e.g. ['2'] or ['LP','HP']
  timestamp: number;
  bufferedInput?: string;  // e.g. "1+2" — what the game actually reads when buttons were held
}

interface InputHistoryProps {
  entries: InputHistoryEntry[];
}

const MAX_VISIBLE = 18;

// Numpad notation from InputState directions
export function getDirectionNumpad(state: InputState): string {
  const { up, down, left, right } = state;
  if (down && left) return '1';
  if (down && !left && !right) return '2';
  if (down && right) return '3';
  if (left && !up && !down) return '4';
  if (!up && !down && !left && !right) return '5';
  if (right && !up && !down) return '6';
  if (up && left) return '7';
  if (up && !left && !right) return '8';
  if (up && right) return '9';
  return '5';
}

const DIR_ARROWS: Record<string, string> = {
  '1': '\u2199', // ↙
  '2': '\u2193', // ↓
  '3': '\u2198', // ↘
  '4': '\u2190', // ←
  '5': '\u25CF', // ● (neutral)
  '6': '\u2192', // →
  '7': '\u2196', // ↖
  '8': '\u2191', // ↑
  '9': '\u2197', // ↗
};

const DIR_COLORS: Record<string, string> = {
  '1': '#88aaff', '2': '#88aaff', '3': '#88aaff',
  '4': '#88aaff', '5': '#444',    '6': '#88aaff',
  '7': '#88aaff', '8': '#88aaff', '9': '#88aaff',
};

export const InputHistory: React.FC<InputHistoryProps> = ({ entries }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries.length]);

  const visible = entries.slice(-MAX_VISIBLE);

  return (
    <div style={{
      width: 100, display: 'flex', flexDirection: 'column',
      background: 'rgba(10,10,20,0.8)', borderLeft: '1px solid #1a1a2e',
      fontFamily: 'monospace', fontSize: 12, userSelect: 'none',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '6px 8px', fontSize: 10, color: '#334', textAlign: 'center',
        borderBottom: '1px solid #1a1a2e',
      }}>
        INPUT
      </div>
      <div
        ref={containerRef}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end', padding: '4px 0',
          overflow: 'hidden',
        }}
      >
        {visible.map((entry, i) => {
          const age = visible.length - 1 - i;
          const opacity = Math.max(0.2, 1 - age * 0.05);
          return (
            <div key={entry.id} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', opacity,
              transition: 'opacity 0.2s',
            }}>
              <span style={{
                fontSize: 16, color: DIR_COLORS[entry.direction] ?? '#666',
                width: 20, textAlign: 'center',
              }}>
                {DIR_ARROWS[entry.direction] ?? entry.direction}
              </span>
              {entry.buttons.length > 0 && (
                <span style={{ color: '#cc88ff', fontSize: 11 }}>
                  +{entry.buttons.join('+')}
                </span>
              )}
              {entry.bufferedInput && (
                <span style={{
                  color: '#ff6644', fontSize: 9, fontWeight: 'bold',
                  marginLeft: 2,
                }} title={`Game reads: ${entry.bufferedInput}`}>
                  [{entry.bufferedInput}]
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
