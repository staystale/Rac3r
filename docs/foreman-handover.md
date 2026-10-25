# Foreman handover

Written on the owner's request, 2026-10-25 evening (main at the commit that adds this page:
"Bushes the default"). Read `CLAUDE.md`, then `NOTES.md` (the owner's rules, decisions, measured
lessons and the routine - not repeated here), then `TODO.md` ("Where we are" and the "OWNER LIST
2026-10-24" section are the plan), then this page.

## Where we are

- **The plain link is the approved game; the test list is EMPTY.** Everything below passed the
  owner's phone test and is the DEFAULT, its switch and old path DELETED (one system).
- Since the morning handover: **BUSHES (D part 2)**, default (owner: "pass"):
  - The `bush` surface (world/surfaces.ts): BRUSH drag proportional to speed above 8 m/s
    (physics/tyres.ts brushForce; brush 2.6, plough 0.8) - a clump costs 26-37 km/h more than
    grass at 54-126 km/h; from a standstill a RWD car creeps out at ~8 km/h.
  - Flattened to long grass by passes like any worn ground (wear.ts BASE_WEAR bush -> grassLong,
    3 passes; a slow crossing counts front and rear wheels, so 1-3 crossings).
  - A wheel entering a bush cell (wear.ts recordWearPoint -> world/bushes.ts bushPass): puncture
    0.8 % (11-13 of 80 bushes at 90 km/h), a light dent on that corner by speed (damage.js
    bushScratch: dmg + crushS, 0.07 at 25 m/s; ~40 % of bushes at 90 km/h).
  - Placed by world/bushplan.ts as SQUARE ground patches (1-3 per clump, own random stream per
    level, shuffled so long stages thin evenly to the 260 cap) from each level's plan
    (world/levels/bushes.ts: RALLY 1.2-9 m off the road, RX off the verges, CIRCUIT 12 m+ back and
    at the foot of trees, TEST_TRACK, and hand-placed `beds` on the Lab and Rough Patch). Levels:
    Castle Cum, Brands Snatch GP / Indy, Knobhill, Killder, Sweaty Lamb, forest + alpine stages
    (set and generated), Lab, Rough Patch, Test Track, Sandbox. Not snow / desert themes, ovals,
    the highway.
  - Look (owner: "square and pixel art", "different shades of green"): three kinds per clump -
    holly, olive gorse (yellow flecks), blue-green - one table, render/ground/bushes.ts
    BUSH_LOOKS, read by the ground art (art.ts addBushLooks), the volume squares (shadow, mid /
    lit squares, shaded band) and the TUFTS: render/bushtufts.ts draws 3-6 leaf squares per bush
    over the cars in the overhead pass (under lamp heads and canopies), gone where flattened.
- **Owner answers 10-25** (TODO / NOTES): the HUD text fix and the GPU ground phase C are BINNED;
  the 10-04 car feedback is out of date (dropped); the driving ROOT FIX (wheel spin as real
  state) is WANTED for real ABS - plan first; outer tyre walls: pushing through is fine (closed).
- The remote branch `experiment/hudtext` is still there: auto mode refused to delete it. The
  owner can run `git -C C:/Users/Admin/Desktop/G/rac3r push origin --delete experiment/hudtext`.
- **TypeScript conversion: ON HOLD** (owner). New code is TypeScript.
- **itch.io** is still build #2201136 (10-24); push only when the owner says (recipe below).

## NEXT (owner's order, 10-25)

1. **CAR SYSTEMS C** (TODO "C. CAR SYSTEMS + DAMAGE"): design first, extend damage.js (no second
   damage model). Start C1-C5: flat tyres that look flat and go to the rim (the bush / debris /
   crash punctures already set `car.punct`), radiator + engine temperature, speedo warning
   lights, exhaust smoke; then C6-C10. Mockup / photos first for every new look; no written
   banners (owner rule).
2. **The `wearcheck` rewrite** when C passes (13 stale checks; today's rules: bush -> long grass
   too).
3. Then (owner to order): the driving root fix (real ABS), AI rework B, sound + settings G, Story
   + upgrades H, levels (Dieatona), multiplayer I.

## Proofs and references

- Worktrees: `Desktop/G/rac3r-wt` (the work) and `rac3r-wt2` (proofs: check out the tested
  commit, save switch-on references with `RAC3R_QUERY="<switch>=1" node tools/simhash.mjs save`,
  copy `tools/.simhash` across). The served clone `Desktop/G/rac3r` is detached on origin/main.
- References (gitignored, `rac3r-wt/tools/`): `.simhash` = today's default (saved on dad113d
  with `bushes=1`; the flip read SAME). simhash does not see bushes (no scripted driver leaves the
  road into one in 50 s) - the bush physics is measured by `tools/scratch/_bushes.mjs` instead.
  `.worldhash`: re-saved on the bushes default. The flip read DIFFERENT on EVERY level: planning
  bushes reads the ground, which leaves cache fields (`_segs`, `_r`...) on shared objects that
  worldhash also hashes; with `_` keys and `bushes` skipped, only the 15 bush levels differed
  (their patch lists hold the bushes). `.renderhash` is STALE since 10-24
  and now the palette has the bush greens: re-save on main in 4 parts before the next pixel proof.

## Lessons from today (also in NOTES where they last)

- **The tiles' palette is built from SURFACE_ART** (render/tilesPalette.ts): a new surface's
  colours change the nearest-colour snap of other pixels. Add a new look's colours only while
  its switch is on (art.ts reads the switch when the renderer is built) so the switch-off game
  stays pixel-identical.
- **Patches drawn as ground tiles take wear for free**: a cell that changes surface repaints as
  the new surface, so anything inside the patch's own outline goes with it; keep shading inside
  the outline (a shadow outside stays after flattening - small, accepted).
- **Odds rolled per cell scale with area**: square bushes cover more cells than round ones; the
  same per-cell puncture chance went 13 % -> 23 % of bushes. Re-measure after any shape change.
- **A background tool can be reaped for low memory** while the session is idle (simhash at 10 of
  13 runs): read the finished runs against the reference, ask the owner before re-running.
- `worldhash` hashes every level field, cache fields (`_...`) included: a new data field, or code
  that touches shared objects, reads DIFFERENT widely - prove the rest by skipping those keys in
  BOTH builds (temporarily, the same filter), then restore the tool.

## New probes (`tools/scratch/`)

`_bushes.mjs` (per level: count, nearest road edge, photos; Killder drag through vs beside,
punctures / dents over N bushes, flattening by pass; `physics` as 4th argument skips the photos),
`_bushtufts.mjs` (a car parked in a bush, close up).

## itch.io push (owner says when)

1. `npm run build` in the worktree (bundles to `dist/`: index.html, game.js, game.js.map).
2. Stage index.html, game.js, manifest.webmanifest (not the map) in a new folder under
   `GamesStudio/ready-to-play/`.
3. Test it as itch serves it: `node tools/scratch/_staticcheck.mjs <folder>`.
4. `BUTLER_API_KEY=<wharf key from the owner> GamesStudio/tools/butler/butler.exe push <folder>
   fuzzlepun/rac3r:html5 --userversion <date>-<commit>`; check with `butler status`.

## Picking up

- Test server `node serve.mjs` and cloudflared (running); the link is in
  `Desktop/G/GamesStudio/tools/logs/rac3r-tunnel.err`. Phone reports: `node tools/phonereport.mjs
  ../GamesStudio/tools/logs/rac3r-phone-report.jsonl --since <UTC>`.
- To main: commit in a worktree, `set -o pipefail; npm run verify`, push
  `HEAD:refs/heads/foreman/<name>`, wait for the `verify` check-run (GitHub API
  `repos/staystale/Rac3r/commits/<sha>/check-runs`), push `HEAD:refs/heads/main`, delete the
  branch, move the served clone (`git fetch -q origin && git checkout -q --detach origin/main`).
