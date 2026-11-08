// render/coverlooks.ts - THE LOOKS OF THE TYRE-MADE COVERS (oil, a radiator's water, glass) in one
// place: the GPU field draws them on the ground (render/glfield.ts: its shader is written from
// these), and a bridge's or tunnel's own ground is painted with the same (render/ground/
// deckcovers.ts) - one look for one thing wherever it lies (owner 11-08: "it should work like any
// other surface"). RGB 0..1; a look is its body, mixed toward its sheen on the sheen's squares
// (by sheenShare), its alpha (+ thickAlpha when the cover is thick), and its rim where a square's
// neighbour is bare ground.
export const OIL_LOOK = { body: [0.04, 0.02, 0.06], sheen: [0.27, 0.10, 0.40],
  rim: [0.32, 0.14, 0.48, 0.9], sheenShare: 0.75, alpha: 0.86, thickAlpha: 0.1 };
export const WATER_LOOK = { body: [0.16, 0.26, 0.44], sheen: [0.40, 0.54, 0.72],
  rim: [0.08, 0.12, 0.20, 0.45], sheenShare: 0.3, alpha: 0.28, thickAlpha: 0.22 };
// glass: pale specks GLASS_PX to a square's side, on `share` of them
export const GLASS_LOOK = { pale: [0.80, 0.87, 0.93], share: 0.05, px: 8 };

/**
 * Numbers as a GLSL list (the shader's literals).
 * @param values the numbers
 * @returns "a, b, c" with two decimals
 */
export const glslList = (values: number[]): string =>
  values.map((value) => value.toFixed(2)).join(', ');
