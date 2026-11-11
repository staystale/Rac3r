// _moraw.mjs - Moanaco's mapped race line at game scale, for venueplan EXTRA (scratch)
import fs from 'node:fs';
const { MOANACO_VENUE: data } = await import('../../src/world/levels/venues/moanaco.ts');
const scale = 0.5 * 3337 / 3329, out = [];
for (const piece of data.pieces) out.push({ pts: piece.pts.map(([x, y]) => [x * scale, y * scale]), col: '#ff00ff' });
for (const lane of data.pitLanes) out.push({ pts: lane.pts.map(([x, y]) => [x * scale, y * scale]), col: '#00aaff' });
fs.writeFileSync(process.argv[2], JSON.stringify(out));
