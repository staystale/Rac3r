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
    id: 'xgayms',
    added: '2026-11-12',
    name: 'L.A. Lively: X Gayms rallycross in the streets, a crossover bridge, a 16 m gap jump',
    where: 'Test link + &xgayms=1: TEST MODE > RALLYCROSS > L.A. Lively',
    try: 'A race with a full grid: the dirt lots, under and over the bridge, and the joker'
      + ' (north-east, past the north street) over the gap jump - flat out, then lifting; by day'
      + ' and at night (START HOUR).',
    wrong: 'A jump you cannot see coming, landing short being unfair, a car stuck in the gap, a'
      + ' way off the course, anything over the track, a dark stretch you cannot read, a lower'
      + ' frame rate than the other rallycross levels.',
  },
];
