import { GameRegistry } from './GameRegistry';
import { TekkenParser } from '../parsers/TekkenParser';
import { SFParser } from '../parsers/SFParser';
import { GameDefinition } from '../types';

const tekkenDef: GameDefinition = {
  id: 'tekken',
  label: 'Tekken 8',
  buttons: ['lp', 'mp', 'lk', 'hk'], // lp=1, mp(rp)=2, lk=3, hk(rk)=4
  laneLabels: ['b', 'd', 'u', 'f', '1', '2', '3', '4'],
  laneInputMap: ['left', 'down', 'up', 'right', 'lp', 'mp', 'lk', 'hk'],
  defaultKeyMap: {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    u: 'lp',
    i: 'mp',
    j: 'lk',
    k: 'hk',
  },
  defaultLeverlessMap: {
    w: 'up',
    s: 'down',
    a: 'left',
    d: 'right',
    u: 'lp',
    i: 'mp',
    j: 'lk',
    k: 'hk',
  },
  parser: new TekkenParser(),
};

const sfDef: GameDefinition = {
  id: 'sf',
  label: 'Street Fighter 6',
  buttons: ['lp', 'mp', 'hp', 'lk', 'mk', 'hk'],
  laneLabels: ['b', 'd', 'u', 'f', 'LP', 'MP', 'HP', 'LK', 'MK', 'HK'],
  laneInputMap: ['left', 'down', 'up', 'right', 'lp', 'mp', 'hp', 'lk', 'mk', 'hk'],
  defaultKeyMap: {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    u: 'lp',
    i: 'mp',
    o: 'hp',
    j: 'lk',
    k: 'mk',
    l: 'hk',
  },
  defaultLeverlessMap: {
    w: 'up',
    s: 'down',
    a: 'left',
    d: 'right',
    u: 'lp',
    i: 'mp',
    o: 'hp',
    j: 'lk',
    k: 'mk',
    l: 'hk',
  },
  parser: new SFParser(),
};

export function registerAllGames(): void {
  GameRegistry.register(tekkenDef);
  GameRegistry.register(sfDef);
}
