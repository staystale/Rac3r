// _crossinglist.mjs - EVERY LEVEL'S BRIDGES AND TUNNELS (scratch): each level built in node with
// the switches in env (e.g. NITROUSNOOK=1), its crossings listed - kind, length, the race road's
// own underpass, a straight tunnel's underground stretch (the night's deck over it:
// render/lightdecks.ts traceUnderground) - and its slat props.
// node tools/scratch/_crossinglist.mjs [level ...]
import * as L from '../../src/lab.ts';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : L.LEVELS.map((lv) => lv.id);
for (const id of ids) {
  try {
    L.setLevel(id);
  } catch (err) {
    console.log(id.padEnd(22), 'BUILD FAILED', String(err).slice(0, 80));
    continue;
  }
  const ways = L.LEVEL.crossings || [];
  const slats = (L.PROPS || []).filter((prop) => prop.kind === 'slat').length;
  if (!ways.length && !slats) continue;
  const rows = ways.map((way) => `${way.kind}${way.track ? '(lap)' : ''} ${Math.round(way.length)}m`
    + (way.kind === 'tunnel' && !way.hidden && way.length > 2 * way.cut
      ? ` UNDERGROUND ${Math.round(way.length - 2 * way.cut)}m` : ''));
  console.log(id.padEnd(22), `slats ${slats}`, rows.join(' | '));
}
