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
    id: 'hwchevron',
    added: '2026-11-15',
    name: 'Highway chevron boards: black and white, sharp bends only, never in a lay-by',
    where: 'Test link + &hwchevron=1: the single lane and the dual carriageway (most sharp bends), '
      + 'in the countryside and on Deaf Valley',
    try: 'Look for the boards on the outside of the sharp bends; hit one and see it fall; check '
      + 'the lay-bys and petrol stations have none.',
    wrong: 'Boards on gentle bends or straights, in a lay-by or by a station, on the inside of a '
      + 'bend, too few or too many to read the bends, or one that does not fall when hit.',
  },
  {
    id: 'aipace',
    added: '2026-11-15',
    name: 'AI PACE dial, and the AI DRIVERS dials live from the pause menu',
    where: 'Test link + &aipace=1: any race with AI cars (a circuit, rallycross, a stage, the '
      + 'highway); pause, then AI DRIVERS',
    try: 'Move PACE up and resume: the whole field should corner and brake harder and lap quicker '
      + '(x1.00 at the middle); move it down: they ease off. The other dials (skill, risk, '
      + 'mistakes ...) work mid-race too; RESET puts back what the race started with.',
    wrong: 'No change in the AI after moving a dial, the race jumping or cars teleporting on '
      + 'resume, PACE in the middle not matching the plain link, or the panel not fitting the '
      + 'screen.',
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
];
