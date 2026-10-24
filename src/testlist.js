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
  // passed 2026-10-19; mudwater approved 2026-10-24)
  {
    id: 'skyblend',
    added: '2026-10-24',
    name: 'A1: sunrise / sunset colour blends in; rain and snow start and stop gently',
    where: 'Plain link + &skyblend=1: TEST MODE, SEASON summer, START HOUR 19 (sunset ~20:10)'
      + ' or 3 (sunrise ~04:00); WEATHER rain, then dry; SEASON weather for changes',
    try: 'Drive through the golden hour into dusk (~3 min), in rain and dry; wait for a change'
      + ' of weather in SEASON mode.',
    wrong: 'The colour jumping at any moment, a bright orange sunset in heavy rain, a shower'
      + ' or its darkening arriving in one go, slow frames.',
  },
  {
    id: 'decklight',
    added: '2026-10-24',
    name: 'A2: head / tail lights stop at bridge decks (never through them)',
    where: 'Plain link + &decklight=1&night=0.9: Castle Cum (footbridges) and the highway'
      + ' (bridges), with AI / traffic',
    try: 'Drive under the footbridges and bridges, and watch cars pass under them.',
    wrong: 'Light on top of a deck from a car below, light cut short before the deck or past it,'
      + ' a street light pool missing on a deck, a dark box where no deck is, slow frames.',
  },
  {
    id: 'weatheronly',
    added: '2026-10-24',
    name: 'A5: snow and ice only from the weather; snow stages snowy by their weather',
    where: 'Plain link + &weatheronly=1: Mont Brakefade (no hairpin ice when warm),'
      + ' Ikeaflatpack / Brrrmeatballen (SEASON winter, then summer), Test Track, Lab; highway'
      + ' rivers in a hot and a freezing event',
    try: 'Warm: no ice or snow anywhere on race tracks / stages; cold or snowing: what the weather'
      + ' lays. A snow stage in winter starts deep in snow; in summer it is a clear road.',
    wrong: 'Drawn ice or snow left on a race track or stage, Lab / test pads gone, a snow stage'
      + ' with no snow in a cold winter, the forest ford missing, a stage layout changed, a river'
      + ' drying up, a river that never freezes in hard frost.',
  },
  {
    id: 'formation',
    added: '2026-10-24',
    name: 'A3: rolling starts - every car (yours too) held in its own grid slot until the green',
    where: 'Plain link + &formation=1: TEST MODE, Naffcar Speedway and Stock Car, VS AI x5,'
      + ' a few starts each (RESTART)',
    try: 'Watch the formation from the lights to the green, then race away.',
    wrong: 'A car leaving its column or weaving before the green, any contact before it, your car'
      + ' not in its slot, the pack bunching or stretching, a slow or jerky green.',
  },
  {
    id: 'raingrip',
    added: '2026-10-24',
    name: 'A6: rain only a little slippery; puddles the real loss; fewer, smaller puddles',
    where: 'Plain link + &raingrip=1: TEST MODE, Castle Cum, WEATHER rain, then heavy rain;'
      + ' your usual car on its usual and on rain tyres',
    try: 'Lap in the rain (a few s slower than dry, not ~12 s); hit a puddle (a real slide);'
      + ' watch the puddles over 10 min of heavy rain, then a dry spell.',
    wrong: 'Damp road still like ice, puddles harmless, the track flooding, no puddles at all in'
      + ' heavy rain, rain tyres no better than slicks in the wet.',
  },
  {
    id: 'lockheat',
    added: '2026-10-24',
    name: 'A8: handbrake / locked wheels warm their tyres (rears hotter in a handbrake slide)',
    where: 'Plain link + &lockheat=1: any tarmac level, the tyre HUD on (pause, HUD list)',
    try: 'A few handbrake turns: the rear tyre numbers climb a little more than the fronts.',
    wrong: 'Rears not warming, tyres overheating or popping from a few handbrake turns.',
  },
  {
    id: 'gravelsand',
    added: '2026-10-24',
    name: 'E: dry gravel turns to sand now and then - more often the hotter the track',
    where: 'Plain link + &gravelsand=1: a gravel stage (Llanfairsheepdip), WEATHER hot, then dry',
    try: 'Drive the same gravel stretch again and again: sand patches appear in your line.',
    wrong: 'Gravel turning to sand in the wet, whole stretches changing at once, no change ever.',
  },
];
