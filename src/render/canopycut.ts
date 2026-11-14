// render/canopycut.ts - THE CANOPY CUT (?nightfly=1, FIX.nightfly): the night layer puts its dark
// back over every tree canopy on the light map after all the light is in (render/light.ts
// darkenCanopies) - zoomed out over Spa's forest a path of up to ~8 000 squares, filled twice.
// A canopy no light reached is already exactly that dark, so filling it changes no pixel: only the
// canopies within reach of a light are traced. The still lights (the lamps' pools and heads, the
// event lights that stay put: render/eventglows.ts) are walked once per level (again when the
// props list, the lamps or the level change): each tree keeps its gap, m, to the nearest. The
// moving lights (every car's beams and glows, the sparks, a train's lights, the caravans, a lamp
// whose head a knock moved) are walked each frame through the prop grid round each light. A tree
// is traced when a light comes within MARGIN_PX of its canopy on the map.
import { activeLamps } from '../world/lamps.ts';
import { LEVEL } from '../world/state.ts';
import { visitPropsInBox } from './propgrid.ts';
import { noteMovingEventLights, noteStillEventLights } from './eventglows.ts';
import type { Prop } from '../world/types.ts';
import type { RenderCar, RenderGame } from './types.ts';
import type { Lamp } from '../world/lamps.ts';

// light-map px past a light's reach a canopy is still traced: the canopy squares are rounded to
// whole px (half a px), a picture drawn smoothed reaches into the px round its edge (one) and a
// thin spark streak is drawn a px wide; three holds them all
const MARGIN_PX = 3;
// m: the still lights' gaps are kept out to this; a map coarser than MARGIN_PX / STILL_SEARCH_M px
// a metre (zoomed out past any fly-in) traces every canopy
const STILL_SEARCH_M = 64;
// the largest canopy side looked for round a light, m (a tree's prop.s, 4 when unset)
const DEFAULT_SIDE_M = 4;

/** A spark as the cut reads it (render/particles.ts). */
interface SparkReach { x: number; y: number; vx: number; vy: number; sz: number }

/** What the cut reads each frame from the night layer. */
export interface CanopyCutInput {
  props: Prop[];
  game: RenderGame;
  sparks: SparkReach[];
  artPerMetre: number;   // the light map's px a metre
  carReachM: (car: RenderCar) => number;   // m from a car's centre its light reaches
  streakS: number;   // s of flight a spark's streak shows (render/particles.ts STREAK_S)
  haloX: number;     // a spark's halo width over its size
}

// what the still lights were walked for, and each tree's gap to the nearest, m (Infinity: none
// within STILL_SEARCH_M); the lamps' heads as walked (a knocked lamp's head moves)
const STILL = {
  props: null as Prop[] | null, count: -1, level: null as object | null,
  lamps: null as Lamp[] | null, gapM: new Float32Array(0), heads: new Float64Array(0),
  sideM: DEFAULT_SIDE_M,
};
// this frame: the trees a moving light reaches carry the frame's stamp
const MOVING = { stamp: 0, marks: new Uint32Array(0), marginM: 0 };
// what was traced last frame (tools, ?report=1): canopies traced, of those on the map
export const CANOPY_STATS = { traced: 0, onMap: 0 };

let walkProps: Prop[] = [];
let walkX = 0, walkY = 0, walkReach = 0;

/**
 * The gap, m, between a tree's canopy square and a light's square reach (negative: overlapping).
 * @param prop the tree
 * @returns the gap
 */
function gapOf(prop: Prop): number {
  const half = (prop.s || DEFAULT_SIDE_M) / 2;
  return Math.max(Math.abs(prop.x - walkX), Math.abs(prop.y - walkY)) - walkReach - half;
}

/**
 * Keeps a tree's least gap to a still light.
 * @param index the tree's index in the props
 */
function keepStillGap(index: number) {
  const prop = walkProps[index];
  if (prop.kind !== 'tree') return;
  const gap = gapOf(prop);
  if (gap < STILL.gapM[index]) STILL.gapM[index] = gap;
}

/**
 * Stamps a tree a moving light reaches this frame.
 * @param index the tree's index in the props
 */
function stampMoving(index: number) {
  const prop = walkProps[index];
  if (prop.kind === 'tree' && gapOf(prop) <= MOVING.marginM) MOVING.marks[index] = MOVING.stamp;
}

/**
 * Walks the trees round a light with a visit.
 * @param x the light's centre, m
 * @param y the light's centre, m
 * @param reachM its radius, m
 * @param pastM m past its reach to walk
 * @param visit called per tree index
 */
function walkTrees(x: number, y: number, reachM: number, pastM: number,
  visit: (index: number) => void) {
  walkX = x;
  walkY = y;
  walkReach = reachM;
  const box = reachM + pastM + STILL.sideM / 2;
  visitPropsInBox(walkProps, x - box, y - box, x + box, y + box, visit);
}

const noteStill = (x: number, y: number, reachM: number) =>
  walkTrees(x, y, reachM, STILL_SEARCH_M, keepStillGap);
const noteMoving = (x: number, y: number, reachM: number) =>
  walkTrees(x, y, reachM, MOVING.marginM, stampMoving);

/**
 * A lamp's light reach, m: its pool (its head glow is smaller).
 * @param lamp the lamp
 * @returns the radius
 */
const lampReachM = (lamp: Lamp) => lamp.poolM;

/**
 * Walks the still lights again when the props, the level or the lamps changed.
 * @param input the frame's input
 */
function refreshStill(input: CanopyCutInput) {
  const lamps = activeLamps(), props = input.props;
  if (STILL.props === props && STILL.count === props.length && STILL.level === LEVEL
    && STILL.lamps === lamps) return;
  Object.assign(STILL, { props, count: props.length, level: LEVEL, lamps });
  STILL.gapM = new Float32Array(props.length).fill(Infinity);
  STILL.heads = new Float64Array(lamps.length * 4);
  MOVING.marks = new Uint32Array(props.length);
  STILL.sideM = DEFAULT_SIDE_M;
  for (const prop of props) {
    if (prop.kind === 'tree') STILL.sideM = Math.max(STILL.sideM, prop.s || 0);
  }
  walkProps = props;
  lamps.forEach((lamp, index) => {
    STILL.heads.set([lamp.headX, lamp.headY, lamp.twinX, lamp.twinY], index * 4);
    noteStill(lamp.headX, lamp.headY, lampReachM(lamp));
    if (lamp.twin) noteStill(lamp.twinX, lamp.twinY, lampReachM(lamp));
  });
  noteStillEventLights(noteStill, input.game);
}

/**
 * Stamps the trees the moving lights reach this frame: the cars, the sparks, the moving event
 * lights, and any lamp whose head is not where it was walked.
 * @param input the frame's input
 */
function stampMovingLights(input: CanopyCutInput) {
  const { game } = input;
  MOVING.stamp = (MOVING.stamp + 1) >>> 0 || 1;
  if (MOVING.stamp === 1) MOVING.marks.fill(0);
  const eachCar = (car: RenderCar) => noteMoving(car.x, car.y, input.carReachM(car));
  if (game.traffic) for (const car of game.traffic.cars) eachCar(car);
  for (const rival of game.ai || []) eachCar(rival.car);
  eachCar(game.car);
  for (const spark of input.sparks) {
    const tailX = spark.x - spark.vx * input.streakS, tailY = spark.y - spark.vy * input.streakS;
    noteMoving((spark.x + tailX) / 2, (spark.y + tailY) / 2,
      Math.hypot(spark.x - tailX, spark.y - tailY) / 2 + spark.sz * input.haloX / 2);
  }
  noteMovingEventLights(noteMoving, game);
  const heads = STILL.heads, lamps = STILL.lamps || [];
  for (let index = 0; index < lamps.length; index++) {
    const lamp = lamps[index], first = index * 4;
    if (lamp.headX === heads[first] && lamp.headY === heads[first + 1]
      && lamp.twinX === heads[first + 2] && lamp.twinY === heads[first + 3]) continue;
    noteMoving(lamp.headX, lamp.headY, lampReachM(lamp));
    if (lamp.twin) noteMoving(lamp.twinX, lamp.twinY, lampReachM(lamp));
  }
}

/**
 * Whether a tree's canopy may hold light this frame (STILL and MOVING set by canopiesLit).
 * @param index the tree's index in the props
 * @returns true to trace it
 */
function isCanopyLit(index: number): boolean {
  return STILL.gapM[index] <= MOVING.marginM || MOVING.marks[index] === MOVING.stamp;
}

/**
 * The canopies the dark must go back over this frame (?nightfly=1), as a test on a tree's index;
 * null to trace them all (a streaming level, a map too coarse for the still lights' walk).
 * @param input the frame's input
 * @returns the test, or null
 */
export function canopiesLit(input: CanopyCutInput): ((index: number) => boolean) | null {
  if (LEVEL.endless || !(input.artPerMetre > 0)) return null;
  const marginM = MARGIN_PX / input.artPerMetre;
  if (marginM > STILL_SEARCH_M) return null;
  walkProps = input.props;
  refreshStill(input);
  walkProps = input.props;
  MOVING.marginM = marginM;
  stampMovingLights(input);
  return isCanopyLit;
}
