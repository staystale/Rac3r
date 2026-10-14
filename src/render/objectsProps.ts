// The big roadside props of the objects layer, seen from above: the banger, the caravan and the
// podium.
import type { RenderCone, View } from "./types.ts";

// what the prop drawers read of the objects context
interface PropsEnv {
  view: View;
  PPMz: () => number;
  roundRect: (
    g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number
  ) => void;
}

/**
 * Draws a dented banger from above, with its roll cage and number.
 * @param env the draw env
 * @param cone the object
 */
export function drawBanger(env: PropsEnv, cone: RenderCone) {
  const { view, roundRect } = env;
  const ppm = env.PPMz();
  view.ctx.rotate(cone.ang);
  // Cast shadow
  view.ctx.fillStyle = 'rgba(10,12,16,0.44)';
  roundRect(view.ctx, -2.1 * ppm + 3, -1.0 * ppm + 4, 4.2 * ppm, 2.0 * ppm, 5);
  view.ctx.fill();
  // Dented banger body with primer & rust patches
  view.ctx.fillStyle = cone.paint || '#7c342a';
  roundRect(view.ctx, -2.1 * ppm, -1.0 * ppm, 4.2 * ppm, 2.0 * ppm, 4); view.ctx.fill();
  view.ctx.strokeStyle = '#181a1f'; view.ctx.lineWidth = 1.2; view.ctx.stroke();
  // Heavy triangular welded iron roof fin with driver number
  view.ctx.fillStyle = '#1e2129';
  view.ctx.fillRect(-0.4 * ppm, -0.15 * ppm, 1.4 * ppm, 0.3 * ppm);
  view.ctx.fillStyle = '#f8fafc';
  view.ctx.font = `900 ${Math.round(1.05 * ppm)}px Impact, ui-sans-serif, sans-serif`;
  view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
  view.ctx.fillText(cone.num || '42', 0.3 * ppm, 0);
  // Smashed windscreen & open cabin showing welded H-frame roll-bar
  view.ctx.fillStyle = '#14161c';
  roundRect(view.ctx, -0.8 * ppm, -0.75 * ppm, 1.9 * ppm, 1.5 * ppm, 2); view.ctx.fill();
  // Steel roll-cage crossbars
  view.ctx.strokeStyle = '#e2e8f0'; view.ctx.lineWidth = 1.5;
  view.ctx.beginPath();
  view.ctx.moveTo(-0.5 * ppm, -0.6 * ppm); view.ctx.lineTo(0.7 * ppm, 0.6 * ppm);
  view.ctx.moveTo(-0.5 * ppm, 0.6 * ppm); view.ctx.lineTo(0.7 * ppm, -0.6 * ppm);
  view.ctx.stroke();
  // Crumpled front wing & exposed radiator
  view.ctx.fillStyle = '#3a3e48';
  view.ctx.fillRect(1.8 * ppm, -0.6 * ppm, 0.3 * ppm, 1.2 * ppm);
  // Smashed headlight
  view.ctx.fillStyle = '#fff6dc';
  view.ctx.beginPath();
  view.ctx.arc(1.9 * ppm, -0.6 * ppm, 0.15 * ppm, 0, Math.PI * 2);
  view.ctx.fill();
  // Sponsor stencil on boot
  view.ctx.fillStyle = 'rgba(255,255,255,0.7)';
  view.ctx.font = `700 ${Math.round(0.35 * ppm)}px ui-monospace, monospace`;
  view.ctx.fillText("BILL'S SCRAP", -1.3 * ppm, 0);
}

/**
 * Draws a retro tourer caravan from above.
 * @param env the draw env
 * @param cone the object
 */
export function drawCaravan(env: PropsEnv, cone: RenderCone) {
  const { view, roundRect } = env;
  const ppm = env.PPMz();
  view.ctx.rotate(cone.ang);
  // Cast shadow
  view.ctx.fillStyle = 'rgba(10,12,16,0.40)';
  roundRect(view.ctx, -2.4 * ppm + 4, -1.1 * ppm + 5, 4.8 * ppm, 2.2 * ppm, 7);
  view.ctx.fill();
  // Steel A-frame tow hitch with black jockey wheel
  view.ctx.strokeStyle = '#5a6270'; view.ctx.lineWidth = Math.max(2, 0.14 * ppm);
  view.ctx.beginPath();
  view.ctx.moveTo(2.4 * ppm, -0.35 * ppm);
  view.ctx.lineTo(3.3 * ppm, 0);
  view.ctx.lineTo(2.4 * ppm, 0.35 * ppm);
  view.ctx.stroke();
  // Jockey wheel
  view.ctx.fillStyle = '#111';
  view.ctx.fillRect(3.1 * ppm, -0.15 * ppm, 0.3 * ppm, 0.3 * ppm);
  // Green gas bottle mounted on A-frame
  view.ctx.fillStyle = '#2d6a4f';
  roundRect(view.ctx, 2.5 * ppm, -0.2 * ppm, 0.4 * ppm, 0.4 * ppm, 2); view.ctx.fill();
  // Rounded retro tourer body in classic warm cream
  view.ctx.fillStyle = '#f4f0e6';
  roundRect(view.ctx, -2.4 * ppm, -1.1 * ppm, 4.8 * ppm, 2.2 * ppm, 6); view.ctx.fill();
  view.ctx.strokeStyle = '#9ca3af'; view.ctx.lineWidth = 1.2; view.ctx.stroke();
  // Burnt-orange & chocolate dual vintage beltline stripes
  view.ctx.fillStyle = '#c0561a';
  view.ctx.fillRect(-2.3 * ppm, -0.22 * ppm, 4.6 * ppm, 0.28 * ppm);
  view.ctx.fillStyle = '#5a280d';
  view.ctx.fillRect(-2.3 * ppm, 0.08 * ppm, 4.6 * ppm, 0.12 * ppm);
  // Pop-up roof vent hatch
  view.ctx.fillStyle = '#d8d4c8';
  roundRect(view.ctx, -0.4 * ppm, -0.4 * ppm, 0.8 * ppm, 0.8 * ppm, 2); view.ctx.fill();
  view.ctx.fillStyle = 'rgba(0,0,0,0.18)';
  view.ctx.fillRect(-0.4 * ppm, 0.3 * ppm, 0.8 * ppm, 0.1 * ppm); // vent shadow
  // Tinted panoramic front & rear windows with curtain borders
  view.ctx.fillStyle = '#1e293b';
  roundRect(view.ctx, 1.7 * ppm, -0.85 * ppm, 0.5 * ppm, 1.7 * ppm, 1.5); view.ctx.fill();
  roundRect(view.ctx, -2.2 * ppm, -0.85 * ppm, 0.5 * ppm, 1.7 * ppm, 1.5); view.ctx.fill();
  view.ctx.fillStyle = '#ffffff'; // White curtain trim
  view.ctx.fillRect(1.7 * ppm, -0.85 * ppm, 0.1 * ppm, 1.7 * ppm);
  view.ctx.fillRect(-1.8 * ppm, -0.85 * ppm, 0.1 * ppm, 1.7 * ppm);
  // Side door with handle
  view.ctx.strokeStyle = '#94a3b8'; view.ctx.lineWidth = 1;
  view.ctx.strokeRect(-0.8 * ppm, 0.4 * ppm, 1.0 * ppm, 0.7 * ppm);
  view.ctx.fillStyle = '#cbd5e1';
  view.ctx.fillRect(-0.7 * ppm, 0.65 * ppm, 0.15 * ppm, 0.15 * ppm); // handle
  // Amber side marker lights and red circular taillights
  view.ctx.fillStyle = '#f59e0b';
  view.ctx.fillRect(-1.0 * ppm, -1.15 * ppm, 0.2 * ppm, 0.1 * ppm);
  view.ctx.fillRect(1.0 * ppm, -1.15 * ppm, 0.2 * ppm, 0.1 * ppm);
  view.ctx.fillStyle = '#ef4444';
  view.ctx.beginPath();
  view.ctx.arc(-2.4 * ppm, -0.7 * ppm, 0.12 * ppm, 0, Math.PI * 2);
  view.ctx.fill();
  view.ctx.beginPath();
  view.ctx.arc(-2.4 * ppm, 0.7 * ppm, 0.12 * ppm, 0, Math.PI * 2);
  view.ctx.fill();
}

/**
 * Draws the three-step podium with its cups and numerals.
 * @param env the draw env
 * @param cone the object
 */
export function drawPodium(env: PropsEnv, cone: RenderCone) {
  const { view, roundRect } = env;
  const ppm = env.PPMz();
  view.ctx.rotate(cone.ang);
  // Ground shadow
  view.ctx.fillStyle = 'rgba(10,12,16,0.38)';
  roundRect(view.ctx, -1.8 * ppm + 3, -1.0 * ppm + 4, 3.6 * ppm, 2.0 * ppm, 3);
  view.ctx.fill();
  // 3 stepped blocks: 2nd (left), 1st (center), 3rd (right)
  // Center 1st place tier
  view.ctx.fillStyle = '#b4783e';
  roundRect(view.ctx, -0.6 * ppm, -1.0 * ppm, 1.2 * ppm, 2.0 * ppm, 2); view.ctx.fill();
  view.ctx.strokeStyle = '#5a3512'; view.ctx.lineWidth = 1.2; view.ctx.stroke();
  // Left 2nd place tier
  view.ctx.fillStyle = '#9b622e';
  roundRect(view.ctx, -1.7 * ppm, -0.85 * ppm, 1.1 * ppm, 1.7 * ppm, 2); view.ctx.fill();
  view.ctx.stroke();
  // Right 3rd place tier
  view.ctx.fillStyle = '#874f20';
  roundRect(view.ctx, 0.6 * ppm, -0.75 * ppm, 1.1 * ppm, 1.5 * ppm, 2); view.ctx.fill();
  view.ctx.stroke();
  // Chequered bunting skirt along the front bottom
  const checkW = 0.3 * ppm;
  for (let checkX = -1.7 * ppm; checkX < 1.7 * ppm; checkX += checkW) {
    view.ctx.fillStyle = Math.floor(checkX / checkW) % 2 === 0 ? '#111' : '#fff';
    view.ctx.fillRect(checkX, 0.85 * ppm, checkW, 0.15 * ppm);
  }
  // Numerals 1, 2, 3
  view.ctx.fillStyle = '#ffffff';
  view.ctx.font = `900 ${Math.round(0.75 * ppm)}px ui-sans-serif, sans-serif`;
  view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
  view.ctx.fillText('1', 0, 0.3 * ppm);
  view.ctx.fillText('2', -1.15 * ppm, 0.3 * ppm);
  view.ctx.fillText('3', 1.15 * ppm, 0.3 * ppm);
  // Gold / Silver / Bronze trophy cups on the top steps!
  // 1st place Gold cup
  view.ctx.fillStyle = '#eab308';
  view.ctx.fillRect(-0.25 * ppm, -0.75 * ppm, 0.5 * ppm, 0.45 * ppm);
  view.ctx.fillRect(-0.15 * ppm, -0.3 * ppm, 0.3 * ppm, 0.15 * ppm);
  view.ctx.strokeStyle = '#ca8a04'; view.ctx.lineWidth = 1.2;
  // cup handles
  view.ctx.beginPath();
  view.ctx.arc(0, -0.52 * ppm, 0.35 * ppm, -0.6, 0.6);
  view.ctx.stroke();
  // 2nd place Silver cup
  view.ctx.fillStyle = '#cbd5e1';
  view.ctx.fillRect(-1.35 * ppm, -0.65 * ppm, 0.4 * ppm, 0.35 * ppm);
  view.ctx.fillRect(-1.25 * ppm, -0.3 * ppm, 0.2 * ppm, 0.12 * ppm);
  // 3rd place Bronze cup
  view.ctx.fillStyle = '#b45309';
  view.ctx.fillRect(0.95 * ppm, -0.55 * ppm, 0.4 * ppm, 0.35 * ppm);
  view.ctx.fillRect(1.05 * ppm, -0.2 * ppm, 0.2 * ppm, 0.12 * ppm);
}
