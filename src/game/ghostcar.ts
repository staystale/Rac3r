// game/ghostcar.ts - GHOST CARS, the tape (?ghost; owner 11-22: test mode only, every track but the
// highways, any lap the quickest - lap 1 and laps with a reset too - one best per track, its
// layout / direction and the CAR). A lap or a stage run is recorded as the player car's place and
// heading GHOST_HZ times a second of its own clock (the lap's or the stage's), and played back on
// the same clock, the two samples round it blended. Saved per key on the device (localStorage, at
// the safe moments only: game/session.ts saveRecords), at most GHOST_MAX of them, the oldest
// dropped. Nothing here touches the world: the ghost is only drawn (game/ghostrun.ts).

/** One recorded lap or run: its car, its time (s) and its samples (m, m, rad). */
export interface GhostTape { car: string; time: number; xs: number[]; ys: number[]; hs: number[];
  last?: { clock: number; pose: GhostPose } }   // the step recorded last (recordTape)

/** A saved best as the accolades list it. */
export interface GhostEntry { key: string; track: string; car: string; time: number; at: number }

/** A place and heading. */
export interface GhostPose { x: number; y: number; h: number }

// samples a second of the tape's own clock (the sim steps at 120 a second: every 6th)
export const GHOST_HZ = 20;
// the most bests kept on the device (a 90 s lap ~18 KB stored)
const GHOST_MAX = 40;
// the storage keys: one per best, and the list of them
const KEY_PREFIX = 'rac3r.ghost.', INDEX_KEY = 'rac3r.ghosts';
// stored units: cm for places, 1e-4 rad for headings (an int16 holds -pi .. pi)
const CM_PER_M = 100, HEAD_UNIT = 1e4;

/**
 * A new, empty tape.
 * @param car the car's id
 * @returns the tape
 */
export const newTape = (car: string): GhostTape => ({ car, time: 0, xs: [], ys: [], hs: [] });

/**
 * Records the car into the tape up to its clock: a sample at each GHOST_HZ tick the clock has
 * passed since the last step, its place blended between that step's and this one's (sampled at
 * the step after the tick the ghost ran up to a step - 0.4 m at 180 km/h - ahead of the car).
 * @param tape the tape
 * @param clock the tape's clock, s
 * @param pose the car's place and heading now
 */
export function recordTape(tape: GhostTape, clock: number, pose: GhostPose): void {
  const from = tape.last ?? { clock, pose };
  while (tape.xs.length <= clock * GHOST_HZ) {
    const tick = tape.xs.length / GHOST_HZ, span = clock - from.clock;
    const share = span > 0 ? Math.max(0, Math.min(1, (tick - from.clock) / span)) : 1;
    let turn = pose.h - from.pose.h;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    tape.xs.push(from.pose.x + (pose.x - from.pose.x) * share);
    tape.ys.push(from.pose.y + (pose.y - from.pose.y) * share);
    tape.hs.push(from.pose.h + turn * share);
  }
  tape.last = { clock, pose: { ...pose } };
}

/**
 * The tape's place at a time of its clock: the two samples round it blended (the heading the
 * short way round); the last sample past its end; null before it starts or with no samples.
 * @param tape the tape
 * @param clock s
 * @returns the pose
 */
export function poseAt(tape: GhostTape | null, clock: number): GhostPose | null {
  if (!tape || !tape.xs.length || !(clock >= 0)) return null;
  const ticks = clock * GHOST_HZ, last = tape.xs.length - 1;
  const i = Math.min(last, Math.floor(ticks)), next = Math.min(last, i + 1);
  const share = ticks >= last ? 0 : ticks - i;
  let turn = tape.hs[next] - tape.hs[i];
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  return { x: tape.xs[i] + (tape.xs[next] - tape.xs[i]) * share,
    y: tape.ys[i] + (tape.ys[next] - tape.ys[i]) * share, h: tape.hs[i] + turn * share };
}

/**
 * A tape as text: its car, time and samples packed (int32 cm places, int16 headings) in base64.
 * @param tape the tape
 * @returns the text
 */
export function encodeTape(tape: GhostTape): string {
  const count = tape.xs.length, bytes = new DataView(new ArrayBuffer(count * 10));
  for (let i = 0; i < count; i++) {
    bytes.setInt32(i * 10, Math.round(tape.xs[i] * CM_PER_M), true);
    bytes.setInt32(i * 10 + 4, Math.round(tape.ys[i] * CM_PER_M), true);
    let heading = Math.atan2(Math.sin(tape.hs[i]), Math.cos(tape.hs[i]));
    heading = Math.max(-32767, Math.min(32767, Math.round(heading * HEAD_UNIT)));
    bytes.setInt16(i * 10 + 8, heading, true);
  }
  let raw = '';
  const view = new Uint8Array(bytes.buffer);
  for (let i = 0; i < view.length; i++) raw += String.fromCharCode(view[i]);
  return JSON.stringify({ v: 1, car: tape.car, time: tape.time, hz: GHOST_HZ, d: btoa(raw) });
}

/**
 * A tape from its text (encodeTape), or null when it is not one.
 * @param text the text
 * @returns the tape
 */
export function decodeTape(text: string | null): GhostTape | null {
  try {
    const saved = JSON.parse(text || 'null') as { v: number; car: string; time: number;
      hz: number; d: string } | null;
    if (!saved || saved.v !== 1 || saved.hz !== GHOST_HZ) return null;
    const raw = atob(saved.d), view = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
    const bytes = new DataView(view.buffer), tape = newTape(saved.car);
    tape.time = saved.time;
    for (let i = 0; i + 10 <= view.length; i += 10) {
      tape.xs.push(bytes.getInt32(i, true) / CM_PER_M);
      tape.ys.push(bytes.getInt32(i + 4, true) / CM_PER_M);
      tape.hs.push(bytes.getInt16(i + 8, true) / HEAD_UNIT);
    }
    return tape;
  } catch {
    return null;
  }
}

/**
 * The key of a best: the track (its layout), its direction (a hill climb's: up / down) and the car.
 * @param track the level's id
 * @param direction the level's direction id, if it has one
 * @param car the car's id
 * @returns the key
 */
export const ghostKey = (track: string, direction: string | undefined, car: string) =>
  [track, direction || '', car].join('|');

/**
 * The saved bests, as the accolades list them (the newest first).
 * @returns the entries
 */
export function listGhosts(): GhostEntry[] {
  try {
    const list = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]') as GhostEntry[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * The saved best for a key, or null.
 * @param key the key (ghostKey)
 * @returns the tape
 */
export function loadGhost(key: string): GhostTape | null {
  try {
    return decodeTape(localStorage.getItem(KEY_PREFIX + key));
  } catch {
    return null;
  }
}

/**
 * Saves a best (quietly nothing without storage), listed for the accolades; past GHOST_MAX the
 * oldest is dropped.
 * @param key the key (ghostKey)
 * @param tape the tape
 * @param track the track's name for the list
 */
export function saveGhost(key: string, tape: GhostTape, track: string): void {
  try {
    localStorage.setItem(KEY_PREFIX + key, encodeTape(tape));
    const list = listGhosts().filter((entry) => entry.key !== key);
    list.unshift({ key, track, car: tape.car, time: tape.time, at: Date.now() });
    for (const old of list.splice(GHOST_MAX)) localStorage.removeItem(KEY_PREFIX + old.key);
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch { /* private mode or full: fine */ }
}
