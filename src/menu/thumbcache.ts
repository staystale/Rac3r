// thumbcache.ts — THE SAVED THUMBNAILS: the menu's track thumbnails kept
// on the device per game version, so a load paints them only the first time a version runs.
// MEASURED: painting all 18 at load took ~0.65 s on the laptop (~0.3 s on the owner's phone),
// most of the start-up after the bundle. The version is the bundle's fingerprint of every source
// file (tools/lib/buildid.mjs; none when the modules are loaded one by one, as the test tools do).
// Storage can fail (a private window, storage full): every caller falls back to painting.

const DB_NAME = 'rac3r-thumbs', STORE = 'thumbs';
const SAVED_KEY = 'rac3r.thumbs.build';   // localStorage: the version whose thumbnails are saved

/** This game version's fingerprint, or null (modules loaded one by one: no version known). */
const built = (globalThis as { __RAC3R_BUILD__?: unknown }).__RAC3R_BUILD__;
export const BUILD_ID = typeof built === 'string' ? built : null;

/**
 * Whether this version's thumbnails are saved on the device (a quick check at load).
 * @param build the version
 * @returns saved
 */
export function hasSavedThumbs(build: string): boolean {
  try {
    return localStorage.getItem(SAVED_KEY) === build;
  } catch {
    return false;
  }
}

/**
 * Opens the thumbnail database.
 * @returns the database
 */
function openThumbDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Every saved thumbnail as [level id, PNG blob].
 * @param database the database
 * @returns the entries
 */
function readEntries(database: IDBDatabase): Promise<[string, Blob][]> {
  return new Promise((resolve, reject) => {
    const entries: [string, Blob][] = [];
    const request = database.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) { resolve(entries); return; }
      entries.push([String(cursor.key), cursor.value as Blob]);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Reads the saved thumbnails back into canvases (decoded off the main thread).
 * @returns level id -> thumbnail
 */
export async function readThumbs(): Promise<Record<string, HTMLCanvasElement>> {
  const database = await openThumbDb();
  const entries = await readEntries(database);
  database.close();
  const thumbs: Record<string, HTMLCanvasElement> = {};
  await Promise.all(entries.map(async ([levelId, blob]) => {
    const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    bitmap.close();
    thumbs[levelId] = canvas;
  }));
  return thumbs;
}

/**
 * Saves the thumbnails for a version (replacing any older version's), then marks it saved.
 * @param build the version
 * @param thumbs level id -> thumbnail
 * @returns resolves when saved
 */
export async function saveThumbs(build: string,
  thumbs: Record<string, HTMLCanvasElement>): Promise<void> {
  const blobs = await Promise.all(Object.entries(thumbs).map(([levelId, canvas]) =>
    new Promise<[string, Blob | null]>((resolve) =>
      canvas.toBlob((blob) => resolve([levelId, blob]), 'image/png'))));
  const database = await openThumbDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    store.clear();
    for (const [levelId, blob] of blobs) if (blob) store.put(blob, levelId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  localStorage.setItem(SAVED_KEY, build);
}
