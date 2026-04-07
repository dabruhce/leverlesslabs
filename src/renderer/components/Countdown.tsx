import React, { useEffect, useState } from 'react';

interface CountdownProps {
  onComplete: () => void;
}

export const Countdown: React.FC<CountdownProps> = ({ onComplete }) => {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count <= 0) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [count, onComplete]);

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.8)', zIndex: 1000,
      fontFamily: 'monospace',
    }}>
      <div style={{
        fontSize: 120, fontWeight: 'bold',
        color: count > 0 ? '#4466cc' : '#00ff88',
        textShadow: '0 0 40px rgba(68,102,204,0.5)',
      }}>
        {count > 0 ? count : 'GO!'}
      </div>
    </div>
  );
};
