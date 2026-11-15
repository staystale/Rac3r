// _sirenwav.mjs - THE POLICE SIREN (?siren=1) rendered to .wav files to listen to, with the game's
// own sound code in a browser's OfflineAudioContext (no speakers, no recording):
//   siren-scene.wav   the real sound engine (src/audio.ts createAudio: your engine at a steady
//                     110 km/h, 4200 rpm, half throttle; the volume at the game's default 50 %)
//                     driven frame by frame (30 a second, OfflineAudioContext.suspend), the sirens
//                     through its sirens(): 0-1.5 s engine only; 1.5 s a chaser starts 225 m off,
//                     ahead-left, closes and passes left to right ~10 m away; 6 s a second chaser
//                     from 180 m off on the right; 12.5 s both chases end; to 14 s engine only
//   siren-scene-sirens-only.wav   the same with the engine never driven (silent): the sirens alone
//   siren-twotone.wav, siren-wail.wav, siren-yelp.wav   each pattern alone at 50 %, a chaser 25 m
//                     dead ahead
// Prints each file's peak and its level (RMS, left / right) every half second.
// CHECK_PORT=8092 node tools/scratch/_sirenwav.mjs <out dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, launchBrowser } from '../lib/browser.mjs';

const OUT = process.argv[2];
if (!OUT) throw new Error('give the folder to write the .wav files into');
mkdirSync(OUT, { recursive: true });
const server = await startServer();
let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  // a blank page on the game's server, to import its modules from
  await page.route(server.url + '/blank.html', (route) => route.fulfill({ body: '<html></html>',
    contentType: 'text/html' }));
  await page.goto(server.url + '/blank.html');
  const files = await page.evaluate(renderAll);
  for (const file of files) {
    writeFileSync(join(OUT, file.name), Buffer.from(file.base64, 'base64'));
    console.log(`${file.name}: ${file.seconds} s, peak ${file.peak.toFixed(3)}`);
    console.log('  RMS L/R each 0.5 s: ' + file.rms.join(' '));
  }
  if (errors.length) console.log('PAGE ERRORS:', errors.join(' | '));
} finally {
  await browser?.close();
  server.stop();
}

/** In the page: every render, as WAV files (base64) with their levels. */
async function renderAll() {
  const RATE = 44100, VOLUME = 0.5;
  const { createAudio } = await import('/src/audio.ts');
  const siren = await import('/src/audiosiren.ts');
  const toWav = (buffer, name) => {
    const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
    const bytes = new DataView(new ArrayBuffer(44 + left.length * 4));
    const text = (at, str) => [...str].forEach((ch, i) => bytes.setUint8(at + i, ch.charCodeAt(0)));
    text(0, 'RIFF'); bytes.setUint32(4, 36 + left.length * 4, true); text(8, 'WAVEfmt ');
    bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 2, true);
    bytes.setUint32(24, RATE, true); bytes.setUint32(28, RATE * 4, true);
    bytes.setUint16(32, 4, true); bytes.setUint16(34, 16, true); text(36, 'data');
    bytes.setUint32(40, left.length * 4, true);
    let peak = 0, sumL = 0, sumR = 0;
    const rms = [], half = RATE / 2;
    for (let i = 0; i < left.length; i++) {
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
      sumL += left[i] * left[i];
      sumR += right[i] * right[i];
      if ((i + 1) % half === 0) {
        rms.push(Math.sqrt(sumL / half).toFixed(3) + '/' + Math.sqrt(sumR / half).toFixed(3));
        sumL = sumR = 0;
      }
      bytes.setInt16(44 + i * 4, Math.max(-1, Math.min(1, left[i])) * 32767, true);
      bytes.setInt16(46 + i * 4, Math.max(-1, Math.min(1, right[i])) * 32767, true);
    }
    const raw = new Uint8Array(bytes.buffer);
    let bin = '';
    for (let i = 0; i < raw.length; i += 32768) bin += String.fromCharCode(...raw.subarray(i, i + 32768));
    return { name, base64: btoa(bin), peak, rms, seconds: left.length / RATE };
  };

  // the scene: the real sound engine and its sirens(), frame by frame
  const scene = async (withEngine) => {
    const SECONDS = 14, offline = new OfflineAudioContext(2, RATE * SECONDS, RATE);
    // (the engine's update runs only while its context reads 'running': rendering, it is)
    Object.defineProperty(offline, 'state', { get: () => 'running' });
    window.AudioContext = function OfflineStandIn() { return offline; };
    localStorage.setItem('rac3r.vol', String(VOLUME));
    localStorage.setItem('rac3r.mute', '0');
    const audio = createAudio(true);
    audio.init();
    const car = { vx: 0, vy: -30.6, rpm: 4200, gear: 4, in: { throttle: 0.5 },
      spec: { id: 'hatch-rwd', redline: 7000, idleRpm: 900, cyl: 4 }, surface: { id: 'tarmac' } };
    const spots = [{ isOn: false, dx: 0, dy: 0 }, { isOn: false, dx: 0, dy: 0 }];
    const sceneAt = (time) => {
      const first = (time - 1.5) / 7.5, second = (time - 6) / 6;
      spots[0].isOn = time >= 1.5 && time < 12.5;
      spots[0].dx = -50 + 60 * first;
      spots[0].dy = -220 + 235 * first;
      spots[1].isOn = time >= 6 && time < 12.5;
      spots[1].dx = 90 - 70 * second;
      spots[1].dy = 160 - 150 * second;
      if (withEngine) audio.update(car);
      audio.sirens(spots);
    };
    for (let frame = 1; frame < SECONDS * 30; frame++) {
      const at = Math.round((frame / 30) * RATE / 128) * 128 / RATE;
      offline.suspend(at).then(() => {
        sceneAt(at);
        offline.resume();
      });
    }
    sceneAt(0);
    return toWav(await offline.startRendering(),
      withEngine ? 'siren-scene.wav' : 'siren-scene-sirens-only.wav');
  };
  const files = [await scene(true), await scene(false)];

  // each pattern alone, a chaser 25 m dead ahead
  for (const name of ['twotone', 'wail', 'yelp']) {
    const alone = new OfflineAudioContext(2, RATE * 6, RATE), master = alone.createGain();
    master.gain.value = VOLUME;
    master.connect(alone.destination);
    const voices = siren.buildSirens(alone, master, siren.SIREN_TONES[name]);
    siren.updateSirenVoices(voices, [{ isOn: true, dx: 0, dy: -25 }, { isOn: false, dx: 0, dy: 0 }],
      0);
    files.push(toWav(await alone.startRendering(), `siren-${name}.wav`));
  }
  return files;
}
