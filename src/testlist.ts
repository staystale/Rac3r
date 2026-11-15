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
    id: 'stuckreset',
    added: '2026-11-15',
    name: 'Stuck AI put back after 6-10 s, behind; stuck highway cars go',
    where: 'Test link + &stuckreset=1: circuit and rallycross races with a big grid, a rally '
      + 'stage, a highway race and free drive with traffic; phone upright and on its side',
    try: 'Watch the first-lap pile-ups and cars beached or rocking off the road; crash a '
      + 'highway car and stop near it; wait in traffic queued behind a wreck or your stopped car.',
    wrong: 'An AI left stuck over ~10 s, or put back ahead of where it was or onto a car; a car '
      + 'put back while waiting at the lights, in a queue or pulling away; a wreck in view over '
      + '~7 s; a car vanishing from a queue, a pump or the roadside where it broke down.',
  },
  {
    id: 'offroadwin',
    added: '2026-11-15',
    name: 'No highway race won by pulling away off the road',
    where: 'Test link + &offroadwin=1: a highway race with AI (endless, and 5 KM / 3 MIN), any '
      + 'road; phone upright and on its side',
    try: 'Get well ahead, then run on the verge or in the fields: PULLING AWAY should go; back '
      + 'on the road it counts again from 8. In a 5 KM / 3 MIN race, cross the line or let the '
      + 'clock run out off the road: that still counts.',
    wrong: 'A getaway win while off the road; PULLING AWAY not starting again on the road; a '
      + 'line or clock race not ending because you were off the road.',
  },
  {
    id: 'rollhold',
    added: '2026-11-15',
    name: 'Rolling starts: every car holds the pace, no bumping before the green',
    where: 'Test link + &rollhold=1: a race with AI on Naffcar Speedway, Stock Car, Dieatona and '
      + 'the highway; AI cars of your class (a saloon or a banger mixes the field)',
    try: 'Watch the formation from the grid to the green: the cars rise to speed together, each '
      + 'keeping its gap; the green comes ~1.5 s later than before on the ovals.',
    wrong: 'A car running into the one ahead before the green, a car dropping out of its slot, '
      + 'the formation crawling or the green taking much longer.',
  },
  {
    id: 'croughedrx',
    added: '2026-11-15',
    name: 'Croughed RX: Croft\'s rallycross at full size (tarmac, then gravel, a joker)',
    where: 'Test link + &croughedrx=1: TRACKS, rallycross (or Croughed in ALL), any car, AI on',
    try: 'Start on the Main Straight, race through Clervaux, Hawthorn and the chicane onto the '
      + 'gravel, round the gravel hairpin and back; take the joker once (the infield loop).',
    wrong: 'A car off the grid or stuck at the start, a barrier on the road, Armco ending in the '
      + 'open, the hairpin too wide or too tight to drive, the dark map edge, a floating prop.',
  },
  {
    id: 'nighthw',
    added: '2026-11-15',
    name: 'Night on the endless highway: only the trees a light reaches darkened (lighter)',
    where: 'Test link + &nighthw=1&report=1: a countryside highway at night, drive a few km',
    try: 'Drive past lamps and trees with your headlights on; watch tree tops near the lights.',
    wrong: 'A tree top lit by a lamp or headlight, a hitch as the road ahead appears.',
  },
  {
    id: 'exitpuns',
    added: '2026-11-14',
    name: 'Countryside exit signs as puns: GHOULE, SKUNKTHORPE, BRIGGADOON, HOWDY-DEN',
    where: 'Test link + &exitpuns=1: a countryside highway, the exit signs',
    try: 'Drive past a few exits and read the signs.',
    wrong: 'A real town left (GOOLE, SCUNTHORPE, BRIGG, HOWDEN), a sign cut off or overlapping.',
  },
  {
    id: 'hjfirs',
    added: '2026-11-15',
    name: 'Holy Jeez mostly firs: a Swedish pine forest (85 % firs), a few leafy trees',
    where: 'Test link + &hjfirs=1: Holy Jeez; compare without the switch',
    try: 'Race a lap, by day (autumn if you can) and at night. Look at the forest round the lap.',
    wrong: 'Leafy trees still most of them; every tree alike; any other level\'s trees changed.',
  },
];
