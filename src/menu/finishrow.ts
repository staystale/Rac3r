// menu/finishrow.ts - THE HIGHWAY'S FINISH in the setup (?hwfinish=1; owner 11-09: "we should
// allow highway levels to have a distance or timer to end it… or infinit / It should be an option
// in the menu", "Timer or distance - or get away"): ENDLESS, then the distances on one row and the
// times on the next, and a line saying what the choice means solo or VS AI. Remembered.
import { FIX } from '../core/fixes.ts';
import { HW_FINISHES, finishOf } from '../highway/finish.ts';
import { saveProfile } from './profile.ts';
import { addButton, addElement } from './widgets.ts';
import type { Menu } from '../menu.ts';
import type { Level } from '../world/types.ts';
import type { SetupState } from './menutypes.ts';

/**
 * What a finish means, solo or VS AI.
 * @param code the finish's code
 * @param vsAi true racing AI
 * @returns the line under the buttons
 */
function finishNote(code: string, vsAi: boolean): string {
  const finish = finishOf(code), choice = HW_FINISHES.find((entry) => entry.code === code);
  if (!finish) return vsAi ? 'NO FINISH: THE RACE ENDS WHEN SOMEONE GETS AWAY'
    : 'NO FINISH: DRIVE AS FAR AS YOU LIKE';
  if (finish.m) return vsAi ? 'FIRST TO ' + choice!.label + ' WINS · OR GET AWAY FIRST'
    : 'ROLLING START · THE CLOCK RUNS TO THE ' + choice!.label + ' LINE';
  return vsAi ? 'FURTHEST IN ' + choice!.label + ' WINS · OR GET AWAY FIRST'
    : 'ROLLING START · HOW FAR CAN YOU GET IN ' + choice!.label;
}

/**
 * Adds the FINISH rows of an endless level (?hwfinish=1). Wraps state.paint so the line follows
 * SOLO / VS AI.
 * @param menu the menu context
 * @param panel the setup pane
 * @param level the chosen level
 * @param state the setup state (reads opponents; reads / writes finish, paint)
 */
export function addFinishRows(menu: Menu, panel: HTMLElement, level: Level, state: SetupState) {
  if (!level.endless || !FIX.hwfinish) return;
  const profile = menu.profile as { hwFinish?: string };
  state.finish = state.finish ?? (finishOf(profile.hwFinish) ? profile.hwFinish! : 'endless');
  addElement(panel, 'div', 'FINISH', 'sub');
  const rows = [addElement(panel, 'div', '', 'row'), addElement(panel, 'div', '', 'row')];
  const note = addElement(panel, 'div', '', 'sub');
  const paint = () => {
    buttons.forEach((button, i) => button.classList.toggle('on',
      HW_FINISHES[i].code === state.finish));
    note.textContent = finishNote(state.finish!, state.opponents > 0);
  };
  // (ENDLESS and the distances on the first row, the times on the second)
  const buttons = HW_FINISHES.map((choice) => addButton(menu, rows[choice.finish?.t ? 1 : 0],
    choice.label, () => {
      state.finish = choice.code;
      profile.hwFinish = choice.code;
      saveProfile(menu.profile);
      paint();
    }));
  const paint0 = state.paint;
  state.paint = () => {
    paint0();
    paint();
  };
  paint();
}
