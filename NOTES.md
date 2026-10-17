# RAC3R - working notes

The standing notes for whoever works on RAC3R: the owner's rules, decisions, measured lessons and the
routine. Read after `CLAUDE.md` and before `TODO.md`. Keep every entry short and current: edit an entry
in place, replace it when it changes, delete it when it no longer holds. This is not a log: history is
in git, open work in `TODO.md`. Write a handover document only when the owner asks for one.

## Owner rules

- Discuss before anything non-trivial: find the root cause, propose the fix with a size (S / M / L, a
  total for a plan), wait for a yes. No chains of experiments without telling the owner.
- One step at a time, then pause for the owner's phone verdict. Give tap-able links.
- The plain test link is the approved game. Anything new goes behind a `?switch` for a phone test
  first, even when the owner asked for it. On the owner's OK it becomes the default the same day
  (`=0` keeps the old path), its testlist entry is deleted and the verdict noted in `TODO.md`.
- Links to the owner: the plain link plus only the switch under test, `&report=1` for a measured run.
  For a judder question ask for two runs back to back, with and without the switch, same level.
- When the owner reports something that looks wrong, fix it; do not spend effort proving whose fault
  it was. If asked to "fix it or undo it" and the cause is not found, undo.
- Bring mockups before building new UI or a new look (the car mockup: `tools/scratch/carmock.html`).
- Every car / track / stage / brand / generated name is a parody pun.
- No keys, tokens, tunnel URLs or process IDs in the repo. No itch.io push until the owner says so.
- The foreman may push to `main` once the change is proven (routine below).
- Keep the test server and the tunnel running.
- Check what tools and earlier work exist before building a new tool (`ls tools`, `git log --grep`,
  `TODO.md`, these notes); build a new one only for what is missing.
- Handovers only when the owner asks. Notes go here.
- Bigeon ideas and fixes go in the owner's idea file on the worker PC (SSH; see the owner's README).

## Decisions (owner)

- Ground drawn by the GPU (floor, zones, hill shading; fixed-density tiles for the rest), zoom hold
  with smooth moves, frame pacing, minimap (highway too), grippier grass, the Lab split: approved and
  default (10-15 / 10-16).
- Cars: look B, turned and scaled at screen resolution on the 2D screen canvas (`drawSharpCarLayers`),
  not strict pixel art; default since 10-16 (`?sharpcars=0` = off). Skid marks drawn on the screen
  canvas too (no quiver), and the joker lane on the minimap + RESET back onto it: default since 10-17
  (`?sharpmarks=0`, `?jokerfix=0` = off). Ground tiles at their exact place on the GPU ground, so
  track edges hold still while zooming: default since 10-17 (`?exacttiles=0`). The pause menu's
  HUD list (each display piece on / off; controls never; tyre / damage OFF stays off when damaged):
  default since 10-17 (`?hudmenu=0`, `?tyreoff=0`). Loading: the game as one bundled file from
  the test server and the menu thumbnails saved per version: default since 10-17 (`?bundle=0`,
  `?thumbcache=0`); the tools (automation) always load the separate modules. The menu: no fly-in behind it, thumbnails
  painted while loading, long-grass blades stroked once (one palette shade off on ~0.2 % of
  long-grass pixels, owner accepted): default since 10-17 (`?menufast=0`). The long-grass textures
  painted while loading (the menu's ~125 ms frame): default since 10-17 (`?texwarm=0`). Screen
  sharpness capped at 1.5 device px per CSS px (was 2): default since 10-17 (`?dpr=2` = old). The
  race start without the fly-in hand-over jolt: default since 10-17 (`?startfix=0`).
  Pre-turned pixel art (RotSprite)
  was the alternative, not chosen.
- Not wanted / undone: the highway rebuild (cancelled 10-15), a fade at zoom steps, tiles tracing
  only their part of the ribbon (`?ribboncull`, undone 10-16), the WebGL cars (`?gpucars`, removed
  10-16), the menu recording (parked until after the graphics work).
- Order (10-17 night): the lean drawing plan is paused and today's default kept (the holds are
  Safari's, see Measured lessons); next weather (answers and plan R1-R4 in `TODO.md` "GRASS GRIP
  + WATER"). Off-screen AI at half rate: saved.
- Weather (10-18): approved and the default (?weather=0 off): the season / weather setup rows,
  changing weather, wet grip per surface, the wet look, puddles and snow from the weather (scenery
  water permanent), the cold freezing water; sliding wheels wear the ground twice (?slidewear=0).
  Tyre wear (?tyrewear=1) under test. Lighting / time of day next, its own switch.
- Weather (10-17): a season slider sets the chances of rain / snow / dry / hot / super hot, the
  temperature and the track condition; it can change mid-race; it must add no lag. One water
  system: the existing wet / puddle cover, extended, never a second one.
- "Straight Outta Swindon" is a reserved name for a future highway level (the test straight that
  used it was removed 10-17).

## Measured lessons

- The owner's iPhone 17 Pro Max (Safari, often the home-screen app) is the yardstick, not the laptop.
  Our JS takes ~4 ms of a 16.7 ms frame there: the phone is not CPU-bound. Laptop numbers at CPU x4
  overstate our cost; use them for A/B only, never as the reason for a change the owner will feel.
- GPU work helps visual problems (texture flicker at zoom), not speed on the phone - and it costs
  smoothness there: the WebGL ground under the 2D canvas made Safari hold 48-78 frames in 15 s at
  Castle Cum's corners, the CPU ground 9, the original build 0. Every new look is a per-frame cost
  for Safari: prove each with a held-frame recording before it becomes the default.
- The held frames are Safari's way of showing the page: the same default build in DuckDuckGo
  (iOS WebKit too) showed the owner no holds while a Safari tab held 42 in 10 s (10-17). The
  lean drawing only brought Safari to the original's level (0.3-0.6 a second). Test a Safari
  look in the home-screen app too before blaming our drawing.
- Never copy pixels between the 2D canvas and WebGL every frame: uploading the art buffer each frame
  took the phone's draw time from 3 to 7-8 ms and juddered.
- Felt judder comes and goes on the same build (two Castle Cum runs, same link: "juddery" and "fine",
  both ~0.4 % slow frames). One rough run is a reason for a back-to-back A/B, not proof.
- Safari rounds rAF timestamps to whole ms: frame pacing (`game/pacing.ts`) fixed the constant shake.
- The 136 m highway hitch was the skid-mark layer re-centring (26 MB copy); it now wraps.
- `preserveDrawingBuffer: true` on the WebGL canvas is needed on the iPhone (fewer slow frames).
- Held frames are invisible to rAF: an owner screen recording showed Safari holding ~6 frames a
  second at Castle Cum's corners while every rAF and physics step was on time. Count held frames in a
  recording (frames identical to the one before while things move), and count drawing work with
  tools/drawload.mjs; frame times alone cannot see this.
- In the recording counter (motion.html, frames shrunk to 220 px) the ground moves ~1.3 px a
  frame: its "1.5x / 0.5x step" counts are matching noise, not judder. Trust held frames only.
- The phone report's physics steps: 2 a frame on 97-99 % of race frames (lean, 10-17): the game
  moves evenly; what remains is how Safari shows it.
- Screen pixels cost frames on the iPhone even with our JS at 2-3 ms: sharpness 1.5 vs 2 halved
  the dropped frames in back-to-back races (4.5 vs 8.4 a minute); the owner saw no blur.
- Chrome's canvas picks its anti-aliasing method by a path's point count: clipping a path changes a
  few edge pixels, so "same shapes" is not "same pixels".
- Canvas 2D drawing is deferred until read: a getImageData / upload cost in a profile is often the
  painting itself.
- A CPU-backed texture pattern-filled onto a GPU-backed canvas is moved on every fill.
- Track edges jiggled only while the zoom moved: tiles placed on whole art pixels under a GPU
  ground that zooms smoothly (up to 1.5 device px a frame). Measure motion against a control.
- The tyre marks quiver: the marks layer (4.2 px/m) is stretched ~3.6x nearest into the art grid each
  frame, so a mark pixel is 3 or 4 art px wide by camera position; now drawn on the screen canvas.
- Laptop frame numbers swing with the machine (Brands work median 20 ms one hour, 38 ms the next,
  main included): only compare A/B runs made back to back.
- The phone in Safari (tab or home screen) has 1-5 % off-beat frames (early or late) in every mode;
  a screen recording shows them as a frame held twice. Not our code (2-3 ms a frame): do not chase
  them as a menu or race problem without a back-to-back A/B.
- The test server sends the game as ~160 modules, never cached: over the tunnel that is seconds
  of load before our code runs; the bundle (one file, the default) fixed it. Measure the
  phone's load with `loadMs` (`phonereport` prints it).
- `?report=1` records without drawing the meter graph (`?meter=1` shows it). It records the
  menu too: `phonereport` prints a MENU run (frame times, ignored taps, slowest tap handler).

## Routine

- Work in a worktree, never the served clone: `git worktree add -q --detach ../rac3r-wt origin/main`,
  then a node_modules junction (`cmd //c mklink //J ...rac3r-wt\node_modules ...rac3r\node_modules`).
  Clean up: `cmd //c rmdir` the junction first, then `git worktree remove --force ../rac3r-wt`; the
  clone's node_modules must still have 77 entries.
- Proofs: `npm run verify`; `node tools/settingscheck.mjs` for switches; `renderhash` (pixels, ~7 min)
  only for drawing changes, `simhash` / `worldhash` for physics / level changes. Reuse saved
  references (`tools/.renderhash` etc.) between changes instead of re-saving on the base. A change
  meant to alter pixels: prove the old path SAME with `RAC3R_QUERY=<switch>=0`, then save new ones.
- Photograph visual changes at 844x390 and 390x844 and look at them before reporting.
- To main: commit, `git push origin HEAD:refs/heads/foreman/<name>`, wait for the `verify` check-run
  (GitHub API `repos/staystale/Rac3r/commits/<sha>/check-runs`), `git push origin HEAD:refs/heads/main`,
  delete the branch, then move the served clone: `git fetch -q origin && git checkout -q --detach
  origin/main`.
- Phone runs: `node tools/phonereport.mjs <report log> --since <UTC time>`; the log path is in the
  owner's README / the test server's start-up.
- Long tools: run in the background, write to a file, poll it. One heavy browser tool at a time
  (6 GB laptop). Stop processes by PID only.
- Long inline text in the Bash tool can fail to parse: write scripts to a file and run them.

## Tools worth knowing

- `tools/tilecost.mjs` (tiles by reason), `tools/framecheck.mjs <level> [query]` (frame times),
  `tools/profile.mjs`, `tools/phonereport.mjs`, `tools/renderhash.mjs` (`--only`, `--shots`),
  `tools/shotdiff.mjs`, `tools/zoomcheck.mjs`, `tools/scratch/carmock.html` (car drawing mockup),
  `tools/edgecheck.mjs` (does the white edge line move rigidly; `--control` = the noise floor),
  `tools/drawload.mjs` (drawing asked per frame, per layer: what Safari paints after our JS).
- Browser tools open the game with `gotoGame` (`tools/lib/browser.mjs`): the game starts by a
  dynamic import, so the page's load event comes before `window.__game`; and Edge 155 never runs
  Playwright's default animation-frame poll under the determinism script (use a timed poll).
  Tools not yet moved to it may read the game too early.
