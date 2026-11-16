// render/carshade.ts - (owner: "Just shade all the cars, they're looking
// better generally"): every car shaded the TS010's way, in the flat pixel style - a light 1 px
// line along a crest, a soft dark line down its slope, shadow where the body meets the glass and
// inside an arch's bulge. One shared step over the finished sprite (its own outline and colours),
// plus each car's own crest lines (CAR_SHADE: only the painter's shapes say where its bonnet,
// roof and shoulders are). Painted once per livery and cached with the sprite: no cost a frame.
import type { SpriteCtx } from './carsprite.ts';

/** A tone: its colour and how much of it goes over the pixel. */
type Tone = 'shine' | 'shade' | 'soft';
const TONES: Record<Tone, [number, number, number, number]> = {
  shine: [255, 255, 255, 0.32], shade: [0, 0, 0, 0.22], soft: [0, 0, 0, 0.12],
};
/** One crest line: along the car (shares of its length, 0 tail), across it (0 top edge, 1 the
 * bottom), its tone. */
type Line = [from: number, until: number, across: number, tone: Tone];

/**
 * A car's crest lines from where its glass sits: the boot's or tailgate's top, the roof's and the
 * bonnet's shoulders (lit on the top side, soft on the lower), the flank's crest and its shadow.
 * @param boot [from, until] the boot lid behind the rear screen, or null (a hatch)
 * @param roof [from, until] the roof
 * @param bonnet [from, until] the bonnet ahead of the windscreen
 * @returns the lines
 */
function crests(boot: [number, number] | null, roof: [number, number],
  bonnet: [number, number]): Line[] {
  const lines: Line[] = [
    [roof[0], roof[1], 0.3, 'shine'], [roof[0], roof[1], 0.7, 'soft'],
    [bonnet[0], bonnet[1], 0.3, 'shine'], [bonnet[0], bonnet[1], 0.7, 'soft'],
    [0.04, 0.96, 0.12, 'shine'], [0.04, 0.96, 0.88, 'shade'],
  ];
  if (boot) lines.push([boot[0], boot[1], 0.3, 'shine'], [boot[0], boot[1], 0.7, 'soft']);
  return lines;
}

// each car's crest lines (from its painter's cabin: render/carlooks.ts, carsprite.ts,
// newcarlooks*.ts); null - its painter shades it itself (the TS010, the M4 GT3)
export const CAR_SHADE: Record<string, Line[] | null> = {
  'hatch-fwd': crests(null, [0.16, 0.56], [0.72, 0.95]),
  'hatch-rwd': crests(null, [0.18, 0.5], [0.66, 0.95]),
  'saloon-rwd': crests([0.04, 0.17], [0.31, 0.55], [0.7, 0.95]),
  'estate-4x4': crests(null, [0.12, 0.56], [0.73, 0.95]),
  'mini-fwd': crests(null, [0.24, 0.62], [0.78, 0.95]),
  'muscle-rwd': crests([0.03, 0.14], [0.28, 0.46], [0.63, 0.96]),
  'lambo-awd': crests(null, [0.46, 0.62], [0.74, 0.95]),
  'focust-st': crests(null, [0.12, 0.53], [0.69, 0.95]),
  'cleo-rs200': crests(null, [0.14, 0.53], [0.7, 0.94]),
  'cleo-cup': crests(null, [0.14, 0.53], [0.7, 0.94]),
  'saxo-vtr': crests(null, [0.14, 0.53], [0.7, 0.94]),
  'saxo-kit': crests(null, [0.14, 0.53], [0.7, 0.94]),
  'strange-l322': crests(null, [0.11, 0.59], [0.68, 0.95]),
  'tesla-m3': crests([0.03, 0.12], [0.24, 0.58], [0.71, 0.95]),
  // batch 2: the rally, RX, drift and stock cars
  'wrz-awd': crests([0.04, 0.19], [0.32, 0.55], [0.7, 0.95]),
  'rally-4x4': crests(null, [0.27, 0.53], [0.69, 0.95]),
  'mikra-r1': crests(null, [0.16, 0.58], [0.76, 0.95]),
  'kit-2l': crests(null, [0.24, 0.53], [0.71, 0.95]),
  'rx-super': crests(null, [0.22, 0.5], [0.67, 0.95]),
  'banger-f2': crests([0.04, 0.16], [0.3, 0.58], [0.73, 0.95]),
  'drift-s13': crests([0.04, 0.12], [0.28, 0.53], [0.69, 0.95]),
  naffcar: crests([0.04, 0.18], [0.32, 0.54], [0.69, 0.95]),
  // batch 3: the race cars, the vans, the bus, the trophy truck, the tractor, the Seven, the
  // Defunder (the single-seaters and the buggy, open, left as they are)
  'porch-gt3r': crests([0.04, 0.2], [0.38, 0.55], [0.68, 0.95]),
  'civvic-btcc': crests([0.04, 0.14], [0.31, 0.54], [0.68, 0.95]),
  'effing-tt': crests([0.05, 0.34], [0.4, 0.55], [0.63, 0.95]),
  'transfit-van': crests(null, [0.05, 0.7], [0.82, 0.96]),
  'transfit-lwb': crests(null, [0.05, 0.72], [0.83, 0.96]),
  'transfit-swb': crests(null, [0.05, 0.68], [0.8, 0.96]),
  'defunder-110': crests(null, [0.06, 0.64], [0.7, 0.96]),
  'seven-420r': [[0.55, 0.95, 0.3, 'shine'], [0.55, 0.95, 0.7, 'soft'],
    [0.04, 0.96, 0.12, 'shine'], [0.04, 0.96, 0.88, 'shade']],
  routemonster: [[0.05, 0.95, 0.3, 'shine'], [0.05, 0.95, 0.7, 'soft'],
    [0.03, 0.97, 0.12, 'shine'], [0.03, 0.97, 0.88, 'shade']],
  tractor: [[0.04, 0.96, 0.12, 'shine'], [0.04, 0.96, 0.88, 'shade']],
  ts010: null,
  'rebelion-r13': null,
  'seat-ibiza': null,
  'ordi-a4': null,
  'transfit-custom': null,
  'bmv-e36peak': null,
  'skool-bus': null,
  'scanyah-r450': null,
  'scanyah-trailer': null,
  'bmv-m4gt3': null,
  'toyoter-corolla': null,
};

/** The sprite's pixels and what the step reads of them. */
interface Pixels { rgba: Uint8ClampedArray; width: number; top: number; bottom: number;
  isBody: (x: number, y: number) => boolean; isGlass: (x: number, y: number) => boolean }

/**
 * Reads the sprite: its pixels, the body's rows (the 2 px margin left out: mirrors stand in it),
 * which pixels are its paint or roof colours, which its glass.
 * @param spr the painting context
 * @param img the sprite's image data
 * @returns the reader
 */
function readPixels(spr: SpriteCtx, img: ImageData): Pixels {
  const rgba = img.data, width = img.width;
  const colours = [spr.paint, spr.roof2, spr.trim].map((hex) => {
    const value = hex.replace('#', '');
    return [0, 2, 4].map((from) => parseInt(value.slice(from, from + 2), 16));
  });
  const indexOf = (x: number, y: number) => (y * width + x) * 4;
  const isBody = (x: number, y: number) => {
    const i = indexOf(x, y);
    return rgba[i + 3] > 200 && colours.some(([red, green, blue]) => Math.abs(rgba[i] - red) < 6
      && Math.abs(rgba[i + 1] - green) < 6 && Math.abs(rgba[i + 2] - blue) < 6);
  };
  const isGlass = (x: number, y: number) => {
    const i = indexOf(x, y);
    return rgba[i + 3] > 200 && rgba[i] < 70 && rgba[i + 1] < 75 && rgba[i + 2] < 95;
  };
  return { rgba, width, top: 2, bottom: 2 + spr.widthPx - 1, isBody, isGlass };
}

/**
 * Lays a tone over one pixel.
 * @param pixels the sprite's pixels
 * @param x canvas px
 * @param y canvas px
 * @param tone the tone
 */
function toneAt(pixels: Pixels, x: number, y: number, tone: Tone): void {
  const [red, green, blue, share] = TONES[tone], i = (y * pixels.width + x) * 4, rgba = pixels.rgba;
  rgba[i] = rgba[i] * (1 - share) + red * share;
  rgba[i + 1] = rgba[i + 1] * (1 - share) + green * share;
  rgba[i + 2] = rgba[i + 2] * (1 - share) + blue * share;
}

/**
 * The body's top and bottom rows in each column (-1 where it has none).
 * @param pixels the sprite's pixels
 * @param lengthPx the car's length, px
 * @returns [top, bottom] each column
 */
function bodyEdges(pixels: Pixels, lengthPx: number): [number, number][] {
  const edges: [number, number][] = [];
  for (let x = 2; x < 2 + lengthPx; x++) {
    let upper = -1, lower = -1;
    for (let y = pixels.top; y <= pixels.bottom; y++) {
      if (pixels.rgba[(y * pixels.width + x) * 4 + 3] < 200) continue;
      if (upper < 0) upper = y;
      lower = y;
    }
    edges.push([upper, lower]);
  }
  return edges;
}

/**
 * The shared step: inside each arch's bulge past the doors' waist a soft line down its slope (lit
 * along its crest), and the body's edge against the glass in shadow (the cowl, the pillars).
 * @param spr the painting context
 * @param pixels the sprite's pixels
 * @param marks the tones to lay: [x, y, tone]
 */
function sharedMarks(spr: SpriteCtx, pixels: Pixels, marks: [number, number, Tone][]): void {
  const edges = bodyEdges(pixels, spr.lengthPx), halves = edges.map(([upper, lower]) =>
    (upper < 0 ? 0 : (lower - upper) / 2));
  const waist = halves.slice(Math.round(halves.length * 0.35), Math.round(halves.length * 0.65))
    .filter((half) => half > 0);
  const base = waist.length ? Math.min(...waist) : 0;
  edges.forEach(([upper, lower], column) => {
    const x = column + 2, bulge = Math.round(halves[column] - base);
    if (upper < 0) return;
    if (bulge >= 1) marks.push([x, upper + bulge + 3, 'soft'], [x, lower - bulge - 3, 'shade']);
    for (let y = upper; y <= lower; y++) {
      if (pixels.isBody(x, y) && (pixels.isGlass(x + 1, y) || pixels.isGlass(x - 1, y)
        || pixels.isGlass(x, y - 1) || pixels.isGlass(x, y + 1))) marks.push([x, y, 'soft']);
    }
  });
}

/**
 * shades a finished closed car's sprite - the shared step, then its own crest lines -
 * only over its body's own colours (its lamps, grille, glass and details untouched).
 * @param spr the painting context
 */
export function shadeSprite(spr: SpriteCtx): void {
  const lines = CAR_SHADE[String(spr.spec.id).split('#')[0]];
  if (lines === null) return;
  const { ctx, canvas, lengthPx, widthPx } = spr;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height), pixels = readPixels(spr, img);
  const marks: [number, number, Tone][] = [];
  sharedMarks(spr, pixels, marks);
  for (const [from, until, across, tone] of lines || []) {
    const y = 2 + Math.round(across * (widthPx - 1));
    for (let x = 2 + Math.round(from * lengthPx); x < 2 + Math.round(until * lengthPx); x++)
      marks.push([x, y, tone]);
  }
  for (const [x, y, tone] of marks) if (pixels.isBody(x, y)) toneAt(pixels, x, y, tone);
  ctx.putImageData(img, 0, 0);
}
