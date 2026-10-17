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
  // stalecap undone; dpr approved)
  {
    id: 'startfix',
    added: '2026-10-17',
    name: 'Race start: no jolt as the fly-in reaches the car',
    where: 'Castle Cum autopilot link with ?startfix=1, then without, back to back',
    try: 'Tap to start and watch the camera fly in to the grid; then the first laps, hands off.',
    wrong:
      'A jolt as the fly-in ends; track, kerbs or hill shading popping in after it; tyre wear ' +
      'not clearing at a restart.',
  },
];
