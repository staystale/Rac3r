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
    id: 'pembreezy',
    added: '2026-11-16',
    name: 'Pembreezy: Pembrey Circuit (half size) and Pembreezy RX (full size, with its joker)',
    where: 'Test link + &pembreezy=1: test mode, CIRCUITS -> Pembreezy Circuit; RALLYCROSS -> '
      + 'Pembreezy RX',
    try: 'The circuit: a few laps, all tarmac (Hatchets and Brooklands hairpins, the fast Honda '
      + 'onto the straight). The RX: from Dibeni down the fast tarmac sweeper, the gravel hairpin '
      + 'off its end, the gravel loop (the joker round its right-hander, once a race) and the '
      + 'gravel run to Woodlands. Look at the Welsh flags, the paddock, the dunes and pines.',
    wrong: 'A wall, tyre or bale on the road, a road that ends in nothing, cars stuck or reset '
      + 'on the gravel, the joker not counted, the lap feeling stiff or boxy, the dunes or the '
      + 'paddock looking out of place.',
  },
  {
    id: 'gpustat',
    added: '2026-11-16',
    name: 'Frame-drop hunt: the phone report also records the GPU side and each layer',
    where: 'Test link + &report=1&gpustat=1: the highway (motorway, countryside), test mode',
    try: 'Drive about 5 minutes at motorway speed so the view stays zoomed out, as when the frames '
      + 'dropped. Nothing should look or play differently: it only writes numbers for the foreman.',
    wrong: 'Anything drawn or driving differently from the plain link, or a hitch about once a '
      + 'second (it times the graphics chip then; tell the foreman if you can feel it).',
  },
  {
    id: 'hwtrips',
    added: '2026-11-15',
    name: 'Traffic leaves by the slip roads, stops for fuel and joins from the on-ramps',
    where: 'Test link + &hwtrips=1: the highway (motorway, dual, Deaf Valley); slip roads every '
      + '2-4 km, junctions (roundabouts by a bridge) now and then, petrol stations in lay-bys',
    try: 'Watch the cars ahead before an exit: about 1 in 6 moves to the left lane, indicates left '
      + 'and takes the slip (a junction: round its roundabout). About 1 in 8 pulls in at a petrol '
      + 'station, a cruising police car too. Past a junction or a services, a car comes down the '
      + 'on-ramp, waits if the lane is busy and merges.',
    wrong: 'A car cutting across lanes into the slip, leaving with no indicator, stopping on the '
      + 'motorway for its exit, vanishing in view, a chasing police car leaving, or a joining car '
      + 'pulling out into a car in the left lane.',
  },
];
