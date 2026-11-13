// _pngdiffbox.mjs - where two PNGs differ: the count, the box round the differing pixels and a
// few of them with both colours; a third path writes the first marked where they differ.
// node tools/scratch/_pngdiffbox.mjs <a.png> <b.png> [marked.png]
import fs from 'node:fs';
import { decodePng } from '../lib/png.mjs';
const [one, two] = process.argv.slice(2, 4).map((file) => decodePng(fs.readFileSync(file)));
let count = 0, minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
const samples = [];
for (let index = 0; index < one.rgba.length; index += 4) {
  const same = [0, 1, 2].every((ch) => one.rgba[index + ch] === two.rgba[index + ch]);
  if (same) continue;
  const x = (index / 4) % one.width, y = Math.floor(index / 4 / one.width);
  count++;
  [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)];
  if (samples.length < 40 && count % 5 === 1) samples.push(`${x},${y} ${[...one.rgba.slice(index, index + 3)]} / ${[...two.rgba.slice(index, index + 3)]}`);
}
console.log(`${one.width}x${one.height}: ${count} px differ, box ${minX},${minY} - ${maxX},${maxY}`);
console.log(samples.join('\n'));
// with a third argument: write the first picture dimmed with each differing pixel in red, grown
// to 5x5 so a single pixel shows
if (process.argv[4]) {
  const { encodePng } = await import('../lib/png.mjs');
  const marked = Uint8Array.from(one.rgba, (value, index) => (index % 4 === 3 ? 255 : value >> 1));
  for (let index = 0; index < one.rgba.length; index += 4) {
    if ([0, 1, 2].every((ch) => one.rgba[index + ch] === two.rgba[index + ch])) continue;
    const x = (index / 4) % one.width, y = Math.floor(index / 4 / one.width);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const at = ((y + dy) * one.width + x + dx) * 4;
      if (at >= 0 && at < marked.length) marked.set([255, 0, 0, 255], at);
    }
  }
  fs.writeFileSync(process.argv[4], encodePng(one.width, one.height, Buffer.from(marked.buffer)));
}
