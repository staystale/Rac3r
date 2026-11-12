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
    id: 'stadeprancebarriers',
    added: '2026-11-12',
    name: 'Stadium crossovers: room at the portals, the Armco flared into each mouth',
    where: 'TEST MODE > RALLYCROSS > Stade de Prance (and Wobbly Stadium)',
    try: 'Drive under the bridge both ways with your wheels on each edge line, and along both edges'
      + ' of the bridge road past the portals; look where the Armco meets each portal.',
    wrong: 'A car on the road touching a portal or its Armco, Armco across a portal or overlapping'
      + ' it, a gap or pocket beside a portal.',
  },
];
