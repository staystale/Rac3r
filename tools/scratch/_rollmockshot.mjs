// _rollmockshot.mjs - photographs tools/scratch/rollmock.html at phone size mid-roll and at rest,
// with page errors. node tools/scratch/_rollmockshot.mjs [car]
import { startServer, launchBrowser } from '../lib/browser.mjs';
const car = process.argv[2] || 'hatch-fwd';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto(`${server.url}/tools/scratch/rollmock.html`);
  await page.waitForTimeout(1500);
  await page.click(`#cars button:text-is("${car}")`);
  await page.click('#slow');
  for (const at of [0.25, 0.6, 4]) {
    await page.waitForTimeout(at * 1000);
    await page.screenshot({ path: `tools/scratch/_rollmock-${car}-${at}s.png`, fullPage: false });
  }
  console.log(errors.length ? 'ERRORS ' + errors.join(' | ') : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
