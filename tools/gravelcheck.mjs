// gravelcheck.mjs — does the run-off work like a GRAVEL TRAP?
//
// User, 2026-09-28: "can the gravel trap actually work like a gravel trap - slow you down grab ya
// wheels ect". A gravel trap is not "tarmac with less grip" — less grip would make you slide FURTHER.
// It stops you because the wheels sink and bulldoze, and it hauls a yawed car straight. So:
//   1. IT STOPS YOU — distance and time from entry to standstill, and it must beat the tarmac figure
//      for coasting, not lose to it.
//   2. SIDEWAYS DIGS IN HARDER than straight. A spun car should stop in far less distance.
//   3. IT GRABS — a yawed car must be pulled straight, not left spinning.
//   4. YOU GET STUCK — full throttle from rest in gravel must barely move the car.
//   5. IT DOES NOT TOUCH THE TARMAC. Every number on the floor is unchanged.
import { makeCar, step, reset, neutralInput, PHYSICS_STEP_SECONDS } from '../src/vehicle.ts';
import { applyGround, groundAt, FLOOR, FENCE, RUNOFF_MU, SURFACE_TARMAC, LEVELS, setLevel, SURFACES } from '../src/lab.js';
// S-B (2026-10-06): the lab's south edge moved 480 m south, so the trap is measured on a BARE square lab floor (kerbcheck.mjs the same)
{ const lab = LEVELS.find((l) => l.id === 'lab');   // the old lab's quarters + its blend / inclusion patches; no extension, no bounds
  LEVELS.push({ id: 'edge-test', name: 'edge', base: SURFACES.lab, zones: lab.zones.filter((z) => !z.ext), bumps: [], paint: [], boards: [], cones: [], props: [], spawn: { x: 0, y: 0, heading: 0 }, _blend: lab._blend, _incl: lab._incl, _coversBase: lab._coversBase });
  setLevel('edge-test'); }
import { CAR_IDS } from '../src/cars.ts';

// MEASURED BUG in this very harness, 2026-09-28: it dropped the car in at FLOOR+2 and measured distance
// to a stop — but every run above 10 m/s reached the FENCE, so it printed 27.5 / 27.6 / 27.6 / 27.6 m
// for entry speeds of 10 to 40 m/s. That is the trap's WIDTH, not a measurement. CLAUDE.md rule 1:
// identical outcomes across different inputs is a bug, and this time it was in my instrument.
//
// So there are two tests. This one pins a SURFACE and runs in free space, which characterises the
// surface itself with no geometry in the way.
function onSurface(id, surf, v, yaw = 0, inp0 = {}, secs = 20) {
  const car = makeCar(id);
  reset(car, 0, 0, Math.PI / 2 + (yaw * Math.PI) / 180);
  car.vx = 0; car.vy = v;
  car.gear = 3; car.rpm = 3500;
  const inp = { ...neutralInput(), ...inp0 };
  const y0 = car.y;
  let t = 0, maxYaw = Math.abs(yaw);
  for (let i = 0; i < 120 * secs; i++) {
    car.surface = surf;                       // pinned: no fence, no grading, just this surface
    car.groundF = car.groundR = 0; car.groundVF = car.groundVR = 0;
    step(car, inp, PHYSICS_STEP_SECONDS);
    t += PHYSICS_STEP_SECONDS;
    const beta = Math.abs(Math.atan2(car.t.vLat, car.t.vLong) * 57.3);
    if (Math.hypot(car.vx, car.vy) > 2) maxYaw = Math.max(maxYaw, beta);
    if (Math.hypot(car.vx, car.vy) < 0.4) break;
  }
  return { dist: Math.hypot(car.x, car.y - y0), t, maxYaw,
           endYaw: Math.abs(Math.atan2(car.t.vLat, car.t.vLong) * 57.3),
           stopped: Math.hypot(car.vx, car.vy) < 0.4 };
}

// And this one uses the REAL lab, and reports the thing that actually matters there: how fast you are
// still going when you reach the fence, or that you stopped before it.
function realTrap(id, v, yaw = 0) {
  const car = makeCar(id);
  reset(car, 0, FLOOR - 1, Math.PI / 2 + (yaw * Math.PI) / 180);
  car.vx = 0; car.vy = v;
  car.gear = 3; car.rpm = 3500;
  const inp = { ...neutralInput() };
  const y0 = car.y;
  for (let i = 0; i < 120 * 20; i++) {
    applyGround(car, PHYSICS_STEP_SECONDS);
    step(car, inp, PHYSICS_STEP_SECONDS);
    if (Math.abs(car.y) >= FENCE - 0.6) {
      return { hit: true, vHit: Math.hypot(car.vx, car.vy), dist: Math.abs(car.y - y0) };
    }
    if (Math.hypot(car.vx, car.vy) < 0.4) {
      return { hit: false, vHit: 0, dist: Math.abs(car.y - y0) };
    }
  }
  return { hit: false, vHit: 0, dist: Math.abs(car.y - y0) };
}

const F = (v, n = 1) => v.toFixed(n).padStart(n + 4);
const GRAVEL_EDGE = groundAt(0, FLOOR + 1).surface;        // shallow pea gravel at the lip
const GRAVEL_DEEP = groundAt(0, FENCE - 1).surface;        // the deep stuff by the barrier

console.log('SURFACES  tarmac plough', SURFACE_TARMAC.plough,
  ' gravel edge', GRAVEL_EDGE.plough.toFixed(2), ' gravel deep', GRAVEL_DEEP.plough.toFixed(2),
  ' gravel mu', RUNOFF_MU);

console.log('\n1. IT STOPS YOU — coasting, no brakes, measured in free space (hatch-rwd)');
console.log('   v m/s   gravel: dist    time   stopped    tarmac: dist    ratio');
for (const v of [10, 20, 30, 40]) {
  const g = onSurface('hatch-rwd', GRAVEL_EDGE, v);
  const t = onSurface('hatch-rwd', SURFACE_TARMAC, v, 0, {}, 60);
  console.log(`   ${String(v).padStart(4)}    ${F(g.dist)} m  ${F(g.t, 2)}s   ${g.stopped ? 'yes' : 'NO '}      ` +
              `${F(t.dist)} m   ${F(t.dist / g.dist, 1)}x further on tarmac`);
}

console.log('\n2. SIDEWAYS DIGS IN HARDER — 30 m/s in, different body angle (shallow gravel)');
console.log('   yaw deg   dist     time    hauled straight to');
for (const yaw of [0, 20, 45, 75, 90]) {
  const g = onSurface('hatch-rwd', GRAVEL_EDGE, 30, yaw);
  console.log(`   ${String(yaw).padStart(5)}     ${F(g.dist)} m  ${F(g.t, 2)}s   ${F(g.endYaw)} deg`);
}

console.log('\n3. IT GRABS — every car, 30 m/s in at 45 deg');
console.log('   car             dist     time    ended at');
for (const id of CAR_IDS) {
  const g = onSurface(id, GRAVEL_EDGE, 30, 45);
  console.log(`   ${id.padEnd(15)} ${F(g.dist)} m  ${F(g.t, 2)}s   ${F(g.endYaw)} deg`);
}

console.log('\n4. YOU GET STUCK — full throttle from rest, distance covered in 4 s');
console.log('   car             in gravel   on tarmac');
for (const id of CAR_IDS) {
  const go = (surf) => {
    const car = makeCar(id);
    reset(car, 0, 0, Math.PI / 2);
    car.gear = 1; car.rpm = 1200;
    const inp = { ...neutralInput(), throttle: 1 };
    for (let i = 0; i < 120 * 4; i++) {
      car.surface = surf;
      car.groundF = car.groundR = 0; car.groundVF = car.groundVR = 0;
      step(car, inp, PHYSICS_STEP_SECONDS);
    }
    return Math.hypot(car.x, car.y);
  };
  console.log(`   ${id.padEnd(15)} ${F(go(GRAVEL_EDGE))} m    ${F(go(SURFACE_TARMAC))} m`);
}

console.log('\n5. THE REAL TRAP — off the floor at speed. Does the 42 m of graded gravel catch you?');
console.log('   v m/s   straight: stops in    at the fence      spun 90 deg: stops in');
for (const v of [15, 25, 35, 45]) {
  const a = realTrap('hatch-rwd', v);
  const b = realTrap('hatch-rwd', v, 90);
  console.log(`   ${String(v).padStart(4)}    ${F(a.dist)} m ${a.hit ? '(hit fence)' : '(caught)   '}    ` +
              `${a.hit ? F(a.vHit) + ' m/s ' : '  --   '}        ${F(b.dist)} m ${b.hit ? '(hit fence)' : '(caught)'}`);
}

setLevel('lab');   // section 6 brakes in the middle of the REAL lab (the bare edge level has another natural-terrain seed)
console.log('\n6. THE TARMAC IS UNTOUCHED — plough is 0 there, so this is the stock braking figure.');
{
  const car = makeCar('hatch-rwd');
  reset(car, 0, 0, 0);
  car.vx = 30; car.gear = 4; car.rpm = 4000;
  const inp = { ...neutralInput(), brake: 1 };
  let t = 0;
  const x0 = car.x;
  while (Math.hypot(car.vx, car.vy) > 0.5 && t < 10) { applyGround(car, PHYSICS_STEP_SECONDS); step(car, inp, PHYSICS_STEP_SECONDS); t += PHYSICS_STEP_SECONDS; }
  console.log(`   braking 30 m/s -> 0 on the floor: ${(car.x - x0).toFixed(1)} m in ${t.toFixed(2)}s`);
  console.log(`   surface: ${car.surface.id}  mu ${car.surface.mu}  plough ${car.surface.plough}  mark ${car.surface.mark ? 'yes' : 'none'}`);
}
