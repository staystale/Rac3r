# Foreman handover

Kept current as the work goes (owner 11-12: "update the handover as we go"). Last updated
2026-11-17 (night). Read `CLAUDE.md`, then `NOTES.md` (the owner's rules and the Routine at its end,
not repeated here), then `TODO.md`, then this page. The 11-07 version of this page is in git.

## Where we are (11-16 into 11-17 night)

- **ITCH** = `2026-11-15-7c4af37a` (unchanged). The owner HOLDS itch push #4 until ALL the cars and the
  open bugs are passed (11-16: "All 21"; the list grew since). Ask before any push, every time.
- **Main** = 2926ed0a (round100). CI jammed on 11-16 night (33 superseded runs cancelled with the
  owner's yes); CI is re-running on round139 - when green, push it to main.
- **The owner's link** = foreman/round140 (36af5616). Under test (switches): ?underskin (the damage
  look), ?carparts (each car's own crash parts, steps 1-6), ?carshade (every closed car shaded),
  ?reversefix (TCS in reverse, the 20 km/h cap holds), ?f1menu (F1 / WORLD cards), ?corolla.
  Parked behind switches: ?pbzline / ?driftbrake (for the AI tune), ?siren (sound pass).
- **The foreman FIXED the under-the-skin bug himself** (owner asked: "Can you take over"): branch
  foreman/armsfix2 + foreman/torn. A torn-off wheel takes its hub and its suspension BY THE HIT, no
  dice (world/debris.ts wheelBits + car.suspOff); snapped arms drawn on the subframe
  (render/carcorners.ts); the arms the F1's dark bars, thicker on cars, thicker again on heavy
  vehicles; the engine ejects only once exposed and reached (debris.ts crushedEngine); TORN PANELS
  (render/torncut.ts). Tested with real crashes at the GAME'S zoom (tools/scratch/_armzoom.mjs) -
  close-ups had hidden the problem for three rounds.
- **Worker A** (a2fab314deb77a72b, worktree `bugfix`, PC `repo`): building cars, each a plan
  first, the owner said yes to all: Corolla (done, link), R13, Ibeefa, A4 Avant, Transfit Custom (its
  sliding door), E36 Peak (new HILL CLIMB class), Skool Bus (rare, school-run hours), then the
  TWO-WHEEL TIPPING (?tipping, approved, realistic save, gravel trips through it), then the Scanyah
  artic (jointed trailer, drivable, NOT in traffic until the owner tests). PIT STOPS PARKED: the owner
  has IMAGES to share and wants to discuss first.
- **Worker B** (aaf511f3d9d953888, scratch worktrees, PC `repo2`): damage items, each approved:
  5 rolled cars (underside matches what's missing; rolling throws wheels / track rods by the face
  that hits), low range finished as a small GRIP boost in LO (owner, not a crawl), 2 dragging (the
  pull by what drags, sparks off the snapped arm, dirt spray), 4 hanging exhaust / bumper (chance by
  damage, random distance), 3 steam and leaks (from the real radiator / engine; worse damage leaks
  faster; puddles under the real parts). Then Blighty Park RX + a Blighty Park circuit.
- **Owner rules added 11-16** (NOTES.md + memory): discuss and plan first, down to the fundamentals,
  but ask BRIEFLY and expand only on request; every car has its own real crash parts; road cars
  always go in traffic at their real share (don't ask); every test link carries everything under
  test, and the pause-menu TESTING list must hold it all; no idle workers.
- **Lessons 11-16:** a worker's proof must be AT THE GAME'S VIEW with REAL crashes; close-ups and set
  damage passed three times while the phone showed nothing. Rebase stacking: two workers on one base
  collide in the car rows - merge by patch (see round115). Many pushes queue many CI runs: push the
  latest round only.
- The morning notes: scratchpad morning.md (the session's), summarised here.

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
