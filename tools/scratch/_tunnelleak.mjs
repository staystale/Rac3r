// _tunnelleak.mjs - WHERE A CAR'S LIGHT LANDS IN MOANACO'S TUNNEL (scratch): the player car driven
// into the tunnel by the demo driver at night and stopped at STOPS points along it; at each stop a
// photo with its lamps off and one with them on (headlights, and the brake lights held), and the
// difference amplified: whatever lights up is the car's light - on a slat or outside the walls
// it leaks. Writes tools/scratch/_leak-<stop>-{off,on,diff}.png and the lit share per stop.
// node tools/scratch/_tunnelleak.mjs [query] (env VIEW 440x738, ZOOM 0.6, STOPS 6, STEP_S 0.6;
// CHECK_PORT; one browser)
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [query = ''] = process.argv.slice(2);
const ZOOM = +(process.env.ZOOM || 0.6), STOPS = +(process.env.STOPS || 6);
const STEP_S = +(process.env.STEP_S || 0.6);
const [viewW, viewH] = (process.env.VIEW || '440x738').split('x').map(Number);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: viewW, height: viewH } }))
    .newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&night=0.9&level=moanaco&${query}`);
  await page.mouse.click(viewW / 2, viewH / 2);
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__game.launch('moanaco', window.__game.car.spec.id, { ai: 0 }));
  await page.waitForTimeout(9000);
  // (env AT=x,y: start 25 m before the race road's point nearest there - a footbridge - instead
  // of before the tunnel's mouth)
  const at = process.env.AT ? process.env.AT.split(',').map(Number) : null;
  await page.evaluate(async (near) => {
    const game = window.__game, sub = game.level.subtrack;
    let from = sub.under[0].d0 - 22;
    if (near) {
      let closest = sub.pts[0];
      for (const point of sub.pts) if (Math.hypot(point.x - near[0], point.y - near[1])
        < Math.hypot(closest.x - near[0], closest.y - near[1])) closest = point;
      from = closest.dist - 25;
    }
    let best = sub.pts[0];
    const speed = 20;
    for (const point of sub.pts) if (point.dist <= from) best = point;
    const { reset } = await import('/src/vehicle.ts');
    game.car.crossing = -1;
    reset(game.car, best.x, best.y, best.heading);
    Object.assign(game.car, { vx: speed * Math.cos(best.heading), vy: speed * Math.sin(best.heading) });
    const auto = await import('/src/ai/autodrive.ts');
    const driver = auto.createAutoDriver(sub);
    window.__leak = { stopped: false };
    game.input.update = () => (window.__leak.stopped
      ? { steer: 0, throttle: 0, brake: 1, handbrake: 1, reverse: 0, shiftUp: false,
        shiftDown: false }
      : { ...driver.drive(game.car), reverse: 0, shiftUp: false, shiftDown: false });
  }, at);
  await page.evaluate((zoom) => window.__game.renderer.debugZoom(zoom), ZOOM);
  for (let stop = 0; stop < STOPS; stop++) {
    // (on again at the speed it was stopped at)
    await page.evaluate(() => {
      const car = window.__game.car, leak = window.__leak;
      if (leak.vx !== undefined) Object.assign(car, { vx: leak.vx, vy: leak.vy, heading: leak.heading });
      leak.stopped = false;
    });
    await page.waitForTimeout(STEP_S * 1000);
    // (env TURN=radians: the stopped car turned by that much - its beam at the tunnel's side)
    const state = await page.evaluate((turn) => {
      const car = window.__game.car;
      window.__leak.heading = car.heading;
      car.heading += turn;
      Object.assign(window.__leak, { stopped: true, vx: car.vx, vy: car.vy });
      car.vx = 0;
      car.vy = 0;
      car.lightsOn = false;
      return { crossing: car.crossing, at: [+car.x.toFixed(1), +car.y.toFixed(1)] };
    }, +(process.env.TURN || 0));
    await page.waitForTimeout(700);
    const off = await page.screenshot();
    await page.evaluate(() => { window.__game.car.lightsOn = true; });
    await page.waitForTimeout(400);
    const on = await page.screenshot();
    const result = await page.evaluate(async ([offB64, onB64]) => {
      const load = async (b64) => {
        const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`))
          .blob());
        const canvas = new OffscreenCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        return ctx.getImageData(0, 0, image.width, image.height);
      };
      const [dark, lit] = [await load(offB64), await load(onB64)];
      const out = new ImageData(dark.width, dark.height);
      let changed = 0;
      for (let i = 0; i < dark.data.length; i += 4) {
        const gain = Math.max(0, lit.data[i] - dark.data[i], lit.data[i + 1] - dark.data[i + 1],
          lit.data[i + 2] - dark.data[i + 2]);
        if (gain > 3) changed++;
        // the dark photo, dimmed, with the light the car added in bright yellow over it
        out.data[i] = Math.min(255, dark.data[i] * 0.5 + gain * 8);
        out.data[i + 1] = Math.min(255, dark.data[i + 1] * 0.5 + gain * 8);
        out.data[i + 2] = dark.data[i + 2] * 0.5;
        out.data[i + 3] = 255;
      }
      const canvas = new OffscreenCanvas(dark.width, dark.height);
      canvas.getContext('2d').putImageData(out, 0, 0);
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return { diff: btoa(binary), changed };
    }, [off.toString('base64'), on.toString('base64')]);
    fs.writeFileSync(`tools/scratch/_leak-${stop}-off.png`, off);
    fs.writeFileSync(`tools/scratch/_leak-${stop}-on.png`, on);
    fs.writeFileSync(`tools/scratch/_leak-${stop}-diff.png`, Buffer.from(result.diff, 'base64'));
    console.log(`stop ${stop}`, JSON.stringify(state), `lit px ${result.changed}`);
  }
  console.log(errors.length ? `ERRORS ${errors.slice(0, 5).join(' | ')}` : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
