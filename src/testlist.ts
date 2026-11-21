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
    id: 'hwfan',
    added: '2026-11-21',
    name: 'Highway race start: cars hold their lane at the green, then fan out to their own side',
    where: 'Test link + &hwfan=1: a motorway race (rolling start) with racers and traffic',
    try: 'Watch the green: the two columns stay in their lanes, then the left column goes round '
      + 'slower cars to the left and the right column to the right.',
    wrong: 'The field sliding together into one lane at the green and weaving back, or cars '
      + 'leaving their lane while the car ahead is just as fast.',
  },
  {
    id: 'rollgreen',
    added: '2026-11-21',
    name: 'Rolling starts: each AI goes at its own reaction, a few jump the green, then race',
    where: 'Test link + &rollgreen=1: a rolling start (Naffcar, Dieatona, Stock Car, the highway)',
    try: 'Watch the green: the field breaks up, cars pull out and swap places in the first '
      + 'seconds instead of moving as one block. Count the crashes in the first corner.',
    wrong: 'The field still moving as a block, or far more crashes and pile-ups than before.',
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
];
