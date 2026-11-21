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
    id: 'aitune',
    added: '2026-11-21',
    name: 'AI tune: later, steady braking; followers and closer running (first try)',
    where: 'Test link + &aitune=1: any circuit with a full AI field; the motorway with racers',
    try: 'Race a few laps: AI brake later and smoothly, no dabbing or braking mid-straight, '
      + 'followers close up without panic-braking. Note crashes on tight or loose tracks.',
    wrong: 'AI braking on straights, crashing into corners or each other far more than before, '
      + 'or slower laps.',
  },
  {
    id: 'boxhold',
    added: '2026-11-21',
    name: 'Auto box: no hunting between 1st and 2nd (the Scanyah, loaded or not)',
    where: 'Test link + &boxhold=1: the Scanyah tractor (with &trailer=1 the loaded trailer)',
    try: 'Pull away flat out and gently, on the flat and up a hill: it holds 1st until it rolls, '
      + 'then 2nd and up, never back to 1st and again. Every other car shifts as before.',
    wrong: 'Gears jumping 1-2-1-2, the truck stuck at a crawl up a hill, or any car now slower off '
      + 'the line or stuck in a gear.',
  },
  {
    id: 'trailer',
    added: '2026-11-21',
    name: 'The Scanyah trailer: towed on its pin, its own crash parts, its lamps at night',
    where: 'Test link + &trailer=1: the Scanyah R-Series (Lab, Test Track, a circuit), day and '
      + 'night; the garage TRAILER row (CURTAINSIDER HALF-FULL or WITHOUT)',
    try: 'Pull away, corner, brake hard, reverse; crash it: curtain sections, the rear doors, the '
      + 'under-run bar and a mudguard come off; at night its tail and brake lights at its back.',
    wrong: 'The trailer leaving its pin in normal driving, car parts (doors with windows, a '
      + 'bonnet) off it, lamps glowing under its nose, a dark trailer with the lights on.',
  },
  {
    id: 'gridlen',
    added: '2026-11-21',
    name: 'Grid slots as long as the vehicle: the towing rig at the back, buses spaced out',
    where: 'Test link + &gridlen=1&trailer=1: the Scanyah towing with AI on a circuit; the school '
      + 'bus with AI; the Scanyah alone on the Lab',
    try: 'At the lights nothing overlaps: your rig in the last slot, each bus a slot its own '
      + 'length; alone, the rig starts clear of the start posts. A grid of cars looks as before.',
    wrong: 'A trailer over another car or a post at the start, a grid of cars spread out more '
      + 'than before, or a rig not at the back of a grid.',
  },
  {
    id: 'labstart',
    added: '2026-11-21',
    name: 'The Lab start in the open, one spot for every vehicle',
    where: 'Test link + &labstart=1: the Lab (OG Lab) with a car, the bus and the Scanyah towing',
    try: 'Launch and drive straight off: nothing in the way, a street light row each side 7 m off.',
    wrong: 'A vehicle starting against a lamp or a cone, or the start box away from the car.',
  },
];
