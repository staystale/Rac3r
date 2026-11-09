// TRACK CATEGORIES: a level's kind, by id, else generated / set rally stages -> rally, endless ->
// roads, anything new and unlisted -> circuits (so a new level is never hidden). The menu groups
// the track list by it (menu/tracks.ts) and the lamp plan lights each kind its own way
// (world/lampplan.ts).
import type { Level } from '../types.ts';

const CAT_OF: Record<string, string> = { 'test-track': 'circuits', thruston: 'circuits',
  'castle-cum': 'circuits', 'brands-snatch': 'circuits', 'brands-snatch-indy': 'circuits',
  snotterton: 'circuits', 'snotterton-200': 'circuits', 'snotterton-100': 'circuits',
  'knobhill-circuit': 'circuits', dongington: 'circuits', 'dongington-national': 'circuits',
  sillystone: 'circuits', 'sillystone-national': 'circuits', oultonpork: 'circuits',
  'oultonpork-island': 'circuits', 'oultonpork-fosters': 'circuits', cadwallop: 'circuits',
  'cadwallop-club': 'circuits', malarkey: 'circuits', 'malarkey-oval': 'circuits',
  anglesleazy: 'circuits', 'anglesleazy-coastal': 'circuits', 'anglesleazy-national': 'circuits',
  'anglesleazy-club': 'circuits', goodwoody: 'circuits', croughed: 'circuits',
  'croughed-club': 'circuits', spa: 'circuits',
  'sweaty-lamb': 'rally', killder: 'rally', knobhill: 'rx', 'slidden-hill': 'rx',
  'grass-track': 'ovals', dieatona: 'ovals', 'dieatona-road': 'ovals', 'stock-car': 'ovals',
  naffcar: 'ovals',
  lab: 'test', sandbox: 'test', 'bowling-alley': 'test', 'rough-patch': 'test',
  'crash-bench': 'test' };

/**
 * A level's category.
 * @param level the level (id; gen for a generated stage, endless for the highway)
 * @returns circuits, rally, rx, ovals, roads or test
 */
export const catOf = (level: { id: string; gen?: unknown; endless?: boolean }): string =>
  CAT_OF[level.id] || (level.gen ? 'rally' : level.endless ? 'roads' : 'circuits');

// listed in the menu under another category than its kind (owner 11-09: "The test track should
// go with other test tracks" - it is still lit and rained on as a circuit)
const LISTED_UNDER: Record<string, string> = { 'test-track': 'test' };

/**
 * The category a level is listed under in the menu (menu/tracks.ts).
 * @param level the level
 * @returns circuits, rally, rx, ovals, roads or test
 */
export const menuCatOf = (level: { id: string; gen?: unknown; endless?: boolean }): string =>
  LISTED_UNDER[level.id] || catOf(level);

/**
 * A level's lap (a rally stage's length), m, for the menu (owner 11-09: "Can tracks show their
 * length when selecting them / Especially between version of themselves"): a level built on first
 * use from what it carries before (Level._lap: a venue's traced road), a generated stage from its
 * recipe; 0 for the endless roads and the test grounds (no lap).
 * @param level the level
 * @returns metres (0: none to show)
 */
export function lapOf(level: Level): number {
  if (level.endless || catOf(level) === 'test') return 0;
  if (level._lap) return level._lap();
  if (level.gen?.km) return level.gen.km * 1000;
  return level.subtrack?.totalDist || 0;
}
