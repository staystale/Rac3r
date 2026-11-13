// _gapjump.mjs - THE GAP JUMP on L.A. Lively's joker (scratch): each car put on the joker straight
// at a speed, held to it (throttle on, a line held on the lane's middle), over the kicker, the gap
// and the landing deck; reports where it left the ground and touched down (m past the kicker's
// lip: the deck starts 16 m past it), its airtime, the hardest landing load, whether it cleared
// the gap, and its time over the straight (the cost of landing short). No browser.
// (env OFF: the line held that many m off the joker's middle)
// node tools/scratch/_gapjump.mjs [cars, comma separated] [speeds km/h]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { LALIVELY_JUMP } from '../../src/world/levels/venues/lalively.ts';

const cars = (process.argv[2] || 'rally-4x4,rx-super,hatch-fwd,muscle-rwd').split(',');
const speeds = (process.argv[3] || '40,50,60,70,80,90,100').split(',').map(Number);
L.setLevel('xgayms');
// the kicker's and the landing's middle pieces (each laid as pieces side by side across the road)
const middle = (kind) => { const all = LALIVELY_JUMP.filter((bump) => bump.kind === kind); return all[(all.length - 1) >> 1]; };
const kicker = middle('ramp'), landing = middle('table');
// the straight runs west (rot PI): the lip at the kicker's west end, the deck from 16 m past it
const lipX = kicker.x - kicker.len / 2, deckX = landing.x + landing.len / 2 - 0.3 * landing.len;
const lineY = kicker.y + +(process.env.OFF || 0), fromX = kicker.x + 45, untilX = landing.x - landing.len / 2 - 12;
for (const id of cars) {
  console.log(`${id} (lip x ${lipX}, deck from x ${deckX})`);
  for (const kmh of speeds) {
    const car = makeCar(id);
    reset(car, fromX, lineY, Math.PI);
    car.vx = -kmh / 3.6;
    let time = 0, leave = null, land = null, air = 0, worst = 0, stuck = false;
    while (car.x > untilX) {
      const speed = Math.hypot(car.vx, car.vy) * 3.6;
      // hold the lane's middle: steer back toward y = lineY, heading PI
      const headErr = Math.atan2(Math.sin(car.heading - Math.PI), Math.cos(car.heading - Math.PI));
      const steer = Math.max(-1, Math.min(1, -(car.y - lineY) * 0.08 - headErr * 1.5));
      const input = { throttle: speed < kmh ? 1 : 0.15, brake: 0, steer, handbrake: 0 };
      L.applyGround(car, PHYSICS_STEP_SECONDS);
      step(car, input, PHYSICS_STEP_SECONDS);
      time += PHYSICS_STEP_SECONDS;
      if (car.air > 0 && leave == null && car.x < kicker.x + kicker.len / 2) leave = car.x;
      if (leave != null && land == null && car.air === 0 && car.x < leave - 1) land = car.x;
      air = Math.max(air, car.air);
      if (land != null) worst = Math.max(worst, car.loadK);
      if (time > 30) { stuck = true; break; }
    }
    const past = (x) => (x == null ? '-' : (lipX - x).toFixed(1));
    const cleared = land != null && land <= deckX;
    console.log(`  ${String(kmh).padStart(3)} km/h: off ${past(leave)} m, down ${past(land)} m,`
      + ` air ${air.toFixed(2)} s, landing load ${worst.toFixed(2)}, ${cleared ? 'CLEARED' : 'short'},`
      + ` straight ${time.toFixed(2)} s${stuck ? ' STUCK' : ''}`);
  }
}
