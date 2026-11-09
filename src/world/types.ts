// Shared world data shapes; this file grows as files are converted.
import type { Branches, RacingLine } from "../ai/types.ts";
import type { HwState } from '../highway/hwtypes.ts';

// What a wheel leaves behind on a surface.
export interface Mark {
  rgb: string;
  widen: number;
  alpha: number;
}

// What the wheels throw up from a surface.
export interface Spray {
  rgb: string;
  size: number;
  rate: number;
  lift: number;
  life: number;
  grow: number;
  over?: number;   // the share of its puffs drawn over the cars (fine dry dust)
}

/** What the marks and the spray read of the ground under one wheel (either Surface type). */
export interface WheelGround { mark?: Mark | null; spray?: Spray | null }

export interface Surface {
  id: string;
  label?: string;
  mu: number;
  peakK: number;
  longK?: number;
  plough: number;
  rough: number;
  mark: Mark | null;
  spray?: Spray | null;
  hard?: boolean;
  coolK?: number;
  heatK?: number;
  under?: string;   // what a snow / ice / wet surface lies on; a puddle's base id
  wetK?: number;    // how wet, 0..1 (damp / puddle surfaces, wet.ts): hard ground's tyre WET grip
  gripWetK?: number;   // the share of the tyre's WET grip a damp / puddle surface asks (wet.ts)
  brush?: number;   // 1/s: drag growing with speed, plants pushed through (bushes; tyres.ts)
}

export interface Paint {
  kind: string;
  x: number;
  y: number;
  r?: number;
  lw?: number;
  tone?: number;
  w?: number;
  h?: number;
  len?: number;
  wid?: number;
  rot?: number;
  pts?: Point[];   // a painted line (kind 'line'): its points, lw wide
}

export interface Board {
  x: number;
  y: number;
  label: string;
  rot?: number;
}

export interface Cone {
  x: number;
  y: number;
  kind?: string;
  rot?: number;
  paint?: string;
  num?: string;
  col?: string;
  tape?: string | number;   // load.ts tapePass numbers its tapes
  idx?: number;
  field?: number;   // highway/fields.ts: a field's animals go when the field is cleared
}

export interface Spawn {
  x: number;
  y: number;
  heading: number;
  rot?: number;
}

export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
  surface: Surface;
  boxed?: boolean;
  ext?: boolean;
  lane?: string;
  rounded?: boolean;
  rot?: number;
  art?: string | null;   // null: the surface's own look (highway/fields.ts)
  hedge?: boolean;
  field?: number;
  _s?: number;
  sv?: number;   // highway.ts river banks: which side of the river (-1 / 1)
  _r?: number;   // zoneAt caches for rotated zones
  _co?: number;
  _si?: number;
  blocks?: ZoneBlock[];   // a ploughed field's drying blocks (fieldblocks.ts)
  // a real outline (a venue's traps, paddocks, car parks: world/venuescenery.ts); x / y / w / h
  // are then its bounding box. Physics tests the outline; the tiles paint inside it.
  poly?: Point[];
}

// One block of a field (fieldblocks.ts): a rectangle in the zone's own frame (m from its
// centre, u along w, v along h), its own surface and, once dried, the look drawn over the field.
export interface ZoneBlock {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  surface: Surface;
  art?: string;
}

export interface Bump {
  kind: string;
  x: number;
  y: number;
  cos?: number;   // set by prepBumps
  sin?: number;   // set by prepBumps
  reach2?: number;   // set by prepBumps
  rot?: number;
  len?: number;
  wid?: number;
  h?: number;
  r?: number;
  d?: number;
  amp?: number;
  wave?: number;
  r0?: number;
  R?: number;
  B?: number;
  _s?: number;   // highway.ts: the road distance it is dropped behind with
}

export interface Prop {
  kind: string;
  x: number;
  y: number;
  wid?: number;
  rot?: number;
  w?: number;
  h?: number;
  size?: number;
  label?: string;
  col?: string;
  flip?: boolean;   // highway/canyon.ts: a wreck on its roof
  s?: number;
  seed?: number;
  brand?: string;
  front?: Point[];
  back?: Point[];
  _walled?: boolean;   // its outline made a solid wall (world/load.ts garagePass)
  banner?: Point[];
  roof?: string;
  paint?: string;
  num?: string;
  len?: number;
  line?: Point[];
  nose?: boolean;
  _bb?: [number, number, number, number];   // road.ts drawSlip caches the slip road's box
  field?: number;
  _s?: number;
  house?: boolean;
  church?: boolean;
  blue?: boolean;
  bars?: number;
  n?: number;
  snow?: boolean;
  pal?: string;
  carries?: string;
  boat?: boolean;   // highway.ts bridges: a river bridge with a boat
  roadHw?: number;   // highway.ts river bridges
  skew?: number;   // highway.ts river bridges
  appL?: number[];   // highway.ts bridges: the approach lengths [0 | 1]
  appW?: number;   // highway.ts bridges: the approaches' width
  type?: string;   // highway.ts slips: 'short', 'long' or 'side'
  ww?: number;   // highway.ts river bridges: the river's width
  phase?: number;   // highway.ts bridges
  cow?: boolean;   // highway.ts road bridges
  cars?: number;   // highway.ts road bridges
  quiet?: boolean;   // a road bridge with no traffic over it (Brands Snatch's)
  look?: string;   // a prop drawn in another look ('venue': a venue's road bridge)
  trainEvery?: number;   // highway.ts rail bridges
  cone?: boolean;   // highway.ts foot bridges
  people?: number;   // highway.ts foot bridges
  reach?: number;   // gantry / overhead props: how far they span the track (level data)
  // a start gantry's lights' middle along its span from its centre, m (a venue's: its legs
  // unequally far off the road, world/venuescenery.ts startGantry)
  podX?: number;
  _camHit?: number;   // highway.ts: a speed-camera gantry already passed (1)
  _flash?: number;   // render/props/buildings.ts reads it: when a camera flashed (set by the game)
}

// An x, y pair in metres.
export type Point = [number, number];

// The floor rectangle (LEVEL.bounds).
export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

// The part of the car (vehicle.ts Car) the world code touches; the real Car satisfies it.
export interface CarBody {
  bellyDepth?: number;   // m of the underside in the ground (world/belly.ts)
  wheelOff?: boolean[]; onRim?: boolean[];   // wheels gone / tyres on the rim, by corner
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  yawRate: number;
  shake?: number;   // set by the first contact (contact.ts, the clamps), never by makeCar
  _hitKind?: string | null;   // what it hit this step (physics/punctures.ts noteHit)
  spec: { len: number; wid: number; lf: number; lr: number; mass: number; trackWidth?: number;
    rideH?: number;
    tyre?: { grip: Record<string, number> } | null };
  t: { slipSpeedF: number; slipSpeedR: number };
  air: number;
  surface: Pick<Surface, 'id' | 'mu'>;   // the fields both Surface types (here and cars.ts) have
  tyreT?: number[];
  prevWheels: Wheel[] | null;   // null after a reset; stepWear sets it
  // the ground under each wheel (carWheels order), stepWear: what marks / spray read of it
  wheelSurf?: WheelGround[] | null;
  zF: number;
  zR: number;
  zvF: number;
  zvR: number;
  groundF: number;
  groundR: number;
  groundVF: number;
  groundVR: number;
  groundInit: boolean;
  slopeLat?: number;   // set by applyGround
  slopeLong?: number;   // set by applyGround
  slopeYaw?: number;   // set by applyGround
  bankLatForce?: number;   // set by applyGround
  bankLoadFactor?: number;   // set by applyGround
  mods: { mass: number };
  // the LEVEL.crossings index of the bridge / tunnel the car is on, -1 on the ground; and where
  // it was the step before (world/crossings.ts: it changes level only through an end)
  crossing?: number;
  crossX?: number;
  crossY?: number;
  tangleT?: number;   // s a torn catch fence still drags it (world/armcodent.ts)
}

// A DRIVABLE BRIDGE OR TUNNEL (world/crossings.ts): a straight way between two ends, over or under
// the track. A car comes onto it only through an end and keeps to it - held by its walls, on its
// tarmac, apart from the cars on the ground - until it leaves by an end.
export interface Crossing {
  kind: 'bridge' | 'tunnel';
  // end A, where a car changes level (a ramp's foot, a portal's mouth), m
  ax: number;
  ay: number;
  // unit, from A toward end B; m from A to B
  dirX: number;
  dirY: number;
  length: number;
  // m across the way (+ along (-dirY, dirX)) to each wall's face
  minAcross: number;
  maxAcross: number;
  // m in from each end a tunnel's open cut runs (its car still seen); 0 for a bridge
  cut: number;
  // m the way rises at its middle over its ends' ground (a bridge's arch; a tunnel's dip, below 0)
  rise: number;
  // the walls holding a car on it (kind 'wall'; no ground car meets them)
  walls: Barrier[];
}

// One wheel's contact point in the world, metres.
export interface Wheel {
  x: number;
  y: number;
}

// A cover lying on the ground (LEVEL.covers); 'wet' is a puddle.
export type CoverId = 'snow' | 'ice' | 'wet';

// A cover's cut-out band (highway.ts river parapets).
export interface CoverCut {
  ox: number;
  oy: number;
  tn: number;
  e: number;
}

// One entry of LEVEL.covers.
export interface Cover {
  x: number;
  y: number;
  w: number;
  h: number;
  cover: CoverId;
  shape?: 'rect' | 'ellipse';
  rot?: number;
  cut?: CoverCut;
  _s?: number;   // highway.ts: the road distance it is dropped behind with
  water?: boolean;   // SCENERY water (river, lake, ford): permanent in any weather (puddles.ts)
  _frozen?: boolean;   // puddles.ts: scenery water frozen over (its _iceTwin is shown)
  _iceTwin?: Cover;   // puddles.ts: the same water as ice
  _co?: number;   // coverAt caches for rotated covers
  _si?: number;
  _cells?: CoverCells;   // ground.ts coverCells caches the covered 0.5 m cells
}


// The 0.5 m world-grid cells inside a cover, as x, y pairs; rim = those with an outside neighbour.
export interface CoverCells {
  all: number[];
  rim: number[];
  G: number;
}

// One entry of LEVEL.patches / PATCH_GRID: a spot of a different base laid on the ground.
export interface Patch {
  x: number;
  y: number;
  w: number;
  h: number;
  surface: Surface;
  sq?: boolean;
  rot?: number;
  blend?: boolean;   // blend.ts: made by buildBlend
  src?: string;   // blend.ts: 'change' for sector change points
  bush?: boolean;   // world/bushplan.ts: a bush (drawn with its own shadow and rim)
  // laid with a streamed road's zones (highway/gorge.ts: their edges' blend), dropped behind it
  streamed?: boolean; _s?: number;
  art?: string;   // the look it is drawn with when not its surface's (a bush's kind)
}

// Where a level grows its bushes (world/bushplan.ts): clumps beside the road and under trees.
export interface BushPlan {
  every: number;   // m of road between clump spots on each side (each spot taken by chance)
  band: [number, number];   // m beyond the road's edge a clump's centre lies, nearest .. farthest
  clear: number;   // m every bush keeps clear of the road's edge
  treeShare: number;   // the share of the level's trees with a clump at their foot
  beds?: Point[];   // clumps placed by hand (the test levels' sample beds), each still checked
}

// A cover patch made by buildInclusions (cover is a CoverId name).
export interface InclusionCover {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  cover: CoverId;
  shape: 'rect' | 'ellipse';
}

// What buildInclusions returns.
export interface Inclusions {
  patches: Patch[];
  covers: InclusionCover[];
}

// One entry of LEVEL.obstacles: an axis-aligned solid box.
export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

// One cell of the wear map (wear.ts): two layers, base and cover.
export interface WearCell {
  cx: number;
  cy: number;
  base: string;
  cover: string | null;
  orig: string;
  passes: number;
  scrub: number;
  dry: number;
  standing: boolean;
  lastSeenTime: number;
  current?: string;   // set right after the cell is made
  rut?: number;
  rainDry?: number;   // the dry line tyres made in the rain, 0..1 (wet.ts)
  mudDry?: number;    // how far mud has dried toward the next step, 0..1 (puddles.ts)
  frozeMud?: boolean;   // mud frozen over in the cold (its ice cover thaws back; puddles.ts)
  rainT?: number;     // the wear clock when rainDry was set, s
  fixed?: boolean;    // its cover is the level's own: it never follows the cover field
  laid?: string | null;   // what the cover field last laid here (coverfield.ts syncFieldCells)
  area?: string | null;   // the cover field's level area the cell is in (coverfield.ts)
  crack?: number;     // how cracked its ice is, 0..1 (icecrack.ts)
  oilGen?: number;    // its oil's spreads left + 1 (oil.ts)
  waterGen?: number;    // its water's spreads left + 1, when it was spread (waterdrag.ts)
}

// What layersAt returns: the static layers at a point, before any wear.
export interface Layers {
  base: string;
  cover: string | null;
  standing: boolean;
  fixed?: boolean;   // the cover is the level's own (a zone, LEVEL.covers), not the weather's
  area?: string | null;   // the cover field's level area the point is in (coverfield.ts)
}

// What groundAt returns: height in metres and the surface there.
export interface Ground {
  h: number;
  surface: Surface;
}

export type BarrierKind = 'armco' | 'wall' | 'pitwall' | 'fence' | 'building' | 'line'
  | 'catchfence' | 'rock';

// One padded segment of a barrier polyline (what prepBarriers pushes).
export interface BarrierSeg {
  ax: number;
  ay: number;
  dx: number;
  dy: number;
  l2: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  i0?: number;   // the index in the barrier's pts its start is (world/armcodent.ts)
  torn?: boolean;   // torn open this step (world/armcodent.ts): no longer solid
}

/** A generated rally stage's recipe (stagegen.ts genStage); km once built. */
export interface StageRecipe {
  seed: number; theme: string; len: string; style: string; attempt?: number; km?: number;
}

// One entry of LEVEL.barriers; polylines in metres.
export interface Barrier {
  kind: BarrierKind;
  pts: Point[];
  col?: string;
  _s?: number;   // highway.ts
  _segs?: BarrierSeg[];   // added by prepBarriers
  _cbb?: [number, number, number, number];   // barriers.ts barrierClamp: the box round _segs
  _runs?: number[];   // barriers.ts segRunBoxes: the box round each run of SEG_RUN _segs
  field?: number;   // highway/fields.ts: the field (village) it belongs to
  // a canyon's rock wall (highway/canyon.ts): the rock behind its face, and its strata lines
  band?: Point[]; strata?: Point[][];
  _rbb?: [number, number, number, number];   // render/props/fence.ts caches the padded box
}

// A rotated solid box (what solidsFromProps returns); r is its bounding radius.
export interface Solid {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  kind: string;
  r?: number;   // solidsFromProps sets it after the push
}

// LEVEL.joker: the rallycross joker-lap rule (gate, time penalty, laps, painted arrows).
export interface JokerRule {
  gate: { x: number; y: number; r: number };
  penalty: number;
  // game/rules.ts caches the gate line across the joker lane (null: no lane)
  _line?: { x: number; y: number; tx: number; ty: number; half: number } | null;
  estCost?: number;   // s a joker is guessed to cost an unfinished car (raceflow.ts; unset: 5)
  laps: number;
  // d: its distance round the track (hud/laps.ts reads it for the joker turn-off; none sets it)
  arrows: ({ x: number; y: number; rot: number; len: number; d?: number } | null)[];
}

export interface Level {
  id: string;
  name: string;
  // the venue it is one layout of (menu/tracks.ts: the venue's card, then its layouts)
  venue?: string;
  coneCount?: boolean;   // show the knocked-cone tally (a cone course)
  rollingStart?: boolean;   // races start rolling (the ovals)
  snowy?: boolean;   // a snow-themed stage (weather only): its theme biases the weather
  seams?: boolean;
  randomise?: () => void;   // the Grass Track: new random patches every load
  patches?: Patch[];
  stage?: { finish: number };   // rally stage: finish distance
  joker?: JokerRule;
  _blend?: Patch[] | null;   // load.ts prepareLevel
  _incl?: Inclusions;   // load.ts prepareLevel
  allPatches?: Patch[];   // load.ts prepareLevel
  solidsDirty?: boolean;   // highway.ts
  fixed?: boolean;   // stagegen.ts
  gen?: StageRecipe;   // stagegen.ts: a generated stage's recipe (world/levels/category.ts)
  roadTypes?: Record<string, string>;   // highway.ts: the road types setup offers, key -> name
  // highway.ts: the themes setup offers (presets.ts HW_THEMES), each with its road types
  themes?: Record<string, { name: string; roads: Record<string, string> }>;
  litter?: number;   // main.ts, highway levels
  roadType?: string;   // highway.ts
  _layout?: number;   // highway.ts
  barriers?: Barrier[];
  solids?: Solid[];
  crossings?: Crossing[];   // its drivable bridges and tunnels (world/crossings.ts)
  paint: Paint[];
  boards: Board[];
  cones: Cone[];
  spawn: Spawn;
  zones: Zone[];
  bumps: Bump[];
  props?: Prop[];
  lamps?: Prop[];   // hand-placed lamps (streetlight / floodlight; world/lampplan.ts adds more)
  bounds?: Rect;
  floor?: number;
  subtrack?: Subtrack;
  lanes?: Lane[];
  base?: Surface;
  bankAngle?: number;   // radians; banked ovals only
  // the ground's height off the road (world/terrain.ts bumpAt; Deaf Valley's gorges: highway/
  // gorge.ts): m added at a road distance and an offset (+ the +normal side), the road's half
  // width, the ground point
  roadside?: (dist: number, offset: number, halfWidth: number,
    at: { x: number; y: number }) => number;
  camber?: Camber;
  _bumpGridOf?: Bump[] | null;   // terrain.ts bumpAt: the list the grid was built from
  _bumpGrid?: Map<number, Bump[]>;   // terrain.ts bumpAt
  covers?: Cover[];
  obstacles?: Obstacle[];
  endless?: boolean;   // blend.ts: the 100 km highway
  _coversBase?: Cover[];   // blend.ts: the hand-placed covers
  _staticCovers?: Cover[];   // load.ts: the covers the weather does not move (puddles.ts)
  _hw?: HighwayState;   // highway.ts: the endless road (only the fields the camera reads)
  _mergedOf?: Cover[];   // ground.ts mergedCovers: the covers list _merged was built from
  _merged?: MergedCover[];   // ground.ts mergedCovers
  _line?: RacingLine;   // ai/line.ts racingLine: the racing line, cached
  // stagegen.ts addStageLevels: a rally stage, generated on first use (load.ts buildLevel)
  _build?: () => Level;
  // a level built on first use: its lap, m, read before it is (the menu: levels/category.ts lapOf)
  _lap?: () => number;
  _branches?: Branches;   // ai/line.ts racingLine: the joker / start lane paths, cached
  bushes?: BushPlan;   // where its bushes grow (world/bushplan.ts)
  _bushes?: Patch[];   // load.ts prepareLevel: its bushes, planned once
  _streamed?: Patch[];   // highway/gorge.ts: its streamed zones' edge blend (load.ts reindex)
}

// One 0.5 m cell of a merged cover group.
export interface MergedCell {
  x: number;
  y: number;
  gx: number;
  gy: number;
  base?: string;   // the ground under it (a puddle's tint), looked up once
}

// All covers of one kind joined (ground.ts mergedCovers); rim = cells with an outside neighbour.
export interface MergedCover {
  kind: CoverId;
  cells: MergedCell[];
  rim: MergedCell[];
  bb: [number, number, number, number];
  G: number;
}

// LEVEL._hw as the camera reads it: the look-ahead direction and the road points' distance.
export type HighwayState = HwState;   // highway/hwtypes.ts

// One resampled centre-line point of a subtrack.
export interface TrackPoint {
  x: number;
  y: number;
  dist: number;
  dirX: number;
  dirY: number;
  nx: number;
  ny: number;
  heading: number;
  width: number;
}

// A stretch of the lap with its own surface; startDist > endDist wraps over the start line.
export interface Sector {
  startDist: number;
  endDist: number;
  surface: Surface;
}

// A kerb along the road edge. 'left' = the +normal side.
export interface CurvedKerb {
  side: 'left' | 'right';
  startDist: number;
  endDist: number;
  width: number;
  h: number;
}

// One padded road segment of the lookup grid.
export interface SubSeg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  dx: number;
  dy: number;
  l2: number;
  len: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  ghost?: boolean;   // set by ghostSegment
}

// What createSubtrack returns (the track centre line and its lookup grid).
export interface Subtrack {
  pts: TrackPoint[];
  segs: SubSeg[];
  totalDist: number;
  width: number;
  sectors: Sector[];
  sectorAt: (dist: number) => Sector | { surface: Surface };
  curvedKerbs: CurvedKerb[];
  grid: Map<number, number[]>;
  ghost?: { d0: number; d1: number };   // ghostSegment
  noLines?: boolean;   // stagegen.ts
  laneDash?: number[];   // highway.ts
  laneSolid?: number[];   // highway.ts
  sBase?: number;   // highway.ts
  _camber?: Float32Array;   // terrain.ts camberHeightAt
  _camberCfg?: Camber;   // terrain.ts camberHeightAt
  layoutId?: number;   // highway.ts, grass-track.js: a new value means cached ground is stale
}

// Options of autoKerbs (all optional; defaults in subtrack.ts).
export interface AutoKerbOptions {
  maxR?: number;
  exitR?: number;
  width?: number;
  h?: number;
  heavyR?: number;
  heavyW?: number;
  heavyH?: number;
  minTurn?: number;
  mergeGap?: number;
}

// Options of traceTrack (all optional; defaults in subtrack.ts).
export interface TraceOptions {
  mpp?: number;
  cx?: number;
  cy?: number;
  step?: number;
  rMin?: number;
  passes?: number;
  kern?: number;
}
// A ribbon of one surface along an open polyline (pit lanes, access roads).
// _segs/_bb are cached by laneAt.
export interface Lane {
  pts: Point[];
  width: number;
  surface: Surface;
  out?: number;   // gravel traps only (see Trap)
  _s?: number;   // highway.ts: the road distance it is dropped behind with
  field?: number;   // highway/fields.ts: the field (village) it belongs to
  // a canyon's rock wall (highway/canyon.ts): the rock behind its face, and its strata lines
  band?: Point[]; strata?: Point[][];
  _segs?: { ax: number; ay: number; dx: number; dy: number; l2: number }[];
  _bb?: [number, number, number, number];
}

// What querySubtrack returns; seg is absent on the no-subtrack early return, null off the grid.
export interface SubtrackHit {
  dist: number;
  side: 'left' | 'right';
  trackDist: number;
  seg?: number | null;
}

// Options of outerTyreWall (all optional; defaults in tyrewall.ts).
export interface TyreWallOptions {
  margin?: number;
  spacing?: number;
  clear?: ClearBox[];
}

// A box {x, y, hw, hh} the tyre wall must leave a gap round.
export interface ClearBox {
  x: number;
  y: number;
  hw: number;
  hh: number;
}

// LEVEL.camber: track camber settings (terrain.ts camberTable).
export interface Camber {
  maxDeg: number;
  refR: number;
  crown?: number;
  edge?: number;
  // side: +1 / -1 banks that way regardless of the bend (an oval's turns and straights)
  sections?: { from: number; to: number; deg: number; side?: 1 | -1 }[];
}

// One cell of terrain.ts's natural-ground cache: amplitude (m) of each noise family.
export interface NatCell {
  small: number;
  medium: number;
  rolling: number;
  whoops: number;
  zero?: boolean;   // set by natCell
}

// What slopeAt / visualSlopeAt return: the height gradient.
export interface Slope {
  gx: number;
  gy: number;
}

// What trackKit (levels/kit.ts) returns: the placement helpers of one track.
export interface TrackKit {
  rnd: () => number;
  at: (d: number, off: number) => { x: number; y: number };
  rot: (d: number) => number;
  prop: (d: number, off: number, o: Omit<Prop, 'x' | 'y'>) => Prop;
  clear: (x: number, y: number, reach: number) => boolean;
  span: (d0: number, d1: number) => number;
  bank: (d0: number, d1: number, off: number, r: number, h: number) => Bump[];
  along: (d0: number, d1: number, off: number, step: number) => Point[];
  onLane: (x: number, y: number, pad: number) => boolean;
}

// A gravel trap lane (rallycross / Brands levels): a Lane plus its side (out) and lap span d0-d1.
export interface Trap extends Lane {
  out: number;
  d0: number;
  d1: number;
}
