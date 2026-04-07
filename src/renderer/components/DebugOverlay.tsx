import React, { useEffect, useState } from 'react';
import { InputState } from '@shared/types';

interface DebugOverlayProps {
  getState: () => InputState;
  visible: boolean;
}

const KEYS: (keyof InputState)[] = ['up', 'down', 'left', 'right', 'lp', 'mp', 'hp', 'lk', 'mk', 'hk'];
const KEY_LABELS: Record<keyof InputState, string> = {
  up: 'u', down: 'd', left: 'b', right: 'f',
  lp: '1', mp: '2', hp: 'HP', lk: '3', mk: 'MK', hk: '4',
};

export const DebugOverlay: React.FC<DebugOverlayProps> = ({ getState, visible }) => {
  const [state, setState] = useState<InputState>(getState());

  useEffect(() => {
    if (!visible) return;
    let rafId: number;
    const tick = () => {
      setState({ ...getState() });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [getState, visible]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', top: 8, right: 8, background: 'rgba(0,0,0,0.85)',
      padding: '8px 12px', borderRadius: 6, fontFamily: 'monospace', fontSize: 12,
      color: '#0f0', zIndex: 9999, border: '1px solid #333',
    }}>
      <div style={{ marginBottom: 4, color: '#888' }}>Input Debug</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '2px 12px' }}>
        {KEYS.map(k => (
          <React.Fragment key={k}>
            <span style={{ color: '#888' }}>{KEY_LABELS[k]}</span>
            <span style={{ color: state[k] ? '#0f0' : '#444' }}>
              {state[k] ? 'ON' : '---'}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
