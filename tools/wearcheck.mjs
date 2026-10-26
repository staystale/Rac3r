// wearcheck.mjs - proves the GROUND WEAR rules as they are today (the owner's rules, NOTES.md) by
// running the game's own pass rule (world/wear.ts recordWearAt: one tyre pass over a wear cell)
// on real ground of the Lab and the Sandbox, with the weather's temperature and dampness set.
// Rewritten 2026-10-26: the 10-03 version checked rules the owner has since changed (snow packing
// to ice at pass 4, puddles only going with hot tyres, mud thickening dry) and read the surface
// art from a table that had moved, so it failed 13-14 checks on a correct game.
//
//   node tools/wearcheck.mjs        exit code 1 on any failure
//
// 1. the grass chain by passes: bush -> long grass (3), long -> short grass (2), -> dirt (2)
// 2. worn dirt (2 passes) by the track's heat and dampness: mud / gravel / stays dirt
// 3. mud thickens only damp; dry mud holds
// 4. loose ground: dry gravel -> sand (more the hotter), damp sand -> gravel, damp gravel -> dirt
// 5. snow (4 passes) packs, ices or melts by the temperature; never before pass 4
// 6. packed snow (4 passes) -> mostly ice when cold, else loose snow, a little water
// 7. ice: rolling passes may break it to water (more the warmer); a locked slide scrubs it through
//    in 2-4 passes to meltwater - driven with the real car over the Lab's ice sheet
// 8. standing water: 3 passes of any tyre clear it on hard ground (2 hot, 1 on rain tyres); on
//    soft ground it churns in (grass / dirt -> mud, sand -> gravel, gravel -> dirt); some is
//    dragged a cell or two ahead (waterdrag.ts)
// 9. damp ground (not standing water): a dry line forms in ~17 cold passes, ~3 hot ones
// 10. grip: a puddle and oil are slipperier than the ground under them
// 11. coverage: every surface has art (render/ground/art.ts makeSurfaceArt)
// Shares measured over many cells are checked against the rule's own numbers +- a margin.
import { makeCar, step, reset, PHYSICS_STEP_SECONDS, setAidsDefault } from '../src/vehicle.ts';
import * as L from '../src/lab.js';
import { WEATHER, setWetness, setRain, startWeather } from '../src/world/weather.ts';
import { dirtToMudChance, dirtToGravelChance, gravelToSandChance } from '../src/world/dig.ts';
import { setPassTyre } from '../src/world/puddles.ts';
import { notePass } from '../src/world/pass.ts';
import { makeSurfaceArt } from '../src/render/ground/art.ts';

// RAW physics: driver aids OFF (with ABS on, a locked pass cannot lock)
setAidsDefault(false);
const fails = [];
const check = (ok, msg) => {
  console.log((ok ? '  ok   ' : '  FAIL ') + msg);
  if (!ok) fails.push(msg);
};
const near = (got, want, margin) => Math.abs(got - want) <= margin;
const pct = (share) => `${(share * 100).toFixed(0)} %`;

// the weather: an event's weather running (snow and ice feel the track's temperature), dry,
// at the temperature each check sets
startWeather({ mode: 'dry', season: 2, seed: 1 });
const setTrackC = (tempC) => { WEATHER.trackC = tempC; WEATHER.tempC = tempC; };
const setDamp = (wetness) => { setWetness(wetness); setRain(0); };
setTrackC(20);
setDamp(0);
// the pass's wheel: moving +x (water dragged ahead goes +x)
const wheel = { vx: 1, vy: 0 };

let clockMs = 0;
/** One tyre pass at a point, half a second after the last (past the pass debounce). */
const pass = (x, y, tyreC = 18) => {
  notePass(wheel, 0, 0.3, 0);
  return L.recordWearAt(x, y, null, (clockMs += 500), tyreC);
};
/**
 * The middle of a wear cell on the level whose own ground (its base, no cover) is this surface,
 * scanning a grid - the wear cell's base, not the drawn surface (a long-grass tuft drawn by the
 * blend is plain grass to the wear rules).
 */
function findGround(id) {
  for (let gx = -260; gx < 260; gx += L.WEAR_CELL) {
    for (let gy = -260; gy < 260; gy += L.WEAR_CELL) {
      const cell = freshCell(gx, gy);
      if (cell && cell.base === id && !cell.cover && !cell.fixed) {
        return [(cell.cx + 0.5) * L.WEAR_CELL, (cell.cy + 0.5) * L.WEAR_CELL];
      }
    }
  }
  return null;
}
/** The middle of a wear cell on the level with this cover (the level's own, as it lays it). */
function findCover(id) {
  for (let gx = -260; gx < 260; gx += L.WEAR_CELL) {
    for (let gy = -260; gy < 260; gy += L.WEAR_CELL) {
      const cell = freshCell(gx, gy);
      if (cell && cell.cover === id) {
        return [(cell.cx + 0.5) * L.WEAR_CELL, (cell.cy + 0.5) * L.WEAR_CELL];
      }
    }
  }
  return null;
}
/** A fresh wear cell at a point (the wear map cleared first), made even on hard ground. */
function freshCell(x, y) {
  L.clearWear();
  return L.getCell(Math.floor(x / L.WEAR_CELL), Math.floor(y / L.WEAR_CELL), true);
}
/** Lays a cover on a fresh cell at a point. */
function covered(x, y, cover, standing = true) {
  const cell = freshCell(x, y);
  Object.assign(cell, { cover, standing, dry: 0, passes: 0, scrub: 0, current: cover });
  return cell;
}
/** Shares of what a cell is after n passes, over many fresh cells. */
function outcomes(x, y, passes, trials, setUp, tyreC = 18) {
  const tally = {};
  for (let k = 0; k < trials; k++) {
    if (setUp) setUp(); else freshCell(x, y);
    let now = null;
    for (let i = 0; i < passes; i++) now = pass(x, y, tyreC);
    tally[now] = (tally[now] || 0) + 1 / trials;
  }
  return tally;
}
const show = (tally) => Object.entries(tally).map(([id, share]) => `${id} ${pct(share)}`).join(', ');

// ---- 1. the grass chain
L.setLevel('lab');
{
  const at = findGround('grassLong');
  freshCell(...at);
  const seq = [];
  for (let i = 0; i < 4; i++) seq.push(pass(...at));
  console.log('1. long grass, after each pass:', seq.join(' > '));
  check(seq[0] === 'grassLong' && seq[1] === 'grassShort' && seq[3] === 'dirt',
    'long grass -> short grass at pass 2 -> dirt at pass 4 (dry)');
}
L.setLevel('sandbox');
{
  const at = findGround('bush');
  if (!at) check(false, 'a bush on the Sandbox to test');
  else {
    freshCell(...at);
    const seq = [];
    for (let i = 0; i < 3; i++) seq.push(pass(...at));
    console.log('1b. bush, after each pass:', seq.join(' > '));
    check(seq[1] === 'bush' && seq[2] === 'grassLong', 'a bush is flattened to long grass at pass 3');
  }
}

// ---- 2. worn dirt
{
  const at = findGround('dirt');
  for (const [tempC, wetness] of [[10, 0], [20, 0], [40, 0], [20, 1]]) {
    setTrackC(tempC);
    setDamp(wetness);
    const need = wetness ? 1 : 2;
    const tally = outcomes(...at, need, 600);
    const mud = dirtToMudChance(wetness ? 1 : 0, tempC), gravel = dirtToGravelChance(wetness ? 1 : 0, tempC);
    console.log(`2. dirt, ${need} ${wetness ? 'damp' : 'dry'} pass(es) at ${tempC} C: ${show(tally)}`
      + ` (rule: mud ${pct(mud)}, gravel ${pct(gravel)})`);
    check(near(tally.mud || 0, mud, 0.06) && near(tally.gravel || 0, gravel, 0.05),
      `worn dirt at ${tempC} C ${wetness ? 'damp' : 'dry'}: mud / gravel / dirt by the rule`);
  }
  setTrackC(20);
  setDamp(0);
}

// ---- 3. mud
{
  const at = findGround('mud') || findGround('dirt');
  const mudCell = () => { const cell = freshCell(...at); cell.base = 'mud'; cell.current = 'mud'; };
  const dry = outcomes(...at, 10, 50, mudCell);
  setDamp(1);
  const damp = outcomes(...at, 2, 50, mudCell);
  setDamp(0);
  console.log(`3. mud: 10 dry passes -> ${show(dry)}; 2 damp passes -> ${show(damp)}`);
  check((dry.mud || 0) > 0.99, 'dry mud never thickens');
  check((damp.thickMud || 0) > 0.99, 'damp mud thickens at pass 2');
}

// ---- 4. loose ground (one pass each, many cells)
{
  const sand = findGround('sand'), gravel = findGround('gravel');
  for (const tempC of [15, 40]) {
    setTrackC(tempC);
    const tally = outcomes(...gravel, 1, 3000);
    console.log(`4. dry gravel, 1 pass at ${tempC} C: ${show(tally)} (rule: sand ${pct(gravelToSandChance(tempC))})`);
    check(near(tally.sand || 0, gravelToSandChance(tempC), 0.015), `dry gravel -> sand by the heat (${tempC} C)`);
  }
  setTrackC(20);
  const drySand = outcomes(...sand, 5, 200);
  check((drySand.sand || 0) > 0.99, 'dry sand stays sand');
  setDamp(1);
  const dampSand = outcomes(...sand, 1, 3000), dampGravel = outcomes(...gravel, 1, 3000);
  setDamp(0);
  console.log(`4b. damp, 1 pass: sand -> ${show(dampSand)}; gravel -> ${show(dampGravel)}`);
  check(near(dampSand.gravel || 0, 0.1, 0.02) && near(dampGravel.dirt || 0, 0.1, 0.02),
    'damp sand -> gravel and damp gravel -> dirt, 10 % a pass');
}

// ---- 5. snow (a snow cover laid on the Lab's grass)
L.setLevel('lab');
{
  const at = findGround('grass');
  const snowCell = () => covered(...at, 'snow');
  snowCell();
  const held = [];
  for (let i = 0; i < 3; i++) held.push(pass(...at));
  check(held.every((id) => id === 'snow'), 'snow holds 3 passes');
  for (const [tempC, water, ice] of [[-10, 0.05, 0.45], [0, 0.15, 0.15], [3, 0.45, 0.06]]) {
    setTrackC(tempC);
    const tally = outcomes(...at, 4, 1000, snowCell);
    console.log(`5. snow, 4 passes at ${tempC} C: ${show(tally)} (rule: water ${pct(water)}, ice ${pct(ice)})`);
    check(near(tally.wet || 0, water, 0.05) && near(tally.ice || 0, ice, 0.05)
      && near(tally.packedSnow || 0, 1 - water - ice, 0.06), `snow at ${tempC} C packs / ices / melts by the rule`);
  }
  setTrackC(20);
}

// ---- 6. packed snow (a packed-snow cover on grass)
{
  const at = findGround('grass');
  setTrackC(-5);
  // water 5 % - 8 % x 5 C -> the 3 % floor; ice of the rest 55 % + 3 % x 5 = 70 %
  const tally = outcomes(...at, 4, 1000, () => covered(...at, 'packedSnow'));
  console.log(`6. packed snow, 4 passes at -5 C: ${show(tally)} (rule: water 3 %, ice ${pct(0.97 * 0.7)})`);
  check(near(tally.wet || 0, 0.03, 0.025) && near(tally.ice || 0, 0.97 * 0.7, 0.05)
    && near(tally.snow || 0, 0.97 * 0.3, 0.05), 'packed snow breaks to ice / loose snow / a little water');
  setTrackC(20);
}

// ---- 7. ice: after 4 rolling passes a chance it breaks to water by the heat (-5 C 2 %, 0 C 10 %,
// 3 C 34 %); passes CRACK it too (icecrack.ts) and cracked ice breaks sooner and twice as often;
// the water left then churns into the grass or the tyres take it
{
  const at = findGround('grass');
  const broke = {};
  for (const [tempC, water] of [[-5, 0.02], [0, 0.1], [3, 0.34]]) {
    setTrackC(tempC);
    const tally = outcomes(...at, 4, 1000, () => covered(...at, 'ice'));
    broke[tempC] = 1 - (tally.ice || 0);
    console.log(`7. ice, 4 rolling passes at ${tempC} C: ${show(tally)} - ${pct(broke[tempC])} broken`
      + ` through (rule: ${pct(water)} at pass 4 uncracked, up to x2 cracked)`);
    check(broke[tempC] >= water - 0.03 && broke[tempC] <= Math.min(1, water * 2 + 0.05),
      `rolling over ice breaks it through by the heat (${tempC} C)`);
  }
  check(broke[-5] < broke[0] && broke[0] < broke[3], '... more the warmer');
  setTrackC(20);
}
// the real car over the Lab's ice sheet
L.setLevel('lab');
{
  // the Lab has several ice panels: drive along the row (1 m grid) with the longest unbroken run
  let best = null;
  for (let gy = -260; gy < 260; gy++) {
    let runFrom = null;
    for (let gx = -262; gx < 262; gx++) {
      const isIce = L.groundAt(gx, gy + 0.5).surface.id === 'ice';
      if (isIce && runFrom === null) runFrom = gx;
      if (!isIce && runFrom !== null) {
        if (!best || gx - runFrom > best.to - best.from) best = { y: gy + 0.5, from: runFrom, to: gx };
        runFrom = null;
      }
    }
  }
  if (!best || best.to - best.from < 20) check(false, 'the Lab has an ice sheet to drive (20 m+)');
  else {
    console.log(`7b. the Lab's ice: ${best.to - best.from} m along y ${best.y}`);
    const ice = [best.from, best.y];
    const iceY = ice[1], startX = ice[0] - 20;
    const drive = (brakeFrom) => {
      const car = makeCar('hatch-rwd');
      reset(car, startX, iceY, 0);
      car.vx = 16;
      for (let i = 0; i < 120 * 8 && car.x < best.to + 10; i++) {
        L.applyGround(car, PHYSICS_STEP_SECONDS);
        step(car, { throttle: 0, brake: brakeFrom !== null && car.x > brakeFrom ? 1 : 0, steer: 0 },
          PHYSICS_STEP_SECONDS);
      }
    };
    L.clearWear();
    setTrackC(-5);
    // the Lab's ice is a cover-field area: a cell made on it records the ice it was laid with
    const iceCells = () => [...L.wearMap.values()].filter((cell) => cell.laid === 'ice');
    const through = () => iceCells().filter((cell) => cell.cover !== 'ice');
    for (let n = 0; n < 3; n++) drive(null);
    const rolled = iceCells().length, rollThrough = through().length;
    console.log(`7b. 3 rolling passes over the Lab ice at -5 C: ${rolled} ice cells, ${rollThrough} through`);
    check(rolled > 0 && rollThrough <= rolled * 0.05, 'rolling over cold ice barely wears it');
    L.clearWear();
    drive(ice[0] + 1);
    const afterOne = through().length;
    let passes = 1;
    while (through().length < 4 && passes < 8) { drive(ice[0] + 1); passes++; }
    const exposed = through();
    console.log(`7c. locked slides over the Lab ice: after 1 -> ${afterOne} cells through; 4+ through after`
      + ` ${passes}: ${exposed.length} cells, now ${show(exposed.reduce((tally, cell) => {
      tally[cell.current] = (tally[cell.current] || 0) + 1 / exposed.length;
      return tally;
    }, {}))}`);
    check(afterOne < 4, 'one locked slide does not scrub the ice through');
    check(passes >= 2 && passes <= 4, '2-4 locked slides scrub it through');
    check(exposed.length > 0 && exposed.every((cell) => cell.cover === 'wet' || cell.cover === null),
      '... to meltwater (or the ground under it, once that water has gone)');
    setTrackC(20);
  }
}

// ---- 8. standing water
L.setLevel('sandbox');
{
  const tarmac = findGround('tarmac');
  const passesToClear = (at, tyreC, trials = 300) => {
    let sum = 0, worst = 0;
    const left = {};
    for (let k = 0; k < trials; k++) {
      covered(...at, 'wet');
      let n = 0, now = 'wet';
      while (now === 'wet' && n < 20) { now = pass(...at, tyreC); n++; }
      sum += n;
      worst = Math.max(worst, n);
      left[now] = (left[now] || 0) + 1 / trials;
    }
    return { mean: sum / trials, worst, left };
  };
  const cold = passesToClear(tarmac, 18), hot = passesToClear(tarmac, 120);
  setPassTyre({ grip: { wet: 1.3 } });
  const rain = passesToClear(tarmac, 18);
  setPassTyre(null);
  console.log(`8. a puddle on tarmac: cold tyres ${cold.mean.toFixed(2)} passes (worst ${cold.worst}); hot`
    + ` ${hot.mean.toFixed(2)} (worst ${hot.worst}); rain tyres ${rain.mean.toFixed(2)} (worst ${rain.worst})`);
  check(cold.worst === 3 && cold.mean >= 2.4, 'cold tyres clear a puddle on tarmac in 3 passes (dragged water sooner)');
  check(hot.worst === 2, 'hot tyres in 2');
  check(rain.worst === 1, 'rain tyres in 1');
  // soft ground: each pass the tyre may take the water first (waterdrag.ts: 25 % dragged, half
  // of that used up = 12.5 %), else it churns in (40 %, always by pass 3): over the 3 passes
  // 22.5 % used up, 77.5 % churned in
  for (const [id, want] of [['grass', 'mud'], ['dirt', 'mud'], ['sand', 'gravel'], ['gravel', 'dirt']]) {
    let at = findGround(id);
    if (!at) { L.setLevel('lab'); at = findGround(id); }
    if (!at) { check(false, `${id} on the Sandbox or the Lab to test`); continue; }
    const soft = passesToClear(at, 18);
    L.setLevel('sandbox');
    console.log(`8b. a puddle on ${id}: ${soft.mean.toFixed(2)} passes (worst ${soft.worst}),`
      + ` leaving ${show(soft.left)}`);
    check(soft.worst <= 3 && near(soft.left[want] || 0, 0.775, 0.07)
      && Object.keys(soft.left).every((left) => left === want || left === id),
      `a puddle on ${id} churns in within 3 passes leaving ${want} (~78 %), else the tyres take it`);
  }
  // dragged water: some puddles push a cell or two ahead (+x), never further
  let spread = 0, furthest = 0;
  const cellX = Math.floor(tarmac[0] / L.WEAR_CELL), cellY = Math.floor(tarmac[1] / L.WEAR_CELL);
  for (let k = 0; k < 300; k++) {
    covered(...tarmac, 'wet');
    for (let i = 0; i < 3; i++) pass(...tarmac);
    for (let ahead = 1; ahead <= 4; ahead++) {
      const cell = L.wearMap.get(L.wearKey(cellX + ahead, cellY));
      if (cell && cell.cover === 'wet') { spread++; furthest = Math.max(furthest, ahead); break; }
    }
  }
  console.log(`8c. 300 puddles on tarmac, 3 passes each: ${spread} pushed water ahead, at most ${furthest} cell(s)`);
  check(spread > 15 && spread < 120 && furthest <= 2, 'dragged water spreads a cell ahead now and then, never far');
}

// ---- 9. damp ground (not standing water)
{
  const tarmac = findGround('tarmac');
  const dryLine = (tyreC) => {
    covered(...tarmac, 'wet', false);
    let n = 0, now = 'wet';
    while (now === 'wet' && n < 40) { now = pass(...tarmac, tyreC); n++; }
    return n;
  };
  const coldN = dryLine(18), hotN = dryLine(100);
  console.log(`9. damp tarmac: a dry line after ${coldN} cold passes, ${hotN} at 100 C`);
  check(coldN >= 14 && coldN <= 20 && hotN <= 4, 'damp ground dries in ~17 cold passes, a few hot ones');
}

// ---- 10. grip
{
  const grass = L.SURFACES.grass, tarmac = L.SURFACES.tarmac;
  const onGrass = L.surfaceOf('grass', 'wet'), onTarmac = L.surfaceOf('tarmac', 'wet');
  const oil = L.surfaceOf('racetarmac', 'oil');
  console.log(`10. grip: grass ${grass.mu} -> puddle ${onGrass.mu.toFixed(2)}; tarmac ${tarmac.mu} -> puddle`
    + ` ${onTarmac.mu.toFixed(2)}; race tarmac ${L.SURFACES.racetarmac.mu} -> oil ${oil.mu.toFixed(2)}`);
  check(onGrass.mu < grass.mu && onTarmac.mu < tarmac.mu && onGrass.mu < onTarmac.mu,
    'a puddle is slipperier than its ground and keeps that ground\'s character');
  check(oil.mu < onTarmac.mu, 'oil is slipperier than a puddle');
}

// ---- 11. coverage
{
  const art = makeSurfaceArt();
  const missing = Object.keys(L.SURFACES).filter((id) => id !== 'lab' && id !== 'kerb' && !art[id]);
  console.log('11. surfaces without art:', missing.length ? missing.join(', ') : 'none');
  check(missing.length === 0, 'every surface has art (render/ground/art.ts)');
}

console.log(fails.length ? `\nFAIL (${fails.length})` : '\nWear rules: all OK');
process.exitCode = fails.length ? 1 : 0;
