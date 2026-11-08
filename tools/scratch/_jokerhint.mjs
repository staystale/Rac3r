import fs from 'node:fs';
function sub(path, a, b) {
  const s = fs.readFileSync(path, 'utf8');
  if (!s.includes(a)) throw new Error(path + ': ' + a);
  fs.writeFileSync(path, s.replace(a, () => b));
}
sub('src/core/fixes.ts', `export const FIX = {
  // ?smokelinger=1`, `export const FIX = {
  // ?jokerhint=1: the lap panel's joker "approaching" hint works out where the turn-off is
  // (hud/laps.ts)
  jokerHint: atLoad('jokerhint'),
  // ?smokelinger=1`);
const L = 'src/hud/laps.ts';
sub(L, "import { COL } from '../world/colours.ts';", "import { COL } from '../world/colours.ts';\nimport { querySubtrack } from '../world/tyrewall.ts';\nimport { FIX } from '../core/fixes.ts';");
sub(L, `function jokerIsNear(game: HudGame, race: HudRace) {
  const jokerArrow = LEVEL.joker && LEVEL.joker.arrows
    && LEVEL.joker.arrows.find((x) => x && x.d != null), trackDist = game.trackD;
  const near = race.started && !race.joker && jokerArrow && trackDist != null
    && (((jokerArrow.d! - trackDist) % LEVEL.subtrack!.totalDist)
    + LEVEL.subtrack!.totalDist) % LEVEL.subtrack!.totalDist < 140;
  return near;
}`, `function jokerIsNear(game: HudGame, race: HudRace) {
  const trackDist = game.trackD;
  if (FIX.jokerHint) {
    const turnDist = jokerTurnDist(), total = LEVEL.subtrack ? LEVEL.subtrack.totalDist : 0;
    return race.started && !race.joker && turnDist != null && trackDist != null && total > 0
      && (((turnDist - trackDist) % total) + total) % total < 140;
  }
  const jokerArrow = LEVEL.joker && LEVEL.joker.arrows
    && LEVEL.joker.arrows.find((x) => x && x.d != null);
  const near = race.started && !race.joker && jokerArrow && trackDist != null
    && (((jokerArrow.d! - trackDist) % LEVEL.subtrack!.totalDist)
    + LEVEL.subtrack!.totalDist) % LEVEL.subtrack!.totalDist < 140;
  return near;
}

// ?jokerhint=1 (owner 11-03: "yes", fix it): the hint read each arrow's track distance d, which
// nothing ever set, so it never showed. The turn-off's distance round the track is now worked out
// once per level from the first arrow (the one in the joker's mouth: world/levels jokerArrow).
const turnDists = new WeakMap<object, number | null>();
/**
 * The joker turn-off's distance round the track, m (null: no joker / no track).
 * @returns m from the start line
 */
function jokerTurnDist(): number | null {
  if (turnDists.has(LEVEL)) return turnDists.get(LEVEL)!;
  const arrow = LEVEL.joker && LEVEL.joker.arrows ? LEVEL.joker.arrows.find(Boolean) : null;
  const dist = arrow && LEVEL.subtrack ? querySubtrack(LEVEL.subtrack, arrow.x, arrow.y).trackDist
    : null;
  turnDists.set(LEVEL, dist);
  return dist;
}`);
console.log('ok');
