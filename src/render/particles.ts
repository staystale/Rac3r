// The PARTICLES layer of the renderer: thrown material - puffs, spray, smoke, paint chips and
// sparks. createParticles owns the pools and returns the add / draw entry points.
import { SPRITE_PPM, fxRandom } from "./shared.ts";
import type { Spray } from "../world/types.ts";
import type { Cam, Chip, ParticleCar, Puff, PuffHit, RenderMarks, View } from "./types.ts";

// what createParticles destructures from the renderer
interface ParticleHelpers {
  PPMz: () => number;
  toScreenX: (wx: number) => number;
  toScreenY: (wy: number) => number;
}

// one damage event of a car
interface DmgEvent {
  scrape?: boolean; amt: number; c: number; metal?: boolean; aim?: number; speed?: number;
}

// the mutable values the particle layer keeps between frames
interface ParticleState {
  puffs: Puff[];
  // WHEEL SPRAY keeps a fractional remainder, because a rate below one particle per frame must
  // still emit at the right average rather than rounding to nothing.
  sprayDebt: number;
  smokeDebt: number;
  // PAINT CHIPS: capped, oldest dropped (§4)
  chips: Chip[];
  // SPARKS: their own pool, drawn on the screen canvas above the cars (drawSparksOnScreen)
  sparks: Chip[];
}

// what the moved functions share
interface ParticleCtx {
  view: View;
  cam: Cam;
  PPMz: () => number;
  toScreenX: (wx: number) => number;
  toScreenY: (wy: number) => number;
  state: ParticleState;
}

// ---------------------------------------------------------------- thrown material
// Wall clock (rule 5): something the player WATCHES must not complete inside one frame.
//
// One pool serves both the cone puffs and the wheel spray. WHAT gets thrown is entirely the
// SURFACE's business - colour, size, rate, how far it is flung, how long it hangs and how much it
// blooms all come off `surface.spray`. This file never learns what snow is, which is the same
// seam the marks layer uses.
// raised from 40: four wheels throwing continuously needs the headroom
const MAX_PUFFS = 220;
const MAX_CHIPS = 400;
const MAX_SPARKS = 600;

// Cone hits: the same pool, with a fixed pale dust.
const CONE_DUST = { rgb: '185,178,164', size: 0.18, lift: 2.2, life: 0.45, grow: 0.55 };
// a burst BALE throws a big slow straw-coloured cloud
const BALE_DUST = { rgb: '214,190,128', size: 0.55, lift: 1.6, life: 1.4, grow: 1.1 };
// a popped SHEEP (S-C): a white FLUFF cloud, no gore
const FLUFF_PUFF = { rgb: '248,247,240', size: 0.5, lift: 3.2, life: 1.5, grow: 1.0 };

// TYRE SMOKE. Each tyre over SMOKE_T that is also slipping puffs white-grey smoke at a rate set by
// how hot and how hard - the silent twin of a squeal (CLAUDE.md §4).
const SMOKE_T = 115;
const SMOKE = { rgb: '225,225,230', size: 0.45, lift: 0.9, life: 1.3, grow: 1.9 };
// a badly hit front (damage.ts wreck.smoke) trails grey smoke from the nose - the silent twin of
// a damaged engine
const DSMOKE = { rgb: '120,120,128', size: 0.5, lift: 0.7, life: 1.1, grow: 1.6 };

/**
 * Throw one puff into the pool, dropping the oldest when it is full.
 * @param ctx particle context
 * @param x world x
 * @param y world y
 * @param vx source velocity x
 * @param vy source velocity y
 * @param spray what is thrown (colour, size, lift, life, grow)
 * @param scale multiplier on the fling speed
 */
function emitPuff(
  ctx: ParticleCtx, x: number, y: number, vx: number, vy: number,
  spray: Omit<Spray, "rate">, scale: number,
) {
  const puffs = ctx.state.puffs;
  if (puffs.length >= MAX_PUFFS) puffs.shift();          // cap; drop the oldest (§4)
  const angle = fxRandom() * 6.2832;
  const fling = spray.lift * scale * (0.35 + fxRandom() * 0.65);
  puffs.push({
    x, y, age: 0,
    life: spray.life * (0.7 + fxRandom() * 0.6),
    r0: spray.size * (0.7 + fxRandom() * 0.7),
    grow: spray.grow, rgb: spray.rgb,
    // thrown BACKWARDS off the contact patch plus a scatter, so it trails the car instead of
    // sitting under it - material is flung opposite to the way the wheel is travelling
    vx: -vx * 0.28 + Math.cos(angle) * fling,
    vy: -vy * 0.28 + Math.sin(angle) * fling,
  });
}

/**
 * Emit the puffs for this frame's cone, bale and sheep hits.
 * @param ctx particle context
 * @param hits the hits to turn into puffs
 */
function addPuffsTo(ctx: ParticleCtx, hits: PuffHit[]) {
  for (const hit of hits) {
    if (hit.kind === 'fluff') { for (let i = 0; i < 5; i++) emitPuff(ctx, hit.x, hit.y,
      (fxRandom() - 0.5) * 4, (fxRandom() - 0.5) * 4, FLUFF_PUFF, 1); continue; }
    if (hit.kind === 'bale') { for (let i = 0; i < 4; i++) emitPuff(ctx, hit.x, hit.y,
      (fxRandom() - 0.5) * 3, (fxRandom() - 0.5) * 3, BALE_DUST, 1); continue; }
    const count = Math.min(3, 1 + Math.floor(hit.speed / 6));
    for (let i = 0; i < count; i++) emitPuff(ctx, hit.x, hit.y, 0, 0, CONE_DUST, 1);
  }
}

/**
 * WHEEL SPRAY. The rate rises with how hard the wheels are actually WORKING - rolling speed plus
 * any slipping - so cruising over gravel ticks along quietly and a slide throws a rooster tail.
 * @param ctx particle context
 * @param car the car
 * @param marks the marks layer (wheel positions)
 * @param wallDt wall-clock frame time
 */
function emitSpray(ctx: ParticleCtx, car: ParticleCar, marks: RenderMarks, wallDt: number) {
  const state = ctx.state;
  // each wheel throws what is under IT (marks.js wheelsOf: world/wear.ts stepWear's sample)
  const wheels = marks.wheelsOf(car);
  let rate = 0;
  for (const wheel of wheels) rate += wheel.spray ? wheel.spray.rate / 4 : 0;
  if (!rate) { state.sprayDebt = 0; return; }
  const speed = Math.hypot(car.vx, car.vy);
  if (speed < 1.5) { state.sprayDebt = 0; return; }
  const slip = Math.max(car.t.slipSpeedF, car.t.slipSpeedR);
  const work = Math.min(1, speed / 26) * 0.55 + Math.min(1, slip / 9) * 0.75;
  // airborne wheels throw nothing - there is nothing under them to throw
  const grounded = Math.max(0, Math.min(1, (car.t.loadKF + car.t.loadKR) / 2));
  state.sprayDebt += rate * work * grounded * wallDt;
  let count = Math.floor(state.sprayDebt);
  state.sprayDebt -= count;
  // never let a frame spike flood the pool
  if (count > 12) count = 12;
  for (let i = 0; i < count; i++) {
    const wheel = wheels[(fxRandom() * 4) | 0];
    if (wheel.spray) emitPuff(ctx, wheel.x, wheel.y, car.vx, car.vy, wheel.spray, 0.4 + work);
  }
}

/**
 * Puff white-grey smoke from every hot, slipping tyre.
 * @param ctx particle context
 * @param car the car
 * @param marks the marks layer (wheel positions)
 * @param wallDt wall-clock frame time
 */
function emitTyreSmoke(ctx: ParticleCtx, car: ParticleCar, marks: RenderMarks, wallDt: number) {
  const state = ctx.state;
  if (!car.tyreT) return;
  const wheels = marks.wheelsOf(car);
  for (const wheel of wheels) {
    if (wheel.heat < SMOKE_T || wheel.slip < 1.5) continue;
    state.smokeDebt += Math.min(1, (wheel.heat - SMOKE_T) / 40 + 0.3) * Math.min(1,
      wheel.slip / 6) * 40 * wallDt;
    while (state.smokeDebt >= 1) { state.smokeDebt--;
      emitPuff(ctx, wheel.x, wheel.y, car.vx * 0.6, car.vy * 0.6, SMOKE, 0.5); }
  }
  if (state.smokeDebt > 4) state.smokeDebt = 4;
}

/**
 * Trail grey smoke from the nose of a badly damaged car.
 * @param ctx particle context
 * @param car the car
 * @param wallDt wall-clock frame time
 */
function emitDamageSmoke(ctx: ParticleCtx, car: ParticleCar, wallDt: number) {
  if (!car.wreck || !car.wreck.smoke) return;
  // a stopped wreck: a thin wisp (10/s piled into a square haze)
  car._dsDebt = (car._dsDebt || 0) + (Math.hypot(car.vx, car.vy) > 2 ? 10 : 2.5) * wallDt;
  const cosHeading = Math.cos(car.heading), sinHeading = Math.sin(car.heading),
    nose = car.spec.len * 0.45;
  while (car._dsDebt >= 1) { car._dsDebt--;
    emitPuff(ctx, car.x + cosHeading * nose, car.y + sinHeading * nose, car.vx * 0.4,
      car.vy * 0.4, DSMOKE, 0.6); }
}

/**
 * Fling the paint chips of one hit from the hurt corner of the car.
 * @param ctx particle context
 * @param car the car
 * @param hit one damage event
 */
function flingChips(ctx: ParticleCtx, car: ParticleCar, hit: DmgEvent) {
  const chips = ctx.state.chips;
  const spec = car.spec, cosHeading = Math.cos(car.heading), sinHeading = Math.sin(car.heading);
  const count = hit.scrape ? 3 : Math.min(60, Math.round(8 + 90 * hit.amt)),
    cornerX = (hit.c < 2 ? 1 : -1) * spec.len * 0.48, cornerY = (hit.c % 2 ? 1
      : -1) * spec.wid * 0.45;
  const worldX = car.x + cosHeading * cornerX - sinHeading * cornerY,
    worldY = car.y + sinHeading * cornerX + cosHeading * cornerY;
  for (let i = 0; i < count; i++) {
    const angle = fxRandom() * 6.2832, speed = 1.5 + fxRandom() * (hit.scrape ? 3
      : 4 + 14 * hit.amt), roll = fxRandom();
    if (chips.length >= MAX_CHIPS) chips.shift();
    chips.push({ x: worldX, y: worldY, vx: car.vx * 0.5 + Math.cos(angle) * speed,
      vy: car.vy * 0.5 + Math.sin(angle) * speed, age: 0, life: 6 + fxRandom() * 6,
      // art px: visible at phone zoom
      col: roll < 0.75 ? (spec.paint
        || '#d0552f') : roll < 0.88 ? '#9a9aa2' : '#22242a',
          sz: 2 + (fxRandom() < 0.35 ? 1 : 0) });
  }
}

// IMPACT SPARKS (owner: "big crashes metal on metal ... a high chance for sparks to emit from
// the impact zones, like paint"): a hit on metal (physics/punctures.ts
// hitIsMetal: another car, armco, posts, fences ...) of at least IMPACT_FROM damage, the car
// DRIVEN into it at IMPACT_SPEED or more (owner: "only with impacts over 20-30 mph, so rolling
// into a barrier doesn't spark but driving into it does"), throws a burst of sparks from the hurt
// corner IMPACT_CHANCE of the time (owner: 70 %), more the harder the hit; they spray on the way
// the car was going into it, fanned along the hit (owner: "directional with impact")
const IMPACT_FROM = 0.04, IMPACT_SPEED = 11.2, IMPACT_CHANCE = 0.7;
const IMPACT_SPARKS_MIN = 14, IMPACT_SPARKS_PER = 160, IMPACT_SPARKS_MAX = 90;
// a crash flings them harder than dragging metal, in a wider fan (rad either side)
const IMPACT_FLING = 1.6, IMPACT_FAN_EXTRA = 0.5;

/**
 * A burst of sparks out of a crash's hurt corner, by chance and by how hard the hit was.
 * @param ctx particle context
 * @param car the car
 * @param hit the damage event
 */
function throwImpactSparks(ctx: ParticleCtx, car: ParticleCar, hit: DmgEvent) {
  if (hit.amt < IMPACT_FROM || !((hit.speed || 0) >= IMPACT_SPEED)) return;
  if (fxRandom() > IMPACT_CHANCE) return;
  const spec = car.spec, cosHeading = Math.cos(car.heading), sinHeading = Math.sin(car.heading);
  const cornerX = (hit.c < 2 ? 1 : -1) * spec.len * 0.48;
  const cornerY = (hit.c % 2 ? 1 : -1) * spec.wid * 0.45;
  const x = car.x + cosHeading * cornerX - sinHeading * cornerY;
  const y = car.y + sinHeading * cornerX + cosHeading * cornerY;
  // on the way the car was going into the hit
  const onward = hit.aim ?? Math.atan2(y - car.y, x - car.x);
  const count = Math.min(IMPACT_SPARKS_MAX, Math.round(IMPACT_SPARKS_MIN + IMPACT_SPARKS_PER
    * hit.amt));
  for (let i = 0; i < count; i++) {
    throwSpark(ctx, car, x, y, onward + (fxRandom() * 2 - 1) * IMPACT_FAN_EXTRA, IMPACT_FLING);
  }
}

/**
 * PAINT CHIPS: every hit (damage.ts dmgEvents) flings square pixels of the car's paint (and some
 * primer / black trim) from the hurt corner; they skid to a stop and lie on the ground a few
 * seconds. Wall clock (rule 5: watched). Capped, oldest dropped (§4).
 * @param ctx particle context
 * @param car the car
 */
function emitChips(ctx: ParticleCtx, car: ParticleCar) {
  emitTyreMoments(ctx, car);
  const events = car.dmgEvents; if (!events || !events.length) return;
  for (const hit of events) {
    flingChips(ctx, car, hit);
    if (hit.metal && !hit.scrape) throwImpactSparks(ctx, car, hit);
  }
  events.length = 0;
}

// TYRE MOMENTS (physics/tyrepressure.ts car.tyreFx): a burst puffs air and dust from
// the wheel; a tyre coming off the rim throws black shreds of rubber
const TYRE_PUFF = { rgb: '200,192,176', size: 0.3, lift: 3.0, life: 0.6, grow: 1.2 };
const SHRED_COL = '#0d0e11';

/**
 * Where a wheel is, by damage corner (0 front -y, 1 front +y, 2 rear -y, 3 rear +y).
 * @param car the car
 * @param corner the damage corner
 * @returns world x, y
 */
function wheelPlace(car: ParticleCar, corner: number): [number, number] {
  const spec = car.spec, cosHeading = Math.cos(car.heading), sinHeading = Math.sin(car.heading);
  const along = corner < 2 ? spec.lf ?? spec.len * 0.33 : -(spec.lr ?? spec.len * 0.33);
  const across = (corner % 2 ? 1 : -1) * (spec.trackWidth ?? spec.wid) / 2;
  return [car.x + along * cosHeading - across * sinHeading,
    car.y + along * sinHeading + across * cosHeading];
}

/**
 * The puff when a tyre goes and the shreds when it reaches the rim.
 * @param ctx particle context
 * @param car the car
 */
function emitTyreMoments(ctx: ParticleCtx, car: ParticleCar) {
  const moments = car.tyreFx; if (!moments || !moments.length) return;
  for (const moment of moments) {
    const [wheelX, wheelY] = wheelPlace(car, moment.corner);
    if (moment.kind === 'puff') {
      for (let i = 0; i < 12; i++) emitPuff(ctx, wheelX, wheelY, car.vx * 0.5, car.vy * 0.5,
        TYRE_PUFF, 1.2);
      continue;
    }
    for (let i = 0; i < 16; i++) {
      const angle = fxRandom() * 6.2832, speed = 2 + fxRandom() * 6;
      if (ctx.state.chips.length >= MAX_CHIPS) ctx.state.chips.shift();
      ctx.state.chips.push({ x: wheelX, y: wheelY, vx: car.vx * 0.4 + Math.cos(angle) * speed,
        vy: car.vy * 0.4 + Math.sin(angle) * speed, age: 0, life: 5 + fxRandom() * 5,
        col: SHRED_COL, sz: 2 });
    }
  }
  moments.length = 0;
}

// SPARKS: metal on hard ground (world/metalscrape.ts). Owner: "I don't see sparks", then "more
// random, small, fling off and fade like real sparks": each a small hot fleck (0.1-0.2 m, a few
// screen px at race zoom) flung hard backwards and outward in a wide random fan, carried on at
// about half the car's speed, cooling white -> yellow -> orange and shrinking over its own short
// life (0.1-0.45 s), thrown in bursts rather than a steady stream.
// a spark's thickness, m (on the screen canvas: a few device px, not one blocky art pixel), and how
// long its streak is - the distance it flies in STREAK_S
const SPARK_SIZE_M = 0.14, SPARK_LIFE_S = 0.15, SPARK_LIFE_SPREAD_S = 0.4;
export const STREAK_S = 0.04;
// each spark glows: a soft halo HALO_X as thick under its core, at HALO_ALPHA (owner: "they
// should glow"; the separate glow patch beside the rim is gone)
export const HALO_X = 3.2;
const HALO_ALPHA = 0.28;
// m a rim's sparks start behind the wheel's centre and out from it (off the car's bodywork)
const SPARK_BACK_M = 0.3, SPARK_OUT_M = 0.15;
// m/s a spark is flung off the metal (on top of the carry), and the fan's half angle, rad
const FLING_MIN = 3, FLING_SPREAD = 9, FAN = 1.2;
// how far a rim's sparks lean out to its own side (share of the backward direction)
const OUT_LEAN = 0.6;
// sparks a second (on average) from a wheel on its rim, and from a body sliding on its side or
// roof; each frame's rate is this x a random burst factor 0..BURST_MAX (mean ~1)
const RIM_SPARK_RATE = 200, BODY_SPARK_RATE = 260, BURST_MAX = 2.6;
// each spark's fade curve exponent (alpha 1 - share gone ^ k): low dims early, high stays bright
// and snaps out - so they do not all fade alike (owner); and a flicker each frame
const FADE_K_MIN = 0.5, FADE_K_SPREAD = 3.5, FLICKER = 0.35;
// the most art px a streak's trail draws behind the head
const TRAIL_MAX = 4;
// what a spark looks like as it cools (by the share of its life gone): its core and its halo
const SPARK_COOLING: [number, string, string][] = [[0.25, '#fff6d6', '#ffcf6a'],
  [0.6, '#ffd85a', '#ff9a2a'], [1, '#ff8a2a', '#ff4a10']];

/**
 * Throws one spark from a point of a car: carried on with it, flung backwards and out.
 * @param ctx particle context
 * @param car the car
 * @param x world x, m
 * @param y world y, m
 * @param aim the direction it is flung, rad (a random fan of FAN round it)
 * @param flingK a scale on how hard it is flung (1: metal dragging; more: a crash)
 */
function throwSpark(ctx: ParticleCtx, car: ParticleCar, x: number, y: number, aim: number,
  flingK = 1) {
  const sparks = ctx.state.sparks;
  const angle = aim + (fxRandom() * 2 - 1) * FAN;
  const fling = (FLING_MIN + fxRandom() * fxRandom() * FLING_SPREAD) * flingK;
  const carry = 0.3 + fxRandom() * 0.35;
  if (sparks.length >= MAX_SPARKS) sparks.shift();
  sparks.push({ x, y, vx: car.vx * carry + Math.cos(angle) * fling,
    vy: car.vy * carry + Math.sin(angle) * fling, age: 0,
    life: SPARK_LIFE_S + fxRandom() * SPARK_LIFE_SPREAD_S, col: SPARK_COOLING[0][1],
    sz: SPARK_SIZE_M * (0.5 + fxRandom() * 0.5), fadeK: FADE_K_MIN + fxRandom() * FADE_K_SPREAD });
}

/**
 * The way a dragging spark is flung: behind the way the car is MOVING (owner: sliding, rolling -
 * not the way its nose points), leaning out to the side it came from.
 * @param car the car
 * @param outward the side (+1 the car's +y, -1 -y, 0 either)
 * @returns the direction, rad
 */
function dragAim(car: ParticleCar, outward: number): number {
  const speed = Math.hypot(car.vx, car.vy);
  const backX = speed > 1 ? -car.vx / speed : -Math.cos(car.heading);
  const backY = speed > 1 ? -car.vy / speed : -Math.sin(car.heading);
  return Math.atan2(backY + Math.cos(car.heading) * outward * OUT_LEAN,
    backX - Math.sin(car.heading) * outward * OUT_LEAN);
}

/**
 * The sparks one source owes after this frame: the rate x a random burst, kept between frames
 * (throw the whole part now, keep the rest).
 * @param debt the sparks owed so far
 * @param rate sparks a second on average
 * @param wallDt wall-clock frame time
 * @returns the sparks owed now
 */
function sparksOwed(debt: number, rate: number, wallDt: number): number {
  return debt + rate * BURST_MAX * fxRandom() * fxRandom() * 2 * wallDt;
}

/**
 * SPARKS from metal on hard ground: each wheel on its rim (car.rimSparks) and a body sliding on
 * its side or roof (roll.js car.sparks), wall clock.
 * @param ctx particle context
 * @param car the car
 * @param wallDt wall-clock frame time
 */
function emitSparks(ctx: ParticleCtx, car: ParticleCar, wallDt: number) {
  const rims = car.rimSparks;
  if (rims) for (let corner = 0; corner < 4; corner++) {
    if (!rims[corner]) continue;
    // from the tyre's outer back edge, where the rim meets the road behind the car's body
    const [wheelX, wheelY] = wheelPlace(car, corner), side = corner % 2 ? 1 : -1;
    const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
    const fromX = wheelX - cosH * SPARK_BACK_M - sinH * side * SPARK_OUT_M;
    const fromY = wheelY - sinH * SPARK_BACK_M + cosH * side * SPARK_OUT_M;
    const owed = sparksOwed(car._rimDebt || 0, RIM_SPARK_RATE, wallDt), count = Math.floor(owed);
    car._rimDebt = owed - count;
    const aim = dragAim(car, side);
    for (let i = 0; i < count; i++) throwSpark(ctx, car, fromX, fromY, aim);
  }
  if (!car.sparks) return;
  // from the trailing part of the body: behind its middle along the way it is moving
  const cosHeading = Math.cos(car.heading), sinHeading = Math.sin(car.heading);
  const moving = Math.hypot(car.vx, car.vy) || 1;
  const trailX = -car.vx / moving * car.spec.len * 0.3, trailY = -car.vy / moving * car.spec.len
    * 0.3;
  const owed = sparksOwed(car._spDebt || 0, BODY_SPARK_RATE, wallDt), count = Math.floor(owed);
  car._spDebt = owed - count;
  for (let i = 0; i < count; i++) {
    const offsetX = (fxRandom() - 0.5) * car.spec.len;
    const offsetY = (fxRandom() - 0.5) * car.spec.wid;
    throwSpark(ctx, car, car.x + trailX + cosHeading * offsetX * 0.6 - sinHeading * offsetY,
      car.y + trailY + sinHeading * offsetX * 0.6 + cosHeading * offsetY, dragAim(car, 0));
  }
}

/**
 * Move, fade and draw the paint chips and sparks; expired ones are removed.
 * @param ctx particle context
 * @param wallDt wall-clock frame time
 */
function renderChips(ctx: ParticleCtx, wallDt: number) {
  const { view, PPMz, toScreenX, toScreenY } = ctx;
  const chips = ctx.state.chips;
  const scale = PPMz() / SPRITE_PPM;
  for (let i = chips.length - 1; i >= 0; i--) {
    const chip = chips[i]; chip.age += wallDt; if (chip.age > chip.life) { chips.splice(i, 1);
      continue; }
    // skid to a stop
    chip.x += chip.vx * wallDt; chip.y += chip.vy * wallDt;
    const damp = Math.max(0, 1 - 4 * wallDt); chip.vx *= damp; chip.vy *= damp;
    // fade over the last second, or over the whole life of a short one (a spark lives under
    // 0.4 s: by seconds left it was never more than 40 % opaque, so never seen)
    view.ctx.globalAlpha = Math.min(1, (chip.life - chip.age) / Math.min(1, chip.life));
    view.ctx.fillStyle = chip.col;
    const z = Math.max(1, Math.round(chip.sz * scale));
    view.ctx.fillRect(Math.round(toScreenX(chip.x) - z / 2),
      Math.round(toScreenY(chip.y) - z / 2), z, z);
  }
  view.ctx.globalAlpha = 1;
}

/**
 * Moves, cools and draws the sparks on the SCREEN canvas, over the road and under the cars
 * (owner): MEASURED (owner: "I'm not seeing the promised changes") drawn into the art buffer a
 * spark under ~0.15 m was always one art pixel (several screen px) at race zoom, so no change of
 * size or colour could show. Each is a short streak along its flight with a glowing halo, thinner
 * and orange as it cools; at night the light map opens the dark along it (render/light.ts).
 * @param ctx particle context
 * @param wallDt wall-clock frame time
 * @param target the screen canvas, already set to draw in art px (render/screen.ts)
 */
function renderSparks(ctx: ParticleCtx, wallDt: number, target: CanvasRenderingContext2D) {
  const { PPMz, toScreenX, toScreenY } = ctx, sparks = ctx.state.sparks, ppm = PPMz();
  for (let i = sparks.length - 1; i >= 0; i--) {
    const spark = sparks[i]; spark.age += wallDt;
    if (spark.age > spark.life) { sparks.splice(i, 1); continue; }
    spark.x += spark.vx * wallDt; spark.y += spark.vy * wallDt;
    const damp = Math.max(0, 1 - 4 * wallDt); spark.vx *= damp; spark.vy *= damp;
    const gone = spark.age / spark.life;
    const fade = (1 - gone ** (spark.fadeK || 2)) * (1 - FLICKER * fxRandom());
    const cooling = SPARK_COOLING.find(([until]) => gone <= until)!;
    drawSparkPixels(target, spark, cooling, fade,
      Math.max(1, Math.round(spark.sz * (1 - 0.5 * gone) * ppm)), toScreenX, toScreenY);
  }
  target.globalAlpha = 1;
}

/**
 * One spark as pixel art (owner: "not pixelated enough"): squares on the art-pixel grid - the
 * head, a short trail back along its flight, and a dim square one pixel bigger round the head for
 * the glow.
 * @param target the screen canvas in art px
 * @param spark the spark
 * @param cooling its colours now: [until, core, halo]
 * @param fade its brightness now, 0..1
 * @param size its square, art px
 * @param toScreenX world x -> art px
 * @param toScreenY world y -> art px
 */
function drawSparkPixels(
  target: CanvasRenderingContext2D, spark: Chip, cooling: [number, string, string], fade: number,
  size: number, toScreenX: (x: number) => number, toScreenY: (y: number) => number,
) {
  const headX = Math.round(toScreenX(spark.x)), headY = Math.round(toScreenY(spark.y));
  const tailX = toScreenX(spark.x - spark.vx * STREAK_S) - headX;
  const tailY = toScreenY(spark.y - spark.vy * STREAK_S) - headY;
  const steps = Math.min(TRAIL_MAX, Math.round(Math.hypot(tailX, tailY) / size));
  const half = Math.floor(size / 2);
  target.globalAlpha = fade * HALO_ALPHA;
  target.fillStyle = cooling[2];
  target.fillRect(headX - half - 1, headY - half - 1, size + 2, size + 2);
  target.fillStyle = cooling[1];
  for (let step = steps; step >= 0; step--) {
    const share = steps ? step / steps : 0;
    target.globalAlpha = fade * (1 - 0.7 * share);
    target.fillRect(headX + Math.round(tailX * share) - half, headY + Math.round(tailY * share)
      - half, size, size);
  }
}

/**
 * Move, fade and draw the puffs; expired ones are removed.
 * @param ctx particle context
 * @param wallDt wall-clock frame time
 */
function renderPuffs(ctx: ParticleCtx, wallDt: number) {
  const { view, PPMz, toScreenX, toScreenY } = ctx;
  const puffs = ctx.state.puffs;
  const ppm = PPMz();
  for (let i = puffs.length - 1; i >= 0; i--) {
    const puff = puffs[i];
    puff.age += wallDt;
    if (puff.age >= puff.life) { puffs.splice(i, 1); continue; }
    const fade = puff.age / puff.life;
    puff.x += puff.vx * wallDt; puff.y += puff.vy * wallDt;
    // air drag: clods slow and settle
    puff.vx *= 1 - 2.6 * wallDt; puff.vy *= 1 - 2.6 * wallDt;
    view.ctx.fillStyle = `rgb(${puff.rgb})`;
    // PIXEL PUFFS: a square snapped to the art-pixel grid, fading in STEPS (pixel-art smoke),
    // not a smooth disc
    view.ctx.globalAlpha = Math.ceil((1 - fade) * 4) / 4 * 0.5;
    const radius = Math.max(1, Math.round((puff.r0 + fade * puff.grow) * ppm * view.dpr));
    const pixelX = Math.round(toScreenX(puff.x) * view.dpr),
      pixelY = Math.round(toScreenY(puff.y) * view.dpr);
    view.ctx.save(); view.ctx.setTransform(1, 0, 0, 1, 0, 0);
    view.ctx.fillRect(pixelX - radius, pixelY - radius, radius * 2, radius * 2);
    view.ctx.restore();
  }
  view.ctx.globalAlpha = 1;
}

/**
 * Build the particle layer.
 * @param view the canvas view
 * @param cam the camera
 * @param helpers zoomed pixels-per-metre and world-to-screen converters
 * @returns the chip pool and the add / draw entry points
 */
export function createParticles(view: View, cam: Cam, helpers: ParticleHelpers) {
  const { PPMz, toScreenX, toScreenY } = helpers;
  const state: ParticleState = { puffs: [], sprayDebt: 0, smokeDebt: 0, chips: [], sparks: [] };
  const ctx: ParticleCtx = { view, cam, PPMz, toScreenX, toScreenY, state };
  return {
    chips: state.chips, MAX_CHIPS, sparks: state.sparks,
    addPuffs: (hits: PuffHit[]) => addPuffsTo(ctx, hits),
    addSpray: (car: ParticleCar, marks: RenderMarks, wallDt: number) =>
      emitSpray(ctx, car, marks, wallDt),
    addSmoke: (car: ParticleCar, marks: RenderMarks, wallDt: number) =>
      emitTyreSmoke(ctx, car, marks, wallDt),
    addDamageSmoke: (car: ParticleCar, wallDt: number) => emitDamageSmoke(ctx, car, wallDt),
    addChips: (car: ParticleCar) => emitChips(ctx, car),
    addSparks: (car: ParticleCar, wallDt: number) => emitSparks(ctx, car, wallDt),
    drawChips: (wallDt: number) => renderChips(ctx, wallDt),
    drawSparks: (wallDt: number, target: CanvasRenderingContext2D) =>
      renderSparks(ctx, wallDt, target),
    drawPuffs: (wallDt: number) => renderPuffs(ctx, wallDt),
  };
}
