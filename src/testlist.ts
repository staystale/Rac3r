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
    id: 'rxguide',
    added: '2026-11-15',
    name: 'Rallycross walkthrough: "Not every rallycross has a joker."',
    where: 'Test link + &rxguide=1: a rallycross race with a joker (Knobhill RX, RX RACE), its '
      + 'walkthrough (pause menu, or the first time)',
    try: 'Read the first RALLYCROSS step. Then Croughed RX: no joker steps, no joker in the '
      + 'lap box.',
    wrong: 'The sentence missing or cut off, the box overlapping the lap panel, a joker step or '
      + 'joker line on Croughed RX.',
  },
  {
    id: 'forestseed',
    added: '2026-11-15',
    name: 'Forest stage and other tracks built the same whatever you raced before',
    where: 'Test link + &forestseed=1: race a big circuit (Spa), then the stage generator\'s '
      + 'forest stage, a set rally stage and Croughed RX; then the same with a small one first '
      + '(Naffcar)',
    try: 'Look at the forest\'s edge on the stage and at the bales round Clervaux and Hawthorn on '
      + 'Croughed RX: both visits should look the same, Croughed RX with all its bales and tyre '
      + 'stacks there both times.',
    wrong: 'Trees or bales that come and go with the track raced before; bare grass round '
      + 'Clervaux and Hawthorn where bales were; anything else changed.',
  },
  {
    id: 'wantedlost',
    added: '2026-11-15',
    name: 'Police: WANTED LEVEL LOST when you shake them off (was LOST THEM)',
    where: 'Test link + &wantedlost=1: a highway, speed past a camera or hit a car till the police '
      + 'chase, then get away; phone upright and on its side',
    try: 'Lose the police and read the notice.',
    wrong: 'LOST THEM still shown; the notice cut off or over a button or panel.',
  },
  {
    id: 'weathermobile',
    added: '2026-11-15',
    name: 'Weather notices only on MOBILE difficulty; the weather itself unchanged',
    where: 'Test link + &weathermobile=1: any track, weather SEASON, a long session or race; once '
      + 'with MOBILE, once with any other difficulty',
    try: 'Wait for the rain to start or stop (a few minutes).',
    wrong: 'RAIN STARTING (or any weather notice) shown on GAME, REALISH, RICH or REAL; none on '
      + 'MOBILE; the rain coming or going differently from before.',
  },
  {
    id: 'menunan',
    added: '2026-11-15',
    name: 'The menu race\'s own car never frozen at the start',
    where: 'Test link + &menunan=1: open the game to the main menu many times (reload), phone '
      + 'upright mostly; also with the game started from the home screen',
    try: 'Watch the race behind the menu each time: every car, the one the camera follows too, '
      + 'pulls away.',
    wrong: 'The camera\'s car standing still at the start while the others race; any other '
      + 'change to the menu race or to driving.',
  },
];
