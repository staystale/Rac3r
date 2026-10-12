// the OBJECTS layer of render.js (phase 4 of the render.js split): pixel objects (cones, tyres),
// tape and debris. Moved verbatim.
import { parkMiller } from "../core/random.ts";
import { CONE_R } from "../world/tyrewall.ts";
import { COL } from "../world/colours.ts";
import { SPRITE_PPM } from "./shared.js";
import { PIXEL, shade } from "../render.js";   // read only at draw time (no load-time cycle)

export function createObjects(view, cam, helpers) {
  const {
    PPMz, sx, sy, roundRect, chips, MAX_CHIPS,
  } = helpers;

  // ---------------------------------------------------------------- cones
  //
  // STANDING and TOPPLED must be unmistakable at a glance and at phone size (§4: if the player cannot
  // read it, it did not happen). Standing reads as concentric rings — the cone seen from directly
  // above. Toppled reads as a LONG shape lying in the direction it was hit, which is a completely
  // different silhouette rather than the same blob in a different colour.
  // ---------------------------------------------------------------- PIXEL OBJECTS (cones, tyres)
  // Generated pixel sprites, cached, drawn at the car's art scale (SPRITE_PPM) with smoothing off. Round things are
  // PIXEL-round — rasterised square by square (pdisc), never an anti-aliased arc.
  const objCache = new Map();
  function objSprite(key, size, paint) {
    let s = objCache.get(key);
    if (!s) {
      const c = document.createElement('canvas'); c.width = c.height = size;
      paint(c.getContext('2d'), size); s = { c, size }; objCache.set(key, s);
    }
    return s;
  }
  // a pixel disc of radius rr centred in a size x size sprite (pixel centres inside the circle)
  function pdisc(g, size, rr, col) {
    g.fillStyle = col; const m = (size - 1) / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if ((x - m) ** 2 + (y - m) ** 2 <= rr * rr) g.fillRect(x, y, 1, 1);
  }
  function pixelObjectSprite(c) {
    const mode = c.mode || (c.kind === 'tyrestack' ? 'stack' : c.kind === 'tyre' ? 'flat' : 'cone');
    if (c.kind === 'cone') {
      if (c.down > 0.5) return objSprite('cone-down', 11, (g) => {          // lying on its side, tip to +x
        g.fillStyle = '#b8410c'; g.fillRect(0, 2, 2, 7);                      // base
        for (let x = 2; x < 11; x++) { const h = Math.max(1, Math.round(3.4 - (x - 2) * 0.36)); g.fillStyle = '#f26a1b'; g.fillRect(x, 5 - h, 1, h * 2 + 1); }
        g.fillStyle = '#f4f4f6'; g.fillRect(5, 3, 2, 5);                       // reflective band
        g.fillStyle = '#ff9a55'; g.fillRect(2, 4, 7, 1);                       // highlight
      });
      return objSprite('cone-up', 9, (g, n) => {                               // top-down: base, band, tip
        pdisc(g, n, 4.4, '#b8410c'); pdisc(g, n, 3.6, '#f26a1b'); pdisc(g, n, 2.4, '#f4f4f6'); pdisc(g, n, 1.4, '#f26a1b');
        g.fillStyle = '#ffb27a'; g.fillRect(4, 4, 1, 1);
      });
    }
    if (c.kind === 'tyre' || c.kind === 'tyrestack') {
      if (mode === 'roll' || mode === 'flip' || mode === 'wobble') return objSprite('tyre-side', 15, (g) => {   // on its tread
        g.fillStyle = '#16171c'; g.fillRect(0, 5, 15, 5);
        g.fillStyle = '#3a3d47'; for (let x = 1; x < 15; x += 3) g.fillRect(x, 5, 1, 5);
        g.fillStyle = '#6b6f7a'; g.fillRect(4, 6, 7, 1);
      });
      const stack = mode === 'stack';
      return objSprite(stack ? 'tyre-stack' : 'tyre-flat', 17, (g, n) => {
        pdisc(g, n, stack ? 8.2 : 7.2, '#0f1014'); pdisc(g, n, stack ? 7.2 : 6.3, '#2a2c33');
        pdisc(g, n, stack ? 5.0 : 4.2, '#6b6f7a'); pdisc(g, n, stack ? 3.6 : 3.0, '#1d1f25');
        if (stack) { g.fillStyle = '#4a4e58'; for (let x = 4; x < 13; x++) g.fillRect(x, 2, 1, 1); g.fillStyle = '#f2c94c'; g.fillRect(12, 6, 1, 2); }   // top ring glint, sponsor fleck
        g.clearRect(7, 7, 3, 3);                                                // the hole: ground shows through
      });
    }
    return null;
  }
  function drawPixelObject(c) {
    const sp = pixelObjectSprite(c);
    if (!sp) return false;
    const u = PPMz() / SPRITE_PPM;
    view.ctx.rotate(c.ang || 0);
    view.ctx.scale(u, u);
    view.ctx.drawImage(sp.c, -sp.size / 2, -sp.size / 2);
    return true;
  }

  // RALLY TAPE (cones.js sections): red / white between its posts; a SNAPPED section hangs as two short loose ends; tape STUCK to a car
  // trails behind it as a fluttering streamer (wall-clock flutter, fades after ~14 s)
  function drawTape(game) {
    const S = game.cones.tapes; if (!S || !S.length) return;
    const p = PPMz(), lw = Math.max(1.5, 0.12 * p);
    view.ctx.save(); view.ctx.lineWidth = lw; view.ctx.lineCap = 'butt';
    // TAPE PUFFS (cones.js: a section gone after its second hit; and a streamer coming off a car): a burst of red / white flecks
    const puff = (x, y, vx, vy, n) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.2832, v = 0.8 + Math.random() * 3.2;
        if (chips.length >= MAX_CHIPS) chips.shift();
        chips.push({ x: x + (Math.random() - 0.5) * 0.6, y: y + (Math.random() - 0.5) * 0.6, vx: vx + Math.cos(a) * v, vy: vy + Math.sin(a) * v, age: 0, life: 0.5 + Math.random() * 1.1, col: Math.random() < 0.5 ? '#e23b2e' : '#f2f2f2', sz: 2 });
      }
    };
    const PQ = game.cones.tapePuffs;
    if (PQ && PQ.length) { for (const q of PQ) puff(q.x, q.y, q.vx, q.vy, 22); PQ.length = 0; }
    for (const sct of S) {
      if (sct.gone) continue;
      const ax = sx(sct.a.x), ay = sy(sct.a.y), bx = sx(sct.b.x), by = sy(sct.b.y);
      if ((ax < -40 && bx < -40) || (ax > view.W + 40 && bx > view.W + 40) || (ay < -40 && by < -40) || (ay > view.H + 40 && by > view.H + 40)) continue;
      const seg = (x0, y0, x1, y1) => { view.ctx.setLineDash([0.5 * p, 0.5 * p]); view.ctx.strokeStyle = '#e23b2e'; view.ctx.beginPath(); view.ctx.moveTo(x0, y0); view.ctx.lineTo(x1, y1); view.ctx.stroke();
        view.ctx.lineDashOffset = 0.5 * p; view.ctx.strokeStyle = '#f2f2f2'; view.ctx.beginPath(); view.ctx.moveTo(x0, y0); view.ctx.lineTo(x1, y1); view.ctx.stroke(); view.ctx.lineDashOffset = 0; };
      if (!sct.broken) seg(ax, ay, bx, by);
      else { const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, e = Math.min(L * 0.35, 1.3 * p);
        seg(ax, ay, ax + dx / L * e + dy / L * e * 0.3, ay + dy / L * e - dx / L * e * 0.3); seg(bx, by, bx - dx / L * e + dy / L * e * 0.3, by - dy / L * e - dx / L * e * 0.3); }
    }
    view.ctx.setLineDash([]);
    const now = performance.now() / 1000, clock = game.cones.clock || 0;
    for (const car of [game.car, ...(game.ai || []).map((a) => a.car)]) {
      // null = reset (the car was teleported): no puff, just forget the count
      if (!car.streamers) { car._stN = 0; continue; }
      car.streamers = car.streamers.filter((st) => clock - st.born < 14);
      // a streamer lost since last frame (timed out, or knocked off by an impact in damage.js) goes up in a puff behind the car
      if (car._stN != null && car.streamers.length < car._stN) { const ch0 = Math.cos(car.heading), sh0 = Math.sin(car.heading);
        for (let n = car.streamers.length; n < car._stN; n++) puff(car.x - ch0 * car.spec.len * 0.5, car.y - sh0 * car.spec.len * 0.5, car.vx * 0.5, car.vy * 0.5, 12); }
      car._stN = car.streamers.length;
      const ch = Math.cos(car.heading), sh = Math.sin(car.heading), v = Math.hypot(car.vx, car.vy);
      const bxW = car.x - ch * car.spec.len * 0.45, byW = car.y - sh * car.spec.len * 0.45;
      car.streamers.forEach((st, k) => {
        // trails BEHIND the direction of travel (or the car's back when slow), fluttering
        const dirx = v > 1 ? -car.vx / v : -ch, diry = v > 1 ? -car.vy / v : -sh, side = (k - 1) * 0.35;
        view.ctx.beginPath(); view.ctx.moveTo(sx(bxW - sh * side), sy(byW + ch * side));
        for (let q = 1; q <= 6; q++) { const u = q / 6, w = Math.sin(now * 14 + st.phase + u * 5) * 0.35 * u;
          view.ctx.lineTo(sx(bxW - sh * side + dirx * st.len * u - diry * w), sy(byW + ch * side + diry * st.len * u + dirx * w)); }
        view.ctx.lineWidth = lw * 1.8; view.ctx.setLineDash([0.5 * p, 0.5 * p]); view.ctx.strokeStyle = '#e23b2e'; view.ctx.stroke(); view.ctx.lineDashOffset = 0.5 * p; view.ctx.strokeStyle = '#f2f2f2'; view.ctx.stroke(); view.ctx.lineDashOffset = 0; view.ctx.setLineDash([]); view.ctx.lineWidth = lw;   // streamers drawn thicker (photographed thin)
      });
    }
    view.ctx.restore();
  }
  // ROADSIDE DEBRIS (cones.js DEBRIS): top-down squares, rotated with the object; broken ones are a scatter of bits (seeded by home)
  const DEBRIS_KINDS = new Set(['pallet', 'box', 'crate', 'bin', 'sandbag', 'barrel', 'exhaust', 'bumper', 'tarp', 'splinters', 'cardboard', 'sand', 'fluff']);
  function drawDebris(c) {
    const p = PPMz(), P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
    const sh = (w, h) => { view.ctx.fillStyle = 'rgba(10,12,16,0.30)'; view.ctx.fillRect((-w / 2 + 0.15) * p, (-h / 2 + 0.25) * p, w * p, h * p); };
    view.ctx.rotate(c.ang || 0);
    switch (c.kind) {
      case 'pallet': sh(1.2, 1.0); P(-0.6, -0.5, 1.2, 1.0, '#8a6a43'); for (let k = 0; k < 4; k++) P(-0.6, -0.42 + k * 0.26, 1.2, 0.08, '#5e4529'); break;
      case 'box': sh(0.8, 0.6); P(-0.4, -0.3, 0.8, 0.6, '#b8925e'); P(-0.4, -0.04, 0.8, 0.08, '#d9c08a'); break;
      case 'crate': sh(1.0, 1.0); P(-0.5, -0.5, 1.0, 1.0, '#7d5a32'); P(-0.42, -0.42, 0.84, 0.84, '#9b7444'); P(-0.5, -0.05, 1.0, 0.1, '#5e4529'); P(-0.05, -0.5, 0.1, 1.0, '#5e4529'); break;
      case 'bin': sh(0.7, 0.8); P(-0.35, -0.4, 0.7, 0.8, c.col || '#2f5d3a'); P(-0.35, -0.4, 0.7, 0.14, '#1f3d27'); break;
      case 'sandbag': sh(0.9, 0.5); P(-0.45, -0.25, 0.9, 0.5, '#a89470'); P(-0.45, -0.25, 0.9, 0.08, '#c4b28c'); break;
      case 'barrel': sh(0.8, 0.8); P(-0.4, -0.4, 0.8, 0.8, c.col || '#2b56b5'); P(-0.25, -0.25, 0.5, 0.5, shade(c.col || '#2b56b5', 0.8)); P(-0.07, -0.07, 0.14, 0.14, '#1c1d20'); break;
      case 'exhaust': sh(1.0, 0.25); P(-0.5, -0.07, 0.8, 0.14, '#6a7077'); P(0.3, -0.13, 0.25, 0.26, '#4a4f57'); break;
      case 'bumper': sh(1.6, 0.3); P(-0.8, -0.15, 1.6, 0.3, c.col || '#c8302c'); P(-0.8, -0.15, 1.6, 0.07, 'rgba(255,255,255,0.3)'); break;
      case 'tarp': P(-0.9, -0.7, 1.8, 1.4, c.col || '#2f6fb0'); P(-0.9, -0.2, 1.8, 0.12, 'rgba(255,255,255,0.18)'); P(0.2, -0.7, 0.12, 1.4, 'rgba(0,0,0,0.15)'); break;
      default: {   // broken: a scatter of bits in its colour
        const rn = parkMiller(Math.floor(Math.abs((c.hx || 0) * 73.1 + (c.hy || 0) * 19.7)) % 9973 + 1);
        const cols = c.kind === 'fluff' ? ['#f6f5ef', '#dcdbd2'] : c.kind === 'sand' ? ['#c4b28c', '#a89470'] : c.kind === 'cardboard' ? ['#b8925e', '#d9c08a'] : ['#8a6a43', '#5e4529'];
        for (let q = 0; q < 14; q++) { const a = rn() * 6.283, rr = Math.sqrt(rn()) * 1.2, w = 0.12 + rn() * 0.3, h = c.kind === 'splinters' ? 0.08 : w; P(Math.cos(a) * rr - w / 2, Math.sin(a) * rr - h / 2, w, h, cols[q % 2]); }
      }
    }
  }
  function drawCones(cones) {
    const r = CONE_R * PPMz() * 1.35;   // drawn a touch over scale: a cone the player cannot see is not a cone
    for (const c of cones) {
      const px = sx(c.x), py = sy(c.y);
      if (px < -60 || px > view.W + 60 || py < -60 || py > view.H + 60) continue;
      const d = c.down;                       // 0 = upright, 1 = flat

      view.ctx.save();
      view.ctx.translate(px, py);
      if (c.kind === 'bale' || c.kind === 'straw') {
        const P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * PPMz(), y * PPMz(), w * PPMz(), h * PPMz()); };
        view.ctx.rotate(c.ang || 0);
        if (c.kind === 'bale') {
          // ROUND HAY BALE from the top: straw square, darker spiral ring (squares — the pixel rule)
          view.ctx.fillStyle = 'rgba(10,12,16,0.30)'; view.ctx.fillRect(-0.8 * PPMz() + 0.3 * PPMz(), -0.8 * PPMz() + 0.45 * PPMz(), 1.6 * PPMz(), 1.6 * PPMz());
          P(-0.8, -0.8, 1.6, 1.6, '#c9a85a'); P(-0.55, -0.55, 1.1, 1.1, '#b48f45'); P(-0.3, -0.3, 0.6, 0.6, '#d8bb6e'); P(-0.08, -0.08, 0.16, 0.16, '#9a7836');
        } else {
          // BURST STRAW: a spread of loose straw squares, the same every frame (seeded by its home position)
          const rn = parkMiller(Math.floor(Math.abs(c.hx * 73.1 + c.hy * 19.7)) % 9973 + 1);
          for (let q = 0; q < 26; q++) { const a = rn() * 6.283, rr = Math.sqrt(rn()) * 1.8, w = 0.2 + rn() * 0.35; P(Math.cos(a) * rr - w / 2, Math.sin(a) * rr - w / 2, w, w, q % 3 ? '#cfae62' : '#a8873f'); }
        }
        view.ctx.restore(); continue;
      }
      if (c.kind === 'sheep' || c.kind === 'cow') {
        // SHEEP / COW (S-C: loose objects, cones.js; the old field look): a body square, a head square at +x, a shadow. A TIPPED cow lies
        // on its side: four dark leg squares out, the head flat
        const p = PPMz(), P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        view.ctx.rotate(c.ang || 0);
        if (c.kind === 'cow' && c.tipped) { P(-0.9, -0.2, 2, 0.9, 'rgba(10,12,16,0.3)'); P(-1.1, -0.45, 2, 0.85, '#f0eee8'); P(-0.6, -0.45, 0.7, 0.4, '#1c1d20');
          for (const lx of [-0.9, -0.5, 0.15, 0.55]) P(lx, 0.4, 0.2, 0.55, '#1c1d20'); P(0.9, -0.3, 0.55, 0.55, '#1c1d20'); }
        else if (c.kind === 'cow') { P(-0.9, -0.35, 2, 1, 'rgba(10,12,16,0.3)'); P(-1.1, -0.5, 2, 1, '#f0eee8'); P(-0.7, -0.5, 0.6, 0.5, '#1c1d20'); P(0.2, 0, 0.5, 0.5, '#1c1d20'); P(0.9, -0.3, 0.55, 0.6, '#1c1d20'); }
        else { P(-0.45, -0.2, 1, 0.7, 'rgba(10,12,16,0.3)'); P(-0.55, -0.35, 1, 0.7, '#ecebe4'); P(-0.45, -0.25, 0.8, 0.5, '#f7f6f0'); P(0.42, -0.2, 0.32, 0.4, '#2a2a2c'); }
        view.ctx.restore(); continue;
      }
      if (DEBRIS_KINDS.has(c.kind)) { drawDebris(c); view.ctx.restore(); continue; }
      if (c.kind === 'tapepost') {
        // a tape POST: a dark stake (upright) or lying (knocked)
        const p = PPMz(); view.ctx.rotate(c.ang || 0); view.ctx.fillStyle = '#3a2d21';
        if (d < 0.5) view.ctx.fillRect(-0.12 * p, -0.12 * p, 0.24 * p, 0.24 * p); else view.ctx.fillRect(-0.6 * p, -0.06 * p, 1.2 * p, 0.12 * p);
        view.ctx.restore(); continue;
      }
      if (c.kind === 'chevron' || c.kind === 'flag') {
        // a knockable CHEVRON board / FLAG (cones.js): upright as the old prop; once knocked (down > 0.5) lying flat — the chevron face up
        // and darker, the flag pole down with its cloth crumpled beside it
        const p = PPMz(), P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        view.ctx.rotate(c.ang || 0);
        if (c.kind === 'chevron') {
          view.ctx.scale(1.6, 1.6);
          if (d < 0.5) { view.ctx.fillStyle = 'rgba(10,12,16,0.32)'; view.ctx.fillRect(-1.6 * p + 0.3 * p, -0.25 * p + 0.5 * p, 3.2 * p, 0.5 * p); P(-1.6, -0.25, 3.2, 0.5, '#15171c');
            for (let k = 0; k < 3; k++) { P(-1.25 + k * 1.0, -0.2, 0.25, 0.15, '#f2c21b'); P(-1.0 + k * 1.0, -0.075, 0.25, 0.15, '#f2c21b'); P(-1.25 + k * 1.0, 0.05, 0.25, 0.15, '#f2c21b'); } }
          else { P(-1.6, -0.5, 3.2, 1.0, '#15171c'); for (let k = 0; k < 3; k++) { P(-1.25 + k * 1.0, -0.4, 0.3, 0.3, '#b08c14'); P(-0.95 + k * 1.0, -0.15, 0.3, 0.3, '#b08c14'); P(-1.25 + k * 1.0, 0.1, 0.3, 0.3, '#b08c14'); }
            P(-1.5, 0.5, 0.15, 0.6, '#5a4632'); P(1.35, 0.5, 0.15, 0.6, '#5a4632'); }   // face up, its two posts
        } else {
          if (d < 0.5) { view.ctx.fillStyle = 'rgba(10,12,16,0.28)'; view.ctx.fillRect(0.2 * p, 0.1 * p, 1.8 * p, 0.6 * p);
            P(-0.15, -0.15, 0.3, 0.3, '#3a3f47'); P(0.15, -0.55, 1.3, 0.75, c.col || '#c8302c'); P(0.15, -0.55, 1.3, 0.12, 'rgba(255,255,255,0.35)'); }
          else { P(-1.1, -0.06, 2.2, 0.12, '#5a5f68'); P(0.6, 0.06, 0.8, 0.5, c.col || '#c8302c'); P(0.9, 0.2, 0.5, 0.3, shade(c.col || '#c8302c', 0.7)); }   // pole down, cloth crumpled
        }
        view.ctx.restore(); continue;
      }
      if (PIXEL && drawPixelObject(c)) { view.ctx.restore(); continue; }

      if (c.kind === 'banger') {
        const p = PPMz();
        view.ctx.rotate(c.ang);
        // Cast shadow
        view.ctx.fillStyle = 'rgba(10,12,16,0.44)';
        roundRect(view.ctx, -2.1 * p + 3, -1.0 * p + 4, 4.2 * p, 2.0 * p, 5); view.ctx.fill();
        // Dented banger body with primer & rust patches
        view.ctx.fillStyle = c.paint || '#7c342a';
        roundRect(view.ctx, -2.1 * p, -1.0 * p, 4.2 * p, 2.0 * p, 4); view.ctx.fill();
        view.ctx.strokeStyle = '#181a1f'; view.ctx.lineWidth = 1.2; view.ctx.stroke();
        // Heavy triangular welded iron roof fin with driver number
        view.ctx.fillStyle = '#1e2129';
        view.ctx.fillRect(-0.4 * p, -0.15 * p, 1.4 * p, 0.3 * p);
        view.ctx.fillStyle = '#f8fafc';
        view.ctx.font = `900 ${Math.round(1.05 * p)}px Impact, ui-sans-serif, sans-serif`;
        view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
        view.ctx.fillText(c.num || '42', 0.3 * p, 0);
        // Smashed windscreen & open cabin showing welded H-frame roll-bar
        view.ctx.fillStyle = '#14161c';
        roundRect(view.ctx, -0.8 * p, -0.75 * p, 1.9 * p, 1.5 * p, 2); view.ctx.fill();
        // Steel roll-cage crossbars
        view.ctx.strokeStyle = '#e2e8f0'; view.ctx.lineWidth = 1.5;
        view.ctx.beginPath();
        view.ctx.moveTo(-0.5 * p, -0.6 * p); view.ctx.lineTo(0.7 * p, 0.6 * p);
        view.ctx.moveTo(-0.5 * p, 0.6 * p); view.ctx.lineTo(0.7 * p, -0.6 * p);
        view.ctx.stroke();
        // Crumpled front wing & exposed radiator
        view.ctx.fillStyle = '#3a3e48';
        view.ctx.fillRect(1.8 * p, -0.6 * p, 0.3 * p, 1.2 * p);
        // Smashed headlight
        view.ctx.fillStyle = '#fff6dc';
        view.ctx.beginPath(); view.ctx.arc(1.9 * p, -0.6 * p, 0.15 * p, 0, Math.PI * 2); view.ctx.fill();
        // Sponsor stencil on boot
        view.ctx.fillStyle = 'rgba(255,255,255,0.7)';
        view.ctx.font = `700 ${Math.round(0.35 * p)}px ui-monospace, monospace`;
        view.ctx.fillText("BILL'S SCRAP", -1.3 * p, 0);
        view.ctx.restore();
        continue;
      }

      if (c.kind === 'caravan') {
        const p = PPMz();
        view.ctx.rotate(c.ang);
        // Cast shadow
        view.ctx.fillStyle = 'rgba(10,12,16,0.40)';
        roundRect(view.ctx, -2.4 * p + 4, -1.1 * p + 5, 4.8 * p, 2.2 * p, 7); view.ctx.fill();
        // Steel A-frame tow hitch with black jockey wheel
        view.ctx.strokeStyle = '#5a6270'; view.ctx.lineWidth = Math.max(2, 0.14 * p);
        view.ctx.beginPath(); view.ctx.moveTo(2.4 * p, -0.35 * p); view.ctx.lineTo(3.3 * p, 0); view.ctx.lineTo(2.4 * p, 0.35 * p); view.ctx.stroke();
        // Jockey wheel
        view.ctx.fillStyle = '#111';
        view.ctx.fillRect(3.1 * p, -0.15 * p, 0.3 * p, 0.3 * p);
        // Green gas bottle mounted on A-frame
        view.ctx.fillStyle = '#2d6a4f';
        roundRect(view.ctx, 2.5 * p, -0.2 * p, 0.4 * p, 0.4 * p, 2); view.ctx.fill();
        // Rounded retro tourer body in classic warm cream
        view.ctx.fillStyle = '#f4f0e6';
        roundRect(view.ctx, -2.4 * p, -1.1 * p, 4.8 * p, 2.2 * p, 6); view.ctx.fill();
        view.ctx.strokeStyle = '#9ca3af'; view.ctx.lineWidth = 1.2; view.ctx.stroke();
        // Burnt-orange & chocolate dual vintage beltline stripes
        view.ctx.fillStyle = '#c0561a';
        view.ctx.fillRect(-2.3 * p, -0.22 * p, 4.6 * p, 0.28 * p);
        view.ctx.fillStyle = '#5a280d';
        view.ctx.fillRect(-2.3 * p, 0.08 * p, 4.6 * p, 0.12 * p);
        // Pop-up roof vent hatch
        view.ctx.fillStyle = '#d8d4c8';
        roundRect(view.ctx, -0.4 * p, -0.4 * p, 0.8 * p, 0.8 * p, 2); view.ctx.fill();
        view.ctx.fillStyle = 'rgba(0,0,0,0.18)';
        view.ctx.fillRect(-0.4 * p, 0.3 * p, 0.8 * p, 0.1 * p); // vent shadow
        // Tinted panoramic front & rear windows with curtain borders
        view.ctx.fillStyle = '#1e293b';
        roundRect(view.ctx, 1.7 * p, -0.85 * p, 0.5 * p, 1.7 * p, 1.5); view.ctx.fill();
        roundRect(view.ctx, -2.2 * p, -0.85 * p, 0.5 * p, 1.7 * p, 1.5); view.ctx.fill();
        view.ctx.fillStyle = '#ffffff'; // White curtain trim
        view.ctx.fillRect(1.7 * p, -0.85 * p, 0.1 * p, 1.7 * p);
        view.ctx.fillRect(-1.8 * p, -0.85 * p, 0.1 * p, 1.7 * p);
        // Side door with handle
        view.ctx.strokeStyle = '#94a3b8'; view.ctx.lineWidth = 1;
        view.ctx.strokeRect(-0.8 * p, 0.4 * p, 1.0 * p, 0.7 * p);
        view.ctx.fillStyle = '#cbd5e1';
        view.ctx.fillRect(-0.7 * p, 0.65 * p, 0.15 * p, 0.15 * p); // handle
        // Amber side marker lights and red circular taillights
        view.ctx.fillStyle = '#f59e0b';
        view.ctx.fillRect(-1.0 * p, -1.15 * p, 0.2 * p, 0.1 * p);
        view.ctx.fillRect(1.0 * p, -1.15 * p, 0.2 * p, 0.1 * p);
        view.ctx.fillStyle = '#ef4444';
        view.ctx.beginPath(); view.ctx.arc(-2.4 * p, -0.7 * p, 0.12 * p, 0, Math.PI * 2); view.ctx.fill();
        view.ctx.beginPath(); view.ctx.arc(-2.4 * p, 0.7 * p, 0.12 * p, 0, Math.PI * 2); view.ctx.fill();
        view.ctx.restore();
        continue;
      }

      if (c.kind === 'podium') {
        const p = PPMz();
        view.ctx.rotate(c.ang);
        // Ground shadow
        view.ctx.fillStyle = 'rgba(10,12,16,0.38)';
        roundRect(view.ctx, -1.8 * p + 3, -1.0 * p + 4, 3.6 * p, 2.0 * p, 3); view.ctx.fill();
        // 3 stepped blocks: 2nd (left), 1st (center), 3rd (right)
        // Center 1st place tier
        view.ctx.fillStyle = '#b4783e';
        roundRect(view.ctx, -0.6 * p, -1.0 * p, 1.2 * p, 2.0 * p, 2); view.ctx.fill();
        view.ctx.strokeStyle = '#5a3512'; view.ctx.lineWidth = 1.2; view.ctx.stroke();
        // Left 2nd place tier
        view.ctx.fillStyle = '#9b622e';
        roundRect(view.ctx, -1.7 * p, -0.85 * p, 1.1 * p, 1.7 * p, 2); view.ctx.fill();
        view.ctx.stroke();
        // Right 3rd place tier
        view.ctx.fillStyle = '#874f20';
        roundRect(view.ctx, 0.6 * p, -0.75 * p, 1.1 * p, 1.5 * p, 2); view.ctx.fill();
        view.ctx.stroke();
        // Chequered bunting skirt along the front bottom
        const checkW = 0.3 * p;
        for (let cx = -1.7 * p; cx < 1.7 * p; cx += checkW) {
          view.ctx.fillStyle = Math.floor(cx / checkW) % 2 === 0 ? '#111' : '#fff';
          view.ctx.fillRect(cx, 0.85 * p, checkW, 0.15 * p);
        }
        // Numerals 1, 2, 3
        view.ctx.fillStyle = '#ffffff';
        view.ctx.font = `900 ${Math.round(0.75 * p)}px ui-sans-serif, sans-serif`;
        view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
        view.ctx.fillText('1', 0, 0.3 * p);
        view.ctx.fillText('2', -1.15 * p, 0.3 * p);
        view.ctx.fillText('3', 1.15 * p, 0.3 * p);
        // Gold / Silver / Bronze trophy cups on the top steps!
        // 1st place Gold cup
        view.ctx.fillStyle = '#eab308';
        view.ctx.fillRect(-0.25 * p, -0.75 * p, 0.5 * p, 0.45 * p);
        view.ctx.fillRect(-0.15 * p, -0.3 * p, 0.3 * p, 0.15 * p);
        view.ctx.strokeStyle = '#ca8a04'; view.ctx.lineWidth = 1.2;
        view.ctx.beginPath(); view.ctx.arc(0, -0.52 * p, 0.35 * p, -0.6, 0.6); view.ctx.stroke(); // cup handles
        // 2nd place Silver cup
        view.ctx.fillStyle = '#cbd5e1';
        view.ctx.fillRect(-1.35 * p, -0.65 * p, 0.4 * p, 0.35 * p);
        view.ctx.fillRect(-1.25 * p, -0.3 * p, 0.2 * p, 0.12 * p);
        // 3rd place Bronze cup
        view.ctx.fillStyle = '#b45309';
        view.ctx.fillRect(0.95 * p, -0.55 * p, 0.4 * p, 0.35 * p);
        view.ctx.fillRect(1.05 * p, -0.2 * p, 0.2 * p, 0.12 * p);
        view.ctx.restore();
        continue;
      }

      if (c.kind === 'tyrestack' || c.kind === 'tyre') {
        const tr = (c.r || 0.42) * PPMz();
        const mode = c.mode || (c.kind === 'tyrestack' ? 'stack' : 'flat');

        if (mode === 'roll') {
          // Upright rolling tyre seen from above: rounded tread capsule rolling along c.ang
          view.ctx.rotate(c.ang);
          const tw = tr * 0.24;
          // Rolling shadow
          view.ctx.fillStyle = 'rgba(12,14,18,0.40)';
          roundRect(view.ctx, -tr * 0.95 + 2, -tw + 2, tr * 1.9, tw * 2, tw);
          view.ctx.fill();

          // Outer rubber tread body with fully rounded semicircle caps (radius = tw)
          view.ctx.fillStyle = '#202228';
          roundRect(view.ctx, -tr * 0.95, -tw, tr * 1.9, tw * 2, tw);
          view.ctx.fill();
          view.ctx.strokeStyle = '#686f82';
          view.ctx.lineWidth = 1.2;
          view.ctx.stroke();

          // Scrolling tread grooves / sipes
          view.ctx.fillStyle = '#101114';
          const rollOff = ((c.rollDist || 0) * PPMz()) % (tr * 0.35);
          for (let gx = -tr * 0.70 + rollOff; gx < tr * 0.70; gx += tr * 0.35) {
            view.ctx.fillRect(gx, -tw * 0.85, 2, tw * 1.7);
          }
        } else if (mode === 'flip') {
          // Tumbling end-over-end — always completely rounded, circular/elliptical perspective
          view.ctx.rotate(c.ang);
          const flipScale = Math.abs(Math.cos(c.flipPhase || 0));
          const faceH = tr * Math.max(0.18, flipScale);

          // Contact / tumbling ground shadow
          view.ctx.fillStyle = 'rgba(12,14,18,0.36)';
          view.ctx.beginPath();
          view.ctx.ellipse(2, 3, tr * 1.05, faceH * 1.05, 0, 0, Math.PI * 2);
          view.ctx.fill();

          // If tilted edge-on, show the cylindrical curved tread thickness behind the face
          if (flipScale < 0.45) {
            view.ctx.fillStyle = '#14151a';
            view.ctx.beginPath();
            view.ctx.ellipse(0, tr * 0.16 * (1 - flipScale), tr * 0.98, faceH * 0.95, 0, 0, Math.PI * 2);
            view.ctx.fill();
          }

          // Main circular/elliptical tyre face (zero square corners)
          view.ctx.fillStyle = '#24262e';
          view.ctx.beginPath();
          view.ctx.ellipse(0, 0, tr, faceH, 0, 0, Math.PI * 2);
          view.ctx.fill();
          view.ctx.strokeStyle = '#686f82';
          view.ctx.lineWidth = 1.4;
          view.ctx.stroke();

          // Sidewall sponsor stencils (compressed with faceH)
          if (faceH > tr * 0.35) {
            view.ctx.strokeStyle = '#ffffff';
            view.ctx.lineWidth = Math.max(1, tr * 0.08);
            view.ctx.beginPath();
            view.ctx.ellipse(0, 0, tr * 0.65, faceH * 0.65, 0, 0.3, 1.9);
            view.ctx.stroke();
            view.ctx.beginPath();
            view.ctx.ellipse(0, 0, tr * 0.65, faceH * 0.65, 0, 3.4, 5.0);
            view.ctx.stroke();
          }

          // Inner hollow hub hole
          view.ctx.fillStyle = '#0a0b0e';
          view.ctx.beginPath();
          view.ctx.ellipse(0, 0, tr * 0.44, faceH * 0.44, 0, 0, Math.PI * 2);
          view.ctx.fill();
          view.ctx.strokeStyle = '#1e2026';
          view.ctx.lineWidth = 1.1;
          view.ctx.stroke();
        } else if (mode === 'wobble') {
          // Precessing Euler wobble before slapping flat
          view.ctx.rotate(c.ang + Math.sin(c.wobblePhase || 0) * 0.4);
          const tiltScale = 0.65 + 0.35 * Math.abs(Math.sin(c.wobblePhase || 0));

          view.ctx.fillStyle = 'rgba(12,14,18,0.35)';
          view.ctx.beginPath();
          view.ctx.arc(2, 2.5, tr * 1.04, 0, Math.PI * 2);
          view.ctx.fill();

          view.ctx.fillStyle = '#24262e';
          view.ctx.beginPath();
          view.ctx.ellipse(0, 0, tr, tr * tiltScale, 0, 0, Math.PI * 2);
          view.ctx.fill();
          view.ctx.strokeStyle = '#686f82';
          view.ctx.lineWidth = 1.3;
          view.ctx.stroke();

          view.ctx.fillStyle = '#0a0b0e';
          view.ctx.beginPath();
          view.ctx.ellipse(0, 0, tr * 0.44, tr * 0.44 * tiltScale, 0, 0, Math.PI * 2);
          view.ctx.fill();
        } else if (mode === 'stack') {
          // Standing 3-tier tyre stack seen from above
          view.ctx.fillStyle = 'rgba(14,16,20,0.38)';
          view.ctx.beginPath();
          view.ctx.arc(2.5, 3.5, tr * 1.08, 0, Math.PI * 2);
          view.ctx.fill();

          // Tier 1 (bottom tyre offset ring)
          view.ctx.fillStyle = '#181920';
          view.ctx.beginPath();
          view.ctx.arc(-1.5, -1.5, tr * 1.06, 0, Math.PI * 2);
          view.ctx.fill();
          view.ctx.strokeStyle = '#484c58';
          view.ctx.lineWidth = 1.1;
          view.ctx.stroke();

          // Tier 2 (middle tyre offset ring)
          view.ctx.fillStyle = '#1f2128';
          view.ctx.beginPath();
          view.ctx.arc(1.2, 1.2, tr * 1.02, 0, Math.PI * 2);
          view.ctx.fill();
          view.ctx.strokeStyle = '#555a68';
          view.ctx.lineWidth = 1.1;
          view.ctx.stroke();

          // Top Tyre (pure circle)
          view.ctx.fillStyle = '#262830';
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr, 0, Math.PI * 2);
          view.ctx.fill();
          view.ctx.strokeStyle = '#686f82';
          view.ctx.lineWidth = 1.4;
          view.ctx.stroke();

          view.ctx.strokeStyle = '#14151a';
          view.ctx.lineWidth = Math.max(1, tr * 0.16);
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.84, 0, Math.PI * 2);
          view.ctx.stroke();

          // Sidewall sponsor stencils
          view.ctx.strokeStyle = '#ffffff';
          view.ctx.lineWidth = Math.max(1, tr * 0.09);
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.65, 0.3, 1.9);
          view.ctx.stroke();
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.65, 3.4, 5.0);
          view.ctx.stroke();

          view.ctx.strokeStyle = '#f5c518';
          view.ctx.lineWidth = Math.max(1, tr * 0.05);
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.65, 2.1, 2.7);
          view.ctx.stroke();
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.65, 5.2, 5.8);
          view.ctx.stroke();

          view.ctx.fillStyle = '#0a0b0e';
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.44, 0, Math.PI * 2);
          view.ctx.fill();
          view.ctx.strokeStyle = '#1e2026';
          view.ctx.lineWidth = 1.2;
          view.ctx.stroke();
        } else {
          // Single flat tyre lying on ground — 100% PURE CIRCLE (zero oval)
          view.ctx.rotate(c.ang);

          // Circular contact shadow
          view.ctx.fillStyle = 'rgba(12,14,18,0.36)';
          view.ctx.beginPath();
          view.ctx.arc(2.0, 2.5, tr * 1.05, 0, Math.PI * 2);
          view.ctx.fill();

          // Main tyre rubber body (pure circle)
          view.ctx.fillStyle = '#24262e';
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr, 0, Math.PI * 2);
          view.ctx.fill();

          // High-contrast outer silhouette ring
          view.ctx.strokeStyle = '#686f82';
          view.ctx.lineWidth = 1.4;
          view.ctx.stroke();

          // Tread groove ring
          view.ctx.strokeStyle = '#14151a';
          view.ctx.lineWidth = Math.max(1, tr * 0.16);
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.84, 0, Math.PI * 2);
          view.ctx.stroke();

          // Sidewall sponsor stencils (rotates with c.ang)
          view.ctx.strokeStyle = '#ffffff';
          view.ctx.lineWidth = Math.max(1, tr * 0.09);
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.65, 0.3, 1.9);
          view.ctx.stroke();
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.65, 3.4, 5.0);
          view.ctx.stroke();

          view.ctx.strokeStyle = '#f5c518';
          view.ctx.lineWidth = Math.max(1, tr * 0.05);
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.65, 2.1, 2.7);
          view.ctx.stroke();
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.65, 5.2, 5.8);
          view.ctx.stroke();

          // Inner hollow hole
          view.ctx.fillStyle = '#0a0b0e';
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.44, 0, Math.PI * 2);
          view.ctx.fill();
          view.ctx.strokeStyle = '#1e2026';
          view.ctx.lineWidth = 1.2;
          view.ctx.stroke();
        }
        view.ctx.restore();
        continue;
      }

      if (d > 0.02) {
        // ---- lying down: the cone's body stretches out along `ang`, the base stays put
        view.ctx.rotate(c.ang);
        const len = r * (1.0 + 2.6 * d);
        view.ctx.fillStyle = 'rgba(40,38,46,0.18)';
        view.ctx.beginPath();
        view.ctx.ellipse(len * 0.3 + 2, 2.5, len * 0.78, r * 1.1, 0, 0, Math.PI * 2);
        view.ctx.fill();
        // body, tapering to the tip
        view.ctx.fillStyle = COL.cone;
        view.ctx.beginPath();
        view.ctx.moveTo(0, -r * 1.25);
        view.ctx.lineTo(len, -r * 0.34);
        view.ctx.lineTo(len, r * 0.34);
        view.ctx.lineTo(0, r * 1.25);
        view.ctx.closePath();
        view.ctx.fill();
        // the reflective band, now a stripe across the lying body
        view.ctx.fillStyle = COL.coneBand;
        view.ctx.beginPath();
        view.ctx.moveTo(len * 0.52, -r * 0.72);
        view.ctx.lineTo(len * 0.74, -r * 0.48);
        view.ctx.lineTo(len * 0.74, r * 0.48);
        view.ctx.lineTo(len * 0.52, r * 0.72);
        view.ctx.closePath();
        view.ctx.fill();
        // square base plate
        view.ctx.fillStyle = COL.coneDark;
        roundRect(view.ctx, -r * 0.5, -r * 1.45, r * 1.0, r * 2.9, 2);
        view.ctx.fill();
      } else {
        // ---- upright: concentric rings, seen from above
        view.ctx.fillStyle = 'rgba(40,38,46,0.20)';
        view.ctx.beginPath(); view.ctx.ellipse(r * 0.5, r * 0.7, r * 1.35, r * 1.0, 0, 0, Math.PI * 2); view.ctx.fill();
        view.ctx.fillStyle = COL.coneDark;
        view.ctx.beginPath(); view.ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2); view.ctx.fill();
        view.ctx.fillStyle = COL.cone;
        view.ctx.beginPath(); view.ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2); view.ctx.fill();
        view.ctx.fillStyle = COL.coneBand;
        view.ctx.beginPath(); view.ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2); view.ctx.fill();
        view.ctx.fillStyle = COL.cone;
        view.ctx.beginPath(); view.ctx.arc(0, 0, r * 0.46, 0, Math.PI * 2); view.ctx.fill();
      }
      view.ctx.restore();
    }
  }

  return { drawCones, drawTape };
}
