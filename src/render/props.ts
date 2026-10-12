// the PROPS layer of render.ts (phase 4 of the render.js split): fence, barriers, bridges,
// garage rows and props - the trackside scenery. Moved verbatim.
import { parkMiller } from "../core/random.ts";
import { RUNOFF_W } from "../world/bounds.ts";
import { LEVEL, PROPS } from "../world/state.ts";
import { BARRIER_HALF } from "../world/barriers.ts";
import type { Point, Prop } from "../world/types.ts";
import type { Cam, ForSide, View } from "./types.ts";

// what createProps destructures from the renderer, the ground painter and the road painter
interface PropsHelpers {
  PPMz: () => number;
  sx: (wx: number) => number;
  sy: (wy: number) => number;
  roundRect: (
    g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number
  ) => void;
  forSide: ForSide;
  drawSlip: (pr: Prop, p: number) => void;
}

export function createProps(view: View, cam: Cam, helpers: PropsHelpers) {
  const {
    PPMz, sx, sy, roundRect, forSide, drawSlip,
  } = helpers;

  function drawFence() {
    if (LEVEL.endless) return;   // MEASURED 2026-10-05: ~133k mesh segments + posts per frame along a 100 km edge (55-105 ms frames)
    for (let i = 0; i < 4; i++) forSide(i, (p: number, D: number, Lh: number) => {
      const y = (D + RUNOFF_W) * p, E = Lh + RUNOFF_W;   // E: the half-length of this side's fence, corners included
      // only the stretch in view (the frame's cam / W from forSide): the long sides are ~1 km of mesh
      const u0 = Math.max(-E, Math.floor((cam.x - view.W / 2 / p) / 4) * 4 - 4), u1 = Math.min(E, cam.x + view.W / 2 / p + 4);
      // High-performance Armco crash barrier:
      // 1. Backing catch-fence wire mesh
      view.ctx.strokeStyle = 'rgba(145,148,160,0.32)';
      view.ctx.lineWidth = Math.max(1, 0.08 * p);
      view.ctx.beginPath();
      for (let u = Math.max(-E, Math.floor((u0 + E) / 2.4) * 2.4 - E); u < u1; u += 2.4) {
        view.ctx.moveTo(u * p, y - 1.2 * p);
        view.ctx.lineTo((u + 2.4) * p, y + 0.4 * p);
        view.ctx.moveTo((u + 2.4) * p, y - 1.2 * p);
        view.ctx.lineTo(u * p, y + 0.4 * p);
      }
      view.ctx.stroke();

      // 2. Steel I-beam stanchions every 4 m
      const postW = Math.max(2, 0.28 * p);
      const postH = Math.max(3, 0.55 * p);
      view.ctx.fillStyle = '#42454e';
      for (let u = Math.max(-E, Math.floor((u0 + E) / 4) * 4 - E); u <= u1; u += 4) {
        view.ctx.fillRect(u * p - postW / 2, y - postH * 0.4, postW, postH);
      }

      // 3. Double-corrugated Armco rail: deep shadow underneath, steel beam, specular upper highlight
      view.ctx.fillStyle = 'rgba(25,27,32,0.6)';
      view.ctx.fillRect(-E * p, y + 0.15 * p, E * 2 * p, Math.max(1, 0.15 * p));

      view.ctx.fillStyle = '#9296a2';  // galvanized beam
      view.ctx.fillRect(-E * p, y - 0.25 * p, E * 2 * p, Math.max(2, 0.45 * p));

      view.ctx.fillStyle = '#d2d6e2';  // top reflective bevel
      view.ctx.fillRect(-E * p, y - 0.25 * p, E * 2 * p, Math.max(1, 0.12 * p));
    });
  }

  // ---------------------------------------------------------------- trackside scenery & props
  // BARRIERS (lab.js LEVEL.barriers): drawn at exactly the width the physics collides with (BARRIER_HALF)
  function drawBarriers() {
    const list = LEVEL.barriers;
    if (!list || !list.length) return;
    const p = PPMz();
    const path = (pts: Point[]) => { view.ctx.beginPath(); pts.forEach(([x, y], i) => (i ? view.ctx.lineTo(sx(x), sy(y)) : view.ctx.moveTo(sx(x), sy(y)))); };
    const posts = (pts: Point[], every: number, size: number, col: string) => {
      view.ctx.fillStyle = col;
      let acc = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1], L = Math.hypot(bx - ax, by - ay);
        for (; acc <= L; acc += every) { const t = acc / L, x = ax + (bx - ax) * t, y = ay + (by - ay) * t; view.ctx.fillRect(sx(x) - (size * p) / 2, sy(y) - (size * p) / 2, size * p, size * p); }
        acc -= L;
      }
    };
    view.ctx.save(); view.ctx.lineJoin = 'round'; view.ctx.lineCap = 'butt';
    for (const b of list) {
      const half = BARRIER_HALF[b.kind] ?? 0.2;
      if (b.kind === 'building') continue;
      // OFF-SCREEN CULL (2026-10-04): Thruston's ~500 m of Armco was stroked + posted every frame for the whole lap
      if (!b._rbb) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of b.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } b._rbb = [x0 - 1, y0 - 1, x1 + 1, y1 + 1]; }
      if (sx(b._rbb[0]) > view.W || sx(b._rbb[2]) < 0 || sy(b._rbb[1]) > view.H || sy(b._rbb[3]) < 0) continue;
      if (b.kind === 'line') { path(b.pts); view.ctx.strokeStyle = b.col || '#e2c13a'; view.ctx.lineWidth = Math.max(1, 0.25 * p); view.ctx.stroke(); continue; }
      if (b.kind === 'fence') {
        path(b.pts); view.ctx.strokeStyle = 'rgba(40,44,52,0.55)'; view.ctx.lineWidth = Math.max(1, 2 * half * p); view.ctx.stroke();
        posts(b.pts, 3, 0.35, '#2b2f38'); continue;
      }
      if (b.kind === 'armco') {
        path(b.pts); view.ctx.strokeStyle = '#5d626d'; view.ctx.lineWidth = Math.max(2, 2 * half * p); view.ctx.stroke();      // shadowed rail
        path(b.pts); view.ctx.strokeStyle = '#c9ccd3'; view.ctx.lineWidth = Math.max(1, half * p); view.ctx.stroke();          // bright face
        posts(b.pts, 2, 0.32, '#3d4049'); continue;
      }
      // wall / pitwall
      path(b.pts); view.ctx.strokeStyle = '#a9a7a0'; view.ctx.lineWidth = Math.max(2, 2 * half * p); view.ctx.stroke();
      if (b.kind === 'pitwall') {
        // painted red / white / blue blocks along the base (photographed at Thruxton)
        view.ctx.lineWidth = Math.max(1, half * 0.9 * p);
        const cols = ['#c8302c', '#f2f2f2', '#2b56b5'];
        view.ctx.setLineDash([2 * p, 4 * p]);
        cols.forEach((col, k) => { view.ctx.lineDashOffset = -k * 2 * p; path(b.pts); view.ctx.strokeStyle = col; view.ctx.stroke(); });
        view.ctx.setLineDash([]);
      }
    }
    view.ctx.restore();
  }
  // BRIDGES (highway.js extras): carries 'road' / 'rail' / 'foot' = a deck OVER the motorway (kind 'bridge', drawn after the cars);
  // kind 'river' = the motorway over water. Local frame: +x along the deck (across the motorway). Squares only.
  // v2 (2026-10-06, user: "bridges have no connecting roads so it looks silly"; "make the cars n stuff move across if you can ... only if
  // cheap enough"): the APPROACHES (highway.js approaches(): lane ribbons in the ground tiles) run pr.appL[0 | 1] m out from each end;
  // their markings / rails are drawn here, and so is what MOVES across: cars both ways, walkers, a train every pr.trainEvery s. Pure
  // drawing on the wall clock (no physics, no state): a few dozen squares per bridge on screen.
  // The RIVER's water is now a real 'wet' cover (lab.js covers: the puddle water, grip and spray, painted into the ground tiles; user:
  // "water seemed to be painted and not our water texture"), so only the boat is drawn here.
  function drawBridge(pr: Prop, p: number) {
    const P = (x: number, y: number, w: number, h: number, col: string) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
    const half = (pr.wid || 30) / 2, c = pr.carries, sd = pr.seed || 0;
    if (pr.kind === 'river') {
      if (pr.boat) { const e = (pr.roadHw || half - 9) / Math.cos(pr.skew || 0) + 4; P(e, -1.2, 5, 2.4, '#e9e4d8'); P(e + 1, -0.8, 2, 1.6, '#c8302c'); P(e + 0.2, -1.25, 4.6, 0.2, '#6a7077'); }
      return;
    }
    const a0 = half + 3 + ((pr.appL && pr.appL[0]) ?? 0), a1 = half + 3 + ((pr.appL && pr.appL[1]) ?? 0), Lt = a0 + a1, t = performance.now() / 1000 + (pr.phase || 0);
    // a mover at distance d along [-a0, a1] (wrapping), drawn by f(x)
    const along = (v: number, k: number, gap: number, f: (x: number) => void) => f((((t * v + k * gap) % Lt) + Lt) % Lt - a0);   // v < 0 runs -x by itself
    const dw = c === 'foot' ? 2.6 : c === 'rail' ? 7 : 9;
    view.ctx.fillStyle = 'rgba(10,12,16,0.32)'; view.ctx.fillRect((-half + 1.5) * p, (-dw / 2 + 2.6) * p, 2 * half * p, dw * p);   // shadow
    P(-half - 4, -dw / 2 - 0.6, 4, dw + 1.2, '#7c7f86'); P(half, -dw / 2 - 0.6, 4, dw + 1.2, '#7c7f86');                 // abutments
    P(-half, -dw / 2, 2 * half, dw, c === 'rail' ? '#5a5048' : '#8f949c');
    P(-half, -dw / 2, 2 * half, 0.4, '#c9ccd3'); P(-half, dw / 2 - 0.4, 2 * half, 0.4, '#5d626d');                       // parapets
    if (c === 'road') {
      P(-half, -dw / 2 + 0.6, 2 * half, dw - 1.2, '#3b3e44');
      // centre dashes over the deck AND the approaches, edge lines on the approaches (the ribbon is 7 m: edges at +-3.2)
      for (let k = -a0 + 1; k < a1 - 2; k += 4) P(k, -0.08, 2, 0.16, 'rgba(245,245,240,0.8)');
      for (const y of [-3.2, 3.05]) { P(-a0, y, a0 - half - 4, 0.15, 'rgba(245,245,240,0.6)'); P(half + 4, y, a1 - half - 4, 0.15, 'rgba(245,245,240,0.6)'); }
      if (pr.cow) { const x = half * 0.35; P(x - 1.1, -0.6, 2.2, 1.2, '#f2f2f2'); P(x - 0.6, -0.6, 0.7, 0.6, '#1c1d20'); P(x + 0.3, 0, 0.6, 0.6, '#1c1d20'); P(x + 1.1, -0.35, 0.5, 0.7, '#f2f2f2'); }
      // TRAFFIC both ways (left-hand: +x in the lane at y +1.6): 1-2 cars per direction, 13-17 m/s, spaced along the whole road
      const cols = ['#c8302c', '#2b56b5', '#e9e4d8', '#3f5a3a', '#d6a21e'], n = 1 + (pr.cars || 1);
      for (let k = 0; k < n; k++) { const dir = k % 2 ? -1 : 1, y = dir > 0 ? 1.6 : -1.6, v = dir * (13 + ((sd + k * 7) % 5));
        along(v, k, Lt / n * 1.7, (x: number) => { P(x - 2, y - 0.85, 4, 1.7, cols[(k + sd) % 5]); P(x + (dir > 0 ? -0.2 : -1.2), y - 0.7, 1.4, 1.4, 'rgba(20,22,28,0.6)'); P(x + (dir > 0 ? 1.7 : -2), y - 0.7, 0.3, 0.4, '#fff6e6'); P(x + (dir > 0 ? 1.7 : -2), y + 0.3, 0.3, 0.4, '#fff6e6'); }); }
    } else if (c === 'rail') {
      // sleepers + rails over the deck and along the ballast approaches (the gravel ribbon in the tiles)
      for (let k = -a0; k < a1; k += 0.9) if (k < -half - 4 || k > half) P(k, -2.4, 0.35, 4.8, '#6e5a44'); else P(k, -dw / 2 + 0.8, 0.35, dw - 1.6, '#6e5a44');
      for (const y of [-1.9, -0.6, 0.6, 1.9]) P(-a0, y - 0.08, Lt, 0.16, '#b9bcc3');
      for (let k = -half + 3; k < half; k += 12) P(k, -dw / 2 - 0.3, 0.3, dw + 0.6, '#3d4049');
      // A TRAIN every trainEvery s: 3-5 coaches of 18 m at 32 m/s, one way or the other, crossing the whole length then gone
      const every = pr.trainEvery || 20, cyc = Math.floor(t / every), tt = t - cyc * every, dir = (cyc + sd) % 2 ? 1 : -1, nc = 3 + ((cyc + sd) % 3), len = nc * 19;
      const head = -a0 - 10 + tt * 32;
      if (head - len < a1 + 10) {
        const y = dir > 0 ? 1.25 : -1.25, col = ['#c8302c', '#2b56b5', '#d6a21e'][(cyc + sd) % 3];
        // mirrored about the middle of [-a0, a1] for the other way; a coach past either end of the track (a cut-short bed) is not drawn
        for (let k = 0; k < nc; k++) { const x0 = head - (k + 1) * 19, x = dir > 0 ? x0 : a1 - a0 - x0 - 18; if (x < -a0 - 18 || x > a1) continue; P(x, y - 1.4, 18, 2.8, '#2a2c33'); P(x + 0.3, y - 1.25, 17.4, 2.5, k === 0 ? col : '#d7d9de'); for (let w = 1.5; w < 17; w += 3) P(x + w, y - 0.5, 1.6, 1, 'rgba(30,40,58,0.55)'); }
      }
    } else {
      P(-half, -dw / 2 + 0.4, 2 * half, dw - 0.8, '#a29a8c');
      if (pr.cone) { P(half * 0.2 - 0.35, -0.35, 0.7, 0.7, '#f97316'); P(half * 0.2 - 0.15, -0.15, 0.3, 0.3, '#f2f2f2'); }
      // WALKERS along the deck and the footpath (1.1-1.6 m/s), one now and then with a dog
      for (let k = 0; k < (pr.people || 1) + 1; k++) { const dir = (k + sd) % 2 ? 1 : -1, y = dir > 0 ? 0.35 : -0.35;
        along(dir * (1.1 + ((sd + k * 3) % 5) * 0.12), k, Lt / ((pr.people || 1) + 1) * 1.3, (x: number) => { P(x - 0.3, y - 0.3, 0.6, 0.6, ['#c8302c', '#eab308', '#2b56b5', '#3f5a3a'][(k + sd) % 4]); P(x - 0.15, y - 0.15, 0.3, 0.3, '#e8c39e'); if ((k + sd) % 3 === 0) P(x + dir * 0.9 - 0.2, y - 0.15, 0.45, 0.3, '#5a4231'); }); }
    }
  }
  // GARAGE ROW (2026-10-04): one strip along the lane from front / back / banner polylines, so it bends with the track
  function drawGarageRow(pr: Prop, p: number) {
    if (!pr._bb) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of [...pr.front!, ...pr.back!]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } pr._bb = [x0, y0, x1, y1]; }
    if (sx(pr._bb[0]) > view.W || sx(pr._bb[2]) < 0 || sy(pr._bb[1]) > view.H || sy(pr._bb[3]) < 0) return;
    const F = pr.front!, B = pr.back!, N = pr.banner!, n = F.length;
    const poly = (a: Point[], b: Point[], col: string) => { view.ctx.beginPath(); a.forEach(([x, y], i) => (i ? view.ctx.lineTo(sx(x), sy(y)) : view.ctx.moveTo(sx(x), sy(y)))); for (let i = b.length - 1; i >= 0; i--) view.ctx.lineTo(sx(b[i][0]), sy(b[i][1])); view.ctx.closePath(); view.ctx.fillStyle = col; view.ctx.fill(); };
    view.ctx.save();
    view.ctx.translate(0.6 * p, 0.8 * p); poly(F, B, 'rgba(10,12,16,0.40)'); view.ctx.translate(-0.6 * p, -0.8 * p);   // shadow
    poly(F, B, '#5b626b');
    view.ctx.strokeStyle = '#3b4047'; view.ctx.lineWidth = Math.max(1, 0.25 * p);
    for (let i = 0; i < n; i += 2) { view.ctx.beginPath(); view.ctx.moveTo(sx(F[i][0]), sy(F[i][1])); view.ctx.lineTo(sx(B[i][0]), sy(B[i][1])); view.ctx.stroke(); }   // a unit every 5 m
    view.ctx.beginPath(); F.forEach(([x, y]: Point, i: number) => (i ? view.ctx.lineTo(sx(x), sy(y)) : view.ctx.moveTo(sx(x), sy(y)))); for (let i = n - 1; i >= 0; i--) view.ctx.lineTo(sx(B[i][0]), sy(B[i][1])); view.ctx.closePath(); view.ctx.stroke();
    poly(F, N, '#c8302c');                                                                                      // the banner
    const bh = 0.9 * p;
    if (bh >= 8) {
      view.ctx.fillStyle = '#ffffff'; view.ctx.font = `900 ${Math.round(bh * 0.8)}px Impact, ui-sans-serif, sans-serif`; view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
      for (let i = 3; i < n - 3; i += 6) {
        const a = N[i - 1], b = N[i + 1], m = F[i], q = N[i], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        view.ctx.save(); view.ctx.translate(sx((m[0] + q[0]) / 2), sy((m[1] + q[1]) / 2)); view.ctx.rotate(ang); view.ctx.fillText(pr.brand || 'KUM TYRES', 0, 1, 6 * 2.5 * p * 0.85); view.ctx.restore();
      }
    }
    view.ctx.restore();
  }
  // OVERHEAD props span the track ABOVE the cars and are drawn AFTER them. MEASURED BUG (user, 2026-10-03: "the gantry
  // being below cars on the naffcar track"): every prop was drawn before the car, so cars drove OVER the start gantry.
  const OVERHEAD = new Set(['gantry', 'footbridge', 'bridge']);
  // pr.w, h, seed, label, front, back and banner are optional on Prop, but every kind
  // that reads them sets them (the ! below)
  function drawProps(overhead = false) {
    if (!PROPS || !PROPS.length) return;
    const p = PPMz();
    for (const pr of PROPS) {
      if (OVERHEAD.has(pr.kind) !== overhead) continue;
      if (pr.kind === 'garagerow') { drawGarageRow(pr, p); continue; }
      if (pr.kind === 'slip') { drawSlip(pr, p); continue; }
      const px = sx(pr.x), py = sy(pr.y);
      // margin by the prop's own size (a fixed 150 px let a 20 m hangar pop in at the screen edge)
      const m = Math.max(150, Math.max(pr.w || 0, pr.h || 0, pr.size || 0, pr.wid || 0, 18) * p * 0.75, (pr.reach || 0) * p);
      if (px < -m || px > view.W + m || py < -m || py > view.H + m) continue;
      view.ctx.save();
      view.ctx.translate(px, py);
      if (pr.rot) view.ctx.rotate(pr.rot);

      if (pr.kind === 'grandstand' || pr.kind === 'stadium_grandstand') {
        const gw = (pr.w || 36) * p, gh = (pr.h || 7.5) * p;
        // Heavy ground shadow
        view.ctx.fillStyle = 'rgba(10,12,16,0.42)';
        view.ctx.fillRect(-gw / 2 + 4, -gh / 2 + 5, gw, gh);
        // Base structural frame
        view.ctx.fillStyle = '#2e2c28';
        view.ctx.fillRect(-gw / 2, -gh / 2, gw, gh);
        // Stepped seating tiers
        const rows = pr.kind === 'stadium_grandstand' ? 6 : 4;
        const rowH = gh / rows;
        for (let r = 0; r < rows; r++) {
          view.ctx.fillStyle = r % 2 === 0 ? '#423d35' : '#585246';
          view.ctx.fillRect(-gw / 2, -gh / 2 + r * rowH, gw, rowH);
          // Planks and footwells
          view.ctx.fillStyle = 'rgba(20,18,16,0.45)';
          view.ctx.fillRect(-gw / 2, -gh / 2 + r * rowH + rowH - 1.5, gw, 1.5);
          // Colorful spectator crowd heads & caps
          const crowdColors = ['#e63946', '#3a86ff', '#2a9d8f', '#ffb703', '#fb8500', '#f1faee', '#8338ec'];
          const numDots = Math.floor(gw / (0.80 * p));
          for (let d = 0; d < numDots; d++) {
            const seed = (d * 19 + r * 37) % crowdColors.length;
            view.ctx.fillStyle = crowdColors[seed];
            view.ctx.fillRect(-gw / 2 + d * (0.80 * p) + 2, -gh / 2 + r * rowH + rowH * 0.28, 3.5, 3.5);
          }
        }
        // Corrugated canopy roof over the rear half
        view.ctx.fillStyle = 'rgba(12,14,18,0.30)';
        view.ctx.fillRect(-gw / 2, -gh / 2 + gh * 0.45, gw, 4); // shadow under roof edge
        view.ctx.fillStyle = '#656b78'; // galvanized zinc roof
        view.ctx.fillRect(-gw / 2 - 2, -gh / 2 - 2, gw + 4, gh * 0.50);
        // Roof corrugation ribs
        view.ctx.strokeStyle = '#858c9b'; view.ctx.lineWidth = 1;
        view.ctx.beginPath();
        for (let rx = -gw / 2; rx <= gw / 2; rx += 4 * p) {
          view.ctx.moveTo(rx, -gh / 2 - 2); view.ctx.lineTo(rx, -gh / 2 + gh * 0.50);
        }
        view.ctx.stroke();
        // Fluttering pennant flags along the roof ridge
        const flagColors = ['#ef4444', '#3b82f6', '#eab308', '#22c55e'];
        for (let fi = -gw / 2 + 6 * p; fi <= gw / 2 - 6 * p; fi += 10 * p) {
          view.ctx.fillStyle = '#222';
          view.ctx.fillRect(fi - 1, -gh / 2 - 8, 2, 7);
          view.ctx.fillStyle = flagColors[Math.abs(Math.floor(fi)) % flagColors.length];
          view.ctx.beginPath();
          view.ctx.moveTo(fi + 1, -gh / 2 - 8); view.ctx.lineTo(fi + 7, -gh / 2 - 5); view.ctx.lineTo(fi + 1, -gh / 2 - 2);
          view.ctx.fill();
        }
        // Front safety barrier rail
        view.ctx.strokeStyle = '#8e95a5'; view.ctx.lineWidth = Math.max(1.2, 0.12 * p);
        view.ctx.strokeRect(-gw / 2, -gh / 2, gw, gh);
      } else if (pr.kind === 'official_box') {
        // Wooden cabin on stilts
        view.ctx.fillStyle = 'rgba(10,12,16,0.38)';
        view.ctx.fillRect(-2.2 * p + 3, -1.8 * p + 4, 4.4 * p, 3.6 * p);
        // 4 heavy timber stilt posts
        view.ctx.fillStyle = '#3a2e22';
        view.ctx.fillRect(-2.0 * p, -1.6 * p, 0.4 * p, 3.2 * p);
        view.ctx.fillRect(1.6 * p, -1.6 * p, 0.4 * p, 3.2 * p);
        // Ladder rungs on the side
        view.ctx.fillStyle = '#65523f';
        for (let ly = -1.2 * p; ly <= 1.2 * p; ly += 0.5 * p) {
          view.ctx.fillRect(1.6 * p, ly, 0.4 * p, 2);
        }
        // Cabin body
        view.ctx.fillStyle = '#6b5847';
        view.ctx.fillRect(-1.8 * p, -1.4 * p, 3.6 * p, 2.8 * p);
        // Green timber window frame & observation window
        view.ctx.fillStyle = '#2b4436';
        view.ctx.fillRect(-1.5 * p, -1.1 * p, 3.0 * p, 1.2 * p);
        view.ctx.fillStyle = '#3b4856';
        view.ctx.fillRect(-1.3 * p, -1.0 * p, 2.6 * p, 1.0 * p);
        // Slanted corrugated tin roof
        view.ctx.fillStyle = '#555e6c';
        view.ctx.fillRect(-2.1 * p, -1.7 * p, 4.2 * p, 1.4 * p);
        // Wrap-around balcony rail
        view.ctx.strokeStyle = '#c4b5a0'; view.ctx.lineWidth = 1.5;
        view.ctx.strokeRect(-1.9 * p, -0.2 * p, 3.8 * p, 1.7 * p);
        // Marshal figure with yellow caution flag & chequered flag
        view.ctx.fillStyle = '#ffcc00'; // Yellow flag
        view.ctx.beginPath(); view.ctx.moveTo(1.7 * p, -1.7 * p); view.ctx.lineTo(2.6 * p, -1.3 * p); view.ctx.lineTo(1.7 * p, -0.9 * p); view.ctx.fill();
        view.ctx.fillStyle = '#fff'; // Chequered flag on opposite pole
        view.ctx.fillRect(-2.4 * p, -1.6 * p, 0.7 * p, 0.5 * p);
        view.ctx.fillStyle = '#111';
        view.ctx.fillRect(-2.4 * p, -1.6 * p, 0.35 * p, 0.25 * p);
        view.ctx.fillRect(-2.05 * p, -1.35 * p, 0.35 * p, 0.25 * p);
      } else if (pr.kind === 'gantry') {
        const gw = (pr.wid || 26) * p;
        // Heavy 3D steel truss frame spanning across track
        view.ctx.fillStyle = 'rgba(10,12,16,0.30)';
        view.ctx.fillRect(-gw / 2 + 2, -0.6 * p + 3, gw, 1.2 * p);
        // Concrete crash protection pillars on both sides
        view.ctx.fillStyle = '#9aa0ae';
        view.ctx.fillRect(-gw / 2 - 0.6 * p, -0.9 * p, 1.2 * p, 1.8 * p);
        view.ctx.fillRect(gw / 2 - 0.6 * p, -0.9 * p, 1.2 * p, 1.8 * p);
        // Yellow/black hazard chevrons on pillars
        view.ctx.fillStyle = '#eab308';
        view.ctx.fillRect(-gw / 2 - 0.6 * p, -0.9 * p, 1.2 * p, 0.4 * p);
        view.ctx.fillRect(gw / 2 - 0.6 * p, -0.9 * p, 1.2 * p, 0.4 * p);
        // SPEED CAMERA (highway gantries, highway.js speedCamera): a yellow box on the beam over the left lanes; flashes white when it
        // catches you (pr._flash, wall clock)
        if (LEVEL.endless) { const fl = pr._flash && performance.now() - pr._flash < 250; view.ctx.fillStyle = fl ? '#ffffff' : '#eab308'; view.ctx.fillRect(-gw * 0.3 - 0.7 * p, 0.6 * p, 1.4 * p, 1.0 * p); view.ctx.fillStyle = '#1c1d20'; view.ctx.fillRect(-gw * 0.3 - 0.35 * p, 1.2 * p, 0.7 * p, 0.3 * p); }
        // Main steel truss beam
        view.ctx.strokeStyle = '#3e4450'; view.ctx.lineWidth = Math.max(2.5, 0.35 * p);
        view.ctx.strokeRect(-gw / 2, -0.6 * p, gw, 1.2 * p);
        // Steel cross-bracing lattice
        view.ctx.strokeStyle = '#2b303c'; view.ctx.lineWidth = 1.2;
        view.ctx.beginPath();
        for (let bx = -gw / 2; bx < gw / 2; bx += 3.5 * p) {
          view.ctx.moveTo(bx, -0.6 * p); view.ctx.lineTo(bx + 3.5 * p, 0.6 * p);
          view.ctx.moveTo(bx + 3.5 * p, -0.6 * p); view.ctx.lineTo(bx, 0.6 * p);
        }
        view.ctx.stroke();
        // 5 circular start light pods with bright red glowing LED cores
        const lightSpacing = gw / 8;
        for (let l = -2; l <= 2; l++) {
          const lx = l * lightSpacing;
          view.ctx.fillStyle = '#111317';
          roundRect(view.ctx, lx - 0.35 * p, -0.45 * p, 0.7 * p, 0.9 * p, 3); view.ctx.fill();
          view.ctx.strokeStyle = '#4a5160'; view.ctx.lineWidth = 1; view.ctx.stroke();
          // Outer red glow
          view.ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
          view.ctx.beginPath(); view.ctx.arc(lx, 0, 0.35 * p, 0, Math.PI * 2); view.ctx.fill();
          // Solid red core
          view.ctx.fillStyle = '#ef4444';
          view.ctx.beginPath(); view.ctx.arc(lx, 0, 0.20 * p, 0, Math.PI * 2); view.ctx.fill();
          // White specular highlight
          view.ctx.fillStyle = '#fff';
          view.ctx.beginPath(); view.ctx.arc(lx - 0.05 * p, -0.05 * p, 0.06 * p, 0, Math.PI * 2); view.ctx.fill();
        }
        // Center digital lap / position board with green LEDs
        view.ctx.fillStyle = '#0a0d0a';
        roundRect(view.ctx, -1.4 * p, -0.55 * p, 2.8 * p, 0.45 * p, 2); view.ctx.fill();
        view.ctx.fillStyle = '#22c55e';
        view.ctx.font = `700 ${Math.round(0.32 * p)}px ui-monospace, monospace`;
        view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
        view.ctx.fillText('LAP 1', 0, -0.32 * p);
      } else if (pr.kind === 'pit_wall') {
        const pw = (pr.len || 220) * p, ph = (pr.h || 1.2) * p;
        // Ground shadow
        view.ctx.fillStyle = 'rgba(10,12,16,0.35)';
        view.ctx.fillRect(-pw / 2 + 2, -ph / 2 + 3, pw, ph);
        // Concrete wall body
        view.ctx.fillStyle = '#8a909d';
        view.ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
        // Top steel capping plate with bevel highlight
        view.ctx.fillStyle = '#b8becb';
        view.ctx.fillRect(-pw / 2, -ph / 2, pw, ph * 0.35);
        // Yellow/black diagonal hazard stripes at the wall ends
        view.ctx.fillStyle = '#eab308';
        view.ctx.fillRect(-pw / 2, -ph / 2, 4 * p, ph);
        view.ctx.fillRect(pw / 2 - 4 * p, -ph / 2, 4 * p, ph);
        view.ctx.fillStyle = '#111';
        view.ctx.fillRect(-pw / 2 + 1.2 * p, -ph / 2, 1.4 * p, ph);
        view.ctx.fillRect(pw / 2 - 2.6 * p, -ph / 2, 1.4 * p, ph);
        // Pit stall accessories along the inside of the wall (toolboxes & air booms)
        for (let bx = -pw / 2 + 25 * p; bx <= pw / 2 - 25 * p; bx += 40 * p) {
          // Red tool cabinet
          view.ctx.fillStyle = '#b91c1c';
          roundRect(view.ctx, bx - 1.2 * p, -ph / 2 - 1.0 * p, 2.4 * p, 0.8 * p, 2); view.ctx.fill();
          view.ctx.fillStyle = '#d1d5db';
          view.ctx.fillRect(bx - 1.0 * p, -ph / 2 - 0.7 * p, 2.0 * p, 1.5);
          // Overhead air hose boom
          view.ctx.strokeStyle = '#222'; view.ctx.lineWidth = 1.2;
          view.ctx.beginPath(); view.ctx.moveTo(bx, -ph / 2); view.ctx.lineTo(bx + 1.5 * p, -ph / 2 - 2.0 * p); view.ctx.stroke();
        }
      } else if (pr.kind === 'pylon') {
        // High-output halogen floodlight pylon
        // Warm circular ground illumination pool on the deck
        const grad = view.ctx.createRadialGradient(0, 0, 1 * p, 0, 0, 18 * p);
        grad.addColorStop(0, 'rgba(255, 248, 220, 0.16)');
        grad.addColorStop(0.5, 'rgba(255, 244, 200, 0.08)');
        grad.addColorStop(1, 'rgba(255, 240, 180, 0)');
        view.ctx.fillStyle = grad;
        view.ctx.beginPath(); view.ctx.arc(0, 0, 18 * p, 0, Math.PI * 2); view.ctx.fill();

        // Tower shadow
        view.ctx.fillStyle = 'rgba(10,12,16,0.38)';
        view.ctx.beginPath(); view.ctx.arc(3, 3, 1.1 * p, 0, Math.PI * 2); view.ctx.fill();
        // Steel base
        view.ctx.fillStyle = '#2f343e';
        view.ctx.beginPath(); view.ctx.arc(0, 0, 0.9 * p, 0, Math.PI * 2); view.ctx.fill();
        // Quad floodlamp heads with silver dishes & warm centers
        const heads = [[-0.6, -0.6], [0.2, -0.6], [-0.6, 0.2], [0.2, 0.2]];
        for (const [hx, hy] of heads) {
          view.ctx.fillStyle = '#e2e8f0';
          roundRect(view.ctx, hx * p, hy * p, 0.55 * p, 0.45 * p, 1.5); view.ctx.fill();
          view.ctx.fillStyle = '#fffbeb';
          view.ctx.beginPath(); view.ctx.arc((hx + 0.27) * p, (hy + 0.22) * p, 0.14 * p, 0, Math.PI * 2); view.ctx.fill();
        }
      } else if (pr.kind === 'garages') {
        // PIT GARAGES (Thruxton photo): concrete-block units under a red tyre-brand banner. Local +x = along the lane, -y = the
        // lane side. Top-down: the flat roof with a divider per unit, the banner along the front edge. Squares only (pixel rule).
        // First cut (photographed): a light grey roof vanished into the concrete apron and a 1.3 m banner read as a red wall.
        // Now a dark slate roof with an outline, ribbed per unit, and a 0.9 m banner with the brand once, centred.
        const gw = pr.w! * p, gh = pr.h! * p, unit = 5, o = Math.max(1, 0.25 * p);
        view.ctx.fillStyle = 'rgba(10,12,16,0.40)'; view.ctx.fillRect(-gw / 2 + 0.6 * p, -gh / 2 + 0.8 * p, gw, gh);
        view.ctx.fillStyle = '#3b4047'; view.ctx.fillRect(-gw / 2, -gh / 2, gw, gh);                       // outline
        view.ctx.fillStyle = '#5b626b'; view.ctx.fillRect(-gw / 2 + o, -gh / 2 + o, gw - 2 * o, gh - 2 * o); // roof
        view.ctx.fillStyle = '#666d77';
        for (let y = 1; y < 10; y += 2) view.ctx.fillRect(-gw / 2 + o, -gh / 2 + (gh * y) / 10, gw - 2 * o, Math.max(1, 0.2 * p));   // roof ribs
        view.ctx.fillStyle = '#3b4047';
        const units = Math.max(1, Math.round(pr.w! / unit));
        for (let k = 1; k < units; k++) view.ctx.fillRect(-gw / 2 + (gw * k) / units - o / 2, -gh / 2, o, gh);
        const bh = 0.9 * p;                                                                          // the banner, lane side
        view.ctx.fillStyle = '#c8302c'; view.ctx.fillRect(-gw / 2, -gh / 2, gw, bh);
        if (bh >= 8) {
          view.ctx.fillStyle = '#ffffff'; view.ctx.font = `900 ${Math.round(bh * 0.8)}px Impact, ui-sans-serif, sans-serif`;
          view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
          view.ctx.fillText(pr.brand || 'KUM TYRES', 0, -gh / 2 + bh / 2 + 1, gw * 0.9);
        } else {
          view.ctx.fillStyle = '#ffffff'; view.ctx.fillRect(-gw * 0.25, -gh / 2 + bh * 0.3, gw * 0.5, Math.max(1, bh * 0.4));
        }
      } else if (pr.kind === 'tower') {
        // CONTROL TOWER: a two-storey block (long shadow = tall) with a small glazed cab on the roof. The first cut — a square with
        // a thick dark band — photographed as a swimming pool.
        const g = (pr.size || 9) * p, c = g * 0.45;
        view.ctx.fillStyle = 'rgba(10,12,16,0.40)'; view.ctx.fillRect(-g / 2 + 1.6 * p, -g / 2 + 2.2 * p, g, g);
        view.ctx.fillStyle = '#d9d5cc'; view.ctx.fillRect(-g / 2, -g / 2, g, g);                                  // flat roof
        view.ctx.fillStyle = '#bdb8ad'; view.ctx.fillRect(-g / 2, g / 2 - 0.5 * p, g, 0.5 * p); view.ctx.fillRect(g / 2 - 0.5 * p, -g / 2, 0.5 * p, g);   // parapet shade
        view.ctx.fillStyle = 'rgba(10,12,16,0.35)'; view.ctx.fillRect(-c / 2 + 0.6 * p, -c / 2 + 0.8 * p, c, c);  // the cab's shadow
        view.ctx.fillStyle = '#2f4656'; view.ctx.fillRect(-c / 2, -c / 2, c, c);                                   // glazed cab
        view.ctx.fillStyle = '#e9e6df'; view.ctx.fillRect(-c / 2 + 0.35 * p, -c / 2 + 0.35 * p, c - 0.7 * p, c - 0.7 * p);   // its roof
        view.ctx.fillStyle = '#5a5e66'; view.ctx.fillRect(-0.25 * p, -0.25 * p, 0.5 * p, 0.5 * p);                 // mast
      } else if (pr.kind === 'hangar') {
        // T2-style hangar: corrugated roof (ribs across), a lighter ridge, dark door end. Squares only.
        const hw = pr.w! * p, hh = pr.h! * p;
        view.ctx.fillStyle = 'rgba(10,12,16,0.40)'; view.ctx.fillRect(-hw / 2 + 1.2 * p, -hh / 2 + 1.6 * p, hw, hh);
        view.ctx.fillStyle = '#7b8188'; view.ctx.fillRect(-hw / 2, -hh / 2, hw, hh);
        view.ctx.fillStyle = '#8c929a'; view.ctx.fillRect(-hw / 2, -hh / 2, hw, hh * 0.5);
        view.ctx.fillStyle = '#6a7077'; for (let x = -pr.w! / 2 + 1; x < pr.w! / 2; x += 1.6) view.ctx.fillRect(x * p, -hh / 2, Math.max(1, 0.18 * p), hh);
        view.ctx.fillStyle = '#a7adb4'; view.ctx.fillRect(-hw / 2, -Math.max(1, 0.2 * p), hw, Math.max(2, 0.4 * p));
        view.ctx.fillStyle = '#3d4249'; view.ctx.fillRect(hw / 2 - 0.8 * p, -hh / 2, 0.8 * p, hh);
      } else if (pr.kind === 'plane') {
        // LIGHT AIRCRAFT, nose along +x: fuselage, wing, tailplane, a coloured stripe
        const P = (x: number, y: number, w: number, h: number, col: string) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        view.ctx.fillStyle = 'rgba(10,12,16,0.30)'; view.ctx.fillRect(-3.2 * p + 0.8 * p, -0.5 * p + 1.2 * p, 7 * p, 1 * p); view.ctx.fillRect(0.3 * p, -4.5 * p + 1.2 * p, 1.4 * p, 9 * p);
        P(-3.2, -0.5, 7, 1, '#eef0f2'); P(0.3, -4.5, 1.4, 9, '#e3e6ea'); P(-3.2, -1.6, 0.8, 3.2, '#e3e6ea');
        P(-2.6, -0.15, 5.6, 0.3, pr.col || '#c8302c'); P(3.4, -0.3, 0.4, 0.6, '#3a3f47');
      } else if (pr.kind === 'windsock') {
        const P = (x: number, y: number, w: number, h: number, col: string) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        P(-0.25, -0.25, 0.5, 0.5, '#5a5e66');
        for (let k = 0; k < 4; k++) P(0.25 + k * 0.6, -0.35 + k * 0.04, 0.6, 0.7 - k * 0.08, k % 2 ? '#f2f2f2' : '#f07a1a');
      } else if (pr.kind === 'truck') {
        // RACE TRANSPORTER (paddock): cab + long trailer with a team stripe, nose along +x
        const P = (x: number, y: number, w: number, h: number, col: string) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        view.ctx.fillStyle = 'rgba(10,12,16,0.35)'; view.ctx.fillRect(-7 * p + 0.6 * p, -1.25 * p + 0.9 * p, 14 * p, 2.5 * p);
        P(-7, -1.25, 11.2, 2.5, '#e6e8eb'); P(-7, -0.35, 11.2, 0.7, pr.col || '#c8302c'); P(4.6, -1.2, 2.4, 2.4, pr.col || '#c8302c'); P(6.2, -1.0, 0.6, 2.0, '#2a3038');
      } else if (pr.kind === 'tree') {
        // a tree from overlapping SQUARES (pixel rule), shade per seed; long shadow first
        const sz = (pr.s || 4) * p, h = (pr.seed! * 9301 + 49297) % 233280 / 233280;
        view.ctx.fillStyle = 'rgba(10,12,16,0.32)'; view.ctx.fillRect(-sz / 2 + 0.25 * sz, -sz / 2 + 0.35 * sz, sz, sz);
        // pal: 'dry' = desert scrub (olive / dust), else conifer greens; snow: white caps on the upper squares (generated stages)
        const cols = pr.pal === 'dry' ? (h < 0.5 ? ['#5b5a2e', '#6f6d38', '#8a8646'] : ['#64552c', '#786a36', '#948548']) : h < 0.5 ? ['#2f5a2a', '#3d6e33', '#4f8240'] : ['#355f2c', '#456f36', '#5a8a45'];
        view.ctx.fillStyle = cols[0]; view.ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
        view.ctx.fillStyle = pr.snow ? '#dfe7ee' : cols[1]; view.ctx.fillRect(-sz / 2 + sz * 0.12, -sz / 2 + sz * 0.1, sz * 0.62, sz * 0.62);
        if (pr.snow) { view.ctx.fillStyle = cols[1]; view.ctx.fillRect(-sz / 2 + sz * 0.42, -sz / 2 + sz * 0.42, sz * 0.32, sz * 0.32); }
        view.ctx.fillStyle = pr.snow ? '#ffffff' : cols[2]; view.ctx.fillRect(-sz / 2 + sz * 0.2, -sz / 2 + sz * 0.18, sz * 0.3, sz * 0.3);
      } else if (pr.kind === 'rock') {
        // ROCK / BOULDER: overlapping grey squares, light top-left, dark bottom-right, a long shadow (pixel rule); pal 'red' = desert stone
        const sz = (pr.s || 3) * p, h = ((pr.seed || 1) * 9301 + 49297) % 233280 / 233280;
        const cols = pr.pal === 'red' ? ['#6e4a32', '#8c5f40', '#a87652', '#c39270'] : ['#4d5157', '#62676e', '#7b8088', '#989da4'];
        view.ctx.fillStyle = 'rgba(10,12,16,0.34)'; view.ctx.fillRect(-sz / 2 + 0.3 * sz, -sz / 2 + 0.4 * sz, sz, sz * 0.9);
        view.ctx.fillStyle = cols[0]; view.ctx.fillRect(-sz / 2, -sz / 2 + sz * 0.1, sz, sz * 0.8); view.ctx.fillRect(-sz / 2 + sz * 0.15, -sz / 2, sz * 0.7, sz);
        view.ctx.fillStyle = cols[1]; view.ctx.fillRect(-sz / 2 + sz * 0.1, -sz / 2 + sz * 0.08, sz * 0.72, sz * 0.7);
        view.ctx.fillStyle = cols[2]; view.ctx.fillRect(-sz / 2 + sz * 0.16, -sz / 2 + sz * 0.12, sz * (0.38 + 0.15 * h), sz * 0.36);
        view.ctx.fillStyle = cols[3]; view.ctx.fillRect(-sz / 2 + sz * 0.22, -sz / 2 + sz * 0.16, sz * 0.16, sz * 0.14);
        if (pr.snow) { view.ctx.fillStyle = '#eef3f7'; view.ctx.fillRect(-sz / 2 + sz * 0.12, -sz / 2 + sz * 0.06, sz * 0.5, sz * 0.22); }
      } else if (pr.kind === 'crowd') {
        // SPECTATORS: a cluster of people (a 2x2 px head-and-shoulders each, jackets in random colours, a shadow) over w x h m
        const n = pr.n || 14, w = pr.w || 8, hh = pr.h || 3; const rr = parkMiller((pr.seed || 7) * 7919);
        const JK = ['#c8302c', '#2b56b5', '#e2c13a', '#2f7d4f', '#f2f2f2', '#e07a1f', '#7a3fa0', '#16181d', '#3fb6c9'];
        for (let k = 0; k < n; k++) { const x = (rr() - 0.5) * w * p, y = (rr() - 0.5) * hh * p, z = Math.max(2, 0.55 * p);
          view.ctx.fillStyle = 'rgba(10,12,16,0.3)'; view.ctx.fillRect(x + z * 0.3, y + z * 0.4, z, z);
          view.ctx.fillStyle = JK[(rr() * JK.length) | 0]; view.ctx.fillRect(x - z / 2, y - z / 2, z, z);
          view.ctx.fillStyle = rr() < 0.5 ? '#e6c3a0' : '#8a5a3c'; view.ctx.fillRect(x - z * 0.22, y - z * 0.22, z * 0.44, z * 0.44); }
      } else if (pr.kind === 'marshal') {
        // MARSHAL POST: small hut, white roof, orange edge
        const P = (x: number, y: number, w: number, h: number, col: string) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        view.ctx.fillStyle = 'rgba(10,12,16,0.35)'; view.ctx.fillRect(-1.2 * p + 0.4 * p, -1 * p + 0.6 * p, 2.4 * p, 2 * p);
        P(-1.2, -1, 2.4, 2, '#f07a1a'); P(-0.95, -0.75, 1.9, 1.5, '#f2f2f2');
      } else if (pr.kind === 'footbridge') {
        // FOOTBRIDGE over the track (Castle Combe's Avon + Dunlop bridges): deck across (+x), stair towers at the ends, a sponsor band
        const P = (x: number, y: number, w: number, h: number, col: string) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        const half = (pr.wid || 27) / 2;
        view.ctx.fillStyle = 'rgba(10,12,16,0.30)'; view.ctx.fillRect(-half * p + 1.5 * p, -1.2 * p + 2.4 * p, 2 * half * p, 2.4 * p);   // shadow on the road
        P(-half, -1.2, 2 * half, 2.4, '#8f949c'); P(-half, -1.2, 2 * half, 0.3, '#c9ccd3'); P(-half, 0.9, 2 * half, 0.3, '#5d626d');
        P(-half * 0.55, -0.75, half * 1.1, 1.5, '#1c4fa0');
        P(-half - 1.6, -1.5, 3.2, 3.0, '#6a7077'); P(half - 1.6, -1.5, 3.2, 3.0, '#6a7077');                                       // stair towers
        for (let k = 0; k < 4; k++) { P(-half - 1.4, -1.3 + k * 0.7, 2.8, 0.25, '#565b63'); P(half - 1.4, -1.3 + k * 0.7, 2.8, 0.25, '#565b63'); }
        if (p * 1.0 >= 8) { view.ctx.fillStyle = '#ffffff'; view.ctx.font = `900 ${Math.round(p * 1.0)}px Impact, ui-sans-serif, sans-serif`; view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle'; if (Math.cos(pr.rot || 0) < 0) view.ctx.rotate(Math.PI); /* never upside down (photographed) */ view.ctx.fillText(pr.label || '', 0, 0.05 * p, half * 1.05 * p); }
      } else if (pr.kind === 'sculpture') {
        // the red steel SCULPTURE by the start line (photo): a crown of red squares, orange core, long shadow (it is tall)
        const P = (x: number, y: number, w: number, h: number, col: string) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        view.ctx.fillStyle = 'rgba(10,12,16,0.32)'; view.ctx.fillRect(0.2 * p, 0.2 * p, 3.2 * p, 1.6 * p);
        for (const [x, y] of [[-1.1, -1.1], [0.3, -1.3], [0.7, -0.2], [-0.1, 0.6], [-1.2, 0.1]]) P(x, y, 0.8, 0.8, '#d6331f');
        P(-0.4, -0.4, 0.8, 0.8, '#f07a1a');
      } else if (pr.kind === 'block') {
        // a flat-roofed BUILDING (clubhouse, offices): roof colour, parapet, rooftop plant, optional name on the roof
        const P = (x: number, y: number, w: number, h: number, col: string) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        const w2 = pr.w! / 2, h2 = pr.h! / 2;
        view.ctx.fillStyle = 'rgba(10,12,16,0.40)'; view.ctx.fillRect(-w2 * p + 1.2 * p, -h2 * p + 1.6 * p, pr.w! * p, pr.h! * p);
        P(-w2, -h2, pr.w!, pr.h!, '#3b4047'); P(-w2 + 0.4, -h2 + 0.4, pr.w! - 0.8, pr.h! - 0.8, pr.roof || '#5b626b');
        P(w2 - 4, -h2 + 1.2, 2.4, 1.8, '#9aa0a8'); P(w2 - 3.6, -h2 + 1.5, 1.6, 1.2, '#7c828a');
        // a CHURCH (highway.js village): a square tower at the west end of the nave, with a little cross; a HOUSE: a ridge line, no rooftop plant
        if (pr.church) { P(-w2 - 2.6, -2, 4, 4, '#3b4047'); P(-w2 - 2.3, -1.7, 3.4, 3.4, '#8f8a80'); P(-w2 - 0.8, -0.8, 0.4, 1.6, '#3b4047'); P(-w2 - 1.2, -0.2, 1.2, 0.4, '#3b4047'); }
        if (pr.house || pr.church) P(-w2 + 0.4, -0.08, pr.w! - 0.8, 0.16, 'rgba(20,22,28,0.35)');
        if (pr.label && p * 1.4 >= 9) { view.ctx.fillStyle = 'rgba(255,255,255,0.85)'; view.ctx.font = `900 ${Math.round(p * 1.4)}px Impact, ui-sans-serif, sans-serif`; view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle'; if (Math.cos(pr.rot || 0) < 0) view.ctx.rotate(Math.PI); view.ctx.fillText(pr.label, 0, 0.6 * p, pr.w! * 0.8 * p); }
      } else if (pr.kind === 'chevron') {
        // RALLY CHEVRON BOARD (black + yellow arrows), placed on the outside of a corner, arrows pointing the way it turns (+x).
        // Drawn at 1.6x (photographed: at 3.2 m it was a smudge beside the bales)
        view.ctx.scale(1.6, 1.6);
        const P = (x: number, y: number, w: number, h: number, col: string) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        view.ctx.fillStyle = 'rgba(10,12,16,0.32)'; view.ctx.fillRect(-1.6 * p + 0.3 * p, -0.25 * p + 0.5 * p, 3.2 * p, 0.5 * p);
        P(-1.6, -0.25, 3.2, 0.5, '#15171c');
        for (let k = 0; k < 3; k++) { P(-1.25 + k * 1.0, -0.2, 0.25, 0.15, '#f2c21b'); P(-1.0 + k * 1.0, -0.075, 0.25, 0.15, '#f2c21b'); P(-1.25 + k * 1.0, 0.05, 0.25, 0.15, '#f2c21b'); }
      } else if (pr.kind === 'bale') {
        // ROUND HAY BALE from the top: a straw square with a darker spiral ring (squares — the pixel rule)
        const P = (x: number, y: number, w: number, h: number, col: string) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        view.ctx.fillStyle = 'rgba(10,12,16,0.30)'; view.ctx.fillRect(-0.8 * p + 0.3 * p, -0.8 * p + 0.45 * p, 1.6 * p, 1.6 * p);
        P(-0.8, -0.8, 1.6, 1.6, '#c9a85a'); P(-0.55, -0.55, 1.1, 1.1, '#b48f45'); P(-0.3, -0.3, 0.6, 0.6, '#d8bb6e'); P(-0.08, -0.08, 0.16, 0.16, '#9a7836');
      } else if (pr.kind === 'flag') {
        // a FLAG on a pole: pole square + a pennant blowing in +x, with a long shadow
        const P = (x: number, y: number, w: number, h: number, col: string) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        view.ctx.fillStyle = 'rgba(10,12,16,0.28)'; view.ctx.fillRect(0.2 * p, 0.1 * p, 1.8 * p, 0.6 * p);
        P(-0.15, -0.15, 0.3, 0.3, '#3a3f47'); P(0.15, -0.55, 1.3, 0.75, pr.col || '#c8302c'); P(0.15, -0.55, 1.3, 0.12, 'rgba(255,255,255,0.35)');
      } else if (pr.kind === 'bridge' || pr.kind === 'river') { drawBridge(pr, p);
      } else if (pr.kind === 'slipcount') {
        // the 300 / 200 / 100 yd COUNTDOWN posts before an exit: white with red diagonal bars (squares, not circles)
        const P = (x: number, y: number, w: number, h: number, col: string) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        P(-0.5, -1.0, 1.2, 2.2, 'rgba(10,12,16,0.35)'); P(-0.6, -1.1, 1.2, 2.2, '#f2f2f2');
        for (let k = 0; k < (pr.bars || 1); k++) P(-0.6, -0.95 + k * 0.7, 1.2, 0.35, '#c8302c');
      } else if (pr.kind === 'gate') {
        // a FIELD GATE where the slip road ends (wooden 5-bar, posts either side)
        const P = (x: number, y: number, w: number, h: number, col: string) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        P(-3.4, -0.2, 6.8, 0.6, 'rgba(10,12,16,0.35)'); P(-3.2, -0.35, 0.5, 0.7, '#3a2d21'); P(2.7, -0.35, 0.5, 0.7, '#3a2d21');
        for (let k = 0; k < 3; k++) P(-2.7, -0.25 + k * 0.22, 5.4, 0.1, '#b48a5a');
      } else if (pr.kind === 'solarfarm') {
        // the SMILEY SOLAR FARM (a cheeky extra): rows of dark blue panels laid out as a smiling face, seen from above
        const P = (x: number, y: number, w: number, h: number, col: string) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        const cell = (cx: number, cy: number) => { P(cx * 2.4 - 1.1, cy * 2.4 - 0.9, 2.2, 1.8, '#1b2b55'); P(cx * 2.4 - 1.1, cy * 2.4 - 0.9, 2.2, 0.35, '#5f7fc4'); };
        for (const [cx, cy] of [[-3, -3], [-2, -3], [2, -3], [3, -3], [-3, -2], [-2, -2], [2, -2], [3, -2]]) cell(cx, cy);   // eyes
        for (const [cx, cy] of [[-5, 1], [-4, 2], [-3, 3], [-2, 3], [-1, 4], [0, 4], [1, 4], [2, 3], [3, 3], [4, 2], [5, 1]]) cell(cx, cy);   // grin
      } else if (pr.kind === 'board') {
        // Heavy timber support posts
        const bw = 18 * p, bh = 2.4 * p;
        view.ctx.fillStyle = 'rgba(10,12,16,0.38)';
        view.ctx.fillRect(-bw / 2 + 2, -bh / 2 + 3, bw, bh);
        // Wooden support posts
        view.ctx.fillStyle = '#3a2d21';
        view.ctx.fillRect(-bw / 2 + 1 * p, -bh / 2, 0.4 * p, bh + 2);
        view.ctx.fillRect(bw / 2 - 1.4 * p, -bh / 2, 0.4 * p, bh + 2);
        // Signboard body with colored accent border
        view.ctx.fillStyle = pr.blue ? '#1f4fa8' : '#14161c';   // blue = a motorway EXIT sign (highway.js slip roads)
        view.ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
        view.ctx.strokeStyle = pr.blue ? '#ffffff' : pr.label!.includes('SPUM') ? '#eab308' : pr.label!.includes('CREEM') ? '#38bdf8' : '#f97316';
        view.ctx.lineWidth = 1.8; view.ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
        // Sponsor typography with punchy contrast
        view.ctx.fillStyle = '#ffffff';
        view.ctx.font = `900 ${Math.round(1.15 * p)}px Impact, ui-sans-serif, sans-serif`;
        view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
        view.ctx.fillText(pr.label || 'SPONSOR', 0, 0);
      }
      view.ctx.restore();
    }
  }

  return { drawFence, drawBarriers, drawProps };
}
