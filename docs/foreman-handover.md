# Foreman handover

Written on the owner's request, 2026-10-17 evening (main 6cc40d3, plus this page). Read `CLAUDE.md`,
then `NOTES.md` (the owner's rules, decisions, measured lessons and the routine - not repeated
here), then `TODO.md`, then this page.

## The decision: rebuild the drawing lean, keep the game

The owner agreed (17:40): **we overdid the rendering, not the game.** Physics, AI, cars and tracks
take ~3 ms of a 16.7 ms frame on the owner's iPhone; nothing there needs rebuilding, and feel and
function must stay exactly as they are. Since 10-15 the drawing gained layer after layer, each
judged by its look (the ground on the GPU with its own hill-shading pass, two stacked full-screen
canvases, cars and skid marks redrawn at screen resolution, a minimap of ~200 strokes). Safari pays
for all of it after our JS finishes, where no frame timing can see it, and holds frames.

The plan, in order, one step at a time, each with a phone screen recording (held frames counted):

1. **`?lean=1` (S-M): draw the way the old builds did.** One 2D canvas; the ground painted on the
   CPU (the `?glground=0` path still exists and works); cars and skid marks in the art buffer (the
   `?sharpcars=0` / `?sharpmarks=0` paths still exist); no GPU ground, no separate shading pass.
   Gameplay identical. Target: ~0 held frames through Castle Cum corners 1 and 2.
2. **Fix the "dance" by how the camera zooms.** The shimmer of edges and textures is pixel art
   resized by a slightly different amount every frame of a smooth zoom; the GPU ground was our way
   of hiding it, and it cost the smoothness. Show the owner the options side by side (a mockup or
   switches), owner chooses: (a) zoom in a few fixed steps (3-4 levels, a quick change between):
   each drawn at exact size, no dance, cheap - what pixel-art games do; (b) keep the smooth zoom
   and accept a little shimmer; (c) a smaller zoom range. The zoom code: `render/camera.ts`
   (zoom hold, the spring), the view lock in `render.ts` `applyViewLock`.
3. **Add the nicer touches back one at a time** (sharp cars, sharp marks, minimap, hill shading,
   texture look), each with a recording; keep only what keeps the corners smooth.

Size: M-L in total, in small measured steps. Then retire the GPU ground path (`glground.ts`,
`glpaint.ts`, `glshade.ts`) so there is one ground path again - ask the owner first.

## What the recordings proved (owner's iPhone, Castle Cum, ~15 s each)

| Build | Held frames | Note |
|---|---|---|
| Today's default (GPU ground under the 2D canvas) | 78 | 15:35 run: 50 in 8 s from corner 2 |
| `?drawlite=1` (80 % less ground painting) | 69 | undone: painting was not the cause |
| `?onecanvas=1` (GPU ground drawn into the 2D canvas) | 48 | still on main behind the switch |
| `?glground=0` (ground on the CPU, one canvas) | 9 | owner: "some lag", edges dance |
| The original (10-08, owner driving, no AI) | 0 at the corners | 15 in 12 s, all on the straight while zooming |

In every run the phone's own report showed rAF on time and the physics even (2 steps a frame on
1751 of 1766 frames): the holds are Safari presenting, not our code. The owner's switch test
(no recordings): no ground = judder free, no props = nearly none, no shading = less.

## Done today (on main, defaults unless said)

- Test list emptied (all passed); the test straight Straight Outta Swindon removed (name reserved).
- Weather: the owner's answers and plan R1-R4 in `TODO.md` "GRASS GRIP + WATER" (season slider,
  rain can change mid-race, puddles drain slowly / normal tyres several passes / rain tyres one,
  one water system). Not started; after the rendering work.
- Suite browser tools fixed: `tools/lib/browser.mjs` `gotoGame` (the game loads by a dynamic
  import; Edge 155 never runs Playwright's animation-frame poll under the determinism script).
- `texwarm`: the long-grass textures painted while loading (the menu's ~125 ms frame gone).
- Screen sharpness capped at 1.5 (`MAX_DPR`, `?dpr=2` = old): dropped frames roughly halved.
- `startfix`: the race start without the fly-in hand-over jolt (wear reset stales only worn tiles,
  the fly-in uploads tiles and readies the shading ahead, colours read through one reused canvas).
- Undone (do not repeat without a new reason): `?stalecap` (one stale repaint a frame), `?drawlite`
  (ribbon cull + 2 tiles a frame + minimap fade steps; kept in git e5c8a21).
- `?onecanvas=1` is on main behind its switch (testlist entry `onecanvas`); if the lean plan goes
  ahead it can be removed with the GPU ground.

## Measuring

- **Held frames** (the only measure that sees this judder): the owner screen-records (Control
  Centre) and attaches the .mov in the chat; it lands in `~/.claude/uploads/<session>/`. The
  scripts are in this session's scratchpad
  `AppData/Local/Temp/claude/C--Users-Admin-Desktop-G-car-sim/fff86173-0929-4ac5-b6d5-51f0de6b677a/scratchpad/`:
  copy the video to `<dir>/rec.mov` with `video/motion.html` and `video/probe.html` beside it, then
  `node vmotion.mjs <dir> 0 900` (ground shift per frame by block matching, ~0.25 s a frame, run in
  the background) and `node held.mjs <dir>/motion-0.json` (held frames, 1.5x / 0.5x steps, per
  second). `mp4times.mjs` reads the file's own frame timing; `vgrab.mjs <dir> <s>` saves a frame;
  `vmont.mjs` puts frames side by side; `vcars.mjs` tracks the red / blue AI cars (did everything
  freeze, or only one layer). Edge decodes the iPhone's HEVC.
- **`tools/drawload.mjs`** (in the repo): the drawing a frame asks of the browser per layer (WebGL
  draws and pixels per program; 2D fills, strokes, path pieces per canvas). Good for proving a
  change cuts work on the laptop; it showed the work is not what holds frames.
- Phone report (`?report=1`, `tools/phonereport.mjs`): times are UTC (an hour behind the phone's
  clock in October).
- Owner test links: Castle Cum, autopilot, 3 AI:
  `<tunnel>/?menu=0&guide=0&rules=0&level=castle-cum&ai=3&autopilot=1&report=1` plus the switch
  under test. The true original is at `<tunnel>/original/` (no autopilot: the owner drives).

## Picking up

- Test server and tunnel running (`serve.mjs` PID 6236, cloudflared 1408, in
  `GamesStudio/tools/logs/rac3r-pids.txt`); `serve.mjs` did not change today.
- Worktree `Desktop/G/rac3r-wt` clean on main. Saved references: `tools/.renderhash` there (and
  `renderhash-ref-dpr15.json` in the scratchpad above; sharpness 1.5 and every change since: SAME);
  `.simhash` / `.worldhash` from `.../1db38863-a214-4ad6-9a79-7cde47066581/scratchpad/refs/`
  (worldhash still lists the removed straight-outta: re-save it).
- The worker PC was shut down on the owner's request (it will not answer SSH until switched on).
- `checks` on GitHub had failed for 40+ commits (the browser tools); `gotoGame` fixed the suite
  locally - look at the next `checks` run.
