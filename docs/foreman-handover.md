# Foreman handover

Written on the owner's request, 2026-10-18 (main at the cover-field default commit, plus this
page). Read `CLAUDE.md`, then `NOTES.md` (the owner's rules, decisions, measured lessons and the
routine - not repeated here), then `TODO.md` ("Where we are" and the 10-18 entries: COVER FIELD,
WINTER LOGIC, TYRE FEEL, WET TYRE MARKS, ONE PUDDLE LOOK, PACKED SNOW), then this page.

## Where we are

- **The test list is EMPTY**: everything built on 10-18 is approved and the DEFAULT, each with an
  `=0` switch back to the old: `?tyrefeel`, `?morepuddles`, `?onepuddle`, `?packedwear`,
  `?wettrail`, `?winter`, `?coverfield`. (`?labweather` is superseded by the cover field.)
- The judder question stays closed (DuckDuckGo shows no holds; Safari's presentation holds frames;
  `NOTES.md`). The owner saw no judder with the cover field.
- **READY TO WORK ON FIRST (owner, 10-18):** rain / water + driving over it turns SAND -> GRAVEL
  and GRAVEL -> DIRT (`TODO.md` "NEXT, READY TO WORK ON": today a churned puddle makes gravel
  into MUD and dry-or-wet sand / gravel never wear by passes - `wear.ts WATER_MIX`, `BASE_WEAR`).
- **Then (owner's list, in no fixed order - ask):** LIGHTING / time of day (brief below), T3 (tyres
  cool toward the AIR temperature; hot tyres clear water / ice faster), and a clean-up pass that
  deletes the retired puddle-site system (below).

## What was built 10-18 (all default)

- **Tyre feel** (`physics/tyreheat.ts`, `tyrewear.ts`): tyres warm sooner and hold heat inside
  their window (cooling less with speed; above the window as before, so overheating / popping is
  as hard as it was); a scrubbing axle's slip heat x1.4 below the window top; slides / spins /
  donuts wear 2-3x by their real slip, hot slides more, cold slides no extra. tyrecheck's rules
  moved with it (drift too hot 15 s+, 80 s drift never pops).
- **Wet trails** (`src/wettrail.ts`): wet tyre lines are a short trail per wheel (a point a metre,
  gone after 1 s or 50 m), drawn where the marks are drawn - not baked into the skid-mark layer.
- **One puddle look** (`render/ground/covers.ts PUDDLE_WATER`, `art.ts 'puddle'`): water tinted by
  its ground, blue-grey on hard ground; the wet art lost its blue blobs.
- **Packed snow wear + winter logic** (`world/snowwear.ts`, `puddles.ts`, `weather.ts`): loose snow
  packs / ices / slushes by temperature; packed snow ices more in the cold, churns to snow, or
  breaks through to water (a snow road's bed: gravel); tyre-made snow / ice melt above freezing
  (faster per C and in rain); tyre water freezes to black ice below 0 and dries in a warm spell;
  scenery water and frozen mud thaw faster per C. Without an event's weather nothing melts.
- **The cover field** (`world/coverfield.ts`, `world/coverlookup.ts`, `render/glfield.ts`) - F0-F4,
  see below. Every level follows its weather (the snow-level freeze was removed, F0).

## The cover field - how it works

- Every 0.5 m square has a CATCH (world-space value noise, two octaves, 255 steps; water and snow
  each their own seed). The weather moves LEVELS (water, snow, ice; areas also packed snow). A
  square is covered where its level is above its catch: small patches first, then a full coat
  (~10 min heavy rain / snow, ~25 light); drying / melting reverse it. Nothing stored per square:
  the endless highway is covered as it is built. Settled starts: rain 0.15-0.5, snow 0.15-0.38
  (owner: a quarter of the first try on normal tracks).
- LEVEL AREAS: the level's own snow ground, cover zones and lanes, packed snow roads and
  hand-placed patches have their own levels (full at the start), so a snow stage melts in patches
  in a hot event and the Bowling Alley wet lane dries. Their ground is painted as what lies
  beneath (`paintAs` in zones.ts / road.ts / tiles.ts; `areaUnder`: the surface's `under`, a
  road's tarmac, open snow ground's grass). Scenery water (Cover.water) is fixed.
- Physics: `wear.ts layersAt` -> `coverfield.ts fieldLayers` (square centres, the same 255-step
  catch the GPU reads: what you see is what the tyre feels). Wear cells follow the field once a
  second (`syncFieldCells`); a spot tyres cleared refills only while it rains / snows; tyre-made
  covers keep the winter rules. The AI re-plans speeds when a level crosses a tenth
  (`coverEpoch` + the wetness step in `ai/line.ts`).
- Drawing: `glfield.ts` - a world grid texture (1024 squares, wrapping) of catch (RG) and a mask
  (255 = the tiles show it: scenery water, tyre-changed cells; 1-4 = the square's area) computed
  per 8 m chunk within 2 ms a frame (view first; a missing chunk shows no field); one full-screen
  pass after the tiles, before the hill shading; rims only where a cover meets bare ground. Mask
  updates ride `heightsChanged` (the wear drain). Not drawn on the 2D ground (`?glground=0`).
- Measured: Castle Cum race, 3 AI, water 0.6: 54.2 fps with vs 55.5 without (headless laptop); a
  snow stage under a full coat 60 fps; field + cell sync 0.48 ms a second with 5,749 cells.

## Clean-up owed (ask before deleting)

- The puddle SITES (`puddles.ts` sites, `refillCleared`, `extraWaterSites`, `?morepuddles`,
  `?labweather`, `covergrid.ts` use by sites) are off whenever the field is on (the default):
  dead weight to remove. Scenery water freezing / thawing and the winter cell rules live in
  `puddles.ts` too and must stay (or move to their own module).
- `?winter` / `?coverfield` old paths stay until the owner says the old can go.

## LIGHTING - the owner's brief (not started)

Weather changes the light; time of day an option that moves slowly and realistically through a
race; darker in winter (shorter days); pink sunrises, orange sunsets, moonlit nights, truly dark
nights where the headlights matter (cars have beams: `render/cars.ts drawHeadlights`); track /
street lights if not overkill. On its own switch, tested separately. THE RISK is Safari: every new
look is a per-frame cost there (`NOTES.md`). Ideas, not decided: tint the ground in the GPU shaders
as the wet look does; a low-res light map; measure each with `tools/drawload.mjs` and an owner
screen recording (held frames). CLAUDE.md: bring a mockup before a new look.

## Proofs and references

- simhash / renderhash references were re-saved on the cover-field default (worktree
  `Desktop/G/rac3r-wt/tools/.simhash`, `.renderhash` - gitignored). Old paths prove SAME with
  `RAC3R_QUERY="coverfield=0&winter=0"` (these tools run the browser game: never prove an old path
  with a node wrapper - `NOTES.md`).
- Probes kept in `tools/scratch/`: `_coverfield.mjs` (coverage over time, cost), `_winter.mjs`
  (snow outcomes by temperature, melt, lab sites, cost), `_packedwear.mjs`, `_morepuddles.mjs`.
- File-size caps bite: `render/road.ts` is at 800 lines (`wear.ts` 760 after the cover lookup
  moved out). Long node edit scripts: write them with the Write tool, not a Bash heredoc.

## Picking up

- Test server and tunnel running (`serve.mjs` PID 6236, cloudflared 1408; the link in
  `GamesStudio/tools/logs/rac3r-tunnel.err`); the served clone `Desktop/G/rac3r` is detached on
  origin/main - never `git checkout main` there (a stale local branch); use
  `git checkout -q --detach origin/main`.
- Worktree `Desktop/G/rac3r-wt` on main, clean.
- `gh` is not on the Bash PATH: read check-runs with curl
  (`api.github.com/repos/staystale/Rac3r/commits/<sha>/check-runs`).
