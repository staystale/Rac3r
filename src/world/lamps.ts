// The LAMPS (?lamps=1): street lights (the level's `lamps` data) and floodlight pylons (the
// `pylon` props) as solid posts that light a pool below their head from dusk and go off in the
// light, as real ones do. Every car is clamped against their posts (world/barriers.ts
// solidClamp); the night layer (render/light.ts) draws their pools; render/props/lamps.ts the
// lamps themselves.
import { LEVEL, PROPS } from './state.ts';
import { DAYLIGHT } from './daylight.ts';
import type { Prop, Solid } from './types.ts';

// darkness at and above which the lamps are on (a light sensor: a little before the cars' lights)
export const LAMPS_ON_DARKNESS = 0.3;
// a street light: how far its arm reaches out over the road and the radius of its pool, m
const STREET_ARM_M = 2.4, STREET_POOL_M = 15;
// a street light's post, m square (a steel column ~0.25 m, padded for the wheel arches)
const STREET_POST_M = 0.36;
// a floodlight pylon: its pool radius and its concrete base, m
const FLOOD_POOL_M = 34, FLOOD_BASE_M = 1.6;

/** One lamp: where its post stands, where its light hangs, its pool and its solid. */
export interface Lamp {
  kind: 'street' | 'flood';
  x: number;        // the post's foot, m
  y: number;
  headX: number;    // where the light hangs (a street light's arm reaches over the road), m
  headY: number;
  rot: number;      // the arm's direction, radians
  poolM: number;    // the pool's radius, m
  level: number;    // how bright it can be, 0..1
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
 * A lamp from a street light or pylon entry.
 * @param prop the level entry (x, y the foot; rot the arm's direction)
 * @param kind street or flood
 * @returns the lamp
 */
function makeLamp(prop: Prop, kind: Lamp['kind']): Lamp {
  const rot = prop.rot || 0, arm = kind === 'street' ? STREET_ARM_M : 0;
  const post = kind === 'street' ? STREET_POST_M : FLOOD_BASE_M;
  return {
    kind, x: prop.x, y: prop.y, rot,
    headX: prop.x + Math.cos(rot) * arm, headY: prop.y + Math.sin(rot) * arm,
    poolM: kind === 'street' ? STREET_POOL_M : FLOOD_POOL_M, level: 1,
    solid: { x: prop.x, y: prop.y, w: post, h: post, rot, kind: 'lamp',
      r: Math.hypot(post, post) / 2 },
  };
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
