import fs from 'node:fs';
const p = 'src/input.ts';
let s = fs.readFileSync(p, 'utf8');
const r = (a, b) => { if (!s.includes(a)) throw new Error(a); s = s.replace(a, b); };
r('const KEYMAP = {', `/** The createInput options. */
export interface InputOpts {
  mode?: string;   // 'touch' | 'pc' | 'auto'
  hudDown?: (x: number, y: number) => boolean;   // a tap the HUD claims (never reaches the world)
  onKey?: (key: string) => void;   // every key down
}

/** The one input state: the resolved axes, what the HUD draws, and the frame methods. */
export interface InputState {
  steer: number; throttle: number; brake: number; handbrake: number; reverse?: number;
  shiftUp: boolean; shiftDown: boolean;
  mode: string;
  stick: { active: boolean; ox: number; oy: number; x: number; y: number };
  speed: number;   // the player car's speed, m/s (sim.js): the stick's reach
  stickReach: number;   // px of thumb for full lock this frame (steerfeel.ts)
  pedals: Record<string, boolean>;
  tapped: { x: number; y: number } | null;
  brakeHeld: number; thrHeld: number; revHeld: number;   // s each has been held (the ramps)
  isTouch: () => boolean;
  pedalHits: typeof findPedalHits;
  releaseAll: () => void;
  update: (wallDt?: number) => InputState;
  consumeTap: () => { x: number; y: number } | null;
}

/** What the pointer handlers share. */
interface InputCore {
  state: InputState; canvas: HTMLCanvasElement; opts: InputOpts;
  keys: Set<string>;   // the held key actions
  owners: Map<number, string>;   // pointer id -> 'stick' | 'hud' | a pedal name
}

const KEYMAP: Record<string, string> = {`);
r('function makeInputState(opts: InputOpts) {\n  return {', 'function makeInputState(opts: InputOpts): InputState {\n  return {');
r('    handbrake: 0,                     // 0..1, slewed both ways (see HB_SLEW)\n  };',
  '    handbrake: 0,                     // 0..1, slewed both ways (see HB_SLEW)\n  } as InputState;   // its methods are set by createInput');
r('export function createInput(canvas: HTMLCanvasElement, opts: InputOpts = {}) {',
  'export function createInput(canvas: HTMLCanvasElement, opts: InputOpts = {}): InputState {');
r('  const core = {', '  const core: InputCore = {');
s = s.replace(/ \* @param \{[^}]*\} /g, ' * @param ').replace(/ \* @returns \{[^}]*\} ?/g, ' * @returns ');
fs.writeFileSync(p, s);
console.log('ok');
