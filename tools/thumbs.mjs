// thumbs.mjs - THE SHIPPED TRACK THUMBNAILS (src/menu/thumbfiles.ts): every level's menu
// thumbnail painted by the game itself (game/menuflow.ts paintThumbsNow: the light build and
// renderer.thumbnail(320), as the menu painted them) into assets/thumbs/<level id>.png, and
// assets/thumbs/index.json listing the levels that have one. Run it when a level is added or its
// look changes (tools/thumbcheck.mjs fails on a level without one).
// Each is also written as lossless WebP beside its PNG (tools/lib/thumbwebp.mjs; the menu reads
// those with ?thumbfill=1), kept only when its pixels match.
// node tools/thumbs.mjs [id,id...]   (only those painted again; the list covers every file)
// node tools/thumbs.mjs --webp        (no painting: every listed PNG written again as WebP)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, launchBrowser, gotoGame, extraQuery } from './lib/browser.mjs';
import { encodeThumbsWebp } from './lib/thumbwebp.mjs';
import { LEVELS } from '../src/world/levels/index.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'assets', 'thumbs');
const isWebpOnly = process.argv[2] === '--webp';
const only = process.argv[2] && !isWebpOnly ? new Set(process.argv[2].split(',')) : null;
const ids = LEVELS.map((level) => level.id).filter((levelId) => !only || only.has(levelId));
// levels a page paints before its next: the page's level is put back between
const BATCH = 6;
fs.mkdirSync(DIR, { recursive: true });
/**
 * Writes the levels' PNGs again as lossless WebP beside them (one whose pixels did not match is
 * not written, and a stale one removed).
 * @param page a page on the game's server
 * @param levelIds the levels (each with its PNG written)
 */
async function writeWebps(page, levelIds) {
  const pngs = Object.fromEntries(levelIds.map((levelId) => [levelId,
    fs.readFileSync(path.join(DIR, levelId + '.png')).toString('base64')]));
  const webps = await encodeThumbsWebp(page, pngs);
  for (const levelId of levelIds) {
    const target = path.join(DIR, levelId + '.webp');
    if (webps[levelId]) fs.writeFileSync(target, Buffer.from(webps[levelId], 'base64'));
    else {
      errors.push(`${levelId}: its WebP did not match`);
      fs.rmSync(target, { force: true });
    }
  }
}

const server = await startServer();
const browser = await launchBrowser();
const errors = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  page.on('pageerror', (err) => errors.push(err.message));
  // (RAC3R_QUERY: a level behind its switch, with the switch's NAME=1 for the list here too)
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1${extraQuery()}`);
  const t0 = Date.now();
  if (isWebpOnly) await writeWebps(page, ids.filter((levelId) =>
    fs.existsSync(path.join(DIR, levelId + '.png'))));
  for (let from = 0; from < (isWebpOnly ? 0 : ids.length); from += BATCH) {
    const batch = ids.slice(from, from + BATCH);
    const urls = await page.evaluate((want) => {
      const painted = window.__game.paintThumbsNow(want);
      return want.map((levelId) => (painted[levelId] ? painted[levelId].toDataURL('image/png')
        : null));
    }, batch);
    batch.forEach((levelId, i) => {
      if (!urls[i]) { errors.push(`${levelId}: no thumbnail`); return; }
      fs.writeFileSync(path.join(DIR, levelId + '.png'), Buffer.from(urls[i].split(',')[1],
        'base64'));
    });
    await writeWebps(page, batch.filter((levelId, i) => urls[i]));
    process.stdout.write(`${Math.min(ids.length, from + BATCH)}/${ids.length} `);
  }
  // the list: every level with a file (in the levels' order)
  const listed = LEVELS.map((level) => level.id).filter((levelId) =>
    fs.existsSync(path.join(DIR, levelId + '.png')));
  fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify({ ids: listed }, null, 1) + '\n');
  const bytes = listed.reduce((sum, levelId) => sum + fs.statSync(path.join(DIR, levelId + '.png'))
    .size, 0);
  console.log(`\n${ids.length} painted in ${((Date.now() - t0) / 1000).toFixed(1)} s; ${listed.length}`
    + ` listed, ${(bytes / 1024).toFixed(0)} KB`);
} finally {
  console.log('page errors:', errors.length ? errors.join(' || ') : 'none');
  await browser.close();
  server.stop();
  if (errors.length) process.exitCode = 1;
}
