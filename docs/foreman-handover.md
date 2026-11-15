# Foreman handover

Kept current as the work goes (owner 11-12: "update the handover as we go"). Last updated
2026-11-15. Read `CLAUDE.md`, then `NOTES.md` (the owner's rules and the Routine at its end,
not repeated here), then `TODO.md`, then this page. The 11-07 version of this page is in git.

## Where we are (11-15, late morning)

- **Main** = round46 (71bdf097) = **ITCH.IO** build `2026-11-15-71bdf097` (pushed 11-15 on the
  owner's yes; staged in `GamesStudio/ready-to-play/rac3r-2026-11-15`). Bugs 1-8, Croughed RX (no
  joker: Croft had none), the boot bar with the logo fade: all PASSED and the default. Test list
  empty. Only switch left: `?siren=1` (PARKED until the sound pass, owner).
- **ITCH RULE:** ask before EVERY push; push only on the owner's yes, after CI is green.
- **Worker A** (agent a519a84a1d0ed2559, worktree `bugfix`, port 8091, PC folder
  `rac3r-proofepo`): BUG 10 behind `?hwdodge=1` (owner chose A + B: read cars along the road
  frame; own lanes when oncoming, overtake only when clear, skill can misjudge; NOT C), then
  `?hwputback=1` (two racers put back onto one spot). Then BUG 9 (owner GO, one switch: hold a slide
  at each surface's best slip angle - on ice slide MORE but fast; more corner speed off tarmac; use
  kerbs / other lines when quicker; mistakes by skill). Briefs: scratchpad briefA2.md.
- **Worker B** (agent a6dd9ec310acc785b, worktree `barriercull`, port 8092, PC folder
  `rac3r-proofepo2` port 8093): `?forestseed=1` (gen-forest seed leak), `?wantedlost=1` (LOST
  THEM -> WANTED LEVEL LOST), `?weathermobile=1` (weather notices on MOBILE difficulty only), the
  menu demo car's NaN (find first). THEN the highway off-road jerk (owner: after itch; ~87 frames/min
  over 20 ms since 11-14 vs 39-47 on 11-13; drop seconds have ~20 % more tile builds), THEN the
  tracks (answers in hand: Pembreezy RX + circuit as ONE, Blighty Park, Glen Hellish, Swapsies
  head-to-head real / full field in test mode, quarry). Brief: scratchpad briefB2.md.
- **Queued, approved:** JOKER TAKEN on its own line in the lap box; game SOUND OFF entirely until the
  sound pass (switch, then default); the AI using your reset rules; the wrong-way guard on R's verge
  rule; the off-road countdown running 8-16 m out; start lights keeping the car clear. Pit stops:
  questions first (not every race; test-mode option; a real race turns them on where real life
  would). Then highway extras, F1 vs world circuits, cars, the sound pass.
- **DROPPED (owner):** NO NEW BANNERS ever (the WRONG WAY 3-2-1, GET BACK ON THE ROAD); the police
  contact measuring.
- **Open question:** the Rallycross walkthrough line "Your lap and the JOKER status" (Croughed RX
  has no joker): change to "your lap"? (rec yes)
- **Faster rounds (owner approved):** targeted re-checks after small fixes (CI runs the full set);
  heavy proofs on the PC (two folders, two ports); the owner's link moved to a branch once the
  worker's proofs pass, before CI; measuring sized to the change.
- **Test tools get no boot bar** (index.html skips it under navigator.webdriver; the bar took their
  start click). _bootbarshots hides the flag to photograph it.
- **The PC** (i5-3570K, 4 threads, 8 GB) is not faster per run than the laptop (Ryzen 5 5500U, 12
  threads, 5.8 GB, ~1 GB free): its worth is spare memory.
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
