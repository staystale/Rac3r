// THE GAME CLOCK (?daytime=1): one global time of day and season that runs while you race and
// holds for the story (owner). 1 game day = 1 real hour; a season = 7 game days, so a year is 28
// days (28 h of play); UK-like days (winter ~8 h of daylight, summer ~16 h); the moon waxes and
// wanes over 8 days, so some nights are moonlit and some pitch-black; cloud and rain dim the day
// and hide the moon. The clock gives the sky - how dark, and the colour of the dark (pink
// at sunrise, orange at sunset, blue-black at night) - which the night layer draws and the lamps
// and the field's headlights follow (world/daylight.ts). Saved in its own storage key. In TEST
// MODE an event may start at an hour of its own (the setup's TIME slider) and runs from there.

import { setSky } from './daylight.ts';

// game seconds per real second: 1 game day = 1 real hour
export const GAME_PER_REAL = 24;
// game days in a season, seasons in a year (weather.ts SEASON_NAMES order: winter first)
export const DAYS_PER_SEASON = 7, SEASONS_PER_YEAR = 4;
// the moon's cycle, game days (not a multiple of a season: full moons drift through the year)
const MOON_DAYS = 8;
const DAY_S = 24 * 3600, YEAR_DAYS = DAYS_PER_SEASON * SEASONS_PER_YEAR;
// daylight hours: 12 +- this through the year (UK ~52 N: ~7.75 h midwinter, ~16.25 h midsummer)
const DAYLIGHT_SWING_H = 4.25;
// twilight, hours: the golden hour before sunset (after sunrise) and the fall to full night after
const GOLDEN_H = 1, DUSK_H = 0.8;
// how dark it is: at the end of the golden hour, and a moonless night; a full moon lifts the night
// by MOON_LIFT; heavy cloud / rain darkens the day by CLOUD_DIM
const GOLDEN_DARK = 0.2, NIGHT_DARK = 1, MOON_LIFT = 0.3, CLOUD_DIM = 0.25;
// the dark's colour, 'r,g,b': sunset, sunrise, the dusk between, night
const SUNSET_RGB = [120, 52, 12], SUNRISE_RGB = [118, 52, 84], DUSK_RGB = [40, 22, 52];
const NIGHT_RGB = [4, 8, 22];
// real seconds between saves while racing, and between updates of the sky
const SAVE_EVERY_S = 10, SKY_EVERY_S = 0.25;
const STORE_KEY = 'carsim.clock.v1';

/** The clock: game seconds since the first day of the year (global), and this event's own. */
export const CLOCK = { globalS: 0, eventS: 0, isOn: false, sinceSaveS: 0, sinceSkyS: 0 };

/** What the sky is at a moment: how dark (0..1) and the colour of the dark ('r,g,b'). */
export interface Sky {
  darkness: number;
  rgb: string;
}

/**
 * Turns the clock on (?daytime=1) and reads the saved global time; a new player starts at
 * today's season at 10:00.
 * @param isOn true for the clock
 * @param seasonNow the season to start in when nothing is saved (0 winter .. 3 autumn)
 */
export function startClock(isOn: boolean, seasonNow: number): void {
  CLOCK.isOn = isOn;
  if (!isOn) return;
  let saved = NaN;
  try {
    saved = Number(localStorage.getItem(STORE_KEY));
  } catch { /* no storage: the default below */ }
  CLOCK.globalS = Number.isFinite(saved) && saved > 0 ? saved
    : (seasonNow * DAYS_PER_SEASON * DAY_S) + 10 * 3600;
  CLOCK.eventS = CLOCK.globalS;
  setSky(skyNow(0));
}

/** Saves the global time (guarded: private windows throw). */
function saveClock(): void {
  try {
    localStorage.setItem(STORE_KEY, String(Math.round(CLOCK.globalS)));
  } catch { /* fine */ }
}

/**
 * Starts an event's clock: the global time, or (TEST MODE) the same day at an hour of its own.
 * @param hour the start hour 0..24, or null for the global time
 */
export function startEventClock(hour: number | null): void {
  if (!CLOCK.isOn) return;
  CLOCK.eventS = hour === null ? CLOCK.globalS
    : Math.floor(CLOCK.globalS / DAY_S) * DAY_S + hour * 3600;
  setSky(skyNow(0));
}

/**
 * Runs the clock one sim step: the global time and this event's move on together while racing;
 * the sky follows four times a second (racing or not: the menu shows the time it is).
 * @param dt real (sim) seconds
 * @param isRacing true in an event (the clock runs only while you play)
 * @param cloud how overcast / rainy, 0..1 (weather.ts rain)
 */
export function stepClock(dt: number, isRacing: boolean, cloud: number): void {
  if (!CLOCK.isOn) return;
  CLOCK.sinceSkyS += dt;
  if (CLOCK.sinceSkyS >= SKY_EVERY_S) {
    CLOCK.sinceSkyS = 0;
    setSky(skyNow(cloud));
  }
  if (!isRacing) return;
  CLOCK.globalS += dt * GAME_PER_REAL;
  CLOCK.eventS += dt * GAME_PER_REAL;
  CLOCK.sinceSaveS += dt;
  if (CLOCK.sinceSaveS >= SAVE_EVERY_S) {
    CLOCK.sinceSaveS = 0;
    saveClock();
  }
}

/**
 * The calendar at a moment: season, day in it, hour, moon.
 * @param timeS game seconds since the first day of the year
 * @returns the season (0 winter), the day in the season (0..6), the hour (0..24), the moon's
 *   light (0 new .. 1 full) and the year's fraction (0..1, midwinter at 0.125)
 */
export function calendarAt(timeS: number) {
  const day = Math.floor(timeS / DAY_S), hour = (timeS - day * DAY_S) / 3600;
  const dayOfYear = ((day % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
  const moonPhase = ((timeS / DAY_S) % MOON_DAYS) / MOON_DAYS;
  return {
    season: Math.floor(dayOfYear / DAYS_PER_SEASON), dayInSeason: dayOfYear % DAYS_PER_SEASON,
    hour, moon: (1 - Math.cos(2 * Math.PI * moonPhase)) / 2,
    yearFraction: (dayOfYear + hour / 24) / YEAR_DAYS,
  };
}

/**
 * Sunrise and sunset on a day of the year, hours (solar noon at 12:00).
 * @param yearFraction 0..1 through the year (winter first; midwinter at 0.125)
 * @returns sunrise and sunset, hours
 */
export function sunTimes(yearFraction: number) {
  const daylight = 12 - DAYLIGHT_SWING_H * Math.cos(2 * Math.PI * (yearFraction - 0.125));
  return { sunrise: 12 - daylight / 2, sunset: 12 + daylight / 2 };
}

const mix = (from: number[], toward: number[], share: number) =>
  from.map((value, i) => Math.round(value + (toward[i] - value) * share)).join(',');
const smooth = (share: number) => {
  const clamped = Math.max(0, Math.min(1, share));
  return clamped * clamped * (3 - 2 * clamped);
};

/**
 * The sky at an hour: hours from the nearest sunrise / sunset decide the twilight.
 * @param hour the hour, 0..24
 * @param sun sunrise and sunset, hours
 * @param nightDark how dark the night is (the moon)
 * @returns darkness 0..1 and the colour of the dark
 */
function twilightSky(hour: number, sun: { sunrise: number; sunset: number },
    nightDark: number): Sky {
  const isEvening = hour >= 12;
  // hours past the sun's line: negative in daylight (sunset ahead / sunrise behind)
  const past = isEvening ? hour - sun.sunset : sun.sunrise - hour;
  const glow = isEvening ? SUNSET_RGB : SUNRISE_RGB;
  if (past < -GOLDEN_H) return { darkness: 0, rgb: NIGHT_RGB.join(',') };
  if (past < 0) {
    const share = smooth(1 + past / GOLDEN_H);
    return { darkness: GOLDEN_DARK * share, rgb: glow.join(',') };
  }
  if (past >= DUSK_H) return { darkness: nightDark, rgb: NIGHT_RGB.join(',') };
  const share = past / DUSK_H;
  const rgb = share < 0.5 ? mix(glow, DUSK_RGB, share * 2)
    : mix(DUSK_RGB, NIGHT_RGB, share * 2 - 1);
  return { darkness: GOLDEN_DARK + (nightDark - GOLDEN_DARK) * smooth(share), rgb };
}

/**
 * The sky now: the event's time of day, its season's day length, the moon and the cloud.
 * @param cloud how overcast / rainy, 0..1 (weather.ts rain)
 * @returns darkness 0..1 and the colour of the dark
 */
export function skyNow(cloud: number): Sky {
  const when = calendarAt(CLOCK.eventS);
  // cloud hides the moon
  const nightDark = NIGHT_DARK - MOON_LIFT * when.moon * (1 - cloud);
  const sky = twilightSky(when.hour, sunTimes(when.yearFraction), nightDark);
  sky.darkness = Math.min(1, Math.max(sky.darkness, CLOUD_DIM * cloud));
  return sky;
}

/**
 * The clock as a line for the setup / pause menu, e.g. "SPRING DAY 3 · 19:40 · FULL MOON".
 * @param timeS game seconds since the first day of the year
 * @param seasonNames the season names (weather.ts SEASON_NAMES)
 * @returns the line
 */
export function clockLine(timeS: number, seasonNames: string[]): string {
  const when = calendarAt(timeS);
  const minutes = Math.floor(when.hour * 60);
  const clock = String(Math.floor(minutes / 60)).padStart(2, '0') + ':'
    + String(minutes % 60).padStart(2, '0');
  const moon = when.moon > 0.85 ? ' · FULL MOON' : when.moon < 0.15 ? ' · NO MOON' : '';
  return seasonNames[when.season] + ' DAY ' + (when.dayInSeason + 1) + ' · ' + clock + moon;
}
