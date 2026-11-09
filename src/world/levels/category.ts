// TRACK CATEGORIES: a level's kind, by id, else generated / set rally stages -> rally, endless ->
// roads, anything new and unlisted -> circuits (so a new level is never hidden). The menu groups
// the track list by it (menu/tracks.ts) and the lamp plan lights each kind its own way
// (world/lampplan.ts).

const CAT_OF: Record<string, string> = { 'test-track': 'circuits', thruston: 'circuits',
  'castle-cum': 'circuits', 'brands-snatch': 'circuits', 'brands-snatch-indy': 'circuits',
  snotterton: 'circuits', 'snotterton-200': 'circuits', 'snotterton-100': 'circuits',
  'knobhill-circuit': 'circuits', dongington: 'circuits', 'dongington-national': 'circuits',
  sillystone: 'circuits', 'sillystone-national': 'circuits',
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
