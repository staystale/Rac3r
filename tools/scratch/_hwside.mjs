// _hwside.mjs - THE HIGHWAY ROLLING START, SIDEWAYS (owner 11-21 bug on the round174 link: "they
// all seem to drift to one side and then kinda all weave back over together"), measure only: the
// real game, seeded, nothing drawn, your car on ?autopilot, the motorway race (5 AI). Every 0.5 s
// from the launch to the green + 10 s, each racer's place across the road (its road frame, car._hwf
// off, m), its driver's lane (state.laneLat), its dodge and gap-picker line (state.dodge,
// gapBase), whether the start holds it; then the FIELD'S MEAN across and its spread, and each
// racer's lane changes. The switches through RAC3R_QUERY. SEED=1 SECONDS=16
// node tools/scratch/_hwside.mjs
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const SEED = Number(process.env.SEED || 1), SECONDS = Number(process.env.SECONDS || 16);
const ROAD = process.env.ROAD || 'motorway';
const SKIP = '&skip=world,ground,car&autopilot=1' + extraQuery();

/** Page side: one sample of every racer. */
function sampleHw() {
  const game = window.__game;
  return { t: game.start.t, green: game.start.green, cars: game.ai.map((entry) => {
    const state = entry.drv.state, frame = entry.car._hwf;
    return { off: frame ? frame.off : null, lane: state.laneLat ?? null, dodge: state.dodge ?? 0,
      gap: state.gapBase ?? null, held: state.heldT === state.t,
      v: Math.hypot(entry.car.vx, entry.car.vy) };
  }) };
}

const server = await startServer();
const browser = await launchBrowser();
try {
  const errors = [];
  const page = await openPage(browser, server.url, 'highway', errors, SKIP);
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((value) => window.__rt.seed(value), SEED);
  await page.evaluate(launchLevel, ['highway', { car: 'hatch-rwd', ai: 5, traffic: 1.5, road: ROAD }]);
  await page.waitForTimeout(SETTLE_MS);
  const samples = [];
  for (let frames = 0; frames < SECONDS * 60; frames += 30) {
    await page.evaluate(() => window.__rt.step(30));
    samples.push(await page.evaluate(`(${sampleHw.toString()})()`));
  }
  const greenAt = samples.find((sample) => sample.green)?.t;
  console.log(`${ROAD} seed ${SEED} ${process.env.RAC3R_QUERY || '(all off)'}: green at`
    + ` ${greenAt?.toFixed(1)} s`);
  console.log('  t s | field mean across m (spread) | each racer: across m / lane m / dodge m'
    + ' / picked line m (H = held)');
  for (const sample of samples) {
    const offs = sample.cars.map((car) => car.off).filter((off) => off != null);
    const mean = offs.reduce((sum, off) => sum + off, 0) / Math.max(1, offs.length);
    const spread = offs.length ? Math.max(...offs) - Math.min(...offs) : 0;
    console.log(`  ${sample.t.toFixed(1).padStart(5)}${sample.green ? 'G' : ' '} | ${mean.toFixed(2)
      .padStart(6)} (${spread.toFixed(1)}) | ${sample.cars.map((car) => `${car.off == null ? '-'
      : car.off.toFixed(1)}/${car.lane == null ? '-' : car.lane.toFixed(1)}/${car.dodge.toFixed(1)}/`
      + `${car.gap == null ? '-' : car.gap.toFixed(1)}${car.held ? 'H' : ''}`).join('  ')}`);
  }
  if (errors.length) console.log('  ERR ' + errors[0]);
} finally {
  await browser.close();
  server.stop();
}
