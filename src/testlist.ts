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
    id: 'schoolbus',
    added: '2026-11-16',
    name: 'New vehicle: the Skool Bus (an American IC Bus CE school bus), ROAD / Bus, and in the '
      + 'traffic on the school runs',
    where: 'Test link + &schoolbus=1: the garage, ROAD / Bus; the highway in TEST MODE at 08:00 '
      + 'or 15:30 (the setup\'s TIME) to meet one, and at noon to see none; + &carparts=1',
    try: 'Its look (yellow, the white roof, the dog nose, shaded), drive it, crash it: the '
      + 'entrance door, side panels, the rear emergency door, lots of glass.',
    wrong: 'One outside the school runs, too common, not yellow in the traffic, a car door off it.',
  },
  {
    id: 'e36peak',
    added: '2026-11-16',
    name: 'New car: the BMV E36 Peak (the BimmerWorld Pikes Peak E36), HILL CLIMB / Unlimited (a '
      + 'new class)',
    where: 'Test link + &e36peak=1: the garage, HILL CLIMB; a road stage or a hilly circuit '
      + '(no hill climb stage yet)',
    try: 'Its look (black, the white roof, the huge blue wing, shaded), about 1,000 hp with '
      + 'traction control on and off, its grip in fast corners (the downforce).',
    wrong: 'Not an E36 from above, undrivable even with the aids, slow in a straight line.',
  },
  {
    id: 'transitcustom',
    added: '2026-11-16',
    name: 'New car: the Fjord Transfit Custom (a Ford Transit Custom L1 H1), ROAD / Van, and in '
      + 'the traffic',
    where: 'Test link + &transitcustom=1: the garage, ROAD / Van; the highway (the four Transfits '
      + 'share the vans: the Custom the commonest)',
    try: 'Its look (the white van, the big black mirrors, shaded), its pull against the other '
      + 'Transfits, crash it: two cab doors, the nearside sliding door, the twin rear doors.',
    wrong: 'Not a Transit Custom from above, a car door off it, too common or rare in the traffic.',
  },
  {
    id: 'dmgmore',
    added: '2026-11-17',
    name: 'More damage, item 1: a rolled car\'s underside as it really is; rolls throw track rods',
    where: 'Test link + &dmgmore=1: roll a hatch and a saloon hard (the Lab\'s flip ramp, a '
      + 'crash at speed)',
    try: 'On its roof or side its underside shows the subframe, arms, drive shafts (driven wheels '
      + 'only) and track rods; a wheel torn off leaves them snapped short, and a front one throws '
      + 'its track rod too. A closed car on its roof loses no wheels; landing back on its wheels '
      + 'only that side\'s.',
    wrong: 'A closed car losing a wheel on its roof, a wheel lost on the far side as it lands, '
      + 'arms reaching an empty hub, a tyre drawn where the wheel is gone.',
  },
];
