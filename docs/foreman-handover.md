# Foreman handover

For the next foreman (a Claude session) taking over RAC3R. Read `CLAUDE.md`, then `TODO.md` ("Where we
are"), then this page. `ENGINE.md` is the architecture map.

## Where things stand

- The code quality overhaul is DONE (phases 0-10): lint 0 problems, every function under 80 lines and
  complexity 15, every file under 800 lines, docs trimmed, CI on every push.
- Code comments are clean: no dates, task numbers or quotes; owner reasons are "(requirement: ...)" notes.
- GROUND ON THE GPU, step A is DONE (main): `src/render/glground.ts` draws the cached ground tiles with
  WebGL2 at screen resolution (`?glground=0` = the old 2D path). It removed the flicker WITHIN a zoom
  step (5.7 % -> 1.4 % of pixels per tiny zoom change). The owner still sees **tiny shifts in the surface
  textures**: they happen when the camera crosses a ZOOM STEP, because each step's tiles are a separate
  painting at a different resolution (zoomcheck across 0.9 -> 0.3: spikes of 4.9 / 6.1 / 9.6 % at the
  switches, 1-3 % elsewhere). Not the palette snap, not the hill shading (both measured), and a filtered
  texture shrink (branch worker/224) barely helps. A fade between steps was tried and REJECTED by the
  owner ("I don't want dissolves").
- AGREED NEXT (owner approved 2b; start it): the ground at ONE fixed pixel density drawn by the GPU every
  frame, in world coordinates - no tiles, no zoom steps - like the car sprites (17.3 px per metre). A
  CPU version at fixed density was estimated at ~2 M px/s to paint at highway speed fully zoomed out,
  about what a phone-speed CPU manages (~1.7 M px/s), so the GPU is the robust route; it also removes
  tile painting from the highway (today ~17 ms a tile, the old highway judder). Phases, each behind a
  switch and compared by screenshot before it becomes the default:
  - B1 (M): GPU ground skeleton: base floor and surface zones, sampling the existing pre-painted
    surface textures (`render/textures.ts`, uploaded once, repeat + mipmaps) in world space.
  - B2 (M/L): track ribbon, lanes, dashes, kerbs, paint, runoff, bumps as GPU geometry; pixel edges
    snapped to the fixed world texel grid.
  - B3 (M): wear, puddles, snow (a data texture of the wear grid, updated only where it changes),
    patches.
  - B4 (M): hill shading (a height texture), the palette, the fly-in, highway streaming.
  - B5 (S/M): zoomcheck shows no step shifts, framecheck (highway especially), screenshots, the owner's
    phone test; then make it the default and keep the 2D path as the fallback.
  Owner phone tests after B2 and at the end. Marks, props, cars, particles and the HUD stay 2D.
- Then the owner's queued features (TODO.md "Open items", `docs/specs/`).
- Known failing checks that are older than the overhaul (TODO.md "Known bugs"): racecheck case C,
  hwracecheck, trafficcheck, treadmillcheck; solidcheck is timing-dependent. The suite runner marks them
  KNOWN-FAIL.

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
