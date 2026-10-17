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
    id: 'wettrail',
    added: '2026-10-18',
    name: 'Wet tyre lines: the light line behind wet tyres fades within ~10-50 m',
    where: 'Plain link + &wettrail=1: a circuit, WEATHER RAIN / HEAVY RAIN (or &rain=0.6)',
    try: 'Drive on the wet road: a short light line follows each tyre and fades behind you'
      + ' (~10 m slow, ~50 m fast); dry rubber marks unchanged.',
    wrong: 'Lines lasting long, none at all, a line jumping across between puddles.',
  },
  {
    id: 'onepuddle',
    added: '2026-10-18',
    name: 'One puddle look: see-through water tinted by its ground, blue-grey on the road',
    where: 'Plain link + &onepuddle=1&morepuddles=1: a circuit, WEATHER HEAVY RAIN',
    try: 'Puddles on tarmac, grass, dirt: one look each (no blue squares inside); easy to see on'
      + ' the wet road; meltwater and refilled spots look the same.',
    wrong: 'Two looks again, puddles hard to see on the road, or too bright / blue.',
  },
  {
    id: 'packedwear',
    added: '2026-10-18',
    name: 'Packed snow wears: after 4 passes it breaks up into loose snow or ice, 50:50',
    where: 'Plain link + &packedwear=1: Surface Bowling Alley packed-snow lane, snow stages',
    try: 'Drive the same line 4+ times: patches of snow and ice appear; ice scrubs to water,'
      + ' snow packs again; in the wet it goes to snow only.',
    wrong: 'Changes too soon / late, all one kind, packed snow changing with no car on it.',
  },
  {
    id: 'tyrefeel',
    added: '2026-10-18',
    name: 'Tyre feel: warm sooner, hold heat on straights; slides, spins and donuts wear more',
    where: 'Plain link + &tyrefeel=1: TYRE HUD on (pause > HUD); any tarmac circuit',
    try: 'Race laps: the numbers stay in the window more; a straight cools them slower; drift,'
      + ' burnout, donut: wear climbs ~2-3x faster than before; clean laps wear as before.',
    wrong: 'Tyres overheating in clean driving, cooling too slowly, wear too fast / slow.',
  },
  {
    id: 'morepuddles',
    added: '2026-10-18',
    name: 'More puddles: more than snow, half on the road; the racing line refills in the rain',
    where: 'Plain link + &morepuddles=1: TEST MODE, a circuit, WEATHER HEAVY RAIN (then SNOW)',
    try: 'Heavy rain: ~150-175 puddles, about half on the track; drive through: the line clears,'
      + ' then fills again within ~15 s while it pours; SNOW: the same patches as without.',
    wrong: 'Too many / few puddles, snow looking different, the race feeling heavier in rain.',
  },
  // (approved late, deleted: fields, grassedge, catchthem, slipsdual, fps - TODO.md 1c;
  // dirtroad, animals, labext, labsplit, zoomhold, gpupaint, minimap, zoomspring, grassgrip, hwmap,
  // cracktufts, sharpcars, sharpmarks, jokerfix,
  // groundlookup, exacttiles, hudmenu, tyreoff, menufast, bundle,
  // sound, joker, markedge, ainowait, judder, texwarm; straightoutta removed with its level;
  // stalecap, drawlite undone; dpr, startfix approved; onecanvas paused with the lean plan;
  // weather, rain, slidewear approved 2026-10-18)
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
