// _packedwear.mjs (node tools/scratch/_packedwear.mjs) - ?packedwear=1: packed-snow cells of the
// Surface Bowling Alley worn pass by pass: passes until they break up, how many go to snow / ice,
// what wet packed snow becomes, and that the switch off leaves them packed.
const W = new URL('../../src/', import.meta.url).href;
const L = await import(W + 'lab.js');
const wear = await import(W + 'world/wear.ts');
const { setPackedSnowWear } = await import(W + 'world/snowwear.ts');
const { setWetness } = await import(W + 'world/weather.ts');
const STATE = await import(W + 'world/state.ts');

L.setLevel('bowling-alley');
const points = [];
const lane = STATE.LEVEL.zones.find((zone) => zone.lane === 'packedSnow');
for (let x = lane.x - lane.w / 2 + 1; x < lane.x + lane.w / 2 && points.length < 400; x += wear.WEAR_CELL) {
  for (let y = lane.y - lane.h / 2 + 1; y < lane.y + lane.h / 2 && points.length < 400; y += wear.WEAR_CELL) {
    const layers = wear.layersAt(x, y);
    if (!layers.cover && layers.base === 'packedSnow') points.push([x, y]);
  }
}
function run(label, isOn, wetness) {
  setPackedSnowWear(isOn); setWetness(wetness); wear.clearWear();
  const counts = {}, firstAt = [];
  for (const [x, y] of points) {
    let first = 0;
    for (let pass = 1; pass <= 8; pass++) {
      const now = wear.recordWearAt(x, y, null, pass * 1000);
      if (now === null) break;   // no wear cell: it can never change
      if (!first && now !== 'packedSnow') { first = pass; counts[now] = (counts[now] || 0) + 1; }
    }
    if (first) firstAt.push(first);
  }
  const passes = [...new Set(firstAt)].join('/');
  console.log(`${label.padEnd(16)} ${points.length} cells: ${JSON.stringify(counts)}`
    + ` broke up at pass ${passes || '-'}`);
}
run('switch off', false, 0);
run('packedwear dry', true, 0);
run('packedwear wet', true, 0.8);
