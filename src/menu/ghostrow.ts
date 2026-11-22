// menu/ghostrow.ts - the setup's GHOST switch (passed 11-22; owner: always there in TEST MODE's
// setup, off when AI are on, on solo - until the player picks): GHOST ON / OFF, and under it the
// best the ghost would race (game/ghostcar.ts) - "BEST 1:23.45 (BMV E36 PEAK)" - for this track
// and your car. Not on the highways (no ghosts there).
import { ROSTER } from '../cars.ts';
import { fmtTime } from '../hud/widgets.ts';
import { ghostKey, loadGhost } from '../game/ghostcar.ts';
import { addButton, addElement } from './widgets.ts';
import type { Menu } from '../menu.ts';
import type { Level } from '../world/types.ts';
import type { SetupState } from './menutypes.ts';

/**
 * Whether the ghost runs: the player's pick, else on solo and off VS AI.
 * @param state the setup state
 * @returns on
 */
export const ghostOnOf = (state: SetupState) => state.ghost ?? state.opponents === 0;

/**
 * A car's proper name (cars.ts ROSTER), else its id.
 * @param carId the car's id
 * @returns the name
 */
export const carNameOf = (carId: string) => ROSTER.find((car) => car.id === carId)?.name
  ?? carId;

/**
 * The line under the switch: the saved best for this track and car, or that there is none yet.
 * @param level the level
 * @param carId the car's id
 * @returns the line
 */
function bestLine(level: Level, carId: string): string {
  const best = loadGhost(ghostKey(level.id, (level as { ghostDir?: string }).ghostDir, carId));
  return best ? `BEST ${fmtTime(best.time)} (${carNameOf(carId).toUpperCase()})`
    : 'NO BEST YET - A LAP SETS ONE';
}

/**
 * Adds the GHOST row to the setup (not on a highway): a button that turns it on / off,
 * the best under it; the solo / VS AI buttons put it back to their default (state.ghost unset).
 * @param menu the menu context
 * @param panel the setup pane
 * @param level the chosen level
 * @param state the setup state (reads / writes ghost; its paint wrapped)
 */
export function addGhostRow(menu: Menu, panel: HTMLElement, level: Level, state: SetupState) {
  if (level.endless) return;
  const row = addElement(panel, 'div', '', 'row');
  const button = addButton(menu, row, 'GHOST', () => {
    state.ghost = !ghostOnOf(state);
    state.paint();
  });
  button.style.flex = '1';
  const line = addElement(panel, 'div', bestLine(level, menu.profile.active), 'sub');
  const paintBefore = state.paint;
  state.paint = () => {
    paintBefore();
    const isOn = ghostOnOf(state);
    button.textContent = isOn ? 'GHOST: ON' : 'GHOST: OFF';
    button.classList.toggle('on', isOn);
    line.style.display = isOn ? '' : 'none';
  };
  state.paint();
}
