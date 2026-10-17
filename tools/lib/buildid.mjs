// buildid.mjs - a fingerprint of the game's code: sha-256 of every file under src/ (path + content,
// sorted), first 12 hex digits. serve.mjs and tools/build.mjs put it in the bundle as
// globalThis.__RAC3R_BUILD__, so the game can tell one version from the next (the menu's saved
// thumbnails, src/menu/thumbcache.js).
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

/**
 * Every file under a folder, recursively.
 * @param {string} dir the folder
 * @returns {Promise<string[]>} full paths
 */
async function listFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(full));
    else out.push(full);
  }
  return out;
}

/**
 * The fingerprint of the code under root/src.
 * @param {string} root the repository root
 * @returns {Promise<string>} 12 hex digits
 */
export async function sourceHash(root) {
  const src = join(root, 'src'), hash = createHash('sha256');
  for (const file of (await listFiles(src)).sort()) {
    hash.update(relative(src, file).replaceAll('\\', '/'));
    hash.update(await readFile(file));
  }
  return hash.digest('hex').slice(0, 12);
}
