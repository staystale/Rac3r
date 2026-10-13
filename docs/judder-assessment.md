# Highway judder: leak and per-km allocation assessment (task 126)

Phone fact: the highway drops about 1 frame per 170 m at any speed; circuits drop 0. This report looks for
things the endless highway creates, keeps and never deletes, and for per-km work a circuit does not do.
Measured with `tools/heapcheck.mjs` (re-runnable, see the top of that file). Short answer: **no leak found**.

## How it was measured (and its limits)

- Desktop Edge via Playwright, CDP `HeapProfiler`. URL
  `/?touch=1&guide=0&menu=0&rules=0&level=highway&autopilot=1&traffic=0` (control: `level=brands-snatch`).
- The game runs on a **virtual clock**: `requestAnimationFrame` is captured and pumped by hand at 60 Hz, so a
  km takes seconds. This measures what the code *keeps* and *allocates per km*. It cannot show timing,
  phone GC pauses or GPU memory.
- Distance: `game.hwDist` on the highway; on brands-snatch the sum of the car's movement (an odometer).
- **Shortened runs**: the shell stops commands after 30 s and a snapshot plus parse takes about 10 s, so the
  highway was snapshotted at **2 km and 6 km** (not 10) and brands-snatch at **1 km and 3 km** (not 1 and
  5 laps). A 10 km run was tried and timed out. Each snapshot was taken after a forced GC.
- The sampler's line numbers may be those of the served files, not always the `.ts` source lines.
  Snapshot files went to the OS temp dir and were deleted.

## 1. Leak check

Total retained heap (all node self sizes, after GC):

| Run | Early | Late |
|---|---|---|
| highway, 2 km -> 6 km | 28.94 MB, 1,417,102 nodes | 28.76 MB, 1,384,124 nodes |
| brands-snatch, 1 km -> 3 km | 31.34 MB, 1,543,243 nodes | 32.29 MB, 1,601,705 nodes |

The highway heap did **not grow**: 4 km of road later it is 0.18 MB smaller.

Top growth by COUNT, highway 2 -> 6 km (full top 30: `node tools/heapcheck.mjs snap highway 2 6`):

| Name | +count | +bytes | Held by (retainer path of one example) |
|---|---|---|---|
| array (object elements) | 666 | 35,236 | `(Read-only roots).empty_slow_element_dictionary`: V8's own |
| native system / WeakArrayList | 117 | 37,348 | V8 `(Strong root list).script_list` (scripts compiled) |
| native blink::CachedColor | 105 | 5,040 | canvas 2D state of a small `<canvas 11x11>` |
| native system / ExternalStringData | 54 | 1,397 | module source string of `carsprite.ts` |
| native PerformanceLongAnimationFrameTiming | 38 | 6,688 | `window.performance` buffer (browser) |
| native blink::ShapeResult / Run / Glyph | 25 each | ~1,400 | text shaping cache of the main canvas |
| native blink::Font, CanvasRenderingContext2D | 10-18 | 3-17 KB | browser; +10 contexts, +5 `<canvas 73x28>` |

Top by BYTES: WeakArrayList +37 KB, array +35 KB, CanvasRenderingContext2D +17 KB, then 7 KB and less. All
growers together are about 100 KB over 4 km (25 KB/km). Every one is a browser or V8 structure; the only
objects of ours in the list are 2 scope / closure objects of 56 bytes. No `Map`, `Set` or array of ours grew.
(The small canvases might be a label cache; I did not trace which of our files makes them: 8 in 4 km.)

Control, brands-snatch 1 -> 3 km: it grows by 0.95 MB: `native PropertyArray` +5,818 (+116 KB) and
`object Object` +5,810 (+163 KB, count now 112,258). I did not find which structure holds these. They are
possibly lazily filled caches (terrain `natCache`, `wearMap`: a circuit never prunes them), but that is a
guess, not a retainer path. It is the circuit, which does not judder.

## 2. Per-km allocation (sampling heap profiler, 4096 B interval, major and minor GC included)

One km after a 1 km warm-up (1.08 km highway, 1.05 km brands-snatch). KB per km, self size, top 25 each.
`node tools/heapcheck.mjs alloc highway 1` / `alloc brands-snatch 1`.

| Highway function | KB/km | Brands-snatch function | KB/km |
|---|---|---|---|
| hillShade render/tiles.ts:222 | 33,789 | bumpAt world/terrain.ts:68 | 39,689 |
| naturalHeightAt world/terrain.ts:234 | 26,979 | hillShade render/tiles.ts:222 | 28,540 |
| zoneAt world/zones.ts:40 | 16,411 | naturalHeightAt world/terrain.ts:234 | 23,005 |
| querySubtrack world/tyrewall.ts:51 | 14,193 | querySubtrack world/tyrewall.ts:51 | 16,602 |
| (anon) hud.js:63 | 7,102 | (anon) hud.js:63 | 14,683 |
| (anon) hud.js:105 | 6,575 | (anon) hud.js:105 | 14,620 |
| vnoise world/terrain.ts:213 | 6,471 | posts render/props.ts:51 | 11,507 |
| speedCamera highway.js:583 | 5,825 | (anon) hud.js:58 | 11,369 |
| bumpAt world/terrain.ts:68 | 5,483 | (anon) render/road.ts:338 | 8,484 |
| (anon) hud.js:58 | 4,969 | drawTrackRibbon render/road.ts:45 | 7,610 |
| drawProps render/props.ts:266 | 4,685 | layout hud.js:50 | 6,999 |
| step vehicle.ts:276 | 4,365 | draw hud.js:315 | 6,558 |
| drawTrackRibbon render/road.ts:45 | 3,673 | (anon) render/props.ts:49 | 6,197 |
| layout hud.js:50 | 3,260 | wheelsOf marks.js:152 | 5,592 |
| wheelsOf marks.js:152 | 3,075 | vnoise world/terrain.ts:213 | 5,181 |
| draw hud.js:315 | 2,885 | drawLanes render/road.ts:7 | 4,512 |
| natCell world/terrain.ts:221 | 2,844 | hypot (native) | 4,348 |
| scan highway.js:509 | 2,298 | applyGroundInner world/wear.ts:361 | 3,929 |
| blitStep render/tiles.ts:289 | 2,266 | label hud.js:202 | 3,704 |
| loop main.js:888 | 2,065 | step vehicle.ts:276 | 3,658 |
| applyGroundInner world/wear.ts:361 | 1,803 | loop main.js:888 | 3,579 |
| hypot (native) | 1,802 | drawPaint render/road.ts:243 | 3,529 |
| drive ai/weaver.ts:33 | 1,729 | blitStep render/tiles.ts:289 | 3,420 |
| label hud.js:202 | 1,684 | natCell world/terrain.ts:330 | 3,330 |
| sx render.ts:46 | 1,344 | drawBarriers render/props.ts:43 | 3,177 |
| **total (all functions)** | **203,681** | **total** | **295,395** |

The highway allocates less per km than the circuit in total. These are churn rates (short-lived objects
too). The autopilot speed of the two runs was not recorded, so per-second rates were not compared.

**Highway-only (absent from the circuit's top 25):**
- `zoneAt` 16.4 MB/km (the circuit's is below 3.2 MB).
- `speedCamera` highway.js:583, 5.8 MB/km: it runs a `for (const pr of lv.props)` scan on each call.
- `scan` highway.js:509, 2.3 MB/km, and `drive` ai/weaver.ts:33, 1.7 MB/km (the autopilot driver).

## 3. Check by reading: what the car's movement adds to

| Structure | Grows at | Bounded? Trimmed at |
|---|---|---|
| `wearMap` | wear.ts:205-212 | Yes: `pruneWear` wear.ts:103 (highway.js:575, each slide); `clearWear` :90 |
| `wearDirty` | wear.ts:109, 243 | Yes: `length = 0` wear.ts:92 |
| marks layer | marks.js (one fixed canvas) | Yes: `follow()` re-centres it (marks.js:47-63); `prev` has 4 keys |
| `breadcrumbs` | main.js:1028 | Yes: `shift` over 12 (main.js:1029) |
| `game.flow` flags | highwayrace.ts:132 | Once per race end |
| `_hw.pts` | highway.js:103 | Yes: `P.splice(0, cut)` highway.js:563 |
| `_hw` keep, cuts, props, lanes, zones, covers | highway.js:146, 158 | Yes: `_s >= s0` filter, highway.js:567-569 |
| `_hw.goneFields` | highway.js:255 | Yes: `g.clear()` main.js:994 |
| `_hw.looseNew` | highway.js:560 | Yes: `length = 0` main.js:992 |
| cones list, `restGrid` | cones.js:492, 405-408 | Yes: `cull` cones.js:493 (main.js:993-994) |
| terrain `natCache` | terrain.ts:257-270 | Yes: cleared at 60,000 cells (terrain.ts:253, 261) |
| overview cache `ovCache` | camera.ts:94 | One entry, replaced when `s0` moves (camera.ts:90) |
| traffic `list` / `cars` | traffic.ts:67, 100 | Capped by `MAX_CARS`; `cars.length = 0` on rebuild |
| `_hwf` per car | highwayrace.ts:51 | Replaced every step (one small object per car per step) |
| `camRecord` | main.js:1008-1012 | Counters in one object |
| **`c._cutLog`** | main.js:342, one `[gain, q]` per shortcut | **Never trimmed.** Only grows per counted shortcut |
| sprite, face, obj caches | carsprite.ts:16, cardamage.ts:85, objects.ts:40 | By variety; not read |
| ground tiles | render/tiles.ts | Not read here; the earlier tile tests ruled them out; heap flat |


## 4. Verdict

**LEAKS FOUND**
- `c._cutLog` (main.js:342): one 2-number array per counted shortcut, never trimmed. Growth per km: 0 in
  normal driving, a few dozen bytes per cut. Smallest fix: cap it (`if (log.length > 50) log.shift()`).
  Not a judder source.
- Nothing else. Highway retained heap: 28.94 MB at 2 km, 28.76 MB at 6 km; no JS structure of ours grew.

**PER-KM WASTE (top 5; churn, not retained). I have not tried any fix; these are suggestions from the names**
1. `hillShade` tiles.ts:222, 34 MB/km (28 on the circuit): looks like per-tile allocation; smallest fix:
   reuse the pixel buffer between calls.
2. `naturalHeightAt` terrain.ts:234, 27 MB/km (23 on the circuit): called per sample; smallest fix: avoid the
   per-call temporary (reuse a scratch object or return numbers).
3. `zoneAt` zones.ts:40, 16 MB/km, much higher on the highway (many zones): smallest fix: reuse the
   result and the temporary lists it builds.
4. `querySubtrack` tyrewall.ts:51, 14 MB/km (same on the circuit): smallest fix: reuse the result object.
5. `speedCamera` highway.js:583, 5.8 MB/km, highway-only (plus `_hwf` in highwayrace.ts:51): smallest fix:
   an index loop over the gantry props only; update `_hwf` in place instead of a new object per step.

**Honest verdict.** Our code looks clean on the highway: the heap is flat over 4 km, and every structure that
grows with distance is trimmed when the road window slides. Per km the highway allocates less than the
circuit (204 vs 295 MB/km), so a plain "more garbage" explanation does not fit; a circuit churns more and
does not drop. I cannot explain 6 dropped frames per km from heap growth or allocation volume. Things I
could not see with this method: real-time effects on the phone (a slide plus a major GC in one frame),
Safari's GC, GPU / canvas memory (snapshots show JS shells, not textures), and the exact run length (2 to 6
km, not 10). Use the new "per km:" line on the meter: if the later km are not worse than the early ones, it
is not a leak.

