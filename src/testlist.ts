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
    id: 'nojump',
    added: '2026-11-22',
    name: 'No early starts anywhere: every car, you and the AI, held until the green',
    where: 'Test link + &nojump=1: any race VS AI - a circuit, RX, an oval, the highway',
    try: 'Hold the throttle through the lights: nothing moves before GREEN; on a rolling '
      + 'start no AI jumps it.',
    wrong: 'Any car moving before the green, a car stuck after it, or the start feeling late.',
  },
  {
    id: 'stageplace',
    added: '2026-11-22',
    name: 'Rally stage: cars that started before you placed at their driven pace',
    where: 'Test link + &stageplace=1: TEST MODE, a rally stage, VS AI 5 (start 3rd or later)',
    try: 'Drive the stage and read the results: the cars ahead of you in the order should have '
      + 'times like the cars that drove the whole stage.',
    wrong: 'Cars ahead always far quicker than the rest (as before), or a car appearing past '
      + 'the finish.',
  },
  {
    id: 'stageline',
    added: '2026-11-22',
    name: 'Rally stage: the next car creeps up to the line and leaves on its own green',
    where: 'Test link + &stageline=1: TEST MODE, a rally stage, VS AI 5 (start 1st)',
    try: 'Start 1st and watch behind you: the queue moves up a place, the next car stops on '
      + 'the line and goes on its own green; everyone timed from their green.',
    wrong: 'Cars driving off from back in the queue, bumping, creeping past the line, or '
      + 'times that look short by a second or two.',
  },
  {
    id: 'gantrylights',
    added: '2026-11-22',
    name: 'Start gantries show the countdown and the green, on every track',
    where: 'Test link + &gantrylights=1: any race with a start gantry (stages, Knobhill, '
      + 'Naffcar, circuits)',
    try: 'Watch the gantry at the start: dark, then reds one a second, then green, then dark; on a '
      + 'stage it counts each later car down at the line.',
    wrong: 'The gantry red all the time (as before), lights out of step with the HUD lights, or a '
      + 'finish gantry counting down.',
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
    id: 'stagetracks',
    added: '2026-11-22',
    name: 'Rally stage: tyre tracks of the cars that started before you, from the start line',
    where: 'Test link + &stagetracks=1: TEST MODE, Sweaty Lamb, VS AI 5 (start 2nd or later)',
    try: 'Look at the gravel ahead after the start: ruts from the cars ahead, each its own line, '
      + 'running into each car where you catch up with it.',
    wrong: 'No ruts on gravel, ruts on tarmac, ruts off the road or straight through bends, or a '
      + 'stutter at the start.',
  },
];
