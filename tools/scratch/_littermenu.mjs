// _littermenu.mjs - THE LITTER SLIDER THROUGH THE MENU (owner 11-10: "It doesn't seem the litter
// slider affects the amount on both highways and Death Valley", "The slider should affect the
// amount of junk cactus / cow skulls and barrels and stuff / And normal junk for country side"):
// TEST MODE > ENDLESS ROADS > the theme (THEMES) > the road (ROAD), the LITTER slider set to each of
// LITTERS, LAUNCH; then the level's litter, the loose objects in the game (by kind) and the
// roadside props of the desert's kinds, within NEAR m of the car along the road, a phone page.
// [THEMES=COUNTRYSIDE,DEAF VALLEY] [LITTERS=0,1,3] [ROAD=SINGLE LANE] [SHOT=1] [DRIVE=s] [Q=] node tools/scratch/_littermenu.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const THEMES = (process.env.THEMES || 'COUNTRYSIDE,DEAF VALLEY').split(',');
const LITTERS = (process.env.LITTERS || '0,1,3').split(',').map(Number), NEAR = 400;
const ROAD = process.env.ROAD || 'SINGLE LANE';
const PROPS = ['skull', 'cactus', 'barrelcactus', 'wreck', 'shack', 'crate', 'barrel', 'tyre',
  'tyrestack', 'pallet'];
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
try {
  for (const theme of THEMES) for (const litter of LITTERS) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0&rules=0&noaudio=1${process.env.Q || ''}`);
    await page.waitForTimeout(1500);
    const tap = async (text) => {
      await page.locator('#menu button', { hasText: text }).first().tap();
      await page.waitForTimeout(700);
    };
    await tap('TEST MODE');
    await tap('ENDLESS ROADS');
    await tap(theme);
    await tap(ROAD);
    const label = await page.evaluate((value) => {
      for (const input of document.querySelectorAll('#menu input[type=range]')) {
        const text = input.parentElement.textContent;
        if (!/LITTER/.test(text)) continue;
        input.value = String(value);
        input.dispatchEvent(new Event('input'));
        return input.parentElement.textContent.trim();
      }
      return 'no LITTER slider';
    }, litter);
    await tap('LAUNCH');
    await page.waitForTimeout(3500);
    // (SHOT=1: a phone photo of each)
    // (DRIVE=s: driven on that long first - with Q=&autopilot=1)
    if (process.env.DRIVE) await page.waitForTimeout(+process.env.DRIVE * 1000);
    if (process.env.SHOT) await page.screenshot({ path: `tools/scratch/_littermenu-${theme.replace(/ /g, '')}-${litter}.png` });
    const got = await page.evaluate(([near, props]) => {
      const game = window.__game, car = game.car, level = game.level;
      const close = (obj) => Math.hypot(obj.x - car.x, obj.y - car.y) < near;
      const loose = {}, still = {};
      for (const obj of game.cones.list) if (close(obj)) loose[obj.kind] = (loose[obj.kind] || 0) + 1;
      for (const obj of level.props || []) if (props.includes(obj.kind) && close(obj))
        still[obj.kind] = (still[obj.kind] || 0) + 1;
      const sum = (rec) => Object.values(rec).reduce((all, count) => all + count, 0);
      return { litter: level.litter, road: level.roadType, loose: sum(loose), looseKinds: loose,
        props: sum(still), propKinds: still };
    }, [NEAR, PROPS]);
    console.log(`${theme} ${got.road}, slider "${label}" -> level.litter ${got.litter}: loose`
      + ` ${got.loose} ${JSON.stringify(got.looseKinds)}; props ${got.props}`
      + ` ${JSON.stringify(got.propKinds)}`);
    await context.close();
  }
} finally {
  console.log('page errors:', errors.length ? errors.join(' || ') : 'none');
  await browser.close();
  server.stop();
}
