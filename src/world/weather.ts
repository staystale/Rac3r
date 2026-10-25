// THE WEATHER: how wet the track is, how hard it rains or snows and how warm it is. One small state
// object read by the ground (wet.ts: damp surfaces, the dry line), the tyres (they warm and cool
// toward the TRACK temperature), the AI (its speed plan follows the wetness) and the look (rain.ts,
// the wet ground). No weather (the default) is a dry track at 18 C: every reader then behaves
// exactly as before weather existed.
//
// WETNESS is the water on the ground everywhere, 0 (dry) .. 1 (soaked): the surfaces between their
// dry and DAMP grip (surfaces.ts WET_MU, the owner's signed-off table). It is read in WET_BANDS
// steps, so the damp surfaces are a small cached set and the AI re-plans only when the wetness
// moves a whole step. Puddles (standing water) are a separate cover (wear.ts), not this.
//
// THE SEASON (event setup) sets the chance of each kind of weather and the air temperature; in
// SEASON mode the weather can change through the race (sim time, its own seeded random stream, so
// a restart replays it). Rain soaks the track over about a minute (heavy) to a few (light); a dry
// spell dries it by the track temperature (minutes in summer, a long time in winter).

import { sunShareNow } from "./clock.ts";
import { lcg } from "../core/random.ts";

/** the steps wetness is read in: 0 = dry .. WET_BANDS = soaked */
export const WET_BANDS = 10;

/** What the sky is doing. */
export type WeatherKind = 'dry' | 'rain' | 'heavy' | 'snow' | 'hot' | 'superhot';
/** The event setup's choice: follow the season (changes in the race), or a fixed weather. */
export type WeatherMode = 'season' | 'dry' | 'hot' | 'superhot' | 'rain' | 'heavy' | 'snow';

/** The weather now. */
export interface WeatherState {
  /** water on the ground everywhere, 0 (dry) .. 1 (soaked) */
  wetness: number;
  /** how hard it is raining, 0 .. 1 (soaks the track, re-wets the dry line; the rain look) */
  rain: number;
  /** how hard it is snowing, 0 .. 1 (the snow look; snow lying is the puddle step) */
  snow: number;
  /** air temperature, C */
  tempC: number;
  /** track temperature, C: the air plus what the sun puts into the surface (tyres follow it) */
  trackC: number;
  /** what the sky is doing */
  kind: WeatherKind;
  /** the event's season, 0 winter .. 3 autumn (puddles.ts: did it rain before the start?) */
  season: number;
  /** wetness in steps, 0 .. WET_BANDS */
  band: number;
  /** counts every change of band: readers that cache by wetness compare it */
  epoch: number;
}

export const WEATHER: WeatherState = {
  wetness: 0, rain: 0, snow: 0, tempC: 18, trackC: 18, kind: 'dry', season: 2, band: 0, epoch: 0,
};

export const SEASON_NAMES = ['WINTER', 'SPRING', 'SUMMER', 'AUTUMN'];

// The chance of each kind of weather per season, and the air temperature range (C): a British
// year - wet, mild winters with some snow; hot spells only in summer.
const SEASONS: { chance: Record<WeatherKind, number>; airC: [number, number] }[] = [
  { chance: { dry: 0.40, rain: 0.25, heavy: 0.10, snow: 0.25, hot: 0, superhot: 0 }, airC: [1, 8] },
  { chance: { dry: 0.50, rain: 0.28, heavy: 0.10, snow: 0.02, hot: 0.10, superhot: 0 },
    airC: [8, 16] },
  { chance: { dry: 0.42, rain: 0.13, heavy: 0.07, snow: 0, hot: 0.28, superhot: 0.10 },
    airC: [17, 25] },
  { chance: { dry: 0.47, rain: 0.30, heavy: 0.15, snow: 0.03, hot: 0.05, superhot: 0 },
    airC: [8, 15] },
];

// Each kind: how hard it rains / snows, what it does to the air (C), and what the sun adds to the
// track surface (C; a sunny summer track runs 10-20 C above the air, a wet one near it).
const KINDS: Record<WeatherKind, { rain: number; snow: number; airC: number; sunC: number }> = {
  dry: { rain: 0, snow: 0, airC: 0, sunC: 8 },
  rain: { rain: 0.45, snow: 0, airC: -2, sunC: 1 },
  heavy: { rain: 1, snow: 0, airC: -3, sunC: 0 },
  snow: { rain: 0, snow: 0.7, airC: -6, sunC: 0 },
  hot: { rain: 0, snow: 0, airC: 6, sunC: 14 },
  superhot: { rain: 0, snow: 0, airC: 12, sunC: 20 },
};

// WINTER COLD (owner: a dry winter day can freeze; ice melts slower than snow): winter air
// WINTER_COLD_AIR_C (was 1-8: a dry winter track ran 9-16 C, never freezing), a low winter sun
// warms the track WINTER_SUN of its usual (not on a hot day: hot whatever the season); every ice
// melts at ICE_MELT_SHARE of snow's rate (a level's ice was half gone in 8 s at 12 C, snow in 7
// min)
const WINTER_COLD_AIR_C: [number, number] = [-4, 7], WINTER_SUN = 0.25;
export const ICE_MELT_SHARE = 0.5;
// ONE COLD-SURFACE ORDER: coverfield.ts (the order), snowwear.ts (driven ice), puddles.ts (rain on
// tyre-made ice)

/**
 * A season's air temperature range (C).
 * @param season 0 winter .. 3 autumn
 * @returns [low, high]
 */
const airRange = (season: number): [number, number] =>
  (season === 0 ? WINTER_COLD_AIR_C : SEASONS[season].airC);

// WEATHER ONLY (owner: no level-drawn snow or ice, only the weather's - scenery water stays): a
// SNOWY level (a snow-themed stage) has no snow of its own; its theme makes snow SNOWY_SNOW_K
// times as likely where the season allows it (never in summer) and its mountain air SNOWY_AIR_C
// colder (coverfield.ts: its snow starts lying deep when cold)
const SNOWY_SNOW_K = 4, SNOWY_AIR_C = -5;

/**
 * A season's odds of each kind of weather and its air range, at a level: a snowy level's theme
 * biases them.
 * @param season 0 winter .. 3 autumn
 * @param isSnowy true at a snowy level
 * @returns the chances (summing to 1) and the air range, C
 */
function seasonOdds(season: number, isSnowy: boolean) {
  const chance = SEASONS[season].chance, airC = airRange(season);
  if (!isSnowy) return { chance, airC };
  const biased = { ...chance, snow: chance.snow * SNOWY_SNOW_K };
  const total = Object.values(biased).reduce((sum, share) => sum + share, 0);
  for (const kind of Object.keys(biased) as WeatherKind[]) biased[kind] /= total;
  const coldAirC: [number, number] = [airC[0] + SNOWY_AIR_C, airC[1] + SNOWY_AIR_C];
  return { chance: biased, airC: coldAirC };
}

// the least air temperature (C) of a hot and a very hot day
const HOT_AIR_MIN_C: Partial<Record<WeatherKind, number>> = { hot: 24, superhot: 32 };

// wetness a second at rain 1 (heavy rain soaks the track in about a minute)
const SOAK_PER_S = 1 / 60;
// a melting coat's soak as a rain of this much (coverfield.ts setMeltSoak; 0 when nothing melts)
let meltSoak = 0;

/**
 * Sets how hard a melting coat soaks the track this step, as a rain (the cover
 * field sets it every step). While it soaks, the track's damp does not dry.
 * @param rainLike the rain it soaks as, 0..1
 */
export function setMeltSoak(rainLike: number): void {
  meltSoak = rainLike;
}
// wetness a second a dry spell takes off per C of track temperature (20 C: ~9 min to dry a soaked
// track; a 45 C summer track ~4 min; a 10 C winter one ~18 min)
const DRY_PER_S_PER_C = 1 / (600 * 18);
// how fast the rain / snow and the temperatures move to a new weather (1/s): a shower builds over
// ~15 s, the temperature over ~1 min
const SKY_EASE = 1 / 15, TEMP_EASE = 1 / 60;
// the rain / snow ease in two stages, each twice as fast (~15 s on the whole; owner: weather
// changes gradual): one stage moved fastest at the very first instant, so a shower and its
// dimming started at once
const BLEND_EASE = 2 * SKY_EASE;
// s between chances of a change of weather in SEASON mode, and the chance it stays the same
const CHANGE_S: [number, number] = [70, 180];
const STAY_CHANCE = 0.45;
// SUN TEMPERATURE (owner: the track warms and cools with the light, so it cannot heat
// up as it gets dark): the sun's heat on the track follows the clock's sun (clock.ts sunShareNow:
// none at night, all of it at noon) and the air swings this much either side of its day's value,
// C (night to midday); sampled every SUN_EVERY_S of sim time
const AIR_DAY_SWING_C = 2.5, SUN_EVERY_S = 1;
// a dry start this soon after rain (chance, and how wet it still is)
const DRYING_START_CHANCE = 0.3, DRYING_START_WET: [number, number] = [0.2, 0.55];

/** The weather plan of an event (the setup's choice). */
export interface WeatherPlan {
  mode: WeatherMode;
  /** 0 winter .. 3 autumn */
  season: number;
  /** the random stream's start, so a restart replays the same weather */
  seed: number;
  /** a snowy level (a snow-themed stage): its theme biases the odds */
  snowy?: boolean;
}

// MELTING (owner: snow and ice should melt in anything but the cold, faster when hot; every level
// follows its weather - a snow level may be played hot and melt). The melting itself: puddles.ts.

/**
 * The temperature snow and ice feel (snowwear.ts): the track's while an event's weather runs,
 * else 0 C - the old game had no temperature for snow.
 * @returns C
 */
export function snowTempC(): number { return RUN.plan ? WEATHER.trackC : 0; }

/** Whether this event is at a snowy level whose theme biases the weather. */
export function weatherSnowy(): boolean { return !!RUN.plan?.snowy; }

/** Whether an event's weather is running (no plan: the old dry 18 C game, nothing melts). */
export function weatherRuns(): boolean { return !!RUN.plan; }

/** The running event's season, 0 winter .. 3 autumn, or null with no event weather. */
export function weatherSeason(): number | null { return RUN.plan ? RUN.plan.season : null; }

// the running weather: plan, random stream, targets
const RUN = {
  plan: null as WeatherPlan | null,
  random: (() => 0) as () => number,
  baseAirC: 18,
  nextChangeS: 0,
  targetRain: 0,
  targetSnow: 0,
  targetAirC: 18,
  targetTrackC: 18,
  airAimC: 18,      // the weather's air, before the day's swing
  sunTrackC: 0,     // what a noon sun adds to the track in this weather, C
  sinceSunS: 0,     // sim s since the sun was last sampled
  frontRain: 0,     // the rain / snow's first stage, which the falling one follows
  frontSnow: 0,
};
/** Points the temperature targets at the weather and the sun now (air and track follow it). */
function aimTemps(): void {
  const share = sunShareNow();
  RUN.targetAirC = RUN.airAimC + AIR_DAY_SWING_C * (2 * share - 1);
  RUN.targetTrackC = RUN.targetAirC + RUN.sunTrackC * share;
}

/**
 * Sets how wet the track is (and moves the band and epoch when the step changes).
 * @param wetness 0 (dry) .. 1 (soaked)
 */
export function setWetness(wetness: number): void {
  WEATHER.wetness = Math.max(0, Math.min(1, wetness));
  const band = Math.round(WEATHER.wetness * WET_BANDS);
  if (band !== WEATHER.band) {
    WEATHER.band = band;
    WEATHER.epoch++;
  }
}

/**
 * Sets how hard it is raining.
 * @param rain 0 (none) .. 1 (downpour)
 */
export function setRain(rain: number): void {
  WEATHER.rain = Math.max(0, Math.min(1, rain));
}

/** The event's seeded random stream (puddles.ts deals the start's puddles from it: a restart
 * replays them). */
export function weatherRandom(): number {
  if (!RUN.plan) return 1;
  return RUN.random();
}

/** The wetness as a fraction in whole steps (what the surfaces are built at). */
export function wetStep(): number {
  return WEATHER.band / WET_BANDS;
}

/** The kind of weather a season deals, by its chances. */
function dealKind(season: number): WeatherKind {
  const { chance } = seasonOdds(season, !!RUN.plan?.snowy);
  let roll = RUN.random();
  for (const kind of Object.keys(chance) as WeatherKind[]) {
    roll -= chance[kind];
    if (roll < 0) return kind;
  }
  return 'dry';
}

/** Points the sky and the temperatures at a kind of weather (they ease there). */
function aimAt(kind: WeatherKind): void {
  const spec = KINDS[kind];
  WEATHER.kind = kind;
  RUN.targetRain = spec.rain;
  RUN.targetSnow = spec.snow;
  // snow needs freezing air; a hot day is hot whatever the season (chosen in winter too)
  RUN.airAimC = kind === 'snow' ? Math.min(0, RUN.baseAirC + spec.airC)
    : Math.max(HOT_AIR_MIN_C[kind] ?? -50, RUN.baseAirC + spec.airC);
  const lowSun = WEATHER.season === 0 && !HOT_AIR_MIN_C[kind];
  RUN.sunTrackC = spec.sunC * (lowSun ? WINTER_SUN : 1);
  aimTemps();
}

/** The fixed kind a mode asks for, or null (SEASON: dealt by the season). */
function fixedKind(mode: WeatherMode): WeatherKind | null {
  return mode === 'season' ? null : mode;
}

/**
 * Starts an event's weather (a launch or a restart): the season's temperature, the first weather
 * (fixed, or dealt by the season) and how wet the track already is.
 * @param plan the setup's choice, or null for no weather (dry, 18 C: the game as before; a
 *   weather set by hand - the ?rain test switch - is left as it is)
 */
export function startWeather(plan: WeatherPlan | null): void {
  const hadPlan = !!RUN.plan;
  RUN.plan = plan;
  meltSoak = 0;
  if (!plan) {
    if (hadPlan) {
      Object.assign(WEATHER, { rain: 0, snow: 0, tempC: 18, trackC: 18, kind: 'dry' });
      setWetness(0);
    }
    return;
  }
  // the seed mixed first: an LCG's first draws follow its seed closely (seeds 11, 22, 33 dealt the
  // same first weather)
  RUN.random = lcg(Math.imul(plan.seed, 2654435761) >>> 0);
  RUN.random();
  WEATHER.season = plan.season;
  const [lowC, highC] = seasonOdds(plan.season, !!plan.snowy).airC;
  RUN.baseAirC = lowC + (highC - lowC) * RUN.random();
  aimAt(fixedKind(plan.mode) || dealKind(plan.season));
  WEATHER.rain = RUN.frontRain = RUN.targetRain;
  WEATHER.snow = RUN.frontSnow = RUN.targetSnow;
  WEATHER.tempC = RUN.targetAirC;
  WEATHER.trackC = RUN.targetTrackC;
  // it has been raining a while; a dry day may follow rain (a drying track); hot days are dry
  let wetness = WEATHER.rain > 0 ? 0.6 + 0.4 * RUN.random() : 0;
  if (WEATHER.kind === 'dry' && plan.mode === 'season' && RUN.random() < DRYING_START_CHANCE) {
    wetness = DRYING_START_WET[0] + (DRYING_START_WET[1] - DRYING_START_WET[0]) * RUN.random();
  }
  setWetness(wetness);
  RUN.nextChangeS = CHANGE_S[0] + (CHANGE_S[1] - CHANGE_S[0]) * RUN.random();
}

/**
 * Deals the next weather in SEASON mode (or keeps this one).
 * @returns the news for the HUD, or null
 */
function changeWeather(): { text: string; good: boolean } | null {
  const plan = RUN.plan!;
  RUN.nextChangeS = CHANGE_S[0] + (CHANGE_S[1] - CHANGE_S[0]) * RUN.random();
  if (RUN.random() < STAY_CHANCE) return null;
  const was = WEATHER.kind, next = dealKind(plan.season);
  if (next === was) return null;
  aimAt(next);
  if (KINDS[next].rain > KINDS[was].rain) {
    return { text: next === 'heavy' ? 'HEAVY RAIN' : 'RAIN STARTING', good: false };
  }
  if (next === 'snow') return { text: 'SNOW FALLING', good: false };
  if (KINDS[was].rain > 0 && KINDS[next].rain === 0) return { text: 'RAIN STOPPING', good: true };
  if (KINDS[next].sunC > KINDS[was].sunC + 4) return { text: 'HOT TRACK', good: false };
  return null;
}

/** Moves a value toward a target at a rate (1/s). */
const ease = (from: number, target: number, rate: number, dt: number) =>
  from + (target - from) * Math.min(1, rate * dt);

/**
 * Eases the rain and snow toward the weather in two stages, so a change starts and ends gently.
 * @param dt sim seconds
 */
function easeSky(dt: number): void {
  RUN.frontRain = ease(RUN.frontRain, RUN.targetRain, BLEND_EASE, dt);
  RUN.frontSnow = ease(RUN.frontSnow, RUN.targetSnow, BLEND_EASE, dt);
  WEATHER.rain = ease(WEATHER.rain, RUN.frontRain, BLEND_EASE, dt);
  WEATHER.snow = ease(WEATHER.snow, RUN.frontSnow, BLEND_EASE, dt);
}

/**
 * One sim step of the weather: the sky and temperatures ease to the weather, the track soaks or
 * dries, and in SEASON mode the weather may change.
 * @param dt sim seconds
 * @returns the news for the HUD (a change of weather), or null
 */
export function stepWeather(dt: number): { text: string; good: boolean } | null {
  const plan = RUN.plan;
  if (!plan) return null;
  let news = null;
  if (plan.mode === 'season') {
    RUN.nextChangeS -= dt;
    if (RUN.nextChangeS <= 0) news = changeWeather();
  }
  easeSky(dt);
  RUN.sinceSunS += dt;
  if (RUN.sinceSunS >= SUN_EVERY_S) {
    RUN.sinceSunS = 0;
    aimTemps();
  }
  WEATHER.tempC = ease(WEATHER.tempC, RUN.targetAirC, TEMP_EASE, dt);
  WEATHER.trackC = ease(WEATHER.trackC, RUN.targetTrackC, TEMP_EASE, dt);
  const soak = (WEATHER.rain + meltSoak) * SOAK_PER_S;
  const dry = WEATHER.rain > 0.05 || meltSoak > 0 ? 0
    : Math.max(0, WEATHER.trackC) * DRY_PER_S_PER_C;
  setWetness(WEATHER.wetness + (soak - dry) * dt);
  return news;
}

/**
 * A one-line forecast of a season, for the event setup.
 * @param season 0 winter .. 3 autumn
 * @param isSnowy true at a snowy level (its theme biases the odds)
 * @returns the line
 */
export function seasonForecast(season: number, isSnowy = false): string {
  const { chance, airC } = seasonOdds(season, isSnowy);
  const pct = (kinds: WeatherKind[]) =>
    Math.round(100 * kinds.reduce((sum, kind) => sum + chance[kind], 0));
  const parts = [`DRY ${pct(['dry'])}%`, `RAIN ${pct(['rain', 'heavy'])}%`];
  if (chance.snow) parts.push(`SNOW ${pct(['snow'])}%`);
  if (chance.hot || chance.superhot) parts.push(`HOT ${pct(['hot', 'superhot'])}%`);
  return parts.join(' · ') + ` · ${airC[0]}-${airC[1]} °C`;
}
