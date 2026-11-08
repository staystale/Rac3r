import fs from 'node:fs';
const p = 'src/stagegen.ts';
let s = fs.readFileSync(p, 'utf8');
const a = s.indexOf('/** A stage theme: its name');
const b = s.indexOf('}\n', s.indexOf('interface Dress {')) + 2;
if (a < 0 || b < 2) throw new Error('types block');
let block = s.slice(a, b);
s = s.slice(0, a) + s.slice(b);
block = block.replace(/^interface /gm, 'export interface ');
fs.writeFileSync('src/world/stagetypes.ts', `// world/stagetypes.ts: the shapes the rally stage generator (stagegen.ts) shares - a theme, the
// growing road and its elements, and the dressing context.
import type { BushPlan, Cone, Prop, Barrier, Subtrack } from './types.ts';
import type { trackKit } from './levels/kit.ts';

${block}`);
s = s.replace(/import type \{ BushPlan, Cone, Prop, Barrier, Subtrack, Level[^}]*\} from '.\/world\/types.ts';\n/, (m) => m);
fs.writeFileSync(p, s);
console.log('ok');
