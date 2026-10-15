// scratch (S-B, 2026-10-06): the OLD lab square as data - ground surface + height every 3 m over x -255..255, y -255..250, and the
// cone list - so the extended lab can be proved to leave every old metre exactly as it was. node tools/_labbase.mjs [out.json]
// (run once BEFORE the change to write the baseline; tools/_labcheck.mjs compares against it)
import { writeFileSync } from 'node:fs';
const L = await import('../../src/lab.js');
L.setLevel('lab');
const g = [];
for (let x = -255; x <= 255; x += 3) for (let y = -255; y <= 250; y += 3) { const q = L.groundAt(x, y); g.push(q.surface.id + ':' + q.h.toFixed(4)); }
const cones = L.LEVEL.cones.map((c) => `${c.kind || 'cone'}@${(+c.x).toFixed(2)},${(+c.y).toFixed(2)}`);
const out = process.argv[2] || '../../shots/look/sb-base/lab-ground.json';
writeFileSync(new URL(out, import.meta.url), JSON.stringify({ g, cones, zones: L.LEVEL.zones.length, bumps: L.LEVEL.bumps.length }));
console.log(`wrote ${out}: ${g.length} ground samples, ${cones.length} cones, ${L.LEVEL.zones.length} zones, ${L.LEVEL.bumps.length} bumps`);
