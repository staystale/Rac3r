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
    id: 'sliddenhillvenue',
    added: '2026-11-09',
    name: 'Slidden Hill as the real venue (Lydden Hill) at 1/2 size: rallycross and circuit',
    where: 'Link + &sliddenhillvenue=1: RALLYCROSS > Slidden Hill; UK CIRCUITS > ... Circuit',
    try: 'Race the rallycross from the start straight: the gravel loop, the joker round Chessons.',
    wrong: 'A joker not counted, a car stuck on the start straight or gravel, a road on the track.',
  },
  {
    id: 'knobhillvenue',
    added: '2026-11-09',
    name: 'Knobhill as the real venue (Knockhill) at 1/2 size: the rallycross and the circuit',
    where: 'Test link + &knobhillvenue=1: RALLYCROSS > Knobhill; UK CIRCUITS > Knobhill Circuit',
    try: 'Race the rallycross: the gravel, the joker round the hairpin; lap the circuit.',
    wrong: 'A joker not counted, a car stuck at the gravel, a road or prop on the track.',
  },
  {
    id: 'canyon',
    added: '2026-11-08',
    name: 'Deaf Valley: the endless road as a desert canyon - rock walls, cactus, open desert',
    where: 'Test link + &canyon=1: TEST MODE > ROADS > Deaf Valley (no traffic yet: round 2)',
    try: 'Drive it fast through the canyons and the open desert; hit a wall, a saguaro.',
    wrong: 'A wall end facing the road, gaps in a wall, a cactus on the road, bad walls look.',
  },
  {
    id: 'dieatona',
    added: '2026-11-08',
    name: 'Dieatona (the Daytona parody) at 1/2 size: the banked tri-oval and the road course',
    where: 'Test link + &dieatona=1: TEST MODE > OVALS > Dieatona / Dieatona Road Course',
    try: 'Lap the banking flat out; the pits, Lake Lloyd, the tunnels, the road course infield.',
    wrong: 'A car launched off the banking, a road over the track, a barrier gap, a stuck tunnel.',
  },
  {
    id: 'thrustonvenue',
    added: '2026-11-08',
    name: 'Thruston as the real venue (Thruxton) at 1/2 size, the airfield inside it',
    where: 'Test link + &thrustonvenue=1: TEST MODE > UK CIRCUITS > Thruston',
    try: 'Lap it; look at the pits, the tunnel under the start straight, Club, the Complex.',
    wrong: 'A road or prop on the track, a barrier gap, a road to nowhere, a broken tunnel.',
  },
  {
    id: 'roofflaps',
    added: '2026-11-08',
    name: 'Naffcar roof flaps: two plates pop up on the roof when it goes backwards fast',
    where: 'Test link + &roofflaps=1: the Naffcar, Stock Car oval or any track',
    try: 'Spin it over 90 km/h so it slides backwards; watch the roof as it comes round.',
    wrong: 'Flaps up when driving normally, never up in a fast spin, or stuck up after it stops.',
  },
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
