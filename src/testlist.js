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
  // stalecap, drawlite undone; dpr, startfix approved; onecanvas paused with the lean plan)
  {
    id: 'weather',
    added: '2026-10-18',
    name: 'Weather: season, rain / hot / snow, changing in the race, puddles from the weather',
    where: 'Plain link + &weather=1: TEST MODE, a circuit, the WEATHER rows in the setup',
    try: 'Try SEASON (each season), DRY, HOT, VERY HOT, RAIN, HEAVY RAIN; race a few laps in each;'
      + ' fit Wet tyres (garage) in the rain; drive through puddles.',
    wrong: 'Wet grip not real, AI crashing in the wet, tyres too hot / cold, puddles or snow where'
      + ' they look wrong, the old level puddles still there, lag or held frames in the rain.',
  },
  {
    id: 'rain',
    added: '2026-10-18',
    name: 'Fixed wet track to compare the wet feel and look (0 dry .. 1 soaked)',
    where: 'Plain link + &rain=0.5 (or &rain=1), any level',
    try: 'Drive a few laps; watch the dry line form from the light trails; compare with dry.',
    wrong: 'Feels unreal, rain or wet ground looks wrong, judder from the rain drawing.',
  },
  {
    id: 'slidewear',
    added: '2026-10-18',
    name: 'Sliding and crashing cars wear the ground twice as fast',
    where: 'Plain link + &slidewear=1, a grass / dirt level',
    try: 'Spin and slide on grass and dirt; compare how fast it wears to mud.',
    wrong: 'Driving normally wears it faster too; wear in the wrong place.',
  },
];
