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
    id: 'aitune',
    added: '2026-11-21',
    name: 'AI tune: later, steady braking; followers and closer running (first try)',
    where: 'Test link + &aitune=1: any circuit with a full AI field; the motorway with racers',
    try: 'Race a few laps: AI brake later and smoothly, no dabbing or braking mid-straight, '
      + 'followers close up without panic-braking. Note crashes on tight or loose tracks.',
    wrong: 'AI braking on straights, crashing into corners or each other far more than before, '
      + 'or slower laps.',
  },
  {
    id: 'labstart',
    added: '2026-11-21',
    name: 'The Lab start in the open, one spot for every vehicle',
    where: 'Test link + &labstart=1: the Lab (OG Lab) with a car, the bus and the Scanyah towing',
    try: 'Launch and drive straight off: nothing in the way, a street light row each side 7 m off.',
    wrong: 'A vehicle starting against a lamp or a cone, or the start box away from the car.',
  },
  {
    id: 'gridpos',
    added: '2026-11-21',
    name: 'The place shown on the grid before the start is your slot’s (not P1)',
    where: 'Test link + &gridpos=1: any circuit with AI, before you press anything',
    try: 'Launch with AI: the lap panel shows your grid place (P4/6 from the fourth slot) at once.',
    wrong: 'P1 shown from a slot behind the pole, or a place that jumps when the race starts.',
  },
];
