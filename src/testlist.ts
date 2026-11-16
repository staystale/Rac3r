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
    id: 'cleo',
    added: '2026-11-16',
    name: 'New car: the Renolt Cleo Cup (the Clio Cup one-make racer, Clio V), TOURING / One-make',
    where: 'Test link + &cleo=1: the garage, TOURING; a race at Thruston or Brands Snatch; '
      + '+ &underskin=1 for a crash',
    try: 'Its look (white, yellow roof, the wing), a launch, the brakes, a race against the '
      + 'Civvic (it is 150 bhp down and 160 kg lighter), crash it, roll it.',
    wrong: 'Not a Clio Cup from above, faster than the Civvic, too much or too little grip for '
      + 'a small car on slicks.',
  },
  {
    id: 'focustlook',
    added: '2026-11-16',
    name: 'The Fjord Focust ST drawn as a five-door hatch from above',
    where: 'Test link + &focustlook=1: the garage (ROAD / Hatch), a race, the highway traffic',
    try: 'Look at it beside the Golf: the roof should run almost to the back, a short dark rear '
      + 'screen under the spoiler, no boot deck behind the glass.',
    wrong: 'Still reads as a saloon or a long-tailed hatch, the rear screen too long or gone.',
  },
  {
    id: 'pbzline',
    added: '2026-11-16',
    name: 'Pembreezy RX: the AI line kept off the edge on the gravel',
    where: 'Test link + &pbzline=1: test mode, RALLYCROSS -> Pembreezy RX, a race with a '
      + 'full field',
    try: 'Watch the field through the gravel loop and the S-bends after it (towards Woodlands): '
      + 'fewer cars running wide into the bales and being put back.',
    wrong: 'Cars slower or bunched up through the gravel, the line looking odd (weaving in the '
      + 'middle), more crashes, cars still piling into the bales on the S-bends.',
  },
  {
    id: 'fuelcarry',
    added: '2026-11-16',
    name: 'Traffic going for fuel that misses a station tries the next one',
    where: 'Test link + &fuelcarry=1: the highway (motorway, dual, Deaf Valley), petrol stations '
      + 'in the lay-bys',
    try: 'Watch a car indicating into the left lane before a station: if it is blocked or the '
      + 'pumps are taken, it stays in the left lane and pulls in at the next one. About 1 car in '
      + '8 passing a station should still pull in.',
    wrong: 'A car crawling in the left lane for miles, a queue forming behind one, cars pulling '
      + 'in much more often than before, a car swerving across lanes for the pumps.',
  },
  {
    id: 'underskin',
    added: '2026-11-16',
    name: 'Under the skin, round 2: uneven folds, a crushed wheel corner shows its arms, steering',
    where: 'Test link + &underskin=1: crash a closed car front-corner first (a hatch, a saloon, '
      + 'the Huracan) until the corner is pushed in to the wheel, then steer; side and rear too',
    try: 'The dent: crumpled, uneven folds. The crushed wheel corner: a dark well with the arms, '
      + 'strut and (driven wheel) drive shaft, joined to the wheel, the wheel pushed in with the '
      + 'metal; steer - the arms and wheel turn together.',
    wrong: 'Straight even stripes, see-through patches, arms not reaching the wheel or not turning '
      + 'with it, a wheel floating off the car, parts too small to make out.',
  },
];
