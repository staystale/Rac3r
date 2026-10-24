// _skysnap.mjs - the sky (darkness, colour) the game clock gives through a day, and the biggest
// change in one real second of play: does the light snap at sunrise / sunset?
// node tools/scratch/_skysnap.mjs [season 0..3] [cloud 0..1]
import { CLOCK, skyNow, sunTimes, calendarAt, GAME_PER_REAL, DAYS_PER_SEASON } from '../../src/world/clock.ts';
const season = Number(process.argv[2] ?? 2), cloud = Number(process.argv[3] ?? 0);
const DAY_S = 86400;
const base = season * DAYS_PER_SEASON * DAY_S + 3 * DAY_S;
const sun = sunTimes(calendarAt(base + 12 * 3600).yearFraction);
console.log('sunrise', sun.sunrise.toFixed(2), 'sunset', sun.sunset.toFixed(2));
let prev = null, worst = { d: 0 }, worstRgb = { d: 0 };
const stepGame = GAME_PER_REAL; // one real second
for (let t = 0; t < DAY_S; t += stepGame) {
  CLOCK.eventS = base + t;
  const sky = skyNow(cloud);
  const rgb = sky.rgb.split(',').map(Number);
  // what the overlay adds: colour times alpha (0.9 * darkness), per channel
  const shown = rgb.map((c) => c * 0.9 * sky.darkness);
  if (prev) {
    const dDark = Math.abs(sky.darkness - prev.darkness);
    const dRgb = Math.max(...shown.map((c, i) => Math.abs(c - prev.shown[i])));
    if (dDark > worst.d) worst = { d: dDark, hour: t / 3600, from: prev, to: sky };
    if (dRgb > worstRgb.d) worstRgb = { d: dRgb, hour: t / 3600, from: prev.rgb, to: sky.rgb };
  }
  prev = { ...sky, shown };
  const h = t / 3600;
  if ((Math.abs(h - sun.sunrise) < 1.5 || Math.abs(h - sun.sunset) < 1.5) && (t / stepGame) % 10 === 0)
    console.log(h.toFixed(2), sky.darkness.toFixed(3), sky.rgb);
}
console.log('worst darkness step / real s', worst.d.toFixed(4), 'at', worst.hour.toFixed(2));
console.log('worst overlay colour step / real s', worstRgb.d.toFixed(2), 'at', worstRgb.hour.toFixed(2), worstRgb.from, '->', worstRgb.to);
