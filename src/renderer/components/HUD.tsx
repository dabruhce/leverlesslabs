import React from 'react';
import { ScoreState } from '@shared/types';

interface HUDProps {
  score: ScoreState;
  showMissFlash: boolean;
}

export const HUD: React.FC<HUDProps> = ({ score, showMissFlash }) => {
  const totalResolved = score.perfects + score.closes + score.lates + score.sloppies + score.misses;
  const hits = score.perfects + score.closes + score.lates;
  const accuracy = totalResolved > 0
    ? Math.round((hits / totalResolved) * 100)
    : 100;

  return (
    <div style={{
      position: 'absolute', top: 16, left: 16,
      fontFamily: 'monospace', fontSize: 14, lineHeight: 1.8,
      color: '#ccc', userSelect: 'none',
    }}>
      <div style={{ fontSize: 32, fontWeight: 'bold', color: score.combo > 0 ? '#00ff88' : '#666' }}>
        {score.combo > 0 ? `${score.combo}x` : ''}
      </div>
      {showMissFlash && (
        <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff3344', animation: 'fadeOut 0.5s' }}>
          MISS
        </div>
      )}
      <div>Accuracy: {accuracy}%</div>
      <div>Max Combo: {score.maxCombo}</div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#666', lineHeight: 1.6 }}>
        <span style={{ color: '#00ff88' }}>P:{score.perfects}</span>
        {' '}
        <span style={{ color: '#44ddff' }}>C:{score.closes}</span>
        {' '}
        <span style={{ color: '#ffdd00' }}>L:{score.lates}</span>
        {' '}
        <span style={{ color: '#ff8844' }}>S:{score.sloppies}</span>
        {' '}
        <span style={{ color: '#ff3344' }}>M:{score.misses}</span>
      </div>
    </div>
  );
};
