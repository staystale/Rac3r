// Shared render-layer shapes; the CARS / AI / GAME ones list only the fields the render code reads.
import type { Level, Spray } from "../world/types.ts";
import type { Spec } from "../cars.ts";
import type { Car } from "../vehicle.ts";

// The shared view object render.ts creates.
export interface View {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  dpr: number;
  PPM: number;
  zoom: number;
  noPatterns: boolean;
  // the GPU painter (glpaint.ts) draws the floor and zone fills: a tile leaves them transparent
  fillsOnGpu: boolean;
}

// The camera object; lx / ly are undefined until follow sets them (updateFly resets them).
export interface Cam {
  x: number;
  y: number;
  initialised: boolean;
  lx?: number;
  ly?: number;
}

// A whole-level picture painted flat once, with the world rectangle it covers.
export interface Overview {
  c: HTMLCanvasElement;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// The level fly-in: time so far, the level centre, the start zoom and the overview picture.
export interface Fly {
  t: number;
  cx: number;
  cy: number;
  z0: number;
  ov: Overview;
}

// What levelOverview caches per level (layout and road start decide when it is stale).
export interface OvCache {
  level: Level;
  layout: number;
  s0: number;
  ov: Overview | null;
}

// The camera state other layers read.
export interface CamState {
  fly: Fly | null;
  ovCache: OvCache | null;
  vZoom: number | null;
  pinZoom: number | null;
  // zoom hold: the zoom move under way (from, to, progress 0..1, its length in s, the zoom it
  // set last), or null while the zoom holds
  zoomGlide: { from: number; to: number; progress: number; seconds: number; last: number } | null;
  // ?zoomspring=1: the spring move under way (its speed in halvings per s, its way: +1 in / -1
  // out, caught: near enough, now easing to a stop; the zoom it set last), or null while it holds
  zoomSpring: { rate: number; way: number; caught: boolean; last: number } | null;
}

// What the camera reads of a car.
export interface CamCar {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// One wheel as marks.wheelsOf returns it (the fields the particles read).
export interface RenderWheel {
  x: number;
  y: number;
  heat: number;
  slip: number;
}

// What the particles read of a car.
export interface ParticleCar extends CamCar {
  heading: number;
  spec: { len: number; wid: number; paint?: string };
  surface: { spray?: Spray | null };
  t: { slipSpeedF: number; slipSpeedR: number; loadKF: number; loadKR: number };
  tyreT?: unknown;   // truthy when the tyre temperatures are simulated
  wreck?: { smoke?: boolean };
  dmgEvents?: { scrape?: boolean; amt: number; c: number }[];
  sparks?: boolean;
  _spDebt?: number;
  _dsDebt?: number;
}

// What the particles read of the marks layer.
export interface RenderMarks {
  wheelsOf: (car: ParticleCar) => RenderWheel[];
  shiftX: number;   // layer px the window has moved (getters in marks.js; 0 = not moved)
  shiftY: number;
  size: number;   // the layer canvas side, px
  canvas: HTMLCanvasElement;
}

// One layer of a surface's art: [kind, colour, ...numbers in metres] (see PRIM in ground.ts).
export type ArtLayer = [string, string, ...number[]];

// How one surface is painted: a base colour, then layers drawn in order (SURFACE_ART in ground.ts).
export interface SurfaceArt {
  base: string;
  layers: ArtLayer[];
}

// One pattern painter of PRIM: draws a layer over a world rectangle.
export type PrimFn = (layer: ArtLayer, x0: number, y0: number, x1: number, y1: number) => void;

// forSide(i, fn): runs fn in the frame of floor side i (px per metre, edge distance, half length).
export type ForSide = (
  side: number, fn: (ppm: number, dist: number, half: number) => void
) => void;

// What drawArrows reads of the game.
export interface RoadGame {
  jokerTaken?: boolean;
}

// The worn cells of one surface for one drawWear pass: rects as x, y, w, h, and their world box.
export interface WearGroup {
  r: number[];
  bx0: number;
  by0: number;
  bx1: number;
  by1: number;
}
// A hit that throws dust: a cone, a bale or a sheep.
export interface PuffHit {
  kind?: string;
  x: number;
  y: number;
  speed: number;
}

// One puff of thrown material.
export interface Puff {
  x: number;
  y: number;
  age: number;
  life: number;
  r0: number;
  grow: number;
  rgb: string;
  vx: number;
  vy: number;
}

// One paint chip or spark.
export interface Chip {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  col: string;
  sz: number;
}

// A canvas that silhouette caches its darker copy on (cardamage.ts).
export interface SilCanvas extends HTMLCanvasElement {
  _sil?: HTMLCanvasElement;
}

// The top-view car sprite pixelCar builds and caches: the canvas and its size in art px.
export interface CarSprite {
  c: SilCanvas;
  Lp: number;
  Wp: number;
}

// The side face of a rolled car (sideSprite): the canvas and its size in art px.
export interface SideSprite {
  c: SilCanvas;
  Lp: number;
  Hp: number;
}

// One face of a rolled car as rolledFaces returns it for drawFaces.
export interface RollFace {
  cv: HTMLCanvasElement;
  cy: number;
  ky: number;
  hh: number;
}

// What the car layers read of a car SPEC (cars.ts Spec).
export type RenderCarSpec =
  Pick<Spec, 'id' | 'paint' | 'trim' | 'kind' | 'lf' | 'lr' | 'len' | 'wid'>
  & Partial<Pick<Spec, 'num' | 'trackWidth' | 'wheelR' | 'rideH' | 'rim'>>;   // num: the livery

// What the car layers read of a CAR (vehicle.ts Car + what damage.js / roll.js / the render
// layers add).
export interface RenderCar extends CamCar, Pick<Car, 'heading' | 'delta'> {
  spec: RenderCarSpec;
  num?: number;  dmg?: number[];    // the next five are set together with dmg by damageInit
  crushL: number[];
  crushS: number[];
  roofDmg: number;
  punct: boolean[];
  wheelOff: boolean[];
  roll?: { phi: number } | null;
  lightsOn?: boolean;
  indicator?: number;
  hazard?: boolean;
  brakeLight?: number;
  // caches the car layers set on the car itself
  _dsp?: { key: string; base: CarSprite; sp: CarSprite } | null;
  _dface?: Record<string, { key: string; out: CarSprite | SideSprite }>;
}

// One game object the cones layer draws (cones.js: cones, bales, tyres, animals, debris, ...).
export interface RenderCone {
  x: number;
  y: number;
  kind: string;
  down: number;   // 0 = upright, 1 = flat
  ang: number;
  mode?: string;   // tyres: stack / flat / roll / flip / wobble
  col?: string;
  hx: number;   // home position; seeds the scatter of burst straw and broken debris
  hy: number;
  tipped?: boolean;
  paint?: string;
  num?: string;
}

// One rally tape section between two posts.
export interface RenderTape {
  a: { x: number; y: number };
  b: { x: number; y: number };
  gone?: boolean;
  broken?: boolean;
}

// A tape streamer stuck to a car.
export interface Streamer {
  born: number;
  phase: number;
  len: number;
}

// What drawTape reads of a car.
export interface TapeCar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  spec: { len: number };
  streamers?: Streamer[] | null;   // null = reset; cones.js sets it
  _stN?: number | null;   // drawTape's count of streamers, to see one lost
}

// What drawTape reads of the game.
export interface TapeGame {
  cones: {
    tapes?: RenderTape[];
    tapePuffs?: { x: number; y: number; vx: number; vy: number }[];
    clock?: number;
  };
  car: TapeCar;
  ai?: { car: TapeCar }[];
}

// A car as frame hands it to every layer: drawn, smoking / chipping and trailing tape.
export type GameCar = RenderCar & ParticleCar & TapeCar;

// What frame reads of the game (jokerTaken: RoadGame; cones, car, ai: TapeGame).
export interface RenderGame extends RoadGame, TapeGame {
  car: GameCar;
  ai?: { car: GameCar }[];
  traffic?: { cars: GameCar[] };   // highway traffic (traffic.js)
  cones: TapeGame["cones"] & { list: RenderCone[]; drainHits: () => PuffHit[] };
  marks: RenderMarks;
}

// One cached ground tile: its canvas, the frame it was last used, and whether wear made it stale.
export interface Tile {
  c: HTMLCanvasElement;
  used: number;
  stale?: boolean;
}

// The counters and flags the tile cache shares with the renderer's getters.
export interface TileState {
  tileFrame: number;
  tilesPainted: number;
  tileMs: number;
  staleRepaints: number;
  msLayers: number;
  msSnap: number;
  msShade: number;
  newTiles: number;
  perStep: Record<number, number>;
  prefetched: number;
  lastStep: number | null;
  drawnN: number;
  standIn: boolean;
}

// How many tiles one frame may still paint (n), and the time budget of tileBudget.
export interface TileBudget {
  n: number;
  first?: boolean;
  until?: number | null;
}
