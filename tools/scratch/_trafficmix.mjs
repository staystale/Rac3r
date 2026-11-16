// _trafficmix.mjs - THE HIGHWAY TRAFFIC'S MIX: draws N cars as the traffic does (ai/trafficSpawn.ts
// newTrafficVehicle, its weights ai/trafficCtx.ts VEH and the paints) with a seeded random source,
// and prints each model's share. A new car behind its switch: its NAME=1.
// node tools/scratch/_trafficmix.mjs [cars, 20000] [seed, 1]
import { newTrafficVehicle } from '../../src/ai/trafficSpawn.ts';
import { lcg } from '../../src/core/random.ts';

const COUNT = +(process.argv[2] || 20000), SEED = +(process.argv[3] || 1);
const ctx = { rnd: lcg(SEED), list: [], level: null, want: 0, placed: 0, recycled: 0, visHits: 0,
  cars: [], ourSide: [] };
const counts = new Map();
for (let i = 0; i < COUNT; i++) {
  const id = String(newTrafficVehicle(ctx).spec.id).split('#')[0];
  counts.set(id, (counts.get(id) || 0) + 1);
}
for (const [id, count] of [...counts].sort((one, two) => two[1] - one[1]))
  console.log(id.padEnd(14), String(count).padStart(6), `${(100 * count / COUNT).toFixed(1)} %`);
