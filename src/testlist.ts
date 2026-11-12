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
    id: 'tyrelights',
    added: '2026-11-12',
    name: 'Lights clear of tyres: no corner light and its tyre ring on top of a floodlight pylon',
    where: "Test link + &tyrelights=1 (and &birdsmess=1): The Bird's Mess, Naffcar",
    try: "The Bird's Mess: the infield inside the long west sweeper; Naffcar: the east end's"
      + ' pylons. Any other level: look at the floodlights and their tyre rings.',
    wrong: "A tyre or prop over a light's base, two lights side by side, a corner floodlight"
      + ' with no tyre ring round it.',
  },
  {
    id: 'stadiumprops',
    added: '2026-11-12',
    name: 'Stadium dressing: each stadium its own props and litter, its Armco and fences tidied',
    where: 'Test link + &stadiumprops=1 (and &birdsmess=1): TEST MODE > RALLYCROSS > Wobbly,'
      + " Stade de Prance, The Bird's Mess",
    try: 'Lap each stadium: look at the Armco at both mouths of the tunnel (it should run out of'
      + ' each mouth along the road and ease away, no hook), between the lanes by the crossover and'
      + ' in the corners beside it, and at the transporters, paddock, TV platform, motorhome, show'
      + ' cars and fans behind the fences and in the infield.',
    wrong: 'Armco hooking into a tunnel mouth or touching its wall, a kink or step, an end meeting'
      + " nothing, a prop on a fence, over the track or in a car's way, a board moved, a lower"
      + ' frame rate.',
  },
  {
    id: 'birdsmess',
    added: '2026-11-12',
    name: "The Bird's Mess: the Race of Champions in Beijing, two lanes, a crossover, at night",
    where: "Test link + &birdsmess=1: TEST MODE > RALLYCROSS > The Bird's Mess (TIME on LIVE)",
    try: 'HEAD-TO-HEADBUTT vs one AI, then a full grid: the gravel start into the hairpin, the'
      + ' pinched north side, the long west sweeper, over and under the bridge; look at the red'
      + ' stands and the roof lattice past the fence.',
    wrong: 'A dark stretch of road you cannot read, anything drawn over the track or a car, a car'
      + ' touching a portal on the road, a way off the lanes, a lower frame rate than the others.',
  },
  {
    id: 'tunnellights',
    added: '2026-11-12',
    name: 'Lights in a slatted tunnel: your lamps and the cars\' seen between the slats',
    where: 'Test link + &coverlight=1: a night (or ?night=0.8) > Moanaco, the tunnel; any tunnel',
    try: 'Drive into and out of Moanaco\'s tunnel at night, headlights on, with AI cars; watch the'
      + ' slats and gaps as you and they approach, pass under and leave; then any other tunnel.',
    wrong: 'Light on top of a slat (from a car in, before or beside the tunnel), a car between the'
      + ' slats with its lamps out, light through a solid tunnel\'s cover.',
  },
];
