// world/formations.ts - the shapes of DEAF VALLEY's ROCK FORMATIONS (owner 11-09: "more random real
// rock formations in the desert"; highway/canyon.ts places them), in a prop's own frame (metres,
// before its turn), shared by what is drawn (render/props/formations.ts) and what is solid
// (world/barriers.ts):
//   butte   a flat-topped mass (s m long, 0.62 s wide): its ragged outline
//   hoodoo  a cluster of spires within s m: each one's place and width
//   arch    a natural arch spanning s m: its two legs and the span bowing between them
import type { Point, Prop } from './types.ts';

/**
 * A prop's own random stream (its look the same every visit).
 * @param prop the prop (its seed)
 * @param salt a stream per use
 * @returns 0..1 numbers
 */
function streamOf(prop: Prop, salt: number): () => number {
  let state = ((prop.seed || 1) * 7919 + salt * 104729) % 2147483646 + 1;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

/**
 * A butte's outline: twelve points round an ellipse, each pushed in or out a little.
 * @param prop the butte
 * @returns the outline, m
 */
export function butteOutline(prop: Prop): Point[] {
  const rand = streamOf(prop, 1), size = prop.s || 24, pts: Point[] = [];
  for (let idx = 0; idx < 12; idx++) {
    const angle = (idx / 12) * Math.PI * 2, push = 0.82 + rand() * 0.22;
    pts.push([Math.cos(angle) * size / 2 * push, Math.sin(angle) * size * 0.31 * push]);
  }
  return pts;
}

/** One hoodoo spire: where (m) and how wide. */
export interface Spire { x: number; y: number; d: number }

/**
 * A hoodoo cluster's spires: three to seven, 1.2-2.6 m across, within s m, none on another.
 * @param prop the cluster
 * @returns the spires
 */
export function hoodooSpires(prop: Prop): Spire[] {
  const rand = streamOf(prop, 2), size = prop.s || 8, count = 3 + Math.floor(rand() * 5),
    spires: Spire[] = [];
  for (let tries = 0; spires.length < count && tries < 40; tries++) {
    const angle = rand() * Math.PI * 2, radius = Math.sqrt(rand()) * (size / 2 - 1),
      spire = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, d: 1.2 + rand() * 1.4 };
    if (spires.every((other) => Math.hypot(other.x - spire.x, other.y - spire.y)
      > (other.d + spire.d) / 2 + 0.4)) spires.push(spire);
  }
  return spires;
}

/**
 * An arch's legs (boxes: centre x, y, w, h) and its span (points along its top, from leg to leg).
 * @param prop the arch
 * @returns legs and span, m
 */
export function archShape(prop: Prop) {
  const size = prop.s || 18, legW = size * 0.16, legH = size * 0.26, bow = size * 0.14;
  const span: Point[] = [];
  for (let idx = 0; idx <= 8; idx++) {
    const frac = idx / 8;
    span.push([(frac - 0.5) * size, -bow * Math.sin(frac * Math.PI)]);
  }
  return { legs: [[-size / 2, 0, legW, legH], [size / 2, 0, legW, legH]], span,
    width: size * 0.12 };
}
