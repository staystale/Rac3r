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
    id: 'underskin',
    added: '2026-11-15',
    name: 'Under the skin: what a lost panel shows',
    where: 'Test link + &underskin=1: crash hard in any closed car (a hatch, the Huracan, the '
      + 'tractor) and in the F1 / F2, until a bonnet, a wing, a bumper or a boot comes off',
    try: 'Look into each hole: the engine and radiator under a bonnet, the suspension (strut, '
      + 'arms) and on a driven wheel the drive shaft in a wing well, the crash bar behind a '
      + 'bumper; an F1 sidepod its radiator.',
    wrong: 'A part drawn outside its hole or over the tyre, a front-drive car with drive shafts at '
      + 'the back (or the reverse), an engine where that car has none, holes odd at speed.',
  },
];
