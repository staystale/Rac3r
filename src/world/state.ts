// The ACTIVE level. `let` so the exported binding is live: importers see the switch without
// anything having to be re-plumbed through a setter.
import type { Level, Paint, Board, Cone, Spawn, Zone, Bump, Prop } from "./types.ts";

export let LEVEL: Level;
export let PAINT: Paint[];
export let BOARDS: Board[];
export let CONES: Cone[];
export let SPAWN: Spawn;
export let ZONES: Zone[];
export let BUMPS: Bump[];
export let PROPS: Prop[];

export function setActiveLevel(level: Level): void {
  // EVERY exported per-level binding must be re-pointed here. MEASURED BUG, 2026-10-03: the
  // PAINT/BOARDS/CONES line was deleted (DeepSeek, 2026-10-02) and every level then drew the lab's
  // 242 cones and paint. Never push() into these arrays either — they are the level's own data,
  // shared across switches.
  LEVEL = level;
  PAINT = LEVEL.paint;
  BOARDS = LEVEL.boards;
  CONES = LEVEL.cones;
  SPAWN = LEVEL.spawn;
  ZONES = LEVEL.zones;
  BUMPS = LEVEL.bumps;
  PROPS = LEVEL.props || [];
}
