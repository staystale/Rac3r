import { LEVELS } from '../world/levels/index.ts';
import { ROSTER } from '../cars.ts';

const KEY = 'carsim.profile.v1';

/** A car's paint, trim and race number (cars.ts applyLivery). */
export interface Livery { paint?: string; trim?: string; num?: number }

/** The player profile, as saved on the device. */
export interface Profile {
  unlocked: string[];   // car ids the player may drive (every car while testing)
  active: string;   // the car picked
  lastLevel: string;   // the track last chosen
  lastCat?: string;   // the track category last opened (menu/tracks)
  tyres?: Record<string, string>;   // the tyre fitted per car id (cars.ts TYRES)
  tyreWear?: Record<string, number[]>;   // that set's wear per car, FL FR RL RR, 0..1
  livery?: Record<string, Livery>;   // paint shop choices per car
  aiCars?: string;   // setup: AI cars of the same model or the class
  traffic?: number;   // setup: endless traffic density
  litter?: number;   // setup: endless roadside litter density
  weather?: Record<string, unknown>;   // setup: the weather picks
  gen?: { theme: string; len: string; style: string; seed: number };   // the last generated stage
}

// PLAYER PROFILE (spec §5): unlocked cars, active car, last track. Every car is SEEDED unlocked for
// testing (spec: "ensure all existing vehicle IDs are seeded on boot"). localStorage can throw in
// private windows: guarded, and the game still works with the in-memory default.
/**
 * The saved profile, with every car unlocked and a valid car and track.
 * @returns the profile
 */
export function loadProfile(): Profile {
  let saved: Partial<Profile> | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<Profile> | null;
  } catch { /* no storage */ }
  const profile = (saved || {}) as Profile;
  profile.unlocked = [...new Set([...(profile.unlocked || []), ...ROSTER.map((car) => car.id)])];
  profile.active = ROSTER.some((car) => car.id === profile.active) ? profile.active : 'hatch-rwd';
  profile.lastLevel = LEVELS.some((entry) => entry.id === profile.lastLevel) ? profile.lastLevel
    : 'test-track';
  return profile;
}

/**
 * Saves the profile on the device (quietly nothing in a private window).
 * @param profile the profile
 */
export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch { /* fine */ }
}
