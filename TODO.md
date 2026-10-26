# RAC3R - open work

New session? Read `CLAUDE.md`, then `NOTES.md`, then this file. Open items only: finished work is in
the git history (this file was swept on 2026-10-19: every finished entry deleted; the owner's
decisions and the measured lessons live in `NOTES.md`). `docs/foreman-handover.md` is the last
handover, written on request.

## Where we are (2026-10-25)

- The plain link is the approved game; the test list is EMPTY. DEFAULT 10-24 / 10-25 (owner
  "all pass"; every switch and old path deleted, each proved SAME against the tested switch):
  highway street lights L4b + the solid grid; traffic seated when woken, the Sandbox puddles,
  meltwater, ice cracks (E); reversing lights; event lighting F; car lamps that flicker then
  settle by damage; wooden marshal huts that smash; hot brake glow (builds over ~3 hard stops,
  handbrake heats the rears, cold again on RESTART / RESET as the tyres); trees D part 1
  (trunk-only solid, canopies over the cars and dark at night, seasons, firs, weather snow).
  Earlier 10-24: A1-A13 fixes, grass G1, mud M1.
- TYPESCRIPT CONVERSION: ON HOLD (owner 10-25); new code is TypeScript, old .js converted later.
- ORDER (owner 10-25): 1 BUSHES (D part 2) - DEFAULT 10-25 (owner: pass); 2 car systems C
  (design + mockup approved 10-25; ROUND 1 - C1 + C2, metal on ground, stingers, highway
  hedges, sparks, crash sparks, flip ramp - DEFAULT 10-25 (owner: all pass); round 2
  C3-C5 DEFAULT 10-25 (owner: pass); C6 oil DEFAULT 10-25 (owner: all pass); C7 debris
  DEFAULT 10-26; C8 post hits, C9 armco dents DEFAULT 10-26; NEXT C10); 3 the wearcheck
  rewrite when C passes.
  Then (owner to order): the driving ROOT
  FIX for real ABS (owner: "abs is needed to be fixed so yes"), AI rework B (design first),
  sound + settings G, Story + upgrades H, new levels (Dieatona), multiplayer I.
- BINNED 10-25 (owner: "park em : bin em"): the HUD text fix (branch experiment/hudtext - its
  remote delete needs the owner's OK in auto mode) and the GPU ground phase C. The 10-04 car
  feedback is out of date (owner): dropped.
- itch.io: build #2201136 (10-24, before the A fixes); push only when the owner says.
- TIDY-UP done 10-24: the hand-placed 'wet' covers staticCovers dropped are deleted from Test
  Track, Grass Track and Stock Car. The Sandbox (a test level) KEEPS its two sample puddles
  (owner; default 10-24).
- CI: `verify` is the gate for main; the `checks` job compares each push with its parent (a
  commit that changes behaviour on purpose fails it by design).
- The laptop has ~6 GB: ONE heavy browser tool at a time; a full renderhash runs in 4 parts.
- Refs (gitignored): rac3r-wt2/tools and rac3r-wt/tools hold .worldhash / .simhash /
  .renderhash saved on main be32466 (renderhash re-saved 10-24 in 4 parts).

## Queue (the owner orders it)

ORDER (owner 10-24): 4 mud M1, 5 grass G1, 3 HUD text fix, 6 highway lamps, THEN the TypeScript
conversion (2). Anything new is written in TypeScript; a .js file a feature changes substantially
is converted first in its own commit, proved SAME, then changed (owner: "1.a is ok").

2. TYPESCRIPT CONVERSION (owner: approved; "wait until I say I'm about to sleep, then do as much
   as you can over night"; after the clean-up, so no dead code is converted): the 57 remaining
   .js files (~14k lines), converted in place with types, proved SAME (worldhash, simhash,
   renderhash) batch by batch: 1 small leaf files (testlist, menu style / widgets, cone
   constants, presets, profile, state), 2 cones, 3 HUD, 4 menus, 5 highway, 6 game flow (loop,
   sim, session, ai, menuflow, controls, rules, order, grid), 7 top level (main, audio, guide,
   stagegen, marks, input, damage, roll, carstats, raceflow, contact, tune). New modules are .ts
   already (NOTES).
3. HUD TEXT FIX - BINNED 10-25 (owner). Measured 10-24: no clear gain on the laptop (bitmap
   stamps slower, the font set once within noise).
4. MUD M1 - DONE, the default 10-24 (world/levelmud.ts, fieldblocks.ts): mud thickens only
   damp (dig.ts wearHolds; 6 dry passes: 0/100 thicken, was 100/100); a level's own mud and thick
   mud get wear cells at an event's start and dry as worn mud does, in patches by the water
   catch; each piece (zone, patch, lane, road sector) steps when all its cells have, which takes
   its sub-cell edge with it; a speck with no cell centre dries on its own timer; pieces put back
   at the next start. Every circuit level dries fully (20 C: ~8 min). Cost: none measured
   (framecheck sandbox alternating on / off: same tiles and frames). OPEN: the HIGHWAY's ploughed
   fields need up to ~15 000 cells loaded (6 fields, 3.4 ha; tools/scratch/_hwplough.mjs) -
   per-cell drying there costs every rebuild (pruneWear walks the cells) and every tile paint
   (render/ground/wear.ts walks the cells); options to the owner. Thick mud road stretches keep
   their white edge lines (road.ts strokeRibbonEdge omits dirt / mud / grass, not thick mud).
   Round 2 (owner 10-24): a piece counts only cells of its own surface (the bowling alley's mud
   lane waited on the thick mud lane next to it: edges 458 s -> 207 s at 30 C) and steps at
   90 % of its cells; worn DIRT goes to mud by a chance falling with heat (25 % at 10 C -> 3 %
   at 40 C) and to gravel by one rising with heat (0 at 25 C -> 25 % at 45 C), damp ground
   towards always mud (dig.ts wornDirtTo); drying mud makes the AI read the grip again.
   APPROVED 10-24 (owner: "all pass", highway too) and the DEFAULT: the switch, the old 25 %
   dry-dirt rule, the HOT weather-kind bake (wet.ts wornTo) and the fixed drying need DELETED.
   Round 3: the HIGHWAY's ploughed fields dry in random blocks (world/fieldblocks.ts: a seeded
   random split, 8-24 blocks a field, each its own timer; zoneAt looks inside a field only):
   a field streams in as dry as the dry spell so far (rain resets it), a dried block drives as
   dirt and is drawn paler (art.ts ploughDry, one GPU patch over the field). Highway 12 km at
   40 C: rebuilds 1.8 ms mean on and off; 412 dried-block samples all drive as dirt.
5. GRASS G1 (approved): short grass told apart from grass (identical today: same art, mu 0.47) -
   a lighter, drier mown look, tighter stripes, no blades, dirt patches ~4 -> 10 % (own random
   stream: existing patches unchanged), mu 0.46, peak a touch earlier, ~20 % less drag; grass
   gets a sparse fine blade layer. Photos first, behind its own switch. DEFAULT (owner: pass,
   10-24): short grass a pale striped lawn (owner: "not different enough" -> option A: base
   #a8bc70, 2.5 m stripes, a dry fleck; extra dirt 6 % on its own stream, blend.ts; mu 0.46,
   peakK 1.15, rough 0.011); grass a sparse layer of fine blades (_grassshots.mjs).
6. HIGHWAY LAMPS L4b (owner: "yes I want them"; street lights ALTERNATING sides, not paired):
   lamps streamed with the road (spawn ahead, cull behind, like highway/litter.js) and a spatial
   grid for the clamp (solidClamp walks every lamp per car per step: fine at ~30 a level, not at
   hundreds). DEFAULT (owner: pass, 10-24; the ?hwlamps switch deleted):
   highway/roadlamps.ts lays one street light every 34 m on alternating sides (each side every
   68 m), 2.5 m off the edge, arm over the edge (the circuits' lamp); a spot not clear (side road
   on the left, slip / bridge / river keep-outs, gantry legs, signs) is left dark. ~55 loaded at
   once; same damage / pools / glows as every lamp. MEASURED (_hwlamps.mjs, 3-4 km per road
   type): gaps 32-36 m, 68 m where one is skipped; 0 posts within 1 m of a solid or 0.5 m of a
   barrier. The SOLID GRID (world/solidgrid.ts, core/cellgrid.ts - the cover index and bump grid
   moved onto the same helper) is ON (identical answers): the highway's solidClamp 4.3 ->
   0.3 us a car-step with ~250 solids, lamps included.

## OWNER LIST 2026-10-24 (digested; ORDER AGREED 10-24 - answers folded in below)

Sizes S / M / L / XL. "Exists" = already in the game, so the item extends it (one system).

A. FIXES AND CHECKS (S-M each; first, they change what is already there)
- A1 Light at dawn / dusk snaps in: blend smoothly through sunrise / sunset colours
  (world/daylight.ts); weather changes gradual too. S-M. DEFAULT (owner: all pass) (10-24): CAUSE - under
  cloud / rain the dark's colour switched from blue-black to the sunset / sunrise colour in one
  step at the golden hour's edge (heavy rain: 26/255 of overlay in one frame; clear: hidden by
  darkness 0). Now blended (< 1/255 a real s in any weather), cloud mutes the glow; rain / snow
  ease in two stages (a shower 0.03 at 2 s, was 0.125). Probes: _skysnap.mjs, _rainease.mjs.
- A2 Head / tail lights shine through bridges: the night layer's beams are cut under decks
  (glow at the edge, never through). S-M. DEFAULT (owner: all pass) (10-24): render/lightdecks.ts; the
  cars' beams / glows rubbed out, the dark put back over bridge / footbridge decks, then the
  lamps' pools (above) - order unchanged with no deck on screen. Gantries (open trusses) pass.
- A3 Rolling / grid starts: cars (the player too) weave oddly, crash before the race starts or
  start off their slot - find the cause (session.js grid / rolling start). S-M. DEFAULT
  (owner: all pass) (10-24): CAUSE - the circuit AI ignored "hold station" (only the highway's used
  it): each AI raced its own line capped at the pace; the player's car was driven to the
  centreline. MEASURED (_rollstart.mjs, both ovals, 5 AI): contact before the green in every run
  (-1.5 m box gap), cars 5 m off their column -> none in 4 runs, closest 3.6 m, all within 1 m
  of their column. ai/formation.ts: one scripted driver per car along its grid column, closing
  on its slot behind the pole. Standing starts were already held (brakes, no steer).
- A4 AI wiggle near the start / finish on the oval and stock car: likely the racing line's seam
  where the lap closes (ai/line.ts). S. MEASURED 10-24: NOT the seam (the ovals' lines are
  smooth where the lap closes; a lone AI never reverses steer there); after lap 1 the line zone
  is no different from the far side (Naffcar swing 3.1 vs 3.7 m, stock car 6.1 vs 6.8 m) - the
  wiggle was the rolling start's release: A3. (Thruston's line HAS a small seam: a 1.385 m
  segment and a turn spike at the last point - _lineseam.mjs; not reported, harmless so far.)
- A5 Mont Brakefade's corner ice does not melt (a generated stage's ice covers, stagegen.js) - and
  owner: weather only, no level-drawn snow / ice / packed snow (scenery water stays). Check one
  system (the cover field). Snow-themed stages then need the weather to be snowy: PROPOSED their
  theme biases the weather odds instead. M. DEFAULT (owner: all pass) (10-24): race tracks and stages
  lose drawn snow / ice (puddles already went with the weather); test levels keep their samples
  (owner); snow stages: road from the seed (tarmac / gravel / dirt, world/stageweather.ts) on
  grass, snow x4 likelier, air -5 C, snow lying deep when cold; every stage layout identical
  (_stagelayout.mjs); scenery water (the forest ford, highway rivers) never dries, can freeze.
- A6 Rain too slippery: damp ground a small grip loss, puddles the real one (less for wet tyres,
  as now); fewer, smaller puddles; water evaporates slowly even in rain. Measure before / after.
  S-M. DEFAULT (owner: all pass) (10-24): MEASURED before: damp tarmac x tyre wet factor left soft
  track tyres 51 % of dry grip; Castle Cum soaked +15-22 % lap time; heavy rain flooded 98 % of
  the race surface. Now damp takes 40 % of the loss (soft tyres 80 %; laps +5-7 %, rain tyres
  still fastest), water rises to a ceiling by rain (heavy 22 %, light 9 % of the surface),
  evaporates at 1/5 rate while raining. Probes: _rainlap.mjs, _coverfield.mjs (RAINGRIP=1).
- A7 Wear faster under wheelspin / locked brakes on EVERY surface (exists for some: slidewear);
  rolling at the normal rate - check each surface's path. S. CHECKED 10-24, no change: every
  surface wears through passCell and a wheel slipping > 4 m/s counts twice (locked 81-93 % of a
  stop, handbrake 100 %, wheelspin the spinning ~30 % of a launch; rolling normal); tarmac /
  concrete have nothing to wear to (_spinwear.mjs). Owner: keep x2. CLOSED.
- A8 Handbrake / harsh braking / sliding heat the rear tyres a little (tyre heat exists). S.
  DEFAULT (owner: all pass) (10-24): a locked axle's slide work x2 into its tyres (it saturated):
  straight handbrake 1.5 s from 54 km/h rears +4.5 -> +9.1 C, fronts +0.6 (= rolling); a
  handbrake TURN fronts +4.8 = cornering work (owner: fronts heat only by turning - they do).
  Hard stops are ABS-capped (not "locked"): fronts +5.5 C already.
- A9 AI on icy starts cannot pull away and get reset: part of B (a traction-limited launch; the
  reset tells "trying, wheels spinning" from "stuck"). S.
- A10 ABS does not behave like real ABS: today it is an ideal limiter (physics/tyres.ts ABS_K caps
  each axle just under grip) - it never pulses, so no staggered marks. Real ABS needs the wheel
  spin speed as real state = the DRIVING "ROOT FIX" below (L, ask first). Then: pulsing,
  staggered marks, steering kept, shorter stops than locked.
- A11 HIGHWAY: PULLING AWAY shows sometimes when you are NOT in first place (owner 10-24). Its
  rule (ai/hwFlow.ts dueKind) is "every rival behind you and off screen"; suspects: a running
  clock surviving GRACE (2 s) after you are passed, a rival missing from the list (wrecked /
  reset), the road distance sOf. Reproduce first, then fix the cause. S. DEFAULT (owner: test
  pass, 10-24):
  CAUSE (scripted, tools/scratch/_pullaway.mjs): a rival with no road frame - reset (one step)
  or off the road - read as -Infinity, behind you; and the 2 s GRACE (meant for CATCH THEM at
  the screen edge) kept PULLING AWAY up after a rival passed. PULLING AWAY while not first:
  passed 2 s, rival crashed ahead 3.25 s, rival reset ahead 2 s -> 0 in all; leading as before.
- A12 TRAFFIC (and maybe the AI everywhere) glitches into a lane: changes lane / shuffles
  sideways into it (owner 10-24). Reproduce and find the cause (highway traffic lane following;
  then check the circuit AI for the same). S-M. DEFAULT (owner: test pass, 10-24): CAUSE (_laneshuffle.mjs, traffic 1.5,
  180 s, undamaged cars): a traffic car handed back from driven to carried - in view too - was
  put straight onto its old lane's line, 1-6 m sideways in one step (3-4 in 3 min; lane-change
  aborts 0-1, not the cause; racing AI is never carried). Now it carries on from where it is, in
  the nearest lane, drifting onto the line at the lane-change speed: 0 handover jumps.
- A13 PUNCTURES too easy, e.g. driving on grass, even on the wrong tyres - real-life balance
  (owner 10-24); more testing suggests HITTING OBJECTS. Today: a burst from heat / wear
  (physics/tyrewear.ts), a hard crash (damage.ts PUNCT_HIT), debris one flat 4 % per hit over
  3 m/s whatever it is (DEBRIS_CHANCE; splinters 1 %). WANTED: a puncture chance PER OBJECT
  KIND by what it is - tyres, tarps, cones ~none; pallets, broken glass, sign posts higher.
  Measure today's puncture sources on a grass run first (which one fires). One table, used
  later by C2 / C7 (glass) and D (bushes). S-M. DEFAULT (owner: pass, 10-24; table approved): CAUSE
  (_puncturehit.mjs) - a hit losing 40 km/h+ punctured ~50 % whatever was hit (the grass ovals'
  tyre walls as concrete); smaller hits never. physics/punctures.ts: the clamps, car contacts
  and loose objects note what was hit; the big-hit chance by kind (tyre walls / bales / cones
  5 %, cars / armco / bins 25-28 %, walls / trees 35 %, posts / signs / pallets 50 %); debris
  runs and pallet nails their own (pallet 15 %, nails 3 %/s). AI runs 6 min: 0 punctures.

B. AI REWORK (L) - architecture to agree first. EXISTS: the racing line, 5 difficulties as a
centre with a spread, personalities (quick / tidy / aggressive / defensive), mistake chance per
corner, wander off the line, racecraft (attack, tow pass, give room, cover), resets.
- B1 One SKILL number per driver (0-1) drives the existing knobs (pace, line use, wander,
  mistakes) and a top-speed loss for low skill (5-10 mph max, through the mods seam). Test
  mode: random, biased by difficulty. Story: by class and event, rising through a class, easing
  at the start of the next; old classes keep their own limits.
- B2 A separate RISK draw per driver (faster entries, later braking, wider lines) - the
  existing aggression made explicit.
- B3 Surface awareness OUT, FELT GRIP IN (proposed): no map of the grip ahead; each driver keeps a
  running sense of grip from what its tyres feel (slip vs force, as a person does) and brakes
  for corners by it, plus seeing a hazard (visible ice / water / snow ahead) with confidence by
  skill. They slide, catch it or crash naturally; they do not crawl. Cheap (one number per car).
- B4 Never wait: if blocked, go round; if not, push through slower; reverse out after a few s;
  reset only when really stuck. Highway racers not lane-bound (traffic stays lane-bound);
  indicators when changing lane (the car lamps exist).
- B5 Dodge objects / barriers / cars / players: one short look-ahead probe on the existing
  spatial grids per car per step (cost measured first).
- B6 Budget: measure the AI's ms per car now (profile) and keep it at or below that.

C. CAR SYSTEMS + DAMAGE (L; one chain - extend damage.ts, no second damage model)
- C1 Car systems state: tyres (pressure, puncture, flat, rim), radiator (water, leak), engine
  (temperature, oil, pressure, brief power loss), drivetrain (grinding). Shown only by what is
  seen / heard: NO written banners (owner rule, see Q2).
- C2 Punctures: a flat that looks flat (bulging, wider), to the rim if driven on (sparks, worse
  grip), drag on that wheel, a sudden pull at the moment it goes, a puff of air / dust (sound
  later). See Q1.
- C3 Radiator + engine temperature: a thermostat holds the engine at its temperature (real
  behaviour); airflow by speed, air temperature, rain, water and mud splashes cool it (hot days
  heat it); a damaged radiator leaks (water left on the track - the tyres' water, one water
  system); it overheats only when the water is nearly gone. Oil leak -> pressure light -> seize.
- C4 Speedo warning lights: engine temperature, oil pressure (greyed on cars without them).
- C5 Exhaust smoke: pretty and minimal, from each car's exhaust spot, more with throttle, more in
  the cold, little or none in the heat; darker puffs / backfire for a power loss.
- C6 Oil from crashes (bigger crash = more likely; spray if it rolls): a NEW cover in the existing
  cover / wear-cell system (not weather): drops like rain, small specks joining into puddles;
  soaked up by sand / gravel / dirt / mud / long grass; slippery on short grass and hard ground;
  never evaporates; oily tyres for 1-5 s after (tyre state); oily marks mildly slippery while on
  them; a black / purple sheen look.
  DEFAULT 10-25 (owner: "all pass"; the ?oil switch deleted). Owner after the mockup
  (claude.ai/artifact/DGC5z9Sjmk38frzgM6Zg9p): too much detail - oil ACTS LIKE WATER (one cover
  in the wear cells, whole cells, no amounts / specks), the agreed slip (~1/3 of dry), drawn LIKE
  ICE BUT PURPLE (pixel sheen); NO oily tyres / marks - instead a puddle driven through spreads a
  little the way the wheel went; water spreads oil 50:50 a second. world/oil.ts (spills,
  generations, drive-through and water spreading), wet.ts oilSurface, glfield kind 5 / OIL_CODE.
  Sources: a cracked sump drips ~20 cells (engineheat.ts), a hit of 0.2+ damage spills 1-4 cells
  (likelier the bigger), a rollover impact 25 %. Soaks into sand, gravel, dirt, mud, thick mud,
  long grass, bushes, traps; never dries, rain never washes it. MEASURED (_oil.mjs, _oilgrip.mjs,
  Castle Cum): oil racetarmac mu 0.350 (dry 1.060); the car on it reads 'oil'; one oil cell in a
  ring of water spread 1 -> 7 in 5 s -> 10 (generations stop it); sump at 25 km/h: 19 cells;
  20 head-on 70 km/h hits spilled 6 times (9 cells); autopilot 90 s through a 9-cell spill
  9 -> 10 (it spreads slightly); 0 page errors. Photos 844x390 / 390x844.
- C7 Debris: a bumper / wing / panel from where the car was hit, in the car's own colours, as a
  contactable object (the cones / props system); glass only from cars with glass: thrown a bit,
  tiny sparkling specks, higher puncture chance, cleared in one pass.
  OWNER ANSWERS 10-25: a part comes off at ~0.3 damage on a corner (~40 km/h), likelier the
  bigger the hit; the car's own look stays as is (dents enough, may revisit); parts STAY all
  race, capped, the OLDEST FADES first; glass "sounds great" - it should change colour /
  sparkle gently as the view moves. PLAN (mockup claude.ai/artifact/EbunhqrdHDfzWT6F5o2KBf,
  APPROVED by the owner 10-25) - DEFAULT 10-26 (owner: "all pass"; the ?debris switch deleted).
  OWNER TWEAKS 10-26 - DEFAULT 10-26 (owner: "pass"; both switches deleted):
  ?glasspop=1 - a glass puncture pops (a burst) 15 % of the time (400 passes: 35 slow + 5 pops;
  off 48 slow, 0 pops); ?oilwear=1 - when oil would spread (driven through, beside water) it
  spreads 75 %, the cell wears away 25 % (50 crash spills x 20 passes: 53 cells, 13 of 50
  originals left; off 100 cells, 50 left). Switch off: simhash SAME.
  MEASURED (_debris.mjs, Castle Cum): 12 hits from 50 km/h (mended between) knocked off 15 parts
  (6 bumpers - one an end - 6 panels, 3 wings) and laid 12 glass cells; 30 parts -> the oldest
  6 faded, 24 left; glass swept by the first tyre over it, the fronts picking up slow leaks
  (59 passes in 12 s: both fronts leaking); 0 page errors; switch off simhash SAME. world/pass.ts
  is the one "wheel making this pass" note (oil's direction, glass's tyre). Built as planned: parts through the wheelSpawn path (damage.ts queue ->
  game/sim.js game.cones.add) as DEBRIS kinds bumper (exists) + new wing / panel with the car's
  paint (cone.col) and trim; a fade on the oldest past the cap (render/objects.ts alpha).
  Glass a wear-cell cover 'glass' like oil (world/oil.ts pattern; GPU field kind 6 with
  camera-dependent glints), thrown round the hit corner, a pass clears it with a puncture
  chance (physics/punctures.ts); no glass from the track car, banger, grass-track car.
  Behind ?debris=1.
- C8 Penetration: small hard objects (lamp posts) hit harder at speed; flat barriers do not.
  MEASURED 10-26 (tools/scratch/_c8measure.mjs, hatch into a Castle Cum street light / a tree):
  the flat rule reads damage off the speed CHANGE, so a street light that snaps (from ~47 km/h,
  the car keeps 65 %) did 1.44 total at 45 km/h but 0.18 at 50 (0.68 at 100); and the spot hit
  was ignored (centre and 0.6 m off identical). OWNER 10-26: P1 one curve by closing speed, the
  post still snaps; P2 damage where it struck - street lights and TREE TRUNKS only (floodlight
  pylons: wide base, flat rule); P3 a post square on the nose hits the radiator harder; no V dent.
  BUILT behind ?posthit=1 (physics/posthit.ts; barriers.ts clampToSolid notes, damage.ts hit
  takes): off-centre hit corner 30 / 50 / 80 km/h = 0.21 / 0.54 / 1.00 (centre: both fronts 0.13
  / 0.32 / 0.69). That is LIGHTER than a wall below ~70 km/h (tree today 50 km/h: 0.78 both
  fronts), so ?posthit=hard counts it as a wall's bounce: hit corner 0.58 / 1.00 / 1.00, never
  lighter than a wall. DEFAULT 10-26 (owner: "=1 seems best"; ?posthit and =hard deleted).
- C9 Armco dents (barrier segments deform). M.
  MEASURED 10-26 (tools/scratch/_c9measure.mjs, hatch into Castle Cum's longest armco run):
  armco was a concrete wall - square on 30 / 50 / 80 km/h = 0.21 / 0.77 / 2.23 total, bounced
  back at ~17 %; it never moved or remembered a hit. OWNER 10-26: softer "but only a bit" and
  dents; very fast hits can tear it; posts / paint scuffs only if easy (not done: the posts
  follow the bowed rail already); the arena's edge fence left out; build, photograph, test.
  BUILT behind ?armcodent=1 (world/armcodent.ts; barriers.ts clamp, fence.ts draws the gaps,
  RESTART straightens: barriers.ts resetTrackside): a hit INTO the rail bows it back (0.04 m per
  m/s over 3 m/s, up to 0.8 m, 3 m each side, points every 0.5 m), a second hit deepens it; one
  that would take it past 1.1 m tears a 4 m gap (square on from ~115 km/h at the rail) and the
  car goes through losing 40 % of its speed into it; bounce 0.2 (a wall's 0.3) and 0.9 of the
  damage. _c9shots.mjs (bare rail, from 3 m): 50 / 80 / 120 km/h = 0.36 m / 0.69 m / torn 4.3 m;
  80 twice 0.79 m; RESTART straight. Damage 30 / 50 / 80 km/h = 0.16 / 0.67 / 2.12, bounce ~12 %.
  DEFAULT 10-26 (owner: "pass"; ?armcodent deleted).
- WATER DRAGGED BY THE TYRES (owner 10-26, a C6 oil tweak): standing water driven through
  spreads as oil does - a 25 % chance a pass; then 50:50 (owner) it runs into the next cell the
  way the wheel went or the cell's water is used up; each spread a generation weaker (3).
  world/waterdrag.ts (wear.ts passCell); DEFAULT 10-26 (owner: "pass"; ?waterspread deleted).
  MEASURED (_waterdrag.mjs, 20 one-cell puddles on Castle Cum tarmac, a wheel down each line a
  round): before - 20 wet to round 2, all cleared at round 3 (3 passes); now - 19 / 20 / 5 / 3 /
  1 / 0 wet, reaching 2 cells (3 m) ahead.
- C10 Open-wheel cars: exposed wheels collide with other cars (today they pass through), can be
  ripped off in a hard hit. M.
- (bushes moved to D, with the trees)
- DESIGN AGREED 10-25 (mockup claude.ai/artifact/BozNYQLMm4FpspU9SsrXAc; answers in NOTES):
  ROUND 1 ?flats=1 - C1 tyre pressure (physics/tyrepressure.ts) replaces the puncture flag's
  effect: a burst (big hit, heat) flat in ~0.5 s with a sharp pull and a puff; debris / nails /
  bush leak over 10-30 s; grip 1 -> 0.7 flat -> 0.45 rim, pull and drag by pressure; ~1 km flat
  (sooner cornering) to the rim. Look progressive by pressure (render/tyrelook.ts), HUD ring
  amber / red / silver, no written PUNCTURE notice under the switch. METAL ON HARD GROUND
  (owner, world/metalscrape.ts): a rim or a rolled body sparks, a rim scores a line, each new
  cell a small chance race tarmac -> tarmac -> broken (concrete, kerbs, Lab left alone).
  DEFAULT 10-25 (owner: pass): the ?flats / ?hedges switches, the car.punct flag (its 0.7 axle
  rule, the pale wheel block, the HUD white ring) and the written PUNCTURE notice DELETED; a
  puncture is a leak (physics/tyrepressure.ts isPunctured). Test list EMPTY.
  STINGER (owner, to test the flats): tyre spikes on the Lab and Test Track (world/stingers.ts).
  HIGHWAY HEDGES (owner 10-25: "highways should have bushes around farmers fields"):
  highway/hedges.ts, one continuous hedge of square bushes round each field's border (owner:
  "can that whole line around the field be a bush"), streamed with the field.
  RIM BY CHANCE (owner: "so all tyres don't degrade at the exact same moment"): a Weibull
  wear-out over the metres run flat - 10 % by ~550 m, half by ~1 km, 90 % by ~1.5 km.
  FIXES 10-25 (owner): wet trails left on dry tarmac - CAUSE: every wheel's mark and spray came
  off car.surface, one sample between the rear wheels (leaving a puddle the fronts laid trail on
  dry tarmac; a puddle under one side gave all four); now each wheel's own ground (wear.ts
  stepWear car.wheelSurf). A lost wheel's tyre reads 0 C (tyreheat.ts), its axle's heat grip
  from the other tyre (tyres.ts axleHeatGrip). SPARKS (owner: "I don't see sparks"; light at
  night; hard ground only): 0.4 m, dense, carried at ~half the car's speed, faded over their own
  life (they were never above 40 % opaque); then (owner: more random, small, fling off and fade)
  0.1-0.2 m flecks flung back and out in a random fan, in bursts, cooling white -> orange; then
  (owner: not seen, more / glow, under the car) drawn on the SCREEN canvas over the road and under
  the cars (in the art buffer every spark was one art pixel), streaks with a halo, the night's
  light map opening the dark along them (no glow patch beside the rim); brake glow off while rolled;
  then (owner: too high quality, slightly too many, fade too even) pixel squares on the art grid
  with a short trail and a dim halo square, ~200 a second from a rim, each its own fade curve +
  flicker; a warm flickering glow per sparking wheel / body in
  the night light map (render/light.ts drawSparkGlows); hard surfaces only (tarmac, race tarmac,
  broken, concrete, kerb, lab floor, wet tarmac). Drawing has its own random stream (fxRandom).
  GLOWS OFF THE BODYWORK (owner): brake glow orange -> deep red the hotter (owner), 0.45 m, centred 0.3 m
  outside the tyre; a rim's spark glow 0.45 m outside its tyre, a sliding body's behind it.
  FLIP RAMP - DEFAULT 10-25 (owner: pass; switch deleted) (owner: an angled armco end that can flip a vehicle, near the Lab's spike
  strip, to test rolling / sliding sparks): world/flipramps.ts (roll.js tripCheck asks it),
  render/flipramps.ts. 5 m x 0.6 m rising to 0.8 m; one side's wheels up it at 7+ m/s roll the car.
  SPARKS while crash rolling too (owner), flung behind the way the car MOVES (sliding / rolling),
  hard ground only (roll.js car.sparks: any roll phase at 3+ m/s on hard ground).
  CRASH SPARKS - DEFAULT 10-25 (owner: all pass; switch deleted; 70 %, over 25 mph, on the way the
  car went into the hit) (owner: big metal-on-metal crashes spark from the impact zone, like
  paint): physics/punctures.ts hitIsMetal (cars, armco, fences, posts, gantries ...), damage.ts
  marks the hit, render/particles.ts throws a burst from the hurt corner (likelier, bigger the
  harder).
  ROUND 2 ?engine=1 - C3 radiator + engine temperature (seizes ~10 s at 130 C), C4 speedo lights
  (every car), C5 exhaust smoke; the grey nose smoke replaced by steam / engine smoke.
  DEFAULT 10-25 (owner: pass; the ?engine switch and the old grey nose smoke of a bent front
  (wreck.smoke, particles.ts DSMOKE) DELETED; lift-off pops near the redline YES): physics/engineheat.ts, hud/enginelights.ts,
  render/enginesmoke.ts. MEASURED
  (tools/scratch/_engine.mjs): a full radiator holds 87-90 C in every case (a flat-out crawl at
  40 C 89.5); cracked, race driving: empty in 240 / 74 / 40 s (hit 0.15 / 0.35 / 0.6), then 105 C
  +20 s, 115 C +34 s, 130 C +73 s, seized +83 s; coasting from 120 C cools (92 C after 5 min);
  sump cracked: oil light at 48 s, seized at 70 s. THE LEAK IS WATER (owner: the same liquid
  as the rain, behaving the same, more the worse the leak): a radiator's water lands as ~60 wear
  cells of the tyres' water (puddles.ts rules: grip, clearing, drying, black ice; the field's
  look), one every ~23 m at race pace for a fast leak, ~140 m for a slow one; pools when
  stopped. Real game (_engineshots.mjs, Castle Cum autopilot, fast leak): empty 40 s, 115 C
  100 s, seized 172 s; an AI seized, reset and came back mended; 0 page errors.. NEXT: C6 oil (design first).

D. TREES, BUSHES + SEASONS (M). BUSHES: pass-through, heavy drag, wear to long grass, minor
damage by chance (less with speed), a fairly high puncture chance (needs C2). TREES: canopy
drawn ABOVE cars (drive under), only the trunk solid; leaves change
colour / fall with the global season (bare in deep winter); evergreens / firs keep theirs; a few
tree types; snow settles on trees from the weather, not level art.

E. SURFACES (S-M each): gravel -> sand by chance when dry, more when hot (the dig rules); ice
cracks when driven (semi-random, spreading over connected ice; cracked ice melts and wears
faster); snow / ice / packed snow melt to water with a chance by surface (check what exists).
GRAVEL -> SAND DEFAULT (owner: all pass) (10-24, world/dig.ts): a dry pass 2 % at 15 C and below to
10 % at 40 C (damp sand still turns back to gravel at 10 %).
DEFAULT 10-24 (owner: "all pass"; switches deleted; owner answers: cracked ice MORE grip and degrades faster; melt = the weather
melting ice and snow should leave water):
- MELTWATER (coverfield.ts, weather.ts setMeltSoak). CAUSE (_meltwater.mjs, Castle Cum, a
  full coat in a dry spell): drying ran with the melt and ate it - snow left 0-3 % of the
  surface wet, ice at 5 C none. Now all meltwater stays, a melting coat dries as slowly as rain
  and runs off above heavy rain's ceiling, the track's damp rises as in a 0.25 drizzle while it
  melts: snow / ice leave water on ~22 % (heavy rain's), damp 0.88-1.0, dry off after.
- ICE CRACKS (world/icecrack.ts; glfield codes 11-14): a pass cracks ice 0.08 (-15 C) .. 0.2
  (0 C) x 0.5-1.5; a cell from crack 0.35 spreads to a neighbour at 0.6 of its crack (stops ~3
  cells, 4.8 m out: _icecrack.mjs); grip x1.5 at a full crack (mu 0.12 -> 0.18); breaks through
  in 2 passes not 4, chance x2, scrubs in half the slide, melts x2. MEASURED 12 passes on the
  Lab sheet: 0 C line ice left 21/27 off -> 3/27 on; 3 C 7/27 -> 0/27; -5 C no break either way.
  Fixed ice (frozen scenery water) does not crack. Photos: _icecrackshots.mjs.

F. LIGHTING (M): circuits and rallycross lit (public-road stages street lights; closed stages
none); event lighting at starts / finishes / busy corners; floodlights off the racing line with a
ring of tyres (e.g. inside Knobhill's top-left corner). IDEAS for the owner: festoon / fairy
lights on grandstands and marquees, pit-lane lamps, glowing marshal posts, lit advertising
boards, a start-gantry light bar, warm caravan windows in camping areas. Damaged lights:
flicker, then by chance (by damage) recover or die.
OWNER PICKS 10-25 (mockup claude.ai/artifact/D6k1bE4NDseZdr27dZBuCM): F1 corner floodlights on a
ring of tyres - drawn with the EXISTING tyre-stack and floodlight-pylon art (mockup was "a bit
off"); F2 start gantry light bar AND the start lights glowing; F3 festoon lights MULTI-COLOURED;
F5 marshal post beacons YES and the marshal boxes WOODEN and DESTRUCTIBLE; F6 boards BACKLIT;
F7 caravans: top-down, so NO visible windows - light spilling out round the sides only; F8
knocked lights flicker then recover or die: yes; F9 street lights on generated stages that pass
buildings, Sweaty Lamb / Killder stay dark: yes. F4 pit-lane lamps: yes. Owner added: rally
stages get multi-coloured fairy lights too; HOT BRAKE GLOW (Q9) next.
DEFAULT 10-25 (owner: all pass; fairy lights moved off the road, board halo faint - owner
note: trees glowing near boards is the tree layering, fixed with the trees rework D; switch
deleted): render/eventglows.ts
(boards, marshal beacons, festoons, gantry bar + start lights, pits, caravans, stage fairy
lights), world/lampplan.ts (corner floodlights + tyre rings via cones.js, villages, fairy
strings), world/lamps.ts settleLamp (3-8 s, dies 15 % + 70 % of lost light). Photos:
_eventlightshots.mjs. Switch off: simhash SAME. TO DO after: F5b WOODEN marshal boxes,
destructible (?woodmarshal=1).
ROUND 2 DEFAULT 10-25 (owner: all pass; switches deleted): car lamps (render/carlamps.ts: a
hit flickers 3-8 s, then steady or dead by damage), wooden marshal huts (world/marshalbox.ts:
smash at 8 m/s, pallets thrown, beacon out), hot brakes (render/brakeglow.ts: heat builds over
~3 hard stops; the handbrake heats the rears; cold again on a reset, as the tyres), trees
(world/treetrunks.ts trunk-only solid; render/trees.ts seasons, firs, weather snow, canopies
overhead and dark at night). TS conversion ON HOLD.
BUSHES (D part 2) DEFAULT 10-25 (owner: pass; the ?bushes switch deleted): the 'bush' surface
(surfaces.ts: brush drag ~ speed, physics/tyres.ts; mu 0.48, brush 2.6, plough 0.8), laid as
square ground patches by world/bushplan.ts from each level's plan (world/levels/bushes.ts: rally
close to the road, rallycross off the verges, circuits well back + at the foot of trees,
sample beds on the test
levels), flattened to long grass by passes (wear.ts BASE_WEAR); a wheel entering a bush cell may
puncture (0.8 %) or dent that corner by speed (world/bushes.ts, damage.ts bushScratch). Look
(owner: square pixel art like the trees, own shades of green): art.ts addBushLooks (holly, olive
gorse, blue-green; their colours are in the tiles' palette), ground/bushes.ts.
Round 2 (owner): drag 2.6, a light dent, puncture 0.8 %; leaf TUFTS drawn over the cars
(render/bushtufts.ts, the overhead pass under the canopies; gone where the bush is flattened).
MEASURED (_bushes.mjs): a clump costs 21-35 km/h more than grass at 54-126 km/h. Levels: Castle
Cum, Brands Snatch GP / Indy, Knobhill, Killder, Sweaty Lamb, the forest and alpine stages (set
+ generated), Lab, Rough Patch, Test Track, Sandbox. Not on snow / desert themes, ovals or the
highway.

G. SOUND + SETTINGS (M): pause menu SOUND sub-menu (car, environment, radio channel, menu: each a
volume + mute); a SETTINGS screen off the main menu with the same and the GENERAL DIFFICULTY;
TEST MODE's difficulty applies to that event only; the main difficulty (settings) is for Story.
BANNERS (owner): an option in settings; the difficulty sets its default (on for easy, fewer on
hard, forced OFF on the hardest), changeable without changing difficulty; TEST MODE may change
it for the event. SLAVE FM: the owner's own project on the laptop (read it, NEVER change it);
stream at slaveFM.duckdns.org. SOUNDS: consult the owner on every sound before building it,
and a test to approve - no running ahead.

H. UPGRADES + GARAGE + TYRE PRESSURE (XL, with Story mode): every car's today = level 5 of 10;
level 1 near scrap (worn, issues likely). Engine (top speed, acceleration, heat / seize
resistance), Body (every damage and puncture chance; trim colour above 5), Drivetrain
(acceleration, shift speed, grinding chance), Suspension (usable grip; how much the ground steers
you), Quality (random faults: punctures, leaks, 1-30 s power losses with smoke). Tyre pressure in
the garage. New garage screens. Needs C first (the systems it upgrades). Percentages: proposed
after measuring today's chances (Q8).

I. MULTIPLAYER (XL): possible on the web now - WebRTC works in Safari and inside an iPhone app
wrapper, so it is built once. Needs a small signalling server (room codes) and a relay for strict
networks; one phone hosts the race (best connection, measured in the lobby), the others send
inputs and get the cars back. A SPIKE (two phones on the tunnel) before committing.

ANSWERED 10-24: Q1 drag, yes. Q2 banners = a setting (above). Q3 yes. Q4 felt grip yes. Q5
above. Q6 = A3. Q7 TypeScript conversion first, yes. Q8 later, with numbers. Q9 all four ideas
and the lighting ideas approved (to build in their groups). Multiplayer: no rush; talk it through
in detail when we get there. Upgrades: questions as we go, approval first.
THE QUESTIONS AS ASKED: Q1 at the puncture "increase grip drastically" - did you mean drag (a puncture
loses grip)? Q2 no banners: also WRONG WAY / OFF THE MOTORWAY / reset messages, or only events
like weather and punctures? Q3 OK that snow stages are snowy only by weather (theme biases it)?
Q4 OK with felt grip for the AI (B3)? Q5 Slave FM: the stream's address and format, and can a
web page play it (permission / CORS)? Q6 rolling / grid starts: what goes wrong, where? Q7
order: the TypeScript conversion BEFORE the AI rework and C (they rewrite the same .js files)?
Q8 upgrade percentages after measuring today's. Q9 the other non-clutter ideas to approve:
brake discs glowing when hot (night), steam from a leaking / hot radiator, mud and dust building
up on the car body, a wet sheen on cars in rain.

ORDER (agreed 10-24): 1 mud default + clean-up (now) -> 2 A fixes (S each, one test link) -> 3 grass
G1, HUD fix, highway lamps L4b (queued) -> 4 TypeScript conversion (overnight) -> 5 B AI rework
-> 6 C car systems (C1-C5, then C6-C10) -> 7 E surfaces + D trees and bushes -> 8 F lighting -> 9 G sound /
settings -> 10 H upgrades with Story mode -> 11 I multiplayer (spike earlier, to keep the sim
ready for it).

## Parked (owner)

- Judder: the held frames are Safari's (NOTES); owner: "ignore judder, it's ok atm". Before
  itch: a screen recording from the home-screen app.
- itch.io: pushed 10-24 (build #2201136); push again only when the owner says. The PAGE PICTURES
  are ready but not uploaded (owner: another time): GamesStudio/ready-to-play/rac3r-page-2026-10-24
  (cover 630x500 + 8 shots); upload on the edit page (by hand, or via Claude in Chrome).
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

DRIVING (ask before starting; re-measure first, these are old):
- [ ] THE ROOT FIX: wheel angular velocity as real state (the rolling and sliding tyre laws
  disagreed ~2.8x at breakaway; ENGINE.md has the two reverted attempts). WANTED (owner 10-25:
  "abs is needed to be fixed so yes"): it makes real ABS possible (A10). Plan first, then build.
- [ ] Threshold braking regressed (full pedal optimal again; brake force wants ~1.7 g).
- [ ] Naffcar V8 failed the lap driver on its own track (12.7 s off the road).
- [ ] Tyre marks (rubber) adding grip on the racing line; cross-surface contamination (mud carried
  onto tarmac). Not built - ASK if wanted.

## Tools that are wrong

- [ ] `tools/wearcheck.mjs` is STALE, not just 3c (10-24: 13 FAILs): it still checks the old
  rules the owner has since changed (snow packs to ice at pass 4, puddles churn to mud, mud
  thickens dry) and its "surfaces without graphics" lists every surface (a broken lookup).
  Rewrite it to today's rules (S-M) - asked the owner.
- FIXED 10-24 (small-fixes round; traffic seat DEFAULT, owner "all pass"): `treadmillcheck` (the 2 "litter in a lane" were
  a field's cows with no road segment near them: a checker bug); `trafficcheck` (a REAL bug: a
  carried traffic car woken to physics kept its suspension height - woken on a hill 4.4 m up it
  was thrown 42 m into the air and drifted off the road; now seated as a reset is,
  ai/trafficPhys.ts); `hwracecheck` passes; `wobblecheck` (drives by ?autopilot=1, opens the game
  with gotoGame); `?autopilot=1` no longer throws on the Lab (no driver without a track).
- FIXED 10-24 (a bug, no switch): the Lab's own ice sheet, snow patch and puddle were WIPED at
  boot - the highway's first road build handed its river covers to the active level (the Lab:
  puddles.ts adoptRoadCovers); now to the highway level (_labcovers.mjs: 0 -> 3 covers).

## Owner specs

- `docs/specs/levels-events.md` - Levels and events (owner spec dump)
- `docs/specs/roadmap-2026-10-03.md` - Roadmap (digest of SPECS-2026-10-03.md)
- `docs/specs/surface-evolution.md` - Surface evolution (owner spec)
- `docs/specs/master-backlog.md` - Master backlog (triaged owner list)
- `SPECS-2026-10-03.md`, `BRIEF.md` - the owner's original specs
