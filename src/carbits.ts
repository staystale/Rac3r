// carbits.ts - ?bigparts (owner 11-07: "can worse crashes have a chance to emit more parts like
// exhaust and engine blocks ... they should all be accurate to the vehicle"; "how about things like
// wishbones and suspension struts too? ... size / their sharpness ... how likely they are to cause
// punctures"): each car's own BITS - its exhaust, the panel at each end, where its engine sits and
// what it is - so what a bad crash throws out is that car's. world/debris.ts throws them,
// render/carparts.ts draws them.

/** What a car has to lose. */
export interface CarBits {
  // the exhaust: how many tailpipes and where (sides = one each side, left = all on the left,
  // centre / quad = in the middle, stack = a vertical stack - the tractor)
  pipes: number; pipesAt: 'sides' | 'left' | 'right' | 'centre' | 'stack';
  front: 'bonnet' | 'none';   // the panel over the front
  rear: 'boot' | 'spoiler' | 'none';   // the boot lid / tailgate, or a wing on it
  engine: 'front' | 'mid';   // where the engine sits
  cyl: number; layout: 'inline' | 'v' | 'flat';   // what it is
}

export const CAR_BITS: Record<string, CarBits> = {
  // Golf GTI Mk7: one tailpipe each side, the tailgate, the transverse 2.0 four
  'hatch-fwd': { pipes: 2, pipesAt: 'sides', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 4, layout: 'inline' },
  // M135i: twin pipes on the left, the tailgate, the straight six
  'hatch-rwd': { pipes: 2, pipesAt: 'left', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 6, layout: 'inline' },
  // E46 330i: twin on the left, the boot lid, the straight six
  'saloon-rwd': { pipes: 2, pipesAt: 'left', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 6, layout: 'inline' },
  // GD WRX: one fat pipe, the boot WING, the flat four
  'wrz-awd': { pipes: 1, pipesAt: 'right', front: 'bonnet', rear: 'spoiler', engine: 'front',
    cyl: 4, layout: 'flat' },
  // V70 R: one each side, the tailgate, the five
  'estate-4x4': { pipes: 2, pipesAt: 'sides', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 5, layout: 'inline' },
  // Chevelle SS 454: dual exhaust, the boot lid, the big-block V8
  'muscle-rwd': { pipes: 2, pipesAt: 'sides', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 8, layout: 'v' },
  // Sport quattro S1 E2: one pipe, the rear WING, the five
  'rally-4x4': { pipes: 1, pipesAt: 'right', front: 'bonnet', rear: 'spoiler', engine: 'front',
    cyl: 5, layout: 'inline' },
  // F1 2022: the one central pipe, no bonnet (its wings come off as parts), the V6 behind the
  // driver
  'track-rwd': { pipes: 1, pipesAt: 'centre', front: 'none', rear: 'none', engine: 'mid',
    cyl: 6, layout: 'v' },
  'f2-rwd': { pipes: 1, pipesAt: 'centre', front: 'none', rear: 'none', engine: 'mid', cyl: 6,
    layout: 'v' },
  // Next Gen: side pipes on the right, the spoiler, the V8
  naffcar: { pipes: 2, pipesAt: 'right', front: 'bonnet', rear: 'spoiler', engine: 'front',
    cyl: 8, layout: 'v' },
  // Fastrac: the vertical stack, the bonnet, the straight six
  tractor: { pipes: 1, pipesAt: 'stack', front: 'bonnet', rear: 'none', engine: 'front', cyl: 6,
    layout: 'inline' },
  // Mini Cooper S: one pipe, the boot lid, the A-series four
  'mini-fwd': { pipes: 1, pipesAt: 'right', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 4, layout: 'inline' },
  // Huracan: four in the middle, the front lid, the V10 behind the seats
  'lambo-awd': { pipes: 4, pipesAt: 'centre', front: 'bonnet', rear: 'none', engine: 'mid',
    cyl: 10, layout: 'v' },
  // Micra R1: one pipe, the tailgate, the three
  'mikra-r1': { pipes: 1, pipesAt: 'right', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 3, layout: 'inline' },
  // 306 Maxi: one pipe, the tailgate, the four
  'kit-2l': { pipes: 1, pipesAt: 'right', front: 'bonnet', rear: 'boot', engine: 'front', cyl: 4,
    layout: 'inline' },
  // Fiesta RX: one pipe, the big WING, the four
  'rx-super': { pipes: 1, pipesAt: 'right', front: 'bonnet', rear: 'spoiler', engine: 'front',
    cyl: 4, layout: 'inline' },
  // BriSCA F2: one pipe, the boot lid, a four
  'banger-f2': { pipes: 1, pipesAt: 'right', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 4, layout: 'inline' },
  // the autograss buggy: one pipe, no panels, the four behind the driver
  'grass-special': { pipes: 1, pipesAt: 'right', front: 'none', rear: 'none', engine: 'mid',
    cyl: 4, layout: 'inline' },
  // Silvia S13: one pipe, the DUCKTAIL on the boot, the SR20 four
  'drift-s13': { pipes: 1, pipesAt: 'right', front: 'bonnet', rear: 'spoiler', engine: 'front',
    cyl: 4, layout: 'inline' },
};

/**
 * A car's bits (any car not listed: a front-engined four with a bonnet and a boot).
 * @param carId the car (an AI's "id#n" too)
 * @returns its bits
 */
export function bitsOf(carId: string): CarBits {
  return CAR_BITS[String(carId).split('#')[0]] || CAR_BITS['hatch-fwd'];
}
