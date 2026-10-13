// FRAME METER (?meter=1): an on-screen graph + numbers for the last frames, so the owner can see
// on a real phone whether judder comes from the physics step (sim, red), from drawing (blue), or
// from something else (grey: the browser, the GPU, a late frame). Only main.js creates it, and
// only with ?meter=1; without it nothing here runs. The ring buffers are allocated once: no
// garbage per frame.
//
// Dots above a bar: YELLOW = ground tiles were drawn that frame; PINK = a finger went down, up
// or was cancelled that frame (touches), one row higher; GREEN = the highway's road window slid
// that frame (stepHighway extended the road), one more row up; CYAN = the overview was repainted
// that frame (endless levels), the top row. The last text lines count the drops near a tile /
// near a touch (in that frame or the 2 before), and the drops after an overview (in that frame
// or within the 500 ms before it). Every counted drop is also put in a bucket by the time since
// the last highway slide (this frame included): <0.5 s, 0.5-1 s, 1-2 s, 2-3 s, 3-5 s, 5 s+,
// or none (no slide yet). It shows whether drops come with a delay after a slide (garbage
// collection). The bucket line is split over 2 text lines to fit 390 px wide.
// highway.js and camera.ts call meterEvent(); main.js takes the counts once per frame.

const pending = { slide: 0, overview: 0 };
const taken = { slide: 0, overview: 0 };   // reused: takeMeterEvents allocates nothing

export function meterEvent(kind: 'slide' | 'overview'): void { pending[kind]++; }

// Returns the counts since the last call and zeroes them. The SAME object every time (copied
// into, so the caller must read it before the next call).
export function takeMeterEvents(): { slide: number; overview: number } {
  taken.slide = pending.slide; taken.overview = pending.overview;
  pending.slide = 0; pending.overview = 0;
  return taken;
}

export type FrameRec = {
  dt: number; sim: number; draw: number; steps: number; tiles: number;
  moving: boolean;   // the player car is over 20 km/h (5.6 m/s)
  touches: number;   // finger down / up events since the last frame
  slide: number;     // highway road window slides this frame
  overview: number;  // overview repaints this frame
  dist: number;      // game.hwDist in metres (0 off the highway)
};

const KEEP = 240;      // frames kept for the numbers
const BARS = 120;      // frames drawn as bars
const EVERY = 15;      // the stats are recomputed every this many frames
const AFTER_MS = 500;   // a drop this soon after an overview repaint counts as after it
const NO_SLIDE = 1e9;   // start value of the ms since a slide: no slide has happened yet
const KM_KEEP = 12;   // km of highway whose drop counts are shown
const DROP_MS = 25;    // a frame longer than this missed a 60 Hz beat: a drop
const FULL_MS = 40;    // bar graph: this many ms = full height
// CSS px: below the HUD's button rows (top 12 + 34, second row on a phone 34 + 6, help row 3)
const BOX_X = 12, BOX_Y = 132, BOX_W = 360, BOX_H = 190;
const GRAPH_Y = 4, GRAPH_H = 52, GRAPH_X = 20, BAR_W = 2;

// Bucket of the ms since the last slide: 0 <.5s, 1 .5-1s, 2 1-2s, 3 2-3s, 4 3-5s, 5 5s+, 6 none.
function slideBucket(msec: number): number {
  if (msec >= NO_SLIDE) return 6;
  if (msec < 500) return 0;
  if (msec < 1000) return 1;
  if (msec < 2000) return 2;
  return msec < 3000 ? 3 : msec < 5000 ? 4 : 5;
}

// Running totals since the meter was created (never reset). The tiles of the last 3 frames are
// kept in plain number variables: a drop "near a tile" had tiles in this frame or the 2 before.
// The same for touches. For slides and overviews the ms since the last one are kept (sum of the
// frame dt, this frame included): a drop is "after" one if it is under AFTER_MS.
function createTotals() {
  let millis = 0, drops = 0, near = 0, nearTouch = 0, afterOv = 0;
  let prev1 = 0, prev2 = 0, touch1 = 0, touch2 = 0;
  let sinceSlide = NO_SLIDE, sinceOv = 1e9;
  const slideBk = new Float64Array(7);   // drops per bucket of ms since a slide
  const kmRing = new Float64Array(KM_KEEP);   // drops of the last finished km
  let kmDone = 0, kmNow = 0, kmDrops = 0;   // finished km, current km index, its drops
  // the car is on road km index kmIdx: close the finished km into the ring
  function roadKm(kmIdx: number): void {
    if (kmIdx < kmNow) { kmNow = 0; kmDone = 0; kmDrops = 0; }   // restart
    while (kmNow < kmIdx) {
      kmRing[kmDone % KM_KEEP] = kmDrops;
      kmDone++; kmNow++; kmDrops = 0;
    }
  }
  return {
    add(frameMs: number, tiles: number, touches: number, moving: boolean,
      slide: number, overview: number, dist: number): void {
      if (dist > 0) roadKm(Math.floor(dist / 1000));
      sinceSlide = slide > 0 ? 0 : sinceSlide + frameMs;
      sinceOv = overview > 0 ? 0 : sinceOv + frameMs;
      if (moving) {
        millis += frameMs;
        if (frameMs > DROP_MS) {
          drops++;
          if (dist > 0) kmDrops++;
          if (tiles > 0 || prev1 > 0 || prev2 > 0) near++;
          if (touches > 0 || touch1 > 0 || touch2 > 0) nearTouch++;
          slideBk[slideBucket(sinceSlide)]++;
          if (sinceOv <= AFTER_MS) afterOv++;
        }
      }
      prev2 = prev1; prev1 = tiles;
      touch2 = touch1; touch1 = touches;
    },
    kmText(): string {
      let out = 'per km:';
      for (let i = Math.max(0, kmDone - KM_KEEP); i < kmDone; i++) out += ' ' + kmRing[i % KM_KEEP];
      return out + ' (now ' + kmDrops + ')';
    },
    text(): string[] {
      const secs = millis / 1000;
      const perMin = secs > 0 ? drops / secs * 60 : 0;
      return [`driving ${Math.round(secs)} s: drops ${drops} (${perMin.toFixed(1)}/min)`,
        `near a tile ${near}, near a touch ${nearTouch}, after an overview ${afterOv}`,
        `since slide: <.5s ${slideBk[0]}, .5-1s ${slideBk[1]}, 1-2s ${slideBk[2]},`,
        `2-3s ${slideBk[3]}, 3-5s ${slideBk[4]}, 5s+ ${slideBk[5]}, none ${slideBk[6]}`];
    },
  };
}

function markDot(ctx: CanvasRenderingContext2D, dotX: number, dotY: number, color: string): void {
  ctx.fillStyle = color; ctx.fillRect(dotX, Math.max(0, dotY), BAR_W, 2);
}

// the 120 / 60 fps guide lines and their labels
function drawGuides(ctx: CanvasRenderingContext2D, base: number, scale: number): void {
  ctx.font = '10px monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
  for (const [msec, label] of [[8.3, '120'], [16.7, '60']] as const) {
    const lineY = Math.round(base - msec * scale) + 0.5;
    ctx.beginPath(); ctx.moveTo(GRAPH_X, lineY); ctx.lineTo(GRAPH_X + BARS * BAR_W, lineY);
    ctx.stroke();
    ctx.fillText(label, 2, lineY);
  }
}

export function createMeter() {
  const dts = new Float64Array(KEEP), sims = new Float64Array(KEEP), draws = new Float64Array(KEEP);
  const stepsBuf = new Float64Array(KEEP), tilesBuf = new Float64Array(KEEP);
  const slideBuf = new Float64Array(KEEP), ovBuf = new Float64Array(KEEP);
  const touchBuf = new Float64Array(KEEP), sorted = new Float64Array(KEEP);
  let head = 0, count = 0, sinceStats = EVERY;
  const lines = ['', '', '', '', '', '', '', '', ''];
  const totals = createTotals();

  function add(rec: FrameRec): void {
    dts[head] = rec.dt; sims[head] = rec.sim; draws[head] = rec.draw;
    stepsBuf[head] = rec.steps; tilesBuf[head] = rec.tiles;
    touchBuf[head] = rec.touches; slideBuf[head] = rec.slide; ovBuf[head] = rec.overview;
    head = (head + 1) % KEEP;
    if (count < KEEP) count++;
    sinceStats++; totals.add(rec.dt, rec.tiles, rec.touches, rec.moving,
      rec.slide, rec.overview, rec.dist);
  }

  const fix1 = (val: number) => val.toFixed(1);

  function stats(): void {
    sinceStats = 0;
    if (!count) return;
    let slow = 0, sumSim = 0, sumDraw = 0, sumSteps = 0, maxSteps = 0, nTiles = 0, worst = 0;
    for (let i = 0; i < count; i++) {
      sorted[i] = dts[i];
      if (dts[i] > 17) slow++;
      sumSim += sims[i]; sumDraw += draws[i]; sumSteps += stepsBuf[i]; nTiles += tilesBuf[i];
      if (stepsBuf[i] > maxSteps) maxSteps = stepsBuf[i];
      if (dts[i] > dts[worst]) worst = i;
    }
    const part = sorted.subarray(0, count).sort();
    const med = part[Math.floor(count / 2)];
    const p95 = part[Math.min(count - 1, Math.floor(count * 0.95))];
    lines[0] = `frame med ${fix1(med)} p95 ${fix1(p95)} worst ${fix1(dts[worst])} ms`;
    lines[1] = `slow >17ms: ${slow}   sim avg ${fix1(sumSim / count)}` +
      `  draw avg ${fix1(sumDraw / count)} ms`;
    lines[2] = `steps avg ${fix1(sumSteps / count)} max ${maxSteps}   tiles ${nTiles}`;
    lines[3] = `worst: sim ${fix1(sims[worst])} draw ${fix1(draws[worst])}` +
      ` other ${fix1(Math.max(0, dts[worst] - sims[worst] - draws[worst]))}` +
      ` steps ${stepsBuf[worst]} tiles ${tilesBuf[worst]} touch ${touchBuf[worst]}`;
    [lines[4], lines[5], lines[6], lines[7]] = totals.text();
    lines[8] = totals.kmText();
  }

  function draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // the HUD draws in CSS px on the full-resolution context (render.ts sets the dpr transform)
    if (BOX_X + BOX_W > width || BOX_Y + BOX_H > height) return;   // no room: draw nothing
    if (sinceStats >= EVERY) stats();
    ctx.save();
    ctx.translate(BOX_X, BOX_Y);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, BOX_W, BOX_H);
    const base = GRAPH_Y + GRAPH_H, scale = GRAPH_H / FULL_MS;
    const shown = Math.min(count, BARS);
    for (let bar = 0; bar < shown; bar++) {
      const idx = (head - shown + bar + KEEP) % KEEP, barX = GRAPH_X + bar * BAR_W;
      const total = Math.min(GRAPH_H, dts[idx] * scale);
      const simH = Math.min(total, sims[idx] * scale);
      const drawH = Math.min(total - simH, draws[idx] * scale);
      ctx.fillStyle = '#888'; ctx.fillRect(barX, base - total, BAR_W, total);
      ctx.fillStyle = '#e03030'; ctx.fillRect(barX, base - simH, BAR_W, simH);
      ctx.fillStyle = '#3070e0'; ctx.fillRect(barX, base - simH - drawH, BAR_W, drawH);
      if (touchBuf[idx] > 0) markDot(ctx, barX, base - total - 8, '#ff4fd8');
      if (tilesBuf[idx] > 0) markDot(ctx, barX, base - total - 4, '#ffd020');
      if (slideBuf[idx] > 0) markDot(ctx, barX, base - total - 12, '#4fe36b');
      if (ovBuf[idx] > 0) markDot(ctx, barX, base - total - 16, '#4fd8ff');
    }
    drawGuides(ctx, base, scale);
    ctx.textBaseline = 'top';
    for (let row = 0; row < lines.length; row++) ctx.fillText(lines[row], 4, 62 + row * 14);
    ctx.restore();
  }

  return { add, draw };
}
