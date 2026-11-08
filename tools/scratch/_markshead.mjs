import fs from 'node:fs';
const p = 'src/marks.ts';
let s = fs.readFileSync(p, 'utf8');
const a = s.indexOf('/**\n * The buffer state of one marks layer.');
const b = s.indexOf('// WRAP-AROUND LAYER.');
if (a < 0 || b < 0) throw new Error('typedefs');
s = s.slice(0, a) + `/** The buffer state of one marks layer. */
interface MarkState {
  prev: Map<string, { x: number; y: number }>;   // wheel key -> world position last step
  stamps: number;   // how many stamps were laid since the last clear
  shiftX: number; shiftY: number;   // layer px the window has moved (0 on a level that fits)
  wraps: boolean;   // true once the window follows the car (a wrap-around buffer)
  fadeT?: number;   // s since the last fade tick
  clock?: number;   // s of marks time (the aged fade)
  cellT?: Float64Array;   // each fade cell's newest mark, marks s (the aged fade)
  cellStep?: Uint8Array;   // each fade cell's fade steps done (the aged fade)
  live?: Set<number>;   // the fade cells holding marks (the aged fade)
}

/** What every marks function takes. */
interface MarkCtx { layer: HTMLCanvasElement; ctx: CanvasRenderingContext2D; state: MarkState }

/** One wheel this step: where, how hard it slips, how wide, what it marks and throws, its heat. */
export interface MarkWheel {
  key: string; x: number; y: number; slip: number; width: number;
  mark?: Mark | null;   // set only by loose surfaces (undefined = ordinary skid marks), or a rim
  spray?: Spray | null; heat: number;
}

/** What the marks read of a car. */
interface MarkCar {
  x: number; y: number; heading: number;
  spec: { lf: number; lr: number; trackWidth: number; tyreWidth: number };
  t: { slipSpeedF: number; slipSpeedR: number };
  surface: Surface; wheelSurf?: (Surface | null)[] | null;   // the ground under each wheel
  tyreT?: number[]; rimSparks?: boolean[]; wheelOff?: boolean[];
  _markId?: number;
}

` + s.slice(b);
fs.writeFileSync(p, s);
console.log('ok');
