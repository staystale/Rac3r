# Foreman handover

Written on the owner's request, 2026-10-18 (late afternoon; main at the "tyre cooling and cover look
default" commit, plus this page). Read `CLAUDE.md`, then `NOTES.md` (the owner's rules, decisions,
measured lessons and the routine - not repeated here), then `TODO.md` ("Where we are" and the
10-18 entries from ZOOM LURCH down), then this page.

## Where we are

- **The test list is EMPTY.** Everything built on 10-18 is approved and the DEFAULT, each with an
  `=0` switch back to the old path (below).
- **NEXT (owner's order):** a **PERFORMANCE PASS** (owner: "before lighting"), then **LIGHTING**
  (brief below). Nothing else is queued.
- Performance so far: the owner's iPhone, Castle Cum IN SNOW, `?report=1` (14:40Z): **0.10 % slow
  frames**, our JS ~1 ms sim + 2 ms draw - the best Castle Cum run yet; the cover field, mud frost,
  mark fade and HUD gauge cost nothing measurable. The menu run had a 190 ms frame and a **183 ms
  tap** handler (the owner felt nothing): the first lead. Reports now carry the weather
  (`ui/report.ts weatherNow`; `tools/phonereport.mjs` prints it).
- Suggested shape of the pass (agree it with the owner first, with sizes): find the 183 ms tap
  (`phonereport` MENU section: slowest handler), a snow-stage `?report=1` run (Ikeaflatpack /
  Brrrmeatballen: the cover field on every square), a held-frame screen recording if the owner
  feels anything; `tools/drawload.mjs` for drawing counts. Do not chase Safari's own 1-5 %
  off-beat frames (`NOTES.md`).

## Built 10-18 (all default; `=0` = the old)

| switch | what |
|---|---|
| `?zoomswitch` | GPU ground tiles get mipmaps with the upload: no burst of mipmap builds (and a held frame) when the zoom first passes ~0.5 |
| `?mudfreeze` | all mud / thick mud freeze by the cover field's FROST (thick mud x0.7), driven or not |
| `?sanddig` / `?graveldig` | sand dents fastest (dry too, 45 cm floor); gravel like sand but slower (30 cm); wet sand / gravel x1.5; dry mud / thick mud at half the wet rate; churned gravel -> dirt |
| `?wintercold` | winter air -4..7 C, weak winter sun (dry winter track ~-2..9 C, 18 % of starts below 0); every ice melts at half snow's rate |
| `?coldsurface` | ONE cold-surface order: water over snow over ice per square, a level area's cover stacking with the weather's; snow never on water (melts in; freezes first when cold); rain on ice no longer spreads it; driven ice breaks to water by temperature; rain melts ice (less than snow) |
| `?wearchance` | dry dirt -> mud 1 in 4 (wet as before); damp sand -> gravel, damp gravel -> dirt; dry sand / gravel keep their surface |
| `?markfade` | tyre marks fade block by block, gone in ~2-3 min (the old per-step fade never removed anything) |
| `?hudunits` | TRACK temp gauge (minimap's per-difficulty rule), SPEED km/h-mph and TEMPERATURE C-F rows in pause > HUD; on landscape phones ABS / TCS move left of the pedals when the right column reaches them (a pre-existing overlap) |
| `?onelook` | ice / snow / packed snow / water the TYRES make are drawn by the GPU field with its look |
| `?tyrecool` | tyres cool toward a track / air mix (air 0 at rest -> half at 150 km/h); hot tyres clear standing water in 2 passes at 100 C; hot tyres break driven ice more often |
| `?coverlook` | water darker navy, ice glassy cyan with sparse streaks, packed snow grey-white with a light grain |

**Clean-up done:** the puddle SITES, `?morepuddles`, `?labweather` and `?coverfield=0` are deleted
(`puddles.ts` 722 -> 376 lines: scenery water freezing, the tyres' winter cell rules, mud drying).
The old level snow / ice PATCH melting was removed with them: it deleted a level's own snow / ice
on any start above 5 C. The cover field is the one water / snow / ice system.

**Owner decisions 10-18:** snow keeps its opacity by depth (thin snow shows its ground - do not
re-propose an opaque snow); slide-scrubbing of ice by hot tyres stays at x1.67 at 120 C (cut from
x3 at the owner's request earlier); the minimap may be simplified if ever needed (no need measured).

## How the systems fit (where to look)

- `world/coverfield.ts` - the field: CATCH noise per 0.5 m square, LEVELS (weather + level areas),
  `stackOfLevels` / `stackCovers` (the one order), `FROST` (mud), `cellCoverOnGpu` (one look),
  `fieldLayers` (what the tyre feels). `render/glfield.ts` draws the same: mask codes 0 none,
  1-4 level areas, 5/6 mud / thick mud, 7-10 tyre-made covers, 255 the tiles show it; the shader's
  `stackIn` / `kindOf` mirror the CPU; `newLookOf` is the cover look.
- `world/dig.ts` - how ground dents and wears (RUT, SAND_DIG, GRAVEL_DIG, wear chances).
- `world/puddles.ts` - scenery water freeze / thaw, the tyres' winter cell rules, mud drying.
- `world/snowwear.ts` - driven snow / packed snow / ice outcomes by temperature.
- `physics/tyrecool.ts` - T3 (no imports: the world modules read it without a cycle).
- `hud/tracktemp.js`, `hud/minimap.js modeSetting` (per-difficulty HUD settings, shared).
- `marks.js fadeBlocks`.

## Proofs and references

- simhash references: re-saved on the A-D defaults (worktree `Desktop/G/rac3r-wt/tools/.simhash`);
  still SAME on today's last commit. renderhash references: re-saved on main 5003d9a (valid now).
- renderhash runs the CPU ground (`?gpupaint=0`): it does NOT cover the GPU field shader
  (`glfield.ts`). For a GPU look change: photograph it (`tools/scratch/_coverlook.mjs`,
  `_onelook.mjs`, `_mudshots.mjs`, `_coldshots.mjs`) and check page errors (a shader that fails to
  compile shows only as a missing field).
- `tools/uicheck.mjs` reads the HUD layout before a frame draws the tyre diagram: use
  `tools/scratch/_hudoverlap.mjs` (frames drawn, 6 sizes) for the right-hand column.
- Probes in `tools/scratch/`: `_zoomlurch` / `_zoomswitch` (camera / zoom), `_mudfreeze`,
  `_sanddig` / `_sandcover` / `_sandshots`, `_wintertemp`, `_coldsurface`, `_markfade`,
  `_tyrecool`, `_hudunits` / `_hudunits2`, `_snowmix`.

## Lessons from today

- Rerun `npm run verify` after the LAST edit before pushing (CI failed once on a long line).
- Long node edit scripts: write them to a file (`../_x.mjs`) - inline `node -e` with template
  strings broke in bash several times.
- Size caps bite: `wear.ts` 768 / 800 (dig rules moved out to `dig.ts`); `settings.ts readSettings`
  sits at the 80-line cap - new weather / ground switches go in `weatherSettings`.
- Changing the sharpness (dpr) moves the zoom where the GPU ground changes method (NOTES).

## Picking up

- Test server and tunnel running (`serve.mjs` PID 6236, cloudflared 1408; the link in
  `GamesStudio/tools/logs/rac3r-tunnel.err`); the served clone `Desktop/G/rac3r` is detached on
  origin/main - never `git checkout main` there; use `git checkout -q --detach origin/main`.
- Worktree `Desktop/G/rac3r-wt` on main, clean after this commit.
- `gh` is not on the Bash PATH: read check-runs with curl
  (`api.github.com/repos/staystale/Rac3r/commits/<sha>/check-runs`).

## LIGHTING - the owner's brief (not started; after the performance pass)

Weather changes the light; time of day an option that moves slowly and realistically through a
race; darker in winter (shorter days); pink sunrises, orange sunsets, moonlit nights, truly dark
nights where the headlights matter (cars have beams: `render/cars.ts drawHeadlights`); track /
street lights if not overkill. On its own switch, tested separately. THE RISK is Safari: every new
look is a per-frame cost there (`NOTES.md`). Ideas, not decided: tint the ground in the GPU shaders
as the wet look does; a low-res light map; measure each with `tools/drawload.mjs` and an owner
screen recording (held frames). CLAUDE.md: bring a mockup before a new look.
