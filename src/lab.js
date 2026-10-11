// lab.js — THE SCENE, as data (PLAN.md / CLAUDE.md §6: never hard-code a position that should be a
// number in a file; the first request after the first drive is "move that three metres closer").
//
// A proving-ground floor: pale, bounded by a hazard kerb (A4), with painted figures that give the eye
// something to measure speed and drift angle against, and cones to aim at.
import { parkMiller } from "./core/random.ts";
import { setFloor, setRect } from "./world/bounds.js";
export * from "./world/bounds.js";
import { RUNOFF_W, FLOOR, FX0, FX1, FY0, FY1, KERB_W, KERB_H, KERB_MU, KERB_RIDGE, KERB_RIDGE_L, RUNOFF_MU, RUNOFF_ROUGH, edgeOut } from "./world/bounds.js";
const COL_GRAVEL_TRACK = '150,134,106';   // rgb of a rut ploughed through gravel — warm, not black
const COL_GRASS_SCUFF  = '92,112,66';     // rgb of torn turf
// =============================================================================================
// SURFACES (user, 2026-09-28: "we should have road surfaces - tarmac - the lab - gravel - grass.
// They should all affect driving conditions differently and realistically").
//
// A surface is FOUR independent physical properties, not a grip number. Getting this wrong is the
// classic mistake: if a loose surface is only "tarmac with less mu" it feels like WET tarmac —
// slippery and vague — rather than loose, and you cannot drive it sideways on purpose.
//
//   mu      peak friction coefficient. How much grip there is at all.
//   peakK   multiplies the SLIP ANGLE at which grip peaks. THE ONE THAT MATTERS MOST for feel.
//           Tarmac peaks at ~7 deg; gravel digs a wedge into the loose layer and peaks at 15-25,
//           with a gentler falloff past it. That is why a rally car lives sideways on gravel and
//           why the identical input spins you on tarmac. See vehicle.js tyreLateral.
//   plough  m/s^2 of bulldozing drag. Nothing to do with friction: the wheel displaces material.
//           Zero on anything hard. This is what actually stops a car in a gravel trap.
//           MEASURED AGAINST REALITY, 2026-09-28 (user: "mud and sand seem too hard to drive in" and
//           "should look and be accurate to real life"). These had been tuned by feel, and feel was
//           wrong: mud was 5.2 where published rolling-resistance coefficients for deep mud (Crr
//           0.10-0.25) give 1.0-2.5 m/s^2, i.e. I had it at 2.1x the realistic MAXIMUM. Sand was 1.5x
//           and gravel 2.3x. Every figure below is now Crr * g from vehicle-engineering references:
//             tarmac 0.010-0.015   gravel road 0.020-0.035   grass 0.050-0.080
//             snow   0.030-0.120   deep mud    0.100-0.250   loose sand 0.150-0.300
//           Mid-band, NOT the top of it, and here is the reason — it is a real coupling I had missed.
//           Ploughing drags on ALL FOUR wheels, but a two-wheel-drive car can only push through ONE
//           axle's share of the weight. At the top of the sand band (2.7 m/s^2) the drag exceeded the
//           traction a RWD hatch could generate (0.5 * mu * longK * g = 2.3 m/s^2) and the car could not
//           move AT ALL — which is what the user hit. It survives as an emergent property rather than a
//           rule: 4WD still walks out of sand and mud where 2WD wallows, because it drives through twice
//           the weight against the same drag.
//   rough   m of surface height noise, fed to the suspension. Decides how much the car is working
//           just to stay on the ground, so it is what makes soft springs pay on gravel.
//
// mark is what a wheel leaves behind (read by marks.js, which knows nothing about any of these).
const MARK_GRAVEL = { rgb: COL_GRAVEL_TRACK, widen: 2.4, alpha: 0.13 };
const MARK_GRASS = { rgb: COL_GRASS_SCUFF, widen: 1.9, alpha: 0.10 };
const MARK_DIRT = { rgb: '98,74,52', widen: 2.3, alpha: 0.16 };
const MARK_GRASS_LONG = { rgb: '76,96,52', widen: 2.1, alpha: 0.14 };
const MARK_SNOW = { rgb: '138,152,170', widen: 2.2, alpha: 0.14 };   // compressed snow, blue-grey
const MARK_MUD = { rgb: '58,42,30', widen: 2.6, alpha: 0.20 };       // deep dark ruts, the clearest of all
// THICK MUD's OWN, darker mark (2026-10-07; user: tracks on mud "vanish or morph weirdly as the surface gets degraded to thick mud" -
// "should darken if anything"; tools/_mudtracks.mjs). MEASURED: MARK_MUD (58,42,30) IS thick mud's base colour (#3a291d), so on a worn
// cell the same tracks went 11 -> 7 luminance darker than their ground (pass 2 -> 4) and read as the ripple art instead. Wetter, darker.
const MARK_THICK_MUD = { rgb: '34,23,15', widen: 2.6, alpha: 0.17 };   // 22,14,9 @ 0.26 photographed near-BLACK by pass 6: softened
const MARK_SAND = { rgb: '176,152,112', widen: 2.5, alpha: 0.14 };
// Wet tarmac is the odd one: a tyre does not darken it, it DRIES it. So the mark is lighter than the
// surface, which is why the trail behind a car on a wet track is the one you can actually see.
const MARK_WET = { rgb: '196,199,208', widen: 1.6, alpha: 0.16 };

// SPRAY — what a wheel THROWS UP off a loose surface (user, 2026-09-28: "floor with a loose surface like
// snow mud sand or grass should particle emit and small and kick up dust / dirt / grass / snow").
// Read by render.js, which never learns what any of these are; a surface without one throws nothing.
//   rgb    colour of the thrown material
//   size   metres, roughly the radius of one clod
//   rate   particles per second per wheel at full chat — what makes dust billow and clods scatter
//   lift   how far it is flung (m/s); heavy clods drop near the car, fine dust drifts
//   life   seconds. Dust hangs; wet spray and mud do not.
//   grow   how much it expands as it ages. Dust blooms, a clod of mud does not.
// MEASURED BUG, 2026-09-28 (photographed): the first set of colours was sampled FROM each surface, so
// the spray came out the same tone as the ground it left and vanished into that ground's own grain. A
// car drifting on gravel at 103 km/h was throwing ~13 particles a frame and you could not see one.
// Thrown material is AIRBORNE — it catches light and reads PALER and hazier than the packed surface
// beneath it, except wet clods which read darker. Pick for contrast against the surface, never to
// match it (CLAUDE.md §4: if the player cannot find it, it does not exist).
const SPRAY_GRAVEL = { rgb: '222,210,184', size: 0.22, rate: 62, lift: 5.2, life: 0.55, grow: 0.60 };
const SPRAY_GRASS  = { rgb: '152,190,106', size: 0.18, rate: 48, lift: 4.4, life: 0.46, grow: 0.22 };
const SPRAY_DIRT   = { rgb: '190,160,122', size: 0.22, rate: 66, lift: 4.8, life: 0.60, grow: 0.70 };
const SPRAY_GRASS_LONG = { rgb: '136,174,90', size: 0.22, rate: 58, lift: 4.6, life: 0.50, grow: 0.28 };
const SPRAY_MUD    = { rgb: '64,46,30',    size: 0.26, rate: 42, lift: 3.4, life: 0.62, grow: 0.10 };
const SPRAY_SAND   = { rgb: '244,230,200', size: 0.20, rate: 70, lift: 3.8, life: 0.85, grow: 0.95 };
const SPRAY_SNOW   = { rgb: '255,255,255', size: 0.24, rate: 76, lift: 4.8, life: 0.75, grow: 0.85 };
const SPRAY_WET    = { rgb: '232,238,248', size: 0.15, rate: 54, lift: 3.0, life: 0.28, grow: 0.50 };

// RETUNED 2026-09-28 (user: "can the floor styles feel slightly more unique to drive on - grass mud and
// gravel feel too similar"). They WERE too similar, and the reason is instructive: all three were built
// the same way — take grip off, add slip angle, add some drag. Three points on one line is one surface
// with three names.
//
// The fix is to give each a DIFFERENT DOMINANT PROPERTY, so they fail you in different ways:
//   GRAVEL  slidey and FAST. Drag cut 1.1 -> 0.8 and longK raised to 1.30: stones pack under a driven
//           wheel, so you can put the power down and it bites even while the back is out. You carry
//           speed. The thing that beats you is the corner you cannot tighten.
//   GRASS   skatey and FAST. A thin slick layer over hard ground, so it barely ploughs at all (2.0 ->
//           0.4) and its peak comes EARLY (1.60 -> 1.25). You keep your speed and lose your steering —
//           nearer to bumpy ice than to mud. The thing that beats you is that nothing happens when you
//           turn the wheel.
//   MUD     heavy and SLOW. The biggest drag on the board (3.4 -> 5.2) and longK 0.65, so the wheels
//           just churn. You can point it, you simply cannot go anywhere. The thing that beats you is
//           being bogged.
// Measured spread after the change is in tools/surfacecheck.mjs test 5.
//
// longK  — longitudinal grip relative to lateral. Above 1 means a driven wheel finds more bite than a
//          cornering one (loose stones pack, snow compacts); below 1 means it just spins (mud, sand).
//          This is why gravel rewards power and mud swallows it.
// spray  — what the wheels throw up. Read by render.js, which knows nothing about any of these.
export const SURFACES = {
  // THE LAB FLOOR — the reference. Sealed, polished, dead flat. Every bench number in tools/ was
  // measured on this, so its numbers are 1.0 by definition and must stay that way.
  lab:        { id: 'lab', label: 'LAB FLOOR', mu: 1.00, peakK: 1.00, longK: 1.00, plough: 0, rough: 0, mark: null, spray: null, hard: true },
  // RACE TARMAC — closed racing circuit asphalt. Smooth, clean, and high-grip (1.06).
  racetarmac: { id: 'racetarmac', label: 'RACE TARMAC', mu: 1.06, peakK: 1.00, longK: 1.02, plough: 0, rough: 0.0005, mark: null, spray: null, hard: true },
  // REAL TARMAC — a public road, not a proving ground. Slightly less grip and slightly textured.
  tarmac:     { id: 'tarmac', label: 'TARMAC', mu: 0.94, peakK: 1.00, longK: 1.00, plough: 0, rough: 0.002, mark: null, spray: null, hard: true },
  // DIRT ROAD — between gravel and mud. Packed sub-base with loose top: allows speed, drifts cleanly.
  dirt:       { id: 'dirt', label: 'DIRT ROAD', mu: 0.56, peakK: 2.10, longK: 1.15, plough: 0, rough: 0.009, mark: MARK_DIRT, spray: SPRAY_DIRT },
  // RALLY GRAVEL — a loose layer over a hard base. Drivable FAST, and only sideways.
  gravel:     { id: 'gravel', label: 'RALLY GRAVEL', mu: 0.62, peakK: 2.40, longK: 1.30, plough: 0.25, rough: 0.012, mark: MARK_GRAVEL, spray: SPRAY_GRAVEL },
  // GRASS / SHORT GRASS — mown grass. Slick skin over hard ground.
  grass:      { id: 'grass', label: 'GRASS', mu: 0.34, peakK: 1.25, longK: 0.85, plough: 0, rough: 0.014, mark: MARK_GRASS, spray: SPRAY_GRASS },
  grassShort: { id: 'grassShort', label: 'SHORT GRASS', mu: 0.34, peakK: 1.25, longK: 0.85, plough: 0, rough: 0.014, mark: MARK_GRASS, spray: SPRAY_GRASS },
  // LONG GRASS — un-mown pasture. Taller, deeper, more drag and height variation.
  // plough 0.10 -> 0.35 (user, 2026-10-03: "long grass to grab slightly ... until it's driven over enough to become
  // short grass" — 2 passes, BASE_WEAR). MEASURED vs short grass, hatch-fwd / muscle: 0-50 km/h 7.56 -> 8.58 s /
  // 7.70 -> 8.88 s; coasting 50 -> 4 km/h 502 -> 205 m / 469 -> 198 m. (0.10 was 368 m — barely felt; 0.5 / 0.7 tried:
  // 162 / 127 m, 9.2 / 10.2 s — more than "slightly".)
  grassLong:  { id: 'grassLong', label: 'LONG GRASS', mu: 0.36, peakK: 1.30, longK: 0.82, plough: 0.35, rough: 0.024, mark: MARK_GRASS_LONG, spray: SPRAY_GRASS_LONG },
  // THE KERB — painted concrete. Hard, so no ploughing; slippery when you are on the paint.
  kerb:       { id: 'kerb', label: 'KERB', mu: KERB_MU, peakK: 1.00, longK: 1.00, plough: 0, rough: 0, mark: null, spray: null, hard: true },

  // ---- THE LOW-FRICTION PANELS
  ice:    { id: 'ice', label: 'ICE', mu: 0.12, peakK: 0.70, longK: 1.00, plough: 0, rough: 0.001, mark: null, spray: null, coolK: 0.25 },
  // PACKED SNOW (2026-10-04, generated snow stages: a snow road drawn white on white could not be seen): a rolled snow road, blue-grey,
  // mu a little above loose snow; everything else as snow
  packedSnow: { id: 'packedSnow', label: 'PACKED SNOW', mu: 0.36, peakK: 1.90, longK: 1.10, plough: 0.6, rough: 0.005, mark: MARK_SNOW, spray: SPRAY_SNOW, coolK: 0.25 },
  snow:   { id: 'snow', label: 'SNOW', mu: 0.32, peakK: 2.00, longK: 1.10, plough: 1.00, rough: 0.006, mark: MARK_SNOW, spray: SPRAY_SNOW, coolK: 0.25 },
  wet:    { id: 'wet', label: 'WET TARMAC', mu: 0.72, peakK: 0.95, longK: 0.92, plough: 0, rough: 0.002, mark: MARK_WET, spray: SPRAY_WET, hard: true, coolK: 0.18 },
  mud:    { id: 'mud', label: 'MUD', mu: 0.45, peakK: 2.20, longK: 0.85, plough: 1.60, rough: 0.010, mark: MARK_MUD, spray: SPRAY_MUD },
  // THICK MUD (user, 2026-10-03: "two types of mud ... mud turns to thick mud"). Same family as mud, but
  // the bog: less grip, driven wheels churn, and it drags harder than mud. SIZED TO THE STALL LINE (see the
  // plough note above): a 2WD car drives through one axle, so RWD traction ~ 0.5*mu*longK*g = 1.30 m/s^2,
  // and drag at a crawl is plough*PLOUGH_CRAWL = 1.9*0.55 = 1.05 — 81% of it. Bogged, never stuck dead.
  // (First cut was mu 0.36 / longK 0.60 / plough 3.4: 1.87 drag vs 1.06 traction = a RWD car cannot move.)
  thickMud: { id: 'thickMud', label: 'THICK MUD', mu: 0.38, peakK: 2.40, longK: 0.70, plough: 1.90, rough: 0.018, mark: MARK_THICK_MUD, spray: SPRAY_MUD },
  broken: { id: 'broken', label: 'BROKEN TARMAC', mu: 0.86, peakK: 1.00, longK: 1.00, plough: 0, rough: 0.022, mark: null, spray: null, hard: true },
  // CONCRETE (2026-10-03, roadmap B1: airfield runways, pit lanes, paddocks). A touch less grip than good tarmac, smooth, hard.
  concrete: { id: 'concrete', label: 'CONCRETE', mu: 0.90, peakK: 1.00, longK: 1.00, plough: 0, rough: 0.004, mark: null, spray: null, hard: true },
  sand:   { id: 'sand', label: 'SAND', mu: 0.55, peakK: 2.20, longK: 0.92, plough: 1.90, rough: 0.008, mark: MARK_SAND, spray: SPRAY_SAND },
};
// TYRE COOLING by surface (2026-10-03): hard surfaces (above) do not cool tyres; everything loose or cold does.
// coolK is 1/s toward ambient, on top of the always-on cooling in vehicle.js. Stated where it matters (wet, snow,
// ice); every other non-hard surface gets OFFROAD_COOL here, so a new surface cannot silently skip it.
// Cold and wet ground pulls heat out faster (user, 2026-10-03): snow / ice 0.25, puddles 0.20, wet tarmac 0.18,
// thick mud 0.12, mud 0.10; dry loose ground (grass, dirt, gravel, sand) OFFROAD_COOL.
const OFFROAD_COOL = 0.06;
SURFACES.mud.coolK = 0.10; SURFACES.thickMud.coolK = 0.12;
for (const sf of Object.values(SURFACES)) if (!sf.hard && sf.coolK === undefined) sf.coolK = OFFROAD_COOL;
export const SURFACE_TARMAC = SURFACES.lab;   // what a car spawns on by default    // what a car spawns on; kept under the old name

// THE GRAVEL TRAP is a different thing from rally gravel, and both exist. A trap is DEEP gravel whose
// entire job is to stop you: five times the ploughing, and GRADED — shallow pea gravel at the lip,
// deep stuff at the barrier — so the further in you go the harder it grabs. That grading is what makes
// a half-spin at the edge survivable and a flat-out excursion not.
export const RUNOFF_PLOUGH = 5.0;    // m/s^2 at the lip. 0.51 g, rising to 0.76 g at the barrier — the
                                     // band real FIA gravel traps are designed to. A TRAP is far deeper
                                     // than any rally road, which is why this is ~8x the gravel figure.
export const RUNOFF_GRADE = 1.5;     // multiplier at the fence
const TRAP_STEPS = 12;               // built once at load, indexed by depth: groundAt never allocates
const SURFACE_TRAP = Array.from({ length: TRAP_STEPS }, (_, i) => ({
  id: 'trap', coolK: 0.06, mu: RUNOFF_MU, peakK: 2.00, rough: RUNOFF_ROUGH, mark: MARK_GRAVEL,
  plough: RUNOFF_PLOUGH * (1 + (RUNOFF_GRADE - 1) * (i / (TRAP_STEPS - 1))),
}));

// GRASS VERGE between the kerb and the trap, which is how real circuits are built: you get a strip of
// grass to gather it up on before the gravel takes the decision away from you.
export const VERGE_W = 9;

// ---------------------------------------------------------------------------------------------
// ZONES — every patch of surface on the floor, as ONE mechanism. A zone is a centred rectangle with a
// surface on it; first hit wins, and anything uncovered is the level's base surface. The lab's four
// quadrants and its low-friction panels are now the same kind of object with different numbers, which
// is what lets a second level lay its surfaces out completely differently for free.
//
// `boxed` only affects DRAWING — a rim and a painted name, for a test panel you are meant to aim at.
export const PAD_APRON = 1.2;   // m of tarmac round a rounded test pad (drawn by render.js drawZones)
// |dx|, |dy| from the centre inside a rectangle of half-size hw x hh with corner radius R
function inRoundRect(dx, dy, hw, hh, R) {
  if (dx > hw || dy > hh) return false;
  const ix = dx - (hw - R), iy = dy - (hh - R);
  return ix <= 0 || iy <= 0 || ix * ix + iy * iy <= R * R;
}
// LANES (2026-10-04, Thruston pit lane): LEVEL.lanes [{ pts: [[x,y]...] open polyline, width, surface }] — a ribbon of one surface
// along a path, for pit lanes and access roads. Drawn by render.js drawLanes from the same pts and width.
function laneAt(x, y) {
  const list = LEVEL.lanes;
  if (!list) return null;
  for (const ln of list) {
    if (!ln._segs) {
      ln._segs = []; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < ln.pts.length - 1; i++) {
        const [ax, ay] = ln.pts[i], [bx, by] = ln.pts[i + 1], dx = bx - ax, dy = by - ay;
        ln._segs.push({ ax, ay, dx, dy, l2: dx * dx + dy * dy || 1e-6 });
        x0 = Math.min(x0, ax, bx); y0 = Math.min(y0, ay, by); x1 = Math.max(x1, ax, bx); y1 = Math.max(y1, ay, by);
      }
      const h = ln.width / 2; ln._bb = [x0 - h, y0 - h, x1 + h, y1 + h];
    }
    const b = ln._bb; if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    const h2 = (ln.width / 2) ** 2;
    for (const g of ln._segs) {
      let t = ((x - g.ax) * g.dx + (y - g.ay) * g.dy) / g.l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x - g.ax - g.dx * t, ey = y - g.ay - g.dy * t;
      if (ex * ex + ey * ey <= h2) return ln.surface;
    }
  }
  return null;
}
function zoneAt(x, y) {
  // 1. If on a circuit with defined track sectors: road ribbon has continuous sector texturing & curved kerbs
  if (LEVEL.subtrack && LEVEL.subtrack.sectors && LEVEL.subtrack.sectors.length > 0) {
    const q = querySubtrack(LEVEL.subtrack, x, y);
    const halfW = LEVEL.subtrack.width / 2;
    if (q.dist <= halfW) {
      const sec = LEVEL.subtrack.sectorAt ? LEVEL.subtrack.sectorAt(q.trackDist) : null;
      return (sec && sec.surface) ? sec.surface : SURFACES.tarmac;
    }
    // Check curved kerbs on corner apexes and exits
    if (LEVEL.subtrack.curvedKerbs) {
      for (let i = 0; i < LEVEL.subtrack.curvedKerbs.length; i++) {
        const k = LEVEL.subtrack.curvedKerbs[i];
        if (k.side === q.side && q.trackDist >= k.startDist && q.trackDist <= k.endDist) {
          if (q.dist <= halfW + (k.width || 2.4)) return SURFACES.kerb;
        }
      }
    }
  }

  // 1b. LANES (pit lanes, access roads): the track wins where they overlap (render draws lanes UNDER the ribbon to match)
  const ln = laneAt(x, y);
  if (ln) return ln;

  // 2. Dedicated proving ground test pads (Wet, Ice, Snow, Mud, Gravel)
  const z = LEVEL.zones;
  for (let i = 0; i < z.length; i++) {
    const q = z[i];
    if (q.rounded) {
      // ROUNDED PADS, exactly as render.js drawZones draws them: corner radius min(5, 0.15 w) and a PAD_APRON of tarmac
      // round the outside. MEASURED BUG, 2026-10-03 (tools/visualcheck.mjs): physics was the plain rectangle, so the
      // drawn tarmac apron drove as grass and the rounded-off corners drove as the pad's surface.
      const dx = Math.abs(x - q.x), dy = Math.abs(y - q.y), R = Math.min(5, q.w * 0.15);
      if (inRoundRect(dx, dy, q.w / 2, q.h / 2, R)) return q.surface;
      if (inRoundRect(dx, dy, q.w / 2 + PAD_APRON, q.h / 2 + PAD_APRON, R + PAD_APRON)) return SURFACES.tarmac;
      continue;
    }
    if (q.rot) {
      // ROTATED zone (2026-10-03: Thruston's diagonal airfield runways, traced from the real map). Cheap reject + cached trig (2026-10-06:
      // the highway's fields put ~80 rotated zones in the window, tested for every wheel off the road)
      const dx = x - q.x, dy = y - q.y;
      if (q._r === undefined) { q._r = Math.hypot(q.w, q.h) / 2; q._co = Math.cos(q.rot); q._si = Math.sin(q.rot); }
      if (dx * dx + dy * dy > q._r * q._r) continue;
      const co = q._co, si = q._si;
      if (Math.abs(dx * co + dy * si) <= q.w / 2 && Math.abs(-dx * si + dy * co) <= q.h / 2) return q.surface;
      continue;
    }
    if (Math.abs(x - q.x) <= q.w / 2 && Math.abs(y - q.y) <= q.h / 2) return q.surface;
  }
  return LEVEL.base;
}

// ---------------------------------------------------------------------------------------------
// BUMPS, JUMPS AND KERBS (user, 2026-09-28: "and some bumps / jumps / curbs").
//
// All four kinds are nothing but a HEIGHT added to the ground. That is the whole implementation: the
// suspension written for the boundary kerb already turns a height into light wheels, heavy landings and
// real airtime, so a jump needed no new physics at all — only a new shape to drive over.
//
// Every profile is SMOOTH where you drive onto it. A step in the height is an infinite ground velocity,
// and the springs answer an infinite velocity with an infinite load. The one deliberate exception is a
// ramp's LIP, where the ground genuinely does fall away — and that case is safe because the load clamps
// at zero and the body goes ballistic, which is exactly what leaving a ramp is.
const bumpKind = {
  // a round whoop. Drive over it at any angle; the further off-centre, the less you get.
  hump: (b, u, v) => {
    const d = Math.hypot(u, v) / b.r;
    if (d >= 1) return 0;
    const c = Math.cos((Math.PI / 2) * d);
    return b.h * c * c;
  },
  // a launch ramp: rises the whole way and then stops. u runs 0 at the foot to 1 at the lip.
  ramp: (b, u, v) => {
    const t = (u + b.len / 2) / b.len;
    if (t < 0 || t > 1) return 0;
    return b.h * t * t * across(v, b.wid);      // t^2: gentle at the foot, steepest at the lip
  },
  // a flat-top table jump: up, along, down. Landable, and the safer of the two jumps.
  table: (b, u, v) => {
    const t = (u + b.len / 2) / b.len;
    if (t < 0 || t > 1) return 0;
    const r = t < 0.3 ? t / 0.3 : t > 0.7 ? (1 - t) / 0.3 : 1;
    const s = Math.sin((Math.PI / 2) * r);
    return b.h * s * s * across(v, b.wid);
  },
  // a rumble kerb strip: a low hump across its width, ridged along its length. Same shape as the
  // boundary kerb, so it shakes the car for the same reason and by the same code.
  kerb: (b, u, v) => {
    const t = Math.abs(v) / (b.wid / 2);
    if (t >= 1 || Math.abs(u) > b.len / 2) return 0;
    const s = Math.cos((Math.PI / 2) * t);
    return (b.h * s * s) + KERB_RIDGE * s * Math.sin((u / KERB_RIDGE_L) * Math.PI * 2);
  },
};
// ---- TERRAIN SHAPES (step 3, 2026-10-03). The user's "vector dips": bumps push the car OUT and dips pull it IN, in any
// direction — that is gravity on the slope, applied in applyGround from slopeAt(). Each shape is smooth everywhere.
Object.assign(bumpKind, {
  // a round hollow: the hump turned upside down. d = depth (m), r = radius.
  dip: (b, u, v) => -bumpKind.hump({ r: b.r, h: b.d }, u, v),
  // WASHBOARD: short ripples across a strip. Felt through the suspension (chatter, grip loss) but deliberately left out
  // of the slope force (NO_SLOPE): a 1 m ripple pushing the car back and forth every step would be a judder.
  washboard: (b, u, v) => {
    if (Math.abs(u) > b.len / 2) return 0;
    const t = 1 - Math.abs(u) / (b.len / 2);
    const ends = Math.min(1, t * 6);                        // fade in over the first sixth so entry is not a step
    return b.amp * ends * across(v, b.wid) * (0.5 + 0.5 * Math.sin((u / b.wave) * Math.PI * 2));
  },
  // BANKED BOWL, DUG INTO the ground: floor h below ground out to r0, then a wall rising to ground level at R. MEASURED BUG (user: "I think the bowl on the lab is broken"): the first version was
  // RAISED, 2.5 m up a 6 m outer slope, so driving in at 50 km/h was a ramp — 2.17 s of airtime over the whole bowl.
  bowl: (b, u, v) => {
    const d = Math.hypot(u, v);
    if (d <= b.r0) return -b.h;
    // S-curve wall (sin^2): flat into the floor AND flat into the rim, steepest part-way up. MEASURED: the t^2 wall was
    // steepest AT the rim (0.42), and driving out at 50 km/h launched 0.96 s over the lip; now the lip has zero slope.
    if (d <= b.R) { const t = (d - b.r0) / (b.R - b.r0); const sn2 = Math.sin((Math.PI / 2) * t); return -b.h * (1 - sn2 * sn2); }
    return 0;
  },
});
const NO_SLOPE = new Set(['kerb', 'washboard']);   // felt by the suspension only, never a push

// taper to nothing at the edges, so clipping the side of a ramp gives you a wheel on and a wheel off
function across(v, wid) {
  const t = Math.abs(v) / (wid / 2);
  if (t >= 1) return 0;
  const c = Math.cos((Math.PI / 2) * t);
  return c * c;
}

// Height of every bump at a point. Bumps ADD, so two crossing kerbs make a crest rather than fighting.
// smooth = the height the SLOPE FORCE reads: no kerb ridges, no washboard ripples, no curved kerbs.
const BUMP_CELL = 16, NO_BUMPS = [];
function bumpAt(x, y, smooth = false) {
  const list = LEVEL.bumps;
  // ONE subtrack query per lookup, shared by the banking, the camber and the curved kerbs. MEASURED (2026-10-03, user: "still
  // seeing lag at high speeds"): three separate scans made a Test Track ground tile cost ~12 ms to shade on a PC.
  const st = LEVEL.subtrack;
  const q = st && (LEVEL.bankAngle || LEVEL.camber || (!smooth && st.curvedKerbs)) ? querySubtrack(st, x, y) : null;
  let h = bankHeightAt(x, y, q) + camberHeightAt(x, y, q) - rutAt(x, y) + naturalHeightAt(x, y);
  // BUMP GRID (2026-10-04): Thruston's earth banks took the list to 212 bumps and every height lookup scanned them all —
  // MEASURED ground tile 22 -> 28.7 ms, slow frames 71 -> 103 of 570 at CPU x4. Now only the bumps whose reach touches this cell.
  if (LEVEL._bumpGridOf !== list) {
    LEVEL._bumpGridOf = list; const grid = LEVEL._bumpGrid = new Map();
    for (const b of list) { const r = Math.sqrt(b.reach2);
      for (let cx = Math.floor((b.x - r) / BUMP_CELL); cx <= Math.floor((b.x + r) / BUMP_CELL); cx++)
        for (let cy = Math.floor((b.y - r) / BUMP_CELL); cy <= Math.floor((b.y + r) / BUMP_CELL); cy++) { const k = cx * 100003 + cy; const c = grid.get(k); if (c) c.push(b); else grid.set(k, [b]); } }
  }
  const cell = LEVEL._bumpGrid.get(Math.floor(x / BUMP_CELL) * 100003 + Math.floor(y / BUMP_CELL)) || NO_BUMPS;
  for (let i = 0; i < cell.length; i++) {
    const b = cell[i];
    if (smooth && NO_SLOPE.has(b.kind)) continue;
    const dx = x - b.x, dy = y - b.y;
    // cheap reject first: this runs twice per axle per physics step
    if (dx * dx + dy * dy > b.reach2) continue;
    const u = dx * b.cos + dy * b.sin;          // along the bump
    const v = -dx * b.sin + dy * b.cos;         // across it
    h += bumpKind[b.kind](b, u, v);
  }

  // Curved rumble kerbs along corner apexes and exits
  if (!smooth && LEVEL.subtrack && LEVEL.subtrack.curvedKerbs && q) {
    const halfW = LEVEL.subtrack.width / 2;
    for (let i = 0; i < LEVEL.subtrack.curvedKerbs.length; i++) {
      const k = LEVEL.subtrack.curvedKerbs[i];
      if (k.side === q.side && q.trackDist >= k.startDist && q.trackDist <= k.endDist) {
        const kw = k.width || 2.4;
        if (q.dist >= halfW && q.dist <= halfW + kw) {
          const t = (q.dist - halfW) / kw;
          const s = Math.sin(Math.PI * t);
          h += (k.h || 0.11) * s * s + KERB_RIDGE * s * Math.sin((q.trackDist / KERB_RIDGE_L) * Math.PI * 2);
        }
      }
    }
  }

  return h;
}

// BANKING AS REAL HEIGHT (step 3, 2026-10-03; replaces the sideways bank FORCE in applyGround). On a level with bankAngle,
// the track rises across its width in the turns: 0 at the inside edge, tan(bank) x width at the outside, then a back
// slope down to the ground beyond the outer edge (no cliff). Turns = |x| beyond BANK_X0, blended in over BANK_BLEND m so
// the straights stay flat with no step. Gravity on that slope (slopeAt) is what pulls a slow car down the banking now.
// BLEND 60 m (was 30 at first cut): a 7 m outer edge rising over 30 m is a 23% ramp at 200 km/h — a launch. BACK 16 m:
// at 8 m the back slope was 52 deg.
const BANK_X0 = 100, BANK_BLEND = 60, BANK_BACK = 16;
// bump steer strength (see applyGround). Exported object so tools can sweep it.
// k 1 (user: "dips and whoops should GENTLY affect steering"). MEASURED hands-off through a whole Lab lane, 1.5 m off its
// line at 50 km/h: whoops turn the car 0.6 -> 3.5 deg away, dips 0.3 -> 3.3 deg into them; k 2 / 3 gave 4.8 / 5.7 deg.
export const BUMP_STEER = { k: 1 };
function bankHeightAt(x, y, qIn) {
  const st = LEVEL.subtrack;
  if (!LEVEL.bankAngle || !st) return 0;
  const w = Math.min(1, Math.max(0, (Math.abs(x) - BANK_X0) / BANK_BLEND));
  if (w <= 0) return 0;
  const q = qIn || querySubtrack(st, x, y);
  if (!Number.isFinite(q.dist) || q.seg == null) return 0;
  const hw = st.width / 2;
  // which side is the infield: the oval is convex, so the side facing the origin. q.side 'left' = +normal side.
  const seg = st.segs[q.seg];
  const nx = -seg.dy, ny = seg.dx;
  const leftIsInside = (nx * -x + ny * -y) >= 0;
  const outward = (q.side === 'left') === leftIsInside ? -q.dist : q.dist;   // + toward the OUTSIDE of the turn
  const top = Math.tan(LEVEL.bankAngle) * st.width;
  let h;
  if (outward <= -hw) h = 0;
  else if (outward <= hw) h = Math.tan(LEVEL.bankAngle) * (outward + hw);
  else if (outward <= hw + BANK_BACK) { const t = (outward - hw) / BANK_BACK; const cc = Math.cos((Math.PI / 2) * t); h = top * cc * cc; }
  else h = 0;
  return h * (w * w * (3 - 2 * w));
}
// TRACK CAMBER (user, 2026-10-03: "can the Test Track get cambering across the race surface"; and earlier: camber "positive,
// negative, whether it's useful to drive on, which can also match real tracks"). LEVEL.camber = { maxDeg, refR, crown, edge,
// sections: [{ from, to, deg }] } (from / to in metres of track distance; deg signed: + helps you round the corner, - falls
// away = OFF-CAMBER). Default per segment: corners get + camber scaled by tightness (maxDeg at refR or tighter), straights
// a CROWN (centre high, both edges lower — how real circuits drain), and the surface eases back to the ground over `edge` m
// beyond the ribbon. Smoothed along the track so no section boundary is a step.
function camberTable(st, cfg) {
  const n = st.pts.length, deg = new Float32Array(n), turn = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    const a0 = st.pts[(i - 3 + n) % n], a1 = st.pts[(i + 3) % n];
    let dh = a1.heading - a0.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    const len = Math.max(1, ((a1.dist - a0.dist) + st.totalDist) % st.totalDist);
    const R = len / Math.max(1e-4, Math.abs(dh));
    turn[i] = dh > 0 ? 1 : -1;
    deg[i] = Math.min(cfg.maxDeg, cfg.maxDeg * cfg.refR / R);
    for (const sec of cfg.sections || []) if (st.pts[i].dist >= sec.from && st.pts[i].dist < sec.to) deg[i] = sec.deg;
  }
  // smooth along the track (moving average over +-6 points) so a section boundary is never a step
  const sm = new Float32Array(n);
  for (let i = 0; i < n; i++) { let t = 0; for (let k = -6; k <= 6; k++) t += deg[(i + k + n) % n] * turn[(i + k + n) % n]; sm[i] = t / 13; }
  return sm;   // signed: + = camber toward the inside of a RIGHT turn (+normal side low)
}
function camberHeightAt(x, y, qIn) {
  const st = LEVEL.subtrack, cfg = LEVEL.camber;
  if (!cfg || !st) return 0;
  if (!st._camber || st._camberCfg !== cfg) { st._camber = camberTable(st, cfg); st._camberCfg = cfg; }
  const q = qIn || querySubtrack(st, x, y);
  if (!Number.isFinite(q.dist) || q.seg == null) return 0;
  const hw = st.width / 2, edge = cfg.edge || 6;
  if (q.dist > hw + edge) return 0;
  const i = q.seg, j = (i + 1) % st.pts.length, seg = st.segs[i];
  const tt = Math.max(0, Math.min(1, (q.trackDist - st.pts[i].dist) / (seg.len || 1)));
  const sDeg = st._camber[i] * (1 - tt) + st._camber[j] * tt;              // signed camber here
  const o = q.side === 'left' ? q.dist : -q.dist;                            // offset along +normal
  // + camber lowers the +normal side (inside of a right turn): h = -tan(cam) x offset, zero on the centreline
  const oc = Math.max(-hw, Math.min(hw, o));
  const crownW = Math.max(0, 1 - Math.abs(sDeg) / Math.max(0.1, cfg.maxDeg));   // crown fades out as the corner bites
  let h = -Math.tan((sDeg * Math.PI) / 180) * oc + (cfg.crown || 0) * crownW * (hw - Math.abs(oc));
  // shift so the LOWEST edge sits at ground level (the surface is built UP from the ground, never dug into it)
  const lowEdge = Math.min(-Math.tan((sDeg * Math.PI) / 180) * hw, Math.tan((sDeg * Math.PI) / 180) * hw);
  h -= lowEdge;
  // beyond the ribbon, ease back down to the ground
  if (q.dist > hw) { const tE = (q.dist - hw) / edge, c = Math.cos((Math.PI / 2) * tE); h *= c * c; }
  return h;
}
// NATURAL GROUND (user, 2026-10-03): "loose surfaces should naturally have some random light vector dips and whoops — gravel %
// more likely to have SMALL dips and bumps, mud MEDIUM AGGRESSIVE dips and bumps, grass AVERAGE and ROLLING HILLS vibe, sand
// WHOOPS or bumps and dips". Four smooth noise families, each with a fixed size; every BASE surface sets how much of each
// it has (metres of amplitude). Hard surfaces (tarmac, kerbs, the lab floor) have none. The amplitudes live on a NAT_CELL
// grid, averaged over the cell and interpolated between cells, so where gravel meets tarmac the bumps FADE over a few
// metres instead of stepping (a step is an infinite slope). Seeded per level, so a track is the same every visit.
const NAT_CELL = 3;
const NAT_FAMILY = {            // wavelength (m) of each family
  small: 2.5,                   // gravel chatter
  medium: 4.5,                  // mud: medium, aggressive (sharpened)
  rolling: 26,                  // grass: rolling hills (+ a half-size octave)
  whoops: 6,                    // sand: whoops / dunes (squared, so mostly crests)
};
const NAT_SURF = {              // base id -> { family: amplitude m }
  gravel: { small: 0.045 }, rally: { small: 0.05 },
  dirt: { small: 0.03, rolling: 0.10 },
  mud: { medium: 0.10 }, thickMud: { medium: 0.15 },
  grass: { rolling: 0.25, small: 0.01 }, grassShort: { rolling: 0.22, small: 0.01 }, grassLong: { rolling: 0.30, small: 0.015 },
  sand: { whoops: 0.15, small: 0.02 },
  snow: { small: 0.02 },
};
function hash2(i, j, seed) { let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, seed) {   // smooth value noise, -1..1
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j, seed), b = hash2(i + 1, j, seed), c = hash2(i, j + 1, seed), d = hash2(i + 1, j + 1, seed);
  return ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v) * 2 - 1;
}
let natCache = new Map(), natLevel = null, natSeed = 0;
// NUMBER keys (perf, 2026-10-03): string keys made every height lookup ~5x slower (0.04 -> 0.7 us).
function natCell(i, j) {
  const key = (i + 32768) * 65536 + (j + 32768);
  let c = natCache.get(key);
  if (c) return c;
  c = { small: 0, medium: 0, rolling: 0, whoops: 0 };
  // ONE sample at the cell centre (perf): 9 per cell cost ~1200 surface lookups per new ground tile (tiles 22 -> ~30 ms at
  // CPU x4). The bilinear blend between cell centres is what keeps the edges smooth; the averaging added little.
  const L = layersAt((i + 0.5) * NAT_CELL, (j + 0.5) * NAT_CELL);
  const p = NAT_SURF[L.base];
  if (p) for (const f in p) c[f] += p[f];
  c.zero = !(c.small || c.medium || c.rolling || c.whoops);
  natCache.set(key, c);
  return c;
}
function naturalHeightAt(x, y) {
  if (natLevel !== LEVEL) { natCache = new Map(); natLevel = LEVEL; natSeed = 0; for (const ch of LEVEL.id) natSeed = (natSeed * 31 + ch.charCodeAt(0)) | 0; }
  // amplitudes at this point: bilinear between the four surrounding cell CENTRES
  const fx = x / NAT_CELL - 0.5, fy = y / NAT_CELL - 0.5, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
  const c00 = natCell(i, j), c10 = natCell(i + 1, j), c01 = natCell(i, j + 1), c11 = natCell(i + 1, j + 1);
  if (c00.zero && c10.zero && c01.zero && c11.zero) return 0;          // hard ground all round: flat, no noise
  const amp = (f) => (c00[f] * (1 - tx) + c10[f] * tx) * (1 - ty) + (c01[f] * (1 - tx) + c11[f] * tx) * ty;
  let h = 0;
  const aS = amp('small'), aM = amp('medium'), aR = amp('rolling'), aW = amp('whoops');
  if (aS) h += aS * vnoise(x / NAT_FAMILY.small, y / NAT_FAMILY.small, natSeed + 1);
  if (aM) { const n = vnoise(x / NAT_FAMILY.medium, y / NAT_FAMILY.medium, natSeed + 2); h += aM * n * (0.6 + 0.8 * n * n); }   // sharpened
  if (aR) h += aR * (0.75 * vnoise(x / NAT_FAMILY.rolling, y / NAT_FAMILY.rolling, natSeed + 3) + 0.25 * vnoise(x / (NAT_FAMILY.rolling / 2), y / (NAT_FAMILY.rolling / 2), natSeed + 4));
  if (aW) { const n = vnoise(x / NAT_FAMILY.whoops, y / NAT_FAMILY.whoops, natSeed + 5); h += aW * (n * n * 2 - 0.5); }      // crests
  return h;
}
export function clearNaturalCache() { natCache = new Map(); }

// Gradient of the SMOOTH height (central difference). The slope force is -m g grad(h): bumps push OUT, dips pull IN.
export function slopeAt(x, y) {
  const e = 0.3;
  const gx = (bumpAt(x + e, y, true) - bumpAt(x - e, y, true)) / (2 * e);
  const gy = (bumpAt(x, y + e, true) - bumpAt(x, y - e, true)) / (2 * e);
  return { gx, gy };
}
export function heightAt(x, y) { return bumpAt(x, y, true); }
// What the GROUND LOOKS like (render.js hill-shading): the FULL height — washboard ripples and kerb humps included, so
// you can see them — but never the per-surface roughness noise, which would speckle every tile.
export function visualHeightAt(x, y) { return bumpAt(x, y); }
export function visualSlopeAt(x, y) {
  const e = 0.2;
  return { gx: (bumpAt(x + e, y) - bumpAt(x - e, y)) / (2 * e), gy: (bumpAt(x, y + e) - bumpAt(x, y - e)) / (2 * e) };
}

// Fill in the derived fields a bump needs at runtime, so groundAt never does trigonometry per step.
export function prepBumps(list) {
  for (const b of list) {
    const rot = b.rot || 0;
    b.cos = Math.cos(rot); b.sin = Math.sin(rot);
    const reach = b.kind === 'hump' || b.kind === 'dip' ? b.r : b.kind === 'bowl' ? b.R + 1 : Math.max(b.len, b.wid) / 2 + 1;
    b.reach2 = reach * reach;
  }
  return list;
}

// =============================================================================================
// SURFACE DEGRADATION & WEAR MAP — LAYERED, rebuilt 2026-10-03 (user: "snow should compress to ice after
// several passes; ice should wear away with heavy braking or sliding and show the surface underneath; if
// the surface under is grass it should behave like grass and turn to mud once exposed and then driven
// over ... mud turns to thick mud ... puddles on any surface, ice and snow on any surface").
//
// A wear CELL (WEAR_CELL m square) holds two layers:
//   base   — the ground itself. Wears down a chain by PASSES (a wheel crossing the cell, debounced):
//            long grass -> short grass -> dirt -> mud -> thick mud. Counts in BASE_WEAR below.
//   cover  — something lying ON the base: 'snow', 'ice' or 'wet' (a puddle). While a cover is there the
//            base cannot wear — the tyre never touches it.
//              snow  compresses to ice after SNOW_TO_ICE passes.
//              ice   is SCRUBBED away only by a wheel that is sliding or locked over it (slip speed above
//                    ICE_SCRUB_MIN, metres of slip accumulated past ICE_SCRUB). Rolling over it does nothing.
//                    When it goes, the base is exposed and wears by its own rules from then on.
//              wet   WATER DRIES BY TYRE HEAT (user, 2026-10-03, third pass: "puddles should only go when hot tyres
//                    or weather evaporate them — dry lines can still form with many passes of cold tyres but happen
//                    quicker with warmer tyres"). Each pass adds dryness by tyre temperature (dryAmount):
//                      STANDING water (level puddles, meltwater): cold tyres add NOTHING; hot tyres evaporate it.
//                      DAMP ground (a wet zone / sector, wet tarmac): cold tyres dry a line slowly, warm ones fast.
//                    When dry it MIXES with what it lay on
//                    (WATER_MIX): grass / dirt -> mud, sand -> gravel, gravel -> mud; tarmac just dries.
//                    (user, 2026-10-03: "puddles should vanish or mix with surfaces like grass or dirt to
//                    create mud ... sand and water should mix to create gravel ... gravel and water make mud")
// Covers come from the level (LEVEL.covers, any shape over any surface) or from a zone whose own surface
// is snow/ice — those are treated as a cover over zone.under (default UNDER_DEFAULT), so a lab ice
// panel scrubs through to tarmac and the same rules apply everywhere.
//
// ONE rule table. MEASURED BUG fixed here: the old code had the chain written TWICE with different numbers
// (recordWearAt said long grass -> mud in 8 passes, the game's recordWearPoint said 6), and the only test
// exercised the copy the game never used (CLAUDE.md rule 18).
export const WEAR_CELL = 1.5;
export const wearMap = new Map();
// Cells whose surface CHANGED since the renderer last looked. The renderer bakes wear into its cached
// ground tiles and uses this to know which tiles to repaint (render.js drawGround). Drained by it.
export const wearDirty = [];
const BASE_WEAR = {             // base -> [what it becomes, passes it takes]. Cumulative from long grass: 2, 4, 6, 9.
  grassLong: ['grassShort', 2],
  grass: ['dirt', 2],
  grassShort: ['dirt', 2],
  dirt: ['mud', 2],
  mud: ['thickMud', 3],
};
export const SNOW_TO_ICE = 4;      // passes to pack snow into ice
// dryness a pass adds, by tyre temperature T. Measured in tools/wearcheck.mjs:
//   damp:     0.06 + 0.30 x heat(40..100 C)  -> cold ~17 passes, 100 C ~3 passes
//   standing: 0.35 x heat(60..120 C)          -> cold never, 90 C ~6 passes, 120 C ~3 passes
// (Before this: a puddle went in 1-3 passes of ANY tyre — PUDDLE_CHURN_CHANCE — which the user found far too easy.)
export function dryAmount(standing, T) {
  if (standing) return 0.35 * Math.max(0, Math.min(1, (T - 60) / 60));
  return 0.06 + 0.30 * Math.max(0, Math.min(1, (T - 40) / 60));
}
// (history) the rule before (user: "a happy medium — a % chance so it takes 1-3 passes"): a 40% chance per pass of
// ANY tyre, so 1-3 passes. Replaced by dryAmount above.
export const SNOW_MELT_CHANCE = 0.5;   // packed snow melts to water (else freezes to ice), per cell
export const WATER_CHURN_CHANCE = 0.4;   // per pass, standing water over a WATER_MIX base -> 1-3 passes
const WATER_MIX = {                // what a churned puddle leaves behind, by the base it lay on
  grass: 'mud', grassShort: 'mud', grassLong: 'mud', dirt: 'mud', mud: 'thickMud',
  sand: 'gravel', gravel: 'mud',
};
// 7.0, was 2.0. User, 2026-10-03: "ice should take a couple of passes before it melts unless tyres are very
// hot". MEASURED at 2.0: ONE locked-brake pass scrubbed 32 cells through. A locked pass puts ~3 m of slip into a
// cell (two wheels in line, ~1.5 m each), so 7 m takes 2-3 hard passes. Hot tyres melting it faster waits for
// the tyre-temperature model (TODO, tier 3) — it should scale THIS number down, nothing else.
export const ICE_SCRUB = 7.0;      // m of tyre slip over a cell to scrub its ice through
export const ICE_SCRUB_MIN = 2.0;  // m/s of slip below which a wheel is rolling, not scrubbing
const COVER_IDS = { snow: 1, ice: 1, wet: 1 };
const UNDER_DEFAULT = 'tarmac';

// ONE wear clock for the world (sim seconds), not per car. MEASURED BUG, 2026-10-03 (tools/wearcheck.mjs):
// the pass debounce used car.simTime, which starts at 0 for every new car — so after switching car, every
// cell the old car had driven over stopped counting passes until the new car's clock caught up.
let wearClock = 0;
export let wearEpoch = 0;
export function clearWear() {
  wearMap.clear();
  wearClock = 0;
  wearDirty.length = 0;
  wearEpoch++;          // tells the renderer every baked tile is out of date

}

// PRUNE THE WEAR on a streamed level (highway.js stepHighway, after each rebuild). MEASURED BUG (user, 2026-10-06: "occasionally leaves
// patches of dirt on highway levels ... after longer drives / with ai on"; tools/_wearleak.mjs): wear cells live at WORLD positions and
// were never dropped - so when the endless road was rebuilt and new ground (a field, a bridge approach, the road swinging back) came
// down over a worn cell, that cell still drove AND drew as the old dirt / mud. Spun AI chew the verge, so it showed most with AI. The map
// also grew for the whole drive, and every ground-tile repaint walks it. Drop a cell if it is farther than `far` m from (x, y) or the
// ground under it is not what it was worn FROM; its tiles are repainted (wearDirty).
export function pruneWear(x, y, far) {
  let n = 0;
  for (const [key, cell] of wearMap) {
    const cx = (cell.cx + 0.5) * WEAR_CELL, cy = (cell.cy + 0.5) * WEAR_CELL;
    let drop = (cx - x) ** 2 + (cy - y) ** 2 > far * far;
    if (!drop) { const L = layersAt(cx, cy); drop = (L.cover || L.base) !== cell.orig; }
    if (drop) { wearMap.delete(key); n++; if (cell.current !== cell.orig) { cell.current = cell.orig; wearDirty.push(cell); } }
  }
  return n;
}
export const cleanAt = (x, y) => { const L = layersAt(x, y); return L.cover || L.base; };   // tools/_wearleak.mjs: the ground with no wear

// The STATIC layers at a point, before any wear: { base, cover } as surface ids.
// LEVEL.patches: [{ x, y, w, h, rot, surface }] — small ellipses of a different BASE laid on the ground
// (the Grass Track's random spots). Checked after the zone, so a patch on the road changes the road.
// Looked up through PATCH_GRID (built per level in prepareLevel), so thousands of blend patches cost the
// physics a handful of comparisons per query instead of a scan of the whole list.
const PATCH_CELL = 6;
let PATCH_GRID = new Map();
const patchKey = (cx, cy) => cx * 65536 + cy;
export const zoneSurfaceAt = (x, y) => zoneAt(x, y);     // read-only, for tools/blendcheck.mjs
function patchAt(x, y) {
  if (!PATCH_GRID.size) return null;
  const list = PATCH_GRID.get(patchKey(Math.floor(x / PATCH_CELL), Math.floor(y / PATCH_CELL)));
  if (!list) return null;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    let dx = x - c.x, dy = y - c.y;
    if (c.sq) { if (Math.abs(dx) <= c.w / 2 && Math.abs(dy) <= c.h / 2) return c.surface; continue; }
    if (dx * dx + dy * dy > c.w * c.w) continue;
    const co = Math.cos(c.rot || 0), si = Math.sin(c.rot || 0), u = dx * co + dy * si, v = -dx * si + dy * co;
    if ((u * u) / ((c.w / 2) ** 2) + (v * v) / ((c.h / 2) ** 2) <= 1) return c.surface;
  }
  return null;
}
function layersAt(x, y) {
  const zz = zoneAt(x, y);
  // `standing`: the water here is a PUDDLE (LEVEL.covers), not a damp wet zone — they dry differently
  const z = zz.id === 'kerb' ? zz : (patchAt(x, y) || zz);   // kerbs are their own surface; patches never cover them
  let base = z.id, cover = null;
  // a snow, ice OR WET zone is a cover over its `under` (default tarmac). Wet joined 2026-10-03 (user: "wet tarmac
  // ... needs blue-ish puddles that can be removed by driving over them") — so a wet panel or wet sector now
  // DRIES where it is driven, cell by cell, leaving a dry line through it like a real drying track.
  if (COVER_IDS[base]) { cover = base; base = z.under || UNDER_DEFAULT; }
  const cv = coverAt(x, y);
  if (cv) cover = cv;
  return { base, cover, standing: !!cv };
}
// LEVEL.covers: [{ x, y, w, h, cover: 'snow'|'ice'|'wet', shape: 'rect'|'ellipse', rot }]
// share of tyre-slip heat that reaches the TYRE on loose ground (vehicle.js TYRE_HEAT). User: "off-road surfaces
// shouldn't get them up much". MEASURED: gravel drift 260 C in 14 s before -> 25 C at 30 s at 0.15.
export const HEAT_OFFROAD = 0.15;
export const COVER_SQ = 0.5;   // m, the cover grid (render.js coverCells uses the same 0.5)
export function coverAt(x, y) {
  const list = LEVEL.covers;
  if (!list) return null;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    // the SAME 0.5 m world-grid squares render.js coverCells draws (user rule: visuals accurate to their effects):
    // the point is tested at the centre of its square, so a cover's grip edge is exactly its drawn stepped edge
    let dx = Math.floor(x / COVER_SQ) * COVER_SQ + COVER_SQ / 2 - c.x, dy = Math.floor(y / COVER_SQ) * COVER_SQ + COVER_SQ / 2 - c.y;
    // CHEAP REJECT before any trig (2026-10-04, profiled: Sweaty Lamb's 40-puddle stream made coverAt 3.4 % of a lap); rotation cached
    const hx = c.w / 2, hy = c.h / 2, rr = hx > hy ? hx : hy;
    if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
    if (c.rot) { if (c._co === undefined) { c._co = Math.cos(c.rot); c._si = Math.sin(c.rot); } const co = c._co, si = c._si; const u = dx * co + dy * si; dy = -dx * si + dy * co; dx = u; }
    if (c.shape === 'ellipse' ? (dx * dx) / (hx * hx) + (dy * dy) / (hy * hy) <= 1 : Math.abs(dx) <= hx && Math.abs(dy) <= hy) { if (c.cut && coverCut(c, x, y)) continue; return c.cover; }
  }
  return null;
}
// a cover's CUT-OUT (highway.js river: no water where the motorway crosses on its parapets): in the frame of (cut.ox, cut.oy) along
// c.rot, the band |u - v tan| < e is dry. Tested at the 0.5 m square's centre, like the cover itself (render.js coverCells agrees).
export function coverCut(c, x, y) {
  const k = c.cut, co = Math.cos(c.rot || 0), si = Math.sin(c.rot || 0);
  const ex = Math.floor(x / COVER_SQ) * COVER_SQ + COVER_SQ / 2 - k.ox, ey = Math.floor(y / COVER_SQ) * COVER_SQ + COVER_SQ / 2 - k.oy;
  const u = ex * co + ey * si, v = -ex * si + ey * co;
  return Math.abs(u - v * k.tn) < k.e;
}

// What a tyre feels for a base + cover. snow / ice replace the base outright (the tyre is on them). A
// PUDDLE does not — water on grass is not wet tarmac — it scales the base: less grip, more drag, wet
// marks and spray. Built once per base and cached, so physics gets a plain surface object.
const PUDDLE = {};
export function surfaceOf(base, cover) {
  if (!cover) return SURFACES[base] || SURFACES[UNDER_DEFAULT];
  if (cover !== 'wet') return SURFACES[cover];
  const b = SURFACES[base] || SURFACES[UNDER_DEFAULT];
  if (b.id === 'wet') return b;
  return PUDDLE[b.id] || (PUDDLE[b.id] = {
    ...b, id: 'puddle', under: b.id, label: 'PUDDLE (' + b.label + ')',
    mu: b.mu * 0.72, longK: (b.longK || 1) * 0.92, plough: (b.plough || 0) + 0.6, mark: MARK_WET, spray: SPRAY_WET,
    coolK: Math.max(0.20, b.coolK || 0),
  });
}

function getCell(cx, cy) {
  const key = cx + ',' + cy;
  let cell = wearMap.get(key);
  if (!cell) {
    const L = layersAt((cx + 0.5) * WEAR_CELL, (cy + 0.5) * WEAR_CELL);
    // nothing in this cell can ever change: do not create it (keeps the map to cells that matter)
    if (!L.cover && !BASE_WEAR[L.base]) return null;
    cell = { cx, cy, base: L.base, cover: L.cover, orig: L.cover || L.base, passes: 0, scrub: 0, dry: 0, standing: L.standing, lastSeenTime: -100 };
    cell.current = cell.orig;
    wearMap.set(key, cell);
  }
  return cell;
}
// Apply one PASS to a cell (debounced by the caller).
function passCell(cell, T = 18) {
  if (cell.cover === 'snow') {
    // MELT OR FREEZE (user, 2026-10-03: "snow should have a chance to melt or turn to ice when driven over — it
    // should still take multiple passes"). After SNOW_TO_ICE passes it becomes ICE or MELTWATER, by chance.
    if (++cell.passes >= SNOW_TO_ICE) { cell.cover = Math.random() < SNOW_MELT_CHANCE ? 'wet' : 'ice'; cell.passes = 0; cell.standing = true; cell.dry = 0; }
  } else if (cell.cover === 'wet') {
    // CHURN vs EVAPORATE (user, 2026-10-03, fourth pass: "water on dirt ... should become mud when driven over").
    // MEASURED BUG: a puddle on dirt only mixed after it had DRIED, and standing water only dries above 60 C, so on
    // dirt it stayed a puddle forever. Tyres churning water INTO soft ground is not evaporation: on any base with a
    // WATER_MIX rule, every pass of ANY tyre has WATER_CHURN_CHANCE to churn it (1-3 passes, the user's earlier
    // "happy medium"). Hard ground (tarmac) has nothing to churn into, so it keeps the heat / weather rule.
    // capped: the 3rd pass always churns (pure 40% measured a worst case of 9-12 passes over 200 puddles)
    if (cell.standing && WATER_MIX[cell.base] && (++cell.passes >= 3 || Math.random() < WATER_CHURN_CHANCE)) cell.dry = 1;
    else cell.dry += dryAmount(cell.standing, T);
    if (cell.dry >= 1) { cell.cover = null; cell.base = WATER_MIX[cell.base] || cell.base; cell.passes = 0; cell.dry = 0; }
  } else if (!cell.cover) {
    const rule = BASE_WEAR[cell.base];
    if (rule && ++cell.passes >= rule[1]) { cell.base = rule[0]; cell.passes = 0; }
    // RUTS THAT DEEPEN (step 3; user: the "vector dips" — "mud turns to thick mud / vector dips; sand and gravel also
    // have the chance to create vector dips"). A pass digs the cell down by RUT[base].step (sand / gravel by chance) to
    // its max. It is real height: the suspension feels it and gravity on its sides pulls wheels into the groove.
    const r = RUT[cell.base];
    if (r && Math.random() < r.chance) {
      const was = cell.rut || 0;
      cell.rut = Math.min(r.max, was + r.step);
      // repaint the shading only when the depth crosses a 2 cm band (a repaint per pass would thrash the tile cache)
      if (Math.floor(cell.rut / 0.02) !== Math.floor(was / 0.02)) wearDirty.push(cell);
    }
  }
  const now = cell.cover || cell.base;
  if (now !== cell.current) { cell.current = now; wearDirty.push(cell); }
}
// Slip scrubbing a cell's ice (metres of slip this step).
function scrubCell(cell, slipM) {
  if (cell.cover !== 'ice') return;
  cell.scrub += slipM;
  // scrubbed ice leaves MELTWATER, not bare ground (user, 2026-10-03: "after snow / ice water should be left") —
  // a puddle that then churns into its base by the WATER_MIX rules, so ice over grass ends as mud.
  if (cell.scrub >= ICE_SCRUB) { cell.cover = 'wet'; cell.standing = true; cell.dry = 0; cell.scrub = 0; cell.passes = 0; cell.current = 'wet'; wearDirty.push(cell); }
}

// Kept for tools/phase1check.mjs: one pass at a point, debounced in ms. Same rules as the game.
export function recordWearAt(x, y, _baseIdUnused, timeMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()), tyreT = 18) {
  const cell = getCell(Math.floor(x / WEAR_CELL), Math.floor(y / WEAR_CELL));
  if (!cell) return null;
  if (timeMs / 1000 - cell.lastSeenTime > 0.35) passCell(cell, tyreT);
  cell.lastSeenTime = timeMs / 1000;
  return cell.current;
}

// RUT depth per soft base: m per pass, cap, and the chance a pass digs at all.
const RUT = {
  mud: { step: 0.025, max: 0.15, chance: 1 },
  thickMud: { step: 0.03, max: 0.22, chance: 1 },
  sand: { step: 0.02, max: 0.12, chance: 0.5 },
  gravel: { step: 0.015, max: 0.08, chance: 0.35 },
};
// Rut depth at a point, BILINEAR between cell centres so the groove has smooth sides (a step would be an infinite slope).
export function rutAt(x, y) {
  if (wearMap.size === 0) return 0;
  const fx = x / WEAR_CELL - 0.5, fy = y / WEAR_CELL - 0.5;
  const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
  const d = (a, b) => { const c = wearMap.get(a + ',' + b); return c && c.rut ? c.rut : 0; };
  const d00 = d(i, j), d10 = d(i + 1, j), d01 = d(i, j + 1), d11 = d(i + 1, j + 1);
  if (!(d00 || d10 || d01 || d11)) return 0;
  return (d00 * (1 - tx) + d10 * tx) * (1 - ty) + (d01 * (1 - tx) + d11 * tx) * ty;
}

export function getWornSurface(x, y) {
  if (wearMap.size === 0) return null;
  const cell = wearMap.get(Math.floor(x / WEAR_CELL) + ',' + Math.floor(y / WEAR_CELL));
  return cell ? surfaceOf(cell.base, cell.cover) : null;
}

// Height noise for a surface, from its own `rough`. Two incommensurate frequencies so it does not read
// as a sine wave, and long enough wavelengths to survive a 120 Hz sim at 45 m/s without aliasing.
function roughAt(x, y, rough) {
  if (!rough) return 0;
  return rough * (Math.sin(x * 0.9) * Math.sin(y * 1.2) + 0.6 * Math.sin(x * 2.1 + y * 1.7));
}

// THE GROUND under a point: its height in metres and what it grips like. Everything about the world's
// surface is this one function; main.js reads it and vehicle.js integrates over it.
export function groundAt(x, y) {
  // e = metres past the floor edge (negative inside); on the square it is max(|x|, |y|) - FLOOR, as before (S-B: any rectangle)
  const ex = Math.max(x - FX1, FX0 - x), ey = Math.max(y - FY1, FY0 - y), e = ex > ey ? ex : ey;

  // --- on the floor: whatever zone you are standing in, plus any bumps laid on top of it
  if (e <= -KERB_W) {
    const worn = getWornSurface(x, y);
    let s = worn;
    if (!s) { const L = layersAt(x, y); s = surfaceOf(L.base, L.cover); }
    return { h: roughAt(x, y, s.rough) + bumpAt(x, y), surface: s };
  }

  // --- THE KERB. A HUMP, not a step: zero at the inner lip, KERB_H at the crest, back to zero at the
  // outer edge. sin^2 so both ends are smooth — a discontinuity here is an infinite ground velocity,
  // and the suspension would answer with an infinite load.
  if (e <= 0) {
    const d = (e + KERB_W) / KERB_W;
    const s = Math.sin(Math.PI * d);
    // ridges run ALONG the edge, so their phase comes from whichever axis is not the dominant one
    const along = ex > ey ? y : x;
    return {
      h: KERB_H * s * s + KERB_RIDGE * s * Math.sin((along / KERB_RIDGE_L) * Math.PI * 2),
      surface: SURFACES.kerb,
    };
  }

  // --- the grass verge: your one chance to gather it up
  if (e <= VERGE_W) {
    return { h: roughAt(x, y, SURFACES.grass.rough), surface: SURFACES.grass };
  }

  // --- the gravel trap, graded deeper toward the fence
  const deep = Math.min(1, (e - VERGE_W) / (RUNOFF_W - VERGE_W));
  const band = Math.min(TRAP_STEPS - 1, Math.floor(deep * TRAP_STEPS));
  return { h: roughAt(x, y, RUNOFF_ROUGH), surface: SURFACE_TRAP[band] };
}

export function carWheels(car) {
  const s = car.spec;
  const c = Math.cos(car.heading), sn = Math.sin(car.heading);
  const hw = (s.trackWidth || 1.5) / 2;
  const fx = car.x + c * s.lf, fy = car.y + sn * s.lf;
  const rx = car.x - c * s.lr, ry = car.y - sn * s.lr;
  return [
    { x: fx - sn * hw, y: fy + c * hw }, // FL
    { x: fx + sn * hw, y: fy - c * hw }, // FR
    { x: rx - sn * hw, y: ry + c * hw }, // RL
    { x: rx + sn * hw, y: ry - c * hw }, // RR
  ];
}

// A HOT tyre (above HOT_TYRE) over snow or water counts its pass TWICE with HOT_EXTRA_CHANCE — it melts and
// dries faster. On ice the slip it scrubs with is multiplied by heatScrub (see stepWear).
const HOT_TYRE = 80, HOT_EXTRA_CHANCE = 0.5;
function recordWearPoint(x, y, simTime, tyreT = 0) {
  const cell = getCell(Math.floor(x / WEAR_CELL), Math.floor(y / WEAR_CELL));
  if (!cell) return;
  if (simTime - cell.lastSeenTime > 0.35) {
    passCell(cell, tyreT);
    // a hot tyre packs / melts SNOW faster (water now dries by temperature inside passCell)
    if (tyreT > HOT_TYRE && cell.cover === 'snow' && Math.random() < HOT_EXTRA_CHANCE) passCell(cell, tyreT);
  }
  cell.lastSeenTime = simTime;
}

// carWheels() order is FL, FR, RL, RR with L = +lateral; vehicle.js indexes tyres the same way (0..3).
const TYRE_OF_WHEEL = [0, 1, 2, 3];
export function stepWear(car, dt) {
  wearClock += dt;
  if (Math.hypot(car.vx, car.vy) < 0.6) return;
  const curr = carWheels(car);
  if (!car.prevWheels) car.prevWheels = curr;
  const t = car.t;
  // A JUMP is not a tyre path (MEASURED BUG, 2026-10-06, "dirt in the road"; tools/_dirtroad.mjs): highway traffic out of view is moved
  // KINEMATICALLY (traffic.js, no applyGround), so prevWheels went stale and the first physical step after it woke swept one straight
  // line of wear from where it fell asleep, often across the carriageway. Same for any teleport. 3 m in one step = 360 m/s at 120 Hz.
  if (Math.hypot(curr[0].x - car.prevWheels[0].x, curr[0].y - car.prevWheels[0].y) > 3) { car.prevWheels = curr; return; }
  for (let i = 0; i < 4; i++) {
    const p0 = car.prevWheels[i];
    const p1 = curr[i];
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const dist = Math.hypot(dx, dy);
    // Interpolate continuously along each tyre's swept path: zero gaps even at high speed
    const steps = Math.max(1, Math.ceil(dist / (WEAR_CELL * 0.45)));
    for (let s = 0; s <= steps; s++) {
      const k = s / steps;
      recordWearPoint(p0.x + dx * k, p0.y + dy * k, wearClock, car.tyreT ? car.tyreT[TYRE_OF_WHEEL[i]] : 0);
    }
    // ICE SCRUB: only a wheel that is actually sliding or locked wears ice (front axle = wheels 0,1)
    const slip = i < 2 ? t.slipSpeedF : t.slipSpeedR;
    if (slip > ICE_SCRUB_MIN) {
      const cell = getCell(Math.floor(p1.x / WEAR_CELL), Math.floor(p1.y / WEAR_CELL));
      // hot rubber melts ice faster: x1 at 60 C, x2 at 90 C, x3 at 120 C
      // x1 at 60 C rising to x1.67 at 120 C (was x3: user, "hot tyres melt ice too easily")
      const heatScrub = car.tyreT ? 1 + Math.min(1, Math.max(0, (car.tyreT[TYRE_OF_WHEEL[i]] - 60) / 90)) : 1;
      if (cell) scrubCell(cell, slip * dt * heatScrub);
    }
  }
  car.prevWheels = curr;
}

// Put the ground under the car. Lives HERE, not in main.js, so the game and every harness run the
// identical code — MEASURED BUG, 2026-09-28: tools/kerbcheck.mjs had its own copy, the field names
// changed under it, and it cheerfully reported load 1.00 at every speed from 3 to 42 m/s. Identical
// outcomes across different inputs is CLAUDE.md rule 1, and it was my own instrument lying again.
//
// Sampled AT EACH AXLE, not at the centre. A 2.6 m wheelbase over a 3.5 m kerb means the front is
// cresting while the rear is still climbing, and that phase difference is the whole character of riding
// a kerb — one end light while the other still grips. One sample point would average it away.
// LOCAL LOOKUP HINT (2026-10-04, AI stage 1: applyGround made 34 track lookups per car per physics step — slope, bump steer, camber,
// kerbs — each a fresh grid search; with 6 cars that was a third of the frame). The car is looked up ONCE; the samples around it search
// only the 21 segments either side of its nearest one, and that answer is used only when the point is ON the road (within half width +
// 3 m) — then no other part of the lap can be nearer (legs are >= 33 m apart on every level). Anything else gets the full search.
let qsHintSub = null, qsHint = -1;
export function applyGround(car, dt) {
  const st0 = LEVEL.subtrack;
  if (st0) { const q0 = querySubtrack(st0, car.x, car.y); qsHintSub = q0.seg != null ? st0 : null; qsHint = q0.seg ?? -1; }
  try { applyGroundInner(car, dt); } finally { qsHintSub = null; qsHint = -1; }
}
function applyGroundInner(car, dt) {
  const s = car.spec;
  const c = Math.cos(car.heading), sn = Math.sin(car.heading);
  const fx = car.x + c * s.lf, fy = car.y + sn * s.lf;
  const rx = car.x - c * s.lr, ry = car.y - sn * s.lr;
  const gF = groundAt(fx, fy);
  const gR = groundAt(rx, ry);
  // The true discrete derivative, so driving ALONG a ridged kerb shakes the car for exactly the same
  // reason crossing one does. There is no separate "rumble" code anywhere, and there should not be.
  // FIRST STEP AFTER A RESET (user, 2026-10-04: "resetting on terrain causes the car to get stuck when pulling away"). reset() zeroes the
  // ground + suspension heights, so on a hill the first derivative read the whole hill as one step: MEASURED a reset 7.5 m up Sweaty
  // Lamb launched the car 106 m into the air (Slidden Hill 67 m; Castle Cum's 1.1 m crest 1.1 s of air). Now the first step after a reset
  // puts the ground AND the body at the local height with no vertical speed.
  if (!car.groundInit) { car.groundF = gF.h; car.groundR = gR.h; car.zF = gF.h; car.zR = gR.h; car.zvF = 0; car.zvR = 0; car.groundInit = true; }
  car.groundVF = (gF.h - car.groundF) / dt; car.groundF = gF.h;
  car.groundVR = (gR.h - car.groundR) / dt; car.groundR = gR.h;
  car.surface = gR.surface;      // grip is still one number for the car; per-axle grip is a later job

  // Corner banking physics (PLAN.md §3): on banked turns (e.g. Naffcar), the slope hauls the car inward
  // SLOPE FORCE (step 3, 2026-10-03; user: "vector dips ... push in all 8 directions, out and in"). Gravity along the
  // smooth terrain: F = -m g grad(h), world frame -> body frame. Bumps push OUT, dips and banking pull IN/DOWN. Only on
  // the ground (an airborne car falls straight). Replaces the old bank FORCE, which pushed 0.3 g to the car's left
  // anywhere past |x| 130 — grass included (fixed earlier today); banking is now real height (bankHeightAt).
  car.bankLatForce = 0; car.bankLoadFactor = 1.0;
  if (car.air > 0) { car.slopeLong = 0; car.slopeLat = 0; car.slopeYaw = 0; }
  else {
    // PER AXLE, under each wheel (ruts: sampled at the centre the car sits on the ridge between two grooves and is pushed
    // sideways; at the wheels each side is pulled back into its own groove). Each axle carries its static share of the
    // weight, and the two axles' sideways pushes act at the axles — so an off-centre whoop or dip under the FRONT wheels
    // tugs the nose toward the dip / away from the hump (user, 2026-10-03: "dips and whoops should gently affect steering").
    const hw2 = (s.trackWidth || 1.5) / 2, ps = -sn, pc = c, L2 = s.lf + s.lr;
    const mg = s.mass * car.mods.mass * 9.81;
    let Flong = 0, Flat = 0, Mz = 0;
    for (const [ax, share, arm] of [[s.lf, s.lr / L2, s.lf], [-s.lr, s.lf / L2, -s.lr]]) {
      let gx = 0, gy = 0;
      for (const sd of [1, -1]) { const q = slopeAt(car.x + c * ax + ps * hw2 * sd, car.y + sn * ax + pc * hw2 * sd); gx += q.gx / 2; gy += q.gy / 2; }
      const gmag = Math.hypot(gx, gy), k = gmag > 1 ? 1 / gmag : 1;          // cap at 45 deg
      const Fwx = -mg * share * gx * k, Fwy = -mg * share * gy * k;
      const fl = Fwx * c + Fwy * sn, ft = -Fwx * sn + Fwy * c;
      Flong += fl; Flat += ft; Mz += arm * ft;                                // lateral push x lever arm = yaw
    }
    // BUMP STEER: the front wheel that drops (into a dip, or off the far side of a whoop) tugs the nose toward its side —
    // the tramlining a real car's steering does. +y is the car's right, and a right turn is positive yaw, so a LOWER right
    // wheel (hL > hR) adds positive yaw. Strength BUMP_STEER x front weight x height difference (m).
    // banking excluded: a steady cross-slope is not a bump, and the slope push already slides you down it
    const hAt = (x, y) => heightAt(x, y) - bankHeightAt(x, y);
    const hR = hAt(car.x + c * s.lf + ps * hw2, car.y + sn * s.lf + pc * hw2);
    const hL = hAt(car.x + c * s.lf - ps * hw2, car.y + sn * s.lf - pc * hw2);
    // BUMPS ONLY, never an even slope (user, 2026-10-03: "I think the bowl on the lab is broken"): on the bowl wall the
    // left / right difference was PERMANENT and dragged the nose toward the middle the whole way round. Subtract what a
    // flat plane with the local slope would give, so a steady cross-slope (bowl, hill, banking) reads zero.
    const gF = slopeAt(car.x + c * s.lf, car.y + sn * s.lf);
    const plane = -2 * hw2 * (gF.gx * ps + gF.gy * pc);                   // hL - hR on a flat tilted plane
    Mz += BUMP_STEER.k * mg * (s.lr / L2) * Math.max(-0.4, Math.min(0.4, (hL - hR) - plane));
    car.slopeLong = Flong; car.slopeLat = Flat; car.slopeYaw = Mz;
  }

  // Dynamic surface wear: continuous swept tyre paths for all 4 wheels
  stepWear(car, dt);
}

// The fence is the one hard constraint out here, because a barrier IS one.
// PREVENTS WEDGING: bounds against car corners rather than center point, prevents body
// from penetrating the fence, zeroes penetrating velocity with elastic rebound, and damps snagging yaw.
export function fenceClamp(car) {
  const s = car.spec;
  const reach = Math.max(s.wid, s.len) * 0.48;
  // per side (S-B: the floor is a rectangle): the fence is RUNOFF_W past each floor edge
  for (const k of ['x', 'y']) {
    const lo = (k === 'x' ? FX0 : FY0) - RUNOFF_W + reach, hi = (k === 'x' ? FX1 : FY1) + RUNOFF_W - reach;
    if (car[k] > hi || car[k] < lo) {
      const sgn = car[k] > hi ? 1 : -1;
      car[k] = sgn > 0 ? hi : lo;
      const v = k === 'x' ? 'vx' : 'vy';
      if (car[v] * sgn > 0) {
        car[v] = -car[v] * 0.35;
        car.yawRate *= 0.65;     // kill corner pivot snagging
      }
    }
  }
}

// Solid impactable obstacle collision (grandstands, pit divider walls, marshal towers)
export function obstacleClamp(car) {
  if (!LEVEL.obstacles || !LEVEL.obstacles.length) return;
  const s = car.spec;
  const reachX = s.len * 0.45, reachY = s.wid * 0.45;

  for (let i = 0; i < LEVEL.obstacles.length; i++) {
    const ob = LEVEL.obstacles[i];
    const halfW = ob.w / 2, halfH = ob.h / 2;
    const minX = ob.x - halfW - reachX;
    const maxX = ob.x + halfW + reachX;
    const minY = ob.y - halfH - reachY;
    const maxY = ob.y + halfH + reachY;

    if (car.x > minX && car.x < maxX && car.y > minY && car.y < maxY) {
      const penLeft = car.x - minX;
      const penRight = maxX - car.x;
      const penTop = car.y - minY;
      const penBottom = maxY - car.y;
      const minPen = Math.min(penLeft, penRight, penTop, penBottom);

      if (minPen === penLeft) {
        car.x = minX;
        if (car.vx > 0) car.vx = -car.vx * 0.35;
      } else if (minPen === penRight) {
        car.x = maxX;
        if (car.vx < 0) car.vx = -car.vx * 0.35;
      } else if (minPen === penTop) {
        car.y = minY;
        if (car.vy > 0) car.vy = -car.vy * 0.35;
      } else {
        car.y = maxY;
        if (car.vy < 0) car.vy = -car.vy * 0.35;
      }
      car.yawRate *= 0.50;
      const sp = Math.hypot(car.vx, car.vy);
      car.shake = Math.min(1.0, (car.shake || 0) + sp * 0.12);
    }
  }
}

// =============================================================================================
// BARRIERS (2026-10-03; user: "use aerial photos of tracks on race days for pit layouts and perimeter decorations — if you
// need to make things like ARMCO or FENCES, do"). LEVEL.barriers: [{ kind, pts: [[x, y], ...] }], polylines in metres.
//   armco    steel double rail on posts — solid
//   wall     concrete — solid          pitwall  concrete, red / white / blue painted (Thruxton photos) — solid
//   fence    catch fence, posts + mesh — solid        building  an invisible solid outline (props draw the building)
//   line     painted line (pit lane edge) — NOT solid
// Solid ones collide with the car's four corners (push out, bounce, scrape) on the same step as obstacleClamp; what is drawn
// is exactly what you hit (user rule: visuals accurate to their effects).
export const BARRIER_HALF = { armco: 0.3, wall: 0.45, pitwall: 0.5, fence: 0.15, building: 0.1, line: 0 };
const BARRIER_E = 0.3;           // restitution off a barrier (obstacles use 0.35)
const BARRIER_SCRAPE = 0.85;     // share of the along-the-wall speed kept per contact step... (scrape)
// polyline offset from the subtrack centreline, d0 -> d1 (wrapping past the line), `step` metres apart; offset may be a
// function of the distance (pit-lane entry / exit ramps). + = the +normal side.
// INTERPOLATED point + SMOOTHED normal for paths offset from the track (2026-10-04, photographed: the pit lane's edges wobbled).
// onTrack snaps to the sample before d and uses that sample's own direction; at a 17 m offset the sample-to-sample jitter in
// direction became metres of sideways wobble. Here: position lerped between samples, normal averaged over +-4 samples (~12 m).
function smoothOnTrack(sub, d, off) {
  const pts = sub.pts, n = pts.length; d = ((d % sub.totalDist) + sub.totalDist) % sub.totalDist;
  let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pts[m].dist <= d) lo = m; else hi = m - 1; }
  const a = pts[lo], b = pts[(lo + 1) % n], seg = (b.dist > a.dist ? b.dist : sub.totalDist) - a.dist, t = seg > 0 ? (d - a.dist) / seg : 0;
  let nx = 0, ny = 0; for (let k = -4; k <= 4; k++) { const q = pts[(lo + k + n) % n]; nx += q.nx; ny += q.ny; } const L = Math.hypot(nx, ny) || 1;
  return { x: a.x + (b.x - a.x) * t + (nx / L) * off, y: a.y + (b.y - a.y) * t + (ny / L) * off };
}
export function alongTrack(sub, d0, d1, offset, step = 4) {
  const total = sub.totalDist, pts = [];
  let len = d1 - d0; if (len < 0) len += total;
  for (let t = 0; t <= len + 1e-6; t += step) {
    const d = (d0 + Math.min(t, len)) % total;
    const off = typeof offset === 'function' ? offset(t, len) : offset;
    const p = smoothOnTrack(sub, d, off);
    pts.push([+p.x.toFixed(2), +p.y.toFixed(2)]);
  }
  return pts;
}
export function prepBarriersOf(level) { prepBarriers(level); }
function prepBarriers(level) {
  for (const b of level.barriers || []) {
    if (b._segs) continue;
    b._segs = [];
    for (let i = 0; i < b.pts.length - 1; i++) {
      const [ax, ay] = b.pts[i], [bx, by] = b.pts[i + 1];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      if (l2 < 1e-6) continue;
      b._segs.push({ ax, ay, dx, dy, l2, minX: Math.min(ax, bx) - 4, maxX: Math.max(ax, bx) + 4, minY: Math.min(ay, by) - 4, maxY: Math.max(ay, by) + 4 });
    }
  }
}
// SOLID PROPS (2026-10-04; user: "make sure trees, planes etc are collidable objects"). LEVEL.solids [{ x, y, w, h, rot }] — rotated
// boxes, tested against the car's box with the separating-axis test. barrierClamp only checks the car's 4 CORNERS against
// segments, so a tree trunk or a wing tip narrower than the car could slip between two corners; SAT cannot miss it.
// Response = the barrier rules (restitution BARRIER_E, scrape BARRIER_SCRAPE, yaw x0.6, shake). solidsFromProps builds the boxes
// from what is drawn, so "move that tree" moves its collision too.
export function solidsFromProps(props) {
  const out = [];
  const box = (pr, ox, oy, w, h) => { const c = Math.cos(pr.rot || 0), s = Math.sin(pr.rot || 0); out.push({ x: pr.x + c * ox - s * oy, y: pr.y + s * ox + c * oy, w, h, rot: pr.rot || 0, kind: pr.kind }); };
  for (const pr of props) {
    switch (pr.kind) {
      case 'hangar': case 'grandstand': box(pr, 0, 0, pr.w, pr.h); break;
      case 'tower': box(pr, 0, 0, pr.size || 9, pr.size || 9); break;
      case 'truck': box(pr, 0, 0, 14, 2.5); break;
      case 'plane': box(pr, 0.3, 0, 7, 1); box(pr, 1.0, 0, 1.4, 9); box(pr, -2.8, 0, 0.8, 3.2); break;   // fuselage, wing, tailplane
      case 'marshal': box(pr, 0, 0, 2.4, 2); break;
      case 'board': box(pr, 0, 0, 18, 1.2); break;
      case 'windsock': box(pr, 0, 0, 0.5, 0.5); break;
      // a TREE stops you at its trunk + lower branches (half the canopy); you can clip the outer leaves
      case 'tree': box(pr, 0, 0, (pr.s || 4) * 0.5, (pr.s || 4) * 0.5); break;
      case 'gantry': box(pr, -(pr.wid || 26) / 2, 0, 1.2, 1.8); box(pr, (pr.wid || 26) / 2, 0, 1.2, 1.8); break;   // the two legs
      case 'footbridge': box(pr, -(pr.wid || 27) / 2, 0, 1.6, 3.0); box(pr, (pr.wid || 27) / 2, 0, 1.6, 3.0); break;   // stair towers
      // highway BRIDGES (highway.js extras): the two ABUTMENTS (4 m blocks) at the ends of the span, out on the grass; the deck is overhead
      case 'bridge': box(pr, -(pr.wid || 30) / 2 - 2, 0, 4, pr.carries === 'foot' ? 3.8 : 8); box(pr, (pr.wid || 30) / 2 + 2, 0, 4, pr.carries === 'foot' ? 3.8 : 8); break;
      case 'gate': box(pr, 0, 0, 6.8, 0.6); break;
      case 'block': box(pr, 0, 0, pr.w, pr.h); break;
      case 'sculpture': box(pr, 0, 0, 2.2, 2.2); break;
      case 'bale': box(pr, 0, 0, 1.6, 1.6); break;
      case 'rock': box(pr, 0, 0, (pr.s || 3) * 0.7, (pr.s || 3) * 0.7); break;
      // (field sheep / cows are LOOSE OBJECTS since S-C, 2026-10-07 - cones.js: pushable, a sheep pops into fluff, a cow tips; not solid props)
      // (chevron boards and flag poles are NOT solid since 2026-10-04: flimsy signs on stakes that a car flattens — as solid walls they
      // tore a rally car's front wheels off and rolled it at a Killder corner exit, photographed)
    }
  }
  for (const b of out) b.r = Math.hypot(b.w, b.h) / 2;
  return out;
}
export function solidClamp(car) {
  const list = LEVEL.solids;
  if (!list || !list.length) return;
  const s = car.spec, hl = s.len * 0.48, hw = s.wid * 0.48, cr = Math.hypot(hl, hw);
  const c = Math.cos(car.heading), sn = Math.sin(car.heading);
  for (const b of list) {
    const dx = car.x - b.x, dy = car.y - b.y;
    if (dx * dx + dy * dy > (cr + b.r) ** 2) continue;
    const bc = Math.cos(b.rot), bs = Math.sin(b.rot), bw = b.w / 2, bh = b.h / 2;
    // SAT on the 4 axes: overlap = sum of projected half-extents - |centre distance on the axis|
    let best = Infinity, ax = 0, ay = 0;
    for (const [ux, uy] of [[c, sn], [-sn, c], [bc, bs], [-bs, bc]]) {
      const rc = hl * Math.abs(c * ux + sn * uy) + hw * Math.abs(-sn * ux + c * uy);
      const rb = bw * Math.abs(bc * ux + bs * uy) + bh * Math.abs(-bs * ux + bc * uy);
      const dist = dx * ux + dy * uy, ov = rc + rb - Math.abs(dist);
      if (ov <= 0) { best = -1; break; }
      if (ov < best) { best = ov; const sg = dist >= 0 ? 1 : -1; ax = ux * sg; ay = uy * sg; }
    }
    if (best <= 0) continue;
    car.x += ax * best; car.y += ay * best;
    const vn = car.vx * ax + car.vy * ay;
    if (vn < 0) {
      const tx = -ay, ty = ax, vt = car.vx * tx + car.vy * ty;
      const vn2 = -vn * BARRIER_E, vt2 = vt * BARRIER_SCRAPE;
      car.vx = ax * vn2 + tx * vt2; car.vy = ay * vn2 + ty * vt2;
      car.yawRate *= 0.6;
      car.shake = Math.min(1.0, (car.shake || 0) + Math.abs(vn) * 0.12);
    }
  }
}
export function barrierClamp(car) {
  const list = LEVEL.barriers;
  if (!list || !list.length) return;
  const s = car.spec, c = Math.cos(car.heading), sn = Math.sin(car.heading);
  const hl = s.len * 0.48, hw = s.wid * 0.48;
  const corners = [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw]];
  for (const b of list) {
    const half = BARRIER_HALF[b.kind];
    if (!half || !b._segs) continue;
    for (const g of b._segs) {
      if (car.x < g.minX - s.len || car.x > g.maxX + s.len || car.y < g.minY - s.len || car.y > g.maxY + s.len) continue;
      for (const [u, v] of corners) {
        const px = car.x + c * u - sn * v, py = car.y + sn * u + c * v;
        let t = ((px - g.ax) * g.dx + (py - g.ay) * g.dy) / g.l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = g.ax + g.dx * t, qy = g.ay + g.dy * t;
        let nx = px - qx, ny = py - qy; const d = Math.hypot(nx, ny);
        if (d >= half) continue;
        if (d < 1e-6) { nx = -g.dy; ny = g.dx; } const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
        // which side the car is on: the side its CENTRE is on (a corner may have poked through)
        const side = Math.sign((car.x - qx) * nx + (car.y - qy) * ny) || 1; nx *= side; ny *= side;
        const push = half - d * side;
        car.x += nx * push; car.y += ny * push;
        const vn = car.vx * nx + car.vy * ny;
        if (vn < 0) {
          const tx = -ny, ty = nx, vt = car.vx * tx + car.vy * ty;
          const vn2 = -vn * BARRIER_E, vt2 = vt * BARRIER_SCRAPE;
          car.vx = nx * vn2 + tx * vt2; car.vy = ny * vn2 + ty * vt2;
          car.yawRate *= 0.6;
          car.shake = Math.min(1.0, (car.shake || 0) + Math.abs(vn) * 0.12);
        }
      }
    }
  }
}

// Painted floor figures — all data, all in metres. `kind` picks how render.js draws it.
const LAB_PAINT = [
  { kind: 'ring', x: 0, y: 0, r: 40, lw: 0.18, tone: 0.55 },      // skidpad
  { kind: 'ring', x: 0, y: 0, r: 20, lw: 0.12, tone: 0.35 },
  { kind: 'box', x: -28.3, y: 28.3, w: 6, h: 11, tone: 0.5 },     // start box, on the skidpad ring
  { kind: 'box', x: 210, y: 200, w: 60, h: 60, tone: 0.40 },      // donut pad, south-east
  { kind: 'lane', x: -120, y: 240, w: 200, h: 11, tone: 0.35 },   // drag strip along the south edge
  // SUSPENSION TEST ZONE mark-out: the whole zone, then one box per lane
  // tones 0.55-0.8: the first cut at 0.30 was invisible against the lab grid (photographed)
  // top edge at y 166: at 161 it ran into the mud / sand test panels north of the zone (photographed)
  { kind: 'box', x: -124, y: 190, w: 242, h: 48, tone: 0.8 },
  { kind: 'lane', x: -195, y: 172, w: 80, h: 10, tone: 0.55 },
  { kind: 'lane', x: -190, y: 187, w: 90, h: 10, tone: 0.55 },
  { kind: 'lane', x: -205, y: 203, w: 56, h: 10, tone: 0.55 },
];

// Distance boards down the braking straight, in metres from its start. These make a braking test
// readable without a HUD number, which is the point of painting them.
const LAB_BOARDS = [
  { x: -25, y: 240, label: '0' },
  { x: -75, y: 240, label: '50' },
  { x: -125, y: 240, label: '100' },
  { x: -175, y: 240, label: '150' },
  // SUSPENSION TEST ZONE labels, painted on the floor at the WEST end of each lane (you enter from the west)
  { x: -118, y: 172, label: 'SUSPENSION TEST' },
  { x: -242, y: 172, label: 'WHOOPS' },
  { x: -242, y: 187, label: 'DIPS' },
  { x: -242, y: 203, label: 'WASHBOARD' },
  { x: -36, y: 166, label: 'BOWL' },
];

// Cones. Loose clusters, a slalom, and a gate — something to aim at and knock over later (Step 6).
// r is the base radius in metres (a real traffic cone base is ~0.18 m).
// ---------------------------------------------------------------------------------------------
// THE COURSE. A lap you can actually drive, marked out in cones on the big floor — data, so moving a
// corner is a number in this file and not a refactor (CLAUDE.md §6).
//
// Laid as a centreline of corner apexes; the gates are generated from it, so the shape can be edited
// as a path rather than by placing 80 cones by hand. Clockwise from the start box.
const COURSE = [
  [   0,  -30], [  95,  -55], [ 170, -120], [ 190, -200],   // long right-hand sweep up the east side
  [ 140, -235], [  60, -225], [  10, -175],                 // tight hairpin at the top
  [ -60, -190], [-130, -215], [-195, -180],                 // esses heading west
  [-215, -100], [-185,  -30], [-205,   50],                 // fast left down the west side
  [-160,  120], [ -80,  145], [   0,  125],                 // wide bottom sweep
  [  70,  150], [ 140,  120], [ 165,   50],                 // second hairpin, south-east
  [ 120,   10], [  55,    5],                               // short chicane back onto the straight
];
const GATE = 11;         // m between the two cones of a gate — wide enough to take at speed
const GATE_SPACING = 13; // m along the path between gates. 26 m left the course reading as scattered
                         // cones rather than a track (user: "needs more cones or it is confusing"), so
                         // the gates are twice as dense. The path is resampled, so this is one number.
// Catmull-Rom through the apexes, so the course is a smooth closed loop rather than a polygon, then
// resampled at a fixed spacing. Editing the shape means moving an apex in COURSE — nothing else.
function smoothPath(pts, perSeg = 24) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * ((2*p1[0]) + (-p0[0]+p2[0])*t + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
        0.5 * ((2*p1[1]) + (-p0[1]+p2[1])*t + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3),
      ]);
    }
  }
  return out;
}

// =============================================================================================
// SUBTRACK SYSTEM (for circuit recovery / reset and lap progress tracking)
// AUTO KERBS (2026-10-03; user: "check the kerbs, they look a bit broken"). MEASURED on Thruston: kerbs placed by NAMED corner
// distances landed on the OUTSIDE of four corners and on a straight (a naming slip in the Complex shifted them). Now kerbs come
// from the track's own curvature: every corner tighter than maxR gets an INSIDE kerb over the part tighter than 1.6 x its
// tightest radius; corners tighter than exitR also get an OUTSIDE exit kerb after the apex. 'left' = +normal side = the
// inside of a RIGHT-hander (heading increasing, y-down).
// MERGE + MIN TURN (2026-10-04, Thruston re-trace): on a traced lap the curvature still ripples, so one sweeper came out as 3-6 kerbs
// with gaps. Corners turning less than minTurn deg get none (a kink is not a corner); same-side kerbs closer than mergeGap m join.
export function autoKerbs(st, { maxR = 70, exitR = 30, width = 2.4, h = 0.11, heavyR = 0, heavyW = 3.0, heavyH = 0.14, minTurn = 0, mergeGap = 0 } = {}) {
  const pts = st.pts, n = pts.length;
  const R = [], turn = [];
  for (let i = 0; i < n; i++) {
    const a0 = pts[(i - 3 + n) % n], a1 = pts[(i + 3) % n];
    let dh = a1.heading - a0.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    R.push(Math.max(1, ((a1.dist - a0.dist) + st.totalDist) % st.totalDist) / Math.max(1e-4, Math.abs(dh)));
    turn.push(dh > 0 ? 1 : -1);
  }
  const kerbs = [];
  let i = 0;
  // start scanning at a point that is NOT in a corner, so a corner spanning the line is found whole
  let start = 0; while (start < n && R[start] < maxR) start++;
  for (let c = 0; c < n; c++) {
    const k = (start + c) % n;
    if (R[k] >= maxR) continue;
    // a corner: run while it stays tight in the SAME direction
    let e = c; const dir = turn[k]; let minR = Infinity, minAt = k;
    while (e < n && R[(start + e) % n] < maxR && turn[(start + e) % n] === dir) { const j = (start + e) % n; if (R[j] < minR) { minR = R[j]; minAt = j; } e++; }
    // the apex region: tighter than 1.6 x the minimum
    let a = minAt, b = minAt;
    while (R[(a - 1 + n) % n] < minR * 1.6 && a !== (start + c) % n) a = (a - 1 + n) % n;
    while (R[(b + 1) % n] < minR * 1.6 && b !== (start + e - 1) % n) b = (b + 1) % n;
    const heavy = minR < heavyR;
    const d0 = pts[a].dist, d1 = pts[b].dist + 4;
    let turnDeg = pts[(start + e - 1) % n].heading - pts[(start + c) % n].heading; turnDeg = Math.abs(Math.atan2(Math.sin(turnDeg), Math.cos(turnDeg))) * 180 / Math.PI;
    if (turnDeg < minTurn) { c = e; continue; }
    const inside = dir > 0 ? 'left' : 'right', outside = dir > 0 ? 'right' : 'left';
    // NO FANS (2026-10-04, photographed at Campbell / Club): a kerb on the inside of a tight corner has its inner edge at
    // R - half road - kerb width; at R 12.6 with a 3 m heavy kerb that was 2.6 m and the blocks fanned into wedges. Cap the
    // inside kerb so its inner edge stays >= 0.7 of its outer one.
    const capW = Math.max(1.2, 0.3 * (minR - st.width / 2));
    if (d1 - d0 > 3) kerbs.push({ side: inside, startDist: d0, endDist: d1, width: Math.min(capW, heavy ? heavyW : width), h: heavy ? heavyH : h });
    if (minR < exitR) kerbs.push({ side: outside, startDist: pts[b].dist, endDist: pts[b].dist + 18, width: heavy ? heavyW : width, h: heavy ? heavyH : h });
    c = e;
  }
  if (!mergeGap) return kerbs;
  // join same-side kerbs that nearly touch (the longer/heavier style wins); order by start
  kerbs.sort((p, q) => p.startDist - q.startDist);
  const out = [];
  for (const k of kerbs) {
    const prev = [...out].reverse().find((o) => o.side === k.side);
    if (prev && k.startDist - prev.endDist < mergeGap && k.startDist >= prev.startDist) {
      prev.endDist = Math.max(prev.endDist, k.endDist); prev.width = Math.max(prev.width, k.width); prev.h = Math.max(prev.h, k.h);
    } else out.push({ ...k });
  }
  return out;
}
// TRACE A REAL MAP INTO A DRIVABLE CENTRELINE (2026-10-04; user: Thruston "kerbs still broken on tight corners, not like the real
// corner"). The first re-lay pushed hand-read map points straight through Catmull-Rom and opened only the corners that FOLDED:
// MEASURED Campbell/Cobb ~R 11, Club R 9 (fold at 266 m), so a 3 m inside kerb had its inner edge ~1-4 m from the corner centre
// and drew as wedges (kerbside.mjs "kerb fans"). Now:
// map px -> metres, resample evenly, Taubin-smooth (no shrink), then open every corner tighter than rMin by smoothing only
// there, until the whole lap is >= rMin over an 8 m arc. Returns dense points for createSubtrack(..., dense = true).
// WHY rMin: the cars are full size but the lap is ~1/3 scale, so the real Complex / Club (R ~4 m at this scale) cannot carry a
// 14 m road — under half the width the ribbon FOLDS. rMin = half width + kerb + margin keeps the shape and never folds.
// CURVATURE NOISE: straight lines between the read points put ALL the turning at the points, so curvature flickered between
// "straight" and "tight" and autoKerbs laid ~55 fragments (MEASURED: 84 corner edges round the lap). A CENTRIPETAL Catmull-Rom
// through the points (alpha 0.5: no cusps or loops where points bunch, which is what kinked the uniform one) then smoothing
// over +-3 samples: 36 edges.
export function traceTrack(mapPts, { mpp = 0.47, cx = 480, cy = 338, step = 1.5, rMin = 12, passes = 10, kern = 3 } = {}) {
  const centripetal = (p) => {
    const n = p.length, out = [];
    const tj = (a, b) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) || 1e-3;
    const L = (A, B, ta, tb, t) => [(A[0] * (tb - t) + B[0] * (t - ta)) / (tb - ta), (A[1] * (tb - t) + B[1] * (t - ta)) / (tb - ta)];
    for (let i = 0; i < n; i++) {
      const P0 = p[(i - 1 + n) % n], P1 = p[i], P2 = p[(i + 1) % n], P3 = p[(i + 2) % n];
      const t0 = 0, t1 = t0 + tj(P0, P1), t2 = t1 + tj(P1, P2), t3 = t2 + tj(P2, P3);
      const m = Math.max(4, Math.ceil(Math.hypot(P2[0] - P1[0], P2[1] - P1[1]) / 0.5));
      for (let j = 0; j < m; j++) {
        const t = t1 + (t2 - t1) * j / m;
        const A1 = L(P0, P1, t0, t1, t), A2 = L(P1, P2, t1, t2, t), A3 = L(P2, P3, t2, t3, t);
        out.push(L(L(A1, A2, t0, t2, t), L(A2, A3, t1, t3, t), t1, t2, t));
      }
    }
    return out;
  };
  const resample = (p) => {
    const out = []; const n = p.length; let carry = 0;
    for (let i = 0; i < n; i++) {
      const a = p[i], b = p[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      let t = carry; while (t < L) { out.push([a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L]); t += step; }
      carry = t - L;
    }
    return out;
  };
  const lap = (p, k, mask, w = 1) => p.map((q, i) => {
    if (mask && !mask[i]) return q;
    const a = p[(i - w + p.length) % p.length], b = p[(i + w) % p.length];
    return [q[0] + k * ((a[0] + b[0]) / 2 - q[0]), q[1] + k * ((a[1] + b[1]) / 2 - q[1])];
  });
  // R over an 8 m arc from SEGMENT headings (chord-to-chord angles averaged a short sharp bend away: Club read 11.7 m by the
  // chords and 6.6 m by the 8 m arc that kerbside.mjs uses — the same measure now)
  const radii = (p) => { const n = p.length, h = Math.max(1, Math.round(4 / step));
    const hd = p.map((q, i) => { const b = p[(i + 1) % n]; return Math.atan2(b[1] - q[1], b[0] - q[0]); });
    return p.map((_, i) => { let d = hd[(i + h) % n] - hd[(i - h + n) % n]; d = Math.atan2(Math.sin(d), Math.cos(d));
      return (2 * h * step) / Math.max(1e-4, Math.abs(d)); }); };
  let p = resample(centripetal(mapPts.map(([x, y]) => [(x - cx) * mpp, (y - cy) * mpp])));
  for (let k = 0; k < passes; k++) { p = lap(p, 0.5, null, kern); p = lap(p, -0.53, null, kern); }
  for (let it = 0; it < 3000; it++) {
    const R = radii(p), n = p.length, mask = new Array(n).fill(false); let bad = 0;
    const reach = Math.round(6 / step);
    for (let i = 0; i < n; i++) if (R[i] < rMin) { bad++; for (let j = -reach; j <= reach; j++) mask[(i + j + n) % n] = true; }
    if (!bad) break;
    p = lap(p, 0.5, mask);
    if (it % 20 === 19) p = resample(p);
  }
  return resample(p);
}
const SUB_CELL = 16;   // m, subtrack lookup grid cell
export function createSubtrack(apexes, width = 13, sectors = [], curvedKerbs = [], dense = false) {
  const pts = dense ? apexes : smoothPath(apexes, 20);
  let totalDist = 0;
  const sampled = [];
  const segs = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const hdg = Math.atan2(dy, dx);
    sampled.push({
      x: a[0], y: a[1], dist: totalDist,
      dirX: dx / (len || 1), dirY: dy / (len || 1),
      nx: -dy / (len || 1), ny: dx / (len || 1),
      heading: hdg, width,
    });
    totalDist += len;
    // pad 5 -> 18 m past the edge: the camber eases off over 6 m and the Naffcar back slope over 16 m; at 5 the lookup
    // returned "no track" part-way down them and the ground stepped. The GRID below keeps the wider pad cheap.
    const pad = width / 2 + 18;
    segs.push({
      ax: a[0], ay: a[1], bx: b[0], by: b[1],
      dx, dy, l2: len * len, len,
      minX: Math.min(a[0], b[0]) - pad, maxX: Math.max(a[0], b[0]) + pad,
      minY: Math.min(a[1], b[1]) - pad, maxY: Math.max(a[1], b[1]) + pad,
    });
  }

  function sectorAt(dist) {
    if (!sectors.length) return { surface: SURFACES.tarmac };
    for (let i = 0; i < sectors.length; i++) {
      const s = sectors[i];
      if (s.startDist > s.endDist) {
        if (dist >= s.startDist || dist < s.endDist) return s;
      } else {
        if (dist >= s.startDist && dist < s.endDist) return s;
      }
    }
    return { surface: SURFACES.tarmac };
  }

  // LOOKUP GRID (perf, 2026-10-03): segment indices per SUB_CELL m square of their padded box, so querySubtrack checks a
  // handful of segments instead of every one. MEASURED: a shaded Test Track ground tile cost 34 ms at phone-ish CPU speed.
  const grid = new Map();
  segs.forEach((g, i) => {
    for (let cx = Math.floor(g.minX / SUB_CELL); cx <= Math.floor(g.maxX / SUB_CELL); cx++)
      for (let cy = Math.floor(g.minY / SUB_CELL); cy <= Math.floor(g.maxY / SUB_CELL); cy++) {
        const k = cx * 100003 + cy; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(i);   // numeric key (string keys were slow: querySubtrack is the hottest function with AI cars)
      }
  });
  return { pts: sampled, segs, totalDist, width, sectors, sectorAt, curvedKerbs, grid };
}

// GHOST SEGMENT (point-to-point stages, user 2026-10-04: "rally stages are circular often — they should mostly be a LINE"). The engine's
// roads are closed loops (distances wrap at the start line); a point-to-point stage keeps that arithmetic by closing its loop with ONE
// invisible segment from the stop-zone end back to the run-up before the start. A ghost segment is not road: it is out of the lookup grid
// (querySubtrack never returns it, so physics / ground / resets / AI-progress never see it) and render.js does not draw it.
export function ghostSegment(sub, i) {
  sub.segs[i].ghost = true;
  for (const l of sub.grid.values()) { const k = l.indexOf(i); if (k >= 0) l.splice(k, 1); }
  sub.ghost = { d0: sub.pts[i].dist, d1: sub.pts[(i + 1) % sub.pts.length].dist || sub.totalDist };
  return sub;
}

// ---------------------------------------------------------------------------------------------
// OUTER TYRE WALL (user, 2026-10-03: "add a tyre wall around the stock car and grass track circuits";
// chose LOOSE stacks on the OUTSIDE only). Returns plain `tyrestack` objects for a level's `cones` list,
// so they are the same knockable 38 kg stacks as everywhere else — they burst into rolling tyres when hit
// hard (cones.js). Nothing new in the physics; the wall is DATA generated from the track's own centreline.
//
//   margin   m from the track EDGE to the centre of the stacks (the grass runoff before the wall)
//   spacing  m between stacks, measured along the WALL (not the centreline) so corners are as dense as
//            straights — the outside of a bend is longer than the centreline through it
//   clear    boxes {x, y, hw, hh} the wall must leave a gap round (props it would otherwise run through)
//
// "Outside" = the side of the centreline facing AWAY from the loop's centroid, which is right for any
// convex circuit (both ovals). A stack that would land within the track width + 1 m of ANY part of the
// circuit is also dropped, so a tight hairpin cannot throw part of the wall onto another bit of road.
export function outerTyreWall(subtrack, { margin = 3, spacing = 1.0, clear = [] } = {}) {
  const pts = subtrack.pts, halfW = subtrack.width / 2;
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  cx /= pts.length; cy /= pts.length;
  // the wall's own path: every centreline point pushed outward by halfW + margin
  const path = pts.map((p) => {
    const s = (p.x - cx) * p.nx + (p.y - cy) * p.ny >= 0 ? 1 : -1;
    return { x: p.x + s * p.nx * (halfW + margin), y: p.y + s * p.ny * (halfW + margin) };
  });
  const out = [];
  let carry = spacing;                 // distance walked since the last stack. Starts at `spacing` so the
                                       // first stack sits ON path[0] and the closing seam is one spacing, not two
  for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[(i + 1) % path.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let d = spacing - carry;           // where the next stack falls on this segment
    while (d <= len) {
      const x = a.x + (b.x - a.x) * (d / len), y = a.y + (b.y - a.y) * (d / len);
      const blocked = clear.some((c) => Math.abs(x - c.x) < c.hw && Math.abs(y - c.y) < c.hh)
        || querySubtrack(subtrack, x, y).dist < halfW + 1;
      if (!blocked) out.push({ x, y, kind: 'tyrestack' });
      d += spacing;
    }
    carry = len - (d - spacing);
  }
  return out;
}

// The clearance a prop needs from the wall, from its kind. Half-extents in metres, padded ~0.6 m beyond
// what render.js draws (a stack is 0.48 m in radius). Kinds not listed sit in the infield, away from it.
function propClearance(props) {
  const size = { pylon: [1.6, 1.6], board: [9.6, 1.7], official_box: [2.8, 2.4] };
  return props.flatMap((p) => {
    if (p.kind === 'grandstand') return [{ x: p.x, y: p.y, hw: p.w / 2 + 1, hh: p.h / 2 + 1 }];
    const s = size[p.kind];
    return s ? [{ x: p.x, y: p.y, hw: s[0], hh: s[1] }] : [];
  });
}

// A cover placed BY DISTANCE ALONG A TRACK (2026-10-03): \`offset\` metres to the left (+) / right (-) of the
// centreline, rotated to the road. Data, so "move that puddle" is one number — and it stays on the road if
// the track shape changes.
export function onTrack(sub, dist, offset, cover) {
  const pts = sub.pts;
  let p = pts[0];
  for (let i = 0; i < pts.length; i++) if (pts[i].dist <= dist) p = pts[i];
  return { ...cover, x: p.x + p.nx * offset, y: p.y + p.ny * offset, rot: p.heading };
}

export function querySubtrack(subtrack, px, py) {
  if (!subtrack || !subtrack.segs) return { dist: Infinity, side: 'left', trackDist: 0 };
  const segs = subtrack.segs;
  if (subtrack === qsHintSub) {
    const n = segs.length, lim = (subtrack.width / 2 + 3) ** 2; let bd = Infinity, bi = -1, bt = 0;
    for (let o = -21; o <= 21; o++) { const i = (qsHint + o + n) % n, sg = segs[i]; if (sg.ghost) continue;
      let t = ((px - sg.ax) * sg.dx + (py - sg.ay) * sg.dy) / (sg.l2 || 1); if (t < 0) t = 0; else if (t > 1) t = 1;
      const ex = px - (sg.ax + t * sg.dx), ey = py - (sg.ay + t * sg.dy), d = ex * ex + ey * ey; if (d < bd) { bd = d; bi = i; bt = t; } }
    if (bd < lim) { const sg = segs[bi], cross = sg.dx * (py - sg.ay) - sg.dy * (px - sg.ax);
      return { dist: Math.sqrt(bd), side: cross > 0 ? 'left' : 'right', trackDist: subtrack.pts[bi].dist + bt * sg.len, seg: bi }; }
  }
  let minD = Infinity;
  let bestSide = 'left';
  let bestTrackDist = 0, bestSeg = null;
  const cand = subtrack.grid ? subtrack.grid.get(Math.floor(px / SUB_CELL) * 100003 + Math.floor(py / SUB_CELL)) : null;
  if (subtrack.grid && !cand) return { dist: Infinity, side: 'left', trackDist: 0, seg: null };
  const nC = cand ? cand.length : segs.length;
  for (let ci = 0; ci < nC; ci++) {
    const i = cand ? cand[ci] : ci;
    const s = segs[i];
    if (px < s.minX || px > s.maxX || py < s.minY || py > s.maxY) continue;
    let t = ((px - s.ax) * s.dx + (py - s.ay) * s.dy) / (s.l2 || 1);
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const ex = px - (s.ax + t * s.dx), ey = py - (s.ay + t * s.dy), d = ex * ex + ey * ey;   // squared; one sqrt at the end
    if (d < minD) {
      minD = d;
      const cross = s.dx * (py - s.ay) - s.dy * (px - s.ax);
      // 'left' = the +normal side (nx = -dy, ny = dx), the SAME convention render.js drawCurvedKerbs uses. MEASURED BUG,
      // 2026-10-03 (tools/visualcheck.mjs): this said 'right', so every kerb you drove on was on the OPPOSITE side of the
      // track from the kerb you could see — invisible bumps on plain grass, and painted kerbs that were just grass.
      bestSide = cross > 0 ? 'left' : 'right';
      bestTrackDist = subtrack.pts[i].dist + t * s.len;
      bestSeg = i;
    }
  }
  return { dist: Math.sqrt(minD), side: bestSide, trackDist: bestTrackDist, seg: bestSeg };
}

export function distToSubtrack(subtrack, px, py) {
  return querySubtrack(subtrack, px, py).dist;
}

export function findNearestSubtrackPoint(subtrack, x, y, maxProgressDist = Infinity) {
  if (!subtrack || !subtrack.pts.length) return null;
  const pts = subtrack.pts;
  let best = null, bestDist2 = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    // Never place ahead of driven distance
    if (p.dist > maxProgressDist + 8) continue;
    const dx = x - p.x, dy = y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist2) {
      bestDist2 = d2;
      best = p;
    }
  }
  return best || pts[0];
}

function courseCones(apexes = COURSE, gate = GATE, spacing = GATE_SPACING) {
  const path = smoothPath(apexes);
  const out = [];
  let acc = spacing;                          // place one at the very start
  for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[(i + 1) % path.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const seg = Math.hypot(dx, dy);
    acc += seg;
    if (acc < spacing) continue;
    acc = 0;
    const ux = dx / (seg || 1), uy = dy / (seg || 1);
    const hx = -uy * gate / 2, hy = ux * gate / 2;
    out.push({ x: a[0] + hx, y: a[1] + hy }, { x: a[0] - hx, y: a[1] - hy });
  }
  return out;
}

// A slalom is still the clearest way to feel a car change direction, so one survives beside the course.
function slalom(x0, y0, dx, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: x0 + i * dx, y: y0 + (i % 2 ? 4.5 : -4.5) });
  return out;
}

export const CONE_R = 0.20;

// =============================================================================================
// THE SURFACE SANDBOX — REBUILT 2026-10-03 as a real circuit (user: "rebuild the surface sandbox to cover all
// surface types, cones, tyres and make it similar to the test track in the sense it's a real track with lap
// timer and reset functions but unique and better. Beautiful and functional. Put some mixed testing
// functions like wet spots and snow or ice patches, long and short grass patches").
//
// It is a SUBTRACK, like the Test Track, so the lap timer, the lap counter and RESET-to-the-track all work
// with no new code. One lap (~1.67 km) runs through EVERY surface in the game, in an order that flows:
//   start straight RACE TARMAC > T1 sweeper TARMAC > chicane BROKEN TARMAC (kerbs) >
//   fast sweeper RALLY GRAVEL > top hairpin DIRT > esses SAND > MUD > THICK MUD hairpin >
//   LONG GRASS > SHORT GRASS > SNOW > ICE > WET TARMAC > home.
// On the road: COVERS as surprises — a puddle on the start straight, black ice in the T1 sweeper, a snow
// drift across the gravel, a puddle in the dirt hairpin, an ice patch on the short grass.
// In the infield: rounded TEST PADS (wet, snow, ice, mud, gravel, sand) like the Test Track's, and patches
// of long and short grass to drive across and wear.
// Everything is placed BY DISTANCE ALONG THE TRACK (sbAt), and kerbs / barriers find the inside or outside
// of a corner from the track's own curvature — so moving an apex keeps them all where they belong.
// The old ring version (2026-09-28) laid surface boxes across a circular cone course; it had no lap.
const SB_APEXES = [
  [-100, 190], [60, 190], [160, 170], [200, 110], [188, 48], [140, 22], [158, -32], [200, -80],
  [190, -160], [130, -200], [60, -170], [40, -110], [-20, -80], [-80, -120], [-140, -180], [-200, -150],
  [-210, -70], [-160, -20], [-120, 30], [-170, 80], [-200, 140], [-170, 190],
];
// geometry measured 2026-10-03 (scratch design script): lap 1669 m, tightest centreline radius 11.8 m
// (the chicane), closest approach of two parts of the track 49.7 m, max extent 213 m (floor edge 256).
const SB_W = 13;
const SB_SECTORS = [];            // filled below, by apex distance, once the track exists
const SB_KERBS = [];
const SB_SUBTRACK = createSubtrack(SB_APEXES, SB_W, SB_SECTORS, SB_KERBS);
// distance along the lap of apex i (smoothPath samples 20 points per apex segment)
const sbApex = (i) => SB_SUBTRACK.pts[(i * 20) % SB_SUBTRACK.pts.length].dist;
function sbPt(d) {
  const pts = SB_SUBTRACK.pts, total = SB_SUBTRACK.totalDist;
  d = ((d % total) + total) % total;
  let p = pts[0]; for (const q of pts) if (q.dist <= d) p = q;
  return p;
}
// +1 if the track turns toward +n (the 'left' side) around d, -1 if toward -n
function sbTurn(d) {
  let dh = sbPt(d + 10).heading - sbPt(d - 10).heading;
  dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  return dh >= 0 ? 1 : -1;
}
// a point \`off\` metres from the centreline at d; off > 0 = toward +n
function sbAt(d, off = 0) { const p = sbPt(d); return { x: p.x + p.nx * off, y: p.y + p.ny * off, rot: p.heading }; }
// sectors, by apex index: [from apex, to apex, surface]
[[0, 2, 'racetarmac'], [2, 4, 'tarmac'], [4, 7, 'broken'], [7, 9, 'gravel'], [9, 11, 'dirt'], [11, 13, 'sand'],
 [13, 14, 'mud'], [14, 15, 'thickMud'], [15, 16, 'grassLong'], [16, 17, 'grassShort'], [17, 18, 'snow'],
 [18, 19, 'ice'], [19, 21, 'wet'], [21, 22, 'racetarmac']].forEach(([a, b, id]) => {
  SB_SECTORS.push({ startDist: sbApex(a), endDist: b >= SB_APEXES.length ? 1e9 : sbApex(b), surface: SURFACES[id] });
});
// kerbs on the INSIDE of the tarmac corners (T1, the chicane's three bends, the last corner)
[[3, 30], [4, 22], [5, 22], [6, 22], [20, 30]].forEach(([i, half]) => {
  const d = sbApex(i);
  SB_KERBS.push({ side: sbTurn(d) > 0 ? 'left' : 'right', startDist: d - half, endDist: d + half, width: 2.4, h: 0.11 });
});
// a row of loose tyre stacks on the OUTSIDE of a corner, from d0 to d1, \`gap\` m out from the edge
function sbBarrier(d0, d1, gap = 4, spacing = 1.2) {
  const out = [];
  for (let d = d0; d <= d1; d += spacing) {
    const side = -sbTurn(d);
    const p = sbAt(d, side * (SB_W / 2 + gap));
    out.push({ x: p.x, y: p.y, kind: 'tyrestack' });
  }
  return out;
}
const SB_CONES = [
  ...courseCones(SB_APEXES, SB_W, 18),                              // gates lining the whole lap
  ...sbBarrier(sbApex(2) + 10, sbApex(3) + 30),                     // T1, end of the long straight
  ...sbBarrier(sbApex(8) + 20, sbApex(9) + 40),                     // top hairpin
  ...sbBarrier(sbApex(14) - 20, sbApex(15) + 10),                   // thick mud hairpin
  ...sbBarrier(sbApex(18) - 10, sbApex(18) + 25),                   // ice corner
];
const SB_COVERS = [
  { ...sbAt(120, 3), w: 9, h: 5, cover: 'wet', shape: 'ellipse' },                  // puddle on the start straight
  { ...sbAt(sbApex(3), 0), w: 16, h: 9, cover: 'ice', shape: 'ellipse' },         // black ice in the T1 sweeper
  { ...sbAt(sbApex(8) - 25, 0), w: 22, h: 10, cover: 'snow', shape: 'ellipse' },   // snow drift across the gravel
  { ...sbAt(sbApex(10), -2), w: 8, h: 5, cover: 'wet', shape: 'ellipse' },         // puddle in the dirt hairpin
  { ...sbAt((sbApex(16) + sbApex(17)) / 2, 1), w: 14, h: 8, cover: 'ice', shape: 'ellipse' }, // ice on the short grass
];
// INFIELD: rounded test pads + long / short grass patches (all checked clear of the road, see ENGINE.md)
const SB_ZONES = [
  { x: -40, y: 120, w: 50, h: 30, surface: SURFACES.wet, boxed: true, rounded: true },
  { x: 20, y: 120, w: 50, h: 30, surface: SURFACES.snow, boxed: true, rounded: true },
  { x: 80, y: 120, w: 50, h: 30, surface: SURFACES.ice, boxed: true, rounded: true },
  { x: -10, y: 70, w: 50, h: 30, surface: SURFACES.mud, boxed: true, rounded: true },
  { x: 50, y: 70, w: 50, h: 30, surface: SURFACES.gravel, boxed: true, rounded: true },
  { x: 110, y: 70, w: 40, h: 30, surface: SURFACES.sand, boxed: true, rounded: true },
  { x: -60, y: 20, w: 60, h: 34, surface: SURFACES.grassLong },
  { x: 20, y: 15, w: 50, h: 26, surface: SURFACES.grassLong },
  { x: 90, y: -10, w: 36, h: 40, surface: SURFACES.grassLong },
  { x: -10, y: -30, w: 40, h: 20, surface: SURFACES.grassLong },
  { x: 140, y: -120, w: 50, h: 40, surface: SURFACES.grassLong },
  { x: 60, y: 160, w: 80, h: 18, surface: SURFACES.grassLong },
];
// NO JUMPS on this level (user, 2026-10-03: "no jumps on the surface sandbox new level please"). The
// ramp, the gravel table and the dirt whoops were removed; the lab keeps its own jumps.
const SB_BUMPS = [];
const SB_START = sbAt(0);
const SB_PAINT = [{ kind: 'chequered', x: SB_START.x, y: SB_START.y, len: 1.6, wid: SB_W, rot: SB_START.rot }];
const SB_BOARDS = [{ ...sbAt(0, -(SB_W / 2 + 3)), label: 'FINISH' }];
const SB_PROPS = [
  { kind: 'grandstand', x: -20, y: 222, w: 60, h: 8, rot: 0 },
  { kind: 'pylon', x: -150, y: 225 }, { kind: 'pylon', x: 110, y: 225 },
  { kind: 'board', x: 70, y: 212, label: 'SURFACE SANDBOX' },
];
const SB_SPAWN = { ...sbAt(-12), heading: sbAt(-12).rot };

// A couple of bumps in the LAB too, on the tarmac quarter, well away from the drag strip and the
// skidpad — the measured benches must keep running on flat ground.
const LAB_BUMPS = prepBumps([
  { kind: 'ramp', x: 120, y: -80, rot: Math.PI / 2, len: 16, wid: 13, h: 1.30 },
  { kind: 'table', x: 120, y: -140, rot: Math.PI / 2, len: 26, wid: 14, h: 0.85 },
  ...[0, 1, 2, 3].map((i) => ({ kind: 'hump', x: 60, y: -60 - i * 14, r: 6.5, h: 0.30 })),
  { kind: 'kerb', x: 185, y: -40, rot: 0, len: 44, wid: 3.4, h: 0.11 },
  // ---- SUSPENSION TEST ZONE (user, 2026-10-03: "add some bumps and dips to the lab level and mark it out as a
  // suspension test zone"; chose whoops + dips/compressions + washboard + banked bowl). The bare lab floor, south-west,
  // x -245..0, y 162..214 — scanned clear of cones, panels, the drag strip (y 240) and the benches. Drive WEST -> EAST.
  // Lane 1 (y 172): WHOOPS, six round humps rising 0.15 -> 0.40 m, 9 m apart.
  ...[0.15, 0.20, 0.25, 0.30, 0.35, 0.40].map((h, i) => ({ kind: 'hump', x: -228 + i * 9, y: 172, r: 3.2, h })),
  // Lane 2 (y 187): DIPS, five hollows 0.15 -> 0.45 m deep, then one BIG COMPRESSION (wide, 0.8 m).
  ...[0.15, 0.22, 0.30, 0.37, 0.45].map((d, i) => ({ kind: 'dip', x: -228 + i * 10, y: 187, r: 3.6, d })),
  { kind: 'dip', x: -160, y: 187, r: 9, d: 0.8 },
  // Lane 3 (y 203): WASHBOARD, 50 m of 0.9 m ripples, 5 cm deep.
  { kind: 'washboard', x: -205, y: 203, rot: 0, len: 50, wid: 7, amp: 0.05, wave: 0.9 },
  // BANKED BOWL at the east end: flat floor to 6 m, wall rising to 2.5 m at 18 m (flat at the bottom, steep at the top),
  // back slope out over 6 m.
  { kind: 'bowl', x: -36, y: 188, r0: 6, R: 18, h: 2.5, B: 6 },
]);

const LAB_PANELS = [
  ['ice', 'snow', 'wet'],
  ['mud', 'sand', 'broken'],
].flatMap((row, r) => row.map((id, c) => ({
  x: -228 + c * 66, y: 74 + r * 66, w: 56, h: 56, surface: SURFACES[id], boxed: true,
}))).concat([
  // 2026-10-03: long grass was defined but on no level, and thick mud is new — so both get a test panel,
  // in the clear north-west grass quarter (scanned clear of cones, bumps, paint and the spawn).
  { x: -143, y: -106, w: 56, h: 56, surface: SURFACES.grassLong, boxed: true },
  { x: -77, y: -106, w: 56, h: 56, surface: SURFACES.thickMud, boxed: true },
]);

// =============================================================================================
// S-B THE LAB EXTENSION (user, 2026-10-06, VERBATIM: "add some of every object laid out nicely ready to test crash into ect into he lab
// level, maybe extend the bottom of the map ? with some strips of all the different tarmacs and stuff, the objects can be at the end of
// the lanes make it fun and useful"; Q3 "go 1k why not fill the other area with an off road test area with some test hills grass and dirt
// with active terrain"; Q4 "ideally one for each but maybe mix some if needed"). The floor goes from 520 x 520 to 520 x 1000 m: the old
// square is untouched (tools/_labcheck.mjs proves every old metre is the same) and the new 480 m runs SOUTH of it, in the lab floor.
//   y 290..526  CRASH LANES: one per surface (17), 11 m wide, 460 m long, driven WEST -> EAST; at the east end of each, one object kind
//               (two kinds where 21 kinds meet 17 lanes) laid out to drive into. Boxed: no blend, no inclusions, so each stays pure.
//   y 548..732  OFF-ROAD AREA: grass with long grass, a mud bog, sand, gravel, a dirt loop round it and a dirt straight with jumps, plus
//               hills and hollows. Grass / dirt / mud / sand carry the natural terrain (NAT_SURF) and all of it wears (the wear map).
export const LAB_BOUNDS = { x0: -260, x1: 260, y0: -260, y1: 740 };
const LANE_Y0 = 296, LANE_PITCH = 14, LANE_H = 11, LANE_X0 = -245, LANE_X1 = 215, OBJ_X = 168;
// [surface, object kinds at the end] - hard -> loose -> cold. Mixed pairs: exhaust + bumper, chevron + flag, cow + crate, sheep + bin (S-C: the animals FIRST, so you can hit one clean).
export const LAB_LANES = [
  ['lab', ['cone']], ['racetarmac', ['tyrestack']], ['tarmac', ['banger']], ['concrete', ['caravan']], ['broken', ['podium']],
  ['wet', ['tyre']], ['dirt', ['bale']], ['gravel', ['pallet']], ['sand', ['sandbag']], ['grassShort', ['box']], ['grass', ['cow', 'crate']],
  ['grassLong', ['sheep', 'bin']], ['mud', ['barrel']], ['thickMud', ['exhaust', 'bumper']], ['packedSnow', ['chevron', 'flag']],
  ['snow', ['tarp']], ['ice', ['tapepost']],
].map(([id, kinds], i) => ({ id, kinds, y: LANE_Y0 + i * LANE_PITCH }));
const LAB_LANE_ZONES = LAB_LANES.map((l) => ({ x: (LANE_X0 + LANE_X1) / 2, y: l.y, w: LANE_X1 - LANE_X0, h: LANE_H, surface: SURFACES[l.id], boxed: true, ext: true, lane: l.id }));
const LANE_COLS = ['#c8302c', '#2b56b5', '#d6a21e', '#2f5d3a', '#3a3f47', '#2f6fb0'];
// what sits at the end of a lane: a wall / grid / row per kind, centred on the lane line, starting at OBJ_X
function laneObjects(kinds, y, li) {
  const out = [], col = (n) => LANE_COLS[(li + n) % LANE_COLS.length];
  for (const [ki, kind] of kinds.entries()) {
    const x0 = OBJ_X + ki * 14;        // the second kind of a mixed lane sits 14 m further on
    if (kind === 'cone') { for (let c = 0; c < 4; c++) for (let r = 0; r < 5; r++) out.push({ kind: 'cone', x: x0 + c * 4, y: y - 4 + r * 2 }); }
    else if (kind === 'tyrestack') { for (let c = 0; c < 2; c++) for (let r = 0; r < 9; r++) out.push({ kind: 'tyrestack', x: x0 + c * 1.0, y: y - 4 + r * 1.0 }); }
    else if (kind === 'tyre') { for (let c = 0; c < 3; c++) for (let r = 0; r < 4; r++) out.push({ kind: 'tyre', x: x0 + c * 3, y: y - 4.5 + r * 3 }); }
    else if (kind === 'bale') { for (let r = 0; r < 6; r++) out.push({ kind: 'bale', x: x0, y: y - 4.2 + r * 1.7 }); out.push({ kind: 'bale', x: x0 + 8, y: y - 1 }, { kind: 'bale', x: x0 + 8, y: y + 1 }); }
    else if (kind === 'banger') { out.push({ kind: 'banger', x: x0 + 2, y, rot: Math.PI / 2, paint: '#8b2a26', num: '42' }, { kind: 'banger', x: x0 + 12, y: y - 2.5, rot: 0.3, paint: '#2a4d7a', num: '17' }, { kind: 'banger', x: x0 + 12, y: y + 2.8, rot: -0.3, paint: '#8b7a2b', num: '88' }); }
    else if (kind === 'caravan') { out.push({ kind: 'caravan', x: x0 + 3, y, rot: Math.PI / 2 }, { kind: 'caravan', x: x0 + 16, y: y + 1, rot: 0.2 }); }
    else if (kind === 'podium') out.push({ kind: 'podium', x: x0 + 3, y, rot: 0 });
    else if (kind === 'sheep') { for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) out.push({ kind: 'sheep', x: x0 + c * 2.6, y: y - 2.8 + r * 2.8, rot: (c + r) * 0.9 }); }
    else if (kind === 'cow') { for (let r = 0; r < 3; r++) out.push({ kind: 'cow', x: x0 + (r % 2) * 3.5, y: y - 3.4 + r * 3.4, rot: r * 0.5 }); }
    else if (kind === 'chevron') { for (let r = 0; r < 4; r++) out.push({ kind: 'chevron', x: x0, y: y - 3.9 + r * 2.6, rot: Math.PI / 2, col: '#c8302c' }); }
    else if (kind === 'flag') { for (let r = 0; r < 3; r++) out.push({ kind: 'flag', x: x0, y: y - 3.5 + r * 3.5, col: col(r) }); }
    else if (kind === 'tapepost') { for (const [t, dx] of [[0, 0], [1, 8]]) for (let r = 0; r < 5; r++) out.push({ kind: 'tapepost', x: x0 + dx, y: y - 5 + r * 2.5, tape: 'lab-ice-' + t, idx: r }); }
    else { const n = kinds.length > 1 ? 2 : 3; for (let c = 0; c < n; c++) for (let r = 0; r < 3; r++) out.push({ kind, x: x0 + c * 4, y: y - 3.5 + r * 3.5, rot: (c * 3 + r) * 0.7, col: col(c * 3 + r) }); }
  }
  return out;
}
const LAB_CRASH_OBJECTS = LAB_LANES.flatMap((l, i) => laneObjects(l.kinds, l.y, i));
// the OFF-ROAD AREA (first listed wins: the small features before the grass they sit in)
const OR_Y = 640;
const LAB_OFFROAD_ZONES = [
  { x: -20, y: OR_Y, w: 16, h: 12, surface: SURFACES.thickMud },                 // the bog's deep middle
  { x: -20, y: OR_Y, w: 40, h: 30, surface: SURFACES.mud },                      // MUD BOG
  { x: 0, y: 600, w: 200, h: 8, surface: SURFACES.dirt },                        // DIRT STRAIGHT with the jumps
  { x: 0, y: 558, w: 488, h: 8, surface: SURFACES.dirt },                        // DIRT LOOP round the area: north,
  { x: 0, y: 722, w: 488, h: 8, surface: SURFACES.dirt },                        //   south,
  { x: -240, y: OR_Y, w: 8, h: 172, surface: SURFACES.dirt },                    //   west,
  { x: 240, y: OR_Y, w: 8, h: 172, surface: SURFACES.dirt },                     //   east
  { x: -168, y: OR_Y, w: 136, h: 140, surface: SURFACES.grassLong },             // LONG GRASS meadow (west)
  { x: 196, y: 598, w: 64, h: 52, surface: SURFACES.sand },                      // SAND (east; dunes from NAT_SURF whoops)
  { x: 196, y: 682, w: 64, h: 52, surface: SURFACES.gravel },                    // GRAVEL
  { x: 0, y: OR_Y, w: 496, h: 184, surface: SURFACES.grass },                    // the rest: GRASS (rolling natural terrain)
].map((z) => ({ ...z, ext: true }));
const LAB_OFFROAD_BUMPS = [
  { kind: 'ramp', x: -40, y: 600, rot: 0, len: 14, wid: 8, h: 1.2 },             // the straight: a launch ramp ...
  { kind: 'table', x: 40, y: 600, rot: 0, len: 24, wid: 9, h: 1.0 },             // ... then a table top
  { kind: 'hump', x: -60, y: 688, r: 28, h: 3.5 },                               // HILLS
  { kind: 'hump', x: 60, y: 690, r: 22, h: 2.2 },
  { kind: 'hump', x: 130, y: 676, r: 30, h: 5.0 },                               // the big one
  { kind: 'hump', x: 112, y: 612, r: 14, h: 1.6 },
  ...[0, 1, 2, 3, 4].map((i) => ({ kind: 'hump', x: -110 + i * 11, y: 710, r: 4, h: 0.45 })),   // whoops in the grass by the loop
  { kind: 'dip', x: -170, y: 640, r: 14, d: 1.2 },                               // a hollow in the long grass
  { kind: 'dip', x: 70, y: 632, r: 9, d: 0.7 },
  { kind: 'washboard', x: -150, y: 558, rot: 0, len: 60, wid: 7, amp: 0.05, wave: 0.9 },   // corrugations on the loop
];
const LAB_EXT_PAINT = [
  { kind: 'box', x: (LANE_X0 + LANE_X1) / 2, y: (LAB_LANES[0].y + LAB_LANES[LAB_LANES.length - 1].y) / 2, w: LANE_X1 - LANE_X0 + 8, h: LAB_LANES.length * LANE_PITCH + 6, tone: 0.8 },
  { kind: 'box', x: 0, y: OR_Y, w: 500, h: 188, tone: 0.8 },
];
const LAB_EXT_BOARDS = [
  { x: -15, y: 282, label: 'CRASH TEST LANES  -  drive EAST, objects at the end' },
  ...LAB_LANES.map((l) => ({ x: LANE_X0 + 18, y: l.y, label: l.kinds.map((k) => (k === 'tapepost' ? 'TAPE' : k.toUpperCase())).join(' + ') + '  >' })),
  { x: 0, y: 541, label: 'OFF-ROAD TEST AREA  -  hills, grass, dirt, mud, sand, gravel' },
];

// =============================================================================================
// THE TEST TRACK (A flowing road course showcasing all surface types)
const TT_APEXES = [
  [-70, -95], [0, -95], [70, -95],                 // Main straight (Race Tarmac)
  [120, -75], [145, -20], [130, 35],               // Turn 1 sweeping right (Tarmac)
  [95, 75], [55, 95], [15, 75],                    // Turn 2 chicane (Broken Tarmac + Kerbs)
  [-30, 95], [-85, 115], [-135, 90],               // Turn 3 dirt sweeper (Dirt Road)
  [-145, 40], [-115, 5], [-140, -35],              // Turn 4 hairpin cut (Long / Short Grass)
  [-110, -75],                                     // Turn 5 entry back to straight
];

const TT_CURVED_KERBS = [
  // Turn 1 Apex inside (Right / -nx)
  { side: 'right', startDist: 180, endDist: 280, width: 2.4, h: 0.11 },
  // Turn 1 Exit outside (Left / +nx)
  { side: 'left', startDist: 285, endDist: 345, width: 2.4, h: 0.11 },
  // Turn 2 Chicane Entry 1 apex (Left / +nx)
  { side: 'left', startDist: 365, endDist: 415, width: 2.4, h: 0.11 },
  // Turn 2 Chicane Flick 2 apex (Right / -nx)
  { side: 'right', startDist: 425, endDist: 470, width: 2.4, h: 0.11 },
  // Turn 2 Chicane Exit outside (Left / +nx)
  { side: 'left', startDist: 470, endDist: 510, width: 2.4, h: 0.11 },
  // Turn 4 Double Hairpin Apex 1 (Right / -nx)
  { side: 'right', startDist: 690, endDist: 735, width: 2.4, h: 0.11 },
  // Turn 4 Double Hairpin Apex 2 (Left / +nx)
  { side: 'left', startDist: 745, endDist: 785, width: 2.4, h: 0.11 },
  // Turn 5 Final Corner Exit outside (Right / -nx)
  { side: 'right', startDist: 805, endDist: 855, width: 2.4, h: 0.11 },
];

const TT_SECTORS = [
  // Sector 1: Race Tarmac main straight
  { startDist: 820, endDist: 150, surface: SURFACES.racetarmac },
  // Sector 2: Turn 1 sweeper
  { startDist: 150, endDist: 345, surface: SURFACES.tarmac },
  // Sector 3: Chicane with broken tarmac
  { startDist: 345, endDist: 495, surface: SURFACES.broken },
  // Sector 4: Off-road dirt sweeper
  { startDist: 495, endDist: 675, surface: SURFACES.dirt },
  // Sector 5: Double Hairpin & return straight
  { startDist: 675, endDist: 820, surface: SURFACES.tarmac },
];

const TT_SUBTRACK = createSubtrack(TT_APEXES, 13, TT_SECTORS, TT_CURVED_KERBS);
const TT_CONES = [
  ...courseCones(TT_APEXES, 13, 14),
  // Chicane and corner protection tyre stacks
  { x: 58, y: 72, kind: 'tyrestack' },
  { x: 55, y: 70, kind: 'tyrestack' },
  { x: 32, y: 96, kind: 'tyrestack' },
  { x: 35, y: 98, kind: 'tyre' },
  // Turn 1 run-off safety buffers
  { x: 148, y: -20, kind: 'tyrestack' },
  { x: 146, y: -25, kind: 'tyre' },
  // Infield testing pad entrance tyre stacks
  { x: -20, y: -16, kind: 'tyrestack' },
  { x: -22, y: -18, kind: 'tyre' },
  { x: 20, y: -16, kind: 'tyrestack' },
];

const TT_ZONES = [
  // Dedicated Infield Proving Ground testing facilities:
  { x: 0, y: -30, w: 54, h: 28, surface: SURFACES.wet, boxed: true, rounded: true },
  { x: -58, y: -30, w: 46, h: 28, surface: SURFACES.ice, boxed: true, rounded: true },
  { x: 58, y: -30, w: 46, h: 28, surface: SURFACES.snow, boxed: true, rounded: true },
  { x: -30, y: 25, w: 52, h: 32, surface: SURFACES.mud, boxed: true, rounded: true },
  { x: 32, y: 25, w: 52, h: 32, surface: SURFACES.gravel, boxed: true, rounded: true },
];

const TT_BUMPS = prepBumps([
  // Table jump on the straight exit (straight ramp on straight section)
  { kind: 'table', x: 45, y: -95, rot: 0, len: 24, wid: 14, h: 0.80 },
]);

const TT_PAINT = [
  // Chequered Grand Prix start/finish line — exactly aligned with road centerline and heading
  { kind: 'chequered', x: -48, y: -96.48, len: 1.6, wid: 13, rot: 0.0109 },
];

const TT_BOARDS = [
  { x: -48, y: -87.5, label: 'FINISH' },
  { x: 0, y: -87.5, label: '50m' },
  { x: 50, y: -87.5, label: '100m' },
];

// =============================================================================================
// GRASS OVAL (Dirt/Grass/Mud Track — PLAN.md §3)
// Counter-clockwise (turning left). Start/finish at x=0, y=38.
// =============================================================================================
const GO_APEXES = [
  [0, 38], [55, 38], [85, 18], [85, -18], [55, -38], [0, -38], [-55, -38], [-85, -18], [-85, 18], [-55, 38]
];
const GO_SECTORS = [
  { startDist: 0, endDist: 55, surface: SURFACES.grassShort },
  { startDist: 55, endDist: 185, surface: SURFACES.dirt },
  { startDist: 185, endDist: 240, surface: SURFACES.grassShort },
  { startDist: 240, endDist: 1000, surface: SURFACES.dirt },
];
const GO_CURVED_KERBS = [
  // Inner kerb hugging the inside edge (right of path vector)
  { side: 'right', startDist: 0, endDist: 1000, width: 2.0, h: 0.08 }
];
const GO_SUBTRACK = createSubtrack(GO_APEXES, 14, GO_SECTORS, GO_CURVED_KERBS);
const GO_RANDOM_PATCHES = [];      // filled by randomiseGrassTrack on every load

// GRASS TRACK LAYOUT (user, 2026-10-03, second pass): "it should be mostly as I asked — grass on the straights
// and dirt on the corners — however random patches, single squares etc of grass, long grass or mud or dirt,
// randomly throughout the normal course. The course should change just these random patches."
//   1. the BASE is fixed: every corner dirt, every straight short grass (heading change over 12 m > GO_TURN).
//   2. each load scatters GO_PATCHES random PATCHES over the racing surface (LEVEL.patches): small blobs
//      1-5 m across of long grass, mud, thick mud, dirt or grass, chosen by what they sit in. They are real
//      ground — physics, wear and graphics all read them (layersAt / drawPatches) — and only they change.
// The first version randomised the sectors themselves in 10-30 m runs; the user found that too uniform.
const GO_TURN = 0.25;
const GO_MIN_RUN = 20;             // m; shorter base runs are absorbed into their neighbours
const GO_PATCHES = 46;
const GO_PATCH_ON_STRAIGHT = [['dirt', 0.30], ['mud', 0.25], ['grassLong', 0.30], ['thickMud', 0.15]];
const GO_PATCH_ON_CORNER = [['grassShort', 0.30], ['mud', 0.35], ['grassLong', 0.15], ['thickMud', 0.20]];
function pick(table, x) { for (const [id, w] of table) { if ((x -= w) < 0) return id; } return table[table.length - 1][0]; }
function randomiseGrassTrack(sub, sectors, patches, rng = Math.random) {
  const pts = sub.pts, total = sub.totalDist;
  const headingAt = (d) => { let p = pts[0]; for (const q of pts) if (q.dist <= d) p = q; return p; };
  const isCorner = (d) => {
    const dh = headingAt((d + 12) % total).heading - headingAt(d).heading;
    return Math.abs(Math.atan2(Math.sin(dh), Math.cos(dh))) > GO_TURN;
  };
  // 1. fixed base
  sectors.length = 0;
  for (let d = 0; d < total; d += 1) {
    const surface = isCorner(d) ? SURFACES.dirt : SURFACES.grassShort;
    const last = sectors[sectors.length - 1];
    if (last && last.surface === surface) last.endDist = d + 1;
    else sectors.push({ startDist: d, endDist: d + 1, surface });
  }
  // absorb runs shorter than GO_MIN_RUN into their neighbours. MEASURED 2026-10-03: the raw corner test
  // flickered 1 m dirt/grass slivers at every corner boundary and left an 11 m grass strip between the two
  // bends at each end of the oval — 23 sectors where the design is 4 (two straights, two dirt ends).
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < sectors.length; i++) {
      const sc = sectors[i];
      if (sc.endDist - sc.startDist >= GO_MIN_RUN) continue;
      const prev = sectors[(i - 1 + sectors.length) % sectors.length];
      sc.surface = prev.surface; changed = true;
    }
    for (let i = sectors.length - 1; i > 0; i--) {
      if (sectors[i].surface === sectors[i - 1].surface) { sectors[i - 1].endDist = sectors[i].endDist; sectors.splice(i, 1); }
    }
    if (sectors.length < 2) break;
  }
  sectors[sectors.length - 1].endDist = 1e9;
  // 2. random patches across the racing surface
  patches.length = 0;
  for (let n = 0; n < GO_PATCHES; n++) {
    const d = rng() * total, p = headingAt(d);
    const off = (rng() - 0.5) * (sub.width - 2);
    // a CLUSTER of 0.5-1 m squares (squares, not ellipses — user, with the pixel-art pass): 1-3 for a single
    // spot, up to ~12 for a bigger patch
    const surface = SURFACES[pick(isCorner(d) ? GO_PATCH_ON_CORNER : GO_PATCH_ON_STRAIGHT, rng())];
    const cx0 = p.x + p.nx * off, cy0 = p.y + p.ny * off, spread = rng() < 0.3 ? 2.2 : 0.8;
    const count = spread > 1 ? 6 + Math.floor(rng() * 7) : 1 + Math.floor(rng() * 3);
    for (let k = 0; k < count; k++) {
      const w = 0.5 * (1 + Math.floor(rng() * 2));
      patches.push({ x: Math.round((cx0 + (rng() - 0.5) * 2 * spread) * 2) / 2, y: Math.round((cy0 + (rng() - 0.5) * 2 * spread) * 2) / 2, w, h: w, sq: true, surface });
    }
  }
  sub.layoutId = (sub.layoutId || 0) + 1;       // tells the renderer its cached ground is out of date
}

const GO_ZONES = [
  // Infield natural grass & mud patches (odd squares around edges of grass)
  { x: 0, y: 0, w: 110, h: 45, surface: SURFACES.grass },
  { x: -35, y: -4, w: 28, h: 22, surface: SURFACES.mud },
  { x: 30, y: 6, w: 24, h: 20, surface: SURFACES.mud },
  { x: 0, y: 14, w: 32, h: 16, surface: SURFACES.grassShort },
  { x: 0, y: -16, w: 36, h: 18, surface: SURFACES.grassShort },
  // (2026-10-03) three mud RECTANGLES at the outer edges were removed: with mud's new pattern their hard
  // straight sides cut across the track edge and under the tyre wall. Variety on this level now comes from
  // the random PATCHES rolled every load (randomiseGrassTrack), which the user asked for instead.
];

const GO_PROPS = [
  { kind: 'podium', x: 0, y: 0, rot: 0 },
  { kind: 'caravan', x: -26, y: -4, rot: 0.16 },
  { kind: 'grandstand', x: 0, y: 66, w: 38, h: 7, rot: 0 },
  { kind: 'pylon', x: -65, y: 48 }, { kind: 'pylon', x: 65, y: 48 },
  { kind: 'pylon', x: -65, y: -48 }, { kind: 'pylon', x: 65, y: -48 },
];

const GO_PAINT = [
  // White chalk start/finish line across the front straight
  { kind: 'lane', x: 0, y: 38, w: 0.8, h: 14, tone: 0.95 },
];

const GO_BOARDS = [
  { x: 0, y: 47, label: 'FINISH' },
];

// =============================================================================================
// STOCK CAR OVAL (Tarmac with broken sections — PLAN.md §3)
// Counter-clockwise (turning left). Start/finish at x=0, y=48.
// =============================================================================================
const SO_APEXES = [
  [0, 48], [70, 48], [105, 22], [105, -22], [70, -48], [0, -48], [-70, -48], [-105, -22], [-105, 22], [-70, 48]
];
const SO_SECTORS = [
  { startDist: 0, endDist: 85, surface: SURFACES.tarmac },
  { startDist: 85, endDist: 195, surface: SURFACES.broken },   // broken Turn 1/2
  { startDist: 195, endDist: 300, surface: SURFACES.tarmac },
  { startDist: 300, endDist: 410, surface: SURFACES.broken },  // broken Turn 3/4
  { startDist: 410, endDist: 1000, surface: SURFACES.tarmac },
];
const SO_CURVED_KERBS = [
  { side: 'right', startDist: 0, endDist: 1000, width: 2.2, h: 0.12 }
];
const SO_SUBTRACK = createSubtrack(SO_APEXES, 15, SO_SECTORS, SO_CURVED_KERBS);

const SO_ZONES = [
  { x: 0, y: 0, w: 150, h: 56, surface: SURFACES.broken },     // infield broken tarmac
  { x: 0, y: 72, w: 120, h: 22, surface: SURFACES.tarmac },     // paddock & pits outside
  { x: -45, y: 8, w: 26, h: 18, surface: SURFACES.grassShort },
  { x: 45, y: -8, w: 26, h: 18, surface: SURFACES.grassShort },
];

const SO_PROPS = [
  { kind: 'banger', x: -28, y: 12, rot: 0.52, paint: '#8b2a26', num: '42' },
  { kind: 'banger', x: 20, y: -14, rot: -0.44, paint: '#2a4d7a', num: '17' },
  { kind: 'banger', x: -8, y: -10, rot: 2.15, paint: '#8b7a2b', num: '88' },
  { kind: 'banger', x: 30, y: 15, rot: -1.15, paint: '#484c56', num: '03' },
  { kind: 'official_box', x: -14, y: 64 },
  { kind: 'grandstand', x: 18, y: 76, w: 42, h: 7, rot: 0 },
  { kind: 'board', x: -55, y: 62, label: 'SPUM TYRES' },
  { kind: 'board', x: 55, y: 62, label: 'CREEM OIL' },
  { kind: 'board', x: 0, y: -62, label: 'SLAG HEAP SCRAP' },
  { kind: 'pylon', x: -90, y: 60 }, { kind: 'pylon', x: 90, y: 60 },
  { kind: 'pylon', x: -90, y: -60 }, { kind: 'pylon', x: 90, y: -60 },
];

const SO_PAINT = [
  // Chequered start/finish line across the front straight
  { kind: 'chequered', x: 0, y: 48, wid: 15, len: 2.0 },
];

const SO_BOARDS = [
  { x: 0, y: 58, label: 'FINISH' },
];

// =============================================================================================
// NAFFCAR SPEEDWAY (Super Speedway — PLAN.md §3)
// Counter-clockwise (turning left). Max extent 226m (fits cleanly within 302m world fence).
// Start/finish at x=0, y=75. Banked corners (18 deg), stadium grandstands, start gantry.
// =============================================================================================
const NC_APEXES = [
  [0, 75], [135, 75], [190, 48], [215, 0], [190, -48], [135, -75], [0, -75], [-135, -75], [-190, -48], [-215, 0], [-190, 48], [-135, 75]
];
const NC_SECTORS = [
  { startDist: 0, endDist: 2500, surface: SURFACES.racetarmac }
];
const NC_CURVED_KERBS = [
  // Inner rumble kerb
  { side: 'right', startDist: 0, endDist: 2500, width: 2.4, h: 0.12 },
  // Outer warning kerb
  { side: 'left', startDist: 0, endDist: 2500, width: 2.0, h: 0.08 }
];
const NC_SUBTRACK = createSubtrack(NC_APEXES, 22, NC_SECTORS, NC_CURVED_KERBS);

const NC_ZONES = [
  { x: 0, y: 0, w: 360, h: 90, surface: SURFACES.grassShort },  // grassy infield
  { x: 0, y: 54, w: 240, h: 14, surface: SURFACES.tarmac },       // driveable pit apron
];

const NC_PROPS = [
  { kind: 'gantry', x: 0, y: 75, wid: 26, rot: Math.PI / 2 },
  { kind: 'pit_wall', x: 0, y: 62, len: 220, h: 1.2 },
  { kind: 'stadium_grandstand', x: 0, y: 98, w: 180, h: 14 },
  { kind: 'stadium_grandstand', x: 0, y: -98, w: 180, h: 14 },
  { kind: 'pylon', x: -210, y: 70 }, { kind: 'pylon', x: 210, y: 70 },
  { kind: 'pylon', x: -210, y: -70 }, { kind: 'pylon', x: 210, y: -70 },
];

const NC_PAINT = [
  // Start/finish chequered stripe
  { kind: 'chequered', x: 0, y: 75, wid: 22, len: 2.5 },
  // Pit lane entrance & exit white divider line
  { kind: 'lane', x: 0, y: 62, w: 220, h: 0.4, tone: 0.8 },
];

const NC_BOARDS = [
  { x: 0, y: 88, label: 'FINISH' },
];

// =============================================================================================
// THE LEVELS. `base` is what you are on where no zone covers you; `zones` are first-hit-wins.

// =============================================================================================
// THRUSTON — parody of Thruxton, "the fastest circuit in the UK" (user's roster + build guide, SPECS-2026-10-03.md; track list
// approved 2026-10-03). Clockwise, all race tarmac, an old airfield: S/F straight -> ALLARD (fast right) -> the COMPLEX
// (CAMPBELL 90 right, COBB open left, SEAGRAVE flat right with "a nasty bump just before the apex") -> back straight ->
// NOBLE (fast right) -> GOODWOOD ("very bumpy", long right) -> VILLAGE (kink) -> CHURCH (fast and "deceptively tight", the apex
// kerb takes a beating) -> BROOKLANDS (fast) -> WOODHAM -> CLUB chicane (right-left-right, heavy kerbs + tyre markers) -> line.
// Sources: fastcar.co.uk Thruxton track guide; Wikipedia "Thruxton Circuit" (3.79 km, 12 turns).
// SCALE: the real lap is 3.79 km; every level shares one 520 m world (the tyre-mark layer is sized to it), so this is the real
// corner sequence at 1567 m (measured), proportions kept, real width (14 m). Corner distances along the lap (measured):
//   ALLARD 187  CAMPBELL 312  COBB 374  SEAGRAVE 444  NOBLE 686  GOODWOOD 810  VILLAGE 869  CHURCH 1032  BROOKLANDS 1089
//   WOODHAM 1285  CLUB 1343-1422.
// INTENDED FAILURE: carrying Church's speed into a tight apex; arriving at Club too hot after the fastest part of the lap; tyre
// heat (sustained right-handers load the left-side tyres — user: "high tyre-heat generator").
// RE-LAID 2026-10-03 from the REAL MAP (Wikimedia "Thuxton_Motor_Racing_Circuit_map.svg", 369 m = 255 px), traced clockwise from
// the line and scaled 0.47 (1254 m, measured). The first layout had the right corners in a made-up shape — re-laid, not patched.
// RE-TRACED 2026-10-04 (user: "kerbs still broken on tight corners, not like the real corner"): centreline read off the map at
// 4x zoom on a 10 px grid (art/ref/thruxton-map.png, 960 px wide; game (0,0) = map centre, 0.47 m per px), clockwise from the
// line, then traceTrack() (no kinks, every corner R >= 12 m). Check against the map: node tools/traceoverlay.mjs thruston.
// The previous trace (hand points through Catmull-Rom, kinked at Campbell / Cobb / Club) is in _archive/; the FIRST layout is
// _archive/thruston-old-layout.cjs.
const TH_MAP = [
  [51,532],[46,515],[40,500],[33,480],[25,455],[21,430],[21,405],[30,380],[55,355],[70,345],[100,330],    // S/F straight up the west side, ALLARD
  [120,305],[155,260],[180,210],[191,172],[194,150],[197,120],[204,105],[214,99],                         // up to CAMPBELL (right)
  [225,101],[242,104],[265,104],[280,102],[287,97],                                                        // the dip to COBB (left)
  [296,82],[310,57],[322,37],[332,25],[347,19],[372,15],[397,14],[450,22],[480,35],[530,52],              // up to SEAGRAVE (right)
  [580,85],[600,102],[630,110],[660,112],[690,107],[730,87],[780,67],[820,62],[860,67],                   // NOBLE, the back straight
  [905,95],[930,130],[947,175],[952,225],[950,275],[940,325],[922,365],[900,400],                         // GOODWOOD (long right)
  [860,460],[825,500],[780,520],[740,527],[690,522],[630,522],[555,530],[480,545],[400,565],[300,625],    // VILLAGE, CHURCH, BROOKLANDS
  [270,647],[232,657],[195,656],[182,651],[176,642],[170,632],[164,630],[156,632],[150,637],[140,640],    // WOODHAM, CLUB (right-left-right)
  [125,636],[110,625],[100,615],[85,597],[70,575],[57,552]];
const TH_SUBTRACK = createSubtrack(traceTrack(TH_MAP, { rMin: 15.5 }), 14, [{ startDist: 0, endDist: 1e9, surface: SURFACES.racetarmac }], [], true);
TH_SUBTRACK.curvedKerbs = autoKerbs(TH_SUBTRACK, { maxR: 70, exitR: 30, heavyR: 22, minTurn: 20, mergeGap: 12 });
const thAt = (d, off) => { const p = onTrack(TH_SUBTRACK, d, off, {}); return { x: p.x, y: p.y }; };
// clear of the road? (centre at least hw + reach + margin from the centreline, and off every lane)
const thClear = (x, y, reach) => querySubtrack(TH_SUBTRACK, x, y).dist >= TH_SUBTRACK.width / 2 + reach;
const thRnd = parkMiller(1968);   // Thruxton opened in 1968
// EARTH BANKS round the outside (ukcircuits: "extensive earthen banks ... from Club through Noble"; Woodham Hill Bank on the
// approach to Club, 2025) — a chain of humps, filtered off the road
const thBank = (d0, d1, off, step, r, h) => { const out = []; const L = ((d1 - d0) + TH_SUBTRACK.totalDist) % TH_SUBTRACK.totalDist;
  for (let t = 0; t <= L; t += step) { const p = thAt((d0 + t) % TH_SUBTRACK.totalDist, off); if (thClear(p.x, p.y, r + 3)) out.push({ kind: 'hump', ...p, r, h }); }
  return out; };
const TH_BUMPS = prepBumps([
  // SEAGRAVE: "a nasty bump just before the apex will unsettle the car"
  { kind: 'hump', ...thAt(306, -1), r: 3.4, h: 0.09 },   // re-traced 2026-10-04: Seagrave apex ~315
  // GOODWOOD: "a very bumpy corner" — a short field of low humps and dips across the racing line
  ...[0, 1, 2, 3, 4, 5].map((k) => ({ kind: k % 2 ? 'dip' : 'hump', ...thAt(575 + k * 13, (k % 3) * 3 - 3), r: 3, h: 0.06, d: 0.05 })),
  // SPECTATOR BANKS (race-day photo): grass earth banks behind the fence at Church and outside Noble
  ...thBank(778, 877, -31, 4, 7, 1.3),
  ...thBank(440, 500, 27, 4, 7, 1.1),
  // spacing 4 m with r 7: at 10 m apart they photographed as a row of separate pale blobs, not a bank
  ...thBank(1120, 480, -33, 4, 7, 1.2),       // the perimeter banking, Club -> line -> Allard -> Complex -> Noble
  ...thBank(1035, 1100, -31, 4, 7, 1.4),      // Woodham Hill Bank
]);
// THE AIRFIELD, from the real map (first match wins, so the paved runway is listed before the remnants it lies on):
const TH_ZONES = [
  { x: 61.1, y: -38.8, w: 245.3, h: 9, rot: -0.4036, surface: SURFACES.tarmac },          // paved active runway (SW-NE)
  { x: 11.8, y: -2.3, w: 245.1, h: 10, rot: 0.5667, surface: SURFACES.grassShort },     // grass active runway (NW-SE), mown short
  // what is left of the original runway (SW-NE). SHORTENED 2026-10-04 (user: "pits look messy"): it ran ~26 m past its real west
  // end (map px ~118,442), out over the S/F straight and under the pit lane, merging both into one ragged concrete blob.
  { x: 12.4, y: -26.4, w: 395, h: 22, rot: -0.3926, surface: SURFACES.concrete },
  { x: 16.5, y: -27.7, w: 323.9, h: 20, rot: 0.5703, surface: SURFACES.concrete },        // and the other one (NW-SE)
];
// ARMCO runs (outside of the right-handers) and the TYRE WALLS in front of them (user, 2026-10-04: "lots of tyres between the track
// and the Armco"): two staggered rows of knockable tyre stacks (cones.js r 0.48 -> 0.95 m apart), rows at -14 and -15 (rail face -15.7).
const TH_ARMCO = [[35, 125], [205, 250], [290, 345], [560, 760], [785, 870], [1080, 1112]];
const TH_TYREWALL = TH_ARMCO.flatMap(([a, b]) => [[-14.0, 0], [-15.0, 0.475]].flatMap(([off, shift]) =>
  alongTrack(TH_SUBTRACK, a + shift, b, off, 0.95).map(([x, y]) => ({ x, y, kind: 'tyrestack' }))));
const TH_CONES = [
  ...TH_TYREWALL,
  // CLUB: tyre markers on the outside of each flick (user: "heavy kerbing and tyre markers strictly at the final Club chicane")
  ...[1126, 1136, 1146, 1156, 1166, 1176].flatMap((d, k) => [{ ...thAt(d, (k % 2 ? 12 : -12)), kind: 'tyrestack' }]),
  { ...thAt(1146, 0.5), kind: 'cone' },     // the apex cone in the middle flick
];
const TH_PAINT = [
  { kind: 'chequered', x: TH_SUBTRACK.pts[0].x, y: TH_SUBTRACK.pts[0].y, len: 1.6, wid: 14, rot: TH_SUBTRACK.pts[0].heading },
];
// PITS + PERIMETER (2026-10-04; user: "aerial / race-day photos for pit layouts and perimeter decorations — if you need ARMCO or
// FENCES, do"). From the map (pit lane on the INSIDE between Club and the line) and the photos (art/ref/: concrete lane, yellow
// line, low red/white/blue pit wall, block garages under a red tyre-brand banner, control tower, grandstand, Armco, catch fence,
// spectator banks). Layout only — working pit stops come later (user). Everything by DISTANCE + OFFSET (+ = inside).
const ss01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const TH_PIT = { d0: 1178, d1: 48, off: 17, w: 9, ramp: 28 };   // lane leaves after Club, rejoins before Allard (R >= 67 m here)
const TH_PIT_LANE = alongTrack(TH_SUBTRACK, TH_PIT.d0, TH_PIT.d1, (t, len) => 4 + (TH_PIT.off - 4) * ss01(Math.min(t, len - t) / TH_PIT.ramp), 2);
const TH_GAR = { d0: 1204, d1: 22, off: TH_PIT.off + TH_PIT.w / 2 + 5, depth: 10, n: 4 };   // garage fronts flush with the lane (a 1 m grass strip showed)
const thSpan = (d0, d1) => ((d1 - d0) + TH_SUBTRACK.totalDist) % TH_SUBTRACK.totalDist;
// THE INFIELD (2026-10-04; user: "isn't there more decorating to make it look like the real race track?"). Read off the map
// (art/ref/thruxton-map.png: paved taxiway system, paved apron, hangars, grass aircraft parking) and the 1945 RAF photo
// (art/ref/may45.jpg). Map px -> game m exactly as TH_MAP. Widths EXAGGERATED (the lap is ~1/3 scale, the cars full size).
const thM = (px, py) => [+((px - 480) * 0.47).toFixed(2), +((py - 338) * 0.47).toFixed(2)];
const TH_LANES = [
  { pts: TH_PIT_LANE, width: TH_PIT.w, surface: SURFACES.concrete },
  { pts: [thM(207, 492), thM(180, 590)], width: 18, surface: SURFACES.tarmac },                                   // PADDOCK (paved apron)
  { pts: [thM(207, 492), thM(222, 450), thM(245, 432), thM(310, 404), thM(372, 372)], width: 7, surface: SURFACES.broken },   // taxiway to the runway
  { pts: [thM(313, 402), thM(312, 330), thM(309, 272), thM(298, 251), thM(278, 243), thM(215, 238), thM(205, 244)], width: 7, surface: SURFACES.broken },
  { pts: [thM(283, 243), thM(292, 190), thM(300, 152)], width: 7, surface: SURFACES.broken },
  { pts: [thM(312, 147), thM(366, 181)], width: 12, surface: SURFACES.broken },                                   // north apron
  { pts: [thM(205, 244), thM(188, 295), thM(172, 345)], width: 6, surface: SURFACES.broken },                     // hangar road
];
// hangars on the INFIELD side of the hangar road (on the map they stand west of it, but at this scale that is on the track)
const TH_HANGARS = [0.2, 0.5, 0.8].map((t) => {
  const a = thM(205, 244), b = thM(172, 345), x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
  const ux = (b[0] - a[0]), uy = (b[1] - a[1]), L = Math.hypot(ux, uy), px = uy / L, py = -ux / L;   // points EAST (infield); the first sign put two hangars on the track (measured 4.8 m from the centreline)
  return { kind: 'hangar', x: x + px * 14, y: y + py * 14, w: 20, h: 12, rot: Math.atan2(py, px) };   // 12 m deep: at 15 they touched (one long shed, and a car between two was pushed back and forth)
});
const TH_PLANES = [[478, 488, 0.5, '#c8302c'], [500, 482, 2.4, '#2b56b5'], [560, 470, 1.2, '#e2c13a'], [640, 455, 3.6, '#2f7d4f'],
  [690, 432, 0.1, '#c8302c'], [600, 425, 4.6, '#5a5e66']].map(([px, py, rot, col]) => { const [x, y] = thM(px, py); return { kind: 'plane', x, y, rot, col }; });
const TH_PADDOCK = [0.18, 0.42, 0.66].flatMap((t, k) => {
  const a = thM(207, 492), b = thM(180, 590), x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
  const ux = b[0] - a[0], uy = b[1] - a[1], L = Math.hypot(ux, uy), rot = Math.atan2(uy, ux), px = -uy / L, py = ux / L;
  const cols = ['#c8302c', '#2b56b5', '#e2c13a', '#2f7d4f', '#f2f2f2', '#7a3fa0'];
  return [{ kind: 'truck', x: x + px * 5.5, y: y + py * 5.5, rot, col: cols[k * 2] }, { kind: 'truck', x: x - px * 5.5, y: y - py * 5.5, rot: rot + Math.PI, col: cols[k * 2 + 1] }];
});
// WOODS on the west side (1945 photo) + hedgerow trees round the outside; seeded, filtered off the road
const TH_TREES = [];
for (let k = 0; k < 46; k++) { const d = 40 + thRnd() * 190, off = -46 - thRnd() * 34, p = thAt(d, off); if (thClear(p.x, p.y, 10)) TH_TREES.push({ kind: 'tree', ...p, s: 3 + thRnd() * 3, seed: k }); }
for (let d = 0; d < TH_SUBTRACK.totalDist; d += 26) { const p = thAt(d, -44 - thRnd() * 10); if (thClear(p.x, p.y, 12)) TH_TREES.push({ kind: 'tree', ...p, s: 2.5 + thRnd() * 2.5, seed: 100 + d }); }
// MARSHAL POSTS behind the Armco at each corner
const TH_POSTS = [70, 230, 315, 470, 600, 700, 830, 1000, 1090, 1150].map((d) => { const q = onTrack(TH_SUBTRACK, d, -20, {}); return { kind: 'marshal', x: q.x, y: q.y, rot: q.rot }; }).filter((p) => thClear(p.x, p.y, 4));
// placed BY DISTANCE (2026-10-04 re-trace): fixed x/y left the gantry off the line and the stand off the straight when the track moved.
// Clockwise lap: +offset = inside (right of travel), -offset = outside. Grandstand: OUTSIDE the S/F straight, opposite the pits.
const thProp = (d, off, o) => { const p = onTrack(TH_SUBTRACK, d, off, {}); return { ...o, x: p.x, y: p.y, rot: p.rot + (o.rot || 0) }; };
const TH_STAND = { d0: 1188, d1: 1228, off: -14 };
const TH_PROPS = [
  thProp((TH_STAND.d0 + TH_STAND.d1) / 2, TH_STAND.off, { kind: 'grandstand', w: TH_STAND.d1 - TH_STAND.d0, h: 8 }),
  thProp(3, 0, { kind: 'gantry', wid: 26, rot: Math.PI / 2 }),
  // garages: ONE row that follows the lane (the first cut, 4 rotated blocks, stepped and overlapped on the curve — user: "messy")
  { kind: 'garagerow', brand: 'KUM TYRES', x: 0, y: 0,
    front: alongTrack(TH_SUBTRACK, TH_GAR.d0, TH_GAR.d1, TH_GAR.off - TH_GAR.depth / 2, 2.5),
    back: alongTrack(TH_SUBTRACK, TH_GAR.d0, TH_GAR.d1, TH_GAR.off + TH_GAR.depth / 2, 2.5),
    banner: alongTrack(TH_SUBTRACK, TH_GAR.d0, TH_GAR.d1, TH_GAR.off - TH_GAR.depth / 2 + 0.9, 2.5) },
  thProp(1214, TH_GAR.off + 14, { kind: 'tower', size: 9 }),
  thProp(100, -26, { kind: 'board', label: 'THRUSTON' }),
  thProp(1100, -24, { kind: 'board', label: 'KUM TYRES' }),
  thProp(640, -28, { kind: 'board', label: 'SPUM OIL' }),
  thProp(1106, -27, { kind: 'grandstand', w: 26, h: 8 }),     // CLUB: two grandstands (ukcircuits) — approach ...
  ...TH_HANGARS, ...TH_PLANES, ...TH_PADDOCK, ...TH_TREES, ...TH_POSTS,
  { kind: 'windsock', x: 53, y: -57, rot: 0.6 },
  // (the sign stood ON the re-laid start straight — user: "there's a sign over the track"; now placed by the track, see below)
];

// =============================================================================================
// CASTLE CUM — parody of Castle Combe (Wiltshire), built 2026-10-04. Track list approved 2026-10-03; decisions (user, 2026-10-04):
// BIGGER scale (~1250 m lap so the chicanes keep their shape), Avon Rise crest FELT (light over the top; braking there can lock —
// the real Quarry trap), all the scenery, DRY tarmac + grass.
// TRACED from the official map (art/ref/cc2.png, Wikimedia "Castle_Combe_Circuit_track_map.svg" at 1280 px; 385 m = 448 px ->
// 0.859 m/px real) at 0.358 game m per px (0.42 of real), centre (637, 532). Clockwise from the line on the bottom straight:
// FOLLY (flat right kink, bumpy) -> AVON RISE (shallow left over the CREST) -> QUARRY (long slow right; "statistically the most
// accident-prone corner in the UK") -> FARM STRAIGHT -> the ESSES (chicane, 1999) -> OLD PADDOCK (fast right) -> HAMMERDOWN (flat
// left kink) -> TOWER (right, braking downhill) -> BOBBIES (chicane, 1999) -> WESTWAY / DEAN STRAIGHT -> CAMP (right) -> line.
// Corner guide: bristolpegasus.com Castle Combe turn-by-turn; scenery: the circuit's own site sign (art/ref/cc4.jpg — it is drawn
// rotated 180 deg from the map) and pistonclick.com spectator guide.
const CC_MAP = [
  [940, 1031], [900, 1031], [800, 1029], [700, 1026], [640, 1021], [600, 1012],                         // start / finish straight (west)
  [580, 1000], [550, 975], [500, 948], [450, 918], [400, 890], [350, 855], [320, 830], [280, 795], [250, 765], [200, 728],   // FOLLY, the climb
  [165, 705], [130, 697], [80, 688], [45, 678],                                                          // AVON RISE (left, crest)
  [25, 660], [10, 630], [10, 600], [20, 575], [40, 553], [70, 525],                                      // QUARRY (long right)
  [100, 495], [150, 450], [200, 400], [250, 350], [300, 300],                                            // FARM STRAIGHT
  [310, 285], [330, 272], [345, 270], [370, 278], [385, 275], [400, 260], [410, 240], [420, 215], [430, 185], [445, 150],   // the ESSES
  [470, 125], [500, 103], [530, 85], [560, 78], [600, 76],                                               // OLD PADDOCK (right)
  [700, 78], [800, 80], [870, 80], [900, 75], [950, 60], [1000, 48], [1050, 33], [1100, 20],              // HAMMERDOWN (left kink)
  [1130, 17], [1160, 22], [1190, 40], [1210, 65], [1225, 100], [1230, 150], [1233, 200], [1237, 250],     // TOWER (right)
  [1240, 290], [1225, 305], [1210, 315], [1200, 330], [1202, 350], [1210, 375],                           // BOBBIES (chicane)
  [1225, 410], [1245, 450], [1260, 480], [1266, 520], [1263, 570], [1250, 620], [1230, 680],              // WESTWAY
  [1215, 750], [1200, 800], [1185, 850], [1172, 900], [1158, 945], [1138, 980], [1110, 1008], [1080, 1025], [1050, 1031], [1000, 1031]];   // re-read: first pass ran ~15 px east   // DEAN STRAIGHT, CAMP
const CC_SUBTRACK = createSubtrack(traceTrack(CC_MAP, { mpp: 0.358, cx: 637, cy: 532, rMin: 15.5 }), 13, [{ startDist: 0, endDist: 1e9, surface: SURFACES.racetarmac }], [], true);
CC_SUBTRACK.curvedKerbs = autoKerbs(CC_SUBTRACK, { maxR: 70, exitR: 30, heavyR: 22, minTurn: 20, mergeGap: 12 });
const CC_PAINT = [{ kind: 'chequered', x: CC_SUBTRACK.pts[0].x, y: CC_SUBTRACK.pts[0].y, len: 1.6, wid: 13, rot: CC_SUBTRACK.pts[0].heading }];

// TRACK KIT (2026-10-04, written for Castle Cum after doing Thruston by hand): decorate a traced circuit by DISTANCE + OFFSET
// (+ = right of travel; on a clockwise lap that is the INSIDE). Everything generated is filtered off the road, off the given
// lanes and inside the floor — the Thruston lesson: an outside offset on the inside of a left-hander lands on the track.
export function trackKit(sub, seed, lanes = []) {
  const rnd = parkMiller(seed);
  const at = (d, off) => smoothOnTrack(sub, d, off);
  const rot = (d) => onTrack(sub, ((d % sub.totalDist) + sub.totalDist) % sub.totalDist, 0, {}).rot;
  const prop = (d, off, o) => ({ ...o, ...at(d, off), rot: rot(d) + (o.rot || 0) });
  const onLane = (x, y, pad) => lanes.some((ln) => ln.pts.some(([ax, ay], i) => { const q = ln.pts[i + 1]; if (!q) return false;
    const dx = q[0] - ax, dy = q[1] - ay, l2 = dx * dx + dy * dy || 1e-6; let t = ((x - ax) * dx + (y - ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(x - ax - dx * t, y - ay - dy * t) <= ln.width / 2 + pad; }));
  const clear = (x, y, reach) => querySubtrack(sub, x, y).dist >= sub.width / 2 + reach && Math.abs(x) < FLOOR - 6 - reach && Math.abs(y) < FLOOR - 6 - reach && !onLane(x, y, reach);
  const span = (d0, d1) => ((d1 - d0) + sub.totalDist) % sub.totalDist;
  // earth bank = humps every 4 m (at 10 m they photographed as separate blobs)
  const bank = (d0, d1, off, r, h) => { const out = []; for (let t = 0; t <= span(d0, d1); t += 4) { const p = at(d0 + t, off); if (clear(p.x, p.y, r + 2)) out.push({ kind: 'hump', x: p.x, y: p.y, r, h }); } return out; };
  const along = (d0, d1, off, step) => alongTrack(sub, d0, d1, off, step);
  return { rnd, at, rot, prop, clear, span, bank, along, onLane };
}

// CASTLE CUM SCENERY (all asked for, 2026-10-04). Distances measured on this trace (lap 1338 m): FOLLY 130, AVON RISE 313, QUARRY 384,
// ESSES 547-624, OLD PADDOCK 663, HAMMERDOWN 795, TOWER 904, BOBBIES 997-1033, WESTWAY 1089, CAMP 1261. Pit lane from the map: OUTSIDE
// the start straight, leaving at Camp and rejoining before Folly ("the pit exit joins the main circuit before Folly").
const ccMapXY = (px, py) => [+((px - 637) * 0.358).toFixed(2), +((py - 532) * 0.358).toFixed(2)];
const CC_PIT = { d0: 1225, d1: 121, off: -17, w: 9, ramp: 28 };
const CC_PIT_LANE = alongTrack(CC_SUBTRACK, CC_PIT.d0, CC_PIT.d1, (t, len) => -4 + (CC_PIT.off + 4) * ss01(Math.min(t, len - t) / CC_PIT.ramp), 2);
const CC_KIT0 = trackKit(CC_SUBTRACK, 1950);   // Castle Combe circuit opened 1950
const CC_KART = (() => {   // the KART TRACK, north of the top straight (site sign: "skid pan, kart track, 4x4 course"), in its own frame
  const c = CC_KIT0.at(740, -56), r = CC_KIT0.rot(740)   /* beyond the ring road (it ran through the kart track at -38) */, cs = Math.cos(r), sn = Math.sin(r);
  return [[-25, -8], [20, -8], [25, -3], [25, 3], [20, 8], [2, 8], [-4, 2], [-10, 8], [-25, 8], [-29, 3], [-29, -3], [-25, -8]]
    .map(([u, v]) => [+(c.x + cs * u - sn * v).toFixed(2), +(c.y + sn * u + cs * v).toFixed(2)]);
})();
// RING ROAD from the track's OUTLINE, not an offset: an offset of -66 m looped back on itself inside the Esses' left-handers and
// squashed against the world edge (photographed). Per 6 deg round the centroid: the furthest track point in a +-12 deg window,
// + margin, smoothed, clamped inside the floor. A star-shaped curve like this cannot self-intersect.
function ringAround(sub, margin, lim) {
  let cx = 0, cy = 0; for (const p of sub.pts) { cx += p.x; cy += p.y; } cx /= sub.pts.length; cy /= sub.pts.length;
  const N = 60, rr = new Array(N).fill(0);
  for (const p of sub.pts) { const a = Math.atan2(p.y - cy, p.x - cx), d = Math.hypot(p.x - cx, p.y - cy);
    for (let k = 0; k < N; k++) { let da = a - (k / N) * 2 * Math.PI; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) < 0.21) rr[k] = Math.max(rr[k], d * Math.cos(da)); } }
  let r2 = rr.map((r) => r + margin);
  for (let it = 0; it < 3; it++) r2 = r2.map((r, k) => (r2[(k + N - 1) % N] + 2 * r + r2[(k + 1) % N]) / 4);
  return r2.map((r, k) => { const a = (k / N) * 2 * Math.PI; return [+Math.max(-lim, Math.min(lim, cx + Math.cos(a) * r)).toFixed(2), +Math.max(-lim, Math.min(lim, cy + Math.sin(a) * r)).toFixed(2)]; });
}
// it ran straight through the paddock (the start straight is the southernmost part of the lap): now it STOPS at the paddock at
// both ends, as a real perimeter road feeds into the paddock — the ring minus the points near the pits / paddock, opened there
const CC_RING = (() => {
  const full = ringAround(CC_SUBTRACK, 26, FLOOR - 9), pad = alongTrack(CC_SUBTRACK, 1210, 140, -36, 4);
  const near = ([x, y]) => pad.some(([px, py]) => Math.hypot(x - px, y - py) < 22);
  const k0 = full.findIndex((q, i) => near(q) && !near(full[(i + 1) % full.length]));   // last point inside the paddock zone
  const out = []; for (let i = 1; i <= full.length; i++) { const q = full[(k0 + i) % full.length]; if (near(q)) break; out.push(q); }
  // join each end to the nearer END of the paddock (photographed: the open ends dangled 100 m short of it)
  const ends = [smoothOnTrack(CC_SUBTRACK, 1290, -42), smoothOnTrack(CC_SUBTRACK, 65, -42)].map((p) => [+p.x.toFixed(2), +p.y.toFixed(2)]);
  const dd = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const first = dd(out[0], ends[0]) < dd(out[0], ends[1]) ? ends[0] : ends[1], last = first === ends[0] ? ends[1] : ends[0];
  // the Camp end went straight across the pit lane (photographed): route it round the OUTSIDE of the pit entry first
  const via = [smoothOnTrack(CC_SUBTRACK, 1235, -50)].map((p) => [+p.x.toFixed(2), +p.y.toFixed(2)])[0];
  return first === ends[0] ? [first, via, ...out, last] : [first, ...out, via, last];
})();
const CC_LANES = [
  { pts: CC_PIT_LANE, width: CC_PIT.w, surface: SURFACES.concrete },
  { pts: alongTrack(CC_SUBTRACK, 1285, 70, -42, 3), width: 26, surface: SURFACES.tarmac },          // PADDOCK behind the pits
  { pts: [ccMapXY(316, 270), ccMapXY(452, 141)], width: 11, surface: SURFACES.broken },             // the ESSES escape road (pre-1999 layout)
  { pts: [ccMapXY(1241, 296), ccMapXY(1266, 472)], width: 10, surface: SURFACES.broken },           // the BOBBIES escape road (pre-1999 layout)
  { pts: alongTrack(CC_SUBTRACK, 940, 990, -8.6, 2), width: 2.6, surface: SURFACES.concrete },     // "braking point: where a concrete strip ends on the left"
  { pts: CC_KART, width: 6, surface: SURFACES.tarmac },                                              // kart track
  { pts: CC_RING, width: 6, surface: SURFACES.broken },                                              // circuit ring road (ends at the paddock)
];
const CC_KIT = trackKit(CC_SUBTRACK, 1950, CC_LANES);
const CC_ARMCO = [[345, 432], [640, 692], [878, 945]];          // outside of QUARRY, OLD PADDOCK, TOWER
const CC_BUMPS = prepBumps([
  // AVON RISE: the crest before Quarry. cos^2 hump: crest curvature h pi^2 / 2 r^2 = 0.0052/m -> at 145 km/h (40 m/s) 8.3 m/s^2 of the
  // 13.7 vertical gravity: the car goes LIGHT, not airborne. Braking there is the real trap (locks). Measured: see ENGINE.md.
  { kind: 'hump', ...CC_KIT.at(296, 0), r: 30, h: 0.95 },
  // the run down into TOWER: a broad rise on the top straight after Hammerdown, so you brake for Tower going DOWNHILL
  // MEASURED (tools/crestcheck --flat): r 45 h 1.6 put EVERY car airborne 0.2-0.5 s flat out (user asked for light, not flying);
  // r 50 h 0.9 = 46% of that crest curvature
  { kind: 'hump', ...CC_KIT.at(850, 0), r: 50, h: 0.9 },
  // FOLLY: "the track is bumpy here"
  ...[0, 1, 2, 3, 4].map((k) => ({ kind: k % 2 ? 'dip' : 'hump', ...CC_KIT.at(112 + k * 12, (k % 3) * 2.5 - 2.5), r: 3, h: 0.05, d: 0.045 })),
  // VIEWING BANKS (site sign / pistonclick): Folly, Quarry, the Esses, Bobbies, and "quite a high bank along the straight to Camp"
  ...CC_KIT.bank(140, 260, -32, 7, 1.3), ...CC_KIT.bank(350, 440, -34, 7, 1.5), ...CC_KIT.bank(530, 640, -30, 7, 1.3),
  ...CC_KIT.bank(970, 1060, -30, 7, 1.3), ...CC_KIT.bank(1110, 1215, -30, 7, 2.0),
]);
const CC_TREES = [];
for (let k = 0; k < 420 && CC_TREES.length < 110; k++) {
  const x = (CC_KIT.rnd() - 0.5) * 2 * (FLOOR - 12), y = (CC_KIT.rnd() - 0.5) * 2 * (FLOOR - 12);
  if (CC_KIT.clear(x, y, 9)) CC_TREES.push({ kind: 'tree', x, y, s: 3 + CC_KIT.rnd() * 3.5, seed: 500 + k });
}
const CC_PROPS = [
  CC_KIT.prop(3, 0, { kind: 'gantry', wid: 24, rot: Math.PI / 2 }),
  CC_KIT.prop(1325, -11.3, { kind: 'sculpture' }),                       // the red sculpture by the pit wall (photo)
  CC_KIT.prop(1195, 0, { kind: 'footbridge', wid: 27, label: 'AVAN TYRES', rot: Math.PI / 2 }),    // AVON footbridge over Dean Straight
  CC_KIT.prop(712, 0, { kind: 'footbridge', wid: 27, label: 'DUMLOP', rot: Math.PI / 2 }),          // DUNLOP footbridge after Old Paddock
  CC_KIT.prop(20, -62, { kind: 'block', w: 26, h: 12, roof: '#7a5a48', label: 'TAVERN' }),            // the clubhouse
  CC_KIT.prop(55, -62, { kind: 'block', w: 18, h: 10, roof: '#5b626b' }),                            // circuit administration
  CC_KIT.prop(1300, -36, { kind: 'tower', size: 7 }),                                                // race control
  CC_KIT.prop(806, -66, { kind: 'block', w: 14, h: 14, roof: '#6c7280', label: 'OCTAGON' }),          // Octagon building by the kart track
  CC_KIT.prop(176, -21, { kind: 'board', label: 'CASTLE CUM' }),
  CC_KIT.prop(1150, -22, { kind: 'board', label: 'KUM TYRES' }),
  CC_KIT.prop(460, -24, { kind: 'board', label: 'SPUM OIL' }),
  ...[1300, 1315, 10, 25, 40].flatMap((d, k) => [CC_KIT.prop(d, -36, { kind: 'truck', col: ['#c8302c', '#2b56b5', '#e2c13a', '#2f7d4f', '#7a3fa0'][k] }), CC_KIT.prop(d + 6, -48, { kind: 'truck', col: ['#f2f2f2', '#c8302c', '#2b56b5', '#5a5e66', '#e2c13a'][k], rot: Math.PI })]),
  ...[130, 313, 384, 600, 663, 795, 904, 1015, 1089].map((d) => CC_KIT.prop(d, -21, { kind: 'marshal' })),
  ...CC_TREES,
].filter((p) => p.kind === 'gantry' || p.kind === 'footbridge' || p.kind === 'sculpture' || p.kind === 'tower' || p.kind === 'truck' || p.kind === 'block' || CC_KIT.clear(p.x, p.y, p.kind === 'tree' ? 9 : 3));
const CC_TYREWALL = CC_ARMCO.flatMap(([a, b]) => [[-14.0, 0], [-15.0, 0.475]].flatMap(([off, sh]) => alongTrack(CC_SUBTRACK, a + sh, b, off, 0.95).map(([x, y]) => ({ x, y, kind: 'tyrestack' }))));
const CC_ZONES = [(() => { const c = CC_KIT.at(872, -58); return { x: c.x, y: c.y, w: 34, h: 26, rot: CC_KIT.rot(870), surface: SURFACES.wet }; })()];   // SKID PAN

// =============================================================================================
// SLIDDEN HILL — parody of Lydden Hill (Kent), the rallycross circuit. Built 2026-10-04. Decisions (user, 2026-10-04): loose sections =
// HARD DIRT + gravel patches (the dirt inclusion table), JOKER = an "RX race" (5 laps from the start grid, joker once, missed = +5 s),
// START on the RX grid (the dead-end start straight), scenery like Castle Cum + the hill.
// TRACED from the official RX map (art/ref/ly2.png = Wikimedia "Lydden_Hill_-_Rallycross.svg" at 1280 px: black = tarmac, yellow =
// gravel; no scale bar — sized for a ~1 km lap, 0.30 game m per px). Lap from the JUNCTION where the start straight meets the loop:
// up the diagonal -> PADDOCK HILL (the outer tarmac sweep, top-left) -> CHESSONS DRIFT (gravel, top) -> down to DEVIL'S ELBOW ("almost
// doubles back") -> the climb to NORTH BEND ("a hairpin at the top of the hill") -> HAIRY HILL ("a steep downhill") -> the gravel run
// back to the junction. JOKER = the inner gravel arc across the top-left (branch on the diagonal, rejoin on Chessons Drift).
const SH = { mpp: 0.30, cx: 640, cy: 358 };
const shXY = (px, py) => [+((px - SH.cx) * SH.mpp).toFixed(2), +((py - SH.cy) * SH.mpp).toFixed(2)];
const SH_MAP = [
  [440, 465], [380, 415], [320, 375], [250, 352], [190, 322], [140, 300], [100, 280], [70, 250], [40, 200], [18, 150], [12, 118],   // PADDOCK HILL (outer)
  [25, 95], [50, 70], [80, 52], [130, 32], [200, 22], [260, 22], [330, 32], [400, 62], [470, 105], [530, 150], [560, 180],          // CHESSONS DRIFT (gravel)
  [590, 212], [615, 250], [640, 300], [660, 350], [680, 400], [700, 450], [720, 500], [745, 548], [775, 580], [812, 594],         // down to DEVIL'S ELBOW
  [852, 586], [882, 560], [910, 522], [932, 480], [962, 418], [1000, 330], [1040, 240], [1080, 150], [1110, 80], [1132, 42],      // the climb
  [1162, 18], [1200, 14], [1238, 38], [1258, 78], [1255, 120], [1240, 160],                                                     // NORTH BEND
  [1210, 212], [1170, 282], [1120, 366], [1080, 436], [1040, 506], [1000, 575], [968, 630], [935, 668], [895, 688],              // HAIRY HILL
  [845, 692], [792, 682], [740, 662], [698, 634], [658, 598], [620, 558], [586, 520], [556, 500], [518, 492], [478, 484]];        // gravel run back
const SH_SUBTRACK0 = createSubtrack(traceTrack(SH_MAP, { mpp: SH.mpp, cx: SH.cx, cy: SH.cy, rMin: 15.5 }), 14, [], [], true);
// sector distances from where the map's colours change (nearest trace point to the colour boundary)
const shD = (px, py) => { const [x, y] = shXY(px, py); let best = 0, bd = Infinity; for (const p of SH_SUBTRACK0.pts) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p.dist; } } return best; };
const SH_D = { chessIn: shD(80, 52), chessOut: shD(560, 180), runIn: shD(890, 690), runOut: shD(552, 498) };
const SH_SECTORS = [
  { startDist: 0, endDist: SH_D.chessIn, surface: SURFACES.racetarmac },
  { startDist: SH_D.chessIn, endDist: SH_D.chessOut, surface: SURFACES.dirt },
  { startDist: SH_D.chessOut, endDist: SH_D.runIn, surface: SURFACES.racetarmac },
  { startDist: SH_D.runIn, endDist: SH_D.runOut, surface: SURFACES.dirt },
  { startDist: SH_D.runOut, endDist: 1e9, surface: SURFACES.racetarmac },
];
const SH_SUBTRACK = createSubtrack(SH_SUBTRACK0.pts.map((p) => [p.x, p.y]), 14, SH_SECTORS, [], true);
SH_SUBTRACK.curvedKerbs = autoKerbs(SH_SUBTRACK, { maxR: 70, exitR: 30, heavyR: 22, minTurn: 20, mergeGap: 12 });
// the JOKER (inner gravel arc) and the START STRAIGHT (the RX grid, used once) are LANES: drivable, off the lap's centreline
// OPEN path smoothing (Chaikin, endpoints kept) — traceTrack is for closed loops only
const openSmooth = (pts, it = 3) => { let p = pts; for (let k = 0; k < it; k++) { const o = [p[0]]; for (let i = 0; i < p.length - 1; i++) { const [ax, ay] = p[i], [bx, by] = p[i + 1]; o.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]); } o.push(p[p.length - 1]); p = o; } return p.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]); };
const SH_JOKER = { pts: openSmooth([[245, 347], [190, 312], [150, 280], [118, 240], [105, 200], [104, 160], [112, 120], [130, 82], [160, 54], [195, 36], [228, 26]].map(([x, y]) => shXY(x, y))), width: 12, surface: SURFACES.dirt };
const SH_START = (() => { const a = shXY(725, 700), j = shXY(445, 468), L = Math.hypot(j[0] - a[0], j[1] - a[1]);
  const nx = -(j[1] - a[1]) / L, ny = (j[0] - a[0]) / L, k = -8;   // n = toward the loop; shift 8 m AWAY from it
  const m = [a[0] + (j[0] - a[0]) * 0.62 + nx * k, a[1] + (j[1] - a[1]) * 0.62 + ny * k];
  return { pts: [[+(a[0] + nx * k).toFixed(2), +(a[1] + ny * k).toFixed(2)], [+m[0].toFixed(2), +m[1].toFixed(2)], j], width: 14, surface: SURFACES.racetarmac }; })();
// the tyre wall: along the start straight, in the middle of the grass between its edge and the loop's edge, two staggered rows, only where
// the gap is >= 4 m, stopping before the junction
const SH_STARTWALL = (() => { const out = [], P = SH_START.pts, half = 7;
  for (let s = 0; s < 2; s++) { const [a, b] = [P[s], P[s + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = 0; t < L; t += 0.95) { const x = a[0] + (b[0] - a[0]) * t / L, y = a[1] + (b[1] - a[1]) * t / L, q = querySubtrack(SH_SUBTRACK, x, y);
      if (!q.seg || q.dist - 14 < 4) continue;
      const c = onTrack(SH_SUBTRACK, q.trackDist, 0, {}), dx = c.x - x, dy = c.y - y, dd = Math.hypot(dx, dy), mid = (half + (dd - 14) / 2) / dd;
      for (const [row, sh] of [[-0.5, 0], [0.5, 0.475]]) out.push({ x: +(x + dx * mid + (-dy / dd) * 0 + (dx / dd) * row + ((b[0] - a[0]) / L) * sh).toFixed(2), y: +(y + dy * mid + (dy / dd) * row + ((b[1] - a[1]) / L) * sh).toFixed(2), kind: 'tyrestack' });
    } }
  // and never on the start straight itself (at its bend 5 stacks landed on it — tools/tyrewallcheck)
  const onS = (o) => { for (let i = 0; i < P.length - 1; i++) { const [ax, ay] = P[i], [bx, by] = P[i + 1], dx = bx - ax, dy = by - ay; let t = Math.max(0, Math.min(1, ((o.x - ax) * dx + (o.y - ay) * dy) / (dx * dx + dy * dy))); if (Math.hypot(o.x - ax - dx * t, o.y - ay - dy * t) < half + 0.6) return true; } return false; };
  return out.filter((o) => !onS(o)); })();
// JOKER RULES (user, 2026-10-03/04): once per race, mandatory, missed = time penalty; a translucent white arrow, gently pulsing, at
// the entry. The GATE is the middle of the joker lane: drive through it and the joker counts. Normal route branch -> rejoin 180 m,
// joker 134 m but tight and on dirt (MEASURED cost: ENGINE.md).
// ARROWS (user, 2026-10-04: "the arrow needs to be closer and more clearly pointing at the joker lap, and vanish when it has been
// taken"). The first cut sat at the split pointing along BOTH routes (they part slowly: 1 m apart at 72 m, 11 m at 112 m, measured).
// Now: one on the track 7 m before the split, on the joker (+) half, turned 20 deg toward it; one at the joker's mouth where the
// routes are ~9 m apart, pointing down the joker. Both 10 m long. main.js hides them once the gate is driven through.
// JOKER ARROW ACROSS THE TRANSITION (user, 2026-10-04, phone screenshot: "joker arrows should sit across the transition to highlight the
// joker section clearly"): centred where the joker's centre line crosses the ROAD EDGE (half on the tarmac, half on the dirt), aimed along
// the joker there. (Before: on the track ~40 m before the split, aimed at the mouth.)
// the APPROACH arrow (user, 2026-10-04: "not sure the joker suggestion is showing correctly"): the lane-mouth arrow sat just off the road
// and landed at the screen edge at speed; this one is ON the road, 30 m before the turn-off, on the joker's side, angled into the lane
function jokerApproach(sub, J, len = 12) {
  const hw = sub.width / 2;
  for (let i = 1; i < J.length - 1; i++) if (querySubtrack(sub, J[i][0], J[i][1]).dist > hw) {
    const q = querySubtrack(sub, J[i][0], J[i][1]), p0 = sub.pts[q.seg], side = Math.sign((J[i][0] - p0.x) * p0.nx + (J[i][1] - p0.y) * p0.ny) || 1;
    const d = ((q.trackDist - 30) % sub.totalDist + sub.totalDist) % sub.totalDist, p = onTrack(sub, d, side * (hw - 2.5), {});
    return { x: p.x, y: p.y, rot: p.rot + side * 0.35, len, d: q.trackDist };
  }
  return null;
}
function jokerArrow(sub, J, len = 10) {
  const hw = sub.width / 2;
  for (let i = 1; i < J.length - 1; i++) if (querySubtrack(sub, J[i][0], J[i][1]).dist > hw) {
    const a = J[Math.max(0, i - 2)], b = J[Math.min(J.length - 1, i + 2)];
    return { x: J[i][0], y: J[i][1], rot: Math.atan2(b[1] - a[1], b[0] - a[0]), len };
  }
  return null;
}
const SH_JOKER_RULE = (() => { const J = SH_JOKER.pts, m = J[Math.floor(J.length / 2)], a = J[30], b = J[34];   // 30: fully on the gravel (22 straddled the edge, photographed)
  const t = onTrack(SH_SUBTRACK, 60, 3.5, {});
  // PENALTY 5 -> 10 s (MEASURED, tools/jokercost: the joker costs rally 1.8 s but hatch 7.4 / track car 6.4 s — slow on dirt — so at
  // +5 s a road car was FASTER skipping it. The penalty must beat every car's joker cost.)
  // USER (phone screenshot with a red hand-drawn arrow, 2026-10-04): "only ONE arrow, placed where the red arrow is" — on the track
  // at its right edge just before the gravel splits off, pointing into the joker's mouth.
  const u = onTrack(SH_SUBTRACK, 98, 4, {});
  // PENALTY 10 -> 30 s per miss OR extra joker (user, 2026-10-04: "harsh, real-ish")
  return { gate: { x: m[0], y: m[1], r: 7 }, penalty: 30, laps: 5, arrows: [jokerArrow(SH_SUBTRACK, J), jokerApproach(SH_SUBTRACK, J)].filter(Boolean) }; })();

// SLIDDEN HILL SCENERY (user: "same treatment" + the hill). Distances on this trace (lap 1136 m): joker branch 69 / rejoin 249, PADDOCK
// HILL 166, CHESSONS DRIFT 202-361 (dirt), DEVIL'S ELBOW 511 (a LEFT hairpin: its outside is +), NORTH BEND 742, HAIRY HILL 856, the
// gravel run 978-1101. + = inside except at the Elbow (measured against the centroid).
const SH_ST = SH_START.pts, SH_SDIR = (() => { const [a, b] = SH_ST, L = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; })();
const shOffStart = (t, side) => [+(SH_ST[0][0] + (SH_ST[1][0] - SH_ST[0][0]) * t + -SH_SDIR[1] * side).toFixed(2), +(SH_ST[0][1] + (SH_ST[1][1] - SH_ST[0][1]) * t + SH_SDIR[0] * side).toFixed(2)];
// the PADDOCK: a tarmac apron beside the start grid, on its south-west side (photo art/ref/ly1.jpg: buildings low down by the start)
const SH_PADDOCK = { pts: [shOffStart(0.05, -40), shOffStart(0.55, -40)], width: 30, surface: SURFACES.tarmac };
const SH_KIT = trackKit(SH_SUBTRACK, 1955, [SH_START, SH_JOKER, SH_PADDOCK]);   // Lydden opened in 1955
const SH_ARMCO = [[120, 200, -16], [230, 330, -16], [480, 545, 16], [700, 790, -16]];   // Paddock Hill, Chessons, Devil's Elbow (+), North Bend
const SH_BUMPS = prepBumps([
  // THE HILL: North Bend is "a hairpin at the top of the hill", then HAIRY HILL "a steep downhill". One broad cos^2 hill over the
  // top-right: 8 m high, 105 m radius -> steepest ~12 %, flat again before Devil's Elbow and Chessons (both > 170 m from its centre).
  { kind: 'hump', x: +((1150 - SH.cx) * SH.mpp).toFixed(2), y: +((140 - SH.cy) * SH.mpp).toFixed(2), r: 105, h: 8 },
  // the natural bowl: viewing banks round the outside
  ...SH_KIT.bank(90, 480, -32, 7, 1.4), ...SH_KIT.bank(470, 560, 32, 7, 1.6), ...SH_KIT.bank(570, 1110, -32, 7, 1.3),
]);
const SH_TREES = [];
for (let k = 0; k < 500 && SH_TREES.length < 130; k++) {
  const x = (SH_KIT.rnd() - 0.5) * 2 * (FLOOR - 12), y = (SH_KIT.rnd() - 0.5) * 2 * (FLOOR - 12);
  if (SH_KIT.clear(x, y, 12)) SH_TREES.push({ kind: 'tree', x, y, s: 3 + SH_KIT.rnd() * 4, seed: 900 + k });
}
const SH_PROPS = [
  (() => { const [x, y] = shOffStart(0.12, 0); return { kind: 'gantry', x, y, wid: 22, rot: Math.atan2(SH_SDIR[1], SH_SDIR[0]) + Math.PI / 2 }; })(),   // start lights
  ...[0.12, 0.27, 0.42].flatMap((t, k) => { const [x1, y1] = shOffStart(t, -33), [x2, y2] = shOffStart(t + 0.06, -47), r = Math.atan2(SH_SDIR[1], SH_SDIR[0]);
    return [{ kind: 'truck', x: x1, y: y1, rot: r, col: ['#c8302c', '#2b56b5', '#e2c13a'][k] }, { kind: 'truck', x: x2, y: y2, rot: r + Math.PI, col: ['#2f7d4f', '#f2f2f2', '#7a3fa0'][k] }]; }),
  (() => { const [x, y] = shOffStart(0.7, -46); return { kind: 'block', x, y, w: 22, h: 12, rot: Math.atan2(SH_SDIR[1], SH_SDIR[0]), roof: '#7a5a48', label: 'CHESSONS' }; })(),
  SH_KIT.prop(300, -24, { kind: 'board', label: 'SLIDDEN HILL' }),
  SH_KIT.prop(820, -24, { kind: 'board', label: 'KUM TYRES' }),
  ...[166, 279, 742, 856, 1039].map((d) => SH_KIT.prop(d, -21, { kind: 'marshal' })), SH_KIT.prop(511, 21, { kind: 'marshal' }),
  ...SH_TREES,
].filter((p) => p.kind === 'gantry' || p.kind === 'truck' || p.kind === 'block' || SH_KIT.clear(p.x, p.y, p.kind === 'tree' ? 12 : 3));
const SH_TYREWALL = SH_ARMCO.flatMap(([a, b, off]) => [[off - Math.sign(off) * 2, 0], [off - Math.sign(off) * 1, 0.475]].flatMap(([o, sh]) => alongTrack(SH_SUBTRACK, a + sh, b, o, 0.95).map(([x, y]) => ({ x, y, kind: 'tyrestack' }))));

// =============================================================================================
// SWEATY LAMB — parody of Sweet Lamb (mid Wales), the gravel rally stage. Built 2026-10-04. Decisions (user): layout INSPIRED BY THE
// PHOTOS (no published map — rally-maps needs a browser): Sweet Lamb is 4.24 km of gravel, 373-497 m (123 m of climb), a valley side
// of switchbacks that make the famous spectator bowl, black corrugated farm sheds round a gravel yard, a water splash, moorland and
// conifer plantations (art/ref/sl1-5.jpg). ~1 MINUTE of stage (~1.2 km at this game's scale). After the flying finish BOTH: a stop
// zone + RESTART, and an untimed farm road back round to the start. Built as ONE closed loop (stage + liaison) so RESET, lap tracking
// and the autodriver all work; LEVEL.stage = { finish } and main.js times start line -> finish.
// World metres (mpp 1). Valley floor in the south, the hill rising to the north (one cos^2 hill, 18 m); start in the SW farm yard.
// V2 (user, 2026-10-04: "a bit basic track wise — more unique corners"; "slightly longer, more twists and turns, same map size";
// "more tyres, cones, flags so it feels like a rally event"). ~2 km of stage, every corner a different kind, in order:
// SQUARE LEFT out of the yard, DOG-LEG square right, fast ESSES along the valley, the WATER SPLASH, a long right SWEEPER round the SE
// corner, a TYRE CHICANE on the climb, a square left, the HAIRPIN AROUND THE TREE, a left kink, HAIRPIN 2, the CREST YUMP, a right-left
// FLICK, a downhill left sweeper, a SQUARE RIGHT junction, the HAIRPIN AT THE TOP of the second hill, the LONG FAST DESCENT, a WIGGLE,
// the flying FINISH; then a short farm road back to the start.
const SL_STAGE = [[-215, 205], [-175, 205], [-150, 200], [-148, 172], [-140, 160], [-110, 158],                 // square left, dog-leg square right
  [-80, 172], [-50, 150], [-20, 172], [10, 150], [40, 168], [75, 165],                                          // ESSES, the SPLASH
  [110, 178], [150, 192], [190, 190], [218, 170], [228, 135], [228, 110], [228, 82],                           // SWEEPER, the TYRE CHICANE straight
  [225, 58], [195, 52], [150, 55], [100, 58],                                                                    // square left, west along the bowl
  [62, 50], [45, 35], [55, 18], [100, 18], [150, 20], [185, 10], [200, -12],                                     // HAIRPIN AROUND THE TREE, left kink
  [200, -40], [192, -56], [172, -60], [130, -56], [90, -62], [60, -70], [20, -75],                               // HAIRPIN 2, the CREST YUMP
  [-20, -60], [-40, -78], [-60, -95], [-100, -118], [-130, -112], [-160, -110],                                  // FLICK, downhill sweeper, SQUARE RIGHT
  [-162, -150], [-168, -192], [-188, -205], [-208, -190], [-215, -150], [-215, -120], [-210, -60],               // HAIRPIN AT THE TOP, the DESCENT
  [-195, -30], [-215, 0], [-200, 30], [-200, 60]];                                                               // WIGGLE, FINISH
const SL_LIAISON = [[-202, 92], [-222, 130], [-236, 168], [-232, 196]];
const SL_SUB0 = createSubtrack(traceTrack([...SL_STAGE, ...SL_LIAISON], { mpp: 1, cx: 0, cy: 0, rMin: 12 }), 10, [], [], true);
const slD = ([x, y]) => { let best = 0, bd = Infinity; for (const p of SL_SUB0.pts) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p.dist; } } return best; };
const SL_FINISH = slD([-200, 60]), SL_LIAISON_D = slD([-202, 92]);
const SL_SUBTRACK = createSubtrack(SL_SUB0.pts.map((p) => [p.x, p.y]), 10, [
  { startDist: 0, endDist: SL_LIAISON_D, surface: SURFACES.gravel },          // the STAGE: rally gravel
  { startDist: SL_LIAISON_D, endDist: 1e9, surface: SURFACES.broken },        // the farm road back (untimed)
], [], true);   // no kerbs: a rally stage has none
const SL_KIT = trackKit(SL_SUBTRACK, 1984, []);
// named corners (distance along the stage) — everything event-dressing hangs off these
const SL_C = { sqL: slD([-150, 200]), sqR: slD([-140, 160]), splash: slD([75, 165]), sweep: slD([210, 182]), chicane: slD([228, 110]),
  sqL2: slD([225, 58]), tree: slD([45, 35]), hp2: slD([196, -50]), yump: slD([60, -70]), flick: slD([-40, -78]), sqR2: slD([-160, -110]),
  top: slD([-188, -205]), wiggle: slD([-215, 0]) };
const SL_SPLASH = SL_KIT.at(SL_C.splash, 0);
// WATER: the stream down to the splash and on south, plus the farm POND — drawn as one body where they touch (render mergedCovers)
const SL_STREAM = [];
for (let t = 0; t <= 1.0001; t += 0.03) { const x = 62 + 26 * t, y = 112 + 140 * t; if (Math.abs(x) < FLOOR - 8 && Math.abs(y) < FLOOR - 8) SL_STREAM.push({ x, y, w: 7 + 2 * Math.sin(t * 9), h: 5, cover: 'wet', shape: 'ellipse', rot: 1.39 }); }
SL_STREAM.push({ x: SL_SPLASH.x, y: SL_SPLASH.y, w: 13, h: 9, cover: 'wet', shape: 'ellipse', rot: 0.2 });   // the WATER SPLASH
SL_STREAM.push({ x: -95, y: 228, w: 30, h: 14, cover: 'wet', shape: 'ellipse', rot: 0.1 }, { x: -78, y: 232, w: 16, h: 10, cover: 'wet', shape: 'ellipse', rot: -0.3 });   // the farm POND
const SL_YARD = { pts: [[-235, 228], [-175, 230]], width: 22, surface: SURFACES.gravel };   // the farm yard / service park, south of the start
const SL_BUMPS = prepBumps([
  { kind: 'hump', x: 70, y: -40, r: 150, h: 16 },                              // THE HILL of the bowl (steepest ~17 %); the yump sits near its top
  { kind: 'hump', x: -175, y: -165, r: 95, h: 10 },                            // the second hill: hairpin at the top, the long descent off it
  { kind: 'hump', ...SL_KIT.at(SL_C.yump, 0), r: 9, h: 0.9 },                  // the CREST YUMP
  ...SL_KIT.bank(SL_C.sqL2, SL_C.tree, -24, 7, 1.5), ...SL_KIT.bank(SL_C.tree + 40, SL_C.hp2 - 30, 24, 7, 1.5),   // the SPECTATOR BOWL
]);
// EVENT DRESSING by corner: chevron boards on the OUTSIDE (pointing the way), hay bales lining it, cones on the inside apex, flags
// at the spectator spots. Outside of a left-hander is +, of a right-hander -. (dir: +1 = the corner turns right)
const slTurn = (d) => { const a = SL_KIT.rot(d - 8), b = SL_KIT.rot(d + 8); let t = b - a; t = Math.atan2(Math.sin(t), Math.cos(t)); return t > 0 ? 1 : -1; };
const SL_DRESS = [], SL_CONES = [];
for (const d of [SL_C.sqL, SL_C.sqR, SL_C.sqL2, SL_C.tree, SL_C.hp2, SL_C.sqR2, SL_C.top, SL_C.flick]) {
  const dir = slTurn(d), out = -dir;          // outside of the corner
  SL_DRESS.push(SL_KIT.prop(d - 6, out * 9.5, { kind: 'chevron', rot: dir > 0 ? Math.PI / 2 : -Math.PI / 2 }));
  for (const k of [-4, 0, 4]) { const p = SL_KIT.at(d + k, -out * 5.8); SL_CONES.push({ x: p.x, y: p.y, kind: 'cone' }); }
  SL_DRESS.push(SL_KIT.prop(d + 12, out * 11, { kind: 'flag', col: ['#c8302c', '#e2c13a', '#2b56b5', '#2f7d4f'][(d | 0) % 4] }));
}
// HAY BALES round EVERY corner of the stage (user, 2026-10-04: "more hay bales around the rally stage corners"): corners found from the
// curvature (autoKerbs' corner finder: tighter than 45 m, turning > 25 deg), a knockable bale every 2.1 m along the OUTSIDE from just
// before the corner to 12 m after it. (First cut: 7 bales at 8 hand-picked corners.)
for (const c of autoKerbs(SL_SUBTRACK, { maxR: 45, exitR: 0, minTurn: 25, mergeGap: 10 })) {
  if (c.startDist > SL_FINISH) continue;
  const out = c.side === 'left' ? -1 : 1;     // 'left' = +normal = the INSIDE of a right-hander, so the outside is the other side
  for (let d = c.startDist - 8; d <= Math.min(c.endDist + 12, SL_FINISH - 5); d += 2.1) { const p = SL_KIT.at(d, out * 8); SL_CONES.push({ x: p.x, y: p.y, kind: 'bale', rot: SL_KIT.rot(d) }); }
}
// the TYRE CHICANE (rally style: stacks on the road, alternate sides) on the climb
// 3 deep x 3 long blocks of stacks (photographed: one row of 3 read as debris, not a chicane)
for (const [k, side] of [[-16, 1], [0, -1], [16, 1]]) for (const w of [0, 1, 2]) for (const l of [-1, 0, 1]) { const p = SL_KIT.at(SL_C.chicane + k + l * 0.95, side * (5 - w * 0.95)); SL_CONES.push({ x: p.x, y: p.y, kind: 'tyrestack' }); }
// flags along the start / finish and the bowl; spectator TAPE on the bank tops (non-solid line)
for (let k = 0; k < 6; k++) SL_DRESS.push(SL_KIT.prop(8 + k * 6, -8.5, { kind: 'flag', col: ['#c8302c', '#f2f2f2'][k % 2] }), SL_KIT.prop(SL_FINISH - 20 + k * 6, -8.5, { kind: 'flag', col: ['#2b56b5', '#f2f2f2'][k % 2] }));
const SL_TAPE = [{ kind: 'line', col: '#e23b2e', pts: alongTrack(SL_SUBTRACK, SL_C.sqL2 + 10, SL_C.tree - 10, -14, 3) }, { kind: 'line', col: '#e23b2e', pts: alongTrack(SL_SUBTRACK, SL_C.tree + 40, SL_C.hp2 - 30, 14, 3) }];
const SL_TREES = [{ kind: 'tree', ...SL_KIT.at(SL_C.tree, 12), s: 7, seed: 3 }];   // THE TREE the hairpin goes round (inside of a right-hander)
for (const [cx, cy, n] of [[150, 110, 26], [-60, 110, 22], [-110, -30, 26], [140, -150, 30], [-60, -170, 18], [-235, -230, 10]]) for (let k = 0; k < n; k++) {
  const x = cx + (SL_KIT.rnd() - 0.5) * 60, y = cy + (SL_KIT.rnd() - 0.5) * 50;
  if (SL_KIT.clear(x, y, 9)) SL_TREES.push({ kind: 'tree', x, y, s: 3.5 + SL_KIT.rnd() * 2, seed: 2 * k + 1 });   // odd seeds: the darker palette
}
const SL_PROPS = [
  { kind: 'block', x: -238, y: 246, w: 20, h: 10, rot: 0, roof: '#2c2f33', label: 'SWEATY LAMB' },   // black corrugated sheds (photo)
  { kind: 'block', x: -150, y: 248, w: 24, h: 10, rot: 0, roof: '#2c2f33' },
  { kind: 'truck', x: -220, y: 226, rot: 0, col: '#c8302c' }, { kind: 'truck', x: -190, y: 232, rot: 0, col: '#2b56b5' },   // service vans
  SL_KIT.prop(2, 0, { kind: 'gantry', wid: 18, rot: Math.PI / 2 }),                                   // the START arch
  ...[[SL_C.tree + 60, 34], [SL_C.tree + 120, 34], [SL_C.hp2 + 40, -34]].map(([d, off]) => SL_KIT.prop(d, off, { kind: 'block', w: 5, h: 5, roof: '#eef0f2' })),   // marquees in the bowl
  SL_KIT.prop(SL_FINISH + 2, -9, { kind: 'board', label: 'FINISH' }), SL_KIT.prop(SL_FINISH + 40, -9, { kind: 'board', label: 'STOP' }),
  SL_KIT.prop(60, -12, { kind: 'board', label: 'SWEATY LAMB' }), SL_KIT.prop(SL_C.sweep, -16, { kind: 'board', label: 'KUM TYRES' }),
  ...SL_DRESS, ...SL_TREES,
].filter((p) => (p.kind === 'block' && p.w > 10) || p.kind === 'truck' || p.kind === 'gantry' || p.kind === 'bale' || p.kind === 'chevron' || p.kind === 'flag' ? true : SL_KIT.clear(p.x, p.y, p.kind === 'tree' ? (p.s > 6 ? 6 : 9) : 3));
const SL_PAINT = [
  { kind: 'chequered', x: SL_SUBTRACK.pts[0].x, y: SL_SUBTRACK.pts[0].y, len: 1.6, wid: 10, rot: SL_SUBTRACK.pts[0].heading },
  (() => { const p = onTrack(SL_SUBTRACK, SL_FINISH, 0, {}); return { kind: 'chequered', x: p.x, y: p.y, len: 1.6, wid: 10, rot: p.rot }; })(),
];

// =============================================================================================
// KILLDER — parody of the Kielder Forest rally stages (Northumberland). Built 2026-10-04. DECIDED (user): "FAST + FLOWING"; "be LIBERAL
// with hay bales, tyres, cones, flags and other event decorations"; a staggered-start stage like Sweaty Lamb (main.js / raceflow stage).
// Real Kielder: fast gravel forest roads through dense conifer plantations, long straights into tight JUNCTION hairpins, big crests and
// jumps, log piles at the junctions, the reservoir (Kielder Water). ~2 km of stage (1966 m traced), in order: the FOREST STRAIGHT out of
// the start, flowing right-left SWEEPERS north, the big CREST, JUNCTION HAIRPIN 1 (right), south past the plantation, the DAM STRAIGHT
// along Kielder Water, a fast right, THE JUMP, a long fast left, the LOG-PILE SQUARE right, north-east S-bends, JUNCTION HAIRPIN 2
// (left), the long crest-y TOP ROAD west, sweeping down the west side, fast S-BENDS, the flying FINISH; then the forest road back.
// MEASURED (layout check): tightest R 24 m (the junction hairpins), road never within 32 m of another part of itself.
const KD_STAGE = [[-200, 230], [-140, 232], [-80, 228], [-30, 215], [10, 190], [30, 150], [35, 110], [32, 70], [25, 30], [22, -2], [38, -16], [58, -10], [70, 10],
  [76, 60], [92, 108], [122, 140], [170, 150], [210, 140], [230, 100], [232, 50], [230, 10], [222, -22], [205, -50], [170, -68], [130, -74], [100, -78],
  [93, -110], [96, -160], [115, -195], [150, -212], [190, -208], [218, -214], [226, -234], [205, -248], [170, -246], [120, -240], [60, -226], [0, -236],
  [-60, -226], [-110, -200], [-140, -160], [-150, -110], [-132, -70], [-150, -30], [-126, 10], [-140, 50], [-142, 92]];
const KD_LIAISON = [[-150, 130], [-185, 160], [-222, 185], [-240, 210], [-228, 230]];
const KD_SUB0 = createSubtrack(traceTrack([...KD_STAGE, ...KD_LIAISON], { mpp: 1, cx: 0, cy: 0, rMin: 12 }), 9, [], [], true);
const kdD = ([x, y]) => { let best = 0, bd = Infinity; for (const p of KD_SUB0.pts) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p.dist; } } return best; };
const KD_FINISH = kdD([-142, 92]), KD_LIAISON_D = kdD([-150, 130]);
const KD_SUBTRACK = createSubtrack(KD_SUB0.pts.map((p) => [p.x, p.y]), 9, [
  { startDist: 0, endDist: KD_LIAISON_D, surface: SURFACES.gravel },          // the STAGE: forest gravel
  { startDist: KD_LIAISON_D, endDist: 1e9, surface: SURFACES.dirt },          // the forest road back (untimed)
], [], true);
const KD_KIT = trackKit(KD_SUBTRACK, 1982, []);   // Kielder Water filled 1982
const KD_C = { sweep: kdD([10, 190]), crest: kdD([30, 50]), hp1: kdD([40, -14]), dam: kdD([150, 150]), fastR: kdD([222, 120]), jump: kdD([231, 30]),
  longL: kdD([190, -60]), sq: kdD([98, -80]), ess: kdD([150, -212]), hp2: kdD([222, -236]), top1: kdD([90, -233]), top2: kdD([-30, -232]),
  down: kdD([-125, -180]), sb: kdD([-140, -50]) };
// KIELDER WATER: the reservoir south-east of the dam straight (shallow edges you can drive into — a wet cover), plus a forest pond
const KD_WATER = [
  { x: 150, y: 205, w: 170, h: 52, cover: 'wet', shape: 'ellipse', rot: -0.05 },
  { x: 225, y: 228, w: 60, h: 40, cover: 'wet', shape: 'ellipse', rot: 0.3 },
  { x: -40, y: -120, w: 26, h: 16, cover: 'wet', shape: 'ellipse', rot: 0.4 },
];
const KD_YARD = { pts: [[-232, 246], [-160, 246]], width: 18, surface: SURFACES.gravel };   // the service park, south of the start
const KD_BUMPS = prepBumps([
  { kind: 'hump', x: 60, y: -150, r: 140, h: 12 },                               // the forest hill in the north (the top road runs over its edge)
  { kind: 'hump', x: -170, y: -60, r: 90, h: 7 },                                // the west hill the S-bends come down
  { kind: 'hump', ...KD_KIT.at(KD_C.crest, 0), r: 22, h: 1.8 },                  // THE BIG CREST (light car, long view)
  { kind: 'hump', ...KD_KIT.at(KD_C.jump, 0), r: 8, h: 1.3 },                    // THE JUMP (sharp: you fly)
  { kind: 'hump', ...KD_KIT.at(KD_C.top1, 0), r: 18, h: 1.4 }, { kind: 'hump', ...KD_KIT.at(KD_C.top2, 0), r: 18, h: 1.4 },   // crests on the top road
  ...KD_KIT.bank(KD_C.hp1 - 30, KD_C.hp1 + 30, -20, 6, 1.4), ...KD_KIT.bank(KD_C.hp2 - 30, KD_C.hp2 + 30, 20, 6, 1.4),          // spectator banks
]);
// EVENT DRESSING (user: "be liberal"): on EVERY corner chevrons on the outside, hay bales lining the outside, cones on the inside apex,
// flags; tyre-stack walls at the junction hairpins and the square; spectator tape + marquees at the hairpins and the jump; log piles.
const kdTurn = (d) => { const a = KD_KIT.rot(d - 8), b = KD_KIT.rot(d + 8); let t = b - a; t = Math.atan2(Math.sin(t), Math.cos(t)); return t > 0 ? 1 : -1; };
const KD_DRESS = [], KD_CONES = [];
const KD_FLAGC = ['#c8302c', '#e2c13a', '#2b56b5', '#2f7d4f', '#f2f2f2', '#e07a1f'];
for (const c of autoKerbs(KD_SUBTRACK, { maxR: 70, exitR: 0, minTurn: 18, mergeGap: 10 })) {
  if (c.startDist > KD_FINISH - 10) continue;
  const mid = (c.startDist + c.endDist) / 2, dir = kdTurn(mid), out = -dir;   // outside of the corner
  for (let d = c.startDist - 10; d <= Math.min(c.endDist + 14, KD_FINISH - 6); d += 2.2) { const p = KD_KIT.at(d, out * 7.4); KD_CONES.push({ x: p.x, y: p.y, kind: 'bale', rot: KD_KIT.rot(d) }); }
  KD_DRESS.push(KD_KIT.prop(c.startDist - 14, out * 9.5, { kind: 'chevron', rot: dir > 0 ? Math.PI / 2 : -Math.PI / 2 }), KD_KIT.prop(mid, out * 10.5, { kind: 'chevron', rot: dir > 0 ? Math.PI / 2 : -Math.PI / 2 }));
  for (const k of [-5, 0, 5]) { const p = KD_KIT.at(mid + k, -out * 5.2); KD_CONES.push({ x: p.x, y: p.y, kind: 'cone' }); }
  for (let k = 0; k < 3; k++) KD_DRESS.push(KD_KIT.prop(mid - 10 + k * 10, out * 12.5, { kind: 'flag', col: KD_FLAGC[(k + (mid | 0)) % KD_FLAGC.length] }));
}
// tyre walls: the outside of the two junction hairpins and the square (3 rows deep)
for (const [d, side] of [[KD_C.hp1, 1], [KD_C.hp2, -1], [KD_C.sq, 1]]) for (let k = -12; k <= 12; k += 0.95) for (const w of [0, 1, 2]) {
  const p = KD_KIT.at(d + k, side * (8 + w * 0.95)); if (KD_KIT.clear(p.x, p.y, 0.5)) KD_CONES.push({ x: p.x, y: p.y, kind: 'tyrestack' });
}
// cones down the middle of the start and finish straights' run-in, and loose tyres at the stop zone
for (let d = KD_FINISH + 8; d < KD_FINISH + 40; d += 6) { const p = KD_KIT.at(d, 3.5); KD_CONES.push({ x: p.x, y: p.y, kind: 'cone' }); }
// START / FINISH flag lines
for (let k = 0; k < 8; k++) KD_DRESS.push(KD_KIT.prop(4 + k * 5, -7.5, { kind: 'flag', col: ['#c8302c', '#f2f2f2'][k % 2] }), KD_KIT.prop(4 + k * 5, 7.5, { kind: 'flag', col: ['#2b56b5', '#f2f2f2'][k % 2] }),
  KD_KIT.prop(KD_FINISH - 30 + k * 5, -7.5, { kind: 'flag', col: ['#2b56b5', '#f2f2f2'][k % 2] }));
const KD_TAPE = [KD_C.hp1, KD_C.hp2, KD_C.jump].map((d, i) => ({ kind: 'line', col: '#e23b2e', pts: alongTrack(KD_SUBTRACK, d - 35, d + 35, (i === 1 ? 1 : -1) * 15, 3) }));
// LOG PILES (Kielder: timber stacks at the forest junctions) — solid blocks of stacked logs
const KD_LOGS = [[KD_C.hp1 + 22, 16], [KD_C.sq - 18, -15], [KD_C.sq + 25, 15], [KD_C.hp2 + 24, -16], [KD_C.down + 30, 15], [KD_C.longL, -16], [KD_C.dam - 60, -15]]
  .map(([d, off]) => KD_KIT.prop(d, off, { kind: 'block', w: 9, h: 3.2, roof: '#7a5232' }));
// THE FOREST: conifer plantations in blocks between the roads (dark seeds), clear of the road by 8 m
const KD_TREES = [];
for (const [cx, cy, w, h, n] of [[-60, 120, 70, 120, 35], [140, 40, 100, 120, 40], [10, -120, 120, 90, 40], [-200, -120, 70, 160, 35], [170, -140, 80, 60, 25],
  [-60, -60, 80, 80, 28], [70, 210, 90, 30, 15], [-190, 60, 50, 70, 18], [200, -200, 50, 30, 10]]) for (let k = 0; k < n; k++) {
  const x = cx + (KD_KIT.rnd() - 0.5) * w, y = cy + (KD_KIT.rnd() - 0.5) * h;
  if (KD_KIT.clear(x, y, 8)) KD_TREES.push({ kind: 'tree', x, y, s: 4 + KD_KIT.rnd() * 2.5, seed: 2 * k + 1 });
}
// the TREE WALLS of a forest stage (photographed v1: plantations only, so the road ran through open grass): both sides, 10-16 m out,
// every ~8 m with gaps, along the whole stage (the corners' bales / chevrons sit inside 13 m; clear() keeps 8 m off any road)
for (let d = 20; d < KD_FINISH - 10; d += 8) for (const side of [-1, 1]) {
  if (KD_KIT.rnd() < 0.3) continue;
  const p = KD_KIT.at(d + KD_KIT.rnd() * 4, side * (14 + KD_KIT.rnd() * 6));
  if (KD_KIT.clear(p.x, p.y, 8)) KD_TREES.push({ kind: 'tree', x: p.x, y: p.y, s: 4.5 + KD_KIT.rnd() * 2.5, seed: 2 * ((d | 0) % 50) + 1 });
}
// along the STRAIGHTS too (user: "be liberal"): a marshal post every ~240 m, a sponsor board every ~300 m, a flag pair every ~120 m
const KD_ALONG = [];
for (let d = 120; d < KD_FINISH - 40; d += 240) KD_ALONG.push(KD_KIT.prop(d, (d / 240 | 0) % 2 ? 11 : -11, { kind: 'marshal' }));
['KUM TYRES', 'KILLDER', 'FORESTRY RALLY', 'SLIPPY PISTONS', 'MUDDY BANK'].forEach((label, i) => KD_ALONG.push(KD_KIT.prop(260 + i * 330, i % 2 ? 13 : -13, { kind: 'board', label })));
for (let d = 60; d < KD_FINISH - 30; d += 120) for (const side of [-1, 1]) KD_ALONG.push(KD_KIT.prop(d, side * 9.5, { kind: 'flag', col: KD_FLAGC[((d / 120) | 0) % KD_FLAGC.length] }));
const KD_PROPS = [
  ...[[-128, 248], [-104, 248]].map(([x, y]) => ({ kind: 'block', x, y, w: 14, h: 7, rot: 0, roof: '#eef0f2' })),                            // service marquees
  { kind: 'truck', x: -220, y: 244, rot: 0, col: '#2f7d4f' }, { kind: 'truck', x: -195, y: 249, rot: 0, col: '#c8302c' }, { kind: 'truck', x: -170, y: 244, rot: 0, col: '#2b56b5' },
  KD_KIT.prop(2, 0, { kind: 'gantry', wid: 17, rot: Math.PI / 2 }),                                                                         // the START arch
  KD_KIT.prop(KD_FINISH, 0, { kind: 'gantry', wid: 17, rot: Math.PI / 2 }),                                                                 // the FINISH arch
  KD_KIT.prop(KD_FINISH + 3, -9, { kind: 'board', label: 'FINISH' }), KD_KIT.prop(KD_FINISH + 42, -9, { kind: 'board', label: 'STOP' }),
  KD_KIT.prop(40, -11, { kind: 'board', label: 'KILLDER FOREST RALLY' }), KD_KIT.prop(KD_C.dam, -12, { kind: 'board', label: 'KUM TYRES' }),
  KD_KIT.prop(KD_C.jump - 25, 12, { kind: 'board', label: 'JUMP' }), KD_KIT.prop(KD_C.hp1 - 30, -12, { kind: 'board', label: 'SPECTATORS' }),
  ...[[KD_C.hp1, -26], [KD_C.hp2, 26], [KD_C.jump, -26]].map(([d, off]) => KD_KIT.prop(d, off, { kind: 'block', w: 5, h: 5, roof: '#eef0f2' })),   // spectator marquees
  ...KD_LOGS, ...KD_DRESS, ...KD_ALONG, ...KD_TREES,
].filter((p) => p.kind === 'gantry' || p.kind === 'truck' || p.kind === 'chevron' || p.kind === 'flag' || (p.kind === 'block' && p.w > 10) ? true : KD_KIT.clear(p.x, p.y, p.kind === 'tree' ? 8 : 3));
const KD_PAINT = [
  { kind: 'chequered', x: KD_SUBTRACK.pts[0].x, y: KD_SUBTRACK.pts[0].y, len: 1.6, wid: 9, rot: KD_SUBTRACK.pts[0].heading },
  (() => { const p = onTrack(KD_SUBTRACK, KD_FINISH, 0, {}); return { kind: 'chequered', x: p.x, y: p.y, len: 1.6, wid: 9, rot: p.rot }; })(),
];

// =============================================================================================
// BRANDS SNATCH — parody of Brands Hatch (Kent). Built 2026-10-04. Decisions (user): BOTH layouts (GP + Indy) from one build, REAL-ISH
// hills from the contour map (art/ref/bh1.png: 115-145 m), GRAVEL TRAPS + tyre walls + Armco, grandstands, pits, woods.
// TRACED from the official map (art/ref/bh2.png = Wikimedia "Brands_Hatch_2003.svg" at 1280 px; 300 m = 460 px -> 0.652 m/px real) at
// 0.31 game m/px (0.48 of real, so the 3.9 km GP fits the world). Clockwise from the line on BRABHAM STRAIGHT: PADDOCK HILL BEND (the
// blind plunge, right) -> down HAILWOOD HILL -> DRUIDS (uphill right hairpin) -> GRAHAM HILL down -> GRAHAM HILL BEND (left) -> COOPER
// STRAIGHT -> SURTEES (left) -> [GP: PILGRIMS DROP -> HAWTHORN HILL -> HAWTHORNS (right) -> DEREK MINTER STRAIGHT -> WESTFIELD (right)
// -> DINGLE DELL (dip) -> SHEENE CURVE (right) -> STIRLINGS (left) -> CLEARWAYS | Indy: McLAREN] -> CLARK CURVE -> line.
const BH = { mpp: 0.31, cx: 635, cy: 895 };
const bhXY = (px, py) => [+((px - BH.cx) * BH.mpp).toFixed(2), +((py - BH.cy) * BH.mpp).toFixed(2)];
const BH_TOP = [[700, 152], [800, 155], [900, 160], [950, 168], [1000, 182], [1050, 205], [1090, 240], [1110, 280], [1115, 330], [1105, 390],   // BRABHAM, PADDOCK HILL
  [1080, 450], [1050, 510], [1020, 560], [985, 615], [955, 665], [930, 690], [905, 698], [880, 680], [866, 645], [875, 600], [900, 545],          // HAILWOOD HILL, DRUIDS
  [925, 490], [940, 440], [946, 395], [946, 355], [932, 325], [905, 310], [850, 300], [780, 285], [720, 272], [650, 268], [550, 268], [480, 272],  // GRAHAM HILL, BEND, COOPER
  [432, 292], [402, 322], [388, 360]];                                                                                                               // SURTEES
const BH_GP = [[395, 400], [418, 435], [460, 470], [510, 515], [570, 565], [632, 625], [675, 675], [720, 735], [780, 820], [850, 915], [920, 1010],   // PILGRIMS DROP
  [990, 1105], [1030, 1160], [1058, 1215], [1074, 1270], [1070, 1325], [1048, 1370], [1015, 1405], [960, 1452], [880, 1520], [805, 1590],          // HAWTHORN HILL, HAWTHORNS, MINTER
  [765, 1625], [738, 1634], [705, 1626], [650, 1605], [590, 1582], [548, 1555], [500, 1508], [452, 1455], [412, 1390], [392, 1325], [380, 1270],   // WESTFIELD, DINGLE DELL
  [374, 1228], [388, 1196], [422, 1140], [470, 1082], [528, 1015], [572, 962], [588, 922], [580, 888], [558, 858], [518, 815], [450, 742],        // SHEENE, STIRLINGS
  [380, 662], [300, 575], [232, 500], [182, 447], [160, 405], [154, 360], [164, 312], [198, 262], [258, 216], [330, 180], [420, 158], [520, 152], [610, 150]];   // CLEARWAYS, CLARK
const BH_INDY = [[378, 400], [350, 432], [300, 455], [250, 466], [205, 463], [176, 440], [160, 405], [154, 360], [164, 312], [198, 262], [258, 216],   // McLAREN, CLARK
  [330, 180], [420, 158], [520, 152], [610, 150]];
// HILLS from the contours, in game metres (heights ~0.5 of real so a car goes LIGHT at the crests, never flies: tools/crestcheck)
const BH_HILLS = [
  { kind: 'dip', ...(([x, y]) => ({ x, y }))(bhXY(1085, 455)), r: 55, d: 4.0 },     // the bottom of PADDOCK HILL: the plunge, then up Hailwood
  { kind: 'hump', ...(([x, y]) => ({ x, y }))(bhXY(905, 690)), r: 42, h: 2.2 },     // DRUIDS on its rise
  { kind: 'dip', ...(([x, y]) => ({ x, y }))(bhXY(860, 1000)), r: 110, d: 4.5 },    // PILGRIMS DROP into the valley, out up HAWTHORN HILL
  { kind: 'dip', ...(([x, y]) => ({ x, y }))(bhXY(470, 1480)), r: 45, d: 2.2 },     // DINGLE DELL
  { kind: 'hump', ...(([x, y]) => ({ x, y }))(bhXY(330, 760)), r: 150, h: 3.0 },    // the high ground west of the infield (145 m contour)
];
const BRANDS_DROPPED = {};   // what the footprint check removed per layout (tools read it)
export { BRANDS_DROPPED };
function brandsLevel(id, name, mapPts) {
  const sub0 = createSubtrack(traceTrack(mapPts, { mpp: BH.mpp, cx: BH.cx, cy: BH.cy, rMin: 15.5 }), 13, [{ startDist: 0, endDist: 1e9, surface: SURFACES.racetarmac }], [], true);
  sub0.curvedKerbs = autoKerbs(sub0, { maxR: 70, exitR: 30, heavyR: 22, minTurn: 20, mergeGap: 12 });
  const sub = sub0, hw = sub.width / 2;
  const dOf = (px, py) => { const [x, y] = bhXY(px, py); let b = 0, bd = Infinity; for (const p of sub.pts) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; b = p.dist; } } return b; };
  // PIT LANE: on the inside (+) of Brabham Straight, from Clark Curve to past the line (map: grey line)
  const pd0 = dOf(200, 262), pd1 = dOf(915, 162);
  const pit = alongTrack(sub, pd0, pd1, (t, len) => 4 + 13 * ss01(Math.min(t, len - t) / 30), 2);
  const PIT = { pts: pit, width: 9, surface: SURFACES.concrete };
  // GRAVEL TRAPS on the OUTSIDE of every real corner (autoKerbs' finder: R < 45, turn > 35 deg): 12 m deep, from the apex to 30 m after
  const traps = [];
  for (const c of autoKerbs(sub, { maxR: 45, exitR: 0, minTurn: 35, mergeGap: 15 })) {
    if (c.startDist < pd1 + 5 && c.endDist > pd0 - 5 && pd0 < pd1) continue;
    const out = c.side === 'left' ? -1 : 1;
    traps.push({ out, d0: c.startDist - 5, d1: c.endDist + 30, pts: alongTrack(sub, c.startDist - 5, c.endDist + 30, out * (hw + 2 + 6), 2), width: 12, surface: SURFACES.gravel });
  }
  const kit = trackKit(sub, id.length * 1999, [PIT, ...traps]);
  const kit0 = trackKit(sub, 7, [PIT]);       // filter only against the road + pit lane (barriers stand behind the traps)
  const barriers = [], cones = [];
  // keep barriers / tyres off EVERY part of the road (behind a trap the Armco can come near another leg — barriercheck failed 2 runs):
  // a run is split wherever it comes within half width + 4 m of any road
  const nearRoad = (x, y) => querySubtrack(sub, x, y).dist < hw + 4 || kit.onLane(x, y, 0.6);   // ... or on another trap / the pit lane
  const runs = (pts) => { const out = []; let cur = []; for (const q of pts) { if (nearRoad(q[0], q[1])) { if (cur.length > 1) out.push(cur); cur = []; } else cur.push(q); } if (cur.length > 1) out.push(cur); return out; };
  for (const t of traps) {
    const o = t.out * (hw + 2 + 12 + 2.5);   // Armco behind the trap; two staggered rows of tyres in front of it
    for (const r of runs(alongTrack(sub, t.d0, t.d1, o, 2))) barriers.push({ kind: 'armco', pts: r });
    for (const [oo, sh] of [[o - t.out * 1.4, 0], [o - t.out * 2.35, 0.475]]) for (const [x, y] of alongTrack(sub, t.d0 + sh, t.d1, oo, 0.95)) if (!nearRoad(x, y)) cones.push({ x, y, kind: 'tyrestack' });
  }
  barriers.push({ kind: 'pitwall', pts: alongTrack(sub, pd0 + 30, pd1 - 30, 9.5, 2) });
  const kitT = trackKit(sub, 3, traps);   // gravel traps only
  for (const r of (() => { const out = []; let cur = []; for (const q of alongTrack(sub, dOf(480, 155), dOf(780, 158), 22.1, 2)) { if (kitT.onLane(q[0], q[1], 0.5)) { if (cur.length > 1) out.push(cur); cur = []; } else cur.push(q); } if (cur.length > 1) out.push(cur); return out; })())
    barriers.push({ kind: 'building', pts: r });   // the garages are solid (split where a gravel trap reaches them — Indy's McLaren trap)
  barriers.push({ kind: 'line', pts: alongTrack(sub, pd0 + 34, pd1 - 34, 13.6, 2) });
  const props = [
    kit0.prop(2, 0, { kind: 'gantry', wid: 24, rot: Math.PI / 2 }),
    // garages 5 m deep, x 430-780 (photographed: 10 m deep they reached Cooper Straight, only ~34 m away, and the Graham Hill trap's tyres)
    { kind: 'garagerow', brand: 'KUM TYRES', x: 0, y: 0, front: alongTrack(sub, dOf(480, 155), dOf(780, 158), 21.8, 2.5), back: alongTrack(sub, dOf(480, 155), dOf(780, 158), 26.8, 2.5), banner: alongTrack(sub, dOf(480, 155), dOf(780, 158), 22.7, 2.5) },
    kit0.prop(dOf(560, 152), -26, { kind: 'grandstand', w: 90, h: 9 }),            // the main grandstand, outside Brabham
    kit0.prop(dOf(1090, 240), -34, { kind: 'grandstand', w: 40, h: 9 }),           // Paddock Hill
    kit0.prop(dOf(250, 480), -34, { kind: 'grandstand', w: 40, h: 9 }),            // Clearways (outside)
    // race control by Druids: the first spot OUTSIDE the hairpin that clears the road (at +40 inside it stood across Hailwood / Graham Hill)
    ...[-40, -48, -56, 52, 64].map((o) => kit0.prop(dOf(905, 698), o, { kind: 'tower', size: 8 })),
    kit0.prop(dOf(200, 262), -30, { kind: 'board', label: 'BRANDS SNATCH' }), kit0.prop(dOf(950, 168), -30, { kind: 'board', label: 'KUM TYRES' }),
    kit0.prop(dOf(480, 272), -24, { kind: 'board', label: 'SPUM OIL' }),
  ];
  for (const [x, y] of [[-40, -130], [70, -150], [40, -60]]) props.push({ kind: 'truck', x, y, rot: 0.1, col: ['#c8302c', '#2b56b5', '#e2c13a'][props.length % 3] });   // paddock inside the Indy loop
  // WOODS: the GP loop runs through them; scattered trees elsewhere — seeded, kept off road / pit / traps
  for (let k = 0; k < 700 && props.filter((p) => p.kind === 'tree').length < 160; k++) {
    const x = (kit.rnd() - 0.5) * 2 * (FLOOR - 12), y = (kit.rnd() - 0.5) * 2 * (FLOOR - 12), woods = y > 30;
    if ((woods || kit.rnd() < 0.25) && kit.clear(x, y, 10)) props.push({ kind: 'tree', x, y, s: 3.5 + kit.rnd() * 3, seed: k });
  }
  for (const c of sub.curvedKerbs) if (c.side === 'left' || c.side === 'right') props.push(kit0.prop((c.startDist + c.endDist) / 2, (c.side === 'left' ? -1 : 1) * -(hw + 30), { kind: 'marshal' }));
  // FOOTPRINT CHECK (user, 2026-10-04: "a truck across the Brands GP track", "a hut across the road near the exit of Druids on the Indy").
  // The first filter skipped big props and tested only a prop's CENTRE. Now every prop's whole box (its solid size + 1.5 m) is sampled on
  // a 1.5 m grid against the road and the pit / trap lanes; anything touching is dropped. Only the gantry and the garages may stand there.
  const FOOT = { grandstand: (p) => [p.w, p.h], tower: (p) => [p.size, p.size], truck: () => [14, 2.5], marshal: () => [2.4, 2], board: () => [18, 1.2], tree: (p) => [p.s * 0.5, p.s * 0.5] };
  const boxClear = (p) => { const f = FOOT[p.kind]; if (!f) return true; const [w, h] = f(p), c = Math.cos(p.rot || 0), sn = Math.sin(p.rot || 0);
    for (let u = -w / 2 - 1.5; u <= w / 2 + 1.5; u += 1.5) for (let v = -h / 2 - 1.5; v <= h / 2 + 1.5; v += 1.5) {
      const x = p.x + c * u - sn * v, y = p.y + sn * u + c * v;
      if (querySubtrack(sub, x, y).dist < hw + 0.5 || kit.onLane(x, y, 0)) return false; }
    return true; };
  let towerDone = false;
  const okProps = props.filter((p) => p.kind === 'gantry' || p.kind === 'garagerow' || (boxClear(p) && (p.kind !== 'tower' || (!towerDone && (towerDone = true)))));
  BRANDS_DROPPED[id] = props.filter((p) => !okProps.includes(p)).map((p) => p.kind).filter((k) => k !== 'tree' && k !== 'tower');
  const banks = [...kit.bank(dOf(1000, 182), dOf(1050, 510), -36, 7, 1.4), ...kit.bank(dOf(400, 320), dOf(650, 268), 30, 7, 1.2)];
  return {
    id, name, base: SURFACES.grass, subtrack: sub,
    camber: { maxDeg: 3, refR: 70, crown: 0.02, edge: 6, sections: [] },
    zones: [], bumps: prepBumps([...BH_HILLS, ...banks]),
    paint: [{ kind: 'chequered', x: sub.pts[0].x, y: sub.pts[0].y, len: 1.6, wid: 13, rot: sub.pts[0].heading }],
    boards: [], seams: false, cones,
    lanes: [PIT, ...traps], barriers, props: okProps, solids: solidsFromProps(okProps),
    spawn: (() => { const p = onTrack(sub, sub.totalDist - 15, 0, {}); return { x: p.x, y: p.y, heading: p.rot }; })(),
  };
}
const BH_GP_LEVEL = brandsLevel('brands-snatch', 'Brands Snatch GP', [...BH_TOP, ...BH_GP]);
const BH_INDY_LEVEL = brandsLevel('brands-snatch-indy', 'Brands Snatch Indy', [...BH_TOP, ...BH_INDY]);

// =============================================================================================
// KNOBHILL — parody of Knockhill (Fife), the rallycross layout. Built 2026-10-04. Decisions (user): the TARMAC CIRCUIT + an INFIELD
// DIRT section (~40 % dirt like the real RX lap: 1.4 km, 39 % dirt), DRY, hills FELT like Brands ("twists, drops and climbs 60 m").
// TRACED from Wikimedia "Knockhill_circuit_map.png" (art/ref/kh3.png, 800 px; 100 m = 76 px) at 0.62 game m/px. Clockwise from the line:
// DUFFUS DIP (fast blind downhill right) -> SCOTSMAN (90 right) -> BUTCHERS -> the chicane -> bottom straight [JOKER: a dirt loop off the
// LEFT after turn 4, as the real one] -> CLARK'S (blind uphill right, "onto two wheels") -> DIRT: HISLOP'S -> up to the hairpin -> back
// onto the start straight. No published RX map: the dirt runs where the real circuit's tarmac does from Clark's to the hairpin.
const KH = { mpp: 0.62, cx: 400, cy: 520 };
const khXY = (px, py) => [+((px - KH.cx) * KH.mpp).toFixed(2), +((py - KH.cy) * KH.mpp).toFixed(2)];
const KH_MAP = [[365, 378], [420, 384], [480, 392], [540, 402], [578, 412], [592, 430], [605, 455], [622, 475], [650, 485], [690, 495], [705, 508],   // DUFFUS DIP
  [708, 532], [700, 560], [690, 590], [670, 610], [645, 625], [622, 642], [600, 655], [560, 662], [500, 670], [440, 675], [405, 676],              // SCOTSMAN, BUTCHERS, chicane
  [388, 665], [378, 640], [366, 602], [345, 572], [320, 545], [280, 510], [220, 470], [160, 435], [112, 405], [90, 385], [92, 366], [110, 357],    // CLARK'S, HISLOP'S, HAIRPIN
  [150, 360], [220, 366], [290, 372]];
const KH_SUB0 = createSubtrack(traceTrack(KH_MAP, { mpp: KH.mpp, cx: KH.cx, cy: KH.cy, rMin: 15.5 }), 13, [], [], true);
const khD = (px, py) => { const [x, y] = khXY(px, py); let b = 0, bd = Infinity; for (const p of KH_SUB0.pts) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; b = p.dist; } } return b; };
const KH_D = { dirtIn: khD(395, 670), dirtOut: khD(215, 366) };
const KH_SUBTRACK = createSubtrack(KH_SUB0.pts.map((p) => [p.x, p.y]), 13, [
  { startDist: 0, endDist: KH_D.dirtIn, surface: SURFACES.racetarmac },
  { startDist: KH_D.dirtIn, endDist: KH_D.dirtOut, surface: SURFACES.dirt },
  { startDist: KH_D.dirtOut, endDist: 1e9, surface: SURFACES.racetarmac },
], [], true);
KH_SUBTRACK.curvedKerbs = autoKerbs(KH_SUBTRACK, { maxR: 70, exitR: 30, heavyR: 22, minTurn: 20, mergeGap: 12 }).filter((k) => k.endDist < KH_D.dirtIn || k.startDist > KH_D.dirtOut);   // no kerbs on dirt
// the JOKER: a dirt loop off the LEFT (south) of the bottom straight after the chicane
// SHALLOW (MEASURED, tools/jokercost: the first loop, 34 m deep, cost 7-16.5 s; a real RX joker costs ~1-3 s)
// + 4 m further out in the middle (user wanted bales between joker and track: the strip was 1-2 m)
const KH_JOKER = { pts: openSmooth([[590, 657], [572, 684], [540, 699], [500, 701], [468, 694], [448, 678]].map(([x, y]) => khXY(x, y))), width: 12, surface: SURFACES.dirt };
const KH_JOKER_RULE = (() => { const J = KH_JOKER.pts, m = J[Math.floor(J.length / 2)], a = J[6], u = onTrack(KH_SUBTRACK, khD(620, 643), -4, {});
  return { gate: { x: m[0], y: m[1], r: 7 }, penalty: 30, laps: 5, arrows: [jokerArrow(KH_SUBTRACK, J), jokerApproach(KH_SUBTRACK, J)].filter(Boolean) }; })();
const KH_LEVEL = (() => {
  const sub = KH_SUBTRACK, hw = sub.width / 2;
  // gravel traps on the outside of the TARMAC corners only (the real Clark's has one); tyre walls on the dirt corners instead
  const traps = [], barriers = [], cones = [];
  const isDirt = (d) => d > KH_D.dirtIn - 5 && d < KH_D.dirtOut + 5;
  for (const c of autoKerbs(sub, { maxR: 45, exitR: 0, minTurn: 35, mergeGap: 15 })) {
    const out = c.side === 'left' ? -1 : 1;
    if (isDirt(c.startDist) && isDirt(c.endDist)) { for (const [x, y] of alongTrack(sub, c.startDist - 5, c.endDist + 15, out * (hw + 4), 0.95)) cones.push({ x, y, kind: 'tyrestack' }); continue; }
    traps.push({ out, d0: c.startDist - 5, d1: c.endDist + 30, pts: alongTrack(sub, c.startDist - 5, c.endDist + 30, out * (hw + 2 + 6), 2), width: 12, surface: SURFACES.gravel });
  }
  const kit = trackKit(sub, 1974, [KH_JOKER, ...traps]);   // Knockhill opened 1974
  const nearRoad = (x, y) => querySubtrack(sub, x, y).dist < hw + 4 || kit.onLane(x, y, 0.6);
  const runs = (pts) => { const out = []; let cur = []; for (const q of pts) { if (nearRoad(q[0], q[1])) { if (cur.length > 1) out.push(cur); cur = []; } else cur.push(q); } if (cur.length > 1) out.push(cur); return out; };
  for (const t of traps) {
    const o = t.out * (hw + 2 + 12 + 2.5);
    for (const r of runs(alongTrack(sub, t.d0, t.d1, o, 2))) barriers.push({ kind: 'armco', pts: r });
    for (const [oo, sh] of [[o - t.out * 1.4, 0], [o - t.out * 2.35, 0.475]]) for (const [x, y] of alongTrack(sub, t.d0 + sh, t.d1, oo, 0.95)) if (!nearRoad(x, y)) cones.push({ x, y, kind: 'tyrestack' });
  }
  const finalCones = cones.filter((c) => querySubtrack(sub, c.x, c.y).dist > hw + 1.2 && !kit.onLane(c.x, c.y, 0.3));
  const props = [
    kit.prop(2, 0, { kind: 'gantry', wid: 24, rot: Math.PI / 2 }),
    kit.prop(khD(470, 390), -28, { kind: 'grandstand', w: 80, h: 9 }),          // the main stand above the start straight (north)
    kit.prop(khD(600, 440), -30, { kind: 'grandstand', w: 34, h: 8 }),          // Duffus Dip
    kit.prop(khD(380, 650), 34, { kind: 'grandstand', w: 30, h: 8 }),           // Clark's
    kit.prop(khD(330, 378), -40, { kind: 'tower', size: 8 }),
    kit.prop(khD(230, 368), -26, { kind: 'board', label: 'KNOBHILL' }), kit.prop(khD(700, 540), -26, { kind: 'board', label: 'KUM TYRES' }),
    ...[[420, 300], [470, 296], [520, 300], [570, 304]].map(([x, y], k) => { const [wx, wy] = khXY(x, y); return { kind: 'truck', x: wx, y: wy, rot: 0.08, col: ['#c8302c', '#2b56b5', '#e2c13a', '#2f7d4f'][k] }; }),   // the paddock (north)
  ];
  for (const c of sub.curvedKerbs) props.push(kit.prop((c.startDist + c.endDist) / 2, (c.side === 'left' ? 1 : -1) * (hw + 28), { kind: 'marshal' }));
  for (let k = 0; k < 600 && props.filter((p) => p.kind === 'tree').length < 110; k++) {   // Fife farmland: trees round the outside, few inside
    const x = (kit.rnd() - 0.5) * 2 * (FLOOR - 12), y = (kit.rnd() - 0.5) * 2 * (FLOOR - 12);
    if ((Math.abs(y) > 120 || Math.abs(x) > 230 || kit.rnd() < 0.15) && kit.clear(x, y, 10)) props.push({ kind: 'tree', x, y, s: 3.5 + kit.rnd() * 3, seed: k });
  }
  // footprint check, as Brands (props on the road were a real bug there)
  const FOOT = { grandstand: (p) => [p.w, p.h], tower: (p) => [p.size, p.size], truck: () => [14, 2.5], marshal: () => [2.4, 2], board: () => [18, 1.2], tree: (p) => [p.s * 0.5, p.s * 0.5] };
  const boxClear = (p) => { const f = FOOT[p.kind]; if (!f) return true; const [w, h] = f(p), c = Math.cos(p.rot || 0), sn = Math.sin(p.rot || 0);
    for (let u = -w / 2 - 1.5; u <= w / 2 + 1.5; u += 1.5) for (let v = -h / 2 - 1.5; v <= h / 2 + 1.5; v += 1.5) { const x = p.x + c * u - sn * v, y = p.y + sn * u + c * v;
      if (querySubtrack(sub, x, y).dist < hw + 0.5 || kit.onLane(x, y, 0) || Math.abs(x) > FLOOR - 4 || Math.abs(y) > FLOOR - 4) return false; }
    return true; };
  const okProps = props.filter((p) => p.kind === 'gantry' || boxClear(p));
  const hills = [
    { kind: 'dip', ...(([x, y]) => ({ x, y }))(khXY(625, 480)), r: 55, d: 3.5 },      // DUFFUS DIP
    { kind: 'hump', ...(([x, y]) => ({ x, y }))(khXY(372, 628)), r: 32, h: 2.2 },     // CLARK'S blind uphill crest
    { kind: 'hump', ...(([x, y]) => ({ x, y }))(khXY(150, 395)), r: 95, h: 4.0 },     // the hairpin on the hill top
  ];
  return {
    id: 'knobhill', name: 'Knobhill', base: SURFACES.grass, subtrack: sub,
    camber: { maxDeg: 2, refR: 60, crown: 0.02, edge: 6, sections: [] },
    zones: [], bumps: prepBumps([...hills, ...kit.bank(khD(560, 402), khD(690, 495), -34, 7, 1.4), ...kit.bank(khD(320, 545), khD(112, 405), 34, 7, 1.3)]),
    paint: [{ kind: 'chequered', x: sub.pts[0].x, y: sub.pts[0].y, len: 1.6, wid: 13, rot: sub.pts[0].heading }],
    boards: [], seams: false, cones: [...finalCones, ...rxDress(sub, [KH_JOKER, ...traps], finalCones, [[KH_D.dirtIn, KH_D.dirtOut]]), ...jokerBales(sub, KH_JOKER, finalCones)],
    lanes: [KH_JOKER, ...traps], joker: KH_JOKER_RULE, barriers, props: okProps, solids: solidsFromProps(okProps),
    spawn: (() => { const p = onTrack(sub, sub.totalDist - 15, 0, {}); return { x: p.x, y: p.y, heading: p.rot }; })(),
  };
})();

// RALLYCROSS DRESSING (user, 2026-10-04: "a couple more hay bales and tyres around Slidden Hill and Knobhill"): knockable HAY BALES every 2.2 m
// along the OUTSIDE of every corner (hw + 4.5), and a 2 x 3 block of TYRE STACKS on each inside apex (hw + 2.5) — kept off the road, every
// lane (joker, start, traps, paddock) and 1.6 m clear of any existing object.
function rxDress(sub, lanes, existing, lined = []) {   // lined: [[d0, d1]] stretches with bales along BOTH sides every 4.4 m
  const hw = sub.width / 2, out = [], have = [...existing];
  const onLane = (x, y) => lanes.some((ln) => ln.pts.some(([ax, ay], i) => { const q = ln.pts[i + 1]; if (!q) return false; const dx = q[0] - ax, dy = q[1] - ay, l2 = dx * dx + dy * dy || 1;
    let t = ((x - ax) * dx + (y - ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(x - ax - dx * t, y - ay - dy * t) <= ln.width / 2 + 1; }));
  const free = (x, y) => querySubtrack(sub, x, y).dist > hw + 1.5 && !onLane(x, y) && Math.abs(x) < FLOOR - 5 && Math.abs(y) < FLOOR - 5 && !have.some((c) => Math.hypot(c.x - x, c.y - y) < 1.6);
  const add = (o) => { if (free(o.x, o.y)) { out.push(o); have.push(o); } };
  for (const c of autoKerbs(sub, { maxR: 60, exitR: 0, minTurn: 25, mergeGap: 10 })) {
    const outS = c.side === 'left' ? -1 : 1, mid = (c.startDist + c.endDist) / 2;
    // ONLY WHERE THERE IS NO WALL YET (user: "they should go where there isn't already Armco and tyre walls" — the first pass lined bales in
    // front of Slidden Hill's tyre walls): skip a bale with an existing tyre stack within 6 m
    for (let d = c.startDist - 6; d <= c.endDist + 10; d += 2.2) { const p = smoothOnTrack(sub, d, outS * (hw + 4.5)); if (existing.some((e) => e.kind === 'tyrestack' && Math.hypot(e.x - p.x, e.y - p.y) < 6)) continue; add({ x: p.x, y: p.y, kind: 'bale', rot: onTrack(sub, ((d % sub.totalDist) + sub.totalDist) % sub.totalDist, 0, {}).rot }); }
    for (const dd of [-1, 0, 1]) for (const w of [0, 1]) { const p = smoothOnTrack(sub, mid + dd * 0.95, -outS * (hw + 2.5 + w * 0.95)); add({ x: p.x, y: p.y, kind: 'tyrestack' }); }
  }
  for (const [d0, d1] of lined) for (let d = d0; d <= d1; d += 4.4) for (const sd of [-1, 1]) { const p = smoothOnTrack(sub, d, sd * (hw + 4.5)); add({ x: p.x, y: p.y, kind: "bale", rot: onTrack(sub, ((d % sub.totalDist) + sub.totalDist) % sub.totalDist, 0, {}).rot }); }
  return out;
}

// JOKER SEPARATION (user, 2026-10-04: "hay bales between the joker section and the normal track on both rallycross tracks — a clear barrier"):
// a line of bales in the MIDDLE of the grass strip between the joker and the main road, every 2.1 m wherever that strip is at least 2.2 m wide
// (so the joker's mouth and exit stay open).
function jokerBales(sub, joker, existing) {
  const hw = sub.width / 2, jw = joker.width / 2, out = [], J = joker.pts;
  let acc = 0;
  for (let i = 1; i < J.length; i++) {
    const [ax, ay] = J[i - 1], [bx, by] = J[i], L = Math.hypot(bx - ax, by - ay);
    for (let t = acc; t < L; t += 2.1) {
      const x = ax + (bx - ax) * t / L, y = ay + (by - ay) * t / L, q = querySubtrack(sub, x, y), gap = q.dist - hw - jw;
      // clear of the main road's KERBS (2.4 m) too: bale centre >= 3.3 m off the road edge and >= 0.9 m off the joker edge (photographed on a kerb)
      if (gap < 4.2) continue;
      const c = onTrack(sub, q.trackDist, 0, {}), dx = c.x - x, dy = c.y - y, dl = Math.hypot(dx, dy) || 1, k = jw + Math.min(gap / 2, gap - 3.3);
      const p = { x: +(x + dx / dl * k).toFixed(2), y: +(y + dy / dl * k).toFixed(2), kind: 'bale', rot: Math.atan2(by - ay, bx - ax) };
      if (![...existing, ...out].some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 1.6)) out.push(p);
    }
    acc = (acc - L) % 2.1; if (acc < 0) acc += 2.1;
  }
  return out;
}

export const LEVELS = [
  {
    id: 'lab', name: 'The Lab',
    coneCount: true,      // show the knocked-cone tally (a cone course)
    // COVERS (2026-10-03): lying ON whatever is under them; see "LAYERED" wear in this file. The ice sheet
    // is over GRASS on purpose — scrub it through and the grass shows, then wears to mud (the user's chain).
    covers: [
      { x: -95, y: -185, w: 60, h: 30, cover: 'ice', shape: 'ellipse' },
      { x: -180, y: -185, w: 50, h: 26, cover: 'snow', shape: 'ellipse' },
      { x: 120, y: 60, w: 16, h: 10, cover: 'wet', shape: 'ellipse', rot: 0.3 },
    ],
    base: SURFACES.lab,
    bounds: LAB_BOUNDS,   // S-B: 520 x 1000 m, the extension south of the old square
    zones: [
      ...LAB_PANELS,
      { x: -FLOOR / 2, y: FLOOR / 2, w: FLOOR, h: FLOOR, surface: SURFACES.lab },      // SW
      { x: FLOOR / 2, y: FLOOR / 2, w: FLOOR, h: FLOOR, surface: SURFACES.tarmac },    // SE
      { x: FLOOR / 2, y: -FLOOR / 2, w: FLOOR, h: FLOOR, surface: SURFACES.gravel },   // NE
      { x: -FLOOR / 2, y: -FLOOR / 2, w: FLOOR, h: FLOOR, surface: SURFACES.grass },   // NW
      // S-B: AFTER the old zones, so the old blend's random stream (and every old patch) is unchanged
      ...LAB_LANE_ZONES, ...LAB_OFFROAD_ZONES,
    ],
    bumps: [...LAB_BUMPS, ...prepBumps(LAB_OFFROAD_BUMPS)],
    paint: [...LAB_PAINT, ...LAB_EXT_PAINT],
    boards: [...LAB_BOARDS, ...LAB_EXT_BOARDS],
    props: [],
    seams: true,
    cones: [
      ...courseCones(),
      ...slalom(-150, 230, 13, 9),
      { x: 30, y: 200 }, { x: 55, y: 215 }, { x: 22, y: 222 },
      { x: 150, y: -10 }, { x: 175, y: -10 },
      ...LAB_CRASH_OBJECTS,   // S-B: every loose object kind, at the ends of the crash lanes
    ],
    spawn: { x: -28.3, y: 28.3, heading: 0 },
  },
  {
    id: 'test-track', name: 'Test Track',
    coneCount: true,      // show the knocked-cone tally (a cone course)
    base: SURFACES.grassShort,
    subtrack: TT_SUBTRACK,
    // CAMBER (user, 2026-10-03): 2% crown on the straights, up to 4 deg of positive camber in the corners (at 40 m radius or
    // tighter). Off-camber sections can be added here as { from, to, deg: -2 } (metres of track distance).
    camber: { maxDeg: 4, refR: 40, crown: 0.02, edge: 6, sections: [] },
    covers: [
      onTrack(TT_SUBTRACK, 250, 2, { w: 9, h: 5, cover: 'wet', shape: 'ellipse' }),     // sweeper, tarmac
      onTrack(TT_SUBTRACK, 740, -2, { w: 7, h: 4, cover: 'wet', shape: 'ellipse' }),    // hairpin, tarmac
      onTrack(TT_SUBTRACK, 580, 0, { w: 14, h: 9, cover: 'ice', shape: 'ellipse' }),    // black ice on the dirt
      onTrack(TT_SUBTRACK, 700, 14, { w: 18, h: 10, cover: 'snow', shape: 'ellipse' }), // drift beside the hairpin
    ],
    zones: TT_ZONES,
    bumps: TT_BUMPS,
    paint: TT_PAINT,
    boards: TT_BOARDS,
    props: [],
    seams: false,
    cones: TT_CONES,
    spawn: { x: -62, y: -96.48, heading: 0.0109 },
  },
  KH_LEVEL,
  BH_GP_LEVEL,
  BH_INDY_LEVEL,
  {
    id: 'sweaty-lamb', name: 'Sweaty Lamb',
    base: SURFACES.grassLong,                 // moorland
    subtrack: SL_SUBTRACK,
    camber: { maxDeg: 0, refR: 60, crown: 0.03, edge: 5, sections: [] },
    zones: [],
    bumps: SL_BUMPS,
    covers: SL_STREAM,
    paint: SL_PAINT,
    boards: [], seams: false, cones: SL_CONES,
    props: SL_PROPS,
    barriers: SL_TAPE,
    solids: solidsFromProps(SL_PROPS),
    lanes: [SL_YARD],
    stage: { finish: SL_FINISH },
    // 6 m behind the START line, facing it: the clock starts as you cross it
    spawn: (() => { const p = onTrack(SL_SUBTRACK, SL_SUBTRACK.totalDist - 6, 0, {}); return { x: p.x, y: p.y, heading: p.rot }; })(),
  },
  {
    id: 'killder', name: 'Killder',
    base: SURFACES.grassLong,                 // forest floor / moorland between the plantations
    subtrack: KD_SUBTRACK,
    camber: { maxDeg: 0, refR: 60, crown: 0.03, edge: 5, sections: [] },
    zones: [],
    bumps: KD_BUMPS,
    covers: KD_WATER,
    paint: KD_PAINT,
    boards: [], seams: false, cones: KD_CONES,
    props: KD_PROPS,
    barriers: KD_TAPE,
    solids: solidsFromProps(KD_PROPS),
    lanes: [KD_YARD],
    stage: { finish: KD_FINISH },
    spawn: (() => { const p = onTrack(KD_SUBTRACK, KD_SUBTRACK.totalDist - 6, 0, {}); return { x: p.x, y: p.y, heading: p.rot }; })(),
  },
  {
    id: 'slidden-hill', name: 'Slidden Hill',
    base: SURFACES.grass,
    subtrack: SH_SUBTRACK,
    camber: { maxDeg: 2, refR: 60, crown: 0.02, edge: 6, sections: [] },
    zones: [],
    bumps: SH_BUMPS,
    paint: [{ kind: 'chequered', x: SH_SUBTRACK.pts[0].x, y: SH_SUBTRACK.pts[0].y, len: 1.6, wid: 14, rot: SH_SUBTRACK.pts[0].heading }],
    boards: [], seams: false,
    lanes: [SH_START, SH_JOKER, SH_PADDOCK],
    joker: SH_JOKER_RULE,
    props: SH_PROPS,
    solids: solidsFromProps(SH_PROPS),
    cones: [...SH_TYREWALL, ...SH_STARTWALL, ...rxDress(SH_SUBTRACK, [SH_START, SH_JOKER, SH_PADDOCK], [...SH_TYREWALL, ...SH_STARTWALL]), ...jokerBales(SH_SUBTRACK, SH_JOKER, [...SH_TYREWALL, ...SH_STARTWALL])],
    barriers: SH_ARMCO.map(([a, b, off]) => ({ kind: 'armco', pts: alongTrack(SH_SUBTRACK, a, b, off, 2) })),
    // on the grid near the dead end of the (moved) start straight, facing the junction
    spawn: (() => { const [p0, p1] = SH_START.pts, x0 = p0[0] + (p1[0] - p0[0]) * 0.08, y0 = p0[1] + (p1[1] - p0[1]) * 0.08; return { x: x0, y: y0, heading: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) }; })(),
  },
  {
    id: 'castle-cum', name: 'Castle Cum',
    base: SURFACES.grass,
    subtrack: CC_SUBTRACK,
    camber: { maxDeg: 3, refR: 70, crown: 0.02, edge: 6, sections: [] },
    zones: CC_ZONES,
    bumps: CC_BUMPS,
    paint: CC_PAINT,
    boards: [],
    props: CC_PROPS,
    seams: false,
    cones: [...CC_TYREWALL, ...[1000, 1012, 1024].map((d, k) => ({ ...CC_KIT.at(d, k % 2 ? 9 : -9), kind: 'tyrestack' }))],
    lanes: CC_LANES,
    solids: solidsFromProps(CC_PROPS),
    barriers: [
      { kind: 'pitwall', pts: alongTrack(CC_SUBTRACK, 1250, 97, -10, 2) },
      { kind: 'line', pts: alongTrack(CC_SUBTRACK, 1255, 92, -15.5, 2) },
      ...CC_ARMCO.map(([a, b]) => ({ kind: 'armco', pts: alongTrack(CC_SUBTRACK, a, b, -16, 2) })),
      { kind: 'fence', pts: alongTrack(CC_SUBTRACK, 1110, 1215, -22, 2) },     // "only a waist high fence" on the Camp bank
    ],
    spawn: (() => { const p = onTrack(CC_SUBTRACK, CC_SUBTRACK.totalDist - 15, 0, {}); return { x: p.x, y: p.y, heading: p.rot }; })(),
  },
  {
    id: 'thruston', name: 'Thruston',
    base: SURFACES.grass,
    subtrack: TH_SUBTRACK,
    // a smooth, fast airfield surface: a gentle crown, up to 3 deg of camber in the corners (Thruxton is FLAT; bumps above)
    camber: { maxDeg: 3, refR: 70, crown: 0.02, edge: 6, sections: [] },
    zones: TH_ZONES,
    bumps: TH_BUMPS,
    paint: TH_PAINT,
    boards: [],
    props: TH_PROPS,
    seams: false,
    cones: TH_CONES,
    // on the grid 15 m BEHIND the line (photographed: at distance 0 the car sat on the chequers)
    spawn: (() => { const p = onTrack(TH_SUBTRACK, TH_SUBTRACK.totalDist - 15, 0, {}); return { x: p.x, y: p.y, heading: p.rot }; })(),
    // the grandstand is solid: an invisible 'building' barrier along its track-side face (obstacles are axis-aligned only)
    barriers: [
      { kind: 'building', pts: alongTrack(TH_SUBTRACK, TH_STAND.d0, TH_STAND.d1, TH_STAND.off + 4.2) },
      { kind: 'building', pts: alongTrack(TH_SUBTRACK, 1093, 1119, -22.6, 2) },
      // pit wall between the track and the lane, only where the lane has fully separated
      { kind: 'pitwall', pts: alongTrack(TH_SUBTRACK, 1201, 25, 10, 2) },
      { kind: 'line', pts: alongTrack(TH_SUBTRACK, 1206, 20, TH_PIT.off - 1.5, 2) },               // the yellow line
      { kind: 'building', pts: alongTrack(TH_SUBTRACK, TH_GAR.d0, TH_GAR.d1, TH_GAR.off - TH_GAR.depth / 2 + 0.3, 2) },
      // ARMCO on the OUTSIDE of the right-handers (an inside offset of a tight corner self-intersects)
      ...TH_ARMCO.map(([a, b]) => ({ kind: 'armco', pts: alongTrack(TH_SUBTRACK, a, b, -16, 2) })),
      // catch fence behind the Armco at Church, where the spectators stand
      { kind: 'fence', pts: alongTrack(TH_SUBTRACK, 780, 875, -22, 2) },
    ],
    lanes: TH_LANES,
    solids: solidsFromProps(TH_PROPS),
  },
  {
    id: 'grass-track', name: 'Grass Track',
    base: SURFACES.grass,
    subtrack: GO_SUBTRACK,
    randomise: () => randomiseGrassTrack(GO_SUBTRACK, GO_SECTORS, GO_RANDOM_PATCHES),   // new random patches every load
    patches: GO_RANDOM_PATCHES,
    covers: [
      onTrack(GO_SUBTRACK, 100, 2, { w: 7, h: 4, cover: 'wet', shape: 'ellipse' }),
      onTrack(GO_SUBTRACK, 300, -3, { w: 9, h: 5, cover: 'wet', shape: 'ellipse' }),
      onTrack(GO_SUBTRACK, 380, 1.5, { w: 6, h: 3.5, cover: 'wet', shape: 'ellipse' }),
    ],
    zones: GO_ZONES,
    bumps: [],
    paint: GO_PAINT,
    boards: GO_BOARDS,
    props: GO_PROPS,
    seams: false,
    cones: [
      { x: 0, y: 0, kind: 'podium' },
      { x: -26, y: -4, kind: 'caravan', rot: 0.16 },
      // Corner apex clipping tyre barriers
      { x: 55, y: 28, kind: 'tyrestack' }, { x: 57, y: 27, kind: 'tyrestack' },
      { x: 55, y: -28, kind: 'tyrestack' }, { x: 57, y: -27, kind: 'tyrestack' },
      { x: -55, y: -28, kind: 'tyrestack' }, { x: -57, y: -27, kind: 'tyrestack' },
      { x: -55, y: 28, kind: 'tyrestack' }, { x: -57, y: 27, kind: 'tyrestack' },
      // Infield caravan protection barrier
      { x: -18, y: -6, kind: 'tyrestack' }, { x: -18, y: -3, kind: 'tyrestack' }, { x: -18, y: 0, kind: 'tyrestack' },
      // Outer tyre wall (2026-10-03): loose stacks 3 m outside the track edge, gapped round the pylons
      ...outerTyreWall(GO_SUBTRACK, { margin: 3, spacing: 1.0, clear: propClearance(GO_PROPS) }),
    ],
    spawn: { x: -4, y: 38, heading: 0 },
    obstacles: [
      { x: 0, y: 66, w: 38, h: 7 }, // Wooden covered grandstand — moved out 10 m (2026-10-02)
    ],
  },
  {
    id: 'stock-car', name: 'Stock Car',
    rollingStart: true,   // races start ROLLING (user, 2026-10-04: the ovals)
    base: SURFACES.grass,
    subtrack: SO_SUBTRACK,
    covers: [
      onTrack(SO_SUBTRACK, 40, -3, { w: 8, h: 4, cover: 'wet', shape: 'ellipse' }),
      onTrack(SO_SUBTRACK, 250, 3, { w: 10, h: 5, cover: 'wet', shape: 'ellipse' }),
      onTrack(SO_SUBTRACK, 470, 0, { w: 6, h: 3, cover: 'wet', shape: 'ellipse' }),
    ],
    zones: SO_ZONES,
    bumps: [],
    paint: SO_PAINT,
    boards: SO_BOARDS,
    props: SO_PROPS,
    seams: false,
    cones: [
      { x: -28, y: 12, kind: 'banger', rot: 0.52 },
      { x: 20, y: -14, kind: 'banger', rot: -0.44 },
      { x: -8, y: -10, kind: 'banger', rot: 2.15 },
      { x: 30, y: 15, kind: 'banger', rot: -1.15 },
      // Continuous infield barrier separating track from wrecked bangers
      { x: -45, y: 36, kind: 'tyrestack' }, { x: -30, y: 36, kind: 'tyrestack' }, { x: 30, y: 36, kind: 'tyrestack' }, { x: 45, y: 36, kind: 'tyrestack' },
      { x: -45, y: -36, kind: 'tyrestack' }, { x: -30, y: -36, kind: 'tyrestack' }, { x: 30, y: -36, kind: 'tyrestack' }, { x: 45, y: -36, kind: 'tyrestack' },
      // Corner apex tyre stacks
      { x: 72, y: 24, kind: 'tyrestack' }, { x: 72, y: -24, kind: 'tyrestack' },
      { x: -72, y: -24, kind: 'tyrestack' }, { x: -72, y: 24, kind: 'tyrestack' },
      // Outer tyre wall (2026-10-03): loose stacks 2 m outside the track edge — 2, not 3, so the wall
      // runs IN FRONT of the sponsor boards (front edge y 60.8) instead of being gapped by 18 m at each
      ...outerTyreWall(SO_SUBTRACK, { margin: 2, spacing: 1.0, clear: propClearance(SO_PROPS) }),
    ],
    spawn: { x: -4, y: 48, heading: 0 },
    obstacles: [
      { x: 18, y: 76, w: 42, h: 7 },    // Grandstand — moved further from the track edge (2026-10-02)
      { x: -14, y: 64, w: 4.4, h: 3.6 }, // Marshal tower / official box
    ],
  },
  {
    id: 'naffcar', name: 'Naffcar Speedway',
    rollingStart: true,   // races start ROLLING (user, 2026-10-04: the ovals)
    base: SURFACES.grassShort,
    subtrack: NC_SUBTRACK,
    zones: NC_ZONES,
    bumps: [],
    paint: NC_PAINT,
    boards: NC_BOARDS,
    props: NC_PROPS,
    bankAngle: 0.31, // ~18 deg banking in the turns
    seams: false,
    cones: [
      // Pit wall impact attenuator crash cushions
      { x: -111, y: 62, kind: 'tyrestack' }, { x: -113, y: 61, kind: 'tyrestack' }, { x: -113, y: 63, kind: 'tyrestack' },
      { x: 111, y: 62, kind: 'tyrestack' }, { x: 113, y: 61, kind: 'tyrestack' }, { x: 113, y: 63, kind: 'tyrestack' },
      // Spare racing tyre sets stacked along pit stalls
      { x: -60, y: 57, kind: 'tyrestack' }, { x: -20, y: 57, kind: 'tyrestack' },
      { x: 20, y: 57, kind: 'tyrestack' }, { x: 60, y: 57, kind: 'tyrestack' },
    ],
    spawn: { x: -4, y: 75, heading: 0 },
    obstacles: [
      { x: 0, y: 62, w: 220, h: 1.4 },  // Solid concrete pit divider wall
      { x: 0, y: 98, w: 180, h: 14 },   // Front stadium grandstand
      { x: 0, y: -98, w: 180, h: 14 },  // Back stadium grandstand
    ],
  },
  {
    id: 'sandbox', name: 'Surface Sandbox',
    base: SURFACES.grassShort,
    subtrack: SB_SUBTRACK,
    covers: SB_COVERS,
    zones: SB_ZONES,
    bumps: SB_BUMPS,
    paint: SB_PAINT,
    boards: SB_BOARDS,
    props: SB_PROPS,
    seams: false,
    cones: SB_CONES,
    spawn: SB_SPAWN,
    obstacles: [{ x: -20, y: 222, w: 60, h: 8 }],   // the grandstand is solid
  },
];

// The ACTIVE level. `let` so the exported binding is live: importers see the switch without anything
// having to be re-plumbed through a setter.
export let LEVEL = LEVELS[0];
export let PAINT = LEVEL.paint;
export let BOARDS = LEVEL.boards;
export let CONES = LEVEL.cones;
export let SPAWN = LEVEL.spawn;
export let ZONES = LEVEL.zones;
export let BUMPS = LEVEL.bumps;
export let PROPS = LEVEL.props || [];

// =============================================================================================
// SURFACE BLENDING AT CHANGE POINTS (user, 2026-10-03: "sections of surfaces should rarely come to abrupt
// changes — a blend area where random patches of the under layer show through and the top layer drags over;
// semi random, greater at the point of blend and lower away from it, so we get a natural gradient").
// Generated as PATCHES (the same mechanism as the Grass Track's spots — real ground: grip, wear, graphics):
//   (a) TRACK SECTOR changes: each side's surface scattered into the other along the road, triangular density
//       peaking at the change point and reaching zero BLEND_W metres away.
//   (b) LOOSE ROAD EDGES (dirt, gravel, grass, mud, sand, snow sectors): the road surface drags out onto the
//       verge and the verge creeps onto the road. Hard (tarmac-family) edges stay crisp, as in reality.
//   (c) NATURAL ZONE EDGES (not the boxed / rounded test pads, which are deliberate man-made panels).
// Kerbs always win (layersAt), so no patch ever covers a kerb. Covers (puddles / snow / ice) are not blended yet.
// FIXED PER LEVEL: a seeded RNG (from the level id), so a level looks the same every load — except levels that
// re-randomise (the Grass Track), whose blend is rolled again with the layout.
export const BLEND_W = 6;          // m from the change point to where the blend fades out
// User, 2026-10-03 (after seeing it): "smaller random patches, and only LOOSE surfaces should move to hard surfaces".
// So patches are 0.4-1.4 m (were 1-3.2 m), twice as many to keep the coverage, and a HARD surface (tarmac family,
// lab floor, wet tarmac) never scatters onto anything — loose ground drags onto hard ground, never the reverse.
export const BLEND_DENSITY = 1.4;  // patches per metre of boundary at the change point
function seededRng(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const tri = (rng) => rng() * rng();      // 0..1, dense near 0: the "greater at the point of blend" falloff
// SQUARES, not circles (user, 2026-10-03, with the pixel-art pass: "make the surface and transitions squares too,
// no circles"): every blend patch is an axis-aligned square of 0.5, 1.0 or 1.5 m on a half-metre world grid.
const SQ_GRID = 0.5;
const snapG = (v) => Math.round(v / SQ_GRID) * SQ_GRID;
function blendPatch(rng, x, y, surface, rot) {
  const w = SQ_GRID * (1 + Math.floor(rng() * 3));
  return { x: snapG(x), y: snapG(y), w, h: w, sq: true, surface, blend: true };
}
function buildBlend(level, rng) {
  const out = [];
  const st = level.subtrack;
  const onRoad = (x, y, pad) => st && querySubtrack(st, x, y).dist < st.width / 2 + pad;
  const inPad = (x, y) => level.zones.some((z) => (z.boxed || z.rounded) && Math.abs(x - z.x) < z.w / 2 + 1 && Math.abs(y - z.y) < z.h / 2 + 1);
  if (st && st.sectors && st.sectors.length > 1) {
    const pts = st.pts, total = st.totalDist, hw = st.width / 2;
    // INTERPOLATED between samples. MEASURED (tools/blendcheck): snapping to the ~4 m sample spacing clumped the
    // patches into 4 m steps — 89 / 1 / 25 / 70 per metre from the change point instead of a smooth falloff.
    const at = (d) => {
      d = ((d % total) + total) % total;
      let i = 0; while (i < pts.length - 1 && pts[i + 1].dist <= d) i++;
      const a = pts[i], b = pts[(i + 1) % pts.length], seg = (b.dist > a.dist ? b.dist : total) - a.dist, k = seg > 0 ? (d - a.dist) / seg : 0;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, nx: a.nx, ny: a.ny, heading: a.heading };
    };
    const secs = st.sectors.slice().sort((a, b) => a.startDist - b.startDist);
    // (a) sector change points
    for (let i = 0; i < secs.length; i++) {
      const A = secs[(i - 1 + secs.length) % secs.length].surface, B = secs[i].surface, d0 = secs[i].startDist;
      if (A === B || d0 <= 0.5) continue;
      const n = Math.round(2 * BLEND_W * BLEND_DENSITY * (st.width / 8));
      for (let k = 0; k < n; k++) {
        const u = (rng() < 0.5 ? -1 : 1) * tri(rng) * BLEND_W;      // signed distance from the change point
        const p = at(d0 + u), off = (rng() - 0.5) * (st.width - 1);
        const bp = blendPatch(rng, p.x + p.nx * off, p.y + p.ny * off, u < 0 ? B : A, p.heading); bp.src = 'change'; out.push(bp);
      }
    }
    // (b) loose road edges
    for (const sc of secs) {
      const S = sc.surface;
      if (S.hard || COVER_IDS[S.id]) continue;
      const end = Math.min(sc.endDist, total);
      for (let d = sc.startDist; d < end; d += 1) {          // 1 m (was 2 m before patches got smaller)
        const p = at(d);
        for (const side of [-1, 1]) {
          // CLEANER SIDES (user, 2026-10-03: "sides of tracks should be a cleaner transition, like real life"): only a
          // thin, sparse fringe of the road material at the edge — was 55% per metre out to ~5 m, plus the verge
          // creeping onto the road (removed).
          if (rng() < 0.18) {                                          // the road drags a little onto the verge
            const off = side * (hw + 0.2 + tri(rng) * 1.5);
            const x = p.x + p.nx * off, y = p.y + p.ny * off;
            if (!onRoad(x, y, -0.2) && !inPad(x, y)) out.push(blendPatch(rng, x, y, S, p.heading));
          }
        }
      }
    }
  }
  // (c) natural zone edges
  for (const z of level.zones) {
    if (z.boxed || z.rounded) continue;
    const edges = [[z.x - z.w / 2, z.y - z.h / 2, 1, 0, 0, -1, z.w], [z.x - z.w / 2, z.y + z.h / 2, 1, 0, 0, 1, z.w],
                   [z.x - z.w / 2, z.y - z.h / 2, 0, 1, -1, 0, z.h], [z.x + z.w / 2, z.y - z.h / 2, 0, 1, 1, 0, z.h]];
    for (const [ex, ey, tx, ty, nx, ny, len] of edges) {
      for (let s = 0.5; s < len; s += 1) {                   // 1 m (was 2 m before patches got smaller)
        const bx = ex + tx * s, by = ey + ty * s;
        // (S-B) a zone laid in a level's EXTENSION (z.ext: beyond the original square) blends there; every other zone keeps the square
        // rule, so the old lab's blend is bit-identical (tools/_labcheck.mjs)
        if (Math.max(Math.abs(bx), Math.abs(by)) > FLOOR - KERB_W - 2 && !(z.ext && edgeOut(bx, by) < -KERB_W - 2)) continue;
        const outer = zoneAt(bx + nx * 1.5, by + ny * 1.5);
        if (outer === z.surface || outer.id === 'kerb') continue;
        for (const [sign, surf] of [[1, z.surface], [-1, outer]]) {     // outward: the zone drags out; inward: the neighbour creeps in
          if (rng() > 0.6) continue;
          const o = sign * (0.3 + tri(rng) * BLEND_W);
          const x = bx + nx * o, y = by + ny * o;
          if (onRoad(x, y, 1.5) || inPad(x, y)) continue;
          out.push(blendPatch(rng, x, y, surf, Math.atan2(ty, tx)));
        }
      }
    }
  }
  return out.filter((p) => !p.surface.hard);      // only loose surfaces travel (user)
}
// Per-level preparation: re-roll random layouts, build (or reuse) the blend, index every patch in the grid.
// SURFACE INCLUSIONS (user, 2026-10-03: "can surfaces have a chance to contain other like surfaces % wise ... keep it proportional
// and realistic"; table APPROVED as proposed). Share of each surface's AREA covered by small patches of a related surface; '@x'
// is a COVER (puddle / snow / ice) rather than a ground patch. Seeded per level (the Grass Track re-rolls with its layout).
// Boxed test panels stay pure (the tyre / wear tools and the player's tests depend on them).
const INCLUDE = {
  gravel: [['sand', 0.08], ['dirt', 0.06]],
  dirt: [['gravel', 0.06], ['mud', 0.05]],
  grass: [['grassLong', 0.10], ['dirt', 0.04], ['mud', 0.02]],
  grassShort: [['grassLong', 0.10], ['dirt', 0.04], ['mud', 0.02]],
  grassLong: [['grassShort', 0.08], ['mud', 0.03]],
  mud: [['thickMud', 0.12], ['@wet', 0.04]],
  thickMud: [['@wet', 0.06]],
  sand: [['gravel', 0.05]],
  broken: [['gravel', 0.06], ['@wet', 0.03]],
  tarmac: [['broken', 0.02]],
  snow: [['@ice', 0.10]],
  ice: [['@snow', 0.10]],
};
// USER, after seeing it (2026-10-03): "it looks awful, too much too often — it should be like 10% of that, and ideally smaller
// patches". So: the same table, but INCL_RATE 0.1 of the patch COUNT the table implies at the original 1.5-5 m size, and the
// patches themselves 0.75-2 m.
const INCL_STEP = 6, INCL_MIN = 0.75, INCL_MAX = 2, INCL_COVER_CAP = 30, INCL_RATE = 0.1, INCL_REF_SIZE = 3.25;
function buildInclusions(level, rng) {
  const patches = [], covers = [];
  // ENDLESS levels (the highway, 100 km a side): the FLOOR-wide 6 m scan below is ~1e9 cells there (MEASURED 2026-10-05: froze the
  // Test Mode menu, ran node out of heap). The road window moves anyway, so no inclusions on an endless level.
  if (level.endless) return { patches, covers };
  // expected patch area: ellipse of w x h, w and h uniform in [MIN, MAX] -> pi/4 x E[w]^2 (independent)
  const ew = (INCL_MIN + INCL_MAX) / 2, patchArea = (Math.PI / 4) * ew * ew, cellArea = INCL_STEP * INCL_STEP;
  const refArea = (Math.PI / 4) * INCL_REF_SIZE * INCL_REF_SIZE;   // the count is set at the original size, then x INCL_RATE
  const boxed = (level.zones || []).filter((z) => z.boxed);
  // hand-placed covers (the lab's ice sheet, puddle and snow features) are test features too: keep the ground under them pure.
  // MEASURED: a long-grass patch under the lab ice sheet broke tools/wearcheck (scrubbed ice exposed long grass, not grass).
  const authored = (level._coversBase || []).map((c) => ({ x: c.x, y: c.y, w: Math.max(c.w, c.h), h: Math.max(c.w, c.h) }));
  const lim = FLOOR - KERB_W - 2;
  for (let x = -lim; x <= lim; x += INCL_STEP) for (let y = -lim; y <= lim; y += INCL_STEP) {
    const px = x + (rng() - 0.5) * INCL_STEP, py = y + (rng() - 0.5) * INCL_STEP;
    if (boxed.some((z) => Math.abs(px - z.x) < z.w / 2 + 3 && Math.abs(py - z.y) < z.h / 2 + 3)) continue;
    if (authored.some((z) => Math.abs(px - z.x) < z.w / 2 + 4 && Math.abs(py - z.y) < z.h / 2 + 4)) continue;
    const base = zoneAt(px, py);
    const list = base && INCLUDE[base.id];
    if (!list) continue;
    let r = rng(), pick = null;
    for (const [id, pct] of list) { const p = INCL_RATE * (pct * cellArea) / refArea; if (r < p) { pick = id; break; } r -= p; }
    if (!pick) continue;
    const w = INCL_MIN + rng() * (INCL_MAX - INCL_MIN), h = INCL_MIN + rng() * (INCL_MAX - INCL_MIN), rot = rng() * Math.PI;
    if (pick[0] === '@') { if (covers.length < INCL_COVER_CAP) covers.push({ x: px, y: py, w, h, rot, cover: pick.slice(1), shape: 'ellipse' }); }
    else {
      // a CLUSTER of 2-3 overlapping squares on the world grid (pixel-art rule: squares, not circles — photographed, smooth
      // ellipses read as a different art style from the Grass Track's square patches). Same expected area as one ellipse.
      const n = 1 + (rng() < 0.6 ? 1 : 0), side = Math.sqrt(patchArea / n) * 1.15;
      for (let k = 0; k < n; k++) {
        const sw = Math.round(side * (0.7 + rng() * 0.6) * 2) / 2, sh = Math.round(side * (0.7 + rng() * 0.6) * 2) / 2;
        const ox = Math.round((px + (rng() - 0.5) * side) * 2) / 2, oy = Math.round((py + (rng() - 0.5) * side) * 2) / 2;
        patches.push({ x: ox, y: oy, w: Math.max(1, sw), h: Math.max(1, sh), sq: true, surface: SURFACES[pick] });
      }
    }
  }
  return { patches, covers };
}
function prepareLevel() {
  prepBarriers(LEVEL);
  if (LEVEL.randomise) { LEVEL.randomise(); LEVEL._blend = null; }
  // ENDLESS levels get NO blend (MEASURED BUG, 2026-10-06, tools/_dirtroad.mjs: the highway's blend was built ONCE, against whatever road
  // window existed at the first setLevel, then cached through every restart / road type / reseed - 8209 long grass / dirt squares, many
  // on the CURRENT carriageway, which then wore to dirt: "dirt in the road on highway levels". Its zone-edge pass also ignores a zone's
  // rotation, and the fields are all rotated.) The highway draws its own verges; inclusions are skipped there for the same reason.
  if (LEVEL.endless) LEVEL._blend = [];
  if (!LEVEL._blend) LEVEL._blend = buildBlend(LEVEL, LEVEL.randomise ? Math.random : seededRng(LEVEL.id));
  // inclusions: built once per level (per layout on a re-randomising level), patches + covers
  if (LEVEL._coversBase === undefined) LEVEL._coversBase = LEVEL.covers || [];
  if (LEVEL.randomise || !LEVEL._incl) { LEVEL.covers = LEVEL._coversBase; LEVEL._incl = buildInclusions(LEVEL, LEVEL.randomise ? Math.random : seededRng(LEVEL.id + ':incl')); }
  LEVEL.covers = [...LEVEL._coversBase, ...LEVEL._incl.covers];
  // KEEP LANES CLEAN (2026-10-04, user: Thruston "pits look messy"): blend + inclusion squares picked on the grass next to a lane
  // overlapped onto it and chewed its edge ragged. Drop any generated patch that reaches a lane (authored LEVEL.patches stay).
  const offLane = (c) => { const r = Math.max(c.w, c.h) / 2 + 1; for (const d of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) if (laneAt(c.x + d[0], c.y + d[1])) return false; return true; };
  const gen = LEVEL.lanes ? [...LEVEL._blend, ...LEVEL._incl.patches].filter(offLane) : [...LEVEL._blend, ...LEVEL._incl.patches];
  LEVEL.allPatches = [...(LEVEL.patches || []), ...gen];
  PATCH_GRID = new Map();
  for (const c of LEVEL.allPatches) {
    const r = Math.max(c.w, c.h) / 2;
    for (let cx = Math.floor((c.x - r) / PATCH_CELL); cx <= Math.floor((c.x + r) / PATCH_CELL); cx++)
      for (let cy = Math.floor((c.y - r) / PATCH_CELL); cy <= Math.floor((c.y + r) / PATCH_CELL); cy++) {
        const k = patchKey(cx, cy), cell = PATCH_GRID.get(k);
        if (cell) cell.push(c); else PATCH_GRID.set(k, [c]);
      }
  }
}

// RALLY TAPE (user, 2026-10-04: "rally tape should be contactable and easy to snap — give it POSTS and tape SECTIONS — a chance to STICK to
// cars; used more liberally and CLOSE to the track edge on rally / rallycross stages"): a tape is a run of light POSTS (loose objects,
// kind 'tapepost', every TAPE_STEP m; cones.js strings the sections between them and snaps them). On every stage / joker level: the old
// red spectator lines become tape, and BOTH sides of every corner get a run close to the edge (inside at half width + 2.5 m, outside
// beyond the dressing at half width + 5.5 m). Pit / painted lines stay lines.
const TAPE_STEP = 4, LANE_CLEAR = 2.5;   // m: tape posts keep this far beyond a road lane's edge
let tapeId = 0;
function tapePass(lv) {
  if (!lv.subtrack || !(lv.stage || lv.joker)) return;
  const runs = [], hw = lv.subtrack.width / 2;
  for (const b of lv.barriers || []) if (b.kind === 'line' && b.col === '#e23b2e') runs.push(b.pts);
  lv.barriers = (lv.barriers || []).filter((b) => !(b.kind === 'line' && b.col === '#e23b2e'));
  for (const c of autoKerbs(lv.subtrack, { maxR: 70, exitR: 0, minTurn: 18, mergeGap: 10 })) {
    if (lv.stage && c.startDist > lv.stage.finish) continue;
    const a = onTrack(lv.subtrack, c.startDist, 0, {}).rot, bb = onTrack(lv.subtrack, c.endDist, 0, {}).rot;
    let t = bb - a; t = Math.atan2(Math.sin(t), Math.cos(t)); const out = t > 0 ? -1 : 1;
    runs.push(alongTrack(lv.subtrack, c.startDist - 15, c.endDist + 15, out * (hw + 5.5), TAPE_STEP), alongTrack(lv.subtrack, c.startDist - 10, c.endDist + 10, -out * (hw + 2.5), TAPE_STEP));
  }
  // ...but NEVER across a ROAD LANE (user, 2026-10-04: "tape covering joker track section entries on Knobhill"): a post within half a lane
  // width + LANE_CLEAR of the joker / RX start / pit / service lane is left out, and the run's idx gap leaves that section open (cones.js
  // strings consecutive idx only). Gravel traps (lanes with an 'out' side) are run-off, not road: tape may cross them.
  const roads = (lv.lanes || []).filter((n) => n.out == null);
  const onRoad = (x, y) => roads.some((n) => { for (let k = 0; k + 1 < n.pts.length; k++) {
    const [ax, ay] = n.pts[k], [bx, by] = n.pts[k + 1], vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L2)); if (Math.hypot(x - ax - t * vx, y - ay - t * vy) < n.width / 2 + LANE_CLEAR) return true; } return false; });
  const posts = [];
  for (const pts of runs) {
    const id = tapeId++;
    pts.forEach(([x, y], i) => { if (querySubtrack(lv.subtrack, x, y).dist > hw + 1.5 && !onRoad(x, y)) posts.push({ x, y, kind: 'tapepost', tape: id, idx: i }); });
  }
  lv.cones = [...(lv.cones || []), ...posts];
}
// CHEVRONS + FLAGS are KNOCKABLE (user, 2026-10-04: "heavy but impactable"): every level's chevron boards and flag poles move from the
// static props (drawn into the scenery, solid until today) into its loose objects (cones.js: mass, topple, slide, lie flat)
function knockPass(lv) {
  const mv = (lv.props || []).filter((p) => p.kind === 'chevron' || p.kind === 'flag'); if (!mv.length) return;
  lv.props = lv.props.filter((p) => !(p.kind === 'chevron' || p.kind === 'flag'));
  lv.cones = [...(lv.cones || []), ...mv.map((p) => ({ x: p.x, y: p.y, kind: p.kind, rot: p.rot || 0, col: p.col }))];
}
// the post-passes every level gets (tape, knockable signs) — exported for generated levels (stagegen.js)
export function finishLevel(lv) { tapePass(lv); knockPass(lv); return lv; }
for (const lv of LEVELS) finishLevel(lv);
// the floor rectangle of the current level (S-B): LEVEL.bounds, else the square +-FLOOR
function applyBounds() {
  setRect(LEVEL.bounds);
}
export function setLevel(id) {
  const next = LEVELS.find((l) => l.id === id);
  if (!next) return LEVEL;
  LEVEL = next;
  // EVERY exported per-level binding must be re-pointed here. MEASURED BUG, 2026-10-03: the PAINT/BOARDS/
  // CONES line was deleted (DeepSeek, 2026-10-02) and every level then drew the lab's 242 cones and paint.
  // Never push() into these arrays either — they are the level's own data, shared across switches.
  PAINT = LEVEL.paint; BOARDS = LEVEL.boards; CONES = LEVEL.cones;
  SPAWN = LEVEL.spawn; ZONES = LEVEL.zones; BUMPS = LEVEL.bumps;
  PROPS = LEVEL.props || [];
  setFloor(LEVEL.floor || 260);   // WORLD SIZE per level (2026-10-05)
  applyBounds();
  prepareLevel();
  natLevel = null;              // natural-ground amplitudes are per layout (the Grass Track re-randomises every load)
  return LEVEL;
}


// Colour language (CLAUDE.md §4: never pick a colour ad hoc).
export const COL = {
  floor: '#f2f2f4',
  floorWarm: '#ececed',
  grid: '#d9d9e2',
  paint: '#b9b9c6',
  kerbA: '#d8d4cc',
  kerbB: '#b9552f',
  cone: '#f26a1b',
  coneBand: '#f4f4f6',
  coneDark: '#b8410c',
  mark: '40,38,42',        // rgb of a skid mark — dark neutral, not black, so overlaps deepen
  ink: '#2a2c33',
  inkSoft: '#7a7d88',
  hud: '#1b1d22',
  hudText: '#e8e8ee',
  warn: '#e8a13a',
  danger: '#d8453c',
  live: '#4cc2a0',
  gravel: '#cfc6b4',       // the gravel trap. Warm and dead-looking against the cold lab floor.
  rally: '#c2b49a',        // rally-stage gravel — a touch browner, so the two read as different things
  rallyGrit: '#a8987c',
  rallyDark: '#8e8066',
  gravelDark: '#a3977f',
  racetarmac: '#2d303a',   // dark competition circuit asphalt (rich contrast against black tyres)
  dirt: '#8a6e50',         // warm earth brown
  dirtGrit: '#74593d',
  dirtDark: '#5d4329',
  tarmac: '#3a3c46',       // authentic dark road asphalt
  tarmacGrit: '#4e505c',
  grassLight: '#93ad72',
  grassLong: '#557239',
  grassLongDark: '#41592a',
  ice: '#cfe2ee', iceSheen: '#eaf4fa',
  snow: '#eef3f8', snowDark: '#d3dde8',
  wet: '#63656e', wetSheen: '#7b7e8a',
  mud: '#6b5644', mudDark: '#57432f',
  broken: '#9b9ca6', brokenDark: '#7e7f89',
  sand: '#ddc99e', sandDark: '#c4ae82',
  outside: '#3c4048',       // beyond the fence: nothing, and it should LOOK like nothing
  grass: '#7e9c5e',
  grassDark: '#6a8850',
  gravelGrit: '#b4a894',
  fence: '#8a8d99',
  fencePost: '#5f626d',
};

// TYRE HEAT SHARE per surface (vehicle.js TYRE_HEAT): hard ground 1, loose ground HEAT_OFFROAD. Here, at the end,
// because the run-off trap surfaces are built after SURFACES. Puddles copy their base's value (surfaceOf).
for (const s of [...Object.values(SURFACES), ...SURFACE_TRAP]) if (s.heatK === undefined) s.heatK = s.hard ? 1 : HEAT_OFFROAD;

// The first level is active from module load without a setLevel() call, so prepare it here — at the END of the
// module, after every const it reads exists (calling it earlier threw "Cannot access tri before initialization").
applyBounds();
prepareLevel();
