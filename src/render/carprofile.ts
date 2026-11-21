// render/carprofile.ts - each car's REAL SIDE PROFILE (owner 11-08, on the roll mockup: "we need
// angled windscreens and accurate side and under profiles for each car - coz the f1 car for
// example doesn't look right nor does the estate"). The rolled car's side and underside were one
// generic box for every car (render/cardamage.ts sideSprite: the same height, a flat roof, square
// windows). Here every car has its roof line from tail to nose (the windscreen and rear screen at
// their angle), its side glass, its waist; an open car its tub and wings. paintSideProfile and
// paintUnderProfile paint them in the car's colours at its drawn length; heightsPx gives the body's
// height along its length for the rolled body (render/rollbody.ts).
import { SPRITE_PPM } from "./shared.ts";
import { shade } from "../render.ts";   // hoisted, only called at draw time (no cycle)
import { tyreBox } from "./cars.ts";
import type { RenderCarSpec } from "./types.ts";
import { ROD_STUB_SHARE, SUBFRAME, SUBFRAME_HALF_M, SUBFRAME_PX } from "./carcorners.ts";
import { SNAP_SHARE, SNAP_SHARE_NO_WISHBONE, SUBFRAME_M, SUSP_ROD, SUSP_SHAFT, SUSP_STRUT,
  SUSP_WISHBONE } from "../world/debris.ts";

/** A wing of an open car: from / to share of the length (tail 0, nose 1), low / high m, span. */
type Wing = [number, number, number, number, number];
/** A side window: from / to share of the length (tail 0, nose 1), its sill and head, m up (the
 * roof line clips it: a windscreen's edge under its rake). */
type SideWindow = [number, number, number, number];
/** A car's side profile: its real length; its roof line, tail to nose, [share of length, m up];
 * the side glass from / to share and the waist (m) under it; an open car's tub share of the width
 * and wings. */
export interface CarProfile {
  len: number; roof: [number, number][]; glass?: [number, number]; waist?: number;
  open?: { tub: number; wings: Wing[] };
  // a lorry's, van's or bus's own side windows in place of the glass band (its glass
  // is not one band from the waist to the roof: a high cab's door window, a row of bays)
  windows?: SideWindow[];
}

/**
 * A row of equal window bays between their pillars (a bus's side), its own measures.
 * @param from the row's tail end, share of the length
 * @param upto its nose end, share
 * @param count the bays
 * @param pillar a pillar's width, share of the length
 * @param sill the sill, m up
 * @param head the head, m up
 * @returns the bays
 */
function windowBays(from: number, upto: number, count: number, pillar: number, sill: number,
  head: number): SideWindow[] {
  const bay = (upto - from + pillar) / count;
  return Array.from({ length: count }, (unused, idx): SideWindow =>
    [from + idx * bay, from + (idx + 1) * bay - pillar, sill, head]);
}

// the roof lines from photographs of the real cars, tail (0) to nose (1), m up
export const PROFILES: Record<string, CarProfile> = {
  'hatch-fwd': { len: 4.27, waist: 0.98, glass: [0.1, 0.63], roof: [[0, 0.55], [0.02, 0.95],
    [0.08, 1.38], [0.15, 1.44], [0.5, 1.44], [0.66, 0.98], [0.95, 0.85], [1, 0.55]] },
  'hatch-rwd': { len: 4.33, waist: 0.97, glass: [0.1, 0.6], roof: [[0, 0.55], [0.02, 0.95],
    [0.09, 1.36], [0.16, 1.42], [0.47, 1.42], [0.62, 0.97], [0.95, 0.84], [1, 0.55]] },
  'saloon-rwd': { len: 4.47, waist: 0.97, glass: [0.28, 0.65], roof: [[0, 0.6], [0.03, 0.95],
    [0.18, 1.0], [0.3, 1.38], [0.54, 1.43], [0.67, 0.97], [0.96, 0.85], [1, 0.55]] },
  'wrz-awd': { len: 4.47, waist: 1.0, glass: [0.28, 0.64], roof: [[0, 0.6], [0.02, 1.16],
    [0.09, 1.16], [0.11, 1.0], [0.19, 1.02], [0.3, 1.42], [0.53, 1.47], [0.66, 1.0],
    [0.96, 0.86], [1, 0.55]] },
  // A4 Avant: the long roof to the near upright tailgate, the raked screen (EST from photos)
  'ordi-a4': { len: 4.703, waist: 0.98, glass: [0.03, 0.69], roof: [[0, 0.6], [0.01, 1.0],
    [0.04, 1.36], [0.1, 1.42], [0.56, 1.44], [0.69, 0.97], [0.96, 0.8], [1, 0.52]] },
  'estate-4x4': { len: 4.71, waist: 1.02, glass: [0.04, 0.7], roof: [[0, 0.6], [0.01, 1.0],
    [0.04, 1.5], [0.6, 1.55], [0.72, 1.02], [0.96, 0.88], [1, 0.58]] },
  'muscle-rwd': { len: 5.01, waist: 0.98, glass: [0.32, 0.6], roof: [[0, 0.65], [0.02, 0.95],
    [0.17, 1.0], [0.33, 1.34], [0.51, 1.35], [0.62, 0.98], [0.97, 0.92], [1, 0.65]] },
  'rally-4x4': { len: 4.24, waist: 1.0, glass: [0.2, 0.62], roof: [[0, 0.7], [0.02, 1.15],
    [0.12, 1.15], [0.14, 1.0], [0.2, 1.33], [0.54, 1.34], [0.65, 1.0], [0.95, 0.85],
    [1, 0.55]] },
  'track-rwd': { len: 5.6, roof: [[0, 0.42], [0.07, 0.42], [0.09, 0.45], [0.4, 0.86],
    [0.46, 0.95], [0.52, 0.62], [0.62, 0.55], [0.78, 0.42], [0.95, 0.25], [1, 0.18]],
  open: { tub: 0.36, wings: [[0, 0.07, 0.42, 0.95, 0.75], [0.94, 1, 0.08, 0.2, 1]] } },
  'f2-rwd': { len: 5.22, roof: [[0, 0.42], [0.07, 0.42], [0.09, 0.45], [0.4, 0.84],
    [0.46, 0.92], [0.52, 0.6], [0.62, 0.54], [0.78, 0.42], [0.95, 0.25], [1, 0.18]],
  open: { tub: 0.38, wings: [[0, 0.07, 0.42, 0.92, 0.72], [0.94, 1, 0.08, 0.2, 1]] } },
  naffcar: { len: 5.1, waist: 0.95, glass: [0.3, 0.62], roof: [[0, 0.72], [0.02, 1.0],
    [0.14, 1.0], [0.3, 1.3], [0.55, 1.3], [0.66, 0.95], [0.97, 0.8], [1, 0.5]] },
  // the cab's tall glass: the rear quarter, the B-pillar, the door
  tractor: { len: 5.1,
    windows: [[0.335, 0.43, 1.45, 2.75], [0.445, 0.59, 1.35, 2.75]],
    waist: 1.6, glass: [0.33, 0.6], roof: [[0, 1.2], [0.3, 1.2],
    [0.32, 2.9], [0.6, 2.9], [0.62, 1.5], [1, 1.4]] },
  'mini-fwd': { len: 3.85, waist: 1.0, glass: [0.06, 0.66], roof: [[0, 0.6], [0.01, 1.05],
    [0.06, 1.41], [0.55, 1.41], [0.68, 1.0], [0.95, 0.88], [1, 0.6]] },
  'lambo-awd': { len: 4.46, waist: 0.82, glass: [0.38, 0.7], roof: [[0, 0.72], [0.08, 0.95],
    [0.3, 1.12], [0.45, 1.17], [0.6, 1.1], [0.72, 0.85], [1, 0.5]] },
  'mikra-r1': { len: 3.72, waist: 1.0, glass: [0.1, 0.65], roof: [[0, 0.6], [0.02, 1.1],
    [0.1, 1.42], [0.5, 1.45], [0.66, 1.0], [0.93, 0.85], [1, 0.6]] },
  'kit-2l': { len: 4.0, waist: 0.95, glass: [0.08, 0.64], roof: [[0, 0.6], [0.02, 1.0],
    [0.08, 1.32], [0.5, 1.35], [0.66, 0.95], [0.95, 0.8], [1, 0.5]] },
  'rx-super': { len: 4.1, waist: 0.98, glass: [0.1, 0.64], roof: [[0, 0.65], [0.02, 1.42],
    [0.1, 1.42], [0.5, 1.4], [0.66, 0.98], [0.95, 0.85], [1, 0.5]] },
  'banger-f2': { len: 4.3, roof: [[0, 0.8], [0.15, 1.0], [0.3, 1.3], [0.55, 1.3],
    [0.65, 0.9], [1, 0.7]], open: { tub: 0.6, wings: [[0.25, 0.6, 1.3, 1.4, 0.9]] } },
  'grass-special': { len: 3.6, roof: [[0, 0.9], [0.2, 1.3], [0.6, 1.3], [0.7, 0.8],
    [1, 0.5]], open: { tub: 0.5, wings: [] } },
  'drift-s13': { len: 4.52, waist: 0.95, glass: [0.3, 0.64], roof: [[0, 0.6], [0.03, 0.95],
    [0.18, 1.0], [0.3, 1.28], [0.55, 1.29], [0.66, 0.95], [0.97, 0.8], [1, 0.55]] },
  // M4 GT3: the long bonnet, the coupe's roof, the short boot, the wing on its swan necks over it
  // (height EST)
  'bmv-m4gt3': { len: 5.02, waist: 0.82, glass: [0.24, 0.62], roof: [[0, 0.62], [0.01, 1.22],
    [0.07, 1.24], [0.09, 0.9], [0.18, 0.95], [0.3, 1.25], [0.52, 1.3], [0.64, 0.86],
    [0.96, 0.7], [1, 0.42]] },
  // 911 GT3 R: the wing on its swan necks over the tail, the fastback, the low nose (height EST)
  'porch-gt3r': { len: 4.62, waist: 0.8, glass: [0.34, 0.6], roof: [[0, 0.7], [0.01, 1.26],
    [0.08, 1.28], [0.1, 0.92], [0.2, 0.98], [0.38, 1.22], [0.54, 1.25], [0.66, 0.86],
    [0.94, 0.68], [1, 0.42]] },
  // Seven: the low tub, the roll bar behind the seats, the little screen, the long bonnet
  'seven-420r': { len: 3.1, waist: 0.8, glass: [0.48, 0.52], roof: [[0, 0.62], [0.03, 0.78],
    [0.22, 0.8], [0.25, 1.08], [0.29, 1.08], [0.31, 0.82], [0.48, 0.84], [0.5, 1.02],
    [0.53, 0.86], [0.86, 0.74], [1, 0.52]] },
  // Transit H2: the tall box to the cab, the raked screen, the short bonnet (EST from photos)
  // the cab door's window (the van's box has none), the screen's edge
  'transfit-van': { len: 5.53,
    windows: [[0.62, 0.755, 1.3, 2.08], [0.765, 0.83, 1.3, 2.4]],
    waist: 1.25, glass: [0.71, 0.8], roof: [[0, 0.62], [0.01, 2.38],
    [0.03, 2.47], [0.72, 2.47], [0.75, 2.32], [0.83, 1.4], [0.97, 1.2], [1, 0.72]] },
  // Transit Custom L1 H1: the 2.0 m box, the steep raked screen, the short sloping bonnet (EST)
  // the lower cab's door window, the screen's edge
  'transfit-custom': { len: 4.97,
    windows: [[0.57, 0.725, 1.15, 1.78], [0.735, 0.8, 1.15, 1.9]],
    waist: 1.15, glass: [0.7, 0.79], roof: [[0, 0.6], [0.01, 1.92],
    [0.03, 2.0], [0.69, 2.0], [0.72, 1.86], [0.8, 1.22], [0.97, 1.05], [1, 0.66]] },
  // Transit Mk7 SWB low roof: the box to ~2.0 m, the steeper screen, the short bonnet (EST)
  // the Mk7 cab's door window, the screen's edge
  'transfit-swb': { len: 4.86,
    windows: [[0.58, 0.735, 1.2, 1.8], [0.745, 0.81, 1.2, 1.92]],
    waist: 1.2, glass: [0.69, 0.79], roof: [[0, 0.6], [0.01, 1.92],
    [0.03, 2.0], [0.7, 2.0], [0.73, 1.88], [0.81, 1.3], [0.97, 1.12], [1, 0.7]] },
  // Transit L3 H3: the long, high box (2.65 m) to the same cab (EST from photos)
  // the same cab's door window and screen edge on the long box
  'transfit-lwb': { len: 5.98,
    windows: [[0.66, 0.775, 1.3, 2.08], [0.785, 0.84, 1.3, 2.4]],
    waist: 1.25, glass: [0.73, 0.82], roof: [[0, 0.62], [0.01, 2.55],
    [0.03, 2.65], [0.74, 2.65], [0.77, 2.32], [0.84, 1.4], [0.97, 1.2], [1, 0.72]] },
  // trophy truck: the bed with its spares, the cab and roof scoop, the long bonnet, all high
  // on its long-travel wheels (EST from photos)
  // the door window in the cab, the windscreen's edge
  'effing-tt': { len: 5.6,
    windows: [[0.42, 0.575, 1.62, 1.98], [0.59, 0.66, 1.6, 2.1]],
    waist: 1.55, glass: [0.38, 0.58], roof: [[0, 1.0], [0.02, 1.4],
    [0.3, 1.42], [0.34, 1.55], [0.38, 2.05], [0.58, 2.1], [0.66, 1.6], [0.95, 1.42],
    [1, 1.05]] },
  // E36 Peak: the big wing on its necks over the boot, the coupe's roof, the long bonnet (EST)
  'bmv-e36peak': { len: 4.433, waist: 0.82, glass: [0.2, 0.62], roof: [[0, 0.6], [0.01, 1.3],
    [0.07, 1.32], [0.09, 0.88], [0.18, 0.92], [0.28, 1.28], [0.5, 1.3], [0.62, 0.86],
    [0.96, 0.66], [1, 0.38]] },
  // Corolla BTCC: the wing over the hatch, the short steep hatch, the low roof (EST from photos)
  'toyoter-corolla': { len: 4.37, waist: 0.88, glass: [0.1, 0.63], roof: [[0, 0.55], [0.02, 1.05],
    [0.08, 1.12], [0.14, 1.28], [0.24, 1.36], [0.53, 1.36], [0.64, 0.92], [0.95, 0.76],
    [1, 0.45]] },
  // Civic Type R BTCC (FK8): the wing over the tailgate, the long sloping hatch, the low roof, the
  // raked screen and the long bonnet to the splitter (EST from photos)
  'civvic-btcc': { len: 4.557, waist: 0.9, glass: [0.12, 0.62], roof: [[0, 0.55], [0.02, 1.05],
    [0.08, 1.12], [0.24, 1.3], [0.32, 1.36], [0.52, 1.36], [0.65, 0.95], [0.95, 0.78],
    [1, 0.45]] },
  // Defender 110: the spare on the rear door, the flat roof, the near upright screen, the flat
  // bonnet and wings, the bumper (EST from photos)
  'defunder-110': { len: 4.785, waist: 1.3, glass: [0.1, 0.66], roof: [[0, 0.45], [0.005, 0.85],
    [0.035, 0.85], [0.04, 1.94], [0.07, 1.98], [0.66, 1.98], [0.69, 1.3], [0.97, 1.25],
    [1, 0.6]] },
  // Focus Mk4 hatch: the spoiler over the sloping tailgate, the roof, the raked screen, the long
  // bonnet (EST from photos)
  'focust-st': { len: 4.388, waist: 0.98, glass: [0.1, 0.64], roof: [[0, 0.55], [0.02, 0.98],
    [0.09, 1.4], [0.16, 1.46], [0.52, 1.46], [0.66, 0.98], [0.95, 0.82], [1, 0.5]] },
  // Clio Cup V: the wing over the tailgate, the short hatch, the low round roof, the raked
  // screen, the short bonnet to the splitter (EST from photos)
  'cleo-cup': { len: 3.986, waist: 0.9, glass: [0.1, 0.63], roof: [[0, 0.5], [0.02, 0.98],
    [0.08, 1.32], [0.15, 1.41], [0.5, 1.42], [0.64, 0.96], [0.95, 0.76], [1, 0.43]] },
  // Clio III 3-door: the short hatch, the round roof, the raked screen, the short bonnet (EST
  // from photos)
  // Routemaster: the two decks to 4.38 m, the domed roof, the half-cab and bonnet at the front
  // (EST from photos)
  // school bus: the dog nose's low bonnet, the tall square body (~3.1 m), its windows (EST)
  // Scanyah tractor: the tall cab (~3.6 m with the spoiler) at the front, the chassis low behind
  // the door window high on the cab, the windscreen's edge under its rake
  'scanyah-r450': { len: 6.0,
    windows: [[0.8, 0.955, 2.05, 2.9], [0.975, 0.995, 1.95, 3.05]],
    waist: 1.2, glass: [0.94, 0.99], roof: [[0, 0.9], [0.6, 1.15],
    [0.61, 3.6], [0.97, 3.6], [0.99, 2.6], [1, 1.0]] },
  // ten passenger bays, the driver's window, the windscreen's edge
  'skool-bus': { len: 10.9,
    windows: [...windowBays(0.06, 0.78, 10, 0.011, 1.75, 2.55), [0.8, 0.855, 1.75, 2.6],
      [0.862, 0.882, 1.7, 3.0]],
    waist: 1.75, glass: [0.03, 0.86], roof: [[0, 0.55], [0.005, 3.0],
    [0.86, 3.05], [0.875, 2.3], [0.885, 1.85], [0.99, 1.6], [1, 0.8]] },
  // the upper deck's six bays, the lower deck's five, the half-cab's window
  routemonster: { len: 8.38,
    windows: [...windowBays(0.05, 0.93, 6, 0.014, 2.95, 3.75),
      ...windowBays(0.14, 0.78, 5, 0.016, 1.35, 2.15), [0.86, 0.94, 1.6, 2.4]],
    waist: 2.3, glass: [0.05, 0.92], roof: [[0, 0.5], [0.01, 4.1],
    [0.04, 4.38], [0.95, 4.38], [0.99, 4.1], [1, 1.2]] },
  // Range Rover L322: the flat roof to 1.86 m, the short tailgate, the near upright screen, the
  // long flat bonnet (EST from photos)
  'strange-l322': { len: 4.95, waist: 1.2, glass: [0.06, 0.66], roof: [[0, 0.6], [0.02, 1.1],
    [0.04, 1.78], [0.08, 1.86], [0.62, 1.86], [0.68, 1.25], [0.97, 1.1], [1, 0.6]] },
  // Model 3: the low nose, the long glass roof sweeping down to the short boot (EST from photos)
  'tesla-m3': { len: 4.694, waist: 0.95, glass: [0.2, 0.66], roof: [[0, 0.62], [0.03, 0.98],
    [0.14, 1.04], [0.28, 1.36], [0.5, 1.44], [0.66, 0.96], [0.96, 0.74], [1, 0.5]] },
  // Saxo VTR: the short round hatch (EST from photos)
  // Ibiza Mk4: the short steep tailgate, the long roof, the raked screen (EST from photos)
  'seat-ibiza': { len: 4.052, waist: 0.95, glass: [0.06, 0.66], roof: [[0, 0.58], [0.02, 0.98],
    [0.06, 1.32], [0.12, 1.42], [0.54, 1.44], [0.66, 0.96], [0.95, 0.76], [1, 0.48]] },
  'saxo-vtr': { len: 3.718, waist: 0.92, glass: [0.1, 0.64], roof: [[0, 0.55], [0.02, 0.95],
    [0.08, 1.3], [0.15, 1.36], [0.5, 1.37], [0.65, 0.92], [0.95, 0.75], [1, 0.45]] },
  // Saxo: the short round hatch on its arches (EST from photos)
  'saxo-kit': { len: 3.717, waist: 0.92, glass: [0.1, 0.64], roof: [[0, 0.55], [0.02, 0.95],
    [0.08, 1.28], [0.15, 1.34], [0.5, 1.35], [0.65, 0.92], [0.95, 0.75], [1, 0.45]] },
  'cleo-rs200': { len: 4.017, waist: 0.95, glass: [0.1, 0.63], roof: [[0, 0.5], [0.02, 1.0],
    [0.08, 1.36], [0.15, 1.46], [0.5, 1.47], [0.64, 0.98], [0.95, 0.78], [1, 0.45]] },
  // R13: the wing on its pylon, the fin along the engine cover, the canopy, the raised nose (EST
  // from photos)
  'rebelion-r13': { len: 4.645, waist: 0.7, glass: [0.46, 0.68], roof: [[0, 0.95], [0.06, 0.95],
    [0.08, 0.78], [0.4, 0.9], [0.48, 1.03], [0.6, 1.05], [0.68, 0.84], [0.92, 0.6], [1, 0.38]] },
  // TS010: the wing at the tail, the long low engine cover, the canopy bubble, the low nose (EST
  // from photos)
  ts010: { len: 4.8, waist: 0.72, glass: [0.42, 0.64], roof: [[0, 0.95], [0.06, 0.95],
    [0.08, 0.72], [0.36, 0.8], [0.44, 1.0], [0.56, 1.03], [0.64, 0.82], [0.9, 0.55],
    [1, 0.32]] },
};

/**
 * A car's profile (the hatch's for a car without one).
 * @param spec the car as drawn
 * @returns its profile
 */
export const profileOf = (spec: RenderCarSpec): CarProfile =>
  PROFILES[String(spec.id).split('#')[0]] || PROFILES['hatch-fwd'];

/**
 * px per real metre for a car: its drawn length over its real one.
 * @param spec the car as drawn
 * @returns px a m
 */
const pxPerM = (spec: RenderCarSpec) => (spec.len * SPRITE_PPM) / profileOf(spec).len;

/**
 * The height of a profile's roof line at a share of its length, m.
 * @param roof the roof line
 * @param share 0 tail .. 1 nose
 * @returns m up
 */
function roofAt(roof: [number, number][], share: number): number {
  for (let i = 1; i < roof.length; i++) if (share <= roof[i][0]) {
    const [from, low] = roof[i - 1], [upto, high] = roof[i];
    return low + (high - low) * (share - from) / Math.max(1e-6, upto - from);
  }
  return roof[roof.length - 1][1];
}

/**
 * The body's height along its length, px, a column each (tail at 0, as the sprites).
 * @param spec the car as drawn
 * @returns the heights
 */
export function heightsPx(spec: RenderCarSpec): Float32Array {
  const profile = profileOf(spec), lengthPx = Math.round(spec.len * SPRITE_PPM),
    scale = pxPerM(spec), out = new Float32Array(lengthPx);
  for (let x = 0; x < lengthPx; x++) out[x] = roofAt(profile.roof, (x + 0.5) / lengthPx) * scale;
  return out;
}

/** A side or underside picture: its pixels (the sprites' 2 px margin), length and height px. */
export interface ProfilePicture { img: ImageData; Lp: number; Hp: number }
/** Colours from the car's own top sprite for a side picture, per column (0xRRGGBB, -1 none): the
 * top edge (the middle of the top sprite - a trim roof, a stripe, the glass) and the waist (its
 * outermost row on that side - a pinstripe, a mirror cap, an arch). */
export interface SideAccents { top: Int32Array; waist: Int32Array }

/**
 * A colour as 0xRRGGBB: '#rgb', '#rrggbb' or 'rgb(r,g,b)' (render.ts shade).
 * @param col the colour
 * @returns the packed colour
 */
function packed(col: string): number {
  if (col.startsWith('rgb')) {
    const [red, green, blue] = col.slice(col.indexOf('(') + 1, -1).split(',').map(Number);
    return (red << 16) | (green << 8) | blue;
  }
  const hex = col.length === 4 ? col.slice(1).split('').map((digit) => digit + digit).join('')
    : col.slice(1, 7);
  return parseInt(hex, 16);
}

/**
 * A fresh picture's pixels and a rect painter on its 2 px margin (pixels, not a canvas: nothing
 * to read back from the GPU).
 * @param width px
 * @param height px
 * @returns the pixels and the painter (a colour as CSS or 0xRRGGBB)
 */
function pictureOf(width: number, height: number) {
  const img = new ImageData(Math.max(1, width + 4), Math.max(1, height + 4)), data = img.data;
  const rect = (x: number, y: number, wide: number, tall: number, col: string | number) => {
    const rgb = typeof col === 'number' ? col : packed(col),
      left = Math.max(0, 2 + Math.round(x)), top = Math.max(0, 2 + Math.round(y)),
      right = Math.min(img.width, left + Math.round(wide) + Math.min(0, 2 + Math.round(x))),
      bottom = Math.min(img.height, top + Math.round(tall) + Math.min(0, 2 + Math.round(y)));
    for (let row = top; row < bottom; row++) for (let across = left; across < right; across++) {
      const idx = (row * img.width + across) * 4;
      data[idx] = rgb >> 16; data[idx + 1] = (rgb >> 8) & 255; data[idx + 2] = rgb & 255;
      data[idx + 3] = 255;
    }
  };
  return { img, rect };
}

/**
 * The car seen from its side (tail left, nose right): its roof line with the glass at its angle,
 * paint, wheels at their real size and place, lamps; an open car its tub, wings and wheels. Its
 * top edge and waist carry the colours of the car's own top sprite on that side (accents), so a
 * livery's trim, third colour and details read on its side too.
 * @param spec the car as drawn
 * @param accents the top sprite's colours along that side, or none
 * @returns the picture
 */
export function paintSideProfile(spec: RenderCarSpec, accents?: SideAccents): ProfilePicture {
  const profile = profileOf(spec), tops = heightsPx(spec), lengthPx = tops.length,
    scale = pxPerM(spec), heightPx = Math.ceil(Math.max(...tops)) + 1,
    { img, rect } = pictureOf(lengthPx, heightPx);
  const paint = spec.paint || '#d0552f', outline = shade(paint, 0.4), glass = '#15171d',
    clearance = Math.max(1, (spec.rideH ?? 0.13) * scale);
  const waist = (profile.waist ?? 0) * scale, { glassAt, windows } = glassOf(profile, waist);
  // the glass under the roof line (the windscreen and rear screen at the roof line's angle)
  const body = profile.open ? shade(paint, 0.85) : paint;
  for (let x = 0; x < lengthPx; x++) {
    const top = heightPx - tops[x];
    rect(x, top, 1, heightPx - clearance - top, body);
    if (glassAt(x / lengthPx, tops[x])) rect(x, top + 1, 1, heightPx - waist - top - 1, glass);
    windowColumn(rect, windows, { x, lengthPx, top, heightPx, scale }, glass);
    rect(x, top, 1, 1, outline);
    if (accents) accentColumn(rect, accents, x, [top, waist > 0 && tops[x] > waist + 1
      ? heightPx - waist : -1]);
  }
  for (const [from, upto, low, high] of profile.open?.wings ?? [])
    rect(from * lengthPx, heightPx - high * scale, (upto - from) * lengthPx, (high - low) * scale,
      shade(paint, 0.6));
  rect(lengthPx - 2, heightPx - waist - 3, 2, 2, '#fff3c4');
  rect(0, heightPx - waist - 3, 2, 2, '#c8342a');
  sideWheels(spec, rect, lengthPx, heightPx);
  return { img, Lp: lengthPx, Hp: heightPx };
}

/**
 * The glass band's test (a car's side glass from its waist to the roof line), or none.
 * @param band the band's from / to share, or null (open, or its own windows)
 * @param waist the waist, px
 * @returns whether a column at a share with its roof that high, px, is glass
 */
const bandGlass = (band: number[] | null, waist: number) => (share: number, high: number) =>
  !!band && share > band[0] && share < band[1] && high > waist + 2;

/**
 * A side picture's glass: its own windows (a lorry's, van's or bus's), else the band.
 * @param profile the car's profile
 * @param waist the waist, px
 * @returns the band's test (never with its own windows) and the windows, if any
 */
function glassOf(profile: CarProfile, waist: number) {
  const windows = profile.windows;
  return { windows, glassAt: bandGlass(windows || profile.open ? null : profile.glass ?? [1, 0],
    waist) };
}

/**
 * A side picture column's own windows (each from its sill to its head, under the
 * roof line).
 * @param rect the picture's painter
 * @param windows the vehicle's windows (none: nothing)
 * @param column the column: x, the picture's length and height, the roof's row, px a m
 * @param column.x the column
 * @param column.lengthPx the picture's length, px
 * @param column.top the roof line's row
 * @param column.heightPx the picture's height, px
 * @param column.scale px a m
 * @param glass the glass colour
 */
function windowColumn(rect: (x: number, y: number, wide: number, tall: number,
  col: string | number) => void, windows: SideWindow[] | undefined,
  column: { x: number; lengthPx: number; top: number; heightPx: number; scale: number },
  glass: string) {
  const share = (column.x + 0.5) / column.lengthPx;
  for (const [from, upto, sill, head] of windows ?? []) {
    if (share < from || share > upto) continue;
    const high = Math.max(column.top + 1, column.heightPx - head * column.scale);
    const low = column.heightPx - sill * column.scale;
    if (low > high) rect(column.x, high, 1, low - high, glass);
  }
}

/**
 * A side picture column's accents: the top sprite's colours on its top edge and its waist.
 * @param rect the picture's painter
 * @param accents the colours
 * @param x the column
 * @param rows the top edge's row and the waist's (-1 none)
 */
function accentColumn(rect: (x: number, y: number, wide: number, tall: number,
  col: string | number) => void, accents: SideAccents, x: number, rows: number[]) {
  const [top, waist] = rows;
  if (accents.top[x] >= 0) rect(x, top + 1, 1, 1, accents.top[x]);
  if (accents.waist[x] >= 0 && waist >= 0) rect(x, waist, 1, 1, accents.waist[x]);
}

/**
 * The wheels on a side picture: tyres at their real size, the rim in them, at the axles.
 * @param spec the car as drawn
 * @param rect the picture's painter
 * @param lengthPx the car's length, px
 * @param heightPx the picture's height, px
 */
function sideWheels(spec: RenderCarSpec, rect: (x: number, y: number, wide: number, tall: number,
  col: string | number) => void, lengthPx: number, heightPx: number) {
  for (const [axle, rear] of [[spec.lf, false], [-spec.lr, true]] as [number, boolean][]) {
    const dia = tyreBox(spec, rear).len, mid = lengthPx / 2 + axle * SPRITE_PPM;
    // round: each column the circle's chord, the rim a smaller circle in it
    for (let x = Math.floor(mid - dia / 2); x <= mid + dia / 2; x++) {
      const along = x + 0.5 - mid, tyre = Math.sqrt(Math.max(0, (dia / 2) ** 2 - along ** 2)),
        rim = Math.sqrt(Math.max(0, (dia * 0.3) ** 2 - along ** 2));
      rect(x, heightPx - dia / 2 - tyre, 1, tyre * 2, '#16171c');
      rect(x, heightPx - dia / 2 - rim, 1, rim * 2, spec.rim || '#6d707a');
    }
  }
}

// the arms seen from below: light steel (on the dark floor), each line 1 px; a strut gone leaves
// its tower's hole in the floor
const UNDER_ARM = '#8a8f98', STRUT_HOLE = '#0e0f12';

/** A car's corners as the underside reads them: its wheels gone, what each took (SUSP_* bits). */
export interface UnderState { wheelOff?: boolean[]; suspOff?: number[] }
/** Where the underside's corners sit, px: the axles along, the middle, the track, the width. */
interface UnderPlace { frontAxle: number; rearAxle: number; mid: number; track: number;
  widthPx: number }

/**
 * Paints a line of 1 px squares (sizePx wide).
 * @param rect the picture's block painter
 * @param from [x, y] px
 * @param dest [x, y] px
 * @param col its colour
 * @param sizePx its width
 */
function underLine(rect: (x: number, y: number, w: number, h: number, col: string) => void,
  from: number[], dest: number[], col: string, sizePx = 1): void {
  const steps = Math.max(1, Math.round(Math.max(Math.abs(dest[0] - from[0]),
    Math.abs(dest[1] - from[1]))));
  for (let step = 0; step <= steps; step++) rect(from[0] + (dest[0] - from[0]) * step / steps,
    from[1] + (dest[1] - from[1]) * step / steps, sizePx, sizePx, col);
}

/**
 * One corner seen from below, as the upright car draws it (render/carcorners.ts): the
 * SUBFRAME rail; the wishbone's two arms from it to the hub; a driven wheel's DRIVE SHAFT from the
 * middle; a front's TRACK ROD. A wheel torn off (state.wheelOff) leaves them snapped - the arms
 * SNAP_SHARE of the way out (less with the wishbone gone), the shaft and rod stubs when they went
 * too (SUSP_SHAFT, SUSP_ROD) - and a strut gone its tower's hole.
 * @param rect the picture's block painter
 * @param spec the car as drawn (its drive)
 * @param place where the corners sit
 * @param corner the damage corner (0, 1 front; odd +y)
 * @param snap its wheel torn off, and what it took (SUSP_* bits)
 */
function underCorner(rect: (x: number, y: number, w: number, h: number, col: string) => void,
  spec: RenderCarSpec, place: UnderPlace, corner: number,
  snap: { gone: boolean; off: number }): void {
  const { mid, track, widthPx } = place, front = corner < 2, side = corner % 2 ? 1 : -1;
  const axle = front ? place.frontAxle : place.rearAxle, spread = 0.2 * SPRITE_PPM;
  const { gone, off } = snap;
  const innerY = mid + side * (widthPx / 2 - SUBFRAME_M * SPRITE_PPM);
  const hubY = mid + side * track / 2;
  const out = (share: number) => innerY + (hubY - innerY) * share;
  const half = SUBFRAME_HALF_M * SPRITE_PPM;
  rect(axle - half, innerY - SUBFRAME_PX / 2, half * 2, SUBFRAME_PX, SUBFRAME);
  const armEnd = !gone ? hubY : out(off & SUSP_WISHBONE ? SNAP_SHARE_NO_WISHBONE : SNAP_SHARE);
  underLine(rect, [axle - spread, innerY], [axle, armEnd], UNDER_ARM);
  underLine(rect, [axle + spread, innerY], [axle, armEnd], UNDER_ARM);
  const drive = spec.drive ?? 0, driven = front ? drive > 0 : drive < 1;
  const shaftEnd = !gone ? hubY : off & SUSP_SHAFT ? out(SNAP_SHARE_NO_WISHBONE) : armEnd;
  if (driven) underLine(rect, [axle - 1, mid], [axle - 1, shaftEnd], '#5a5d66', 2);
  const rodX = axle - spread * 0.7, rodEnd = off & SUSP_ROD ? out(ROD_STUB_SHARE) : hubY - side;
  if (front) underLine(rect, [rodX, innerY], [rodX, rodEnd], UNDER_ARM);
  if (gone && off & SUSP_STRUT) rect(axle - 1.5, hubY - side * 2 - 1.5, 3, 3, STRUT_HOLE);
}

/**
 * The car seen from below (tail left, nose right, as the top sprite): the floor or an open car's
 * plank and pods, the axles, a prop shaft to a driven rear axle, the exhaust, the sump at the
 * engine, the wheels.
 * @param spec the car as drawn
 * @param widthPx the body's width, px (the top sprite's)
 * @param state the wheels gone and what they took (render/rollbody.ts; none: whole)
 * @returns the picture
 */
export function paintUnderProfile(spec: RenderCarSpec, widthPx: number,
  state?: UnderState): ProfilePicture {
  const profile = profileOf(spec), lengthPx = Math.round(spec.len * SPRITE_PPM),
    { img, rect } = pictureOf(lengthPx, widthPx), mid = widthPx / 2;
  const paint = spec.paint || '#d0552f', floor = '#34353b', metal = '#5a5d66';
  if (profile.open) {
    const tub = widthPx * profile.open.tub;
    rect(lengthPx * 0.08, mid - tub / 2, lengthPx * 0.86, tub, floor);
    rect(lengthPx * 0.3, mid - tub / 2 - 3, lengthPx * 0.3, 3, shade(paint, 0.5));
    rect(lengthPx * 0.3, mid + tub / 2, lengthPx * 0.3, 3, shade(paint, 0.5));
    for (const [from, upto, , , span] of profile.open.wings)
      rect(from * lengthPx, mid - widthPx * span / 2, (upto - from) * lengthPx, widthPx * span,
        shade(paint, 0.6));
  } else {
    rect(0, 1, lengthPx, widthPx - 2, shade(paint, 0.35));
    rect(2, 2, lengthPx - 4, widthPx - 4, floor);
  }
  const frontAxle = lengthPx / 2 + spec.lf * SPRITE_PPM,
    rearAxle = lengthPx / 2 - spec.lr * SPRITE_PPM, track = (spec.trackWidth || 1.5) * SPRITE_PPM;
  // (a closed car's corners as the upright car draws them through its damage - the subframe, the
  // arms, a driven wheel's shaft, a front's track rod; snapped where a wheel was torn off - an open
  // car's a bar across each axle)
  const place = { frontAxle, rearAxle, mid, track, widthPx };
  if (!profile.open) underCorners(rect, spec, place, state);
  else for (const axle of [frontAxle, rearAxle]) rect(axle - 1, mid - track / 2, 2, track, metal);
  // a prop shaft to a driven rear axle, the exhaust to the tail, the sump at the engine
  if ((spec.drive ?? 0) < 1 && !profile.open) rect(rearAxle, mid - 1, frontAxle - rearAxle, 2,
    metal);
  rect(0, mid + widthPx * 0.2, lengthPx * 0.6, 2, '#8a8d96');
  rect(frontAxle - lengthPx * 0.12, mid - 3, lengthPx * 0.1, 6, '#2a2b30');
  underTyres(rect, spec, place, state);
  return { img, Lp: lengthPx, Hp: widthPx };
}

/**
 * The underside's four corners (underCorner), each snapped where its wheel was torn
 * off.
 * @param rect the picture's block painter
 * @param spec the car as drawn
 * @param place where the corners sit
 * @param state the wheels gone and what they took (none: whole)
 */
function underCorners(rect: (x: number, y: number, w: number, h: number, col: string) => void,
  spec: RenderCarSpec, place: UnderPlace, state?: UnderState): void {
  for (let corner = 0; corner < 4; corner++) underCorner(rect, spec, place, corner,
    { gone: !!state?.wheelOff?.[corner], off: state?.suspOff?.[corner] ?? 0 });
}

/**
 * The underside's tyres, but those torn off (state.wheelOff).
 * @param rect the picture's block painter
 * @param spec the car as drawn
 * @param place where the corners sit
 * @param state the wheels gone (none: all on)
 */
function underTyres(rect: (x: number, y: number, w: number, h: number, col: string) => void,
  spec: RenderCarSpec, place: UnderPlace, state?: UnderState): void {
  const { frontAxle, rearAxle, mid, track } = place;
  for (const [axle, rear] of [[frontAxle, false], [rearAxle, true]] as [number, boolean][]) {
    const { len, wid } = tyreBox(spec, rear);
    for (const side of [-1, 1]) {
      if (state?.wheelOff?.[(rear ? 2 : 0) + (side > 0 ? 1 : 0)]) continue;
      rect(axle - len / 2, mid + side * track / 2 - wid / 2, len, wid, '#16171c');
    }
  }
}
