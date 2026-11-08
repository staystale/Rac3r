import fs from 'node:fs';
let t = fs.readFileSync('src/testlist.ts', 'utf8');
const r = (a, b) => { if (!t.includes(a)) throw new Error(a); t = t.replace(a, b); };
r("    name: 'REAL CARS: every car on its real counterpart (weight, engine, gears, tyres, drag) + names',",
  "    name: 'REAL CARS: each car on its real counterpart (weight, engine, gears, tyres, drag) + names',");
r("    where: 'Plain link + &realcars=1: the garage (names), then drive each car - Mini, saloon, Muscle',",
  "    where: 'Plain link + &realcars=1: the garage (names), then drive a few - Mini, saloon, Muscle',");
r("    try: 'Top speed and pull in each gear: does each feel like the real car? The Mini tops ~156 km/h.',",
  "    try: 'Top speed and the pull in each gear: like the real car? The Mini tops out ~160 km/h.',");
r("    wrong: 'A car that will not pull its top gear, revs that sound wrong, or one that handles oddly.',",
  "    wrong: 'A car that will not pull top gear, revs that sound wrong, or one handling oddly.',");
fs.writeFileSync('src/testlist.ts', t);
