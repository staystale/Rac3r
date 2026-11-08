import fs from 'node:fs';
function sub(path, a, b) {
  const s = fs.readFileSync(path, 'utf8');
  if (!s.includes(a)) throw new Error(path + ': ' + a);
  fs.writeFileSync(path, s.replace(a, () => b));
}
const S = 'src/game/state.ts';
sub(S, "import type { RaceFlow } from '../raceflow.ts';", "import type { RaceFlow } from '../raceflow.ts';\nimport type { HwFlow } from '../ai/hwFlowTypes.ts';");
sub(S, `  indicator?: number; lightsOn?: boolean;
  num?: number;
};`, `  indicator?: number; lightsOn?: boolean;
  indT?: number; indTurned?: boolean;   // the indicator's blink clock; cancelled by the turn
  brakeLight?: number; handbrakeOn?: number; rainLight?: boolean;   // the lamps
  num?: number;
  _slot?: number;   // its grid slot (a stage: relative to yours)
  _lastQ?: number;   // its distance round the track last step
  _lastOn?: { dist: number; off: number };   // where it was last on the road
  _cut?: { gain: number; prog?: number; q?: number } | null;   // a track cut in progress
  _cuts?: number; _cutLog?: number[][];   // track cuts taken; their log (tools)
  _dmgResets?: number;   // resets for damage
  simTime?: number;
};`);
sub(S, `  flow: RaceFlow | null; flowShown?: boolean; flowDoneAt?: number;`,
  `  flow: RaceFlow | HwFlow | null; flowShown?: boolean; flowDoneAt?: number;`);
sub(S, `/** The game object (filled in by main.ts). */
export const game = {} as Game;`, `declare global {
  // the harness handle (CLAUDE.md §5: a script must be able to drive the real game)
  interface Window { __game: Record<string, unknown> }
}

/** The game object (filled in by main.ts). */
export const game = {} as Game;`);
// the world's narrow view of the highway state is the highway's own
const W = 'src/world/types.ts';
let w = fs.readFileSync(W, 'utf8');
w = w.replace(/export interface HighwayState \{\n  camDir: \{ x: number; y: number \};\n  pts: \{ s: number \}\[\];\n\}/,
  `export type HighwayState = HwState;   // highway/hwtypes.ts`);
w = w.replace(/(\nimport [^\n]*\n)(?!import)/, `$1import type { HwState } from '../highway/hwtypes.ts';\n`);
fs.writeFileSync(W, w);
console.log('ok');
