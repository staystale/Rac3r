// scratch: apply exact-text replacements from a JSON file [[file, old, new], ...]; reports any old text not found (and changes nothing then)
import { readFileSync, writeFileSync } from 'node:fs';
const edits = JSON.parse(readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, '')), files = {};
let bad = 0;
for (const [f, a, b] of edits) { files[f] ??= readFileSync(f, 'utf8').replace(/\r\n/g, '\n'); if (!files[f].includes(a)) { console.log('MISSING in', f, ':', a.slice(0, 70)); bad++; } else files[f] = files[f].replace(a, () => b); }
if (bad) process.exit(1);
for (const [f, t] of Object.entries(files)) writeFileSync(f, t);
console.log('patched', Object.keys(files).join(', '), '(' + edits.length + ' edits)');
