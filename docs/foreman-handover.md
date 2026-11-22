# Foreman handover

Kept current as the work goes (owner 11-12: "update the handover as we go"). Last updated
2026-11-22 (afternoon). Read `CLAUDE.md`, then `NOTES.md` (the owner's rules and the Routine at its end,
not repeated here), then `TODO.md`, then this page. The 11-07 version of this page is in git.

## Where we are (11-21)

- **ITCH** = `2026-11-21-67c5592c` (push #5, owner yes): + the reset fix, headlights, FPS toggle,
  tyre marks kept whole, Blighty Park RX + circuit, the chequered flag every race. Ask before #6.
- **Main** = 186bfb32 (round171: trailer/boxhold/gridlen passed, CI green). Serve locally; push only for CI.
  LESSON: a level made plain needs tools/laplengths.mjs re-run (CI failed on it twice).
- **The owner's link** = foreman/round191 074b8bc8 (local, 11-22 14:20): the AI pass, proved w88 SAME
  (plain: hazard incl. the stop fix, softback, brakepedal, gapdest highway-only, revstuck 4 s rule; aitune
  and gapcommit REMOVED). Not yet on main: rounds 172-191. Merge the c-pass186 (c19), c-pass-tl (c20)
  passes once proved, then CI, then push main.
- **NOISE (w86/w87):** off alone moves up to 51 incidents/track and 22 km/h on the motorway between
  4-seed sets. 4-seed sweeps cannot judge AI changes; the owner's phone decides (or ~16 seeds/side).
  PC jobs: ONE detached wmic launch each (scratchpad/launch1.sh confirms start); the laptop memory
  reaper kills long laptop loops. Foreman uses CronCreate one-shots to check PC jobs.
- **Worker A** (a2fab314deb77a72b, PC repo, port 8091): ?contactcost (plan approved 11-22: rear-end,
  side rub, cut-off costs in ai/gapPick.ts lineScore; staged scenes, no sweeps). Then the slider sweep
  (waiting: the owner picks more seeds vs phone).
- **Worker C** (a60bdb17a2f902ec3, PC repo2, port 8092): ?trailroll step 2 done (worker/c-trailroll
  47ca3285, trailer tips at 0.45 g, owner chose (a)); step 3 (cab and trailer roll together) building;
  load shift and AI/traffic trailers LATER. Hill climb SPIKES PEAK parked on worker/c-hill2 559d13fd
  (grade too steep, ease to 7.9 %). PC proofs: c19 running (14:23), then c20, then c18 (read each .cmd).
- **PARKED, the owner's next list:** PIT STOPS (the owner has IMAGES - ask for them, then discuss);
  the AI rework (circuits' off-track and first-corner pile-ups, Pembreezy); a hill climb stage for
  the E36; Glen Hellish, Swapsies; Story mode / upgrades (race conversions, the repair bill: pay or
  debt); the sound pass.
- **Owner rules added 11-16/17** (NOTES.md + memory): plan first, briefly, expand on request; every
  car its own real parts; road cars always in traffic at their real share; every link carries all
  under test and the pause TESTING list holds it; no idle workers; keep this page current.
- **Lessons:** prove looks with REAL crashes at the GAME'S zoom (close-ups hid the arms bug three
  times); two workers on one base collide in rows - merge by patch; push only the latest round. SERVE
  WITHOUT PUSHING: the served clone Desktop/G/rac3r IS the main repo (rac3r-wt is its worktree), so
  `git -C ../rac3r checkout --detach <sha>` is enough; every push queues a 14-job CI run.

## How the owner works

- Every change behind a `?switch`, measured, then a test link. On "pass": the default, the switch
  and old path deleted, TODO moved to TODO-DONE, CI, main, the served clone moved.
- Test at each logical stage: hand each piece over as soon as it works.
- NEVER change anything the owner has not asked for (the AI included); measure, report, ask.
- Use the project's prebuilt tools (`tools/`, `tools/scratch/`) before writing new ones.
- The owner answers on the phone, often mid-turn: answer each message. Ask questions plainly,
  each one standing alone with a recommended answer.
- Worker briefs restate the FULL rules every time, never "rules as before" (owner 11-12).
- One worker at a time. The worker does not push. The foreman stacks its commits on one branch
  and runs CI once (CI is shared and queued: see NOTES Routine).

## Picking up

- Worktrees: `Desktop/G/rac3r-wt` (the foreman's) and the worker's under
  `rac3r/.claude/worktrees/`. The served clone is `Desktop/G/rac3r`.
- Server and tunnel PIDs are in `GamesStudio/tools/logs/rac3r-pids.txt`. Today: server 7852 on
  port 8080, tunnel 15060. The owner's link is the cloudflared quick tunnel's URL, which is in that
  log folder and in the session, never in the repo. If it stops resolving, restart cloudflared
  (`GamesStudio/tools/cloudflared.exe tunnel --url http://localhost:8080`, stderr to
  `rac3r-tunnel.err`), update the PIDs file and give the owner the new link.
- Ports: 8080 is the owner's (never touch it), 8097 the foreman's, 8090 the worker's.
- Browser tools: one at a time, holding `Desktop/G/.browser-busy`. A lock left by a killed session
  is stale once no browser runs.
- A session cut off mid-task: read the tail of the newest large transcript in
  `~/.claude/projects/C--Users-Admin/`, then `gh run list`, the lock, and `git status` here.
- gh: `C:/Users/Admin/tools/gh/bin/gh.exe -R staystale/Rac3r`.
- **Second test PC** (owner 11-14 OK; on only when the owner turns it on): `ssh billj@192.168.1.13`
  (key, cmd shell). It has 8 GB, Node 24, Git and Edge. The game is cloned from a git bundle at
  `C:\Users\billj\work\rac3r-proof\repo`, with `npm ci` done. Touch nothing else there. Use it for
  jobs SPLIT from the worker's list, never copies of them (owner: "don't double do work").

## itch.io push (owner says when)

`npm run build` in the worktree. Stage in a new `GamesStudio/ready-to-play/rac3r-<date>/`:
- `dist/index.html`, `dist/game.js`
- the repo's `manifest.webmanifest` (the build does not copy it)
- `dist/assets/`, minus `fonts/README.md` and `game.js.map`

Then:
1. `node tools/scratch/_staticcheck.mjs <folder>`: both phone sizes, nothing missing, no errors.
2. `BUTLER_API_KEY=<the wharf line of Desktop/ITCH-API-KEYS.txt, read inline, never printed>
   GamesStudio/tools/butler/butler.exe push <folder> fuzzlepun/rac3r:html5 --userversion
   <date>-<commit>`.
3. `butler status fuzzlepun/rac3r:html5` until the build is up.
