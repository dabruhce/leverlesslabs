import React from 'react';
import { ScoreState } from '@shared/types';

interface ResultsScreenProps {
  chartTitle: string;
  gameLabel: string;
  score: ScoreState;
  totalNotes: number;
  onRetry: () => void;
  onMenu: () => void;
}

function getLetterGrade(accuracy: number): { letter: string; color: string } {
  if (accuracy >= 95) return { letter: 'S', color: '#00ffcc' };
  if (accuracy >= 85) return { letter: 'A', color: '#00ff88' };
  if (accuracy >= 70) return { letter: 'B', color: '#ffdd00' };
  if (accuracy >= 50) return { letter: 'C', color: '#ff8800' };
  return { letter: 'F', color: '#ff3344' };
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  chartTitle, gameLabel, score, totalNotes, onRetry, onMenu,
}) => {
  const totalResolved = score.perfects + score.closes + score.lates + score.sloppies + score.misses;
  const hits = score.perfects + score.closes + score.lates;
  const accuracy = totalResolved > 0
    ? (hits / totalResolved) * 100
    : 0;
  const grade = getLetterGrade(accuracy);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', fontFamily: 'monospace',
      background: 'linear-gradient(180deg, #0a0a1a, #111133)',
    }}>
      <h1 style={{ fontSize: 28, color: '#aac', marginBottom: 4 }}>Results</h1>
      <div style={{ color: '#667', fontSize: 14, marginBottom: 24 }}>
        {chartTitle} — {gameLabel}
      </div>

      <div style={{
        fontSize: 120, fontWeight: 'bold', color: grade.color,
        textShadow: `0 0 40px ${grade.color}55`, marginBottom: 24,
      }}>
        {grade.letter}
      </div>

      <div style={{ fontSize: 24, color: '#ddd', marginBottom: 32 }}>
        {accuracy.toFixed(1)}%
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'auto auto auto', gap: '8px 24px',
        fontSize: 16, color: '#bbb', marginBottom: 40, alignItems: 'center',
      }}>
        <span style={{ color: '#00ff88' }}>Perfect</span><span style={{ fontSize: 12, color: '#555' }}>0f</span><span>{score.perfects}</span>
        <span style={{ color: '#44ddff' }}>Close</span><span style={{ fontSize: 12, color: '#555' }}>1-3f</span><span>{score.closes}</span>
        <span style={{ color: '#ffdd00' }}>Late</span><span style={{ fontSize: 12, color: '#555' }}>3-10f</span><span>{score.lates}</span>
        <span style={{ color: '#ff8844' }}>Sloppy</span><span style={{ fontSize: 12, color: '#555' }}>10-20f</span><span>{score.sloppies}</span>
        <span style={{ color: '#ff3344' }}>Miss</span><span style={{ fontSize: 12, color: '#555' }}>20f+</span><span>{score.misses}</span>
        <span style={{ color: '#88aaff' }}>Max Combo</span><span /><span>{score.maxCombo}</span>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <button onClick={onRetry} style={btnStyle}>Retry</button>
        <button onClick={onMenu} style={{ ...btnStyle, background: '#333' }}>Menu</button>
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: '12px 32px', fontSize: 16, fontFamily: 'monospace',
  background: '#2244aa', color: '#fff', border: 'none', borderRadius: 8,
  cursor: 'pointer',
};
