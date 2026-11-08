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
  // ground clearance), crossings (drivable bridges and tunnels), fencedrag passed 2026-11-08)
  {
    id: 'burstcap',
    added: '2026-11-08',
    name: 'Pile-ups: a tyre stack holds together once ~400 loose objects are already moving',
    where: 'Test link + &burstcap=1: TEST MODE > Test > Festival of Splat (&report=1 to measure)',
    try: 'Watch the 20-car crash into the tyre wall; run it with and without the switch.',
    wrong: 'Stacks that never burst in a small crash, cars hurt worse, a lower frame rate.',
  },
  {
    id: 'stackvary',
    added: '2026-11-08',
    name: 'Tyre stacks 1-4 high (taller: longer shadow), bursting by chance - harder hit, likelier',
    where: 'Test link + &stackvary=1: any level with tyre walls; Festival of Splat',
    try: 'Look at a tyre wall, then nudge and hit stacks gently and hard.',
    wrong: 'Shadows wrong or floating, a gentle nudge bursting a stack, a hard hit never bursting.',
  },
  {
    id: 'tyresleep',
    added: '2026-11-08',
    name: 'Pile-ups: tyres sliding flat stop a little sooner (at 0.25 m/s, was 0.05)',
    where: 'Test link + &tyresleep=1: TEST MODE > Test > Festival of Splat',
    try: 'Watch the thrown tyres settle after the crash; knock tyres on a circuit.',
    wrong: 'Tyres stopping dead or jerking to a halt, a tyre wall that looks frozen.',
    id: 'castlecumvenue',
    added: '2026-11-08',
    name: 'Castle Cum as the real venue (Castle Combe) at 1/2 size, the real Armco and fences',
    where: 'Test link + &castlecumvenue=1: TEST MODE > UK CIRCUITS > Castle Cum',
    try: 'Lap it, look round: Quarry + Tower tyre walls, catch fences, pits, paddock, skid pan.',
    wrong: 'A road or prop on the track, a gap in a barrier, a road to nowhere, a wire fence.',
  },
];
