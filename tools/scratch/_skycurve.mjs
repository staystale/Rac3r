// _skycurve.mjs - the game clock's sky (world/clock.ts) through a day: midwinter and midsummer,
// a full and a new moon, dry and in rain: darkness and the colour of the dark, every hour.
import { CLOCK, calendarAt, skyNow, sunTimes, DAYS_PER_SEASON } from '../../src/world/clock.ts';

const DAY_S = 86400;
for (const [label, day] of [['MIDWINTER', 3], ['MIDSUMMER', 2 * DAYS_PER_SEASON + 3]]) {
  for (const moonDay of [0, 4]) {
    const base = (day + moonDay * 0) * DAY_S;
    const startS = base + moonDay * 0;
    CLOCK.eventS = startS;
    const cal = calendarAt(startS + 12 * 3600);
    const sun = sunTimes(cal.yearFraction);
    console.log(`${label} day ${day} moon ${cal.moon.toFixed(2)} sunrise ${sun.sunrise.toFixed(2)} sunset ${sun.sunset.toFixed(2)}`);
    const row = [];
    for (let hour = 0; hour < 24; hour += 1) {
      CLOCK.eventS = startS + hour * 3600;
      row.push(`${hour}:${skyNow(0).darkness.toFixed(2)}`);
    }
    console.log('  ' + row.join(' '));
    break;
  }
}
// the moon over 8 nights at midnight, and rain by day
for (let night = 0; night < 8; night++) {
  CLOCK.eventS = (DAYS_PER_SEASON * 1 + night) * DAY_S;
  process.stdout.write(`n${night}:${skyNow(0).darkness.toFixed(2)} `);
}
CLOCK.eventS = (DAYS_PER_SEASON + 1) * DAY_S + 13 * 3600;
console.log(`\nnoon dry ${skyNow(0).darkness} rain ${skyNow(1).darkness}`);
for (const hour of [15.5, 16, 16.25, 16.5, 16.75, 17, 17.25, 7.25, 7.75]) {
  CLOCK.eventS = 3 * DAY_S + hour * 3600;
  const sky = skyNow(0);
  console.log(`winter ${hour}h dark ${sky.darkness.toFixed(2)} rgb ${sky.rgb}`);
}
