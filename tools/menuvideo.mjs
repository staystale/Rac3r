// menuvideo.mjs — RECORD THE MENU'S BACKGROUND RACE (src/game/menuvideo.js plays it): the live menu
// race (?menulive=1) is recorded from the game's own canvases, in the browser, to
// media/menu-race.mp4 (H.264, plays on an iPhone) plus media/menu-race.jpg, its still frame (the
// poster: shown while the video loads, and in iPhone Low Power Mode). Run it again whenever the
// game's look changes.
//   node tools/menuvideo.mjs [seconds=16] [kbps=1100]
// The ground is a WebGL canvas under the 2D screen canvas (render/glground.ts), so every frame both
// are drawn, in order, into one recording canvas, and that is what MediaRecorder records.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer, launchBrowser } from './lib/browser.mjs';

const SECONDS = Number(process.argv[2]) || 16;
const KBPS = Number(process.argv[3]) || 1100;
const W = 1280, H = 720;     // landscape; a portrait phone shows the middle (object-fit: cover)
const SETTLE_MS = 7000;      // the fly-in and the start, before recording
const media = fileURLToPath(new URL('../media/', import.meta.url));

const srv = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: W, height: H },
    deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (err) => console.log('page error:', err.message));
  await page.goto(`${srv.url}/?menu=1&menulive=1&guide=0&rules=0`);
  await page.waitForTimeout(SETTLE_MS);
  const out = await page.evaluate(async ([seconds, kbps]) => {
    // the menu panel is DOM over the canvases: the recording sees only the race
    // (the GL ground first, then the screen: document order; none of the menu's own canvases)
    const layers = [...document.querySelectorAll('canvas')].filter((canvas) => !canvas.closest('#menu'));
    const rec = document.createElement('canvas');
    rec.width = window.innerWidth;
    rec.height = window.innerHeight;
    const ctx = rec.getContext('2d');
    const paint = () => {
      ctx.fillStyle = '#1b1d22';
      ctx.fillRect(0, 0, rec.width, rec.height);
      for (const layer of layers) ctx.drawImage(layer, 0, 0, rec.width, rec.height);
    };
    let painting = true;
    const tick = () => { if (painting) { paint(); requestAnimationFrame(tick); } };
    paint();
    const poster = rec.toDataURL('image/jpeg', 0.82);
    requestAnimationFrame(tick);
    const recorder = new MediaRecorder(rec.captureStream(60), {
      mimeType: 'video/mp4;codecs=avc1.640028', videoBitsPerSecond: kbps * 1000 });
    const chunks = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const done = new Promise((resolve) => { recorder.onstop = resolve; });
    recorder.start(1000);
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    recorder.stop();
    await done;
    painting = false;
    const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/mp4' }).arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { video: btoa(binary), poster: poster.split(',')[1], layers: layers.length };
  }, [SECONDS, KBPS]);
  mkdirSync(media, { recursive: true });
  const video = Buffer.from(out.video, 'base64');
  writeFileSync(media + 'menu-race.mp4', video);
  writeFileSync(media + 'menu-race.jpg', Buffer.from(out.poster, 'base64'));
  console.log(`media/menu-race.mp4 ${(video.length / 1024).toFixed(0)} KB, ${SECONDS} s at ` +
    `${KBPS} kbps, ${out.layers} canvas layers; media/menu-race.jpg`);
} finally {
  await browser.close();
  srv.stop();
}
