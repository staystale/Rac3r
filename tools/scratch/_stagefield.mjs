// _stagefield.mjs - A RALLY STAGE'S FIELD AT THE START, HASHED (the proof of a stage-start change:
// old code with its switch == new plain). Per level, per seed: Math.random seeded and the field
// spawned again in one synchronous step (window.__game.setAI -> game/grid.ts spawnAI, so no frame
// draws from the stream between), then every car's slot, place, speed, predicted time, start and
// result if home, hashed. Prints a hash per level and "stagefield: <all>"; OUT=file writes every
// car's row. RAC3R_QUERY carries switches.
// [LEVELS=sweaty-lamb,killder] [SEEDS=30] [AI=5] [OUT=file] node tools/scratch/_stagefield.mjs
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const LEVELS = (process.env.LEVELS || 'sweaty-lamb,killder').split(',');
const SEEDS = +(process.env.SEEDS || 30), AI_COUNT = +(process.env.AI || 5);
const server = await startServer();
const browser = await launchBrowser();
const rows = [], hashes = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } }))
    .newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&rules=0&noaudio=1` + extraQuery());
  for (const levelId of LEVELS) {
    await page.evaluate(([id, count]) => window.__game.launch(id, 'saloon-rwd', { ai: count,
      diff: 2, laps: 1, weather: { mode: 'dry', season: 2, seed: 4 } }), [levelId, AI_COUNT]);
    await page.waitForTimeout(2500);
    await page.mouse.click(422, 195);
    await page.waitForTimeout(1500);
    const fields = await page.evaluate(([seedCount, count]) => {
      const out = [], round = (value, places) => (value == null || !isFinite(value) ? null
        : +value.toFixed(places));
      for (let seed = 1; seed <= seedCount; seed++) {
        let state = seed >>> 0;
        Math.random = () => {
          state = (state + 0x6d2b79f5) >>> 0;
          let mix = Math.imul(state ^ (state >>> 15), 1 | state);
          mix = (mix + Math.imul(mix ^ (mix >>> 7), 61 | mix)) ^ mix;
          return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
        };
        window.__game.setAI(count);
        const game = window.__game, cars = [...game.ai.map((entry) => entry.car),
          ...(game.aiDone || [])];
        out.push(cars.map((car) => [seed, car.num, car._slot, (game.aiDone || []).includes(car)
          ? 'home' : 'road', round(car.x, 3), round(car.y, 3), round(Math.hypot(car.vx, car.vy), 3),
        round(car._prog, 2), round(car._predT, 3), car._stageStart ?? null,
        round(car._stageTime, 3)]));
      }
      return out;
    }, [SEEDS, AI_COUNT]);
    const flat = fields.flat().map((row) => [levelId, ...row].join(' '));
    rows.push(...flat);
    const hash = createHash('md5').update(flat.join('\n')).digest('hex');
    hashes.push(hash);
    const homes = flat.filter((row) => row.includes(' home ')).length;
    console.log(`${levelId}  ${hash}  seeds=${SEEDS} cars=${flat.length} home=${homes}`);
  }
  console.log('errors', errors.length ? errors.slice(0, 3).join(' | ') : 'none');
} finally {
  await browser.close();
  server.stop();
}
if (process.env.OUT) writeFileSync(process.env.OUT, rows.join('\n') + '\n');
console.log('stagefield: ' + createHash('md5').update(hashes.join('\n')).digest('hex'));
