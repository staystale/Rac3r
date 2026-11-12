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
    id: 'tunnellights',
    added: '2026-11-12',
    name: 'Lights in a slatted tunnel: your lamps and the cars\' seen between the slats',
    where: 'TEST MODE > a night (or ?night=0.8) > Moanaco, through the tunnel; any other tunnel',
    try: 'Drive through Moanaco\'s tunnel at night, headlights on, and watch the gaps between the'
      + ' slats; then any crossover or road tunnel.',
    wrong: 'A car seen between the slats with its lamps out, light on top of a slat, a car\'s light'
      + ' showing through a solid tunnel\'s cover.',
  },
];
