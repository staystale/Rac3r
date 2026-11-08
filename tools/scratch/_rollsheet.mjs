// _rollsheet.mjs - the roll mockup's proposed body at 12 angles for some cars, at phone size, and
// any page errors. node tools/scratch/_rollsheet.mjs [cars, comma]
import { startServer, launchBrowser } from '../lib/browser.mjs';
const cars = (process.argv[2] || 'hatch-fwd,estate-4x4,mikra-r1,track-rwd').split(',');
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  for (const car of cars) {
    await page.goto(`${server.url}/tools/scratch/rollmock.html?sheet=1&car=${car}`);
    await page.waitForTimeout(1500);
    const sheet = await page.$('main > canvas');
    await sheet.screenshot({ path: `tools/scratch/_rollsheet-${car}.png` });
  }
  console.log(errors.length ? 'ERRORS ' + errors.join(' | ') : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
