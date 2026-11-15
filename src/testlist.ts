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
    id: 'resetback',
    added: '2026-11-15',
    name: 'Resets never put you ahead, never onto a car, and leave the police',
    where: 'Test link + &resetback=1: a circuit race, rallycross (the joker lane too), a rally '
      + 'stage, the highway with traffic and police, the Test Lab; phone upright and on its side',
    try: 'Go off, drive back down the grass, then RESET; reset with a rival on the spot; on the '
      + 'highway go the wrong way, go far off the road, and RESET with the police behind you.',
    wrong: 'A reset that puts you further on than you were, onto or into a car, or makes a '
      + 'police car vanish; a reset onto the other carriageway or off the road.',
  },
  {
    id: 'wrongway',
    added: '2026-11-15',
    name: 'Highway WRONG WAY reset waits: turn round, reverse a little, get knocked back',
    where: 'Test link + &wrongway=1: any highway (motorway, twisty, Deaf Valley), alone and in '
      + 'a race; phone upright and on its side',
    try: 'Stop and reverse 10-15 m; spin round and turn back the right way; then drive the '
      + 'wrong way on purpose and hold it.',
    wrong: 'WRONG WAY firing while you reverse a little or turn round; driving the wrong way '
      + 'on purpose not reset within about 4 s / 50 m.',
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
  {
    id: 'bootbar',
    added: '2026-11-15',
    name: 'A loading bar from the first moment the page opens',
    where: 'Test link + &bootbar=1: open or reload it (twice: the 2nd is paced on the 1st)',
    try: 'Watch from the blank page to the menu: pane, LOADING, the logo (or RAC3R with a big '
      + 'blue 3 until it comes), the bar filling.',
    wrong: 'The old "RAC3R loading..." shown, the bar still or jumping, two screens, no blue '
      + 'flash, the menu slower to come than without the switch, a tap passing through.',
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
