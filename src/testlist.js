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
  // raingrip, lockheat, gravelsand approved 2026-10-24; hwlead, trafficease passed 2026-10-24)
  {
    id: 'punctkind',
    added: '2026-10-24',
    name: 'A13: punctures by what you hit - tyre walls and bales rarely, posts and pallets often',
    where: 'Plain link + &punctkind=1: Grass Track / Stock Car (tyre walls), Castle Cum (armco,'
      + ' signs), the highway (litter: pallets, crates)',
    try: 'Hit tyre walls and bales hard (rare punctures), then armco and walls (sometimes), then'
      + ' posts, chevrons and pallets (often).',
    wrong: 'Tyre walls still puncturing about half the time, posts never puncturing, punctures'
      + ' from small knocks, a puncture with nothing hit.',
  },
];
