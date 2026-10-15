// Records the baseline: code stats for src/*.js plus every check tool run once.
// Used by: node tools/runall.mjs --baseline [--out <file>] [--only a,b]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

/**
 * Collect the names bound by a declaration pattern.
 * @param {object} node pattern node
 * @param {string[]} acc names found so far
 * @returns {string[]} the names
 */
function patternNames(node, acc) {
  if (!node) return acc;
  switch (node.type) {
    case 'Identifier': acc.push(node.name); break;
    case 'ObjectPattern':
      for (const p of node.properties) {
        patternNames(p.type === 'RestElement' ? p.argument : p.value, acc);
      }
      break;
    case 'ArrayPattern': for (const e of node.elements) patternNames(e, acc); break;
    case 'RestElement': patternNames(node.argument, acc); break;
    case 'AssignmentPattern': patternNames(node.left, acc); break;
    default: break;
  }
  return acc;
}

/**
 * Size and naming numbers for one source file.
 * @param {string} file path
 * @returns {{lines: number, short: number, wide: number, long: number}} the numbers
 */
function fileStats(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  let shortNames = 0;
  let longFns = 0;
  const countNames = (names) => { for (const n of names) if (n.length <= 2) shortNames++; };
  const fn = (node) => {
    if (node.id) countNames([node.id.name]);
    for (const p of node.params) countNames(patternNames(p, []));
    if (node.loc.end.line - node.loc.start.line + 1 > 80) longFns++;
  };
  walk.full(ast, (node) => {
    if (node.type === 'VariableDeclarator') countNames(patternNames(node.id, []));
    else if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression'
      || node.type === 'ArrowFunctionExpression') fn(node);
  });
  return {
    lines: lines.length,
    short: shortNames,
    wide: lines.filter((l) => l.length > 100).length,
    long: longFns,
  };
}

/**
 * Stats for every src/*.js file plus a TOTAL row.
 * @param {string} root repo root
 * @returns {Array<[string, object]>} rows
 */
function codeStats(root) {
  const dir = path.join(root, 'src');
  const rows = [];
  const total = { lines: 0, short: 0, wide: 0, long: 0 };
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.js')).sort()) {
    const s = fileStats(path.join(dir, f));
    rows.push([f, s]);
    for (const k of Object.keys(total)) total[k] += s[k];
  }
  rows.push(['TOTAL', total]);
  return rows;
}

/**
 * Run one tool as a child process and keep the tail of its output.
 * @param {string} root repo root
 * @param {string} name label
 * @param {string} tool tool file name without extension
 * @param {string[]} toolArgs arguments
 * @returns {object} the result row
 */
function runStep(root, name, tool, toolArgs) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join('tools', `${tool}.mjs`), ...toolArgs], {
    cwd: root, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024,
  });
  const secs = (Date.now() - t0) / 1000;
  const timedOut = r.error && r.error.code === 'ETIMEDOUT';
  let exit = timedOut ? 'timeout' : r.status;
  if (exit === null || exit === undefined) {
    exit = r.error ? `error: ${r.error.message}` : `signal ${r.signal}`;
  }
  const lastLines = (s, n) => (s || '').split(/\r?\n/).filter((l) => l.trim()).slice(-n);
  const tail = lastLines(r.stdout, tool === 'lapdriver' ? 8 : 5);
  if (exit !== 0) tail.push(...lastLines(r.stderr, 5));
  return { name, exit, secs, tail, ok: exit === 0 };
}

/**
 * The baseline steps: one entry per tool run.
 * @param {string} root repo root
 * @returns {Promise<Array<{tool: string, label: string, args: string[]}>>} the plan
 */
async function buildPlan(root) {
  const { CAR_IDS } = await import(pathToFileURL(path.join(root, 'src', 'cars.ts')).href);
  const plan = [];
  for (const t of ['aifieldsuite']) plan.push({ tool: t, label: t, args: [] });
  plan.push({ tool: 'pacesuite', label: 'pacesuite', args: ['baseline'] });
  const singles = ['weavecheck', 'barriercheck', 'solidcheck', 'propcheck', 'uicheck',
    'guidecheck', 'menucheck', 'settingscheck'];
  for (const t of singles) plan.push({ tool: t, label: t, args: [] });
  for (const id of CAR_IDS) {
    plan.push({ tool: 'lapdriver', label: `lapdriver ${id}`, args: ['test-track', id] });
  }
  for (const t of ['framecheck', 'profile']) {
    for (const lv of ['test-track', 'thruston', 'stock-car']) {
      plan.push({ tool: t, label: `${t} ${lv}`, args: [lv] });
    }
  }
  return plan;
}

/**
 * Short git output.
 * @param {string} root repo root
 * @param {string[]} cmd git arguments
 * @returns {string} trimmed stdout
 */
function git(root, cmd) {
  const r = spawnSync('git', cmd, { cwd: root, encoding: 'utf8' });
  return (r.stdout || '').trim() || 'unknown';
}

/**
 * Record the baseline report.
 * @param {string} root repo root
 * @param {string[]} args command line arguments
 * @returns {Promise<boolean>} true when every step passed
 */
export async function recordBaseline(root, args) {
  const argVal = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  const out = path.resolve(root, argVal('--out') || 'shots/runall/latest.md');
  const onlyArg = argVal('--only');
  const only = onlyArg ? onlyArg.split(',').map((s) => s.trim()).filter(Boolean) : null;
  const stats = codeStats(root);
  const results = [];
  if (!only || !only.includes('stats') || only.length > 1) {
    for (const p of await buildPlan(root)) {
      if (only && !only.includes(p.tool)) continue;
      console.log(`running ${p.label} ...`);
      const r = runStep(root, p.label, p.tool, p.args);
      console.log(`  exit ${r.exit} in ${r.secs.toFixed(1)}s`);
      results.push(r);
    }
  }
  const md = [];
  md.push('# runall baseline', '');
  md.push(`- date: ${new Date().toISOString()}`);
  md.push(`- commit: ${git(root, ['rev-parse', '--short', 'HEAD'])}`);
  md.push(`- node: ${process.version}`);
  md.push(`- cpu: ${os.cpus()[0].model}`, '');
  md.push('## Code stats', '');
  md.push('| file | lines | names <=2 chars | lines >100 chars | functions >80 lines |');
  md.push('|---|---|---|---|---|');
  for (const [f, s] of stats) {
    md.push(`| ${f} | ${s.lines} | ${s.short} | ${s.wide} | ${s.long} |`);
  }
  md.push('', '## Steps', '');
  md.push('| name | exit | s |', '|---|---|---|');
  for (const r of results) md.push(`| ${r.name} | ${r.exit} | ${r.secs.toFixed(1)} |`);
  md.push('');
  for (const r of results) md.push(`### ${r.name}`, '', '```', ...r.tail, '```', '');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, md.join('\n'));
  const tot = stats[stats.length - 1][1];
  console.log(`TOTAL: lines ${tot.lines}, short names ${tot.short}, long lines ${tot.wide}, `
    + `long functions ${tot.long}`);
  console.log(`report: ${out}`);
  return results.every((r) => r.ok);
}

