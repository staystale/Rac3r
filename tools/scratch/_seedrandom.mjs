// _seedrandom.mjs - MEASURING ONLY: a seeded Math.random, preloaded into an AI tool so an off / on
// comparison runs the same random draws both sides (wear, debris and punctures draw Math.random,
// so the AI tools are not repeatable run to run: aijokercheck, the switch off, gave Slidden Hill
// 223 / 228 / 253 s on three runs; seeded, the same number twice). Pair every comparison by seed:
//   RANDOM_SEED=1 node --import ./tools/scratch/_seedrandom.mjs tools/aijokercheck.mjs ...
// and run several seeds a side (the draws part ways once the cars do).
// RANDOM_SEED (default 1): any integer.
const SEED = Number(process.env.RANDOM_SEED || 1);
// a mulberry32 stream, its state started from the seed (Knuth's multiplicative hash)
let state = (SEED * 2654435761) >>> 0;
Math.random = () => {
  state = (state + 0x6D2B79F5) >>> 0;
  let mixed = Math.imul(state ^ (state >>> 15), state | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
};
