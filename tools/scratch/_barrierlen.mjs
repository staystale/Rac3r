// _barrierlen.mjs - each venue layout's barriers by kind, m (what a venue rule change adds or
// takes away). [RUNOFF=1] [SILLYSTONE=1] node tools/scratch/_barrierlen.mjs [ids,comma]
import * as L from '../../src/lab.ts';
const ids = (process.argv[2] || 'brands-snatch,castle-cum,snotterton,dongington,sillystone,oultonpork').split(',');
for (const id of ids) {
  L.setLevel(id);
  const by = {};
  for (const b of L.LEVEL.barriers || []) {
    let len = 0;
    for (let i = 0; i < b.pts.length - 1; i++) len += Math.hypot(b.pts[i + 1][0] - b.pts[i][0], b.pts[i + 1][1] - b.pts[i][1]);
    by[b.kind] = (by[b.kind] || 0) + len;
  }
  console.log(id.padEnd(14), Object.entries(by).map(([k, v]) => `${k} ${Math.round(v)}`).join(', '));
}
