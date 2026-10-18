# RAC3R - open work

New session? Read `CLAUDE.md`, then `NOTES.md`, then this file. Open items only: finished work is in
the git history. `docs/foreman-handover.md` is the last handover (10-18, cover field), written on request.

## Where we are

- The code quality overhaul (below) is DONE (phases 0-10). Lint: 0 problems. `npm run suite` runs the
  quick checks (pass / fail, exit code); `node tools/runall.mjs --full` adds the slow ones.
- Behaviour is proved unchanged by `tools/worldhash.mjs` (level data), `tools/simhash.mjs` (every car, every
  step), `tools/renderhash.mjs` (pixels) - save the reference on the base commit, then compare.
- Work is foremanned with Bigeon (worker PC + `node ../Bigeon/bin/bigeon.ts`); see `CLAUDE.md`.
- Do not publish to itch.io until the owner approves the converted game.
- NOTES.md holds the owner's rules, decisions and lessons (handovers only on request). Measure
  judder on the owner's iPhone with ?report=1 and tools/phonereport.mjs, not only on the laptop.
- JUDDER FIXED (owner phone runs 2026-10-15, ?report=1): the per-distance hitch of the highway
  and the Lab was marks.js re-centring its 26 MB skid-mark canvas (a new canvas + two full copies)
  each time the car was 136 m (0.45 x MARK_EXTENT) from the layer's centre, on levels that do not
  fit the layer. Now a wrap-around layer (no copy, no allocation). Found on the empty Swindon
  straight: one frame ~12 ms late every 3.5 s = 136 m at 140 km/h, our JS 1-3 ms. After the fix:
  Swindon no rhythm (27 s clean); old highway hands-off 3 slow frames in 48 s (0.06 %, was ~0.5 %),
  owner "no visual drops"; Lab driven by hand 0.41 % single-refresh misses (Safari tab; the owner's
  hand-driven Knobhill run from the home screen 0.19 %), owner "much better, a couple of drops".
  The 10-13 "inside Safari" verdict was wrong: it was our canvas copy, deferred by Safari.
- HIGHWAY REBUILD CANCELLED (owner): it was planned only because of this hitch. The test
  straight (Straight Outta Swindon) was REMOVED 2026-10-17 (owner; in git history). NAME NOTE
  (owner): "Straight Outta Swindon" is RESERVED for a future highway level; every highway level
  gets its own name. Fixes it brought stay, for every level: the inclusion scan covers the floor
  rectangle, drawPatches reads PATCH_GRID, drawKerb draws only blocks in view, zoneAt treats a
  sector-less road as tarmac, the overview caps its long side at 4096 px.
  Still O(track points) (fine at 3000 points): drawTrackRibbon walks every centreline point per
  tile; session.js updateRecoveryTracking scans every point each sim step.
- TEST LIST EMPTY (owner, 2026-10-17): sound, joker, markedge, ainowait, judder all passed
  ("we may come back to judder"; ?nolock=1 still exists).
- MENU FREEZE (~125 ms, ~16 frames after the menu shows, every phone run): CAUSE FOUND 10-17 -
  OUR draw (111-119 ms in the frame before the long dt; the 10-17 handover read the wrong frame):
  the ground tiles behind the menu reach the long-grass texture (textures.ts tintedBlades, its
  blade masks) before the idle warm-up (one texture / 60 ms) does. Owner approved trying, in
  order, with a phone test each: A texwarm (paint the blade textures while loading): phone, the
  ~125 ms frame gone (owner: felt better), the DEFAULT since 2026-10-17 (?texwarm=0 = off). B save
  painted textures per version and C paint textures on a worker: NOT DONE - they only speed up
  loading (texture painting is in none of the slow frames), not the judder.
- MENU / RACE JUDDER (owner, 10-17: "whole picture hitches"): (1) menu race zoomed out, our draw
  16-21 ms every ~9th frame = the wear drain (0.15 s) marking worn tiles stale, then all repainted
  in one frame (with nothing missing the frame budget is unlimited). ?stalecap=1 (one stale
  repaint a frame) cut frames painting 2+ tiles 4-19 -> 1-2 on the laptop, but the owner felt the
  race WITH it juddery and without fine (phone data: same) - UNDONE 10-17. (2) Castle Cum autopilot
  races back to back (13:02 / 13:03): 3-4 dropped frames a minute, 0.5-0.7 % off-beat, our JS
  2-3 ms - the best race runs on record; the owner still sees occasional drops. SHARPNESS 1.5
  (was 2) is the DEFAULT since 10-17 (?dpr=2 = old; owner: "no blurrier"): two back-to-back pairs,
  4.5 vs 8.4 drops a minute, slow frames of ours 16 vs 33. Still ours in those runs: (a) the race
  start, one 45-60 ms frame as the fly-in hands over (40-48 tiles uploaded at once); (b) worn-tile
  repaints every 9th frame (wear drain), dt 20-25. The rest: Safari.
  (a) startfix, the DEFAULT since 10-17 (owner: "removed fly in judder"; ?startfix=0 = old): a wear reset stales only tiles holding wear (the race start
  staled every tile; the hand-over repainted 48-77 in one frame); the fly-in on the GPU ground
  pre-paints only the fixed step over the hand-over view and uploads each tile as painted; it
  readies the hill shading in its 2 ms budget; colours are read through one reused canvas (all 27
  the GPU ground reads are identical). Laptop race start: worst frame 83-160 ms -> 11 ms. Phone: the
  uploads moved to the first fly-in frame (46 + 58 mipmaps): now at most FLY_PREFETCH a frame.
  (b) next if wanted: wear drawn as its own GPU layer (no stale tiles at all).
  Also seen on the laptop only: the GPU ground's first frame (glground.ts parseColour ~20-25 ms).
- CORNER JUDDER (owner screen recording, 10-17 15:35): Safari HELD ~6 frames a second (50 in 8 s)
  from corner 2 on while our rAF and physics were even. Owner switch test: no ground = judder free,
  no props = nearly none, no hill shading = less. tools/drawload.mjs (drawing asked per frame,
  Castle Cum corner 2, zoomed out): ground-square painting ~5,600 path pieces / 450 strokes / 220
  fills a frame (each square traced the WHOLE track: ~7,000 pieces a square); the minimap ~200
  strokes a frame (its fade a segment at a time); GPU ground light (~5 screens of pixels).
  ?drawlite (the ribbon cull restored + 2 squares a frame + minimap fade steps) cut that drawing
  ~80 % but the phone held as many frames (recordings 16:28: 69 in 14 s with it, 78 in 15 s
  without): UNDONE (git e5c8a21 has it). ?glground=0 (the old 2D ground: ONE canvas) held 9 in
  15 s (16:40). CAUSE: Safari compositing two full-screen canvases updated every frame (the WebGL
  ground under the 2D canvas). Fix under way: ?onecanvas=1 - the finished WebGL ground drawn into
  the 2D canvas as its bottom layer each frame, the WebGL canvas hidden (WebGL -> 2D can stay on
  the GPU; 2D -> WebGL each frame juddered before).
  ?onecanvas=1 held 48 (17:21); the ORIGINAL build held 0 at the corners (17:31).
- LEAN DRAWING PLAN PAUSED, DEFAULT KEPT (owner, 2026-10-17 night: "our default link is working
  pretty good ... let's move on"). Lean = ?glground=0&sharpcars=0&sharpmarks=0 (no new code;
  the CPU path bakes the hill shading into the tiles). Owner recordings (Castle Cum, autopilot):
  lean held 0.3-0.6 frames a second (Safari default 4-5, the original 0.6); ?minimap=0, ?dpr=1.25
  and a zoom held still (?zoomfix, removed) made no difference. The SAME default build in
  DuckDuckGo (iOS WebKit too): the owner saw no holds, menu included; Safari held 42 in 10 s.
  So the holds are how Safari shows the page, not our drawing. Before itch: record the
  home-screen app (no Safari toolbar over the game). Parked: fixed zoom steps (only for the
  edge dance in the lean path).
- WEATHER DONE and the DEFAULT (10-18; "GRASS GRIP + WATER" below). TYRE WEAR the DEFAULT, its
  test open (?tyrewear=0 off). NEXT: LIGHTING / time of day (the owner's brief in docs/foreman-handover.md), on
  its own switch. Owner also saw a very minor jerk behind the main menu (DuckDuckGo): not looked at.
- GRASS THROUGH THE CRACKS (owner: a and b, "like real life"): long-grass tufts in some
  broken-tarmac flecks, and scattered on broken-tarmac / concrete ground (blend.ts, own random
  stream: every existing patch unchanged). OWNER APPROVED 2026-10-16 (testlist entry deleted).
- Then: ground on the GPU phase C (cars, props as GPU sprites), one canvas, delete the old tile
  machinery. The GPU ground and the zoom hold are the default since 2026-10-16 (owner approved;
  ?gpupaint=0 / ?zoomhold=0 = the old paths). Frame pacing is done and default.
- URL SWITCHES (owner rule, 2026-10-16): the plain link is the game with everything approved. A
  ?switch is only for a change under test, and it becomes the default the day the owner approves
  it; the owner's link is the plain one plus that switch. renderhash pins ?gpupaint=0 (the GPU
  painter rasterised on the CPU is ~3.5 min a level); RAC3R_QUERY=gpupaint=1 proves the GPU path.

## CODE QUALITY OVERHAUL

Standards: `CLAUDE.md` section 2. Behaviour must not change unless a phase says so.

- [x] 0-6. Baseline, tooling (package.json, ESLint, TypeScript), shared `src/core/`, `lab.js` split into
  `src/world/`, `render.js` split into `src/render/`, one AI engine, performance pass.
- [x] 7. Rename pass and function splits: every name descriptive, lines under 100, functions under 80
  lines and complexity 15, files under 800 lines; lint 0 problems.
- [x] 8. Tools: no hardcoded user paths (`tools/lib/browser.mjs`), one-off scripts in `tools/scratch/`,
  one runner (`npm run suite`).
- [x] 9. Docs: TODO.md open items only, ENGINE.md an architecture overview, HANDOVER.md folded in
  and removed, owner spec dumps in `docs/specs/`; no dates, task numbers or quotes in code comments
  (owner quotes became "(requirement: ...)" notes; tools/samecode.mjs SAME).
- [x] 10. CI: `verify` (required for `main`) and `checks` (the suite against the base commit,
  `.github/workflows/checks.yml`) on every push; `CONTRIBUTING.md`.

Owner decisions (2026-10-11):
1. `package.json` with dev-only tools: yes. TypeScript needs a build step: esbuild, run by `node serve.mjs` before serving, so the routine stays the same. The itch.io build is one bundled file.
2. Target: modern phones (owner tests on iPhone 17 Pro Max). Measured on desktop with CPU throttled 4x: median frame 8 ms, 95th percentile 14 ms.
3. There is only one AI engine (`src/ai/`: the circuit driver and the highway weaver); `src/highwayrace.ts` holds the highway race rules.
4. TypeScript. Convert in place, phase by phase, not a rebuild: behaviour is proven unchanged by the phase 0 baseline. Playtest on the phone as often as possible, after every phase that touches visible behaviour.
5. Reviews: rely on automated checks (`node tools/verify.mjs`, later lint and the regression suite in CI); the foreman spot-checks diffs and reviews the whole project now and then.
Order: the overhaul first. LEVELS + EVENTS and every older item wait until it is done. Do not publish to itch.io until the owner approves the converted game.
Known bugs found during the overhaul (wait until it is done, they are not caused by it):
- RX race, two jokers: `node tools/racecheck.mjs` (slidden-hill) fails case C. The car is put through the joker gate on lap 2 and again on lap 3; the race never finishes (stuck on lap 3 after 8 minutes, no +30 s penalty). Same result on the original code (commit 857f105, checked 2026-10-12), so it is older than the overhaul. Not yet known whether the game or the test is wrong (the test teleports onto the gate; joker detection became a line that must be crossed on 2026-10-07). Cases A, B and practice pass. racecheck takes about 18 minutes, so it is not in the baseline run.
- Highway tests failing on the code before these changes too (checked 2026-10-12 on ab938eb and later): `node tools/hwracecheck.mjs` "no racer wrecked (2)" (2 FAILs, counts vary per run), `node tools/trafficcheck.mjs` "motorway: traffic stays on the carriageway (30 car-steps off)", `node tools/treadmillcheck.mjs` "motorway: no litter in a driving lane (2)". Not caused by the overhaul; look at them with phase 5 (AI).
- AI weak spots measured in phase 5 (same as the phase 0 baseline, so not caused by the overhaul; improving the AI changes behaviour, so after the overhaul): pacesuite BAD runs 3/9 (a racer far off the road or wrecked); weavecheck: spun in 5 and over 1 m wide in 5 of 45 scenarios (all at 240 km/h); aifieldsuite: 4.0 incidents per race.
- Idea: a floor (e.g. 0.10) under (1 - use^2) in the friction ellipse, so a tyre keeps a little lateral grip under full braking / wheelspin. Not implemented; try in a handling pass if cars lose all steering there.

## AFTER THE OVERHAUL - GROUND ON THE GPU (owner, 2026-10-15)

Owner: the ground textures "repaint and change as zoom changes", worst "near fully zoomed out"; "normal games
don't have this issue". Decision: fix it by changing how the ground is drawn, AFTER the code overhaul; both steps.

Cause (measured): the ground is painted on the CPU into cached tiles at fixed zoom steps (ZSTEP 2 per doubling)
in a low-res art-pixel buffer (~15 art px/m at zoom 1, ~4.6 at ZOOM_MIN 0.30), then each frame stretched or
shrunk to the camera's exact zoom with smoothing off. Textures hold TEX_PPM 17.3 texels/m. As the zoom creeps,
different pixels are dropped or doubled each frame = flicker. tools/zoomcheck.mjs measures it; with
ZOOMS="0.33,0.325,0.32,0.315,0.31,0.305,0.3" (one patch, tiny zoom changes) main flickers 5.7 % of pixels.
Tried, not kept: a halving mip of each texture (5.7 -> 4.3 %, task 224 / branch worker/224), tiles only
stretched (3.3 %), smoothing when a tile shrinks (2.2 %, loses grain far out). Kept: one texture painting per
surface (task 218), one water look, hill shading on a world grid with 0.5 m cells (tasks 220, 222).

- [x] A DONE (owner phone test pending): src/render/glground.ts draws the cached tiles with WebGL2 at screen
      resolution (sharp-pixel filter; mipmaps when shrunk); ?glground=0 = the old 2D path (renderhash SAME).
      zoomcheck tiny zoom changes at full zoom-out (ZOOMS 0.33..0.30, brands-snatch): 5.7 % -> 1.4 % of
      pixels; framecheck brands-snatch work median 10.4 -> 10.5 ms (noise), highway same.
- [ ] (was A, for reference) keep the CPU tile painter, but draw the cached tiles to the screen through WebGL with mipmaps and
      trilinear filtering (a ground canvas under the 2D canvas for cars, props and the HUD). Check the existing
      `tileGpu` setting (src/render/tiles.ts TILE_GPU) first. Goal: zoomcheck flicker near 0 with the pixel-art
      look kept. Phone test.
- [x] B1 DONE, the DEFAULT since 2026-10-16 (owner approved; ?gpupaint=0 = off): src/render/glpaint.ts paints the floor
      (level base, or the lab floor with its glow and grid) and every zone (plain, rotated, rounded
      with apron) on the GPU every frame at TEX_PPM texels per metre, sampling the textures.ts
      textures in world space (sharp-pixel filter, mipmaps when a texel is under a pixel), shape edges
      on the world texel grid, snapped to the same palette as the tiles (32^3 lookup texture). The
      tiles leave those fills transparent and are drawn over them. The view lock no longer rounds the
      zoom to the tile step on this path (that rounding alone made a step shift: zoomcheck GPU-only
      ground 5.0 % -> none with it off). Measured (zoomcheck --at, 0.9 -> 0.3 in 0.05 steps): inside
      the sandbox gravel pad the step spikes 9.4 / 12.1 / 16.1 % -> none (max 5.0 %, even across
      steps); on the Lab lanes the panel labels and lane rims (still in the tiles) still jump at steps.
      framecheck (CPU x4): GPU paint 0.4 ms a frame median; highway tile 17.6 -> 11.1 ms; work median
      within noise. renderhash SAME (default and ?glground=0).
      Still in the tiles, to move: labels and rims of boxed / rounded panels and the lab seams (to
      per-frame 2D in B2, when the tiles go).
- [x] B2 OPTION A (owner chose it over GPU geometry), the DEFAULT since 2026-10-16 (owner approved):
      the tiles that still carry track / lanes / kerbs / wear / labels are painted at ONE fixed
      density (the zoom-1 step) whatever the zoom; the GPU scales them (sharp filter, mipmaps) and
      snaps each opaque texel to the palette (no CPU readback); everything the widest zoom shows is
      prefetched, one tile a frame. Tiles are CPU-backed canvases (a GPU tile canvas moved the
      surface texture on every pattern fill: 2.7 s in 900 highway frames). Measured: no zoom-step
      spikes on the Lab lanes, no brightness flash (4 levels, max jump 0.25-0.73). framecheck CPU x4:
      sandbox slow frames 29-31 (default) -> 23, p95 18.7 ms; highway worst 213-232 -> 70-90 ms but
      ~660 tiles a lap (2.7 ms + ~1.2 ms GPU upload each), slow frames 81 -> 98, median 10 -> 13 ms.
      Next: the cached height field (GC pauses), the incremental highway road build.
- [x] FRAME PACING (default, ?vsync=0 = off): the owner's iPhone (Safari) reports frame times rounded to
      whole ms (16 / 17 / 18, pairs like 24 + 10) while the display runs 16.68 ms; the world moved
      unevenly = the constant fine shake on every level, the original too. game/pacing.ts advances
      whole display refreshes. Owner: "better". Remaining: occasional whole-world hitches, ~0.5-0.8 %
      of frames, outside our JS (sim ~1 ms, draw ~3 ms on the phone): suspect GC (~24 MB/s of garbage
      at highway speed) - next: the allocation diet (terrain lookups, traffic contacts, HUD layout).
- [ ] PHONE REPORTS: ?report=1 posts frame timings to serve.mjs /__report (RAC3R_REPORT_LOG).
- [ ] THE LAB JUDDERS (owner phone test, 2026-10-15): also in the 10-08 original, circuits do not.
      CAUSE FOUND AND FIXED: the Lab rectangle does not fit the marks layer, so it re-centred the
      26 MB layer every 136 m (see "JUDDER FIXED" above). Owner, after the fix: "much better, a
      couple of drops" (0.41 % in a Safari tab, hand-driven; Knobhill from the home screen 0.19 %).
- [x] LAB SPLIT (owner, 2026-10-15; done 2026-10-16; OWNER APPROVED on the phone 2026-10-16, 'all tested fine'):
      today's Lab is three levels on the lab floor at the same world coordinates
      (src/world/levels/lab-extension.ts). OG Lab (id 'lab'): the four squares only, its old
      520 m floor and south edge back - identical to the old Lab inside the square (renderhash
      SAME). Surface Bowling Alley ('bowling-alley'): the 17 surface lanes and their objects,
      spawn at the head of the first lane; the simhash cone run moved here and is SAME (car and
      every lane object). The Rough Patch ('rough-patch'): the off-road area, spawn on the dirt
      loop. Zones, hills and objects are the same values; the random blend squares and the gentle
      natural ground roll re-rolled (seeded by level id). OG Lab fits the skid-mark layer again
      (plain path); the other two lie south of the layer's centre, so they use the wrap-around.
      Found while testing: launching any lab-family level from the menu threw in recoverAI for a
      moment (the menu demo's AI stepped on a level with no racing line until the deferred
      spawnAI); doRestart now clears the old field at once.
- [x] B4a HILL SHADING ON THE GPU + flash fixes, the DEFAULT since 2026-10-16 (owner approved; owner saw
      the terrain flash brighter at zoom changes). src/render/glshade.ts: the tiles' shade cells (same
      heights, bands, colours; tilesShade.ts shared) computed per 8 m chunk into a world grid texture
      kept for the widest zoom, drawn over the ground every frame. The flash itself (tools: mean
      brightness per frame over a 1 -> 0.35 zoom glide) was two tile stand-ins drawn over the GPU
      ground: the flat level overview (now skipped on this path) and old + new zoom step tiles
      stacked (now masked with the stencil). One-frame brightness jumps: knobhill 1.71 -> 0.21, lab
      1.90 -> 0.69 (default path 0.21 / 0.65). framecheck CPU x4: highway tile 17.5 -> 5.8 ms, frames
      over 33 ms 70-78 -> 25-68, worst 230 -> 53-71; but median work +2-3 ms (terrain height
      lookups for the shade chunks, 832 of 1025 ms; a shared height cache could cut ~1/3).
- [x] SMOOTH ZOOM MOVES, the DEFAULT since 2026-10-16 (OWNER APPROVED: "zooms good"; was behind
      ?zoomspring=1; glideZoom deleted, ?zoomhold=0 = the old eased zoom). Owner 2026-10-16: "still
      a bit of chunkylumpy zoom out nearly 3/4 the way fully zoomed out". Measured
      (straight-outta from rest, phone size, CPU x4): the zoom hold went out in a staircase - 6
      glides of ~0.8 s with stops of up to 1.6 s, some ending and the next starting at once - as
      each glide ran to the target of its start while the target ran on. camera.ts springZoom: a
      critically damped spring on log zoom that chases the target as it is now, one way only, and
      eases to a stop within 5 % of it: from rest to full zoom-out is one move. wobblecheck sandbox:
      zoom still in 45 % of frames (glides 64 %); a brisker spring brought a stop back. On the
      owner's OK: make it the default, delete glideZoom.
      Owner 1st look (2026-10-16): "zoom is smooth now"; asked: zoom out a bit easier with speed,
      and no bounce at the start. The bounce was the averaged speed carrying the menu demo's
      79 km/h into the launch (after the fly-in the zoom went out with the car still, then back):
      the fly-in now forgets it. Zoom-out starts at 12 % off (zoom-in keeps 20 %), and the view keeps
      1.2 x LOOKAHEAD of road: full zoom-out at 159 km/h (was ~183). All behind ?zoomspring=1.
- [x] ZOOM HOLD, the DEFAULT since 2026-10-16 (owner approved; ?zoomhold=0 = eased; owner: textures "shake really small
      amounts", motion sickness; highway judder). Measured: with a still camera the ground glides
      (no jumping pixels on either path); camera jerk 0.02 px; but the eased speed zoom moved the
      screen edge 0.83 px a frame and was still in only 21-22 % of frames (wobblecheck). The hold
      keeps the zoom until the target is 20 % away, then one 1.2 s eased glide: still in 51-62 %.
- [ ] B (L/XL, its own phase): move the ground painting itself to the GPU (surface textures uploaded once;
      zones, water, wear, skid marks, road, kerbs and hill shading as shaders / textured geometry). Goal: no
      tile painting on the highway (today ~17-18 ms a tile against a 6 ms frame budget: the old highway
      judder). Measure tools/framecheck.mjs highway and brands-snatch before and after; phone test.

- [ ] MENU SLOWNESS (owner 2026-10-16: "the first load in of the game seems a bit heavy and slow and
      the menu while the background race happens can be a bit laggy / slow if tapped quickly").
      MEASURED (CPU x4, 844x390): menu usable after 7.7 s with one 5.5 s freeze; menu frames 53 ms
      (the live 5-car race took the whole CPU); TEST MODE tap 4.0 s (thumbnails: every level built
      in full, 2.0 s of it ground detail invisible at 320 px). Fixed: the menu race is a RECORDING
      (owner: "can it just be a recording not a live race?"; src/game/menuvideo.js plays
      media/menu-race.mp4 from a blob, poster media/menu-race.jpg; the game neither steps nor draws
      behind it; ?menulive=1 = the live race); thumbnails use a light level build and are painted
      in the background while it plays; the nine rally stages are generated on first use
      (load.ts buildLevel; identical content, only tape run ids / key order differ, so worldhash
      lists them); trackKit's onLane uses a segment grid (worldhash SAME). After: menu usable 4.2 s,
      biggest freeze 2.8 s, TEST MODE tap 0.32 s, menu frames 18 ms. OWNER ON THE PHONE: "the video
      plays really slowly and laggy worse than the normal one and comes in part way thru ... wind
      back you didn't get a test first" - the live race is back (recording parked behind
      ?menuvideo=1); kept: light thumbnails (TEST MODE tap 4.0 -> 2.2 s live), stages on first use,
      the lane grid. Owner: hopefully the graphics update helps the intro / menu lag; work on it
      after if not.
- [ ] PERFORMANCE (owner-agreed order 2026-10-16; see docs/foreman-handover.md "In progress").
      MEASURED (Brands, 4 AI, CPU x4): simulation ~59 % (wheel ground checks 2.7 s / 15 s, AI 1.7 s,
      physics 2.1 s), drawing ~38 % (ground tiles 1.8 s, kerb teeth 0.5 s, HUD 0.9 s).
      ORDER (owner, 2026-10-16): the graphics work (2, 3) FIRST; the rest of 1 after it.
      1. Ground checks: near-hint search +-4 first (tyrewall.ts NEAR_FIRST): querySubtrackInto 0.96
         -> 0.33 s, applyGround 2.68 -> 2.13 s, simhash SAME - DONE. Next: fewer samples per step
         behind ?groundlite=1 (lap-time proof) - OWNER: "a good idea", after the graphics work,
         and a phone test when in doubt. DONE 2026-10-17 as ?groundlookup, the DEFAULT (owner:
         "seems okay"; ?groundlookup=0 = the old ~22; wear.ts setGroundLookup, on by default
         there too so the headless tools match the game): each wheel's slope from its
         own height + one step along x and y (forward differences, 3 lookups not 4), the bump
         steer reusing the front wheels' heights, the front axle's slope the mean of its wheels:
         12 height lookups a car a step instead of ~22. Applies to every car alike (off-screen AI
         included). tools/scratch/_groundlookup.mjs (AI, difficulty 4, 7 circuits, same seed):
         2nd lap time +0.01..+0.06 s, racing line max 0.04-0.10 m apart (mean 0.01 m); ground
         code 16-22 -> 11-16 us a car a step. Switch off: simhash SAME. Height map rejected. Off-screen AI at half rate: owner
         "probably ok to consider if we need more performance" - SAVED for later, not now.
      2. Ground tiles: MEASURED (2026-10-16, tools/tilecost.mjs + a race profile; Brands, 4 AI,
         CPU x4, 90 s): tile painting ~11 % of the CPU, ~20 tiles/s at 5.7 ms; 98 % of them
         prefetch for the widest zoom; 87 % of a tile's cost was the ribbon (3.6 s) and the kerb
         teeth (3.4 s) traced for the WHOLE track per tile and clipped by the canvas. Longer-kept
         tiles REJECTED: with no cap lap 2 paints ~0, but a Brands lap is ~1650 tiles (~190 MB of
         canvas + about as much again in GPU textures) - too much for the phone.
         TRIED AND UNDONE (8022db6, reverted): option A, each tile traced only the ribbon / kerbs
         in it (span outlines clipped to the tile, Sutherland-Hodgman), behind ?ribboncull=1.
         Laptop: tile 5.5 -> 3.4 ms, frames over 33 ms 228-235 -> 146-174; not bit-identical
         (Chrome picks its anti-aliasing method by a path's point count: a few edge pixels).
         OWNER ON THE PHONE: "the change seems to be making tracks judder" -> "fix it or undo
         it": undone (cause not found; one run, Castle Cum, 0.43 % slow frames, 7 of 9 painting
         tiles, no run without the switch to compare). Before a second try: a back-to-back phone
         A/B (?report=1 with and without), and suspect the tile budget (TILE_MS 6 ms lets a frame
         paint MORE cheaper tiles, each a GPU upload + mipmaps) and per-tile edge shading.
      3. Phase C GPU sprites -> one canvas -> delete the old tile machinery; then the menu video.
         C1 MOCKUP (tools/scratch/carmock.html: A today, B GPU, C pre-turned pixel art /
         RotSprite): OWNER CHOSE B ("looks lovely", accepted that it is not strict pixel art).
         C2 FIRST TRY, REMOVED: ?gpucars=1 uploaded the art buffer to WebGL every frame and drew
         the cars there. Owner's phone: "some sort of judder that isn't on the compare link";
         ?report=1 draw 3 -> 7-8 ms a frame (Surface Bowling Alley). Owner: "these GPU loadings
         to save the CPU don't seem to help on mobile much - is our approach right?" It was not:
         the phone is not CPU-bound (our JS ~4 ms of 16.7), and shuttling pixels between the 2D
         canvas and WebGL every frame is what hurts on Safari. RULE: no per-frame copies between
         the 2D canvas and WebGL.
         C2 DONE, the DEFAULT since 2026-10-16 (?sharpcars=0 = the old art-buffer cars). OWNER
         ON THE PHONE: "seems good, no major issues ... the change seems to have worked";
         ?report=1 back to back on Castle Cum: draw 2 ms both, slow frames 0.05 % (2 / 4195)
         with it against 0.25 % (12 / 4791) without. How it works: the cars
         drawn on the full-resolution SCREEN canvas (render.ts drawSharpCarLayers): the art
         buffer under the cars is blitted, each car painted facing +x into its own picture by
         drawPixelCar, each sprite px a whole-number block (cars.ts paintCarPicture), then
         turned / scaled onto the screen with smoothing; the art buffer is cleared, takes the
         overhead props and is blitted again. No WebGL involved.
         Shared shader builder: src/render/glprogram.ts (glpaint / glshade still have their own
         copies: fold them in).
         NEXT ASK (owner, 2026-10-16): "tyre marks seem to quiver, I think they always have" -
         cause: the marks layer (MARK_PPM 4.2 px/m) stretched ~3.6x NEAREST into the art grid each
         frame, so a mark pixel is 3 or 4 art px wide by camera position. DONE, the DEFAULT
         since 2026-10-17 (owner: "both fixes tested and working"; ?sharpmarks=0 = off): the art
         buffer so far
         (ground, deck) is blitted, the marks drawn on the screen canvas at device resolution
         (an edge moves by one device px, not one art px), the buffer cleared for the layers
         above (render/screen.ts drawMarksOnScreen). Switch off: renderhash SAME.
- [x] HUD LIST (owner, 2026-10-17: "this and mini map be in a sub menu called HUD ... all HUD
      options can be separately toggled to match player preference ... keep it light and
      functional"). The DEFAULT since 2026-10-17 (owner: "test approved"; ?hudmenu=0 = the old
      MINIMAP row). Then (owner): tyre / damage OFF means off even when damaged - the DEFAULT
      since 2026-10-17 (owner: "test passed"; ?tyreoff=0 = it pops up on damage again). The
      pause menu's MINIMAP row becomes HUD ›, an ON / OFF button each for the minimap, the progress
      bar, the lap timer, the speedo and the tyre / damage diagram (moved out of TUNE). Minimap and
      bar remembered per difficulty mode (the bar with the minimap's defaults, never locked; alone
      at the top of the window's place when the minimap is off), the rest per device. Controls are
      never in the list. The top-right stack closes up round a hidden speedo / lap timer. Without
      ?hudmenu the stored choices do not count. Switch off: renderhash SAME; uicheck OK both ways.
      ALSO SEEN (plain link, not caused by this): with the tyre / damage diagram on at 390 px tall,
      the test-mode FPS strip lands on the ABS chip (the speed panel grows 50 px; uicheck only
      checks controls). Owner: leave it unless it helps the iPhone - it does not (portrait 440
      px wide, 732-894 tall; landscape home-screen app 440 tall; needs under 420 tall).
- [ ] NEXT, OWNER 2026-10-17 (assess the cause first, then propose with sizes):
      (1) DONE - the menu fixes are the DEFAULT since 2026-10-17 (owner: "Seems to have worked
      nice one"; ?menufast=0 = the old). Owner's run (10:28Z): menu slow frames 0.50 % (4 % on the
      first run), no texture warm-up in a slow frame, TEST MODE instant. Left: one 124 ms frame
      at 0.4 s in every run (not ours: 2-4 ms), and that run's load took 11.7 s (2.3-2.7 s
      before; likely the first load of a new build through the tunnel) - for the load question.
      "main menu is still sluggish" - the live 5-car race runs behind the menu (game/menu
      demo); measure it ON THE PHONE first, then decide (fewer demo cars, a cheaper demo, the
      recording again, slow tap handlers). MENU REPORT BUILT: ?report=1 records the menu too
      (frame [9] menu up, [10] taps ignored in a new screen's 350 ms ghost window, [11] the
      slowest button handler ms); phonereport prints a MENU run per session. Laptop (390x844,
      not the yardstick): menu 1.5 % slow frames vs 0.26 % in the race, TEST MODE tap 417 ms.
      OWNER'S PHONE RUN (09:20Z): the menu smooth (median 17 ms) except the menu race's fly-in
      (a 113 ms frame painting the whole-level picture, 121 ms at the handover with 28 GPU
      uploads, two ~120 ms frames outside our code) and the TEST MODE tap (193 ms painting every
      thumbnail, then 68 ms: putting the menu level back clears wear, every tile stale). BUILT
      behind ?menufast=1 (owner phone test pending, testlist 'menufast'): no fly-in behind the
      menu; thumbnails painted while the loading screen is up. Laptop A/B: menu slow frames 14
      -> 5, TEST MODE 419 -> 3 ms; loading +~0.5 s (laptop; phone ~2x faster). The report now
      carries loadMs (page open -> menu shown) to compare on the phone. NEXT (owner): the
      initial load feels long - find what was tried before, propose (after this is approved).
      LOAD DONE - the bundle and the saved thumbnails are the DEFAULT since 2026-10-17 (owner:
      "Yes, make it default"; ?bundle=0 / ?thumbcache=0 = the old). The owner's phone (11:38Z): menu
      shown 2.49 s (old) -> 1.15 s (first load) -> 0.53 s (saved thumbnails). Left: one ~125 ms
      frame just after the menu shows, in every run, outside our code - next to chase.
      LOAD (owner, 2026-10-17: "the initial load in is kinda long too"). Tried before: 8ec3ad8
      (textures warmed after boot; overview snap skipped on the GPU path) and 6b6c7fa (the menu
      recording, later parked; light thumbnail builds; rally stages built on first use). MEASURED
      now (laptop, phone size): the test server sends 158 modules (3.5 MB), never cached, one round
      trip after another: with 80 ms a request the last arrives at 3.2 s, menu at 4.2 s; then ~1 s
      of our start-up (most of it the 18 thumbnails painted at load, the 9 rally stages generated
      for theirs). The owner's phone: menu 2.3-2.7 s, 11.7 / 15.2 s on the first load after a push.
      BUILT behind ?bundle=1 (owner phone test pending, testlist 'bundle'): serve.mjs /__bundle.js,
      the game as ONE minified gzipped file (186 KB) rebuilt when a source changes; index.html
      loads it with ?bundle=1 unless automation (the tools keep the modules); the itch build maps
      both paths to game.js. Laptop, 80 ms a request: menu 4.2 -> 1.3 s. Thumbnails: painting per
      list does not work (the category screen shows ~15 of them). Owner chose: remember them.
      BUILT behind ?thumbcache=1 (with ?bundle=1; testlist 'bundle'): src/menu/thumbcache.js keeps
      them in IndexedDB per version (the bundle's fingerprint of src/, tools/lib/buildid.mjs) and
      reads them back at load; a miss paints and saves 4 s after the menu shows. Laptop, no delay:
      menu 1722 ms (first load) -> 408 ms (second), the 18 pictures pixel-identical.
      MENU FRAME RHYTHM (owner: "the race behind stutters", screen recording 10:59Z): the phone shows
      ~2.5 % of frames twice; its reports: menu 0.7-2.4 % off-beat frames, races 1.9-4.8 %, same in
      the home-screen app. Platform cadence, not our code (2-3 ms a frame). Owner: "it's ok".
      SECOND PHONE RUN (09:46Z, ?menufast=1): the fly-in gone, but the same four ~120 ms frames at
      0.4-1.4 s: three were the texture warm-up (110-122 ms of it in those frames; report [12]).
      Laptop: hedgerow / grassLong / wheat / rapeseed 32-36 ms each, every other texture 0-5 ms;
      the cost is the blades' stroke (32 ms), not building the path (2 ms). ADDED to ?menufast=1
      (owner: A, 'accept A, test it'): the blades of each shape stroked ONCE as a white mask and
      tinted per colour (textures.ts tintedBlades): wheat / rapeseed / hedgerow 33-36 -> 3 ms.
      NOT pixel-identical: over the base colour at most 2 levels off at soft blade edges; after the
      palette snap 0.13-0.3 % of a frame's pixels one shade off on long grass (renderhash with
      menufast=1 DIFFERENT on grass levels; owner accepted). If the last hitch (grassLong itself)
      still shows: B, texture painting on a worker (OffscreenCanvas), exact, M.
      Owner: 'judder throughout' on that run - the frames say otherwise (490/500 at 16-18 ms);
      the menu camera now starts fully zoomed in (ppm 26 vs ~8). Back-to-back pair asked for.
      (2) DONE - the DEFAULT since 2026-10-17 (owner: "test passed track edges don't wiggle";
      "maybe more judder but it's subtle if it was" - the owner's run: Castle Cum 0.17 % slow
      frames, draw 2 ms, against ~0.4 % on earlier Castle Cum runs; ?exacttiles=0 = the old
      placement).
      "some track edges jiggle or dance like the tyre tracks were" (owner: the white line at
      the road edge). CAUSE (tools/edgecheck.mjs, Brands): only while the zoom MOVES - the tiles
      (ribbon, white lines, curved kerbs) were drawn at whole-art-pixel edges, but the GPU ground
      zooms smoothly, so each tile moved by up to 1.5 device px, differently every frame. Line
      stray frame to frame (median / p95 / max px): zoom moving 0.30 / 1.61 / 2.92, held 0.03 /
      0.09 / 0.37; a perfect line (--control) 0.05 / 0.16 / 0.37. FIX: on the GPU ground the
      tiles go at their exact place (tiles.ts drawTileImage); zoom moving 0.03 / 0.14 / 0.44.
- [x] JOKER BUGS (owner, 2026-10-16; FIXED, the DEFAULT since 2026-10-17, owner: "tested and
      working"; ?jokerfix=0 = the old behaviour): (1) the joker lap / joker section did not show on the
      minimap (it drew the main centreline only); (2) RESET in the joker lane put the car back on
      the main road (the last point ON the main track, before the joker): it should put it back on
      the joker lane where it came off. How: world/joker.ts (the joker lane, a spot / pose on it, one lookup for
      the rules, RESET and the minimap); rules.js stepJoker remembers the last spot ON the lane
      (forgotten on the main road); session.js resetOnJoker: 4 m back, on the lane edge the car
      left by, nose turned in; the minimap draws the lane as road. Measured (tools: a scratch
      test, car put off the lane then R): Slidden Hill 66.8 m along -> 62.8 m, on the edge (off
      6.0 of 6.0); Knobhill 50.9 -> 46.9 m; without the switch both went to the main road.
- [ ] MENU VIDEO, if still wanted after the graphics update (owner: it must be a video of a race; the
      first take lagged on the phone): find why first (uneven frames from a real-time take? record
      from the deterministic runtime instead, frame by frame), test behind ?menuvideo=1 BEFORE it
      becomes the default. node tools/menuvideo.mjs [seconds] [kbps].
- [ ] GRASS GRIP + WATER AS A TOP SURFACE (owner, 2026-10-16; not now, logged; DISCUSS FIRST: check
      the code, report whether it needs major changes, ask questions). Owner: grass, long grass too,
      feels slightly too slippy - it should become as slippery as it is now only when WET. Water /
      rain as a surface modifier on top of any surface: rain has a chance of making puddles, puddles
      join when they touch or get close; water makes a surface more slippy and makes it wear faster
      where it can wear (not every surface does). Start from surfaces.ts (grip), the puddle cover
      (load.ts / lab.js layersAt, surfaceOf: id 'puddle'), wear.ts and any rain / weather code.
      FINDINGS (reported 2026-10-16): puddles (a 'wet' cover on any base: mu x0.72, longK x0.92,
      plough +0.6), churning into mud / gravel and drying by tyre heat already exist; no rain or
      weather, puddles never appear / grow / join, wet ground does not wear faster. Dry grass mu
      0.34 is about a real wet-grass value: dry 0.47 makes a puddle on grass today's 0.34.
      STEP 1 DONE, OWNER APPROVED ("test passed tho for grass"), the DEFAULT since 2026-10-16
      (?grassgrip=0 = the old grip): dry grass
      0.34 -> 0.47, long grass 0.36 -> 0.50 (surfaces.ts applyGrassGrip); a puddle on them 0.338 /
      0.360 = today's grass. Steady cornering on grass (surfacegrip, 60 km/h): hatch-rwd 0.43 ->
      0.62 g, rally-4x4 0.53 -> 0.60 g; tarmac unchanged.
      OWNER RULES: wet-weather tyres clear water from hard surfaces faster than normal tyres;
      normal tyres take 3 passes to clear water / degrade it.
      OWNER ANSWERS (2026-10-16): RAIN is chosen as WEATHER in the event setup before the start,
      beside the AI choices (not random). PUDDLES may form anywhere, with a higher chance in dips
      and a lower chance on hills (slopes / crests). GRIP when wet differs PER SURFACE, and water
      also speeds up the degrading where it combines with a surface (gravel + water, snow + water,
      and so on). Order (owner, 2026-10-16): the agreed graphics work first, then this.
      OWNER ANSWERS (2026-10-17): WEATHER CAN CHANGE MID-RACE. A SEASON SLIDER in the event setup
      sets the chance of each weather (rain, snow, dry, hot, super hot) and the temperature, and
      the weather changes the track's condition. Keep it efficient: no added lag. PUDDLES DRAIN
      very slowly by themselves, clear with normal tyres after several passes, with rain tyres
      in one pass. THE WET LOOK may change the ground colour and add falling rain, in the game's
      style, with performance and visibility in mind (it can be turned down). ONE WATER SYSTEM:
      build on the existing wet / puddle cover (wear.ts surfaceOf 'puddle'), never a second one.
      PLAN (sizes, proposed 2026-10-17): R1 wet-grip / wet-wear table per surface, signed off by
      the owner (S, no code); R2 season slider + weather in the event setup + the rain look (M);
      R3 wet ground plays wet, tyre rules (M); R4 puddles form / grow / join / drain (L). Snow,
      hot and super hot: to be planned after rain (ask first). Each step behind a switch.
      R1 SIGNED OFF (owner, 2026-10-17: realism in the numbers and the feel; owner tests). mu
      dry / DAMP (rain) / PUDDLE (standing): race tarmac 1.06 / 0.74 / 0.62; tarmac 0.94 / 0.72 /
      0.58; concrete 0.90 / 0.68 / 0.56; broken 0.86 / 0.69 / 0.56; kerb 0.70 / 0.45 / 0.40; lab
      1.00 / 0.65 / 0.55; gravel 0.62 / 0.59 / 0.50; dirt 0.56 / 0.42 / 0.38; grass 0.47 / 0.34 /
      0.34; long grass 0.50 / 0.36 / 0.36; mud 0.45 / 0.38 / 0.34; thick mud 0.38 / 0.34 / 0.30;
      sand 0.55 / 0.58 (less plough: damp sand packs) / 0.45; snow 0.32 / 0.26 / 0.22; packed
      snow 0.36 / 0.28 / 0.24; ice 0.12 / 0.06 / 0.06. WET WEAR: grass, long grass, dirt -> next
      in 1 pass (dry 2); mud -> thick mud in 2 (dry 3); wet snow turns to slush / water, not ice;
      wet ice scrubs through in half the slip; puddle churn rules as today. TYRES: wet HARD
      ground uses the tyre's WET column; wet loose ground the tyre's own column for that ground.
      Owner OK'd: existing puddles change with this table (tarmac puddle 0.68 -> 0.58; Killder,
      Sweaty Lamb, the Lab). FOUND: a puddle's surface id is 'puddle', missing from tyre.bySurf,
      so every tyre counts as Pre-Spun in a puddle (rain tyres no help, slicks no penalty) - R3.
      OWNER (2026-10-17 night): finish all of weather, then the owner looks (ask only real
      decisions). ORDER: R3a wet physics, R3b the wet look, R2 setup + changing weather, R4
      puddles, then LIGHT. SNOW: patches like puddles, a lower chance. HOT / SUPER HOT: raise
      track and tyre temperature; dirt wears to GRAVEL (not mud); mud, puddles and damp ground
      DRY over time. Rivers, lakes, scenery water: PERMANENT. The puddles levels have today
      (hand-placed, and blend.ts '@wet' patches) GO: puddles come from the weather. LIGHT: weather
      changes the light; time of day an option that moves slowly and realistically through a
      race; darker in winter (shorter days); pink sunrises, orange sunsets, moonlit nights,
      truly dark nights where headlights matter; track / street lights if not overkill (Safari:
      measure every look). TYRE WEAR (owner): dry tyres wear slower in the wet, wets faster in
      the dry, any tyre on ground it is not made for faster - NO tyre wear exists yet (heat
      only): a new system, design questions to the owner before building.
      R3a BUILT behind ?rain=0..1 (wetness and rain; ?rain = 0.6): world/weather.ts (state),
      world/wet.ts (damp + puddle surfaces from WET_MU, cached per step; the dry line per wear
      cell, re-wet by rain), tyres.ts tyreGripOn (wet hard ground -> WET column; the puddle fix),
      wet wear (one pass sooner; wet snow melts; wet ice scrubs at double rate), the AI re-plans
      per wetness step (line.ts regripPath; weaver x roadWetGrip). PROOF: simhash dry 11 SAME, 2
      DIFFERENT only by the new puddle grip (grass-track, generated stage: SAME with the old
      formula). Steady cornering (hatch, 60 km/h) tarmac dry / damp / puddle: Pre-Spun 1.38 /
      0.99 / 0.76 g, Wet 1.41 / 1.31 / 1.05, Semi-Slick 1.59 / 0.84 / 0.60. AI alone: wet laps
      13-20 % slower, less time off; AI field (7 races, 5 cars): incidents 14 wet vs 11 dry.
      R3b BUILT (same switch): wet ground darker and cooler in the GPU ground's own shaders
      (glprogram.ts WET_GLSL; the 2D ground one multiply fill of the art buffer), falling rain and
      splashes (render/rain.ts: one stroke + one fill a frame into the art buffer, fixed pool, own
      random stream), the existing wet spray and light "dried" tyre trails. drawload: +~420 path
      pieces in the art buffer, nothing on the screen canvas or the GPU. renderhash dry: SAME
      (against a reference re-saved on R3a). Phone held-frame recording: with the owner's look.
      R2 BUILT behind ?weather=1: the event setup's WEATHER row (SEASON / DRY / HOT / VERY HOT /
      RAIN / HEAVY RAIN), the SEASON slider (default: today's season) and its forecast; remembered
      in the profile. weather.ts: per season the chance of each weather and the air temperature
      (a British year); SEASON mode can change every 70-180 s of race (seeded: a restart replays
      it); rain soaks the track (heavy ~1 min), a dry spell dries it by track temperature (~9 min
      at 20 C, ~4 at 45 C); the HUD notice says RAIN STARTING / HEAVY RAIN / SNOW FALLING / RAIN
      STOPPING / HOT TRACK. Tyres cool toward and start at the TRACK temperature (18 C without
      weather). Hot / very hot: dirt wears to gravel. Falling snow look (render/rain.ts). Proof:
      simhash with weather off SAME (13/13); browser races heavy / very hot / winter: no errors.
      ?slidewear=1 (owner): a sliding wheel (slip > 4 m/s: crashes, spins, drifts) counts its
      wear pass twice - the slip the wear step already reads, no new checks.
      R4 BUILT (with ?weather=1): world/puddles.ts - puddle SITES per level with a lap (seeded;
      along and beside the track, likelier and bigger in terrain dips, rarer on crests; a third
      to half can hold SNOW). Sites fill in rain once the ground is soaked (heavy: full in ~3 min),
      drain slowly when dry (~13 min at 20 C), snow settles below 1 C and melts into a puddle;
      shown in 4 size steps as the existing 'wet' / 'snow' covers (neighbours merge); changed
      sites repaint their ground squares only (tilesWear staleCoverAreas) and re-sync the wear
      cells (a receding puddle leaves dry ground; rain refills cleared spots). The levels' own
      puddles (hand-placed, blend '@wet', stage) GO; scenery water stays (Cover.water: Killder
      Water, Sweaty Lamb's stream / splash / pond) and the Lab's test features. Tyres clear
      standing water in 3 passes, rain tyres 1 (soft ground still churns to mud). Mud dries to
      dirt (thick mud to mud) in a dry spell (~4 min at 20 C). Proof: simhash weather off SAME
      (13/13); sites per circuit 2-27; browser heavy-rain race: puddles shown, no errors.
      OWNER (10-18): WEATHER ALL PASS (weather, rain, slidewear): weather and the slide wear are
      the DEFAULT since 2026-10-18 (?weather=0 / ?slidewear=0 = off; ?rain= stays a test tool).
      Owner tweaks, built with it (testlist wintertweaks): below 0 C a puddle turns to ice (thaws
      above 1 C), worn mud may freeze over (a slide scrubs it), scenery water may freeze over
      below -2 C (at the start likelier the colder); an event's start may follow earlier rain
      (season's chance: some sites part full) or lying snow, seeded per event; faster build-up
      (heavy rain from dry: first puddle 26 s, half the sites 48 s; dips first); a SNOW button.
      Lighting approved to build, tested separately (its own switch): NEXT, a new session.
- TYRE WEAR (owner answers 10-18): punctures likelier with heat and wear, small chance from crashes
  (damage.js, existed) and debris; worn tyres lose a fair bit of grip; a set lasts several races (a
  running cost and a choice, not a nag); new sets only in the garage (FIT = a new set); the HUD
  wheel colour is the wear (green / amber / red), the numbers stay the heat. BUILT behind
  ?tyrewear=1 (physics/tyrewear.ts): wear from each wheel's friction work (the heat model's), x
  above the window, x wrong ground (the tyre's grip table), dry tyres x0.6 in the wet, rain tyres
  x2.5 on dry hard ground; grip -20 % at bald (more when wet); puncture risk from heat over the
  window and wear past 70 % only (no random draw for a healthy tyre); debris 4 % on a hard hit,
  splinters 1 % a pass; saved per car in the profile (session only; the demo car never).
  MEASURED (Castle Cum, hatch, busiest tyre): 3 laps ~10 % (about 9 races a set), 10 hard laps
  36 %, Wet tyres in the dry 28 % / 3 laps, dry tyres in the wet 5 %. simhash off SAME 13/13.
  SEEN, not changed: with the tyre diagram on, ABS / TCS sit under the FPS panel (layout).
  OWNER (10-18): "apply it to main and roll it back if needed": the DEFAULT (?tyrewear=0 off), its
  test stays open (testlist tyrewear). RESTART puts the set back as it was at the event's start,
  RESET keeps the race as it is; the wear is saved when the event is over (results, menu, another
  car).
- [ ] ZOOM LURCH (owner 10-18: "whole picture lurches / ground repaints, now and then, zooming out
      or in"), behind ?zoomswitch=1, owner phone test (testlist zoomswitch). MEASURED: the camera
      and zoom are smooth (_zoomlurch: jerk <= 0.33 px zooming; phone reports: the zoom never
      reverses frame to frame). CAUSE (_zoomswitch, Castle Cum glide): a GPU tile gets mipmaps
      the first time it is drawn below 1 screen px per tile px, so the first zoom-out past that
      (zoom ~0.5 since sharpness 1.5, was ~0.33 = rarely crossed) built them for every tile in
      view in ONE frame (14 landscape; tiles painted while zoomed in through a corner have none,
      and idle tiles expire, so it recurs). Fix: mipmaps with the upload (spread with the uploads);
      the sharp filter reads level 0. renderhash SAME switch off and on. A one-frame look change
      at that zoom was NOT found (the 3 % at zoom 0.5000 is texels meeting whole pixels, seen with
      the fix too); a look blend was built and dropped (no measurable gain, extra GPU work).
      Phone A/B: two ?report=1 runs back to back, &zoomswitch=1 and plain; frames with 8+ mipmaps.
- [ ] THICK MUD FREEZES (owner 10-18): thick mud should freeze like mud does, maybe a bit slower.
      After the zoom test. Look at puddles.ts / snowwear.ts winter rules for mud first.
- NEXT, READY TO WORK ON (owner 10-18): RAIN / WATER + DRIVING OVER IT turns SAND -> GRAVEL and
  GRAVEL -> DIRT. Today: a churned puddle mixes sand -> gravel but gravel -> MUD (wear.ts
  WATER_MIX), and damp ground only speeds the grass / dirt / mud chain (BASE_WEAR: sand and gravel
  never wear by passes). To do: WATER_MIX gravel -> dirt; sand and gravel wear by passes only when
  wet (damp ground or a puddle / field water over them): sand -> gravel, gravel -> dirt (then dirt
  -> mud as today); pass counts to agree with the owner (suggest: like dirt, 2 passes wet, 1 in a
  puddle). Check the hot-weather rule (wet.ts: dirt bakes to gravel) and the AI regrip.
- OWNER 10-18 "ALL PASS OTHERWISE": the cover field and the winter logic are the DEFAULT
  (?coverfield=0 / ?winter=0 off); a normal track's settled start snow cut to about a quarter
  (START_SNOW 0.2-0.7 -> 0.15-0.38: ~3-20 % of the ground); the test list is empty. Refs re-saved;
  with coverfield=0&winter=0: renderhash SAME, simhash SAME. Clean-up owed: the puddle sites.
- COVER FIELD (owner 10-18: rain and snow build in small patches until they coat the race surface;
  everything by weather / temperature; every level, highway included; settled at a wet start).
  Plan F0-F4 agreed: F0 DONE (every level follows its weather). F1 + F2 BUILT behind
  ?coverfield=1: world/coverfield.ts - each 0.5 m square's catch (world-space value noise, 255
  steps) against three levels the weather moves (water, snow, ice); render/glfield.ts draws it on
  the GPU ground (a catch / mask grid texture computed per 8 m chunk in a 2 ms a frame budget, one
  texture read a pixel; the mask leaves tyre-changed cells and the level's own covers to the
  tiles). Physics reads the same squares. MEASURED (Castle Cum race surface): heavy rain 1 % at
  30 s, 8 % 2 min, 47 % 5 min, 98 % 10 min; light rain 100 % at 25 min; dry in ~10 min at 26 C;
  snow 98 % at 10 min, melts in ~2-3 min at 43 C; settled starts 11 % (rain) / 44 % (snow). Cost:
  0.48 ms a second with 5,749 wear cells. F3 BUILT: the level's own snow ground, cover zones and
  lanes, packed snow roads and hand-placed patches are LEVEL AREAS with their own levels (full at
  the start, the same weather rules), so a snow stage melts in a hot event and the Bowling Alley
  wet lane dries; their ground is painted as what lies beneath (coverfield.ts areaUnder: the
  surface's under, a road's tarmac, open snow ground's grass); scenery water stays. F4 BUILT: the
  AI plans its speeds again when a level crosses a tenth (coverfield.ts coverEpoch, ai/line.ts);
  tyres clear water lines (3 passes), pack and break snow by the winter rules, per wear cell (the
  GPU mask leaves those cells to the tiles). MEASURED: Castle Cum race, 3 AI, water 0.6: 54.2 fps
  with the field vs 55.5 without (headless laptop); a snow stage under a full field 60 fps. Not on
  the 2D ground (?glground=0 / ?gpupaint=0): grip only. Owner test link: plain + &coverfield=1
  &winter=1.
- WINTER LOGIC (owner 10-18: snow and ice melt in anything but the cold, faster when hot; snow
  driven over packs; packed snow ices more in the cold, a small chance it breaks to water on what
  is under it; "complete logical interactions"; efficient on mobile). BUILT behind ?winter=1
  (testlist winter). Loose snow (4 passes) -> packed snow / ice (colder) / slush (warmer); packed
  snow (cover or snow road, 4 passes) -> ice (more the colder) / loose snow / water on its ground
  (a snow road's bed: gravel). Above freezing the tyres' snow / packed snow / ice melt to water by
  chance, faster per C and in rain; their water freezes to ice below 0 (black ice) and dries in a
  warm dry spell; scenery water and frozen mud thaw faster per C (at 5 C as before); weather snow
  melts faster in rain; a level's own snow / ice patches (Test Track, Sandbox, alpine stage ice)
  melt, dry, refreeze to ice (gone on a warm start); the Lab's test features never change. Snow
  ground (snow stages): F0 (owner 10-18) REMOVED the freeze - every level follows its weather.
  Without an event's weather nothing melts (snow logic at 0 C). MEASURED (tools/scratch/
  _winter.mjs, 400 cells): -8 C snow -> 55 % packed / 40 % ice / 5 % slush, packed -> 81 % ice;
  0 C 71 / 14 / 15, packed -> 52 % ice, 3 % water; 5 C 39 % packed / 61 % slush, packed 43 % water.
  Cost: the per-second tick with 4,248 wear cells 0.12-0.19 ms (laptop) - the existing passes, no
  new ones. LAB WEATHER behind ?labweather=1 (testlist labweather): OG Lab, Bowling Alley, Rough
  Patch get the floor's puddle / snow sites (92-113). STILL WITHOUT weather sites: the endless
  highway (sites would have to follow the road as it is built) - next if wanted.
- OWNER 10-18 "YES ALL": tyre feel, more puddles (road sites + refill), one puddle look, packed
  snow wear and wet trails are the DEFAULT (=0 off each; testlist entries deleted). tyrecheck rules
  moved with the owner's "heat faster from sliding": drift too hot 15 s+ (was 20), 80 s drift never
  pops (was 90). Refs re-saved. With all five =0: renderhash SAME, simhash SAME.
- WET TYRE MARKS (owner 10-18: "tyre marks in the wet need to vanish quite quickly 10-50 m").
  Cause: wet marks (MARK_WET, the light line a tyre leaves on a wet road) went into the skid-mark
  layer with the rubber, which fades ~46 s to half (marks.js fadeMarks): ~2 km of trail at race
  speed. BUILT behind ?wettrail=1 (testlist wettrail): src/wettrail.ts - a wet wheel keeps a
  short trail instead (a point a metre, gone after 1 s or 50 m of trail: ~10 m at 36 km/h, 50 m
  at 180 km/h), drawn where the marks are drawn (screen.ts / render.ts), fading in 4 bands: one
  stroke per band and line width (~8 a frame), no new layer, no whole-layer fade (a second 26 MB
  layer was rejected for Safari). Photographed racing in the rain: short lines behind each tyre,
  none left down the track. Dry rubber marks unchanged.
- ONE PUDDLE LOOK (owner 10-18: "two types of puddle - there should only be one"; puddles hardly
  showed on tarmac). CAUSE: the weather's puddles were painted with the WET TARMAC art (opaque
  #2c3039, its own blue 'blobs' = puddles inside each puddle; dark on a wet road). BUILT behind
  ?onepuddle=1 (testlist onepuddle): a puddle is see-through water tinted by the ground under it
  (covers.ts PUDDLE_WATER: the old PUDDLE_TINT, blue-grey on hard ground) with the water's sheen
  and rings (art.ts 'puddle'); the wet art loses its blobs; meltwater / refilled wear cells the
  same look over their ground (render/ground/wear.ts). Photographed on road and kerb.
- MORE PUDDLES ON THE ROAD + THE LINE REFILLS (owner 10-18: puddles do not build up on the race
  surface). MEASURED (Castle Cum, heavy rain, 4 AI, 2 min): 29 of 119 water sites on the road;
  cars cleared a third of the road's water in 60 s and it never refilled while pouring (a cleared
  spot waited for its puddle to change size). With ?morepuddles=1 now: the extra lap sites ON the
  road every 11 m (chance 0.35, at most 90), and while it rains a full puddle's cleared spots
  fill again every 15 s of heavy rain (puddles.ts refillCleared). Castle Cum 65 of 146 on the
  road, Brands 89 of 174; road water still there after 2 min 93-94 % (was 66 %).
- PACKED SNOW WEARS (owner 10-18: "packed snow should have a chance to degrade into snow or ice
  50:50"). BUILT behind ?packedwear=1 (testlist packedwear): world/snowwear.ts - after 4 passes a
  bare packed-snow cell takes a cover of loose snow or ice, even odds (wet: snow, the owner's wet
  table); the packed base stays under it and the existing rules go on (snow packs, ice scrubs to
  meltwater, water clears in 3 passes). Packed snow never wore before. MEASURED
  (tools/scratch/_packedwear.mjs, 400 lane cells): dry 201 ice / 199 snow at pass 4; wet 400 snow;
  switch off no change.
- TYRE FEEL (owner 10-18: wear faster sliding, faster still wheelspinning / donuts; temperature "a
  little bit hard to get hot" and cools "a little bit too easy"; heat faster from sliding but no
  extra wear for a cold slide; hot tyres wear more from sliding). BUILT behind ?tyrefeel=1
  (testlist tyrefeel): tyreheat.ts - flex warm-up 0.07 -> 0.1; while a tyre is no hotter than
  its window's top it cools at 0.0135 + 0.00025 / (m/s) (was 0.008 + 0.0008: the same at 10 m/s,
  less when faster) and a scrubbing axle's slip heat x1.4; above the window as before.
  tyrewear.ts - a scrubbing wheel wears x 1 + tanh(slip / 12 m/s), the gain x 1 per 60 C above
  the window. MEASURED (hatch, tarmac, worst tyre, %/min, off -> on): clean hard corner 3.7 ->
  3.7, handbrake taps 7.8 -> 8.5, drift 11.6 -> 26.7, donut 16.4 -> 43.1, pinned burnout 20.3 ->
  52.5. 85 C to below 65 on a 90 km/h straight 15 -> 22 s. AI laps 2-3 in the window: Castle Cum
  43-52 -> 83-85 %, Brands 66-73 -> 93 %; wear a race +0.0-0.8 points. tyrecheck with it: all
  pass but two old "hard to overheat" numbers - the hatch drift too hot at 17 s (rule 20 s+; was
  26) and the track car's 90 s drift reaching the pop point at ~88 s (it was 259 C at 90 s):
  the owner's "heat faster from sliding"; update those rules if it becomes the default.
- MORE PUDDLES THAN SNOW (owner 10-18: "puddles should have more chance than snow to form; snow
  is at a good level, don't change it"). BUILT behind ?morepuddles=1 (testlist morepuddles):
  water-only sites from their own seeded stream (puddles.ts extraWaterSites: half way between the
  lap's sites, chance 0.3 on level ground, and the floor grid offset half a cell, 0.38; dips add,
  crests take off as before), so every snow patch and existing puddle stays where it was (snow
  sites IDENTICAL on 6 circuits; Grass Track re-rolls per load anyway). Water / snow sites, 5 min
  heavy rain all showing: castle-cum 37 -> 119 / 97, brands 53 -> 151 / 100, killder 61 -> 156 /
  86, sweaty-lamb 49 -> 149 / 94, grass-track 34 -> 101 / 86, knobhill 40 -> 114 / 87,
  slidden-hill 48 -> 117 / 91. Look changes in heavy rain 13-24 -> 41-55 a minute (snow 23-27;
  each repaints its ground squares in view): watch Safari in rain.
- PUDDLES / SNOW EVERYWHERE (owner 10-18): sites over the whole floor too (a jittered grid by the
  level's area, ~100-125 a level): water by the dip, snow anywhere (60 % of floor points), snow
  patches 1.4x a puddle. Heavy rain 5 min: 34-61 puddles a circuit; snow 5 min: 86-100 patches;
  13-27 look changes a minute (each repaints its ground squares in view). world/covergrid.ts: a
  grid index of the covers for coverAt (identical answers; 0.2 us a lookup at ~130 covers).
  Proof: simhash (?tyrewear=0) SAME 13/13.

## GAME NAME: RAC3R (user, 2026-10-03)

## Owner specs (moved verbatim)

- `docs/specs/levels-events.md` - Levels and events (owner spec dump)
- `docs/specs/roadmap-2026-10-03.md` - Roadmap (digest of SPECS-2026-10-03.md)
- `docs/specs/surface-evolution.md` - Surface evolution (owner spec)
- `docs/specs/master-backlog.md` - Master backlog (triaged owner list)
- `SPECS-2026-10-03.md`, `BRIEF.md` - the owner's original specs

## OWNER REQUESTS FOR LATER

- [x] MINIMAP (owner, 2026-10-15; OWNER APPROVED on the phone 2026-10-16, "mini map tests good":
      the DEFAULT since then, ?minimap=0 = off): an optional minimap on every track, toggled on /
      off; rally stages most of all. OWNER CHOSE (2026-10-16, from mockups A whole track / B road ahead / C stage strip):
      B, "the map should rotate with you so it's always clear which corner etc is next": a small
      round window (~120 px) top-left under the buttons, heading-up, the next ~330 m of road from
      the centreline, fading at the top, your car a chevron at the bottom, a thin progress bar under
      it; subtle (no box, ~85 % opacity), drawn on the HUD, never touchable. BUILT (was behind ?minimap=1)
      (src/hud/minimap.js; owner phone test pending, testlist minimap). Pause menu MINIMAP row,
      remembered per difficulty mode: on in MOBILE / GAME / REALISH (owner 2026-10-16: REALISH, the
      default difficulty, counts as easy), off in RICH, locked off and greyed out in REAL (owner). Gives way to the car list / tune panel. The lab floors and the
      endless highway have none - until the owner asked: "highway levels should have a minimap
      too": road ahead, no progress bar. OWNER APPROVED ("highway mini map approved"), the DEFAULT
      since 2026-10-16 (?hwmap=0 = not there).
      Owner: "the mini map should zoom in n out with the camera / car speed": its scale is the main
      view's / 30, so ~140 m ahead fully zoomed in, ~450 m fully out, following the camera's zoom.
      Owner: "the car on the mini map should face the same direction as the actual car, the road
      matching too": no longer heading-up - it faces the main view's way, the window pushed ahead
      of the car in the direction of travel (eased), the chevron pointing where the car points.

## Open items carried over (not re-checked since they were written; some may be done)

## USER SPEC DUMP (2026-10-04, late) — recorded before any work; QUICK FIXES first, the big systems are PLAN-FIRST (discuss)
- [ ] MORE LEVELS + MORE CARS (user, 2026-10-04: "more levels and more cars too").
- [ ] GARAGE SYSTEMS — DECIDED (user, 2026-10-04):
      TYRES: "do your recommended" but 4 BRANDS / 15 TYPES (Creem is an oil brand: dropped): SPUM (budget: Pre-Spun +0 = today's floor,
        All-Season, Mud-Plugger), KUM (road: Road Sport, Semi-Slick, Drift, Wet), DUNFLOP (rally / off-road: Gravel, Soft Gravel, Tarmac Rally,
        Studded Snow, All-Terrain), PIRRELLY (race: Soft, Medium, Full Wet). Grip per surface group (hard / wet / loose / soft / snow) + heat;
        fit by class; prices shown (test mode: not charged); the stats panel shows the effect.
      CLASSES: ROAD (hatch, saloon, sports, muscle) · RALLY (1L / 2L / 2L+ / Group B) · RALLYCROSS · STOCK CAR / GRASS TRACK · OVAL ·
        SINGLE-SEATER (F1 / F2 / FE-ish) · DRIFT · OFF-ROAD / ODD; car menu filtered class -> subclass; upgrades never change class.
      PAINT: 16-colour palette body + trim, a NUMBER 1-99 drawn big where the car has room, PREVIEW on the lift, APPLY saves; follows the car.
      ORDER: classes + filtered menu -> paint + number -> tyres.   [x] CLASSES done 2026-10-04 (ENGINE.md "Garage step 1")  [x] PAINT + NUMBER done 2026-10-04 ("Garage step 2"); Subaroo -> RALLY 2L+; picker grouped + coloured
      [x] TYRES done 2026-10-04 ("Garage step 3").  [x] AI race within the class (setup toggle).  [x] joker HUD switches live.
      [x] MORE CARS 2026-10-04: +9 (Mini, Lambo, Mikra 1L, 306 Maxxi 2L, Fiester RX, BriSKA stock, Autograss, Sylvya drift, F2).
      Known: kit car AI 8.7 s off at Sweaty Lamb ~1712 m. NEXT: one of every EVENT type + levels (user order), then story (discuss).  Also done: lamps break with damage; tape puffs on its 2nd hit.  OPEN Q: number the AI cars too?
      THEN (user, 2026-10-04): "after this can we do MORE CARS" — new cars right after the garage systems, before events/levels.
- [ ] STORY MODE: ROOKIE SEASON (grass track, stock car, time trials: hillclimb / runway time trial in cones) -> ROOKIE 2 (similar events, track
      variations, harder to win). We select which events are in. MONEY / POINTS also for NOT finishing top 3 (it's hard); REPLAYABLE events /
      championships for higher scores + more money (finish 5th throughout, earn some, upgrade, come back and win).
- [ ] UPGRADES limited by SERIES ELIGIBILITY: over-upgrade and the car no longer qualifies — downgrade or buy another car.
- [ ] GARAGE: pick COLOUR; pick a NUMBER drawn clearly on the bonnet / roof (wherever free on that model) = your ID; a PREVIEW and an APPLY;
      applied colours / number / upgrades follow the car into race and test events.
- [ ] TYRES FIRST UPGRADE: manufacturers, ranges per class / vehicle; only fit what fits the class/car; e.g. rally / off-road tyres on a road
      car = more off-road grip, heat up too quickly on tarmac; wets, race, intermediates — a real mix with distinct grip interactions.
      TODAY's grip ("feels low generally, on road and off") = the FLOOR: "SPUM — pre-spun tyres, +0 grip".
- [ ] CLASSES: rally / road / stock car / grass track / naffcar / F1 F2 FE...; drift, muscle, sports...; SUBCLASSES (rally 1L / 2L / 2L+ /
      Class B...) for events; the car menu FILTERS by class then subclass; upgrading never changes a car's class; mods shown with the stats and
      how they change them. Example upgrade: "Engine v2: top speed +10 mph".

## AI rounds 1-4, Killder all accepted.
- [ ] NEW CARS FEEDBACK (user): "look a little less standard, more like their unique real counterparts" (both); WRZ "feels a bit SLOW at
      acceleration / unable to WHEELSPIN or DRIFT"; BMV handling okay.

## SESSION 2026-10-04 (b) — user: "stage two is ongoing but feels ok; progress with this to do list as far as you can"
- [ ] ITCH RULE (user, 2026-10-04): "DON'T PUSH yet — wait till we're NEARLY OUT OF CREDITS" (then re-stage + push the latest; ask for the key).

## PLAN (user notes 2026-10-04, digested) — work top to bottom; tick + record numbers as each lands
- [ ] DAYTONA DECIDED (user, 2026-10-04): name "DIEATONA"; tri-oval + pits + scenery (31 deg turns, 18 deg tri-oval, flat back straight, pit lane,
      grandstands, infield lake, rolling start), keep old Naffcar as classic; "slip in some SUBTLE SKULLS in the decorations layout".
- [ ] NAFFCAR REBUILD = DAYTONA tri-oval parody (user, 2026-10-04): trace the real map, real banking (31 deg turns, 18 deg tri-oval), pits + scenery.
- [ ] PERF: Sweaty Lamb ground tiles ~35 ms (others ~26) — A/B long grass vs grass was inside the noise today (machine load swings);
      re-measure on a quiet machine before acting. The planned lever: paint tiles off the main thread.
- [ ] PERF: draw resting tyre stacks into the ground tiles (Slidden Hill 113 slow frames of 570, ~870 stacks).
- [ ] tools/wearcheck 3c is FLAKY (random churn) — make it seeded or loosen the threshold.

## QUEUED — SURFACE EVOLUTION (user, 2026-10-03, verbatim then read). NOT STARTED — propose a plan first.
- [ ] Grass Track ribbon: random dirt/grass patches along the course (currently fixed autograss sectors).
      DECIDED (user, 2026-10-03): random, but MOSTLY GRASS on the straights and MOSTLY DIRT in the corners.
      UPDATED (user, later 2026-10-03): "don't forget to do the grass track randomising EVERY LOAD IN" — a new
      random layout on every load (supersedes "fixed per track").
- [ ] Snow -> ice after several passes (EXISTS since 2026-10-02: 4 passes, lab.js wear map — verify it shows).
- [ ] Ice wears away under heavy braking / sliding, revealing what is UNDER it; that base then wears on its
      own rules (grass -> mud). Needs a LAYER model per wear cell: a cover (ice/snow/puddle) over a base.
- [ ] Mud -> thick mud (second mud type) with "vector dips". Sand and gravel can also form them.
      CHECKED 2026-10-03: the user asked whether Gemini/DeepSeek captured their description of "the vector
      system". THEY DID NOT — no doc in either folder mentions it; the only "ruts" are painted wear cells with
      mud grip, no height change. Waiting on the user to re-describe it before designing anything.
- [ ] Every surface instantly distinguishable by its graphics, and keeps its own driving numbers.
- [ ] Cover layers on ANY surface: puddles, snow, ice.
- [ ] (user) "unless tyres are very hot" — needs the tyre-temperature model (tier 3); scale ICE_SCRUB with heat.
- [ ] WEATHER must evaporate standing water — until weather exists, puddles only go under hot tyres.

## DONE — SURFACE BLENDING AT CHANGE POINTS (user, 2026-10-03) — ENGINE.md; small patches, loose surfaces only. Covers not blended yet.
- [ ] At every surface boundary (track sectors, zones, covers): scatter PATCHES (the Grass Track mechanism) of each
      side into the other, density highest at the boundary and falling off with distance. Data-driven, per level.

## MASTER BACKLOG — the user's long list (originally sent to DeepSeek), TRIAGED 2026-10-03 by Claude
    - [ ] Naffcar V8 fails the lap driver on its own track (12.7 s off the road; was 13.8 before the fix) -> step 3.
    - [ ] REVERSE (user: "it should work how the card says and the game is wrong"). Today R is a TOGGLE (<1 m/s), then
          BRAKE drives backwards and GAS brakes (vehicle.js ~311-323). Make it: HOLD R = drive backwards (ramped like
          GAS); BRAKE always brakes; GAS always drives forward; no pedal swap. PC: hold Z.
    - [ ] RESET on levels with no circuit (The Lab) goes to the SPAWN, not "near where you left it": main.js reads
          `breadcrumbs` but nothing ever records one. Fix: record the last safe spot while driving.
    - [ ] Wording: RESTART card says "everything reset", but the Grass Track's random layout is kept; the Lab has no
          start line. Tyres card: cold tyres only lose grip on hard surfaces (off-road ignores temperature).

## Awaiting a verdict
- [ ] **OUTER TYRE WALLS — Grass Track + Stock Car, 2026-10-03.** Loose 38 kg stacks on the OUTSIDE only (user's
      choice), generated from the track centreline by `outerTyreWall()` in lab.js (margin/spacing per level).
      507 + 611 stacks, 1.00 m apart, unbroken, none on the road, clear of pylons/boards/official box.
      MEASURED: 80 km/h head-on -> punches through, loses 1.5 m/s (~7%), bursts 6-9 stacks; 36 km/h -> through.
      Frame cost, CPU throttled 4x: draw 9.7 ms mean / 14.6 ms p95 on Stock Car (Lab 6.8 / 10.2), 58-60 fps.
      Also: cone tally moved into layout() — it sat on RESTART/RESET/CLEAR in portrait (uicheck now covers it,
      proven to fire). OPEN: does it need to CATCH cars? (heavier stacks / double row) — user to decide.
- [ ] **REPAIR PASS — 2026-10-03.** (serve.mjs on 8080 from THIS folder +
      GamesStudio/tools/cloudflared.exe). Test: jump + brake on every car; level switching; portrait HUD.
- [ ] **HANDLING PASS 2 + DEBUG PANEL — 2026-09-27.** Tune it yourself with the TUNE chip and tell me
      the numbers you land on; I will write them into cars.js as the new defaults.
- [ ] **Slice 1, Steps 0–2b + touch + marks + knockable cones — DELIVERED 2026-09-27.** Cloudflare tunnel (not itch — the
      user's call for this pass and the next): ``
      Drive it and say how it feels. Every measured figure, and the model as built, is in `ENGINE.md`.

## Queued
- [ ] **Slice 1 remainder** — audio (engine note + squeal), and screen shake for a proper impact (a 2 kg
      cone does not earn one). Sequential/manual box: the user said **keep it auto for now** (2026-09-27).
- [ ] **Open question raised by the build:** the floor is 200 x 200 m and the hatch tops out at ~193
      km/h, so a full-speed run crosses it in ~4 s. Decide whether the lab needs to be bigger, or
      whether that does not matter for a feel box.
- [ ] **Gamification comes after the lab**, and only once the user has driven it. Nothing from `BRIEF.md`
      §4/§5 — garage, pips, money, tracks, rivals — is to be started before then.
- [ ] Decide the open questions in `BRIEF.md` (rivals vs ghosts, the broke-player floor, fuel/damage
      persistence, what a pip is worth in lap seconds). **Not needed for Slice 1** — needed before the
      economy.

## Queued — the user's next direction (2026-09-27)
- [ ] **Progression: take every car from base spec progressively up.** This is the brief's 10-pip
      system. The mods seam already exists and every multiplier already defaults to 1.0.
- [ ] **Tyres as a choice, with silly brand names** (Kum / Spum / Creem as the register), each brand
      making a range — road, dirt, etc — with real spec differences. NOT NOW; noted as spec in
      BRIEF.md. Lands on the existing surface.mu hook, which is still a no-op waiting for exactly this.

## Awaiting a verdict — 2026-09-28
- [ ] **RALLY CAR**, bigger lab, cone race course, camera and gear-change work. Tunnel restarted (2026-10-01):

## Work log — Claude (2026-10-02)
- [ ] Wet tarmac → dry — DEFERRED to Tier 3. Requires tyre temperature (hot tyres clear wet surfaces).
- [ ] Tyre marks increase grip — pending
- [ ] Cross-surface contamination — pending
- [ ] Per-tyre temperature state machine — 4 independent wheel temps
- [ ] Hot tyres should take TIME or be VERY HOT to melt snow/ice/water. Not instant on first pass. Couple tyres to surface wear: tyre temp above a threshold AND multiple passes needed to clear wet/snow/ice.
- [ ] Cold tyre grip penalty on tarmac. Off-road surfaces unaffected.
- [ ] Wheelspin heats driven wheels, cornering heats fronts, drifting heats outside tyres.
- [ ] Cooling: off-road surfaces, not driving.
- [ ] Tyre types & tread system — multiple manufacturers, unique grip/slip/surface characteristics.
- [ ] Test: does brake freeze still happen? Airborne brake force now zero.
- [ ] Test: high-speed judder — SLIDE_BLEND bump should help.
- [ ] Test: steering feel with power curve.
- [ ] Test: camera fly-in at level start.
      dumped the whole budget onto lateral at once. Full history in ENGINE.md.

## Queued — from the playtesters, 2026-09-27 (in their order)
- [ ] **The floor is too small for the new speeds** — 300 m is crossed in ~5 s at 216 km/h; the
      screenshot at speed shows the car already off the map. Needs to grow with a tiled marks layer.
- [ ] Tyre marks should FADE after a while. STILL OPEN.
- [ ] Track car should look like an F1 car: bigger wheels, proper proportions. STILL OPEN.
- [ ] Camera should zoom out further the faster you go.
- [ ] Cars faster / more powerful / more weight and momentum still (user, on top of this pass).

## Queued — next session
- [ ] **THE ROOT FIX: model wheel angular velocity as a real state.** The rolling and sliding tyre laws
      disagree by ~2.8x at breakaway (measured FyR stepping 2115 -> 5951 N in one step). That mismatch
      is the track-car judder AND the likely reason steering lock still barely affects drift angle.
      Deriving longitudinal slip from a real wheel speed instead of approximating it removes the seam
      entirely. This is a substantial change to the longitudinal model — ASK BEFORE STARTING.
      Two cheaper attempts were measured and reverted; see ENGINE.md before trying a third.
- [ ] **Threshold braking regressed** — full pedal is optimal again. Brake force wants ~1.7 g.
