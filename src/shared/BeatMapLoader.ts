import { BeatMap } from './types';
import { GameRegistry } from './registry/GameRegistry';

export function validateBeatMap(data: unknown): BeatMap {
  const map = data as BeatMap;
  if (!map.id || !map.title || !map.game || !map.fps || !map.notes) {
    throw new Error('Invalid BeatMap: missing required fields');
  }

  const game = GameRegistry.getGame(map.game);
  const maxLane = game.laneLabels.length - 1;

  for (const note of map.notes) {
    // Default endTime to time if missing (backward compat)
    if (note.endTime == null) note.endTime = note.time;
    if (note.lane < 0 || note.lane > maxLane) {
      throw new Error(`Invalid lane ${note.lane} in chart "${map.title}". Must be 0–${maxLane}.`);
    }
  }

  return map;
}

export async function loadChart(chartPath: string): Promise<BeatMap> {
  const response = await fetch(chartPath);
  if (!response.ok) throw new Error(`Failed to load chart: ${chartPath}`);
  const data = await response.json();
  return validateBeatMap(data);
}

export function loadChartFromJson(data: unknown): BeatMap {
  return validateBeatMap(data);
}
