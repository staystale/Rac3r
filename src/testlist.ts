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
    id: 'tesla',
    added: '2026-11-16',
    name: 'New car: the Teslur Model Why (the Tesla Model 3 Long Range AWD), ROAD / Saloon, and '
      + 'in the traffic',
    where: 'Test link + &tesla=1: the garage, ROAD / Saloon; a circuit, the highway (about 1 car '
      + 'in 260, as on the real roads); + &underskin=1 for a crash',
    try: 'Its look (Pearl White, the glass roof), the pull from a standstill (one gear, no '
      + 'shifts), lift off at speed (its regen slows it harder than an engine), no exhaust smoke, '
      + 'knock the bonnet off (the frunk), no Tesla at the petrol stations.',
    wrong: 'A gear change, revs at a standstill, smoke from the back, an engine under the bonnet, '
      + 'a Tesla at the pumps.',
  },
  {
    id: 'saxovtr',
    added: '2026-11-16',
    name: 'New car: the Citrone Saxo VTR (the road Saxo the Saxmax racers start from), ROAD / '
      + 'Hatch, and (rarely) in the traffic',
    where: 'Test link + &saxovtr=1: the garage, ROAD / Hatch; a circuit, a road stage; the '
      + 'highway (about 1 car in 15,000, as on the real roads); + &underskin=1 for a crash',
    try: 'Its look (Diablo Red, the small roof spoiler), 98 hp against the Golf and the Clio, '
      + 'crash it, roll it.',
    wrong: 'Not a Saxo from above, too quick or too grippy for 98 hp on budget tyres.',
  },
  {
    id: 'strange',
    added: '2026-11-16',
    name: 'New car: the Strange Rover (a Range Rover L322 4.4 V8), ROAD / SUV, and in the traffic',
    where: 'Test link + &strange=1: the garage, ROAD / SUV; a road stage, the highway (it shares '
      + 'the Land Rovers\' traffic with the Defunder); + &underskin=1 for a crash',
    try: 'Its look (silver, the black floating roof, the clamshell bonnet, the gills), a fast '
      + 'road, the gravel, crash it, roll it.',
    wrong: 'Not a Range Rover from above, a sports car\'s grip, too slow for 290 PS, rolling '
      + 'at every corner.',
  },
  {
    id: 'saxo',
    added: '2026-11-16',
    name: 'New car: the Citrone Saxo Max (the Saxo Kit Car, F2 1997-99), RALLY / 2L',
    where: 'Test link + &saxo=1: the garage, RALLY; a rally stage or rallycross',
    try: 'Its look, a stage against the Pugeot 306 Maxxi (it should be a little slower), '
      + 'gravel and tarmac, crash it.',
    wrong: 'Not a Saxo from above, quicker than the 306, twitchy on gravel.',
  },
  {
    id: 'routemonster',
    added: '2026-11-16',
    name: 'New car: the AEC Routemonster (a London Routemaster bus), ROAD / Bus',
    where: 'Test link + &routemonster=1: the garage, ROAD; the highway for it in the traffic',
    try: 'Drive it (top speed about 68 km/h), throw it into a corner, look for it in the '
      + 'traffic (about 1 in 250).',
    wrong: 'Not a Routemaster from above, too quick, rolls over far too easily, too common in '
      + 'the traffic.',
  },
  {
    id: 'ts010',
    added: '2026-11-16',
    name: 'New car: the Toyoter TS010 (Toyota\'s 1992 Group C car), PROTOTYPE / Group C',
    where: 'Test link + &ts010=1: the garage, PROTOTYPE; Le Manky for the straights',
    try: 'Its look, top speed (about 344 km/h), braking and grip in fast corners.',
    wrong: 'Undrivable, slower than the Porch, a shape that does not read as a Group C car.',
  },
  {
    id: 'rollguard',
    added: '2026-11-16',
    name: 'Rolling starts: green waits for the real line when the AI pole is far off the track',
    where: 'Test link + &rollguard=1: a race with a rolling start where an AI car is on pole',
    try: 'Start a few rolling-start races; nothing should look different (normal racing never '
      + 'puts the pole that far off).',
    wrong: 'A rolling start that never goes green, or goes green before the pole reaches the line.',
  },
  {
    id: 'transfitswb',
    added: '2026-11-16',
    name: 'New van: the Fjord Transfit SWB (a Ford Transit Mk7 SWB, 2006-13), ROAD / Van, and in '
      + 'the traffic; with it the L2 is named the Fjord Transfit MWB',
    where: 'Test link + &transfitswb=1 (with &transfitlwb=1 for all three): the garage, ROAD / '
      + 'Van; the highway traffic; + &underskin=1 for a crash',
    try: 'Its Mk7 nose (three chrome bars, tall lamps, grey bumpers) beside the MWB and the LWB, '
      + 'a drive, spot all three Transits in the traffic.',
    wrong: 'It reads as a short Mk8, too quick for 110 PS, too many or too few vans on the road.',
  },
  {
    id: 'cleoroad',
    added: '2026-11-16',
    name: 'New car: the Renolt Cleo RS 200 (a Renaultsport Clio 200 Cup, Clio III), ROAD / Hatch',
    where: 'Test link + &cleoroad=1: the garage, ROAD / Hatch; a circuit (Thruston, Brands '
      + 'Snatch); a road stage; + &underskin=1 for a crash',
    try: 'Its look (Liquid Yellow, the blade, twin pipes in the middle), the revs to 7,500, a lap '
      + 'against the Golf and the Focust, crash it, roll it.',
    wrong: 'Not a Clio 200 from above, quicker than the Focust, a racer’s grip on road tyres.',
  },
  {
    id: 'cleo',
    added: '2026-11-16',
    name: 'New car: the Renolt Cleo Cup (the Clio III Cup one-make racer, 2006-13), TOURING / '
      + 'One-make',
    where: 'Test link + &cleo=1: the garage, TOURING; a race at Thruston or Brands Snatch; '
      + '+ &underskin=1 for a crash; with &cleoroad=1 beside its road car, the RS 200',
    try: 'Its look (the road Clio III in white with a yellow roof), the revs to 7,500, no ABS on '
      + 'the brakes, a race against the Civvic (145 bhp down, 140 kg lighter), crash it, roll it.',
    wrong: 'Not a Clio Cup from above, faster than the Civvic, too much or too little grip for '
      + 'a small car on slicks.',
  },
  {
    id: 'focustlook',
    added: '2026-11-16',
    name: 'The Fjord Focust ST drawn as a five-door hatch from above',
    where: 'Test link + &focustlook=1: the garage (ROAD / Hatch), a race, the highway traffic',
    try: 'Look at it beside the Golf: the roof should run almost to the back, a short dark rear '
      + 'screen under the spoiler, no boot deck behind the glass.',
    wrong: 'Still reads as a saloon or a long-tailed hatch, the rear screen too long or gone.',
  },
  {
    id: 'fuelcarry',
    added: '2026-11-16',
    name: 'Traffic going for fuel that misses a station tries the next one',
    where: 'Test link + &fuelcarry=1: the highway (motorway, dual, Deaf Valley), petrol stations '
      + 'in the lay-bys',
    try: 'Watch a car indicating into the left lane before a station: if it is blocked or the '
      + 'pumps are taken, it stays in the left lane and pulls in at the next one. About 1 car in '
      + '8 passing a station should still pull in.',
    wrong: 'A car crawling in the left lane for miles, a queue forming behind one, cars pulling '
      + 'in much more often than before, a car swerving across lanes for the pumps.',
  },
  {
    id: 'underskin',
    added: '2026-11-16',
    name: 'Under the skin, round 4: a crushed wheel corner open to the road, dark arms, strut over',
    where: 'Test link + &underskin=1: crash a closed car front-corner first (a hatch, a saloon, '
      + 'the Huracan) until the corner is pushed in to the wheel, then steer; side and rear too',
    try: 'The crushed wheel corner: the road seen through it, the dark arms and track rod under '
      + 'the tyre (as on the F1), the strut over it at the top of the arch (only its inner half '
      + 'until the corner is badly crushed), the wheel '
      + 'pushed in with the metal; steer - the wheel and track rod turn. Lose a wheel: its '
      + 'wishbone and strut lie under it on the road.',
    wrong: 'A dark block in the wheel arch, arms over the tyre, arms not reaching the wheel, a '
      + 'wheel floating off the car, the engine bay, door floor or boot floor not crumpling.',
  },
];
