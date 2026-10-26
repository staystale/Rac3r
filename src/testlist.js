// testlist.js — THE TEST QUEUE (requirement: can we have a to test feature list somewhere in the
// pause menu while we are testing it should be updated when we add new features and remove approved
// features). Shown in the PAUSE menu, TEST MODE only (menu.js pause -> TESTING).
// THE RULE (CLAUDE.md §1): every feature handed over for a phone test gets an entry here IN THE
// SAME TASK; when the user approves it, DELETE the entry (and note the verdict in TODO.md). Keep
// each line short: it is read on a phone, mid-session.
//   id     stable key            added   date it went in (yyyy-mm-dd)
//   where  how to get to it      try     what to do      wrong   what would count as a bug
export const TEST_LIST = [
  // (approved late, deleted: fields, grassedge, catchthem, slipsdual, fps - TODO.md 1c;
  // dirtroad, animals, labext, labsplit, zoomhold, gpupaint, minimap, zoomspring, grassgrip, hwmap,
  // cracktufts, sharpcars, sharpmarks, jokerfix,
  // groundlookup, exacttiles, hudmenu, tyreoff, menufast, bundle,
  // sound, joker, markedge, ainowait, judder, texwarm; straightoutta removed with its level;
  // stalecap, drawlite undone; dpr, startfix approved; onecanvas paused with the lean plan;
  // weather, rain, slidewear approved 2026-10-18; morepuddles, tyrefeel, packedwear, onepuddle,
  // wettrail approved 2026-10-18; coverfield, winter approved 2026-10-18 - labweather
  // superseded by the cover field; zoomswitch, mudfreeze, sanddig, wintercold, graveldig approved
  // 2026-10-18; tyrewear, wintertweaks passed 2026-10-18;
  // coldsurface, wearchance, markfade, hudunits, onelook, tyrecool, coverlook approved
  // 2026-10-18; night (cost test) passed 2026-10-18; lamps, daytime approved 2026-10-18; suntemp
  // approved 2026-10-18; nightjudder, glowmap, pauseclock, onelight passed 2026-10-18; gpuonly
  // passed 2026-10-19; mudwater approved 2026-10-24; skyblend, decklight, formation, weatheronly,
  // raingrip, lockheat, gravelsand approved 2026-10-24; hwlead, trafficease passed 2026-10-24;
  // punctkind, shortgrass, grassblades passed 2026-10-24; hwlamps passed 2026-10-24;
  // trafficseat, sandboxwet, meltwater, icecrack passed 2026-10-24; reverselights passed
  // 2026-10-25 (owner: "slightly bright": beam 0.35 -> 0.25, glow 0.7); eventlights passed
  // 2026-10-25 (fairy lights moved off the road, board halo faint); carlamps, woodmarshal,
  // brakeglow, trees passed 2026-10-25 (brake heat now resets with the tyres); bushes passed
  // 2026-10-25 (round 2: more drag, a light dent, leaves over the cars); flats (with the
  // stingers, the rim by chance) and hedges (one continuous line) passed 2026-10-25; flipramp
  // passed 2026-10-25; impactsparks passed 2026-10-25 (round 2: 70 %, over 25 mph,
  // directional); engine (radiator + engine heat, the leak as water, speedo lights, exhaust)
  // passed 2026-10-25); oil passed 2026-10-25; debris passed 2026-10-26)
  {
    id: 'glasspop',
    added: '2026-10-26',
    name: 'Glass can pop a tyre (a burst), now and then, not only a slow leak',
    where: 'Plain link + &glasspop=1&oilwear=1: Castle Cum, crash, then drive over the glass',
    try: 'Drive over glass several times: mostly slow leaks, about 1 puncture in 8 a sudden pop.',
    wrong: 'Pops on every glass pass, or never a pop after many punctures.',
  },
  {
    id: 'oilwear',
    added: '2026-10-26',
    name: 'Oil wears away: when it would spread, 75 % it spreads, 25 % that cell goes',
    where: 'Same link: crash for a spill, then drive through it lap after lap (or in the rain)',
    try: 'Drive through a spill again and again: it spreads a little and thins out, cells go.',
    wrong: 'Oil that never goes, or a spill gone after one pass.',
  },
];
