import fs from 'node:fs';
const p = 'src/guide.ts';
let s = fs.readFileSync(p, 'utf8');
const lines = s.split('\n');
let last = -1;
for (let i = 0; i < lines.length; i++) {
  if (!/^import /.test(lines[i])) continue;
  let end = i;
  while (end < lines.length - 1 && !/from ['"][^'"]+['"];?\s*$/.test(lines[end])) end++;
  last = end; i = end;
}
lines.splice(last + 1, 0, `import type { HudRects } from './hud/layout.ts';

/** A screen rectangle, css px. */
interface Rect { x: number; y: number; w: number; h: number }
/** A pedal's circle (input.ts findPedalHits). */
interface Pedal { name: string; x: number; y: number; r: number }
/** What a card can point at this frame (buildGuideScene). */
interface GuideScene {
  L: HudRects; W: number; H: number; touch: boolean; pedals: Pedal[];
  carRect: Rect; hint: Rect; aids: Rect | null; menu: boolean;
}
/** One card: its title, its words (touch / pc, or worked out from the scene) and its target. */
interface GuideCard {
  title: string; touch?: string; pc?: string;
  text?: (scene: GuideScene) => string;
  target: ((scene: GuideScene) => Rect | null) | null;
}
/** The guide's state: the deck shown, the card, and the geometry drawn last frame. */
interface GuideState {
  seen: boolean; idx: number; pulse: number;
  last: { box: Rect; nextB: Rect; skipB: Rect | null; target: Rect | null } | null;
  deck: GuideCard[]; deckKind: string | null;
}
/** What the guide reads of the game. */
interface GuideGame {
  input: { isTouch: () => boolean; pedalHits: (width: number, height: number) => Pedal[] };
  car: { x: number; y: number; spec: { aids?: { abs: boolean; tcs: boolean } } };
  menuMode?: boolean;
}
/** What the guide reads of the renderer: the scale and world -> screen. */
interface GuideView { PPM: number; toScreenX: (x: number) => number; toScreenY: (y: number) => number }`);
fs.writeFileSync(p, lines.join('\n'));
