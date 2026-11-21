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
    id: 'trailheal',
    added: '2026-11-21',
    name: 'RESET mends the truck’s trailer too',
    where: 'Test link + &trailheal=1: the Scanyah with its trailer, any level',
    try: 'Crash the trailer (dents, a door or mudguard off, a flat), then press RESET.',
    wrong: 'The trailer still dented, missing parts or on a flat after RESET.',
  },
  {
    id: 'cabglass',
    added: '2026-11-21',
    name: 'Rolled lorries, vans and buses show their real side windows',
    where: 'Test link + &cabglass=1: the Scanyah, a Transfit, the buses, the tractor',
    try: 'Roll one onto its side (a fast slide into a kerb or a barrier) and look at its side.',
    wrong: 'A cab side with no window, glass up to the roof, or a bus side with no pillars.',
  },
  {
    id: 'dashphase',
    added: '2026-11-21',
    name: 'The highway’s lane dashes stay put (no skipping)',
    where: 'Test link + &dashphase=1: Deaf Valley (or any scenery), a motorway or interstate',
    try: 'Drive a few km through the bends and watch the dashed lane lines.',
    wrong: 'Dashes jumping, doubled or broken where the ground joins, or a different length.',
  },
];
