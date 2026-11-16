// _rollguard.mjs - A ROLLING START'S GREEN WITH THE AI POLE OUT OF THE TRACK'S RANGE: game/order.ts
// stepStart stepped by hand on Thruston, the pole car (not the player) put on the line's approach,
// then 60 m off to the side in the last 60 m, then back, then over the line; prints when green
// came at each step. Nothing in the game is changed: it only reads. ROLLGUARD=1 for the switch.
// node tools/scratch/_rollguard.mjs
import * as L from '../../src/lab.ts';
import { game } from '../../src/game/state.ts';
import { stepStart } from '../../src/game/order.ts';
import { makeCar, reset } from '../../src/vehicle.ts';
import { querySubtrack } from '../../src/world/tyrewall.ts';

L.setLevel('thruston');
const sub = L.LEVEL.subtrack, total = sub.totalDist;
game.car = makeCar('hatch-fwd');
game.poleCar = makeCar('hatch-fwd');
game.start = { on: true, t: 3, tGreen: 999, rolling: true, green: false };
const place = (along, side) => {
  const spot = L.onTrack(sub, along, side, {});
  reset(game.poleCar, spot.x, spot.y, spot.rot);
};
for (const [label, along, side] of [['on the track, 40 m to the line', total - 40, 0],
  ['60 m off the side, 30 m to the line', total - 30, 60],
  ['back on the track, 20 m to the line', total - 20, 0], ['over the line, 10 m on', 10, 0]]) {
  place(along, side);
  const q = querySubtrack(sub, game.poleCar.x, game.poleCar.y);
  stepStart(0.1);
  console.log(`${label.padEnd(38)} | query dist ${q.dist === Infinity ? 'Infinity' : q.dist.toFixed(1)}`
    + ` trackDist ${q.trackDist.toFixed(0)} | green ${game.start.green ? 'YES' : 'no'}`
    + ` (tGreen ${game.start.tGreen === 999 ? '-' : game.start.tGreen.toFixed(1)})`);
}
