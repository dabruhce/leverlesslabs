import { GameDefinition, GameId } from '../types';

const registry = new Map<GameId, GameDefinition>();

export const GameRegistry = {
  register(def: GameDefinition): void {
    registry.set(def.id, def);
  },

  getGame(id: GameId): GameDefinition {
    const def = registry.get(id);
    if (!def) throw new Error(`Game "${id}" not registered`);
    return def;
  },

  getAllGames(): GameDefinition[] {
    return Array.from(registry.values());
  },

  getRegisteredIds(): GameId[] {
    return Array.from(registry.keys());
  },
};
