// _waterdrag.mjs - ?waterspread=1 measured in the game's own pass rule (wear.ts recordWearAt):
// Castle Cum, dry, 20 lines of 10 wear cells along the start straight, each with a one-cell
// puddle at its 3rd cell; a wheel drives along each line (+heading, cell by cell) 6 rounds.
// Prints, per round, the water cells on the lines and the furthest any water got from its
// puddle, and the bases under the lines. Run with and without the switch.
// node tools/scratch/_waterdrag.mjs [extra query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const query = process.argv[2] || '';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1${query}`);
  await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd',
    { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }));
  await page.waitForTimeout(2500);
  const res = await page.evaluate(async () => {
    const car = window.__game.car;
    const wear = await import('/src/world/wear.ts'), pass = await import('/src/world/pass.ts');
    const W = wear.WEAR_CELL, hx = Math.cos(car.heading), hy = Math.sin(car.heading);
    const side = [-hy, hx], lines = [];
    // 20 lines: 4 across the road (1.6 m apart) x 5 along it (20 m apart), 10 cells each
    for (let along = 0; along < 5; along++) {
      for (let across = -1.5; across <= 1.5; across++) {
        const startX = car.x + hx * (30 + along * 20) + side[0] * across * 1.6;
        const startY = car.y + hy * (30 + along * 20) + side[1] * across * 1.6;
        const cells = [];
        for (let k = 0; k < 10; k++) {
          const x = startX + hx * k * W, y = startY + hy * k * W;
          const cell = wear.getCell(Math.floor(x / W), Math.floor(y / W), true);
          if (cell && !cells.includes(cell)) cells.push({ cell, x, y });
        }
        lines.push(cells);
      }
    }
    const bases = {};
    for (const line of lines) for (const { cell } of line) bases[cell.base] = (bases[cell.base] || 0) + 1;
    for (const line of lines) {
      const { cell } = line[2];
      Object.assign(cell, { cover: 'wet', standing: true, dry: 0, passes: 0, current: 'wet' });
    }
    const rounds = [];
    let clock = 10000;
    const wheel = { vx: hx, vy: hy };
    for (let round = 1; round <= 6; round++) {
      for (const line of lines) {
        for (const { x, y } of line) {
          pass.notePass(wheel, 0, hx * 0.3, hy * 0.3);
          wear.recordWearAt(x, y, null, clock);
        }
      }
      clock += 1000;
      let water = 0, reach = 0;
      for (const line of lines) {
        line.forEach(({ cell }, k) => {
          if (cell.cover === 'wet') { water++; reach = Math.max(reach, k - 2); }
        });
      }
      rounds.push(`r${round}: ${water} wet, reach ${reach}`);
    }
    return { bases, rounds: rounds.join(' | ') };
  });
  console.log(`${query || '(no switches)'}: ${JSON.stringify(res)}`);
} finally {
  await browser.close();
  server.stop();
}
