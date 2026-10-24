// _mudwater.mjs (node tools/scratch/_mudwater.mjs) - Mud M1 (levelmud.ts):
// A. does mud thicken with dry passes / with wet ones? The Lab's mud panel, 100 squares, each
//    given 6 tyre passes, dry then (fresh) damp; the share that became thick mud.
// B. does a level's own mud dry in the heat? Every level with mud: its mud squares at the start,
//    then a dry spell at 20 C and 30 C stepped a second at a time; the share still mud / thick
//    mud (what the tyres feel, groundAt) and the most squares repainted in one tick (a burst).
const W = new URL('../../src/', import.meta.url).href;
const load = await import(W + 'world/load.ts');
const wear = await import(W + 'world/wear.ts');
const Wx = await import(W + 'world/weather.ts');
const P = await import(W + 'world/puddles.ts');
const field = await import(W + 'world/coverfield.ts');
const mud = await import(W + 'world/levelmud.ts');
const STATE = await import(W + 'world/state.ts');
const on = process.argv.includes('--on');
load.initWorld();
console.log(on ? 'MUDWATER ON' : 'MUDWATER OFF (today)');

const idAt = (x, y) => {
  const ground = wear.groundAt(x, y);
  return (ground.surface && ground.surface.id) || ground.id;
};

function startEvent(trackC, wetness) {
  Wx.WEATHER.trackC = trackC;
  Wx.WEATHER.rain = 0;
  Wx.setWetness(wetness);
  wear.clearWear();
  P.resetPuddles();
  field.resetCoverField();
}

// A. the thickening rule
load.setLevel('lab');
const panel = STATE.LEVEL.zones.find((zone) => zone.surface.id === 'mud' && zone.boxed);
const squares = [];
for (let i = 0; i < 100; i++) {
  squares.push([panel.x - 12 + (i % 10) * 2.4, panel.y - 12 + Math.floor(i / 10) * 2.4]);
}
for (const [label, wetness] of [['dry', 0], ['damp 0.8', 0.8]]) {
  startEvent(15, wetness);
  let clock = 1e6;
  for (let pass = 0; pass < 6; pass++) {
    for (const [x, y] of squares) wear.recordWearAt(x, y, null, (clock += 1000));
  }
  const thick = squares.filter(([x, y]) => idAt(x, y) === 'thickMud').length;
  console.log(`A ${label}: 6 passes -> thick mud ${thick}/100`);
}

// B. the level's own mud drying
const MUDS = new Set(['mud', 'thickMud']);
function mudSquares() {
  const bounds = STATE.LEVEL.bounds || { x0: -700, x1: 700, y0: -700, y1: 700 };
  const found = [];
  for (let x = bounds.x0 ?? -400; x < (bounds.x1 ?? 400); x += 3) {
    for (let y = bounds.y0 ?? -400; y < (bounds.y1 ?? 400); y += 3) {
      if (MUDS.has(wear.groundSurfaceAt(x, y).id)) found.push([x, y]);
    }
  }
  return found;
}
for (const levelId of ['lab', 'grass-track', 'sandbox', 'test-track', 'castle-cum', 'thruston']) {
  load.setLevel(levelId);
  const found = mudSquares();
  for (const trackC of [20, 30]) {
    startEvent(trackC, 0);
    const cells = wear.wearMap.size;
    const row = [];
    let burst = 0;
    for (let second = 1; second <= 900; second++) {
      P.stepPuddles(1);
      burst = Math.max(burst, wear.wearDirty.length);
      wear.wearDirty.length = 0;
      if ([120, 240, 480, 900].includes(second)) {
        const still = found.filter(([x, y]) => MUDS.has(idAt(x, y))).length;
        row.push(`${second} s ${Math.round((100 * still) / Math.max(1, found.length))}%`);
      }
    }
    console.log(`B ${levelId} ${trackC} C: ${found.length} mud pts, ${cells} cells at start;`
      + ` still mud: ${row.join(', ')}; most repaints a tick ${burst}`);
  }
}
