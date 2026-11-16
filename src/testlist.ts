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
    id: 'hudfit',
    added: '2026-11-16',
    name: 'Landscape HUD: compact temperature, FPS drops when short, ABS / TCS at the bottom',
    where: 'Test link + &hudfit=1: a race on a landscape phone, then turn it upright',
    try: 'Landscape: the temperature reads "30°C" beside the lap timer; on a short screen FPS is '
      + 'gone; ABS / TCS sit at the bottom just left of HAND - tap them. Upright: as before.',
    wrong: 'Anything changed upright, ABS / TCS hard to hit or hit by HAND taps, the column still '
      + 'reaching the pedals, the temperature unreadable.',
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
      + 'traffic (about 1 in 250).',
    wrong: 'Not a Routemaster from above, too quick, rolls over far too easily, too common in '
      + 'the traffic.',
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
