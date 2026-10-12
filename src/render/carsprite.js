// The clean PIXEL CAR sprite (render.js split, phase 4): one cached sprite per livery.
import { shade } from "../render.js";   // hoisted, only called at draw time (no cycle)
import { SPRITE_PPM } from "./shared.js";

export function createCarSprite() {
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

  return { pixelCar };
}
