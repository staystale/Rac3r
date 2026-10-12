// Shared render-layer shapes; the CARS / AI / GAME ones list only the fields the render code reads.
import type { Level, Spray } from "../world/types.ts";

// The shared view object render.js creates.
export interface View {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  dpr: number;
  PPM: number;
  zoom: number;
  noPatterns: boolean;
}

// The camera object; lx / ly are undefined until follow() sets them (updateFly resets them).
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
