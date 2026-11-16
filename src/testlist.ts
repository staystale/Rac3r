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
    id: 'm4gt3',
    added: '2026-11-16',
    name: 'New car: the BMV M4 GT3 (the BMW M4 GT3, G82), GT / GT3, the 911 GT3 R\'s rival',
    where: 'Test link + &m4gt3=1: the garage, GT; a race at Thruston, Brands Snatch or Spa with '
      + 'the Porch 911 GT3 Arr; + &underskin=1 for a crash',
    try: 'Its look (white, the M stripes, the kidneys, the big wing, shaded so the shape reads), '
      + 'the straight six\'s pull (700 Nm from low revs) against the 911\'s high revs, the '
      + 'braking, knock the boot lid off (the wing goes with it).',
    wrong: 'Not an M4 GT3 from above, much faster or slower than the 911, a front-engined car that '
      + 'turns like a rear-engined one.',
  },
  {
    id: 'reversefix',
    added: '2026-11-16',
    name: 'Reverse as in life, every car: traction control works going backwards, and the 20 km/h '
      + 'reverse cap holds',
    where: 'Test link + &reversefix=1: any car, any level (a powerful one shows it best: the Tesla '
      + 'with &tesla=1, the Huracan, the 3 Series), on tarmac and on gravel',
    try: 'Hold reverse from a standstill: the car tops out at 20 km/h (it reached 23-32 before), '
      + 'with only a short chirp of wheelspin; TCS off lets the wheels spin a little more.',
    wrong: 'Reverse faster than about 20 km/h, a jolt at the cap, reverse that will not move off, '
      + 'the AI stuck reversing.',
  },
  {
    id: 'tesla',
    added: '2026-11-16',
    name: 'New car: the Teslur Model Why (the Tesla Model 3 Long Range AWD), ROAD / Saloon, and '
      + 'in the traffic',
    where: 'Test link + &tesla=1: the garage, ROAD / Saloon; a circuit, the highway (about 1 car '
      + 'in 260, as on the real roads); + &underskin=1 for a crash',
    try: 'Its look (Pearl White, the glass roof), the pull from a standstill (one gear, no '
      + 'shifts; the rev bar follows the speed, red only near its 233 km/h), lift off at speed '
      + '(its regen slows it harder than an engine), no exhaust smoke, '
      + 'knock the bonnet off (the frunk), no Tesla at the petrol stations.',
    wrong: 'A gear change, revs at a standstill, smoke from the back, an engine under the bonnet, '
      + 'a Tesla at the pumps.',
  },
  {
    id: 'routemonster',
    added: '2026-11-16',
    name: 'New car: the AEC Routemonster (a London Routemaster bus), ROAD / Bus',
    where: 'Test link + &routemonster=1: the garage, ROAD; the highway for it in the traffic',
    try: 'Drive it (top speed about 68 km/h), throw it into a corner, look for it in the '
      + 'traffic (about 1 in 250); its wheels now under the body at their real tracks (hidden from '
      + 'above, as on the real bus), its big mirrors on arms at the front corners - knock them off '
      + 'side-on - and a hard corner hit throws about 4 times the glass of a car.',
    wrong: 'Not a Routemaster from above, too quick, rolls over far too easily, too common in '
      + 'the traffic, wheels sticking out, mirrors that never come off, as little glass as a car.',
  },
  {
    id: 'ts010',
    added: '2026-11-16',
    name: 'New car: the Toyoter TS010 (Toyota\'s 1992 Group C car), PROTOTYPE / Group C',
    where: 'Test link + &ts010=1: the garage, PROTOTYPE; Le Manky for the straights',
    try: 'Its look, reshaped from the real car: the four fender pods over the wheels, the '
      + 'narrow tub and teardrop canopy, the long tail under its wing, shaded so the curves read; '
      + 'top speed (about 344 km/h), braking and grip in fast corners.',
    wrong: 'Undrivable, slower than the Porch, a shape that does not read as a Group C car.',
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
