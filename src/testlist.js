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
  // punctkind, shortgrass, grassblades passed 2026-10-24; hwlamps passed 2026-10-24)
  {
    id: 'trafficseat',
    added: '2026-10-24',
    name: 'Traffic woken near you on a hill no longer flies into the air',
    where: 'Plain link + &trafficseat=1: Highway to Hull, traffic on, hilly stretches',
    try: 'Drive a few km in traffic; watch cars appear ahead and beside you over crests.',
    wrong: 'A traffic car jumping, floating or drifting off the road with nothing hitting it.',
  },
  {
    id: 'sandboxwet',
    added: '2026-10-24',
    name: 'The Sandbox keeps its two sample puddles (start straight, dirt hairpin)',
    where: 'Plain link + &sandboxwet=1: the Sandbox (TEST MODE), dry weather',
    try: 'Drive through both at the start of an event; they follow the weather as the Lab puddle.',
    wrong: 'No puddles there at the start, or a puddle that looks or drives unlike the others.',
  },
  {
    id: 'meltwater',
    added: '2026-10-24',
    name: 'Melting snow and ice leave water (up to heavy rain\'s puddles) and a damp track',
    where: 'Plain link + &meltwater=1: a snowy or icy start that warms up (TEST MODE: winter /'
      + ' spring, or a snow stage), or the Lab\'s ice and snow samples on a mild day',
    try: 'Watch a coat melt: puddles where it went, the track damp (slower) while it melts,'
      + ' drying off after.',
    wrong: 'Melted snow leaving dry ground, the whole track flooded, water that never dries.',
  },
  {
    id: 'icecrack',
    added: '2026-10-24',
    name: 'Driven ice cracks: pale crack lines, a bit more grip, wears through faster, spreads',
    where: 'Plain link + &icecrack=1: the Lab\'s ice sheet (cold weather), any icy track',
    try: 'Drive one line over ice a few times; then leave it a minute; then try it near 0 C.',
    wrong: 'No cracks, cracks off the ice, cracks spreading over the whole sheet, cracked ice as'
      + ' slippery as before, or wearing through as slowly as before.',
  },
];
