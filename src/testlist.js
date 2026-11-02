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
  // passed 2026-10-25); oil passed 2026-10-25; debris passed 2026-10-26; glasspop,
  // oilwear passed 2026-10-26; posthit passed 2026-10-26 (=1 picked over =hard); armcodent
  // passed 2026-10-26; waterspread, openwheel passed 2026-10-26)
  {
    id: 'heavywet',
    added: '2026-11-01',
    name: 'Wet trails only in a puddle or HEAVY rain (not damp tarmac after rain / snow)',
    where: 'Plain link + &heavywet=1: any tarmac level, weather rain / heavy / snow',
    try: 'Drive damp tarmac after rain or melt, in light rain, then heavy rain and puddles.',
    wrong: 'Wet trails on damp tarmac without heavy rain, or none in puddles / heavy rain.',
  },
  {
    id: 'menureset',
    added: '2026-11-01',
    name: 'Menu race: the car the camera follows resets when wrecked, like its rivals',
    where: 'Plain link + &menureset=1: watch the race behind the main menu',
    try: 'Wait for the camera car to crash badly (or a wheel off).',
    wrong: 'It limps on wrecked, or resets for small knocks.',
  },
  {
    id: 'markage',
    added: '2026-11-01',
    name: 'Tyre marks fade oldest first in small bits, gently (round 2: smaller, softer steps)',
    where: 'Plain link + &markage=1: any level, lay skid marks over a few minutes',
    try: 'Lay marks, wait ~2 min, lay more; watch the old ones go first.',
    wrong: 'Big squares fading at once, new marks fading first, marks never fading.',
  },
  {
    id: 'treenight',
    added: '2026-11-01',
    name: 'Trees at night: no pale edge round the canopy',
    where: 'Plain link + &treenight=1: a level with trees (Castle Cum) at night',
    try: 'Look at canopy edges at night, near lamps and in headlights too.',
    wrong: 'A lighter rim round canopies, or canopies lit by lamps.',
  },
  {
    id: 'hwsnow',
    added: '2026-11-01',
    name: 'Highway: the AI\'s tracks in snow / water ahead are still there when you arrive',
    where: 'Plain link + &hwsnow=1: Highway with AI, weather snow (or rain puddles)',
    try: 'Follow the AI on snow; drive where they drove.',
    wrong: 'Their tracks gone (fresh snow) by the time you get there.',
  },
  {
    id: 'evenlap',
    added: '2026-11-02',
    name: 'AI: no braking for nothing at the start line or twitching at small kinks',
    where: 'Plain link + &evenlap=1: Killder, Castle Cum, Thruston (menu race too)',
    try: 'Follow the AI over the start / finish line and through the corners.',
    wrong: 'AI lifting or braking on the straight at the line, or a twitch mid-corner.',
  },
  {
    id: 'wheelgone',
    added: '2026-11-01',
    name: 'A lost wheel takes nothing more: no flat, rim, leak or wear; the hub may spark',
    where: 'Plain link + &wheelgone=1: knock a wheel off (hard corner hit, or an F1 wheel)',
    try: 'Drive on after a wheel comes off; watch the HUD wheel and the sparks.',
    wrong: 'The missing wheel goes flat / to the rim / wears, or rubber marks from it.',
  },
  {
    id: 'menucar',
    added: '2026-11-01',
    name: 'Menu race follows YOUR car (the garage pick), in your paint and number',
    where: 'Plain link + &menucar=1: pick a car + paint in the garage, back to the menu',
    try: 'Change car in the garage, finish an event, look at the menu race.',
    wrong: 'Always the orange hatch, or not your paint / number.',
  },
  {
    id: 'ainumbers',
    added: '2026-11-01',
    name: 'AI race numbers random (2-99, never yours), painted on, same on the scoreboard',
    where: 'Plain link + &ainumbers=1: any race with AI',
    try: 'Start a few races; compare the numbers on the cars and the results.',
    wrong: '2, 3, 4 ... again, a number twice, yours taken, or car and board differ.',
  },
];
