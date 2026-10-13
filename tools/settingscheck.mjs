// node tools/settingscheck.mjs
// readSettings(): a table of page links -> the values the old per-file parsing (main.js qs, highway.js QP,
// render.ts NO_LOCK, render/tiles.ts TILE_PX/TILE_GPU/NO_SHADE) gave. Expected values are worked out from
// that code, not from settings.ts. Only the fields named in a row are checked; the rest must be the defaults.
import { readSettings } from '../src/core/settings.ts';

const DEFAULTS = {
  dev: false, carId: null, aiCount: 0, aiDifficulty: 2, trafficDensity: 0.6, litter: null, menu: null,
  menuAi: 4, guide: null, rules: null, levelId: null, inputMode: 'auto', highwayDebug: null,
  noLock: false, tilePx: 256, tileGpu: false, noShade: false,
  grassEnds: 'round', surfaceTextures: true, meter: false,
  autopilot: false, autopilotKmh: 0, skipLayers: '',   // a Set is compared as its sorted names joined by ','
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
  ['?dev&touch&pc&nolock&tilegpu&noshade&tilepx=128',
    { dev: true, inputMode: 'touch', noLock: true, tileGpu: true, noShade: true, tilePx: 128 }],
  ['?pc', { inputMode: 'pc' }],
  ['?tilepx=abc', { tilePx: 256 }],
  ['?tilepx=0', { tilePx: 256 }],
  ['?level=thruston&car=track-rwd', { levelId: 'thruston', carId: 'track-rwd' }],
  ['?level=&car=', { levelId: '', carId: '' }],
  ['?hw=interstate', { highwayDebug: 'interstate' }],
  ['?hw=', { highwayDebug: '' }],
  ['?grass=square', { grassEnds: 'square' }],
  ['?grass=x', { grassEnds: 'round' }],
  ['?tex=1', { surfaceTextures: true }],
  ['?tex=0', { surfaceTextures: false }],
  ['?tex', { surfaceTextures: true }],
  ['?meter=1', { meter: true }],
  ['?meter=0', { meter: false }],
  ['?autopilot=1', { autopilot: true }],
  ['?autopilot=0', { autopilot: false }],
  ['?autopilot=120', { autopilot: true, autopilotKmh: 120 }],
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
process.exit(bad ? 1 : 0);
