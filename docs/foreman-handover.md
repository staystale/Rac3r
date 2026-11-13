# Foreman handover

Kept current as the work goes (owner 11-12: "update the handover as we go"). Last updated
2026-11-13. Read `CLAUDE.md`, then `NOTES.md` (the owner's rules and the Routine at its end,
not repeated here), then `TODO.md`, then this page. The 11-07 version of this page is in git.

## Where we are

- **Main** is at `3095b72` (round14, all green, 11-13); the served clone is on it. UNDER TEST:
  `?barriercull=1` (barrier culling by stretch) and `?xgaymsprops=1` (X Gayms dressing: evenEdge,
  both portals flared, paddock / trucks / TV platform / fans / show cars). Asked the owner: the
  joker bale lost to the eased Armco, the AI's short landings (16 -> 29 over 12 seeds, 9 one pile-up).
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
