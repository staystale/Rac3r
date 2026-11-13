// _dresskits.mjs - A VENUE'S DRESSING (VenueSpec.dress), shared by the generators that lay one
// (_rocdata.mjs, the stadiums; _lalivelydata.mjs, L.A. Lively): kits of the existing prop kinds
// (DRESS_PROPS: VenueSpec.landmarks, solid where their kind is) and loose objects
// (VenueSpec.litter), each [m along, m out, kind, { c: colour index into the venue's colours, size,
// len, seed }] in the kit's own frame. An item that comes within DRESS_RAIL_M of a barrier line,
// inside a stand grown DRESS_STAND_M, or within DRESS_FLAG_M of a flag or floodlight is left out
// (and reported). Not run on its own.

const r1 = (value) => Math.round(value * 10) / 10;
// [m wide, m long] of each prop kind a kit uses (the rest are loose objects)
export const DRESS_PROPS = { truck: [2.5, 14], parkedcar: [1.8, 4.2], tower: [4, 4],
  crowd: [3, 9], sculpture: [4, 4] };
export const DRESS_KITS = {
  transporters: [[0, 0, 'truck', { c: 0 }], [16, 0, 'truck', { c: 1 }]],
  paddock: [[0, 0, 'truck', { c: 0 }], [0, 4.5, 'truck', { c: 1 }], [-11, 1, 'parkedcar', { c: 2 }],
    [-11, 3.6, 'parkedcar', { c: 0 }], [10, 7.5, 'crate'], [11.2, 7.6, 'box'], [12.4, 7.4, 'crate'],
    [-12, 6.5, 'tyre'], [-11.1, 6.7, 'tyre'], [-10.2, 6.4, 'tyre'], [-11.6, 7.4, 'tyre']],
  motorhome: [[0, 0, 'caravan'], [6.5, 0.5, 'parkedcar', { c: 1 }], [-4.5, 0.3, 'bin'],
    [-5.3, 0.2, 'bin'], [-6.1, 0.35, 'bin']],
  tvcamera: [[0, 0, 'tower'], [-6.5, 0.5, 'box'], [-7.3, -0.3, 'crate'], [-6.7, -1.1, 'box']],
  fans: [[0, 0, 'crowd', { seed: 1 }], [11, 0.4, 'crowd', { len: 7, seed: 2 }]],
  showcars: [[0, 0, 'parkedcar', { c: 0 }], [5.5, 0, 'parkedcar', { c: 1 }],
    [11, 0, 'parkedcar', { c: 2 }]],
  podium: [[0, 0, 'podium'], [0, 4.5, 'crowd', { len: 8, seed: 3 }]],
  cones: [[0, 0, 'cone'], [0.6, 0.3, 'cone'], [1.2, 0, 'cone'], [0.6, -0.4, 'cone'],
    [2.2, 0.2, 'cone']],
  bins: [[0, 0, 'bin'], [0.9, 0, 'bin'], [1.8, 0, 'bin'], [3.2, 0.2, 'pallet']],
  tyres: [[0, 0, 'tyre'], [0.9, 0.2, 'tyre'], [1.8, -0.1, 'tyre'], [0.4, 0.9, 'tyre'],
    [1.3, 1.0, 'tyre']],
  sculpture: [[0, 0, 'sculpture']],
};
export const DRESS_RAIL_M = 3.5, DRESS_STAND_M = 1.5, DRESS_FLAG_M = 2.5;

/**
 * Whether a point lies in a turned box grown by a margin.
 * @param box {x, y, w, h, rot}
 * @param point [x, y]
 * @param grow m
 * @returns true when inside
 */
export const inBox = (box, [x, y], grow) => {
  const cosR = Math.cos(box.rot), sinR = Math.sin(box.rot), dx = x - box.x, dy = y - box.y;
  return Math.abs(dx * cosR + dy * sinR) < box.w / 2 + grow
    && Math.abs(-dx * sinR + dy * cosR) < box.h / 2 + grow;
};

/**
 * The distance from a point to a polyline.
 * @param pts the line
 * @param point [x, y]
 * @returns m
 */
export const lineGap = (pts, [x, y]) => {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return best;
};

/**
 * Whether a spot is clear for an item reaching this far: off every barrier line, out of every
 * stand, away from every flag and floodlight.
 * @param site {rails: line[], stands: box[], marks: {at}[], isFree?: (at, reach) => boolean - a
 *   venue's own keep-offs (a street course's roads, blocks and litter)}
 * @param at [x, y]
 * @param reach the item's half width, m
 * @returns true when clear
 */
export const dressClear = (site, at, reach) =>
  site.rails.every((rail) => lineGap(rail, at) > DRESS_RAIL_M + reach)
  && !site.stands.some((box) => inBox(box, at, DRESS_STAND_M + reach))
  && site.marks.every((mark) => Math.hypot(mark.at[0] - at[0], mark.at[1] - at[1])
    > DRESS_FLAG_M + reach)
  && (!site.isFree || site.isFree(at, reach));

/**
 * One kit laid in its frame: each item clear (its middle and both ends along the frame, each
 * with half its width round it) kept, the rest noted in dropped.
 * @param kit the kit's name
 * @param frame {origin: [x, y], along: unit, across: unit (out), rot: rad, cols: colours}
 * @param site what keeps it off (dressClear's)
 * @param dropped the left-out items' notes (added to)
 * @returns the items, each with prop: true for a prop kind
 */
export function layKit(kit, frame, site, dropped) {
  const { origin: [ax, ay], along, across, rot, cols } = frame;
  return DRESS_KITS[kit].flatMap(([forward, outward, kind, opts = {}]) => {
    const spot = [r1(ax + along[0] * forward + across[0] * outward),
      r1(ay + along[1] * forward + across[1] * outward)];
    const shape = DRESS_PROPS[kind], size = opts.size || (shape ? shape[0] : 1);
    const long = opts.len || (shape ? shape[1] : 1);
    const ends = [-long / 2, 0, long / 2].map((shift) => [spot[0] + along[0] * shift,
      spot[1] + along[1] * shift]);
    if (!ends.every((end) => dressClear(site, end, size / 2))) {
      dropped.push(`${kit} ${kind} at ${spot}`);
      return [];
    }
    const col = opts.c === undefined ? undefined : cols[opts.c % cols.length];
    return [{ at: spot, kind, ...(shape ? { size, ...(long !== size ? { len: long } : {}) } : {}),
      rot, ...(col ? { col } : {}), ...(opts.seed ? { seed: opts.seed } : {}), prop: !!shape }];
  });
}

/**
 * The venue file's lines for its dressing: NAME_DRESS (the props) and NAME_DRESS_LITTER.
 * @param name the export's prefix
 * @param items layKit's items
 * @param json the generator's value writer
 * @param where where they stand, for the comment
 * @returns the lines
 */
export function dressLines(name, items, json, where = 'on the apron and in the infield') {
  const strip = ({ prop, ...item }) => item;
  const lines = [`// the dressing pass's props, ${where} (`,
    '// VenueSpec.landmarks)',
    `export const ${name}_DRESS: NonNullable<VenueSpec['landmarks']> = [`];
  for (const item of items.filter((entry) => entry.prop)) lines.push(`  ${json(strip(item))},`);
  lines.push('];', '', "// and its loose objects (VenueSpec.litter)",
    `export const ${name}_DRESS_LITTER: NonNullable<VenueSpec['litter']> = [`);
  for (const item of items.filter((entry) => !entry.prop)) lines.push(`  ${json(strip(item))},`);
  lines.push('];', '');
  return lines;
}
