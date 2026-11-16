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
    id: 'porch',
    added: '2026-11-16',
    name: 'New car: the Porch 911 GT3 Arr (Porsche 911 GT3 R), the GT class',
    where: 'Test link + &porch=1: the garage, class GT; race it on a circuit (Thruston, Brands) '
      + 'with the AI in its class, and once on a loose stage',
    try: 'Its look (the 911 nose and hips, the wing), its pace, braking and grip, a power slide '
      + 'out of a slow corner; crash it till the engine lid and wing come off (with &underskin=1 '
      + 'the engine shows under it); roll it.',
    wrong: 'Not a 911 from above, too fast or slow for a GT3 car, snap oversteer you cannot catch, '
      + 'a wing left floating after the lid has gone, a part drawn outside the car.',
  },
  {
    id: 'underskin',
    added: '2026-11-15',
    name: 'Under the skin: what a lost panel shows',
    where: 'Test link + &underskin=1: crash hard in any closed car (a hatch, the Huracan, the '
      + 'tractor) and in the F1 / F2, until a bonnet, a wing, a bumper or a boot comes off',
    try: 'Look into each hole: the engine and radiator under a bonnet, the suspension (strut, '
      + 'arms) and on a driven wheel the drive shaft in a wing well, the crash bar behind a '
      + 'bumper; an F1 sidepod its radiator.',
    wrong: 'A part drawn outside its hole or over the tyre, a front-drive car with drive shafts at '
      + 'the back (or the reverse), an engine where that car has none, holes odd at speed.',
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
