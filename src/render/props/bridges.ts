// The bridge and footbridge painters: the road deck, the rails, the footings and the
// walkway over the track.
import type { Prop } from '../../world/types.ts';
import type { BridgeGeom, PropCtx } from './types.ts';
import { trainAt } from '../../world/trains.ts';
import { worldSeconds } from '../../world/worldclock.ts';

/**
 * A rail bridge's train clock, s: the world's sim clock (a car on the deck meets
 * the train it sees), else the wall clock; the bridge's own phase added (world/trains.ts trainAt).
 * @param prop the bridge
 * @returns s
 */
export const trainClock = (prop: Prop): number => worldSeconds() + (prop.phase || 0);

/**
 * The ends of a bridge's track, m along it from its middle: [the -x end, the +x end] (its span, its
 * abutments' 3 m, its approaches).
 * @param prop the bridge (wid, appL)
 * @returns [negEnd, posEnd]
 */
export function trackEnds(prop: Prop): [number, number] {
  const half = (prop.wid || 30) / 2;
  return [half + 3 + ((prop.appL && prop.appL[0]) ?? 0),
    half + 3 + ((prop.appL && prop.appL[1]) ?? 0)];
}

/** A bridge look's paint: abutments, deck, its lit and shaded parapets, a road deck's tarmac. */
interface BridgeLook { abutment: string; deck: string; railDeck: string; lit: string;
  shade: string; tarmac: string; cars: string[] }
// the countryside's grey concrete; Deaf Valley's sun-bleached sand concrete with rusted railings
// and dusty pickups (owner 11-11: bridges "to match the Death Valley asthetic")
const BRIDGE_LOOKS: Record<string, BridgeLook> = {
  plain: { abutment: '#7c7f86', deck: '#8f949c', railDeck: '#5a5048', lit: '#c9ccd3',
    shade: '#5d626d', tarmac: '#3b3e44', cars: ['#c8302c', '#2b56b5', '#e9e4d8', '#3f5a3a',
      '#d6a21e'] },
  desert: { abutment: '#a8957a', deck: '#c4b497', railDeck: '#5a4330', lit: '#8a4a2a',
    shade: '#7d6a52', tarmac: '#4b4743', cars: ['#b8a888', '#8a3b22', '#e9e4d8', '#5c6339',
      '#3e5f7a'] },
};
/**
 * The look a bridge is painted in.
 * @param prop the bridge prop
 * @returns its paint
 */
const lookOf = (prop: Prop): BridgeLook => BRIDGE_LOOKS[prop.look === 'desert' ? 'desert'
  : 'plain'];

/**
 * Draws the traffic lanes, the cow and the cars of a road bridge.
 * @param propCtx the view and painter helpers
 * @param prop the bridge prop
 * @param geo the deck geometry shared with the other bridge drawers
 */
function drawBridgeRoad(propCtx: PropCtx, prop: Prop, geo: BridgeGeom) {
  const { paint, half, seed, negEnd, posEnd, trackLen, along, deckWid } = geo,
    look = lookOf(prop);
  paint(-half, -deckWid / 2 + 0.6, 2 * half, deckWid - 1.2, look.tarmac);
  // centre dashes over the deck AND the approaches, edge lines on the approaches (the ribbon is
  // 7 m: edges at +-3.2)
  for (let dashX = -negEnd + 1; dashX < posEnd - 2; dashX += 4)
    paint(dashX, -0.08, 2, 0.16, 'rgba(245,245,240,0.8)');
  for (const y of [-3.2, 3.05]) {
    paint(-negEnd, y, negEnd - half - 4, 0.15, 'rgba(245,245,240,0.6)');
    paint(half + 4, y, posEnd - half - 4, 0.15, 'rgba(245,245,240,0.6)');
  }
  if (prop.cow) {
    const x = half * 0.35;
    paint(x - 1.1, -0.6, 2.2, 1.2, '#f2f2f2');
    paint(x - 0.6, -0.6, 0.7, 0.6, '#1c1d20');
    paint(x + 0.3, 0, 0.6, 0.6, '#1c1d20');
    paint(x + 1.1, -0.35, 0.5, 0.7, '#f2f2f2');
  }
  // QUIET (owner 11-04, passed: Brands' road bridges "the cars vanish when off the bridge / looks
  // fake"): a quiet bridge has no traffic - its road ends a few metres past the deck
  if (prop.quiet) return;
  // TRAFFIC both ways (left-hand: +x in the lane at y +1.6): 1-2 cars per direction, 13-17 m/s,
  // spaced along the whole road
  const cols = look.cars,
    carCount = 1 + (prop.cars || 1);
  for (let car = 0; car < carCount; car++) {
    const dir = car % 2 ? -1 : 1,
      y = dir > 0 ? 1.6 : -1.6,
      speed = dir * (13 + ((seed + car * 7) % 5));
    along(speed, car, (trackLen / carCount) * 1.7, (x: number) => {
      paint(x - 2, y - 0.85, 4, 1.7, cols[(car + seed) % 5]);
      paint(x + (dir > 0 ? -0.2 : -1.2), y - 0.7, 1.4, 1.4, 'rgba(20,22,28,0.6)');
      paint(x + (dir > 0 ? 1.7 : -2), y - 0.7, 0.3, 0.4, '#fff6e6');
      paint(x + (dir > 0 ? 1.7 : -2), y + 0.3, 0.3, 0.4, '#fff6e6');
    });
  }
}

/**
 * Draws the passing train of a rail bridge.
 * @param prop the bridge prop
 * @param geo the deck geometry shared with the other bridge drawers
 */
function drawBridgeTrain(prop: Prop, geo: BridgeGeom) {
  const { paint, seed, negEnd, posEnd, clock } = geo;
  // A TRAIN every trainEvery s: 3-5 coaches, one way or the other, crossing the whole length then
  // gone (world/trains.ts: where - the cars on the deck meet the same train)
  const train = trainAt(prop, clock);
  if (train) {
    const y = train.across, col = ['#c8302c', '#2b56b5', '#d6a21e'][(train.cycle + seed) % 3];
    // a coach past either end of the track (a cut-short bed) is not drawn
    for (let coach = 0; coach < train.cars.length; coach++) {
      const x = train.cars[coach];
      if (x < -negEnd - 18 || x > posEnd) continue;
      paint(x, y - 1.4, 18, 2.8, '#2a2c33');
      paint(x + 0.3, y - 1.25, 17.4, 2.5, coach === 0 ? col : '#d7d9de');
      for (let winX = 1.5; winX < 17; winX += 3)
        paint(x + winX, y - 0.5, 1.6, 1, 'rgba(30,40,58,0.55)');
    }
  }
}

/**
 * Draws the sleepers, rails and the passing train of a rail bridge.
 * @param propCtx the view and painter helpers
 * @param prop the bridge prop
 * @param geo the deck geometry shared with the other bridge drawers
 */
function drawBridgeRail(propCtx: PropCtx, prop: Prop, geo: BridgeGeom) {
  const { paint, half, negEnd, posEnd, trackLen, deckWid } = geo;
  // sleepers + rails over the deck and along the ballast approaches (the gravel ribbon in the
  // tiles)
  for (let sleeperX = -negEnd; sleeperX < posEnd; sleeperX += 0.9)
    if (sleeperX < -half - 4 || sleeperX > half) paint(sleeperX, -2.4, 0.35, 4.8, '#6e5a44');
    else paint(sleeperX, -deckWid / 2 + 0.8, 0.35, deckWid - 1.6, '#6e5a44');
  for (const y of [-1.9, -0.6, 0.6, 1.9]) paint(-negEnd, y - 0.08, trackLen, 0.16, '#b9bcc3');
  for (let bracketX = -half + 3; bracketX < half; bracketX += 12)
    paint(bracketX, -deckWid / 2 - 0.3, 0.3, deckWid + 0.6, '#3d4049');
  drawBridgeTrain(prop, geo);
}

// (Deaf Valley) a timber trestle's bents (the frames under the deck), m apart and how far each
// cap sticks out past the deck; its timbers' colours
const BENT_GAP_M = 4, CAP_OUT_M = 0.7;
const TIMBER = '#4a3624', TIMBER_DARK = '#33251a', TIE = '#6b5038', RAIL = '#9a9488';

/**
 * (Deaf Valley) Draws a rail bridge as an old timber trestle - the bents' caps and bracing out past
 * a narrow open deck of ties - and the freight train over it.
 * @param prop the bridge prop
 * @param geo the deck geometry shared with the other bridge drawers
 */
function drawTrestle(prop: Prop, geo: BridgeGeom) {
  const { paint, half, negEnd, posEnd, deckWid } = geo;
  // the bents: a cap across, a brace out either side, a shadow strip down the gap below
  for (let bentX = -half + 1; bentX < half; bentX += BENT_GAP_M) {
    paint(bentX, -deckWid / 2 - CAP_OUT_M, 0.5, deckWid + 2 * CAP_OUT_M, TIMBER_DARK);
    paint(bentX + 0.5, -deckWid / 2 - CAP_OUT_M, BENT_GAP_M - 0.5, 0.25, TIMBER);
    paint(bentX + 0.5, deckWid / 2 + CAP_OUT_M - 0.25, BENT_GAP_M - 0.5, 0.25, TIMBER);
  }
  // the ties, close across the deck and the ballast beyond it, and the two rails
  for (let tieX = -negEnd; tieX < posEnd; tieX += 0.8) {
    const onDeck = tieX >= -half && tieX <= half;
    paint(tieX, onDeck ? -deckWid / 2 + 0.6 : -2.2, 0.4, onDeck ? deckWid - 1.2 : 4.4, TIE);
  }
  for (const y of [-0.75, 0.75]) paint(-negEnd, y - 0.08, negEnd + posEnd, 0.16, RAIL);
  drawFreight(prop, geo);
}

// (Deaf Valley) the freight train: its locomotive's livery, then its wagons' (boxcars, a tanker)
const LOCO = ['#d6a21e', '#8a3b22'], WAGONS = ['#7a3b22', '#5c4a3a', '#8a5a32', '#6e6a62'];

/**
 * (Deaf Valley) Draws the freight train of a trestle: a locomotive and 6-9 wagons of 15 m at
 * 22 m/s, one way or the other, every trainEvery s.
 * @param prop the bridge prop
 * @param geo the deck geometry shared with the other bridge drawers
 */
function drawFreight(prop: Prop, geo: BridgeGeom) {
  const { paint, seed, negEnd, posEnd, clock } = geo;
  // (world/trains.ts: where - the cars on the deck meet the same train)
  const train = trainAt(prop, clock);
  if (!train) return;
  const { cycle, dir } = train;
  for (let car = 0; car < train.cars.length; car++) {
    const x = train.cars[car];
    if (x < -negEnd - 15 || x > posEnd) continue;
    paint(x, -1.5, 15, 3, '#22201d');
    paint(x + 0.3, -1.35, 14.4, 2.7, car === 0 ? LOCO[(cycle + seed) % 2]
      : WAGONS[(car * 3 + seed) % WAGONS.length]);
    // a boxcar's roof walk, a tanker's dome, the locomotive's cab
    if (car === 0) paint(x + (dir > 0 ? 10.5 : 1.5), -1.1, 3, 2.2, '#2a2c33');
    else paint(x + 1, -0.15, 13, 0.3, 'rgba(20,16,12,0.45)');
  }
}

/**
 * Draws the footpath deck and its walkers.
 * @param propCtx the view and painter helpers
 * @param prop the bridge prop
 * @param geo the deck geometry shared with the other bridge drawers
 */
function drawBridgeFoot(propCtx: PropCtx, prop: Prop, geo: BridgeGeom) {
  const { paint, half, seed, trackLen, along, deckWid } = geo;
  paint(-half, -deckWid / 2 + 0.4, 2 * half, deckWid - 0.8, '#a29a8c');
  if (prop.cone) {
    paint(half * 0.2 - 0.35, -0.35, 0.7, 0.7, '#f97316');
    paint(half * 0.2 - 0.15, -0.15, 0.3, 0.3, '#f2f2f2');
  }
  // WALKERS along the deck and the footpath (1.1-1.6 m/s), one now and then with a dog
  for (let walker = 0; walker < (prop.people || 1) + 1; walker++) {
    const dir = (walker + seed) % 2 ? 1 : -1,
      y = dir > 0 ? 0.35 : -0.35;
    along(
      dir * (1.1 + ((seed + walker * 3) % 5) * 0.12),
      walker,
      (trackLen / ((prop.people || 1) + 1)) * 1.3,
      (x: number) => {
        paint(
          x - 0.3,
          y - 0.3,
          0.6,
          0.6,
          ['#c8302c', '#eab308', '#2b56b5', '#3f5a3a'][(walker + seed) % 4],
        );
        paint(x - 0.15, y - 0.15, 0.3, 0.3, '#e8c39e');
        if ((walker + seed) % 3 === 0)
          paint(x + dir * 0.9 - 0.2, y - 0.15, 0.45, 0.3, '#5a4231');
      },
    );
  }
}

/**
 * Draws the boat of a river crossing.
 * @param prop the river prop
 * @param half half the deck length
 * @param paint the square painter in metres
 */
function drawRiverBoat(
  prop: Prop, half: number,
  paint: (x: number, y: number, width: number, height: number, col: string) => void,
) {
  if (prop.boat) {
    const boatX = (prop.roadHw || half - 9) / Math.cos(prop.skew || 0) + 4;
    paint(boatX, -1.2, 5, 2.4, '#e9e4d8');
    paint(boatX + 1, -0.8, 2, 1.6, '#c8302c');
    paint(boatX + 0.2, -1.25, 4.6, 0.2, '#6a7077');
  }
}

// BRIDGES (highway.ts extras): carries 'road' / 'rail' / 'foot' = a deck OVER the motorway (kind
// 'bridge', drawn after the cars); kind 'river' = the motorway over water. Local frame: +x along
// the deck (across the motorway). Squares only. v2 (requirement: bridges have no connecting roads
// so it looks silly; "make the cars n stuff move across if you can... only if cheap enough"): the
// APPROACHES (highway.ts approaches: lane ribbons in the ground tiles) run
// pr.appL[0 | 1] m out from each end; their markings / rails are drawn here, and so is what MOVES
// across: cars both ways, walkers, a train every pr.trainEvery s. Pure drawing on the wall clock
// (no physics, no state): a few dozen squares per bridge on screen. The RIVER's water is now a
// real 'wet' cover (lab.ts covers: the puddle water, grip and spray, painted into the ground tiles;
// requirement: water seemed to be painted and not our water texture), so only the boat is drawn
// here.
// a footbridge deck's half width, m (along the road below)
const FOOT_DECK_HALF_M = 1.2;

/**
 * A bridge deck's width by what it carries, m.
 * @param carries 'road', 'rail' or 'foot'
 * @returns the deck's width (along the road below)
 */
function bridgeDeckWidth(carries: string | undefined): number {
  return carries === 'foot' ? 2.6 : carries === 'rail' ? 7 : 9;
}

/**
 * The deck of an overhead prop (a bridge over the motorway, a footbridge), in the prop's own
 * frame: +x along the deck, across the road below. The night layer keeps light from below off it
 * (render/lightdecks.ts).
 * @param prop the prop
 * @returns half the deck's length and half its width, m; null for a prop with no deck
 */
export function overheadDeck(prop: Prop): { halfLength: number; halfWidth: number } | null {
  if (prop.kind === 'bridge') {
    return { halfLength: (prop.wid || 30) / 2, halfWidth: bridgeDeckWidth(prop.carries) / 2 };
  }
  if (prop.kind === 'footbridge') {
    return { halfLength: (prop.wid || 27) / 2, halfWidth: FOOT_DECK_HALF_M };
  }
  return null;
}

/**
 * Draws a bridge deck, or the boat of a river crossing.
 * @param propCtx the view and painter helpers
 * @param prop the bridge or river prop
 * @param ppm pixels per metre
 */
export function drawBridge(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  const paint = (x: number, y: number, width: number, height: number, col: string) => {
    view.ctx.fillStyle = col;
    view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
  const half = (prop.wid || 30) / 2,
    carries = prop.carries,
    seed = prop.seed || 0;
  if (prop.kind === 'river') {
    drawRiverBoat(prop, half, paint);
    return;
  }
  const [negEnd, posEnd] = trackEnds(prop), trackLen = negEnd + posEnd, clock = trainClock(prop);
  // a mover at distance d along [-a0, a1] (wrapping), drawn by f(x)
  const along = (speed: number, slot: number, gap: number, draw: (x: number) => void) =>
    // v < 0 runs -x by itself
    draw(((((clock * speed + slot * gap) % trackLen) + trackLen) % trackLen) - negEnd);
  const deckWid = bridgeDeckWidth(carries);
  view.ctx.fillStyle = 'rgba(10,12,16,0.32)';
  view.ctx.fillRect(
    (-half + 1.5) * ppm,
    (-deckWid / 2 + 2.6) * ppm,
    2 * half * ppm,
    deckWid * ppm,
  ); // shadow
  const look = lookOf(prop);
  // abutments, the deck, the parapets
  paint(-half - 4, -deckWid / 2 - 0.6, 4, deckWid + 1.2, look.abutment);
  paint(half, -deckWid / 2 - 0.6, 4, deckWid + 1.2, look.abutment);
  paint(-half, -deckWid / 2, 2 * half, deckWid, carries === 'rail' ? look.railDeck : look.deck);
  paint(-half, -deckWid / 2, 2 * half, 0.4, look.lit);
  paint(-half, deckWid / 2 - 0.4, 2 * half, 0.4, look.shade);
  const geo: BridgeGeom = {
    ppm,
    paint,
    half,
    seed,
    negEnd,
    posEnd,
    trackLen,
    clock,
    along,
    deckWid,
  };
  if (carries === 'road') drawBridgeRoad(propCtx, prop, geo);
  else if (carries === 'rail' && prop.look === 'desert') drawTrestle(prop, geo);
  else if (carries === 'rail') drawBridgeRail(propCtx, prop, geo);
  else drawBridgeFoot(propCtx, prop, geo);
}

/**
 * Draws the footbridge prop (footbridge).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawFootbridge(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // FOOTBRIDGE over the track (Castle Combe's Avon + Dunlop bridges): deck across (+x), stair
  // towers at the ends, a sponsor band
  const paint = (x: number, y: number, width: number, height: number, col: string) => {
    view.ctx.fillStyle = col;
    view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
  const half = (prop.wid || 27) / 2;
  view.ctx.fillStyle = 'rgba(10,12,16,0.30)';
  view.ctx.fillRect(
    -half * ppm + 1.5 * ppm,
    -1.2 * ppm + 2.4 * ppm,
    2 * half * ppm,
    2.4 * ppm,
  ); // shadow on the road
  paint(-half, -FOOT_DECK_HALF_M, 2 * half, 2 * FOOT_DECK_HALF_M, '#8f949c');
  paint(-half, -1.2, 2 * half, 0.3, '#c9ccd3');
  paint(-half, 0.9, 2 * half, 0.3, '#5d626d');
  paint(-half * 0.55, -0.75, half * 1.1, 1.5, '#1c4fa0');
  paint(-half - 1.6, -1.5, 3.2, 3.0, '#6a7077');
  paint(half - 1.6, -1.5, 3.2, 3.0, '#6a7077'); // stair towers
  for (let step = 0; step < 4; step++) {
    paint(-half - 1.4, -1.3 + step * 0.7, 2.8, 0.25, '#565b63');
    paint(half - 1.4, -1.3 + step * 0.7, 2.8, 0.25, '#565b63');
  }
  if (ppm * 1.0 >= 8) {
    view.ctx.fillStyle = '#ffffff';
    view.ctx.font = `900 ${Math.round(ppm * 1.0)}px Impact, ui-sans-serif, sans-serif`;
    view.ctx.textAlign = 'center';
    view.ctx.textBaseline = 'middle';
    if (Math.cos(prop.rot || 0) < 0) view.ctx.rotate(Math.PI);
    /* never upside down (photographed) */ view.ctx.fillText(
      prop.label || '',
      0,
      0.05 * ppm,
      half * 1.05 * ppm,
    );
  }
}
