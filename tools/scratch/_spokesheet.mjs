// _spokesheet.mjs - every spoke pattern (render/wheelface.ts) at the world's 17 px (x5) and the paint
// shop's 68 px, in chrome and in red: tools/scratch/_spokesheet.png
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
import { writeFileSync } from 'node:fs';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 400 } });
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1`);
  const url = await page.evaluate(async () => {
    const wf = await import('/src/render/wheelface.ts');
    const pats = ['', ...wf.SPOKES], sheet = document.createElement('canvas');
    sheet.width = pats.length * 100; sheet.height = 260;
    const ctx = sheet.getContext('2d'); ctx.fillStyle = '#4a6a3a'; ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.imageSmoothingEnabled = false;
    pats.forEach((pat, i) => {
      for (const [row, rim] of [[0, '#d6d9df'], [1, '#c8342a']]) {
        const small = document.createElement('canvas'); small.width = small.height = 17;
        wf.drawWheelFace(small.getContext('2d'), 17, rim, pat);
        ctx.drawImage(small, i * 100 + 8, 8 + row * 90, 85, 85);
      }
      const big = document.createElement('canvas'); big.width = big.height = 68;
      wf.drawWheelFace(big.getContext('2d'), 68, '#c9a227', pat);
      ctx.drawImage(big, i * 100 + 16, 190 - 8, 68, 68);
      ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText(pat || 'stock', i * 100 + 30, 186);
    });
    return sheet.toDataURL('image/png');
  });
  writeFileSync('tools/scratch/_spokesheet.png', Buffer.from(url.split(',')[1], 'base64'));
} finally { await browser.close(); server.stop(); }
