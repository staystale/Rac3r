// highway/bridgeways.ts - THE ENDLESS ROAD'S DRIVABLE BRIDGES: the venue system's
// crossings (world/crossings.ts) for the road bridges over the motorway, kept as the road streams.
// A car's crossing is an index into LEVEL.crossings, and its deck's wear is filed by that index
// (world/deckwear.ts), so a bridge keeps its slot while it is loaded; a slot whose bridge was
// dropped behind is emptied (a way nowhere) and given to the next new bridge, its deck's wear
// forgotten. The list stays as long as the most bridges loaded at once (2-4), never past the
// deck filing's room.
import { bridgeCrossing, railCrossing } from '../world/crossings.ts';
import { FIX } from '../core/fixes.ts';
import { clearDeckCellsOf } from '../world/deckwear.ts';
import type { Crossing, Prop } from '../world/types.ts';
import type { HwLevel } from './hwtypes.ts';

// an empty slot: a way of no length far off any road - no car is ever between its ends
const NOWHERE: Crossing = { kind: 'bridge', ax: -1e7, ay: -1e7, dirX: 1, dirY: 0, length: 0,
  minAcross: 0, maxAcross: 0, cut: 0, rise: 0, walls: [] };

/**
 * Whether a prop is one of the highway's drivable bridges.
 * @param prop the prop
 * @returns true for one
 */
const isDrivable = (prop: Prop): boolean => prop.kind === 'bridge' && (prop.look === 'venue'
  || (FIX.railbridges && prop.carries === 'rail'));

/**
 * Brings the highway's crossings in line with its loaded props: each drivable bridge keeps its
 * slot, a dropped one's slot is emptied, a new one takes the first empty slot (else a new one).
 * Called when the road is rebuilt (highway.ts rebuild).
 * @param level the highway level
 */
export function syncBridgeways(level: HwLevel): void {
  const state = level._hw, owners = (state.wayOwners ||= []);
  const crossings = (level.crossings ||= []);
  const loaded = new Set(level.props.filter(isDrivable));
  for (let slot = 0; slot < owners.length; slot++) {
    if (owners[slot] && !loaded.has(owners[slot]!)) {
      owners[slot] = null;
      crossings[slot] = NOWHERE;
      clearDeckCellsOf(slot);
    }
  }
  const held = new Set(owners);
  for (const bridge of loaded) {
    if (held.has(bridge)) continue;
    let slot = owners.indexOf(null);
    if (slot < 0) slot = owners.length;
    owners[slot] = bridge;
    crossings[slot] = bridge.carries === 'rail' ? railCrossing(bridge) : bridgeCrossing(bridge);
  }
}
