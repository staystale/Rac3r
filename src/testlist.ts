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
    id: 'scanyah',
    added: '2026-11-16',
    name: 'New vehicle: the Scanyah R-Series (a Scania R 450 4x2 tractor unit), ROAD / Truck - the '
      + 'tractor alone for now (its trailer next)',
    where: 'Test link + &scanyah=1: the garage, ROAD / Truck; a circuit, the highway (it is not '
      + 'in the traffic)',
    try: 'Its look (the white cab, the chassis and fifth wheel, shaded), its pull and its 90 km/h '
      + 'limit, the brakes, crash it: the cab doors, the steel bumper, the big mirrors.',
    wrong: 'Not a Scania tractor from above, faster than 90 km/h, a car part off it.',
  },
  {
    id: 'tipping',
    added: '2026-11-16',
    name: 'The two-wheel state: a car can lift onto its two outside wheels before it rolls - steer '
      + 'into it or lift off to bring it down',
    where: 'Test link + &tipping=1: the Routemonster (and the school bus) in a hard '
      + 'corner on any circuit; a slide sideways across gravel in any car',
    try: 'Throw the bus into a tight corner: it leans up on two wheels (the first roll frames), '
      + 'and comes down if you ease the steering or lift; a car tripping on gravel lifts first and '
      + 'now and then drops back; ordinary cars on tarmac still slide, never lift.',
    wrong: 'A car lifting on plain tarmac in an ordinary corner, a lift that will not come down '
      + 'when you ease off, a juddering lean.',
  },
  {
    id: 'marktrack',
    added: '2026-11-17',
    name: 'The rear-right skid mark at the rear wheel\'s own track (the Routemonster, the Skool '
      + 'Bus)',
    where: 'Test link + &marktrack=1: the Routemonster or the Skool Bus on any circuit',
    try: 'Brake hard or slide: the rear-right tyre\'s mark lines up with the rear-left\'s, under '
      + 'the twin rear wheels (it was 0.125 m too far out, at the front track).',
    wrong: 'A rear mark outside its tyre, or any other car\'s marks changed.',
  },
  {
    id: 'dmgmore',
    added: '2026-11-17',
    name: 'More damage, items 1-2: a rolled car\'s underside as it really is; rolls throw track '
      + 'rods; a torn-off corner DRAGS its snapped arm (sparks, dirt, a pull by what drags)',
    where: 'Test link + &dmgmore=1: roll a hatch and a saloon hard (the Lab\'s flip ramp, a '
      + 'crash at speed); tear a wheel off and drive on tarmac and on grass',
    try: 'On its roof or side its underside shows the subframe, arms, drive shafts (driven wheels '
      + 'only) and track rods; a wheel torn off leaves them snapped short, and a front one throws '
      + 'its track rod too. A closed car on its roof loses no wheels; landing back on its wheels '
      + 'only that side\'s. Driving on a torn corner: sparks from the snapped arm (in from where '
      + 'the wheel was) on tarmac, dirt thrown on grass and gravel; a stronger pull when the '
      + 'wishbone went too.',
    wrong: 'A closed car losing a wheel on its roof, a wheel lost on the far side as it lands, '
      + 'arms reaching an empty hub, a tyre drawn where the wheel is gone; sparks out where the '
      + 'tyre was, a pull too weak or too strong to drive home.',
  },
];
