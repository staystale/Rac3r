// menu/pitmenu.ts - THE PIT STOP MENU (?pitstops; owner 11-22: our normal menu style, no mock-up
// banner, only the title PIT STOP a bit bigger; one row each with the owner's icon cut with its
// glow (assets/pit), a bar and a value; then CONFIRM & GO and CANCEL). TYRES keeps the agreed
// choice - keep them, the same again fresh, wets, slicks, the car's other tyres - not the mock-up's
// single REPLACE; REPAIR all or nothing; REFUEL comes with fuel (where a race needs it). FREE in
// test mode.
// The race runs on while it is open (game/pitstop.ts holds the car).
import { addPane, addButton, addElement } from './widgets.ts';
import { hideMenu } from '../menu.ts';
import { MENU_COL } from './palette.ts';
import type { Menu } from '../menu.ts';

/** What the stop shows: tyre wear and damage (0..1), the tyre on, the tyres that fit. */
export interface PitView { wear: number; damage: number; current: string;
  tyres: { id: string; name: string }[] }

/** What was chosen: a tyre to fit (null: keep them) and a repair or not. */
export interface PitPick { tyre: string | null; repair: boolean }

// px: the icons as drawn (their files are twice that), the bars' width and height
const ICON_PX = 48, BAR_W = 120, BAR_H = 8;

/**
 * The tyre choices in the agreed order: keep them, the same again (fresh), wets, slicks, the rest.
 * @param view the stop's view
 * @returns [id or null, label]
 */
function tyreChoices(view: PitView): [string | null, string][] {
  const same = view.tyres.find((tyre) => tyre.id === view.current);
  const wet = view.tyres.find((tyre) => /wet/i.test(tyre.name) && tyre.id !== view.current);
  const slick = view.tyres.find((tyre) => /slick/i.test(tyre.name) && tyre.id !== view.current);
  const listed = new Set([same?.id, wet?.id, slick?.id]);
  return [[null, 'KEEP THESE'], [view.current, 'SAME AGAIN' + (same ? ' (' + same.name + ')' : '')],
    ...(wet ? [[wet.id, 'WETS (' + wet.name + ')'] as [string, string]] : []),
    ...(slick ? [[slick.id, 'SLICKS (' + slick.name + ')'] as [string, string]] : []),
    ...view.tyres.filter((tyre) => !listed.has(tyre.id))
      .map((tyre) => [tyre.id, tyre.name.toUpperCase()] as [string, string])];
}

/**
 * One row: the icon, the name and its value, a bar, and the row's own control under them.
 * @param panel the pane
 * @param row the icon's file, the name, the value (0..1) and its label
 * @param row.icon the icon's file (assets/pit)
 * @param row.name the name
 * @param row.value 0..1
 * @param row.label the value's label
 * @returns the row's control box
 */
function addPitRow(panel: HTMLElement, row: { icon: string; name: string; value: number;
  label: string }): HTMLElement {
  const box = addElement(panel, 'div', '', 'picker');
  const line = addElement(box, 'div', '', 'prow');
  const icon = document.createElement('img');
  icon.src = 'assets/pit/' + row.icon + '.png';
  icon.width = icon.height = ICON_PX;
  icon.style.cssText = 'flex:none;image-rendering:auto';
  line.appendChild(icon);
  const text = addElement(line, 'div', '');
  text.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:4px';
  addElement(text, 'div', row.name + ' &middot; FREE').style.fontSize = '13px';
  addElement(text, 'div', row.label + ': ' + Math.round(row.value * 100) + '%', 'sub');
  const bar = addElement(text, 'div', '');
  bar.style.cssText = `width:${BAR_W}px;height:${BAR_H}px;background:${MENU_COL.well};`
    + 'border:2px solid #000';
  const fill = addElement(bar, 'div', '');
  fill.style.cssText = `height:100%;width:${Math.round(row.value * 100)}%;background:`
    + MENU_COL.accent;
  return addElement(box, 'div', '', 'prow');
}

/**
 * Opens the PIT STOP menu over the race (it runs on); done gets the pick, or null for CANCEL.
 * @param menu the menu context
 * @param view the stop's view
 * @param done called once with the pick
 */
export function showPitMenu(menu: Menu, view: PitView, done: (pick: PitPick | null) => void) {
  menu.root.className = '';
  const panel = addPane(menu, false);
  const title = addElement(panel, 'h2', 'PIT STOP');
  title.style.fontSize = '22px';
  const choices = tyreChoices(view);
  let pick = 0, fix = false;
  const tyreRow = addPitRow(panel, { icon: 'tyre', name: 'TYRES', value: view.wear,
    label: 'WEAR' });
  addButton(menu, tyreRow, '◀', () => { pick = (pick + choices.length - 1) % choices.length;
    paint(); });
  const tyreName = addElement(tyreRow, 'div', '', 'val');
  addButton(menu, tyreRow, '▶', () => { pick = (pick + 1) % choices.length; paint(); });
  const fixRow = addPitRow(panel, { icon: 'repair', name: 'REPAIR', value: view.damage,
    label: 'DAMAGE' });
  const fixButton = addButton(menu, fixRow, 'REPAIR', () => { fix = !fix; paint(); });
  fixButton.style.flex = '1';
  const paint = () => {
    tyreName.textContent = choices[pick][1];
    fixButton.textContent = fix ? 'REPAIR: ALL' : 'REPAIR: NONE';
    fixButton.classList.toggle('on', fix);
  };
  paint();
  addButton(menu, panel, 'CONFIRM &amp; GO ▶', () => {
    hideMenu(menu);
    done({ tyre: choices[pick][0], repair: fix });
  }, 'go');
  addButton(menu, panel, '◀ CANCEL', () => {
    hideMenu(menu);
    done(null);
  });
}
