// _skills.mjs - the AI field's skill spread per difficulty (seed 7, 20 cars). SKILLBAND=1 for ?skillband.
import { aiTraits } from '../../src/ai/traits.ts';
for (let d = 0; d < 5; d++) { const s = []; for (let i = 0; i < 20; i++) s.push(aiTraits(d, i, 20, 7).skill); s.sort((a, b) => a - b);
  console.log(`diff ${d}: min ${s[0].toFixed(2)} median ${s[10].toFixed(2)} max ${s[19].toFixed(2)}`); }
