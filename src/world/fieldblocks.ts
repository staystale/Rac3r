// FIELD BLOCKS (owner): a highway PLOUGHED field (a rotated mud zone,
// highway/fields.js) dries in blocks, not wear cells - its ~2 500 cells a field (~15 000 in
// view, tools/scratch/_hwplough.mjs) would cost every road rebuild and tile paint. The field is
// cut at random into uneven rectangles (a random split, the bigger block first, mostly across
// its longer side, at 30-70 %: no regular grid), seeded by the field's id so a field always
// splits the same. Each block is a level mud piece (levelmud.ts) that dries on its own timer;
// a dried block drives as dirt and is drawn as dry ploughed earth over the field
// (render/ground/zones.ts). The blocks live inside their zone: zoneAt looks at them only for a
// point already inside the field.
import { parkMiller } from "../core/random.ts";
import type { Zone, ZoneBlock } from "./types.ts";

// about one block per BLOCK_AREA_M2 of field, at least MIN_BLOCKS, at most MAX_BLOCKS; no block
// side under MIN_SIDE_M
const BLOCK_AREA_M2 = 400, MIN_BLOCKS = 8, MAX_BLOCKS = 24, MIN_SIDE_M = 6;
// a cut lies this far along the side (share), and this often across the shorter side instead
const CUT_MIN = 0.3, CUT_SPAN = 0.4, ACROSS_CHANCE = 0.3;

/**
 * Splits one block in two across one side.
 * @param block the block to split
 * @param alongU true to cut across u (two blocks side by side in u)
 * @param share where the cut lies, 0..1 along the side
 * @returns the two halves
 */
function cutBlock(block: ZoneBlock, alongU: boolean, share: number): [ZoneBlock, ZoneBlock] {
  const first = { ...block }, second = { ...block };
  if (alongU) {
    const cutU = block.u0 + (block.u1 - block.u0) * share;
    first.u1 = cutU;
    second.u0 = cutU;
  } else {
    const cutV = block.v0 + (block.v1 - block.v0) * share;
    first.v1 = cutV;
    second.v0 = cutV;
  }
  return [first, second];
}

/**
 * Which side to cut a block across: mostly its longer one, sometimes the other when that side
 * still leaves two blocks of MIN_SIDE_M.
 * @param block the block
 * @param random the field's random stream
 * @returns true to cut across u, false across v, null when neither side can be cut
 */
function cutSide(block: ZoneBlock, random: () => number): boolean | null {
  const sideU = block.u1 - block.u0, sideV = block.v1 - block.v0;
  const canU = sideU >= 2 * MIN_SIDE_M, canV = sideV >= 2 * MIN_SIDE_M;
  if (!canU && !canV) return null;
  if (!canU || !canV) return canU;
  const longerU = sideU >= sideV;
  return random() < ACROSS_CHANCE ? !longerU : longerU;
}

/**
 * Cuts a field into its blocks (zone-local metres, u along the zone's w, v along its h).
 * @param zone the field zone
 * @returns the blocks, each with the field's surface
 */
export function splitField(zone: Zone): ZoneBlock[] {
  const random = parkMiller(((zone.field || 1) * 7919) % 2147483646 + 1);
  const wanted = Math.round((zone.w * zone.h) / BLOCK_AREA_M2);
  const count = Math.max(MIN_BLOCKS, Math.min(MAX_BLOCKS, wanted));
  let blocks: ZoneBlock[] = [{
    u0: -zone.w / 2, v0: -zone.h / 2, u1: zone.w / 2, v1: zone.h / 2, surface: zone.surface,
  }];
  while (blocks.length < count) {
    // the biggest block that can still be cut
    const area = (block: ZoneBlock) => (block.u1 - block.u0) * (block.v1 - block.v0);
    const order = [...blocks].sort((first, second) => area(second) - area(first));
    const target = order.find((block) => cutSide(block, () => 0.5) !== null);
    if (!target) break;
    const alongU = cutSide(target, random)!;
    const halves = cutBlock(target, alongU, CUT_MIN + CUT_SPAN * random());
    blocks = blocks.filter((block) => block !== target).concat(halves);
  }
  return blocks;
}

/**
 * The block of a field holding a zone-local point, or null.
 * @param blocks the field's blocks
 * @param localU the point along the zone's w, m from its centre
 * @param localV the point along the zone's h, m from its centre
 * @returns the block
 */
export function blockAt(blocks: ZoneBlock[], localU: number, localV: number): ZoneBlock | null {
  for (const block of blocks) {
    if (localU >= block.u0 && localU <= block.u1 && localV >= block.v0 && localV <= block.v1) {
      return block;
    }
  }
  return null;
}

/**
 * A block's centre in world metres.
 * @param zone the field zone (rotated)
 * @param block the block
 * @returns the centre
 */
export function blockCentre(zone: Zone, block: ZoneBlock): { x: number; y: number } {
  const midU = (block.u0 + block.u1) / 2, midV = (block.v0 + block.v1) / 2;
  const cosRot = Math.cos(zone.rot || 0), sinRot = Math.sin(zone.rot || 0);
  return { x: zone.x + midU * cosRot - midV * sinRot, y: zone.y + midU * sinRot + midV * cosRot };
}
