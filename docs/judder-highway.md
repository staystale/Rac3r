# What the highway does per distance (judder hunt, task 119)

Report only. No source changed. Phone facts: highway flat out = ~24 dropped frames a minute; brands-snatch = 0.
In a dropped frame our sim + draw take ~1 ms and the browser stalls ~40 ms between our frames.

## Method

Laptop (Edge via playwright, 844x390, dpr 2, touch):
`/?touch=1&guide=0&menu=0&rules=0&level=<id>&autopilot=1&traffic=0`, tap, 3 s settle, then 60 s measured.
- Wrappers on `game.cones.spawn / cull / step`; per frame polling of `level._hw.pts[0].s`, `level.subtrack`,
  `level.covers`; `document.createElement('canvas')` counted.
- A temporary local edit of terrain.ts (reverted, not committed) to read natCache size.
- Heap = `performance.memory.usedJSHeapSize` each second (`--enable-precise-memory-info`).
- The laptop showed 0 frames over 25 ms on both levels: it does NOT reproduce the stall. It only shows what each
  level creates and throws away.
- Highway: 3.35 km in 60 s (56 m/s mean). brands-snatch: autopilot lap driving, no road window.

## Operations that run because the car moved (highway)

At 60 m/s the road window slides when less than AHEAD (1100 m) of road is left ahead: it grows 300 m, so one slide
per ~300 m = one every ~5 s. Measured: 11 slides in 60 s. "slide" below = one `stepHighway` call that rebuilds.

| file:line (function) | what | how often | creates / drops | in 60 s |
|---|---|---|---|---|
| highway.js:546 `stepHighway` (main.js:977) | `locate` scan + `q`, `camDir` | 60/s | 2 small objects a step | 3600 |
| highway.js:93 `growTo` | road +300 m | per slide | ~75 point objects | 11 |
| highway.js:389 `dress` | scenery + loose litter | per slide | hundreds of objects + closures | 11 |
| highway.js:560 `P.splice` | drop ~75 points behind | per slide | shifts the point array | 11 |
| highway.js:564-565 `.filter` | props, bumps, barriers, lanes, zones, keep, cuts | per slide | 7 new arrays | 77 |
| highway.js:567 `syncCovers` (218) | `lv.covers = [...]` | when a river leaves | 1 array | 0 |
| highway.js:481 `createSubtrack` | WHOLE new subtrack | per slide | `P.map` ~400 pairs + grid + ribbon | 11 |
| highway.js:487-488 `prepBumps`, `prepBarriersOf` | refit all bumps, barriers | per slide | per-barrier arrays | 11 |
| highway.js:489 `solidsFromProps` | all solids rebuilt | per slide | 1 object per tree / house box | 11 |
| highway.js:568 -> terrain.ts:295 | `natCache = new Map()` | per slide | Map of up to 9127 cells dropped | 11 |
| highway.js:569 -> wear.ts:103 `pruneWear` | walk `wearMap`, delete far | per slide | Map deletes | 11 |
| main.js:984 -> cones.js:492 `spawn` | `live(c)` copy, `fileAtRest` | per slide | ~30 objects each | 11 (343) |
| main.js:985 -> cones.js:493 `cull` | `filter` + `rebuildRestGrid` | per slide | new list, all grid cells | 11 (368) |
| highway.js:248 `clearFields` | 7 `.filter`s + Set | when a later feature drops a field | arrays rebuilt | 0 seen |
| main.js:1025 `hwFrames` | `roadFrame` + new `_hwf` per car | 60/s (autopilot) | 2 objects a car a step | 3600 |
| main.js:1041 `cones.step` | cone physics, `cs`, `v0` arrays | 60/s | 2 small arrays a step | 7203 (also brands) |
| traffic.ts:123-136 recycle | out-of-view cars reused | only with traffic | list changes | 0 (traffic=0) |
| camera.ts:85-92 overview | `paintOverview` again | every 500 m | 1 canvas, old one garbage | ~7 (not counted) |
| tiles.ts:151, 183 `paintTile` | new scratch canvas + tile canvas | ~11 tiles/s | 2 canvases per tile | 656 tiles |
| tiles.ts:428-433 | over 72 tiles: `[...entries()].sort()`, delete | per frame over cap | array + sort | cap held |
| tiles.ts:378 `tiles.clear()` | all tiles | only on level / dpr / layout change | all tile canvases | 0 |
| terrain.ts:261 `natCell` clear | at 60000 cells | never reached on the highway | - | 0 |

Canvases created in 60 s (counted at `createElement`): highway 1349, brands-snatch 1150.
Tiles painted: highway 656, brands-snatch 567.

Same 60 s on brands-snatch: 0 slides, 0 subtracks, 0 spawn / cull calls, 0 natCache resets, 7203 cone steps.
So what only the highway does per distance: the 11 slides (rebuild + filters + natCache drop + cull / refile), the
per-step `hwFrames` / `locate` objects, and ~16 % more tiles and canvases.

## Heap saw-tooth (used JS heap, sampled every second, 60 s)

| level | min | max | drops over 3 MB | sum of those drops | biggest drops (MB) |
|---|---|---|---|---|---|
| highway | 24.6 MB | 45.0 MB | 25 | 165 MB | 16.8, 14.8, 9.4, 9.3, 8.4, 8.4, 8.2, 7.8 |
| brands-snatch | 27.4 MB | 48.7 MB | 24 | 151 MB | 16.6, 9.7, 9.3, 9.2, 8.4, 6.9, 6.8, 6.5 |

- Highway heap, first 15 s: 44.96 41.45 38.23 39.40 24.55 25.91 34.66 29.98 39.50 33.69 26.27 32.79 28.01 27.63 39.48.
- brands-snatch: a regular 5-10 MB tooth about every 2 s, 40 -> 30 -> 38 MB.
- The two saw-teeth look the same: same number of big drops, same size, no upward drift. So the plain amount of
  garbage is NOT different on the laptop. The heap counter cannot say how long each collection took or whether it
  was a minor or a major one (`--js-flags=--trace-gc` would).
- natCache cells each second on the highway: 5704 5788 6016 6540 7131 7611 8315 9127, then 1592 (reset), up ~800 a
  second to 5700, then 189, 1909 ... 5412, 21 ... A reset about every 5 s, each time the whole Map (up to 9127
  cell objects) is dropped. brands-snatch: grows to 19138 and is never cleared.

## Ranking: top 3 suspects

1. **The slide's one-shot throwaways (highway.js:479-490 and 558-568, terrain.ts:295, cones.js:410 / 493).** Once per
   ~5 s, in ONE sim step: new subtrack + grid, 7 filtered arrays, rebuilt solids, `natCache = new Map()` (~9k cells
   dropped), cones list filtered and the rest grid refiled. It is the only thing tied to distance, and it frees a lot
   at once, so a major GC soon after fits. (24 drops a minute is two per slide.)
   Smallest test: `?nonat=1` skips `clearNaturalCache()` at highway.js:568 (the 60000 cap in `natCell` already bounds
   it). Then `?norebuild=1` to skip `prepBumps` / `solidsFromProps` / `cull` refile when nothing changed.
2. **Canvas creation for ground tiles (tiles.ts:151, 183, ~22 canvases a second) and the sort-evict at tiles.ts:428.**
   ~1 ms of our own time and a ~40 ms stall between frames fits Safari allocating / freeing canvas memory late; the
   highway paints ~16 % more tiles than brands-snatch, all because of new ground per distance.
   Smallest test: `?tilemax=144` (a bigger TILE_MAX) or a canvas pool: reuse an evicted tile's canvas for the next tile
   and keep ONE shared scratch, instead of `createElement`.
3. **Per-step small objects only the highway makes (`locate` result `q` + `camDir`, `hwFrames` `_hwf` + `roadFrame`
   result per car, main.js:977 / 1025).** ~4-6 objects a step, ~300 a second, which brands-snatch does not make; they
   feed the minor GCs. A weak suspect on its own.
   Smallest test: `?nohwframes=1` skips `hwFrames` (autopilot only needs it for the stuck check), or reuse one `_hwf`,
   one `q` and one `camDir` object per car.

Not suspects: `tiles.clear()` (only on level / dpr change), `solidsDirty` (a flag), traffic recycling (off in the test;
only a list change), the 60000 natCache cap (never reached).

Not measured: the 40 ms stall itself (no frame over 25 ms on the laptop), the overview repaint count (read from
camera.ts: every 500 m), anything on the phone.

