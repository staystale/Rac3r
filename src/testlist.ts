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
    id: 'desertroads',
    added: '2026-11-11',
    name: 'Deaf Valley motorways as the others: exits, bridges, services, reservation lamps',
    where: 'Test link + &desertroads=1 (+hwstations, medianlamps): DEAF VALLEY, any road',
    try: 'Drive 8 km: exits, WELCOME BRAKE services, sand-concrete road bridges, timber rail'
      + ' trestles with freight trains; lamps at night.',
    wrong: 'An exit or yard through a rock wall or gorge, junk on a slip, a footbridge or river.',
  },
  {
    id: 'hwstations',
    added: '2026-11-11',
    name: 'Petrol stations on the other roads; motorway services with their own slip road',
    where: 'Test link + &hwstations=1: Highway to Hull > COUNTRYSIDE: DUAL, SINGLE, MOTORWAY',
    try: 'Drive 5 km: SHALL, GULP ... stations; motorway: WELCOME BRAKE etc; pull in, reset.',
    wrong: 'A tree, lamp or Armco on a forecourt, OFF THE MOTORWAY on one, a reset not to it.',
  },
  {
    id: 'medianlamps',
    added: '2026-11-10',
    name: 'Street lights in the central reservation: twin-arm columns, none on the verges',
    where: 'Test link + &medianlamps=1: Highway to Hull, MOTORWAY or DUAL C/WAY, START HOUR night',
    try: 'Drive at night: a column every 68 m in the middle, a light over each side; hit one.',
    wrong: 'Lamps still on the verges, one side dark, a column in a lane or a gantry, lag.',
  },
  {
    id: 'desertmore',
    added: '2026-11-10',
    name: 'Deaf Valley junk + cactus by the LITTER slider; its own kinds, the countryside its own',
    where: 'Test link + &desertmore=1: Highway to Hull > DEAF VALLEY (set the LITTER slider)',
    try: 'LITTER 1, then OFF and 3: skulls, oil drums, bare tyres, wrecks, cactus - none to lots.'
      + ' Cactus outnumbering the drums on the dunes and canyon floors; the rock walls bare.',
    wrong: 'Pallets, tarps or tyres with wheels in the desert; junk on the road or in a wall; lag.',
  },
  {
    id: 'vergereset',
    added: '2026-11-10',
    name: 'Deaf Valley resets: the verge where you are, more lay-bys, never on the road',
    where: 'Test link + &vergereset=1: Highway to Hull > DEAF VALLEY > SINGLE LANE',
    try: 'Crash or RESET often: you land just off the road a few m back, or a lay-by just behind.',
    wrong: 'Put on the road, back to the same lay-by again, in a rock wall or over a drop.',
  },





  {
    id: 'trafficeven',
    added: '2026-11-10',
    name: 'Even traffic both ways, and faster cars coming up behind',
    where: 'Test link + &trafficeven=1: Highway to Hull, any road with traffic',
    try: 'Drive at the limit, then at 80 km/h: as many cars each way; the quicker ones pass you.',
    wrong: 'Cars popping in where you can see, too many your way, a pile-up behind you.',
  },
  {
    id: 'speeders',
    added: '2026-11-10',
    name: 'Speeders: now and then a car your way at 150-180 km/h, weaving like a racer',
    where: 'Test link + &speeders=1&trafficeven=1: Highway to Hull, any road with traffic',
    try: 'Drive a few km, fast and then slow: one blasts past from behind, or you catch one.',
    wrong: 'Too many, none at all, one driving through cars, crashing every time, lag.',
  },
  {
    id: 'breakdowns',
    added: '2026-11-10',
    name: 'Breakdowns: a car pulls onto the hard shoulder (the verge) and stops, hazards on',
    where: 'Test link + &breakdowns=1: Highway to Hull, MOTORWAY, then a country road',
    try: 'Drive a few km: cars stopped at the side with hazards; now and then one pulls over.',
    wrong: 'Stopped in a lane, in a wall or bush, vanishing as you come up, a queue behind it.',
  },
  {
    id: 'bathurst',
    added: '2026-11-10',
    name: 'Bathworst: the Mount Panorama Circuit at 1/2 (3.1 km), up the mountain and down',
    where: 'Test link + &bathurst=1: TEST MODE > WORLD CIRCUITS',
    try: 'A lap, then VS AI: up Mountain Straight, over Skyline, down the Esses, Conrod.',
    wrong: 'Cars flying off the crests, piling up on the walls, a wall across the road.',
  },
  // (approved 11-10, deleted: badwood, hudon, resethazard, sticksize, bushflat)
  // (approved late, deleted: fields, grassedge, catchthem, slipsdual, fps - TODO.md 1c; dirtroad,
  // animals, labext, labsplit, zoomhold, gpupaint, minimap, zoomspring, grassgrip, hwmap,
  // cracktufts, sharpcars, sharpmarks, jokerfix, groundlookup, exacttiles, hudmenu, tyreoff,
  // menufast, bundle, sound, joker, markedge, ainowait, judder, texwarm; straightoutta removed with
  // its level; stalecap, drawlite undone; dpr, startfix approved; onecanvas paused with the lean
  // plan; weather, rain, slidewear approved 2026-10-18; morepuddles, tyrefeel, packedwear,
  // onepuddle, wettrail approved 2026-10-18; coverfield, winter approved 2026-10-18 - labweather
  // superseded by the cover field; zoomswitch, mudfreeze, sanddig, wintercold, graveldig approved
  // 2026-10-18; tyrewear, wintertweaks passed 2026-10-18; coldsurface, wearchance, markfade,
  // hudunits, onelook, tyrecool, coverlook approved 2026-10-18; night (cost test) passed
  // 2026-10-18; lamps, daytime approved 2026-10-18; suntemp approved 2026-10-18; nightjudder,
  // glowmap, pauseclock, onelight passed 2026-10-18; gpuonly passed 2026-10-19; mudwater approved
  // 2026-10-24; skyblend, decklight, formation, weatheronly, raingrip, lockheat, gravelsand
  // approved 2026-10-24; hwlead, trafficease passed 2026-10-24; punctkind, shortgrass, grassblades
  // passed 2026-10-24; hwlamps passed 2026-10-24; trafficseat, sandboxwet, meltwater, icecrack
  // passed 2026-10-24; reverselights passed 2026-10-25 (owner: "slightly bright": beam 0.35 ->
  // 0.25, glow 0.7); eventlights passed 2026-10-25 (fairy lights moved off the road, board halo
  // faint); carlamps, woodmarshal, brakeglow, trees passed 2026-10-25 (brake heat now resets with
  // the tyres); bushes passed 2026-10-25 (round 2: more drag, a light dent, leaves over the cars);
  // flats (with the stingers, the rim by chance) and hedges (one continuous line) passed
  // 2026-10-25; flipramp passed 2026-10-25; impactsparks passed 2026-10-25 (round 2: 70 %, over 25
  // mph, directional); engine (radiator + engine heat, the leak as water, speedo lights, exhaust)
  // passed 2026-10-25); oil passed 2026-10-25; debris passed 2026-10-26; glasspop, oilwear passed
  // 2026-10-26; posthit passed 2026-10-26 (=1 picked over =hard); armcodent passed 2026-10-26;
  // waterspread, openwheel passed 2026-10-26; the 11-01 round - heavywet, menureset, markage (round
  // 2: 8 px cells, 16 steps), treenight, hwsnow, wheelgone (+ the spray fix), menucar, ainumbers -
  // passed 2026-11-02; wheelspin (the driving root fix: real wheel speed, real ABS) passed
  // 2026-11-02; evenlap, flatsize passed 2026-11-02; realism (K13 dials at brake 1, lock 1, grip
  // 0.5, power 1), pedalramp, lockfade, spinmarks, smokefade, musclegears, dustlinger passed
  // 2026-11-02; smokeover, heatease, flatgrip passed 2026-11-02; steerfeel (the SETTINGS steering:
  // curve + reach at speed) passed 2026-11-02, kept as player settings; towplus (the wake)
  // passed 2026-11-02; aicool, smokeearly, airfx, smokelinger, aidust, realcars, jokerhint,
  // puffpool, tyrehealth, pitsolid, muscletyres,
  // namefix, bhbridges, menustyle, testgarage, ai10, k12 passed
  // 2026-11-03; resetin, belly, agtyre, ai20, aifast, aisafe passed 2026-11-03; specsheet removed;
  // drycover, rimsoft, bushmark, leafpop passed 2026-11-04; aireact (AI R1), skillband, bhquiet,
  // aiweave (AI R2), jokerflow, aisliders (AI R3), hudlean,
  // aibands, puffroom, aigrip (AI R4 part 1), aidodge (AI R5),
  // ailines, ailook, dodgefar, markjump, halfcar, rejoinlook, hwshare, oneai (AI R8), brakeread
  // passed 2026-11-04; wetrace, lineback, onroad, rejoinfast, menurand (AI R7)
  // passed 2026-11-07; indyscale decided 2026-11-07 (3/4, the 13 m road) and removed; carpaint,
  // carlooks, carreal (the car look: paint parts, rims, redraws, real shapes), partsoff, bigparts,
  // hwlanes, hwbales, f1aero passed 2026-11-07; credits, bigbrands (the Brands venue) passed
  // 2026-11-08; fenceshred (catch fences tear and shred), partsover (the drive-over chance by
  // ground clearance), crossings (drivable bridges and tunnels), fencedrag passed 2026-11-08;
  // burstcap, tyresleep, stackvary (the crash bench: stacks 1-4 high, bursting by chance), linewall
  // (the line gives a wall by the edge room), tallfence, rollway (rolls the right way),
  // castlecumvenue (Castle Kum as the real venue), rollover (a fast tumble goes over low things),
  // rollbody (a rolled car drawn as a body in its real shape, every car), snotterton (Snetterton
  // as a venue: the 300, 200 and 100), sidedraft (a nose alongside a rear quarter takes the air off
  // its tail) passed 2026-11-08)
];
