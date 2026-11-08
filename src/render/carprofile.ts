// render/carprofile.ts - each car's REAL SIDE PROFILE (owner 11-08, on the roll mockup: "we need
// angled windscreens and accurate side and under profiles for each car - coz the f1 car for
// example doesn't look right nor does the estate"). The rolled car's side and underside were one
// generic box for every car (render/cardamage.ts sideSprite: the same height, a flat roof, square
// windows). Here every car has its roof line from tail to nose (the windscreen and rear screen at
// their angle), its side glass, its waist; an open car its tub and wings. paintSideProfile and
// paintUnderProfile paint them in the car's colours at its drawn length; heightsPx gives the body's
// height along its length for the rolled body (tools/scratch/rollmock.html).
import { SPRITE_PPM } from "./shared.ts";
import { shade } from "../render.ts";   // hoisted, only called at draw time (no cycle)
import { tyreBox } from "./cars.ts";
import type { RenderCarSpec } from "./types.ts";

/** A wing of an open car: from / to share of the length (tail 0, nose 1), low / high m, span. */
type Wing = [number, number, number, number, number];
/** A car's side profile: its real length; its roof line, tail to nose, [share of length, m up];
 * the side glass from / to share and the waist (m) under it; an open car's tub share of the width
 * and wings. */
export interface CarProfile {
  len: number; roof: [number, number][]; glass?: [number, number]; waist?: number;
  open?: { tub: number; wings: Wing[] };
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
  tractor: { len: 5.1, waist: 1.6, glass: [0.33, 0.6], roof: [[0, 1.2], [0.3, 1.2],
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

/** A side or underside picture: its canvas, length and height px (the sprites' 2 px margin). */
export interface ProfilePicture { c: HTMLCanvasElement; Lp: number; Hp: number }

/**
 * A fresh picture canvas and a rect painter on its 2 px margin.
 * @param width px
 * @param height px
 * @returns the canvas and the painter
 */
function pictureOf(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width + 4; canvas.height = height + 4;
  const ctx = canvas.getContext('2d')!;
  const rect = (x: number, y: number, wide: number, tall: number, col: string) => {
    if (wide <= 0 || tall <= 0) return;
    ctx.fillStyle = col;
    ctx.fillRect(2 + Math.round(x), 2 + Math.round(y), Math.round(wide), Math.round(tall));
  };
  return { canvas, rect };
}

/**
 * The car seen from its side (tail left, nose right): its roof line with the glass at its angle,
 * paint, wheels at their real size and place, lamps; an open car its tub, wings and wheels.
 * @param spec the car as drawn
 * @returns the picture
 */
export function paintSideProfile(spec: RenderCarSpec): ProfilePicture {
  const profile = profileOf(spec), tops = heightsPx(spec), lengthPx = tops.length,
    scale = pxPerM(spec), heightPx = Math.ceil(Math.max(...tops)) + 1,
    { canvas, rect } = pictureOf(lengthPx, heightPx);
  const paint = spec.paint || '#d0552f', outline = shade(paint, 0.4), glass = '#15171d',
    clearance = Math.max(1, (spec.rideH ?? 0.13) * scale);
  const waist = (profile.waist ?? 0) * scale, [glassFrom, glassTo] = profile.glass ?? [1, 0];
  for (let x = 0; x < lengthPx; x++) {
    const top = heightPx - tops[x], bottom = heightPx - clearance, share = x / lengthPx;
    rect(x, top, 1, bottom - top, profile.open ? shade(paint, 0.85) : paint);
    rect(x, top, 1, 1, outline);
    // the glass under the roof line (the windscreen and rear screen at the roof line's angle)
    if (!profile.open && share > glassFrom && share < glassTo && tops[x] > waist + 2)
      rect(x, top + 1, 1, heightPx - waist - top - 1, glass);
  }
  for (const [from, upto, low, high] of profile.open?.wings ?? [])
    rect(from * lengthPx, heightPx - high * scale, (upto - from) * lengthPx, (high - low) * scale,
      shade(paint, 0.6));
  rect(lengthPx - 2, heightPx - waist - 3, 2, 2, '#fff3c4');
  rect(0, heightPx - waist - 3, 2, 2, '#c8342a');
  sideWheels(spec, rect, lengthPx, heightPx);
  return { c: canvas, Lp: lengthPx, Hp: heightPx };
}

/**
 * The wheels on a side picture: tyres at their real size, the rim in them, at the axles.
 * @param spec the car as drawn
 * @param rect the picture's painter
 * @param lengthPx the car's length, px
 * @param heightPx the picture's height, px
 */
function sideWheels(spec: RenderCarSpec, rect: (x: number, y: number, wide: number, tall: number,
  col: string) => void, lengthPx: number, heightPx: number) {
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

/**
 * The car seen from below (tail left, nose right, as the top sprite): the floor or an open car's
 * plank and pods, the axles, a prop shaft to a driven rear axle, the exhaust, the sump at the
 * engine, the wheels.
 * @param spec the car as drawn
 * @param widthPx the body's width, px (the top sprite's)
 * @returns the picture
 */
export function paintUnderProfile(spec: RenderCarSpec, widthPx: number): ProfilePicture {
  const profile = profileOf(spec), lengthPx = Math.round(spec.len * SPRITE_PPM),
    { canvas, rect } = pictureOf(lengthPx, widthPx), mid = widthPx / 2;
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
  for (const axle of [frontAxle, rearAxle]) rect(axle - 1, mid - track / 2, 2, track, metal);
  // a prop shaft to a driven rear axle, the exhaust to the tail, the sump at the engine
  if ((spec.drive ?? 0) < 1 && !profile.open) rect(rearAxle, mid - 1, frontAxle - rearAxle, 2,
    metal);
  rect(0, mid + widthPx * 0.2, lengthPx * 0.6, 2, '#8a8d96');
  rect(frontAxle - lengthPx * 0.12, mid - 3, lengthPx * 0.1, 6, '#2a2b30');
  for (const [axle, rear] of [[frontAxle, false], [rearAxle, true]] as [number, boolean][]) {
    const { len, wid } = tyreBox(spec, rear);
    for (const side of [-1, 1]) rect(axle - len / 2, mid + side * track / 2 - wid / 2, len, wid,
      '#16171c');
  }
  return { c: canvas, Lp: lengthPx, Hp: widthPx };
}
