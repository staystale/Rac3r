// the PROPS layer of render.ts (phase 4 of the render.js split): fence, barriers, bridges,
// garage rows and props - the trackside scenery. Moved verbatim.
import { parkMiller } from '../core/random.ts';
import { RUNOFF_W } from '../world/bounds.ts';
import { LEVEL, PROPS } from '../world/state.ts';
import { BARRIER_HALF } from '../world/barriers.ts';
import type { Point, Prop } from '../world/types.ts';
import type { Cam, ForSide, View } from './types.ts';

// what createProps destructures from the renderer, the ground painter and the road painter
interface PropsHelpers {
  PPMz: () => number;
  toScreenX: (wx: number) => number;
  toScreenY: (wy: number) => number;
  roundRect: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) => void;
  forSide: ForSide;
  drawSlip: (prop: Prop, ppm: number) => void;
}

export function createProps(view: View, cam: Cam, helpers: PropsHelpers) {
  const { PPMz, toScreenX, toScreenY, roundRect, forSide, drawSlip } = helpers;

  function drawFence() {
    // MEASURED 2026-10-05: ~133k mesh segments + posts per frame along a 100 km edge (55-105 ms
    // frames)
    if (LEVEL.endless) return;
    for (let i = 0; i < 4; i++)
      forSide(i, (ppm: number, edgeDist: number, halfLen: number) => {
        const y = (edgeDist + RUNOFF_W) * ppm,
          // E: the half-length of this side's fence, corners included
          fenceHalf = halfLen + RUNOFF_W;
        // only the stretch in view (the frame's cam / W from forSide): the long sides are ~1 km of
        // mesh
        const uMin = Math.max(-fenceHalf, Math.floor((cam.x - view.W / 2 / ppm) / 4) * 4 - 4),
          uMax = Math.min(fenceHalf, cam.x + view.W / 2 / ppm + 4);
        // High-performance Armco crash barrier:
        // 1. Backing catch-fence wire mesh
        view.ctx.strokeStyle = 'rgba(145,148,160,0.32)';
        view.ctx.lineWidth = Math.max(1, 0.08 * ppm);
        view.ctx.beginPath();
        for (
          let pos = Math.max(-fenceHalf, Math.floor((uMin + fenceHalf) / 2.4) * 2.4 - fenceHalf);
          pos < uMax;
          pos += 2.4
        ) {
          view.ctx.moveTo(pos * ppm, y - 1.2 * ppm);
          view.ctx.lineTo((pos + 2.4) * ppm, y + 0.4 * ppm);
          view.ctx.moveTo((pos + 2.4) * ppm, y - 1.2 * ppm);
          view.ctx.lineTo(pos * ppm, y + 0.4 * ppm);
        }
        view.ctx.stroke();

        // 2. Steel I-beam stanchions every 4 m
        const postW = Math.max(2, 0.28 * ppm);
        const postH = Math.max(3, 0.55 * ppm);
        view.ctx.fillStyle = '#42454e';
        for (
          let pos = Math.max(-fenceHalf, Math.floor((uMin + fenceHalf) / 4) * 4 - fenceHalf);
          pos <= uMax;
          pos += 4
        ) {
          view.ctx.fillRect(pos * ppm - postW / 2, y - postH * 0.4, postW, postH);
        }

        // 3. Double-corrugated Armco rail: deep shadow underneath, steel beam, specular upper
        // highlight
        view.ctx.fillStyle = 'rgba(25,27,32,0.6)';
        view.ctx.fillRect(
          -fenceHalf * ppm,
          y + 0.15 * ppm,
          fenceHalf * 2 * ppm,
          Math.max(1, 0.15 * ppm),
        );

        view.ctx.fillStyle = '#9296a2'; // galvanized beam
        view.ctx.fillRect(
          -fenceHalf * ppm,
          y - 0.25 * ppm,
          fenceHalf * 2 * ppm,
          Math.max(2, 0.45 * ppm),
        );

        view.ctx.fillStyle = '#d2d6e2'; // top reflective bevel
        view.ctx.fillRect(
          -fenceHalf * ppm,
          y - 0.25 * ppm,
          fenceHalf * 2 * ppm,
          Math.max(1, 0.12 * ppm),
        );
      });
  }

  // ---------------------------------------------------------------- trackside scenery & props
  // BARRIERS (lab.js LEVEL.barriers): drawn at exactly the width the physics collides with
  // (BARRIER_HALF)
  function drawBarriers() {
    const list = LEVEL.barriers;
    if (!list || !list.length) return;
    const ppm = PPMz();
    const path = (pts: Point[]) => {
      view.ctx.beginPath();
      pts.forEach(([x, y], i) =>
        i ? view.ctx.lineTo(toScreenX(x), toScreenY(y)) : view.ctx.moveTo(toScreenX(x),
          toScreenY(y)));
    };
    const posts = (pts: Point[], every: number, size: number, col: string) => {
      view.ctx.fillStyle = col;
      let acc = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const [fromX, fromY] = pts[i],
          [toX, toY] = pts[i + 1],
          segLen = Math.hypot(toX - fromX, toY - fromY);
        for (; acc <= segLen; acc += every) {
          const frac = acc / segLen,
            x = fromX + (toX - fromX) * frac,
            y = fromY + (toY - fromY) * frac;
          view.ctx.fillRect(
            toScreenX(x) - (size * ppm) / 2,
            toScreenY(y) - (size * ppm) / 2,
            size * ppm,
            size * ppm,
          );
        }
        acc -= segLen;
      }
    };
    view.ctx.save();
    view.ctx.lineJoin = 'round';
    view.ctx.lineCap = 'butt';
    for (const barrier of list) {
      const half = BARRIER_HALF[barrier.kind] ?? 0.2;
      if (barrier.kind === 'building') continue;
      // OFF-SCREEN CULL (2026-10-04): Thruston's ~500 m of Armco was stroked + posted every frame
      // for the whole lap
      if (!barrier._rbb) {
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const [x, y] of barrier.pts) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
        barrier._rbb = [minX - 1, minY - 1, maxX + 1, maxY + 1];
      }
      if (
        toScreenX(barrier._rbb[0]) > view.W ||
        toScreenX(barrier._rbb[2]) < 0 ||
        toScreenY(barrier._rbb[1]) > view.H ||
        toScreenY(barrier._rbb[3]) < 0
      )
        continue;
      if (barrier.kind === 'line') {
        path(barrier.pts);
        view.ctx.strokeStyle = barrier.col || '#e2c13a';
        view.ctx.lineWidth = Math.max(1, 0.25 * ppm);
        view.ctx.stroke();
        continue;
      }
      if (barrier.kind === 'fence') {
        path(barrier.pts);
        view.ctx.strokeStyle = 'rgba(40,44,52,0.55)';
        view.ctx.lineWidth = Math.max(1, 2 * half * ppm);
        view.ctx.stroke();
        posts(barrier.pts, 3, 0.35, '#2b2f38');
        continue;
      }
      if (barrier.kind === 'armco') {
        path(barrier.pts);
        view.ctx.strokeStyle = '#5d626d';
        view.ctx.lineWidth = Math.max(2, 2 * half * ppm);
        view.ctx.stroke(); // shadowed rail
        path(barrier.pts);
        view.ctx.strokeStyle = '#c9ccd3';
        view.ctx.lineWidth = Math.max(1, half * ppm);
        view.ctx.stroke(); // bright face
        posts(barrier.pts, 2, 0.32, '#3d4049');
        continue;
      }
      // wall / pitwall
      path(barrier.pts);
      view.ctx.strokeStyle = '#a9a7a0';
      view.ctx.lineWidth = Math.max(2, 2 * half * ppm);
      view.ctx.stroke();
      if (barrier.kind === 'pitwall') {
        // painted red / white / blue blocks along the base (photographed at Thruxton)
        view.ctx.lineWidth = Math.max(1, half * 0.9 * ppm);
        const cols = ['#c8302c', '#f2f2f2', '#2b56b5'];
        view.ctx.setLineDash([2 * ppm, 4 * ppm]);
        cols.forEach((col, stripe) => {
          view.ctx.lineDashOffset = -stripe * 2 * ppm;
          path(barrier.pts);
          view.ctx.strokeStyle = col;
          view.ctx.stroke();
        });
        view.ctx.setLineDash([]);
      }
    }
    view.ctx.restore();
  }
  // BRIDGES (highway.js extras): carries 'road' / 'rail' / 'foot' = a deck OVER the motorway (kind
  // 'bridge', drawn after the cars); kind 'river' = the motorway over water. Local frame: +x along
  // the deck (across the motorway). Squares only. v2 (2026-10-06, user: "bridges have no connecting
  // roads so it looks silly"; "make the cars n stuff move across if you can ... only if cheap
  // enough"): the APPROACHES (highway.js approaches(): lane ribbons in the ground tiles) run
  // pr.appL[0 | 1] m out from each end; their markings / rails are drawn here, and so is what MOVES
  // across: cars both ways, walkers, a train every pr.trainEvery s. Pure drawing on the wall clock
  // (no physics, no state): a few dozen squares per bridge on screen. The RIVER's water is now a
  // real 'wet' cover (lab.js covers: the puddle water, grip and spray, painted into the ground
  // tiles; user: "water seemed to be painted and not our water texture"), so only the boat is drawn
  // here.
  function drawBridge(prop: Prop, ppm: number) {
    const paint = (x: number, y: number, width: number, height: number, col: string) => {
      view.ctx.fillStyle = col;
      view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
    };
    const half = (prop.wid || 30) / 2,
      carries = prop.carries,
      seed = prop.seed || 0;
    if (prop.kind === 'river') {
      if (prop.boat) {
        const boatX = (prop.roadHw || half - 9) / Math.cos(prop.skew || 0) + 4;
        paint(boatX, -1.2, 5, 2.4, '#e9e4d8');
        paint(boatX + 1, -0.8, 2, 1.6, '#c8302c');
        paint(boatX + 0.2, -1.25, 4.6, 0.2, '#6a7077');
      }
      return;
    }
    const negEnd = half + 3 + ((prop.appL && prop.appL[0]) ?? 0),
      posEnd = half + 3 + ((prop.appL && prop.appL[1]) ?? 0),
      trackLen = negEnd + posEnd,
      clock = performance.now() / 1000 + (prop.phase || 0);
    // a mover at distance d along [-a0, a1] (wrapping), drawn by f(x)
    const along = (speed: number, slot: number, gap: number, draw: (x: number) => void) =>
      // v < 0 runs -x by itself
      draw(((((clock * speed + slot * gap) % trackLen) + trackLen) % trackLen) - negEnd);
    const deckWid = carries === 'foot' ? 2.6 : carries === 'rail' ? 7 : 9;
    view.ctx.fillStyle = 'rgba(10,12,16,0.32)';
    view.ctx.fillRect(
      (-half + 1.5) * ppm,
      (-deckWid / 2 + 2.6) * ppm,
      2 * half * ppm,
      deckWid * ppm,
    ); // shadow
    paint(-half - 4, -deckWid / 2 - 0.6, 4, deckWid + 1.2, '#7c7f86');
    paint(half, -deckWid / 2 - 0.6, 4, deckWid + 1.2, '#7c7f86'); // abutments
    paint(-half, -deckWid / 2, 2 * half, deckWid, carries === 'rail' ? '#5a5048' : '#8f949c');
    paint(-half, -deckWid / 2, 2 * half, 0.4, '#c9ccd3');
    paint(-half, deckWid / 2 - 0.4, 2 * half, 0.4, '#5d626d'); // parapets
    if (carries === 'road') {
      paint(-half, -deckWid / 2 + 0.6, 2 * half, deckWid - 1.2, '#3b3e44');
      // centre dashes over the deck AND the approaches, edge lines on the approaches (the ribbon is
      // 7 m: edges at +-3.2)
      for (let dashX = -negEnd + 1; dashX < posEnd - 2; dashX += 4)
        paint(dashX, -0.08, 2, 0.16, 'rgba(245,245,240,0.8)');
      for (const y of [-3.2, 3.05]) {
        paint(-negEnd, y, negEnd - half - 4, 0.15, 'rgba(245,245,240,0.6)');
        paint(half + 4, y, posEnd - half - 4, 0.15, 'rgba(245,245,240,0.6)');
      }
      if (prop.cow) {
        const x = half * 0.35;
        paint(x - 1.1, -0.6, 2.2, 1.2, '#f2f2f2');
        paint(x - 0.6, -0.6, 0.7, 0.6, '#1c1d20');
        paint(x + 0.3, 0, 0.6, 0.6, '#1c1d20');
        paint(x + 1.1, -0.35, 0.5, 0.7, '#f2f2f2');
      }
      // TRAFFIC both ways (left-hand: +x in the lane at y +1.6): 1-2 cars per direction, 13-17 m/s,
      // spaced along the whole road
      const cols = ['#c8302c', '#2b56b5', '#e9e4d8', '#3f5a3a', '#d6a21e'],
        carCount = 1 + (prop.cars || 1);
      for (let car = 0; car < carCount; car++) {
        const dir = car % 2 ? -1 : 1,
          y = dir > 0 ? 1.6 : -1.6,
          speed = dir * (13 + ((seed + car * 7) % 5));
        along(speed, car, (trackLen / carCount) * 1.7, (x: number) => {
          paint(x - 2, y - 0.85, 4, 1.7, cols[(car + seed) % 5]);
          paint(x + (dir > 0 ? -0.2 : -1.2), y - 0.7, 1.4, 1.4, 'rgba(20,22,28,0.6)');
          paint(x + (dir > 0 ? 1.7 : -2), y - 0.7, 0.3, 0.4, '#fff6e6');
          paint(x + (dir > 0 ? 1.7 : -2), y + 0.3, 0.3, 0.4, '#fff6e6');
        });
      }
    } else if (carries === 'rail') {
      // sleepers + rails over the deck and along the ballast approaches (the gravel ribbon in the
      // tiles)
      for (let sleeperX = -negEnd; sleeperX < posEnd; sleeperX += 0.9)
        if (sleeperX < -half - 4 || sleeperX > half) paint(sleeperX, -2.4, 0.35, 4.8, '#6e5a44');
        else paint(sleeperX, -deckWid / 2 + 0.8, 0.35, deckWid - 1.6, '#6e5a44');
      for (const y of [-1.9, -0.6, 0.6, 1.9]) paint(-negEnd, y - 0.08, trackLen, 0.16, '#b9bcc3');
      for (let bracketX = -half + 3; bracketX < half; bracketX += 12)
        paint(bracketX, -deckWid / 2 - 0.3, 0.3, deckWid + 0.6, '#3d4049');
      // A TRAIN every trainEvery s: 3-5 coaches of 18 m at 32 m/s, one way or the other, crossing
      // the whole length then gone
      const every = prop.trainEvery || 20,
        cyc = Math.floor(clock / every),
        trainT = clock - cyc * every,
        dir = (cyc + seed) % 2 ? 1 : -1,
        coaches = 3 + ((cyc + seed) % 3),
        len = coaches * 19;
      const head = -negEnd - 10 + trainT * 32;
      if (head - len < posEnd + 10) {
        const y = dir > 0 ? 1.25 : -1.25,
          col = ['#c8302c', '#2b56b5', '#d6a21e'][(cyc + seed) % 3];
        // mirrored about the middle of [-a0, a1] for the other way; a coach past either end of the
        // track (a cut-short bed) is not drawn
        for (let coach = 0; coach < coaches; coach++) {
          const tailX = head - (coach + 1) * 19,
            x = dir > 0 ? tailX : posEnd - negEnd - tailX - 18;
          if (x < -negEnd - 18 || x > posEnd) continue;
          paint(x, y - 1.4, 18, 2.8, '#2a2c33');
          paint(x + 0.3, y - 1.25, 17.4, 2.5, coach === 0 ? col : '#d7d9de');
          for (let winX = 1.5; winX < 17; winX += 3)
            paint(x + winX, y - 0.5, 1.6, 1, 'rgba(30,40,58,0.55)');
        }
      }
    } else {
      paint(-half, -deckWid / 2 + 0.4, 2 * half, deckWid - 0.8, '#a29a8c');
      if (prop.cone) {
        paint(half * 0.2 - 0.35, -0.35, 0.7, 0.7, '#f97316');
        paint(half * 0.2 - 0.15, -0.15, 0.3, 0.3, '#f2f2f2');
      }
      // WALKERS along the deck and the footpath (1.1-1.6 m/s), one now and then with a dog
      for (let walker = 0; walker < (prop.people || 1) + 1; walker++) {
        const dir = (walker + seed) % 2 ? 1 : -1,
          y = dir > 0 ? 0.35 : -0.35;
        along(
          dir * (1.1 + ((seed + walker * 3) % 5) * 0.12),
          walker,
          (trackLen / ((prop.people || 1) + 1)) * 1.3,
          (x: number) => {
            paint(
              x - 0.3,
              y - 0.3,
              0.6,
              0.6,
              ['#c8302c', '#eab308', '#2b56b5', '#3f5a3a'][(walker + seed) % 4],
            );
            paint(x - 0.15, y - 0.15, 0.3, 0.3, '#e8c39e');
            if ((walker + seed) % 3 === 0)
              paint(x + dir * 0.9 - 0.2, y - 0.15, 0.45, 0.3, '#5a4231');
          },
        );
      }
    }
  }
  // GARAGE ROW (2026-10-04): one strip along the lane from front / back / banner polylines, so it
  // bends with the track
  function drawGarageRow(prop: Prop, ppm: number) {
    if (!prop._bb) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const [x, y] of [...prop.front!, ...prop.back!]) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      prop._bb = [minX, minY, maxX, maxY];
    }
    if (
      toScreenX(prop._bb[0]) > view.W ||
      toScreenX(prop._bb[2]) < 0 ||
      toScreenY(prop._bb[1]) > view.H ||
      toScreenY(prop._bb[3]) < 0
    )
      return;
    const front = prop.front!,
      back = prop.back!,
      banner = prop.banner!,
      count = front.length;
    const poly = (fwd: Point[], rev: Point[], col: string) => {
      view.ctx.beginPath();
      fwd.forEach(([x, y], i) =>
        i ? view.ctx.lineTo(toScreenX(x), toScreenY(y)) : view.ctx.moveTo(toScreenX(x),
          toScreenY(y)));
      for (let i = rev.length - 1; i >= 0; i--) view.ctx.lineTo(toScreenX(rev[i][0]),
        toScreenY(rev[i][1]));
      view.ctx.closePath();
      view.ctx.fillStyle = col;
      view.ctx.fill();
    };
    view.ctx.save();
    view.ctx.translate(0.6 * ppm, 0.8 * ppm);
    poly(front, back, 'rgba(10,12,16,0.40)');
    view.ctx.translate(-0.6 * ppm, -0.8 * ppm); // shadow
    poly(front, back, '#5b626b');
    view.ctx.strokeStyle = '#3b4047';
    view.ctx.lineWidth = Math.max(1, 0.25 * ppm);
    for (let i = 0; i < count; i += 2) {
      view.ctx.beginPath();
      view.ctx.moveTo(toScreenX(front[i][0]), toScreenY(front[i][1]));
      view.ctx.lineTo(toScreenX(back[i][0]), toScreenY(back[i][1]));
      view.ctx.stroke();
    } // a unit every 5 m
    view.ctx.beginPath();
    front.forEach(([x, y]: Point, i: number) =>
      i ? view.ctx.lineTo(toScreenX(x), toScreenY(y)) : view.ctx.moveTo(toScreenX(x), toScreenY(y)),
    );
    for (let i = count - 1; i >= 0; i--) view.ctx.lineTo(toScreenX(back[i][0]),
      toScreenY(back[i][1]));
    view.ctx.closePath();
    view.ctx.stroke();
    poly(front, banner, '#c8302c'); // the banner
    const bannerH = 0.9 * ppm;
    if (bannerH >= 8) {
      view.ctx.fillStyle = '#ffffff';
      view.ctx.font = `900 ${Math.round(bannerH * 0.8)}px Impact, ui-sans-serif, sans-serif`;
      view.ctx.textAlign = 'center';
      view.ctx.textBaseline = 'middle';
      for (let i = 3; i < count - 3; i += 6) {
        const prev = banner[i - 1],
          next = banner[i + 1],
          frontPt = front[i],
          bannerPt = banner[i],
          ang = Math.atan2(next[1] - prev[1], next[0] - prev[0]);
        view.ctx.save();
        view.ctx.translate(toScreenX((frontPt[0] + bannerPt[0]) / 2),
          toScreenY((frontPt[1] + bannerPt[1]) / 2));
        view.ctx.rotate(ang);
        view.ctx.fillText(prop.brand || 'KUM TYRES', 0, 1, 6 * 2.5 * ppm * 0.85);
        view.ctx.restore();
      }
    }
    view.ctx.restore();
  }
  // OVERHEAD props span the track ABOVE the cars and are drawn AFTER them. MEASURED BUG (user,
  // 2026-10-03: "the gantry being below cars on the naffcar track"): every prop was drawn before
  // the car, so cars drove OVER the start gantry.
  const OVERHEAD = new Set(['gantry', 'footbridge', 'bridge']);
  // pr.w, h, seed, label, front, back and banner are optional on Prop, but every kind
  // that reads them sets them (the ! below)
  function drawProps(overhead = false) {
    if (!PROPS || !PROPS.length) return;
    const ppm = PPMz();
    for (const prop of PROPS) {
      if (OVERHEAD.has(prop.kind) !== overhead) continue;
      if (prop.kind === 'garagerow') {
        drawGarageRow(prop, ppm);
        continue;
      }
      if (prop.kind === 'slip') {
        drawSlip(prop, ppm);
        continue;
      }
      const screenX = toScreenX(prop.x),
        screenY = toScreenY(prop.y);
      // margin by the prop's own size (a fixed 150 px let a 20 m hangar pop in at the screen edge)
      const margin = Math.max(
        150,
        Math.max(prop.w || 0, prop.h || 0, prop.size || 0, prop.wid || 0, 18) * ppm * 0.75,
        (prop.reach || 0) * ppm,
      );
      if (
        screenX < -margin ||
        screenX > view.W + margin ||
        screenY < -margin ||
        screenY > view.H + margin
      )
        continue;
      view.ctx.save();
      view.ctx.translate(screenX, screenY);
      if (prop.rot) view.ctx.rotate(prop.rot);

      if (prop.kind === 'grandstand' || prop.kind === 'stadium_grandstand') {
        const standW = (prop.w || 36) * ppm,
          standH = (prop.h || 7.5) * ppm;
        // Heavy ground shadow
        view.ctx.fillStyle = 'rgba(10,12,16,0.42)';
        view.ctx.fillRect(-standW / 2 + 4, -standH / 2 + 5, standW, standH);
        // Base structural frame
        view.ctx.fillStyle = '#2e2c28';
        view.ctx.fillRect(-standW / 2, -standH / 2, standW, standH);
        // Stepped seating tiers
        const rows = prop.kind === 'stadium_grandstand' ? 6 : 4;
        const rowH = standH / rows;
        for (let tier = 0; tier < rows; tier++) {
          view.ctx.fillStyle = tier % 2 === 0 ? '#423d35' : '#585246';
          view.ctx.fillRect(-standW / 2, -standH / 2 + tier * rowH, standW, rowH);
          // Planks and footwells
          view.ctx.fillStyle = 'rgba(20,18,16,0.45)';
          view.ctx.fillRect(-standW / 2, -standH / 2 + tier * rowH + rowH - 1.5, standW, 1.5);
          // Colorful spectator crowd heads & caps
          const crowdColors = [
            '#e63946',
            '#3a86ff',
            '#2a9d8f',
            '#ffb703',
            '#fb8500',
            '#f1faee',
            '#8338ec',
          ];
          const numDots = Math.floor(standW / (0.8 * ppm));
          for (let dot = 0; dot < numDots; dot++) {
            const seed = (dot * 19 + tier * 37) % crowdColors.length;
            view.ctx.fillStyle = crowdColors[seed];
            view.ctx.fillRect(
              -standW / 2 + dot * (0.8 * ppm) + 2,
              -standH / 2 + tier * rowH + rowH * 0.28,
              3.5,
              3.5,
            );
          }
        }
        // Corrugated canopy roof over the rear half
        view.ctx.fillStyle = 'rgba(12,14,18,0.30)';
        // shadow under roof edge
        view.ctx.fillRect(-standW / 2, -standH / 2 + standH * 0.45, standW, 4);
        view.ctx.fillStyle = '#656b78'; // galvanized zinc roof
        view.ctx.fillRect(-standW / 2 - 2, -standH / 2 - 2, standW + 4, standH * 0.5);
        // Roof corrugation ribs
        view.ctx.strokeStyle = '#858c9b';
        view.ctx.lineWidth = 1;
        view.ctx.beginPath();
        for (let ribX = -standW / 2; ribX <= standW / 2; ribX += 4 * ppm) {
          view.ctx.moveTo(ribX, -standH / 2 - 2);
          view.ctx.lineTo(ribX, -standH / 2 + standH * 0.5);
        }
        view.ctx.stroke();
        // Fluttering pennant flags along the roof ridge
        const flagColors = ['#ef4444', '#3b82f6', '#eab308', '#22c55e'];
        for (let flagX = -standW / 2 + 6 * ppm; flagX <= standW / 2 - 6 * ppm; flagX += 10 * ppm) {
          view.ctx.fillStyle = '#222';
          view.ctx.fillRect(flagX - 1, -standH / 2 - 8, 2, 7);
          view.ctx.fillStyle = flagColors[Math.abs(Math.floor(flagX)) % flagColors.length];
          view.ctx.beginPath();
          view.ctx.moveTo(flagX + 1, -standH / 2 - 8);
          view.ctx.lineTo(flagX + 7, -standH / 2 - 5);
          view.ctx.lineTo(flagX + 1, -standH / 2 - 2);
          view.ctx.fill();
        }
        // Front safety barrier rail
        view.ctx.strokeStyle = '#8e95a5';
        view.ctx.lineWidth = Math.max(1.2, 0.12 * ppm);
        view.ctx.strokeRect(-standW / 2, -standH / 2, standW, standH);
      } else if (prop.kind === 'official_box') {
        // Wooden cabin on stilts
        view.ctx.fillStyle = 'rgba(10,12,16,0.38)';
        view.ctx.fillRect(-2.2 * ppm + 3, -1.8 * ppm + 4, 4.4 * ppm, 3.6 * ppm);
        // 4 heavy timber stilt posts
        view.ctx.fillStyle = '#3a2e22';
        view.ctx.fillRect(-2.0 * ppm, -1.6 * ppm, 0.4 * ppm, 3.2 * ppm);
        view.ctx.fillRect(1.6 * ppm, -1.6 * ppm, 0.4 * ppm, 3.2 * ppm);
        // Ladder rungs on the side
        view.ctx.fillStyle = '#65523f';
        for (let rungY = -1.2 * ppm; rungY <= 1.2 * ppm; rungY += 0.5 * ppm) {
          view.ctx.fillRect(1.6 * ppm, rungY, 0.4 * ppm, 2);
        }
        // Cabin body
        view.ctx.fillStyle = '#6b5847';
        view.ctx.fillRect(-1.8 * ppm, -1.4 * ppm, 3.6 * ppm, 2.8 * ppm);
        // Green timber window frame & observation window
        view.ctx.fillStyle = '#2b4436';
        view.ctx.fillRect(-1.5 * ppm, -1.1 * ppm, 3.0 * ppm, 1.2 * ppm);
        view.ctx.fillStyle = '#3b4856';
        view.ctx.fillRect(-1.3 * ppm, -1.0 * ppm, 2.6 * ppm, 1.0 * ppm);
        // Slanted corrugated tin roof
        view.ctx.fillStyle = '#555e6c';
        view.ctx.fillRect(-2.1 * ppm, -1.7 * ppm, 4.2 * ppm, 1.4 * ppm);
        // Wrap-around balcony rail
        view.ctx.strokeStyle = '#c4b5a0';
        view.ctx.lineWidth = 1.5;
        view.ctx.strokeRect(-1.9 * ppm, -0.2 * ppm, 3.8 * ppm, 1.7 * ppm);
        // Marshal figure with yellow caution flag & chequered flag
        view.ctx.fillStyle = '#ffcc00'; // Yellow flag
        view.ctx.beginPath();
        view.ctx.moveTo(1.7 * ppm, -1.7 * ppm);
        view.ctx.lineTo(2.6 * ppm, -1.3 * ppm);
        view.ctx.lineTo(1.7 * ppm, -0.9 * ppm);
        view.ctx.fill();
        view.ctx.fillStyle = '#fff'; // Chequered flag on opposite pole
        view.ctx.fillRect(-2.4 * ppm, -1.6 * ppm, 0.7 * ppm, 0.5 * ppm);
        view.ctx.fillStyle = '#111';
        view.ctx.fillRect(-2.4 * ppm, -1.6 * ppm, 0.35 * ppm, 0.25 * ppm);
        view.ctx.fillRect(-2.05 * ppm, -1.35 * ppm, 0.35 * ppm, 0.25 * ppm);
      } else if (prop.kind === 'gantry') {
        const gantryW = (prop.wid || 26) * ppm;
        // Heavy 3D steel truss frame spanning across track
        view.ctx.fillStyle = 'rgba(10,12,16,0.30)';
        view.ctx.fillRect(-gantryW / 2 + 2, -0.6 * ppm + 3, gantryW, 1.2 * ppm);
        // Concrete crash protection pillars on both sides
        view.ctx.fillStyle = '#9aa0ae';
        view.ctx.fillRect(-gantryW / 2 - 0.6 * ppm, -0.9 * ppm, 1.2 * ppm, 1.8 * ppm);
        view.ctx.fillRect(gantryW / 2 - 0.6 * ppm, -0.9 * ppm, 1.2 * ppm, 1.8 * ppm);
        // Yellow/black hazard chevrons on pillars
        view.ctx.fillStyle = '#eab308';
        view.ctx.fillRect(-gantryW / 2 - 0.6 * ppm, -0.9 * ppm, 1.2 * ppm, 0.4 * ppm);
        view.ctx.fillRect(gantryW / 2 - 0.6 * ppm, -0.9 * ppm, 1.2 * ppm, 0.4 * ppm);
        // SPEED CAMERA (highway gantries, highway.js speedCamera): a yellow box on the beam over
        // the left lanes; flashes white when it
        // catches you (pr._flash, wall clock)
        if (LEVEL.endless) {
          const flashing = prop._flash && performance.now() - prop._flash < 250;
          view.ctx.fillStyle = flashing ? '#ffffff' : '#eab308';
          view.ctx.fillRect(-gantryW * 0.3 - 0.7 * ppm, 0.6 * ppm, 1.4 * ppm, 1.0 * ppm);
          view.ctx.fillStyle = '#1c1d20';
          view.ctx.fillRect(-gantryW * 0.3 - 0.35 * ppm, 1.2 * ppm, 0.7 * ppm, 0.3 * ppm);
        }
        // Main steel truss beam
        view.ctx.strokeStyle = '#3e4450';
        view.ctx.lineWidth = Math.max(2.5, 0.35 * ppm);
        view.ctx.strokeRect(-gantryW / 2, -0.6 * ppm, gantryW, 1.2 * ppm);
        // Steel cross-bracing lattice
        view.ctx.strokeStyle = '#2b303c';
        view.ctx.lineWidth = 1.2;
        view.ctx.beginPath();
        for (let braceX = -gantryW / 2; braceX < gantryW / 2; braceX += 3.5 * ppm) {
          view.ctx.moveTo(braceX, -0.6 * ppm);
          view.ctx.lineTo(braceX + 3.5 * ppm, 0.6 * ppm);
          view.ctx.moveTo(braceX + 3.5 * ppm, -0.6 * ppm);
          view.ctx.lineTo(braceX, 0.6 * ppm);
        }
        view.ctx.stroke();
        // 5 circular start light pods with bright red glowing LED cores
        const lightSpacing = gantryW / 8;
        for (let pod = -2; pod <= 2; pod++) {
          const podX = pod * lightSpacing;
          view.ctx.fillStyle = '#111317';
          roundRect(view.ctx, podX - 0.35 * ppm, -0.45 * ppm, 0.7 * ppm, 0.9 * ppm, 3);
          view.ctx.fill();
          view.ctx.strokeStyle = '#4a5160';
          view.ctx.lineWidth = 1;
          view.ctx.stroke();
          // Outer red glow
          view.ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
          view.ctx.beginPath();
          view.ctx.arc(podX, 0, 0.35 * ppm, 0, Math.PI * 2);
          view.ctx.fill();
          // Solid red core
          view.ctx.fillStyle = '#ef4444';
          view.ctx.beginPath();
          view.ctx.arc(podX, 0, 0.2 * ppm, 0, Math.PI * 2);
          view.ctx.fill();
          // White specular highlight
          view.ctx.fillStyle = '#fff';
          view.ctx.beginPath();
          view.ctx.arc(podX - 0.05 * ppm, -0.05 * ppm, 0.06 * ppm, 0, Math.PI * 2);
          view.ctx.fill();
        }
        // Center digital lap / position board with green LEDs
        view.ctx.fillStyle = '#0a0d0a';
        roundRect(view.ctx, -1.4 * ppm, -0.55 * ppm, 2.8 * ppm, 0.45 * ppm, 2);
        view.ctx.fill();
        view.ctx.fillStyle = '#22c55e';
        view.ctx.font = `700 ${Math.round(0.32 * ppm)}px ui-monospace, monospace`;
        view.ctx.textAlign = 'center';
        view.ctx.textBaseline = 'middle';
        view.ctx.fillText('LAP 1', 0, -0.32 * ppm);
      } else if (prop.kind === 'pit_wall') {
        const wallW = (prop.len || 220) * ppm,
          wallH = (prop.h || 1.2) * ppm;
        // Ground shadow
        view.ctx.fillStyle = 'rgba(10,12,16,0.35)';
        view.ctx.fillRect(-wallW / 2 + 2, -wallH / 2 + 3, wallW, wallH);
        // Concrete wall body
        view.ctx.fillStyle = '#8a909d';
        view.ctx.fillRect(-wallW / 2, -wallH / 2, wallW, wallH);
        // Top steel capping plate with bevel highlight
        view.ctx.fillStyle = '#b8becb';
        view.ctx.fillRect(-wallW / 2, -wallH / 2, wallW, wallH * 0.35);
        // Yellow/black diagonal hazard stripes at the wall ends
        view.ctx.fillStyle = '#eab308';
        view.ctx.fillRect(-wallW / 2, -wallH / 2, 4 * ppm, wallH);
        view.ctx.fillRect(wallW / 2 - 4 * ppm, -wallH / 2, 4 * ppm, wallH);
        view.ctx.fillStyle = '#111';
        view.ctx.fillRect(-wallW / 2 + 1.2 * ppm, -wallH / 2, 1.4 * ppm, wallH);
        view.ctx.fillRect(wallW / 2 - 2.6 * ppm, -wallH / 2, 1.4 * ppm, wallH);
        // Pit stall accessories along the inside of the wall (toolboxes & air booms)
        for (let kitX = -wallW / 2 + 25 * ppm; kitX <= wallW / 2 - 25 * ppm; kitX += 40 * ppm) {
          // Red tool cabinet
          view.ctx.fillStyle = '#b91c1c';
          roundRect(view.ctx, kitX - 1.2 * ppm, -wallH / 2 - 1.0 * ppm, 2.4 * ppm, 0.8 * ppm, 2);
          view.ctx.fill();
          view.ctx.fillStyle = '#d1d5db';
          view.ctx.fillRect(kitX - 1.0 * ppm, -wallH / 2 - 0.7 * ppm, 2.0 * ppm, 1.5);
          // Overhead air hose boom
          view.ctx.strokeStyle = '#222';
          view.ctx.lineWidth = 1.2;
          view.ctx.beginPath();
          view.ctx.moveTo(kitX, -wallH / 2);
          view.ctx.lineTo(kitX + 1.5 * ppm, -wallH / 2 - 2.0 * ppm);
          view.ctx.stroke();
        }
      } else if (prop.kind === 'pylon') {
        // High-output halogen floodlight pylon
        // Warm circular ground illumination pool on the deck
        const grad = view.ctx.createRadialGradient(0, 0, 1 * ppm, 0, 0, 18 * ppm);
        grad.addColorStop(0, 'rgba(255, 248, 220, 0.16)');
        grad.addColorStop(0.5, 'rgba(255, 244, 200, 0.08)');
        grad.addColorStop(1, 'rgba(255, 240, 180, 0)');
        view.ctx.fillStyle = grad;
        view.ctx.beginPath();
        view.ctx.arc(0, 0, 18 * ppm, 0, Math.PI * 2);
        view.ctx.fill();

        // Tower shadow
        view.ctx.fillStyle = 'rgba(10,12,16,0.38)';
        view.ctx.beginPath();
        view.ctx.arc(3, 3, 1.1 * ppm, 0, Math.PI * 2);
        view.ctx.fill();
        // Steel base
        view.ctx.fillStyle = '#2f343e';
        view.ctx.beginPath();
        view.ctx.arc(0, 0, 0.9 * ppm, 0, Math.PI * 2);
        view.ctx.fill();
        // Quad floodlamp heads with silver dishes & warm centers
        const heads = [
          [-0.6, -0.6],
          [0.2, -0.6],
          [-0.6, 0.2],
          [0.2, 0.2],
        ];
        for (const [headX, headY] of heads) {
          view.ctx.fillStyle = '#e2e8f0';
          roundRect(view.ctx, headX * ppm, headY * ppm, 0.55 * ppm, 0.45 * ppm, 1.5);
          view.ctx.fill();
          view.ctx.fillStyle = '#fffbeb';
          view.ctx.beginPath();
          view.ctx.arc((headX + 0.27) * ppm, (headY + 0.22) * ppm, 0.14 * ppm, 0, Math.PI * 2);
          view.ctx.fill();
        }
      } else if (prop.kind === 'garages') {
        // PIT GARAGES (Thruxton photo): concrete-block units under a red tyre-brand banner. Local
        // +x = along the lane, -y = the lane side. Top-down: the flat roof with a divider per unit,
        // the banner along the front edge. Squares only (pixel rule). First cut (photographed): a
        // light grey roof vanished into the concrete apron and a 1.3 m banner read as a red wall.
        // Now a dark slate roof with an outline, ribbed per unit, and a 0.9 m banner with the brand
        // once, centred.
        const garageW = prop.w! * ppm,
          garageH = prop.h! * ppm,
          unit = 5,
          edge = Math.max(1, 0.25 * ppm);
        view.ctx.fillStyle = 'rgba(10,12,16,0.40)';
        view.ctx.fillRect(-garageW / 2 + 0.6 * ppm, -garageH / 2 + 0.8 * ppm, garageW, garageH);
        view.ctx.fillStyle = '#3b4047';
        view.ctx.fillRect(-garageW / 2, -garageH / 2, garageW, garageH); // outline
        view.ctx.fillStyle = '#5b626b';
        view.ctx.fillRect(
          -garageW / 2 + edge,
          -garageH / 2 + edge,
          garageW - 2 * edge,
          garageH - 2 * edge,
        ); // roof
        view.ctx.fillStyle = '#666d77';
        for (let y = 1; y < 10; y += 2)
          view.ctx.fillRect(
            -garageW / 2 + edge,
            -garageH / 2 + (garageH * y) / 10,
            garageW - 2 * edge,
            Math.max(1, 0.2 * ppm),
          ); // roof ribs
        view.ctx.fillStyle = '#3b4047';
        const units = Math.max(1, Math.round(prop.w! / unit));
        for (let unitIdx = 1; unitIdx < units; unitIdx++)
          view.ctx.fillRect(
            -garageW / 2 + (garageW * unitIdx) / units - edge / 2,
            -garageH / 2,
            edge,
            garageH,
          );
        const bannerH = 0.9 * ppm; // the banner, lane side
        view.ctx.fillStyle = '#c8302c';
        view.ctx.fillRect(-garageW / 2, -garageH / 2, garageW, bannerH);
        if (bannerH >= 8) {
          view.ctx.fillStyle = '#ffffff';
          view.ctx.font = `900 ${Math.round(bannerH * 0.8)}px Impact, ui-sans-serif, sans-serif`;
          view.ctx.textAlign = 'center';
          view.ctx.textBaseline = 'middle';
          view.ctx.fillText(
            prop.brand || 'KUM TYRES',
            0,
            -garageH / 2 + bannerH / 2 + 1,
            garageW * 0.9,
          );
        } else {
          view.ctx.fillStyle = '#ffffff';
          view.ctx.fillRect(
            -garageW * 0.25,
            -garageH / 2 + bannerH * 0.3,
            garageW * 0.5,
            Math.max(1, bannerH * 0.4),
          );
        }
      } else if (prop.kind === 'tower') {
        // CONTROL TOWER: a two-storey block (long shadow = tall) with a small glazed cab on the
        // roof. The first cut — a square with
        // a thick dark band — photographed as a swimming pool.
        const towerSize = (prop.size || 9) * ppm,
          cabSize = towerSize * 0.45;
        view.ctx.fillStyle = 'rgba(10,12,16,0.40)';
        view.ctx.fillRect(
          -towerSize / 2 + 1.6 * ppm,
          -towerSize / 2 + 2.2 * ppm,
          towerSize,
          towerSize,
        );
        view.ctx.fillStyle = '#d9d5cc';
        view.ctx.fillRect(-towerSize / 2, -towerSize / 2, towerSize, towerSize); // flat roof
        view.ctx.fillStyle = '#bdb8ad';
        view.ctx.fillRect(-towerSize / 2, towerSize / 2 - 0.5 * ppm, towerSize, 0.5 * ppm);
        // parapet shade
        view.ctx.fillRect(towerSize / 2 - 0.5 * ppm, -towerSize / 2, 0.5 * ppm, towerSize);
        view.ctx.fillStyle = 'rgba(10,12,16,0.35)';
        // the cab's shadow
        view.ctx.fillRect(-cabSize / 2 + 0.6 * ppm, -cabSize / 2 + 0.8 * ppm, cabSize, cabSize);
        view.ctx.fillStyle = '#2f4656';
        view.ctx.fillRect(-cabSize / 2, -cabSize / 2, cabSize, cabSize); // glazed cab
        view.ctx.fillStyle = '#e9e6df';
        view.ctx.fillRect(
          -cabSize / 2 + 0.35 * ppm,
          -cabSize / 2 + 0.35 * ppm,
          cabSize - 0.7 * ppm,
          cabSize - 0.7 * ppm,
        ); // its roof
        view.ctx.fillStyle = '#5a5e66';
        view.ctx.fillRect(-0.25 * ppm, -0.25 * ppm, 0.5 * ppm, 0.5 * ppm); // mast
      } else if (prop.kind === 'hangar') {
        // T2-style hangar: corrugated roof (ribs across), a lighter ridge, dark door end. Squares
        // only.
        const hangarW = prop.w! * ppm,
          hangarH = prop.h! * ppm;
        view.ctx.fillStyle = 'rgba(10,12,16,0.40)';
        view.ctx.fillRect(-hangarW / 2 + 1.2 * ppm, -hangarH / 2 + 1.6 * ppm, hangarW, hangarH);
        view.ctx.fillStyle = '#7b8188';
        view.ctx.fillRect(-hangarW / 2, -hangarH / 2, hangarW, hangarH);
        view.ctx.fillStyle = '#8c929a';
        view.ctx.fillRect(-hangarW / 2, -hangarH / 2, hangarW, hangarH * 0.5);
        view.ctx.fillStyle = '#6a7077';
        for (let x = -prop.w! / 2 + 1; x < prop.w! / 2; x += 1.6)
          view.ctx.fillRect(x * ppm, -hangarH / 2, Math.max(1, 0.18 * ppm), hangarH);
        view.ctx.fillStyle = '#a7adb4';
        view.ctx.fillRect(-hangarW / 2, -Math.max(1, 0.2 * ppm), hangarW, Math.max(2, 0.4 * ppm));
        view.ctx.fillStyle = '#3d4249';
        view.ctx.fillRect(hangarW / 2 - 0.8 * ppm, -hangarH / 2, 0.8 * ppm, hangarH);
      } else if (prop.kind === 'plane') {
        // LIGHT AIRCRAFT, nose along +x: fuselage, wing, tailplane, a coloured stripe
        const paint = (x: number, y: number, width: number, height: number, col: string) => {
          view.ctx.fillStyle = col;
          view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
        };
        view.ctx.fillStyle = 'rgba(10,12,16,0.30)';
        view.ctx.fillRect(-3.2 * ppm + 0.8 * ppm, -0.5 * ppm + 1.2 * ppm, 7 * ppm, 1 * ppm);
        view.ctx.fillRect(0.3 * ppm, -4.5 * ppm + 1.2 * ppm, 1.4 * ppm, 9 * ppm);
        paint(-3.2, -0.5, 7, 1, '#eef0f2');
        paint(0.3, -4.5, 1.4, 9, '#e3e6ea');
        paint(-3.2, -1.6, 0.8, 3.2, '#e3e6ea');
        paint(-2.6, -0.15, 5.6, 0.3, prop.col || '#c8302c');
        paint(3.4, -0.3, 0.4, 0.6, '#3a3f47');
      } else if (prop.kind === 'windsock') {
        const paint = (x: number, y: number, width: number, height: number, col: string) => {
          view.ctx.fillStyle = col;
          view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
        };
        paint(-0.25, -0.25, 0.5, 0.5, '#5a5e66');
        for (let seg = 0; seg < 4; seg++)
          paint(
            0.25 + seg * 0.6,
            -0.35 + seg * 0.04,
            0.6,
            0.7 - seg * 0.08,
            seg % 2 ? '#f2f2f2' : '#f07a1a',
          );
      } else if (prop.kind === 'truck') {
        // RACE TRANSPORTER (paddock): cab + long trailer with a team stripe, nose along +x
        const paint = (x: number, y: number, width: number, height: number, col: string) => {
          view.ctx.fillStyle = col;
          view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
        };
        view.ctx.fillStyle = 'rgba(10,12,16,0.35)';
        view.ctx.fillRect(-7 * ppm + 0.6 * ppm, -1.25 * ppm + 0.9 * ppm, 14 * ppm, 2.5 * ppm);
        paint(-7, -1.25, 11.2, 2.5, '#e6e8eb');
        paint(-7, -0.35, 11.2, 0.7, prop.col || '#c8302c');
        paint(4.6, -1.2, 2.4, 2.4, prop.col || '#c8302c');
        paint(6.2, -1.0, 0.6, 2.0, '#2a3038');
      } else if (prop.kind === 'tree') {
        // a tree from overlapping SQUARES (pixel rule), shade per seed; long shadow first
        const size = (prop.s || 4) * ppm,
          shade = ((prop.seed! * 9301 + 49297) % 233280) / 233280;
        view.ctx.fillStyle = 'rgba(10,12,16,0.32)';
        view.ctx.fillRect(-size / 2 + 0.25 * size, -size / 2 + 0.35 * size, size, size);
        // pal: 'dry' = desert scrub (olive / dust), else conifer greens; snow: white caps on the
        // upper squares (generated stages)
        const cols =
          prop.pal === 'dry'
            ? shade < 0.5
              ? ['#5b5a2e', '#6f6d38', '#8a8646']
              : ['#64552c', '#786a36', '#948548']
            : shade < 0.5
              ? ['#2f5a2a', '#3d6e33', '#4f8240']
              : ['#355f2c', '#456f36', '#5a8a45'];
        view.ctx.fillStyle = cols[0];
        view.ctx.fillRect(-size / 2, -size / 2, size, size);
        view.ctx.fillStyle = prop.snow ? '#dfe7ee' : cols[1];
        view.ctx.fillRect(
          -size / 2 + size * 0.12,
          -size / 2 + size * 0.1,
          size * 0.62,
          size * 0.62,
        );
        if (prop.snow) {
          view.ctx.fillStyle = cols[1];
          view.ctx.fillRect(
            -size / 2 + size * 0.42,
            -size / 2 + size * 0.42,
            size * 0.32,
            size * 0.32,
          );
        }
        view.ctx.fillStyle = prop.snow ? '#ffffff' : cols[2];
        view.ctx.fillRect(-size / 2 + size * 0.2, -size / 2 + size * 0.18, size * 0.3, size * 0.3);
      } else if (prop.kind === 'rock') {
        // ROCK / BOULDER: overlapping grey squares, light top-left, dark bottom-right, a long
        // shadow (pixel rule); pal 'red' = desert stone
        const size = (prop.s || 3) * ppm,
          shade = (((prop.seed || 1) * 9301 + 49297) % 233280) / 233280;
        const cols =
          prop.pal === 'red'
            ? ['#6e4a32', '#8c5f40', '#a87652', '#c39270']
            : ['#4d5157', '#62676e', '#7b8088', '#989da4'];
        view.ctx.fillStyle = 'rgba(10,12,16,0.34)';
        view.ctx.fillRect(-size / 2 + 0.3 * size, -size / 2 + 0.4 * size, size, size * 0.9);
        view.ctx.fillStyle = cols[0];
        view.ctx.fillRect(-size / 2, -size / 2 + size * 0.1, size, size * 0.8);
        view.ctx.fillRect(-size / 2 + size * 0.15, -size / 2, size * 0.7, size);
        view.ctx.fillStyle = cols[1];
        view.ctx.fillRect(-size / 2 + size * 0.1, -size / 2 + size * 0.08, size * 0.72, size * 0.7);
        view.ctx.fillStyle = cols[2];
        view.ctx.fillRect(
          -size / 2 + size * 0.16,
          -size / 2 + size * 0.12,
          size * (0.38 + 0.15 * shade),
          size * 0.36,
        );
        view.ctx.fillStyle = cols[3];
        view.ctx.fillRect(
          -size / 2 + size * 0.22,
          -size / 2 + size * 0.16,
          size * 0.16,
          size * 0.14,
        );
        if (prop.snow) {
          view.ctx.fillStyle = '#eef3f7';
          view.ctx.fillRect(
            -size / 2 + size * 0.12,
            -size / 2 + size * 0.06,
            size * 0.5,
            size * 0.22,
          );
        }
      } else if (prop.kind === 'crowd') {
        // SPECTATORS: a cluster of people (a 2x2 px head-and-shoulders each, jackets in random
        // colours, a shadow) over w x h m
        const count = prop.n || 14,
          width = prop.w || 8,
          height = prop.h || 3;
        const rand = parkMiller((prop.seed || 7) * 7919);
        const jackets = [
          '#c8302c',
          '#2b56b5',
          '#e2c13a',
          '#2f7d4f',
          '#f2f2f2',
          '#e07a1f',
          '#7a3fa0',
          '#16181d',
          '#3fb6c9',
        ];
        for (let person = 0; person < count; person++) {
          const x = (rand() - 0.5) * width * ppm,
            y = (rand() - 0.5) * height * ppm,
            z = Math.max(2, 0.55 * ppm);
          view.ctx.fillStyle = 'rgba(10,12,16,0.3)';
          view.ctx.fillRect(x + z * 0.3, y + z * 0.4, z, z);
          view.ctx.fillStyle = jackets[(rand() * jackets.length) | 0];
          view.ctx.fillRect(x - z / 2, y - z / 2, z, z);
          view.ctx.fillStyle = rand() < 0.5 ? '#e6c3a0' : '#8a5a3c';
          view.ctx.fillRect(x - z * 0.22, y - z * 0.22, z * 0.44, z * 0.44);
        }
      } else if (prop.kind === 'marshal') {
        // MARSHAL POST: small hut, white roof, orange edge
        const paint = (x: number, y: number, width: number, height: number, col: string) => {
          view.ctx.fillStyle = col;
          view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
        };
        view.ctx.fillStyle = 'rgba(10,12,16,0.35)';
        view.ctx.fillRect(-1.2 * ppm + 0.4 * ppm, -1 * ppm + 0.6 * ppm, 2.4 * ppm, 2 * ppm);
        paint(-1.2, -1, 2.4, 2, '#f07a1a');
        paint(-0.95, -0.75, 1.9, 1.5, '#f2f2f2');
      } else if (prop.kind === 'footbridge') {
        // FOOTBRIDGE over the track (Castle Combe's Avon + Dunlop bridges): deck across (+x), stair
        // towers at the ends, a sponsor band
        const paint = (x: number, y: number, width: number, height: number, col: string) => {
          view.ctx.fillStyle = col;
          view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
        };
        const half = (prop.wid || 27) / 2;
        view.ctx.fillStyle = 'rgba(10,12,16,0.30)';
        view.ctx.fillRect(
          -half * ppm + 1.5 * ppm,
          -1.2 * ppm + 2.4 * ppm,
          2 * half * ppm,
          2.4 * ppm,
        ); // shadow on the road
        paint(-half, -1.2, 2 * half, 2.4, '#8f949c');
        paint(-half, -1.2, 2 * half, 0.3, '#c9ccd3');
        paint(-half, 0.9, 2 * half, 0.3, '#5d626d');
        paint(-half * 0.55, -0.75, half * 1.1, 1.5, '#1c4fa0');
        paint(-half - 1.6, -1.5, 3.2, 3.0, '#6a7077');
        paint(half - 1.6, -1.5, 3.2, 3.0, '#6a7077'); // stair towers
        for (let step = 0; step < 4; step++) {
          paint(-half - 1.4, -1.3 + step * 0.7, 2.8, 0.25, '#565b63');
          paint(half - 1.4, -1.3 + step * 0.7, 2.8, 0.25, '#565b63');
        }
        if (ppm * 1.0 >= 8) {
          view.ctx.fillStyle = '#ffffff';
          view.ctx.font = `900 ${Math.round(ppm * 1.0)}px Impact, ui-sans-serif, sans-serif`;
          view.ctx.textAlign = 'center';
          view.ctx.textBaseline = 'middle';
          if (Math.cos(prop.rot || 0) < 0) view.ctx.rotate(Math.PI);
          /* never upside down (photographed) */ view.ctx.fillText(
            prop.label || '',
            0,
            0.05 * ppm,
            half * 1.05 * ppm,
          );
        }
      } else if (prop.kind === 'sculpture') {
        // the red steel SCULPTURE by the start line (photo): a crown of red squares, orange core,
        // long shadow (it is tall)
        const paint = (x: number, y: number, width: number, height: number, col: string) => {
          view.ctx.fillStyle = col;
          view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
        };
        view.ctx.fillStyle = 'rgba(10,12,16,0.32)';
        view.ctx.fillRect(0.2 * ppm, 0.2 * ppm, 3.2 * ppm, 1.6 * ppm);
        for (const [x, y] of [
          [-1.1, -1.1],
          [0.3, -1.3],
          [0.7, -0.2],
          [-0.1, 0.6],
          [-1.2, 0.1],
        ])
          paint(x, y, 0.8, 0.8, '#d6331f');
        paint(-0.4, -0.4, 0.8, 0.8, '#f07a1a');
      } else if (prop.kind === 'block') {
        // a flat-roofed BUILDING (clubhouse, offices): roof colour, parapet, rooftop plant,
        // optional name on the roof
        const paint = (x: number, y: number, width: number, height: number, col: string) => {
          view.ctx.fillStyle = col;
          view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
        };
        const halfW = prop.w! / 2,
          halfH = prop.h! / 2;
        view.ctx.fillStyle = 'rgba(10,12,16,0.40)';
        view.ctx.fillRect(
          -halfW * ppm + 1.2 * ppm,
          -halfH * ppm + 1.6 * ppm,
          prop.w! * ppm,
          prop.h! * ppm,
        );
        paint(-halfW, -halfH, prop.w!, prop.h!, '#3b4047');
        paint(-halfW + 0.4, -halfH + 0.4, prop.w! - 0.8, prop.h! - 0.8, prop.roof || '#5b626b');
        paint(halfW - 4, -halfH + 1.2, 2.4, 1.8, '#9aa0a8');
        paint(halfW - 3.6, -halfH + 1.5, 1.6, 1.2, '#7c828a');
        // a CHURCH (highway.js village): a square tower at the west end of the nave, with a little
        // cross; a HOUSE: a ridge line, no rooftop plant
        if (prop.church) {
          paint(-halfW - 2.6, -2, 4, 4, '#3b4047');
          paint(-halfW - 2.3, -1.7, 3.4, 3.4, '#8f8a80');
          paint(-halfW - 0.8, -0.8, 0.4, 1.6, '#3b4047');
          paint(-halfW - 1.2, -0.2, 1.2, 0.4, '#3b4047');
        }
        if (prop.house || prop.church)
          paint(-halfW + 0.4, -0.08, prop.w! - 0.8, 0.16, 'rgba(20,22,28,0.35)');
        if (prop.label && ppm * 1.4 >= 9) {
          view.ctx.fillStyle = 'rgba(255,255,255,0.85)';
          view.ctx.font = `900 ${Math.round(ppm * 1.4)}px Impact, ui-sans-serif, sans-serif`;
          view.ctx.textAlign = 'center';
          view.ctx.textBaseline = 'middle';
          if (Math.cos(prop.rot || 0) < 0) view.ctx.rotate(Math.PI);
          view.ctx.fillText(prop.label, 0, 0.6 * ppm, prop.w! * 0.8 * ppm);
        }
      } else if (prop.kind === 'chevron') {
        // RALLY CHEVRON BOARD (black + yellow arrows), placed on the outside of a corner, arrows
        // pointing the way it turns (+x). Drawn at 1.6x (photographed: at 3.2 m it was a smudge
        // beside the bales)
        view.ctx.scale(1.6, 1.6);
        const paint = (x: number, y: number, width: number, height: number, col: string) => {
          view.ctx.fillStyle = col;
          view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
        };
        view.ctx.fillStyle = 'rgba(10,12,16,0.32)';
        view.ctx.fillRect(-1.6 * ppm + 0.3 * ppm, -0.25 * ppm + 0.5 * ppm, 3.2 * ppm, 0.5 * ppm);
        paint(-1.6, -0.25, 3.2, 0.5, '#15171c');
        for (let chevron = 0; chevron < 3; chevron++) {
          paint(-1.25 + chevron * 1.0, -0.2, 0.25, 0.15, '#f2c21b');
          paint(-1.0 + chevron * 1.0, -0.075, 0.25, 0.15, '#f2c21b');
          paint(-1.25 + chevron * 1.0, 0.05, 0.25, 0.15, '#f2c21b');
        }
      } else if (prop.kind === 'bale') {
        // ROUND HAY BALE from the top: a straw square with a darker spiral ring (squares — the
        // pixel rule)
        const paint = (x: number, y: number, width: number, height: number, col: string) => {
          view.ctx.fillStyle = col;
          view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
        };
        view.ctx.fillStyle = 'rgba(10,12,16,0.30)';
        view.ctx.fillRect(-0.8 * ppm + 0.3 * ppm, -0.8 * ppm + 0.45 * ppm, 1.6 * ppm, 1.6 * ppm);
        paint(-0.8, -0.8, 1.6, 1.6, '#c9a85a');
        paint(-0.55, -0.55, 1.1, 1.1, '#b48f45');
        paint(-0.3, -0.3, 0.6, 0.6, '#d8bb6e');
        paint(-0.08, -0.08, 0.16, 0.16, '#9a7836');
      } else if (prop.kind === 'flag') {
        // a FLAG on a pole: pole square + a pennant blowing in +x, with a long shadow
        const paint = (x: number, y: number, width: number, height: number, col: string) => {
          view.ctx.fillStyle = col;
          view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
        };
        view.ctx.fillStyle = 'rgba(10,12,16,0.28)';
        view.ctx.fillRect(0.2 * ppm, 0.1 * ppm, 1.8 * ppm, 0.6 * ppm);
        paint(-0.15, -0.15, 0.3, 0.3, '#3a3f47');
        paint(0.15, -0.55, 1.3, 0.75, prop.col || '#c8302c');
        paint(0.15, -0.55, 1.3, 0.12, 'rgba(255,255,255,0.35)');
      } else if (prop.kind === 'bridge' || prop.kind === 'river') {
        drawBridge(prop, ppm);
      } else if (prop.kind === 'slipcount') {
        // the 300 / 200 / 100 yd COUNTDOWN posts before an exit: white with red diagonal bars
        // (squares, not circles)
        const paint = (x: number, y: number, width: number, height: number, col: string) => {
          view.ctx.fillStyle = col;
          view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
        };
        paint(-0.5, -1.0, 1.2, 2.2, 'rgba(10,12,16,0.35)');
        paint(-0.6, -1.1, 1.2, 2.2, '#f2f2f2');
        for (let bar = 0; bar < (prop.bars || 1); bar++)
          paint(-0.6, -0.95 + bar * 0.7, 1.2, 0.35, '#c8302c');
      } else if (prop.kind === 'gate') {
        // a FIELD GATE where the slip road ends (wooden 5-bar, posts either side)
        const paint = (x: number, y: number, width: number, height: number, col: string) => {
          view.ctx.fillStyle = col;
          view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
        };
        paint(-3.4, -0.2, 6.8, 0.6, 'rgba(10,12,16,0.35)');
        paint(-3.2, -0.35, 0.5, 0.7, '#3a2d21');
        paint(2.7, -0.35, 0.5, 0.7, '#3a2d21');
        for (let rail = 0; rail < 3; rail++) paint(-2.7, -0.25 + rail * 0.22, 5.4, 0.1, '#b48a5a');
      } else if (prop.kind === 'solarfarm') {
        // the SMILEY SOLAR FARM (a cheeky extra): rows of dark blue panels laid out as a smiling
        // face, seen from above
        const paint = (x: number, y: number, width: number, height: number, col: string) => {
          view.ctx.fillStyle = col;
          view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
        };
        const cell = (cellX: number, cellY: number) => {
          paint(cellX * 2.4 - 1.1, cellY * 2.4 - 0.9, 2.2, 1.8, '#1b2b55');
          paint(cellX * 2.4 - 1.1, cellY * 2.4 - 0.9, 2.2, 0.35, '#5f7fc4');
        };
        for (const [cellX, cellY] of [
          [-3, -3],
          [-2, -3],
          [2, -3],
          [3, -3],
          [-3, -2],
          [-2, -2],
          [2, -2],
          [3, -2],
        ])
          cell(cellX, cellY); // eyes
        for (const [cellX, cellY] of [
          [-5, 1],
          [-4, 2],
          [-3, 3],
          [-2, 3],
          [-1, 4],
          [0, 4],
          [1, 4],
          [2, 3],
          [3, 3],
          [4, 2],
          [5, 1],
        ])
          cell(cellX, cellY); // grin
      } else if (prop.kind === 'board') {
        // Heavy timber support posts
        const boardW = 18 * ppm,
          boardH = 2.4 * ppm;
        view.ctx.fillStyle = 'rgba(10,12,16,0.38)';
        view.ctx.fillRect(-boardW / 2 + 2, -boardH / 2 + 3, boardW, boardH);
        // Wooden support posts
        view.ctx.fillStyle = '#3a2d21';
        view.ctx.fillRect(-boardW / 2 + 1 * ppm, -boardH / 2, 0.4 * ppm, boardH + 2);
        view.ctx.fillRect(boardW / 2 - 1.4 * ppm, -boardH / 2, 0.4 * ppm, boardH + 2);
        // Signboard body with colored accent border
        // blue = a motorway EXIT sign (highway.js slip roads)
        view.ctx.fillStyle = prop.blue ? '#1f4fa8' : '#14161c';
        view.ctx.fillRect(-boardW / 2, -boardH / 2, boardW, boardH);
        view.ctx.strokeStyle = prop.blue
          ? '#ffffff'
          : prop.label!.includes('SPUM')
            ? '#eab308'
            : prop.label!.includes('CREEM')
              ? '#38bdf8'
              : '#f97316';
        view.ctx.lineWidth = 1.8;
        view.ctx.strokeRect(-boardW / 2, -boardH / 2, boardW, boardH);
        // Sponsor typography with punchy contrast
        view.ctx.fillStyle = '#ffffff';
        view.ctx.font = `900 ${Math.round(1.15 * ppm)}px Impact, ui-sans-serif, sans-serif`;
        view.ctx.textAlign = 'center';
        view.ctx.textBaseline = 'middle';
        view.ctx.fillText(prop.label || 'SPONSOR', 0, 0);
      }
      view.ctx.restore();
    }
  }

  return { drawFence, drawBarriers, drawProps };
}
