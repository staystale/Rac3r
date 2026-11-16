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
    id: 'reversefix',
    added: '2026-11-16',
    name: 'Reverse as in life, every car: traction control works going backwards, and the 20 km/h '
      + 'reverse cap holds',
    where: 'Test link + &reversefix=1: any car, any level (a powerful one shows it best: the '
      + 'Tesla, the Huracan, the 3 Series), on tarmac and on gravel',
    try: 'Hold reverse from a standstill: the car tops out at 20 km/h (it reached 23-32 before), '
      + 'with only a short chirp of wheelspin; TCS off lets the wheels spin a little more.',
    wrong: 'Reverse faster than about 20 km/h, a jolt at the cap, reverse that will not move off, '
      + 'the AI stuck reversing.',
  },
  {
    id: 'underskin',
    added: '2026-11-16',
    name: 'Under the skin, round 4: a crushed wheel corner open to the road, dark arms, strut over',
    where: 'Test link + &underskin=1: crash a closed car front-corner first (a hatch, a saloon, '
      + 'the Huracan) until the corner is pushed in to the wheel, then steer; side and rear too',
    try: 'The crushed wheel corner: the road seen through it, the dark arms and track rod under '
      + 'the tyre (as on the F1), the strut over it at the top of the arch (only its inner half '
      + 'until the corner is badly crushed), the wheel '
      + 'pushed in with the metal; steer - the wheel and track rod turn. Lose a wheel: its '
      + 'wishbone and strut lie under it on the road.',
    wrong: 'A dark block in the wheel arch, arms over the tyre, arms not reaching the wheel, a '
      + 'wheel floating off the car, the engine bay, door floor or boot floor not crumpling.',
  },
];
