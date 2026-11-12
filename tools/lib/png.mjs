// tools/lib/png.mjs - PNG READ AND WRITE for the tools (no dependency: node's zlib): decodePng
// reads an 8-bit RGBA / RGB / palette PNG to RGBA pixels; encodePng writes RGBA pixels as the
// smallest lossless PNG it finds - a palette one (with its alpha) when the picture has at most 256
// colours, else RGBA - each row with the filter that packs it best. The shipped track thumbnails
// (tools/thumbs.mjs) are written with it: the browser's own PNG was full colour.
import zlib from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// PNG colour types: palette, RGB, RGBA
const PALETTE = 3, RGB = 2, RGBA = 6;
// a palette holds at most this many colours
const PALETTE_MAX = 256;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let crc = n;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    table[n] = crc >>> 0;
  }
  return table;
})();

/**
 * A chunk's CRC (over its type and data).
 * @param bytes the type and data
 * @returns the CRC
 */
function crcOf(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * One PNG chunk: length, type, data, CRC.
 * @param type the four-letter type
 * @param data its data
 * @returns the chunk's bytes
 */
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crcOf(body), 8 + data.length);
  return out;
}

/**
 * The Paeth predictor (PNG filter 4).
 * @param left the byte to the left
 * @param up the byte above
 * @param upLeft the byte above-left
 * @returns the predicted byte
 */
function paeth(left, up, upLeft) {
  const guess = left + up - upLeft;
  const toLeft = Math.abs(guess - left), toUp = Math.abs(guess - up);
  const toUpLeft = Math.abs(guess - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
}

/**
 * Undoes one row's filter in place.
 * @param kind the filter (0-4)
 * @param row the row's bytes (filtered in, plain out)
 * @param above the row above, plain (zeros for the first)
 * @param step bytes per pixel
 */
function unfilterRow(kind, row, above, step) {
  for (let i = 0; i < row.length; i++) {
    const left = i >= step ? row[i - step] : 0, up = above[i];
    const upLeft = i >= step ? above[i - step] : 0;
    const add = kind === 1 ? left : kind === 2 ? up : kind === 3 ? (left + up) >> 1
      : kind === 4 ? paeth(left, up, upLeft) : 0;
    row[i] = (row[i] + add) & 0xff;
  }
}

/**
 * Reads a PNG (8 bits a channel; RGBA, RGB or palette; not interlaced).
 * @param bytes the file
 * @returns { width, height, rgba } (4 bytes a pixel)
 */
export function decodePng(bytes) {
  if (!bytes.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');
  let width = 0, height = 0, type = 0, palette = null, alpha = null;
  const parts = [];
  for (let at = 8; at < bytes.length;) {
    const length = bytes.readUInt32BE(at), kind = bytes.toString('ascii', at + 4, at + 8);
    const data = bytes.subarray(at + 8, at + 8 + length);
    if (kind === 'IHDR') {
      [width, height, type] = [data.readUInt32BE(0), data.readUInt32BE(4), data[9]];
      if (data[8] !== 8 || data[12] !== 0) throw new Error('only 8-bit, not interlaced');
    } else if (kind === 'PLTE') palette = data;
    else if (kind === 'tRNS') alpha = data;
    else if (kind === 'IDAT') parts.push(data);
    at += 12 + length;
  }
  const step = type === RGBA ? 4 : type === RGB ? 3 : 1, stride = width * step;
  const raw = zlib.inflateSync(Buffer.concat(parts)), rgba = Buffer.alloc(width * height * 4);
  let above = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const row = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    unfilterRow(raw[y * (stride + 1)], row, above, step);
    for (let x = 0; x < width; x++) {
      const out = (y * width + x) * 4;
      if (type === PALETTE) {
        const index = row[x];
        palette.copy(rgba, out, index * 3, index * 3 + 3);
        rgba[out + 3] = alpha && index < alpha.length ? alpha[index] : 255;
      } else {
        row.copy(rgba, out, x * step, x * step + 3);
        rgba[out + 3] = type === RGBA ? row[x * step + 3] : 255;
      }
    }
    above = row;
  }
  return { width, height, rgba };
}

/**
 * Filters every row with the filter that leaves the smallest sum of bytes (as signed), the usual
 * pick for packing.
 * @param pixels the plain rows, back to back
 * @param stride bytes a row
 * @param step bytes a pixel
 * @returns the filtered data (each row its filter byte first)
 */
function filterRows(pixels, stride, step) {
  const height = pixels.length / stride, out = Buffer.alloc(height * (stride + 1));
  const trial = Buffer.alloc(stride);
  let above = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const row = pixels.subarray(y * stride, (y + 1) * stride);
    let bestKind = 0, bestCost = Infinity;
    for (let kind = 0; kind <= 4; kind++) {
      let cost = 0;
      for (let i = 0; i < stride; i++) {
        const left = i >= step ? row[i - step] : 0, up = above[i];
        const upLeft = i >= step ? above[i - step] : 0;
        const sub = kind === 1 ? left : kind === 2 ? up : kind === 3 ? (left + up) >> 1
          : kind === 4 ? paeth(left, up, upLeft) : 0;
        trial[i] = (row[i] - sub) & 0xff;
        cost += trial[i] < 128 ? trial[i] : 256 - trial[i];
      }
      if (cost < bestCost) {
        bestCost = cost;
        bestKind = kind;
        trial.copy(out, y * (stride + 1) + 1);
      }
    }
    out[y * (stride + 1)] = bestKind;
    above = row;
  }
  return out;
}

/**
 * Writes RGBA pixels as the smallest lossless PNG found: a palette one when there are at most 256
 * colours, else RGBA.
 * @param width px
 * @param height px
 * @param rgba the pixels, 4 bytes each
 * @returns the file
 */
export function encodePng(width, height, rgba) {
  const indexOf = new Map(), colours = [];
  for (let i = 0; i < rgba.length && colours.length <= PALETTE_MAX; i += 4) {
    const key = rgba.readUInt32BE(i);
    if (!indexOf.has(key)) {
      indexOf.set(key, colours.length);
      colours.push(key);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  const parts = [SIGNATURE];
  let data;
  if (colours.length <= PALETTE_MAX) {
    header[9] = PALETTE;
    const palette = Buffer.alloc(colours.length * 3), alpha = Buffer.alloc(colours.length);
    colours.forEach((key, index) => {
      palette.writeUIntBE(key >>> 8, index * 3, 3);
      alpha[index] = key & 0xff;
    });
    const indices = Buffer.alloc(width * height);
    for (let i = 0; i < indices.length; i++) indices[i] = indexOf.get(rgba.readUInt32BE(i * 4));
    data = filterRows(indices, width, 1);
    parts.push(chunk('IHDR', header), chunk('PLTE', palette));
    if (alpha.some((value) => value !== 255)) parts.push(chunk('tRNS', alpha));
  } else {
    header[9] = RGBA;
    data = filterRows(rgba, width * 4, 4);
    parts.push(chunk('IHDR', header));
  }
  parts.push(chunk('IDAT', zlib.deflateSync(data, { level: 9 })), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}
