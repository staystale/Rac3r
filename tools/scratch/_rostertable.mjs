// the roster as a table: id, name, class, mass, peak power / torque, gears, final, drag, tyre
import { ROSTER } from '../../src/cars.ts';
import { CAR_STATS } from '../../src/carstats.ts';
for (const r of ROSTER) {
  let pk = 0, pkR = 0, tq = 0;
  for (const [rpm, nm] of r.curve || []) { const kw = nm * rpm * Math.PI / 30 / 1000; if (kw > pk) { pk = kw; pkR = rpm; } tq = Math.max(tq, nm); }
  const st = CAR_STATS[r.id] || {};
  console.log([r.id, r.name, r.sub, r.mass, Math.round(pk * 1.341) + 'hp@' + pkR, Math.round(tq) + 'Nm',
    (r.gears || []).length + 'sp', r.finalDrive, r.dragC, r.redline, JSON.stringify(st)].join(' | '));
}
