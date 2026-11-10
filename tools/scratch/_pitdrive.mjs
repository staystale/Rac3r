// _pitdrive.mjs - A CAR DOWN A VENUE'S PIT LANE, end to end (node, the game's world clamp): it follows
// the pit lane, the hand-laid pit roads and any pit tunnel (VenueSpec.pitTunnel: Yass Marina's exit
// under the first corner) by pure pursuit at pit speed, and reports each barrier / wall loss of
// speed, when it went on and off a crossing, and whether it reached the exit lane's end.
// YASMARINA=1 node tools/scratch/_pitdrive.mjs [level] [car] [kmh]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { clampWorld } from '../../src/world/crossings.ts';
import { LEVELS } from '../../src/world/levels/index.ts';

const [lv = 'yasmarina', carId = 'hatch-rwd', kmhArg = '70'] = process.argv.slice(2);
const DT = PHYSICS_STEP_SECONDS, LIMIT = +kmhArg / 3.6;
L.setLevel(lv);
const level = L.LEVEL, spec = LEVELS.find((entry) => entry.id === lv);
const pits = level.lanes.filter((lane) => lane.width === 9);
// the path: the pit lane, then each hand-laid 9 m road and the exit lane, in the order they meet
const pieces = pits.slice();
const path = [];
const add = (pts) => {
  if (!path.length) { path.push(...pts); return; }
  const last = path.at(-1), first = pts[0], end = pts.at(-1);
  const forward = Math.hypot(first[0] - last[0], first[1] - last[1])
    <= Math.hypot(end[0] - last[0], end[1] - last[1]);
  path.push(...(forward ? pts : pts.slice().reverse()));
};
add(pieces.shift().pts);
while (pieces.length) {
  const last = path.at(-1);
  pieces.sort((a, b) => Math.min(...[a.pts[0], a.pts.at(-1)].map((p) => Math.hypot(p[0] - last[0],
    p[1] - last[1]))) - Math.min(...[b.pts[0], b.pts.at(-1)].map((p) => Math.hypot(p[0] - last[0],
    p[1] - last[1]))));
  add(pieces.shift().pts);
}
const car = makeCar(carId);
const head = Math.atan2(path[2][1] - path[0][1], path[2][0] - path[0][0]);
reset(car, path[0][0], path[0][1], head);
car.vx = 10 * Math.cos(head); car.vy = 10 * Math.sin(head);
let idx = 0, t = 0, onWay = -1;
const events = [];
const lengthAt = [0];
for (let i = 1; i < path.length; i++) lengthAt.push(lengthAt[i - 1] + Math.hypot(path[i][0]
  - path[i - 1][0], path[i][1] - path[i - 1][1]));
while (t < 120 && idx < path.length - 3) {
  // the nearest path point ahead, then a point LOOK m on
  for (let k = idx; k < Math.min(path.length, idx + 40); k++)
    if (Math.hypot(path[k][0] - car.x, path[k][1] - car.y) < Math.hypot(path[idx][0] - car.x,
      path[idx][1] - car.y)) idx = k;
  let aim = idx;
  while (aim < path.length - 1 && lengthAt[aim] - lengthAt[idx] < 8) aim++;
  const want = Math.atan2(path[aim][1] - car.y, path[aim][0] - car.x);
  const err = Math.atan2(Math.sin(want - car.heading), Math.cos(want - car.heading));
  const speed = Math.hypot(car.vx, car.vy);
  const input = { steer: Math.max(-1, Math.min(1, err * 2)), throttle: speed < LIMIT ? 0.6 : 0,
    brake: speed > LIMIT + 1 ? 0.4 : 0, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false };
  const v0 = speed;
  clampWorld(car, DT);
  const lost = v0 - Math.hypot(car.vx, car.vy);
  if (lost > 1) events.push(`${t.toFixed(1)} s: lost ${lost.toFixed(1)} m/s at ${car.x.toFixed(1)},${
    car.y.toFixed(1)} (${Math.round(lengthAt[idx])} m down the pit lane)`);
  const way = car.crossing ?? -1;
  if (way !== onWay) {
    events.push(`${t.toFixed(1)} s: ${way >= 0 ? `onto crossing ${way} (${level.crossings[way].kind})`
      : 'off the crossing'} at ${Math.round(lengthAt[idx])} m`);
    onWay = way;
  }
  L.applyGround(car, DT);
  step(car, input, DT);
  t += DT;
}
for (const line of events) console.log(line);
const total = lengthAt.at(-1);
console.log(`${lv}: the pit path ${total.toFixed(0)} m (${spec ? 'pit lanes ' + pits.length : ''}), reached ${
  Math.round(lengthAt[idx])} m in ${t.toFixed(1)} s${idx >= path.length - 3 ? ' - THE END' : ' - stopped short'}`);
