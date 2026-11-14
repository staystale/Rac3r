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
    id: 'smoothfly',
    added: '2026-11-14',
    name: 'Smooth fly-in: the whole-track view at full speed',
    where: 'Test link + &smoothfly=1&loadscreen=1 (also without &loadscreen=1): LAUNCH Spa, '
      + 'then RESTART',
    try: 'Watch the fly-in from the whole track down to your car: it should glide, and look as '
      + 'before (trees, stands, cones, cars). Try at night and in rain too.',
    wrong: 'A stutter in the fly-in, trees or cones popping or jumping in size as it zooms, '
      + 'missing or doubled props, cars under a tree or bridge drawn wrongly, a slow first frame.',
  },
  {
    id: 'onestart',
    added: '2026-11-14',
    name: 'Quicker start and restart: nothing done twice',
    where: 'Test link + &onestart=1 (with or without &loadscreen=1): LAUNCH Spa, then RESTART',
    try: 'Start a new track, restart it a few times, change the weather or the track and start '
      + 'again. The fly-in should show the track as before.',
    wrong: 'A fly-in showing the wrong track or layout, a frozen pond drawn as water (or the '
      + 'other way), a missing or doubled field, a slower start.',
  },
  {
    id: 'loadscreen',
    added: '2026-11-14',
    name: 'Loading screen: the track loads, then the fly-in, then the lights',
    where: 'Test link + &loadscreen=1: LAUNCH any track (Spa: the big one), then RESTART',
    try: 'Watch the screen, the bar flash blue when done, the fly-in in full, then the lights '
      + 'count down with you on the grid. Tap the screen while it loads.',
    wrong: 'A blank or frozen screen, the bar still, the lights counting during the fly-in, cars '
      + 'moving before the lights, a tap starting anything, a broken menu race.',
  },
];
