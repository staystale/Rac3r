// tyrecool.ts - T3 TYRE COOLING (owner: tyres cool toward the air too; hot tyres clear
// water and ice faster). A tyre cools toward a mix of the track (its contact patch, always) and the
// air over it, more of the air with speed: AIR_SHARE_MAX of it at AIR_FULL_MPS and up (150 km/h;
// tyreheat.ts). HOT tyres (hotTyreShare: 0 at HOT_FROM_C, 1 at HOT_FULL_C) clear standing water
// in fewer passes (puddles.ts) and break driven ice to water more often (snowwear.ts). No imports:
// the world's modules and the tyre heat both read it.

const AIR_SHARE_MAX = 0.5, AIR_FULL_MPS = 41.7, HOT_FROM_C = 40, HOT_FULL_C = 100;

/**
 * The temperature a tyre cools toward: the track's mix with the air's.
 * @param trackC the track temperature, C
 * @param airC the air temperature, C
 * @param speedMps the car's speed, m/s
 * @returns C
 */
export function coolTowardC(trackC: number, airC: number, speedMps: number): number {
  return trackC + (airC - trackC) * AIR_SHARE_MAX * Math.min(1, speedMps / AIR_FULL_MPS);
}

/**
 * How hot a tyre is for clearing water and ice: 0 at HOT_FROM_C, 1 at HOT_FULL_C.
 * @param tyreC the tyre's temperature, C
 * @returns 0..1
 */
export function hotTyreShare(tyreC: number): number {
  return Math.max(0, Math.min(1, (tyreC - HOT_FROM_C) / (HOT_FULL_C - HOT_FROM_C)));
}
