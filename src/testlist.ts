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
    id: 'stagepos',
    added: '2026-11-22',
    name: 'Rally stage: P n/N from the times so far at the same distance, like live timing',
    where: 'Test link + &stagepos=1: TEST MODE, a rally stage, VS AI 5 (start mid-field)',
    try: 'Watch P n/N as you drive: it moves as you gain or lose time on the cars ahead; N is the '
      + 'whole field; at your finish it matches the results.',
    wrong: 'P that disagrees with the gaps you see, N shrinking as cars finish, or your place '
      + 'at the finish different from the results.',
  },
  {
    id: 'stagetracks',
    added: '2026-11-22',
    name: 'Rally stage: tyre tracks of the cars that started before you, from the start line',
    where: 'Test link + &stagetracks=1: TEST MODE, Sweaty Lamb, VS AI 5 (start 2nd or later)',
    try: 'Look at the gravel ahead after the start: ruts from the cars ahead, each its own line, '
      + 'running into each car where you catch up with it.',
    wrong: 'No ruts on gravel, ruts on tarmac, ruts off the road or straight through bends, or a '
      + 'stutter at the start.',
  },
  {
    id: 'stagetimes',
    added: '2026-11-22',
    name: 'Rally stage: a car already home is timed at the AI driven pace, not the prediction',
    where: 'Test link + &stagetimes=1: TEST MODE, Sweaty Lamb, VS AI 5 (start 5th or 6th)',
    try: 'Restart until you start late (cars home before your green); drive it; read the results.',
    wrong: 'Home cars always on top (they were), or always last, or far off the driven times.',
  },
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
];
