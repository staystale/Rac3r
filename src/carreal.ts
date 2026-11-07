// carreal.ts - every car's REAL SHAPE at its own size (owner 11-07: "make sure all cars get the
// same attention"; then "the cars need to match the sizes they were ish but in proportional shape
// to size - or it'll change too much"). TRIED: every car at its real size (the F1 5.6 m) - AI F1
// fields crashed twice as often (aifieldsuite d2, 12 races: 56 -> 111, 55 -> 83; the Golf 22 ->
// 35), the tracks being 0.41-0.48 of real. Now ?carreal: each car keeps its length and takes the
// real car's PROPORTIONS - width, wheelbase, the weight split (lf / lr), track - scaled to it
// (realShape). ?f1aero, apart: the single-seaters' real downforce, brakes and wheel weight.
// Cars already within ~3 % are left (Mini, Huracan, 306, Fiesta); the Fastrac, the F2 stock car
// and the autograss special have no sure figures.

/** A real car's size, m: length, width, lf / lr (CG to each axle), track. */
type RealSize = { len: number; wid: number; lf: number; lr: number; trackWidth: number };

// the real cars (EST where the figure varies or is not published)
const REAL_SIZE: Record<string, RealSize> = {
  // Golf GTI Mk7: 4.27 x 1.80, wheelbase 2.63, ~62 % on the front (FWD), track ~1.53
  'hatch-fwd': { len: 4.27, wid: 1.8, lf: 1.0, lr: 1.63, trackWidth: 1.53 },
  // M135i (F20): 4.33 x 1.77, wheelbase 2.69, ~52 % front, track ~1.55
  'hatch-rwd': { len: 4.33, wid: 1.77, lf: 1.29, lr: 1.4, trackWidth: 1.55 },
  // E46 3 Series: 4.47 x 1.74, wheelbase 2.725, 50 / 50, track ~1.48
  'saloon-rwd': { len: 4.47, wid: 1.74, lf: 1.36, lr: 1.365, trackWidth: 1.48 },
  // GD WRX: 4.465 x 1.74, wheelbase 2.525, ~58 % front, track ~1.48
  'wrz-awd': { len: 4.465, wid: 1.74, lf: 1.06, lr: 1.465, trackWidth: 1.48 },
  // V70 R: 4.71 x 1.80, wheelbase 2.755, track ~1.56
  'estate-4x4': { len: 4.71, wid: 1.8, lf: 1.38, lr: 1.375, trackWidth: 1.56 },
  // Chevelle SS 454 (1970 coupe): 5.01 x 1.93, wheelbase 2.845, ~55 % front, track ~1.52
  'muscle-rwd': { len: 5.01, wid: 1.93, lf: 1.28, lr: 1.565, trackWidth: 1.52 },
  // Sport quattro S1 E2: 4.24 x 1.80 (EST), the SHORT wheelbase 2.224, track ~1.5 (EST)
  'rally-4x4': { len: 4.24, wid: 1.8, lf: 1.07, lr: 1.155, trackWidth: 1.5 },
  // F1 2022: 5.6 m, the body ~1.4 wide, wheelbase 3.6, ~45 % front, track ~1.62
  'track-rwd': { len: 5.6, wid: 1.4, lf: 1.98, lr: 1.62, trackWidth: 1.62 },
  // F2 (Dallara 2018): 5.22 m, the body ~1.35 wide, wheelbase 3.135, track ~1.5
  'f2-rwd': { len: 5.22, wid: 1.35, lf: 1.72, lr: 1.415, trackWidth: 1.5 },
  // Next Gen Cup car: 5.1 x 2.0, wheelbase 2.794, track ~1.67 (EST)
  naffcar: { len: 5.1, wid: 2.0, lf: 1.35, lr: 1.444, trackWidth: 1.67 },
  // Micra (K12) R1: 3.72 x 1.66, wheelbase 2.43
  'mikra-r1': { len: 3.72, wid: 1.66, lf: 0.97, lr: 1.46, trackWidth: 1.47 },
  // Silvia S13: 4.52 x 1.69, wheelbase 2.475, track ~1.465
  'drift-s13': { len: 4.52, wid: 1.69, lf: 1.24, lr: 1.235, trackWidth: 1.465 },
};

/**
 * ?carreal: a car's real shape at its own length - width, lf / lr and track scaled by the length.
 * @param carId the car
 * @param len its length in the game, m
 * @returns the spec fields, or none
 */
export function realShape(carId: string, len: number): Partial<RealSize> {
  const real = REAL_SIZE[carId];
  if (!real) return {};
  const scale = len / real.len, round = (value: number) => Math.round(value * scale * 1000) / 1000;
  return { wid: round(real.wid), lf: round(real.lf), lr: round(real.lr),
    trackWidth: round(real.trackWidth) };
}

/**
 * A car's length against its real one (its tyres are drawn to the same scale: render/cars.ts).
 * @param carId the car
 * @param len its length in the game, m
 * @returns the scale (1 for a car with no real figures)
 */
export const realScale = (carId: string, len: number) =>
  (REAL_SIZE[carId] ? len / REAL_SIZE[carId].len : 1);

// ?f1aero: the single-seaters' real aero, brakes and wheels (MEASURED before, _f1grip.mjs: the F1's
// braking 1.8-2.3 g - every car shared the 1.8 g brake limit, a real F1 ~4-5 g at speed; its
// downforce its weight at 200 km/h, real ~1.3-1.5x). F1: ClA 5.6 (EST: 1.35x its weight at 200
// km/h, 3x at 300), 40 / 60; brakes able to use it (~6 g of clamp, EST); 18-inch wheels and tyres
// ~18 / 21 kg (EST) - 27 kg an axle at the tread. F2: ~65 % of that downforce (ClA 3.6), brakes ~5
// g, ~24 kg an axle (EST). MEASURED with the real size: F1 braking 1.7 / 2.4 / 4.3 g at 80 / 200 /
// 300 km/h, cornering 3.2 / 4.2 / 4.9 g at 200 / 250 / 300; no ABS - full pedal locks.
export const F1_AERO: Record<string, Record<string, number>> = {
  'track-rwd': { downforceF: 2.24, downforceR: 3.36, brakeMaxDecel: 6.0, wheelMass: 27 },
  'f2-rwd': { downforceF: 1.44, downforceR: 2.16, brakeMaxDecel: 5.0, wheelMass: 24 },
};
