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
  (`?sharpmarks=0`, `?jokerfix=0` = off). Pre-turned pixel art (RotSprite)
  was the alternative, not chosen.
- Not wanted / undone: the highway rebuild (cancelled 10-15), a fade at zoom steps, tiles tracing
  only their part of the ribbon (`?ribboncull`, undone 10-16), the WebGL cars (`?gpucars`, removed
  10-16), the menu recording (parked until after the graphics work).
- Order (10-16): graphics first (the tyre marks quiver: done 10-17), then fewer ground lookups
  (`?groundlookup`, default since 10-17), then rain and weather (answers in `TODO.md`). Off-screen
  AI at half rate: saved for when more performance is needed.

## Measured lessons

- The owner's iPhone 17 Pro Max (Safari, often the home-screen app) is the yardstick, not the laptop.
  Our JS takes ~4 ms of a 16.7 ms frame there: the phone is not CPU-bound. Laptop numbers at CPU x4
  overstate our cost; use them for A/B only, never as the reason for a change the owner will feel.
- GPU work helps visual problems (texture flicker at zoom), not speed on the phone.
- Never copy pixels between the 2D canvas and WebGL every frame: uploading the art buffer each frame
  took the phone's draw time from 3 to 7-8 ms and juddered.
- Felt judder comes and goes on the same build (two Castle Cum runs, same link: "juddery" and "fine",
  both ~0.4 % slow frames). One rough run is a reason for a back-to-back A/B, not proof.
- Safari rounds rAF timestamps to whole ms: frame pacing (`game/pacing.ts`) fixed the constant shake.
- The 136 m highway hitch was the skid-mark layer re-centring (26 MB copy); it now wraps.
- `preserveDrawingBuffer: true` on the WebGL canvas is needed on the iPhone (fewer slow frames).
- Chrome's canvas picks its anti-aliasing method by a path's point count: clipping a path changes a
  few edge pixels, so "same shapes" is not "same pixels".
- Canvas 2D drawing is deferred until read: a getImageData / upload cost in a profile is often the
  painting itself.
- A CPU-backed texture pattern-filled onto a GPU-backed canvas is moved on every fill.
- The tyre marks quiver: the marks layer (4.2 px/m) is stretched ~3.6x nearest into the art grid each
  frame, so a mark pixel is 3 or 4 art px wide by camera position; now drawn on the screen canvas.
- Laptop frame numbers swing with the machine (Brands work median 20 ms one hour, 38 ms the next,
  main included): only compare A/B runs made back to back.
- `?report=1` records without drawing the meter graph (`?meter=1` shows it).

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
  `tools/shotdiff.mjs`, `tools/zoomcheck.mjs`, `tools/scratch/carmock.html` (car drawing mockup).
