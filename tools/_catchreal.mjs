// scratch (2026-10-06, user: "catch them timer never seems to time out it fails to count down"): a real headless race with traffic -
// 5 AI at Real (d4) against a "player" that cruises at CRUISE km/h in its lane (not trying), on a phone-ish +-VIEW m screen. Logs the
// countdown every second and how often it resets / holds, and whether it ends. node tools/_catchreal.mjs [srcDir] [cruise km/h] [seed] [view]
const SRC = process.argv[2] || '../src', CRUISE = +(process.argv[3] || 100) / 3.6, SEED = +(process.argv[4] || 4242), VIEW = +(process.argv[5] || 75);
const { makeCar, step, reset, DT } = await import(SRC + '/vehicle.ts'), L = await import(SRC + '/lab.js'), H = await import(SRC + '/highway.js');
// the levels importing these modules used to add (task 078 made it explicit)
H.addHighwayLevel();
const { createTraffic } = await import(SRC + '/traffic.ts'), { aiTraits } = await import(SRC + '/ai/traits.ts'), { createAIDriver } = await import(SRC + '/ai/circuit.ts');
const { createHwFlow, hwFrames, hwGrid, hwGridSpan, HW_GREEN } = await import(SRC + '/highwayrace.ts');
let r = 777; const rnd = () => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);
const lv = H.createHighway(SEED, 'motorway'); lv.id = 'cr'; L.LEVELS.push(lv); L.setLevel(lv.id);
const N = 6, cars = [], drv = [];
for (let k = 0; k < N; k++) { const c = makeCar('saloon-rwd'); c.num = k + 1; c.absOn = c.tcsOn = true; const g = hwGrid(lv, k); reset(c, g.x, g.y, g.h); cars.push(c); drv.push(createAIDriver(lv, aiTraits(4, k, N, 99))); }
const me = cars[N - 1]; H.stepHighway(lv, me);
const tr = createTraffic({ rnd }); tr.reset(lv, 1); const [gA, gB] = hwGridSpan(lv, N); tr.clearSpan(gA, gB);
const vis = (c) => c._hwf && me._hwf && Math.abs(c._hwf.s - me._hwf.s) < VIEW;
const flow = createHwFlow({ lv, cars: cars.map((c) => ({ car: c, player: c === me })), visible: vis });
let t = 0, resets = 0, prevKind = null, prevCd = null, line = [], holdT = 0, cdT = 0;
while (t < 120 && flow.state !== 'done') {
  hwFrames(lv, [...cars, ...tr.cars]);
  const green = t >= HW_GREEN;
  for (let k = 0; k < N; k++) { const c = cars[k], others = [...cars.filter((o) => o !== c), ...tr.cars];
    let w = drv[k].drive(c, DT, { cars: others, hold: !green });
    if (c === me && green) { const v = Math.hypot(c.vx, c.vy); w = { ...w, throttle: v < CRUISE ? Math.min(w.throttle, 0.6) : 0, brake: v > CRUISE + 1 ? 0.2 : w.brake }; }
    if (!green) { const v = Math.hypot(c.vx, c.vy); w = { ...w, throttle: v > 16 ? 0 : Math.min(w.throttle, 0.55), brake: Math.max(w.brake, v > 18 ? 0.25 : 0) }; }
    L.barrierClamp(c); L.solidClamp(c); L.applyGround(c, DT); step(c, w, DT); }
  const ds = H.stepHighway(lv, me); if (ds) for (const c of [...cars, ...tr.cars]) if (c._hwf) c._hwf.s -= ds;
  tr.step(DT, { player: me, others: cars.filter((c) => c !== me), visible: vis });
  if (green) { flow.step(DT);
    if (flow.cdKind === 'ahead') { cdT += DT; if (flow.cdHold) holdT += DT; if (prevKind === 'ahead' && flow.cd > prevCd + 0.5) resets++; }
    if (flow.cdKind !== prevKind && prevKind === 'ahead') resets++;
    prevKind = flow.cdKind; prevCd = flow.cd; }
  if (Math.abs(t - Math.round(t)) < DT / 2 && Math.round(t) % 2 === 0 && green) { const top = cars.filter((c) => c !== me).reduce((a, c) => (c._hwf.s < a._hwf.s ? c : a)); line.push(`${Math.round(t)}s:${flow.cdKind ? flow.cdKind[0] + (flow.cdHold ? 'H' : '') + flow.cd.toFixed(1) : '-'}(gap ${(top._hwf.s - me._hwf.s).toFixed(0)})`); }
  t += DT;
}
console.log(line.join(' '));
console.log(`cruise ${(CRUISE * 3.6).toFixed(0)} km/h seed ${SEED} view ${VIEW}: ${flow.state === 'done' ? 'ENDED at ' + flow.endT.toFixed(1) + ' s' : 'NOT ENDED in 120 s'} | countdown ran ${cdT.toFixed(1)} s, held ${holdT.toFixed(1)} s, reset/cancelled ${resets}x`);
