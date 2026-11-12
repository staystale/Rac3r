// menu/thumbfiles.ts - THE SHIPPED TRACK THUMBNAILS: assets/thumbs/<level id>.png, listed in
// assets/thumbs/index.json, made by tools/thumbs.mjs with the game's own thumbnail painter
// (game/menuflow.ts paintThumbsNow) - read in the background at load and decoded off the main
// thread, so the menu never paints them itself (owner 11-10: "Yes" to shipping them; MEASURED,
// tools/scratch/_menuload.mjs: painting them all on the first TEST MODE tap after an update froze
// the laptop's menu 37 s, 49 s with the 11-10 venues). A level without one (added since the tool
// last ran: tools/thumbcheck.mjs fails on it) is painted when a list needs it.


// the folder, beside the page (dist/assets the same: tools/build.mjs)
const DIR = 'assets/thumbs/';
// the thumbnails as lossless WebP (the PNGs' pixels, MEASURED 1871 -> 1221 KB for 52:
// tools/scratch/_thumbwebp.mjs; the PNGs stay as the tools' source)
const EXT = '.webp';

// level id -> what fills a menu screen's empty place for its thumbnail when it arrives (a screen
// opened while they are still read: menu/tracks.ts addThumb); true while they are read
const waiting = new Map<string, ((thumb: HTMLCanvasElement) => void)[]>();
let isReading = false;

/**
 * Asks to be handed a level's shipped thumbnail as soon as it is read (nothing if they are not
 * being read now: then it is there already, or it is painted when a list asks).
 * @param levelId the level
 * @param fill takes the thumbnail
 */
export function whenThumbArrives(levelId: string, fill: (thumb: HTMLCanvasElement) => void) {
  if (!isReading) return;
  const list = waiting.get(levelId) || [];
  list.push(fill);
  waiting.set(levelId, list);
}

/**
 * Reads the shipped thumbnails into a record (one that failed to load is left out: painted when
 * needed). The first ones (the menu's first screen's) are read before the rest.
 * @param into level id -> thumbnail (filled; one already there is kept)
 * @param first the level ids to read first
 * @returns the level ids read
 */
export async function loadShippedThumbs(into: Record<string, HTMLCanvasElement>,
  first: string[] = []): Promise<Set<string>> {
  const base = new URL(DIR, document.baseURI), done = new Set<string>();
  isReading = true;
  try {
    return await readThumbs(into, base, done, first);
  } finally {
    isReading = false;
    waiting.clear();
  }
}

/**
 * Reads the listed thumbnails, handing each to whatever waits for it (whenThumbArrives).
 * @param into level id -> thumbnail (filled; one already there is kept)
 * @param base the thumbnails' folder
 * @param done the level ids read (filled)
 * @param first the level ids read before the rest (all at once, then the rest at once)
 * @returns done
 */
async function readThumbs(into: Record<string, HTMLCanvasElement>, base: URL,
  done: Set<string>, first: string[]): Promise<Set<string>> {
  const listed = await fetch(new URL('index.json', base));
  if (!listed.ok) return done;
  const { ids } = await listed.json() as { ids: string[] };
  const early = new Set(first.filter((levelId) => ids.includes(levelId)));
  await Promise.all([...early].map((levelId) => readThumb(into, base, done, levelId)));
  await Promise.all(ids.filter((levelId) => !early.has(levelId))
    .map((levelId) => readThumb(into, base, done, levelId)));
  return done;
}

/**
 * Reads one shipped thumbnail, handing it to whatever waits for it (one that fails is left out).
 * @param into level id -> thumbnail (filled; one already there is kept)
 * @param base the thumbnails' folder
 * @param done the level ids read (filled)
 * @param levelId the level
 */
async function readThumb(into: Record<string, HTMLCanvasElement>, base: URL, done: Set<string>,
  levelId: string) {
  try {
    const file = await fetch(new URL(levelId + EXT, base));
    if (!file.ok) return;
    const bitmap = await createImageBitmap(await file.blob(), { colorSpaceConversion: 'none' });
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    bitmap.close();
    into[levelId] ??= canvas;
    done.add(levelId);
    for (const fill of waiting.get(levelId) || []) fill(into[levelId]);
    waiting.delete(levelId);
  } catch {
    // (that one is painted when a list needs it)
  }
}
