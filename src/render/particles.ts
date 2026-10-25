// The PARTICLES layer of the renderer: thrown material - puffs, spray, smoke, paint chips and
// sparks. createParticles owns the pools and returns the add / draw entry points.
import { SPRITE_PPM } from "./shared.ts";
import type { Spray } from "../world/types.ts";
import type { Cam, Chip, ParticleCar, Puff, PuffHit, RenderMarks, View } from "./types.ts";

// what createParticles destructures from the renderer
interface ParticleHelpers {
  PPMz: () => number;
  toScreenX: (wx: number) => number;
  toScreenY: (wy: number) => number;
}

// one damage event of a car
interface DmgEvent { scrape?: boolean; amt: number; c: number }

// the mutable values the particle layer keeps between frames
interface ParticleState {
  puffs: Puff[];
  // WHEEL SPRAY keeps a fractional remainder, because a rate below one particle per frame must
  // still emit at the right average rather than rounding to nothing.
  sprayDebt: number;
  smokeDebt: number;
  // PAINT CHIPS: capped, oldest dropped (§4)
  chips: Chip[];
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
  const angle = Math.random() * 6.2832;
  const fling = spray.lift * scale * (0.35 + Math.random() * 0.65);
  puffs.push({
    x, y, age: 0,
    life: spray.life * (0.7 + Math.random() * 0.6),
    r0: spray.size * (0.7 + Math.random() * 0.7),
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
      (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, FLUFF_PUFF, 1); continue; }
    if (hit.kind === 'bale') { for (let i = 0; i < 4; i++) emitPuff(ctx, hit.x, hit.y,
      (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, BALE_DUST, 1); continue; }
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
  const spray = car.surface.spray;
  if (!spray) { state.sprayDebt = 0; return; }
  const speed = Math.hypot(car.vx, car.vy);
  if (speed < 1.5) { state.sprayDebt = 0; return; }
  const slip = Math.max(car.t.slipSpeedF, car.t.slipSpeedR);
  const work = Math.min(1, speed / 26) * 0.55 + Math.min(1, slip / 9) * 0.75;
  // airborne wheels throw nothing - there is nothing under them to throw
  const grounded = Math.max(0, Math.min(1, (car.t.loadKF + car.t.loadKR) / 2));
  state.sprayDebt += spray.rate * work * grounded * wallDt;
  let count = Math.floor(state.sprayDebt);
  state.sprayDebt -= count;
  // never let a frame spike flood the pool
  if (count > 12) count = 12;
  const wheels = marks.wheelsOf(car);
  for (let i = 0; i < count; i++) {
    const wheel = wheels[(Math.random() * 4) | 0];
    emitPuff(ctx, wheel.x, wheel.y, car.vx, car.vy, spray, 0.4 + work);
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
    const angle = Math.random() * 6.2832, speed = 1.5 + Math.random() * (hit.scrape ? 3
      : 4 + 14 * hit.amt), roll = Math.random();
    if (chips.length >= MAX_CHIPS) chips.shift();
    chips.push({ x: worldX, y: worldY, vx: car.vx * 0.5 + Math.cos(angle) * speed,
      vy: car.vy * 0.5 + Math.sin(angle) * speed, age: 0, life: 6 + Math.random() * 6,
      // art px: visible at phone zoom
      col: roll < 0.75 ? (spec.paint
        || '#d0552f') : roll < 0.88 ? '#9a9aa2' : '#22242a',
          sz: 2 + (Math.random() < 0.35 ? 1 : 0) });
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
  for (const hit of events) flingChips(ctx, car, hit);
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
      const angle = Math.random() * 6.2832, speed = 2 + Math.random() * 6;
      if (ctx.state.chips.length >= MAX_CHIPS) ctx.state.chips.shift();
      ctx.state.chips.push({ x: wheelX, y: wheelY, vx: car.vx * 0.4 + Math.cos(angle) * speed,
        vy: car.vy * 0.4 + Math.sin(angle) * speed, age: 0, life: 5 + Math.random() * 5,
        col: SHRED_COL, sz: 2 });
    }
  }
  moments.length = 0;
}

/**
 * SPARKS (roll.js car.sparks: on its side / roof on hard ground): short bright pixels thrown
 * back from the body, wall clock.
 * @param ctx particle context
 * @param car the car
 * @param wallDt wall-clock frame time
 */
function emitSparks(ctx: ParticleCtx, car: ParticleCar, wallDt: number) {
  emitRimSparks(ctx, car, wallDt);
  const chips = ctx.state.chips;
  if (!car.sparks) return;
  car._spDebt = (car._spDebt || 0) + 60 * wallDt;
  while (car._spDebt >= 1) { car._spDebt--;
    const angle = Math.random() * 6.2832, speed = 2 + Math.random() * 6,
      offsetX = (Math.random() - 0.5) * car.spec.len,
        offsetY = (Math.random() - 0.5) * car.spec.wid, cosHeading = Math.cos(car.heading),
          sinHeading = Math.sin(car.heading);
    if (chips.length >= MAX_CHIPS) chips.shift();
    chips.push({ x: car.x + cosHeading * offsetX - sinHeading * offsetY,
      y: car.y + sinHeading * offsetX + cosHeading * offsetY,
        vx: -car.vx * 0.3 + Math.cos(angle) * speed, vy: -car.vy * 0.3 + Math.sin(angle) * speed,
          age: 0, life: 0.25 + Math.random() * 0.3,
            col: Math.random() < 0.6 ? '#ffd85a' : '#ffffff', sz: 2 });
  }
}

/**
 * SPARKS from each wheel running on its rim over hard ground (world/metalscrape.ts
 * car.rimSparks), thrown back from the wheel.
 * @param ctx particle context
 * @param car the car
 * @param wallDt wall-clock frame time
 */
function emitRimSparks(ctx: ParticleCtx, car: ParticleCar, wallDt: number) {
  const rims = car.rimSparks; if (!rims) return;
  for (let corner = 0; corner < 4; corner++) {
    if (!rims[corner]) continue;
    const [wheelX, wheelY] = wheelPlace(car, corner);
    car._rimDebt = (car._rimDebt || 0) + 30 * wallDt;
    while (car._rimDebt >= 1) { car._rimDebt--;
      const angle = Math.random() * 6.2832, speed = 1 + Math.random() * 4;
      if (ctx.state.chips.length >= MAX_CHIPS) ctx.state.chips.shift();
      ctx.state.chips.push({ x: wheelX, y: wheelY, vx: -car.vx * 0.3 + Math.cos(angle) * speed,
        vy: -car.vy * 0.3 + Math.sin(angle) * speed, age: 0, life: 0.2 + Math.random() * 0.25,
        col: Math.random() < 0.6 ? '#ffd85a' : '#ffffff', sz: 1.5 });
    }
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
    view.ctx.globalAlpha = Math.min(1, chip.life - chip.age); view.ctx.fillStyle = chip.col;
    const z = Math.max(1, Math.round(chip.sz * scale));
    view.ctx.fillRect(Math.round(toScreenX(chip.x) - z / 2),
      Math.round(toScreenY(chip.y) - z / 2), z, z);
  }
  view.ctx.globalAlpha = 1;
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
  const state: ParticleState = { puffs: [], sprayDebt: 0, smokeDebt: 0, chips: [] };
  const ctx: ParticleCtx = { view, cam, PPMz, toScreenX, toScreenY, state };
  return {
    chips: state.chips, MAX_CHIPS,
    addPuffs: (hits: PuffHit[]) => addPuffsTo(ctx, hits),
    addSpray: (car: ParticleCar, marks: RenderMarks, wallDt: number) =>
      emitSpray(ctx, car, marks, wallDt),
    addSmoke: (car: ParticleCar, marks: RenderMarks, wallDt: number) =>
      emitTyreSmoke(ctx, car, marks, wallDt),
    addDamageSmoke: (car: ParticleCar, wallDt: number) => emitDamageSmoke(ctx, car, wallDt),
    addChips: (car: ParticleCar) => emitChips(ctx, car),
    addSparks: (car: ParticleCar, wallDt: number) => emitSparks(ctx, car, wallDt),
    drawChips: (wallDt: number) => renderChips(ctx, wallDt),
    drawPuffs: (wallDt: number) => renderPuffs(ctx, wallDt),
  };
}
