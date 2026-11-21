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
    id: 'boxhold',
    added: '2026-11-21',
    name: 'Auto box: no hunting between 1st and 2nd (the Scanyah, loaded or not)',
    where: 'Test link + &boxhold=1: the Scanyah tractor (with &trailer=1 the loaded trailer)',
    try: 'Pull away flat out and gently, on the flat and up a hill: it holds 1st until it rolls, '
      + 'then 2nd and up, never back to 1st and again. Every other car shifts as before.',
    wrong: 'Gears jumping 1-2-1-2, the truck stuck at a crawl up a hill, or any car now slower off '
      + 'the line or stuck in a gear.',
  },
];
