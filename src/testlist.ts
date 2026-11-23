// testlist.ts — THE TEST QUEUE (requirement: can we have a to test feature list somewhere in the
// pause menu while we are testing it should be updated when we add new features and remove approved
// features). Shown in the PAUSE menu, TEST MODE only (menu.ts pause -> TESTING).
// THE RULE (CLAUDE.md §1): every feature handed over for a phone test gets an entry here IN THE
// SAME TASK; when the user approves it, DELETE the entry (and note the verdict in TODO.md). Keep
// each line short: it is read on a phone, mid-session.
//   id     stable key            added   date it went in (yyyy-mm-dd)
//   where  how to get to it      try     what to do      wrong   what would count as a bug
/** One feature under test, as the pause menu lists it. */
export interface TestEntry {
  id: string; added: string; name: string; where: string; try: string; wrong: string;
}

export const TEST_LIST: TestEntry[] = [
  {
    id: 'hillclimbs',
    added: '2026-11-22',
    name: 'HILL CLIMBS: Spikes Peak in its own track type in TEST MODE',
    where: 'Test link + &spikespeak=1: TEST MODE, HILL CLIMBS',
    try: 'Find it under HILL CLIMBS (not RALLY STAGES or ALL TRACKS); solo or VS AI (staggered '
      + 'starts), one run up, no laps; your ghost from your best run up.',
    wrong: 'Spikes Peak still under RALLY STAGES or ALL TRACKS, a LAPS row, or no ghost.',
  },
  {
    id: 'queuefit',
    added: '2026-11-22',
    name: 'Generated rally stage: all five cars queued behind you at the start',
    where: 'Test link + &queuefit=1: TEST MODE, RALLY STAGES, the stage generator, VS AI 5 (1st)',
    try: 'Start first and look behind: five cars in the queue, each moving up and going on its '
      + 'own green.',
    wrong: 'A car missing from the queue, one parked off the road far away, or one stuck.',
  },
  {
    id: 'pitstops',
    added: '2026-11-22',
    name: 'Pit stops (your car): the pit lane, limiter, your box, the PIT STOP menu, GO',
    where: 'Test link + &pitstops=1: TEST MODE, an F1 car VS AI over 3+ laps at a circuit with '
      + 'a pit lane (Brands, Sillystone, Le Manky...); the setup PIT STOPS row',
    try: 'Follow the arrows into the pit lane (as a joker lap: the lap panel line PIT TO DO, '
      + 'PIT >>> near the entrance, IN PIT on the lane; the PIT LIMITER light, 60 km/h). Your box '
      + 'is the orange outline with the red lollipop (every box is painted; yours is also an '
      + 'orange dot on the minimap), flashing blue once you are parked in it. Stop in it, pick '
      + 'tyres / repair, CONFIRM & GO: held for the work, '
      + 'the lollipop turns green at GO, PIT TAKEN then PIT DONE. A RESET in the pit lane: back '
      + 'at its entrance. Skip the stop in a dry F1 race: +30 s NO PIT at the finish.',
    wrong: 'Your box hard to spot at speed, arrows pointing the wrong way, no menu in your box, '
      + 'the menu in the wrong box, the race stopping while it is open, the limiter off on the '
      + 'lane or on the track, or a reset leaving you in the pit lane.',
  },




  {
    id: 'spikespeak',
    added: '2026-11-22',
    name: 'SPIKES PEAK, the hill climb: the real 10 km road at half scale, climbing 718 m',
    where: 'Test link + &spikespeak=1: TEST MODE, RALLY STAGES (or ALL TRACKS), Spikes Peak, SOLO',
    try: 'Drive it start to summit: the road and its 23 hairpins, the climb, the time; tell us if '
      + 'it is too long.',
    wrong: 'A kink or a gap in the road, a hairpin you cannot get round, the ground stepping, the '
      + 'car floating or sinking, or a stutter as you drive.',
  },
  {
    id: 'spikeshort',
    added: '2026-11-22',
    name: 'SPIKES PEAK: the ~5 km course - sweepers, the switchbacks, the final climb',
    where: 'Test link + &spikespeak=1&spikeshort=1&spikesmooth=1: TEST MODE, Spikes Peak',
    try: 'Drive start to summit: about half the time of the full road; two joining sweepers.',
    wrong: 'A kink or a step at a join, a join that feels made up, or still far too long.',
  },
  {
    id: 'spikedrops',
    added: '2026-11-22',
    name: 'SPIKES PEAK: the ground falls away past the verge on the outside of bends',
    where: 'Test link + &spikespeak=1&spikedrops=1: TEST MODE, Spikes Peak (first ~5 km)',
    try: 'Look over the outside of the bends: the ground drops ~25 m; run wide to feel it.',
    wrong: 'A cliff into another part of the road, a step in the ground, or the car stuck.',
  },
  {
    id: 'spikesmooth',
    added: '2026-11-22',
    name: 'SPIKES PEAK: the road as true curves, hairpins too',
    where: 'Test link + &spikespeak=1&spikesmooth=1: TEST MODE, Spikes Peak',
    try: 'Drive the hairpins: the road edges and lines curve smoothly.',
    wrong: 'Corners still made of straight pieces (hexagonal), a kink or a step in the road.',
  },
  {
    id: 'spikemarks',
    added: '2026-11-22',
    name: 'SPIKES PEAK: the two-way road centre line',
    where: 'Test link + &spikespeak=1&spikemarks=1: TEST MODE, Spikes Peak',
    try: 'Drive it: a dashed centre line all the way up.',
    wrong: 'No centre line, one that wanders off the middle, or dashes on the start only.',
  },
  {
    id: 'spikestones',
    added: '2026-11-22',
    name: 'SPIKES PEAK: small stones and bits scattered beside the road',
    where: 'Test link + &spikespeak=1&spikestones=1: TEST MODE, Spikes Peak',
    try: 'Look at the verges and hillside as you climb.',
    wrong: 'Stones on the road, a car stopped by a scenery stone, or a stutter.',
  },
  {
    id: 'spikerocks',
    added: '2026-11-22',
    name: 'SPIKES PEAK: movable stones on the edges and corner insides',
    where: 'Test link + &spikespeak=1&spikerocks=1: TEST MODE, Spikes Peak',
    try: 'Clip the stones on hairpin insides: pebbles skip, bigger ones barely shift; now and '
      + 'then a puncture (2 % a hit); a stone hit a few times gets driven over.',
    wrong: 'Big stones flying off, every hit a puncture or none ever, or a stutter near them.',
  },
  {
    id: 'spikescree',
    added: '2026-11-22',
    name: 'SPIKES PEAK: rock and scree on the steep ground',
    where: 'Test link + &spikespeak=1&spikescree=1: TEST MODE, Spikes Peak',
    try: 'Look at the slopes between the hairpin legs: grey scree on steep ground.',
    wrong: 'Scree everywhere or nowhere, or on flat ground.',
  },
  {
    id: 'spikeshadow',
    added: '2026-11-22',
    name: 'SPIKES PEAK: drop shadow below the road edge, darker valley floors',
    where: 'Test link + &spikespeak=1&spikeshadow=1: TEST MODE, Spikes Peak',
    try: 'Look over the edge where the ground falls away: darker the deeper.',
    wrong: 'No change, ground above the road darkened, or patches with hard edges.',
  },
  {
    id: 'spikehaze',
    added: '2026-11-22',
    name: 'SPIKES PEAK: height haze - ground far below paler and bluer',
    where: 'Test link + &spikespeak=1&spikehaze=1: TEST MODE, Spikes Peak',
    try: 'Climb the switchbacks and look down at the road below: paler and bluer.',
    wrong: 'Haze on the road you are on, no change, or a stutter.',
  },

];
