# Foreman handover

Kept current as the work goes (owner 11-12: "update the handover as we go"). Last updated
2026-11-17 (morning, paused). Read `CLAUDE.md`, then `NOTES.md` (the owner's rules and the Routine at its end,
not repeated here), then `TODO.md`, then this page. The 11-07 version of this page is in git.

## Where we are (11-17 morning - PAUSED by the owner to round up)

- **ITCH** = `2026-11-15-7c4af37a` (unchanged). Push #4 HELD until all the cars and open bugs pass.
  Left: the Scanyah's trailer (the last car) and the owner's tests below. Then ASK about itch.
- **Main** = ea383773 (round139). CI is running on foreman/round161 (pushed alone after cancelling
  34 jammed runs with the owner's yes): when green, push it to main.
- **The owner's link** = foreman/round161 (local; served by checkout, not pushed). UNDER TEST:
  ?scanyah (the tractor alone), ?tipping (two wheels, tall vehicles only), ?marktrack (rear-right
  skid mark at the rear track), ?dmgmore2 (hanging exhaust - REVERTED to the car's own drawing,
  owner: "I liked the previous one and I didn't ask to change it" - and bumper; steam from the real
  radiator, leaks by hit size, puddles under the real parts). OPEN QUESTION: leave the drips out
  (they'd be hidden under the body)?
- **Worker A** (a2fab314deb77a72b), PAUSED: WIP worker/joint 020b0d07 - the Scanyah trailer joint
  works (pin gap < 0.4 cm, jack-knife only ABS-off, the pin breaks from 40 km/h, reversing folds
  unless steered). Still to do: the trailer's own parts, the test entry, the night check, a
  link-ready commit; then its PC proofs (tipping, pass batches). OWNER QUESTIONS: (a) the tractor is
  slow towing (0-60 in 22.8 s) and its box hunts 1-2 loaded - tune? (b) at the Lab start the 13.6 m
  trailer lines up through the start posts - spawn the rig with room behind it?
- **Worker B** (aaf511f3d9d953888), PAUSED: WIP worker/b4-blighty 7ac09580 - Blighty Park RX (full size,
  invented gravel flagged) and the Outer circuit (half size), both built and checked; still to do:
  the photos, docs, the RX's tight corner (8.9 m, under its 10 m minimum), the proof, the hand-back.
- **The PC**: Worker A's long proof job has held it since 22:43; Worker B's five proof jobs wait
  behind it (pass proofs for work already stacked). Start no new PC jobs during the pause.
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
