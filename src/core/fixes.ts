// core/fixes.ts - FIXES UNDER TEST: each behind its own ?switch for the owner's phone test. On the
// owner's OK a fix becomes the default, its flag here and the old path are deleted (one system).
// (The 11-01 round - wheelgone, heavywet, menureset, menucar, ainumbers, markage, treenight,
// hwsnow - passed 11-02 and is the game now.)
import { envValue } from './debug.ts';

/**
 * A switch read as this module loads: the circuits are traced as their level modules load,
 * before main.js copies the settings in. The page's ?name=1, or NAME=1 for the node tools.
 * @param name the switch
 * @returns true when on
 */
function atLoad(name: string): boolean {
  const where = (globalThis as { location?: { search?: string } }).location;
  return new URLSearchParams((where && where.search) || '').get(name) === '1'
    || envValue(name.toUpperCase()) === '1';
}

/** The switches under test, all off on the plain link. */
export const FIX = {
  // ?evenlap=1: the traced circuits evenly spaced round the whole lap, short kinks smoothed (K3)
  evenLap: atLoad('evenlap'),
  wheelSpin: atLoad('wheelspin'),   // ?wheelspin=1: wheel speed as real state, real ABS (root fix)
};
