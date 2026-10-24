# RAC3R - open work

New session? Read `CLAUDE.md`, then `NOTES.md`, then this file. Open items only: finished work is in
the git history (this file was swept on 2026-10-19: every finished entry deleted; the owner's
decisions and the measured lessons live in `NOTES.md`). `docs/foreman-handover.md` is the last
handover, written on request.

## Where we are (2026-10-24 evening)

- The plain link is the approved game. UNDER TEST: A13 ?punctkind=1, G1 ?shortgrass=1,
  ?grassblades=1. A11, A12, the A fixes DEFAULT
  (owner 10-24: "all pass"; switches and old paths deleted): A1 sky blend, A2 bridge decks, A3
  formation (A4 with it), A5 weather only, A6 rain grip, A8 lock heat, E gravel -> sand. A7
  needed no change (owner: keep x2). ORDER (owner 10-24): A12, A13, then grass G1, the HUD
  text fix, highway lamps L4b, then the TypeScript conversion (overnight).
- itch.io: build #2201136 (10-24, before the A fixes); push only when the owner says.
- TIDY-UP noted: race levels still carry hand-placed 'wet' covers that staticCovers drops (the
  weather lays puddles): Test Track, Grass Track, Stock Car - delete the data (one system).
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
3. HUD TEXT FIX (approved; owner: "make sure it makes it better not worse"): the HUD text is
   redrawn every frame (~3.5 % of our time on the laptop profile) - draw it only when it changes.
   Measure first and after (laptop profile; a back-to-back phone ?report=1 A/B); default only if
   it is better.
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
   gets a sparse fine blade layer. Photos first, behind its own switch. BUILT 10-24 (world/
   grasslook.ts): ?shortgrass=1 (base #93a96a, stripes 2 m, a dry fleck; extra dirt 6 % on its
   own stream, blend.ts; mu 0.46, peakK 1.15, rough 0.011) and ?grassblades=1 (sparse fine
   blades); photos sent (_grassshots.mjs). Off: worldhash, simhash, renderhash shard 2 SAME.
6. HIGHWAY LAMPS L4b (owner: "yes I want them"; street lights ALTERNATING sides, not paired):
   lamps streamed with the road (spawn ahead, cull behind, like highway/litter.js) and a spatial
   grid for the clamp (solidClamp walks every lamp per car per step: fine at ~30 a level, not at
   hundreds).

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
  (physics/tyrewear.ts), a hard crash (damage.js PUNCT_HIT), debris one flat 4 % per hit over
  3 m/s whatever it is (DEBRIS_CHANCE; splinters 1 %). WANTED: a puncture chance PER OBJECT
  KIND by what it is - tyres, tarps, cones ~none; pallets, broken glass, sign posts higher.
  Measure today's puncture sources on a grass run first (which one fires). One table, used
  later by C2 / C7 (glass) and D (bushes). S-M. BUILT ?punctkind=1 (10-24, table approved): CAUSE
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

C. CAR SYSTEMS + DAMAGE (L; one chain - extend damage.js, no second damage model)
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
- C7 Debris: a bumper / wing / panel from where the car was hit, in the car's own colours, as a
  contactable object (the cones / props system); glass only from cars with glass: thrown a bit,
  tiny sparkling specks, higher puncture chance, cleared in one pass.
- C8 Penetration: small hard objects (lamp posts) hit harder at speed; flat barriers do not.
- C9 Armco dents (barrier segments deform). M.
- C10 Open-wheel cars: exposed wheels collide with other cars (today they pass through), can be
  ripped off in a hard hit. M.
- (bushes moved to D, with the trees)

D. TREES, BUSHES + SEASONS (M). BUSHES: pass-through, heavy drag, wear to long grass, minor
damage by chance (less with speed), a fairly high puncture chance (needs C2). TREES: canopy
drawn ABOVE cars (drive under), only the trunk solid; leaves change
colour / fall with the global season (bare in deep winter); evergreens / firs keep theirs; a few
tree types; snow settles on trees from the weather, not level art.

E. SURFACES (S-M each): gravel -> sand by chance when dry, more when hot (the dig rules); ice
cracks when driven (semi-random, spreading over connected ice; cracked ice melts and wears
faster); snow / ice / packed snow melt to water with a chance by surface (check what exists).
GRAVEL -> SAND DEFAULT (owner: all pass) (10-24, world/dig.ts): a dry pass 2 % at 15 C and below to
10 % at 40 C (damp sand still turns back to gravel at 10 %). The rest of E still open.

F. LIGHTING (M): circuits and rallycross lit (public-road stages street lights; closed stages
none); event lighting at starts / finishes / busy corners; floodlights off the racing line with a
ring of tyres (e.g. inside Knobhill's top-left corner). IDEAS for the owner: festoon / fairy
lights on grandstands and marquees, pit-lane lamps, glowing marshal posts, lit advertising
boards, a start-gantry light bar, warm caravan windows in camping areas. Damaged lights:
flicker, then by chance (by damage) recover or die.

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
- [ ] `?autopilot=1` throws "reading 'pts'" on a level with no track (the Lab the game boots on)
  before a level is launched (seen 10-24 taking the itch shots, tools/scratch/_itchshots.mjs).

## Owner specs

- `docs/specs/levels-events.md` - Levels and events (owner spec dump)
- `docs/specs/roadmap-2026-10-03.md` - Roadmap (digest of SPECS-2026-10-03.md)
- `docs/specs/surface-evolution.md` - Surface evolution (owner spec)
- `docs/specs/master-backlog.md` - Master backlog (triaged owner list)
- `SPECS-2026-10-03.md`, `BRIEF.md` - the owner's original specs
