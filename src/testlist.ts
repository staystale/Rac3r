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
    id: 'corolla',
    added: '2026-11-16',
    name: 'New car: the Toyoter Corolla BTCC (Toyota Gazoo Racing UK, NGTC), TOURING / BTCC',
    where: 'Test link + &corolla=1: the garage, TOURING / BTCC; a race at Thruston or Brands '
      + 'Snatch against the Civvic; + &underskin=1&carparts=1 for a crash',
    try: 'Its look (Gazoo white with the red roof and bands, the wing, shaded), its pace against '
      + 'the Civvic (the same power, a shorter car), no ABS on the brakes, crash it: four doors, '
      + 'the arches come off.',
    wrong: 'Not a Corolla BTCC from above, far quicker or slower than the Civvic.',
  },
  {
    id: 'f1menu',
    added: '2026-11-16',
    name: 'F1 vs WORLD in the menu: an F1 CIRCUITS type card (the Grand Prix calendar) above '
      + 'WORLD CIRCUITS (endurance, GT, mountain)',
    where: 'Test link + &f1menu=1: TEST MODE, the types screen',
    try: 'F1 CIRCUITS holds Sillystone GP, Moanaco, Spa, Monzarella, Snoozuka and Yass Marina; '
      + 'WORLD CIRCUITS holds Nordschlep, Le Manky and Bathworst; Sillystone National is still '
      + 'under CIRCUITS. Pick one from each and race it.',
    wrong: 'A track missing or listed twice, Spa anywhere but F1, the wrong card opening, or the '
      + 'menu remembering the wrong type after a race.',
  },
  {
    id: 'carshade',
    added: '2026-11-16',
    name: 'Shading, every closed car (batches 1-3) the TS010 way (lit crests, soft slopes, shadow '
      + 'at the glass and in the arches)',
    where: 'Test link + &carshade=1: the garage, every class; a race, a rally stage, the '
      + 'highway; compare with the plain link',
    try: 'The Golf, M135i, 3 Series, V70, Mini, Chevvy, Huracan, Focust, Cleo, Saxo, Strange Rover '
      + 'and Tesla; the WRZ, S1, Mikra, 306 Maxxi, Fiester RX, S13, Naffcar and F2 Stocker: the '
      + 'bonnet, roof and shoulders read as shapes; and the 911, Civvic, Cleo Cup, trophy truck, '
      + 'the Transfits, Defunder, Seven, bus and tractor (the F1, F2 and buggy left as they are).',
    wrong: 'Stripes that look like paint instead of light, lines over the lamps or glass, a car '
      + 'that looks dirtier rather than shaped.',
  },
  {
    id: 'carparts',
    added: '2026-11-16',
    name: 'Crash parts, steps 1-6: each car with its own doors (a 2-door two, a 4-door four), '
      + 'the vans and the bus with their own panels, the welded rear wings of road cars stay on',
    where: 'Test link + &carparts=1 (+ &underskin=1): side-swipe a 2-door (the Chevvy, the Mini, '
      + 'the Porch, the Clio, the Saxo) and a 4-door (the Golf, the 3 Series, the Defunder)',
    try: 'Hit a coupe hard at a rear corner side-on: it dents and loses glass, but no door comes '
      + 'off; a 4-door loses its rear door from behind the front one; the Seven never loses a '
      + 'door; the stock cars throw a windowless steel skin. The Transfits: two cab doors, the '
      + 'sliding door on the nearside only, the twin rear doors one at a time. The bus: the cab '
      + 'door (offside front), riveted side panels, the radiator grille, the staircase panel, '
      + 'more glass. A road car hit at a rear wheel keeps its rear wing (welded: it dents); the '
      + 'race cars, Defunder, Seven, trophy truck and tractor still lose theirs. Bumpers of their '
      + 'own: the vans black (Mk8) or grey (Mk7) plastic, the Defunder black steel, the trophy '
      + 'truck and the stock car steel tubes, the tractor its front weight; the Seven has none. '
      + 'Mirrors from where each car has them (a knocked-off one leaves the body edge, not a '
      + 'mirror still drawn), in their own colour, the vans big and black; none off the Seven, '
      + 'the trophy truck or the TS010. A hard hit at the back: the Defunder may throw its spare '
      + 'wheel (it rolls away); the Strange Rover loses the glass or the drop-down half of its '
      + 'split tailgate; the Huracan its engine cover (the V10 under it).',
    wrong: 'A 2-door throwing a second door, a door hole in the wrong place, a door far too short '
      + 'or long, a Seven door, a car door off the bus or a van.',
  },
  {
    id: 'reversefix',
    added: '2026-11-16',
    name: 'Reverse as in life, every car: traction control works going backwards, and the 20 km/h '
      + 'reverse cap holds',
    where: 'Test link + &reversefix=1: any car, any level (a powerful one shows it best: the '
      + 'Tesla, the Huracan, the 3 Series), on tarmac and on gravel',
    try: 'Hold reverse from a standstill: the car tops out at 20 km/h (it reached 23-32 before), '
      + 'with only a short chirp of wheelspin; TCS off lets the wheels spin a little more.',
    wrong: 'Reverse faster than about 20 km/h, a jolt at the cap, reverse that will not move off, '
      + 'the AI stuck reversing.',
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
