// The bridge and footbridge painters: the road deck, the rails, the footings and the
// walkway over the track.
import type { Prop } from '../../world/types.ts';
import type { BridgeGeom, PropCtx } from './types.ts';

/**
 * Draws the traffic lanes, the cow and the cars of a road bridge.
 * @param propCtx the view and painter helpers
 * @param prop the bridge prop
 * @param geo the deck geometry shared with the other bridge drawers
 */
function drawBridgeRoad(propCtx: PropCtx, prop: Prop, geo: BridgeGeom) {
  const { paint, half, seed, negEnd, posEnd, trackLen, along, deckWid } = geo;
  paint(-half, -deckWid / 2 + 0.6, 2 * half, deckWid - 1.2, '#3b3e44');
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
  // TRAFFIC both ways (left-hand: +x in the lane at y +1.6): 1-2 cars per direction, 13-17 m/s,
  // spaced along the whole road
  const cols = ['#c8302c', '#2b56b5', '#e9e4d8', '#3f5a3a', '#d6a21e'],
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
  // A TRAIN every trainEvery s: 3-5 coaches of 18 m at 32 m/s, one way or the other, crossing
  // the whole length then gone
  const every = prop.trainEvery || 20,
    cyc = Math.floor(clock / every),
    trainT = clock - cyc * every,
    dir = (cyc + seed) % 2 ? 1 : -1,
    coaches = 3 + ((cyc + seed) % 3),
    len = coaches * 19;
  const head = -negEnd - 10 + trainT * 32;
  if (head - len < posEnd + 10) {
    const y = dir > 0 ? 1.25 : -1.25,
      col = ['#c8302c', '#2b56b5', '#d6a21e'][(cyc + seed) % 3];
    // mirrored about the middle of [-a0, a1] for the other way; a coach past either end of the
    // track (a cut-short bed) is not drawn
    for (let coach = 0; coach < coaches; coach++) {
      const tailX = head - (coach + 1) * 19,
        x = dir > 0 ? tailX : posEnd - negEnd - tailX - 18;
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

// BRIDGES (highway.js extras): carries 'road' / 'rail' / 'foot' = a deck OVER the motorway (kind
// 'bridge', drawn after the cars); kind 'river' = the motorway over water. Local frame: +x along
// the deck (across the motorway). Squares only. v2 (2026-10-06, user: "bridges have no connecting
// roads so it looks silly"; "make the cars n stuff move across if you can ... only if cheap
// enough"): the APPROACHES (highway.js approaches(): lane ribbons in the ground tiles) run
// pr.appL[0 | 1] m out from each end; their markings / rails are drawn here, and so is what MOVES
// across: cars both ways, walkers, a train every pr.trainEvery s. Pure drawing on the wall clock
// (no physics, no state): a few dozen squares per bridge on screen. The RIVER's water is now a
// real 'wet' cover (lab.js covers: the puddle water, grip and spray, painted into the ground
// tiles; user: "water seemed to be painted and not our water texture"), so only the boat is drawn
// here.
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
  const negEnd = half + 3 + ((prop.appL && prop.appL[0]) ?? 0),
    posEnd = half + 3 + ((prop.appL && prop.appL[1]) ?? 0),
    trackLen = negEnd + posEnd,
    clock = performance.now() / 1000 + (prop.phase || 0);
  // a mover at distance d along [-a0, a1] (wrapping), drawn by f(x)
  const along = (speed: number, slot: number, gap: number, draw: (x: number) => void) =>
    // v < 0 runs -x by itself
    draw(((((clock * speed + slot * gap) % trackLen) + trackLen) % trackLen) - negEnd);
  const deckWid = carries === 'foot' ? 2.6 : carries === 'rail' ? 7 : 9;
  view.ctx.fillStyle = 'rgba(10,12,16,0.32)';
  view.ctx.fillRect(
    (-half + 1.5) * ppm,
    (-deckWid / 2 + 2.6) * ppm,
    2 * half * ppm,
    deckWid * ppm,
  ); // shadow
  paint(-half - 4, -deckWid / 2 - 0.6, 4, deckWid + 1.2, '#7c7f86');
  paint(half, -deckWid / 2 - 0.6, 4, deckWid + 1.2, '#7c7f86'); // abutments
  paint(-half, -deckWid / 2, 2 * half, deckWid, carries === 'rail' ? '#5a5048' : '#8f949c');
  paint(-half, -deckWid / 2, 2 * half, 0.4, '#c9ccd3');
  paint(-half, deckWid / 2 - 0.4, 2 * half, 0.4, '#5d626d'); // parapets
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
  paint(-half, -1.2, 2 * half, 2.4, '#8f949c');
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
