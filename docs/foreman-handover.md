# Foreman handover

Written on the owner's request, 2026-10-24 (~21:00Z; main at the commit that adds this page:
"A13 and grass G1 the default"). Read `CLAUDE.md`, then `NOTES.md` (the owner's rules, decisions,
measured lessons and the routine - not repeated here), then `TODO.md` ("Where we are", the Queue and
the "OWNER LIST 2026-10-24" section are the plan), then this page.

## Where we are

- **The plain link is the approved game; the test list is EMPTY.** Today, after the mud default,
  everything below passed the owner's phone test and is the DEFAULT, its switch and old path
  DELETED (one system), each proved against the tested switch (simhash SAME, renderhash the same
  per level with the same level list, worldhash differing only where expected):
  - A1 sky: the twilight colour only in its share of the dark (no snap under cloud); rain / snow
    ease in two stages. A2 car light kept off bridge decks (render/lightdecks.ts). A3/A4 every car
    held in its grid slot through a circuit's rolling start (ai/formation.ts). A5 weather-only
    snow and ice (snow stages' road from their seed: world/stageweather.ts; scenery water, the
    highway's rivers too, never dries but freezes). A6 damp grip a small loss, fewer / smaller
    puddles. A8 locked wheels heat their tyres. E dry gravel to sand. A7 checked, x2 kept.
  - A11 PULLING AWAY only when you really lead (ai/hwFlow.ts: last road position kept, grace only
    for CATCH THEM). A12 traffic eases onto its lane after a driven -> carried handover
    (ai/trafficPhys.ts). A13 punctures by what you hit (physics/punctures.ts: one table; the
    clamps, contacts and loose objects note the kind). G1 short grass a pale striped lawn (its own
    grip / peak / bumpiness, extra dirt patches on their own stream), grass with fine blades.
- **HUD text fix: measured, not shipped.** HUD ~0.7 ms a frame on the laptop (text 34 % of it);
  bitmap stamps were slower on the laptop's CPU raster, "font set once" inside the noise. Both
  parked on branch `experiment/hudtext`. ASKED the owner (no answer yet): a phone `?report=1`
  A/B of the stamps, or close the item. Recommended: close.
- **itch.io** is build #2201136 (10-24, before all of today's fixes); push only when the owner
  says (recipe below; ask for a fresh wharf key - the key never goes in a file).
- **CI:** `verify` is the gate for main; the `checks` job compares each push with its parent, so
  a commit that changes behaviour on purpose fails it by design.

## NEXT (owner's order, TODO.md)

1. **Highway lamps L4b** (approved: street lights on ALTERNATING sides, streamed with the road like
   highway/litter.js, a spatial grid for the clamp - solidClamp walks every lamp per car per step).
   Not started.
2. **TypeScript conversion overnight** when the owner says they are going to sleep (TODO item 2:
   7 batches, proved SAME batch by batch) - before the AI rework and car systems.
3. Then B AI rework (architecture to agree first), C car systems (punctures now have the kind
   table C2 / C7 should use), E / D, F lighting, G sound / settings, H upgrades, I multiplayer.

## Proofs and references

- Worktrees: `Desktop/G/rac3r-wt` (where today's work was done) and `rac3r-wt2` (the proof
  side: check out the commit to compare against). The served clone `Desktop/G/rac3r` is detached
  on origin/main (`git checkout --detach origin/main` after each push).
- References (gitignored, in `rac3r-wt/tools/`): `.worldhash` saved on today's final defaults;
  `.simhash` saved on 084cce7 with `?punctkind=1&shortgrass=1&grassblades=1` (= the defaults);
  `.renderhash` saved on 1f58a29 in 4 shards - grass blades and short grass changed pixels since:
  RE-SAVE it on main in 4 parts before the next pixel proof.
- **renderhash compares like with like** (NOTES lesson): a `--only` list against a `--shard`
  reference reads DIFFERENT with no change. Prove a change by running the same list on both sides.
- Probes added today (`tools/scratch/`): `_skysnap` (sky colour steps), `_rainease`, `_rollstart`
  (formation / start-finish swing), `_lineseam`, `_stagelayout`, `_rainlap`, `_spinwear`
  (slip / tyre heat), `_pullaway` (highway flow, scripted), `_laneshuffle` (traffic sideways
  moves: aborts, pops, handover jumps; CLEAN=1), `_punctures` / `_puncturehit` (puncture sources
  / chance by kind), `_grassshots`, `_hudcost` / `_hudprofile`.

## Lessons from today

- **Check every name before writing a file** (owner): I overwrote an existing probe once with a
  heredoc; `ls` the path first, always (memory + NOTES).
- **Measure where the owner sees it**: the "oval wiggle" was the rolling start's release, not the
  racing line's seam; the traffic "shuffle" was the driven -> carried handover snap, not the
  lane-change abort - both found only by measuring with the real field.
- **Laptop numbers can mislead for drawing**: the headless browser rasterises on the CPU, so a
  GPU-friendly change (bitmap stamps) can measure slower here than it would be on the phone.
- **A switch read after `initWorld`** misses whatever the world builds at start-up (the Lab's
  patches): fine for a test switch, gone once it is the default.

## itch.io push (owner says when)

1. `npm run build` in the worktree (bundles to `dist/`: index.html, game.js, game.js.map).
2. Stage index.html, game.js, manifest.webmanifest (not the map) in a new folder under
   `GamesStudio/ready-to-play/`.
3. Test it as itch serves it: `node tools/scratch/_staticcheck.mjs <folder>`.
4. `BUTLER_API_KEY=<wharf key from the owner> GamesStudio/tools/butler/butler.exe push <folder>
   fuzzlepun/rac3r:html5 --userversion <date>-<commit>`; check with `butler status`.

## Picking up

- Test server `node serve.mjs` PID 6236 and cloudflared 1408 (running); the link is in
  `Desktop/G/GamesStudio/tools/logs/rac3r-tunnel.err`. Phone reports: `node tools/phonereport.mjs
  ../GamesStudio/tools/logs/rac3r-phone-report.jsonl --since <UTC>`.
- To main: commit in a worktree, `npm run verify`, push `HEAD:refs/heads/foreman/<name>`, wait for
  `verify` (`C:/Users/Admin/tools/gh/bin/gh.exe run list -R staystale/Rac3r -b <branch> -w verify`),
  push `HEAD:refs/heads/main`, delete the branch, move the served clone.
