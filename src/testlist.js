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
  // dirtroad, animals, labext, labsplit)
  {
    id: 'cracktufts',
    added: '2026-10-15',
    name: 'Grass through the cracks: long-grass tufts on cracked tarmac and concrete',
    where:
      'Stock Car (the broken infield and turns), Thruston runways, the alpine rally stages',
    try: 'Look for small dark-green tufts on cracked ground; drive over one.',
    wrong:
      'Grass on plain tarmac in the middle of a road, in a pit lane, too many / too few, or a ' +
      'tuft that feels unfair (a big grip loss from a tiny patch).',
  },
  {
    id: 'straightoutta',
    added: '2026-10-15',
    name: 'Judder fix (skid-mark layer) + new highway step 1: Straight Outta Swindon',
    where:
      'Link: ?menu=0&guide=0&rules=0&level=straight-outta&autopilot=140&gpupaint=1' +
      '&zoomhold=1&report=1 (hands off); then the Lab and the old highway',
    try:
      'Let the autopilot cruise at 140 for 3-5 minutes without touching the screen. Then ' +
      'drive yourself with some hard braking and slides, and look at the skid marks.',
    wrong:
      'A hitch every ~136 m (every 3.5 s at 140), the road missing ahead, grass dust behind ' +
      'the car on the tarmac, skid marks vanishing, jumping or cut in a straight line.',
  },
  {
    id: 'zoomhold',
    added: '2026-10-15',
    name: 'Calm zoom: holds, then glides (?zoomhold=1)',
    where: 'Highway and any circuit, link with &zoomhold=1 (also with &gpupaint=1)',
    try:
      'Drive normally; compare with the same link without &zoomhold=1. Watch the ground ' +
      'textures while cruising and the highway judder.',
    wrong:
      'The ground still swelling / shaking while cruising, a zoom move that feels sudden, or ' +
      'the view too tight / too wide at some speed.',
  },
  {
    id: 'gpupaint',
    added: '2026-10-15',
    name: 'GPU ground: floor, surfaces, hill shading (?gpupaint=1)',
    where: 'The Lab surface lanes and Surface Sandbox pads, link with &gpupaint=1',
    try:
      'Drive slowly over the lanes / pads and let the speed zoom go in and out; compare with ' +
      'the same link without &gpupaint=1.',
    wrong:
      'Surface textures jumping or shifting as the zoom changes, a surface in the wrong place, ' +
      'a hole or seam in the ground, the ground flashing brighter at a zoom change, or slower ' +
      'frames. (Labels, lane rims and the track still use the old path.)',
  },
  {
    id: 'sound',
    added: '2026-10-07',
    name: 'Sound slider + MUTE in pause',
    where: 'Pause menu (any session), under RESUME',
    try: 'Drag SOUND, tap MUTE / UNMUTE, close and reopen the game.',
    wrong: 'Volume not changing, MUTE not silencing, or the setting forgotten after a reload.',
  },
  {
    id: 'joker',
    added: '2026-10-07',
    name: 'Joker counted wide, once a lap',
    where: 'Knobhill RX race (also Slidden Hill)',
    try:
      'Take the joker running wide of the lane; another lap, take it again, or reverse back ' +
      'over it.',
    wrong:
      'A wide joker not counted; one joker counted twice; a joker counted when you never left ' +
      'the main road.',
  },
  {
    id: 'markedge',
    added: '2026-10-07',
    name: 'Knobhill: marks no longer cut off',
    where: 'Knobhill, top-left corner, with AI on',
    try:
      'Lay marks in the top-left corner, then do a few laps (AI too) and come back to look at ' +
      'them.',
    wrong:
      'Marks cut off in a straight line again, on Knobhill or any other circuit (the Lab south ' +
      'area still can: it is too big).',
  },
  {
    id: 'ainowait',
    added: '2026-10-07',
    name: 'AI: never wait, drive out when stuck',
    where: 'Any circuit with AI on (Knobhill, Thruston, Brands)',
    try:
      'Race 3 laps on easy, then on the hardest. Watch them stuck behind each other, and any ' +
      'that beach or hit a wall.',
    wrong:
      'AI sitting behind for ages; a stuck car not reversing out before it resets; more wrecks ' +
      'on hard than easy.',
  },
  {
    id: 'judder',
    added: '2026-10-06',
    name: 'Judder: try ?nolock=1',
    where: 'Add ?nolock=1 to the link, then the highway',
    try: 'Drive at speed with and without ?nolock=1. Watch the FPS corner too.',
    wrong:
      'Tell us which one judders; FPS dropping under ~50 when it does. (Not seen yet ' +
      '2026-10-06: kept open.)',
  },
];
