// _propgridcheck.mjs - render/propgrid.ts against the whole-list walk: for each level, cameras
// along the lap at several zooms and screen sizes, every prop props.ts propVisible passes (or a
// slip / garage row, drawn untested) must be in the grid's list, and the list must be ascending.
// node tools/scratch/_propgridcheck.mjs [level,level,...]
import * as L from '../../src/lab.ts';
import { addStageLevels } from '../../src/stagegen.ts';
import { propsNear, screenBox } from '../../src/render/propgrid.ts';

addStageLevels();
const ids = (process.argv[2] || 'spa,nordschlep,brands-snatch,gen-forest-medium-mixed-1001')
  .split(',');
const visible = (view, prop, sx, sy, ppm) => {
  const margin = Math.max(150,
    Math.max(prop.w || 0, prop.h || 0, prop.size || 0, prop.wid || 0, prop.s || 0, 18) * ppm
      * 0.75, (prop.reach || 0) * ppm);
  return !(sx < -margin || sx > view.W + margin || sy < -margin || sy > view.H + margin);
};
let bad = 0;
for (const id of ids) {
  const level = L.LEVELS.find((lv) => lv.id === id);
  if (!level) { console.log(id, 'no such level'); bad++; continue; }
  L.setLevel(id);
  const props = L.LEVEL.props || [], sub = L.LEVEL.subtrack;
  let tests = 0, walked = 0, listed = 0, fullWalks = 0;
  for (const [W, H] of [[844, 390], [390, 844], [1920, 1080]]) {
    for (const ppm of [2, 6, 12, 24, 40]) {
      for (let k = 0; k < sub.pts.length; k += 7) {
        const cam = { x: sub.pts[k].x + (k % 13) - 6, y: sub.pts[k].y + (k % 11) - 5 };
        const view = { W, H };
        const toScreenX = (x) => (x - cam.x) * ppm + W / 2;
        const toScreenY = (y) => (y - cam.y) * ppm + H / 2;
        const near = propsNear(props, screenBox(view, toScreenX, toScreenY, 150));
        tests++;
        walked += props.length;
        if (!near) { fullWalks++; listed += props.length; continue; }
        listed += near.length;
        for (let i = 1; i < near.length; i++) if (near[i] <= near[i - 1]) { bad++; break; }
        const inList = new Set(near);
        props.forEach((prop, at) => {
          const must = prop.kind === 'garagerow' || prop.kind === 'slip'
            || visible(view, prop, toScreenX(prop.x), toScreenY(prop.y), ppm);
          if (must && !inList.has(at)) {
            if (bad++ < 5) console.log(id, 'MISSED', at, prop.kind, prop.x, prop.y, 'cam', cam, ppm);
          }
        });
      }
    }
  }
  console.log(`${id}: ${props.length} props, ${tests} screens, tested ${(listed / tests)
    .toFixed(0)} a screen of ${props.length} (${fullWalks} whole-list walks)`);
}
console.log(bad ? `propgridcheck: ${bad} BAD` : 'propgridcheck: OK');
