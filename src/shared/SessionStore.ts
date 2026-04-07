import { SessionRun, ScoreState, GameId } from './types';

const STORAGE_KEY = 'fgctrainer-sessions';
const MAX_RUNS = 500;

function loadRuns(): SessionRun[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRuns(runs: SessionRun[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.slice(-MAX_RUNS)));
}

export function getLetterGrade(accuracy: number): string {
  if (accuracy >= 95) return 'S';
  if (accuracy >= 85) return 'A';
  if (accuracy >= 70) return 'B';
  if (accuracy >= 50) return 'C';
  return 'F';
}

export function computeAccuracy(score: ScoreState): number {
  const total = score.perfects + score.closes + score.lates + score.sloppies + score.misses;
  if (total === 0) return 0;
  const hits = score.perfects + score.closes + score.lates;
  return (hits / total) * 100;
}

export const SessionStore = {
  getAllRuns(): SessionRun[] {
    return loadRuns();
  },

  getRunsForChart(chartId: string): SessionRun[] {
    return loadRuns().filter(r => r.chartId === chartId);
  },

  getRunsForGame(game: GameId): SessionRun[] {
    return loadRuns().filter(r => r.game === game);
  },

  getRecentRuns(limit: number = 20): SessionRun[] {
    return loadRuns().slice(-limit).reverse();
  },

  saveRun(run: SessionRun): void {
    const runs = loadRuns();
    runs.push(run);
    saveRuns(runs);
  },

  createRun(
    chartId: string,
    chartTitle: string,
    game: GameId,
    score: ScoreState,
    totalNotes: number,
    loopCount: number = 1,
  ): SessionRun {
    const accuracy = computeAccuracy(score);
    return {
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      chartId,
      chartTitle,
      game,
      timestamp: Date.now(),
      score,
      totalNotes,
      accuracy,
      grade: getLetterGrade(accuracy),
      loopCount,
    };
  },

  getChartStats(chartId: string) {
    const runs = this.getRunsForChart(chartId);
    if (runs.length === 0) return null;

    const accuracies = runs.map(r => r.accuracy);
    const bestAccuracy = Math.max(...accuracies);
    const avgAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
    const recentRuns = runs.slice(-10);
    const recentAvg = recentRuns.length > 0
      ? recentRuns.reduce((a, r) => a + r.accuracy, 0) / recentRuns.length
      : 0;
    const bestCombo = Math.max(...runs.map(r => r.score.maxCombo));

    return {
      totalRuns: runs.length,
      bestAccuracy,
      avgAccuracy,
      recentAvg,
      bestCombo,
      bestGrade: getLetterGrade(bestAccuracy),
      lastPlayed: runs[runs.length - 1].timestamp,
    };
  },

  getOverallStats() {
    const runs = loadRuns();
    if (runs.length === 0) return null;

    const totalNotes = runs.reduce((a, r) => a + r.totalNotes, 0);
    const totalPerfects = runs.reduce((a, r) => a + r.score.perfects, 0);
    const totalCloses = runs.reduce((a, r) => a + r.score.closes, 0);
    const totalLates = runs.reduce((a, r) => a + r.score.lates, 0);
    const totalSloppies = runs.reduce((a, r) => a + r.score.sloppies, 0);
    const totalMisses = runs.reduce((a, r) => a + r.score.misses, 0);
    const avgAccuracy = runs.reduce((a, r) => a + r.accuracy, 0) / runs.length;

    // Group by day for activity
    const byDay = new Map<string, number>();
    for (const run of runs) {
      const day = new Date(run.timestamp).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }

    // Unique charts played
    const uniqueCharts = new Set(runs.map(r => r.chartId)).size;

    return {
      totalRuns: runs.length,
      totalNotes,
      totalPerfects,
      totalCloses,
      totalLates,
      totalSloppies,
      totalMisses,
      avgAccuracy,
      uniqueCharts,
      activeDays: byDay.size,
      byDay,
    };
  },

  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
