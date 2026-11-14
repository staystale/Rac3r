# Foreman handover

Kept current as the work goes (owner 11-12: "update the handover as we go"). Last updated
2026-11-13. Read `CLAUDE.md`, then `NOTES.md` (the owner's rules and the Routine at its end,
not repeated here), then `TODO.md`, then this page. The 11-07 version of this page is in git.

## Where we are

- **11-13, latest:** barriercull, xgaymsprops and jokerclear PASSED ("Ok pass"); then
  jokerarrow and cutroad PASSED ("Pass"), all now the default with their switches gone
  (worldhash old+switches vs new: SAME; renderhash xgayms the same). Main had the X Gayms re-lay
  as d750afa before this pass.
- **xgaymsloose PASSED** (owner "Loose layout is a pass"): L.A. Lively's one layout (round22).
- **fastbuild PASSED** (owner "Ok keep it"): the default (round23). The test list is empty.
- **PERFORMANCE AUDIT done** (worker's b4b86d5 on `worker/perfaudit`, scratch tools only): the sim
  is most of the frame. framecheck measured a FROZEN scene until fixed (its tap never started the
  race). Owner 11-13 "Yes to all": **Worker: PERFPASS**, ONE switch `?perfpass=1` with four fixes:
  onLane by grid, sleeping cones, a barrier grid, the night layer's prop walks; framecheck fixed
  first. NO step-cap change: the owner added it, then removed it ("Ok infact remove it").
  11-14: BUILT, all five fixes (the fifth, the memory budget: owner "1. Yes"), on
  `worker/perfpass` (a8fa89b framecheck, a9188aa onLane, 0535163 barriers, fab4174 cones, 4e18f96
  night, ba6a8d0 memory). Foreman code review: fixes 1-4 give the same answers in the same order.
  For fix 5, check whether a drop frees memory: venueBuild's cache and the WeakMaps keyed by the
  level (joker.ts, lampplan.ts) keep old builds. Claude Code's memory reaper stopped the proofs
  three times as background jobs. Owner 11-14: run them one at a time in the FOREGROUND, checking
  free memory first (stop under 900 MB). Do NOT SendMessage the worker while it runs a foreground
  job: the send moves that job to the background, where the reaper can stop it.
  PROVEN (worker, 0aab120; TODO section 2 holds the results table):
  - simhash: SAME on both seeds.
  - worldhash: SAME on all 63 levels, switch off and on.
  - renderhash at night: SAME.
  - Breaks caught: fixes 2 and 3 and the pit-lamp kinds.
  - Fix 1 is proven by the node test (simhash never reaches a cut decision), the canopy trace by
    `_canopycheck`.
  - NOT caught by any break, proven only by the foreman's reading: fix 4's off-map head-glow cull
    and its lamp heads without a list (no street lights in the renderhash captures).
  In round24, with the CI to run and the `?perfpass=1` link to send.
- **The owner's list of 11-13** is in TODO 3a2 (recorded only: "no need to work on this stuff yet").
  The F1 front-tyre heat is diagnosed there.
- **Open: menu judder** (owner 11-13, seen waiting at the menu): read from the phone report.
- **Worker** (agent a6cc304d1dadeede5, worktree `.claude/worktrees/barriercull`): the audit. QUEUED for
  it after: the new rallycross tracks (TODO 3b; names to approve; NOTES "every new track").
- **Branch `foreman/round9`** holds round8, plus:
  - CI: main's pixel reference is rendered once and reused (`.github/workflows/renderref.yml`).
  - The Bird's Mess and the stadium dressing PASSED (owner 11-12: "That's all pass"). `birdsmess`
    and `stadiumprops` are now the default, their switches and old paths gone. Worldhash: the old
    code with both on against the new code: SAME on every level.
  - NOTES: the game-time rule; the stadium list closed. This page.
  - Push to main when every check-run is green (Routine), then move the served clone.
  - thumbfill and tyrelights PASSED (owner 11-12: "Pass"): the default, switches gone.
- **The test list is EMPTY**; FIX has no switches (round12).
- **Stade de Prance's notch FIXED** (owner 11-12: "Yes that was the corner! No switch just you
  fix it"): the inner lane's east-end hairpin and the bend out after it overlapped by 4.5 m, so the
  lane doubled back (18.9 deg in 1.5 m). The generator (`tools/scratch/_rocdata.mjs`) now closes a
  fold; the worst kink there is 9.6 deg (the lap's others to 9.0). Its Armco was bent by the same
  fold and is now even. lapdriver 63.8 s (64.0 before), 0 s off.
- **itch.io:** behind. Push only when the owner says (recipe below).

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
