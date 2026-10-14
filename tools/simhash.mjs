// simhash.mjs - SIMULATION FINGERPRINT: hashes the game's STATE (not pixels) over fully
// deterministic runs, so a refactor of the AI (src/ai/*, src/cones.js) or of the car physics
// (src/vehicle.ts, src/roll.js, src/damage.js) can be PROVED to leave the simulation identical.
// The sim counterpart of renderhash.mjs; it shares its page-side determinism (tools/lib/
// determinism.mjs: seeded Math.random, fake clock, stepped requestAnimationFrame queue).
// The page loads with &skip=world,ground,car (nothing is drawn, so it is fast; drawing does not
// change the sim). Every 30 frames (0.5 s of fake time) it records, for EVERY car (the player,
// each AI racer, each highway traffic car): x, y, heading, vx, vy, yaw rate, steering angle,
// height, gear, rpm, the damage bill / hits / roof / crush / punctures / wheels off, the roll
// phase, and the lap / progress (player: lap, lap time, race time, jokers; AI: the driver's lap,
// path index, target speed, jokers, stage progress); plus the loose objects (cones, tyres,
// litter): how many, how many moved and a hash of every x, y. Numbers are rounded to 1e-6.
// Runs: the circuits thruston, castle-cum, brands-snatch, naffcar, knobhill and grass-track
// with 5 AI racers and the demo driver on the player car; knobhill-rx (the same level as a
// rallycross race with the joker; only joker levels take rx); a generated stage and
// stage-sahara-sandpants; highway-ai (AI racers) and
// highway-traffic (traffic 1, litter on, 3 AI); crash-thruston (the player holds full throttle
// straight into the barrier: damage.js, roll.js) and cones-lab (the player drives into the
// lab's cone lane: cones.js). The fake time of each run is printed on its line.
// node tools/simhash.mjs                one line per run + "simhash: <all>"; SAME/DIFFERENT
// node tools/simhash.mjs save           also writes tools/.simhash (gitignored)
// node tools/simhash.mjs --only a,b     run only those run ids (a partial save merges into the
//                                       reference; the verdict covers just those runs)
// On DIFFERENT it names the run, the first sample frame that differs, the car and the field.
// Not covered: drawing (renderhash does that), menus, input from a real finger, other car
// models than the hatch (the player) and the AI's own car choice, other screen sizes.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as L from '../src/lab.js';
import { addStageLevels } from '../src/stagegen.js';
import { addHighwayLevel } from '../src/highway.js';
import { startServer, launchBrowser } from './lib/browser.mjs';
import {
  openPage, launchLevel, installDriver, sha, onlyList, SETTLE_MS,
} from './lib/determinism.mjs';

addStageLevels();
addHighwayLevel();

const SAVE_FILE = fileURLToPath(new URL('./.simhash', import.meta.url));
const SEED = 0x5eed;
const SAMPLE_EVERY = 30;
const SKIP = '&skip=world,ground,car';
const CIRCUITS = ['thruston', 'castle-cum', 'brands-snatch', 'naffcar', 'knobhill', 'grass-track'];
const HIGHWAY_TRAFFIC = { ai: 3, traffic: 1, litter: 1.5 };
const HELD = { steer: 0, throttle: 1 };
const CONES_START = { x: 60, y: 296, heading: 0, speed: 20 };

/**
 * Every run: id, level, launch options, who drives the player and for how many frames.
 * @returns {{id: string, level: string, opts: object, mode: string, frames: number}[]} runs
 */
function runList() {
  const drive = (id, level, opts = { ai: 5 }) => ({ id, level, opts, mode: 'drive', frames: 3000 });
  const stages = ['gen-forest-medium-mixed-1001', 'stage-sahara-sandpants'];
  return [
    ...CIRCUITS.map((id) => drive(id, id)),
    drive('knobhill-rx', 'knobhill', { ai: 5, rx: true }),
    ...stages.filter((id) => L.LEVELS.some((lv) => lv.id === id)).map((id) => drive(id, id)),
    drive('highway-ai', 'highway', { ai: 5, traffic: 0 }),
    drive('highway-traffic', 'highway', HIGHWAY_TRAFFIC),
    { id: 'crash-thruston', level: 'thruston', opts: { ai: 3 }, mode: 'held', frames: 1200 },
    { id: 'cones-lab', level: 'lab', opts: { ai: 0 }, mode: 'cones', frames: 1200 },
  ];
}

/**
 * Page side: replace the player's input with a constant steer / throttle.
 * @param {{steer: number, throttle: number}} held the held controls
 * @returns {void}
 */
function installHeld(held) {
  window.__game.input.update = () => ({
    steer: held.steer, throttle: held.throttle, brake: 0, handbrake: 0,
    reverse: 0, shiftUp: false, shiftDown: false,
  });
}

/**
 * Page side: put the player car on the lab's cone lane at speed, for the cones run.
 * @param {{x: number, y: number, heading: number, speed: number}} at where and how fast
 * @returns {void}
 */
function placeCar(at) {
  const car = window.__game.car;
  car.x = at.x; car.y = at.y; car.heading = at.heading;
  car.vx = at.speed * Math.cos(at.heading); car.vy = at.speed * Math.sin(at.heading);
  car.gear = 3; car.rpm = 4000; car._p = null; car.prevWheels = null;
}

/**
 * Page side: the state fields of one car, numbers rounded to 1e-6.
 * @param {object} car a game car
 * @returns {Record<string, number|string>} field -> value
 */
function carFields(car) {
  const num = (value) => (Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : String(value));
  const sum = (list) => (list ? list.reduce((total, item) => total + item, 0) : 0);
  const count = (list) => (list ? list.filter(Boolean).length : 0);
  return {
    x: num(car.x), y: num(car.y), heading: num(car.heading), vx: num(car.vx), vy: num(car.vy),
    yawRate: num(car.yawRate), delta: num(car.delta), z: num(car.z), gear: car.gear,
    rpm: num(car.rpm), dmgBill: num(car.dmgBill || 0), dmgHits: car.dmgHits || 0,
    dmg: num(sum(car.dmg)), crush: num(sum(car.crushL) + sum(car.crushS)),
    roofDmg: num(car.roofDmg || 0), punct: count(car.punct), wheelOff: count(car.wheelOff),
    roll: car.roll ? `${car.roll.phase}:${num(car.roll.phi)}` : 'none',
  };
}

/**
 * Page side: the state of every car and the loose objects, numbers rounded to 1e-6.
 * @returns {Record<string, Record<string, number|string>>} entity name -> field -> value
 */
function snapshot() {
  const num = (value) => (Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : String(value));
  const game = window.__game, out = {};
  out.player = {
    ...window.__simCar(game.car), lap: game.lap.lap, lapTime: num(game.lap.lapTime),
    raceT: num(game.race.t), jokers: game.jokers || 0,
  };
  game.ai.forEach((entry, index) => {
    const state = entry.drv.state || {};
    out['ai' + index] = {
      ...window.__simCar(entry.car), lap: state.lap ?? -1, i: state.i ?? -1,
      vT: num(state.vT ?? 0), jokers: state.jokers ?? 0, prog: num(entry.car._prog ?? 0),
    };
  });
  (game.traffic ? game.traffic.cars : []).forEach((car, index) => {
    out['traffic' + index] = window.__simCar(car);
  });
  let hash = 2166136261, moved = 0;
  const list = game.cones.list;
  for (const item of list) {
    if (item.moved) moved++;
    const text = num(item.x) + ',' + num(item.y) + ';';
    for (let at = 0; at < text.length; at++) hash = Math.imul(hash ^ text.charCodeAt(at), 16777619);
  }
  out.objects = { n: list.length, moved, hash: hash >>> 0 };
  return out;
}

/**
 * Open a page for a run, launch the level and hand the player car to its driver.
 * @param {import('playwright').Browser} browser the browser
 * @param {string} base server url
 * @param {object} run the run
 * @param {string[]} errors collects page errors
 * @returns {Promise<import('playwright').Page>} the page, ready to step
 */
async function startRun(browser, base, run, errors) {
  const page = await openPage(browser, base, run.level, errors, SKIP);
  await page.evaluate(`window.__simCar = ${carFields.toString()}`);
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((seed) => window.__rt.seed(seed), SEED);
  await page.evaluate(launchLevel, [run.level, run.opts]);
  // the game's restart arms the start with a real setTimeout: let it fire before stepping
  await page.waitForTimeout(SETTLE_MS);
  if (run.mode === 'drive') await page.evaluate(installDriver);
  else await page.evaluate(installHeld, HELD);
  if (run.mode === 'cones') await page.evaluate(placeCar, CONES_START);
  return page;
}

/**
 * Run one run: step the fake clock and take a snapshot every SAMPLE_EVERY frames.
 * @param {import('playwright').Browser} browser the browser
 * @param {string} base server url
 * @param {object} run the run
 * @returns {Promise<{frame: number, state: object}[]>} the samples
 */
async function runOne(browser, base, run) {
  const errors = [];
  const page = await startRun(browser, base, run, errors);
  const samples = [];
  for (let frame = SAMPLE_EVERY; frame <= run.frames; frame += SAMPLE_EVERY) {
    await page.evaluate((count) => window.__rt.step(count), SAMPLE_EVERY);
    samples.push({ frame, state: await page.evaluate(snapshot) });
  }
  await page.context().close();
  if (errors.length) throw new Error(`${run.id}: page error: ${errors[0]}`);
  return samples;
}


/**
 * Describe the first difference between two sample lists.
 * @param {{frame: number, state: object}[]} saved the reference samples
 * @param {{frame: number, state: object}[]} now this run's samples
 * @returns {string} "frame F, car C, field X (saved A, now B)"
 */
function firstDiff(saved, now) {
  for (let at = 0; at < Math.max(saved.length, now.length); at++) {
    const old = saved[at], cur = now[at];
    if (!old || !cur) return `sample count ${saved.length} -> ${now.length}`;
    for (const name of new Set([...Object.keys(old.state), ...Object.keys(cur.state)])) {
      const was = old.state[name] || {}, is = cur.state[name] || {};
      for (const field of new Set([...Object.keys(was), ...Object.keys(is)])) {
        if (was[field] !== is[field]) {
          return `frame ${cur.frame}, car ${name}, field ${field} (saved ${was[field]}, ` +
            `now ${is[field]})`;
        }
      }
    }
  }
  return 'no difference found';
}

/**
 * Write the reference file; a partial (--only) run is merged into the existing one.
 * @param {Record<string, object>} runs run id -> {hash, samples}
 * @returns {void}
 */
function saveReference(runs) {
  const keep = onlyList() && existsSync(SAVE_FILE);
  const old = keep ? JSON.parse(readFileSync(SAVE_FILE, 'utf8')).runs : {};
  const merged = { ...old, ...runs };
  const rows = Object.keys(merged).map((id) => id + ' ' + merged[id].hash);
  writeFileSync(SAVE_FILE, JSON.stringify({ all: sha(rows.join('\n')), runs: merged }) + '\n');
}

/**
 * Compare with the saved reference and print the verdict, naming the first difference.
 * @param {string} all hash of everything
 * @param {Record<string, object>} runs run id -> {hash, samples}
 * @returns {void}
 */
function report(all, runs) {
  console.log('simhash: ' + all);
  if (!existsSync(SAVE_FILE)) return;
  const saved = JSON.parse(readFileSync(SAVE_FILE, 'utf8')).runs;
  const ids = Object.keys(saved).filter((id) => !onlyList() || id in runs);
  const bad = ids.filter((id) => !runs[id] || runs[id].hash !== saved[id].hash);
  for (const id of bad) {
    const detail = runs[id] ? firstDiff(saved[id].samples, runs[id].samples) : 'run missing';
    console.log(`simhash: DIFFERENT in ${id}: ${detail}`);
  }
  console.log(bad.length ? `simhash: DIFFERENT (${bad.join(', ')})` : 'simhash: SAME');
}

/**
 * Run every run, print one line each, then the verdict; optionally save the reference.
 * @returns {Promise<void>} resolves when done
 */
async function main() {
  const only = onlyList();
  const server = await startServer();
  let browser;
  const runs = {};
  try {
    browser = await launchBrowser();
    for (const run of runList().filter((item) => !only || only.includes(item.id))) {
      const began = Date.now();
      const samples = await runOne(browser, server.url, run);
      runs[run.id] = { hash: sha(JSON.stringify(samples)), samples };
      const secs = ((Date.now() - began) / 1000).toFixed(1);
      const fake = (run.frames / 60).toFixed(0);
      console.log(`${run.id}  ${runs[run.id].hash.slice(0, 16)}  ${fake} s fake  ${secs} s`);
    }
  } finally {
    await browser?.close();
    server.stop();
  }
  const all = sha(Object.keys(runs).map((id) => id + ' ' + runs[id].hash).join('\n'));
  report(all, runs);
  if (process.argv.includes('save')) saveReference(runs);
}

await main();

