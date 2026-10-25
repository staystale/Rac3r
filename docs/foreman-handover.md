# Foreman handover

Written on the owner's request, 2026-10-25 (main at the commit that adds this page: "Car lamps,
marshal huts, brake glow, trees the default"). Read `CLAUDE.md`, then `NOTES.md` (the owner's
rules, decisions, measured lessons and the routine - not repeated here), then `TODO.md` ("Where
we are" and the "OWNER LIST 2026-10-24" section are the plan), then this page.

## Where we are

- **The plain link is the approved game; the test list is EMPTY.** Everything below passed the
  owner's phone test and is the DEFAULT, its switch and old path DELETED (one system), each
  flip proved simhash SAME against references saved on the tested commit with the switch on.
- Since the 10-24 handover:
  - **Highway street lights (L4b)**: one every 34 m, alternating sides, streamed with the road
    (highway/roadlamps.ts, world/lamps.ts keeps each the same lamp while loaded). With them the
    **solid grid** (world/solidgrid.ts on core/cellgrid.ts - the one grid helper, the cover
    index and bump grid moved onto it): the highway's solid clamp 4.3 -> 0.3 us a car-step.
  - **Small fixes**: traffic woken to physics is seated on the ground (it was thrown 42 m up on
    hills); `?autopilot=1` no longer throws on the Lab; dead hand-placed puddles deleted (Test
    Track, Grass Track, Stock Car); the Sandbox keeps its sample puddles; the Lab's own ice /
    snow / puddle samples were wiped at boot by the highway's first road build (fixed:
    puddles.ts adoptRoadCovers takes the highway level); wobblecheck / treadmillcheck /
    trafficcheck pass again.
  - **Surfaces (E)**: meltwater (melting snow / ice leave water up to heavy rain's and a damp
    track); ice cracks (more grip, wear through faster, spread a few cells; world/icecrack.ts).
  - **Reversing lights** (render/reverselights.ts; dimmed once: owner "slightly bright").
  - **Event lighting (F)**, the owner's picks from the mockup
    (claude.ai/artifact/D6k1bE4NDseZdr27dZBuCM): backlit boards (faint neutral halo), marshal
    beacons, multi-coloured festoons on stands, rally fairy lights following the road edge,
    the start gantry's light bar and red / green start lights, pit lamps, caravan light spill
    (no windows: top-down), floodlights in tyre rings at the tightest corners, village street
    lights on generated stages; a knocked lamp settles (steady, or dies by the light it lost).
    render/eventglows.ts, world/lampplan.ts.
  - **Round 2**: car lamps flicker after a hit then work again or die by damage
    (render/carlamps.ts); wooden marshal huts that smash at ~30 km/h, throwing pallets
    (world/marshalbox.ts); **hot brake glow** (render/brakeglow.ts): heat builds over ~3 hard
    stops, the handbrake heats the rears, and - the owner's last request, in this commit - the
    brakes are COLD again after RESTART / RESET, as the tyres (keyed to vehicle.ts reset's new
    tyre temperatures); **trees, part 1** (world/treetrunks.ts trunk-only solid; render/trees.ts:
    canopies over the cars and kept dark at night, leafy trees by the season, firs, weather snow).
- **TypeScript conversion: ON HOLD** (owner 10-25). New code is TypeScript (every module above
  is); small edits to old .js are fine; convert the old files later when the owner says.
- **HUD text fix**: measured, not shipped (branch `experiment/hudtext`); the owner has not said
  close or phone-test - recommended: close.
- **itch.io** is still build #2201136 (10-24); push only when the owner says (recipe below).

## NEXT (owner to pick; the list given 10-25)

Bushes (the rest of D: pass-through, heavy drag, wear to long grass, a puncture chance); car
systems C (flat tyres that look flat, radiator / engine temperature and warning lights, exhaust
smoke, oil from crashes, bodywork debris, armco dents, open-wheel contact); the `wearcheck`
rewrite to today's rules (it has 13 stale checks); AI rework B (design first, ideally after the
TS conversion); sound + settings G (agree each sound first); Story mode + upgrades H; new
levels (the Dieatona tri-oval); multiplayer I. Mockup / photos first for any new look.

## Proofs and references

- Worktrees: `Desktop/G/rac3r-wt` (where the work is done) and `rac3r-wt2` (the proof side:
  check out the tested commit and save switch-on references there with
  `RAC3R_QUERY="<switches>" node tools/simhash.mjs save`, copy its `tools/.simhash` over). The
  served clone `Desktop/G/rac3r` is detached on origin/main.
- References (gitignored, `rac3r-wt/tools/`): `.simhash` = today's default (saved on be6c494
  with the round-2 switches on; the flip read SAME). `.worldhash` re-saved on this commit.
  `.renderhash` is STALE since 10-24 (grass, lights): re-save on main in 4 parts before the next
  pixel proof.

## Lessons from today (also in NOTES where they last)

- **The Edit tool joined lines** when an old string began with a newline, in files with CRLF
  history: delete whole lines with `sed '/pattern/d'` or a small node script instead, and read
  the result.
- **`verify | tail` hides a failure** (the pipe's status is tail's): use `set -o pipefail` before
  chaining a commit or push after it. Once a failing commit reached a branch (CI stopped it).
- **A straight line between two road points cuts across a bend**: anything placed "along the
  road" (fairy strings) must follow the road edge point by point (barriers.ts smoothOnTrack).
- **The player's brakeLight is rewritten from the controls every frame**: a harness that forces
  it measures nothing; test a look's model on a stand-in object (tools/scratch/_brakeheat.mjs).
- **Auto mode's permission check can fail for a while** ("no verdict"): stop retrying and ask the
  owner to switch auto mode off (Shift+Tab); edits then go to the owner for approval.
- Measure the owner's feel before shipping a look: the brake glow first glowed after one stop -
  the owner wanted it to take several; build the model so a single number moves it.

## New probes (`tools/scratch/`)

`_hwlamps` / `_hwlampgap` / `_hwlampshots` / `_hwlampday` (highway lamps), `_autopilotboot`,
`_staticwet`, `_labcovers` (level covers at boot), `_meltwater`, `_icecrack` /
`_icecrackshots`, `_reverseshots`, `_propkinds`, `_eventlightshots`, `_round2shots`,
`_brakeheat`.

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
- To main: commit in a worktree, `set -o pipefail; npm run verify`, push
  `HEAD:refs/heads/foreman/<name>`, wait for the `verify` check-run (GitHub API
  `repos/staystale/Rac3r/commits/<sha>/check-runs`), push `HEAD:refs/heads/main`, delete the
  branch, move the served clone (`git fetch -q origin && git checkout -q --detach origin/main`).
