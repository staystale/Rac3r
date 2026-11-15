// _offroadwin.mjs - BUG 6 (?offroadwin=1): can a highway race be WON BY PULLING AWAY while OFF THE
// ROAD? The real game, a race with 2 AI (no traffic); after the green your car is put 400 m ahead
// of the leading AI and carried up the road at 45 m/s (set each frame: the rule is under test,
// not the driving) at a distance out from the road's edge:
//   on        in the left lane                        the getaway must win (~8 s)
//   verge     4 m out (no off-road countdown there)   must NOT win while off the road
//   band      12 m out (the countdown held, < 16 m)   must NOT win while off the road
//   field     30 m out (the 10 s countdown runs)      must NOT win while off the road
//   back      12 m out for 10 s, then the left lane   must win, on the road
//   line      12 m out, the finish line 300 m ahead   must finish over the line (off the road
//             still counts in a race to a line)
//   clock     12 m out, the clock out in 6 s          must end on the clock (off the road counts)
// Each line: how the race ended (away / finish / time / not), when, where the car was (m out
// past the road's edge), your place, and any reset by the guard.
// [ROADS=motorway,twisty,canyon] [RAC3R_QUERY=offroadwin=1] node tools/scratch/_offroadwin.mjs
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const ROADS = (process.env.ROADS || 'motorway,twisty,canyon').split(',');
const ROAD_OPTS = {
  motorway: { road: 'motorway' }, twisty: { road: 'twisty' },
  canyon: { road: 'dual', scenery: 'canyon' }, walled: { road: 'walled' },
};
// case: [m out past the edge (null: the lane), s on it before the lane (back), the finish]
const CASES = {
  on: [null], verge: [4], band: [12], field: [30], back: [12, 10], line: [12, null, 'line'],
  clock: [12, null, 'clock'],
};
const MUST = { on: 'away', verge: 'not', band: 'not', field: 'not', back: 'away', line: 'finish',
  clock: 'time' };
const SPEED = 45, GAP_M = 400, WATCH_S = 20;
// SHOTS=<folder>: a photo 6 s into each case named in SHOT_CASES (default band, on); VIEW=WxH
const SHOTS = process.env.SHOTS || '';
const SHOT_CASES = (process.env.SHOT_CASES || 'band,on').split(',');
const [VIEW_W, VIEW_H] = (process.env.VIEW || '844x390').split('x').map(Number);
const SWITCH = (process.env.RAC3R_QUERY || '').includes('offroadwin=1') ? 'on' : 'off';

/** Page side: carry the car up the road for one case; window.__ow holds what it saw. */
function startCase([name, outM, laneAfterS, finish, speed, gapM]) {
  const game = window.__game, level = game.level, car = game.car, flow = game.flow;
  const highway = window.__owHighway, geo = level._hw.geo;
  const lead = Math.max(...game.ai.map((entry) => entry.car._hwf?.s ?? -Infinity));
  const watch = { name, start: performance.now(), s: lead + gapM, snaps: window.__owSnaps,
    reset: false, end: null, maxOut: 0 };
  window.__ow = watch;
  if (finish === 'line') flow.finish = { s: watch.s + 300 };
  if (finish === 'clock') flow.finish = { t: flow.t + 6 };
  game.input.update = () => {
    const heldS = (performance.now() - watch.start) / 1000;
    const onLane = outM === null || (laneAfterS != null && heldS > laneAfterS);
    if (window.__owSnaps !== watch.snaps) watch.reset = true;
    if (flow.state === 'done' && !watch.end) {
      const out = Math.abs(level._hw.q?.off ?? 0) - geo.hw;
      watch.end = { why: flow.endWhy, atS: heldS, out, place: flow.myPlace };
    }
    if (!watch.end && !watch.reset) {
      watch.s += speed / 60;
      const off = onLane ? geo.centres[0] : -(geo.hw + outM);
      const pose = highway.roadPose(level, watch.s, off);
      Object.assign(car, { x: pose.x, y: pose.y, heading: pose.h, yawRate: 0,
        vx: Math.cos(pose.h) * speed, vy: Math.sin(pose.h) * speed, _p: null });
      watch.maxOut = Math.max(watch.maxOut, onLane ? 0 : outM);
    }
    return { steer: 0, throttle: 0.5, brake: 0, handbrake: 0, reverse: 0, shiftUp: false,
      shiftDown: false };
  };
}

const server = await startServer();
const browser = await launchBrowser();
let failed = false;
try {
  const errors = [];
  const page = await browser.newPage({ viewport: { width: VIEW_W, height: VIEW_H } });
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&loadscreen=0`
    + extraQuery());
  await page.mouse.click(VIEW_W / 2, VIEW_H / 2);
  await page.waitForTimeout(800);
  for (const road of ROADS) {
    const lines = [];
    for (const [name, [outM, laneAfterS, finish]] of Object.entries(CASES)) {
      await page.evaluate(([opts, code]) => window.__game.launch('highway', 'hatch-rwd', {
        ai: 2, traffic: 0, finish: code, ...opts }), [ROAD_OPTS[road], finish ? 'km20' : null]);
      await page.evaluate(async () => {
        window.__owHighway = await import('/src/highway.ts');
        const renderer = window.__game.renderer, snap = renderer.snap;
        window.__owSnaps = 0;
        renderer.snap = (car) => {
          if (car === window.__game.car) window.__owSnaps++;
          return snap.call(renderer, car);
        };
      });
      // the green, and the AI under way
      for (let tries = 0; tries < 40; tries++) {
        if (await page.evaluate(() => window.__game.start?.green && window.__game.flow?.t > 3))
          break;
        await page.waitForTimeout(500);
      }
      await page.evaluate(startCase, [name, outM ?? null, laneAfterS ?? null, finish ?? null,
        SPEED, GAP_M]);
      for (let tries = 0; tries < WATCH_S * 2; tries++) {
        await page.waitForTimeout(500);
        if (SHOTS && tries === 11 && SHOT_CASES.includes(name)) {
          await page.screenshot({ path: `${SHOTS}/_offroadwin-${road}-${name}-switch${SWITCH}-`
            + `${VIEW_W}x${VIEW_H}.png` });
        }
        if (await page.evaluate(() => !!window.__ow.end)) break;
      }
      const seen = await page.evaluate(() => ({ ...window.__ow }));
      const how = seen.end ? seen.end.why : 'not';
      const offAtEnd = seen.end && seen.end.out > 0;
      const isOk = MUST[name] === 'not' ? !(seen.end && seen.end.why === 'away' && offAtEnd)
        : how === MUST[name] && (MUST[name] !== 'away' || !offAtEnd);
      if (!isOk) failed = true;
      lines.push(`${isOk ? 'OK  ' : 'FAIL'} ${name.padEnd(6)} ` + (seen.end
        ? `ended "${seen.end.why}" at ${seen.end.atS.toFixed(1)} s, ${seen.end.out.toFixed(1)} m`
          + ` out past the edge, place ${seen.end.place}` : `no end in ${WATCH_S} s`)
        + (seen.reset ? ' (the guard reset the car)' : ''));
    }
    console.log(`${road}:\n  ${lines.join('\n  ')}`);
  }
  console.log(errors.length ? 'PAGE ERRORS ' + [...new Set(errors)].slice(0, 3).join(' | ')
    : 'page errors none');
  if (errors.length) failed = true;
} finally {
  await browser.close();
  server.stop();
}
console.log(failed ? 'RESULT: FAIL' : 'RESULT: ALL OK');
process.exitCode = failed ? 1 : 0;
