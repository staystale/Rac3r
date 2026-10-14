import { RUNOFF_MU, RUNOFF_ROUGH, KERB_MU } from "./bounds.ts";
import type { Mark, Spray, Surface } from "./types.ts";
export type SurfaceId =
  | "lab" | "racetarmac" | "tarmac" | "dirt" | "gravel" | "grass" | "grassShort" | "grassLong"
  | "kerb" | "ice" | "packedSnow" | "snow" | "wet" | "mud" | "thickMud" | "broken" | "concrete"
  | "sand";
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
//           MEASURED AGAINST REALITY, 2026-09-28 (user: "mud and sand seem too hard to drive in"
//           and "should look and be accurate to real life"). These had been tuned by feel, and feel
//           was wrong: mud was 5.2 where published rolling-resistance coefficients for deep mud
//           (Crr 0.10-0.25) give 1.0-2.5 m/s^2, i.e. I had it at 2.1x the realistic MAXIMUM. Sand
//           was 1.5x and gravel 2.3x. Every figure below is now Crr * g from vehicle-engineering
//           references:
//             tarmac 0.010-0.015   gravel road 0.020-0.035   grass 0.050-0.080
//             snow   0.030-0.120   deep mud    0.100-0.250   loose sand 0.150-0.300
//           Mid-band, NOT the top of it, and here is the reason — it is a real coupling I had
//           missed. Ploughing drags on ALL FOUR wheels, but a two-wheel-drive car can only push
//           through ONE axle's share of the weight. At the top of the sand band (2.7 m/s^2) the
//           drag exceeded the traction a RWD hatch could generate (0.5 * mu * longK * g = 2.3
//           m/s^2) and the car could not move AT ALL — which is what the user hit. It survives as
//           an emergent property rather than a rule: 4WD still walks out of sand and mud where 2WD
//           wallows, because it drives through twice the weight against the same drag.
//   rough   m of surface height noise, fed to the suspension. Decides how much the car is working
//           just to stay on the ground, so it is what makes soft springs pay on gravel.
//
// mark is what a wheel leaves behind (read by marks.js, which knows nothing about any of these).
const MARK_GRAVEL: Mark = { rgb: COL_GRAVEL_TRACK, widen: 2.4, alpha: 0.13 };
const MARK_GRASS: Mark = { rgb: COL_GRASS_SCUFF, widen: 1.9, alpha: 0.10 };
const MARK_DIRT: Mark = { rgb: '98,74,52', widen: 2.3, alpha: 0.16 };
const MARK_GRASS_LONG: Mark = { rgb: '76,96,52', widen: 2.1, alpha: 0.14 };
// compressed snow, blue-grey
const MARK_SNOW: Mark = { rgb: '138,152,170', widen: 2.2, alpha: 0.14 };
// deep dark ruts, the clearest of all
const MARK_MUD: Mark = { rgb: '58,42,30', widen: 2.6, alpha: 0.20 };
// THICK MUD's OWN, darker mark (2026-10-07; user: tracks on mud "vanish or morph weirdly as the
// surface gets degraded to thick mud" - "should darken if anything"; tools/_mudtracks.mjs).
// MEASURED: MARK_MUD (58,42,30) IS thick mud's base colour (#3a291d), so on a worn cell the same
// tracks went 11 -> 7 luminance darker than their ground (pass 2 -> 4) and read as the ripple art
// instead. Wetter, darker. 22,14,9 @ 0.26 photographed near-BLACK by pass 6: softened
const MARK_THICK_MUD: Mark = { rgb: '34,23,15', widen: 2.6, alpha: 0.17 };
const MARK_SAND: Mark = { rgb: '176,152,112', widen: 2.5, alpha: 0.14 };
// Wet tarmac is the odd one: a tyre does not darken it, it DRIES it. So the mark is lighter than
// the surface, which is why the trail behind a car on a wet track is the one you can actually see.
export const MARK_WET: Mark = { rgb: '196,199,208', widen: 1.6, alpha: 0.16 };

// SPRAY — what a wheel THROWS UP off a loose surface (user, 2026-09-28: "floor with a loose surface
// like snow mud sand or grass should particle emit and small and kick up dust / dirt / grass /
// snow"). Read by render.ts, which never learns what any of these are; a surface without one throws
// nothing.
//   rgb    colour of the thrown material
//   size   metres, roughly the radius of one clod
//   rate   particles per second per wheel at full chat — what makes dust billow and clods scatter
//   lift   how far it is flung (m/s); heavy clods drop near the car, fine dust drifts
//   life   seconds. Dust hangs; wet spray and mud do not.
//   grow   how much it expands as it ages. Dust blooms, a clod of mud does not.
// MEASURED BUG, 2026-09-28 (photographed): the first set of colours was sampled FROM each surface,
// so the spray came out the same tone as the ground it left and vanished into that ground's own
// grain. A car drifting on gravel at 103 km/h was throwing ~13 particles a frame and you could not
// see one. Thrown material is AIRBORNE — it catches light and reads PALER and hazier than the
// packed surface beneath it, except wet clods which read darker. Pick for contrast against the
// surface, never to match it (CLAUDE.md §4: if the player cannot find it, it does not exist).
const SPRAY_GRAVEL: Spray = { rgb: '222,210,184', size: 0.22, rate: 62, lift: 5.2, life: 0.55,
  grow: 0.60 };
const SPRAY_GRASS:  Spray = { rgb: '152,190,106', size: 0.18, rate: 48, lift: 4.4, life: 0.46,
  grow: 0.22 };
const SPRAY_DIRT:   Spray = { rgb: '190,160,122', size: 0.22, rate: 66, lift: 4.8, life: 0.60,
  grow: 0.70 };
const SPRAY_GRASS_LONG: Spray = { rgb: '136,174,90', size: 0.22, rate: 58, lift: 4.6, life: 0.50,
  grow: 0.28 };
const SPRAY_MUD:    Spray = { rgb: '64,46,30',    size: 0.26, rate: 42, lift: 3.4, life: 0.62,
  grow: 0.10 };
const SPRAY_SAND:   Spray = { rgb: '244,230,200', size: 0.20, rate: 70, lift: 3.8, life: 0.85,
  grow: 0.95 };
const SPRAY_SNOW:   Spray = { rgb: '255,255,255', size: 0.24, rate: 76, lift: 4.8, life: 0.75,
  grow: 0.85 };
export const SPRAY_WET:    Spray = { rgb: '232,238,248', size: 0.15, rate: 54, lift: 3.0,
  life: 0.28, grow: 0.50 };

// RETUNED 2026-09-28 (user: "can the floor styles feel slightly more unique to drive on - grass mud
// and gravel feel too similar"). They WERE too similar, and the reason is instructive: all three
// were built the same way — take grip off, add slip angle, add some drag. Three points on one line
// is one surface with three names.
//
// The fix is to give each a DIFFERENT DOMINANT PROPERTY, so they fail you in different ways:
//   GRAVEL  slidey and FAST. Drag cut 1.1 -> 0.8 and longK raised to 1.30: stones pack under a
//           driven wheel, so you can put the power down and it bites even while the back is
//           out. You carry speed. The thing that beats you is the corner you cannot tighten.
//   GRASS   skatey and FAST. A thin slick layer over hard ground, so it barely ploughs at all (2.0
//           -> 0.4) and its peak comes EARLY (1.60 -> 1.25). You keep your speed and lose your
//           steering — nearer to bumpy ice than to mud. The thing that beats you is that nothing
//           happens when you turn the wheel.
//   MUD     heavy and SLOW. The biggest drag on the board (3.4 -> 5.2) and longK 0.65, so the
//           wheels just churn. You can point it, you simply cannot go anywhere. The thing that
//           beats you is being bogged.
// Measured spread after the change is in tools/surfacecheck.mjs test 5.
//
// longK  — longitudinal grip relative to lateral. Above 1 means a driven wheel finds more bite
//          than a cornering one (loose stones pack, snow compacts); below 1 means it just spins
//          (mud, sand). This is why gravel rewards power and mud swallows it.
// spray  — what the wheels throw up. Read by render.ts, which knows nothing about any of these.
export const SURFACES: Record<SurfaceId, Surface> = {
  // THE LAB FLOOR — the reference. Sealed, polished, dead flat. Every bench number in tools/ was
  // measured on this, so its numbers are 1.0 by definition and must stay that way.
  lab:        { id: 'lab', label: 'LAB FLOOR', mu: 1.00, peakK: 1.00, longK: 1.00, plough: 0,
    rough: 0, mark: null, spray: null, hard: true },
  // RACE TARMAC — closed racing circuit asphalt. Smooth, clean, and high-grip (1.06).
  racetarmac: { id: 'racetarmac', label: 'RACE TARMAC', mu: 1.06, peakK: 1.00, longK: 1.02,
    plough: 0, rough: 0.0005, mark: null, spray: null, hard: true },
  // REAL TARMAC — a public road, not a proving ground. Slightly less grip and slightly textured.
  tarmac:     { id: 'tarmac', label: 'TARMAC', mu: 0.94, peakK: 1.00, longK: 1.00, plough: 0,
    rough: 0.002, mark: null, spray: null, hard: true },
  // DIRT ROAD — between gravel and mud. Packed sub-base with loose top: allows speed, drifts
  // cleanly.
  dirt:       { id: 'dirt', label: 'DIRT ROAD', mu: 0.56, peakK: 2.10, longK: 1.15, plough: 0,
    rough: 0.009, mark: MARK_DIRT, spray: SPRAY_DIRT },
  // RALLY GRAVEL — a loose layer over a hard base. Drivable FAST, and only sideways.
  gravel:     { id: 'gravel', label: 'RALLY GRAVEL', mu: 0.62, peakK: 2.40, longK: 1.30,
    plough: 0.25, rough: 0.012, mark: MARK_GRAVEL, spray: SPRAY_GRAVEL },
  // GRASS / SHORT GRASS — mown grass. Slick skin over hard ground.
  grass:      { id: 'grass', label: 'GRASS', mu: 0.34, peakK: 1.25, longK: 0.85, plough: 0,
    rough: 0.014, mark: MARK_GRASS, spray: SPRAY_GRASS },
  grassShort: { id: 'grassShort', label: 'SHORT GRASS', mu: 0.34, peakK: 1.25, longK: 0.85,
    plough: 0, rough: 0.014, mark: MARK_GRASS, spray: SPRAY_GRASS },
  // LONG GRASS — un-mown pasture. Taller, deeper, more drag and height variation.
  // plough 0.10 -> 0.35 (user, 2026-10-03: "long grass to grab slightly ... until it's driven over
  // enough to become short grass" — 2 passes, BASE_WEAR). MEASURED vs short grass, hatch-fwd /
  // muscle: 0-50 km/h 7.56 -> 8.58 s / 7.70 -> 8.88 s; coasting 50 -> 4 km/h 502 -> 205 m / 469 ->
  // 198 m. (0.10 was 368 m — barely felt; 0.5 / 0.7 tried: 162 / 127 m, 9.2 / 10.2 s — more than
  // "slightly".)
  grassLong:  { id: 'grassLong', label: 'LONG GRASS', mu: 0.36, peakK: 1.30, longK: 0.82,
    plough: 0.35, rough: 0.024, mark: MARK_GRASS_LONG, spray: SPRAY_GRASS_LONG },
  // THE KERB — painted concrete. Hard, so no ploughing; slippery when you are on the paint.
  kerb:       { id: 'kerb', label: 'KERB', mu: KERB_MU, peakK: 1.00, longK: 1.00, plough: 0,
    rough: 0, mark: null, spray: null, hard: true },

  // ---- THE LOW-FRICTION PANELS
  ice:    { id: 'ice', label: 'ICE', mu: 0.12, peakK: 0.70, longK: 1.00, plough: 0, rough: 0.001,
    mark: null, spray: null, coolK: 0.25 },
  // PACKED SNOW (2026-10-04, generated snow stages: a snow road drawn white on white could not be
  // seen): a rolled snow road, blue-grey, mu a little above loose snow; everything else as snow
  packedSnow: { id: 'packedSnow', label: 'PACKED SNOW', mu: 0.36, peakK: 1.90, longK: 1.10,
    plough: 0.6, rough: 0.005, mark: MARK_SNOW, spray: SPRAY_SNOW, coolK: 0.25 },
  snow:   { id: 'snow', label: 'SNOW', mu: 0.32, peakK: 2.00, longK: 1.10, plough: 1.00,
    rough: 0.006, mark: MARK_SNOW, spray: SPRAY_SNOW, coolK: 0.25 },
  wet:    { id: 'wet', label: 'WET TARMAC', mu: 0.72, peakK: 0.95, longK: 0.92, plough: 0,
    rough: 0.002, mark: MARK_WET, spray: SPRAY_WET, hard: true, coolK: 0.18 },
  mud:    { id: 'mud', label: 'MUD', mu: 0.45, peakK: 2.20, longK: 0.85, plough: 1.60, rough: 0.010,
    mark: MARK_MUD, spray: SPRAY_MUD },
  // THICK MUD (user, 2026-10-03: "two types of mud ... mud turns to thick mud"). Same family as
  // mud, but the bog: less grip, driven wheels churn, and it drags harder than mud. SIZED TO THE
  // STALL LINE (see the plough note above): a 2WD car drives through one axle, so RWD traction ~
  // 0.5*mu*longK*g = 1.30 m/s^2, and drag at a crawl is plough*PLOUGH_CRAWL = 1.9*0.55 = 1.05 — 81%
  // of it. Bogged, never stuck dead. (First cut was mu 0.36 / longK 0.60 / plough 3.4: 1.87 drag vs
  // 1.06 traction = a RWD car cannot move.)
  thickMud: { id: 'thickMud', label: 'THICK MUD', mu: 0.38, peakK: 2.40, longK: 0.70, plough: 1.90,
    rough: 0.018, mark: MARK_THICK_MUD, spray: SPRAY_MUD },
  broken: { id: 'broken', label: 'BROKEN TARMAC', mu: 0.86, peakK: 1.00, longK: 1.00, plough: 0,
    rough: 0.022, mark: null, spray: null, hard: true },
  // CONCRETE (2026-10-03, roadmap B1: airfield runways, pit lanes, paddocks). A touch less grip
  // than good tarmac, smooth, hard.
  concrete: { id: 'concrete', label: 'CONCRETE', mu: 0.90, peakK: 1.00, longK: 1.00, plough: 0,
    rough: 0.004, mark: null, spray: null, hard: true },
  sand:   { id: 'sand', label: 'SAND', mu: 0.55, peakK: 2.20, longK: 0.92, plough: 1.90,
    rough: 0.008, mark: MARK_SAND, spray: SPRAY_SAND },
};
// TYRE COOLING by surface (2026-10-03): hard surfaces (above) do not cool tyres; everything loose
// or cold does. coolK is 1/s toward ambient, on top of the always-on cooling in vehicle.js. Stated
// where it matters (wet, snow, ice); every other non-hard surface gets OFFROAD_COOL here, so a new
// surface cannot silently skip it. Cold and wet ground pulls heat out faster (user, 2026-10-03):
// snow / ice 0.25, puddles 0.20, wet tarmac 0.18, thick mud 0.12, mud 0.10; dry loose ground
// (grass, dirt, gravel, sand) OFFROAD_COOL.
const OFFROAD_COOL = 0.06;
SURFACES.mud.coolK = 0.10; SURFACES.thickMud.coolK = 0.12;
for (const surface of Object.values(SURFACES))
  if (!surface.hard && surface.coolK === undefined) surface.coolK = OFFROAD_COOL;
// what a car spawns on by default; what a car spawns on; kept under the old name
export const SURFACE_TARMAC = SURFACES.lab;

// THE GRAVEL TRAP is a different thing from rally gravel, and both exist. A trap is DEEP gravel
// whose entire job is to stop you: five times the ploughing, and GRADED — shallow pea gravel at the
// lip, deep stuff at the barrier — so the further in you go the harder it grabs. That grading is
// what makes a half-spin at the edge survivable and a flat-out excursion not.
// m/s^2 at the lip. 0.51 g, rising to 0.76 g at the barrier — the band real FIA gravel traps
// are designed to. A TRAP is far deeper than any rally road, which is why this is ~8x the
// gravel figure.
export const RUNOFF_PLOUGH = 5.0;
export const RUNOFF_GRADE = 1.5;     // multiplier at the fence
// built once at load, indexed by depth: groundAt never allocates
export const TRAP_STEPS = 12;
export const SURFACE_TRAP: Surface[] = Array.from({ length: TRAP_STEPS }, (unused, i) => ({
  id: 'trap', coolK: 0.06, mu: RUNOFF_MU, peakK: 2.00, rough: RUNOFF_ROUGH, mark: MARK_GRAVEL,
  plough: RUNOFF_PLOUGH * (1 + (RUNOFF_GRADE - 1) * (i / (TRAP_STEPS - 1))),
}));

// GRASS VERGE between the kerb and the trap, which is how real circuits are built: you get a strip
// of grass to gather it up on before the gravel takes the decision away from you.
export const VERGE_W = 9;

