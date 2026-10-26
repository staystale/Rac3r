# RAC3R - working notes

The standing notes for whoever works on RAC3R: the owner's rules, decisions, measured lessons and the
routine. Read after `CLAUDE.md` and before `TODO.md`. Keep every entry short and current: edit an entry
in place, replace it when it changes, delete it when it no longer holds. This is not a log: history is
in git, open work in `TODO.md`. Write a handover document only when the owner asks for one.

## Owner rules

- Discuss before anything non-trivial: find the root cause, propose the fix with a size (S / M / L, a
  total for a plan), wait for a yes. No chains of experiments without telling the owner.
- One step at a time, then pause for the owner's phone verdict. Give tap-able links.
- The plain test link is the approved game. Anything new goes behind a `?switch` for a phone test
  first, even when the owner asked for it. On the owner's OK it becomes the default the same day
  and the OLD PATH IS DELETED (no `=0` kept), its testlist entry is deleted and the verdict noted
  in `TODO.md`.
- ONE SYSTEM FOR EVERYTHING (owner, 10-18: "we don't need old systems and new systems getting
  crossed up"): never two ways of doing one job (the car pictures' own daytime beam met the night
  layer at dusk). Before building, check nothing already does it; extend that instead.
- Links to the owner: the plain link plus only the switch under test, `&report=1` for a measured run.
  For a judder question ask for two runs back to back, with and without the switch, same level.
- When the owner reports something that looks wrong, fix it; do not spend effort proving whose fault
  it was. If asked to "fix it or undo it" and the cause is not found, undo.
- Bring mockups before building new UI or a new look (the car mockup: `tools/scratch/carmock.html`).
- Sounds: ask the owner about each sound before building it, then a test to approve (10-24).
- Test links may bundle several small changes (quicker for the owner); a big or important one
  (the AI rework) keeps its own switch (10-24).
- The owner tests in DuckDuckGo too (phone and laptop): ask before closing it on the laptop.
- Slave FM is the owner's own project on the laptop: read it if needed, NEVER change it.
- WEATHER ONLY (10-24): no level- or stage-drawn snow, ice or puddles - the weather lays them.
  SCENERY WATER (lakes, rivers, fords, the highway's rivers and canals) never evaporates but can
  freeze. The test levels' surface samples (Lab, Test Track pads, Sandbox, Lab extension, the
  Castle Cum skid pan) stay. A level with no setting for what lies under its snow: make a
  logical call (snow stages: the road from the stage's seed).
- HANDBRAKE HEAT (10-24): the handbrake heats the REAR tyres; the fronts heat only by the
  turning they do (never by the handbrake itself).
- Every car / track / stage / brand / generated name is a parody pun.
- No keys, tokens, tunnel URLs or process IDs in the repo. No itch.io push until the owner says so.
- The foreman may push to `main` once the change is proven (routine below).
- Keep the test server and the tunnel running.
- Check what tools and earlier work exist before building a new tool (`ls tools`, `git log --grep`,
  `TODO.md`, these notes); build a new one only for what is missing.
- Handovers only when the owner asks. Notes go here.
- Bigeon ideas and fixes go in the owner's idea file on the worker PC (SSH; see the owner's README).

## Decisions (owner)

- ONE-SYSTEM CLEAN-UP (10-19, owner): every approved feature below is the only way the game does
  that job - the old paths and their `=0` switches are deleted (TODO.md lists the groups). What
  remain are test tools (`?night=`, `?rain=`, `?report=1`, `?skip=`, `?dpr=`, `?autopilot=`).
  The CPU ground was deleted too (10-19, owner: "do it and let me test"): WebGL2 is the ground.
- Ground drawn by the GPU (floor, zones, hill shading; fixed-density tiles for the rest), zoom hold
  with smooth moves, frame pacing, minimap (highway too), grippier grass, the Lab split: approved and
  default (10-15 / 10-16).
- Cars: look B, turned and scaled at screen resolution on the 2D screen canvas (`drawSharpCarLayers`),
  not strict pixel art; default since 10-16. Skid marks drawn on the screen
  canvas too (no quiver), and the joker lane on the minimap + RESET back onto it: default since 10-17. Ground tiles at their exact place on the GPU ground, so
  track edges hold still while zooming: default since 10-17. The pause menu's
  HUD list (each display piece on / off; controls never; tyre / damage OFF stays off when damaged):
  default since 10-17. Loading: the game as one bundled file from
  the test server and the menu thumbnails saved per version: default since 10-17 (`?bundle=0`); the tools (automation) always load the separate modules. The menu: no fly-in behind it, thumbnails
  painted while loading, long-grass blades stroked once (one palette shade off on ~0.2 % of
  long-grass pixels, owner accepted): default since 10-17. The long-grass textures
  painted while loading (the menu's ~125 ms frame): default since 10-17. Screen
  sharpness capped at 1.5 device px per CSS px (was 2): default since 10-17 (`?dpr=2` = old). The
  race start without the fly-in hand-over jolt: default since 10-17. Ground tile
  mipmaps built with the upload (no burst at a zoom-out): default since 10-18. All mud and
  thick mud freeze by the cover field's frost, driven or not: default since 10-18.
  Sand dents most easily (dry too, 45 cm floor), dry mud / thick mud dent at half the wet rate,
  a churned gravel puddle leaves dirt: default since 10-18. Gravel dents like
  sand but slower, both faster wet; frosty dry winters and ice melting at half
  snow's rate: default since 10-18. One cold-surface order (water over snow
  over ice; snow never on water; driven ice breaks to water), dry dirt -> mud
  1 in 4 and damp sand / gravel wear, tyre marks fading block by block, the track temp gauge
  and km/h-mph / C-F rows: default 10-18.
  Tyre-made covers drawn as the field's, tyres cooling toward a track / air mix with
  hot tyres clearing water / ice faster, water / ice / packed snow told apart: default 10-18.
  Pre-turned pixel art (RotSprite)
  was the alternative, not chosen.
- The A fixes (10-24, owner "all pass"): the sky's twilight colour only in its share of the dark
  and rain / snow easing in two stages; car light kept off bridge decks; every car held in its
  grid slot through a circuit's rolling start (ai/formation.ts); weather-only snow and ice
  (snow stages' road from their seed); damp ground a small grip loss with fewer, smaller
  puddles; locked wheels heating their tyres; dry gravel turning to sand when hot.
- Also 10-24 (owner: pass): PULLING AWAY only when you really lead; traffic eases onto its lane
  after a driven -> carried handover; punctures by what you hit (physics/punctures.ts table);
  short grass a pale striped lawn told apart from grass, grass with fine blades; the highway's
  street lights (one every 34 m, alternating sides, streamed with the road); a woken traffic car
  seated on the ground; the Sandbox keeps its sample puddles; melting snow / ice leaves its water
  (up to heavy rain's, the track damp while it melts); driven ice cracks (more grip, wears
  through faster, cracks spread a few metres). 10-25: reversing lights on every car (white
  lamps at the tail in reverse; at night a glow and a short dim beam; owner: "slightly bright"
  -> beam 0.25, glow 0.7 of a brake light's).
- Event lighting (10-25, owner "all pass", picks in TODO F): backlit boards (faint halo), marshal
  beacons, multi-coloured festoons on stands and rally fairy lights (following the road edge),
  the start gantry's light bar and start lights, pit lamps, caravan light spill (no windows:
  top-down), floodlights in tyre rings at the tightest corners, village street lights on
  generated stages; a knocked lamp settles - steady, or dies by how much light it lost.
- Also 10-25 (owner: pass): car lamps flicker after a hit, then work again or die by damage;
  wooden marshal huts that a hard hit smashes (pallets thrown, beacon out); hot brakes glow at
  night after several hard stops (handbrake: the rears), cold again on RESTART / RESET as the
  tyres; trees with a trunk-only solid, canopies over the cars and dark at night, leafy trees by
  the season and firs, snow from the weather. Bushes (10-25, owner: pass): square pixel clumps in
  their own greens that you drive through - heavy drag, a light dent, a puncture chance, leaves
  poking up over the cars - flattened to long grass; on rally stages, circuits, rallycross and
  the test levels.
- TypeScript conversion ON HOLD (owner 10-25): keep building in TypeScript, convert old .js later.
  A .js file a feature rewrites becomes .ts first, in its own commit proved SAME (damage.ts, 10-25);
  a .js file a feature only touches gets a one-line call into new .ts code.
- Car systems C (owner 10-25): integrate with the old systems and finish with ONE coherent system
  (punctures, grip, pull, drag, sparks, marks, water, smoke all extended, never duplicated).
  Answers: a burst goes flat in ~0.5 s, debris / nails / bush leak over 10-30 s; ~1 km flat to
  the rim; an overheated engine SEIZES (RESET mends); every car has both speedo lights; tyres
  squash progressively with pressure (mockup approved). A rim or a rolled body on hard ground
  may break it a grade (race tarmac -> tarmac -> broken).
- Binned 10-25 (owner: "park em : bin em"): the HUD text fix (no clear gain measured) and the
  GPU ground phase C (no phone gain). The 10-04 car feedback is out of date. Real ABS is wanted:
  the driving root fix (wheel spin as real state) is queued, plan first.
- Car systems C round 1 (10-25, owner: pass): punctures are leaks (a burst flat in ~0.5 s, debris /
  nails / bush over 10-30 s), tyres squash progressively by pressure, a flat reaches the rim by a
  rising chance (half by ~1 km), a rim or a rolled body on hard ground sparks and may break it a
  grade (race tarmac -> tarmac -> broken); no written PUNCTURE notice. Stingers (tyre spikes) on
  the Lab and Test Track. Highway hedges: one continuous line of bushes round every farm field.
  Also 10-25 (owner: all pass): sparks as pixel art on the screen canvas under the cars, glowing
  at night (no glow patch), while sliding AND crash rolling, behind the way the car moves, hard
  ground only; crash sparks from metal impacts at 25 mph+ (70 %, sprayed the way the car went
  in); brake glow orange -> red the hotter, outside the wheel, none while rolled; a lost wheel's
  tyre reads 0 C; wet trails per wheel; the Lab's flip ramp (an armco end) for testing rolls.
- Car systems C round 2 (10-25, owner: pass): engine heat - a thermostat holds ~88-90 C with a
  sound radiator on any day; a front hit cracks the radiator, power fades 115 -> 130 C, ~10 s at
  130 C (or no oil) SEIZES it (RESET mends; an AI resets); the speedo's thermometer and oil can;
  exhaust by throttle and cold, backfires, steam and engine smoke over the car. THE LEAK IS WATER
  (owner: "the same liquid" as the rain, behaving the same, more the worse the leak): it lands as
  the tyres' water in the wear cells, never a second water look.
- Oil, car systems C6 (10-25, owner: all pass): it ACTS LIKE WATER - one cover in the wear
  cells, whole cells, a third of the grip, black with a dark purple sheen and edges (pixel art),
  soaked up by loose ground, never dries; driven through it spreads a little the way the wheel
  went, water spreads it 50:50 a second; no oily tyres or oily marks (owner).
- Debris, car systems C7 (10-26, owner: all pass): a corner's hit of ~0.3 knocks off a bumper
  (one an end), wing or door panel in the car's paint; they stay, the oldest fading past 24;
  the car's own look keeps its dents (may revisit). Glass from cars with windows lies in the
  wear cells, glints with the view, swept by the first tyre (a puncture chance; 15 % of those
  a sudden pop). Oil that would spread spreads 75 %, wears away 25 % (10-26, owner: pass).
- Outer tyre walls (Grass Track, Stock Car): a fast car pushing through them is fine (owner
  10-25); they stay single rows of loose tyres.
- Order 10-25 (owner): bushes -> car systems C (when bushes pass) -> the wearcheck rewrite (when
  C passes).
- Not wanted / undone: the highway rebuild (cancelled 10-15), a fade at zoom steps, tiles tracing
  only their part of the ribbon (`?ribboncull`, undone 10-16), the WebGL cars (`?gpucars`, removed
  10-16), the menu recording (parked until after the graphics work).
- Order (10-17 night): the lean drawing plan is paused and today's default kept (the holds are
  Safari's, see Measured lessons). Off-screen AI at half rate: saved.
- Weather (10-18): approved and the default: the season / weather setup rows,
  changing weather, wet grip per surface, the wet look, puddles and snow from the weather (scenery
  water permanent), the cold freezing water; sliding wheels wear the ground twice.
  Tyre wear the default too (10-18, test open; RESTART = the set at the event's
  start, RESET keeps the race).
- Weather and tyres (10-18, owner "yes all"): approved - tyrefeel (tyres warm
  sooner and hold heat in their window, slides / spins / donuts wear 2-3x, hot slides more; cold
  slides no extra), ?morepuddles (more puddles than snow, half on the road, the racing line
  refills in the rain; snow unchanged), onepuddle (one puddle look: water tinted by its ground),
  packedwear (packed snow breaks into snow or ice 50:50), wettrail (wet tyre lines fade within
  10-50 m). Later (owner): T3 - tyres cool toward the air temperature, hot tyres clear water / ice
  faster.
- Cover field + winter logic (10-18, owner "all pass"): approved. Rain and snow build in small patches until they coat
  the track, heat dries / melts them
  back, all by weather and temperature, on every level (highway too); every level follows its
  weather (a snow stage may be played hot and melt; a desert snowed on). The level's own snow,
  ice, water and packed snow are field areas (start full, melt / dry); under them: the surface's
  own under, a road's tarmac, open snow ground's grass (owner: "depends on the track"; varied
  levels later). A normal track's settled start snow is about a quarter of the first try. The
  field is THE water / snow / ice system (the puddle sites, ?morepuddles, ?labweather and
  ?coverfield=0 deleted 10-18); scenery water stays permanent (freezes in the cold). Snow is drawn
  with opacity by depth (owner: keep).
- Weather (10-17): a season slider sets the chances of rain / snow / dry / hot / super hot, the
  temperature and the track condition; it can change mid-race; it must add no lag. One water
  system: the existing wet / puddle cover, extended, never a second one.
- Lighting (10-18): before the performance pass (that only if the owner complains); cost test
  first, then features one at a time. Light fixtures are solid; street lights knockable (nudge =
  wonk + flicker, hard hit = out by degrees, fallen = debris, mangled per hit); pools below a
  lamp; lamps and AI / traffic headlights follow the light level; the player's LIGHTS stay
  manual and do not switch anyone else's (10-18). The night
  layer cost nothing measurable on the phone (L1 passed). Full list in `TODO.md` LIGHTING.
- Time of day (10-18): ONE global game clock that holds for the story (runs while playing,
  saved); 1 game day = 1 real hour; a season = 7 game days; UK-like days with moon phases;
  a start-hour slider in TEST MODE only; the race behind the menu follows the global time and
  season. Lamps (every level, knock-downs) and the clock: approved 10-18 (owner "all pass").
  Light comes from where the lamp's body is (owner). THE NIGHT LAYER IS THE ONLY LIGHT (10-18):
  headlight beams (no picture beam by day: owner "onelight pass"), lamp pools with their warm
  tint (the pylon prop's own pool folded in: owner "it should all be on the new glow style"),
  the cars' lamp glows (a tint in the light map; owner: close is fine "so long as it's clear").
  The pause menu's gold alarm clock beside MUTE (the game time; glows after dark): 10-18.
  Their switches are deleted (the one-system clean-up).
- Code (owner, 10-18): new modules are TypeScript (.ts); the remaining .js files are older.
- Mud (10-24, owner "all pass"): mud thickens only with water; a level's own mud and the
  highway's ploughed fields (random blocks) dry in the heat; worn dirt goes to mud less and to
  gravel more the hotter and drier (one rule by temperature, not the weather kind).
- itch.io: pushed 10-24 on the owner's say-so (recipe in docs/foreman-handover.md; page photos:
  tools/scratch/_itchshots.mjs + _itchcover.mjs, uploaded by hand on the edit page); push again
  only when the owner says.
- "Straight Outta Swindon" is a reserved name for a future highway level (the test straight that
  used it was removed 10-17).

## Measured lessons

- RENDERHASH COMPARES LIKE WITH LIKE (10-24): a level's hash depends on which levels ran before
  it in the same page - a --only list against a reference saved by --shard reads DIFFERENT on
  every level with no code change. Prove a change by running the SAME list (same --only or
  same --shard) on main and on the change, or against a reference saved with that list.
- The owner's iPhone 17 Pro Max (Safari, often the home-screen app) is the yardstick, not the laptop.
  Our JS takes ~4 ms of a 16.7 ms frame there: the phone is not CPU-bound. Laptop numbers at CPU x4
  overstate our cost; use them for A/B only, never as the reason for a change the owner will feel.
- GPU work helps visual problems (texture flicker at zoom), not speed on the phone - and it costs
  smoothness there: the WebGL ground under the 2D canvas made Safari hold 48-78 frames in 15 s at
  Castle Cum's corners, the CPU ground 9, the original build 0. Every new look is a per-frame cost
  for Safari: prove each with a held-frame recording before it becomes the default.
- The held frames are Safari's way of showing the page: the same default build in DuckDuckGo
  (iOS WebKit too) showed the owner no holds while a Safari tab held 42 in 10 s (10-17). The
  lean drawing only brought Safari to the original's level (0.3-0.6 a second). Test a Safari
  look in the home-screen app too before blaming our drawing.
- Never copy pixels between the 2D canvas and WebGL every frame: uploading the art buffer each frame
  took the phone's draw time from 3 to 7-8 ms and juddered.
- Felt judder comes and goes on the same build (two Castle Cum runs, same link: "juddery" and "fine",
  both ~0.4 % slow frames). One rough run is a reason for a back-to-back A/B, not proof.
- Safari rounds rAF timestamps to whole ms: frame pacing (`game/pacing.ts`) fixed the constant shake.
- The 136 m highway hitch was the skid-mark layer re-centring (26 MB copy); it now wraps.
- `preserveDrawingBuffer: true` on the WebGL canvas is needed on the iPhone (fewer slow frames).
- Held frames are invisible to rAF: an owner screen recording showed Safari holding ~6 frames a
  second at Castle Cum's corners while every rAF and physics step was on time. Count held frames in a
  recording (frames identical to the one before while things move), and count drawing work with
  tools/drawload.mjs; frame times alone cannot see this.
- In the recording counter (motion.html, frames shrunk to 220 px) the ground moves ~1.3 px a
  frame: its "1.5x / 0.5x step" counts are matching noise, not judder. Trust held frames only.
- The phone report's physics steps: 2 a frame on 97-99 % of race frames (lean, 10-17): the game
  moves evenly; what remains is how Safari shows it.
- Screen pixels cost frames on the iPhone even with our JS at 2-3 ms: sharpness 1.5 vs 2 halved
  the dropped frames in back-to-back races (4.5 vs 8.4 a minute); the owner saw no blur.
- Chrome's canvas picks its anti-aliasing method by a path's point count: clipping a path changes a
  few edge pixels, so "same shapes" is not "same pixels".
- Canvas 2D drawing is deferred until read: a getImageData / upload cost in a profile is often the
  painting itself.
- A CPU-backed texture pattern-filled onto a GPU-backed canvas is moved on every fill.
- Changing the sharpness (dpr) moves every zoom where the GPU ground changes method (1 screen px
  per tile px / texel): 1.5 put it at zoom ~0.5, mid speed, where a mipmap burst sat. Check
  zoom thresholds after any dpr / PPM change (tools/scratch/_zoomswitch.mjs).
- Track edges jiggled only while the zoom moved: tiles placed on whole art pixels under a GPU
  ground that zooms smoothly (up to 1.5 device px a frame). Measure motion against a control.
- The tyre marks quiver: the marks layer (4.2 px/m) is stretched ~3.6x nearest into the art grid each
  frame, so a mark pixel is 3 or 4 art px wide by camera position; now drawn on the screen canvas.
- Laptop frame numbers swing with the machine (Brands work median 20 ms one hour, 38 ms the next,
  main included): only compare A/B runs made back to back.
- The phone in Safari (tab or home screen) has 1-5 % off-beat frames (early or late) in every mode;
  a screen recording shows them as a frame held twice. Not our code (2-3 ms a frame): do not chase
  them as a menu or race problem without a back-to-back A/B.
- The test server sends the game as ~160 modules, never cached: over the tunnel that is seconds
  of load before our code runs; the bundle (one file, the default) fixed it. Measure the
  phone's load with `loadMs` (`phonereport` prints it).
- iOS LOW POWER MODE (and a hot phone, e.g. charging hard) caps Safari at 30 fps: every frame
  33 ms, the menu too, our JS 2-6 ms (10-18, felt as "major lag" and the ground painting falling
  behind). `phonereport` flags such a run (CAPPED AT ~30 fps); ask about it before chasing.
- `?report=1` records without drawing the meter graph (`?meter=1` shows it). It records the
  menu too: `phonereport` prints a MENU run (frame times, ignored taps, slowest tap handler).

- simhash / renderhash run the BROWSER game (main.js applies the settings): prove an old path with
  RAC3R_QUERY=<switch>=0, never a node wrapper that sets a module flag (main.js overrides it).
- The cover field costs ~nothing on the laptop GPU (Castle Cum race 54.2 vs 55.5 fps, a snow stage
  under a full coat 60): one full-screen pass reading one texel a pixel (rim reads only near
  patch edges); the catch is computed per 8 m chunk on the CPU within 2 ms a frame.

- renderhash draws the CPU ground (?gpupaint=0): it does not cover the GPU field shader
  (render/glfield.ts) - photograph GPU look changes and check page errors. tools/uicheck.mjs reads
  the HUD layout before a frame draws the tyre diagram: tools/scratch/_hudoverlap.mjs draws frames.
- The cover field, mud frost, mark fade and HUD gauge cost the phone nothing measurable (Castle
  Cum in snow, 10-18: 0.10 % slow frames).
- CI runners have no GPU: the WebGL2 ground runs in SwiftShader, 3-6 min a level for renderhash
  and the menu / guide checks several times slower than the laptop. Fixed sleeps time out there:
  wait for the condition. renderhash runs as 4 parallel shards (`--shard k/4`).
- framecheck A/B: alternate the order (on, off, on, off). The first run after a pause painted 3x
  the tiles (385 vs 120) whichever side it was.
- Wear cells cost per cell where code walks them all (pruneWear each highway rebuild, the worn
  tiles' painter per tile): ~3 000 on a circuit measured nothing; ~15 000 (the highway's ploughed
  fields) is why fields dry in blocks, not cells.

- The tiles' palette is built from SURFACE_ART (render/tilesPalette.ts): a new look's colours
  move other pixels' nearest-colour snap. While under test, add them only with the switch on.
- DRAWING NEVER USES Math.random (10-25): the tools seed ONE Math.random for the page, so a look
  that drew from it (marbles in marks.js, sparks, puffs) shifted every later dice roll of the
  physics and simhash read a look change as a race change. Looks use render/shared.ts fxRandom.
- Short-lived chips fade over their own life (render/particles.ts): by seconds left a spark
  (< 0.4 s) was never more than 40 % opaque - sparks existed but could not be seen.
- tools/framecheck.mjs does NOT drive the highway (its autodriver leaves the car parked there):
  A/B the highway with tools/scratch/_hwframes.mjs (the autopilot, CPU x4) instead.
- Odds rolled per wear cell scale with area (square bushes: the same per-cell puncture chance
  went 13 % -> 23 % of bushes vs round ones). Re-measure after any change of shape or size.

## Routine

- Work in a worktree, never the served clone: `git worktree add -q --detach ../rac3r-wt origin/main`,
  then a node_modules junction (`cmd //c mklink //J ...rac3r-wt\node_modules ...rac3r\node_modules`).
  Clean up: `cmd //c rmdir` the junction first, then `git worktree remove --force ../rac3r-wt`; the
  clone's node_modules must still have 77 entries.
- Proofs: `npm run verify`; `node tools/settingscheck.mjs` for switches; `renderhash` (pixels, ~7 min)
  only for drawing changes, `simhash` / `worldhash` for physics / level changes. Reuse saved
  references (`tools/.renderhash` etc.) between changes instead of re-saving on the base. A change
  meant to alter pixels: prove the old path SAME with `RAC3R_QUERY=<switch>=0`, then save new ones.
- Photograph visual changes at 844x390 and 390x844 and look at them before reporting.
- To main: commit, `git push origin HEAD:refs/heads/foreman/<name>`, wait for the `verify` check-run
  (GitHub API `repos/staystale/Rac3r/commits/<sha>/check-runs`), `git push origin HEAD:refs/heads/main`,
  delete the branch, then move the served clone: `git fetch -q origin && git checkout -q --detach
  origin/main`.
- Phone runs: `node tools/phonereport.mjs <report log> --since <UTC time>`; the log path is in the
  owner's README / the test server's start-up.
- Long tools: run in the background, write to a file, poll it. One heavy browser tool at a time
  (6 GB laptop). Stop processes by PID only.
- Long inline text in the Bash tool can fail to parse: write scripts to a file and run them.
- `npm run verify | tail` returns tail's status: `set -o pipefail` before chaining a commit / push.
- Deleting lines: `sed '/pattern/d'` or a node script, not an Edit whose old text starts with a
  newline (it joined lines in CRLF-history files).
- Never edit `src/` in the worktree a proof is running from: the tools load it as they go.
- CI logs: the portable GitHub CLI, `C:/Users/Admin/tools/gh/bin/gh.exe run view <id>
  --log-failed -R staystale/Rac3r` (the anonymous API shows only pass / fail).

## Tools worth knowing

- `tools/tilecost.mjs` (tiles by reason), `tools/framecheck.mjs <level> [query]` (frame times),
  `tools/profile.mjs`, `tools/phonereport.mjs`, `tools/renderhash.mjs` (`--only`, `--shots`),
  `tools/shotdiff.mjs`, `tools/zoomcheck.mjs`, `tools/scratch/carmock.html` (car drawing mockup),
  `tools/edgecheck.mjs` (does the white edge line move rigidly; `--control` = the noise floor),
  `tools/drawload.mjs` (drawing asked per frame, per layer: what Safari paints after our JS).
- Browser tools open the game with `gotoGame` (`tools/lib/browser.mjs`): the game starts by a
  dynamic import, so the page's load event comes before `window.__game`; and Edge 155 never runs
  Playwright's default animation-frame poll under the determinism script (use a timed poll).
  Tools not yet moved to it may read the game too early.
