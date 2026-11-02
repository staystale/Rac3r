// core/fixes.ts - THE 11-01 BUG ROUND (owner list, TODO.md K1-K10): each fix behind its own
// ?switch for the owner's phone test (main.js sets them from core/settings.ts). On the owner's OK
// a fix becomes the default, its flag here and the old path are deleted (one system).
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

/** The bug round's switches, all off on the plain link. */
export const FIX = {
  wheelGone: false,   // ?wheelgone=1: a lost wheel's tyre takes nothing more (K7)
  heavyWet: false,    // ?heavywet=1: wet trails only in a puddle or heavy rain (K1)
  menuReset: false,   // ?menureset=1: the menu race's camera car resets for damage (K2)
  menuCar: false,     // ?menucar=1: the menu race follows the player's garage car (K8)
  aiNumbers: false,   // ?ainumbers=1: AI race numbers random and painted on (K9 / K10)
  markAge: false,     // ?markage=1: tyre marks fade oldest first, in small cells (K4)
  treeNight: false,   // ?treenight=1: no pale rim round tree canopies at night (K5)
  hwSnow: false,      // ?hwsnow=1: highway rebuilds keep tracks in weather snow / water (K6)
  // ?evenlap=1: the traced circuits evenly spaced round the whole lap, short kinks smoothed (K3)
  evenLap: atLoad('evenlap'),
};
