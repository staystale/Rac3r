// testlist.js — THE TEST QUEUE (requirement: can we have a to test feature list somewhere in the
// pause menu while we are testing it should be updated when we add new features and remove approved
// features). Shown in the PAUSE menu, TEST MODE only (menu.js pause -> TESTING).
// THE RULE (CLAUDE.md §1): every feature handed over for a phone test gets an entry here IN THE
// SAME TASK; when the user approves it, DELETE the entry (and note the verdict in TODO.md). Keep
// each line short: it is read on a phone, mid-session.
//   id     stable key            added   date it went in (yyyy-mm-dd)
//   where  how to get to it      try     what to do      wrong   what would count as a bug
export const TEST_LIST = [
  {
    id: 'labweather',
    added: '2026-10-18',
    name: 'Lab weather: puddles and snow patches on OG Lab, Bowling Alley, Rough Patch too',
    where: 'Plain link + &labweather=1: TEST MODE, a lab level, WEATHER HEAVY RAIN / SNOW',
    try: 'Puddles and snow form on the lab floors as on circuits; the test lanes still work.',
    wrong: 'No puddles / snow on the lab floors, or a test lane broken by them.',
  },
  {
    id: 'winter',
    added: '2026-10-18',
    name: 'Winter logic: snow packs, packed snow ices in the cold, melting by heat, water freezes',
    where: 'Plain link + &winter=1: a circuit with SNOW, then warm / HOT; a snow stage',
    try: 'Drive snow: it packs (some ice / slush); packed snow goes to ice more the colder, a'
      + ' little breaks to water; warm: snow / ice / lake melt, quicker hot or in rain; tyre water'
      + ' freezes below 0; a snow stage stays frozen (rain falls as snow).',
    wrong: 'Snow never packing, melting in the cold, snow lasting in the heat, a snow stage'
      + ' melting.',
  },
  // (approved late, deleted: fields, grassedge, catchthem, slipsdual, fps - TODO.md 1c;
  // dirtroad, animals, labext, labsplit, zoomhold, gpupaint, minimap, zoomspring, grassgrip, hwmap,
  // cracktufts, sharpcars, sharpmarks, jokerfix,
  // groundlookup, exacttiles, hudmenu, tyreoff, menufast, bundle,
  // sound, joker, markedge, ainowait, judder, texwarm; straightoutta removed with its level;
  // stalecap, drawlite undone; dpr, startfix approved; onecanvas paused with the lean plan;
  // weather, rain, slidewear approved 2026-10-18; morepuddles, tyrefeel, packedwear, onepuddle,
  // wettrail approved 2026-10-18)
  {
    id: 'tyrewear',
    added: '2026-10-18',
    name: 'Tyre wear: sets wear over races, worn = less grip, hot / bald / debris punctures',
    where: 'Plain link (the default; &tyrewear=0 = off): TYRE HUD on (pause > HUD); garage TYRES',
    try: 'Race several events on one set; drive hard and overheat; try Wet tyres in the dry;'
      + ' RESTART (wear back to the start), RESET (wear kept); wheel colours; garage % WORN.',
    wrong: 'Wear too fast / slow to be a running cost, punctures out of the blue, the set not'
      + ' kept between races, the numbers not being the heat.',
  },
  {
    id: 'wintertweaks',
    added: '2026-10-18',
    name: 'Weather tweaks: cold freezes water, puddles before the start, quicker build-up, SNOW',
    where: 'Plain link: TEST MODE, a circuit (Killder / Sweaty Lamb for their water), WEATHER rows',
    try: 'SNOW and WINTER: puddles turn to ice, mud freezes, the lake / stream may freeze over;'
      + ' restart a few autumn races: some start with puddles; HEAVY RAIN: puddles in ~30-50 s.',
    wrong: 'Ice where no water was, frozen water in the warm, puddles all at once, too many / few.',
  },
];
