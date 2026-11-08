import { wakeStep } from '../../src/physics/wake.ts';
for (const kmh of [100, 200]) { const v = kmh / 3.6, row = [];
  for (const gap of [5, 8, 15, 25, 35]) {
    const a = { x: gap, y: 0, vx: v, vy: 0, heading: 0, spec: { wid: 1.7 } }, b = { x: 0, y: 0, vx: v, vy: 0, heading: 0, spec: { wid: 1.7 } };
    wakeStep([a, b]); row.push(`${gap} m ${Math.round((1 - b.dragMul) * 100)}%`); }
  console.log(`${kmh} km/h: ${row.join(', ')}`); }
