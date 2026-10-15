# RAC3R - open work

New session? Read `CLAUDE.md`, then this file. Open items only: finished work is in the git history.

## Where we are

- The code quality overhaul (below) is DONE (phases 0-10). Lint: 0 problems. `npm run suite` runs the
  quick checks (pass / fail, exit code); `node tools/runall.mjs --full` adds the slow ones.
- Behaviour is proved unchanged by `tools/worldhash.mjs` (level data), `tools/simhash.mjs` (every car, every
  step), `tools/renderhash.mjs` (pixels) - save the reference on the base commit, then compare.
- Work is foremanned with Bigeon (worker PC + `node ../Bigeon/bin/bigeon.ts`); see `CLAUDE.md`.
- Do not publish to itch.io until the owner approves the converted game.
- Next after the overhaul: the ground on the GPU (section below), then the owner's queued features.

## CODE QUALITY OVERHAUL

Standards: `CLAUDE.md` section 2. Behaviour must not change unless a phase says so.

- [x] 0-6. Baseline, tooling (package.json, ESLint, TypeScript), shared `src/core/`, `lab.js` split into
  `src/world/`, `render.js` split into `src/render/`, one AI engine, performance pass.
- [x] 7. Rename pass and function splits: every name descriptive, lines under 100, functions under 80
  lines and complexity 15, files under 800 lines; lint 0 problems.
- [x] 8. Tools: no hardcoded user paths (`tools/lib/browser.mjs`), one-off scripts in `tools/scratch/`,
  one runner (`npm run suite`).
- [x] 9. Docs: TODO.md open items only, ENGINE.md an architecture overview, HANDOVER.md folded in
  and removed, owner spec dumps in `docs/specs/`; no dates, task numbers or quotes in code comments
  (owner quotes became "(requirement: ...)" notes; tools/samecode.mjs SAME).
- [x] 10. CI: `verify` (required for `main`) and `checks` (the suite against the base commit,
  `.github/workflows/checks.yml`) on every push; `CONTRIBUTING.md`.

Owner decisions (2026-10-11):
1. `package.json` with dev-only tools: yes. TypeScript needs a build step: esbuild, run by `node serve.mjs` before serving, so the routine stays the same. The itch.io build is one bundled file.
2. Target: modern phones (owner tests on iPhone 17 Pro Max). Measured on desktop with CPU throttled 4x: median frame 8 ms, 95th percentile 14 ms.
3. There is only one AI engine (`src/ai/`: the circuit driver and the highway weaver); `src/highwayrace.ts` holds the highway race rules.
4. TypeScript. Convert in place, phase by phase, not a rebuild: behaviour is proven unchanged by the phase 0 baseline. Playtest on the phone as often as possible, after every phase that touches visible behaviour.
5. Reviews: rely on automated checks (`node tools/verify.mjs`, later lint and the regression suite in CI); the foreman spot-checks diffs and reviews the whole project now and then.
Order: the overhaul first. LEVELS + EVENTS and every older item wait until it is done. Do not publish to itch.io until the owner approves the converted game.
Known bugs found during the overhaul (wait until it is done, they are not caused by it):
- RX race, two jokers: `node tools/racecheck.mjs` (slidden-hill) fails case C. The car is put through the joker gate on lap 2 and again on lap 3; the race never finishes (stuck on lap 3 after 8 minutes, no +30 s penalty). Same result on the original code (commit 857f105, checked 2026-10-12), so it is older than the overhaul. Not yet known whether the game or the test is wrong (the test teleports onto the gate; joker detection became a line that must be crossed on 2026-10-07). Cases A, B and practice pass. racecheck takes about 18 minutes, so it is not in the baseline run.
- Highway tests failing on the code before these changes too (checked 2026-10-12 on ab938eb and later): `node tools/hwracecheck.mjs` "no racer wrecked (2)" (2 FAILs, counts vary per run), `node tools/trafficcheck.mjs` "motorway: traffic stays on the carriageway (30 car-steps off)", `node tools/treadmillcheck.mjs` "motorway: no litter in a driving lane (2)". Not caused by the overhaul; look at them with phase 5 (AI).
- AI weak spots measured in phase 5 (same as the phase 0 baseline, so not caused by the overhaul; improving the AI changes behaviour, so after the overhaul): pacesuite BAD runs 3/9 (a racer far off the road or wrecked); weavecheck: spun in 5 and over 1 m wide in 5 of 45 scenarios (all at 240 km/h); aifieldsuite: 4.0 incidents per race.
- Idea: a floor (e.g. 0.10) under (1 - use^2) in the friction ellipse, so a tyre keeps a little lateral grip under full braking / wheelspin. Not implemented; try in a handling pass if cars lose all steering there.

## AFTER THE OVERHAUL - GROUND ON THE GPU (owner, 2026-10-15)

Owner: the ground textures "repaint and change as zoom changes", worst "near fully zoomed out"; "normal games
don't have this issue". Decision: fix it by changing how the ground is drawn, AFTER the code overhaul; both steps.

Cause (measured): the ground is painted on the CPU into cached tiles at fixed zoom steps (ZSTEP 2 per doubling)
in a low-res art-pixel buffer (~15 art px/m at zoom 1, ~4.6 at ZOOM_MIN 0.30), then each frame stretched or
shrunk to the camera's exact zoom with smoothing off. Textures hold TEX_PPM 17.3 texels/m. As the zoom creeps,
different pixels are dropped or doubled each frame = flicker. tools/zoomcheck.mjs measures it; with
ZOOMS="0.33,0.325,0.32,0.315,0.31,0.305,0.3" (one patch, tiny zoom changes) main flickers 5.7 % of pixels.
Tried, not kept: a halving mip of each texture (5.7 -> 4.3 %, task 224 / branch worker/224), tiles only
stretched (3.3 %), smoothing when a tile shrinks (2.2 %, loses grain far out). Kept: one texture painting per
surface (task 218), one water look, hill shading on a world grid with 0.5 m cells (tasks 220, 222).

- [ ] A (M/L): keep the CPU tile painter, but draw the cached tiles to the screen through WebGL with mipmaps and
      trilinear filtering (a ground canvas under the 2D canvas for cars, props and the HUD). Check the existing
      `tileGpu` setting (src/render/tiles.ts TILE_GPU) first. Goal: zoomcheck flicker near 0 with the pixel-art
      look kept. Phone test.
- [ ] B (L/XL, its own phase): move the ground painting itself to the GPU (surface textures uploaded once;
      zones, water, wear, skid marks, road, kerbs and hill shading as shaders / textured geometry). Goal: no
      tile painting on the highway (today ~17-18 ms a tile against a 6 ms frame budget: the old highway
      judder). Measure tools/framecheck.mjs highway and brands-snatch before and after; phone test.

## GAME NAME: RAC3R (user, 2026-10-03)

## Owner specs (moved verbatim)

- `docs/specs/levels-events.md` - Levels and events (owner spec dump)
- `docs/specs/roadmap-2026-10-03.md` - Roadmap (digest of SPECS-2026-10-03.md)
- `docs/specs/surface-evolution.md` - Surface evolution (owner spec)
- `docs/specs/master-backlog.md` - Master backlog (triaged owner list)
- `SPECS-2026-10-03.md`, `BRIEF.md` - the owner's original specs

## Open items carried over (not re-checked since they were written; some may be done)

## USER SPEC DUMP (2026-10-04, late) — recorded before any work; QUICK FIXES first, the big systems are PLAN-FIRST (discuss)
- [ ] MORE LEVELS + MORE CARS (user, 2026-10-04: "more levels and more cars too").
- [ ] GARAGE SYSTEMS — DECIDED (user, 2026-10-04):
      TYRES: "do your recommended" but 4 BRANDS / 15 TYPES (Creem is an oil brand: dropped): SPUM (budget: Pre-Spun +0 = today's floor,
        All-Season, Mud-Plugger), KUM (road: Road Sport, Semi-Slick, Drift, Wet), DUNFLOP (rally / off-road: Gravel, Soft Gravel, Tarmac Rally,
        Studded Snow, All-Terrain), PIRRELLY (race: Soft, Medium, Full Wet). Grip per surface group (hard / wet / loose / soft / snow) + heat;
        fit by class; prices shown (test mode: not charged); the stats panel shows the effect.
      CLASSES: ROAD (hatch, saloon, sports, muscle) · RALLY (1L / 2L / 2L+ / Group B) · RALLYCROSS · STOCK CAR / GRASS TRACK · OVAL ·
        SINGLE-SEATER (F1 / F2 / FE-ish) · DRIFT · OFF-ROAD / ODD; car menu filtered class -> subclass; upgrades never change class.
      PAINT: 16-colour palette body + trim, a NUMBER 1-99 drawn big where the car has room, PREVIEW on the lift, APPLY saves; follows the car.
      ORDER: classes + filtered menu -> paint + number -> tyres.   [x] CLASSES done 2026-10-04 (ENGINE.md "Garage step 1")  [x] PAINT + NUMBER done 2026-10-04 ("Garage step 2"); Subaroo -> RALLY 2L+; picker grouped + coloured
      [x] TYRES done 2026-10-04 ("Garage step 3").  [x] AI race within the class (setup toggle).  [x] joker HUD switches live.
      [x] MORE CARS 2026-10-04: +9 (Mini, Lambo, Mikra 1L, 306 Maxxi 2L, Fiester RX, BriSKA stock, Autograss, Sylvya drift, F2).
      Known: kit car AI 8.7 s off at Sweaty Lamb ~1712 m. NEXT: one of every EVENT type + levels (user order), then story (discuss).  Also done: lamps break with damage; tape puffs on its 2nd hit.  OPEN Q: number the AI cars too?
      THEN (user, 2026-10-04): "after this can we do MORE CARS" — new cars right after the garage systems, before events/levels.
- [ ] STORY MODE: ROOKIE SEASON (grass track, stock car, time trials: hillclimb / runway time trial in cones) -> ROOKIE 2 (similar events, track
      variations, harder to win). We select which events are in. MONEY / POINTS also for NOT finishing top 3 (it's hard); REPLAYABLE events /
      championships for higher scores + more money (finish 5th throughout, earn some, upgrade, come back and win).
- [ ] UPGRADES limited by SERIES ELIGIBILITY: over-upgrade and the car no longer qualifies — downgrade or buy another car.
- [ ] GARAGE: pick COLOUR; pick a NUMBER drawn clearly on the bonnet / roof (wherever free on that model) = your ID; a PREVIEW and an APPLY;
      applied colours / number / upgrades follow the car into race and test events.
- [ ] TYRES FIRST UPGRADE: manufacturers, ranges per class / vehicle; only fit what fits the class/car; e.g. rally / off-road tyres on a road
      car = more off-road grip, heat up too quickly on tarmac; wets, race, intermediates — a real mix with distinct grip interactions.
      TODAY's grip ("feels low generally, on road and off") = the FLOOR: "SPUM — pre-spun tyres, +0 grip".
- [ ] CLASSES: rally / road / stock car / grass track / naffcar / F1 F2 FE...; drift, muscle, sports...; SUBCLASSES (rally 1L / 2L / 2L+ /
      Class B...) for events; the car menu FILTERS by class then subclass; upgrading never changes a car's class; mods shown with the stats and
      how they change them. Example upgrade: "Engine v2: top speed +10 mph".

## AI rounds 1-4, Killder all accepted.
- [ ] NEW CARS FEEDBACK (user): "look a little less standard, more like their unique real counterparts" (both); WRZ "feels a bit SLOW at
      acceleration / unable to WHEELSPIN or DRIFT"; BMV handling okay.

## SESSION 2026-10-04 (b) — user: "stage two is ongoing but feels ok; progress with this to do list as far as you can"
- [ ] ITCH RULE (user, 2026-10-04): "DON'T PUSH yet — wait till we're NEARLY OUT OF CREDITS" (then re-stage + push the latest; ask for the key).

## PLAN (user notes 2026-10-04, digested) — work top to bottom; tick + record numbers as each lands
- [ ] DAYTONA DECIDED (user, 2026-10-04): name "DIEATONA"; tri-oval + pits + scenery (31 deg turns, 18 deg tri-oval, flat back straight, pit lane,
      grandstands, infield lake, rolling start), keep old Naffcar as classic; "slip in some SUBTLE SKULLS in the decorations layout".
- [ ] NAFFCAR REBUILD = DAYTONA tri-oval parody (user, 2026-10-04): trace the real map, real banking (31 deg turns, 18 deg tri-oval), pits + scenery.
- [ ] PERF: Sweaty Lamb ground tiles ~35 ms (others ~26) — A/B long grass vs grass was inside the noise today (machine load swings);
      re-measure on a quiet machine before acting. The planned lever: paint tiles off the main thread.
- [ ] PERF: draw resting tyre stacks into the ground tiles (Slidden Hill 113 slow frames of 570, ~870 stacks).
- [ ] tools/wearcheck 3c is FLAKY (random churn) — make it seeded or loosen the threshold.

## QUEUED — SURFACE EVOLUTION (user, 2026-10-03, verbatim then read). NOT STARTED — propose a plan first.
- [ ] Grass Track ribbon: random dirt/grass patches along the course (currently fixed autograss sectors).
      DECIDED (user, 2026-10-03): random, but MOSTLY GRASS on the straights and MOSTLY DIRT in the corners.
      UPDATED (user, later 2026-10-03): "don't forget to do the grass track randomising EVERY LOAD IN" — a new
      random layout on every load (supersedes "fixed per track").
- [ ] Snow -> ice after several passes (EXISTS since 2026-10-02: 4 passes, lab.js wear map — verify it shows).
- [ ] Ice wears away under heavy braking / sliding, revealing what is UNDER it; that base then wears on its
      own rules (grass -> mud). Needs a LAYER model per wear cell: a cover (ice/snow/puddle) over a base.
- [ ] Mud -> thick mud (second mud type) with "vector dips". Sand and gravel can also form them.
      CHECKED 2026-10-03: the user asked whether Gemini/DeepSeek captured their description of "the vector
      system". THEY DID NOT — no doc in either folder mentions it; the only "ruts" are painted wear cells with
      mud grip, no height change. Waiting on the user to re-describe it before designing anything.
- [ ] Every surface instantly distinguishable by its graphics, and keeps its own driving numbers.
- [ ] Cover layers on ANY surface: puddles, snow, ice.
- [ ] (user) "unless tyres are very hot" — needs the tyre-temperature model (tier 3); scale ICE_SCRUB with heat.
- [ ] WEATHER must evaporate standing water — until weather exists, puddles only go under hot tyres.

## DONE — SURFACE BLENDING AT CHANGE POINTS (user, 2026-10-03) — ENGINE.md; small patches, loose surfaces only. Covers not blended yet.
- [ ] At every surface boundary (track sectors, zones, covers): scatter PATCHES (the Grass Track mechanism) of each
      side into the other, density highest at the boundary and falling off with distance. Data-driven, per level.

## MASTER BACKLOG — the user's long list (originally sent to DeepSeek), TRIAGED 2026-10-03 by Claude
    - [ ] Naffcar V8 fails the lap driver on its own track (12.7 s off the road; was 13.8 before the fix) -> step 3.
    - [ ] REVERSE (user: "it should work how the card says and the game is wrong"). Today R is a TOGGLE (<1 m/s), then
          BRAKE drives backwards and GAS brakes (vehicle.js ~311-323). Make it: HOLD R = drive backwards (ramped like
          GAS); BRAKE always brakes; GAS always drives forward; no pedal swap. PC: hold Z.
    - [ ] RESET on levels with no circuit (The Lab) goes to the SPAWN, not "near where you left it": main.js reads
          `breadcrumbs` but nothing ever records one. Fix: record the last safe spot while driving.
    - [ ] Wording: RESTART card says "everything reset", but the Grass Track's random layout is kept; the Lab has no
          start line. Tyres card: cold tyres only lose grip on hard surfaces (off-road ignores temperature).

## Awaiting a verdict
- [ ] **OUTER TYRE WALLS — Grass Track + Stock Car, 2026-10-03.** Loose 38 kg stacks on the OUTSIDE only (user's
      choice), generated from the track centreline by `outerTyreWall()` in lab.js (margin/spacing per level).
      507 + 611 stacks, 1.00 m apart, unbroken, none on the road, clear of pylons/boards/official box.
      MEASURED: 80 km/h head-on -> punches through, loses 1.5 m/s (~7%), bursts 6-9 stacks; 36 km/h -> through.
      Frame cost, CPU throttled 4x: draw 9.7 ms mean / 14.6 ms p95 on Stock Car (Lab 6.8 / 10.2), 58-60 fps.
      Also: cone tally moved into layout() — it sat on RESTART/RESET/CLEAR in portrait (uicheck now covers it,
      proven to fire). OPEN: does it need to CATCH cars? (heavier stacks / double row) — user to decide.
- [ ] **REPAIR PASS — 2026-10-03.** (serve.mjs on 8080 from THIS folder +
      GamesStudio/tools/cloudflared.exe). Test: jump + brake on every car; level switching; portrait HUD.
- [ ] **HANDLING PASS 2 + DEBUG PANEL — 2026-09-27.** Tune it yourself with the TUNE chip and tell me
      the numbers you land on; I will write them into cars.js as the new defaults.
- [ ] **Slice 1, Steps 0–2b + touch + marks + knockable cones — DELIVERED 2026-09-27.** Cloudflare tunnel (not itch — the
      user's call for this pass and the next): ``
      Drive it and say how it feels. Every measured figure, and the model as built, is in `ENGINE.md`.

## Queued
- [ ] **Slice 1 remainder** — audio (engine note + squeal), and screen shake for a proper impact (a 2 kg
      cone does not earn one). Sequential/manual box: the user said **keep it auto for now** (2026-09-27).
- [ ] **Open question raised by the build:** the floor is 200 x 200 m and the hatch tops out at ~193
      km/h, so a full-speed run crosses it in ~4 s. Decide whether the lab needs to be bigger, or
      whether that does not matter for a feel box.
- [ ] **Gamification comes after the lab**, and only once the user has driven it. Nothing from `BRIEF.md`
      §4/§5 — garage, pips, money, tracks, rivals — is to be started before then.
- [ ] Decide the open questions in `BRIEF.md` (rivals vs ghosts, the broke-player floor, fuel/damage
      persistence, what a pip is worth in lap seconds). **Not needed for Slice 1** — needed before the
      economy.

## Queued — the user's next direction (2026-09-27)
- [ ] **Progression: take every car from base spec progressively up.** This is the brief's 10-pip
      system. The mods seam already exists and every multiplier already defaults to 1.0.
- [ ] **Tyres as a choice, with silly brand names** (Kum / Spum / Creem as the register), each brand
      making a range — road, dirt, etc — with real spec differences. NOT NOW; noted as spec in
      BRIEF.md. Lands on the existing surface.mu hook, which is still a no-op waiting for exactly this.

## Awaiting a verdict — 2026-09-28
- [ ] **RALLY CAR**, bigger lab, cone race course, camera and gear-change work. Tunnel restarted (2026-10-01):

## Work log — Claude (2026-10-02)
- [ ] Wet tarmac → dry — DEFERRED to Tier 3. Requires tyre temperature (hot tyres clear wet surfaces).
- [ ] Tyre marks increase grip — pending
- [ ] Cross-surface contamination — pending
- [ ] Per-tyre temperature state machine — 4 independent wheel temps
- [ ] Hot tyres should take TIME or be VERY HOT to melt snow/ice/water. Not instant on first pass. Couple tyres to surface wear: tyre temp above a threshold AND multiple passes needed to clear wet/snow/ice.
- [ ] Cold tyre grip penalty on tarmac. Off-road surfaces unaffected.
- [ ] Wheelspin heats driven wheels, cornering heats fronts, drifting heats outside tyres.
- [ ] Cooling: off-road surfaces, not driving.
- [ ] Tyre types & tread system — multiple manufacturers, unique grip/slip/surface characteristics.
- [ ] Test: does brake freeze still happen? Airborne brake force now zero.
- [ ] Test: high-speed judder — SLIDE_BLEND bump should help.
- [ ] Test: steering feel with power curve.
- [ ] Test: camera fly-in at level start.
      dumped the whole budget onto lateral at once. Full history in ENGINE.md.

## Queued — from the playtesters, 2026-09-27 (in their order)
- [ ] **The floor is too small for the new speeds** — 300 m is crossed in ~5 s at 216 km/h; the
      screenshot at speed shows the car already off the map. Needs to grow with a tiled marks layer.
- [ ] Tyre marks should FADE after a while. STILL OPEN.
- [ ] Track car should look like an F1 car: bigger wheels, proper proportions. STILL OPEN.
- [ ] Camera should zoom out further the faster you go.
- [ ] Cars faster / more powerful / more weight and momentum still (user, on top of this pass).

## Queued — next session
- [ ] **THE ROOT FIX: model wheel angular velocity as a real state.** The rolling and sliding tyre laws
      disagree by ~2.8x at breakaway (measured FyR stepping 2115 -> 5951 N in one step). That mismatch
      is the track-car judder AND the likely reason steering lock still barely affects drift angle.
      Deriving longitudinal slip from a real wheel speed instead of approximating it removes the seam
      entirely. This is a substantial change to the longitudinal model — ASK BEFORE STARTING.
      Two cheaper attempts were measured and reverted; see ENGINE.md before trying a third.
- [ ] **Threshold braking regressed** — full pedal is optimal again. Brake force wants ~1.7 g.
