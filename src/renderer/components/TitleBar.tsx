import React from 'react';

export const TitleBar: React.FC = () => {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      height: 32, background: '#08080f', borderBottom: '1px solid #1a1a2e',
      userSelect: 'none', flexShrink: 0,
      paddingLeft: 12,
    }}>
      <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#445' }}>
        Leverless Controller Trainer
      </span>
    </div>
  );
};
