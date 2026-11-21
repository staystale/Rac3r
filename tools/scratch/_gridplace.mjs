// _gridplace.mjs - THE PLACE SHOWN BEFORE THE GREEN (the lap panel's P n / m, game/order.ts
// stepOrder): a circuit launched with AI, the race held at its lights; each car's race progress
// (_prog), its distance back from the pole, and the place you are shown against the place your
// slot really is - for every slot (the player's slot forced, ?gridpos off / on); then the place
// shown once the race is started (a key) and stepped 1.5 s, still before the green.
// node tools/scratch/_gridplace.mjs [level] [ai] [extra query] [launch options JSON]
// (an RX grid: knobhill 5 '' '{"rx":true}'; a rolling start: naffcar; the highway: highway 5 ''
// '{"traffic":0}'; a stage: stage-sahara-sandpants - no subtrack or no AI: the real place is not
// worked out, the place after the first steps is the game's own)
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [level = 'thruston', aiArg = '5', extra = '', optsArg = '{}'] = process.argv.slice(2);
const OPTS = JSON.parse(optsArg);
const AI = +aiArg;
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1${extra}`);
  await page.mouse.click(422, 195);
  await page.waitForTimeout(1200);
  const rows = [];
  for (let slot = 0; slot <= AI; slot++) {
    const row = await page.evaluate(async ([id, count, wantSlot, more]) => {
      const game = window.__game;
      // (the player's slot drawn at random: tried until it is the one wanted)
      for (let tries = 0; tries < 60; tries++) {
        game.launch(id, 'hatch-rwd', { ai: count, laps: 3,
          weather: { mode: 'dry', season: 2, seed: 4 }, ...more });
        await new Promise((done) => setTimeout(done, 400));
        if (!game.ai.length || game.car._slot === wantSlot
          || game.ai.every((entry) => entry.car._slot !== wantSlot)) break;
      }
      await new Promise((done) => setTimeout(done, 1500));
      const { querySubtrack } = await import('/src/world/tyrewall.ts');
      const sub = game.level.subtrack;
      if (!sub || game.level.endless) return { slot: wantSlot, shown: game.position, truth: '?',
        green: !!game.start.green, progs: `stage ${!!game.level.stage}, endless `
          + `${!!game.level.endless}, rolling ${!!game.start.rolling}, AI ${game.ai.length},`
          + ` your slot ${game.car._slot}`, back: '?' };
      const cars = [game.car, ...game.ai.map((entry) => entry.car)];
      const along = (car) => querySubtrack(sub, car.x, car.y).trackDist;
      const total = sub.totalDist;
      // (another car ahead of yours along the road, the lap's wrap taken out)
      const rel = (car) => ((along(car) - along(game.car)) % total + 1.5 * total) % total
        - total / 2;
      const truth = 1 + cars.filter((car) => car !== game.car && rel(car) > 0).length;
      const top = Math.max(...cars.map(rel));
      return { slot: wantSlot, shown: game.position, truth, green: !!game.start.green,
        rolling: !!game.start.rolling, stage: !!game.level.stage,
        progs: cars.map((car) => (car === game.car ? 'YOU ' : '') + (car._prog === undefined
          ? 'undef' : car._prog.toFixed(1))).join(' '), back: top.toFixed(1),
        total: sub.totalDist.toFixed(0) };
    }, [level, AI, slot, OPTS]);
    // then the race started (a key press) and stepped 1.5 s, still before the green
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(1500);
    row.stepped = await page.evaluate(() => `P${window.__game.position} (green `
      + `${!!window.__game.start.green})`);
    rows.push(row);
  }
  for (const row of rows) console.log(`slot ${row.slot}: shown P${row.shown}, really P${row.truth}`
    + ` (green ${row.green}); after the start's first steps ${row.stepped}; you ${row.back} m`
    + ` back; ${row.rolling ? 'rolling; ' : ''}${row.stage ? 'stage; ' : ''}`
    + `progress: ${row.progs}`);
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
