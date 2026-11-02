// core/fixes.ts - FIXES UNDER TEST: each behind its own ?switch for the owner's phone test. On the
// owner's OK a fix becomes the default, its flag here and the old path are deleted (one system).
// (The 11-01 round - wheelgone, heavywet, menureset, menucar, ainumbers, markage, treenight,
// hwsnow - the driving root fix (wheelspin) and evenlap passed 11-02 and are the game now.)
import { envValue } from './debug.ts';

/**
 * A switch read as this module loads: the circuits are traced as their level modules load,
 * before main.js copies the settings in. The page's ?name=1, or NAME=1 for the node tools.
 * @param name the switch
 * @returns true when on
 */
export function atLoad(name: string): boolean {
  const where = (globalThis as { location?: { search?: string } }).location;
  return new URLSearchParams((where && where.search) || '').get(name) === '1'
    || envValue(name.toUpperCase()) === '1';
}

/**
 * A numeric switch read as this module loads (a test dial): the page's ?name=0.5, or NAME=0.5
 * for the node tools; clamped to 0..1, 0 when absent.
 * @param name the switch
 * @returns the dial, 0..1
 */
export function dialAtLoad(name: string): number {
  const where = (globalThis as { location?: { search?: string } }).location;
  const raw = new URLSearchParams((where && where.search) || '').get(name)
    ?? envValue(name.toUpperCase());
  const value = Number(raw);
  return raw == null || !Number.isFinite(value) ? 0 : Math.min(1, Math.max(0, value));
}

/** The switches under test, all off on the plain link. */
export const FIX = {
  // ?pedalramp=1: throttle full after 1.5 s held (was 0.75), brake after 1.0 s (was 0.25)
  pedalRamp: atLoad('pedalramp'),
  // ?lockfade=1: a locked / spinning tyre grips less the faster it slides (wheelspin.ts)
  lockFade: atLoad('lockfade'),
  // ?spinmarks=1: wheelspin heats tyres like a lock-up; cold slipping tyres still mark (faintly)
  spinMarks: atLoad('spinmarks'),
  // ?smokefade=1: tyre smoke's amount and opacity follow slide speed and tyre heat
  smokeFade: atLoad('smokefade'),
  // ?flatsize=1: a soft / flat tyre keeps its size (a pixel of bulge), still lumps and wobbles
  flatSize: atLoad('flatsize'),
  // ?muscle6=1: the muscle car on a 6-speed (was 4: its top gear capped it at 205 km/h)
  muscle6: atLoad('muscle6'),
};
