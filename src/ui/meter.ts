// FRAME METER (?meter=1): an on-screen graph + numbers for the last frames, so the owner can see
// on a real phone whether judder comes from the physics step (sim, red), from drawing (blue), or
// from something else (grey: the browser, the GPU, a late frame). Only main.js creates it, and
// only with ?meter=1; without it nothing here runs. The ring buffers are allocated once: no
// garbage per frame.

export type FrameRec = { dt: number; sim: number; draw: number; steps: number; tiles: number };

const KEEP = 240;      // frames kept for the numbers
const BARS = 120;      // frames drawn as bars
const EVERY = 15;      // the stats are recomputed every this many frames
const FULL_MS = 40;    // bar graph: this many ms = full height
// CSS px: below the HUD's button rows (top 12 + 34, second row on a phone 34 + 6, help row 3)
const BOX_X = 12, BOX_Y = 132, BOX_W = 310, BOX_H = 120;
const GRAPH_Y = 4, GRAPH_H = 52, GRAPH_X = 20, BAR_W = 2;

export function createMeter() {
  const dts = new Float64Array(KEEP), sims = new Float64Array(KEEP), draws = new Float64Array(KEEP);
  const stepsBuf = new Float64Array(KEEP), tilesBuf = new Float64Array(KEEP);
  const sorted = new Float64Array(KEEP);
  let head = 0, count = 0, sinceStats = EVERY;
  const lines = ['', '', '', ''];

  function add(rec: FrameRec): void {
    dts[head] = rec.dt; sims[head] = rec.sim; draws[head] = rec.draw;
    stepsBuf[head] = rec.steps; tilesBuf[head] = rec.tiles;
    head = (head + 1) % KEEP;
    if (count < KEEP) count++;
    sinceStats++;
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
      ` steps ${stepsBuf[worst]} tiles ${tilesBuf[worst]}`;
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
      if (tilesBuf[idx] > 0) {
        ctx.fillStyle = '#ffd020'; ctx.fillRect(barX, Math.max(0, base - total - 4), BAR_W, 2);
      }
    }
    ctx.font = '11px monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
    for (const [msec, label] of [[8.3, '120'], [16.7, '60']] as const) {
      const lineY = Math.round(base - msec * scale) + 0.5;
      ctx.beginPath(); ctx.moveTo(GRAPH_X, lineY); ctx.lineTo(GRAPH_X + BARS * BAR_W, lineY);
      ctx.stroke();
      ctx.fillText(label, 2, lineY);
    }
    ctx.textBaseline = 'top';
    for (let row = 0; row < lines.length; row++) ctx.fillText(lines[row], 4, 62 + row * 14);
    ctx.restore();
  }

  return { add, draw };
}
