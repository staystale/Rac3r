// The LAMPS (?lamps=1): street lights (the level's `lamps` data) and floodlight pylons (the
// `pylon` props) as solid posts that light a pool below their head from dusk and go off in the
// light, as real ones do. Every car is clamped against their posts (world/barriers.ts
// solidClamp) and a hit leans, dims or snaps them (world/lampdamage.ts); the night layer
// (render/light.ts) draws their pools; render/props/lamps.ts the street lights, buildings.ts the
// pylons. RESTART stands them all up again (resetLamps).
import { LEVEL, PROPS } from './state.ts';
import { DAYLIGHT } from './daylight.ts';
import type { CarBody, Prop, Solid } from './types.ts';

// darkness at and above which the lamps are on (a light sensor: a little before the cars' lights)
export const LAMPS_ON_DARKNESS = 0.3;
// a street light: how far its arm reaches out over the road, the radius of its pool, its height
export const STREET_ARM_M = 2.4, STREET_HEIGHT_M = 8;
const STREET_POOL_M = 15;
// a street light's post, m square (a steel column ~0.25 m, padded for the wheel arches)
const STREET_POST_M = 0.36;
// a floodlight pylon: its pool radius, its concrete base and its height, m
const FLOOD_POOL_M = 34, FLOOD_BASE_M = 1.6, FLOOD_HEIGHT_M = 18;
// a damaged lamp's flicker: the chance a frame it dips, per unit of flicker, and how far
const FLICKER_DIP_CHANCE = 0.3, FLICKER_DIP = 0.2;

/** One lamp: where its post stands, where its light hangs, its pool, its solid, its damage. */
export interface Lamp {
  kind: 'street' | 'flood';
  x: number;        // the post's foot, m
  y: number;
  headX: number;    // where the light hangs (a street light's arm reaches over the road), m
  headY: number;
  rot: number;      // the arm's direction, radians
  poolM: number;    // the pool's radius, m
  level: number;    // how bright it can be, 0..1 (hard hits take it down)
  shown: number;    // how bright it is this frame (level, dipping when it flickers)
  flicker: number;  // how much it flickers, 0..1 (a nudge starts it)
  leanX: number;    // the lean, radians, toward +x / +y (a nudge wonks the post)
  leanY: number;
  down: boolean;    // snapped: lying along (fallX, fallY), no light, no solid
  fallX: number;
  fallY: number;
  solidity: number; // a fallen post: how much it still resists a car, 1 -> flat
  mangle: number;   // a fallen post: how many times it has been driven over
  touching: CarBody | null;   // the car on a fallen post now (one pass = one hit)
  prop: Prop | null;          // a pylon's prop (its painter reads the lamp)
  solid: Solid;
}

let isOn = false;
let builtFor: object | null = null;
let lamps: Lamp[] = [];
const NONE: Lamp[] = [];

/**
 * Turns the lamps on (?lamps=1): solid posts and pools.
 * @param enabled true for the lamps
 */
export function setLamps(enabled: boolean): void {
  isOn = enabled;
  builtFor = null;
}

/**
 * Whether the lamps exist at all (?lamps=1).
 * @returns true when on
 */
export function lampsEnabled(): boolean {
  return isOn;
}

/**
 * Whether the lamps are lit in this light.
 * @returns true from dusk on
 */
export function lampsLit(): boolean {
  return DAYLIGHT.darkness >= LAMPS_ON_DARKNESS;
}

/**
 * Puts a lamp's head where its lean takes it: the top of a leaning post moves by its height
 * times the lean, and a street light's arm reaches on from there.
 * @param lamp the lamp (headX, headY are set)
 */
export function placeHead(lamp: Lamp): void {
  const height = lamp.kind === 'street' ? STREET_HEIGHT_M : FLOOD_HEIGHT_M;
  const arm = lamp.kind === 'street' ? STREET_ARM_M : 0;
  lamp.headX = lamp.x + lamp.leanX * height + Math.cos(lamp.rot) * arm;
  lamp.headY = lamp.y + lamp.leanY * height + Math.sin(lamp.rot) * arm;
}

/**
 * A lamp from a street light or pylon entry.
 * @param prop the level entry (x, y the foot; rot the arm's direction)
 * @param kind street or flood
 * @returns the lamp
 */
function makeLamp(prop: Prop, kind: Lamp['kind']): Lamp {
  const rot = prop.rot || 0;
  const post = kind === 'street' ? STREET_POST_M : FLOOD_BASE_M;
  const lamp: Lamp = {
    kind, x: prop.x, y: prop.y, rot, headX: prop.x, headY: prop.y,
    poolM: kind === 'street' ? STREET_POOL_M : FLOOD_POOL_M, level: 1, shown: 1, flicker: 0,
    leanX: 0, leanY: 0, down: false, fallX: 1, fallY: 0, solidity: 1, mangle: 0,
    touching: null, prop: kind === 'flood' ? prop : null,
    solid: { x: prop.x, y: prop.y, w: post, h: post, rot, kind: 'lamp',
      r: Math.hypot(post, post) / 2 },
  };
  placeHead(lamp);
  return lamp;
}

/**
 * The active level's lamps (none without ?lamps=1), built the first time a level asks.
 * @returns the lamps
 */
export function activeLamps(): Lamp[] {
  if (!isOn || !LEVEL) return NONE;
  if (builtFor !== LEVEL) {
    builtFor = LEVEL;
    lamps = [
      ...(LEVEL.lamps || []).map((prop) => makeLamp(prop, 'street')),
      ...(PROPS || []).filter((prop) => prop.kind === 'pylon')
        .map((prop) => makeLamp(prop, 'flood')),
    ];
  }
  return lamps;
}

/** Stands every lamp up again, undamaged (RESTART). */
export function resetLamps(): void {
  builtFor = null;
}

/**
 * The lamp a pylon prop is (its painter reads the lean and the light).
 * @param prop the pylon prop
 * @returns the lamp, or null without ?lamps=1
 */
export function lampOfProp(prop: Prop): Lamp | null {
  for (const lamp of activeLamps()) if (lamp.prop === prop) return lamp;
  return null;
}

/**
 * This frame's brightness of every lamp: its level, dipping now and then while it flickers
 * (wall clock: once a frame, before anything draws them).
 */
export function updateLampLight(): void {
  for (const lamp of activeLamps()) {
    if (lamp.down) {
      lamp.shown = 0;
      continue;
    }
    const dips = lamp.flicker > 0 && Math.random() < FLICKER_DIP_CHANCE * lamp.flicker;
    lamp.shown = dips ? lamp.level * FLICKER_DIP : lamp.level;
  }
}
