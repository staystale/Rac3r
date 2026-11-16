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
    id: 'transitcustom',
    added: '2026-11-16',
    name: 'New car: the Fjord Transfit Custom (a Ford Transit Custom L1 H1), ROAD / Van, and in '
      + 'the traffic',
    where: 'Test link + &transitcustom=1: the garage, ROAD / Van; the highway (the four Transfits '
      + 'share the vans: the Custom the commonest); + &underskin=1&carparts=1 for a crash',
    try: 'Its look (the white van, the big black mirrors, shaded), its pull against the other '
      + 'Transfits, crash it: two cab doors, the nearside sliding door, the twin rear doors.',
    wrong: 'Not a Transit Custom from above, a car door off it, too common or rare in the traffic.',
  },
  {
    id: 'lowrange',
    added: '2026-11-16',
    name: 'Low range on the Defunder 110 and the Strange Rover: a HI / LO lever left of the speedo',
    where: 'Test link + &lowrange=1: the Defunder or the Strange Rover; mud, sand, a steep climb '
      + '(Holy Jeez, Slidden Hill, the Lab ramps)',
    try: 'Stop, tap LO (the lower half of the lever): more pull and a little more grip, a low top '
      + 'speed. Tap it above 10 km/h: the slot goes amber and says STOP. Climb and wade in HI and '
      + 'LO and compare. The first time, a LOW RANGE card explains it.',
    wrong: 'The lever covering anything, a tap on it steering the car, LO slower than HI where it '
      + 'is steep or boggy, gears hunting in LO, AI 4x4s stuck in LO on tarmac.',
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
    id: 'underskin',
    added: '2026-11-16',
    name: 'Under the skin, round 4: a crushed wheel corner open to the road, dark arms, strut over',
    where: 'Test link + &underskin=1: crash a closed car front-corner first (a hatch, a saloon, '
      + 'the Huracan) until the corner is pushed in to the wheel, then steer; side and rear too',
    try: 'The crushed wheel corner: the road seen through it, the dark arms and track rod under '
      + 'the tyre (as on the F1), the strut over it at the top of the arch (only its inner half '
      + 'until the corner is badly crushed), the wheel '
      + 'pushed in with the metal; steer - the wheel and track rod turn. Lose a wheel: its '
      + 'wishbone and strut lie under it on the road. ROLL a car: on its roof or side its '
      + 'underside shows the subframe, arms, drive shafts (driven wheels only) and track rods; a '
      + 'wheel torn off leaves them snapped short, and a front one throws its track rod too. A '
      + 'closed car on its roof loses no wheels; landing back on its wheels only that side\'s.',
    wrong: 'A dark block in the wheel arch, arms over the tyre, arms not reaching the wheel, a '
      + 'wheel floating off the car, the engine bay, door floor or boot floor not crumpling.',
  },
];
