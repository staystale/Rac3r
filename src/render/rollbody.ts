// render/rollbody.ts - THE ROLLED CAR AS A BODY (owner 11-08 on the roll mockup,
// tools/scratch/rollmock.html: "make it look 3d in the shape the car should be ish rather than a
// clear cube"; "draw it 2D but"; "remember windscreens are angled"; "12 roll frames is the sweet
// spot", "shaded bands"; "slight motion blur and some woosh lines"). Behind ?rollbody=1, for the
// F1 and the Micra first (physics/rollshape.ts). Along its length every column of the car is a
// rounded cross-section - as wide as its top sprite there, as tall as its real roof line
// (render/carprofile.ts), as round as the real car - and the picture at a roll angle shows, in
// each screen row of a column, the nearest point of the turned section: painted from the picture
// covering that part (the top sprite on the roof and bonnet, the side profile down the flanks, the
// underside below), lit from above in bands. The wheels stand off it as boxes; an open car's
// wings and sidepods too. DAMAGE: the top sprite is the car's own (dents, cut ends, lost parts -
// the body is as wide as it is, so a crushed end is shorter, a lost wing or sidepod gone); the
// side and underside pictures take the same crush (render/cardamage.ts carveSide, crushTop); a
// lost door, wing or bumper leaves its opening dark; a lost wheel is gone; a crushed roof sits
// lower. The body's surface is made once per damage step (a new top sprite), each of the 12
// pictures once from it as the roll needs it.
import { FIX } from '../core/fixes.ts';
import { rollShapeOf } from '../physics/rollshape.ts';
import { carveSide, crushTop } from './cardamage.ts';
import { heightsPx, paintSideProfile, paintUnderProfile, profileOf } from './carprofile.ts';
import type { CarProfile, ProfilePicture } from './carprofile.ts';
import { tyreBox } from './cars.ts';
import { SPRITE_PPM } from './shared.ts';
import { readSoon, spriteToWork } from './spritepixels.ts';
import type { CarSprite, RenderCar, RenderCarSpec } from './types.ts';

// 12 pictures a turn; the light in BANDS steps, from above and AHEAD a little (the windscreen and
// the rear screen shade apart from the roof); above the waist the cabin leans in, CABIN_IN of its
// width gone at the roof (the side glass is angled too)
const FRAMES = 12, BANDS = 3, AHEAD = 0.3, CABIN_IN = 0.3;
// the blur: pictures a moment back [s, alpha] from BLUR_W rad/s of spin; whoosh lines from
// WHOOSH_W rad/s or WHOOSH_V m/s
const BLUR: [number, number][] = [[0.07, 0.12], [0.035, 0.25]], BLUR_W = 4, WHOOSH_W = 5,
  WHOOSH_V = 5;
// m: an open car's sidepods' top
const POD_M = 0.55;
const TYRE_RGB = 0x16171c, OPENING = [29, 30, 35];

/** Something standing off the body (a wheel's slice, a wing, a sidepod), px across and up. */
interface Box {
  centre: number; half: number; low: number; high: number; rgb: number;
  textured?: boolean;   // its top face from the top sprite
  rim?: { out: number; low: number; high: number; rgb: number };   // a wheel's rim, its outside
}
/** One column of the body: its cross-section's half width and centre, top and bottom, px; the
 * roof line's slope there; what stands off it. */
interface Column {
  half: number; centre: number; top: number; bottom: number; slope: number; boxes: Box[];
}
/** The pictures a body is painted from: the top sprite's pixels, the -y and +y sides', below. */
interface Paints { top: ImageData; sides: ImageData[]; under: ImageData; Wp: number }
/** A picture of the body at one roll angle and its shadow; half: px from its top to the axis. */
interface BodyFrame { canvas: HTMLCanvasElement; shadow: HTMLCanvasElement; half: number }
/** The body's surface: per sample its column, place (across, up), outward normal (across, up,
 * along the car) and colour; made once a damage step. */
interface Body {
  base: HTMLCanvasElement; length: number; heightMax: number; reach: number;
  xs: Int16Array; ys: Float32Array; zs: Float32Array; nys: Float32Array; nzs: Float32Array;
  alongs: Float32Array; rgbs: Uint32Array; frames: (BodyFrame | undefined)[];
}

const BODIES = new WeakMap<RenderCar, Body>();
const PICTURES = new Map<string, { side: ProfilePicture; under: ProfilePicture }>();

/**
 * Whether a car rolls as a body (?rollbody=1, a car with a rolling shape).
 * @param spec the car as drawn
 * @returns true when it does
 */
export const drawsAsBody = (spec: RenderCarSpec) => FIX.rollbody && !!rollShapeOf(spec.id);

/**
 * A car's side and underside pictures, per look.
 * @param spec the car as drawn
 * @param widthPx its top sprite's width
 * @returns the pictures
 */
function picturesOf(spec: RenderCarSpec, widthPx: number) {
  const key = `${spec.id}|${spec.paint}|${spec.trim}|${spec.rim}|${widthPx}`;
  let pictures = PICTURES.get(key);
  if (!pictures) {
    pictures = { side: paintSideProfile(spec), under: paintUnderProfile(spec, widthPx) };
    PICTURES.set(key, pictures);
  }
  return pictures;
}

/**
 * A car's pictures made now and read on quiet frames (not in the frame it first rolls).
 * @param spec the car as drawn
 * @param widthPx its top sprite's width
 */
export function prepareBody(spec: RenderCarSpec, widthPx: number) {
  const { side, under } = picturesOf(spec, widthPx);
  readSoon(side.c);
  readSoon(under.c);
}

/**
 * Paint a dark opening on a side picture where a part came off (its body's pixels only).
 * @param img the picture's pixels
 * @param heightPx the picture's height
 * @param span from / to px along, low / high px up
 */
function darken(img: ImageData, heightPx: number, span: number[]) {
  const [from, upto, low, high] = span;
  for (let row = Math.round(heightPx - high) + 2; row <= heightPx - low + 2; row++) {
    for (let x = Math.round(from) + 2; x < upto + 2; x++) {
      if (row < 0 || row >= img.height || x < 0 || x >= img.width) continue;
      const idx = (row * img.width + x) * 4;
      if (!img.data[idx + 3]) continue;
      img.data[idx] = OPENING[0]; img.data[idx + 1] = OPENING[1]; img.data[idx + 2] = OPENING[2];
    }
  }
}

/**
 * The openings a closed car's lost parts leave on one side: a door, a wing over its wheel, a
 * bumper at its end (world/debris.ts partLost, render/carparts.ts partRegion's places).
 * @param car the car
 * @param spec the car as drawn
 * @param img the side picture's pixels
 * @param picture the side picture
 * @param plus the +y side
 */
function openings(car: RenderCar, spec: RenderCarSpec, img: ImageData, picture: ProfilePicture,
  plus: boolean) {
  const profile = profileOf(spec), length = picture.Lp, height = picture.Hp,
    scale = length / profile.len, waist = (profile.waist ?? 0.9) * scale,
    clearance = Math.max(1, (spec.rideH ?? 0.13) * scale);
  for (const entry of (car.partLost || '').split(',')) {
    const [kind, cornerText] = entry.split(':'), corner = Number(cornerText),
      front = corner < 2;
    if (kind !== 'bumper' && (corner % 2 === 1) !== plus) continue;
    if (kind === 'panel') darken(img, height, [length * 0.36, length * 0.62, clearance + 2,
      waist - 1]);
    if (kind === 'wing') {
      const axle = length / 2 + (front ? spec.lf : -spec.lr) * SPRITE_PPM;
      darken(img, height, [axle - 7, axle + 7, tyreBox(spec, !front).len, waist - 1]);
    }
    if (kind === 'bumper') darken(img, height, front ? [length - 5, length, clearance, waist * 0.6]
      : [0, 5, clearance, waist * 0.6]);
  }
}

/**
 * The pictures a damaged car's body is painted from.
 * @param car the car
 * @param spec the car as drawn
 * @param top its top sprite (damaged, without its lost parts)
 * @returns the pixels
 */
function paintsOf(car: RenderCar, spec: RenderCarSpec, top: CarSprite): Paints {
  const { side, under } = picturesOf(spec, top.Wp), hurt = !!car.dmg;
  const sides = [false, true].map((plus) => {
    const img = spriteToWork(side.c).img;
    if (hurt) carveSide(car, img, side.Lp, side.Hp, plus);
    if (car.partLost && !profileOf(spec).open) openings(car, spec, img, side, plus);
    return img;
  });
  const below = hurt ? crushTop(car, { c: under.c, Lp: under.Lp, Wp: under.Hp }, false).img
    : spriteToWork(under.c).img;
  return { top: spriteToWork(top.c).img, sides, under: below, Wp: top.Wp };
}

/**
 * The wheels' slices of one column (a tyre's circle, its rim on the outside), but a lost one.
 * @param car the car
 * @param spec the car as drawn
 * @param x the column
 * @param length the car's length, px
 * @returns the boxes
 */
function wheelBoxes(car: RenderCar, spec: RenderCarSpec, x: number, length: number): Box[] {
  const track = (spec.trackWidth || 1.5) * SPRITE_PPM, boxes: Box[] = [],
    rimRgb = parseInt((spec.rim || '#6d707a').slice(1), 16);
  for (let corner = 0; corner < 4; corner++) {
    if (car.wheelOff?.[corner]) continue;
    const rear = corner > 1, { len: dia, wid } = tyreBox(spec, rear),
      mid = length / 2 + (rear ? -spec.lr : spec.lf) * SPRITE_PPM, along = x + 0.5 - mid;
    if (Math.abs(along) > dia / 2) continue;
    const rise = Math.sqrt((dia / 2) ** 2 - along ** 2),
      rim = Math.sqrt(Math.max(0, (dia * 0.3) ** 2 - along ** 2)), out = corner % 2 ? 1 : -1;
    boxes.push({ centre: out * track / 2, half: wid / 2, low: dia / 2 - rise, high: dia / 2 + rise,
      rgb: TYRE_RGB, rim: { out, low: dia / 2 - rim, high: dia / 2 + rim, rgb: rimRgb } });
  }
  return boxes;
}

/**
 * An open car's column: its tub, and what is wider than the tub there in its top sprite (so a
 * lost part is gone) - a wing (a plane on two endplates) or a sidepod.
 * @param col the column as the top sprite gives it
 * @param profile the car's profile
 * @param share the column's share of the length, tail 0
 * @param dims the top sprite's width and px a metre
 */
function openColumn(col: Column, profile: CarProfile, share: number, dims: number[]) {
  const [widthPx, scale] = dims, open = profile.open!, tubHalf = widthPx * open.tub / 2,
    paint = 0x8a8d96;
  if (col.half > tubHalf + 0.5) {
    const wing = open.wings.find(([from, upto]) => share >= from && share < upto);
    if (wing) {
      const low = wing[2] * scale, high = wing[3] * scale,
        plane = Math.max(1.5, (high - low) * 0.3);
      col.boxes.push({ centre: col.centre, half: col.half, low: high - plane, high, rgb: paint,
        textured: true });
      for (const side of [-1, 1]) col.boxes.push({ centre: col.centre + side * (col.half - 0.5),
        half: 0.5, low, high, rgb: paint });
    } else {
      col.boxes.push({ centre: col.centre, half: col.half, low: col.bottom,
        high: Math.min(col.top, POD_M * scale), rgb: paint, textured: true });
    }
  }
  col.half = Math.min(col.half, tubHalf);
  col.centre = 0;
}

/**
 * The body's columns along its length: from its top sprite (how wide, where), its profile (how
 * tall), a crushed roof lower.
 * @param car the car
 * @param spec the car as drawn
 * @param paints its pictures
 * @param heightMax the side picture's height
 * @returns the columns (null where the body is gone)
 */
function columnsOf(car: RenderCar, spec: RenderCarSpec, paints: Paints, heightMax: number) {
  const profile = profileOf(spec), tops = heightsPx(spec), length = tops.length,
    scale = length / profile.len, clearance = Math.max(1, (spec.rideH ?? 0.13) * scale),
    waist = profile.waist ? profile.waist * scale : Infinity, roof = car.roofDmg || 0,
    top = paints.top, widthPx = paints.Wp, cols: (Column | null)[] = [];
  const heightAt = (i: number) => tops[Math.min(length - 1, Math.max(0, i))];
  for (let x = 0; x < length; x++) {
    let first = -1, last = -1;
    for (let row = 0; row < top.height; row++) if (top.data[(row * top.width + x + 2) * 4 + 3]) {
      if (first < 0) first = row;
      last = row;
    }
    if (first < 0) { cols.push(null); continue; }
    let height = heightAt(x);
    const share = x / length;
    if (roof > 0.05 && share > 0.2 && share < 0.85 && height > waist)
      height = Math.max(waist, height - 0.3 * roof * heightMax);
    const col: Column = { half: (last - first + 1) / 2,
      centre: (first + last + 1) / 2 - 2 - widthPx / 2,
      top: Math.max(clearance + 2, height), bottom: clearance,
      slope: (heightAt(x + 1) - heightAt(x - 1)) / 2, boxes: [] };
    if (profile.open) openColumn(col, profile, share, [widthPx, scale]);
    col.boxes.push(...wheelBoxes(car, spec, x, length));
    cols.push(col);
  }
  return cols;
}

/**
 * A picture's pixel as 0xRRGGBB, or -1 where it is clear.
 * @param img the picture
 * @param x px
 * @param y px
 * @returns the colour
 */
function texel(img: ImageData, x: number, y: number): number {
  const col = Math.round(x), row = Math.round(y);
  if (col < 0 || row < 0 || col >= img.width || row >= img.height) return -1;
  const idx = (row * img.width + col) * 4, data = img.data;
  return data[idx + 3] ? (data[idx] << 16) | (data[idx + 1] << 8) | data[idx + 2] : -1;
}

/** The samples of a body's surface as they are made. */
class Samples {
  columns: number[] = []; across: number[] = []; ups: number[] = []; nys: number[] = [];
  nzs: number[] = []; alongs: number[] = []; rgbs: number[] = [];

  /**
   * One sample.
   * @param place column, across, up
   * @param normal across, up, along
   * @param rgb its colour
   */
  add(place: number[], normal: number[], rgb: number) {
    this.columns.push(place[0]); this.across.push(place[1]); this.ups.push(place[2]);
    this.nys.push(normal[0]); this.nzs.push(normal[1]); this.alongs.push(normal[2]);
    this.rgbs.push(rgb);
  }
}

/**
 * The pictures blended by how much a point of the body faces up, down or out (no hard seams); the
 * top and underside read a pixel in from their edge (not their dark outline, a streak). Above the
 * waist the side glass is the side picture's, the top sprite only on the near-flat roof.
 * @param paints the pictures
 * @param where column, across, height above the ground, half, centre, above the waist (0 / 1)
 * @param normalY across
 * @param normalZ up
 * @returns 0xRRGGBB, or -1
 */
function blend(paints: Paints, where: number[], normalY: number, normalZ: number): number {
  const [x, y, height, half, centre, cabin] = where, ramp = (value: number) =>
    Math.min(1, Math.max(0, value));
  const inside = centre + Math.sign(y - centre) * Math.min(Math.abs(y - centre),
    Math.max(0, half - 1.5)) + paints.Wp / 2 + 2, side = paints.sides[normalY < 0 ? 0 : 1];
  const parts: [number, number][] = [
    [ramp(cabin ? (normalZ - 0.6) / 0.3 : (normalZ - 0.15) / 0.55),
      texel(paints.top, x + 2, inside)],
    [ramp((-normalZ - 0.15) / 0.55), texel(paints.under, x + 2, inside)],
    [ramp((Math.abs(normalY) - 0.25) / 0.5), texel(side, x + 2, side.height - 2 - height)],
  ];
  let red = 0, green = 0, blue = 0, weight = 0;
  for (const [share, rgb] of parts) if (share > 0 && rgb >= 0) {
    red += (rgb >> 16) * share; green += ((rgb >> 8) & 255) * share; blue += (rgb & 255) * share;
    weight += share;
  }
  return weight ? (Math.round(red / weight) << 16) | (Math.round(green / weight) << 8)
    | Math.round(blue / weight) : -1;
}

/**
 * One column's cross-section as samples: a superellipse as round as the car, the cabin leaning
 * in above the waist, the normal tipped along the car by the roof line's slope.
 * @param samples the surface so far
 * @param x the column
 * @param col the column
 * @param form the pictures, the superellipse's power, the floor and the waist (px from the axis)
 */
function section(samples: Samples, x: number, col: Column,
  form: { paints: Paints; power: number; floor: number; waist: number }) {
  const { paints, power, floor, waist } = form, bottom = floor + col.bottom, roof = floor + col.top,
    mid = (bottom + roof) / 2, semi = (roof - bottom) / 2,
    count = Math.ceil(5 * (col.half + semi)) + 12;   // ~1.5 a px of its outline
  const point = (turn: number) => {
    const cos = Math.cos(turn), sin = Math.sin(turn),
      z = mid + semi * Math.sign(sin) * Math.abs(sin) ** power,
      lean = z > waist && roof > waist + 2 ? 1 - CABIN_IN * (z - waist) / (roof - waist) : 1;
    return [col.half * lean * Math.sign(cos) * Math.abs(cos) ** power, z];
  };
  // (each point once; its normal from its neighbours either side)
  const ring: number[][] = [];
  for (let i = 0; i < count; i++) ring.push(point((i / count) * 2 * Math.PI));
  for (let i = 0; i < count; i++) {
    const [y, z] = ring[i], [backY, backZ] = ring[(i + count - 1) % count],
      [nextY, nextZ] = ring[(i + 1) % count];
    let normalY = nextZ - backZ, normalZ = -(nextY - backY);
    if (normalY * y + normalZ * (z - mid) < 0) { normalY = -normalY; normalZ = -normalZ; }
    const norm = Math.hypot(normalY, normalZ) || 1;
    normalY /= norm; normalZ /= norm;
    const rgb = blend(paints, [x, y + col.centre, z - floor, col.half, col.centre,
      z > waist ? 1 : 0], normalY, normalZ);
    if (rgb >= 0) samples.add([x, y + col.centre, z], [normalY, normalZ,
      normalZ > 0 ? -col.slope * normalZ : 0], rgb);
  }
}

/**
 * A box's four faces as samples (a wheel's rim on its outside, a textured top from the sprite).
 * @param samples the surface so far
 * @param x the column
 * @param box the box
 * @param form the pictures and the floor (px from the axis)
 */
function boxSamples(samples: Samples, x: number, box: Box,
  form: { paints: Paints; floor: number }) {
  const { paints, floor } = form, low = floor + box.low, high = floor + box.high,
    left = box.centre - box.half, right = box.centre + box.half,
    steps = Math.ceil(2 * Math.max(right - left, high - low)) + 2;
  const sideRgb = (rise: number, out: number) => (box.rim && box.rim.out === out
    && rise >= floor + box.rim.low && rise <= floor + box.rim.high ? box.rim.rgb : box.rgb);
  for (let i = 0; i <= steps; i++) {
    const along = left + (right - left) * i / steps, rise = low + (high - low) * i / steps,
      onTop = box.textured ? texel(paints.top, x + 2, along + paints.Wp / 2 + 2) : -1;
    samples.add([x, along, high], [0, 1, 0], onTop >= 0 ? onTop : box.rgb);
    samples.add([x, along, low], [0, -1, 0], box.rgb);
    samples.add([x, left, rise], [-1, 0, 0], sideRgb(rise, -1));
    samples.add([x, right, rise], [1, 0, 0], sideRgb(rise, 1));
  }
}

/**
 * A car's body for its damage now (its top sprite: a new one each damage step), kept per car.
 * @param car the car
 * @param spec the car as drawn
 * @param top its top sprite
 * @returns the body
 */
function bodyOf(car: RenderCar, spec: RenderCarSpec, top: CarSprite): Body {
  const kept = BODIES.get(car);
  if (kept && kept.base === top.c) return kept;
  const paints = paintsOf(car, spec, top), heightMax = picturesOf(spec, top.Wp).side.Hp,
    cols = columnsOf(car, spec, paints, heightMax), profile = profileOf(spec),
    scale = cols.length / profile.len, round = rollShapeOf(spec.id)?.round ?? 0.5;
  const form = { paints, power: 2 / (2 + 6 * (1 - round)), floor: -heightMax / 2,
    waist: -heightMax / 2 + (profile.waist ? profile.waist * scale : Infinity) };
  const samples = new Samples();
  let reach = 0;
  cols.forEach((col, x) => {
    if (!col) return;
    section(samples, x, col, form);
    for (const box of col.boxes) boxSamples(samples, x, box, form);
  });
  for (let i = 0; i < samples.columns.length; i++)
    reach = Math.max(reach, Math.hypot(samples.across[i], samples.ups[i]));
  const body: Body = { base: top.c, length: cols.length, heightMax, reach: Math.ceil(reach),
    xs: Int16Array.from(samples.columns), ys: Float32Array.from(samples.across),
    zs: Float32Array.from(samples.ups), nys: Float32Array.from(samples.nys),
    nzs: Float32Array.from(samples.nzs), alongs: Float32Array.from(samples.alongs),
    rgbs: Uint32Array.from(samples.rgbs), frames: [] };
  BODIES.set(car, body);
  return body;
}

/**
 * The body turned to one of its 12 angles: each column's nearest turned point in each row, lit
 * from above (and ahead a little) in bands, a pale rim where it turns away.
 * @param body the body
 * @param phi the roll angle
 * @returns the picture
 */
function frameAt(body: Body, phi: number): BodyFrame {
  const bucket = ((Math.round(phi / (2 * Math.PI / FRAMES)) % FRAMES) + FRAMES) % FRAMES;
  const kept = body.frames[bucket];
  if (kept) return kept;
  const angle = bucket * 2 * Math.PI / FRAMES, cos = Math.cos(angle), sin = Math.sin(angle),
    height = body.reach * 2 + 4, out = new ImageData(body.length + 4, height),
    best = new Float32Array(height), data = out.data;
  let column = -1;
  for (let i = 0; i < body.xs.length; i++) {
    const x = body.xs[i], y = body.ys[i], z = body.zs[i];
    if (x !== column) { best.fill(-Infinity); column = x; }
    const row = Math.round(y * cos + z * sin + body.reach + 2), near = -y * sin + z * cos;
    if (row < 0 || row >= height || near <= best[row]) continue;
    best[row] = near;
    const along = body.alongs[i], norm = Math.hypot(along, body.nys[i], body.nzs[i]) || 1,
      litZ = (-body.nys[i] * sin + body.nzs[i] * cos) / norm,
      smooth = Math.max(0, litZ * (1 - AHEAD) + (along / norm) * AHEAD),
      light = 0.32 + 0.68 * Math.round(smooth * BANDS) / BANDS
        + (litZ > 0 && litZ < 0.25 ? 0.12 : 0),
      rgb = body.rgbs[i], idx = (row * out.width + x + 2) * 4;
    data[idx] = (rgb >> 16) * light; data[idx + 1] = ((rgb >> 8) & 255) * light;
    data[idx + 2] = (rgb & 255) * light; data[idx + 3] = 255;
  }
  const canvas = document.createElement('canvas');
  canvas.width = out.width; canvas.height = height;
  canvas.getContext('2d')!.putImageData(out, 0, 0);
  const shadow = document.createElement('canvas');
  shadow.width = out.width; shadow.height = height;
  const shadowCtx = shadow.getContext('2d')!;
  shadowCtx.drawImage(canvas, 0, 0);
  shadowCtx.globalCompositeOperation = 'source-in';
  shadowCtx.fillStyle = '#14121c';
  shadowCtx.fillRect(0, 0, out.width, height);
  const frame = { canvas, shadow, half: body.reach + 2 };
  body.frames[bucket] = frame;
  return frame;
}

/**
 * Whoosh lines: thin pale streaks trailing off the body's back edge against its slide, longer the
 * faster it goes and spins, flickering along its length (car frame, sprite px).
 * @param ctx the canvas
 * @param body the body
 * @param phi the roll angle
 * @param motion along / across the car m/s, the spin rad/s, the top sprite's width
 */
function whoosh(ctx: CanvasRenderingContext2D, body: Body, phi: number, motion: number[]) {
  const [along, across, spin, widthPx] = motion, speed = Math.hypot(along, across) || 1,
    extent = 0.5 * (widthPx * Math.abs(Math.cos(phi)) + body.heightMax * Math.abs(Math.sin(phi))),
    rush = speed + spin * 0.5, length = Math.min(16, rush * 1.2),
    tick = Math.floor(performance.now() / 70), backX = -along / speed, backY = -across / speed;
  ctx.strokeStyle = '#e8ecf2';
  ctx.lineWidth = 1;
  ctx.globalAlpha = Math.min(0.45, rush / 30);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const spot = ((i * 0.27 + ((tick * 7 + i * 3) % 5) * 0.04) - 0.45) * body.length,
      startY = across ? -Math.sign(across) * (extent + 2) : 0,
      reachOut = length * (0.6 + 0.4 * ((tick + i) % 2));
    ctx.moveTo(spot, startY);
    ctx.lineTo(spot + backX * reachOut, startY + backY * reachOut);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Draw a rolling car as its body (the context at the car, its heading, sprite px): its shadow
 * further off as it stands on an edge, a slight blur of where it was a moment ago when it spins
 * fast, whoosh lines, the body.
 * @param ctx the canvas
 * @param car the car
 * @param spec the car as drawn
 * @param top its top sprite (damaged, without its lost parts)
 * @param shadowOff the shadow's offset
 */
export function drawRolledBody(ctx: CanvasRenderingContext2D, car: RenderCar, spec: RenderCarSpec,
  top: CarSprite, shadowOff: number) {
  const body = bodyOf(car, spec, top), phi = car.roll!.phi, spinRate = car.roll!.w ?? 0,
    spin = Math.abs(spinRate), frame = frameAt(body, phi), left = -body.length / 2 - 2;
  const lift = 0.25 * (top.Wp * Math.abs(Math.sin(phi))
    + body.heightMax * Math.abs(Math.cos(phi)) - body.heightMax);
  ctx.globalAlpha = 0.3;
  ctx.drawImage(frame.shadow, left + shadowOff + 2 + lift, -frame.half + shadowOff + 2 + lift);
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading),
    along = car.vx * cosH + car.vy * sinH, across = -car.vx * sinH + car.vy * cosH;
  if (spin > BLUR_W) for (const [back, alpha] of BLUR) {
    const ghost = frameAt(body, phi - spinRate * back);
    ctx.globalAlpha = alpha * Math.min(1, (spin - BLUR_W) / 4);
    ctx.drawImage(ghost.canvas, left - along * back * SPRITE_PPM,
      -ghost.half - across * back * SPRITE_PPM);
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(frame.canvas, left, -frame.half);
  if (spin > WHOOSH_W || Math.hypot(along, across) > WHOOSH_V)
    whoosh(ctx, body, phi, [along, across, spin, top.Wp]);
}
