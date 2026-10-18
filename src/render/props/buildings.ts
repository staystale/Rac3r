// The pit-lane buildings and trackside structures: garage rows, grandstand, official box,
// gantry, pit wall and pylon.
import { LEVEL } from '../../world/state.ts';
import { lampsEnabled, lampsLit } from '../../world/lamps.ts';
import type { Point, Prop } from '../../world/types.ts';
import type { PropCtx } from './types.ts';

/**
 * Draws the brand name along the banner of a garage row, when it is big enough to read.
 * @param propCtx the view and painter helpers
 * @param prop the garage row prop
 * @param ppm pixels per metre
 */
function drawGarageBannerText(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view, toScreenX, toScreenY } = propCtx;
  const front = prop.front!,
    banner = prop.banner!,
    count = front.length;
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
}

// GARAGE ROW: one strip along the lane from front / back / banner polylines, so it
// bends with the track
/**
 * Draws one garage row strip from its front / back / banner polylines.
 * @param propCtx the view and painter helpers
 * @param prop the garage row prop
 * @param ppm pixels per metre
 */
export function drawGarageRow(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view, toScreenX, toScreenY } = propCtx;
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
  drawGarageBannerText(propCtx, prop, ppm);
  view.ctx.restore();
}

/**
 * Draws the grandstand prop (grandstand, stadium_grandstand).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawGrandstand(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
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
}

/**
 * Draws the official box prop (official_box).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawOfficialBox(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
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
}

/**
 * Draws the gantry prop (gantry).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawGantry(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view, roundRect } = propCtx;
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
}

/**
 * Draws the pit wall prop (pit_wall).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawPitWall(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view, roundRect } = propCtx;
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
}

/**
 * The pylon's warm pool of light on the ground around it.
 * @param view the canvas view
 * @param ppm pixels per metre
 */
function drawPylonPool(view: PropCtx['view'], ppm: number) {
  const grad = view.ctx.createRadialGradient(0, 0, 1 * ppm, 0, 0, 18 * ppm);
  grad.addColorStop(0, 'rgba(255, 248, 220, 0.16)');
  grad.addColorStop(0.5, 'rgba(255, 244, 200, 0.08)');
  grad.addColorStop(1, 'rgba(255, 240, 180, 0)');
  view.ctx.fillStyle = grad;
  view.ctx.beginPath();
  view.ctx.arc(0, 0, 18 * ppm, 0, Math.PI * 2);
  view.ctx.fill();
}

/**
 * Draws the pylon prop (pylon).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawPylon(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view, roundRect } = propCtx;
  // High-output halogen floodlight pylon. As a lamp (?lamps=1) it is lit only from dusk.
  const isLit = !lampsEnabled() || lampsLit();
  if (isLit) drawPylonPool(view, ppm);
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
    view.ctx.fillStyle = isLit ? '#fffbeb' : '#aeb5bd';
    view.ctx.beginPath();
    view.ctx.arc((headX + 0.27) * ppm, (headY + 0.22) * ppm, 0.14 * ppm, 0, Math.PI * 2);
    view.ctx.fill();
  }
}
