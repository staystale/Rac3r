# RAC3R - open work

New session? Read `CLAUDE.md`, then `NOTES.md`, then this file. Open items only: finished work is in
the git history (this file was swept on 2026-10-19: every finished entry deleted; the owner's
decisions and the measured lessons live in `NOTES.md`). `docs/foreman-handover.md` is the last
handover, written on request.

## Where we are (2026-10-19)

- The plain link is the approved game; the test list is empty. Everything approved on 10-18 is
  in it: weather, the cover field and winter, tyre wear / feel / cooling, ground dig, lighting
  (lamps, knock-downs, the night layer as the only light), the game clock and sun temperature,
  the glows in the night layer, the pause menu's alarm clock.
- ONE-SYSTEM CLEAN-UP (owner 10-18: "make sure we only have one system for everything ... we
  don't need old systems and new systems getting crossed up"; approved, before the TypeScript
  conversion): every approved switch's old path deleted, in groups, each proved (worldhash,
  simhash, renderhash vs the refs on main; photos for the GPU field, which renderhash does not
  draw) - the plain game unchanged.
  [x] 1 LIGHTS + TIME (main baed231): ?lamps, ?fieldlights, ?daytime, ?suntemp, ?nightpics,
  ?glowmap, ?pauseclock, ?onelight deleted; the car pictures paint lamps only; the pylon prop's
  own pool and the street lights' head glow drawn by the night layer (a warm pool tint, a head
  glow). ?night= stays (a test tool, not a system).
  [x] 2 WEATHER / SURFACES / TYRES: ?weather, ?slidewear, ?tyrewear, ?tyrefeel,
  ?packedwear, ?onepuddle, ?wettrail, ?winter, ?mudfreeze, ?sanddig, ?wintercold, ?graveldig,
  ?coldsurface, ?tyrecool, ?coverlook, ?wearchance, ?markfade, ?onelook, ?grassgrip,
  ?groundlookup deleted, with the cover-field shader's old order and look. simhash, renderhash SAME;
  the GPU field photographed SAME (shotdiff: only the HUD's live FPS figure); worldhash (a node
  tool that built levels with the module defaults, the weather's puddles off) now builds what the
  game builds: on 9 levels only the level's own puddle covers are gone (the weather makes them).
  [x] 3 DRAWING (main 86cbd8d; simhash, renderhash SAME, the GPU ground photographed SAME): ?sharpcars, ?sharpmarks, ?exacttiles, ?zoomhold, ?zoomswitch,
  ?startfix, ?texwarm, ?menufast, ?thumbcache, ?tex, ?vsync, ?hwmap, ?jokerfix deleted with their
  old paths (cars / marks in the art buffer, the eased zoom, mips at a zoom-out and the GPU
  ground shader's level-0 switch, a fresh colour probe per colour, unshared blade masks, live
  surface painting as a choice - it stays the fallback for a texture not yet painted).
  [x] 4 MENUS / HUD: ?hudmenu, ?tyreoff, ?hudunits, ?minimap deleted with their old paths (the
  pause menu's old MINIMAP row, the tune panel's TYRE HUD button, the diagram popping up when
  damaged); the HUD list's MINIMAP / PROGRESS / TRACK TEMP rows decide.
  [x] EXPERIMENTS (owner: delete them if cleaner and not needed): ?menuvideo (with media/ and
  tools/menuvideo.mjs), ?onecanvas, ?tilegpu, ?grass=square, ?nolock deleted; simhash, renderhash
  SAME.
  [ ] 5 THE CPU GROUND (?gpupaint=0 / ?glground=0): renderhash and edgecheck draw it - ASK the
  owner: delete it and point renderhash at the GPU ground (slower proofs, but they prove the
  ground the phone shows), or keep it as a proof tool.
- CI: the `checks` job (the suite vs the base) has FAILED on every main commit since b2dbcf8
  (lighting L4, 10-18); `verify`, the gate for main, passes. Find the failing check (run
  `npm run suite` locally; the job's log needs a GitHub login).
- The laptop has ~6 GB: ONE heavy browser tool at a time. A full proof run with photo browsers
  alongside ran it out of memory (10-18; Claude Code stopped the jobs).

## Queue (the owner orders it)

1. The one-system clean-up, groups 2-5 (above).
2. TYPESCRIPT CONVERSION (owner: approved; "wait until I say I'm about to sleep, then do as much
   as you can over night"; after the clean-up, so no dead code is converted): the 57 remaining
   .js files (~14k lines), converted in place with types, proved SAME (worldhash, simhash,
   renderhash) batch by batch: 1 small leaf files (testlist, menu style / widgets, cone
   constants, presets, profile, state), 2 cones, 3 HUD, 4 menus, 5 highway, 6 game flow (loop,
   sim, session, ai, menuflow, controls, rules, order, grid), 7 top level (main, audio, guide,
   stagegen, marks, input, damage, roll, carstats, raceflow, contact, tune). New modules are .ts
   already (NOTES).
3. HUD TEXT FIX (approved; owner: "make sure it makes it better not worse"): the HUD text is
   redrawn every frame (~3.5 % of our time on the laptop profile) - draw it only when it changes.
   Measure first and after (laptop profile; a back-to-back phone ?report=1 A/B); default only if
   it is better.
4. MUD M1 (approved): mud turns to thick mud only with water (damp ground, rain, a churned
   puddle) - today 3 dry passes do it (wear.ts BASE_WEAR mud); a level's own painted mud dries in
   the heat too, as worn mud does (puddles.ts dryMud: ~4 min at 20 C, ruts kept; owner: YES).
5. GRASS G1 (approved): short grass told apart from grass (identical today: same art, mu 0.47) -
   a lighter, drier mown look, tighter stripes, no blades, dirt patches ~4 -> 10 % (own random
   stream: existing patches unchanged), mu 0.46, peak a touch earlier, ~20 % less drag; grass
   gets a sparse fine blade layer. Photos first, behind its own switch.
6. HIGHWAY LAMPS L4b (owner: "yes I want them"; street lights ALTERNATING sides, not paired):
   lamps streamed with the road (spawn ahead, cull behind, like highway/litter.js) and a spatial
   grid for the clamp (solidClamp walks every lamp per car per step: fine at ~30 a level, not at
   hundreds).

## Parked (owner)

- Judder: the held frames are Safari's (NOTES); owner: "ignore judder, it's ok atm". Before
  itch: a screen recording from the home-screen app.
- itch.io: not until the owner says.
- Ground on the GPU phase C (cars and props as GPU sprites, one canvas): GPU work measured no
  speed gain on the phone and two canvases cost Safari frames; proposed dropping (owner to say).
- The lean drawing plan (paused 10-17, default kept); fixed zoom steps (only for the lean path).
- The minimap may be simplified if ever needed (owner offered; no need measured).
- Outside TEST MODE the setup's SEASON slider gives way to the global season (with Story mode).

## STILL OPEN from the older lists (swept 2026-10-18)

The lists written 09-27 .. 10-04 were checked against the code; what is done was deleted (git has
it): hold-R reverse, RESET breadcrumbs, the grass track's random layout every load, the cover
layers (snow / ice / water over any surface, melting, freezing), mud ruts and dips, tyre heat per
wheel and cooling, weather drying water, mark fade, the speed zoom, the garage (classes, paint +
number, the tyre brands SPUM / KUM / DUNFLOP / PIRRELLY), the bigger lab, audio, screen shake.

GAME (owner decides the order):
- [ ] STORY MODE: ROOKIE SEASON (grass track, stock car, time trials: hillclimb / runway cones) ->
  ROOKIE 2 (similar events, track variations, harder to win); we pick the events; money / points
  also for NOT finishing top 3; replayable events / championships for more money (finish 5th,
  earn, upgrade, come back and win). Not started (the menu shows Story locked). Outside TEST MODE
  the setup's SEASON slider gives way to the global season then.
- [ ] UPGRADES + PROGRESSION: every car from base spec up (BRIEF.md's 10-pip system; the mods seam
  exists, every multiplier 1.0); limited by SERIES ELIGIBILITY (over-upgrade and the car no longer
  qualifies); mods shown with the stats ("Engine v2: top speed +10 mph"). Not started.
- [ ] BRIEF.md open questions before the economy: rivals vs ghosts, the broke-player floor, fuel /
  damage persistence, what a pip is worth in lap seconds.
- [ ] MORE LEVELS + EVENTS: one of every event type; DIEATONA - Naffcar rebuilt as the Daytona
  tri-oval parody (31 deg turns, 18 deg tri-oval, flat back straight, pit lane, grandstands,
  infield lake, rolling start, "subtle skulls" in the decorations; the old Naffcar kept as
  classic). Not started.
- [ ] MORE CARS + car feedback (10-04; ASK if it still stands): cars "a little less standard, more
  like their unique real counterparts"; the WRZ slow to accelerate, cannot wheelspin or drift;
  the track car should look like an F1 car (bigger wheels, proportions).

DRIVING (ask before starting; re-measure first, these are old):
- [ ] THE ROOT FIX: wheel angular velocity as real state (the rolling and sliding tyre laws
  disagreed ~2.8x at breakaway; ENGINE.md has the two reverted attempts). Ask first.
- [ ] Threshold braking regressed (full pedal optimal again; brake force wants ~1.7 g).
- [ ] Naffcar V8 failed the lap driver on its own track (12.7 s off the road).
- [ ] Tyre marks (rubber) adding grip on the racing line; cross-surface contamination (mud carried
  onto tarmac). Not built - ASK if wanted.
- [ ] Outer tyre walls (grass track, stock car): should they CATCH cars (heavier stacks / a double
  row)? Owner decision open since 10-03.

## Tools that are wrong

- [ ] Highway checks failing since before the overhaul (10-12): `tools/hwracecheck.mjs` "no racer
  wrecked (2)", `tools/trafficcheck.mjs` "motorway: traffic stays on the carriageway",
  `tools/treadmillcheck.mjs` "motorway: no litter in a driving lane (2)".
- [ ] `tools/wearcheck.mjs` 3c is flaky (random churn): seed it or loosen the threshold.
- [ ] `tools/wobblecheck.mjs` is broken (its input hook).

## Owner specs

- `docs/specs/levels-events.md` - Levels and events (owner spec dump)
- `docs/specs/roadmap-2026-10-03.md` - Roadmap (digest of SPECS-2026-10-03.md)
- `docs/specs/surface-evolution.md` - Surface evolution (owner spec)
- `docs/specs/master-backlog.md` - Master backlog (triaged owner list)
- `SPECS-2026-10-03.md`, `BRIEF.md` - the owner's original specs
