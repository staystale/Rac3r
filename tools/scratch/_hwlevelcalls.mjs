// replace the LEVEL argument at each tsc "Level is not assignable to HwLevel" error with hwLevel()
import fs from 'node:fs';
import { execSync } from 'node:child_process';
let out = '';
try { out = execSync('npx tsc --noEmit -p .', { encoding: 'utf8' }); } catch (e) { out = e.stdout; }
const hits = out.split('\n').filter((l) => l.includes("not assignable to parameter of type 'HwLevel'"))
  .map((l) => l.match(/^(.+?)\((\d+),(\d+)\)/)).filter(Boolean);
const byFile = {};
for (const [, f, ln, col] of hits) (byFile[f] ||= []).push([+ln, +col]);
for (const [f, list] of Object.entries(byFile)) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  list.sort((a, b) => b[1] - a[1]);
  for (const [ln, col] of list) {
    const line = lines[ln - 1], at = col - 1;
    if (line.slice(at, at + 5) !== 'LEVEL') { console.log('skip', f, ln, line.slice(at, at + 12)); continue; }
    lines[ln - 1] = line.slice(0, at) + 'hwLevel()' + line.slice(at + 5);
  }
  fs.writeFileSync(f, lines.join('\n'));
  console.log(f, list.length);
}
