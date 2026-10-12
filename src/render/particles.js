// the PARTICLES layer of render.js (phase 4 of the render.js split): thrown material -
// puffs, spray, smoke, paint chips and sparks. Moved verbatim from createRenderer.
import { SPRITE_PPM } from "./shared.js";
import { PIXEL } from "../render.js";   // a const read only at draw time (no load-time cycle)

export function createParticles(view, cam, helpers) {
  const { PPMz, sx, sy } = helpers;
  // ---------------------------------------------------------------- thrown material
  // Wall clock (rule 5): something the player WATCHES must not complete inside one frame.
  //
  // One pool serves both the cone puffs and the wheel spray (user, 2026-09-28: "floor with a loose
  // surface like snow mud sand or grass should particle emit and small and kick up dust / dirt / grass
  // / snow"). WHAT gets thrown is entirely the SURFACE's business — colour, size, rate, how far it is
  // flung, how long it hangs and how much it blooms all come off `surface.spray` in lab.js. This file
  // never learns what snow is, which is the same seam the marks layer uses.
  const puffs = [];
  const MAX_PUFFS = 220;      // raised from 40: four wheels throwing continuously needs the headroom
  function emit(x, y, vx, vy, sp, scale) {
    if (puffs.length >= MAX_PUFFS) puffs.shift();          // cap; drop the oldest (§4)
    const a = Math.random() * 6.2832;
    const f = sp.lift * scale * (0.35 + Math.random() * 0.65);
    puffs.push({
      x, y, age: 0,
      life: sp.life * (0.7 + Math.random() * 0.6),
      r0: sp.size * (0.7 + Math.random() * 0.7),
      grow: sp.grow, rgb: sp.rgb,
      // thrown BACKWARDS off the contact patch plus a scatter, so it trails the car instead of sitting
      // under it — material is flung opposite to the way the wheel is travelling
      vx: -vx * 0.28 + Math.cos(a) * f,
      vy: -vy * 0.28 + Math.sin(a) * f,
    });
  }

  // Cone hits: the same pool, with a fixed pale dust.
  const CONE_DUST = { rgb: '185,178,164', size: 0.18, lift: 2.2, life: 0.45, grow: 0.55 };
  // a burst BALE throws a big slow straw-coloured cloud (user: "they explode with dust")
  const BALE_DUST = { rgb: '214,190,128', size: 0.55, lift: 1.6, life: 1.4, grow: 1.1 };
  // a popped SHEEP (S-C): a white FLUFF cloud, no gore
  const FLUFF_PUFF = { rgb: '248,247,240', size: 0.5, lift: 3.2, life: 1.5, grow: 1.0 };
  function addPuffs(hits) {
    for (const h of hits) {
      if (h.kind === 'fluff') { for (let i = 0; i < 5; i++) emit(h.x, h.y, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, FLUFF_PUFF, 1); continue; }
      if (h.kind === 'bale') { for (let i = 0; i < 4; i++) emit(h.x, h.y, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, BALE_DUST, 1); continue; }
      const n = Math.min(3, 1 + Math.floor(h.speed / 6));
      for (let i = 0; i < n; i++) emit(h.x, h.y, 0, 0, CONE_DUST, 1);
    }
  }

  // WHEEL SPRAY. The rate rises with how hard the wheels are actually WORKING — rolling speed plus any
  // slipping — so cruising over gravel ticks along quietly and a slide throws a rooster tail. It keeps
  // a fractional remainder, because a rate below one particle per frame must still emit at the right
  // average rather than rounding to nothing.
  let sprayDebt = 0;
  function addSpray(car, marks, wallDt) {
    const sp = car.surface.spray;
    if (!sp) { sprayDebt = 0; return; }
    const v = Math.hypot(car.vx, car.vy);
    if (v < 1.5) { sprayDebt = 0; return; }
    const slip = Math.max(car.t.slipSpeedF, car.t.slipSpeedR);
    const work = Math.min(1, v / 26) * 0.55 + Math.min(1, slip / 9) * 0.75;
    // airborne wheels throw nothing — there is nothing under them to throw
    const grounded = Math.max(0, Math.min(1, (car.t.loadKF + car.t.loadKR) / 2));
    sprayDebt += sp.rate * work * grounded * wallDt;
    let n = Math.floor(sprayDebt);
    sprayDebt -= n;
    if (n > 12) n = 12;                                    // never let a frame spike flood the pool
    const wheels = marks.wheelsOf(car);
    for (let i = 0; i < n; i++) {
      const w = wheels[(Math.random() * 4) | 0];
      emit(w.x, w.y, car.vx, car.vy, sp, 0.4 + work);
    }
  }

  // TYRE SMOKE (user, 2026-10-03: "smoke when too hot"). Each tyre over SMOKE_T that is also slipping puffs
  // white-grey smoke at a rate set by how hot and how hard — the silent twin of a squeal (CLAUDE.md §4).
  const SMOKE_T = 115;
  const SMOKE = { rgb: '225,225,230', size: 0.45, lift: 0.9, life: 1.3, grow: 1.9 };
  let smokeDebt = 0;
  function addSmoke(car, marks, wallDt) {
    if (!car.tyreT) return;
    const wheels = marks.wheelsOf(car);
    for (const w of wheels) {
      if (w.heat < SMOKE_T || w.slip < 1.5) continue;
      smokeDebt += Math.min(1, (w.heat - SMOKE_T) / 40 + 0.3) * Math.min(1, w.slip / 6) * 40 * wallDt;
      while (smokeDebt >= 1) { smokeDebt--; emit(w.x, w.y, car.vx * 0.6, car.vy * 0.6, SMOKE, 0.5); }
    }
    if (smokeDebt > 4) smokeDebt = 4;
  }
  // a badly hit front (damage.js wreck.smoke) trails grey smoke from the nose — the silent twin of a damaged engine
  const DSMOKE = { rgb: '120,120,128', size: 0.5, lift: 0.7, life: 1.1, grow: 1.6 };
  function addDamageSmoke(car, wallDt) {
    if (!car.wreck || !car.wreck.smoke) return;
    car._dsDebt = (car._dsDebt || 0) + (Math.hypot(car.vx, car.vy) > 2 ? 10 : 2.5) * wallDt;   // a stopped wreck: a thin wisp (10/s piled into a square haze)
    const ch = Math.cos(car.heading), sh = Math.sin(car.heading), f = car.spec.len * 0.45;
    while (car._dsDebt >= 1) { car._dsDebt--; emit(car.x + ch * f, car.y + sh * f, car.vx * 0.4, car.vy * 0.4, DSMOKE, 0.6); }
  }
  // PAINT CHIPS: every hit (damage.js dmgEvents) flings square pixels of the car's paint (and some primer / black trim) from the hurt corner;
  // they skid to a stop and lie on the ground a few seconds. Wall clock (rule 5: watched). Capped, oldest dropped (§4).
  const chips = [], MAX_CHIPS = 400;
  function addChips(car) {
    const ev = car.dmgEvents; if (!ev || !ev.length) return;
    const s = car.spec, ch = Math.cos(car.heading), sh = Math.sin(car.heading);
    for (const e of ev) {
      const n = e.scrape ? 3 : Math.min(60, Math.round(8 + 90 * e.amt)), fx = (e.c < 2 ? 1 : -1) * s.len * 0.48, fy = (e.c % 2 ? 1 : -1) * s.wid * 0.45;
      const wx = car.x + ch * fx - sh * fy, wy = car.y + sh * fx + ch * fy;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.2832, v = 1.5 + Math.random() * (e.scrape ? 3 : 4 + 14 * e.amt), r = Math.random();
        if (chips.length >= MAX_CHIPS) chips.shift();
        chips.push({ x: wx, y: wy, vx: car.vx * 0.5 + Math.cos(a) * v, vy: car.vy * 0.5 + Math.sin(a) * v, age: 0, life: 6 + Math.random() * 6,
          col: r < 0.75 ? (s.paint || '#d0552f') : r < 0.88 ? '#9a9aa2' : '#22242a', sz: 2 + (Math.random() < 0.35 ? 1 : 0) });   // art px: visible at phone zoom
      }
    }
    ev.length = 0;
  }
  // SPARKS (roll.js car.sparks: on its side / roof on hard ground): short bright pixels thrown back from the body, wall clock
  function addSparks(car, wallDt) {
    if (!car.sparks) return;
    car._spDebt = (car._spDebt || 0) + 60 * wallDt;
    while (car._spDebt >= 1) { car._spDebt--;
      const a = Math.random() * 6.2832, v = 2 + Math.random() * 6, ox = (Math.random() - 0.5) * car.spec.len, oy = (Math.random() - 0.5) * car.spec.wid, ch = Math.cos(car.heading), sh = Math.sin(car.heading);
      if (chips.length >= MAX_CHIPS) chips.shift();
      chips.push({ x: car.x + ch * ox - sh * oy, y: car.y + sh * ox + ch * oy, vx: -car.vx * 0.3 + Math.cos(a) * v, vy: -car.vy * 0.3 + Math.sin(a) * v, age: 0, life: 0.25 + Math.random() * 0.3, col: Math.random() < 0.6 ? '#ffd85a' : '#ffffff', sz: 2 });
    }
  }
  function drawChips(wallDt) {
    const u = PPMz() / SPRITE_PPM;
    for (let i = chips.length - 1; i >= 0; i--) {
      const q = chips[i]; q.age += wallDt; if (q.age > q.life) { chips.splice(i, 1); continue; }
      q.x += q.vx * wallDt; q.y += q.vy * wallDt; const k = Math.max(0, 1 - 4 * wallDt); q.vx *= k; q.vy *= k;   // skid to a stop
      view.ctx.globalAlpha = Math.min(1, q.life - q.age); view.ctx.fillStyle = q.col;
      const z = Math.max(1, Math.round(q.sz * u)); view.ctx.fillRect(Math.round(sx(q.x) - z / 2), Math.round(sy(q.y) - z / 2), z, z);
    }
    view.ctx.globalAlpha = 1;
  }
  function drawPuffs(wallDt) {
    const p = PPMz();
    for (let i = puffs.length - 1; i >= 0; i--) {
      const q = puffs[i];
      q.age += wallDt;
      if (q.age >= q.life) { puffs.splice(i, 1); continue; }
      const t = q.age / q.life;
      q.x += q.vx * wallDt; q.y += q.vy * wallDt;
      q.vx *= 1 - 2.6 * wallDt; q.vy *= 1 - 2.6 * wallDt;   // air drag: clods slow and settle
      view.ctx.fillStyle = `rgb(${q.rgb})`;
      if (PIXEL) {
        // PIXEL PUFFS: a square snapped to the art-pixel grid, fading in STEPS (pixel-art smoke), not a smooth disc
        view.ctx.globalAlpha = Math.ceil((1 - t) * 4) / 4 * 0.5;
        const rr = Math.max(1, Math.round((q.r0 + t * q.grow) * p * view.dpr));
        const bx = Math.round(sx(q.x) * view.dpr), by = Math.round(sy(q.y) * view.dpr);
        view.ctx.save(); view.ctx.setTransform(1, 0, 0, 1, 0, 0); view.ctx.fillRect(bx - rr, by - rr, rr * 2, rr * 2); view.ctx.restore();
        continue;
      }
      view.ctx.globalAlpha = (1 - t) * 0.55;
      view.ctx.beginPath();
      view.ctx.arc(sx(q.x), sy(q.y), (q.r0 + t * q.grow) * p, 0, Math.PI * 2);
      view.ctx.fill();
    }
    view.ctx.globalAlpha = 1;
  }
  return { chips, MAX_CHIPS, addPuffs, addSpray, addSmoke, addDamageSmoke,
    addChips, addSparks, drawChips, drawPuffs };
}
