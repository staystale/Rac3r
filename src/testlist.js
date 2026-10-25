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
  // passed 2026-10-25); oil passed 2026-10-25)
  {
    id: 'debris',
    added: '2026-10-25',
    name: 'Crash debris: bumpers, wings, panels in your paint; glass that sparkles on the road',
    where: 'Plain link + &debris=1: any circuit (Castle Cum: hit walls nose first and side on)',
    try: 'Crash hard: parts fly off the hit corner, stay, and the oldest fade past 24; glass'
      + ' glints change as you move; drive over glass (sweeps it, may give a slow puncture).',
    wrong: 'Parts off a light tap, two bumpers from one hit, parts vanishing early, glass from'
      + ' the F1 / banger / grass car, glass that stays after a tyre has passed over it.',
  },
];
