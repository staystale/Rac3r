// _rosterdump.mjs - every car's resolved spec as JSON (to prove a roster rewrite changes nothing)
import { CAR_IDS, spec } from '../../src/cars.ts';
const out = {};
for (const id of CAR_IDS) out[id] = spec(id);
console.log(JSON.stringify(out, null, 1));
