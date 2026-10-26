# Foreman handover

Written on the owner's request, 2026-10-25 late night (main at the commit that adds this page).
Read `CLAUDE.md`, then `NOTES.md` (the owner's rules, decisions, measured lessons and the routine -
not repeated here), then `TODO.md` ("Where we are" and section C are the plan), then this page.

## Where we are

- **The plain link is the approved game; the test list is EMPTY.** C7 debris (parts and
  glass, `world/debris.ts`), glass pops, oil wearing away and C8 post hits (lamp posts and
  tree trunks by closing speed, in one spot: `physics/posthit.ts`) and C9 armco dents (bow,
  tear, a bit softer: `world/armcodent.ts`) are the default since 10-26.
  Everything else below passed the owner's phone test and is the DEFAULT, its switch and old
  path DELETED (one system).
- **Car systems C round 2 (C3-C5) - DONE.** `physics/engineheat.ts`: each car's engine C,
  radiator water, oil and a seize timer, stepped by `damage.ts stepDamage` on every car (the
  damage state is made at the first step). Heat in by throttle x revs (`car.throttleUsed`,
  set in `vehicle.ts step`), out through the radiator (thermostat from 87 C, water left, airflow
  by speed + rain + wheel splashes) and the block. A front hit (the harder-hit front corner's
  share 0.15+) cracks the radiator (empty in 4 min .. 40 s), 0.35+ or a rollover impact may
  crack the sump. Power fades 115 -> 130 C to half (folded into `car.wreck.power`); 10 s at
  130 C or with no oil SEIZES it (RESET mends; an AI resets via `tooInjured`).
  **The leak is water** (owner: the same liquid as the rain): ~60 wear cells a radiator become
  the tyres' water under the nose (`puddles.ts` rules), closer together the worse the leak.
  Speedo lights `hud/enginelights.ts` (thermometer + oil can over the units; dim / amber 105 C /
  flashing red). `render/enginesmoke.ts`: exhaust from each car kind's pipe (`EXHAUST_SPOTS`)
  by throttle and cold, backfires (seize, heat power cuts, lift-off near the redline), steam
  and engine smoke drawn OVER the cars (`particles.ts overPuffs`, `screen.ts` after the
  overhead props). The old grey nose smoke of a bent front is deleted.
- **C6 oil - DONE.** `world/oil.ts`: a wear cell's cover 'oil' that ACTS LIKE WATER (owner:
  whole cells, no specks; `wet.ts oilSurface` a third of the base's grip), drawn by the GPU
  field as kind 5 (`glfield.ts OIL_CODE`): black with a dark purple sheen and purple edges.
  Soaked up by sand, gravel, dirt, mud, long grass, bushes, traps; never dries. Sources: a
  cracked sump drips ~20 cells, a hit of 0.2+ damage spills 1-4 cells, a rollover impact 25 %
  (`damage.ts -> crashOil / rollOil`). Driven through it spreads a cell the way the wheel went
  (a chance a pass; `wear.ts stepWear` notes each wheel's motion); oil beside water runs into
  it 50:50 a second (`stepOil`); each spread a generation weaker (`cell.oilGen`). No oily tyres
  or oily marks (owner).
- **Fix: rims sparked on soft ground.** `world/metalscrape.ts surfaceUnder` read the wear cell
  else the level's zone, missing the weather's snow / ice where no wheel had made a cell yet;
  it now reads `wear.ts groundAt` (the ground the wheels feel).
- **The tunnel was restarted** (Cloudflare had dropped the quick tunnel's name): a NEW link,
  in `GamesStudio/tools/logs/rac3r-tunnel.err`; the pids file is updated.

## NEXT (owner's order)

1. **C10 open-wheel contact / wheels ripped off** next (design first; TODO.md C10). C9 armco
   dents (`world/armcodent.ts`, owner 10-26 "pass") and C8 post hits (`physics/posthit.ts`,
   owner 10-26 "=1 seems best") are the DEFAULT; before them C7 debris, glass pops
   (15 % of glass punctures) and oil wearing away (75 % spread / 25 % gone) are the DEFAULT
   (owner 10-26: all pass); the test list is EMPTY.
2. Then the `wearcheck` rewrite, then (owner to order) the driving root fix
   (real ABS), AI rework B, sound G, Story H, levels, multiplayer I.

## Proofs and references

- Worktrees: `Desktop/G/rac3r-wt` (the work, detached on main) and `rac3r-wt2` (proofs). The
  served clone `Desktop/G/rac3r` is detached on origin/main.
- `.simhash` in `rac3r-wt/tools` = saved on b69764f with `?armcodent=1`, which equals main (every
  later commit read SAME). `.renderhash` is STALE (drawing changes were photographed at the
  owner's phone sizes instead).
- Flip routine used today: save a simhash reference WITH the switch on (`RAC3R_QUERY=x=1 node
  tools/simhash.mjs save`, in rac3r-wt2), flip the default in rac3r-wt, run simhash there
  against that reference -> SAME.

## Probes made today (`tools/scratch/`)

`_engine.mjs` (heat curves headless, every car kind has an exhaust spot), `_engineshots.mjs`
(crack | ai | look | water | crackport: the real game), `_oil.mjs` (spill, drive-through, water
spread, sump, crash), `_oilgrip.mjs` (the car on oil reads 'oil'; photos), `_rimsoft.mjs`,
`_rimsoft2.mjs`, `_rimsoft3.mjs` (soft ground the old spark lookup called hard),
`_mockshot.mjs` (a screenshot of a local mockup page). Browser probe gotchas: tap the screen
before `launch` or the race never starts (the car reads 'lab' and stands still); `debugZoom`
at speed loses the car off screen - use `?autopilot=25`.

## itch.io push (owner says when)

Unchanged: `npm run build` in the worktree; stage index.html, game.js, manifest.webmanifest in
a new folder under `GamesStudio/ready-to-play/`; `node tools/scratch/_staticcheck.mjs <folder>`;
`BUTLER_API_KEY=<wharf key from the owner> GamesStudio/tools/butler/butler.exe push <folder>
fuzzlepun/rac3r:html5 --userversion <date>-<commit>`. Still build #2201136 (10-24).

## Picking up

- Test server `node serve.mjs` and cloudflared (running); the link is in
  `Desktop/G/GamesStudio/tools/logs/rac3r-tunnel.err`. If the link stops resolving, Cloudflare
  dropped the quick tunnel: stop the cloudflared PID, start `GamesStudio/tools/cloudflared.exe
  tunnel --url http://localhost:8080` with stderr to that log, update `rac3r-pids.txt`, give
  the owner the new link. Phone reports: `node tools/phonereport.mjs
  ../GamesStudio/tools/logs/rac3r-phone-report.jsonl --since <UTC>`.
- To main: commit in a worktree, `set -o pipefail; npm run verify`, push
  `HEAD:refs/heads/foreman/<name>`, wait for the `verify` check-run (GitHub API
  `repos/staystale/Rac3r/commits/<sha>/check-runs`), push `HEAD:refs/heads/main`, delete the
  branch, move the served clone (`git fetch -q origin && git checkout -q --detach origin/main`).
  For a quick owner test the served clone may be put on the pushed branch commit first.
