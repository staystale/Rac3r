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
  // 2026-10-18; night (cost test) passed 2026-10-18)
  {
    id: 'lamps',
    added: '2026-10-18',
    name: 'Street lights and floodlights: solid lamps, on from dusk',
    where: 'Plain link + &lamps=1&night=0.8 (Castle Cum start straight; Stock Car pylons);'
      + ' &lamps=1 alone for daytime',
    try: 'At night: a pool below each head, one beam per headlight, indicators glow amber; by day'
      + ' lamps off. Drive into a post or a pylon base:'
      + ' a nudge wonks it and it flickers; a hard hit dims it; ~50 km/h snaps it; drive over the'
      + ' fallen post: it gets flatter each pass. RESTART stands them up.',
    wrong: 'Lamps lit by day, a post you drive through, a pool off its lamp, lamps on the track.',
  },
  {
    id: 'daytime',
    added: '2026-10-18',
    name: 'Time of day: the game clock (1 day = 1 real hour, seasons of 7 days, moon phases)',
    where: 'Plain link + &daytime=1&lamps=1: the menu race shows the clock; TEST MODE setup:'
      + ' TIME OF DAY - LIVE or START HOUR (try 19:00 for a sunset, 22:00 for night)',
    try: 'Sunset orange, sunrise pink, night dark (darker with no moon, lighter at full moon),'
      + ' rain dims the day; lamps and AI lights come on at dusk; time moves on in the race.',
    wrong: 'Too dark / too light, colours garish, the light jumping, time not moving, lag.',
  },
];
