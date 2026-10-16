# RAC3R - open work

New session? Read `CLAUDE.md`, then this file. Open items only: finished work is in the git history.
Foreman taking over? Also read `docs/foreman-handover.md`.

## Where we are

- The code quality overhaul (below) is DONE (phases 0-10). Lint: 0 problems. `npm run suite` runs the
  quick checks (pass / fail, exit code); `node tools/runall.mjs --full` adds the slow ones.
- Behaviour is proved unchanged by `tools/worldhash.mjs` (level data), `tools/simhash.mjs` (every car, every
  step), `tools/renderhash.mjs` (pixels) - save the reference on the base commit, then compare.
- Work is foremanned with Bigeon (worker PC + `node ../Bigeon/bin/bigeon.ts`); see `CLAUDE.md`.
- Do not publish to itch.io until the owner approves the converted game.
- HANDOVER: docs/foreman-handover.md (2026-10-16 evening) - read it first. Measure judder on the
  owner's iPhone with ?report=1 and tools/phonereport.mjs, not only on the laptop.
- JUDDER FIXED (owner phone runs 2026-10-15, ?report=1): the per-distance hitch of the highway
  and the Lab was marks.js re-centring its 26 MB skid-mark canvas (a new canvas + two full copies)
  each time the car was 136 m (0.45 x MARK_EXTENT) from the layer's centre, on levels that do not
  fit the layer. Now a wrap-around layer (no copy, no allocation). Found on the empty Swindon
  straight: one frame ~12 ms late every 3.5 s = 136 m at 140 km/h, our JS 1-3 ms. After the fix:
  Swindon no rhythm (27 s clean); old highway hands-off 3 slow frames in 48 s (0.06 %, was ~0.5 %),
  owner "no visual drops"; Lab driven by hand 0.41 % single-refresh misses (Safari tab; the owner's
  hand-driven Knobhill run from the home screen 0.19 %), owner "much better, a couple of drops".
  The 10-13 "inside Safari" verdict was wrong: it was our canvas copy, deferred by Safari.
- HIGHWAY REBUILD CANCELLED (owner): it was planned only because of this hitch. Straight Outta
  Swindon stays as a measuring stick (TEST GROUNDS, "TEST STRAIGHT") while it does not get in
  the way. NAME NOTE (owner): every highway level gets its own name; "Straight Outta Swindon" is
  kept for a future highway level - give the test straight another name then.
- Straight Outta Swindon (src/world/levels/straight-outta.ts): a 30 km straight running north,
  built once. Making it work fixed, for every level: the inclusion scan covers the floor
  rectangle, drawPatches reads PATCH_GRID, drawKerb draws only blocks in view, zoneAt treats a
  sector-less road as tarmac, the overview caps its long side at 4096 px.
  Still O(track points) (fine at 3000 points): drawTrackRibbon walks every centreline point per
  tile; session.js updateRecoveryTracking scans every point each sim step.
- GRASS THROUGH THE CRACKS (owner: a and b, "like real life"): long-grass tufts in some
  broken-tarmac flecks, and scattered on broken-tarmac / concrete ground (blend.ts, own random
  stream: every existing patch unchanged). Owner look pending (testlist 'cracktufts').
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
      1. Ground checks: near-hint search +-4 first (tyrewall.ts NEAR_FIRST): querySubtrackInto 0.96
         -> 0.33 s, applyGround 2.68 -> 2.13 s, simhash SAME - DONE. Next: fewer samples per step
         behind ?groundlite=1 (lap-time proof). Height map rejected; off-screen AI half rate: ask.
      2. Ground tiles: measure GPU track geometry vs longer-kept painted tiles, then propose.
      3. Phase C GPU sprites -> one canvas -> delete the old tile machinery; then the menu video.
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
      normal tyres take 3 passes to clear water / degrade it. Open questions to the owner: grass
      0.47 ok; rain chosen in setup or random, changing mid-race; puddles in dips only, draining
      after; the wet-grip table per surface. Order (owner): menu slowness, then grass, then the
      graphics plan.

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
