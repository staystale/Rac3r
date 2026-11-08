import fs from 'node:fs';
function sub(path, old, nu) {
  const s = fs.readFileSync(path, 'utf8');
  if (!s.includes(old)) throw new Error(`MISSING in ${path}: ${old.slice(0, 70)}`);
  fs.writeFileSync(path, s.replace(old, () => nu));
}
const P = 'src/render/particles.ts';
// smokeearly -> default
sub(P, `  const heatK = FIX.smokeEarly ? Math.min(1, Math.max(0, (heat - SMOKE_T_EARLY)
      / (SMOKE_T_FULL - SMOKE_T_EARLY))) ** SMOKE_EARLY_POW
    : SMOKE_HEAT_MIN + (1 - SMOKE_HEAT_MIN) * Math.min(1, (heat - SMOKE_T) / SMOKE_HEAT_SPAN);`,
`  const heatK = Math.min(1, Math.max(0, (heat - SMOKE_T_EARLY)
      / (SMOKE_T_FULL - SMOKE_T_EARLY))) ** SMOKE_EARLY_POW;`);
sub(P, `    if (wheel.heat < (FIX.smokeEarly ? SMOKE_T_EARLY : SMOKE_T) || wheel.slip < 1.5) continue;`,
`    if (wheel.heat < SMOKE_T_EARLY || wheel.slip < 1.5) continue;`);
sub(P, `      const alphaMin = FIX.smokeEarly ? SMOKE_ALPHA_EARLY : SMOKE_ALPHA_MIN;
      puff.alpha = alphaMin + (1 - alphaMin) * strength;`,
`      puff.alpha = SMOKE_ALPHA_EARLY + (1 - SMOKE_ALPHA_EARLY) * strength;
      puff.life *= FIX.smokeLinger ? SMOKE_LIFE_K : 1;`);
sub(P, `// ?smokeearly=1 (owner: "can tyre smoke`, `// SMOKE EARLY (passed 11-03; owner: "can tyre smoke`);
// airfx -> default
sub(P, `  const air = FIX.airFx ? windNow(puffs === ctx.state.puffs ? wallDt : 0) : null;`,
`  const air = windNow(puffs === ctx.state.puffs ? wallDt : 0);`);
sub(P, `    // the air (?airfx: spread, wind, the cars' stir - render/airflow.ts), else plain drag: clods
    // slow and settle
    if (air) airMove(puff, wallDt, air, ctx.state.airCars, fxRandom);
    else { puff.vx *= 1 - 2.6 * wallDt; puff.vy *= 1 - 2.6 * wallDt; }`,
`    // the air: spread, wind, the cars' stir (render/airflow.ts; was a plain drag to still air)
    airMove(puff, wallDt, air, ctx.state.airCars, fxRandom);`);
sub(P, `  // the cars stirring the air this frame (?airfx, render/airflow.ts)`,
`  // the cars stirring the air this frame (render/airflow.ts)`);
// smokelinger: eviction by kind
sub(P, `  if (puffs.length >= MAX_PUFFS) puffs.shift();          // cap; drop the oldest (§4)`,
`  if (puffs.length >= MAX_PUFFS) dropOldest(puffs, spray.rgb);   // cap (§4)`);
sub(P, `/**
 * Throw one puff into the pool, dropping the oldest when it is full.`, `// ?smokelinger=1 (owner 11-03: "tyre smoke vanishes sometimes ... when easing off or changing
// surface ... tyre smoke should linger normally even if you change surface or stop generating more
// smoke"). MEASURED cause: the pool is shared and capped (MAX_PUFFS) and a full pool dropped its
// OLDEST puff - on gravel / dirt / sand the long dust trails (~100 puffs a second, 1.4-2.1 s each)
// fill it, so every new dust puff threw out the oldest smoke. Under the switch a full pool drops
// the oldest puff OF THE SAME KIND (colour) as the new one, so dust only ever displaces dust; and
// tyre smoke lives SMOKE_LIFE_K x longer (a hot slide's cloud hangs ~3-5 s, not ~1.5-2).
const SMOKE_LIFE_K = 2.2;

/**
 * Make room in a full pool: the oldest puff of the new one's kind (?smokelinger), else the oldest.
 * @param puffs the pool, oldest first
 * @param rgb the new puff's colour (its kind)
 */
function dropOldest(puffs: Puff[], rgb: string): void {
  const same = FIX.smokeLinger ? puffs.findIndex((puff) => puff.rgb === rgb) : -1;
  puffs.splice(same < 0 ? 0 : same, 1);
}

/**
 * Throw one puff into the pool, dropping the oldest when it is full.`);
const s0 = fs.readFileSync(P, 'utf8');
// drop dead constants if no longer read
let s = s0;
for (const name of ['SMOKE_HEAT_MIN', 'SMOKE_HEAT_SPAN', 'SMOKE_ALPHA_MIN']) {
  const uses = s.split(name).length - 1;
  console.log(name, uses);
}
fs.writeFileSync(P, s);
sub('src/render/airflow.ts', `// render/airflow.ts - THE AIR the puffs hang in (?airfx=1; owner 11-02:`,
`// render/airflow.ts - THE AIR the puffs hang in (airfx, passed 11-03; owner 11-02:`);
sub('src/render/types.ts', `(render/airflow.ts, ?airfx)`, `(render/airflow.ts)`);
const C = 'src/ai/driverCool.ts';
sub(C, `  if (!FIX.aiCool) return { vMul: 1, lat: 0 };\n`, '');
sub(C, `import { FIX } from '../core/fixes.ts';\n`, '');
sub(C, `TYRE COOLING BY SKILL (?aicool=1;`, `TYRE COOLING BY SKILL (aicool, passed 11-03;`);
let f = fs.readFileSync('src/core/fixes.ts', 'utf8');
f = f.replace(/export const FIX = \{[\s\S]*?\n\};/, `export const FIX = {
  // ?smokelinger=1: tyre smoke hangs ~2x longer and dust can no longer push it out of the pool
  // (render/particles.ts)
  smokeLinger: atLoad('smokelinger'),
};`);
f = f.replace('heatease, flatgrip, towplus passed 11-02.)', 'heatease, flatgrip, towplus passed 11-02;\n// aicool, smokeearly, airfx passed 11-03.)');
fs.writeFileSync('src/core/fixes.ts', f);
let t = fs.readFileSync('src/testlist.js', 'utf8');
for (const id of ['aicool', 'smokeearly', 'airfx']) {
  t = t.replace(new RegExp(`\\n  \\{\\n    id: '${id}'[\\s\\S]*?\\n  \\},`), '');
}
t = t.replace(/\n\];\n$/, `
  {
    id: 'smokelinger',
    added: '2026-11-03',
    name: 'Tyre smoke lingers ~2x longer and no longer vanishes when you drive onto dust',
    where: 'Plain link + &smokelinger=1: a drift that runs onto gravel / dirt / sand, a lift-off',
    try: 'Smoke up the tyres, then ease off or slide onto the gravel: the cloud should hang.',
    wrong: 'Smoke still blinking out, or a cloud that never clears.',
  },
];
`);
fs.writeFileSync('src/testlist.js', t);
console.log('ok');
