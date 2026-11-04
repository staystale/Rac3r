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
  // aibands, puffroom, aigrip (AI R4 part 1) passed 2026-11-04)
  {
    id: 'aidodge',
    added: '2026-11-04',
    name: 'AI dodging by skill: crashed / stopped cars avoided, seen sooner by pros',
    where: 'Test link + &aidodge=1: any circuit, a big field (crashes happen)',
    try: 'Watch the field come up on a crashed or spun car; stop on the line yourself.',
    wrong: 'AI ploughing into a stopped car, braking for nothing, or more crashes than before.',
  },
];
