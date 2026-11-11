// highway/ringgeo.ts - A JUNCTION'S ROUNDABOUT MEASURES (?junctions=1): where a junction bridge's
// two roundabouts sit on its road, and their size - read by the junction builder
// (highway/junctions.ts) and by the bridge's approach roads (highway/cuts.ts approaches), which
// part round each ring.
import { VENUE_DECK, rampsOf } from '../world/crossinggeo.ts';
import type { Point, Prop } from '../world/types.ts';

// m: the ring's lane centre-line radius and its lane's width (a small two-way roundabout, ~25 m
// across), so its outer edge; and the straight road between the ring and a ramp's foot (MEASURED,
// _junctiondrive.mjs: at 2 m a car leaving the ring met the ramp's mouth still turning and hit
// its wall)
export const RING_R = 9, RING_LANE_M = 7, RING_OUTER_M = RING_R + RING_LANE_M / 2;
const RING_CLEAR_M = 12;

/**
 * The centre of a junction bridge's roundabout on one side: on the bridge's road, past its ramp's
 * foot.
 * @param bridge the bridge (x, y, rot along its road, wid its span)
 * @param sign -1 the -x end (the motorway's left), +1 the +x end
 * @returns the centre, world m
 */
export function ringCentre(bridge: Prop, sign: number): Point {
  const ramp = rampsOf(bridge)[sign < 0 ? 0 : 1];
  const out = (bridge.wid || 30) / 2 + VENUE_DECK.abutment + ramp + RING_OUTER_M + RING_CLEAR_M;
  return [bridge.x + Math.cos(bridge.rot || 0) * out * sign,
    bridge.y + Math.sin(bridge.rot || 0) * out * sign];
}
