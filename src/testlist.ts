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
    name: 'More damage 2, items 4 and 3: an exhaust or a torn bumper left HANGING; steam and '
      + 'leaks from the real radiator and sump',
    where: 'Test link + &dmgmore2=1: crash a hatch or a saloon tail-first hard, then drive on '
      + '(tarmac, then grass); crash a hatch and the Sport quattro S1 nose-first, then park',
    try: 'About half the time the exhaust hangs instead of flying off: its end trails behind the '
      + 'tail, sparking on tarmac, and drops after 100-400 m (or the next hit at the back). A torn '
      + 'bumper\'s hanging piece drags paint chips off its end and falls off by itself. A cracked '
      + 'radiator steams where it is (the S1 at its tail), more with its panel off; the water and '
      + 'oil drip under the radiator and the engine; a harder crash, or a second, leaks faster.',
    wrong: 'An exhaust that never drops, sparks on grass, sparks off a bumper, a piece that hangs '
      + 'on after it dropped, the Tesla or an open car dragging an exhaust; steam off the S1\'s '
      + 'nose, puddles in the wrong place.',
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
];
