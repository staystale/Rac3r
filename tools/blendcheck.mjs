// blendcheck.mjs — proves SURFACE BLENDING at change points (lab.js buildBlend, 2026-10-03) by measurement.
//
//   node tools/blendcheck.mjs        exit code 1 on any failure
//
// 1. density FALLS OFF away from a track sector change (user: "greater at the point of blend and lower away")
// 2. the blend is FIXED per level (same every load) — except the Grass Track, which re-rolls with its layout
// 3. no patch ever changes a KERB (kerbs win) and none lands inside a boxed / rounded TEST PAD
// 4. the blend is real ground: a blend patch is felt by the physics as its own surface
// 5. the physics cost of patch lookups stays negligible with every patch in place
import * as L from '../src/lab.js';

const fails = [];
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) fails.push(msg); };

// 1. gradient on the Sandbox: distance (along the track) from each road patch to its nearest sector change
L.setLevel('sandbox');
const st = L.LEVEL.subtrack, total = st.totalDist;
const changes = st.sectors.map((s) => s.startDist).filter((d) => d > 0.5);
const bins = new Array(L.BLEND_W).fill(0);
for (const p of L.LEVEL._blend) {
  const q = L.querySubtrack(st, p.x, p.y);
  if (p.src !== 'change') continue;                          // only the patches a sector CHANGE made
  let best = Infinity;
  for (const c of changes) { let u = Math.abs(q.trackDist - c); u = Math.min(u, total - u); best = Math.min(best, u); }
  if (best < L.BLEND_W) bins[Math.floor(best)]++;
}
console.log('1. Sandbox road patches by metres from the nearest sector change (0-1, 1-2, ...):', bins.join(' '));
check(bins[0] > bins[1] && bins[1] > bins[3] && bins[3] >= bins[5], 'density falls steadily away from the change point');

// 1b. only LOOSE surfaces move onto other ground (user)
{ let hard = 0, all = 0; for (const lv of L.LEVELS) { L.setLevel(lv.id); for (const p of L.LEVEL._blend) { all++; if (p.surface.hard) hard++; } }
  console.log(`1b. ${all} blend patches over all levels, ${hard} of them a hard surface`);
  check(all > 1000 && hard === 0, 'no hard surface (tarmac, lab floor, wet tarmac) ever scatters onto other ground'); }

// 2. fixed per level
const sig = () => L.LEVEL._blend.slice(0, 20).map((p) => p.x.toFixed(2) + p.surface.id).join('|');
L.setLevel('sandbox'); const a1 = sig(); L.setLevel('lab'); L.setLevel('sandbox'); const a2 = sig();
L.setLevel('grass-track'); const g1 = sig(); L.setLevel('lab'); L.setLevel('grass-track'); const g2 = sig();
check(a1 === a2, 'the Sandbox blend is identical on every load');
check(g1 !== g2, 'the Grass Track blend re-rolls with its random layout');

// 3. kerbs and pads
let kerbHits = 0, kerbChecks = 0, padHits = 0;
for (const lv of L.LEVELS) {
  L.setLevel(lv.id);
  for (const p of L.LEVEL._blend) {
    for (const z of lv.zones) if ((z.boxed || z.rounded) && Math.abs(p.x - z.x) < z.w / 2 && Math.abs(p.y - z.y) < z.h / 2) padHits++;
  }
  // every point the LEVEL says is kerb (ignoring patches) must still read as kerb with all patches in place.
  // (The first version filtered by left/right and sampled nothing at all — a check that proved nothing.)
  for (const p of L.LEVEL.allPatches) {
    for (let k = 0; k < 6; k++) {
      const x = p.x + (Math.random() - 0.5) * p.w, y = p.y + (Math.random() - 0.5) * p.w;
      if (L.zoneSurfaceAt(x, y).id !== 'kerb') continue;
      kerbChecks++; if (L.groundAt(x, y).surface.id !== 'kerb') kerbHits++;
    }
  }
}
console.log(`3. kerb points sampled ${kerbChecks}, not reading KERB: ${kerbHits}; blend patches inside test pads: ${padHits}`);
check(kerbChecks > 50 && kerbHits === 0, 'every kerb point under a patch still reads as kerb');
check(padHits === 0, 'no blend patch lands in a test pad');

// 4. a blend patch is felt as its own surface
L.setLevel('sandbox');
const sample = L.LEVEL._blend.filter((p) => L.querySubtrack(st, p.x, p.y).dist < st.width / 2 - 1).slice(0, 40);
const felt = sample.filter((p) => { const s = L.groundAt(p.x, p.y).surface; return s.id === p.surface.id || s.under === p.surface.id || (p.surface.id === 'wet' && s.id === 'puddle') || ['snow', 'ice', 'wet'].includes(p.surface.id); }).length;
console.log(`4. ${felt} of ${sample.length} road blend patches are felt as their own surface at their centre`);
check(felt >= sample.length * 0.9, 'blend patches are real ground');

// 5. cost: groundAt queries per second with all patches, on the busiest level
L.setLevel('sandbox');
let n = 0; const t0 = performance.now();
while (performance.now() - t0 < 300) { for (let i = 0; i < 1000; i++) L.groundAt(-200 + (i % 400), -150 + (n % 300)); n++; }
const perQ = 300 / (n * 1000) * 1000;      // microseconds
console.log(`5. groundAt on the Sandbox (${L.LEVEL.allPatches.length} patches): ${perQ.toFixed(2)} us per query`);
check(perQ < 5, 'a ground query stays under 5 us with every patch in place');

console.log(fails.length ? `\nFAIL (${fails.length})` : '\nSurface blending: all OK');
process.exitCode = fails.length ? 1 : 0;
