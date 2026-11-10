import type { Loose } from './coneTypes.ts';
import { hash2d } from '../core/random.ts';
// cones/coneConsts.ts: the tuning constants, the roadside debris table and the tyre-stack burst
// shared by the cone, tyre and loose-object simulation (cones.ts and the files beside this one).

export const CONE_R = 0.20;         // metres base radius
export const DRAG = 2.9;            // exponential velocity decay per second
export const SPIN_DRAG = 4.0;       // spin decays a bit faster than translation
export const RESTITUTION = 0.45;    // bounciness along the contact normal
export const REST_V = 0.05;         // m/s to snap to zero
// m/s a tyre sliding flat stops at: a pile-up's tyres crept at 0.05-0.25 m/s for ~0.4 s more
// each, all paired a step (tools/crashbench.mjs: 50-215 of them from 2.5 s on); it stops ~6 cm
// short of where it would have
export const SLEEP_V = 0.25;
// moving loose objects above which a tyre stack hit hard holds together instead of bursting: a
// 20-car pile-up burst 300 stacks into ~900 tyres, all moving at once
export const BURST_CROWD = 400;

/**
 * Whether a stack hit hard enough to burst may burst now.
 * @param movingNow how many loose objects moved in the last step
 * @returns true while the crowd is under BURST_CROWD
 */
export const mayBurst = (movingNow: number) => movingNow < BURST_CROWD;

// a stack bursts by chance, the likelier the harder it is hit (owner 11-08: "a chance for tyre
// stacks to burst ... harder impact the more likely"): m/s of the hit below which it never bursts,
// and from which it always does (3.8 m/s, the old sure line, is ~1 in 5)
export const BURST_LOW_V = 2.5, BURST_SURE_V = 9;
// kg a tyre of a stack weighs (the 3-high stack was 38 kg)
const STACK_TYRE_KG = 38 / 3;
// each stack's height, by where it stands (the same every time the level loads)
const stackHash = hash2d(0x57ac);

/**
 * Whether a stack hit this hard bursts.
 * @param rel the hit's closing speed, m/s
 * @returns true when it bursts (by chance between BURST_LOW_V and BURST_SURE_V)
 */
export function stackBursts(rel: number): boolean {
  const chance = (rel - BURST_LOW_V) / (BURST_SURE_V - BURST_LOW_V);
  return chance >= 1 || (chance > 0 && Math.random() < chance);
}

/**
 * A level's tyre stack made 1-4 tyres high (owner 11-08: "stacks should vary between 1-4 high"),
 * weighing its tyres; one tyre high is a tyre lying flat.
 * @param stack the stack, as the level placed it
 */
export function heightenStack(stack: Loose): void {
  const tyres = 1 + Math.floor(stackHash(Math.round(stack.x * 10), Math.round(stack.y * 10))
    * 4);
  if (tyres === 1) {
    stack.kind = 'tyre'; stack.mode = 'flat'; stack.mass = 12; stack.r = 0.42;
    return;
  }
  stack.tyres = tyres;
  stack.mass = STACK_TYRE_KG * tyres;
}
export const TOPPLE_V = 0.8;        // m/s hit needed to knock a cone flat
export const MAX_CONE_V = 32;       // clamp fling speed

/** One kind of roadside debris: mass kg, radius m, hits to break (0 never), what it breaks into. */
export interface DebrisKind {
  mass: number; r: number; breaks: number; into?: string; flat?: boolean;
}

// A stack hit hard enough comes apart: it becomes one ROLLING tyre and throws out two more — one
// cartwheeling left, one skidding flat right. Used by the car hitting a stack AND by
// any other object hitting one, so a tyre flung into the wall bursts the stack it lands on.
/**
 * Burst a tyre stack into one rolling tyre plus the rest of its tyres thrown, pushed onto `out`
 * (a stack of 3: two - one cartwheeling left, one skidding flat right; a 4-high also
 * one skidding on ahead, its 2-high only the left one).
 * @param stack the stack (becomes the rolling tyre)
 * @param out receives the new tyres
 */
export function burstStack(stack: Loose, out: Loose[]): void {
  const thrown = (stack.tyres ?? 3) - 1;
  stack.kind = 'tyre';
  stack.mode = 'roll';
  stack.mass = 12;
  stack.r = 0.42;
  stack.down = 0;
  stack.tyres = undefined;
  const baseAng = Math.atan2(stack.vy, stack.vx);
  const spHit = Math.hypot(stack.vx, stack.vy);
  const angL = baseAng + 0.55, angR = baseAng - 0.55;
  // _s: the road distance it belongs to (streamed levels drop it with that stretch of road)
  const common = {
    kind: 'tyre', hx: stack.hx, hy: stack.hy, moved: true, mass: 12, r: 0.42, hitCount: 1,
        wobblePhase: 0, wobbleAmp: 0, rollDist: 0, _s: stack._s
  };
  out.push({ ...common, mode: 'flip', x: stack.x + Math.cos(angL) * 0.45, y: stack.y
      + Math.sin(angL) * 0.45,
    vx: Math.cos(angL) * spHit * 0.90, vy: Math.sin(angL) * spHit * 0.90, ang: angL,
    spin: (Math.random() - 0.5) * 6, down: 0.5, flipPhase: 0, flipSpeed: 14 + Math.random() * 8 });
  if (thrown < 2) return;
  out.push({ ...common, mode: 'flat', x: stack.x + Math.cos(angR) * 0.45, y: stack.y
      + Math.sin(angR) * 0.45,
    vx: Math.cos(angR) * spHit * 0.85, vy: Math.sin(angR) * spHit * 0.85, ang: angR,
    spin: (Math.random() - 0.5) * 12, down: 1.0, flipPhase: 0, flipSpeed: 0 });
  if (thrown < 3) return;
  out.push({ ...common, mode: 'flat', x: stack.x + Math.cos(baseAng) * 0.9, y: stack.y
      + Math.sin(baseAng) * 0.9,
    vx: Math.cos(baseAng) * spHit * 0.7, vy: Math.sin(baseAng) * spHit * 0.7, ang: baseAng,
    spin: (Math.random() - 0.5) * 8, down: 1.0, flipPhase: 0, flipSpeed: 0 });
}

// OBJECT-OBJECT COLLISIONS (requirement: tyres should hit other tyres and cones or objects etc and
// pass impact onto them if necessary). Every object is a circle of radius r and mass m.
// Only objects that are MOVING are tested — a wall of 600 stacks at rest costs nothing — each
// against the whole list with a cheap box reject (see collideObjects for why not a spatial hash).
// Response is a standard impulse along the contact normal with restitution, split by inverse mass,
// plus positional correction so objects never sit inside each other. Consequences match the car
// path: a stack hit hard bursts, a cone hit hard topples, everything hit counts as knocked (moved)
// for the tally, and hard hits throw dust.
export const OBJ_REST: Record<string, number> = {
  cone: 0.45, tyre: 0.35, tyrestack: 0.25, bale: 0.08, sheep: 0.2, cow: 0.1,
};
// BALE: 250 kg (a real round bale is 250-350), r 0.8. A hit above BALE_BURST_V bursts it: a flat
// patch of STRAW (no longer solid), a big straw-dust cloud, and the car loses BALE_DRAG of its
// speed on top of the momentum it gave the bale.
export const BALE_BURST_V = 5, BALE_DRAG = 0.22;   // restitution by kind; heavy props 0.15

// what TOPPLES when hit (cones; and since rally CHEVRON boards, 45 kg on their posts,
// and FLAG poles, 12 kg — (requirement: heavy but impactable), they had been solid walls, then
// pass-through)
export const TOPPLES = new Set(['cone', 'chevron', 'flag', 'tapepost']);
// ROADSIDE DEBRIS (requirement: pallets, boxes, crates, wheelie bins, sandbags, barrels, exhaust /
// bumper, tarps; some should BREAK or become DRIVE-OVERABLE after a hit or two, as logic says per
// object): mass kg, r m, hits to break (0 = never: it slides), and what it breaks INTO (a flat,
// drive-over patch, like the burst bale's straw). Placed by highway.ts LITTER (the density
// slider).
export const DEBRIS: Record<string, DebrisKind> = {
  pallet:   { mass: 20, r: 0.6, breaks: 1, into: 'splinters' },   // snaps first hit
  box:      { mass: 4,  r: 0.4, breaks: 1, into: 'cardboard' },   // flattened
  crate:    { mass: 30, r: 0.55, breaks: 2, into: 'splinters' },
  bin:      { mass: 15, r: 0.4, breaks: 0 },                       // a wheelie bin just tumbles
  sandbag:  { mass: 25, r: 0.45, breaks: 2, into: 'sand' },        // splits on the second
  barrel:   { mass: 18, r: 0.42, breaks: 0 },                       // rolls away
  exhaust:  { mass: 6,  r: 0.5, breaks: 0 },                        // a lost exhaust: skitters
  bumper:   { mass: 8,  r: 0.8, breaks: 0 },
  // a crashed car's own parts (world/debris.ts), in its paint
  wing:     { mass: 6,  r: 0.6, breaks: 0 },
  panel:    { mass: 7,  r: 0.65, breaks: 0 },
  // a bad crash's bits (world/debris.ts bigParts) - a bonnet and a boot lid are big flat
  // panels, a wing / spoiler and a mirror light, the wishbone and strut steel, the engine an iron
  // block (a cow's worth to hit)
  bonnet:   { mass: 14, r: 0.75, breaks: 0 },
  boot:     { mass: 10, r: 0.6, breaks: 0 },
  spoiler:  { mass: 5,  r: 0.6, breaks: 0 },
  mirror:   { mass: 1,  r: 0.15, breaks: 0 },
  wishbone: { mass: 4,  r: 0.35, breaks: 0 },
  strut:    { mass: 7,  r: 0.35, breaks: 0 },
  // a drive shaft: a steel bar with a joint each end
  shaft:    { mass: 6,  r: 0.4, breaks: 0 },
  engine:   { mass: 140, r: 0.55, breaks: 0 },
  // always flat: you drive over it (it drags off with you)
  tarp:     { mass: 3,  r: 0.9, breaks: 0, flat: true },
  // a torn catch fence's shreds (world/armcodent.ts): a scrap of mesh (it lands flat:
  // world/debris.ts), a post is steel
  mesh:     { mass: 3,  r: 0.6, breaks: 0 },
  fencepost: { mass: 9, r: 0.35, breaks: 0 },
  // a torn wooden fence's (world/armcodent.ts): a rail, snapping into splinters when hit again,
  // a post, and a bit of wood
  woodrail: { mass: 8, r: 0.9, breaks: 1, into: 'splinters' },
  woodpost: { mass: 7, r: 0.3, breaks: 1, into: 'splinters' },
  woodchip: { mass: 1, r: 0.2, breaks: 0 },
  // Deaf Valley's cacti (highway/canyon.ts; owner 11-09: "cactus should be destructible but high
  // puncture chance"): a saguaro and a small barrel cactus snap at the first hit into a flat patch
  // of spiny pulp (physics/punctures.ts: their spines)
  cactus:   { mass: 150, r: 0.5, breaks: 1, into: 'pulp' },
  barrelcactus: { mass: 20, r: 0.35, breaks: 1, into: 'pulp' },
  // TUMBLEWEED (?desertjunk=1): a dry ball of brush, bursting at the first hit into twigs
  tumbleweed: { mass: 4, r: 0.7, breaks: 1, into: 'twigs' },
};
export const BROKEN = new Set(['splinters', 'cardboard', 'sand', 'fluff', 'pulp', 'twigs']);
// a TUMBLEWEED (?desertjunk=1) lies snagged until a car comes within TUMBLE_WAKE_M, then a gust
// takes it: it eases to its breeze (Loose.wind) at TUMBLE_EASE /s, the breeze rising and falling
// by TUMBLE_GUST of itself, and rolls on across the desert, never at rest
export const TUMBLE_WAKE_M = 140, TUMBLE_EASE = 1.5, TUMBLE_GUST = 0.35;
// ANIMALS (S-C; (requirement: Can we make Cows and sheep impactable ? Sheep can be like a tyres
// impact weight but burst into white particles / [cows] should stay solid and be heavier more like
// hay bails impact weight); Q5: "no gore... sheep should explode into white fluff over like 30mph
// ... cows tip over 40mph"). A SHEEP is 12 kg (a tyre): hit above SHEEP_POP_V it bursts into FLUFF
// (a drive-over patch + a white cloud, render.ts). A COW is 250 kg (a bale) and stays solid: hit
// above COW_TIP_V it TIPS onto its side (still solid).
export const SHEEP_POP_V = 13.4, COW_TIP_V = 17.9;   // m/s = 30 / 40 mph
// RALLY TAPE: a SECTION between two consecutive posts of one tape snaps when a car crosses it (>
// TAPE_SNAP_V) or its posts are pulled apart (> 1.8 x its rest length); a snapped section sticks to
// that car with TAPE_STICK chance (render.ts trails it as a streamer)
export const TAPE_SNAP_V = 1.5, TAPE_STICK = 0.45;
// ...and it GOES (requirement: tape should vanish into a cloud of particles after multiple hits):
// the snap is hit 1; the next distinct hit (a car through the gap again, >= TAPE_REHIT s later, or
// its posts torn further apart) is hit TAPE_GONE: the stubs vanish and a PUFF is queued
// for render.ts (red / white flecks)
export const TAPE_GONE = 2, TAPE_REHIT = 0.5;
