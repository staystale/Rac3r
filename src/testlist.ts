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
    id: 'jokerarrow',
    added: '2026-11-13',
    name: 'Joker arrows: the first points into it, the second tips into its bend (X Gayms)',
    where: 'Test link + &jokerarrow=1: TEST MODE > RALLYCROSS > L.A. Lively',
    try: 'Drive up to the joker (north-east, past the north street) and follow the arrows.',
    wrong: 'An arrow pointing at a barrier, the lap or off the road, either arrow hard to see.',
  },
  {
    id: 'cutroad',
    added: '2026-11-13',
    name: 'The road under a crossover bridge looks like the rest of the track',
    where: 'Test link + &cutroad=1: X Gayms (L.A. Lively) and the stadiums, under the bridge',
    try: 'Race through the cut under the bridge, both ways, day, night and in the wet: the'
      + ' road going down to the tunnel.',
    wrong: 'Flat dark bands across the road in the cut, a step or seam where it starts, the'
      + ' lines or the wear stopping at the cut, grass or pavement showing in it.',
  },
  {
    id: 'xgaymsloose',
    added: '2026-11-13',
    name: 'L.A. Lively re-laid looser: mixed corners, bending streets, free lines on the dirt',
    where: 'Test link + &xgaymsloose=1: TEST MODE > RALLYCROSS > L.A. Lively',
    try: 'A race with a full grid, day and night: the west lot hairpin, the fast sweep into the'
      + ' east lot, the corner that tightens onto the north street, the joker and its jump.',
    wrong: 'A corner that still reads square, a kink or fold in the road, a car stuck, Armco'
      + ' ending in the open, anything on the road, the jump not cleared from 60 km/h.',
  },
];
