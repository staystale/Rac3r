// _wintertemp.mjs - dry winter: the track temperatures events start at (200 seeds), and how long
// the Lab's own ice and snow areas last at a few track temperatures (cover field levels).
const W = new URL('../../src/', import.meta.url).href;
const Wx = await import(W + 'world/weather.ts');
const field = await import(W + 'world/coverfield.ts');
if (process.argv.includes('--cold')) Wx.setWinterCold(true);
const temps = [];
for (let seed = 1; seed <= 200; seed++) {
  Wx.startWeather({ mode: 'dry', season: 0, seed });
  temps.push(Wx.WEATHER.trackC);
}
temps.sort((a, b) => a - b);
const at = (f) => temps[Math.floor(f * (temps.length - 1))].toFixed(1);
console.log(`dry winter track C: min ${at(0)} 10% ${at(0.1)} median ${at(0.5)} 90% ${at(0.9)}`
  + ` max ${at(1)}; below 0: ${temps.filter((t) => t < 0).length}/200`);
for (const trackC of [3, 8, 12]) {
  field.resetCoverField();
  const gone = {};
  for (let second = 1; second <= 7200; second++) {
    Wx.WEATHER.trackC = trackC;
    Wx.WEATHER.rain = 0;
    field.stepCoverField(1);
    for (const kind of ['ice', 'snow']) {
      const level = kind === 'ice' ? field.AREAS.ice.ice : field.AREAS.snow.snow;
      if (level <= 0.5 && !gone[kind]) gone[kind] = second;
    }
  }
  console.log(`track ${trackC} C: the level's ICE half gone after ${gone.ice || '>7200'} s,`
    + ` SNOW after ${gone.snow || '>7200'} s`);
}
// (run with --cold for ?wintercold=1)
