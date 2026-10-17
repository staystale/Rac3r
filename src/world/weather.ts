// THE WEATHER: how wet the track is and how warm the air is. One small state object read by the
// ground (wet.ts: damp surfaces, the dry line), the tyres (ambient temperature) and the AI (its
// speed plan follows the wetness). No weather (the default) is wetness 0 and 18 C: every reader
// then behaves exactly as before weather existed.
//
// WETNESS is the water on the ground everywhere, 0 (dry) .. 1 (soaked): the surfaces between
// their dry and DAMP grip (surfaces.ts WET_MU, the owner's signed-off table). It is read in
// WET_BANDS steps, so the damp surfaces are a small cached set and the AI re-plans only when the
// wetness moves a whole step. Puddles (standing water) are a separate cover (wear.ts), not this.

/** the steps wetness is read in: 0 = dry .. WET_BANDS = soaked */
export const WET_BANDS = 10;

/** The weather now. */
export interface WeatherState {
  /** water on the ground everywhere, 0 (dry) .. 1 (soaked) */
  wetness: number;
  /** how hard it is raining, 0 .. 1 (re-wets the dry line; the rain look) */
  rain: number;
  /** air temperature, C (the tyres cool toward it) */
  tempC: number;
  /** wetness in steps, 0 .. WET_BANDS */
  band: number;
  /** counts every change of band: readers that cache by wetness compare it */
  epoch: number;
}

export const WEATHER: WeatherState = { wetness: 0, rain: 0, tempC: 18, band: 0, epoch: 0 };

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

/** The wetness as a fraction in whole steps (what the surfaces are built at). */
export function wetStep(): number {
  return WEATHER.band / WET_BANDS;
}
