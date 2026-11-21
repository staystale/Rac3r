// render/axlerows.ts - WHERE A BODY's WHEELS ARE DRAWN: a car's four corners (its front pair
// steered), or a semi-trailer's axle group - three axles 1.31 m apart (EST: a tri-axle's usual
// spread) about its row's rear "axle", and none at its front, where its kingpin sits on the
// tractor (physics/trailer.ts). Each wheel keeps a corner's index (0 front -y, 1 front +y, 2 rear
// -y, 3 rear +y) for its tyre's air, its damage and a lost wheel.
import type { RenderCarSpec } from './types.ts';

// m between a trailer's axles
const TRAILER_AXLE_SPREAD_M = 1.31;

/** One wheel to draw: its axle (m ahead of the middle), its side (-1 / 1), steer (rad), corner. */
export type WheelRow = [axleX: number, side: number, steer: number, corner: number];

/**
 * The wheels a body is drawn on.
 * @param spec the body as drawn (its kind, lf and lr, m)
 * @param steer the front wheels' steer, rad
 * @returns its wheels
 */
export function wheelRows(spec: RenderCarSpec, steer: number): WheelRow[] {
  if (spec.kind === 'trailer') {
    const rows: WheelRow[] = [];
    for (const shift of [-TRAILER_AXLE_SPREAD_M, 0, TRAILER_AXLE_SPREAD_M])
      rows.push([-spec.lr + shift, -1, 0, 2], [-spec.lr + shift, 1, 0, 3]);
    return rows;
  }
  return [
    [spec.lf, -1, steer, 0], [spec.lf, 1, steer, 1], [-spec.lr, -1, 0, 2], [-spec.lr, 1, 0, 3],
  ];
}
