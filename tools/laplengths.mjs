// laplengths.mjs - THE MENU'S LAP LENGTHS AS DATA (src/world/levels/laplengths.ts): every level's
// lap (a rally stage's length), m, measured once here with world/levels/category.ts lapOf (which
// traces a venue's whole road to find it), so the menu's track cards read a number instead of
// tracing every venue when a list opens (MEASURED: ALL TRACKS' open, 3.6 s of a CPU x4 profile).
// Run it when a level is added or its road changes. --check (runall, so CI) fails naming every
// level whose stored length is missing, extra or not the measured one.
// node tools/laplengths.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEVELS } from '../src/world/levels/index.ts';
import { lapOf } from '../src/world/levels/category.ts';
import { addStageLevels } from '../src/stagegen.ts';

// the rally stages are added as the game adds them (main.ts); the endless highway has no lap
addStageLevels();

const DATA_FILE = fileURLToPath(new URL('../src/world/levels/laplengths.ts', import.meta.url));
// m: the stored lengths' rounding (the menu shows km to 2 places, 10 m)
const ROUND_M = 0.1;

const measured = {};
for (const level of LEVELS) {
  const lapM = lapOf(level);
  if (lapM > 0) measured[level.id] = Math.round(lapM / ROUND_M) * ROUND_M;
}
const ids = Object.keys(measured).sort();

if (process.argv.includes('--check')) {
  const text = readFileSync(DATA_FILE, 'utf8');
  const stored = {};
  for (const [, id, metres] of text.matchAll(/^ {2}'([^']+)': ([\d.]+),$/gm)) stored[id] = +metres;
  const wrong = [];
  for (const id of ids) {
    if (!(id in stored)) wrong.push(`${id}: missing (measured ${measured[id].toFixed(1)} m)`);
    else if (Math.abs(stored[id] - measured[id]) > ROUND_M / 2)
      wrong.push(`${id}: stored ${stored[id]} m, measured ${measured[id].toFixed(1)} m`);
  }
  for (const id of Object.keys(stored)) if (!(id in measured)) wrong.push(`${id}: extra`);
  if (wrong.length) {
    console.log(`laplengths: ${wrong.length} wrong - run node tools/laplengths.mjs\n  `
      + wrong.join('\n  '));
    process.exit(1);
  }
  console.log(`laplengths: ${ids.length} levels OK`);
} else {
  const lines = ids.map((id) => `  '${id}': ${measured[id].toFixed(1)},`);
  writeFileSync(DATA_FILE, `// laplengths.ts - every level's lap (a rally stage's length), m, MEASURED by
// tools/laplengths.mjs with world/levels/category.ts lapOf, for the menu's track cards (menu lapOf
// reads this instead of tracing a venue). GENERATED: run node tools/laplengths.mjs, do not edit.
export const LAP_METRES: Record<string, number> = {
${lines.join('\n')}
};
`);
  console.log(`laplengths: ${ids.length} levels written to src/world/levels/laplengths.ts`);
}
