// menu/accolades.ts - SETTINGS > ACCOLADES (?ghost; owner 11-22: "make it neat, keep it in one,
// with our theme"): one screen, two parts in the menu's own boxes. TROPHIES - the Story's, from the
// profile (Profile.trophies: Story adds them when it is built; until then one line says how they
// are won). FASTEST LAPS (TEST MODE) - the ghosts' saved bests (game/ghostcar.ts), per track (and
// its direction), each car by its proper name with its time.
import { addPane, addButton, addElement } from './widgets.ts';
import { loadProfile } from './profile.ts';
import { listGhosts } from '../game/ghostcar.ts';
import { fmtTime } from '../hud/widgets.ts';
import { carNameOf } from './ghostrow.ts';
import { MENU_COL } from './palette.ts';
import type { GhostEntry } from '../game/ghostcar.ts';

// what one menu context needs here (menu.ts builds it)
interface Menu { root: HTMLElement; openedAt: number }

/**
 * One line of a box: a name on the left, a value on the right.
 * @param box the box
 * @param name the name
 * @param value the value
 */
function addLine(box: HTMLElement, name: string, value: string): void {
  const line = addElement(box, 'div', '', 'prow') as HTMLElement;
  const left = addElement(line, 'div', name) as HTMLElement;
  left.style.cssText = 'flex:1;font-size:12px';
  const right = addElement(line, 'div', value) as HTMLElement;
  right.style.cssText = 'font-size:12px;color:' + MENU_COL.good;
}

/**
 * A box in the menu's style (the pickers' dark well) under a heading.
 * @param panel the pane
 * @param title its heading
 * @returns the box
 */
function addBox(panel: HTMLElement, title: string): HTMLElement {
  const heading = addElement(panel, 'div', title, 'sub') as HTMLElement;
  heading.style.cssText = 'opacity:1;color:' + MENU_COL.accent;
  return addElement(panel, 'div', '', 'picker') as HTMLElement;
}

/**
 * The saved bests by track, the tracks in their newest best's order, each track's cars quickest
 * first.
 * @param entries the saved bests
 * @returns the tracks and their bests
 */
function byTrack(entries: GhostEntry[]): [string, GhostEntry[]][] {
  const tracks = new Map<string, GhostEntry[]>();
  for (const entry of entries) {
    const [, direction] = entry.key.split('|');
    const name = entry.track + (direction ? ' (' + direction.toUpperCase() + ')' : '');
    if (!tracks.has(name)) tracks.set(name, []);
    tracks.get(name)!.push(entry);
  }
  for (const list of tracks.values()) list.sort((one, two) => one.time - two.time);
  return [...tracks];
}

/**
 * ACCOLADES: the Story's trophies, then the test mode's fastest laps.
 * @param menu the menu context
 * @param back reopens SETTINGS
 * @param resume closes the menu back to the session (pause menu only)
 */
export function showAccolades(menu: Menu, back: () => void, resume?: () => void): void {
  const panel = addPane(menu, false) as HTMLElement;
  addElement(panel, 'h2', 'ACCOLADES');
  const trophies = loadProfile().trophies || [];
  const trophyBox = addBox(panel, 'TROPHIES');
  if (!trophies.length) {
    addElement(trophyBox, 'div', 'Win events in STORY to earn trophies.', 'sub');
  }
  for (const trophy of trophies) addLine(trophyBox, trophy.name, trophy.won);
  const laps = byTrack(listGhosts());
  const lapBox = addBox(panel, 'FASTEST LAPS (TEST MODE)');
  if (!laps.length) {
    addElement(lapBox, 'div', 'Turn GHOST on in a test run: your quickest laps land here.', 'sub');
  }
  for (const [track, bests] of laps) {
    const name = addElement(lapBox, 'div', track.toUpperCase()) as HTMLElement;
    name.style.cssText = 'font-size:12px;color:' + MENU_COL.accent;
    for (const best of bests) {
      addLine(lapBox, carNameOf(best.car).toUpperCase(), fmtTime(best.time));
    }
  }
  const row = addElement(panel, 'div', '', 'row') as HTMLElement;
  if (resume) addButton(menu, row, 'RESUME ▶', resume, 'go');
  addButton(menu, row, 'BACK', back);
}
