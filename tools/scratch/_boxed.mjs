// _boxed.mjs - THE BOXED TRACE (the owner's 11-21 item 7, read only): every time a racer is held by
// the gap picker's BOXED cap (ai/driverTraffic.ts gapStep: a car on the line it picked - brake to
// arrive behind it, the cap below my plan: holding me), one EPISODE from the cap holding to its letting go (0.25 s off ends it): how
// long it held, and at its start, from the driver's own note (ai/boxedTrace.ts, recorded only with
// __AI_WHY set): the blocking car's distance, speed against mine, how far across it is; whether my
// own lane was blocked or only the picked line; whether a fully free line, or a line with much more
// room (20 m+), existed across the room the picker had. The real game, seeded, nothing drawn, your
// car on ?autopilot. RUNS=motorway,thruston SEEDS=1,2,3,4 SECONDS=180; a switch through RAC3R_QUERY.
import { writeFileSync } from 'node:fs';
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const ALL_RUNS = {
  motorway: { level: 'highway', opts: { ai: 5, traffic: 1.5, road: 'motorway' } },
  thruston: { level: 'thruston', opts: { ai: 19, laps: 30 } },
};
const RUN_IDS = (process.env.RUNS || Object.keys(ALL_RUNS).join(',')).split(',');
const SEEDS = (process.env.SEEDS || '1,2,3,4').split(',').map(Number);
const SECONDS = Number(process.env.SECONDS || 180), CHUNK = 600, OUT = process.env.OUT || '';
const SKIP = '&skip=world,ground,car&autopilot=1' + extraQuery();

/** Page side: one frame - each racer's boxed episode opened, carried or closed. */
function tickBoxed() {
  const box = window.__box, game = window.__game;
  box.t += 1 / 60;
  if (box.t < 15) return;
  for (const entry of game.ai) {
    const car = entry.car, state = entry.drv.state, speed = Math.hypot(car.vx, car.vy);
    box.carS += 1 / 60;
    const set = state.follow && state.followWhy === 'boxed' && state.boxedNote && speed > 8;
    // (an episode: the cap HOLDING me - below my plan; set but above my plan it is counted apart)
    if (set && !state.capBinds) box.loose += 1 / 60;
    if (set && state.capBinds) box.binds += 1 / 60;
    const boxed = set && state.capBinds;
    // (and slowing me: over the capped target - braking or lifting for it)
    const slowing = boxed && speed > state.vT + 0.3;
    const open = box.open.get(entry);
    if (boxed) {
      if (open) {
        open.end = box.t;
        open.minGap = Math.min(open.minGap, state.boxedNote.gap);
        open.slowS += slowing ? 1 / 60 : 0;
      } else box.open.set(entry, { start: box.t, end: box.t, note: { ...state.boxedNote },
        minGap: state.boxedNote.gap, slowS: slowing ? 1 / 60 : 0 });
    } else if (open && box.t - open.end > 0.25) {
      box.episodes.push({ ...open, held: open.end - open.start + 1 / 60 });
      box.open.delete(entry);
    }
  }
}

/** Page side: step frames. */
function stepBoxed(count) {
  for (let frame = 0; frame < count; frame++) {
    window.__rt.step(1);
    window.__boxTick();
  }
}

/** One run. */
async function runOne(browser, base, id, seed) {
  const errors = [], run = ALL_RUNS[id];
  const page = await openPage(browser, base, run.level, errors, SKIP);
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((value) => window.__rt.seed(value), seed);
  await page.evaluate(() => { window.__AI_WHY = 1; });
  await page.evaluate(launchLevel, [run.level, { car: 'hatch-rwd', ...run.opts }]);
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(`window.__box = { t: 0, carS: 0, open: new Map(), episodes: [], binds: 0, loose: 0 };
    window.__boxTick = ${tickBoxed.toString()};`);
  for (let done = 0; done < SECONDS * 60; done += CHUNK) {
    await page.evaluate(stepBoxed, Math.min(CHUNK, SECONDS * 60 - done));
  }
  // (the episodes still open at the end)
  await page.evaluate(() => {
    for (const open of window.__box.open.values()) {
      window.__box.episodes.push({ ...open, held: open.end - open.start + 1 / 60 });
    }
  });
  const out = await page.evaluate(() => ({ episodes: window.__box.episodes,
    carS: window.__box.carS, binds: window.__box.binds, loose: window.__box.loose }));
  await page.context().close();
  out.errors = errors.slice(0, 3);
  return out;
}

/** The middle value of a list. */
const median = (list) => {
  const sorted = list.slice().sort((one, two) => one - two);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : NaN;
};

/**
 * What kept the picker off the roomier line (a line with 20 m+ more room ahead): the part of the
 * two lines' scores (ai/gapPick.ts lineScore) that counts most against the roomier one - or
 * BESIDE (a car beside me on it: no way through), CLAMPED (more than a swerve across: scored part
 * way, where it has no more room), PICKED-IT (it was the picked line).
 * @param note the boxed note
 * @returns the term
 */
function termsOf(episodes) {
  const counts = {}, timeBy = {};
  for (const ep of episodes) {
    if (!(ep.note.bestGap > ep.note.gap + 20)) continue;
    const term = decidingTerm(ep.note);
    counts[term] = (counts[term] || 0) + 1;
    timeBy[term] = (timeBy[term] || 0) + ep.held;
  }
  return Object.entries(counts).sort((one, two) => timeBy[two[0]] - timeBy[one[0]])
    .map(([term, count]) => `${term} ${count} (${timeBy[term].toFixed(0)} car-s)`).join(', ');
}

/** The deciding term of one boxed note (decidingTerm's doc above). */
function decidingTerm(note) {
  const pick = note.picked, room = note.roomiest;
  if (!room) return 'BESIDE';
  if (!pick || Math.abs(room.off - pick.off) < 0.01) return 'PICKED-IT';
  if (Math.abs(room.off - note.bestAt) > 0.01 && room.ahead <= pick.ahead + 20) return 'CLAMPED';
  const against = {
    'OUT-MIRROR': room.outMirror - pick.outMirror, 'OUT-MID': room.outMid - pick.outMid,
    MOVE: room.move - pick.move, PLACE: room.place - pick.place, KEPT: pick.kept - room.kept,
    AHEAD: pick.ahead - room.ahead,
  };
  return Object.entries(against).sort((one, two) => two[1] - one[1])[0][0];
}

/** Node side: one run's (or all runs') summary. */
function summary(name, episodes, carS) {
  const heldS = episodes.reduce((sum, ep) => sum + ep.held, 0);
  const share = (test) => {
    const hit = episodes.filter(test);
    return `${hit.length} (${(100 * hit.reduce((sum, ep) => sum + ep.held, 0)
      / Math.max(0.01, heldS)).toFixed(0)} % of the time)`;
  };
  const own = (ep) => Math.abs(ep.note.line - ep.note.myLat) < 0.6;
  return `${name}: ${episodes.length} boxed episodes, ${heldS.toFixed(0)} car-s (${(100 * heldS
    / Math.max(1, carS)).toFixed(1)} % of racing), median ${median(episodes.map((ep) => ep.held))
    .toFixed(2)} s, longest ${Math.max(0, ...episodes.map((ep) => ep.held)).toFixed(1)} s`
    + ` | at the start: gap median ${median(episodes.map((ep) => ep.note.gap)).toFixed(0)} m,`
    + ` blocker ${median(episodes.map((ep) => ep.note.v * 3.6)).toFixed(0)} km/h vs mine`
    + ` ${median(episodes.map((ep) => ep.note.myV * 3.6)).toFixed(0)}, across`
    + ` ${median(episodes.map((ep) => Math.abs(ep.note.lat - ep.note.myLat))).toFixed(1)} m`
    + ` | picked line = my lane: ${share(own)}; my own lane CLEAR (only the picked line`
    + ` blocked): ${share((ep) => !ep.note.ownBlocked)}; slowing me (over the capped target)`
    + ` ${(100 * episodes.reduce((sum, ep) => sum + ep.slowS, 0) / Math.max(0.01, heldS)).toFixed(0)}`
    + ` % of the held time; a fully FREE line existed:`
    + ` ${share((ep) => ep.note.freeAt != null)}; a line with 20 m+ more room: ${share((ep) =>
      ep.note.bestGap > ep.note.gap + 20)}; blocker 60 m+ ahead: ${share((ep) => ep.note.gap
      > 60)}; blocker faster than me: ${share((ep) => ep.note.v > ep.note.myV)}`
    + ` | WHY NOT the roomier line (score term against it): ${termsOf(episodes)}`;
}

const server = await startServer();
const browser = await launchBrowser();
const report = {};
try {
  for (const id of RUN_IDS) {
    const all = [];
    let carS = 0;
    for (const seed of SEEDS) {
      const out = await runOne(browser, server.url, id, seed);
      report[`${id}-${seed}`] = out;
      all.push(...out.episodes);
      carS += out.carS;
      console.log(summary(`${id} seed ${seed}`, out.episodes, out.carS)
        + ` | the cap holding me (below my plan) ${out.binds.toFixed(0)} car-s, set but above my plan`
        + ` ${out.loose.toFixed(0)} car-s${out.errors.length ? ' | ERR ' + out.errors[0] : ''}`);
      if (OUT) writeFileSync(OUT, JSON.stringify(report));
    }
    console.log(summary(`${id} ALL ${SEEDS.length} seeds`, all, carS));
  }
} finally {
  await browser.close();
  server.stop();
}
