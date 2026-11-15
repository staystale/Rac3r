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
    id: 'logofade',
    added: '2026-11-15',
    name: 'Loading bar: the logo fades in, no cheap text version first',
    where: 'Test link + &logofade=1: open the link, then reload once',
    try: 'Watch the box above the bar: empty until the logo has come, then the logo fading in.',
    wrong: 'The RAC3R text showing first and the logo popping in over it; the box jumping in '
      + 'size; the logo never coming on a good connection.',
  },
];
