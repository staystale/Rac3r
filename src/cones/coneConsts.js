// cones/coneConsts.js: the tuning constants, the roadside debris table and the tyre-stack burst
// shared by the cone, tyre and loose-object simulation (cones.js and the files beside this one).

export const CONE_R = 0.20;         // metres base radius
export const DRAG = 2.9;            // exponential velocity decay per second
export const SPIN_DRAG = 4.0;       // spin decays a bit faster than translation
export const RESTITUTION = 0.45;    // bounciness along the contact normal
export const REST_V = 0.05;         // m/s to snap to zero
export const TOPPLE_V = 0.8;        // m/s hit needed to knock a cone flat
export const MAX_CONE_V = 32;       // clamp fling speed

// A stack hit hard enough comes apart: it becomes one ROLLING tyre and throws out two more — one
// cartwheeling left, one skidding flat right. Used by the car hitting a stack AND by
// any other object hitting one, so a tyre flung into the wall bursts the stack it lands on.
/**
 * Burst a tyre stack into one rolling tyre plus two thrown tyres pushed onto `out`.
 * @param {any} stack the stack (becomes the rolling tyre)
 * @param {any[]} out receives the two new tyres
 */
export function burstStack(stack, out) {
  stack.kind = 'tyre';
  stack.mode = 'roll';
  stack.mass = 12;
  stack.r = 0.42;
  stack.down = 0;
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
  out.push({ ...common, mode: 'flat', x: stack.x + Math.cos(angR) * 0.45, y: stack.y
      + Math.sin(angR) * 0.45,
    vx: Math.cos(angR) * spHit * 0.85, vy: Math.sin(angR) * spHit * 0.85, ang: angR,
    spin: (Math.random() - 0.5) * 12, down: 1.0, flipPhase: 0, flipSpeed: 0 });
}

// OBJECT-OBJECT COLLISIONS (requirement: tyres should hit other tyres and cones or objects etc and
// pass impact onto them if necessary). Every object is a circle of radius r and mass m.
// Only objects that are MOVING are tested — a wall of 600 stacks at rest costs nothing — each
// against the whole list with a cheap box reject (see collideObjects for why not a spatial hash).
// Response is a standard impulse along the contact normal with restitution, split by inverse mass,
// plus positional correction so objects never sit inside each other. Consequences match the car
// path: a stack hit hard bursts, a cone hit hard topples, everything hit counts as knocked (moved)
// for the tally, and hard hits throw dust.
export const OBJ_REST = {
  cone: 0.45, tyre: 0.35, tyrestack: 0.25, bale: 0.08, sheep: 0.2, cow: 0.1,
};
// BALE: 250 kg (a real round bale is 250-350), r 0.8. A hit above BALE_BURST_V bursts it: a flat
// patch of STRAW (no longer solid), a big straw-dust cloud, and the car loses BALE_DRAG of its
// speed on top of the momentum it gave the bale.
export const BALE_BURST_V = 5, BALE_DRAG = 0.22;   // restitution by kind; heavy props 0.15
// m/s relative speed that bursts a stack (same threshold as the car)
export const STACK_BURST_V = 3.8;

// what TOPPLES when hit (cones; and since rally CHEVRON boards, 45 kg on their posts,
// and FLAG poles, 12 kg — (requirement: heavy but impactable), they had been solid walls, then
// pass-through)
export const TOPPLES = new Set(['cone', 'chevron', 'flag', 'tapepost']);
// ROADSIDE DEBRIS (requirement: pallets, boxes, crates, wheelie bins, sandbags, barrels, exhaust /
// bumper, tarps; some should BREAK or become DRIVE-OVERABLE after a hit or two, as logic says per
// object): mass kg, r m, hits to break (0 = never: it slides), and what it breaks INTO (a flat,
// drive-over patch, like the burst bale's straw). Placed by highway.js LITTER (the density
// slider).
export const DEBRIS = {
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
  // always flat: you drive over it (it drags off with you)
  tarp:     { mass: 3,  r: 0.9, breaks: 0, flat: true },
};
export const BROKEN = new Set(['splinters', 'cardboard', 'sand', 'fluff']);
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
