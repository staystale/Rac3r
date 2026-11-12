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
    id: 'thumbfill',
    added: '2026-11-12',
    name: 'Menu track pictures fill in as they load (not left blank)',
    where: 'Test link + &thumbfill=1: open TEST MODE straight after the page loads',
    try: 'Load the link, tap through to TEST MODE at once; watch the category list and a track'
      + ' list.',
    wrong: 'A category or track card still without its picture after a few seconds, a jump or'
      + ' flicker.',
  },
];
