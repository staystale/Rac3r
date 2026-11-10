// menu/thumbfiles.ts - THE SHIPPED TRACK THUMBNAILS: assets/thumbs/<level id>.png, listed in
// assets/thumbs/index.json, made by tools/thumbs.mjs with the game's own thumbnail painter
// (game/menuflow.ts paintThumbsNow) - read in the background at load and decoded off the main
// thread, so the menu never paints them itself (owner 11-10: "Yes" to shipping them; MEASURED,
// tools/scratch/_menuload.mjs: painting them all on the first TEST MODE tap after an update froze
// the laptop's menu 37 s, 49 s with the 11-10 venues). A level without one (added since the tool
// last ran: tools/thumbcheck.mjs fails on it) is painted when a list needs it.

// the folder, beside the page (dist/assets the same: tools/build.mjs)
const DIR = 'assets/thumbs/';

/**
 * Reads the shipped thumbnails into a record (one that failed to load is left out: painted when
 * needed).
 * @param into level id -> thumbnail (filled; one already there is kept)
 * @returns the level ids read
 */
export async function loadShippedThumbs(into: Record<string, HTMLCanvasElement>):
  Promise<Set<string>> {
  const base = new URL(DIR, document.baseURI), done = new Set<string>();
  const listed = await fetch(new URL('index.json', base));
  if (!listed.ok) return done;
  const { ids } = await listed.json() as { ids: string[] };
  await Promise.all(ids.map(async (levelId) => {
    try {
      const file = await fetch(new URL(levelId + '.png', base));
      if (!file.ok) return;
      const bitmap = await createImageBitmap(await file.blob(), { colorSpaceConversion: 'none' });
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
      bitmap.close();
      into[levelId] ??= canvas;
      done.add(levelId);
    } catch {
      // (that one is painted when a list needs it)
    }
  }));
  return done;
}
