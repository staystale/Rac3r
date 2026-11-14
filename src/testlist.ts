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
    id: 'lapdata',
    added: '2026-11-14',
    name: 'Track lists open at once: the lap lengths stored, not worked out',
    where: 'Test link + &lapdata=1: TEST MODE, then each track list (ALL TRACKS, CIRCUITS...)',
    try: 'Open the lists straight after loading the page; read the cards LAP ... KM lines.',
    wrong: 'A list slow to appear after the blue blink, a length missing or not as before.',
  },
  {
    id: 'loadscreen',
    added: '2026-11-14',
    name: 'Loading screen: the track loads, then the fly-in, then the lights',
    where: 'Test link + &loadscreen=1: LAUNCH any track (Spa: the big one), then RESTART',
    try: 'Watch the screen, the bar flash blue when done, the fly-in in full, then the lights '
      + 'count down with you on the grid. Tap the screen while it loads.',
    wrong: 'A blank or frozen screen, the bar still, the lights counting during the fly-in, cars '
      + 'moving before the lights, a tap starting anything, a broken menu race.',
  },
];
