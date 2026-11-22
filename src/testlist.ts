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
    id: 'revroom',
    added: '2026-11-22',
    name: 'AI stuck behind a crashed car reverse out sooner and far enough to steer round it',
    where: 'Test link + &revroom=1: any circuit with a full field, a pile-up or a car stuck '
      + 'against the wall',
    try: 'Watch an AI stuck nose-in behind a stopped car: it backs up after a couple of seconds, '
      + 'far enough to clear it, nose turned away, and drives round - fewer cars put back.',
    wrong: 'AI still nudging back and forth and getting put back, reversing into cars behind, '
      + 'or reversing in normal racing.',
  },
  {
    id: 'stagenolaps',
    added: '2026-11-22',
    name: 'Rally stages have no laps: no LAPS row in the setup, set or generated',
    where: 'TEST MODE: RALLY STAGES - Sweaty Lamb, Killder, the stage generator - VS AI',
    try: 'Pick VS AI on each stage: no LAPS row; launch and race to the finish. Then a circuit '
      + 'VS AI: its LAPS row still there.',
    wrong: 'A LAPS row on any stage, LAP n/N on its HUD, the stage running past its finish, or '
      + 'a circuit or rallycross race with no LAPS row.',
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
