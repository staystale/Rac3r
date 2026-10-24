// _dirtmud.mjs [--on] - worn dirt -> mud by weather: the Bowling Alley's dirt lane, 400 squares, each
// given 2 dry passes (dirt's wear count) per trial; the share that became mud, by track
// temperature and dampness (and the share baked to gravel). ?mudwater=1 with --on.
const W = new URL('../../src/', import.meta.url).href;
const load = await import(W + 'world/load.ts');
const wear = await import(W + 'world/wear.ts');
const Wx = await import(W + 'world/weather.ts');
const P = await import(W + 'world/puddles.ts');
const field = await import(W + 'world/coverfield.ts');
const mud = await import(W + 'world/levelmud.ts');
load.initWorld();
load.setLevel('bowling-alley');
const STATE = await import(W + 'world/state.ts');
const panel = STATE.LEVEL.zones.find((zone) => zone.surface.id === 'dirt');
const squares = [];
for (let i = 0; i < 400; i++) {
  squares.push([panel.x - 100 + (i % 80) * 1.5, panel.y - 3 + Math.floor(i / 80) * 1.5]);
}
const idAt = (x, y) => { const g = wear.groundAt(x, y); return (g.surface && g.surface.id) || g.id; };
const rows = [];
for (const [trackC, wetness] of [[10, 0], [20, 0], [30, 0], [35, 0], [40, 0], [45, 0], [35, 0.25], [20, 0.8]]) {
  Wx.WEATHER.trackC = trackC; Wx.WEATHER.rain = 0; Wx.setWetness(wetness);
  wear.clearWear(); P.resetPuddles(); field.resetCoverField();
  let clock = 1e6;
  for (let pass = 0; pass < 2; pass++) for (const [x, y] of squares) wear.recordWearAt(x, y, null, (clock += 1000));
  const muddy = squares.filter(([x, y]) => idAt(x, y) === 'mud').length;
  const gravel = squares.filter(([x, y]) => idAt(x, y) === 'gravel').length;
  rows.push(`${trackC} C wet ${wetness}: mud ${Math.round(muddy / 4)}% gravel ${Math.round(gravel / 4)}%`);
}
console.log(process.argv.includes('--on') ? 'ON ' : 'OFF', rows.join(' | '));
