# Foreman handover

For the next foreman (a Claude session) taking over RAC3R. Read `CLAUDE.md`, then `TODO.md` ("Where we
are"), then this page. `ENGINE.md` is the architecture map. Last updated 2026-10-16 (evening).

## READ FIRST: the owner's phone is the yardstick

The owner plays on an **iPhone 17 Pro Max, Safari (iOS 18.7)**, often from the **home-screen icon** (a
full-screen web app; `manifest.webmanifest`). Desktop Chrome with the CPU slowed (`framecheck` and
similar tools) did NOT reproduce what the owner sees: several changes measured better on the laptop and
felt worse on the phone. So:

- **`?report=1`** makes the phone post its frame timings to the test server every 300 frames
  (`src/ui/report.ts` -> `serve.mjs` `/__report` -> the JSON-lines file in `RAC3R_REPORT_LOG`; the laptop's
  test server writes `GamesStudio/tools/logs/rac3r-phone-report.jsonl`). Each frame: dt, sim ms, draw ms,
  physics steps, tiles painted, highway slides, zoom (css px per m), GPU uploads, mipmap builds; plus
  screen size, dpr, browser and whether it ran from the home screen.
- **`node tools/phonereport.mjs <log> [--since <ISO time>]`** reads it: per run (session + level) the slow
  frames (> 25 ms), whether our JS was heavy in them, and by zoom band. Log times are UTC.
- Before proposing ANY judder test, read what was already tried: `docs/judder-assessment.md`, TODO.md
  "HIGHWAY JUDDER" (10-13) and this page. The owner had to point out twice on 10-15 that a test had been
  done before (memory churn, sound).

## Where things stand (2026-10-16 evening)

**The plain test link is the approved game** (owner rule, 10-16). A change the owner has not yet tried
on the phone goes behind a `?switch` - EVEN ONE THE OWNER ASKED FOR DIRECTLY (the menu recording went
straight to the plain link, lagged on the phone, and had to be wound back: "you didn't get a test
first"). On the owner's OK it becomes the default the same day, `=0` keeps the old path, and the
testlist entry is deleted with the verdict noted in TODO.md. Links given to the owner: the plain
tunnel link plus only the switch under test (`&report=1` for a measured run).

**Approved and default (all owner-tested on the phone, 10-15 / 10-16)**
- Ground on the GPU: floor, zones, hill shading (`?gpupaint=0` = the old tile painter; renderhash pins
  it for speed). Frame pacing (`?vsync=0`). The skid-mark layer wraps (the 136 m highway hitch).
- Zoom hold with SMOOTH moves (camera.ts springZoom): holds at a steady speed, follows the target as a
  critically damped spring while it moves (no staircase), forgets the menu car's speed at a start (no
  bounce), zooms out from 12 % off with 1.2 x LOOKAHEAD. `?zoomhold=0` = the old eased zoom.
- Minimap (hud/minimap.js): road ahead, facing the main view's way, the window pushed ahead of the car,
  zooms with the camera, rivals as dots, stage / lap progress bar; on the highway too (no bar). Pause
  menu MINIMAP row per difficulty mode: on in MOBILE / GAME / REALISH, off in RICH, locked off in REAL.
  `?minimap=0` / `?hwmap=0` turn it off.
- The Lab split: OG Lab, Surface Bowling Alley, The Rough Patch (TEST GROUNDS).
- Grippier grass: dry 0.47, long 0.50, so a puddle on grass grips as grass did (`?grassgrip=0`).
- Menu: thumbnails use a light level build; the rally stages are generated on first use
  (load.ts buildLevel); trackKit's onLane uses a segment grid. TEST MODE tap 4.0 -> 2.2 s (CPU x4).

**Parked**
- The menu RECORDING (`?menuvideo=1`, src/game/menuvideo.js, `node tools/menuvideo.mjs`): lagged on the
  phone and came in part way. Owner: revisit after the graphics update, and it must be a video of a
  race. Suspects: a real-time take with uneven frames (record from the deterministic runtime frame by
  frame instead), 3.8 MB over the tunnel first. Test behind the switch first.

**In progress: performance, owner-agreed order (10-16)**
MEASURED (Brands GP, 4 AI, CPU x4, 15 s profile): busy 96 %; SIMULATION ~59 % (ground checks under the
wheels 2.7 s, AI driving 1.7 s, car physics 2.1 s), DRAWING ~38 % (ground tile painting 1.8 s, kerb
teeth 0.5 s, HUD 0.9 s; cars, objects, marks ~0.1 s each). So the GPU sprite work alone would not fix
the menu lag (the menu race is mostly simulation).
1. Ground checks (each car samples the ground height ~22 times a physics step at 120 Hz, mostly the
   slope's central differences). DONE in this commit: the near-hint segment search tries +-4 first
   (+-21 only when the best is on that edge): querySubtrackInto 0.96 -> 0.33 s, applyGround 2.68 ->
   2.13 s per 15 s, simhash SAME. NEXT: fewer samples per step (slope from 3 samples reusing the
   wheel's height; the front-axle slope from the two front wheels: ~24 -> ~14) behind `?groundlite=1`,
   proved by lap times / racing lines. A cached height map was costed and REJECTED (first-lap cost over
   the whole track area, ruts change it, small bumps need a fine grid). Off-screen AI at half rate was
   offered; the owner asked that changes are still detected at driving speed - ask before doing it.
2. Ground tiles (track / kerbs / wear painted on the CPU, ~12 %, and the hitches when new ground scrolls
   in): MEASURED 10-16 (TODO PERFORMANCE 2): 98 % of tiles are prefetch, 87 % of a tile was the
   ribbon + kerb teeth traced for the whole track; longer-kept tiles rejected (a Brands lap ~1650
   tiles, ~190 MB). Owner chose A: `?ribboncull=1` (src/render/ribbon.ts), tile 5.5 -> 3.4 ms,
   phone test pending. Tools: tools/tilecost.mjs (reasons), tools/scratch/_tilecost.mjs (a 4-AI
   race with a per-layer profile), tools/scratch/_cullshots.mjs (phone-size race photos).
3. Phase C: cars, props, marks, particles as GPU sprites, then one canvas, then delete the old tile
   machinery. Then re-record the menu video and re-check the menu lag.

**Waiting for the owner**
- Rain and water (TODO "GRASS GRIP + WATER"): rules given (wet-weather tyres clear water from hard
  surfaces faster; normal tyres take 3 passes to clear / degrade it). Answered 10-16: rain is a
  WEATHER choice in the event setup (beside the AI choices); puddles more likely in dips, less on
  hills; wet grip and faster wear per surface combination (TODO "GRASS GRIP + WATER"). After the
  graphics work (owner order 10-16: graphics 2 and 3 first, then the rest of 1, then rain).

**Workflow that works (10-16)**
- Work in a worktree, never the served clone: `git worktree add -q --detach ../rac3r-wt HEAD`, then a
  node_modules junction (`cmd //c mklink //J ...rac3r-wt\node_modules ...rac3r\node_modules`). Clean up:
  `cmd //c rmdir` the junction FIRST, then `git worktree remove --force ../rac3r-wt`; check the clone's
  node_modules still has 77 entries.
- Proof in the background: `git stash -q -u`, save the three references, `git stash pop`, `npm run
  suite` (~13 min). Do not edit the worktree while it is stashed. A behaviour change on purpose: show
  that the OLD path is still SAME (e.g. `RAC3R_QUERY=grassgrip=0 node tools/renderhash.mjs`), then save
  new references before the suite.
- After pushing main, move the served clone: `git fetch -q origin && git checkout -q --detach
  origin/main`, then check the tunnel serves the new file.
- Profiling a race: a CDP Profiler on `?level=brands-snatch&ai=4&autopilot=1` at CPU x4 for 15 s,
  inclusive time by function - better than framecheck A/B runs with layers skipped (too noisy here).

**Test server:** `node serve.mjs` in the clone serves the WORKING TREE live - uncommitted edits reach the
phone at once. PIDs in `GamesStudio/tools/logs/rac3r-pids.txt`; restart it by PID with
`RAC3R_REPORT_LOG` set. Keep it and the tunnel running. It cannot answer byte-range requests (Safari
needs them for a <video> source; a blob URL does not).

**Older notes (10-15) - judder**
- Frame pacing fixed the constant fine shake (Safari's ms-rounded timestamps). Safari's touch
  processing costs frames (outside our code); the home screen roughly halves slow frames.
- `preserveDrawingBuffer: true` on the WebGL canvas is NEEDED on the iPhone. Do not optimise it away.
- Highway rebuild CANCELLED (owner): the hitch was the skid-mark layer. Straight Outta Swindon stays as
  a measuring stick in TEST GROUNDS; the name is kept for a future highway level.
- References: the TRUE ORIGINAL (10-08) worktree at `rac3r/original`, served at `<tunnel>/original/`.

## The owner's standing rules

- Give every proposal a size (S / M / L) and, for a plan, a total. Ask before design choices; S fixes may
  just be done and reported.
- Assess problems properly and do what a professional in the field would do: find the root cause and
  fix it there, not with patches over the symptom. DISCUSS THE PLAN with the owner before spending
  effort on a non-trivial fix; do not run experiment after experiment without telling them.
- The foreman may push to `main` itself when the change is proven (below). Never publish to itch.io until
  the owner says so.
- Visual or handling changes: measure, photograph at phone size (844x390 and 390x844), then the owner
  phone-tests. When the owner reports something that looks wrong, fix it - do not spend effort proving
  whose fault it was.
- Every car / track / stage / brand / generated name is a parody pun.
- No keys, tokens, tunnel URLs or process IDs in the repo.
- Bigeon ideas and fixes go in the owner's Bigeon idea text file on the worker PC desktop (append, numbered,
  "Problem / Workaround / Fix idea (size)"); SSH to the worker PC is allowed while the worker is down.
- Keep the test server and tunnel running unless told to stop them.
- The plain link is the approved game; anything new goes behind a switch for a phone test first (see
  "Where things stand"). Bring mockups before building a new piece of UI.
- One step at a time, then pause for the owner's phone verdict; give tap-able links.

## Proving a change

- `npm run verify` - syntax, encoding, tsc, lint. Must print OK.
- `npm run suite` - the quick checks (about 8 minutes on the foreman laptop). Before a change, save the
  references on the base commit: `node tools/worldhash.mjs --highway 20 save`, `node tools/simhash.mjs
  save`, `node tools/renderhash.mjs save`; after it they must print SAME (unless the change is meant to
  alter levels / driving / looks - say so).
- `node tools/samecode.mjs save` then `node tools/samecode.mjs` - for renames and comment-only edits: the
  built code is byte-identical.
- `RAC3R_QUERY="glground=0"` makes renderhash test the old 2D ground path.
- `tools/zoomcheck.mjs` (with a `ZOOMS=` list in a local copy) measures how much the ground changes between
  zooms; `tools/framecheck.mjs <level> [query]` frame times (run an A/B twice: 1 ms is noise).
- Run one heavy browser tool at a time: the foreman laptop has 6 GB of RAM.

## Getting a change onto main

`main` is protected: the `verify` GitHub check must pass on the exact commit first. So: commit, push the
commit to a branch (`git push origin HEAD:refs/heads/foreman/<name>` - spell out `refs/heads/` when the
clone is on a detached HEAD), wait for the `verify` check-run on that commit (GitHub API
`repos/staystale/Rac3r/commits/<sha>/check-runs`; there is no `gh` CLI on the laptop), then
`git push origin HEAD:refs/heads/main`. The second CI job, `checks`, runs the suite against the base
commit; it is not required, and it fails on purpose for intended visual / behaviour changes.

## Bigeon (the worker loop)

- The foreman works from the clone (`Desktop/G/rac3r`) with `node ../Bigeon/bin/bigeon.ts`:
  `status`, `send task --file <note>`, `watch results --timeout <min>`, `accept NNN`. Results also land
  in `.bigeon/comms-repo/results/NNN.md` (git pull there).
- The worker (Cline on the worker PC) has a 30-minute limit per task (raised from 10) and every single
  shell command is cut at about 30 seconds, so it cannot run the browser proofs: the foreman runs them
  and accepts per commit.
- What made worker tasks succeed: an exact base (`git fetch origin; git checkout -B worker/NNN <hash>`);
  "commit + push after EACH step"; "run Get-Date first, stop starting new steps after 22 minutes"; never
  leave an uncommitted edit (the end-of-task check reads the working tree, so a half-done step turns a good
  task into FAIL); scratch files outside the repo; edit with the file tool or node (never PowerShell
  Set-Content: it makes mojibake); one area per task, 40-80-line steps.
- `accept` refuses a FAIL result even when its pushed commits are good: send a follow-up task that
  branches from that branch, and accept that one.
- `watch results` can return an older result: check the number.
- Restarting the worker loop: Ctrl+C closes the worker window, so the owner opens a new terminal in the
  project and starts `node <Bigeon>/bin/bigeon.ts worker`. Give the owner those steps in full.
- The worker ran out of OpenRouter credit at task 231 (the owner tops it up). Until then the foreman does
  the work itself.

## Lessons from the overhaul

- GPU canvas rasterisation is not bit-exact between builds: renderhash launches Chromium with the GPU off.
- The tile time budget uses `performance.now()`: the deterministic tools freeze the clock, so they cannot
  see tile-timing effects - measure those with framecheck.
- With the GPU ground on, read the finished frame as the GPU canvas (`#glground`) with the screen canvas
  (`#c`) over it (renderhash and zoomcheck do this).
- Comment-only edits by script: a line starting with `* ` can be code (a multiplication continued from
  the line above), and `(; ` can be a `for` loop - check with samecode.
- Stop processes by PID, never by image name.

## Lessons from 2026-10-15

- Measure on the owner's phone (`?report=1`), not only on the laptop. Safari's ms-rounded timestamps, its
  touch processing and its compositing of two stacked canvases do not show in desktop Chrome.
- Canvas 2D drawing is deferred until read: an "upload" or "getImageData" cost in a profile is often the
  painting itself. Paint expensive canvases while idle (the surface textures warm at boot).
- A pattern fill from a CPU-backed texture onto a GPU-backed canvas moves the texture on every fill
  (2.7 s in 900 highway frames): keep tiles CPU-backed on the GPU path.
- Spreading an object with getters copies their values once: expose live counters as functions or
  plain object references.
- `serve.mjs` and `index.html` have CRLF line endings: match edit patterns allowing CRLF.

## Lessons from 2026-10-16

- Test on the phone before the plain link, even when the owner asked for the change (see above).
- Profile before planning: the "graphics" plan turned out to be mostly a SIMULATION problem.
- Cost an idea fully before promising a saving: the cached height map looked like a win and was not
  (area cost on the first lap, ruts, small bumps). Say so as soon as the numbers turn.
- The live menu race runs the whole game behind the menu; anything that makes a race cheaper makes
  the menu cheaper too.
- worldhash hashes key ORDER and global counters (tape run ids): a lazily built level can list as
  DIFFERENT with identical content - compare with sorted keys before believing it.
- A testlist string with an apostrophe breaks the build: no ' inside a '...' string.
