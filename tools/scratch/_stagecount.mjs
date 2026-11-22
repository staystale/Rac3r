// _stagecount.mjs - THE STAGE'S AI COUNT (5 asked, 4 in game.ai 12 s in): every car of a Sweaty Lamb
// stage VS AI 5 over the whole stage - its slot relative to yours, where it was put at the green
// (cars ahead start already down the stage: game/grid.ts spawnAI), its start and finish (the race
// flow), when it left game.ai (game/ai.ts stepAI: 3 s past its finish). Math.random seeded per run
// (RUNS: seed:laps, the old setup's launch laps 3, the new one's 1); the player on the autopilot.
// RUNS=1:3,1:1,2:3,2:1 node tools/scratch/_stagecount.mjs
import { appendFileSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const OUT = process.env.OUT || 'tools/scratch/_stagecount.txt';
const report = (row) => appendFileSync(OUT, JSON.stringify(row) + '\n');

const RUNS = (process.env.RUNS || '1:3,1:1,2:3,2:1').split(',').map((run) => run.split(':')
  .map(Number));
const LIMIT_S = +(process.env.LIMIT_S || 420);
const AI_COUNT = +(process.env.AI || 5), MIN_SLOT = +(process.env.MINSLOT || 0);
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [seed, laps] of RUNS) {
    const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } }))
      .newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((seedValue) => {
      let state = seedValue >>> 0;
      Math.random = () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let mix = Math.imul(state ^ (state >>> 15), 1 | state);
        mix = (mix + Math.imul(mix ^ (mix >>> 7), 61 | mix)) ^ mix;
        return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
      };
    }, seed);
    await gotoGame(page, `${server.url}/?pc=1&guide=0&rules=0&noaudio=1&autopilot=1` + extraQuery());
    // (MINSLOT: launch again until a car starts that many slots ahead of you, or 20 tries; read
    // after the first tap - the grid at 1.5 s was not the one raced)
    for (let tries = 0; tries < 20; tries++) {
      await page.evaluate(([lapCount, aiCount]) => window.__game.launch('sweaty-lamb', 'saloon-rwd', {
        ai: aiCount, diff: 2, laps: lapCount, weather: { mode: 'dry', season: 2, seed: 4 } }),
      [laps, AI_COUNT]);
      await page.waitForTimeout(1500);
      await page.mouse.click(422, 195);
      await page.waitForTimeout(3000);
      const ahead = await page.evaluate(() => Math.min(0, ...window.__game.flow.entries
        .filter((entry) => !entry.player).map((entry) => entry.car._slot ?? 0),
      ...(window.__game.aiDone || []).map((car) => car._slot)));
      report({ seed, tries, ahead });
      if (ahead <= MIN_SLOT) break;
    }
    report({ seed, at3s: await page.evaluate(() => ({ mode: window.__game.mode,
      paused: window.__game.paused, t: window.__game.flow.t, state: window.__game.flow.state,
      start: window.__game.start })) });
    const first = await page.evaluate(() => {
      const game = window.__game;
      return { finishM: game.level.stage.finish, aiNow: game.ai.length,
        aiDone: (game.aiDone || []).map((car) => car.num),
        flowLaps: game.flow.laps, cars: game.flow.entries.map((entry) => ({
          num: entry.car.num, player: !!entry.player, slot: entry.player ? 0 : entry.car._slot,
          prog: entry.car._prog == null ? null : Math.round(entry.car._prog),
          stageStart: entry.car._stageStart ?? null,
          predT: entry.car._predT == null ? null : +entry.car._predT.toFixed(1) })) };
    });
    const left = {};
    let last = null;
    const wallStart = Date.now();
    while ((Date.now() - wallStart) / 1000 < LIMIT_S) {
      await page.waitForTimeout(1000);
      last = await page.evaluate(() => {
        const game = window.__game, flow = game.flow;
        return { t: +flow.t.toFixed(1), state: flow.state, aiNow: game.ai.length,
          inAi: game.flow.entries.filter((entry) => !entry.player).map((entry) => ({
            num: entry.car.num, there: game.ai.some((row) => row.car === entry.car),
            start: entry.start == null ? null : +entry.start.toFixed(1),
            finish: entry.finish == null ? null : +entry.finish.toFixed(1),
            time: entry.time == null ? null : +entry.time.toFixed(1),
            prog: entry.car._prog == null ? null : Math.round(entry.car._prog) })),
          me: (() => {
            const mine = flow.entries.find((entry) => entry.player);
            return { start: mine.start, finish: mine.finish,
              prog: mine.car._prog == null ? null : Math.round(mine.car._prog) };
          })() };
      });
      for (const car of last.inAi) if (!car.there && left[car.num] == null) left[car.num] = last.t;
      if (last.state === 'done') break;
    }
    report({ seed, launchLaps: laps, ...first });
    const results = await page.evaluate(() => (window.__game.flow.results || []).map((row) =>
      [row.pos, row.num, +row.time.toFixed(1), row.est ? 'est' : '', row.dnf ? 'DNF' : '']));
    report({ seed, results });
    report({ seed, end: { t: last.t, state: last.state, aiNow: last.aiNow,
      me: last.me, cars: last.inAi.map((car) => ({ ...car, leftAiAt: left[car.num] ?? null })) },
    errors: errors.slice(0, 3) });
    await page.context().close();
  }
} finally {
  await browser.close();
  server.stop();
}
