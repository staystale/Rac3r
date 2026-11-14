// _flykeep.mjs - THE KEPT FLY-IN PICTURE IS PAINTED AGAIN WHEN IT MUST BE (scratch, node, no
// browser): render/flypicture.ts keptFlyPicture asked as a restart asks it, with a counting
// painter, through each change that alters what the picture shows - the covers list replaced with
// the same covers (kept), a pond frozen over (painted), it thawed and another frozen (painted),
// thawed again (painted), the layout bumped
// (painted), the patch list rebuilt (painted), the scale changed (painted), another level
// (painted), the endless road (painted every time). PASS or the first case that went wrong.
// node tools/scratch/_flykeep.mjs
import * as L from '../../src/lab.ts';
import { addHighwayLevel } from '../../src/highway.ts';
import { LEVEL } from '../../src/world/state.ts';
import { keptFlyPicture } from '../../src/render/flypicture.ts';

addHighwayLevel();
let paints = 0;
const paint = () => {
  paints++;
  return { c: { width: 2, height: 2 }, x0: 0, y0: 0, x1: 1, y1: 1 };
};
const PPM = 22;
const failures = [];
/**
 * Asks for the picture and checks whether it was painted.
 * @param {string} label the case
 * @param {boolean} shouldPaint whether this case must paint afresh
 * @param {number} [ppm] the scale
 */
const ask = (label, shouldPaint, ppm = PPM) => {
  const before = paints;
  keptFlyPicture(ppm, paint);
  const didPaint = paints > before;
  console.log(`${label.padEnd(44)} ${didPaint ? 'painted' : 'kept'}`
    + `${didPaint === shouldPaint ? '' : '  <- WRONG'}`);
  if (didPaint !== shouldPaint) failures.push(label);
};

L.setLevel('killder');
const water = (LEVEL.covers || []).filter((cover) => cover.water);
console.log(`killder: ${LEVEL.covers.length} covers, ${water.length} scenery water`);
ask('first start', true);
ask('restart, nothing changed', false);
LEVEL.covers = [...LEVEL.covers];
ask('a new covers list, the same covers', false);
const pond = water[0];
const frozen = { ...pond, cover: 'ice', water: undefined };
LEVEL.covers = LEVEL.covers.map((cover) => (cover === pond ? frozen : cover));
ask('a pond frozen over', true);
ask('restart, still frozen', false);
const second = water[1], secondFrozen = { ...second, cover: 'ice', water: undefined };
LEVEL.covers = LEVEL.covers.map((cover) => (cover === frozen ? pond
  : cover === second ? secondFrozen : cover));
ask('that pond thawed, another frozen', true);
LEVEL.covers = LEVEL.covers.map((cover) => (cover === secondFrozen ? second : cover));
ask('thawed again', true);
ask('the scale changed', true, PPM + 1);
ask('the scale back', true);
const layout = LEVEL.subtrack.layoutId;
LEVEL.subtrack.layoutId = (layout || 0) + 1;
ask('the layout bumped', true);
LEVEL.subtrack.layoutId = layout;
ask('the layout back', true);
LEVEL.allPatches = [...LEVEL.allPatches];
ask('the patch list rebuilt', true);
L.setLevel('thruston');
ask('another level', true);
ask('restart there', false);
L.setLevel('killder');
ask('back to killder (built again: new patches)', true);
const highway = L.LEVELS.find((level) => level.endless);
L.setLevel(highway.id);
ask('the endless road', true);
ask('the endless road, restart', true);
console.log(failures.length ? `flykeep: FAIL (${failures.join('; ')})` : 'flykeep: PASS');
if (failures.length) process.exitCode = 1;
