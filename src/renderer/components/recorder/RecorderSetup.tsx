import React, { useRef } from 'react';
import { GameId } from '@shared/types';
import { GameRegistry } from '@shared/registry/GameRegistry';

interface RecorderSetupProps {
  gameId: GameId;
  title: string;
  bpm: number;
  metronomeEnabled: boolean;
  audioFileName: string | null;
  onChangeGame: (g: GameId) => void;
  onChangeTitle: (t: string) => void;
  onChangeBpm: (b: number) => void;
  onToggleMetronome: () => void;
  onLoadAudio: (file: File) => void;
  onStart: () => void;
  onBack: () => void;
}

export const RecorderSetup: React.FC<RecorderSetupProps> = ({
  gameId, title, bpm, metronomeEnabled, audioFileName,
  onChangeGame, onChangeTitle, onChangeBpm, onToggleMetronome,
  onLoadAudio, onStart, onBack,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const allGames = GameRegistry.getAllGames();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', fontFamily: 'monospace',
      background: '#0a0a1a', color: '#ccc',
    }}>
      <h2 style={{ color: '#88aaff', marginBottom: 32 }}>Record New Chart</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 360 }}>
        {/* Title */}
        <label style={labelStyle}>
          Title
          <input
            value={title}
            onChange={e => onChangeTitle(e.target.value)}
            placeholder="My Chart"
            style={inputStyle}
          />
        </label>

        {/* Game */}
        <label style={labelStyle}>
          Game
          <select
            value={gameId}
            onChange={e => onChangeGame(e.target.value as GameId)}
            style={inputStyle}
          >
            {allGames.map(g => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
        </label>

        {/* Audio file */}
        <label style={labelStyle}>
          Audio (optional)
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => fileRef.current?.click()}
              style={btnStyle}
            >
              Choose File
            </button>
            <span style={{ fontSize: 12, color: '#666' }}>
              {audioFileName ?? 'None'}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) onLoadAudio(f);
              }}
            />
          </div>
        </label>

        {/* BPM */}
        <label style={labelStyle}>
          BPM (for grid snap)
          <input
            type="number"
            value={bpm || ''}
            onChange={e => onChangeBpm(parseInt(e.target.value) || 0)}
            placeholder="0 = off"
            min={0}
            max={999}
            style={{ ...inputStyle, width: 100 }}
          />
        </label>

        {/* Metronome */}
        <label style={{ ...labelStyle, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={metronomeEnabled}
            onChange={onToggleMetronome}
          />
          Metronome click {bpm > 0 ? `(${bpm} BPM)` : '(set BPM first)'}
        </label>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
        <button onClick={onBack} style={{ ...btnStyle, color: '#888' }}>
          Back
        </button>
        <button
          onClick={onStart}
          disabled={!title.trim()}
          style={{
            ...btnStyle,
            color: title.trim() ? '#0f8' : '#555',
            border: title.trim() ? '1px solid #0f8' : '1px solid #333',
          }}
        >
          Start Recording
        </button>
      </div>

      <div style={{ marginTop: 24, fontSize: 12, color: '#555', textAlign: 'center', maxWidth: 360 }}>
        Play your actual inputs during recording. Every direction and button press
        will be captured as chart notes on their real lanes.
      </div>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6,
  fontSize: 13, color: '#888',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', fontSize: 14, fontFamily: 'monospace',
  background: '#111128', color: '#ccc', border: '1px solid #333',
  borderRadius: 4, outline: 'none',
};

const btnStyle: React.CSSProperties = {
  padding: '8px 20px', fontSize: 13, fontFamily: 'monospace',
  background: '#1a1a2e', color: '#aac', border: '1px solid #333',
  borderRadius: 4, cursor: 'pointer',
};
