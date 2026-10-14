import { LEVELS } from '../world/levels/index.ts';
import { ROSTER } from '../cars.ts';

const KEY = 'carsim.profile.v1';
// PLAYER PROFILE (spec §5): unlocked cars, active car, last track. Every car is SEEDED unlocked for
// testing (spec: "ensure all existing vehicle IDs are seeded on boot"). localStorage can throw in
// private windows: guarded, and the game still works with the in-memory default.
export function loadProfile() {
  let profile = null;
  try {
    profile = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch { /* no storage */ }
  profile = profile || {};
  profile.unlocked = [...new Set([...(profile.unlocked || []), ...ROSTER.map((car) => car.id)])];
  profile.active = ROSTER.some((car) => car.id === profile.active) ? profile.active : 'hatch-rwd';
  profile.lastLevel = LEVELS.some((entry) => entry.id === profile.lastLevel) ? profile.lastLevel
    : 'test-track';
  return profile;
}
export function saveProfile(profile) {
  try {
  localStorage.setItem(KEY, JSON.stringify(profile));
} catch { /* fine */ }
}
