// _hillcheck.mjs - SPIKES PEAK's STANDARD CHECKS (?hillclimb; highway/hillplan.ts, hillground.ts,
// dress.ts dressPeak), in node, per seed:
// - THE NATURAL LINE: the 5 km drawn from above (tools/scratch/_hill-map-<seed>.png: the road by
//   its stretch - sweepers green, esses blue, switchbacks orange, straights grey - and where the
//   race driver ran off the road, red), and each run off: where (m, stretch), the road's radius
//   there, the driver's speed and how far out;
// - THE PROPS: trees, rocks, marshal posts laid; any within the road's width + 1 m of any part of
//   the road (on the road);
// - THE BARRIERS: the armco pieces and their length; any armco point within the road's width of
//   any part of the road (across a road), any piece on a bend's inside.
// [SEEDS=4242,7,99] node tools/scratch/_hillcheck.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

process.env.HILLCLIMB = '1';
const { makeCar, reset, step, PHYSICS_STEP_SECONDS: DT } = await import('../../src/vehicle.ts');
const L = await import('../../src/lab.ts');
const hw = await import('../../src/highway.ts');
const { createAIDriver } = await import('../../src/ai/circuit.ts');
const { aiTraits } = await import('../../src/ai/traits.ts');
const { SPAWN_S } = await import('../../src/highway/presets.ts');
const { HILL_LENGTH_M } = await import('../../src/highway/hillplan.ts');

const SEEDS = (process.env.SEEDS || '4242,7,99').split(',').map(Number);
const COLOURS = { sweepers: [60, 170, 80], esses: [60, 110, 220], switchbacks: [240, 140, 30],
  straight: [140, 140, 140] };
hw.addHighwayLevel();
L.setLevel('highway');
const level = L.LEVEL;

/**
 * A PNG of an RGB picture.
 * @param width px
 * @param height px
 * @param rgb its pixels, 3 bytes each
 * @returns the file's bytes
 */
function png(width, height, rgb) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    data.copy(out, 8);
    out.writeUInt32BE(crc(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
    return out;
  };
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let row = 0; row < height; row++) {
    raw[row * (width * 3 + 1)] = 0;
    rgb.copy(raw, row * (width * 3 + 1) + 1, row * width * 3, (row + 1) * width * 3);
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head[8] = 8;
  head[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head),
    chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/**
 * The map: the road's points by stretch, the runs off in red.
 * @param seed the road's seed
 * @param road every road point seen ({ x, y, s })
 * @param offs the points where the driver was off the road
 */
function drawMap(seed, road, offs) {
  const xs = road.map((point) => point.x), ys = road.map((point) => point.y);
  const minX = Math.min(...xs) - 30, maxX = Math.max(...xs) + 30, minY = Math.min(...ys) - 30,
    maxY = Math.max(...ys) + 30;
  const scale = Math.min(900 / (maxX - minX), 1400 / (maxY - minY));
  const width = Math.ceil((maxX - minX) * scale), height = Math.ceil((maxY - minY) * scale);
  const rgb = Buffer.alloc(width * height * 3, 250);
  const dot = (x, y, colour, size) => {
    const px = Math.round((x - minX) * scale), py = Math.round((y - minY) * scale);
    for (let dx = -size; dx <= size; dx++) for (let dy = -size; dy <= size; dy++) {
      const qx = px + dx, qy = py + dy;
      if (qx < 0 || qy < 0 || qx >= width || qy >= height) continue;
      rgb.set(colour, (qy * width + qx) * 3);
    }
  };
  for (const point of road) dot(point.x, point.y, COLOURS[point.tag || 'straight'], 2);
  for (const point of offs) dot(point.x, point.y, [220, 30, 30], 3);
  const file = `tools/scratch/_hill-map-${seed}.png`;
  writeFileSync(file, png(width, height, rgb));
  return `${file} (${width}x${height}, ${(1 / scale).toFixed(1)} m a pixel)`;
}

/**
 * The props and barriers laid in the window now, checked against every road point in it.
 * @param seen the props / barriers checked already (kept across window moves)
 * @param acc the tallies
 */
function checkLaid(seen, acc) {
  const pts = level._hw.pts, half = level._hw.geo.hw;
  const nearRoad = (x, y, within) => pts.some((point) => Math.hypot(point.x - x, point.y - y)
    < within);
  for (const prop of level.props) {
    if (seen.has(prop) || !['tree', 'rock', 'marshal'].includes(prop.kind)) continue;
    seen.add(prop);
    acc.props[prop.kind] = (acc.props[prop.kind] || 0) + 1;
    if (nearRoad(prop.x, prop.y, half + 1)) acc.onRoad.push(`${prop.kind}@${Math.round(prop._s)}`);
  }
  for (const bar of level.barriers) {
    if (seen.has(bar) || bar.kind !== 'armco') continue;
    seen.add(bar);
    let len = 0;
    for (let i = 1; i < bar.pts.length; i++)
      len += Math.hypot(bar.pts[i][0] - bar.pts[i - 1][0], bar.pts[i][1] - bar.pts[i - 1][1]);
    acc.armco.push(len);
    if (bar.pts.some(([x, y]) => nearRoad(x, y, half - 0.2))) acc.across.push(Math.round(bar._s));
  }
}

for (const seed of SEEDS) {
  hw.setHighwayPreset(level, 'twisty', 'peak');
  level.seed = seed;
  hw.resetHighway(level);
  const lane = level._hw.geo.centres[0], start = hw.roadPose(level, SPAWN_S, lane);
  const car = makeCar('bmv-e36peak');
  reset(car, start.x, start.y, start.h);
  const driver = createAIDriver(level, aiTraits(4, 0, 1, 99));
  const acc = { props: {}, onRoad: [], armco: [], across: [] }, seen = new Set();
  const road = new Map(), offs = [], runs = [];
  let frame = null, run = null;
  checkLaid(seen, acc);
  for (let time = 0; time < 900; time += DT) {
    const input = { ...driver.drive(car, DT, { cars: [], vMax: 120, lap: 1, laps: 99,
      road: { middleOff: null, hand: 1 } }) };
    L.applyGround(car, DT);
    step(car, input, DT);
    if (hw.stepHighway(level, car)) checkLaid(seen, acc);
    for (const point of level._hw.pts) if (!road.has(point.s) && point.s <= SPAWN_S
      + HILL_LENGTH_M + 50) road.set(point.s, { x: point.x, y: point.y, s: point.s, tag: point.tag });
    frame = hw.roadFrame(level, car.x, car.y, frame ? frame.s : null);
    if (!frame) continue;
    const out = Math.abs(frame.off) - level._hw.geo.hw;
    if (out > 0) {
      offs.push({ x: car.x, y: car.y });
      if (!run) {
        const pts = level._hw.pts, i = pts.findIndex((point) => point.s >= frame.s);
        const curvs = [-3, 0, 3].map((shift) => {
          const a = pts[i + shift - 1], b = pts[i + shift], c = pts[i + shift + 1];
          if (!a || !b || !c) return 0;
          const turn = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x);
          return Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) / 4;
        });
        run = { s: frame.s, kind: pts[i]?.tag || 'straight', radius: 1 / Math.max(1e-4,
          ...curvs), kmh: Math.hypot(car.vx, car.vy) * 3.6, out: 0, len: 0 };
      }
      run.out = Math.max(run.out, out);
      run.len = frame.s - run.s;
    } else if (run) {
      runs.push(run);
      run = null;
    }
    if (frame.s >= SPAWN_S + HILL_LENGTH_M) break;
  }
  checkLaid(seen, acc);
  const kinds = {};
  for (const each of runs) kinds[each.kind] = (kinds[each.kind] || 0) + 1;
  console.log(`seed ${seed}: map ${drawMap(seed, [...road.values()], offs)}`);
  console.log(`  runs off the road ${runs.length} (${JSON.stringify(kinds)}): ${runs.slice(0, 8)
    .map((each) => `${Math.round(each.s)} m ${each.kind} R${each.radius.toFixed(0)} at `
      + `${each.kmh.toFixed(0)} km/h ${each.out.toFixed(1)} m out`).join('; ')}`);
  console.log(`  props ${JSON.stringify(acc.props)}, on the road ${acc.onRoad.length}`
    + `${acc.onRoad.length ? ' ' + acc.onRoad.slice(0, 6).join(' ') : ''}`);
  const total = acc.armco.reduce((sum, len) => sum + len, 0);
  console.log(`  armco pieces ${acc.armco.length}, ${total.toFixed(0)} m in all; across a road `
    + `${acc.across.length}${acc.across.length ? ' at ' + acc.across.slice(0, 6).join(',') : ''}`);
}
