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
    id: 'dmgmore2',
    added: '2026-11-17',
    name: 'More damage 2, item 4: an exhaust or a torn bumper left HANGING, dragging until it '
      + 'drops',
    where: 'Test link + &dmgmore2=1: crash a hatch or a saloon tail-first hard, then drive on '
      + '(tarmac, then grass)',
    try: 'About half the time the exhaust hangs instead of flying off: its end trails behind the '
      + 'tail, sparking on tarmac, and drops after 100-400 m (or the next hit at the back). A torn '
      + 'bumper\'s hanging piece drags paint chips off its end and falls off by itself.',
    wrong: 'An exhaust that never drops, sparks on grass, sparks off a bumper, a piece that hangs '
      + 'on after it dropped, the Tesla or an open car dragging an exhaust.',
  },
  {
    id: 'tipping',
    added: '2026-11-16',
    name: 'The two-wheel state: a car can lift onto its two outside wheels before it rolls - steer '
      + 'into it or lift off to bring it down',
    where: 'Test link + &tipping=1: the Routemonster (and &schoolbus=1 the school bus) in a hard '
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
    id: 'schoolbus',
    added: '2026-11-16',
    name: 'New vehicle: the Skool Bus (an American IC Bus CE school bus), ROAD / Bus, and in the '
      + 'traffic on the school runs',
    where: 'Test link + &schoolbus=1: the garage, ROAD / Bus; the highway in TEST MODE at 08:00 '
      + 'or 15:30 (the setup\'s TIME) to meet one, and at noon to see none',
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
];
