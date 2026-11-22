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
    id: 'trailroll',
    added: '2026-11-22',
    name: 'Truck and trailer roll: gently together, violently the pin snaps (about 0.45 g)',
    where: 'Test link + &trailroll=1: TEST MODE, the Scanyah with its trailer, the endless road',
    try: 'Take a long bend hard, keep building speed until it goes over; crash it side-on; RESET.',
    wrong: 'Rolling into the bend, cab and trailer apart after a gentle tip or on different '
      + 'faces, a wheel drawn off it, or RESET leaving either on its side.',
  },
  {
    id: 'hillclimb',
    added: '2026-11-22',
    name: 'SPIKES PEAK: the E36 hill climb - 5 km, switchbacks, drops, the summit the finish',
    where: 'Test link + &hillclimb=1: TEST MODE > ENDLESS ROADS > SPIKES PEAK, the BMV E36 Peak',
    try: 'Climb to the summit flag against the clock; cut a hairpin over its gravel; go off a '
      + 'bend\'s outside edge.',
    wrong: 'A wall or step in the ground, the road not climbing, a drop on a bend\'s inside, a '
      + 'prop or armco on the road, or no finish at the summit.',
  },
];
