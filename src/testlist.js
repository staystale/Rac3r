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
  // superseded by the cover field; zoomswitch, mudfreeze approved 2026-10-18)
  {
    id: 'sanddig',
    added: '2026-10-18',
    name: 'Sand dents the most easily (dry or wet); a churned puddle on gravel leaves dirt',
    where: 'Plain link + &sanddig=1: TEST MODE, a level with sand traps (or the Lab sand panel)',
    try: 'Drive the same line through sand a few times: the ruts deepen fast and pull the wheels;'
      + ' churn a puddle on gravel (rain) and look at what it leaves.',
    wrong: 'Sand changing to another surface, sand denting slower than mud, other ground'
      + ' behaving differently from before, slow frames in sand traps.',
  },
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
