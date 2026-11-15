// newcar.mjs - EVERY CHECK FOR ONE CAR, on one review sheet (owner: "tools first"). It runs the
// existing tools for that car only and gathers what they say and draw:
//   NUMBERS   tools/carstats.mjs <id>: top speed, 0-100, 100-0, grip - beside the REAL car's
//             published figures (tools/lib/realfigures.mjs) and the garage's saved numbers
//             (src/carstats.ts: "out of date" when they differ - re-run carstats then)
//   FEEL      tools/carfeel.mjs <id>: 40-100 pull, wheelspin, power oversteer on gravel
//   TYRES     tools/tyrecheck.mjs --car <id>: the tyre model's claims on this car
//   CRASH     tools/partcheck.mjs <id>: every part it can throw has its loose-object entry
//   AI LAPS   tools/aifieldcheck.mjs: 6 of it racing with contact, Realish, 3 laps, on tarmac
//             (LEVEL) and, for a loose-ground class (rally, rx, stock, off-road), on LOOSE
//   PICTURES  (the browser; --no-browser skips them) tools/scratch/_carsheet.mjs its sprite;
//             _rollbody.mjs rolled at 12 angles, clean and damaged, and a roll mid-spin;
//             _crashparts.mjs a real crash into a parked car; tools/carlapshot.mjs racing with
//             AI at 844x390 and 390x844
// -> shots/newcar/<id>/index.html (the sheet) and sheet.png (a photo of it).
// node tools/newcar.mjs <id> [--level thruston] [--loose sweaty-lamb] [--no-browser]
// The browser steps start their own dev server: pass your port, CHECK_PORT=<port>. A car behind
// its switch: the switch for both sides, e.g. GT86=1 RAC3R_QUERY=gt86=1 node tools/newcar.mjs
// gt86-rwd (NAME=1 for the node steps, src/core/fixes.ts; the page's query for the browser ones).
// A new car's starting row: tools/newcarstart.mjs.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ROSTER } from '../src/cars.ts';
import { CAR_STATS } from '../src/carstats.ts';
import { REAL_FIGURES } from './lib/realfigures.mjs';

const args = process.argv.slice(2);
const CAR = args[0];
const option = (name, fallback) => {
  const at = args.indexOf(name);
  return at > 0 ? args[at + 1] : fallback;
};
const LEVEL = option('--level', 'thruston'), LOOSE = option('--loose', 'sweaty-lamb');
const BROWSER = !args.includes('--no-browser');
// a switch under test, for the browser steps that take the page's query as an argument
const QUERY = (process.env.RAC3R_QUERY || '').replace(/^[?&]+/, '');
// the classes that race on loose ground (src/cars.ts CLASSES)
const LOOSE_CLASSES = ['rally', 'rx', 'stock', 'offroad'];
const row = ROSTER.find((car) => car.id === CAR);
if (!row) {
  console.log(`newcar: no car "${CAR}" in the roster. Cars: ${ROSTER.map((car) => car.id).join(', ')}`);
  process.exit(1);
}
const OUT = `shots/newcar/${CAR}`;
mkdirSync(OUT, { recursive: true });

/**
 * Run one tool to the end; its output is kept for the sheet.
 * @param {string} name the sheet's name for the step
 * @param {string[]} command node's arguments
 * @param {object} [env] extra environment
 * @returns {{name: string, ok: boolean, out: string, seconds: number}}
 */
function runTool(name, command, env = {}) {
  const start = Date.now();
  process.stdout.write(`${name.padEnd(10)} node ${command.join(' ')} ... `);
  const result = spawnSync(process.execPath, command, { encoding: 'utf8',
    env: { ...process.env, ...env }, maxBuffer: 1 << 24 });
  const out = (result.stdout || '') + (result.stderr ? `\n${result.stderr}` : '');
  const step = { name, ok: result.status === 0, out: out.trim(),
    seconds: (Date.now() - start) / 1000 };
  console.log(`${step.ok ? 'ok' : 'FAILED'} (${step.seconds.toFixed(0)} s)`);
  return step;
}

const steps = [];
steps.push(runTool('NUMBERS', ['tools/carstats.mjs', CAR]));
steps.push(runTool('FEEL', ['tools/carfeel.mjs', CAR]));
steps.push(runTool('TYRES', ['tools/tyrecheck.mjs', '--car', CAR]));
steps.push(runTool('CRASH', ['tools/partcheck.mjs', CAR]));
const lapLevels = LOOSE_CLASSES.includes(row.cls) ? [LEVEL, LOOSE] : [LEVEL];
for (const level of lapLevels)
  steps.push(runTool(`AI LAPS ${level}`, ['tools/aifieldcheck.mjs', level, CAR, '2', '6', '7', '3']));
if (BROWSER) {
  steps.push(runTool('SPRITE', ['tools/scratch/_carsheet.mjs', `${OUT}/sprite.png`, '6', CAR]));
  steps.push(runTool('ROLLED', ['tools/scratch/_rollbody.mjs', CAR, QUERY || 'x=1'], { OUT }));
  steps.push(runTool('CRASH PIC', ['tools/scratch/_crashparts.mjs', CAR, '22', QUERY], { OUT }));
  steps.push(runTool('RACING', ['tools/carlapshot.mjs', CAR, LEVEL, OUT]));
}

/** The measured numbers beside the real car's and the garage's saved ones, as table rows. */
function numberRows() {
  const line = (steps[0].out.split('\n').find((text) => text.startsWith(CAR)) || '');
  const measured = line ? JSON.parse(line.slice(line.indexOf('{'))) : {};
  const real = REAL_FIGURES[CAR] || { real: '(not in tools/lib/realfigures.mjs)' };
  const saved = CAR_STATS[CAR] || {};
  const cells = [['top speed, km/h', 'topKph'], ['0-100 km/h, s', 'zeroTo100'],
    ['100-0 km/h, m', 'brake100'], ['grip at 60 km/h, g', 'gripG'], ['mass, kg', 'massKg']];
  return { real, rows: cells.map(([label, key]) => {
    const stale = saved[key] !== undefined && saved[key] !== measured[key];
    const realValue = real[key] ?? (key === 'massKg' ? row.mass : null);
    const off = realValue && measured[key] ? `${(100 * (measured[key] / realValue - 1)).toFixed(0)} %` : '';
    return `<tr><td>${label}</td><td><b>${measured[key] ?? '-'}</b></td><td>${realValue ?? '-'}`
      + `</td><td>${off}</td><td class="${stale ? 'bad' : ''}">${saved[key] ?? '-'}`
      + `${stale ? ' (out of date)' : ''}</td></tr>`;
  }).join('') };
}

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** A tool's output, its FAIL lines red, its ok lines green. */
const outputBlock = (step) => `<pre>${escape(step.out).split('\n').map((text) => (/FAIL|ERROR/.test(text)
  ? `<span class="bad">${text}</span>` : /^\s*ok\b/.test(text) ? `<span class="good">${text}</span>`
    : text)).join('\n')}</pre>`;
const picture = (file, caption) => (existsSync(`${OUT}/${file}`)
  ? `<figure><img src="${file}"><figcaption>${caption}</figcaption></figure>` : '');

const numbers = numberRows();
const failed = steps.filter((step) => !step.ok);
const views = ['844x390', '390x844'];
const lapShots = (process.env.AT || '8,30').split(',').flatMap((seconds) => views.map((view) =>
  picture(`lap-${CAR}-${LEVEL}-${seconds}s-${view}.png`, `racing, ${seconds} s, ${view}`)));
const html = `<!doctype html><meta charset="utf-8"><title>${CAR} review</title><style>
body{font:14px system-ui,sans-serif;background:#1d2126;color:#e8e8e8;margin:16px;max-width:1500px}
h1{margin:0 0 4px}h2{margin:22px 0 6px;border-bottom:1px solid #444}table{border-collapse:collapse}
td,th{border:1px solid #444;padding:3px 8px;text-align:left}pre{background:#111;padding:8px;
white-space:pre-wrap;font-size:12px}.bad{color:#ff7b6b}.good{color:#8fd88f}
figure{display:inline-block;margin:6px;vertical-align:top}figure img{max-height:420px;
border:1px solid #444}figcaption{font-size:12px;color:#aaa}</style>
<h1>${row.name} <small>(${CAR}, ${row.cls} / ${row.sub})</small></h1>
<div>Real car: ${escape(numbers.real.real || '')}${numbers.real.note
  ? ` - ${escape(numbers.real.note)}` : ''}. ${failed.length
  ? `<span class="bad">${failed.length} step(s) failed: ${failed.map((step) => step.name)
    .join(', ')}</span>` : '<span class="good">every step ran clean</span>'}</div>
<h2>Numbers: measured vs the real car</h2><table><tr><th></th><th>measured</th><th>real</th>
<th>vs real</th><th>garage (src/carstats.ts)</th></tr>${numbers.rows}</table>
${steps.filter((step) => !['NUMBERS', 'SPRITE', 'ROLLED', 'CRASH PIC', 'RACING']
    .includes(step.name)).map((step) => `<h2>${step.name}</h2>${outputBlock(step)}`).join('')}
<h2>Pictures</h2>
${picture('sprite.png', 'sprite (the garage painter)')}
${picture(`_rollbody-${CAR}.png`, 'rolled, 12 angles')}
${picture(`_rollbody-${CAR}-hurt.png`, 'rolled, damaged')}
${picture(`_rollbody-${CAR}-live.png`, 'a roll mid-spin')}
${picture(`_rollbody-${CAR}-hurt-live.png`, 'a damaged roll mid-spin')}
${picture(`_crashparts-${CAR}${QUERY ? `-${QUERY.replace(/[=&]/g, '')}` : ''}.png`, 'a real crash into a parked car (22 m/s)')}
<h2>Racing with AI (${LEVEL})</h2>${lapShots.join('\n')}
${steps.filter((step) => ['SPRITE', 'ROLLED', 'CRASH PIC', 'RACING'].includes(step.name))
    .map((step) => `<h3>${step.name}</h3>${outputBlock(step)}`).join('')}`;
writeFileSync(`${OUT}/index.html`, html);

if (BROWSER) {
  const { launchBrowser } = await import('./lib/browser.mjs');
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    await page.goto(pathToFileURL(`${OUT}/index.html`).href);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/sheet.png`, fullPage: true });
  } finally {
    await browser.close();
  }
}
console.log(`\nnewcar ${CAR}: ${failed.length ? `${failed.length} FAILED (${failed.map((step) => step.name)
  .join(', ')})` : 'all steps ran'} -> ${OUT}/index.html${BROWSER ? ` and ${OUT}/sheet.png` : ''}`);
process.exit(failed.length ? 1 : 0);
