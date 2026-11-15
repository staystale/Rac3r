// hud/minimapHighway.ts - THE HIGHWAY'S MINIMAP EXTRAS (?hwmap=1, FIX.hwmap; TODO 3a2 item 11,
// the owner's answers 11-15: "simple pixel icons"): on the endless roads the minimap window
// (hud/minimap.ts) also shows the roads that leave the motorway - the slip roads, the side road,
// a junction's slips and roundabouts, a road bridge's road - as thin road lines under the
// motorway's (sat-nav style); each petrol station (a lay-by's, a services', Deaf Valley's) as a
// small green pump; and the police in the window's range as blue dots, flashing only while
// they chase someone (an angry driver chasing as police do has no lights: not shown).
import { LEVEL } from '../world/state.ts';
import { COL } from '../world/colours.ts';
import { SURFACES } from '../world/surfaces.ts';
import type { HudGame } from './hudtypes.ts';
import type { Lane, Prop } from '../world/types.ts';

// the side roads' two strokes, css px wide: thinner than the motorway's (hud/minimap.ts
// ROAD_STROKES 7 / 3.5), the same colours, so they read as smaller roads branching off it
const SIDE_STROKES: [number, string][] = [[4, 'rgba(20,20,22,0.55)'], [1.8,
  'rgba(236,231,220,0.9)']];
// ms a chasing police dot's half flash (the light bar's own beat, render/lightbar.ts, is ~4 Hz)
const FLASH_MS = 125;
// css px: a police dot's radius (a rival's is 3), the pump icon's body
const POLICE_R = 3, PUMP_W = 5, PUMP_H = 7;

// the level's petrol stations and side roads, picked out when its lists change (not every frame)
const picked = { props: null as Prop[] | null, propCount: -1, lanes: null as Lane[] | null,
  laneCount: -1, pumps: [] as Prop[], roads: [] as Lane[] };

/**
 * The level's pumps and side roads, refreshed when the streamed lists grew or shrank.
 * @returns the petrol stations and the roads leaving the motorway
 */
function pickedNow() {
  const props = LEVEL.props || [], lanes = LEVEL.lanes || [];
  if (props !== picked.props || props.length !== picked.propCount) {
    picked.props = props;
    picked.propCount = props.length;
    picked.pumps = props.filter((prop) => prop.kind === 'gasstation');
  }
  if (lanes !== picked.lanes || lanes.length !== picked.laneCount) {
    picked.lanes = lanes;
    picked.laneCount = lanes.length;
    // tarmac and not a village's street: the slips, the side road, a junction's, a bridge's road
    picked.roads = lanes.filter((lane) => lane.surface === SURFACES.tarmac && lane.field == null
      && !lane.band && lane.pts.length > 1);
  }
  return picked;
}

/**
 * Whether a side road has a point within reach of a spot (its ends and middle: the pieces are
 * short, ~100 m).
 * @param lane the road
 * @param x the spot, m
 * @param y the spot, m
 * @param reach m
 * @returns true when near
 */
function laneNear(lane: Lane, x: number, y: number, reach: number) {
  const pts = lane.pts, mid = pts[pts.length >> 1], last = pts[pts.length - 1];
  return [pts[0], mid, last].some(([pointX, pointY]) => Math.hypot(pointX - x, pointY - y) < reach);
}

/**
 * Draws the roads leaving the motorway within reach, thin, under the motorway (the window's
 * world transform is set: world m).
 * @param ctx the HUD context
 * @param game the game (your car)
 * @param reach m from your car
 * @param scale css px per m
 */
export function drawHighwaySideRoads(ctx: CanvasRenderingContext2D, game: HudGame, reach: number,
  scale: number) {
  if (!LEVEL.endless) return;
  const near = pickedNow().roads.filter((lane) => laneNear(lane, game.car.x, game.car.y, reach));
  for (const [width, colour] of SIDE_STROKES) {
    ctx.lineWidth = width / scale;
    ctx.strokeStyle = colour;
    ctx.beginPath();
    for (const lane of near) {
      lane.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    }
    ctx.stroke();
  }
}

/**
 * A small pixel petrol pump at a window spot: the green body with a dark rim, its pale window,
 * the hose down its right side.
 * @param ctx the HUD context (css px)
 * @param x the spot, css px
 * @param y the spot, css px
 */
function drawPump(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const left = Math.round(x - PUMP_W / 2), top = Math.round(y - PUMP_H / 2);
  ctx.fillStyle = COL.hud;
  ctx.fillRect(left - 1, top - 1, PUMP_W + 2, PUMP_H + 2);
  ctx.fillRect(left + PUMP_W + 1, top + 1, 2, PUMP_H - 1);
  ctx.fillStyle = COL.mapFuel;
  ctx.fillRect(left, top, PUMP_W, PUMP_H);
  ctx.fillRect(left + PUMP_W + 1, top + 2, 1, PUMP_H - 3);
  ctx.fillStyle = COL.hudText;
  ctx.fillRect(left + 1, top + 1, PUMP_W - 2, 2);
}

/**
 * A police car's dot: blue, flashing blue / white while it chases.
 * @param ctx the HUD context (css px)
 * @param x the spot, css px
 * @param y the spot, css px
 * @param isChasing true while it chases someone
 */
function drawPoliceDot(ctx: CanvasRenderingContext2D, x: number, y: number, isChasing: boolean) {
  const isLit = !isChasing || Math.floor(performance.now() / FLASH_MS) % 2 === 0;
  ctx.beginPath();
  ctx.arc(x, y, POLICE_R, 0, Math.PI * 2);
  ctx.fillStyle = isLit ? COL.blues : COL.bluesCore;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = COL.hud;
  ctx.stroke();
}

/**
 * Draws the petrol stations and the police within reach (css px: the window's world transform is
 * NOT set; the window's clip is).
 * @param ctx the HUD context
 * @param game the game (your car, the traffic)
 * @param carX your car's place in the window, css px
 * @param carY your car's place in the window, css px
 * @param scale css px per m
 * @param reach m from your car
 */
export function drawHighwayMarks(ctx: CanvasRenderingContext2D, game: HudGame, carX: number,
  carY: number, scale: number, reach: number) {
  if (!LEVEL.endless) return;
  const car = game.car;
  const toX = (worldX: number) => carX + (worldX - car.x) * scale;
  const toY = (worldY: number) => carY + (worldY - car.y) * scale;
  for (const pump of pickedNow().pumps) {
    if (Math.hypot(pump.x - car.x, pump.y - car.y) < reach) drawPump(ctx, toX(pump.x), toY(pump.y));
  }
  for (const slot of game.traffic ? game.traffic.list : []) {
    const police = slot.police;
    if (!police || police.angry) continue;
    if (Math.hypot(slot.car.x - car.x, slot.car.y - car.y) > reach) continue;
    drawPoliceDot(ctx, toX(slot.car.x), toY(slot.car.y), police.mode === 'chase');
  }
}
