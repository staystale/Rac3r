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
    id: 'forestseed',
    added: '2026-11-15',
    name: 'Forest stage and other tracks built the same whatever you raced before',
    where: 'Test link + &forestseed=1: race a big circuit (Spa), then the stage generator\'s '
      + 'forest stage, a set rally stage and Croughed RX; then the same with a small one first '
      + '(Naffcar)',
    try: 'Look at the forest\'s edge on the stage and at the bales round Clervaux and Hawthorn on '
      + 'Croughed RX: both visits should look the same.',
    wrong: 'Trees or bales that come and go with the track raced before; anything else changed.',
  },
  {
    id: 'offroadwin',
    added: '2026-11-15',
    name: 'No highway race won by pulling away off the road',
    where: 'Test link + &offroadwin=1: a highway race with AI (endless, and 5 KM / 3 MIN), any '
      + 'road; phone upright and on its side',
    try: 'Get well ahead, then run on the verge or in the fields: PULLING AWAY should go; back '
      + 'on the road it counts again from 8. In a 5 KM / 3 MIN race, cross the line or let the '
      + 'clock run out off the road: that still counts.',
    wrong: 'A getaway win while off the road; PULLING AWAY not starting again on the road; a '
      + 'line or clock race not ending because you were off the road.',
  },
  {
    id: 'resetback',
    added: '2026-11-15',
    name: 'Resets never put you ahead, never onto a car, and leave the police',
    where: 'Test link + &resetback=1: a circuit race, rallycross (the joker lane too), a rally '
      + 'stage, the highway with traffic and police, the Test Lab; phone upright and on its side',
    try: 'Go off, drive back down the grass, then RESET; reset with a rival on the spot; on the '
      + 'highway go the wrong way, go far off the road, and RESET with the police behind you.',
    wrong: 'A reset that puts you further on than you were, onto or into a car, or makes a '
      + 'police car vanish; a reset onto the other carriageway or off the road.',
  },
  {
    id: 'wrongway',
    added: '2026-11-15',
    name: 'Highway WRONG WAY reset waits: turn round, reverse a little, get knocked back',
    where: 'Test link + &wrongway=1: any highway (motorway, twisty, Deaf Valley), alone and in '
      + 'a race; phone upright and on its side',
    try: 'Stop and reverse 10-15 m; spin round and turn back the right way; then drive the '
      + 'wrong way on purpose and hold it.',
    wrong: 'WRONG WAY firing while you reverse a little or turn round; driving the wrong way '
      + 'on purpose not reset within about 4 s / 50 m.',
  },
  {
    id: 'tyresmoke',
    added: '2026-11-14',
    name: 'Tyre smoke only past grip, by each tyre\'s own heat window (all four tyres alike)',
    where: 'Test link + &tyresmoke=1: any circuit (Thruston, Spa) and the Test Lab, any car, '
      + 'aids on and off; try it without the switch to compare',
    try: 'Race a few fast laps hard, then a burnout, donuts, a locked-wheel stop from speed and '
      + 'a long hot slide. Fronts and rears should follow one rule.',
    wrong: 'Smoke from tyres that are gripping (a clean fast corner, a normal stop with ABS), '
      + 'or burnouts, donuts, lock-ups and hot slides with clearly less smoke than before.',
  },
  {
    id: 'hudclear',
    added: '2026-11-14',
    name: 'Your car is never under a button, panel or pedal',
    where: 'Test link + &hudclear=1: a highway (twisty, Deaf Valley, any), a circuit, a rally '
      + 'stage, rallycross, the Test Lab; phone upright and on its side',
    try: 'Drive through bends on the highway with the phone upright: the car stays clear of '
      + 'the ABS / TCS chips and the pedals. Try every mode and both ways round.',
    wrong: 'Any part of your car under a button, chip, pedal, panel or the minimap; the view '
      + 'jumping or twitching near the HUD; the car pushed off the screen.',
  },
  {
    id: 'bootbar',
    added: '2026-11-15',
    name: 'A loading bar from the first moment the page opens',
    where: 'Test link + &bootbar=1: open or reload it (twice: the 2nd is paced on the 1st)',
    try: 'Watch from the blank page to the menu: pane, LOADING, the logo (or RAC3R with a big '
      + 'blue 3 until it comes), the bar filling.',
    wrong: 'The old "RAC3R loading..." shown, the bar still or jumping, two screens, no blue '
      + 'flash, the menu slower to come than without the switch, a tap passing through.',
  },
];
