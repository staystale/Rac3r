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
    id: 'resetclean',
    added: '2026-11-21',
    name: 'Reset after a crash: never rolled again, never left moving, overturned or stuck',
    where: 'Test link + &resetclean=1: any circuit or RX course (Thruston, Knobhill, Croughed RX)',
    try: 'Crash hard into a barrier or roll the car, and press RESET while it is still rolling or '
      + 'sliding: it lands on its wheels, still, and pulls away at once.',
    wrong: 'A car rolling, sliding or upside down after a reset, or one that cannot pull away on '
      + 'tarmac; the camera sliding over from where you crashed.',
  },
  {
    id: 'lamps',
    added: '2026-11-21',
    name: 'Each vehicle\'s own headlights: the beam from its nose, nothing lit on its own bonnet',
    where: 'Test link + &lamps=1 at night: a hatch, the Transfit, the Routemonster, the Seven',
    try: 'The beam starts at the lamps: the bonnet, the van\'s cab and the bus stay dark behind '
      + 'them; the bus and van reach a little further, the Seven and the tractor shorter.',
    wrong: 'Light on the car\'s own body behind its lamps, a beam starting ahead of the nose, a '
      + 'beam off to one side.',
  },
];
