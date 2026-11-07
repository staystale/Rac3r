// carreal.ts - ?carreal (owner 11-07: "make f1 cars look better more like modern f1 cars realistic
// and make sure they have realistic looking tyres / wheel weight ... also grip, downforce"; "make
// sure all cars get the same attention"): every car's REAL size - length, width, wheelbase, track,
// the weight split (lf / lr from the front share) - and the single-seaters' real aero, brakes and
// wheels, over their roster rows (cars.ts spec). Cars already within ~3 % are left as they are
// (3 Series, WRX, Mini, Huracan, 306, Fiesta, S13); the Fastrac is not checked (no sure figures).
// MEASURED before (tools/scratch/_f1grip.mjs, the F1): 4.4 m long, a 2.9 m wheelbase, 1.85 m track
// (the real 2022 car ~5.6 / 3.6 / 1.6 - the stubby look was the physics box); braking 1.8-2.3 g
// (every car shared the 1.8 g brake limit; a real F1 car ~4-5 g at speed); downforce = its weight
// at 200 km/h (real ~1.3-1.5x). EST = estimated where the real figure is not published.
export const CAR_REAL: Record<string, Record<string, number>> = {
  // Golf GTI Mk7: 4.27 x 1.80 m, wheelbase 2.63, track ~1.53, ~62 % on the front (FWD) - was
  // 4.0 x 1.7, 2.50, the weight 56 % front
  'hatch-fwd': { len: 4.27, wid: 1.8, lf: 1.0, lr: 1.63, trackWidth: 1.53 },
  // M135i (F20): 4.33 x 1.77 m, wheelbase 2.69, track ~1.55, ~52 % front - was 4.0 x 1.7, 2.50
  'hatch-rwd': { len: 4.33, wid: 1.77, lf: 1.29, lr: 1.4, trackWidth: 1.55 },
  // E46 3 Series and GD WRX: the track ~1.48 (the rest within ~2 %)
  'saloon-rwd': { trackWidth: 1.48 }, 'wrz-awd': { trackWidth: 1.48 },
  // V70 R: 4.71 x 1.80 m, wheelbase 2.755, track ~1.56
  'estate-4x4': { lf: 1.38, lr: 1.375, trackWidth: 1.56 },
  // Chevelle SS 454 (1970 coupe): 5.01 x 1.93 m, wheelbase 2.845 (112 in), track ~1.52, ~55 %
  // front (the big-block) - was 4.8 m, 2.60
  'muscle-rwd': { len: 5.01, wid: 1.93, lf: 1.28, lr: 1.565, trackWidth: 1.52 },
  // Sport quattro S1 E2: 4.24 m, the famous SHORT wheelbase 2.224 (was 2.50), track ~1.5 (EST)
  'rally-4x4': { len: 4.24, lf: 1.07, lr: 1.155 },
  // Next Gen Cup car: ~2.0 m wide, track ~1.67 (EST; was 1.85)
  naffcar: { wid: 2.0, trackWidth: 1.67 },
  // Micra (K12) R1: 3.72 x 1.66 m, wheelbase 2.43
  'mikra-r1': { len: 3.72, wid: 1.66, lf: 0.97, lr: 1.46 },
  // Silvia S13: the track ~1.465
  'drift-s13': { trackWidth: 1.465 },
  // F1 2022 rules: 5.6 m, wheelbase 3.6 m (the limit), 2.0 m wide over the tyres (track 1.62 + a
  // 0.4 m tyre), ~45 % of the weight on the front (lf / lr from it); ClA 5.6 (EST: 1.35x its
  // weight at 200 km/h, 3x at 300), 40 / 60; brakes able to use all of it (~6 g of clamp, EST);
  // the 18-inch wheels and tyres ~18 kg front / 21 kg rear (EST) - 27 kg an axle at the tread
  'track-rwd': { len: 5.6, wid: 1.4, trackWidth: 1.62, lf: 1.98, lr: 1.62, tyreWidth: 0.355,
    downforceF: 2.24, downforceR: 3.36, brakeMaxDecel: 6.0, wheelMass: 27 },
  // F2 (Dallara 2018): 5.22 m, wheelbase 3.135 m, 1.9 m wide (track 1.5); ~65 % of the F1's
  // downforce (EST ClA 3.6), brakes ~5 g (EST), wheels ~24 kg an axle at the tread (EST)
  'f2-rwd': { len: 5.22, wid: 1.35, trackWidth: 1.5, lf: 1.72, lr: 1.41, tyreWidth: 0.32,
    downforceF: 1.44, downforceR: 2.16, brakeMaxDecel: 5.0, wheelMass: 24 },
};
