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
  // 2026-10-18; tyrewear, wintertweaks passed 2026-10-18)
  {
    id: 'coldsurface',
    added: '2026-10-18',
    name: 'One cold-surface system: snow on ice / snow, never on water; ice wears to water',
    where: 'Plain link + &coldsurface=1: TEST MODE, the Lab (ice / wet panels), SNOW then RAIN',
    try: 'Snow on the ice and wet panels (snow settles on ice, melts into water); drive ice: it'
      + ' breaks to water, more when warm; rain melts snow faster than ice.',
    wrong: 'Snow on water, ice spreading onto dry ground in rain, ice never wearing when driven,'
      + ' what you see not being what the tyre feels.',
  },
  {
    id: 'markfade',
    added: '2026-10-18',
    name: 'Tyre marks fade away after ~2-3 min, patch by patch',
    where: 'Plain link + &markfade=1: any circuit; lay marks (slides, donuts) and keep driving',
    try: 'Watch old marks thin out and vanish over a few minutes, some patches sooner than others.',
    wrong: 'Marks that never go, marks vanishing at once, square patch edges that look wrong, lag.',
  },
  {
    id: 'wearchance',
    added: '2026-10-18',
    name: 'Ground wear: dry dirt rarely turns to mud; damp sand -> gravel, damp gravel -> dirt',
    where: 'Plain link + &wearchance=1: TEST MODE, a dirt / sand / gravel area, dry then rain',
    try: 'Drive dry dirt (mostly stays dirt), then damp; drive damp sand and gravel a while.',
    wrong: 'Dry dirt turning to mud as fast as before; dry sand / gravel changing surface.',
  },
];
