// node tools/settingscheck.mjs
// readSettings(): a table of page links -> the values the old per-file parsing (main.js qs, highway.js QP,
// render.ts NO_LOCK, render/tiles.ts TILE_PX/TILE_GPU/NO_SHADE) gave. Expected values are worked out from
// that code, not from settings.ts. Only the fields named in a row are checked; the rest must be the defaults.
// Since 2026-10-16 the GPU painter and the zoom hold are on unless =0 (owner approved).
import { readSettings } from '../src/core/settings.ts';

const DEFAULTS = {
  dev: false, carId: null, aiCount: 0, aiDifficulty: 2, trafficDensity: 0.6, litter: null, menu: null,
  menuAi: 4, guide: null, rules: null, levelId: null, inputMode: 'auto', highwayDebug: null,
  tilePx: 256, rain: null, night: null,
 
  maxDpr: null,
  noShade: false,
  meter: false, meterOverlay: false, report: false, audio: true,
  engine: false,
  autopilot: false, autopilotKmh: 0, noNatClear: false, churn: '', skipLayers: '',   // a Set is compared as its sorted names joined by ','
};

const TABLE = [
  ['', {}],
  ['?ai=9&diff=7&traffic=3', { aiCount: 5, aiDifficulty: 4, trafficDensity: 1.5 }],
  ['?ai=2&diff=0&traffic=0', { aiCount: 2, aiDifficulty: 0, trafficDensity: 0 }],
  ['?ai=-3&diff=-1&traffic=-2&litter=-1', { aiCount: 0, aiDifficulty: 0, trafficDensity: 0, litter: 0 }],
  ['?ai=x&diff=x&traffic=x&menuai=x&litter=x', { aiCount: NaN, aiDifficulty: NaN, trafficDensity: NaN, menuAi: NaN, litter: NaN }],
  ['?diff=&traffic=', { aiDifficulty: 0, trafficDensity: 0 }],
  ['?litter=9&menuai=9', { litter: 3, menuAi: 5 }],
  ['?litter=2&menuai=0', { litter: 2, menuAi: 0 }],
  ['?menu=0&guide=0&rules=0&litter=0', { menu: '0', guide: '0', rules: '0', litter: 0 }],
  ['?menu=1&guide=1&rules=1', { menu: '1', guide: '1', rules: '1' }],
  ['?dev&touch&pc&noshade&tilepx=128',
    { dev: true, inputMode: 'touch', noShade: true, tilePx: 128 }],
  ['?pc', { inputMode: 'pc' }],
  ['?rain=0.4', { rain: 0.4 }],
  ['?rain', { rain: 0.6 }],
  ['?rain=3', { rain: 1 }],
  ['?rain=x', { rain: null }],
  ['?night=0.5', { night: 0.5 }],
  ['?night', { night: 0.8 }],
  ['?night=x', { night: null }],
  ['?dpr=1.5', { maxDpr: 1.5 }],
  ['?dpr=9', { maxDpr: 2 }],
  ['?dpr=0', { maxDpr: 2 }],
  ['?dpr=0.5', { maxDpr: 1 }],
  ['?tilepx=abc', { tilePx: 256 }],
  ['?tilepx=0', { tilePx: 256 }],
  ['?level=thruston&car=track-rwd', { levelId: 'thruston', carId: 'track-rwd' }],
  ['?level=&car=', { levelId: '', carId: '' }],
  ['?hw=interstate', { highwayDebug: 'interstate' }],
  ['?hw=', { highwayDebug: '' }],
  ['?meter=1', { meter: true, meterOverlay: true }],
  ['?nonat=1', { noNatClear: true }],
  ['?meter=0', { meter: false }],
  ['?report=1', { meter: true, report: true }],
  ['?report=1&meter=1', { meter: true, meterOverlay: true, report: true }],
  ['?noaudio=1', { audio: false }],
  ['?autopilot=1', { autopilot: true }],
  ['?autopilot=0', { autopilot: false }],
  ['?autopilot=120', { autopilot: true, autopilotKmh: 120 }],
  ['?engine=1', { engine: true }],
  ['?engine=0', { engine: false }],
  ['?churn=pictures', { churn: 'pictures' }],
  ['?churn=objects', { churn: 'objects' }],
  ['?churn=x', { churn: '' }],
  ['?skip=props,cars', { skipLayers: 'cars,props' }],
];

const norm = (v) => (v instanceof Set ? [...v].sort().join(',') : v);
let bad = 0;
console.log('link'.padEnd(52) + 'result');
for (const [link, want] of TABLE) {
  const got = readSettings(link), exp = { ...DEFAULTS, ...want };
  const diffs = [];
  for (const k of new Set([...Object.keys(exp), ...Object.keys(got)])) {
    if (!Object.is(norm(got[k]), exp[k])) diffs.push(`${k}: got ${String(got[k])}, want ${String(exp[k])}`);
  }
  if (diffs.length) bad++;
  console.log((link || "''").padEnd(52) + (diffs.length ? 'FAIL ' + diffs.join('; ') : 'ok'));
}
console.log(bad ? `${bad} of ${TABLE.length} links FAILED` : `all ${TABLE.length} links ok`);
process.exitCode = bad ? 1 : 0;
