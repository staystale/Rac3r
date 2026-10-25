# Foreman handover

Written on the owner's request, 2026-10-25 night (main at the commit that adds this page). Read
`CLAUDE.md`, then `NOTES.md` (the owner's rules, decisions, measured lessons and the routine - not
repeated here), then `TODO.md` ("Where we are" and section C are the plan), then this page.

## Where we are

- **The plain link is the approved game; the test list is EMPTY.** Everything below passed the
  owner's phone test and is the DEFAULT, its switch and old path DELETED (one system).
- **Car systems C, round 1 (C1 + C2) - DONE.** Design + mockup agreed first (mockup
  claude.ai/artifact/BozNYQLMm4FpspU9SsrXAc). A puncture is a LEAK (`physics/tyrepressure.ts`):
  a burst (big hit, heat, stinger) flat in ~0.5 s with a sharp pull and a puff; debris / nails /
  bush (`car.burstSlow`) over 10-30 s. Axle grip 1 -> 0.7 flat -> 0.45 rim, pull and drag by
  pressure, folded into `car.wreck` by `damage.ts derive`; the rim by a Weibull chance over the
  metres run flat (half by ~1 km). The old `car.punct` flag, its 0.7 rule, the pale wheel block,
  the white HUD ring and the written PUNCTURE notice are deleted. Look: `render/tyrelook.ts`
  (progressive squash by pressure, rim bare), HUD ring amber / red / silver, `?dev=1` line `air`.
- **Metal on hard ground** (`world/metalscrape.ts`): a rim, or a rolled body (sliding OR
  tumbling: `roll.js car.sparks`), on hard ground sparks and may break each new wear cell a grade
  (race tarmac -> tarmac -> broken; concrete, kerbs, Lab floor left alone); a rollover impact has
  its own chance; a rim scores a pale mark (`MARK_GOUGE`).
- **Sparks** (`render/particles.ts`): their own pool, drawn on the SCREEN canvas over the road and
  under the cars (`render/screen.ts drawSparksOnScreen`) as pixel squares on the art grid - head,
  short trail, dim halo square - cooling white -> yellow -> orange, each its own fade curve and a
  flicker; flung behind the way the car MOVES; ~200 a second from a rim, 260 from a body, in
  bursts. At night the light map opens the dark along each spark (`render/light.ts openSparks`).
  **Crash sparks**: a metal impact (`physics/punctures.ts hitIsMetal`: cars, armco, fences,
  posts, gantries ...) with 0.04+ damage, the car driven in at 25 mph+, sparks 70 % of the time,
  sprayed the way the car went in.
- **Brake glow** orange -> deep red the hotter, 0.45 m, just outside the wheel (not over the
  body), none while the car is rolled.
- **Test props:** stingers (tyre spikes) on the Lab and Test Track 50 m past the start
  (`world/stingers.ts`); the Lab's flip ramp, an armco end beside the stinger's left end that
  rolls a car run up it at 7+ m/s (`world/flipramps.ts`; `roll.js tripCheck` asks it).
- **Highway hedges** (`highway/hedges.ts`): one continuous line of square bushes round every
  farm field, streamed with the field, indexed a field at a time (`world/load.ts
  indexNewBushes`).
- **Fixes:** wet trails and spray now per wheel (`world/wear.ts stepWear` reads each wheel's
  ground: `car.wheelSurf`); a lost wheel's tyre reads 0 C (its axle's heat grip from the other
  tyre); `world/wheels.ts CORNER_OF_WHEEL` is the one wheel <-> damage corner table.
- **Drawing never uses Math.random** (`render/shared.ts fxRandom`): the tools seed one stream for
  the page, so a look change used to read as a race change.
- **TypeScript:** `damage.js` became `damage.ts`; all new code is TS; the bulk conversion stays
  ON HOLD (owner).

## NEXT (owner's order)

1. **Car systems C, round 2** behind `?engine=1` (agreed with the mockup): C3 radiator + engine
   temperature (thermostat ~90 C; airflow, air temp, rain / splashes cool; a front hit cracks the
   radiator, the water drips through the wet trail; overheats only when nearly empty; power fades
   above 115 C; ~10 s at 130 C SEIZES - RESET mends; an oil leak -> pressure light -> seize), C4
   speedo warning lights (every car: temperature + oil, dim / amber / flashing red, in the speed
   panel), C5 exhaust smoke (each car's exhaust spot as data; more cold / on throttle, little hot;
   dark puffs + backfire on a power cut). The grey nose smoke becomes steam / engine smoke. Round
   1's look rules hold: no written banners.
2. Then C6-C10 (oil, debris parts, penetration, armco dents, open wheels), then the `wearcheck`
   rewrite, then (owner to order) the driving root fix (real ABS), AI rework B, sound G, Story H,
   levels, multiplayer I.

## Proofs and references

- Worktrees: `Desktop/G/rac3r-wt` (the work) and `rac3r-wt2` (proofs). The served clone
  `Desktop/G/rac3r` is detached on origin/main.
- `.simhash` (gitignored): saved on 1707c66 in `rac3r-wt2/tools` (copied to `rac3r-wt/tools`);
  the commits after it read SAME. `.renderhash` is STALE (not run this session: every drawing
  change was photographed at the owner's phone size instead).
- When a proof reads DIFFERENT, bisect before believing it: this session the per-wheel ground
  lookups read DIFFERENT only because the marks' marbles drew from Math.random (fixed by
  `fxRandom`); with one line reverted a run reads SAME = the change is only that line's.

## Probes made today (`tools/scratch/`)

`_flats.mjs` (physics | photos | stinger | body), `_rimspread.mjs`, `_hedges.mjs`,
`_hedgeshots.mjs`, `_hwframes.mjs` (the highway frame A/B: framecheck does not drive it),
`_hwboot.mjs`, `_wettrail.mjs` (`puddle` mode), `_wheeloffheat.mjs`, `_sparkshots.mjs`,
`_sparkphone.mjs` (the owner's phone: 440x751 css, dpr 3), `_flipramp.mjs`,
`_impactsparks.mjs` (`&hitspeed=N`; logs each impact's metal / speed / damage),
`_stingerspot.mjs`.

## itch.io push (owner says when)

Unchanged: `npm run build` in the worktree; stage index.html, game.js, manifest.webmanifest in
a new folder under `GamesStudio/ready-to-play/`; `node tools/scratch/_staticcheck.mjs <folder>`;
`BUTLER_API_KEY=<wharf key from the owner> GamesStudio/tools/butler/butler.exe push <folder>
fuzzlepun/rac3r:html5 --userversion <date>-<commit>`. Still build #2201136 (10-24).

## Picking up

- Test server `node serve.mjs` and cloudflared (running); the link is in
  `Desktop/G/GamesStudio/tools/logs/rac3r-tunnel.err`. Phone reports: `node tools/phonereport.mjs
  ../GamesStudio/tools/logs/rac3r-phone-report.jsonl --since <UTC>`.
- To main: commit in a worktree, `set -o pipefail; npm run verify`, push
  `HEAD:refs/heads/foreman/<name>`, wait for the `verify` check-run (GitHub API
  `repos/staystale/Rac3r/commits/<sha>/check-runs`), push `HEAD:refs/heads/main`, delete the
  branch, move the served clone (`git fetch -q origin && git checkout -q --detach origin/main`).
  For a quick owner test the served clone may be put on the pushed branch commit first.
