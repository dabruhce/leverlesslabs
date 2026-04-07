import React, { useState, useRef, useEffect } from 'react';
import { SessionRun, GameId } from '@shared/types';
import { SessionStore } from '@shared/SessionStore';
import { GameRegistry } from '@shared/registry/GameRegistry';

interface StatsScreenProps {
  onBack: () => void;
}

type StatsTab = 'overview' | 'charts' | 'history';

export const StatsScreen: React.FC<StatsScreenProps> = ({ onBack }) => {
  const [tab, setTab] = useState<StatsTab>('overview');
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const runs = SessionStore.getAllRuns();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: 'monospace', background: '#0a0a1a', color: '#ccc',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderBottom: '1px solid #222', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={headerBtn}>&#x2190; Back</button>
          <span style={{ fontSize: 18, color: '#aac' }}>Session Tracker</span>
        </div>
        <span style={{ fontSize: 12, color: '#445' }}>{runs.length} total runs</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #222', flexShrink: 0 }}>
        {(['overview', 'charts', 'history'] as StatsTab[]).map(t => (
          <button key={t} onClick={() => { setTab(t); setSelectedChart(null); }} style={{
            padding: '10px 20px', fontFamily: 'monospace', fontSize: 13,
            background: tab === t ? '#1a1a3a' : 'transparent',
            color: tab === t ? '#88aaff' : '#666',
            border: 'none', borderBottom: tab === t ? '2px solid #4466cc' : '2px solid transparent',
            cursor: 'pointer', textTransform: 'capitalize',
          }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {tab === 'overview' && <OverviewTab />}
        {tab === 'charts' && <ChartsTab selectedChart={selectedChart} onSelectChart={setSelectedChart} />}
        {tab === 'history' && <HistoryTab />}
      </div>
    </div>
  );
};

// ── Overview Tab ──

const OverviewTab: React.FC = () => {
  const stats = SessionStore.getOverallStats();
  if (!stats) return <EmptyState text="No sessions recorded yet. Play some charts to start tracking!" />;

  const hitRate = stats.totalNotes > 0
    ? ((stats.totalPerfects + stats.totalCloses + stats.totalLates) / stats.totalNotes * 100).toFixed(1)
    : '0';

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Runs" value={stats.totalRuns.toString()} />
        <StatCard label="Charts Played" value={stats.uniqueCharts.toString()} />
        <StatCard label="Active Days" value={stats.activeDays.toString()} />
        <StatCard label="Avg Accuracy" value={`${stats.avgAccuracy.toFixed(1)}%`} color={accuracyColor(stats.avgAccuracy)} />
        <StatCard label="Total Notes" value={stats.totalNotes.toString()} />
        <StatCard label="Hit Rate" value={`${hitRate}%`} />
      </div>

      {/* Grade breakdown */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, color: '#667', marginBottom: 12 }}>Grade Breakdown</h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <GradeBar label="Perfect" count={stats.totalPerfects} total={stats.totalNotes} color="#00ff88" />
          <GradeBar label="Close" count={stats.totalCloses} total={stats.totalNotes} color="#44ddff" />
          <GradeBar label="Late" count={stats.totalLates} total={stats.totalNotes} color="#ffdd00" />
          <GradeBar label="Sloppy" count={stats.totalSloppies} total={stats.totalNotes} color="#ff8844" />
          <GradeBar label="Miss" count={stats.totalMisses} total={stats.totalNotes} color="#ff3344" />
        </div>
      </div>

      {/* Activity heatmap */}
      <div>
        <h3 style={{ fontSize: 14, color: '#667', marginBottom: 12 }}>Activity</h3>
        <ActivityGrid byDay={stats.byDay} />
      </div>
    </div>
  );
};

// ── Charts Tab ──

const ChartsTab: React.FC<{ selectedChart: string | null; onSelectChart: (id: string | null) => void }> = ({
  selectedChart, onSelectChart,
}) => {
  const runs = SessionStore.getAllRuns();
  const chartIds = [...new Set(runs.map(r => r.chartId))];

  if (chartIds.length === 0) return <EmptyState text="No chart data yet." />;

  if (selectedChart) {
    return <ChartDetail chartId={selectedChart} onBack={() => onSelectChart(null)} />;
  }

  // Group by game
  const byGame = new Map<GameId, string[]>();
  for (const id of chartIds) {
    const run = runs.find(r => r.chartId === id)!;
    const list = byGame.get(run.game) ?? [];
    list.push(id);
    byGame.set(run.game, list);
  }

  return (
    <div>
      {[...byGame.entries()].map(([game, ids]) => {
        const gameDef = GameRegistry.getGame(game);
        return (
          <div key={game} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, color: '#667', marginBottom: 8 }}>{gameDef.label}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ids.map(chartId => {
                const stats = SessionStore.getChartStats(chartId);
                const title = runs.find(r => r.chartId === chartId)?.chartTitle ?? chartId;
                if (!stats) return null;
                return (
                  <button key={chartId} onClick={() => onSelectChart(chartId)} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', background: '#111128', border: '1px solid #222',
                    borderRadius: 6, cursor: 'pointer', fontFamily: 'monospace', fontSize: 13,
                    color: '#ccc', textAlign: 'left',
                  }}>
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{title}</div>
                      <div style={{ fontSize: 11, color: '#555' }}>
                        {stats.totalRuns} runs &middot; last {timeAgo(stats.lastPlayed)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: accuracyColor(stats.bestAccuracy), fontSize: 14 }}>
                          {stats.bestAccuracy.toFixed(1)}%
                        </div>
                        <div style={{ fontSize: 10, color: '#555' }}>best</div>
                      </div>
                      <div style={{
                        fontSize: 24, fontWeight: 'bold',
                        color: gradeColor(stats.bestGrade),
                      }}>
                        {stats.bestGrade}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Chart Detail ──

const ChartDetail: React.FC<{ chartId: string; onBack: () => void }> = ({ chartId, onBack }) => {
  const runs = SessionStore.getRunsForChart(chartId);
  const stats = SessionStore.getChartStats(chartId);
  if (!stats || runs.length === 0) return <EmptyState text="No data." />;

  const title = runs[0].chartTitle;

  return (
    <div>
      <button onClick={onBack} style={{ ...headerBtn, marginBottom: 16 }}>&#x2190; All Charts</button>
      <h2 style={{ fontSize: 18, color: '#aac', marginBottom: 4 }}>{title}</h2>
      <div style={{ fontSize: 12, color: '#555', marginBottom: 20 }}>
        {stats.totalRuns} runs &middot; best combo {stats.bestCombo}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Best" value={`${stats.bestAccuracy.toFixed(1)}%`} color={accuracyColor(stats.bestAccuracy)} />
        <StatCard label="Average" value={`${stats.avgAccuracy.toFixed(1)}%`} color={accuracyColor(stats.avgAccuracy)} />
        <StatCard label="Last 10 Avg" value={`${stats.recentAvg.toFixed(1)}%`} color={accuracyColor(stats.recentAvg)} />
        <StatCard label="Best Grade" value={stats.bestGrade} color={gradeColor(stats.bestGrade)} />
      </div>

      {/* Accuracy graph */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, color: '#667', marginBottom: 12 }}>Accuracy Over Time</h3>
        <AccuracyGraph runs={runs} />
      </div>

      {/* Run history */}
      <h3 style={{ fontSize: 14, color: '#667', marginBottom: 8 }}>Run History</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[...runs].reverse().slice(0, 30).map(run => (
          <RunRow key={run.id} run={run} />
        ))}
      </div>
    </div>
  );
};

// ── History Tab ──

const HistoryTab: React.FC = () => {
  const recent = SessionStore.getRecentRuns(50);
  if (recent.length === 0) return <EmptyState text="No runs yet." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {recent.map(run => <RunRow key={run.id} run={run} showChart />)}
    </div>
  );
};

// ── Accuracy Graph (canvas) ──

const AccuracyGraph: React.FC<{ runs: SessionRun[] }> = ({ runs }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const W = 600, H = 160;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#111128';
    ctx.fillRect(0, 0, W, H);

    if (runs.length < 2) {
      ctx.fillStyle = '#333';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Need at least 2 runs for a graph', W / 2, H / 2);
      return;
    }

    const pad = { top: 10, right: 10, bottom: 20, left: 40 };
    const gw = W - pad.left - pad.right;
    const gh = H - pad.top - pad.bottom;

    // Y axis: 0-100%
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 0.5;
    for (let pct = 0; pct <= 100; pct += 25) {
      const y = pad.top + gh - (pct / 100) * gh;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + gw, y);
      ctx.stroke();
      ctx.fillStyle = '#335';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${pct}%`, pad.left - 4, y);
    }

    // Plot accuracy line
    ctx.beginPath();
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 2;
    runs.forEach((run, i) => {
      const x = pad.left + (i / (runs.length - 1)) * gw;
      const y = pad.top + gh - (run.accuracy / 100) * gh;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots
    runs.forEach((run, i) => {
      const x = pad.left + (i / (runs.length - 1)) * gw;
      const y = pad.top + gh - (run.accuracy / 100) * gh;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = accuracyColor(run.accuracy);
      ctx.fill();
    });

    // Moving average (last 5)
    if (runs.length >= 5) {
      ctx.beginPath();
      ctx.strokeStyle = '#00ff8866';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      for (let i = 4; i < runs.length; i++) {
        const avg = runs.slice(i - 4, i + 1).reduce((a, r) => a + r.accuracy, 0) / 5;
        const x = pad.left + (i / (runs.length - 1)) * gw;
        const y = pad.top + gh - (avg / 100) * gh;
        if (i === 4) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [runs]);

  return <canvas ref={canvasRef} width={W} height={H} style={{ borderRadius: 6, border: '1px solid #222' }} />;
};

// ── Activity Grid ──

const ActivityGrid: React.FC<{ byDay: Map<string, number> }> = ({ byDay }) => {
  const today = new Date();
  const days: { date: string; count: number }[] = [];
  for (let i = 41; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, count: byDay.get(key) ?? 0 });
  }

  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {days.map(d => (
        <div key={d.date} title={`${d.date}: ${d.count} runs`} style={{
          width: 14, height: 14, borderRadius: 2,
          background: d.count === 0 ? '#151520'
            : d.count <= 2 ? '#1a3322'
            : d.count <= 5 ? '#225533'
            : '#33aa55',
        }} />
      ))}
    </div>
  );
};

// ── Shared components ──

const RunRow: React.FC<{ run: SessionRun; showChart?: boolean }> = ({ run, showChart }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 12px', background: '#111128', borderRadius: 4, fontSize: 12,
  }}>
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <span style={{ color: gradeColor(run.grade), fontWeight: 'bold', fontSize: 16, width: 20 }}>
        {run.grade}
      </span>
      <div>
        {showChart && <div style={{ color: '#aac', fontSize: 12 }}>{run.chartTitle}</div>}
        <div style={{ color: '#555', fontSize: 10 }}>
          {new Date(run.timestamp).toLocaleString()}
          {run.loopCount > 1 && <span style={{ color: '#4466cc' }}> &middot; {run.loopCount}x loops</span>}
        </div>
      </div>
    </div>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11 }}>
      <span style={{ color: '#00ff88' }}>P:{run.score.perfects}</span>
      <span style={{ color: '#44ddff' }}>C:{run.score.closes}</span>
      <span style={{ color: '#ffdd00' }}>L:{run.score.lates}</span>
      <span style={{ color: '#ff8844' }}>S:{run.score.sloppies}</span>
      <span style={{ color: '#ff3344' }}>M:{run.score.misses}</span>
      <span style={{ color: accuracyColor(run.accuracy), fontWeight: 'bold' }}>
        {run.accuracy.toFixed(1)}%
      </span>
    </div>
  </div>
);

const StatCard: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div style={{
    padding: '12px 16px', background: '#111128', borderRadius: 6, border: '1px solid #222',
  }}>
    <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 'bold', color: color ?? '#ccc' }}>{value}</div>
  </div>
);

const GradeBar: React.FC<{ label: string; count: number; total: number; color: string }> = ({
  label, count, total, color,
}) => {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ flex: 1, minWidth: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
        <span style={{ color }}>{label}</span>
        <span style={{ color: '#555' }}>{count} ({pct.toFixed(1)}%)</span>
      </div>
      <div style={{ height: 6, background: '#1a1a2e', borderRadius: 3 }}>
        <div style={{ height: 6, background: color, borderRadius: 3, width: `${pct}%`, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ color: '#444', fontSize: 14, textAlign: 'center', marginTop: 60 }}>{text}</div>
);

// ── Helpers ──

function accuracyColor(acc: number): string {
  if (acc >= 95) return '#00ffcc';
  if (acc >= 85) return '#00ff88';
  if (acc >= 70) return '#ffdd00';
  if (acc >= 50) return '#ff8800';
  return '#ff3344';
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'S': return '#00ffcc';
    case 'A': return '#00ff88';
    case 'B': return '#ffdd00';
    case 'C': return '#ff8800';
    default: return '#ff3344';
  }
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const headerBtn: React.CSSProperties = {
  padding: '6px 14px', fontFamily: 'monospace', fontSize: 12,
  background: '#1a1a2e', color: '#aac', border: '1px solid #333',
  borderRadius: 4, cursor: 'pointer',
};
