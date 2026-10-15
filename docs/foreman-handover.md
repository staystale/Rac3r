# Foreman handover

For the next foreman (a Claude session) taking over RAC3R. Read `CLAUDE.md`, then `TODO.md` ("Where we
are"), then this page. `ENGINE.md` is the architecture map. Last updated 2026-10-15 (evening).

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

## Where things stand (2026-10-15 evening)

**Judder - what is known**
- FIXED (default): **frame pacing** (`src/game/pacing.ts`, `?vsync=0` = off). Safari reports frame times
  rounded to whole ms (16 / 17 / 18, pairs like 24 + 10) while the display runs 16.68 ms; the game moved
  the world unevenly = the constant fine "texture dance" on every level, the 10-08 original too. Owner:
  better.
- KNOWN, outside our code: **Safari's touch processing** costs frames (10-13: a bare page with fingers
  dragging 64 drops a minute, the game's handling 22, without the extra touch blockers 11, no fingers 0;
  sound was ruled out then). Playing from the **home screen roughly halves** the slow frames (10-15). The
  owner does NOT want an app wrapper for now.
- On the phone our code is ~1 ms sim + ~3 ms draw a frame. Slow frames on 10-15 (home screen, GPU path):
  Lab ~0.2-0.5 %, highway ~0.5 %.
- **The highway still hitches about every 140-170 m of new road** (regular, at any speed, also hands-off
  with the autopilot, and with drawing switched off on 10-13). Not GPU uploads (6 of 44 slow frames), not
  road builds (2 of 44). Cause unknown. Desktop Chrome GC tracing could not single out garbage collection
  (circuits collect as much and do not hitch).
- `preserveDrawingBuffer: true` on the WebGL canvas is NEEDED on the iPhone (off: Lab 0.6 % slow, on:
  0.37 %; owner "better"). Do not optimise it away again.

**Decided, in progress: a NEW HIGHWAY built from the ground up, phone-measured at every step** (owner,
10-13 and again 10-15). Bisect by construction: step 1 an empty endless straight; then terrain + shading,
props and fences, fields, traffic; the step where the per-distance hitch appears is the cause. The new
streaming must do its per-chunk work in small even slices.
- **Step 1 status: NOT WORKING YET.** `src/world/levels/straight-outta.ts` ("Straight Outta Swindon": a
  30 km straight on grass, built once, ghost return segment) is written but NOT registered in
  `levels/index.ts`. First try (laptop, phone size, `?gpupaint=1`, autopilot 140): the road was not drawn
  beyond the first ~100 m and the game ran at 10 fps - the road drawing (render/road.ts ribbon, tiles)
  does not cope with a 30 km subtrack; and the AI drove ~60 km/h near the start (the ghost return reads
  as a 180 deg turn in its speed profile). Next: find why (profile one frame; probably per-tile work over
  every centreline point), or build the straight from shorter streamed chunks - which step 2 needs
  anyway. Register the level only when it drives and draws, then give the owner the hands-off link:
  `/?menu=0&guide=0&rules=0&level=straight-outta&autopilot=140&gpupaint=1&zoomhold=1&report=1`.

**Rendering - the fundamental issue (explained to and agreed with the owner)**
Pixel art drawn by the CPU into a low-res buffer at a constantly changing zoom: every zoom change
re-rasterised everything, which grew the zoom-step tile cache, stand-ins, the view lock's zoom rounding,
the CPU palette snap, budgets... The fix is the standard design: draw everything at a fixed density on
the GPU and apply the zoom as a GPU scale. Done so far, all behind `?gpupaint=1` (the default game is
unchanged, renderhash SAME):
- Floor + zones on the GPU (`render/glpaint.ts`); surfaces BAKED with their base and palette on the CPU and
  only blended in the shader (snapping after the blend made texels jump: the owner's "micro judder at
  certain zoom levels", fixed).
- Hill shading on the GPU (`render/glshade.ts`): a world grid of 0.5 m cells in 8 m chunks, changed chunks
  refreshed within a 2 ms budget.
- The remaining tile layers (track, lanes, kerbs, wear, labels) at ONE fixed density (the zoom-1 step),
  CPU-backed tile canvases, palette snap per texel on the GPU (`glground.ts` sink), the widest view
  prefetched one tile a frame; a stencil masks old / new tiles; no flat overview stand-in on this path.
- Agreed plan after the highway work: **phase C** (cars, props, marks, particles as GPU sprites at a fixed
  density), then **one canvas**, then delete the old machinery (zoom-step tiles, stand-ins, view-lock
  zoom rounding, CPU snap). `?glground=0` and `/original/` stay as references.
- Camera: `?zoomhold=1` (hold the zoom, glide when the target is 20 % away, 1.6 s per halving). The owner
  tests with it; not the default yet.

**References for comparison**
- The TRUE ORIGINAL (10-08, before the overhaul): a git worktree of 857f105 at `rac3r/original` (excluded
  in `.git/info/exclude`), served at `<tunnel>/original/`. `?glground=0` is NOT the original (the texture
  look changed on 10-13 / 10-14).
- Owner test link: `<tunnel>/?zoomhold=1&gpupaint=1&report=1` (the home-screen icon). The tunnel URL is in
  `GamesStudio/tools/logs/rac3r-tunnel.err` (never in the repo). If the tunnel restarts, the owner must
  re-add the icon.

**Owner requests queued (TODO.md):** an optional minimap on every track (rally stages most of all); the
Lab rebuild / split (it juddered in the original too).

**Test server:** `node serve.mjs` in the clone serves the WORKING TREE live - uncommitted edits reach the
phone at once (the owner's runs during an edit can see half-done code). PIDs in
`GamesStudio/tools/logs/rac3r-pids.txt`; restart it by PID with `RAC3R_REPORT_LOG` set. Keep it and the
tunnel running.

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
