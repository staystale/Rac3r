// menu/aidrivers.ts - the AI DRIVERS panel of the test setup (?aisliders, the AI rework R3 + K15;
// the owner's OK'd mockup 11-04, tools/scratch/_aimock.mjs): the five difficulties as presets
// (CUSTOM once a dial moves), the six field dials (ai/tune.ts), a strip of the field's skill (a
// mark a driver: red a rookie, blue a pro), RESET to the difficulty, BACK to the setup.
import { addPane, addButton, addElement } from './widgets.ts';
import { MENU_COL } from './palette.ts';
import { aiTraits } from '../ai/traits.ts';
import { tuneOf, TUNE_DIALS, dialWords } from '../ai/tune.ts';
import type { AiTune } from '../ai/tune.ts';
import type { Menu } from '../menu.ts';

// the presets' names (setup.ts DIFF)
const PRESETS = ['MOBILE', 'GAME', 'REALISH', 'RICH', 'REAL'];
// the strip's colours: under ROOKIE a rookie, over PRO a pro
const ROOKIE = 0.45, PRO = 0.75;
// the seed the strip deals its field from (the race deals its own)
const STRIP_SEED = 7;
// where the dials are remembered
const STORE = 'carsim.aitune';

/**
 * The dials remembered from the last setup, if any.
 * @returns the dials, or null
 */
export function storedTune(): AiTune | null {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? JSON.parse(raw) as AiTune : null;
  } catch { return null; }
}

/**
 * Remembers the dials (null forgets them: the difficulty's preset).
 * @param tune the dials
 */
export function storeTune(tune: AiTune | null): void {
  try {
    if (tune) localStorage.setItem(STORE, JSON.stringify(tune));
    else localStorage.removeItem(STORE);
  } catch { /* fine: not kept */ }
}

/**
 * The setup's line under the AI DRIVERS button.
 * @param diff the difficulty
 * @param tune the dials, or null (the preset)
 * @returns the line
 */
export function tuneLine(diff: number, tune: AiTune | null): string {
  const dials = tune || tuneOf(diff);
  return (tune && tune.custom ? 'CUSTOM' : 'FROM ' + PRESETS[diff]) + ' · SKILL '
    + dials.skill.toFixed(2) + ' · RISK ' + dials.risk.toFixed(2);
}

/**
 * Draws the field's skill strip: one mark a driver.
 * @param strip the strip element
 * @param caption its caption
 * @param diff the difficulty
 * @param tune the dials
 * @param count the field's size
 */
function paintStrip(strip: HTMLElement, caption: HTMLElement, diff: number, tune: AiTune,
  count: number) {
  strip.innerHTML = '';
  const skills = [];
  for (let i = 0; i < count; i++) skills.push(aiTraits(diff, i, count, STRIP_SEED, tune).skill);
  for (const skill of skills) {
    const mark = document.createElement('div');
    mark.style.cssText = `position:absolute;left:calc((100% - 6px) * ${skill.toFixed(3)});top:5px;`
      + `width:6px;height:16px;background:${skill > PRO ? MENU_COL.good : skill < ROOKIE
        ? MENU_COL.bad : MENU_COL.fg}`;
    strip.appendChild(mark);
  }
  caption.textContent = `THE FIELD: ${count} DRIVERS, SKILL ${Math.min(...skills).toFixed(2)} - `
    + `${Math.max(...skills).toFixed(2)} (RED ROOKIES, BLUE PROS)`;
}

/**
 * Shows the AI DRIVERS panel.
 * @param menu the menu context
 * @param start the difficulty and the dials to start from (null dials: the preset), the field
 * @param back back to the setup with the difficulty and the dials picked (null: the preset)
 */
export function showAiDrivers(menu: Menu, start: { diff: number; tune: AiTune | null;
  count: number }, back: (diff: number, tune: AiTune | null) => void) {
  const panel = addPane(menu, false);
  let diff = start.diff, tune: AiTune = { ...(start.tune || tuneOf(diff)) };
  addElement(panel, 'h1', 'AI DRIVERS');
  addElement(panel, 'div', 'STARTS FROM THE DIFFICULTY. A SLIDER MOVES THE WHOLE FIELD - EACH '
    + 'DRIVER KEEPS ITS OWN PLACE IN IT, SO A BETTER DRIVER STAYS BETTER.', 'sub');
  const presetRow = addElement(panel, 'div', '', 'row');
  const presets = PRESETS.map((name, i) => addButton(menu, presetRow, name, () => {
    diff = i;
    tune = tuneOf(i);
    paint();
  }));
  const customBtn = addButton(menu, presetRow, 'CUSTOM', () => { /* shows the state only */ });
  const inputs: HTMLInputElement[] = [], labels: HTMLElement[] = [];
  let strip: HTMLElement | null = null, caption: HTMLElement | null = null;
  for (const [key, , note] of TUNE_DIALS) {
    const row = addElement(panel, 'div', '', 'row');
    row.style.alignItems = 'center';
    const label = addElement(row, 'div', '');
    label.style.cssText = 'width:150px;font-size:12px';
    const input = document.createElement('input');
    input.type = 'range'; input.min = '0'; input.max = '1'; input.step = '0.01';
    input.style.cssText = 'flex:1;min-height:34px;accent-color:' + MENU_COL.accent;
    input.addEventListener('input', () => {
      tune = { ...tune, [key]: +input.value, custom: true };
      paint();
    });
    row.appendChild(input);
    inputs.push(input); labels.push(label);
    addElement(panel, 'div', note, 'sub');
    if (key === 'spread') {
      strip = addElement(panel, 'div', '');
      strip.style.cssText = 'position:relative;display:block;box-sizing:border-box;width:100%;'
        + 'height:26px;min-height:26px;flex:0 0 26px;margin:6px 0 8px;background:'
        + MENU_COL.well + ';box-shadow:inset 0 0 0 2px #3a2018';
      caption = addElement(panel, 'div', '', 'sub');
    }
  }
  const resetRow = addElement(panel, 'div', '', 'row');
  const resetBtn = addButton(menu, resetRow, '', () => {
    tune = tuneOf(diff);
    paint();
  });
  resetBtn.style.flex = '1';
  const backBtn = addButton(menu, panel, '◀ BACK', () => back(diff, tune.custom ? tune : null));
  backBtn.style.width = '100%';
  function paint() {
    presets.forEach((button, i) => button.classList.toggle('on', !tune.custom && i === diff));
    customBtn.classList.toggle('on', !!tune.custom);
    TUNE_DIALS.forEach(([key, name], i) => {
      inputs[i].value = String(tune[key]);
      labels[i].innerHTML = name + '<br>' + dialWords(key, tune[key]);
    });
    if (strip && caption) paintStrip(strip, caption, diff, tune, start.count);
    resetBtn.textContent = 'RESET TO ' + PRESETS[diff];
  }
  paint();
}
