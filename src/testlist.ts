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
    id: 'carcache',
    added: '2026-11-12',
    name: 'Faster car drawing: the suspension arms of open-wheelers painted once, not every frame',
    where: 'Test link + &carcache=1: any race with F1 / F2 cars, a full grid (20 AI)',
    try: 'Race with a full grid; look at the arms and drive shafts by each wheel while steering.',
    wrong: 'Arms missing, in the wrong place, not turning with the steering, a lower frame rate.',
  },
  {
    id: 'carcull',
    added: '2026-11-12',
    name: 'Faster full grids: AI cars off the screen are not drawn',
    where: 'Test link + &carcull=1: a race with a full grid (20 AI), Spa or any big track',
    try: 'Race a few laps; watch cars come onto the screen at its edges as you catch or lose them.',
    wrong: 'A car popping in at the edge, lamps or wheels odd as it arrives, a lower frame rate.',
  },
  {
    id: 'tunnellights',
    added: '2026-11-12',
    name: 'Lights in a slatted tunnel: your lamps and the cars\' seen between the slats',
    where: 'TEST MODE > a night (or ?night=0.8) > Moanaco, through the tunnel; any other tunnel',
    try: 'Drive through Moanaco\'s tunnel at night, headlights on, and watch the gaps between the'
      + ' slats; then any crossover or road tunnel.',
    wrong: 'A car seen between the slats with its lamps out, light on top of a slat, a car\'s light'
      + ' showing through a solid tunnel\'s cover.',
  },
  {
    id: 'stadeprancebarriers',
    added: '2026-11-12',
    name: 'Stadium crossovers: room at the portals, the Armco flared into each mouth',
    where: 'TEST MODE > RALLYCROSS > Stade de Prance (and Wobbly Stadium)',
    try: 'Drive under the bridge both ways with your wheels on each edge line, and along both edges'
      + ' of the bridge road past the portals; look where the Armco meets each portal.',
    wrong: 'A car on the road touching a portal or its Armco, Armco across a portal or overlapping'
      + ' it, a gap or pocket beside a portal.',
  },
];
