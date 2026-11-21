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
    id: 'fpshud',
    added: '2026-11-21',
    name: 'FPS counter: a row in the pause menu HUD list, on or off',
    where: 'Test link + &fpshud=1: any race, pause -> HUD -> FPS (at the end of the list)',
    try: 'Tap FPS to OFF and resume: the FPS panel under the lap timer is gone; tap it ON: back. '
      + 'Your choice is kept on the phone for the next race and the next visit.',
    wrong: 'The FPS panel still showing when OFF, missing when ON, the row missing, or the choice '
      + 'forgotten after a restart or a reload.',
  },
  {
    id: 'marksage',
    added: '2026-11-21',
    name: 'Tyre marks on big tracks kept whole, never cut off in a straight line',
    where: 'Test link + &marksage=1: Spa, Snoozuka, the Nordschlep, Le Manky (a big track)',
    try: 'Lay skids or slide through a corner, drive on a lap (or a few hundred metres) and come '
      + 'back: the marks are all still there, fading with age, then gone ~2.5 min after.',
    wrong: 'Marks ending in a straight line across the track, marks gone early, a seam or a grid '
      + 'of squares in the marks, or a stutter when marks are laid.',
  },
];
