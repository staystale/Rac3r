// _mockshot.mjs - one screenshot of a local mockup page at phone width (wrapped as published)
// node tools/scratch/_mockshot.mjs <page.html> <out.png> [width]
import { readFileSync } from 'node:fs';
import { launchBrowser } from '../lib/browser.mjs';
const [file, out, width = '420'] = process.argv.slice(2);
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: +width, height: 900 } });
page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
await page.setContent('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
  + readFileSync(file, 'utf8'));
await page.waitForTimeout(2500);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
