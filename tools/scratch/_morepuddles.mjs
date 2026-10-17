// _morepuddles.mjs (node tools/scratch/_morepuddles.mjs) - puddle vs snow sites, ?morepuddles off / on: counts, 5 min heavy rain / snow,
// look changes a minute, and the snow sites' fingerprint (must be identical).
const W = new URL('../../src/', import.meta.url).href;
const P = await import(W + 'world/puddles.ts');
const { startWeather, stepWeather } = await import(W + 'world/weather.ts');
P.setWeatherPuddles(true);
const L = await import(W + 'lab.js');
const STATE = await import(W + 'world/state.ts');
const levels = ['castle-cum', 'brands-snatch', 'killder', 'sweaty-lamb', 'grass-track', 'knobhill', 'slidden-hill'];
for (const level of levels) {
  const line = [level.padEnd(13)];
  let snowPrint = [];
  for (const on of [false, true]) {
    P.setMorePuddles(on);
    L.setLevel(level); STATE.LEVEL._puddleSites = P.buildPuddleSites(STATE.LEVEL);
    const sites = STATE.LEVEL._puddleSites;
    const water = sites.filter((s) => s.catchK > 0).length, snow = sites.filter((s) => s.snowy);
    snowPrint.push(snow.map((s) => `${s.x.toFixed(3)},${s.y.toFixed(3)},${s.w.toFixed(3)}`).join(';'));
    const res = [];
    for (const [mode, season] of [['heavy', 3], ['snow', 0]]) {
      L.clearWear(); startWeather({ mode, season, seed: 5 }); P.resetPuddles();
      let changes = 0; const before = new Map(sites.map((s) => [s, s.shown])); let firstAt = null;
      for (let step = 1; step <= 300 * 120; step++) {
        stepWeather(1 / 120); P.stepPuddles(1 / 120);
        if (step % 120 === 0) for (const s of sites) if (before.get(s) !== s.shown) { changes++; before.set(s, s.shown); }
        if (step % 120 === 0 && firstAt === null && sites.some((s) => s.shown)) firstAt = step / 120;
      }
      res.push(`${mode} ${sites.filter((s) => s.shown).length} (first ${firstAt}s, ${(changes / 5).toFixed(0)}/min)`);
    }
    line.push(`${on ? 'ON ' : 'off'}: water ${water} snow ${snow.length} | ${res.join(' ')}`);
  }
  line.push(snowPrint[0] === snowPrint[1] ? 'snow IDENTICAL' : 'snow DIFFERENT');
  console.log(line.join('  '));
}
