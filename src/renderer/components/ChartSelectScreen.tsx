import React, { useState } from 'react';
import { BeatMap, GameId } from '@shared/types';
import { GameRegistry } from '@shared/registry/GameRegistry';
import { ImportChartsDialog } from './ImportChartsDialog';

interface ChartSelectScreenProps {
  charts: BeatMap[];
  customChartIds: Set<string>;
  onSelectChart: (chart: BeatMap) => void;
  onEditChart: (chart: BeatMap) => void;
  onDeleteChart: (chartId: string) => void;
  onImportCharts: (charts: BeatMap[]) => void;
  onNewChart: () => void;
  onNewRecording: () => void;
  onOpenSettings: () => void;
  onOpenStats: () => void;
}

export const ChartSelectScreen: React.FC<ChartSelectScreenProps> = ({
  charts, customChartIds, onSelectChart, onEditChart, onDeleteChart, onImportCharts, onNewChart, onNewRecording, onOpenSettings, onOpenStats,
}) => {
  const [showImport, setShowImport] = useState(false);
  const allGameIds = GameRegistry.getRegisteredIds();
  const gameIdsWithCharts = allGameIds.filter(gid => charts.some(c => c.game === gid));
  const gameIds = gameIdsWithCharts.length > 0 ? gameIdsWithCharts : allGameIds;
  const [activeTab, setActiveTab] = useState<GameId>(gameIds[0] ?? 'tekken');

  const filteredCharts = charts.filter(c => c.game === activeTab);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: 'monospace', background: '#0a0a1a',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 32px', borderBottom: '1px solid #222',
      }}>
        <h1 style={{ fontSize: 24, color: '#aac' }}>Leverless Controller Trainer</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onNewChart} style={headerBtn}>+ New</button>
          <button onClick={onNewRecording} style={{ ...headerBtn, color: '#ff6644' }}>Record</button>
          <button onClick={() => setShowImport(true)} style={headerBtn}>Import</button>
          <button onClick={onOpenStats} style={headerBtn}>Stats</button>
          <button onClick={onOpenSettings} style={headerBtn}>Settings</button>
        </div>
      </div>

      {/* Game Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #222' }}>
        {gameIds.map(gid => {
          const game = GameRegistry.getGame(gid);
          return (
            <button
              key={gid}
              onClick={() => setActiveTab(gid)}
              style={{
                padding: '12px 24px', fontSize: 14, fontFamily: 'monospace',
                background: activeTab === gid ? '#1a1a3a' : 'transparent',
                color: activeTab === gid ? '#88aaff' : '#666',
                border: 'none', borderBottom: activeTab === gid ? '2px solid #4466cc' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              {game.label}
            </button>
          );
        })}
      </div>

      {/* Chart List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        {filteredCharts.length === 0 && (
          <div style={{ color: '#555', fontSize: 14, textAlign: 'center', marginTop: 60 }}>
            No charts available for this game yet.
            <br />
            <button onClick={onNewChart} style={{ ...headerBtn, marginTop: 12 }}>
              + Create one
            </button>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredCharts.map(chart => {
            const isCustom = customChartIds.has(chart.id);
            return (
              <div
                key={chart.id}
                style={{
                  display: 'flex', alignItems: 'center',
                  background: '#111128', border: '1px solid #222', borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                {/* Main clickable area */}
                <button
                  onClick={() => onSelectChart(chart)}
                  style={{
                    flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px 20px', background: 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left', color: '#ccc',
                    fontFamily: 'monospace', fontSize: 14,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                      {chart.title}
                      {isCustom && <span style={{ color: '#4466cc', fontSize: 11, marginLeft: 8 }}>custom</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {chart.notes.length} notes
                    </div>
                  </div>
                  <div style={{ color: '#88aaff', fontSize: 13 }}>
                    {chart.fps} FPS
                  </div>
                </button>

                <div style={{ display: 'flex', borderLeft: '1px solid #222' }}>
                  <button
                    onClick={() => onEditChart(chart)}
                    title={isCustom ? 'Edit chart' : 'Edit a copy'}
                    style={chartActionBtn}
                  >
                    {isCustom ? 'Edit' : 'Edit'}
                  </button>
                  {isCustom && (
                    <button
                      onClick={() => { if (confirm(`Delete "${chart.title}"?`)) onDeleteChart(chart.id); }}
                      title="Delete chart"
                      style={{ ...chartActionBtn, color: '#f66' }}
                    >
                      Del
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showImport && (
        <ImportChartsDialog
          onImport={(charts) => { onImportCharts(charts); setShowImport(false); }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
};

const headerBtn: React.CSSProperties = {
  padding: '8px 20px', fontSize: 13, fontFamily: 'monospace',
  background: '#222', color: '#888', border: '1px solid #333',
  borderRadius: 6, cursor: 'pointer',
};

const chartActionBtn: React.CSSProperties = {
  padding: '8px 14px', fontFamily: 'monospace', fontSize: 11,
  background: 'transparent', color: '#88aaff', border: 'none',
  cursor: 'pointer',
};
