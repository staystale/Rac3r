// render/lamptypes.ts - EACH VEHICLE'S OWN HEADLIGHTS (the owner 11-21: "each car's lamps
// light only what a real one would, with their own shape and reach"). Where its lamps sit across
// its nose (a share of half its width, by its drawings), how far the beam reaches and how wide it
// spreads, by its kind: a bus's, a lorry's and a van's lamps high and far; a tractor's and the
// Seven's small and short; a car's as the old shared beam. The beam starts AT the nose (its
// lamps), so nothing behind the lamp line - the car's own bonnet - is lit (render/light.ts).

/** A vehicle's headlights: lamps across (share of half its width), reach and half spread (m). */
export interface LampType { across: number; reachM: number; halfM: number }

// a car's: the shared beam's reach and spread (render/light.ts BEAM_REACH_M, BEAM_HALF_M), its
// lamps near the nose's corners
const CAR: LampType = { across: 0.74, reachM: 32, halfM: 9 };
// by kind (cars.ts spec.kind): high mounted and far on the big ones, small and short on the tractor
// and the Seven (by eye from real lamps; the owner's to tune)
const BY_KIND: Record<string, LampType> = {
  bus: { across: 0.78, reachM: 36, halfM: 10 },
  schoolbus: { across: 0.78, reachM: 36, halfM: 10 },
  scanyah: { across: 0.8, reachM: 40, halfM: 11 },
  van: { across: 0.76, reachM: 34, halfM: 10 },
  custom: { across: 0.76, reachM: 34, halfM: 10 },
  tractor: { across: 0.6, reachM: 20, halfM: 8 },
  seven: { across: 0.7, reachM: 26, halfM: 7 },
};

/**
 * A vehicle's headlights.
 * @param kind its spec's kind
 * @returns its lamp type
 */
export const lampTypeOf = (kind: string | undefined): LampType => BY_KIND[kind || ''] || CAR;
