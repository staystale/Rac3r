# Foreman handover

Kept current as the work goes (owner 11-12: "update the handover as we go"). Last updated
2026-11-17 (early morning). Read `CLAUDE.md`, then `NOTES.md` (the owner's rules and the Routine at its end,
not repeated here), then `TODO.md`, then this page. The 11-07 version of this page is in git.

## Where we are (11-17, early morning)

- **ITCH** = `2026-11-15-7c4af37a` (unchanged). Push #4 HELD by the owner until all the cars and the
  open bugs pass. Left: the Scanyah artic (the last car), the damage item 3 (steam / leaks), and the
  owner's tests of ?tipping, ?marktrack, ?dmgmore2, ?scanyah. Then ASK about itch.
- **Main** = ea383773 (round139). CI was started on round151 - check `gh run list`, push the newest
  green round to main (push the LATEST round only: many pushed branches jam the CI queue).
- **The owner's link** = foreman/round158 (5517179b). Under test (switches): ?scanyah (the tractor;
  its trailer joint being built), ?tipping (two-wheel state, tall vehicles only - owner), ?marktrack
  (the rear-right skid mark at the rear track), ?dmgmore2 (the hanging exhaust and bumper; the
  exhaust being made darker / thicker). Parked: ?pbzline / ?driftbrake (AI tune), ?siren (sound).
- **PASSED and DEFAULT since 11-16:** every new car (Porch, Seven, Transfits x4, Trophy, Civvic,
  Defunder, Focust, Cleos, Saxos, Strange Rover, TS010, Tesla, Routemonster - always red in traffic,
  M4 GT3, Corolla BTCC, R13 LMP1, Ibeefa, A4 Avant, E36 Peak - HILL CLIMB class, Skool Bus - school
  runs only); under the skin (the foreman's fix: hubs go with torn wheels, snapped arms on a
  subframe, dark F1-style arms thicker on heavy vehicles, engine ejects only exposed and reached,
  torn panels); each car's own crash parts; every closed car shaded; rolled cars' underside;
  dragging; low range (lever, LOW_GRIP 1.3); reverse TCS and the 20 km/h cap; the F1 / WORLD menu;
  hudfit; fuel carry; Pembreezy.
- **Worker A** (a2fab314deb77a72b, worktree `bugfix`, PC `repo`): the Scanyah trailer joint (owner yes
  to all: 10 t, 85 deg stop, a broken pin, real reversing), drivable, NOT in traffic. Its PC job 2
  (old proofs) and the tipping proofs are queued.
- **Worker B** (aaf511f3d9d953888, scratch worktrees, PC `repo2`): the darker exhaust, then damage
  item 3 (steam / leaks from the real radiator / engine, leaks by hit size, puddles under the real
  parts, denser exposed steam) behind ?dmgmore2, then Blighty Park RX + circuit. PC queue b4q / b4r
  / b4u / b4v (pass proofs).
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
