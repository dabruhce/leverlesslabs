import React, { useState, useEffect, useCallback } from 'react';
import { AppScreen, BeatMap, ScoreState, GameId, ButtonId, DirectionId, InputDevice, GamepadButtonMap } from '@shared/types';
import { registerAllGames } from '@shared/registry/registerGames';
import { GameRegistry } from '@shared/registry/GameRegistry';
import { validateBeatMap } from '@shared/BeatMapLoader';
import { ChartSelectScreen } from './components/ChartSelectScreen';
import { GameScreen } from './components/GameScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { ChartEditor } from './components/ChartEditor';
import { ChartRecorder } from './components/ChartRecorder';
import { StatsScreen } from './components/StatsScreen';
import { TitleBar } from './components/TitleBar';
import { SessionStore, computeAccuracy, getLetterGrade } from '@shared/SessionStore';
import { KeyMap } from './hooks/useInput';
import YAML from 'yaml';

// Register all games on startup
registerAllGames();

// Import all chart YAML files as raw strings
const chartModules = import.meta.glob('/assets/charts/*.yaml', { eager: true, query: '?raw', import: 'default' });

// Import all audio files as resolved URLs
const audioModules = import.meta.glob('/assets/audio/*.{mp3,ogg,wav,m4a}', { eager: true, import: 'default' }) as Record<string, string>;

// Map chart audioFile values (e.g. "audio/kbd-track.mp3") to resolved URLs
function resolveAudioUrl(audioFile: string): string | null {
  // Try matching against the glob results
  const key = `/assets/${audioFile}`;
  if (audioModules[key]) return audioModules[key];
  // Try all keys for a filename match
  const filename = audioFile.split('/').pop();
  for (const [k, url] of Object.entries(audioModules)) {
    if (k.endsWith(`/${filename}`)) return url;
  }
  return null;
}

function loadAllCharts(): BeatMap[] {
  const charts: BeatMap[] = [];
  for (const [path, raw] of Object.entries(chartModules)) {
    try {
      const data = YAML.parse(raw as string);
      charts.push(validateBeatMap(data));
    } catch (e) {
      console.warn(`Failed to load chart ${path}:`, e);
    }
  }
  return charts;
}

type AllKeyMaps = Record<GameId, Record<string, ButtonId | DirectionId>>;

function getDefaultKeyMaps(): AllKeyMaps {
  const maps: Record<string, Record<string, ButtonId | DirectionId>> = {};
  for (const game of GameRegistry.getAllGames()) {
    maps[game.id] = { ...game.defaultKeyMap };
  }
  return maps as AllKeyMaps;
}

function getDefaultLeverlessMaps(): AllKeyMaps {
  const maps: Record<string, Record<string, ButtonId | DirectionId>> = {};
  for (const game of GameRegistry.getAllGames()) {
    maps[game.id] = { ...game.defaultLeverlessMap };
  }
  return maps as AllKeyMaps;
}

function loadPersisted<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function persist(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadPersistedDevice(): InputDevice | null {
  try {
    const stored = localStorage.getItem('fgctrainer-device');
    if (stored === 'keyboard' || stored === 'leverless' || stored === 'controller') return stored;
    return null;
  } catch {
    return null;
  }
}

function loadCustomCharts(): BeatMap[] {
  try {
    const stored = localStorage.getItem('fgctrainer-custom-charts');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function persistCustomCharts(charts: BeatMap[]): void {
  localStorage.setItem('fgctrainer-custom-charts', JSON.stringify(charts));
}

const App: React.FC = () => {
  const [screen, setScreen] = useState<AppScreen>('chart-select');
  const [gameKey, setGameKey] = useState(0);
  const [builtInCharts] = useState<BeatMap[]>(loadAllCharts);
  const [customCharts, setCustomCharts] = useState<BeatMap[]>(loadCustomCharts);
  const [editingChart, setEditingChart] = useState<BeatMap | null>(null);
  const [activeChart, setActiveChart] = useState<BeatMap | null>(null);
  const [lastScore, setLastScore] = useState<ScoreState | null>(null);
  const charts = [...builtInCharts, ...customCharts];
  const [keyMaps, setKeyMaps] = useState<AllKeyMaps>(() => loadPersisted('fgctrainer-keymaps') ?? getDefaultKeyMaps());
  const [leverlessMaps, setLeverlessMaps] = useState<AllKeyMaps>(() => loadPersisted('fgctrainer-leverlessmaps') ?? getDefaultLeverlessMaps());
  const [inputDevice, setInputDevice] = useState<InputDevice>(() => loadPersistedDevice() ?? 'keyboard');
  const [gamepadMap, setGamepadMap] = useState<GamepadButtonMap>(() => loadPersisted('fgctrainer-gamepadmap') ?? {});
  const [debugMode, setDebugMode] = useState(false);

  // Toggle debug mode with F3
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F3') setDebugMode(d => !d);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSelectChart = useCallback((chart: BeatMap) => {
    setActiveChart(chart);
    setGameKey(k => k + 1);
    setScreen('playing');
  }, []);

  const handleFinish = useCallback((score: ScoreState, loopCount: number = 1) => {
    setLastScore(score);
    setScreen('results');
    // Save session run
    if (activeChart) {
      const run = SessionStore.createRun(
        activeChart.id, activeChart.title, activeChart.game,
        score, activeChart.notes.length * loopCount, loopCount,
      );
      SessionStore.saveRun(run);
    }
  }, [activeChart]);

  const handleRetry = useCallback(() => {
    setGameKey(k => k + 1);
    setScreen('playing');
  }, []);

  const handleMenu = useCallback(() => {
    setActiveChart(null);
    setLastScore(null);
    setScreen('chart-select');
  }, []);

  const handleNewChart = useCallback(() => {
    setEditingChart(null);
    setScreen('chart-editor');
  }, []);

  const handleNewRecording = useCallback(() => {
    setScreen('chart-recorder');
  }, []);

  const handleEditChart = useCallback((chart: BeatMap) => {
    const isCustom = customCharts.some(c => c.id === chart.id);
    if (isCustom) {
      setEditingChart(chart);
    } else {
      // Clone built-in chart into a custom copy
      setEditingChart({
        ...chart,
        id: 'custom-' + Date.now(),
        title: chart.title + ' (copy)',
        notes: [...chart.notes],
      });
    }
    setScreen('chart-editor');
  }, [customCharts]);

  const handleSaveChart = useCallback((chart: BeatMap) => {
    setCustomCharts(prev => {
      const existing = prev.findIndex(c => c.id === chart.id);
      const updated = existing >= 0
        ? prev.map((c, i) => i === existing ? chart : c)
        : [...prev, chart];
      persistCustomCharts(updated);
      return updated;
    });
    setScreen('chart-select');
  }, []);

  const handleDeleteChart = useCallback((chartId: string) => {
    setCustomCharts(prev => {
      const updated = prev.filter(c => c.id !== chartId);
      persistCustomCharts(updated);
      return updated;
    });
  }, []);

  const handleImportCharts = useCallback((charts: BeatMap[]) => {
    setCustomCharts(prev => {
      const existingIds = new Set(prev.map(c => c.id));
      const newCharts = charts.filter(c => !existingIds.has(c.id));
      const updated = [...prev, ...newCharts];
      persistCustomCharts(updated);
      return updated;
    });
  }, []);

  const handleSaveSettings = useCallback((
    kbMaps: AllKeyMaps, lvMaps: AllKeyMaps, device: InputDevice, gpMap: GamepadButtonMap,
  ) => {
    setKeyMaps(kbMaps);
    persist('fgctrainer-keymaps', kbMaps);
    setLeverlessMaps(lvMaps);
    persist('fgctrainer-leverlessmaps', lvMaps);
    setInputDevice(device);
    persist('fgctrainer-device', JSON.stringify(device).replace(/"/g, ''));
    localStorage.setItem('fgctrainer-device', device);
    setGamepadMap(gpMap);
    persist('fgctrainer-gamepadmap', gpMap);
  }, []);

  const activeKeyMap: KeyMap = (() => {
    const gameId = activeChart?.game ?? 'tekken';
    if (inputDevice === 'leverless') return leverlessMaps[gameId] ?? {};
    return keyMaps[gameId] ?? {};
  })();

  let content: React.ReactNode;
  switch (screen) {
    case 'chart-select':
      content = (
        <ChartSelectScreen
          charts={charts}
          customChartIds={new Set(customCharts.map(c => c.id))}
          onSelectChart={handleSelectChart}
          onEditChart={handleEditChart}
          onDeleteChart={handleDeleteChart}
          onImportCharts={handleImportCharts}
          onNewChart={handleNewChart}
          onNewRecording={handleNewRecording}
          onOpenSettings={() => setScreen('settings')}
          onOpenStats={() => setScreen('stats')}
        />
      );
      break;

    case 'playing':
      if (!activeChart) return null;
      content = (
        <GameScreen
          key={activeChart.id + '-' + gameKey}
          chart={activeChart}
          audioUrl={resolveAudioUrl(activeChart.audioFile)}
          keyMap={activeKeyMap}
          inputDevice={inputDevice}
          gamepadMap={Object.keys(gamepadMap).length > 0 ? gamepadMap : undefined}
          onFinish={handleFinish}
          onBack={handleMenu}
          debugMode={debugMode}
        />
      );
      break;

    case 'results':
      if (!activeChart || !lastScore) return null;
      content = (
        <ResultsScreen
          chartTitle={activeChart.title}
          gameLabel={GameRegistry.getGame(activeChart.game).label}
          score={lastScore}
          totalNotes={activeChart.notes.length}
          onRetry={handleRetry}
          onMenu={handleMenu}
        />
      );
      break;

    case 'settings':
      content = (
        <SettingsScreen
          keyMaps={keyMaps}
          leverlessMaps={leverlessMaps}
          inputDevice={inputDevice}
          gamepadMap={gamepadMap}
          onSave={handleSaveSettings}
          onBack={() => setScreen('chart-select')}
        />
      );
      break;

    case 'chart-editor':
      content = (
        <ChartEditor
          chart={editingChart}
          onSave={handleSaveChart}
          onBack={() => setScreen('chart-select')}
        />
      );
      break;

    case 'stats':
      content = (
        <StatsScreen onBack={() => setScreen('chart-select')} />
      );
      break;

    case 'chart-recorder':
      content = (
        <ChartRecorder
          keyMaps={keyMaps}
          leverlessMaps={leverlessMaps}
          inputDevice={inputDevice}
          onSave={handleSaveChart}
          onBack={() => setScreen('chart-select')}
        />
      );
      break;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TitleBar />
      <div style={{ flex: 1, overflow: 'hidden' }}>{content}</div>
    </div>
  );
};

export default App;
