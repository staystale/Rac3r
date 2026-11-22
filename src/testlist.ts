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
    id: 'queuefit',
    added: '2026-11-22',
    name: 'Generated rally stage: all five cars queued behind you at the start',
    where: 'Test link + &queuefit=1: TEST MODE, RALLY STAGES, the stage generator, VS AI 5 (1st)',
    try: 'Start first and look behind: five cars in the queue, each moving up and going on its '
      + 'own green.',
    wrong: 'A car missing from the queue, one parked off the road far away, or one stuck.',
  },
  {
    id: 'pitstops',
    added: '2026-11-22',
    name: 'Pit stops (your car): the pit lane, limiter, your box, the PIT STOP menu, GO',
    where: 'Test link + &pitstops=1: TEST MODE, an F1 car VS AI over 3+ laps at a circuit with '
      + 'a pit lane (Brands, Sillystone, Le Manky...); the setup PIT STOPS row',
    try: 'Turn into the pit lane (the PIT LIMITER light, 60 km/h), stop in your box (your grid '
      + 'slot), pick tyres / repair, CONFIRM & GO: held for the work, then GO. A RESET in the pit '
      + 'lane: back at its entrance. Skip the stop in a dry F1 race: +30 s.',
    wrong: 'No menu in your box, the menu in the wrong box, the race stopping while it is open, '
      + 'the limiter off on the lane or on the track, or a reset leaving you in the pit lane.',
  },
  {
    id: 'spikecap',
    added: '2026-11-22',
    name: 'Smoother busy races: a slow frame no longer makes the next ones stutter',
    where: 'Test link + &spikecap=1: Moanaco (or any circuit) with a full F1 field',
    try: 'Race in the pack for a few laps: fewer hitches, the LOW fps figure higher.',
    wrong: 'Cars or the race clock visibly slowing down, or a stutter right after a hitch.',
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

];
