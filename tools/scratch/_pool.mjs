// _pool.mjs - the puff pool under load (render/particles.ts as is): N cars throwing a surface's
// dust, the player also smoking for SMOKE_S then easing off. Per owner: puffs thrown, share cut
// short by a full pool (evicted before their life ran out), and how much of its life it got.
// node tools/scratch/_pool.mjs [surface] [aiCars]
import { createParticles } from '../../src/render/particles.ts';
import { SURFACES } from '../../src/world/surfaces.ts';
const surf = SURFACES[process.argv[2] || 'gravel'], nAi = +(process.argv[3] ?? 5);
const SMOKE_S = 3, TOTAL_S = 9, DT = 1 / 60;
const g2d = { fillRect() {}, save() {}, restore() {}, setTransform() {}, globalAlpha: 1, fillStyle: '' };
const view = { ctx: g2d, dpr: 2, W: 390, H: 844 };
// the camera on you, 8 px a metre (a phone in portrait shows ~49 x 105 m)
const cam = { x: 0, y: 0 };
const parts = createParticles(view, cam, { PPMz: () => 8, toScreenX: (x) => (x - cam.x) * 8 + 195,
  toScreenY: (y) => (y - cam.y) * 8 + 422 });
// the AI around you, ahead and behind, 12 m apart
const mkCar = (i) => ({ x: (i % 2 ? -1 : 1) * Math.ceil(i / 2) * 12, y: 0, vx: 20, vy: 0, heading: 0, tyreT: [140, 140, 140, 140],
  t: { slipSpeedF: 6, slipSpeedR: 6, loadKF: 1, loadKR: 1 } });
const cars = [mkCar(0)]; for (let i = 1; i <= nAi; i++) cars.push(mkCar(i));
let t = 0;
const marks = { wheelsOf: (car) => [0, 1, 2, 3].map((k) => ({ x: car.x + k * 0.5, y: car.y,
  spray: surf.spray, heat: car === cars[0] && t < SMOKE_S ? 140 : 40, slip: 6 })) };
const owner = new Map();   // puff -> [who, kind]
const stats = {};
const tally = (key) => (stats[key] ??= { thrown: 0, cut: 0, lifeGot: 0, lifeWanted: 0 });
// the two pools, found as the puffs are pushed (particles.ts keeps them private)
const pools = new Set(); const push0 = Array.prototype.push;
Array.prototype.push = function (...items) { if (items[0] && 'r0' in items[0] && 'grow' in items[0]) pools.add(this);
  return push0.apply(this, items); };
const live = () => [...pools].flat();
let prev = new Set(), busy = 0;
for (; t < TOTAL_S; t += DT) {
  cam.x = cars[0].x; const t0 = performance.now();
  cars.forEach((car, i) => { car.x += car.vx * DT;
    parts.addSpray(car, marks, DT, i > 0); parts.addSmoke(car, marks, DT, i > 0);
    for (const puff of live()) if (!owner.has(puff)) {
      const kind = puff.rgb === '225,225,230' ? 'smoke' : 'dust';
      owner.set(puff, [i ? 'ai' : 'you', kind]); tally((i ? 'ai ' : 'you ') + kind).thrown++; } });
  parts.drawPuffs(DT); parts.drawOverPuffs(DT); busy += performance.now() - t0;
  const now = new Set(live());
  for (const puff of prev) if (!now.has(puff)) { const [who, kind] = owner.get(puff), st = tally(who + ' ' + kind);
    st.lifeGot += Math.min(puff.age, puff.life); st.lifeWanted += puff.life;
    if (puff.age < puff.life - 1e-6) { st.cut++; const px = (puff.x - cam.x) * 8 + 195, py = (puff.y - cam.y) * 8 + 422;
      if (px > -20 && px < 410 && py > -20 && py < 864) st.seen = (st.seen || 0) + 1; } }
  prev = now;
}
for (const puff of prev) { const [who, kind] = owner.get(puff), st = tally(who + ' ' + kind);
  st.lifeGot += puff.age; st.lifeWanted += Math.max(puff.age, puff.age); }
console.log((process.argv[2] || 'gravel') + ', you + ' + nAi + ' AI' + (process.env.PUFFPOOL ? ' ?puffpool' : '') + ': puffs live ' + prev.size + ', ' + (busy / (TOTAL_S / DT)).toFixed(3) + ' ms a frame (node)');
for (const [key, st] of Object.entries(stats)) console.log(key.padEnd(10), 'thrown', st.thrown,
  'cut short', Math.round(100 * st.cut / Math.max(1, st.thrown)) + '%', 'ON SCREEN', Math.round(100 * (st.seen || 0) / Math.max(1, st.thrown)) + '%',
  'life got', Math.round(100 * st.lifeGot / Math.max(1e-9, st.lifeWanted)) + '%');

