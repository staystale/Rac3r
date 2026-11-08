import fs from 'node:fs';
const p = 'TODO.md';
let s = fs.readFileSync(p, 'utf8');
const anchor = '   already (NOTES).\n3. HUD TEXT FIX';
if (!s.includes(anchor)) throw new Error('anchor');
s = s.replace(anchor, `   already (NOTES).
   OVERNIGHT 11-02/03 (owner: "work thru as much type script conversion as possible"): DONE and on
   main, each batch proved against main 10a3f89 (simhash SAME, worldhash SAME, renderhash SAME on
   test-track / knobhill / highway where it draws; menucheck / uicheck / inputcheck / garage
   where it applies): batch 1 (13 leaf files), 2 cones (6), 3 HUD (7), 4 menus (4), 5b input,
   roll, raceflow, 5c audio, guide, and carstats (the generator writes typed TS) - 36 files.
   LEFT (14 files, ~6.3k lines): the HIGHWAY (7, stashed in rac3r-wt as "ts batch 5 highway":
   it builds lanes / zones / covers in shapes world/types.ts does not allow - [x, y] lane points,
   _s tags - so those world types are widened first); the GAME FLOW (state, grid, controls,
   rules, order, ai, loop, menuflow, session, sim) + main.js - they share game / shared from
   game/state.js, which needs a typed Game first; marks.js; stagegen.js.
   FOUND on the way (behaviour kept, for the owner): the joker turn-off hint on the lap panel
   never shows (hud/laps.ts: no joker arrow carries its track distance d); JokerRule.estCost is
   read but never set (an unfinished car's joker always costs 5 s); carstats are a little stale
   (a re-measure moves 6 numbers by 0.1 since the 11-03 physics passes).
3. HUD TEXT FIX`);
fs.writeFileSync(p, s);
console.log('ok');
