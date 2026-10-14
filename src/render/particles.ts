// the PARTICLES layer of render.ts (phase 4 of the render.js split): thrown material -
// puffs, spray, smoke, paint chips and sparks. Moved verbatim from createRenderer.
import { SPRITE_PPM } from "./shared.ts";
import type { Spray } from "../world/types.ts";
import type { Cam, Chip, ParticleCar, Puff, PuffHit, RenderMarks, View } from "./types.ts";

// what createParticles destructures from the renderer
interface ParticleHelpers {
  PPMz: () => number;
  toScreenX: (wx: number) => number;
  toScreenY: (wy: number) => number;
}

export function createParticles(view: View, cam: Cam, helpers: ParticleHelpers) {
  const { PPMz, toScreenX, toScreenY } = helpers;
  // ---------------------------------------------------------------- thrown material
  // Wall clock (rule 5): something the player WATCHES must not complete inside one frame.
  //
  // One pool serves both the cone puffs and the wheel spray (user, 2026-09-28: "floor with a loose
  // surface like snow mud sand or grass should particle emit and small and kick up dust / dirt /
  // grass / snow"). WHAT gets thrown is entirely the SURFACE's business — colour, size, rate, how
  // far it is flung, how long it hangs and how much it blooms all come off `surface.spray` in
  // lab.js. This file never learns what snow is, which is the same seam the marks layer uses.
  const puffs: Puff[] = [];
  // raised from 40: four wheels throwing continuously needs the headroom
  const MAX_PUFFS = 220;
  function emit(
    x: number, y: number, vx: number, vy: number, spray: Omit<Spray, "rate">, scale: number,
  ) {
    if (puffs.length >= MAX_PUFFS) puffs.shift();          // cap; drop the oldest (§4)
    const angle = Math.random() * 6.2832;
    const fling = spray.lift * scale * (0.35 + Math.random() * 0.65);
    puffs.push({
      x, y, age: 0,
      life: spray.life * (0.7 + Math.random() * 0.6),
      r0: spray.size * (0.7 + Math.random() * 0.7),
      grow: spray.grow, rgb: spray.rgb,
      // thrown BACKWARDS off the contact patch plus a scatter, so it trails the car instead of
      // sitting under it — material is flung opposite to the way the wheel is travelling
      vx: -vx * 0.28 + Math.cos(angle) * fling,
      vy: -vy * 0.28 + Math.sin(angle) * fling,
    });
  }

  // Cone hits: the same pool, with a fixed pale dust.
  const CONE_DUST = { rgb: '185,178,164', size: 0.18, lift: 2.2, life: 0.45, grow: 0.55 };
  // a burst BALE throws a big slow straw-coloured cloud (user: "they explode with dust")
  const BALE_DUST = { rgb: '214,190,128', size: 0.55, lift: 1.6, life: 1.4, grow: 1.1 };
  // a popped SHEEP (S-C): a white FLUFF cloud, no gore
  const FLUFF_PUFF = { rgb: '248,247,240', size: 0.5, lift: 3.2, life: 1.5, grow: 1.0 };
  function addPuffs(hits: PuffHit[]) {
    for (const hit of hits) {
      if (hit.kind === 'fluff') { for (let i = 0; i < 5; i++) emit(hit.x, hit.y,
        (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, FLUFF_PUFF, 1); continue; }
      if (hit.kind === 'bale') { for (let i = 0; i < 4; i++) emit(hit.x, hit.y,
        (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, BALE_DUST, 1); continue; }
      const count = Math.min(3, 1 + Math.floor(hit.speed / 6));
      for (let i = 0; i < count; i++) emit(hit.x, hit.y, 0, 0, CONE_DUST, 1);
    }
  }

  // WHEEL SPRAY. The rate rises with how hard the wheels are actually WORKING — rolling speed plus
  // any slipping — so cruising over gravel ticks along quietly and a slide throws a rooster tail.
  // It keeps a fractional remainder, because a rate below one particle per frame must still emit
  // at the right average rather than rounding to nothing.
  let sprayDebt = 0;
  function addSpray(car: ParticleCar, marks: RenderMarks, wallDt: number) {
    const spray = car.surface.spray;
    if (!spray) { sprayDebt = 0; return; }
    const speed = Math.hypot(car.vx, car.vy);
    if (speed < 1.5) { sprayDebt = 0; return; }
    const slip = Math.max(car.t.slipSpeedF, car.t.slipSpeedR);
    const work = Math.min(1, speed / 26) * 0.55 + Math.min(1, slip / 9) * 0.75;
    // airborne wheels throw nothing — there is nothing under them to throw
    const grounded = Math.max(0, Math.min(1, (car.t.loadKF + car.t.loadKR) / 2));
    sprayDebt += spray.rate * work * grounded * wallDt;
    let count = Math.floor(sprayDebt);
    sprayDebt -= count;
    // never let a frame spike flood the pool
    if (count > 12) count = 12;
    const wheels = marks.wheelsOf(car);
    for (let i = 0; i < count; i++) {
      const wheel = wheels[(Math.random() * 4) | 0];
      emit(wheel.x, wheel.y, car.vx, car.vy, spray, 0.4 + work);
    }
  }

  // TYRE SMOKE (user, 2026-10-03: "smoke when too hot"). Each tyre over SMOKE_T that is also
  // slipping puffs white-grey smoke at a rate set by how hot and how hard — the silent twin of a
  // squeal (CLAUDE.md §4).
  const SMOKE_T = 115;
  const SMOKE = { rgb: '225,225,230', size: 0.45, lift: 0.9, life: 1.3, grow: 1.9 };
  let smokeDebt = 0;
  function addSmoke(car: ParticleCar, marks: RenderMarks, wallDt: number) {
    if (!car.tyreT) return;
    const wheels = marks.wheelsOf(car);
    for (const wheel of wheels) {
      if (wheel.heat < SMOKE_T || wheel.slip < 1.5) continue;
      smokeDebt += Math.min(1, (wheel.heat - SMOKE_T) / 40 + 0.3) * Math.min(1,
        wheel.slip / 6) * 40 * wallDt;
      while (smokeDebt >= 1) { smokeDebt--;
        emit(wheel.x, wheel.y, car.vx * 0.6, car.vy * 0.6, SMOKE, 0.5); }
    }
    if (smokeDebt > 4) smokeDebt = 4;
  }
  // a badly hit front (damage.js wreck.smoke) trails grey smoke from the nose — the silent twin of
  // a damaged engine
  const DSMOKE = { rgb: '120,120,128', size: 0.5, lift: 0.7, life: 1.1, grow: 1.6 };
  function addDamageSmoke(car: ParticleCar, wallDt: number) {
    if (!car.wreck || !car.wreck.smoke) return;
    // a stopped wreck: a thin wisp (10/s piled into a square haze)
    car._dsDebt = (car._dsDebt || 0) + (Math.hypot(car.vx, car.vy) > 2 ? 10 : 2.5) * wallDt;
    const cosHeading = Math.cos(car.heading), sinHeading = Math.sin(car.heading),
      nose = car.spec.len * 0.45;
    while (car._dsDebt >= 1) { car._dsDebt--;
      emit(car.x + cosHeading * nose, car.y + sinHeading * nose, car.vx * 0.4, car.vy * 0.4,
        DSMOKE, 0.6); }
  }
  // PAINT CHIPS: every hit (damage.js dmgEvents) flings square pixels of the car's paint (and some
  // primer / black trim) from the hurt corner; they skid to a stop and lie on the ground a few
  // seconds. Wall clock (rule 5: watched). Capped, oldest dropped (§4).
  const chips: Chip[] = [], MAX_CHIPS = 400;
  function addChips(car: ParticleCar) {
    const events = car.dmgEvents; if (!events || !events.length) return;
    const spec = car.spec, cosHeading = Math.cos(car.heading), sinHeading = Math.sin(car.heading);
    for (const hit of events) {
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
    events.length = 0;
  }
  // SPARKS (roll.js car.sparks: on its side / roof on hard ground): short bright pixels thrown
  // back from the body, wall clock
  function addSparks(car: ParticleCar, wallDt: number) {
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
  function drawChips(wallDt: number) {
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
  function drawPuffs(wallDt: number) {
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
  return { chips, MAX_CHIPS, addPuffs, addSpray, addSmoke, addDamageSmoke,
    addChips, addSparks, drawChips, drawPuffs };
}
