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
    id: 'softback',
    added: '2026-11-22',
    name: 'AI: every return to the racing line is smooth (moves out stay free)',
    where: 'Test link + &softback=1: any circuit with a full field',
    try: 'Watch cars after a dodge, an overtake or running wide: they ease back onto the line.',
    wrong: 'Cars snapping back across the track, or now slow to get out of the way of a crash.',
  },
  {
    id: 'brakepedal',
    added: '2026-11-22',
    name: 'AI: a steady brake pedal through a braking zone (no dabbing), at the usual braking point',
    where: 'Test link + &brakepedal=1 (without &aitune=1): any circuit with a full field',
    try: 'Follow AI into heavy braking zones: one smooth stop, no on-off-on brake lights.',
    wrong: 'Brake lights flickering on and off into a corner, or AI overshooting corners.',
  },
  {
    id: 'gapdest',
    added: '2026-11-21',
    name: 'Racers aim for a gap more than one step across instead of sitting boxed in',
    where: 'Test link + &gapdest=1: the motorway with racers and traffic; any circuit with a field',
    try: 'Follow racers in traffic: they move across to a roomier lane instead of sitting behind '
      + 'a slower car with a clear lane beside.',
    wrong: 'Racers still sitting behind traffic with a lane free, or cutting across into cars.',
  },
  {
    id: 'gapcommit',
    added: '2026-11-21',
    name: 'Lanes: racers weave for gaps; each speeder somewhere from lane-keeping to racer-like',
    where: 'Test link + &gapcommit=1 (best with &gapdest=1): the motorway with racers and speeders',
    try: 'Racers leave a blocked lane for a roomier one; speeders vary, some keep their lane, '
      + 'some weave like racers.',
    wrong: 'Racers or speeders darting lane to lane for no gain, or sideswiping traffic.',
  },
  {
    id: 'aitune',
    added: '2026-11-21',
    name: 'AI tune: later, steady braking; followers and closer running (first try)',
    where: 'Test link + &aitune=1: any circuit with a full AI field; the motorway with racers',
    try: 'Race a few laps: AI brake later and smoothly, no dabbing or braking mid-straight, '
      + 'followers close up without panic-braking. Note crashes on tight or loose tracks.',
    wrong: 'AI braking on straights, crashing into corners or each other far more than before, '
      + 'or slower laps.',
  },
  {
    id: 'stockholm',
    added: '2026-11-21',
    name: 'GETAWAY STOCKHOLM: the city scenery (reworked)',
    where: 'Test link + &stockholm=1: TEST MODE > ENDLESS ROADS > GETAWAY STOCKHOLM, any road',
    try: 'Drive: city blocks, slatted tunnels, long bridges over water, embankments, cuttings.',
    wrong: 'Buildings on the road or a slip, a wall across a way in, an empty city, a bad sign.',
  },
  {
    id: 'copmix',
    added: '2026-11-21',
    name: 'Police by scenery: few in the countryside, some in Deaf Valley, most in Stockholm',
    where: 'Test link + &copmix=1 (&stockholm=1 for Stockholm): an endless road in each scenery',
    try: 'Drive a few km in each, legal then fast, and count the police cars you meet.',
    wrong: 'As many police in the countryside as before, or fewer in Stockholm than before.',
  },
  {
    id: 'keepright',
    added: '2026-11-22',
    name: 'GETAWAY STOCKHOLM drives on the RIGHT (keep right, overtake on the left)',
    where: 'Test link + &stockholm=1&keepright=1: GETAWAY STOCKHOLM, any road, with AI and traffic',
    try: 'Race: our way on the right, slips and lay-bys off the right, the traffic keeps right.',
    wrong: 'A car on the wrong side, a slip or sign on the left, indicators the wrong way.',
  },
];
