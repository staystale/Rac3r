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
    id: 'stagedone',
    added: '2026-11-22',
    name: 'Rally stage: a car that started long before you is home, not on the road',
    where: 'Test link + &stagedone=1: TEST MODE, Sweaty Lamb, VS AI 5 (a late start for you)',
    try: 'Start the stage a few times until you start 4th or later; drive it and read the results.',
    wrong: 'A car parked or driving off just ahead of you at the start, a car finishing at the '
      + 'green, or a time near 270 s; a car missing from the results.',
  },

];
