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
    id: 'aireset',
    added: '2026-11-15',
    name: 'AI put back after a crash or a roll never ahead, never onto a car',
    where: 'Test link + &aireset=1: a busy race with AI (a full grid at Brands or Knobhill RX, a '
      + 'stage, the highway) - wherever AI cars crash hard or roll',
    try: 'When a wrecked or rolled AI car is put back on the road, it should appear at or behind '
      + 'where it crashed, and behind any car already there - as your own reset does.',
    wrong: 'An AI put back further up the road than where it crashed, landing on another car, or '
      + 'put back far behind for no reason.',
  },
  {
    id: 'aislide',
    added: '2026-11-15',
    name: 'AI slides by the ground, uses kerbs, makes sliding mistakes',
    where: 'Test link + &aislide=1: a slippery stage or track with 2WD AI cars (rear-drive hatch, '
      + 'F2) - gravel or sand (Sweaty Lamb, a rally stage), or snow / ice weather; then a tarmac '
      + 'circuit for the kerbs',
    try: 'Watch the AI through corners: on loose ground and ice they should hold slides and still '
      + 'be quick; on tarmac a wheel on the kerbs; weaker drivers now and then sliding wide.',
    wrong: 'AI slower or spinning off far more on ice / snow, sliding on dry tarmac, cutting '
      + 'across the grass instead of the kerb, or no visible change on gravel.',
  },
  {
    id: 'hwmap',
    added: '2026-11-15',
    name: 'Highway minimap: slip roads, petrol pumps, police dots',
    where: 'Test link + &hwmap=1: a highway (the motorway, and Deaf Valley) with traffic, the '
      + 'minimap on',
    try: 'Watch the minimap: slip roads, side roads and junctions as thin lines leaving the road; '
      + 'a small green pump at each petrol station; police as blue dots, flashing once they chase '
      + 'you or anyone.',
    wrong: 'A pump or road line in the wrong place or missing; dots flashing with no chase or '
      + 'steady in one; lines for footpaths or railways; the map harder to read or the game '
      + 'slower.',
  },
];
