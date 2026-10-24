// runall.mjs - THE SUITE RUNNER: runs the check tools one after another, one line each.
// node tools/runall.mjs                  the QUICK suite (each tool under about 2 minutes)
// node tools/runall.mjs --full           QUICK plus the slow tools
// node tools/runall.mjs --only a,b       just these tools (any tools/<name>.mjs file)
// node tools/runall.mjs --skip a,b       the suite without these tools (CI runs renderhash apart)
// node tools/runall.mjs --list           print the suites and stop
// node tools/runall.mjs --baseline [--out <file>] [--only a,b]
//                                        record the code stats + tool results report instead
// Output: "PASS name 12.3 s", "FAIL name 12.3 s" (+ the last 5 lines of the tool),
// "KNOWN-FAIL name 12.3 s" for a tool in KNOWN (it does not fail the suite), then a total.
// Exit code 1 when any tool failed (KNOWN-FAIL does not count).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argVal = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

// Each entry: label, tool file name, arguments.
const entry = (tool, toolArgs = [], label = tool) => ({ label, tool, args: toolArgs });

const QUICK = [
  entry('verify'),
  entry('worldhash', ['--highway', '20']),
  entry('simhash'),
  entry('renderhash'),
  entry('inputcheck'),
  entry('uicheck'),
  entry('menucheck'),
  entry('guidecheck'),
  entry('settingscheck'),
  entry('barriercheck'),
  entry('propcheck'),
  entry('highwaycheck'),
  entry('stagegencheck'),
];

const SLOW = [
  entry('racecheck4', ['thruston', '3', '1', 'drive', '0'], 'racecheck4 thruston'),
  entry('racecheck4', ['knobhill', '3', '2', 'drive', '1'], 'racecheck4 knobhill'),
  entry('aifieldsuite'),
  entry('pacesuite'),
  entry('weavecheck'),
  entry('framecheck'),
  entry('solidcheck'),
  entry('hwracecheck'),
  entry('trafficcheck'),
  entry('treadmillcheck'),
  entry('racecheck'),
];

// Tools that fail on main for older reasons (TODO.md "Known bugs"). They run and print
// KNOWN-FAIL, and do not fail the suite.
const KNOWN = new Set([
  // RX race, two jokers: case C fails (stuck on lap 3, no +30 s penalty); older than the overhaul
  'racecheck',
  // "no racer wrecked (2)": fails on the code before the overhaul too
  'hwracecheck',
  // "motorway: traffic stays on the carriageway (30 car-steps off)": older than the overhaul
  'trafficcheck',
  // "motorway: no litter in a driving lane (2)": older than the overhaul
  'treadmillcheck',
  // timing-dependent: the result changes from run to run
  'solidcheck',
]);

// The hash tools compare with a saved reference file that is not in git.
const REFERENCE = {
  worldhash: 'tools/.worldhash',
  simhash: 'tools/.simhash',
  renderhash: 'tools/.renderhash',
};

// renderhash: ~2 min a level on the laptop (the WebGL2 ground in software), ~30 min for all
const TIMEOUT_MS = { racecheck: 40 * 60 * 1000, renderhash: 50 * 60 * 1000 };
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * The last non-empty lines of some text.
 * @param {string} text output text
 * @param {number} count how many lines
 * @returns {string[]} the lines
 */
function lastLines(text, count) {
  return (text || '').split(/\r?\n/).filter((line) => line.trim()).slice(-count);
}

/**
 * Run one tool as a child process.
 * @param {{label: string, tool: string, args: string[]}} item the tool
 * @returns {{ok: boolean, secs: number, tail: string[]}} the outcome
 */
function runTool(item) {
  const began = Date.now();
  const ref = REFERENCE[item.tool];
  if (ref && !item.args.includes('save') && !existsSync(path.join(ROOT, ref))) {
    const hint = `run: node tools/${item.tool}.mjs save on the base commit`;
    return { ok: false, secs: 0, tail: [`no saved reference (${ref})`, hint] };
  }
  const file = path.join('tools', `${item.tool}.mjs`);
  const r = spawnSync(process.execPath, [file, ...item.args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: TIMEOUT_MS[item.tool] || DEFAULT_TIMEOUT_MS,
    maxBuffer: 256 * 1024 * 1024,
  });
  const secs = (Date.now() - began) / 1000;
  const tail = lastLines(r.stdout, 5);
  if (r.error) tail.push(`error: ${r.error.message}`);
  else if (r.status !== 0) tail.push(...lastLines(r.stderr, 3));
  return { ok: r.status === 0 && !r.error, secs, tail };
}

/**
 * Pick the tools to run from the command line.
 * @returns {Array<{label: string, tool: string, args: string[]}>} the tools
 */
function chooseTools() {
  const skipArg = argVal('--skip');
  const skipped = new Set((skipArg || '').split(',').map((s) => s.trim()).filter(Boolean));
  return pickTools().filter((item) => !skipped.has(item.tool));
}

/**
 * The tools the suite flags (--full, --only) pick, before any --skip.
 * @returns {Array<{label: string, tool: string, args: string[]}>} the tools
 */
function pickTools() {
  const all = args.includes('--full') ? [...QUICK, ...SLOW] : QUICK;
  const onlyArg = argVal('--only');
  if (!onlyArg) return all;
  const names = onlyArg.split(',').map((s) => s.trim()).filter(Boolean);
  const known = [...QUICK, ...SLOW];
  const picked = [];
  for (const name of names) {
    const listed = known.filter((item) => item.tool === name);
    if (listed.length) picked.push(...listed);
    else picked.push(entry(name));
  }
  return picked;
}

/**
 * Print the suites.
 * @returns {void}
 */
function printList() {
  const show = (item) => {
    const extra = item.args.length ? ` ${item.args.join(' ')}` : '';
    const mark = KNOWN.has(item.tool) ? '  (KNOWN-FAIL)' : '';
    console.log(`  ${item.tool}${extra}${mark}`);
  };
  console.log('quick:');
  QUICK.forEach(show);
  console.log('full adds:');
  SLOW.forEach(show);
}

/**
 * Run the chosen tools and print one line each, then the total.
 * @returns {void}
 */
function runSuite() {
  const began = Date.now();
  let passed = 0;
  let failed = 0;
  let known = 0;
  for (const item of chooseTools()) {
    if (!existsSync(path.join(ROOT, 'tools', `${item.tool}.mjs`))) {
      console.log(`FAIL ${item.label} 0.0 s`);
      console.log(`  no such tool: tools/${item.tool}.mjs`);
      failed++;
      continue;
    }
    const r = runTool(item);
    const secs = `${r.secs.toFixed(1)} s`;
    if (r.ok) {
      console.log(`PASS ${item.label} ${secs}`);
      passed++;
      continue;
    }
    const isKnown = KNOWN.has(item.tool);
    console.log(`${isKnown ? 'KNOWN-FAIL' : 'FAIL'} ${item.label} ${secs}`);
    for (const line of r.tail) console.log(`  ${line}`);
    if (isKnown) known++;
    else failed++;
  }
  const total = ((Date.now() - began) / 1000).toFixed(1);
  console.log(`suite: ${passed} passed, ${failed} failed, ${known} known-fail, ${total} s`);
  process.exitCode = failed ? 1 : 0;
}

if (args.includes('--list')) {
  printList();
} else if (args.includes('--baseline')) {
  const { recordBaseline } = await import('./lib/baseline.mjs');
  process.exitCode = (await recordBaseline(ROOT, args)) ? 0 : 1;
} else {
  runSuite();
}

