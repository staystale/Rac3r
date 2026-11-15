# Foreman handover

Kept current as the work goes (owner 11-12: "update the handover as we go"). Last updated
2026-11-15 (night). Read `CLAUDE.md`, then `NOTES.md` (the owner's rules and the Routine at its end,
not repeated here), then `TODO.md`, then this page. The 11-07 version of this page is in git.

## Where we are (11-15, night; the owner asleep from ~22:50)

- **ITCH** = `2026-11-15-7c4af37a` (push #3 of the day, owner yes). **Main** = 7c4af37a. Staged builds in
  `GamesStudio/ready-to-play/rac3r-2026-11-15{,b,c}`. ITCH RULE: ask before every push; push only on a
  clear yes, after CI is green. An ambiguous reply: ASK (owner 11-15: "ask if not sure").
- **The owner's link** = foreman/round77 (8789924a): everything passed today is the default (bugs 1-10,
  stopped-car avoidance + its start fix + the single-lane rolling-start fix, AI crash put-backs, the
  ground density, the joker row, the minimap, chevrons, barrels, parked police). UNDER TEST: none from
  the owner; ?aipace=1 / ?aislide=1 PASSED and being defaulted by Worker A with new presets.
- **Worker A** (fresh, briefA5.md, worktree `bugfix`, PC `repo` / 8094): JOB 1 (PACE + aislide default +
  presets skill +0.10, risk/agg/pace +0.03, proofs and numbers), then CAR TOOLS, the UNDER-THE-SKIN layer,
  the 10 cars (one link each), then the AI extras 2b-2d (owner: cars first).
- **Worker B** (fresh, briefB3.md, worktree `barriercull`, PC `repo2` / 8093): item 15 traffic (2 in 12
  leave at the next slip, 5 in 40 fuel, joins from on-ramps), then JOB 3b the frame-drop prep (GPU / layer
  timing in the phone report, ?gpustat=1) for the owner's morning drive; then F1 vs world (proposal),
  the tracks. Police cap: stays 3 (owner).
- **MEMORY RULE** (the laptop ran out at ~21:45; jobs were reaped): one heavy job at a time, on the PC
  only; the laptop light. Reaped jobs are re-run only on the owner's say (the owner said yes tonight).
- **The PC** is not faster than the laptop; its value is spare memory. Foreman's folder `repo3` / 8095.
- **Lessons today:** test every case a driving change touches before handover (single-lane rolling
  starts shipped broken once); don't invent numeric targets; numbers inform, the owner decides
  "better"; AI changes tag [sim] [look]; a test that taps under the loading screen fails (uicheck fixed).
- PARALLEL WORKERS: each its OWN worktree and its OWN port (two on one port served each other's
  code once); a laptop browser lock is removed only by whoever wrote it (compare its text first);
  check whether a tool opens a browser BEFORE running it (guidecheck, racecheck do).
- Earlier state of this page: git history.

## In progress

- **HUD text cache (`?hudcache=1`), for slower phones.** The speedometer's text was the biggest
  single HUD cost in a Spa profile at CPU x4 (603 ms of a run). The change stamps each HUD text
  line from a cached canvas. It is set aside as stash `c5a474fd` ("hudcache wip"), applied with
  `git stash apply c5a474fd`. MEASURED WORSE (Spa, 20 AI, CPU x4, off/on/off/on):
  - Frame median: off 33.2 / 17.0, on 33.3 / 33.3 ms.
  - Worst frame: off 83 / 100, on 1911 / 2348 ms.
  - Tiles painted: off ~8 ms each, on 58-88 ms each.
  - Something in it stalls (a guess: canvases made or resized per frame, or memory churn). Find
    that before any more measuring. Use `tools/framecheck.mjs` and `tools/cpuprof.mjs`, not
    one-off scripts.
  - The owner's phone already holds 60 fps on every level it drove. This work is for slower phones
    only.
- **X Gayms rallycross, L.A. LIVELY (`?xgayms=1`)**: BUILT by the worker (its commit 20ecddd,
  cherry-picked onto round9 as branch `foreman/round10`). A 942 m figure of eight on a street grid,
  one crossover bridge (clearM 3.5), 43% dirt, the joker with the 16 m gap jump (ramp and table
  pieces, five side by side so the whole road is the jump). AI clears it 19 of 20; no AI change.
  Night frames: 17.5 ms work vs Knobhill's 16.1. The owner's answers (11-12): joker cost "fine";
  "street lamps please"; night frame cost "yes" (look into it); the rest OK. The worker is on that
  as `foreman/xgayms2`, DONE: a5f626b, on main (round11). 22 street lamps (Level.streetLamps: the lamp plan's street-light rule round
  the whole lap). The lamps cost nothing measurable. X Gayms' extra frame cost (night 23.6 vs
  Knobhill 19.4 ms, CPU x4, 20 AI) is BARRIER DRAWING: 1723 m of Armco in 7 long runs, and
  render/props/fence.ts skips a barrier only when its whole box is off screen (`?skip=barriers`
  brings it to Knobhill's level). Asked: cull barriers stretch by stretch (shared code)? The thumbnail is in index.json with
  birdsmess (`XGAYMS=1 node tools/thumbs.mjs --webp`: a switched level is seen only with its env).
- **The Bird's Mess follows the world clock** (owner 11-12: "World clock all levels like I asked"):
  Level.eventHour removed, so no level fixes its own hour; only TEST MODE's START HOUR does. In
  round9, after its stadium commit.

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
