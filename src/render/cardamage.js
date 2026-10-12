// Car DAMAGE (render.js split, phase 4): dented sprites, shadow silhouette, rolled-car faces.
import { hash2d } from "../core/random.ts";
import { shade } from "../render.js";   // hoisted, only called at draw time (no cycle)
import { SPRITE_PPM } from "./shared.ts";

export function createCarDamage(view) {
  // DAMAGED SPRITES (user, 2026-10-04: "cars should crumple, dent, chip and emit their coloured paint pixels in crashes"): a per-car copy
  // of the sprite, rebuilt only when its damage changes by 0.1 on a corner. Each hurt corner is CRUMPLED (cut back along a jagged
  // diagonal, deeper with damage), DENTED (a darkened band behind the crush) and CHIPPED (paint pixels knocked to grey primer). Seeded per
  // car, so the same car always breaks the same way. Canvas: +x = forward (front at the right), +y = the car's +y (damage.js corners).
  // the TOP-VIEW crush pass (damagedSprite below; the UNDERSIDE when rolled uses it too, without the roof): returns a new canvas
  function crushTop(car, sp, withRoof) {
    const rdKeep = car.roofDmg; if (!withRoof) car.roofDmg = 0;
      const c = document.createElement('canvas'); c.width = sp.c.width; c.height = sp.c.height;
      const cg = c.getContext('2d'); cg.drawImage(sp.c, 0, 0);
      const img = cg.getImageData(0, 0, c.width, c.height), P = img.data, W = c.width, H = c.height, Lp = sp.Lp, Wp = sp.Wp;
      const seed = (car.num || 1) * 2654435761;
      const hsh = hash2d(seed);
      const L = car.crushL, S = car.crushS, endMax = Lp * 0.26, sideMax = Wp * 0.34;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4; if (P[i + 3] === 0) continue;
        const u = Math.min(1, Math.max(0, (x - 2) / Lp)), v = Math.min(1, Math.max(0, (y - 2) / Wp));
        // crush depth of each edge HERE, sloped between its two corners (the hit side deepest)
        const dF = endMax * (L[0] * (1 - v) + L[1] * v), dR = endMax * 0.85 * (L[2] * (1 - v) + L[3] * v);
        const dN = sideMax * (S[2] * (1 - u) + S[0] * u), dP = sideMax * (S[3] * (1 - u) + S[1] * u);
        const eF = W - 3 - x, eR = x - 2, eN = y - 2, eP = H - 3 - y;            // how far this pixel is in from each edge
        const jag = (hsh(x, y >> 1) - 0.5) * 2.2;
        // the most-crushed edge near this pixel decides; a pixel inside its crush is gone (crumpled)
        let best = Infinity, depth = 0;
        // (a crush under ~0.6 art px is not drawn: v2a drew a pale crease round the whole outline from scrapes)
        for (const [e, dd] of [[eF, dF], [eR, dR], [eN, dN], [eP, dP]]) { if (dd < 0.6) continue; const m = e - dd; if (m < best) { best = m; depth = dd; } }
        if (best === Infinity) continue;
        if (best < jag * Math.min(1, depth / 2)) { P[i + 3] = 0; continue; }
        // DENT band behind the fold: clearly dark at the fold, fading over 2 + 1.5 x depth px; a pale crease line at the fold itself
        const band = 2 + 1.5 * depth, t = 1 - best / band;
        if (t > 0) {
          const r = hsh(y, x);
          if (best < 1) { const k = 0.45 + 0.2 * r; P[i] *= k; P[i + 1] *= k; P[i + 2] *= k; continue; }   // the FOLD: a dark crumpled edge
          if (best < 2 && r < 0.35 * Math.min(1, depth / 3)) { P[i] = Math.min(255, P[i] * 0.6 + 110); P[i + 1] = Math.min(255, P[i + 1] * 0.6 + 110); P[i + 2] = Math.min(255, P[i + 2] * 0.6 + 118); continue; }   // a pale crease just inside
          if (r < 0.18 * t + 0.08 * Math.min(1, depth / 3)) { P[i] = 150; P[i + 1] = 150; P[i + 2] = 158; continue; }   // CHIP: primer
          const f = 1 - (0.25 + 0.4 * Math.min(1, depth / 4)) * t * (0.8 + 0.4 * r); P[i] *= f; P[i + 1] *= f; P[i + 2] *= f;   // DENT shade
        }
      }
      // ROOF (a rollover, roll.js -> damage.js roofDmg): the cabin pressed dark, the glass cracked white
      const rd = car.roofDmg || 0;
      if (rd > 0.05) for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
        const i = (y * W + x) * 4; if (P[i + 3] === 0) continue;
        const u = (x - 2) / Lp, v = (y - 2) / Wp; if (u < 0.22 || u > 0.78 || v < 0.15 || v > 0.85) continue;
        const dark = P[i] + P[i + 1] + P[i + 2] < 200, r = hsh(x * 3, y * 5);
        if (dark && r < 0.12 + 0.3 * rd) { P[i] = 225; P[i + 1] = 228; P[i + 2] = 235; continue; }   // cracked glass
        const f = 1 - 0.35 * rd * (0.7 + 0.3 * r); P[i] *= f; P[i + 1] *= f; P[i + 2] *= f;          // crushed roof
      }
      cg.putImageData(img, 0, 0);
    car.roofDmg = rdKeep;
    return c;
  }
  function damagedSprite(car, sp) {
    // v2 (user: "not accurate to the 1/4 damaged", "cars don't dent — they should clearly dent if hit"): every EDGE is pushed in by
    // the crush of its two corners, sloped between them — the front / rear by the END-ON crush (crushL), the sides by the SIDE-ON crush
    // (crushS) — so a hit on the front-left shortens the front on the left and caves the left flank there. Behind the new edge a DENT
    // band (dark, graded, with a pale crease at the fold) that is visible from a light knock up, and chipped paint (primer). Seeded.
    const q = (a) => a.map((x) => Math.round(x * 12)).join(',');
    const key = q(car.crushL) + '|' + q(car.crushS) + '|' + car.wheelOff.map(Number).join('') + '|' + Math.round((car.roofDmg || 0) * 8);
    if (car._dsp && car._dsp.key === key && car._dsp.base === sp) return car._dsp.sp;
    let out = sp;
    if (car.dmg.some((x) => x >= 0.02) || car.roofDmg > 0.05) {
      out = { ...sp, c: crushTop(car, sp, true) };
    }
    car._dsp = { key, base: sp, sp: out };
    return out;
  }
  // SHADOW = a darker copy of the sprite (user, 2026-10-04: "make sure the car shadow is redrawn too / is just a darker copy of the
  // sprite") — so a crumpled corner, a missing wheel or a car on its side casts its own shape. Cached on the canvas it copies.
  function silhouette(cv) {
    if (cv._sil) return cv._sil;
    const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
    const s = c.getContext('2d'); s.drawImage(cv, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = '#14121c'; s.fillRect(0, 0, c.width, c.height);
    cv._sil = c; return c;
  }
  // ROLLED CARS (roll.js): the other faces of the box, generated like the top sprite (art px; x rear -> front as pixelCar).
  const faceCache = new Map(), ROLL_HP = (s) => Math.round(1.4 * SPRITE_PPM);
  function sideSprite(s) {
    const k = 'side:' + s.id + s.paint + s.trim; if (faceCache.has(k)) return faceCache.get(k);
    const Lp = Math.round(s.len * SPRITE_PPM), Hp = ROLL_HP(s), c = document.createElement('canvas'); c.width = Lp + 4; c.height = Hp + 4;
    const g2 = c.getContext('2d'), px = (x, y, w, h, col) => { if (w <= 0 || h <= 0) return; g2.fillStyle = col; g2.fillRect(2 + Math.round(x), 2 + Math.round(y), Math.round(w), Math.round(h)); };
    const P = s.paint || '#d0552f', O = shade(P, 0.4), Dk = shade(P, 0.7), Lt = shade(P, 1.25), GL = '#15171d', GH = '#3d4658';
    const wr = (s.wheelR || 0.3) * SPRITE_PPM, roofY = Hp * 0.08, beltY = Hp * 0.42, sillY = Hp - wr * 1.15;
    const cabA = Lp * (s.kind === 'track' ? 0.3 : 0.25), cabB = Lp * (s.kind === 'estate' ? 0.86 : 0.7);
    px(0, beltY - 1, Lp, sillY - beltY + 2, O); px(1, beltY, Lp - 2, sillY - beltY, P);                  // lower body
    px(cabA - 1, roofY - 1, cabB - cabA + 2, beltY - roofY + 1, O); px(cabA, roofY, cabB - cabA, beltY - roofY, P);   // cabin
    px(cabA + 2, roofY + 2, (cabB - cabA) / 2 - 3, beltY - roofY - 3, GL); px(cabA + (cabB - cabA) / 2 + 1, roofY + 2, (cabB - cabA) / 2 - 3, beltY - roofY - 3, GL);   // windows
    px(cabA + 3, roofY + 3, (cabB - cabA) / 2 - 6, 1, GH);
    px(1, beltY, Lp - 2, 1, Lt); px(1, sillY - 2, Lp - 2, 2, Dk);                                        // waist highlight, sill shade
    px(Lp - 3, beltY + 2, 2, 3, '#fff3c4'); px(1, beltY + 2, 2, 3, '#c8342a');                             // head / tail lights
    for (const ax of [Lp / 2 + s.lf * SPRITE_PPM, Lp / 2 - s.lr * SPRITE_PPM]) { px(ax - wr, Hp - 2 * wr, 2 * wr, 2 * wr, '#16171c'); px(ax - wr / 2, Hp - 1.5 * wr, wr, wr, '#6d707a'); }
    const out = { c, Lp, Hp }; faceCache.set(k, out); return out;
  }
  function underSprite(s) {
    const k = 'under:' + s.id + s.paint + s.trim; if (faceCache.has(k)) return faceCache.get(k);
    const Lp = Math.round(s.len * SPRITE_PPM), Wp = Math.round(s.wid * SPRITE_PPM) | 1, c = document.createElement('canvas'); c.width = Lp + 4; c.height = Wp + 4;
    const g2 = c.getContext('2d'), px = (x, y, w, h, col) => { if (w <= 0 || h <= 0) return; g2.fillStyle = col; g2.fillRect(2 + Math.round(x), 2 + Math.round(y), Math.round(w), Math.round(h)); };
    const P = s.paint || '#d0552f';
    px(0, 1, Lp, Wp - 2, shade(P, 0.35)); px(1, 0, Lp - 2, Wp, shade(P, 0.35)); px(2, 2, Lp - 4, Wp - 4, '#34353b');   // floor pan in a lip of paint
    px(3, Wp * 0.28, Lp - 6, 2, '#4a4c55'); px(3, Wp * 0.72 - 2, Lp - 6, 2, '#4a4c55');                           // chassis rails
    const hw = (s.trackWidth || 1.5) / 2 * SPRITE_PPM, mid = Wp / 2, wr = (s.wheelR || 0.3) * SPRITE_PPM;
    for (const ax of [Lp / 2 + s.lf * SPRITE_PPM, Lp / 2 - s.lr * SPRITE_PPM]) {
      px(ax - 1, mid - hw + 2, 2, 2 * hw - 4, '#5a5d66');                                                         // axle
      for (const sd of [-1, 1]) px(ax - wr, mid + sd * hw - 2, 2 * wr, 4, '#16171c');                           // tyres, edge on
    }
    px(2, mid + 2, Lp * 0.45, 1, '#b9bcc4'); px(1, mid + 1, 3, 3, '#8a8d96');                                   // exhaust to the rear
    px(Lp * 0.3, mid - 4, Lp * 0.18, 8, '#2a2b30');                                                             // fuel tank
    const out = { c, Lp, Wp }; faceCache.set(k, out); return out;
  }
  // a box rolled phi about its long axis, seen from above: each face whose outward normal points up, at its projected place and width
  // (top: centre (H/2) sin, width W cos; underside: -(H/2) sin, W cos; -y side: -(W/2) cos, H sin; +y side: (W/2) cos, -H sin)
  // DAMAGED ROLL FACES (user, 2026-10-04: "cars that have lost their front half still show it when they roll"; "balance it against the
  // compute"): the underside and the two side faces get the car's damage too, built lazily (only once the car rolls) and cached per car
  // and per damage step — nothing per frame. Side face (x rear -> front, y roof -> wheels): its two END corners cut the ends back
  // (crushL), its two SIDE corners dent the panel along the length (crushS), a crushed roof pushes the cabin down, a lost wheel is gone.
  function dmgFace(car, kind) {
    if (!car.dmg) return null;
    const qq = (a) => a.map((x) => Math.round(x * 12)).join(','), key = kind + qq(car.crushL) + qq(car.crushS) + car.wheelOff.map(Number).join('') + Math.round((car.roofDmg || 0) * 8);
    const C = car._dface || (car._dface = {});
    if (C[kind] && C[kind].key === key) return C[kind].out;
    const s = car.spec; let out;
    if (kind === 'under') {
      const u = underSprite(s); out = { ...u, c: crushTop(car, u, false) };
      // a lost wheel: its tyre block gone from the underside
      const g2 = out.c.getContext('2d'), hw = (s.trackWidth || 1.5) / 2 * SPRITE_PPM, mid = u.Wp / 2, wr = (s.wheelR || 0.3) * SPRITE_PPM;
      for (let k = 0; k < 4; k++) if (car.wheelOff[k]) { const ax = u.Lp / 2 + (k < 2 ? s.lf : -s.lr) * SPRITE_PPM; g2.clearRect(2 + ax - wr, 2 + mid + (k % 2 ? 1 : -1) * hw - 2, 2 * wr, 4); }
    } else {
      const sp0 = sideSprite(s), plus = kind === 'sideP', cF = plus ? 1 : 0, cR = plus ? 3 : 2;
      const cv = document.createElement('canvas'); cv.width = sp0.c.width; cv.height = sp0.c.height;
      const g2 = cv.getContext('2d'); g2.drawImage(sp0.c, 0, 0);
      const img = g2.getImageData(0, 0, cv.width, cv.height), P = img.data, W = cv.width, H = cv.height, Lp = sp0.Lp, Hp = sp0.Hp;
      const seed = (car.num || 1) * 40503 + (plus ? 7 : 3);
      const hsh = hash2d(seed);
      const dF = Lp * 0.26 * car.crushL[cF], dR = Lp * 0.22 * car.crushL[cR], rd = car.roofDmg || 0, wr = (s.wheelR || 0.3) * SPRITE_PPM, sill = Hp - wr * 1.15;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4; if (P[i + 3] === 0) continue;
        const u = Math.min(1, Math.max(0, (x - 2) / Lp)), eF = W - 3 - x, eR = x - 2, eT = y - 2, jag = (hsh(x, y >> 1) - 0.5) * 2;
        // a lost wheel: below the sill at that axle
        const axF = Lp / 2 + s.lf * SPRITE_PPM, axR = Lp / 2 - s.lr * SPRITE_PPM;
        if (y - 2 > sill && ((car.wheelOff[cF] && Math.abs(x - 2 - axF) <= wr) || (car.wheelOff[cR] && Math.abs(x - 2 - axR) <= wr))) { P[i + 3] = 0; continue; }
        const cut = Math.min(eF - dF, eR - dR, rd > 0.05 && u > 0.2 && u < 0.85 ? eT - Hp * 0.3 * rd : Infinity);
        if (cut < jag) { P[i + 3] = 0; continue; }
        if (cut < 1) { const k = 0.45 + 0.2 * hsh(y, x); P[i] *= k; P[i + 1] *= k; P[i + 2] *= k; continue; }   // the fold
        const sv = car.crushS[cF] * u + car.crushS[cR] * (1 - u), r = hsh(y, x);
        if (r < 0.28 * sv) { P[i] = 150; P[i + 1] = 150; P[i + 2] = 158; continue; }                        // chips
        const f = 1 - Math.min(0.5, 0.55 * sv + (cut < 4 ? 0.2 * (1 - cut / 4) : 0)) * (0.7 + 0.3 * r); P[i] *= f; P[i + 1] *= f; P[i + 2] *= f;
      }
      g2.putImageData(img, 0, 0); out = { ...sp0, c: cv };
    }
    C[kind] = { key, out };
    return out;
  }
  function rolledFaces(car, sp, phi) {
    const s = car.spec, side = sideSprite(s), under = underSprite(s), W = sp.Wp, H = side.Hp, c = Math.cos(phi), sn = Math.sin(phi), out = [];
    const face = (kind, plain) => (car.dmg ? dmgFace(car, kind) || plain : plain);
    if (c > 0.02) out.push({ cv: sp.c, cy: (H / 2) * sn, ky: c, hh: sp.Wp });
    if (c < -0.02) out.push({ cv: face('under', under).c, cy: -(H / 2) * sn, ky: c, hh: under.Wp });
    if (sn > 0.02) out.push({ cv: face('sideN', side).c, cy: -(W / 2) * c, ky: -sn, hh: side.Hp });
    if (sn < -0.02) out.push({ cv: face('sideP', side).c, cy: (W / 2) * c, ky: -sn, hh: side.Hp });
    return out;
  }
  function drawFaces(faces, Lp, sil, off) {
    for (const f of faces) {
      view.ctx.save(); view.ctx.translate(off, f.cy + off); view.ctx.scale(1, f.ky);
      view.ctx.drawImage(sil ? silhouette(f.cv) : f.cv, -Lp / 2 - 2, -f.hh / 2 - 2);
      view.ctx.restore();
    }
  }

  return { damagedSprite, silhouette, faceCache, rolledFaces, drawFaces };
}
