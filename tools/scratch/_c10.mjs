// _c10.mjs - C10 open wheels measured in the game's own collision code (contact.js carContacts,
// world/barriers.ts barrierClamp / solidClamp, damage.ts hit), two F1s (vehicle.ts makeCar
// 'track-rwd') placed by hand and moved at 120 Hz without their engines - switch off vs on:
//  A side by side, one drifting into the other at 1.5 m/s: the closest the centres got
//  B behind, the follower's left front wheel into the leader's right rear (bodies 1.85 m apart)
//  C along Castle Cum's longest armco, drifting into it at 2 m/s: the closest the centre got
//  D a tree trunk 1.2 m off the centre line: only the left front wheel meets it - 20 tries at
//    30 / 40 / 60 / 80 km/h, wheels ripped off
// node tools/scratch/_c10.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1`);
  await page.evaluate(() => window.__game.launch('castle-cum', 'track-rwd',
    { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }));
  await page.waitForTimeout(2500);
  for (const on of [false, true]) {
    const res = await page.evaluate(async (isOn) => {
      window.__game.paused = true;
      const ow = await import('/src/physics/openwheel.ts'), { makeCar } = await import('/src/vehicle.ts');
      const { carContacts } = await import('/src/contact.js');
      const bar = await import('/src/world/barriers.ts'), { hit } = await import('/src/damage.ts');
      const { LEVEL } = await import('/src/world/state.ts');
      ow.setOpenWheel(isOn);
      const DT = 1 / 120;
      const fresh = (x, y, heading, vx, vy) => Object.assign(makeCar('track-rwd'),
        { x, y, heading, vx, vy, yawRate: 0 });
      const move = (car) => { car.x += car.vx * DT; car.y += car.vy * DT; car.heading += car.yawRate * DT; };
      // A: side by side
      let near = 9;
      {
        const first = fresh(0, 0, 0, 30, 1.5), second = fresh(0, 2.6, 0, 30, 0);
        for (let step = 0; step < 240; step++) {
          move(first); move(second);
          carContacts([first, second]);
          near = Math.min(near, Math.hypot(second.x - first.x, second.y - first.y));
        }
      }
      // B: wheel to wheel from behind (the follower 5 m/s faster, its left front on the
      // leader's right rear)
      let kick = null;
      {
        const leader = fresh(0, 0, 0, 30, 0), follower = fresh(-4.6, -1.85, 0, 35, 0);
        for (let step = 0; step < 120; step++) {
          move(leader); move(follower);
          carContacts([leader, follower]);
        }
        kick = { followerYaw: follower.yawRate.toFixed(2), leaderYaw: leader.yawRate.toFixed(2),
          followerKmh: (Math.hypot(follower.vx, follower.vy) * 3.6).toFixed(0),
          leaderKmh: (Math.hypot(leader.vx, leader.vy) * 3.6).toFixed(0),
          gapY: (leader.y - follower.y).toFixed(2) };
      }
      // C: drifting into the armco
      let wall = 9;
      {
        const rail = LEVEL.barriers.filter((item) => item.kind === 'armco')
          .sort((a, b) => b.pts.length - a.pts.length)[0];
        const mid = Math.floor(rail.pts.length / 2), [ax, ay] = rail.pts[mid], [bx, by] = rail.pts[mid + 1];
        const len = Math.hypot(bx - ax, by - ay), tx = (bx - ax) / len, ty = (by - ay) / len;
        const nx = -ty, ny = tx;
        const car = fresh(ax + nx * 2.2, ay + ny * 2.2, Math.atan2(ty, tx), tx * 5 - nx * 2, ty * 5 - ny * 2);
        for (let step = 0; step < 180; step++) {
          move(car);
          bar.barrierClamp(car);
          wall = Math.min(wall, (car.x - ax) * nx + (car.y - ay) * ny);
        }
        bar.resetTrackside();
      }
      // D: a wheel into a tree trunk
      const rips = {};
      {
        const tree = LEVEL.solids.find((solid) => solid.kind === 'tree' && LEVEL.solids.every((other) =>
          other === solid || Math.hypot(other.x - solid.x, other.y - solid.y) > 12));
        for (const kmh of [30, 40, 60, 80]) {
          let ripped = 0, touched = 0;
          for (let trial = 0; trial < 20; trial++) {
            const speed = kmh / 3.6, car = fresh(tree.x - 5, tree.y - 1.2, 0, speed, 0);
            for (let step = 0; step < 90; step++) {
              const vx0 = car.vx, vy0 = car.vy;
              move(car);
              bar.solidClamp(car);
              hit(car, vx0, vy0);
            }
            if (Math.abs(car.vx - speed) > 0.5) touched++;
            if (car.wheelOff && car.wheelOff.some(Boolean)) ripped++;
          }
          rips[kmh + ' km/h'] = `${touched} touched, ${ripped} ripped`;
        }
      }
      window.__game.paused = false;
      return { sideBySide: near.toFixed(2) + ' m', kick, wall: wall.toFixed(2) + ' m', rips };
    }, on);
    console.log(on ? 'ON ' : 'OFF', JSON.stringify(res));
  }
} finally {
  await browser.close();
  server.stop();
}
