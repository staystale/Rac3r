// overview.mjs — paints a level's whole-map overview (the menu thumbnail painter) to shots/look/: node tools/overview.mjs <level>
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 960, height: 676 } })).newPage();
await p.goto('http://localhost:8080/?pc=1&guide=0&menu=0&level=' + (process.argv[2] || 'thruston')); await p.waitForTimeout(800);
const url = await p.evaluate(() => { window.__game.selectLevel(window.__game.level.id); const c = window.__game.renderer.thumbnail(960); return c.toDataURL(); });
const fs = await import('fs'); fs.writeFileSync('shots/look/' + (process.argv[2] || 'thruston') + '-overview.png', Buffer.from(url.split(',')[1], 'base64'));
await b.close();
