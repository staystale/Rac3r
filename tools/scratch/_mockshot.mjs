// one look at a local mockup page: phone width, the logo + the first screens; page errors
import { launchBrowser } from '../lib/browser.mjs';
import { pathToFileURL } from 'node:url';
const file = process.argv[2], out = process.argv[3];
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } }); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(pathToFileURL(file).href).catch(() => {}); await page.waitForTimeout(3500);
  await page.screenshot({ path: out, fullPage: false });
  if (process.argv[4]) { await page.click('[data-pal="logo"]'); await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('phones').scrollIntoView()); await page.waitForTimeout(200);
    await page.screenshot({ path: process.argv[4] }); }
  console.log(errs.join('; ') || 'no errors');
} finally { await browser.close(); }
