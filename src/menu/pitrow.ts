// menu/pitrow.ts - the setup's PIT STOPS switch (?pitstops; owner 11-15: "test mode: a PIT STOPS
// on/off option"), on a level with a pit lane: ON by the rules - an F1 / GT / endurance-type race
// (a single-seater, a GT or a prototype) of more than 3 laps on a circuit over ~2 km - else OFF,
// until the player picks.
import { FIX } from '../core/fixes.ts';
import { ROSTER } from '../cars.ts';
import { addButton, addElement } from './widgets.ts';
import type { Menu } from '../menu.ts';
import type { Level } from '../world/types.ts';
import type { PitLevel } from '../world/pitlane.ts';
import type { SetupState } from './menutypes.ts';

// the car classes that race with pit stops, the most laps of a sprint, the shortest lap (m)
const PIT_CLASSES = ['single', 'gt', 'proto'], SPRINT_LAPS = 3, SHORT_LAP_M = 2000;

/**
 * Whether the race has pit stops: the player's pick, else the rules.
 * @param state the setup state
 * @param level the level
 * @param carId the player's car
 * @returns on
 */
export function pitsOnOf(state: SetupState, level: Level, carId: string): boolean {
  if (!FIX.pitstops || !(level as PitLevel).pits) return false;
  if (state.pits !== undefined) return state.pits;
  const cls = ROSTER.find((row) => row.id === carId)?.cls || '';
  return PIT_CLASSES.includes(cls) && state.opponents > 0 && state.laps > SPRINT_LAPS
    && (level.subtrack?.totalDist || 0) > SHORT_LAP_M && !level.stage && !level.joker;
}

/**
 * Adds the PIT STOPS row to the setup (with ?pitstops, on a level with a pit lane); its paint
 * wrapped so it follows the laps and the solo / VS AI rows until picked.
 * @param menu the menu context
 * @param panel the setup pane
 * @param level the chosen level
 * @param state the setup state (reads / writes pits)
 */
export function addPitRow(menu: Menu, panel: HTMLElement, level: Level, state: SetupState) {
  if (!FIX.pitstops || !(level as PitLevel).pits) return;
  const row = addElement(panel, 'div', '', 'row');
  const button = addButton(menu, row, 'PIT STOPS', () => {
    state.pits = !pitsOnOf(state, level, menu.profile.active);
    state.paint();
  });
  button.style.flex = '1';
  const paintBefore = state.paint;
  state.paint = () => {
    paintBefore();
    const isOn = pitsOnOf(state, level, menu.profile.active);
    button.textContent = isOn ? 'PIT STOPS: ON' : 'PIT STOPS: OFF';
    button.classList.toggle('on', isOn);
  };
  state.paint();
}
