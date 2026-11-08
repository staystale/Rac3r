// _bakereal.mjs - ?realcars to the default: writes each REAL entry of src/realcars.ts into its
// ROSTER row of src/cars.ts (one car table), drops the curves it replaces, and leaves realcars.ts
// as the helpers only. Prove with _rosterdump.mjs against REALCARS=1.
import fs from 'node:fs';
const realSrc = fs.readFileSync('src/realcars.ts', 'utf8');
let cars = fs.readFileSync('src/cars.ts', 'utf8');

/** Split "a: x, b: [1, 2], c: f(1, 2)" at the top-level commas into [key, expr] pairs. */
function pairs(body) {
  const out = []; let depth = 0, cur = '';
  const flush = () => {
    const text = cur.replace(/\/\/[^\n]*/g, '').trim(); cur = '';
    if (!text) return;
    const at = text.indexOf(':');
    out.push([text.slice(0, at).trim(), text.slice(at + 1).trim().replace(/\s+/g, ' ')]);
  };
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '/' && body[i + 1] === '/') { const end = body.indexOf('\n', i); cur += body.slice(i, end); i = end - 1; continue; }
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { flush(); continue; }
    cur += ch;
  }
  flush();
  return out;
}

/** The end of the expression starting at i (the top-level comma or line end). */
function exprEnd(text, i) {
  let depth = 0;
  for (; i < text.length; i++) {
    const ch = text[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) { if (depth === 0) return i; depth--; }
    else if ((ch === ',' || ch === '\n') && depth === 0) return i;
  }
  return i;
}

// the REAL table: id -> { comment lines, fields }
const tableAt = realSrc.indexOf('const REAL: Record<string, Real> = {');
const tableEnd = realSrc.indexOf('\n};', tableAt);
const lines = realSrc.slice(tableAt, tableEnd).split('\n').slice(1);
const REAL = {};
let comment = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/^ {2}\/\//.test(line)) { comment.push(line.trim()); continue; }
  const head = line.match(/^ {2}'?([\w-]+)'?: \{(.*)$/);
  if (!head) continue;
  let body = head[2] + '\n', depth = 1 + (head[2].match(/[{(\[]/g) || []).length
    - (head[2].match(/[})\]]/g) || []).length;
  while (depth > 0) {
    i++; body += lines[i] + '\n';
    depth += (lines[i].match(/[{(\[]/g) || []).length - (lines[i].match(/[})\]]/g) || []).length;
  }
  body = body.slice(0, body.lastIndexOf('}'));
  REAL[head[1]] = { comment, fields: Object.fromEntries(pairs(body)) };
  comment = [];
}

const dropCurves = [];
for (const [id, { comment, fields }] of Object.entries(REAL)) {
  const start = cars.indexOf(`    id: '${id}',`);
  if (start < 0) throw new Error(id);
  const next = cars.indexOf("    id: '", start + 10);
  const end = next < 0 ? cars.indexOf('];', start) : next;
  let row = cars.slice(start, end);
  const num = (key) => { const m = row.match(new RegExp(`\\b${key}: ([\\d.]+)`)); return m ? +m[1] : null; };
  const set = {}; let curveExpr = null;
  for (const [key, expr] of Object.entries(fields)) {
    if (key === 'engine') {
      const eng = Object.fromEntries(pairs(expr.slice(1, -1)));
      const old = row.match(/\bcurve: (CURVE_\w+)/); if (old) dropCurves.push(old[1]);
      const engPairs = pairs(expr.slice(1, -1)).map(([k, v]) => k + ': ' + v);
      curveExpr = 'realCurve({ ' + engPairs.slice(0, 5).join(', ') + ',\n      '
        + engPairs.slice(5).join(', ') + ' })';
      set.redline = eng.redline; set.idleRpm = eng.idle;
    } else set[key] = expr;
  }
  if (set.mass) {
    const massK = +set.mass / num('mass');
    set.caF = String(Math.round(num('caF') * massK)); set.caR = String(Math.round(num('caR') * massK));
  }
  if (curveExpr) set.curve = curveExpr;   // last: its engine has a redline of its own
  const missing = [];
  for (const [key, expr] of Object.entries(set)) {
    const re = new RegExp(`(^|[{,\\s])${key}: `, 'm');
    let at = -1, from = 0;
    for (;;) {
      const m = re.exec(row.slice(from)); if (!m) break;
      const pos = from + m.index + m[1].length, lineStart = row.lastIndexOf('\n', pos) + 1;
      if (!row.slice(lineStart, pos).includes('//')) { at = pos; break; }
      from = pos + key.length;
    }
    if (at < 0) { missing.push(`${key}: ${expr}`); continue; }
    const valAt = at + key.length + 2, valEnd = exprEnd(row, valAt);
    row = row.slice(0, valAt) + expr + row.slice(valEnd);
  }
  // the counterpart's sources under the id line; the fields the row did not state after finalDrive
  const idEnd = row.indexOf('\n') + 1;
  row = row.slice(0, idEnd) + comment.map((text) => '    ' + text + '\n').join('') + row.slice(idEnd);
  if (missing.length) {
    const fd = row.indexOf('finalDrive:'), lineEnd = row.indexOf('\n', fd) + 1;
    row = row.slice(0, lineEnd) + '    ' + missing.join(', ') + ',\n' + row.slice(lineEnd);
  }
  cars = cars.slice(0, start) + row + cars.slice(end);
}
for (const name of dropCurves) {
  const at = cars.indexOf(`const ${name}: Curve = `);
  const end = cars.indexOf(']];', at) + 4;
  cars = cars.slice(0, at) + cars.slice(end);
}
cars = cars.replace("import { applyRealCars } from './realcars.ts';",
  "import { dragOf, realCurve, tyreR } from './realcars.ts';");
cars = cars.replace('// ?realcars=1: each car on its real counterpart (realcars.ts)\nif (FIX.realCars) applyRealCars(ROSTER);\n', '');
fs.writeFileSync('src/cars.ts', cars);
console.log('baked', Object.keys(REAL).join(' '), '| curves dropped', dropCurves.join(' '));
