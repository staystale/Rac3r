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
    id: 'barriercull',
    added: '2026-11-13',
    name: 'Barriers drawn only where on screen: a faster frame on long Armco runs',
    where: 'Test link + &barriercull=1: any level, X Gayms (L.A. Lively) at night most',
    try: 'A race with a full grid, by day and at night; drive along the Armco and catch'
      + ' fences, crash into a rail to dent and tear it.',
    wrong: 'A barrier missing, cut short or flickering at the screen edge, posts jumping, a'
      + ' gap or a kink in a rail, a lower frame rate than without the switch.',
  },
  {
    id: 'xgaymsprops',
    added: '2026-11-13',
    name: 'L.A. Lively dressed like the stadiums: even Armco, tidy tunnel mouths, a paddock',
    where: 'Test link + &xgaymsprops=1: TEST MODE > RALLYCROSS > L.A. Lively',
    try: 'A race with a full grid, day and night: the tunnel mouths both ways, the jump, the'
      + ' paddock east of the hall, fans and a TV tower by the jump, fans at the start.',
    wrong: 'A kink or step in the Armco, an end meeting nothing, a wall end sticking out at a'
      + ' tunnel mouth, a prop on the road, a barrier, a lamp or a flag, a slower frame.',
  },
  {
    id: 'jokerclear',
    added: '2026-11-13',
    name: 'No hay bales blocking the joker, in or out (X Gayms)',
    where: 'Test link + &jokerclear=1: TEST MODE > RALLYCROSS > L.A. Lively',
    try: 'Take the joker a few times, flat out in and out, and watch the AI take it.',
    wrong: 'A bale or tyre where you go into or out of the joker, a gap in the bales'
      + ' between the joker and the lap you could cut through.',
  },
  {
    id: 'jokerarrow',
    added: '2026-11-13',
    name: 'Joker arrows: the first points into it, the second tips into its bend (X Gayms)',
    where: 'Test link + &jokerarrow=1: TEST MODE > RALLYCROSS > L.A. Lively',
    try: 'Drive up to the joker (north-east, past the north street) and follow the arrows.',
    wrong: 'An arrow pointing at a barrier, the lap or off the road, either arrow hard to see.',
  },
];
