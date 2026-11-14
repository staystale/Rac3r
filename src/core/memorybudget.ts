// core/memorybudget.ts - THE MEMORY BUDGET: a phone's browser shows no memory
// reading and kills the tab when memory runs out, so the game keeps its own count: the bytes of
// every canvas and bitmap it makes and still holds (width x height x 4, counted when asked), plus
// the levels it holds built (LEVEL_MB each). Before a NEW level is built for play
// (world/load.ts setLevel), while that is over MEMORY_BUDGET_MB, the least recently played built
// level (not the one being left, not the one coming) goes back to its unbuilt stub - its own keys
// deleted, the stub's put back with its _build - so it is built again, identically, on its next
// use; then the cached pictures registered with onMemoryShort are dropped (painted again when
// next needed).
// MB the game may hold in canvases and built levels before it drops some (MEASURED,
// tools/scratch/_memprobe.mjs at the phone's size, 20 AI: the count at a race start was 90-147 MB
// with one or two levels built - the canvases 72-113 MB of it, which drops do not change - so
// about five more venue levels stay built before the oldest goes)
export const MEMORY_BUDGET_MB = 180;
// MB a built level holds in the JS heap (MEASURED, _memprobe.mjs, after a forced collection: a
// venue level ~7, the heap 66 -> 93 MB over four after Spa; a stage or a non-venue circuit ~2)
export const LEVEL_MB = 7;
const BYTES_MB = 1048576;

interface Sized { width: number; height: number }
// every canvas and bitmap made (a dead one is pruned when counted, and whenever the list passes
// pruneAt: ground tiles are made thousands at a time, so it would otherwise only grow)
let canvases: WeakRef<Sized>[] = [];
// the list's length that next prunes it: twice what was live at the last prune, at least PRUNE_MIN
const PRUNE_MIN = 1024;
let pruneAt = PRUNE_MIN;
// the built levels that can go back to their stub, least recently played first
const built: { level: object; stub: Record<string, unknown> }[] = [];
// the cached pictures that can be dropped, in the order they go
const droppers: { name: string; drop: () => number }[] = [];
// what was dropped, the latest last (for the tools: tools/scratch/_memprobe.mjs), at most DROP_LOG
export const DROPS: string[] = [];
const DROP_LOG = 40;

/**
 * Counts a canvas or bitmap the game makes.
 * @param canvas the canvas, offscreen canvas or bitmap
 * @returns the same canvas
 */
export function trackCanvas<T extends Sized>(canvas: T): T {
  canvases.push(new WeakRef(canvas));
  if (canvases.length > pruneAt) canvasBytes();
  return canvas;
}

/**
 * The bytes the canvases and bitmaps still held take (each width x height x 4).
 * @returns the bytes
 */
export function canvasBytes(): number {
  let bytes = 0;
  const live: WeakRef<Sized>[] = [];
  for (const ref of canvases) {
    const canvas = ref.deref();
    if (!canvas) continue;
    live.push(ref);
    bytes += (canvas.width || 0) * (canvas.height || 0) * 4;
  }
  canvases = live;
  pruneAt = Math.max(PRUNE_MIN, live.length * 2);
  return bytes;
}

/**
 * The game's count now: the canvases and the built levels, MB.
 * @returns MB
 */
export function heldMb(): number {
  return canvasBytes() / BYTES_MB + built.length * LEVEL_MB;
}

/**
 * A level that waits for its first use is about to be built: its stub is kept so it can go back.
 * @param level the level (still with its _build)
 */
export function noteLevelBuilt(level: object): void {
  built.push({ level, stub: { ...(level as Record<string, unknown>) } });
}

/**
 * A level was made current for play: it is now the most recently played.
 * @param level the level
 */
export function noteLevelPlayed(level: object): void {
  const slot = built.findIndex((entry) => entry.level === level);
  if (slot >= 0) built.push(built.splice(slot, 1)[0]);
}

/**
 * Registers a cache of pictures that can be dropped when memory is short.
 * @param name what it is (for the tools)
 * @param drop drops it and returns the bytes it held
 */
export function onMemoryShort(name: string, drop: () => number): void {
  droppers.push({ name, drop });
}

/**
 * Puts a level back to its unbuilt stub.
 * @param entry the built level and its stub
 */
function dropLevel(entry: { level: object; stub: Record<string, unknown> }): void {
  const level = entry.level as Record<string, unknown>;
  for (const key of Object.keys(level)) delete level[key];
  Object.assign(level, entry.stub);
}

/**
 * Before a new level is built for play: drops built levels, least recently played first (never
 * the one being left or the one coming), then cached pictures, while over the budget.
 * @param leaving the current level
 * @param coming the level about to be built
 * @returns what was dropped, for the tools
 */
export function makeRoom(leaving: object, coming: object): string[] {
  const dropped: string[] = [];
  let picture = 0;
  while (heldMb() > MEMORY_BUDGET_MB) {
    const oldest = built.findIndex((entry) => entry.level !== leaving && entry.level !== coming);
    if (oldest >= 0) {
      const [entry] = built.splice(oldest, 1);
      dropped.push('level ' + String((entry.level as { id?: string }).id));
      dropLevel(entry);
      continue;
    }
    if (picture >= droppers.length) break;
    const dropper = droppers[picture++];
    dropped.push(`${dropper.name} ${(dropper.drop() / BYTES_MB).toFixed(1)} MB`);
  }
  DROPS.push(...dropped);
  DROPS.splice(0, Math.max(0, DROPS.length - DROP_LOG));
  return dropped;
}
