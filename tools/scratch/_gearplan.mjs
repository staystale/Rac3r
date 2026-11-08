import { spec, CAR_IDS } from '../../src/cars.ts';
import { CAR_STATS } from '../../src/carstats.js';
const torqueAt = (s, rpm) => { const c = s.curve; if (rpm <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) if (rpm <= c[i][0]) { const [r0, t0] = c[i - 1], [r1, t1] = c[i];
    return t0 + (t1 - t0) * (rpm - r0) / (r1 - r0); } return c[c.length - 1][1]; };
for (const id of CAR_IDS) {
  const s = spec(id); let pk = 0, pkRpm = 0;
  for (let rpm = 1000; rpm <= s.redline; rpm += 50) { const p = torqueAt(s, rpm) * rpm * Math.PI / 30; if (p > pk) { pk = p; pkRpm = rpm; } }
  // drag-limited top: eff*P = dragC v^3 + rollC m g v
  let v = 10; for (let i = 0; i < 200; i++) { const need = s.dragC * v ** 3 + s.rollC * s.mass * 9.81 * v; v *= Math.cbrt(s.driveEff * pk / need) ** 0.5; }
  const kmh = (g) => s.redline / (g * s.finalDrive) * Math.PI / 30 * s.wheelR * 3.6;
  const gears = s.gears.map((g) => kmh(g).toFixed(0)).join('/');
  console.log(`${id.padEnd(13)} ${(pk / 745.7).toFixed(0)}hp@${pkRpm} red ${s.redline} wheelR ${s.wheelR} | gears@red ${gears} | drag-limit ${(v * 3.6).toFixed(0)} measured top ${CAR_STATS[id].topKph}`);
}
// ---- the plan: top gear so the drag-limited top falls at peak power (or 95 % of the redline)
const ROAD = ['hatch-fwd', 'hatch-rwd', 'saloon-rwd', 'wrz-awd', 'estate-4x4', 'track-rwd',
  'naffcar', 'f2-rwd'];
console.log('\nplan:');
for (const id of ROAD) {
  const s = spec(id); let pk = 0, pkRpm = 0;
  for (let rpm = 1000; rpm <= s.redline; rpm += 50) { const p = torqueAt(s, rpm) * rpm * Math.PI / 30; if (p > pk) { pk = p; pkRpm = rpm; } }
  let v = 10; for (let i = 0; i < 200; i++) { const need = s.dragC * v ** 3 + s.rollC * s.mass * 9.81 * v; v *= Math.cbrt(s.driveEff * pk / need) ** 0.5; }
  const rpmTop = Math.min(pkRpm, 0.95 * s.redline);
  const gTop = rpmTop * Math.PI / 30 * s.wheelR / (v * s.finalDrive);
  const g = s.gears.slice(), N = g.length, n = N - 2;
  const S = Math.log(g[1] / gTop), x = 2 * S / (1.7 * n);
  for (let k = 0; k < n; k++) g[2 + k] = g[1 + k] / Math.exp(x * (1 - 0.3 * k / Math.max(1, n - 1)));
  g[N - 1] = gTop;
  const r2 = g.map((r) => Number(r.toFixed(2)));
  const kmh = (r) => (s.redline / (r * s.finalDrive) * Math.PI / 30 * s.wheelR * 3.6).toFixed(0);
  console.log(`  '${id}': [${r2.join(', ')}],   // ${r2.map(kmh).join('/')} (was ${s.gears.map(kmh).join('/')}), top ~${(v * 3.6).toFixed(0)}`);
}
