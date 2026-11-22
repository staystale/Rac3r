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
    id: 'contactcost',
    added: '2026-11-22',
    name: 'AI weigh contact when picking a line: no rear-ending, no chopping a car alongside',
    where: 'Test link + &contactcost=1: any circuit with a full field; the motorway with racers',
    try: 'Race in a pack: AI pick gaps that do not run into the back of a car, do not squeeze a '
      + 'car alongside and do not pull across a car just behind them; they still race close.',
    wrong: 'AI too timid to take a line they are ahead on, never defending, or the same contact '
      + 'as before.',
  },
  {
    id: 'trailroll',
    added: '2026-11-22',
    name: 'Truck and trailer roll: gently together, violently the pin snaps (about 0.45 g)',
    where: 'Test link + &trailroll=1: TEST MODE, the Scanyah with its trailer, the endless road',
    try: 'Take a long bend hard, keep building speed until it goes over; crash it side-on; RESET.',
    wrong: 'Rolling into the bend, cab and trailer apart after a gentle tip or on different '
      + 'faces, a wheel drawn off it, or RESET leaving either on its side.',
  },
];
