// menu/settings.ts - THE SETTINGS SCREEN (owner 11-02: "can you set me up both behind an in game
// switch in the settings menu ... maybe this can be the first thing that goes in"; TODO G: sound,
// difficulty and the rest join it later). Opened from the main menu and the pause menu; each
// setting is remembered on the device. STEERING: the two stick settings of core/steerfeel.ts.
import { addPane, addButton, addElement } from './widgets.ts';
import { STEER_FEEL, setSteerFeel, stickReach, curveSteer } from '../core/steerfeel.ts';

// what one menu context needs here (menu.ts builds it)
interface Menu { root: HTMLElement; openedAt: number }
const STICK_PX = 38, LOCK_DEG = 32, SHOW_V = 120 / 3.6;
type FeelKey = keyof typeof STEER_FEEL;

/**
 * The line under the sliders: what the stick does at 120 km/h with the settings now.
 * @returns the text
 */
function previewText(): string {
  const reach = stickReach(STICK_PX, SHOW_V);
  const halfDeg = curveSteer(0.5 * STICK_PX / reach) * LOCK_DEG;
  return `At 120 km/h: full lock takes ${Math.round(reach)} px of thumb (${STICK_PX} at rest); `
    + `${STICK_PX / 2} px gives ${halfDeg.toFixed(1)}° of the ${LOCK_DEG}°`;
}

/**
 * One setting: its name and value, a 0-100 % slider, and a line on what it does.
 * @param panel the pane
 * @param key the setting
 * @param name its name
 * @param help what it does
 * @param onChange called after a change (the preview)
 */
function addFeelSlider(panel: HTMLElement, key: FeelKey, name: string, help: string,
  onChange: () => void): void {
  const row = addElement(panel, 'div', '', 'row') as HTMLElement;
  row.style.alignItems = 'center';
  const label = addElement(row, 'div', '') as HTMLElement;
  label.style.cssText = 'width:132px;font-size:12px';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '10';
  slider.value = String(Math.round(STEER_FEEL[key] * 100));
  slider.style.cssText = 'flex:1;min-height:34px;accent-color:#e8a13a';
  row.appendChild(slider);
  const show = () => {
    const pct = Math.round(STEER_FEEL[key] * 100);
    label.textContent = `${name} ${pct ? pct + '%' : 'OFF'}`;
  };
  slider.addEventListener('input', () => {
    setSteerFeel(key, Number(slider.value) / 100);
    show();
    onChange();
  });
  show();
  (addElement(panel, 'div', help, 'sub') as HTMLElement).style.textAlign = 'left';
}

/**
 * The row of RESUME (pause menu only) and BACK at the foot of a settings screen.
 * @param menu the menu context
 * @param panel the pane
 * @param back reopens the screen before
 * @param resume closes the menu back to the session
 */
function addFootRow(menu: Menu, panel: HTMLElement, back: () => void, resume?: () => void): void {
  const row = addElement(panel, 'div', '', 'row') as HTMLElement;
  if (resume) addButton(menu, row, 'RESUME ▶', resume, 'go');
  addButton(menu, row, 'BACK', back);
}

/**
 * SETTINGS: one button per group (owner 11-02: the steering in a sub-menu "called steering
 * controls"). BACK returns where it was opened from.
 * @param menu the menu context
 * @param back reopens the screen it came from
 * @param resume closes the menu back to the session (pause menu only)
 */
export function showSettings(menu: Menu, back: () => void, resume?: () => void): void {
  const panel = addPane(menu, false) as HTMLElement;
  addElement(panel, 'h2', 'SETTINGS');
  addButton(menu, panel, 'STEERING CONTROLS ›',
    () => showSteering(menu, () => showSettings(menu, back, resume), resume));
  addFootRow(menu, panel, back, resume);
}

/**
 * STEERING CONTROLS: the two touch-stick settings of core/steerfeel.ts and what they do now.
 * @param menu the menu context
 * @param back reopens SETTINGS
 * @param resume closes the menu back to the session (pause menu only)
 */
function showSteering(menu: Menu, back: () => void, resume?: () => void): void {
  const panel = addPane(menu, false) as HTMLElement;
  addElement(panel, 'h2', 'STEERING CONTROLS');
  addElement(panel, 'div', 'the touch stick', 'sub');
  let preview: HTMLElement | null = null;
  const update = () => { if (preview) preview.textContent = previewText(); };
  addFeelSlider(panel, 'curve', 'STEER CURVE', 'Small thumb moves steer gently, the end of the '
    + 'stick is still full lock. The same at every speed.', update);
  addFeelSlider(panel, 'throw', 'STEER AT SPEED', 'The faster you go, the further you push for '
    + 'full lock (up to twice as far at 120 km/h). Full lock is always there.', update);
  preview = addElement(panel, 'div', '', 'sub') as HTMLElement;
  preview.style.cssText = 'text-align:left;color:#e8a13a';
  update();
  addFootRow(menu, panel, back, resume);
}
