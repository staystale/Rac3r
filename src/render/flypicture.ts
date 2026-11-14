// render/flypicture.ts - THE FLY-IN'S PICTURE KEPT (?onestart=1, FIX.onestart): a RESTART used to
// paint the fly-in's whole-level picture again (MEASURED, tools/scratch/_startload.mjs: Spa 36 ms
// at CPU x1, 144 ms at x4) though nothing on it had changed. The picture (render/camera.ts
// paintOverview) shows the floor, the zones, the lanes, the road, the patches (blend squares,
// inclusions, bushes), the scenery water and the kerbs, flat (no patterns), at a fixed size; no
// weather, time of day, light or wear is painted into it (the wet look and the night are laid over
// it as it is drawn). So it is kept and painted again only when one of these differs:
// - the level, or its layout (a re-randomised Grass Track bumps it);
// - its patch list (a new list each time the level is built);
// - the scenery water drawn (a pond frozen over is an ice twin, which the picture leaves out: the
//   start's freeze deal, world/puddles.ts resetPuddles, can differ restart to restart);
// - the screen's scale (px a metre), which sets the picture's zoom.
// A level's own mud that dried during a race is put back (world/levelmud.ts seedLevelMud) before
// the fly-in starts. The endless road streams under the picture: painted every time there.
// One picture is kept (the last level's); it can be dropped when memory is short.
import { LEVEL } from '../world/state.ts';
import { onMemoryShort } from '../core/memorybudget.ts';
import { sceneryWater } from './ground/covers.ts';
import type { Cover, Level, Patch } from '../world/types.ts';
import type { Overview } from './types.ts';

/** What the kept picture was painted from. */
interface PictureKey {
  level: Level;
  layout: number;
  patches: Patch[] | undefined;
  water: Cover[];
  pixelsPerMetre: number;
}

let kept: { key: PictureKey; picture: Overview } | null = null;
let isDropperOn = false;

/**
 * What the picture would be painted from now.
 * @param pixelsPerMetre the screen's px a metre at zoom 1
 * @returns the key
 */
function keyNow(pixelsPerMetre: number): PictureKey {
  return {
    level: LEVEL,
    layout: LEVEL.subtrack ? LEVEL.subtrack.layoutId || 0 : 0,
    patches: LEVEL.allPatches,
    // (compared cover by cover: LEVEL.covers is a new list at every start, its covers the same)
    water: LEVEL.covers ? sceneryWater(LEVEL.covers) : [],
    pixelsPerMetre,
  };
}

/**
 * Whether two keys paint the same picture.
 * @param one a key
 * @param other another
 * @returns true when every input matches (the water cover by cover)
 */
function isSameKey(one: PictureKey, other: PictureKey): boolean {
  if (one.level !== other.level || one.layout !== other.layout || one.patches !== other.patches
    || one.pixelsPerMetre !== other.pixelsPerMetre || one.water.length !== other.water.length)
    return false;
  return one.water.every((cover, i) => cover === other.water[i]);
}

/**
 * Drops the kept picture (memory short).
 * @returns the bytes it held
 */
function dropPicture(): number {
  const bytes = kept ? kept.picture.c.width * kept.picture.c.height * 4 : 0;
  kept = null;
  return bytes;
}

/**
 * The fly-in's whole-level picture: the kept one when nothing it shows has changed, else painted
 * (and kept). The endless road's is painted every time.
 * @param pixelsPerMetre the screen's px a metre at zoom 1 (view.PPM)
 * @param paint paints the picture afresh
 * @returns the picture
 */
export function keptFlyPicture(pixelsPerMetre: number, paint: () => Overview): Overview {
  if (LEVEL.endless) return paint();
  if (!isDropperOn) {
    isDropperOn = true;
    onMemoryShort('fly-in picture', dropPicture);
  }
  const key = keyNow(pixelsPerMetre);
  if (kept && isSameKey(kept.key, key)) return kept.picture;
  kept = { key, picture: paint() };
  return kept.picture;
}
