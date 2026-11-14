// testlist.ts — THE TEST QUEUE (requirement: can we have a to test feature list somewhere in the
// pause menu while we are testing it should be updated when we add new features and remove approved
// features). Shown in the PAUSE menu, TEST MODE only (menu.ts pause -> TESTING).
// THE RULE (CLAUDE.md §1): every feature handed over for a phone test gets an entry here IN THE
// SAME TASK; when the user approves it, DELETE the entry (and note the verdict in TODO.md). Keep
// each line short: it is read on a phone, mid-session.
//   id     stable key            added   date it went in (yyyy-mm-dd)
//   where  how to get to it      try     what to do      wrong   what would count as a bug
/** One feature under test, as the pause menu lists it. */
export interface TestEntry {
  id: string; added: string; name: string; where: string; try: string; wrong: string;
}

export const TEST_LIST: TestEntry[] = [
  {
    id: 'perfpass',
    added: '2026-11-13',
    name: 'The same game, smoother on big grids',
    where: 'Test link + &perfpass=1: Spa, Sillystone, Snoozuka, Le Manky, X Gayms; day and night',
    try: 'Race a full grid, hit cones, tyre walls and armco, drive at night under trees and lamps.',
    wrong: 'Anything that behaves differently is wrong: a cut, a hit, a light, a tree, a reload.',
  },
  {
    id: 'holyjeez',
    added: '2026-11-14',
    name: 'Holy Jeez: the Holjes rallycross, full size',
    where: 'Test link + &holyjeez=1: RX list, Holy Jeez',
    try: 'Race it with the AI: the crest after the start, the top hairpin, the joker once.',
    wrong: 'A barrier on the road, a car stuck, the joker not counted, cars thrown off the crest.',
  },
];
