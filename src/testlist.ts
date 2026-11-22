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
    id: 'ghost',
    added: '2026-11-22',
    name: 'Ghost cars: race your best lap (test mode), and SETTINGS > ACCOLADES',
    where: 'Test link + &ghost=1: TEST MODE, any track but the highways (a rally stage too); the '
      + 'setup GHOST switch; SETTINGS > ACCOLADES',
    try: 'Solo, GHOST on: drive a few laps - from the next lap a see-through car drives your best '
      + 'one; come back later, it is still there. VS AI it starts off. ACCOLADES lists your '
      + 'fastest laps per track and car.',
    wrong: 'The ghost hitting or being hit, out of step with the lap clock, a wrong car, on a '
      + 'highway, or a best lost after leaving the track.',
  },
  {
    id: 'spikespeak',
    added: '2026-11-22',
    name: 'SPIKES PEAK, the hill climb: the real 10 km road at half scale, climbing 718 m',
    where: 'Test link + &spikespeak=1: TEST MODE, RALLY STAGES (or ALL TRACKS), Spikes Peak, SOLO',
    try: 'Drive it start to summit: the road and its 23 hairpins, the climb, the time; tell us if '
      + 'it is too long.',
    wrong: 'A kink or a gap in the road, a hairpin you cannot get round, the ground stepping, the '
      + 'car floating or sinking, or a stutter as you drive.',
  },
  {
    id: 'stagehold',
    added: '2026-11-22',
    name: 'Rally stage: every car held until its own green - no jump start, you or the AI',
    where: 'Test link + &stagehold=1: TEST MODE, a rally stage, VS AI',
    try: 'Hold the throttle through the countdown: the car moves only on GO; cars behind leave '
      + 'on their own green.',
    wrong: 'Any car moving before its green, a car stuck after it, or a circuit start changed.',
  },
  {
    id: 'stagepos',
    added: '2026-11-22',
    name: 'Rally stage: P n/N from the times so far at the same distance, like live timing',
    where: 'Test link + &stagepos=1: TEST MODE, a rally stage, VS AI 5 (start mid-field)',
    try: 'Watch P n/N as you drive: it moves as you gain or lose time on the cars ahead; N is the '
      + 'whole field; at your finish it matches the results.',
    wrong: 'P that disagrees with the gaps you see, N shrinking as cars finish, or your place '
      + 'at the finish different from the results.',
  },
  {
    id: 'stagetracks',
    added: '2026-11-22',
    name: 'Rally stage: tyre tracks of the cars that started before you, from the start line',
    where: 'Test link + &stagetracks=1: TEST MODE, Sweaty Lamb, VS AI 5 (start 2nd or later)',
    try: 'Look at the gravel ahead after the start: ruts from the cars ahead, each its own line, '
      + 'running into each car where you catch up with it.',
    wrong: 'No ruts on gravel, ruts on tarmac, ruts off the road or straight through bends, or a '
      + 'stutter at the start.',
  },
  {
    id: 'stagetimes',
    added: '2026-11-22',
    name: 'Rally stage: a car already home is timed at the AI driven pace, not the prediction',
    where: 'Test link + &stagetimes=1: TEST MODE, Sweaty Lamb, VS AI 5 (start 5th or 6th)',
    try: 'Restart until you start late (cars home before your green); drive it; read the results.',
    wrong: 'Home cars always on top (they were), or always last, or far off the driven times.',
  },
];
