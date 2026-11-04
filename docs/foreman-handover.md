# Foreman handover

Written on the owner's request, 2026-11-04 late (main at the commit that adds this page).
Read `CLAUDE.md`, then `NOTES.md` (the owner's rules, decisions, measured lessons and the routine -
not repeated here), then `TODO.md` (the top of it is the AI rework's record and the order), then
this page.

## Where we are

- **The plain link is the approved game; the test list (`src/testlist.ts`) is EMPTY.**
- **itch.io is up to date:** build #2300680, version `2026-11-04-4f8d865` (owner asked: "can we
  push this to itch.io before we go any further").
- **The AI rework is done up to R8** (R1-R5 and R8 passed on the owner's phone, R6 skipped,
  R4 part 2 not needed). Today's passes, all the DEFAULT with their switches deleted:
  - **One AI (R8):** the circuit driver races every level, the highway too. The highway weaver
    (`ai/weaver*.ts`, 790 lines) is DELETED; its drive-out moved to `ai/driveOut.ts`.
    - `ai/steerLaw.ts`: the one steering law and cap (the circuit's Stanley).
    - `ai/roadLine.ts`: the highway's line, the lanes' middle, made per road stretch (the road
      rebuilds every ~300 m), smoothed; `circuit.ts follow()` rebinds a driver to each new line.
    - `ai/gapPick.ts`: gap spotting for every driver - 11 lines across the room, scored by free
      road ahead (read 2.6 .. 3.8 s by skill), the swerve's cost, a commit bonus, the verge's
      cost; a blocked way across or a car arriving in the mirror (1.5 s) is out. Round on the
      road first (`followAhead`), past the edge only when there is no room.
    - Boxed in (a car still on the best line) -> late braking, 90 % planned
      (`driverTraffic.ts gapStep`); the attacked car is left out of the gap picker (it undid
      the attack's pass).
  - **Formation starts on the highway** (`ai/formation.ts roadFormationInput`): the circuits'
    formation read along the road; every car keeps station on the POLE's own speed
    (`stationPace`), so a stronger engine cannot run into the next slot. The highway's old
    start driver (`game.start.drv`) is deleted.
  - **Half a car owns the line** (`driverTraffic.ts alongsideCar`): half a car or more ahead
    keeps its line (no chopping: it holds where it is if its line closes on the other); the
    car behind, its line across the leader, drops 0.5 m/s under it to tuck in; truly side by
    side both keep 2.4 m and the inside gets the corner (`racecraft.ts yieldRoom`).
  - **Look before pulling on** (`driverDrive.ts lookFirst` + `gapPick.ts rejoinClear`): a car
    at / past the edge coming in by > 1 m holds its place on the edge until no car on the
    track arrives within 1.5 s or sits alongside on the lines it would cross.
  - **The braking read** (`dodge.ts readBraking / matchSpeed`): each driver reads how fast the
    car ahead slows (differenced over 0.1 s; half of it at skill 0, all at skill 1) and, only
    where there is no way round, keeps a speed it can still match it by. Owner: "it should
    ideally avoid it not just brake ... although it should brake too if it needs to".
- **Measured at the flip** (the plain game): weavecheck 0 / 45 hits at diff 2 and 4; pacesuite
  (9 highway races) ~130 km/h, 0 bad, 0 off-road; circuit fields (4 tracks x 3 seeds, diff 4)
  fewer incidents and less contact than before R8 with passes level; rear test
  (`_reartest.mjs`) nose-tail touches about halved; highway formation closest pair ~3.4 m.

## NEXT (owner's order)

1. **R7** - a menu race on a random track, with a chance of the highway. ASK THE OWNER before
   building (propose the plan first).
2. **Brands Snatch Indy** at real scale and at 3/4 scale.
3. **Car second / third colours** - a mockup first, owner picks.
4. Then upgrades, sound, story. Later (owner decision): the ground on the GPU (A mipmapped tiles,
   then B full GPU).

WATCH (owner to report): the menu demo's NaN recovery; the owner's own-car reset streak; the
mark jump (passed "unless I see it again"); the few hard rear-end hits left are swerves begun
too late (the AI chose to go round), not following.

## How the owner works with us (this session)

- **Permission first** for anything new; a direct fix request or a default flip is fine. Do not
  do anything drastic when stuck - ask.
- **One AI, the same everywhere** (where possible): one law, one set of numbers on every level;
  a per-level difference only where truly needed, and say why.
- **Keep it as simple as we can while avoiding behavioural issues.** Extras that do not measure
  better come out (11-04: closing-speed room, lane-change guess, a no-swerve-past-alongside rule
  made weavecheck 13 -> 18 hits; removed).
- "It's ok for some crashes"; dodge and overtake first, brake when it must; no queueing, no
  hard shoulder, no waiting.
- The owner tests on the phone and answers "pass" per switch; runs are noisy, so hand over for
  the test rather than over-proving. Say "let me know when to test" moments plainly with the
  link and what to try.

## Proofs and tools for the AI

- `tools/weavecheck.mjs <diff>` (45 highway scenarios) - REPEATS EXACTLY: a change in its count
  is real, not noise.
- `tools/pacesuite.mjs <label> 45` (9 highway races, 3 seeds x diff 0/2/4) and
  `tools/hwracecheck.mjs <s> <diff> 1 motorway <seed>` (HRDBG=1: off-road lines;
  `tools/scratch/_hwtrace.mjs` adds HRTRACE=<car> HRT0 / HRT1 per-step traces).
- `tools/scratch/_reactab.mjs <diff>` (TOGGLE=<SWITCH> SEEDS=7,3,11: circuit fields off vs on;
  its off-road column is broken - ignore it). Fields are NOT deterministic.
- `tools/scratch/_reartest.mjs <level> <diff> <n> <laps> <seed>` (a careful lead - the bench
  driver - with AI behind; nose-tail touches; DBG=1 the controls at each touch, TRACE=1 a
  speed timeline). Not deterministic either.
- `tools/scratch/_rollhw.mjs <runs> [query]` (highway rolling start: lane drift, place slip,
  closest pair, slot error at the green; LINE=1 a timeline) and `_rollstart.mjs` (circuits).
- Also: `_stopcar.mjs`, `_rejoin.mjs`, `_feltgrip.mjs` (lone laps), `_icestart.mjs`,
  `_oilline.mjs`, `tools/aijokercheck.mjs`, `tools/aifieldcheck.mjs`.

## itch.io push (owner says when)

`npm run build` in the worktree; stage in a new `GamesStudio/ready-to-play/rac3r-<date>/`:
`dist/index.html`, `dist/game.js`, the repo's `manifest.webmanifest` (the build does not copy it)
AND `dist/assets/` (fonts + logo, new since 10-26; drop `fonts/README.md`; no `game.js.map`);
`node tools/scratch/_staticcheck.mjs <folder>` (both phone sizes: missing none, no errors);
`BUTLER_API_KEY=<wharf line of Desktop/ITCH-API-KEYS.txt, read inline, never printed>
GamesStudio/tools/butler/butler.exe push <folder> fuzzlepun/rac3r:html5 --userversion
<date>-<commit>`; `butler status fuzzlepun/rac3r:html5` until the build is up.

## Picking up

- Worktrees: `Desktop/G/rac3r-wt` (the work, detached on main) and `rac3r-wt2` (proofs). The
  served clone `Desktop/G/rac3r` is detached on origin/main.
- Test server `node serve.mjs` and cloudflared (running); the link is in
  `Desktop/G/GamesStudio/tools/logs/rac3r-tunnel.err`. If the link stops resolving, Cloudflare
  dropped the quick tunnel: stop the cloudflared PID, start `GamesStudio/tools/cloudflared.exe
  tunnel --url http://localhost:8080` with stderr to that log, update `rac3r-pids.txt`, give
  the owner the new link. Phone reports: `node tools/phonereport.mjs
  ../GamesStudio/tools/logs/rac3r-phone-report.jsonl --since <UTC>`.
- To main: commit in a worktree, `node tools/verify.mjs` (check its exit code - do not pipe it
  into tail and commit regardless), push `HEAD:refs/heads/foreman/<name>`, wait for the `verify`
  run (`C:/Users/Admin/tools/gh/bin/gh.exe run list --repo staystale/Rac3r --branch
  foreman/<name>`), push `HEAD:refs/heads/main` (retry: GitHub has had 500s), delete the branch,
  move the served clone (`git fetch -q && git checkout -q --detach origin/main`).
- Switches: `src/core/fixes.ts` (`atLoad('name')`, node env NAME=1), each with a
  `src/testlist.ts` entry; on a pass make it the default, delete the switch AND the old path.
- The laptop has ~6 GB: run the heavy tools one at a time; a background job killed for memory is
  not restarted without asking.
