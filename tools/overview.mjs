// overview.mjs — paints a level's whole-map overview (the menu thumbnail painter) to shots/look/: node tools/overview.mjs <level>
import { startServer, launchBrowser } from './lib/browser.mjs';
const srv = await startServer();
process.on('exit', srv.stop);
const b = await launchBrowser();
const p = await (await b.newContext({ viewport: { width: 960, height: 676 } })).newPage();
await p.goto(srv.url + '/?pc=1&guide=0&menu=0&level=' + (process.argv[2] || 'thruston')); await p.waitForTimeout(800);
const url = await p.evaluate(() => { window.__game.selectLevel(window.__game.level.id); const c = window.__game.renderer.thumbnail(960); return c.toDataURL(); });
const fs = await import('fs'); fs.writeFileSync('shots/look/' + (process.argv[2] || 'thruston') + '-overview.png', Buffer.from(url.split(',')[1], 'base64'));
await b.close();
srv.stop();
