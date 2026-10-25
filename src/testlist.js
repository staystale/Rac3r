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
  // 2026-10-25 (fairy lights moved off the road, board halo faint))
  {
    id: 'carlamps',
    added: '2026-10-25',
    name: 'Damaged car lamps flicker a few seconds, then work again or die (worse damage: dies)',
    where: 'Plain link + &carlamps=1, at night, any level with AI or traffic',
    try: 'Knock a front corner (light, then hard); watch your lamps and other cars\' lamps.',
    wrong: 'Lamps flickering for ever, dying from a tiny knock every time, a smashed corner lit.',
  },
  {
    id: 'woodmarshal',
    added: '2026-10-25',
    name: 'Wooden marshal huts: a knock bounces, a hard hit (~30 km/h) smashes them',
    where: 'Plain link + &woodmarshal=1: Brands Snatch, Thruston, Knobhill (their marshal posts)',
    try: 'Nudge one, then hit one hard: planks (pallets) fly, the beacon goes out; RESTART.',
    wrong: 'A hut you pass through slowly, one that never breaks, planks floating, still there'
      + ' after RESTART wrecked.',
  },
  {
    id: 'brakeglow',
    added: '2026-10-25',
    name: 'Hot brakes glow orange at the wheels at night after hard braking',
    where: 'Plain link + &brakeglow=1, at night, a long straight into a hairpin',
    try: 'Several hard stops close together: the fronts glow from about the 3rd; lots of'
      + ' handbrake glows the rears instead. They fade as you drive on.',
    wrong: 'Glow by day, glow from one stop or gentle braking, glow that never fades.',
  },
  {
    id: 'trees',
    added: '2026-10-25',
    name: 'Trees: trunk-only solid, canopy over the cars, seasons, weather snow, dark at night',
    where: 'Plain link + &trees=1: Killder, a forest stage, Brands Snatch (TEST MODE: SEASON'
      + ' winter / spring / summer / autumn, and at night)',
    try: 'Clip under canopies; see leaves by season (bare in winter), snow when it snows, and'
      + ' at night trees beside signs and lamps staying dark.',
    wrong: 'Bouncing off a canopy, cars drawn over trees, trees lit by signs at night.',
  },
];
