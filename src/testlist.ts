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
    id: 'exitpuns',
    added: '2026-11-14',
    name: 'Countryside exit signs as puns: GHOULE, SKUNKTHORPE, BRIGGADOON, HOWDY-DEN',
    where: 'Test link + &exitpuns=1: a countryside highway, the exit signs',
    try: 'Drive past a few exits and read the signs.',
    wrong: 'A real town left (GOOLE, SCUNTHORPE, BRIGG, HOWDEN), a sign cut off or overlapping.',
    id: 'rollside',
    added: '2026-11-14',
    name: 'A rolled car is solid: no see-through lines on its sides or roof',
    where: 'Test link + &rollside=1: Test Lab, the flip ramp (or any crash that rolls you), '
      + 'every car you like, a light paint too',
    try: 'Roll the car over and watch its sides, roof and underside as it turns and as it '
      + 'rests on its side or roof. Try a damaged car too.',
    wrong: 'Ground showing through the body (thin lines or gaps), a wrong colour on a side, '
      + 'wheels or wings drawn where they were not before, a jerky roll.',
    id: 'frontheat',
    added: '2026-11-14',
    name: 'Front tyres warm when you brake (every car)',
    where: 'Test link + &frontheat=1: Test Lab or Test Track, the F1 car, a road car (aids on), '
      + 'a rally car; the tyre numbers on the HUD',
    try: 'Brake hard from top speed a few times, then drive a few normal laps and corners. The '
      + 'fronts should reach their window (green) like the rears; a long race heats as before.',
    wrong: 'Fronts still cold after hard stops, tyres overheating in normal racing, the handbrake '
      + 'heating the fronts, a burnout or donut heating differently from before.',
  },
  {
    id: 'dongfence',
    added: '2026-11-14',
    name: 'QUESTION: Dongington Park - keep the catch fence by the Hollywood grandstand?',
    where: 'Dongington Park (any layout): the Hollywood grandstand',
    try: 'Look at the catch fence in front of the grandstand; no photo of the real one shows it.',
    wrong: 'Say KEEP or REMOVE (a reminder, not a change: nothing is under test here).',
  },
  {
    id: 'smoothfly',
    added: '2026-11-14',
    name: 'Smooth fly-in: the whole-track view at full speed',
    where: 'Test link + &smoothfly=1&loadscreen=1 (also without &loadscreen=1): LAUNCH Spa, '
      + 'then RESTART',
    try: 'Watch the fly-in from the whole track down to your car: it should glide and look as '
      + 'before (trees, stands, cones, cars). Try night and rain. With &report=1 the report '
      + 'says whether the pictures were drawn.',
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
