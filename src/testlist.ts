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
    id: 'garagewide',
    added: '2026-11-16',
    name: 'The garage car picker wider on a landscape screen',
    where: 'Test link + &garagewide=1 (with &trophy=1&civvic=1 for the long names): test mode, '
      + 'GARAGE, the phone held sideways',
    try: 'Step the CAR row to the Fjord Effing-150 Trophy Truck and the Honder Civvic Type Arr '
      + 'BTCC: each name on two lines with its "1 / 1" count under it. Upright: as before.',
    wrong: 'A name on three lines or its count cut off, the stats on the right cut off or '
      + 'overlapping, the car picture squashed.',
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
    name: 'Under the skin, fixed: dents fold, no see-through holes, structure pushed back',
    where: 'Test link + &underskin=1: crash hard in any closed car (a hatch, the Huracan, the '
      + 'tractor) and in the F1 / F2, front, side and rear, until a bonnet, a wing, a bumper, a '
      + 'door or a boot comes off',
    try: 'Look at the dented corner: creased, darker folds, the edge crumpled but solid. Look '
      + 'into each hole: the engine and radiator (pushed back as the front crumples), the arms, '
      + 'strut and drive shaft in a wing well, the beam behind a bumper, a door sill and floor.',
    wrong: 'Speckled or see-through patches on a damaged car, a radiator, beam or bumper floating '
      + 'past the crushed edge, parts too small or dark to make out at speed, a front-drive car '
      + 'with drive shafts at the back.',
  },
];
