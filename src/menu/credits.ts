// menu/credits.ts - THE CREDITS SCREEN (owner 11-07: "add a credits button to the menu"), opened
// from the main menu. It names whose work the game carries: the traced circuit maps (Wikimedia
// Commons, CC BY-SA - attribution required), OpenStreetMap's map data (ODbL - attribution
// required) and the menu fonts (SIL OFL). Add a line here in the same change as anything else
// the game takes from someone else.
import { addPane, addButton, addElement } from './widgets.ts';
import { MENU_COL } from './palette.ts';

// what one menu context needs here (menu.ts builds it)
interface Menu { root: HTMLElement; openedAt: number }

// the copyright sign in a plain face: the menu's pixel faces draw it as an @
const COPYRIGHT = '<span style="font-family:sans-serif">©</span>';

/** One credit: what it is, whose it is, and its licence (with a link to read it). */
interface Credit { what: string; who: string; licence: string; link: string }

/** The groups of credits, in the order the screen shows them. */
const CREDITS: { heading: string; items: Credit[] }[] = [
  {
    heading: 'MAP DATA',
    items: [
      { what: 'Circuit venues: roads, buildings, grandstands, fences, woods',
        who: `${COPYRIGHT} OpenStreetMap contributors`, licence: 'ODbL',
        link: 'https://www.openstreetmap.org/copyright' },
    ],
  },
  {
    heading: 'CIRCUIT MAPS (TRACED)',
    items: [
      { what: 'Brands Snatch: "Brands Hatch 2003"', who: 'John Chapman',
        licence: 'CC BY-SA 4.0',
        link: 'https://commons.wikimedia.org/wiki/File:Brands_Hatch_2003.svg' },
      { what: 'Castle Cum: "Castle Combe Circuit track map"', who: 'Will Pittenger',
        licence: 'CC BY-SA 3.0',
        link: 'https://commons.wikimedia.org/wiki/File:Castle_Combe_Circuit_track_map.svg' },
      { what: 'Thruston: "Thruxton Motor Racing Circuit map"', who: 'Will Pittenger',
        licence: 'CC BY-SA 3.0',
        link: 'https://commons.wikimedia.org/wiki/File:Thuxton_Motor_Racing_Circuit_map.svg' },
      { what: 'Knobhill: "Knockhill circuit map"', who: 'Desmodromico (Italian Wikipedia)',
        licence: 'CC BY-SA 3.0',
        link: 'https://commons.wikimedia.org/wiki/File:Knockhill_circuit_map.png' },
      { what: 'Slidden Hill: "Lydden Hill - Rallycross"', who: 'Jorjum', licence: 'CC BY-SA 4.0',
        link: 'https://commons.wikimedia.org/wiki/File:Lydden_Hill_-_Rallycross.svg' },
    ],
  },
  {
    heading: 'FONTS',
    items: [
      { what: 'Silkscreen', who: 'Jason Kottke', licence: 'SIL OFL 1.1',
        link: 'https://openfontlicense.org' },
      { what: 'Press Start 2P', who: 'CodeMan38', licence: 'SIL OFL 1.1',
        link: 'https://openfontlicense.org' },
      { what: 'VT323', who: 'Peter Hull', licence: 'SIL OFL 1.1',
        link: 'https://openfontlicense.org' },
    ],
  },
];

/**
 * Adds one credit: the work, then who made it and its licence (the licence a link).
 * @param panel the pane
 * @param credit the credit
 */
function addCredit(panel: HTMLElement, credit: Credit): void {
  const line = addElement(panel, 'div', '', 'sub') as HTMLElement;
  line.style.cssText = `text-align:left;margin:2px 0 8px;color:${MENU_COL.fg}`;
  addElement(line, 'div', credit.what);
  const byLine = addElement(line, 'div', `${credit.who} · `) as HTMLElement;
  byLine.style.color = MENU_COL.dim;
  const link = addElement(byLine, 'a', credit.licence) as HTMLAnchorElement;
  link.href = credit.link;
  link.target = '_blank';
  link.rel = 'noopener';
  link.style.color = MENU_COL.good;
}

/**
 * CREDITS: every group, then BACK.
 * @param menu the menu context
 * @param back reopens the screen it came from
 */
export function showCredits(menu: Menu, back: () => void): void {
  const panel = addPane(menu, false) as HTMLElement;
  addElement(panel, 'h2', 'CREDITS');
  for (const group of CREDITS) {
    const heading = addElement(panel, 'div', group.heading, 'sub') as HTMLElement;
    heading.style.cssText = `text-align:left;margin-top:10px;color:${MENU_COL.accent}`;
    for (const credit of group.items) addCredit(panel, credit);
  }
  const row = addElement(panel, 'div', '', 'row') as HTMLElement;
  addButton(menu, row, 'BACK', back);
}
