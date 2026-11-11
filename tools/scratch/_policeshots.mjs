// _policeshots.mjs - POLICE ON THE HIGHWAYS (?police=1) photographed in the real game: the
// autopilot down the motorway with traffic; the heat set to 1 star (a chaser sent) - a photo once
// it is close (its light bar going, the HUD's 1 star); 3 stars - a photo with the chasers round
// you; then the autopilot off and the handbrake on - a photo of the BUSTED card. A cruising or
// waiting police car's unlit bar is photographed when one is met first (UNLIT=1 waits for one).
// [VIEW=844x390] [NIGHT=0.9] [ROAD=motorway] [UNLIT=1] [ONLY_UNLIT=1] node tools/scratch/_policeshots.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [width, height] = (process.env.VIEW || '844x390').split('x').map(Number);
const ROAD = process.env.ROAD || 'motorway', NIGHT = process.env.NIGHT || '';
const tag = `${width}x${height}${NIGHT ? '-night' : '-day'}`;
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
const shot = async (page, name) => {
  const path = `tools/scratch/_police-${name}-${tag}.png`;
  await page.screenshot({ path });
  console.log('photo', path);
};
// the heat held at a number of stars (no escape while photographing)
const holdStars = (page, stars) => page.evaluate((want) => {
  window.__holdStars = want;
  if (window.__holder) return;
  window.__holder = setInterval(() => {
    const heat = window.__game.traffic.police().heat;
    if (!heat || window.__holdStars == null || window.__game.busted) return;
    heat.stars = Math.max(heat.stars, window.__holdStars);
    heat.escapeT = 0;
  }, 50);
}, stars);
// the chasers' distances from you, m
const chaserGaps = (page) => page.evaluate(() => {
  const game = window.__game, car = game.car;
  return game.traffic.list.filter((slot) => !slot.parked && slot.police?.mode === 'chase')
    .map((slot) => Math.round(Math.hypot(slot.car.x - car.x, slot.car.y - car.y)));
});
try {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
    + `&police=1${NIGHT ? '&night=' + NIGHT : ''}`);
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(800);
  await page.evaluate(([road]) => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, road, scenery: 'countryside', traffic: 0.6 }), [ROAD]);
  await page.waitForTimeout(5000);
  if (process.env.UNLIT) {
    // (no heat meanwhile: the autopilot's own offences would set the bars going)
    await holdStars(page, 0);
    await page.evaluate(() => {
      window.__unlit = setInterval(() => {
        const heat = window.__game.traffic.police().heat;
        if (heat) heat.stars = 0;
      }, 20);
    });
    for (let waited = 0; waited < 900; waited++) {
      // a police car not chasing 12-40 m ahead of you (on screen)
      const near = await page.evaluate(() => {
        const game = window.__game, car = game.car;
        const slot = game.traffic.list.find((each) => {
          const dx = each.car.x - car.x, dy = each.car.y - car.y, gap = Math.hypot(dx, dy);
          return !each.parked && each.police && each.police.mode !== 'chase' && gap > 12
            && gap < 40 && dx * car.vx + dy * car.vy > 0;
        });
        return slot ? slot.police.mode : null;
      });
      if (near) {
        await shot(page, `unlit-${near}`);
        break;
      }
      await page.waitForTimeout(200);
    }
    await page.evaluate(() => clearInterval(window.__unlit));
  }
  if (process.env.ONLY_UNLIT) throw new Error('ONLY_UNLIT: stopped after the unlit photo');
  await holdStars(page, 1);
  for (let waited = 0; waited < 60; waited++) {
    const gaps = await chaserGaps(page);
    if (gaps.some((gap) => gap < 9)) break;
    await page.waitForTimeout(500);
  }
  console.log('1 star: chasers at', await chaserGaps(page), 'm');
  await shot(page, 'chase1');
  await holdStars(page, 3);
  for (let waited = 0; waited < 80; waited++) {
    const gaps = await chaserGaps(page);
    if (gaps.length >= 3 && gaps.filter((gap) => gap < 30).length >= 2) break;
    await page.waitForTimeout(500);
  }
  console.log('3 stars: chasers at', await chaserGaps(page), 'm');
  await shot(page, 'chase3');
  // stopped: the autopilot off, the handbrake on, until the bust
  await page.evaluate(() => window.__game.setAutopilot(false));
  await page.keyboard.down('Space');
  let busted = null;
  for (let waited = 0; waited < 90 && !busted; waited++) {
    await page.waitForTimeout(500);
    busted = await page.evaluate(() => window.__game.busted || null);
  }
  await page.keyboard.up('Space');
  console.log('busted:', JSON.stringify(busted));
  await page.waitForTimeout(500);
  await shot(page, 'busted');
  const after = await page.evaluate(() => ({ stars: window.__game.heat?.stars,
    police: window.__game.traffic.list.filter((slot) => !slot.parked && slot.police).length }));
  console.log('after the bust:', JSON.stringify(after));
} finally {
  await browser.close();
  server.stop();
  console.log(errors.length ? 'PAGE ERRORS:\n  ' + errors.join('\n  ') : 'no page errors');
}
