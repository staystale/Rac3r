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
    id: 'tyrelights',
    added: '2026-11-12',
    name: 'Lights clear of tyres: no corner light and its tyre ring on top of a floodlight pylon',
    where: "Test link + &tyrelights=1: The Bird's Mess, Naffcar",
    try: "The Bird's Mess: the infield inside the long west sweeper; Naffcar: the east end's"
      + ' pylons. Any other level: look at the floodlights and their tyre rings.',
    wrong: "A tyre or prop over a light's base, two lights side by side, a corner floodlight"
      + ' with no tyre ring round it.',
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
