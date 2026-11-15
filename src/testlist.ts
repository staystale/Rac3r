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
    id: 'nighthw',
    added: '2026-11-15',
    name: 'Night on the endless highway: only the trees a light reaches darkened (lighter)',
    where: 'Test link + &nighthw=1&report=1: a countryside highway at night, drive a few km',
    try: 'Drive past lamps and trees with your headlights on; watch tree tops near the lights.',
    wrong: 'A tree top lit by a lamp or headlight, a hitch as the road ahead appears.',
  },
  {
    id: 'tyresmoke',
    added: '2026-11-14',
    name: 'Tyre smoke only past grip, by each tyre\'s own heat window (all four tyres alike)',
    where: 'Test link + &tyresmoke=1: any circuit (Thruston, Spa) and the Test Lab, any car, '
      + 'aids on and off; try it without the switch to compare',
    try: 'Race a few fast laps hard, then a burnout, donuts, a locked-wheel stop from speed and '
      + 'a long hot slide. Fronts and rears should follow one rule.',
    wrong: 'Smoke from tyres that are gripping (a clean fast corner, a normal stop with ABS), '
      + 'or burnouts, donuts, lock-ups and hot slides with clearly less smoke than before.',
  },
  {
    id: 'exitpuns',
    added: '2026-11-14',
    name: 'Countryside exit signs as puns: GHOULE, SKUNKTHORPE, BRIGGADOON, HOWDY-DEN',
    where: 'Test link + &exitpuns=1: a countryside highway, the exit signs',
    try: 'Drive past a few exits and read the signs.',
    wrong: 'A real town left (GOOLE, SCUNTHORPE, BRIGG, HOWDEN), a sign cut off or overlapping.',
  },
];
