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
    id: 'contactcost',
    added: '2026-11-22',
    name: 'AI weigh contact when picking a line: no rear-ending, no chopping a car alongside',
    where: 'Test link + &contactcost=1: any circuit with a full field; the motorway with racers',
    try: 'Race in a pack: AI pick gaps that do not run into the back of a car, do not squeeze a '
      + 'car alongside and do not pull across a car just behind them; they still race close.',
    wrong: 'AI too timid to take a line they are ahead on, never defending, or the same contact '
      + 'as before.',
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
