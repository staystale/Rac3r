// the CARS layer of render.js (phase 4 of the render.js split): the car sprites, damage, rolled faces and
// the two car draw functions. Moved verbatim from createRenderer.
import { hash2d } from "../core/random.ts";
import { shade } from "../render.js";   // a hoisted function, only called at draw time (no load-time cycle)
import { SPRITE_PPM } from "./shared.js";

const CAR_REF_PPM = 22;         // the car is authored at this px/m and scaled as a unit

export function createCars(view, cam, helpers) {
  const { PPMz, sx, sy, roundRect } = helpers;
  // ---------------------------------------------------------------- the car
  function wheel(g, lengthM, widthM, ppm, steer) {
    g.save();
    g.rotate(steer);
    const l = lengthM * ppm, w = widthM * ppm;
    // tyre rubber
    g.fillStyle = '#222328';
    roundRect(g, -l / 2, -w / 2, l, w, Math.min(w / 2, 3));
    g.fill();
    // High-contrast rim/tyre border so tyre silhouette never blends into asphalt
    g.strokeStyle = '#5a5f70';
    g.lineWidth = 1.0;
    g.stroke();

    // Lighter face + rim hint
    g.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(g, -l * 0.28, -w * 0.30, l * 0.56, w * 0.60, 1.5);
    g.fill();

    // Metallic center lock nut
    g.fillStyle = '#b4bac8';
    g.beginPath();
    g.arc(0, 0, Math.min(2.5, w * 0.20), 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // ---------------------------------------------------------------- PIXEL CARS (mock-up)
  // A sprite per car, GENERATED on an integer grid in the reference style (art/reference/car-ref-*.jpg): a 1 px
  // dark outline, flat body colour with one highlight band, black glass, shut lines, mirrors, lights. Drawn once,
  // cached, then rotated as a whole with smoothing off (the classic top-down pixel look). Wheels are separate
  // pixel blocks UNDER the body so the fronts still visibly steer. Front = +x.
  // 3x5 pixel digits for roof numbers (rows top to bottom, 3 bits each). The first Naffcar "18", drawn freehand,
  // read as "IJ" on the review sheet.
  const DIGITS = { 0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [7, 1, 7, 4, 7], 3: [7, 1, 7, 1, 7], 4: [5, 5, 7, 1, 1],
    5: [7, 4, 7, 1, 7], 6: [7, 4, 7, 5, 7], 7: [7, 1, 2, 2, 2], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 7] };
  const spriteCache = new Map();
  function pixelCar(spec) {
    const key = spec.id + '|' + spec.paint + '|' + spec.trim + '|' + (spec.num || 0);   // one sprite per LIVERY (paint, trim, number)
    if (spriteCache.has(key)) return spriteCache.get(key);
    const Lp = Math.round(spec.len * SPRITE_PPM), Wp = Math.round(spec.wid * SPRITE_PPM) | 1;   // odd width: a centre row
    const c = document.createElement('canvas'); c.width = Lp + 4; c.height = Wp + 4;
    const g = c.getContext('2d');
    // px(x, y, w, h, col): one solid block on the art grid. x runs rear (0) -> front (Lp); y is the car's side.
    const px = (x, y, w, h, col) => { if (w <= 0 || h <= 0) return; g.fillStyle = col; g.fillRect(2 + Math.round(x), 2 + Math.round(y), Math.round(w), Math.round(h)); };
    const P = spec.paint, O = shade(P, 0.40), D = shade(P, 0.70), Lt = shade(P, 1.30), Rf = shade(P, 1.10), T = spec.trim || D;
    const GL = '#15171d', GH = '#3d4658', HEAD = '#fff3c4', TAIL = '#c8342a', CHR = '#c9ccd4', WHITE = '#f2f2ee';
    // base id: the AI's 'naffcar#3' too (it was drawn as a plain muscle car)
    const kind = String(spec.id).split('#')[0] === 'naffcar' ? 'stock' : spec.kind, mid = (Wp - 1) / 2, f = (x) => x * Lp;
    // shared: the classic body block — outline, fill, cut corners, top light, bottom shade
    const shell = (inset = 0) => {
      px(0, inset, Lp, Wp - inset * 2, O); px(1, inset + 1, Lp - 2, Wp - inset * 2 - 2, P);
      for (const [x, y] of [[0, inset], [Lp - 1, inset], [0, Wp - 1 - inset], [Lp - 1, Wp - 1 - inset]]) g.clearRect(2 + x, 2 + y, 1, 1);
      px(2, inset + 1, Lp - 4, 2, Lt); px(2, Wp - inset - 3, Lp - 4, 2, D);
    };
    // shared: a glass cabin from x0 (rear glass start) to x3 (windscreen end); r0..r1 is the roof
    const cabin = (x0, r0, r1, x3, roofCol = Rf) => {
      px(x0, 3, r0 - x0, Wp - 6, GL); px(x0 + 1, 4, 1, Wp - 8, GH);                         // rear glass
      px(r0, 2, r1 - r0, Wp - 4, roofCol);                                                  // roof
      px(r0 + 1, 2, r1 - r0 - 2, 1, GL); px(r0 + 1, Wp - 3, r1 - r0 - 2, 1, GL);           // side glass
      for (let i = 0; i < x3 - r1; i++) { const k = 3 + Math.round(i * 0.25); px(r1 + i, k, 1, Wp - k * 2, GL); }   // raked windscreen
      px(r1 + 1, 4, 1, Wp - 8, GH);
      px(r1 + 1, -1, 2, 1, P); px(r1 + 1, Wp, 2, 1, P);                                    // mirrors
      px(r0 + (r1 - r0) * 0.5, 1, 1, 2, O); px(r0 + (r1 - r0) * 0.5, Wp - 3, 1, 2, O);      // door shuts
    };
    // RACE NUMBER (garage livery): a white panel with a dark outline and the digits at scale s (3x5 font), centred at cx along the car,
    // upright when the car points right — drawn where each body has room (the roof; the nose on the open-wheeler; the bonnet on the tractor)
    const NUM = spec.num | 0;
    const numPanel = (cx, s) => {
      const ds = String(NUM).split('').map(Number), nw = ds.length * 3 * s + (ds.length - 1) * s, nh = 5 * s, pw = nw + 2 * s, ph = nh + 2 * s;
      const x0 = Math.round(cx - pw / 2), y0 = Math.round(mid + 0.5 - ph / 2);
      px(x0 - 1, y0 - 1, pw + 2, ph + 2, '#14161b'); px(x0, y0, pw, ph, WHITE);
      ds.forEach((dg, k) => DIGITS[dg].forEach((row, ry) => { for (let b = 0; b < 3; b++) if (row & (4 >> b)) px(x0 + s + k * 4 * s + b * s, y0 + s + ry * s, s, s, '#14161b'); }));
    };
    const lights = () => { px(Lp - 2, 2, 1, 3, HEAD); px(Lp - 2, Wp - 5, 1, 3, HEAD); px(0, 2, 1, 3, TAIL); px(0, Wp - 5, 1, 3, TAIL); };
    if (kind === 'track') {
      // OPEN-WHEEL: narrow tub, long nose, front + rear wings, sidepods, halo cockpit
      const tw = Math.round(Wp * 0.42), ty = Math.round(mid - tw / 2);
      px(0, 1, 5, Wp - 2, O); px(1, 2, 3, Wp - 4, T); px(1, 2, 3, 1, CHR);                // rear wing
      px(Lp - 4, 0, 4, Wp, O); px(Lp - 3, 1, 2, Wp - 2, T); px(Lp - 3, 1, 2, 1, '#e23b2e');   // front wing + flap
      // sidepods: wider than the tub and in BODY colour so the F1 silhouette reads (first cut hid them under the tub)
      px(f(0.16), ty - 5, f(0.28), tw + 10, O); px(f(0.16) + 1, ty - 4, f(0.28) - 2, tw + 8, P);
      px(f(0.16) + 1, ty - 4, f(0.28) - 2, 1, Lt); px(f(0.40) - 2, ty - 4, 2, 2, GL); px(f(0.40) - 2, ty + tw + 2, 2, 2, GL);   // highlight, intakes
      px(4, ty - 1, Lp - 9, tw + 2, O); px(5, ty, Lp - 11, tw, P); px(5, ty, Lp - 11, 1, Lt); // tub
      px(f(0.62), ty + 1, f(0.30), tw - 2, P); px(f(0.62), mid, f(0.30), 1, '#e23b2e');      // nose + stripe
      g.clearRect(2 + Math.round(Lp - 9), 2 + ty, 3, 1); g.clearRect(2 + Math.round(Lp - 9), 2 + ty + tw - 1, 3, 1);   // nose taper
      px(f(0.40), ty + 1, f(0.16), tw - 2, GL); px(f(0.43), mid - 1, 3, 3, '#e4c23a');       // cockpit + helmet
      px(f(0.40), ty, 1, tw, CHR); px(f(0.40), mid, f(0.14), 1, CHR);                       // halo
    } else if (kind === 'tractor') {
      // TRACTOR: cab at the rear half, long louvred bonnet, exhaust stack, mudguards
      shell(2);
      px(f(0.10), 3, f(0.38), Wp - 6, GL); px(f(0.12), 5, f(0.34), Wp - 10, shade(P, 1.15)); // cab roof over glass
      px(f(0.52), 4, f(0.44), Wp - 8, shade(P, 0.92));                                       // bonnet
      for (let x = f(0.56); x < f(0.94); x += 3) px(x, 5, 1, Wp - 10, D);                     // louvres
      px(f(0.60), mid - 1, 3, 3, '#2b2b2b'); px(f(0.61), mid, 1, 1, '#777');                  // exhaust stack
      px(Lp - 2, 3, 1, 3, HEAD); px(Lp - 2, Wp - 6, 1, 3, HEAD);
    } else {
      shell();
      if (kind === 'estate') {
        cabin(f(0.03), f(0.10), f(0.58), f(0.70));
        px(f(0.12), 3, f(0.44), 1, CHR); px(f(0.12), Wp - 4, f(0.44), 1, CHR);                // roof rails
        px(f(0.74), 3, 1, Wp - 6, D); px(1, mid - 3, 3, 7, '#22252c');                         // bonnet shut, tow bar
      } else if (kind === 'muscle') {
        cabin(f(0.16), f(0.26), f(0.48), f(0.60));
        px(f(0.62), mid - 4, Lp - f(0.62) - 2, 2, T); px(f(0.62), mid + 3, Lp - f(0.62) - 2, 2, T);   // twin stripes
        px(f(0.26), mid - 4, f(0.22), 2, T); px(f(0.26), mid + 3, f(0.22), 2, T);
        px(2, mid - 4, f(0.12), 2, T); px(2, mid + 3, f(0.12), 2, T);
        px(f(0.70), mid - 2, f(0.12), 5, O); px(f(0.71), mid - 1, f(0.10), 3, GL);             // bonnet scoop
        px(Lp - 1, 4, 1, Wp - 8, CHR); px(0, 4, 1, Wp - 8, CHR);                               // chrome bumpers
      } else if (kind === 'rally') {
        cabin(f(0.08), f(0.20), f(0.53), f(0.66), WHITE);
        if (!NUM) { px(f(0.30), mid - 2, 5, 5, '#1b1d22'); px(f(0.31), mid - 1, 3, 3, WHITE);  // roof roundel (the number replaces it)
          px(f(0.44), mid - 1, 3, 3, '#30343c'); }                                               // roof vent
        px(f(0.68), 1, f(0.30), 2, T); px(f(0.68), Wp - 3, f(0.30), 2, T);                     // livery
        px(f(0.68), mid, f(0.30), 1, WHITE);
        px(-1, -1, 4, Wp + 2, O); px(0, 0, 2, Wp, T);                                          // rear wing
        px(f(0.18), -1, 3, 1, '#222'); px(f(0.18), Wp, 3, 1, '#222');                          // mud flaps
      } else if (kind === 'saloon') {
        // BMV 3 SERIOUS — the E46's signatures from above (user: "less standard, more like the real counterpart"): a TAPERED nose, two
        // POWER-DOME creases converging on a chrome KIDNEY grille, twin round ANGEL-EYE lamps each side, the bonnet ROUNDEL, a SUNROOF,
        // a short boot deck with its lip, L-shaped TAIL LIGHTS wrapping onto the flanks, silver multi-spoke wheels (spec.rim)
        for (const [x, y] of [[Lp - 1, 0], [Lp - 1, 1], [Lp - 2, 0], [Lp - 1, Wp - 1], [Lp - 1, Wp - 2], [Lp - 2, Wp - 1], [0, 1], [0, Wp - 2]]) g.clearRect(2 + x, 2 + y, 1, 1);   // nose taper
        cabin(f(0.20), f(0.29), f(0.57), f(0.67));
        if (!NUM) { px(f(0.33), 4, f(0.12), Wp - 8, '#1d2128'); px(f(0.34), 5, f(0.10), 1, '#56606e'); }   // SUNROOF + glint (the number takes the roof)
        px(f(0.18), 3, 1, Wp - 6, D); px(f(0.03), 3, f(0.12), 1, Lt);                                  // boot shut, boot lip highlight
        for (let i = 0; i <= f(0.24); i++) { const x = f(0.70) + i, k = Math.round(i * 0.12); px(x, mid - 7 + k, 1, 1, Lt); px(x, mid + 7 - k, 1, 1, D); }   // POWER DOME creases
        px(Lp - 2, mid - 4, 2, 3, CHR); px(Lp - 2, mid + 2, 2, 3, CHR); px(Lp - 1, mid - 3, 1, 1, '#14161b'); px(Lp - 1, mid + 3, 1, 1, '#14161b');   // KIDNEYS
        px(f(0.88), mid - 1, 3, 3, '#14161b'); px(f(0.88) + 1, mid - 1, 1, 1, '#2b6fd6'); px(f(0.88), mid, 1, 1, '#2b6fd6'); px(f(0.88) + 1, mid, 1, 1, WHITE); px(f(0.88), mid - 1, 1, 1, WHITE);   // ROUNDEL
        for (const y of [2, Wp - 4]) { px(Lp - 3, y, 2, 2, HEAD); px(Lp - 6, y + (y < mid ? 1 : 0), 2, 2, HEAD); px(Lp - 4, y, 1, 2, '#2a2d34'); }   // twin ANGEL EYES each side
        for (const y of [0, Wp - 1]) { px(0, y < mid ? 1 : Wp - 6, 1, 5, TAIL); px(1, y, 4, 1, TAIL); }   // L-shaped TAILS
        px(f(0.29), 0, f(0.28), 1, '#2a2d34'); px(f(0.29), Wp - 1, f(0.28), 1, '#2a2d34');             // window trim
      } else if (kind === 'wrz') {
        // SUBAROO WRZ — the 2005 "blob-eye" WRX's signatures from above: the big raised BONNET SCOOP with its dark mesh, big oval
        // BLOB-EYE lamps, a hexagonal GRILLE with the blue STAR badge, fog-lamp pods, FLARED arches at both axles, the tall full-width
        // STI-style BOOT WING on uprights (and its shadow), one fat exhaust, gold wheels (spec.rim)
        const axF = Lp / 2 + spec.lf * SPRITE_PPM, axR = Lp / 2 - spec.lr * SPRITE_PPM;
        for (const ax of [axF, axR]) { px(ax - 6, -1, 12, 1, O); px(ax - 5, -1, 10, 1, D); px(ax - 6, Wp, 12, 1, O); px(ax - 5, Wp, 10, 1, D); }   // ARCH FLARES
        cabin(f(0.21), f(0.30), f(0.57), f(0.67));
        px(f(0.18), 3, 1, Wp - 6, D);
        px(f(0.75), mid - 5, f(0.13), 11, O); px(f(0.76), mid - 4, f(0.11), 9, Lt); px(f(0.77), mid - 3, f(0.08), 7, '#15171d');   // the SCOOP
        for (let x = f(0.77); x < f(0.85); x += 2) px(x, mid - 3, 1, 7, '#2c3038');                                                  // scoop mesh
        for (const y of [1, Wp - 6]) { px(Lp - 5, y, 4, 5, O); px(Lp - 4, y + 1, 3, 3, HEAD); px(Lp - 4, y + 2, 1, 1, '#9aa3b0'); }   // BLOB-EYES
        px(Lp - 1, mid - 4, 1, 9, '#15171d'); px(Lp - 2, mid - 3, 1, 7, '#22252c'); px(Lp - 2, mid - 1, 1, 3, '#2b6fd6'); px(Lp - 2, mid, 1, 1, WHITE);   // GRILLE + STAR
        px(Lp - 1, 2, 1, 2, '#22252c'); px(Lp - 1, Wp - 4, 1, 2, '#22252c');                                                         // fog pods
        px(2, 0, 3, Wp, 'rgba(0,0,0,0.25)');                                                                                          // the wing's shadow
        px(4, -2, 3, Wp + 4, O); px(5, -1, 1, Wp + 2, T); px(4, -2, 3, 1, Lt);                                                        // the BOOT WING (wider than the car)
        px(3, 4, 1, 2, '#2a2d34'); px(3, Wp - 6, 1, 2, '#2a2d34');                                                                    // its uprights
        for (const y of [1, Wp - 4]) px(0, y, 1, 3, TAIL);                                                                            // tails
        px(-1, Wp - 7, 1, 3, CHR); px(-1, Wp - 6, 1, 1, '#1b1d22');                                                                   // the fat exhaust
      } else if (kind === 'mini') {
        // MINNIE COOPED S — the 60s Mini from above: a tiny box with the wheels at the corners, a long glasshouse under a contrasting
        // (trim) ROOF, a short bonnet with twin white STRIPES, a chrome moustache GRILLE, round lamps, the external door + boot hinges
        cabin(f(0.10), f(0.22), f(0.64), f(0.75), T);
        px(f(0.79), mid - 4, Lp - f(0.79) - 2, 2, T); px(f(0.79), mid + 3, Lp - f(0.79) - 2, 2, T);
        px(Lp - 1, mid - 4, 1, 9, CHR); px(Lp - 2, mid - 2, 1, 5, '#2a2c33');
        px(f(0.43), 0, 1, 1, CHR); px(f(0.43), Wp - 1, 1, 1, CHR); px(1, mid - 3, 1, 1, CHR); px(1, mid + 3, 1, 1, CHR);
        px(Lp - 3, 2, 2, 3, HEAD); px(Lp - 3, Wp - 5, 2, 3, HEAD); px(0, 2, 1, 2, TAIL); px(0, Wp - 4, 1, 2, TAIL);
      } else if (kind === 'lambo') {
        // LAMBURGHINI HURRIKAN v2 (photographed v1: "a pickup truck" — a blunt nose, a green louvred bed). The WEDGE: the body TAPERS over
        // the front 30 % to a pointed nose (re-outlined), a dark RAKED CANOPY well forward, a BLACK louvred engine cover behind it, side
        // INTAKES in the flanks, Y-lamps on the tapered nose, a full-width tail bar and a diffuser
        const tz = f(0.30);
        for (let i = 0; i < tz; i++) { const x = Lp - 1 - i, k = Math.round((tz - i) * 0.24);
          if (k > 0) { g.clearRect(2 + x, 2, 1, k); g.clearRect(2 + x, 2 + Wp - k, 1, k); }
          px(x, k, 1, 1, O); px(x, Wp - 1 - k, 1, 1, O); if (k > 0) { px(x, k + 1, 1, 1, Lt); } }
        px(f(0.80), mid, f(0.16), 1, D); px(f(0.74), 4, 1, Wp - 8, D);
        px(f(0.44), 3, f(0.20), Wp - 6, '#15171d'); px(f(0.46), 4, 1, Wp - 8, GH); px(f(0.62), 4, 1, Wp - 8, GH);
        for (let i = 0; i < f(0.08); i++) { const k = 3 + Math.round(i * 0.45); px(f(0.64) + i, k, 1, Wp - k * 2, '#15171d'); }
        px(f(0.48), 2, f(0.12), 1, P); px(f(0.48), Wp - 3, f(0.12), 1, P);
        px(f(0.08), 4, f(0.34), Wp - 8, '#16181d');
        for (let x = f(0.10); x < f(0.40); x += 2) px(x, 5, 1, Wp - 10, '#33363d');
        px(f(0.36), 0, f(0.08), 2, '#16181d'); px(f(0.36), Wp - 2, f(0.08), 2, '#16181d');
        px(f(0.48), -1, 2, 1, P); px(f(0.48), Wp, 2, 1, P);
        const ky = Math.round(f(0.04) * 0.24) + 1;
        px(Lp - f(0.10), ky + 1, 4, 1, HEAD); px(Lp - f(0.10) + 1, ky + 2, 2, 1, HEAD);
        px(Lp - f(0.10), Wp - ky - 2, 4, 1, HEAD); px(Lp - f(0.10) + 1, Wp - ky - 3, 2, 1, HEAD);
        px(0, 3, 1, Wp - 6, TAIL); px(-1, mid - 4, 1, 9, '#16181d'); px(-1, mid - 1, 1, 3, '#55585f');
      } else if (kind === 'mikra') {
        // NISSUN MIKRA R1 — the round 1-litre supermini in rally trim: a bubbly nose, roof VENT, side LIVERY stripes in trim, mud flaps
        for (const [x, y] of [[Lp - 1, 1], [Lp - 2, 0], [Lp - 1, Wp - 2], [Lp - 2, Wp - 1], [0, 1], [0, Wp - 2]]) g.clearRect(2 + x, 2 + y, 1, 1);
        cabin(f(0.08), f(0.18), f(0.56), f(0.68));
        px(f(0.42), mid - 1, 3, 3, '#30343c');
        px(f(0.06), 1, f(0.88), 1, T); px(f(0.06), Wp - 2, f(0.88), 1, T); px(f(0.72), mid, f(0.24), 1, T);
        px(f(0.18), -1, 2, 1, '#222'); px(f(0.18), Wp, 2, 1, '#222');
      } else if (kind === 'kit') {
        // PUGEOT 306 MAXXI — the kit car: huge ARCH FLARES both axles, bonnet VENTS, a four-lamp POD on the nose, a diagonal livery band,
        // a small boot spoiler
        const axF = Lp / 2 + spec.lf * SPRITE_PPM, axR = Lp / 2 - spec.lr * SPRITE_PPM;
        for (const ax of [axF, axR]) { px(ax - 7, -2, 14, 2, O); px(ax - 6, -1, 12, 1, D); px(ax - 7, Wp, 14, 2, O); px(ax - 6, Wp, 12, 1, D); }
        cabin(f(0.12), f(0.22), f(0.55), f(0.68));
        px(f(0.74), mid - 5, f(0.08), 2, GL); px(f(0.74), mid + 4, f(0.08), 2, GL);
        for (let i = 0; i < 4; i++) { px(Lp - 3, mid - 7 + i * 4, 2, 3, HEAD); px(Lp - 3, mid - 6 + i * 4, 1, 1, '#9aa3b0'); }
        px(f(0.80), 2, 3, Wp - 4, T); px(f(0.84), 2, 1, Wp - 4, '#f0f0ea'); px(f(0.86), 2, 2, Wp - 4, T);
        px(0, 1, 2, Wp - 2, O); px(0, 2, 1, Wp - 4, T);
      } else if (kind === 'rxcar') {
        // FJORD FIESTER RX — a supermini on steroids: flares, a big ROOF SCOOP, a front SPLITTER, a twin-plane WING wider than the body
        const axF = Lp / 2 + spec.lf * SPRITE_PPM, axR = Lp / 2 - spec.lr * SPRITE_PPM;
        for (const ax of [axF, axR]) { px(ax - 7, -2, 14, 2, O); px(ax - 6, -1, 12, 1, P); px(ax - 7, Wp, 14, 2, O); px(ax - 6, Wp, 12, 1, P); }
        cabin(f(0.10), f(0.20), f(0.52), f(0.64));
        px(f(0.25), mid - 2, f(0.10), 5, O); px(f(0.26), mid - 1, f(0.08), 3, GL);
        px(f(0.66), 2, f(0.30), 2, T); px(f(0.66), Wp - 4, f(0.30), 2, T);
        px(Lp, -1, 1, Wp + 2, '#16181d');
        px(1, 0, 3, Wp, 'rgba(0,0,0,0.25)'); px(-2, -3, 4, Wp + 6, O); px(-1, -2, 2, Wp + 4, T); px(-2, -3, 4, 1, Lt);
      } else if (kind === 'banger') {
        // BRISKA F2 STOCKER — a saloon shell in a steel cage: massive front + rear BUMPERS (wider than the car), NERF RAILS down both sides,
        // the ROOF in the grade colour (trim), a wire mesh where the windscreen was
        cabin(f(0.18), f(0.28), f(0.60), f(0.70), T);
        for (let x = f(0.61); x < f(0.70); x += 2) px(x, 3, 1, Wp - 6, '#55585f');
        px(Lp, -2, 2, Wp + 4, '#3a3d45'); px(Lp + 1, -2, 1, Wp + 4, '#55585f');
        px(-2, -2, 2, Wp + 4, '#3a3d45'); px(-2, -2, 1, Wp + 4, '#55585f');
        px(f(0.22), -1, f(0.56), 1, '#3a3d45'); px(f(0.22), Wp, f(0.56), 1, '#3a3d45');
      } else if (kind === 'grass') {
        // AUTOGRASS SPECIAL — a space-frame buggy: an open TUB, the engine bay behind the driver (block + filter), the ROLL CAGE as chrome
        // bars round the seat, a helmet, a nose with a number board
        px(f(0.08), mid - 5, f(0.27), 11, '#3a3d45'); px(f(0.12), mid - 3, f(0.12), 7, '#55585f'); px(f(0.27), mid - 2, 3, 5, '#d23b2a');
        px(f(0.40), mid - 6, f(0.26), 13, GL); px(f(0.46), mid - 4, f(0.12), 9, '#22252c'); px(f(0.50), mid - 1, 3, 3, '#e4c23a');
        px(f(0.38), 3, 1, Wp - 6, CHR); px(f(0.66), 3, 1, Wp - 6, CHR); px(f(0.38), 3, f(0.28), 1, CHR); px(f(0.38), Wp - 4, f(0.28) + 1, 1, CHR);
        px(f(0.39), mid, f(0.27), 1, CHR);
        px(Lp - 3, 3, 1, 3, HEAD); px(Lp - 3, Wp - 6, 1, 3, HEAD);
      } else if (kind === 'drift') {
        // NISSUN SYLVYA S13 D — the 90s coupe: closed POP-UP lamps (dark lids), bonnet VENTS, a big ducktail SPOILER, side stickers in trim,
        // a red TOW STRAP on the nose
        cabin(f(0.14), f(0.26), f(0.55), f(0.66));
        px(Lp - 5, 2, 3, 3, O); px(Lp - 5, Wp - 5, 3, 3, O);
        px(f(0.76), mid - 4, f(0.08), 1, GL); px(f(0.76), mid + 3, f(0.08), 1, GL);
        px(f(0.30), 0, f(0.2), 1, T); px(f(0.30), Wp - 1, f(0.2), 1, T); px(f(0.72), 1, f(0.06), 1, T); px(f(0.72), Wp - 2, f(0.06), 1, T);
        px(0, 1, 3, Wp - 2, O); px(1, 2, 1, Wp - 4, T);
        px(Lp - 1, mid + 4, 1, 3, '#d23b2a');
        for (const y of [1, Wp - 4]) px(0, y, 1, 3, TAIL);
      } else if (kind === 'stock') {
        // NAFFCAR stock car: wide slab, big roof number, sponsor panels, window net
        cabin(f(0.18), f(0.28), f(0.54), f(0.64));
        // roof number "42": a white panel, digits UPRIGHT when the car points right (heading 0) — row -> down, bit -> across
        if (!NUM) { px(f(0.29), mid - 4, 11, 9, WHITE);
          [4, 2].forEach((dg, k) => DIGITS[dg].forEach((row, ry) => { for (let b = 0; b < 3; b++) if (row & (4 >> b)) px(f(0.29) + 1 + k * 5 + b, mid - 2 + ry, 1, 1, '#111'); })); }
        px(f(0.66), 2, f(0.30), 3, '#1d3f8f'); px(f(0.66), Wp - 5, f(0.30), 3, '#1d3f8f');     // sponsor panels
        px(f(0.04), 2, f(0.12), 2, '#d23b2a'); px(f(0.04), Wp - 4, f(0.12), 2, '#d23b2a');
        for (let x = f(0.30); x < f(0.52); x += 2) px(x, 1, 1, 1, '#111');                     // window net
        px(-1, 2, 2, Wp - 4, O);                                                                // spoiler lip
      } else {
        // HATCH (both the FWD and the RWD — the paint is the difference, as in the game)
        cabin(f(0.08), f(0.20), f(0.53), f(0.66));
        px(f(0.70), 3, 1, Wp - 6, D); px(f(0.05), 3, 1, Wp - 6, D);                            // bonnet + hatch shuts
        px(Lp - 1, 5, 1, Wp - 10, '#2a2c33');                                                  // grille
      }
      // the saloons + the new bodies with their own lamps draw them (angel eyes, blob-eyes, the Mini's rounds, the Lambo's Ys, pop-ups)
      if (!['saloon', 'wrz', 'mini', 'lambo', 'drift', 'grass'].includes(kind)) lights();
    }
    if (NUM) { const at = { mini: [0.43, 2], lambo: [0.84, 1], mikra: [0.37, 2], kit: [0.385, 2], rxcar: [0.36, 2], banger: [0.44, 2], grass: [0.84, 1], drift: [0.405, 2], track: [0.76, 1], tractor: [0.78, 2], estate: [0.34, 2], muscle: [0.37, 2], stock: [0.41, 2], saloon: [0.43, 2], wrz: [0.435, 2] }[kind] || [0.365, 2]; numPanel(f(at[0]), at[1]); }
    const out = { c, Lp, Wp };
    spriteCache.set(key, out);
    return out;
  }
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
  function drawPixelCar(car) {
    const s = car.spec, sp0 = pixelCar(s), sp = car.dmg ? damagedSprite(car, sp0) : sp0, u = PPMz() / SPRITE_PPM;
    view.ctx.save();
    view.ctx.translate(sx(car.x), sy(car.y));
    view.ctx.rotate(car.heading);
    view.ctx.scale(u, u);
    // shadow: a darker copy of the sprite, offset down-right by the car's ride height (cars.js rideH)
    const shOff = 2 + Math.round((s.rideH || 0.13) * 10);
    if (car.roll && car.roll.phi) {
      const faces = rolledFaces(car, sp, car.roll.phi);
      view.ctx.globalAlpha = 0.3; drawFaces(faces, sp.Lp, true, shOff + 2); view.ctx.globalAlpha = 1;
      drawFaces(faces, sp.Lp, false, 0);
      view.ctx.restore();
      return;
    }
    view.ctx.globalAlpha = 0.3; view.ctx.drawImage(silhouette(sp.c), -sp.Lp / 2 - 2 + shOff, -sp.Wp / 2 - 2 + shOff); view.ctx.globalAlpha = 1;
    // wheels: pixel blocks, the fronts turned by the steering angle
    const tyreL = s.kind === 'track' ? 14 : s.kind === 'tractor' ? 15 : 11, tyreW = s.kind === 'track' ? 6 : 4;
    // at the body's EDGE so they poke out at the sides like the reference sprites (pass 1 hid them under the body)
    const hw = Math.max((s.trackWidth || 1.5) / 2 * SPRITE_PPM, sp.Wp / 2) + (s.kind === 'track' ? 1 : 0);
    for (const [ax, side, st, ci] of [[s.lf, -1, car.delta, 0], [s.lf, 1, car.delta, 1], [-s.lr, -1, 0, 2], [-s.lr, 1, 0, 3]]) {
      if (car.wheelOff && car.wheelOff[ci]) { view.ctx.fillStyle = '#2b2d33'; view.ctx.fillRect(Math.round(ax * SPRITE_PPM) - 2, Math.round(side * hw) - 1, 4, 2); continue; }   // DAMAGE: wheel gone, a hub stub
      view.ctx.save();
      view.ctx.translate(Math.round(ax * SPRITE_PPM), Math.round(side * hw));
      view.ctx.rotate(st);
      const big = s.kind === 'tractor' && ax < 0;                     // tractor: huge rear wheels, yellow rims
      const tl = big ? 20 : tyreL, tw = big ? 7 : tyreW;
      view.ctx.fillStyle = '#16171c'; view.ctx.fillRect(-tl / 2, -tw / 2, tl, tw);
      view.ctx.fillStyle = '#3a3d47'; view.ctx.fillRect(-tl / 2 + 2, -tw / 2, tl - 4, 1);
      if (s.kind === 'tractor') { view.ctx.fillStyle = '#fbc02d'; view.ctx.fillRect(-2, -1, 4, 2); }
      else if (s.rim) { view.ctx.fillStyle = s.rim; view.ctx.fillRect(-2, -1, 4, 2); }   // coloured wheels (the Subaroo's gold)
      view.ctx.restore();
    }
    view.ctx.drawImage(sp.c, -sp.Lp / 2 - 2, -sp.Wp / 2 - 2);
    // DAMAGE (damage.js): a dark crushed block on each hurt corner, growing with the damage, a pale crease along its edge; a punctured
    // wheel shows a bright rim. Squares, not curves (pixel rule).
    if (car.punct) for (let c = 0; c < 4; c++) {
      if (car.punct[c]) { view.ctx.fillStyle = '#c9c9d2'; view.ctx.fillRect(Math.round((c < 2 ? s.lf : -s.lr) * SPRITE_PPM) - 2, Math.round((c % 2 ? 1 : -1) * hw) - 1, 4, 2); }
    }
    // brake lights glow when braking (a live overlay on the sprite)
    // HEADLIGHTS (user, 2026-10-04: "all cars have working headlights"): two soft beams ahead (drawn in the car's frame, art px), brighter
    // lamps; INDICATORS: amber at the front + rear corners of that side, blinking ~1.5 Hz (wall clock)
    // LAMPS BREAK WITH DAMAGE (user, 2026-10-04: "headlights should vanish with damage appropriately"): every lamp lives on its corner
    // (damage.js: 0 front -y, 1 front +y, 2 rear -y, 3 rear +y). Full up to LAMP_OK, then it flickers and dims, out from LAMP_GONE
    // (~a 25-30 km/h head-on on that corner). Headlight beam + lamp, brake light and indicator alike.
    const LAMP_OK = 0.15, LAMP_GONE = 0.35;
    const lamp = (c) => {
      const d = car.dmg ? car.dmg[c] : 0;
      if (d <= LAMP_OK) return 1;
      if (d >= LAMP_GONE) return 0;
      const k = 1 - (d - LAMP_OK) / (LAMP_GONE - LAMP_OK);
      return Math.random() < 0.1 + 0.5 * (1 - k) ? 0 : k;
    };
    if (car.lightsOn) {
      for (const [y, cn] of [[-sp.Wp / 2 + 4, 0], [sp.Wp / 2 - 4, 1]]) {
        const lk = lamp(cn);
        if (!lk) continue;
        const gr = view.ctx.createLinearGradient(sp.Lp / 2, 0, sp.Lp / 2 + 190, 0); gr.addColorStop(0, 'rgba(255,244,200,' + (0.34 * lk).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,244,200,0)');
        view.ctx.fillStyle = gr; view.ctx.beginPath(); view.ctx.moveTo(sp.Lp / 2 - 1, y - 2); view.ctx.lineTo(sp.Lp / 2 + 190, y - 34 + (y > 0 ? 30 : 0)); view.ctx.lineTo(sp.Lp / 2 + 190, y + 34 - (y < 0 ? 30 : 0)); view.ctx.lineTo(sp.Lp / 2 - 1, y + 2); view.ctx.closePath(); view.ctx.fill();
        view.ctx.fillStyle = '#fffbe6'; view.ctx.fillRect(sp.Lp / 2 - 3, y - 2, 3, 4);
      }
    }
    // HAZARDS (car.hazard, a crashed traffic car): both sides at once
    if ((car.indicator || car.hazard) && Math.floor(performance.now() / 333) % 2 === 0) for (const ind of car.hazard ? [-1, 1] : [car.indicator]) {
      const y = ind < 0 ? -sp.Wp / 2 : sp.Wp / 2 - 3; view.ctx.fillStyle = '#ffa630';
      const sd = ind < 0 ? 0 : 1;
      if (lamp(sd)) view.ctx.fillRect(sp.Lp / 2 - 4, y, 3, 3);
      if (lamp(sd + 2)) view.ctx.fillRect(-sp.Lp / 2 + 1, y, 3, 3);
    }
    if (car.brakeLight > 0.05) {
      view.ctx.fillStyle = '#ff4a3a';
      if (lamp(2)) view.ctx.fillRect(-sp.Lp / 2, -sp.Wp / 2 + 2, 2, 3);
      if (lamp(3)) view.ctx.fillRect(-sp.Lp / 2, sp.Wp / 2 - 5, 2, 3);
    }
    view.ctx.restore();
  }

  function drawCar(car, wallT) {
    const s = car.spec;
    const px = sx(car.x), py = sy(car.y);
    const L = s.len, Wd = s.wid;

    view.ctx.save();
    view.ctx.translate(px, py);
    view.ctx.rotate(car.heading);          // +x is forward, +y is the car's right

    // THE WHOLE CAR IS DRAWN AT A FIXED REFERENCE SCALE and then transformed to size.
    //
    // MEASURED BUG, 2026-09-28 (user: "the details on it still morph with zoom"). The body outline was
    // built from metres x ppm, but the DETAIL — shut lines, lights, mirrors, wing thickness, corner
    // radii, stroke widths — was written in raw pixels. So as the camera zoomed the shell scaled and
    // the details did not, and the car visibly changed proportion. Fixing the literals one by one would
    // have missed some; scaling the canvas instead means nothing CAN be missed, now or later.
    // HEIGHT: a top-down view has no vertical axis, so the cues are SIZE and SHADOW SEPARATION — the
    // car rides up toward the camera and its shadow slides out from under it.
    //
    // REWRITTEN 2026-09-28 (user: "jumping over the jump looks weird and poor... it should be small,
    // and it should be more of a feeling"). This used to read a jump TIMER and play a sine arc off it,
    // which is exactly why it read as an animation. It now reads car.z — the body's actual height in
    // metres, out of the suspension — so the picture is a readout of the physics and nothing else. A
    // kerb gives a few centimetres and barely changes the size; the shadow is what you notice. Only a
    // real launch gets big, and then it gets big because the car really is up there.
    const lift = Math.max(0, Math.min(1, car.z / 0.7));
    const u = (PPMz() / CAR_REF_PPM) * (1 + lift * 0.10);
    view.ctx.scale(u, u);
    const ppm = CAR_REF_PPM;   // everything below is authored at this scale and scaled as a whole
    const half = (Wd / 2) * ppm;
    const nose = (L / 2) * ppm, tail = -(L / 2) * ppm;

    // ---- contact shadow. MEASURED BUG, 2026-09-27 (photographed): this un-rotated the context so the
    // shadow stayed axis-aligned to the WORLD, and a cornering car trailed a grey slab at a completely
    // different angle to its own body. The shadow keeps the car's shape and rotation; only the light
    // DIRECTION is fixed, so the offset is rotated into car space instead.
    const lightWx = 3.5 + lift * 16, lightWy = 4.5 + lift * 20;   // shadow falls away as the car rises
    const ox = lightWx * Math.cos(-car.heading) - lightWy * Math.sin(-car.heading);
    const oy = lightWx * Math.sin(-car.heading) + lightWy * Math.cos(-car.heading);
    view.ctx.save();
    view.ctx.fillStyle = lift > 0.02 ? 'rgba(28,26,36,' + (0.17 + lift * 0.12).toFixed(3) + ')' : 'rgba(28,26,36,0.17)';
    roundRect(view.ctx, tail + ox, -half * 0.98 + oy, nose - tail, half * 1.96, 7);
    view.ctx.fill();
    view.ctx.restore();

    // Wheels sit at the body edge, drawn UNDER the bodywork. MEASURED BUG, 2026-09-28 (user:
    // "rally cars front wheels do not look like they turn"): the wheels sit at trackWidth/2, which is
    // INSIDE the bodywork, so they were almost entirely hidden — and the rally car's new arch
    // extensions covered the last sliver. Which way the front wheels point is the single most important
    // readability cue in a top-down driving game (it is written in the header of this file), so it
    // cannot be something the bodywork is allowed to hide.
    const drawWheels = () => {
      const isTrack = s.kind === 'track';
      const vhw = Math.max((s.trackWidth / 2) * ppm, half * (isTrack ? 1.05 : 1.0));
      for (const [ax, side, st] of [
        [s.lf, -1, car.delta], [s.lf, 1, car.delta], [-s.lr, -1, 0], [-s.lr, 1, 0],
      ]) {
        const curWw = isTrack ? (ax > 0 ? 0.31 : 0.42) : 0.26;
        const curWl = isTrack ? (ax > 0 ? 0.72 : 0.76) : 0.72;
        view.ctx.save();
        view.ctx.translate(ax * ppm, side * vhw);
        wheel(view.ctx, curWl, curWw, ppm, st);
        view.ctx.restore();
      }
    };

    // ---- body roll and pitch: shift the shell a whisker against the wheels using the accelerations we
    //      already compute. Costs two lines and sells the weight of the car (§4: surface state you are
    //      already computing).
    const rollPx = Math.max(-2.2, Math.min(2.2, (car.t.ay || 0) * 0.06));
    const pitchPx = Math.max(-2.2, Math.min(2.2, -(car.t.ax || 0) * 0.06));
    view.ctx.translate(pitchPx, rollPx);

    drawWheels();     // UNDER the bodywork — see the note above drawWheels

    const kind = s.kind;
    const bodyR = kind === 'track' ? 3 : 5;

    // ---- silhouette. Each kind gets its own proportions; `track` is authentic open-wheel F1.
    if (kind === 'track') {
      const vhw = Math.max((s.trackWidth / 2) * ppm, half * 1.05);
      // 1. Suspension wishbones: bright metallic graphite with high contrast
      view.ctx.strokeStyle = '#787e90';
      view.ctx.lineWidth = 1.6;
      for (const [ax, side] of [
        [s.lf, -1], [s.lf, 1], [-s.lr, -1], [-s.lr, 1],
      ]) {
        const wx = ax * ppm, wy = side * vhw;
        view.ctx.beginPath();
        view.ctx.moveTo(ax * ppm * 0.45, side * half * 0.35);
        view.ctx.lineTo(wx, wy);
        view.ctx.moveTo(ax * ppm * 1.05, side * half * 0.35);
        view.ctx.lineTo(wx, wy);
        view.ctx.stroke();
      }

      // 2. Sculpted Monocoque Tub + Sidepods (Coke-bottle aerodynamic tapering)
      const tubHalf = half * 0.36;
      const podHalf = half * 0.76;
      view.ctx.fillStyle = s.paint;
      view.ctx.beginPath();
      view.ctx.moveTo(nose * 0.95, 0);
      view.ctx.lineTo(nose * 0.45, -tubHalf);
      view.ctx.lineTo(nose * 0.10, -podHalf);
      view.ctx.lineTo(tail * 0.40, -podHalf * 0.95);
      view.ctx.lineTo(tail * 0.75, -tubHalf * 1.1);
      view.ctx.lineTo(tail * 0.95, -tubHalf * 0.85);
      view.ctx.lineTo(tail * 0.95, tubHalf * 0.85);
      view.ctx.lineTo(tail * 0.75, tubHalf * 1.1);
      view.ctx.lineTo(tail * 0.40, podHalf * 0.95);
      view.ctx.lineTo(nose * 0.10, podHalf);
      view.ctx.lineTo(nose * 0.45, tubHalf);
      view.ctx.closePath();
      view.ctx.fill();
      view.ctx.strokeStyle = '#323642';
      view.ctx.lineWidth = 1.8;
      view.ctx.stroke();

      // Livery racing stripe
      view.ctx.fillStyle = '#e03434';
      view.ctx.fillRect(tail * 0.70, -2, (nose - tail) * 0.75, 4);

      // 3. Sidepod radiator dark inlets
      view.ctx.fillStyle = '#14151a';
      view.ctx.fillRect(nose * 0.08, -podHalf + 1, ppm * 0.22, podHalf * 0.28);
      view.ctx.fillRect(nose * 0.08, podHalf * 0.72 - 1, ppm * 0.22, podHalf * 0.28);

      // 4. Front multi-element aerodynamic wing with endplates
      view.ctx.fillStyle = '#2a2d36';
      roundRect(view.ctx, nose * 0.90, -half * 0.98, ppm * 0.28, half * 1.96, 2);
      view.ctx.fill();
      view.ctx.strokeStyle = '#62687a';
      view.ctx.lineWidth = 1.2;
      view.ctx.stroke();

      // Front wing red cascade flap
      view.ctx.fillStyle = '#e03434';
      roundRect(view.ctx, nose * 0.82, -half * 0.92, ppm * 0.10, half * 1.84, 1);
      view.ctx.fill();

      // Front wing endplates (bright border so they pop against asphalt)
      view.ctx.fillStyle = '#181920';
      roundRect(view.ctx, nose * 0.76, -half * 1.01, ppm * 0.42, 2.5, 1);
      view.ctx.fill();
      view.ctx.strokeStyle = '#ffffff';
      view.ctx.lineWidth = 1;
      view.ctx.stroke();

      roundRect(view.ctx, nose * 0.76, half * 0.98, ppm * 0.42, 2.5, 1);
      view.ctx.fill();
      view.ctx.strokeStyle = '#ffffff';
      view.ctx.lineWidth = 1;
      view.ctx.stroke();

      // 5. Massive rear dual-element wing with endplates & rain light
      view.ctx.fillStyle = '#2a2d36';
      roundRect(view.ctx, tail * 0.92, -half * 0.98, ppm * 0.35, half * 1.96, 2);
      view.ctx.fill();
      view.ctx.strokeStyle = '#62687a';
      view.ctx.lineWidth = 1.2;
      view.ctx.stroke();

      // Rear wing DRS flap
      view.ctx.fillStyle = '#e03434';
      roundRect(view.ctx, tail * 0.82, -half * 0.92, ppm * 0.12, half * 1.84, 1);
      view.ctx.fill();

      // Rear wing endplates
      view.ctx.fillStyle = '#181920';
      roundRect(view.ctx, tail * 1.02, -half * 1.01, ppm * 0.50, 2.5, 1);
      view.ctx.fill();
      view.ctx.strokeStyle = '#ffffff';
      view.ctx.lineWidth = 1;
      view.ctx.stroke();

      roundRect(view.ctx, tail * 1.02, half * 0.98, ppm * 0.50, 2.5, 1);
      view.ctx.fill();
      view.ctx.strokeStyle = '#ffffff';
      view.ctx.lineWidth = 1;
      view.ctx.stroke();

      // Rear red LED rain / hazard safety light
      view.ctx.fillStyle = '#ff2222';
      view.ctx.beginPath();
      view.ctx.arc(tail * 0.98, 0, 2.5, 0, Math.PI * 2);
      view.ctx.fill();

      // 6. Cockpit, Halo structure & Driver Helmet
      view.ctx.fillStyle = '#15161c';
      view.ctx.beginPath();
      view.ctx.ellipse(-ppm * 0.08, 0, ppm * 0.38, tubHalf * 0.75, 0, 0, Math.PI * 2);
      view.ctx.fill();

      view.ctx.fillStyle = '#f0c030';
      view.ctx.beginPath();
      view.ctx.arc(-ppm * 0.10, 0, ppm * 0.18, 0, Math.PI * 2);
      view.ctx.fill();
      view.ctx.fillStyle = '#1c2230';
      view.ctx.fillRect(-ppm * 0.04, -ppm * 0.10, ppm * 0.08, ppm * 0.20);

      view.ctx.strokeStyle = '#282930';
      view.ctx.lineWidth = 2.2;
      view.ctx.beginPath();
      view.ctx.moveTo(-ppm * 0.32, -tubHalf * 0.7);
      view.ctx.lineTo(ppm * 0.14, 0);
      view.ctx.lineTo(-ppm * 0.32, tubHalf * 0.7);
      view.ctx.stroke();

      // Engine airbox scoop above driver head
      view.ctx.fillStyle = '#1c1d24';
      view.ctx.beginPath();
      view.ctx.ellipse(tail * 0.36, 0, ppm * 0.16, tubHalf * 0.45, 0, 0, Math.PI * 2);
      view.ctx.fill();
    } else {
      // a proper car shell: slightly narrower at the nose, rounded, with a gradient across the width
      view.ctx.beginPath();
      view.ctx.moveTo(nose - 4, -half * 0.88);
      view.ctx.quadraticCurveTo(nose, -half * 0.88, nose, -half * 0.62);
      view.ctx.lineTo(nose, half * 0.62);
      view.ctx.quadraticCurveTo(nose, half * 0.88, nose - 4, half * 0.88);
      view.ctx.lineTo(tail + 4, half * 0.96);
      view.ctx.quadraticCurveTo(tail, half * 0.96, tail, half * 0.7);
      view.ctx.lineTo(tail, -half * 0.7);
      view.ctx.quadraticCurveTo(tail, -half * 0.96, tail + 4, -half * 0.96);
      view.ctx.closePath();
      const bg = view.ctx.createLinearGradient(0, -half, 0, half);
      bg.addColorStop(0, shade(s.paint, 1.16));
      bg.addColorStop(0.42, s.paint);
      bg.addColorStop(1, shade(s.paint, 0.74));
      view.ctx.fillStyle = bg;
      view.ctx.fill();
      // DARK RIM (§4) — this is what stops the car dissolving into a pale floor
      view.ctx.strokeStyle = shade(s.paint, 0.45);
      view.ctx.lineWidth = 1.8;
      view.ctx.stroke();

      // greenhouse: windscreen, roof, rear screen. Proportions carry the archetype.
      const cabF = kind === 'muscle' ? 0.02 : kind === 'estate' ? 0.20 : 0.16;
      const cabR = kind === 'estate' ? -0.44 : kind === 'muscle' ? -0.40 : -0.36;
      const gh = half * 0.74;
      view.ctx.fillStyle = s.glass;
      view.ctx.beginPath();
      view.ctx.moveTo(L * cabF * ppm, -gh * 0.80);
      view.ctx.lineTo(L * cabF * ppm + 3, gh * 0.80);
      view.ctx.lineTo(L * cabR * ppm, gh);
      view.ctx.lineTo(L * cabR * ppm, -gh);
      view.ctx.closePath();
      view.ctx.fill();
      // roof panel in body colour over the middle of the greenhouse
      view.ctx.fillStyle = shade(s.paint, 1.04);
      const rf = L * (cabF - 0.06) * ppm, rr = L * (cabR + 0.06) * ppm;
      roundRect(view.ctx, rr, -gh * 0.92, rf - rr, gh * 1.84, 3);
      view.ctx.fill();
      view.ctx.strokeStyle = shade(s.paint, 0.55); view.ctx.lineWidth = 1; view.ctx.stroke();

      // estate roof rails — the silhouette cue that says "estate" at a glance
      if (kind === 'estate') {
        view.ctx.fillStyle = shade(s.paint, 0.6);
        roundRect(view.ctx, L * cabR * ppm, -gh * 0.95, (L * cabF - L * cabR) * ppm, 2, 1); view.ctx.fill();
        roundRect(view.ctx, L * cabR * ppm, gh * 0.95 - 2, (L * cabF - L * cabR) * ppm, 2, 1); view.ctx.fill();
      }
      // RALLY: roof scoop, bonnet vents, a big rear wing and arch extensions. The silhouette has to say
      // "rally car" at phone size, so it is all read from the outline rather than from detail.
      if (kind === 'rally') {
        // wide arch extensions, front and rear
        view.ctx.fillStyle = shade(s.paint, 0.62);
        for (const ax of [s.lf * ppm, -s.lr * ppm]) {
          roundRect(view.ctx, ax - 9, -half * 1.06, 18, half * 0.22, 2); view.ctx.fill();
          roundRect(view.ctx, ax - 9, half * 0.84, 18, half * 0.22, 2); view.ctx.fill();
        }
        // rear wing on end plates, clear of the body
        view.ctx.fillStyle = shade(s.paint, 0.5);
        roundRect(view.ctx, tail + 1, -half * 1.02, 6, half * 2.04, 2); view.ctx.fill();
        view.ctx.fillStyle = s.trim;
        roundRect(view.ctx, tail + 0, -half * 1.02, 3, 5, 1); view.ctx.fill();
        roundRect(view.ctx, tail + 0, half * 1.02 - 5, 3, 5, 1); view.ctx.fill();
        // roof scoop
        view.ctx.fillStyle = shade(s.paint, 0.55);
        roundRect(view.ctx, L * 0.04 * ppm, -half * 0.22, 10, half * 0.44, 2); view.ctx.fill();
        // bonnet vents
        view.ctx.fillStyle = 'rgba(24,22,30,0.55)';
        roundRect(view.ctx, nose - 17, -half * 0.42, 7, half * 0.20, 1); view.ctx.fill();
        roundRect(view.ctx, nose - 17, half * 0.22, 7, half * 0.20, 1); view.ctx.fill();
        // bonnet light pod
        view.ctx.fillStyle = '#fff4d2';
        roundRect(view.ctx, nose - 11, -half * 0.30, 5, half * 0.60, 2); view.ctx.fill();
      }
      // muscle car bonnet stripes + scoop
      if (kind === 'muscle') {
        view.ctx.fillStyle = 'rgba(28,26,32,0.55)';
        roundRect(view.ctx, L * 0.06 * ppm, -half * 0.30, nose - L * 0.06 * ppm - 2, half * 0.16, 1); view.ctx.fill();
        roundRect(view.ctx, L * 0.06 * ppm, half * 0.14, nose - L * 0.06 * ppm - 2, half * 0.16, 1); view.ctx.fill();
        view.ctx.fillStyle = shade(s.paint, 0.5);
        roundRect(view.ctx, L * 0.16 * ppm, -half * 0.34, 8, half * 0.68, 2); view.ctx.fill();
      }
      // tractor: wide rear fenders, yellow front grille, exhaust stack
      if (kind === 'tractor') {
        view.ctx.fillStyle = shade(s.paint, 0.65);
        roundRect(view.ctx, -s.lr * ppm - 10, -half * 1.08, 22, half * 0.32, 2); view.ctx.fill();
        roundRect(view.ctx, -s.lr * ppm - 10, half * 0.76, 22, half * 0.32, 2); view.ctx.fill();
        view.ctx.fillStyle = '#1e2024';
        view.ctx.beginPath(); view.ctx.arc(nose * 0.35, -half * 0.45, 3.5, 0, Math.PI * 2); view.ctx.fill();
        view.ctx.fillStyle = s.trim;
        roundRect(view.ctx, nose - 4, -half * 0.45, 3, half * 0.9, 1); view.ctx.fill();
      }

      // panel shut lines — cheap detail that reads as "a made object"
      view.ctx.strokeStyle = 'rgba(30,28,36,0.22)';
      view.ctx.lineWidth = 1;
      view.ctx.beginPath();
      view.ctx.moveTo(L * cabF * ppm, -half * 0.86); view.ctx.lineTo(L * cabF * ppm, half * 0.86);
      view.ctx.moveTo(L * cabR * ppm, -half * 0.9); view.ctx.lineTo(L * cabR * ppm, half * 0.9);
      view.ctx.stroke();

      // wing mirrors
      view.ctx.fillStyle = shade(s.paint, 0.8);
      roundRect(view.ctx, L * (cabF - 0.01) * ppm, -half * 1.04, 4, 3, 1); view.ctx.fill();
      roundRect(view.ctx, L * (cabF - 0.01) * ppm, half * 1.04 - 3, 4, 3, 1); view.ctx.fill();

      // lights: warm at the front, red at the back. The front end must be unmistakable.
      view.ctx.fillStyle = '#fff6dc';
      roundRect(view.ctx, nose - 5, -half * 0.58, 4, half * 0.30, 1.5); view.ctx.fill();
      roundRect(view.ctx, nose - 5, half * 0.28, 4, half * 0.30, 1.5); view.ctx.fill();
      // brake lights brighten under braking — a free, honest state readout (rule 10)
      const braking = car.t.lockedF || car.t.lockedR || (car.brakeLight || 0) > 0.05;
      view.ctx.fillStyle = braking ? '#ff5248' : '#a8302c';
      roundRect(view.ctx, tail + 1, -half * 0.62, 4, half * 0.34, 1.5); view.ctx.fill();
      roundRect(view.ctx, tail + 1, half * 0.28, 4, half * 0.34, 1.5); view.ctx.fill();
      if (braking) {
        view.ctx.globalAlpha = 0.5;
        view.ctx.fillStyle = '#ff6a60';
        roundRect(view.ctx, tail - 1, -half * 0.7, 7, half * 1.4, 2); view.ctx.fill();
        view.ctx.globalAlpha = 1;
      }

      // specular streak down the shoulder — the "realistic" bit; keep it subtle
      const sp = view.ctx.createLinearGradient(tail, 0, nose, 0);
      sp.addColorStop(0, 'rgba(255,255,255,0)');
      sp.addColorStop(0.5, 'rgba(255,255,255,0.30)');
      sp.addColorStop(1, 'rgba(255,255,255,0)');
      view.ctx.fillStyle = sp;
      roundRect(view.ctx, tail + 6, -half * 0.80, nose - tail - 12, 2.2, 1);
      view.ctx.fill();
    }

    view.ctx.restore();
  }

  return { pixelCar, faceCache, drawPixelCar, drawCar };
}
