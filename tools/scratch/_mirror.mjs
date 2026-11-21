// _mirror.mjs - RIGHT-HAND DRIVING's MIRROR TEST (?keepright, highway/road.ts HwState.hand): the same
// GETAWAY STOCKHOLM road built left-hand and right-hand (the config's rightHand), driven the same
// way (stepHighway, a stand-in car in our nearside lane, as tools/worldhash.mjs); every KM_STEP the
// two worlds compared: the road's points, the props, barriers, zones, lanes, water covers and street
// lights - each right-hand one must stand where its left-hand twin's mirror image (x -> -x) does,
// in the same order. A rotation is reported apart: mirrored (pi - rot) or half a turn from it (a
// sign turned, its words still read). Prints, per road type and seed, the worst position error and
// the counts that do not match.
// STOCKHOLM=1 node tools/scratch/_mirror.mjs [roads motorway,...] [seeds 4242] [km 2]
import * as L from '../../src/lab.ts';
import { createHighway, resetHighway, stepHighway, roadPose, setHighwayPreset }
  from '../../src/highway.ts';

const roads = (process.argv[2] || 'motorway,interstate,dual,walled,twisty').split(',');
const seeds = (process.argv[3] || '4242').split(',').map(Number);
const KM = +(process.argv[4] || 2);
// m of position error that counts as a mismatch
const EPS_M = 1e-6;

/**
 * A road built left- or right-hand, driven to `upTo` m.
 * @param road the road type
 * @param seed the seed
 * @param isRight right-hand
 * @param upTo m
 * @returns the level
 */
function build(road, seed, isRight, upTo) {
  const level = createHighway(seed, road);
  setHighwayPreset(level, road, 'stockholm');
  level._cfg = { ...level._cfg, rightHand: isRight };
  L.LEVELS.push(level);
  L.setLevel('highway');
  resetHighway(level);
  const lane = level._hw.geo.centres[0], car = { x: 0, y: 0 };
  for (let dist = 300; dist <= upTo; dist += 4) {
    const pose = roadPose(level, dist, lane);
    car.x = pose.x;
    car.y = pose.y;
    stepHighway(level, car);
  }
  L.LEVELS.pop();
  return level;
}

/**
 * Two lists of things compared as mirror images, by their points.
 * @param name the list's name
 * @param left the left-hand world's
 * @param right the right-hand world's
 * @param pointsOf a thing's points [[x, y], ...]
 * @param rotOf a thing's rotation, or undefined
 * @returns the report line
 */
function compare(name, left, right, pointsOf, rotOf) {
  let worst = 0, off = 0, mirrored = 0, turned = 0, other = 0;
  const count = Math.min(left.length, right.length);
  for (let i = 0; i < count; i++) {
    const [one, two] = [pointsOf(left[i]), pointsOf(right[i])];
    let bad = one.length !== two.length;
    for (let j = 0; j < Math.min(one.length, two.length); j++) {
      const err = Math.hypot(two[j][0] + one[j][0], two[j][1] - one[j][1]);
      worst = Math.max(worst, err);
      if (err > EPS_M) bad = true;
    }
    if (bad) off++;
    const rotL = rotOf?.(left[i]), rotR = rotOf?.(right[i]);
    if (rotL === undefined || rotR === undefined) continue;
    const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
    const gap = Math.abs(wrap(rotR - (Math.PI - rotL)));
    if (gap < 1e-6) mirrored++;
    else if (Math.abs(gap - Math.PI) < 1e-6) turned++;
    else other++;
  }
  return `${name} ${left.length}/${right.length}${off ? ` OFF ${off}` : ''} worst ${worst.toExponential(1)}`
    + (rotOf ? ` (rot: mirrored ${mirrored}, half a turn ${turned}, other ${other})` : '');
}

for (const road of roads) for (const seed of seeds) {
  const left = build(road, seed, false, KM * 1000), right = build(road, seed, true, KM * 1000);
  const xy = (thing) => [[thing.x, thing.y]];
  const lines = [
    compare('road', left._hw.pts, right._hw.pts, xy),
    compare('props', left.props, right.props, xy, (prop) => prop.rot),
    compare('barriers', left.barriers, right.barriers, (bar) => bar.pts),
    compare('zones', left.zones, right.zones, xy, (zone) => zone.rot),
    compare('lanes', left.lanes, right.lanes, (lane) => lane.pts),
    compare('covers', left._hw.covers, right._hw.covers, xy, (cover) => cover.rot),
    compare('lamps', left.lamps, right.lamps, xy),
  ];
  console.log(`${road} ${seed} (${KM} km):\n  ` + lines.join('\n  '));
}
