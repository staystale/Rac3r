// metalscrape.ts - METAL ON HARD GROUND (owner: "a rim on tarmac should have a small chance to
// degrade hard surfaces - racing to normal, normal to cracked"; "crashed rolled cars should have
// a chance too"). ONE rule for a wheel on its rim (physics/tyrepressure.ts) and a car's body
// sliding on its side or roof (roll.ts car.sparks): on hard ground it throws sparks (the
// particles read car.rimSparks / car.sparks), a rim scores a pale line (MARK_GOUGE), and for each
// new 1.5 m wear cell it enters there is a small chance to break the surface down one grade -
// race tarmac to tarmac, tarmac to broken tarmac - through the wear cells (gougeCell below), so
// the ground painter, the physics and the AI see the new surface as any worn ground. A
// rollover's impact on hard ground has its own, bigger chance under the car. Concrete, kerbs and
// the Lab floor are left alone.

import {
  WEAR_CELL, wearMap, wearKey, wearDirty, getCell, layersAt, groundAt, passCell,
} from './wear.ts';
import type { Mark, Surface } from './types.ts';
import { carWheels, CORNER_OF_WHEEL, wheelGone } from './wheels.ts';
import { dragReach } from './debris.ts';
import { FIX } from '../core/fixes.ts';
import type { Spray } from './types.ts';

/** A car as this file reads it. */
export interface ScrapeCar {
  x: number; y: number; vx: number; vy: number; heading: number;
  spec: { lf: number; lr: number; trackWidth?: number; trackR?: number; wid?: number };
  onRim?: boolean[];
  wheelOff?: boolean[];
  suspOff?: number[];
  rimSparks?: boolean[];
  // ?dmgmore: what a corner dragging on soft ground throws up (its ground's spray; the particles)
  dragSpray?: (Spray | null)[];
  sparks?: boolean;
  _scrapeCell?: number[];
}

// the pale scored line a rim leaves on hard ground (marks.ts: the mark of a wheel with
// car.rimSparks set), narrower than the tyre
export const MARK_GOUGE: Mark = { rgb: '205,205,214', widen: 0.3, alpha: 0.55 };
// the grade a gouge breaks each surface to (anything else is left alone)
export const GOUGE_TO: Record<string, string> = { racetarmac: 'tarmac', tarmac: 'broken' };
// the chance per wear cell a rim enters: ~5 broken cells a km on one rim (667 cells a km)
const RIM_CHANCE = 0.0075;
// the chance per wear cell a sliding body enters, and a rollover impact's under the car
const BODY_CHANCE = 0.05, IMPACT_CHANCE = 0.3;
// m/s: slower than this a rim or a body drags without sparks or gouges
const SCRAPE_FROM = 2;
// a rim or a hub on SOFT ground digs: each new wear cell it enters takes RIM_DIG tyre
// passes at once (a rolling tyre 1, a sliding one 2) - grass wears to dirt, ruts deepen faster;
// it lays no tyre mark there (marks.ts) and no ordinary pass (wear.ts)
const RIM_DIG = 3;
// the scraper slot of the body (after the four wheels)
const BODY = 4;

/**
 * One physics step of metal on the ground: rims on hard ground spark and may gouge; a body
 * sliding on hard ground (car.sparks, set by roll.ts) may gouge.
 * @param car the car
 * @param rnd the random source
 */
export function scrapeMetal(car: ScrapeCar, rnd: () => number = Math.random): void {
  scrapeRims(car, rnd);
  if (car.sparks && enteredCell(car, BODY, car.x, car.y) && rnd() < BODY_CHANCE) {
    gougeCell(car.x, car.y);
  }
}

/**
 * The wheels on their rims: sparks on hard ground (car.rimSparks) and a chance per new cell to
 * break it.
 * @param car the car
 * @param rnd the random source
 */
function scrapeRims(car: ScrapeCar, rnd: () => number) {
  const speed = Math.hypot(car.vx, car.vy), rim = car.onRim;
  const sparks = car.rimSparks || (car.rimSparks = [false, false, false, false]);
  sparks.fill(false);
  if (FIX.dmgmore) (car.dragSpray || (car.dragSpray = [null, null, null, null])).fill(null);
  // a wheel gone drags its hub: metal on the ground as a rim is (owner 11-01: it may spark)
  const metal = (corner: number) => (!!rim && rim[corner]) || wheelGone(car, corner);
  if (![0, 1, 2, 3].some(metal) || speed < SCRAPE_FROM) return;
  const wheels = carWheels(car);
  for (let corner = 0; corner < 4; corner++) {
    if (!metal(corner)) continue;
    const { x, y } = touchPoint(car, corner, wheels[CORNER_OF_WHEEL[corner]]);
    const ground = surfaceUnder(x, y);
    if (!ground.hard) {
      if (enteredCell(car, corner, x, y)) digCell(x, y);
      if (car.dragSpray && wheelGone(car, corner)) car.dragSpray[corner] = ground.spray || null;
      continue;
    }
    sparks[corner] = true;
    if (enteredCell(car, corner, x, y) && rnd() < RIM_CHANCE) gougeCell(x, y);
  }
}

// the point a scraping corner touches, reused (no allocation per step)
const TOUCH = { x: 0, y: 0 };

/**
 * Where a corner's metal meets the ground: its wheel's place (a rim), or with ?dmgmore a torn-off
 * wheel's snapped arm or subframe (world/debris.ts dragReach), in from it toward the middle.
 * @param car the car
 * @param corner the damage corner
 * @param wheel its wheel's place, world m
 * @param wheel.x world x
 * @param wheel.y world y
 * @returns the point, world m (shared: read it before the next call)
 */
function touchPoint(car: ScrapeCar, corner: number, wheel: { x: number; y: number }) {
  if (!FIX.dmgmore || !wheelGone(car, corner)) return wheel;
  const along = corner < 2 ? car.spec.lf : -car.spec.lr;
  const axleX = car.x + Math.cos(car.heading) * along;
  const axleY = car.y + Math.sin(car.heading) * along;
  const hub = Math.hypot(wheel.x - axleX, wheel.y - axleY) || 1;
  const share = dragReach(car, corner) / hub;
  TOUCH.x = axleX + (wheel.x - axleX) * share;
  TOUCH.y = axleY + (wheel.y - axleY) * share;
  return TOUCH;
}

/**
 * Metal digs soft bare ground - RIM_DIG passes on its wear cell (a covered one is left).
 * @param x world x, m
 * @param y world y, m
 */
function digCell(x: number, y: number): void {
  const cell = getCell(Math.floor(x / WEAR_CELL), Math.floor(y / WEAR_CELL), true);
  if (!cell || cell.cover || cell.fixed) return;
  for (let pass = 0; pass < RIM_DIG; pass++) passCell(cell);
}

/**
 * A rollover's impact (damage.ts hitRoll): on hard ground a chance to break the surface under
 * the car.
 * @param car the car
 * @param rnd the random source
 */
export function gougeImpact(car: ScrapeCar, rnd: () => number = Math.random): void {
  if (surfaceUnder(car.x, car.y).hard && rnd() < IMPACT_CHANCE) gougeCell(car.x, car.y);
}

/**
 * Has this scraper moved into a new wear cell since the last step?
 * @param car the car (remembers each scraper's cell)
 * @param slot the scraper: a damage corner 0..3, or BODY
 * @param x world x, m
 * @param y world y, m
 * @returns true on the step it enters a new cell
 */
function enteredCell(car: ScrapeCar, slot: number, x: number, y: number): boolean {
  const cells = car._scrapeCell || (car._scrapeCell = [NaN, NaN, NaN, NaN, NaN]);
  // one number per cell: exact for the levels' sizes (|cell| < 2^20)
  const cell = Math.floor(x / WEAR_CELL) * 2097152 + Math.floor(y / WEAR_CELL);
  if (cells[slot] === cell) return false;
  cells[slot] = cell;
  return true;
}

/**
 * The surface a point of the car touches: the ground the wheels feel (wear.ts groundAt - verges,
 * kerbs and the weather's covers included). The worn cell or the level's zone alone read the race
 * tarmac under a circuit's grass verge, and rims sparked on the grass.
 * @param x world x, m
 * @param y world y, m
 * @returns the surface
 */
function surfaceUnder(x: number, y: number): Surface {
  return groundAt(x, y).surface;
}

/**
 * Breaks the ground at a point down one grade (GOUGE_TO): its wear cell takes the new base and
 * is repainted. A covered cell (snow, ice, standing water) or ground not in GOUGE_TO is left.
 * @param x world x, m
 * @param y world y, m
 * @returns true when the ground broke
 */
export function gougeCell(x: number, y: number): boolean {
  const cellX = Math.floor(x / WEAR_CELL), cellY = Math.floor(y / WEAR_CELL);
  let cell = wearMap.get(wearKey(cellX, cellY));
  if (!cell) {
    // made only when it breaks: no cell for the ground a rim merely crosses
    const layers = layersAt((cellX + 0.5) * WEAR_CELL, (cellY + 0.5) * WEAR_CELL);
    if (layers.cover || !GOUGE_TO[layers.base]) return false;
    cell = getCell(cellX, cellY, true) ?? undefined;
    if (!cell) return false;
  }
  const broken = GOUGE_TO[cell.base];
  if (cell.cover || !broken) return false;
  cell.base = broken;
  cell.current = broken;
  wearDirty.push(cell);
  return true;
}
