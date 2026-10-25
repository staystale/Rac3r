// The LAMPS: street lights and floodlight pylons (the level's `pylon`
// props and world/lampplan.ts's plan; the endless highway's streamed by highway/roadlamps.ts)
// as solid posts that light a pool below their head from dusk
// and go off in the light, as real ones do. Every car is clamped against their posts
// (world/barriers.ts solidClamp) and a hit leans, dims or snaps them (world/lampdamage.ts); the
// night layer (render/light.ts) draws their pools; render/props/lamps.ts the street lights,
// buildings.ts the pylons. RESTART stands them all up again (resetLamps).
import { LEVEL, PROPS } from './state.ts';
import { DAYLIGHT } from './daylight.ts';
import { planLamps } from './lampplan.ts';
import type { CarBody, Level, Prop, Solid } from './types.ts';

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
// SETTLING (owner: a knocked light flickers, then by chance recovers or dies): it settles
// SETTLE_MIN_MS..SETTLE_MAX_MS after its last knock, dying by DIE_BASE plus DIE_PER_LOSS of the
// light the knocks took (a nudge alone: 15 %; a lamp knocked half dark: 50 %)
const SETTLE_MIN_MS = 3000, SETTLE_MAX_MS = 8000, DIE_BASE = 0.15, DIE_PER_LOSS = 0.7;

/** One lamp: where its post stands, where its light hangs, its pool, its solid, its damage. */
export interface Lamp {
  kind: 'street' | 'flood';
  x: number;        // the post's foot, m
  y: number;
  headX: number;    // where the light hangs (a street light's arm reaches over the road), m
  headY: number;
  rot: number;      // the arm's direction (a pylon: the way it faces), radians
  armM: number;     // how far out the light hangs: a street light's arm (a pylon: 0), m
  poolM: number;    // the pool's radius, m
  level: number;    // how bright it can be, 0..1 (hard hits take it down)
  shown: number;    // how bright it is this frame (level, dipping when it flickers)
  flicker: number;  // how much it flickers, 0..1 (a nudge starts it)
  settleAt: number; // wall clock, ms, when its flicker settles (0: not timed yet)
  leanX: number;    // the lean, radians, toward +x / +y (a nudge wonks the post)
  leanY: number;
  down: boolean;    // snapped: lying along (fallX, fallY), no light, no solid
  fallX: number;
  fallY: number;
  solidity: number; // a fallen post: how much it still resists a car, 1 -> flat
  mangle: number;   // a fallen post: how many times it has been driven over
  touching: CarBody | null;   // the car on a fallen post now (one pass = one hit)
  prop: Prop | null;          // a pylon's prop or plan entry (its painter reads the lamp)
  ownDraw: boolean;           // a planned pylon: drawn with the lamps (the level's are props)
  solid: Solid;
}

let builtFor: object | null = null;
let lamps: Lamp[] = [];
const NONE: Lamp[] = [], NO_ENTRIES: Prop[] = [];
// the endless road's streamed entries the lamps were last made from (their list, its length and
// its two ends), and the lamp each entry is
let streamedFrom: Prop[] | null = null, streamedCount = -1;
let streamedFirst: Prop | null = null, streamedLast: Prop | null = null;
let lampOfEntry = new WeakMap<Prop, Lamp>();

/**
 * Whether the lamps are lit in this light.
 * @returns true from dusk on
 */
export function lampsLit(): boolean {
  return DAYLIGHT.darkness >= LAMPS_ON_DARKNESS;
}

/**
 * Puts a lamp's light where its lean takes it: the top of a leaning post moves by its height
 * times the lean, and a street light's arm reaches on from there.
 * @param lamp the lamp (headX, headY are set)
 */
export function placeHead(lamp: Lamp): void {
  const height = lamp.kind === 'street' ? STREET_HEIGHT_M : FLOOD_HEIGHT_M;
  lamp.headX = lamp.x + lamp.leanX * height + Math.cos(lamp.rot) * lamp.armM;
  lamp.headY = lamp.y + lamp.leanY * height + Math.sin(lamp.rot) * lamp.armM;
}

/**
 * A lamp from a street light or pylon entry.
 * @param prop the level entry (x, y the foot; rot the arm's direction)
 * @param kind street or flood
 * @returns the lamp
 */
function makeLamp(prop: Prop, kind: Lamp['kind'], ownDraw = false): Lamp {
  const rot = prop.rot || 0;
  const post = kind === 'street' ? STREET_POST_M : FLOOD_BASE_M;
  const lamp: Lamp = {
    kind, x: prop.x, y: prop.y, rot, headX: prop.x, headY: prop.y,
    // the light is where the lamp's body is (owner): at the end of a street light's arm, on the
    // pylon itself
    armM: kind === 'street' ? STREET_ARM_M : 0,
    poolM: kind === 'street' ? STREET_POOL_M : FLOOD_POOL_M, level: 1, shown: 1, flicker: 0,
    settleAt: 0,
    leanX: 0, leanY: 0, down: false, fallX: 1, fallY: 0, solidity: 1, mangle: 0,
    touching: null, prop: kind === 'flood' ? prop : null, ownDraw,
    solid: { x: prop.x, y: prop.y, w: post, h: post, rot, kind: 'lamp',
      r: Math.hypot(post, post) / 2 },
  };
  placeHead(lamp);
  return lamp;
}

/**
 * The active level's lamps, built the first time a level asks.
 * @returns the lamps
 */
export function activeLamps(): Lamp[] {
  if (!LEVEL) return NONE;
  if (LEVEL.endless) return streamedLamps(LEVEL);
  if (builtFor !== LEVEL) {
    builtFor = LEVEL;
    // the level's own pylons, then the plan (world/lampplan.ts: by the level's kind)
    lamps = [
      ...(PROPS || []).filter((prop) => prop.kind === 'pylon')
        .map((prop) => makeLamp(prop, 'flood')),
      ...planLamps(LEVEL).map((entry) => entry.kind === 'floodlight'
        ? makeLamp(entry, 'flood', true) : makeLamp(entry, 'street')),
    ];
  }
  return lamps;
}

/**
 * The endless road's lamps: its streamed street lights (LEVEL.lamps, laid as the road grows by
 * highway/roadlamps.ts and dropped behind with it). Each entry stays the same lamp, damage and
 * all, while it is loaded; a new list is made only when entries came or went (the road's
 * window moves at the front and the back).
 * @param level the endless level
 * @returns the lamps
 */
function streamedLamps(level: Level): Lamp[] {
  const entries = level.lamps || NO_ENTRIES;
  const first = entries[0] || null, last = entries[entries.length - 1] || null;
  if (builtFor === level && streamedFrom === entries && streamedCount === entries.length
    && streamedFirst === first && streamedLast === last) return lamps;
  builtFor = level;
  streamedFrom = entries;
  streamedCount = entries.length;
  streamedFirst = first;
  streamedLast = last;
  lamps = entries.map((entry) => {
    let lamp = lampOfEntry.get(entry);
    if (!lamp) {
      lamp = makeLamp(entry, 'street');
      lampOfEntry.set(entry, lamp);
    }
    return lamp;
  });
  return lamps;
}

/** Stands every lamp up again, undamaged (RESTART). */
export function resetLamps(): void {
  builtFor = null;
  lampOfEntry = new WeakMap();
}

/**
 * The lamp a pylon prop is (its painter reads the lean and the light).
 * @param prop the pylon prop
 * @returns the lamp, or null
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
  const now = performance.now();
  for (const lamp of activeLamps()) {
    if (lamp.down) {
      lamp.shown = 0;
      continue;
    }
    if (lamp.flicker > 0) settleLamp(lamp, now);
    const dips = lamp.flicker > 0 && Math.random() < FLICKER_DIP_CHANCE * lamp.flicker;
    lamp.shown = dips ? lamp.level * FLICKER_DIP : lamp.level;
  }
}

/**
 * A flickering lamp settles a few seconds after its last knock: it holds steady at what light it
 * has left, or dies (likelier the more light the knocks took). Wall clock: it is only a look.
 * @param lamp the flickering lamp
 * @param now the wall clock, ms
 */
function settleLamp(lamp: Lamp, now: number): void {
  if (!lamp.settleAt) {
    lamp.settleAt = now + SETTLE_MIN_MS + Math.random() * (SETTLE_MAX_MS - SETTLE_MIN_MS);
    return;
  }
  if (now < lamp.settleAt) return;
  lamp.flicker = 0;
  lamp.settleAt = 0;
  if (Math.random() < DIE_BASE + DIE_PER_LOSS * (1 - lamp.level)) lamp.level = 0;
}
