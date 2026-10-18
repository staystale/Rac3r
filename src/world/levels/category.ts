// TRACK CATEGORIES: a level's kind, by id, else generated / set rally stages -> rally, endless ->
// roads, anything new and unlisted -> circuits (so a new level is never hidden). The menu groups
// the track list by it (menu/tracks.js) and the lamp plan lights each kind its own way
// (world/lampplan.ts).

const CAT_OF: Record<string, string> = { 'test-track': 'circuits', thruston: 'circuits',
  'castle-cum': 'circuits', 'brands-snatch': 'circuits', 'brands-snatch-indy': 'circuits',
  'sweaty-lamb': 'rally', killder: 'rally', knobhill: 'rx', 'slidden-hill': 'rx',
  'grass-track': 'ovals', 'stock-car': 'ovals', naffcar: 'ovals',
  lab: 'test', sandbox: 'test', 'bowling-alley': 'test', 'rough-patch': 'test' };

/**
 * A level's category.
 * @param level the level (id; gen for a generated stage, endless for the highway)
 * @returns circuits, rally, rx, ovals, roads or test
 */
export const catOf = (level: { id: string; gen?: unknown; endless?: boolean }): string =>
  CAT_OF[level.id] || (level.gen ? 'rally' : level.endless ? 'roads' : 'circuits');
