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
    id: 'flagfix',
    added: '2026-11-21',
    name: 'The chequered flag at the finish of EVERY race, not only the first one',
    where: 'Test link + &flagfix=1: any race with AI (or a highway run with a FINISH)',
    try: 'Finish a race, then RESTART and finish again, then TRACK SELECT another track and '
      + 'finish: the flag sweeps across with your place every time, win or not.',
    wrong: 'A finish with no flag, a flag twice for one finish, or a flag before you cross the '
      + 'line.',
  },
];
