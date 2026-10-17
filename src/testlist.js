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
  // sound, joker, markedge, ainowait, judder; straightoutta removed with its level)
  {
    id: 'texwarm',
    added: '2026-10-17',
    name: 'Menu: no freeze just after it shows (long grass painted while loading)',
    where: 'Open the link with ?texwarm=1&report=1, then the plain link with ?report=1',
    try: 'Leave the menu up ~10 s each time, hands off. Close the tab or go home after each.',
    wrong:
      'A stutter about a quarter-second after the menu appears; loading clearly slower; the ' +
      'long grass, wheat or hedges looking different.',
  },
];
