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
    id: 'xgaymsloose',
    added: '2026-11-13',
    name: 'L.A. Lively re-laid looser: mixed corners, bending streets, free lines on the dirt',
    where: 'Test link + &xgaymsloose=1: TEST MODE > RALLYCROSS > L.A. Lively',
    try: 'A race with a full grid, day and night: the west lot hairpin, the fast sweep into the'
      + ' east lot, the corner that tightens onto the north street, the joker and its jump.',
    wrong: 'A corner that still reads square, a kink or fold in the road, a car stuck, Armco'
      + ' ending in the open, anything on the road, the jump not cleared from 60 km/h.',
  },
];
