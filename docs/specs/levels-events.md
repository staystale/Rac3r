# Levels and events (owner spec dump)

Moved here verbatim from TODO.md; open items are listed in TODO.md.

## LEVELS + EVENTS DUMP (user, 2026-10-04, after the garage) — "we need more cars and levels and events, let's focus on levels and events"
- RALLY STAGES are LOOPS ("circular often"): they should mostly be a LINE (point to point), some loops OK.  -> OPEN ROADS (engine) FIRST
- Championships later. GYMKHANA. POLICE GETAWAY / CHASE: a long cliff-side road or MOTORWAY, basic TRAFFIC AI, a getaway car + a
  police car (play as either; switchable in test mode); the police car = a fast real police car on semi all-terrain tyres as standard.
- BANGERS, CARAVAN BANGERS, PARK-ON-THE-TRAILER events. RALLYCROSS stages with TUNNELS and/or JUMPS.
- CONE BOWLING (hit cones like bowling). DAMAGE HIGH-SCORE events (old Burnout crash mode).
- TIME TRIALS + DRIVING CHALLENGES, basic -> hard levels. PARKING games / exercises.
- MONSTER TRUCKS + races, TROPHY TRUCKS, PICK-UPS, PARIS-DAKAR-like rallies.
- a MONACO-like F1 street track; a NUERBURGRING (time trial + races, F1 if they do that).
- STADIUM rallycross + truck tracks; OFF-ROAD races of all sorts (layouts + terrain vary); a few stadiums.
BUILD ORDER (Claude, 2026-10-04; user: "levels and events first", "make sure that gets committed to the todo"):
  1 [x] OPEN ROADS (done 2026-10-04: ghost segment, STAGE GENERATOR, 8 SET STAGES — ENGINE.md). OPEN: Rally AI off on 3 set stages;
        loose-object count perf on phones; bigger worlds (step 2).
  1 [~] was: point-to-point stages (a GHOST return segment inside the loop: not drawn / not road / not in querySubtrack, so
        start line, grid, timing, lineRun all stay d=0) + barriers at the stop-zone end. Then NEW LINEAR STAGES (tarmac mountain
        hairpins Monte-style; fast Finnish gravel with crests/jumps; a Dakar-style long desert stage later).
        PROCEDURAL (user, 2026-10-04: "make it procedural maybe for these levels so it feels infinite"): a seeded STAGE GENERATOR —
        NEW STAGE each run or replay a seed; length / surface / difficulty options. True ENDLESS streaming road: with the police chase.
        USER (2026-10-04, later): "RALLY STAGES SHOULD BE SET, but other events might need a procedural track" -> the generator is a
        DESIGN TOOL for rally: curated FIXED-SEED stages registered as normal levels (2 per theme); procedural runtime roads only for
        other events (chase, endless, time-trial variety).
        WORLD SIZE: every level lives in the fixed FLOOR 260 m box (fence at 302) — why stages were loops. Step 1 = generated stages
        wind INSIDE the box (point to point, no road back). Step 2 (Dakar, chase, motorway) = per-level world size (FLOOR / FENCE live
        bindings; marks.js MARK_EXTENT layer + render base fill + cones clamp + groundAt runoff + trackKit clear all read it).
  1b [x] HIGHWAY TO HULL (2026-10-05, ENGINE.md): ENDLESS motorway, solo. OPEN: VS AI / traffic (with the police chase), a road-map
        menu thumbnail, phone check on a real device.
  1c [ ] HIGHWAY v2 — THE TREADMILL (user spec, 2026-10-05, verbatim intent): "act like a treadmill — procedural with changing turns and
        terrain / slip roads off etc., but it should always line up nicely to the previous section and keep a smooth drivable flowing
        track; sections spawn AHEAD and vanish BEHIND (always OFF SCREEN); the pace of the treadmill is the player's car, so it can
        NEVER drive off the screen; going BACKWARDS should RESET you; TOP TO BOTTOM on mobile AND PC (the car heads up the screen),
        feels like a real motorway; dumb, slightly SLOW TRAFFIC, RECYCLED when overtaken and off screen (vehicle randomised and moved
        to the front, or replaced — whichever is most efficient)."
        STATE BEFORE (photographed 2026-10-05, shots/look/hw-before-*.png): the v1 road wanders in any direction (diagonal in portrait,
        sideways in landscape), camera = the normal lead + speed zoom, no traffic, no slip roads, curvature steps 0 -> 1/R (no easing).
        Measured: highwaycheck 5 km 0.0 s off, worst rebuild 7.7 ms, props <= 247.
        DECISIONS (user, 2026-10-05): CAMERA STAYS FIXED / UPRIGHT as now (the car turns, not the world); the road heads UP the
          screen and "we can probably go more extreme on the angle but it should VARY obviously" -> proposed: up to ~±60 deg off
          straight-up (still always climbing the screen, so it cannot cross itself), mixing long straights, sweepers and S-bends.
          APPROVED (user, 2026-10-05: "yes sounds great"): build in this ORDER, the user tests between steps —
          1c.1 [x] (2026-10-05, LIVE, awaiting the phone verdict — ENGINE.md "HIGHWAY v2"; treadmillcheck ALL OK, treadmillshots:
                   car held at 50-70 % W / 67-76 % H in portrait + landscape at 213 km/h, WRONG WAY notice fires, no page errors)
                   ROAD + CAMERA + BACKWARDS: road heads UP the screen (±60 deg, eased curvature so every section joins the last
                   exactly: tangent AND curvature continuous), built ahead / dropped behind OFF SCREEN; camera pins the car LOW on
                   the screen (more road ahead); BACKWARDS = auto reset into the left lane (shown on the HUD — never unexplained).
                   LANE WIDTH + LANE COUNT per level config (wide US motorway <-> skinny dual carriageway).
          1c.2 [ ] SLIP ROADS: off-slips peel away left and leave the screen (drivable, they end -> reset); on-slips merge in.
          1c.3 [ ] TRAFFIC: fixed pool ~10, dumb + slightly slow (90-110 km/h), lane keeping, rare lane change, brakes for the car
                   ahead, shuntable; overtaken + well off the bottom -> moved ahead off the top as a new random vehicle.
          FEEDBACK on 1c.1 (user, 2026-10-05, phone): "ok feels good". BUGS: [x] "it always aims diagonally LEFT — it should go
            left AND right and VARY" (target lean alternating sides; headingcheck); [x] going WIDE: "be wider / have a TIMER so you have
            a chance to return" (8 m -> 6 s countdown, 70 m hard); [x] "how do I test the lane presets" -> ROAD TYPE row in Test Mode
            setup; [x] WALLED preset. [x] GRID STARTS fixed (ENGINE.md "START GRIDS"). All awaiting the phone verdict.
          SPEC (user, 2026-10-05, later): "as it's OPEN SIDED, be LITTERED with TYRES and CONES and have appropriate CHEVRON signs
            for the corners (these already exist)" -> [x] BUILT, awaiting phone test (ENGINE.md "LOOSE ROADSIDE"). Open presets only (walled has walls): chevrons on the outside of bends,
            loose tyres / cones / tyre stacks by the verges, knockable, recycled with the road window.
          SPEC (user, same message):
            - "some levels that use this infinite highway mechanic should be more WALLED IN" (continuous walls / armco: preset flag).
            - TRAFFIC TOGGLEABLE in Test Mode for this level / level type, like the AI count is.
            - TRAFFIC = CRASHABLE cars WITH DAMAGE; NOT racing, just driving; GENTLY AVOIDING; LANE CHANGING.
            - VS AI on the highway (Test Mode) = a normal ROLLING-START race.
            - BUG?: "check GRID STARTS — I think they're wonky / place the player TOO CLOSE to other cars / not in a grid formation".
            - RACE END (highway): an AI reaching the EDGE OF THE SCREEN ahead (what is visible differs PC / phone) starts a COUNTDOWN
              (5-10 s); if it ends and you have not caught up -> race ends, POSITIONS shown. You get so far ahead the AI go off screen
              BEHIND -> countdown; when it ends YOU WIN.
          SCENERY (user, same message): use the EXISTING scenery tools + props (trackKit, props, barriers ...); build new ones where
            needed: WATER-FILLED BARRELS (crash barrels at slip-road gores), DENTING ARMCO.
          REUSE (user): the mechanic will drive other FLAVOUR levels (a CANYON road etc.) -> the generator takes a config (lanes, lane
            width, angle limit, radii, scenery, traffic). ONCOMING traffic only where it is COLLIDABLE (e.g. a single carriageway
            canyon road); a motorway has none (the other carriageway is not modelled). "Be logical or ask if unsure."
          LOOSE ROADSIDE VERDICT (user, 2026-10-05 late): "test is okay".
          ANSWER on traffic in VS AI (user, 2026-10-05 late): "A. traffic in every mode and a SLIDER in test mode for DENSITY".
          SPEC (user, 2026-10-05 late, verbatim): "levels feel a bit BASIC and UNPRETTY, no SLIP ROADS TO NOWHERE etc... maybe BIG
            BRIDGES too, 3 TYPES for different level types: a WALLED highway version, a normal MOTORWAY/INTERSTATE version, and a more
            COUNTRYSIDE smaller FOOT BRIDGE like thing; GANTRYS should have SPEED CAMERAS that FLASH... your SPEED IF CAUGHT should show
            in your HUD TOP RIGHT (this will be used later for MISSIONS and ACHIEVEMENTS)". NOT STARTED — questions asked first:
            [ ] 1c.4 PRETTIER ROADSIDE (what "basic / unpretty" means — asked)   [ ] 1c.2 SLIP ROADS "to nowhere" (already queued)
            [ ] 1c.5 BRIDGES x3 by road type (walled / motorway-interstate / countryside footbridge)
            [ ] 1c.6 SPEED CAMERAS on gantries: flash + "CAUGHT 187 km/h" in the HUD top right, stored for missions / achievements later
            [ ] ROADSIDE DEBRIS (user, same evening, verbatim): "remember objects / debris at road side, PALLETS, CARDBOARD BOXES, etc"
                -> NEW knockable cones.js kinds (none exist yet: today = cone, tyre, tyrestack, chevron, flag, bale, banger, caravan).
          DECISIONS (user, 2026-10-05 late, answering the 6 questions; "great proceed"):
            1 MENU: categories = a BIG LIST; Grass Track goes in OVALS.
            2 PRETTIER: "ideally all of that sounds great" (hedgerows/fields/gates, embankments/cuttings, central reservation,
              cat's eyes/rumble strips, lay-bys/phones, services, distant villages/farms, rivers).
            3 BRIDGES = the MOTORWAY CROSSING another road, RIVERS, RAILWAYS ("no trains, just basic pretty stuff") + "subtle weirder
              cheeky stuff if you can think of any good subtle things, slip them in".
            4 SPEED CAMERAS: OVER THE LIMIT ONLY, 70 mph. HUD: you got caught, your speed, and a FINE (-$) that grows the faster
              you were over.
            5 DEBRIS: the list is fine; some should BREAK or become DRIVE-OVERABLE after a hit or two, as logic says per object.
              "I didn't see any objects like those at road side sadly, I want to see some, they should be RANDOM and also have a
              SLIDER for FREQUENCY / DENSITY".
            6 ORDER agreed: menu -> traffic + slider -> VS AI highway race -> slip roads + bridges -> speed cameras -> debris + pretty.
          FEEDBACK (user, 2026-10-05 night, after the first highway VS AI build):
            - "ai on highways should IGNORE LANES and go FAST DODGING TRAFFIC and WEAVING thru like the player would"
            - "RULES to events should be EXPLAINED the FIRST TIME you do them, and shown WALK THRU style, if needed"
            - "PODIUM looks BROKEN, just use normal TOP DOWN cars"
            - "continue in the agreed order and THEN work on making AI RACERS FASTER"
            TEST NOTE (user, 2026-10-06, on the weaver): "ai doesnt seem like it races enough on infinite highway slow, waits doesnt weave around traffic" -> FIRST (HANDOVER.md 3: low corner cap, brakes far under traffic speed, rarely swerves when boxed; add a PACE metric first).
              [~] 2026-10-06 (later): PACE METRIC BUILT (hwracecheck prints per-racer pace + what limits it; new 5th arg = seed). NO AI CHANGE
                  SHIPPED YET — live behaviour identical (default path re-measured byte-identical). MEASURED (motorway, traffic 100 %, 45-60 s):
                  mean 114-150 km/h, 17-50 % of time < 130; a racer is speed-limited by FOLLOWING 12-72 % of the time and in that time an open
                  line 2.5 m+ across exists only 0-38 %; the corner cap is NOT it (limits < 3 % of the time; kC 0.42 = identical numbers).
                  Free road: TURN FEATHERING caps the throttle 63-96 % of the time (empty road mean 183 / 200 / 209 km/h, d0 / d2 / d4).
                  Leads tested via HWT env knobs (node only): aB 0.55 (follow closer) = +9 km/h mean over 9 runs but MIXED per seed (2 of 9
                  pile-ups vs 3 of 9 base); aB 0.6+ / speed floor 0.85 B.v = pile-ups (racer-racer). Stepped long swerves: mixed. BASELINE ITSELF
                  FAILS "stay on road" on seeds 77 + 1234 (only 4242 was ever tested) — rear-end pile-ups between racers, spins at the edge.
                  -> asking the user which way (HANDOVER 3).
                  USER (2026-10-06): "a/b - and are bridges / sliproads working yet ?" -> A (fix racer-racer pile-ups / off-road on seeds
                  77 + 1234) THEN B (weave more: follow closer, plan by where gaps will be, longer swerves), A/B'd over 9 races. Answer to the
                  question: slip roads + bridges are NOT built (1c.2 / 1c.5 still [ ]; next in the order after this).
              [x] A — THE MIRROR (2026-10-06, LIVE, awaiting the phone verdict): CAUSE (traced, seeds 77 / 1234 / 555) = the weaver only
                  looked AHEAD: it swerved into the line of a racer coming up 18 m behind at +30 km/h, the one behind braked hard and both
                  spun off. Now a faster car closing from behind (arriving < 2.5 s) blocks the lines it is on, and a swerve under way is
                  ABORTED when one closes on that side. MEASURED tools/pacesuite.mjs (NEW: 3 seeds x d0/d2/d4, traffic 100 %), 18 races:
                  bad runs 7 -> 2, off-road car-steps 13079 -> 4006, mean 126.7 -> 133.4 km/h, under-130 44 -> 40 %. weavecheck d0/d2/d4
                  unchanged (0 hits / 0 spins). dual + interstate ALL OK. HONEST: racer-racer contact steps 757 -> 864 (more rubbing that
                  stays on the road; seed 31 Mobile 92 -> 306); still BAD: seed 1234 Real (pile-up), seed 555 Real (racer spun avoiding a
                  car that cut in from the right). Real game: no page errors.
              FEEDBACK on A (user, 2026-10-06, verbatim): "ok they seem slow, maybe even worse - make them faster and just try n handle it...
                  - b n then briges ect, catch them timer should be longer on highway, also it should be a bit soft if you've nearly caught up
                  drop the timer... but let them getaway if the player isnt trying ya know, winning is ok atm , also the off road timer hsould
                  be longer / turn off if youre close to the road (about to get back)"
                  -> [ ] CATCH THEM: longer; soft (nearly caught up / closing = timer held + refills); still runs out if you're not trying.
                  -> [ ] OFF-ROAD timer: longer; paused while you're close to the road edge. (PULLING AWAY / winning: leave as is.)
                  -> [ ] B (below): FASTER, freedom given ("just try n handle it"). Then slip roads + bridges etc.
                  USER (2026-10-06, mid-B, verbatim): "ai should go off road to dodge if its quicker, just not too far obviously, ai should
                  feel like they are racing not on a sunday drive..." -> [ ] DODGE OFF-ROAD: lines a little past the edge (verge) allowed when
                  the road is blocked and it is quicker; never far out. Racing feel over caution.
                  USER (2026-10-06, verbatim): "do this and move on to bridges ect, im going out so cant talk back but i will be testing, work
                  thru as much of the todo as you can" -> finish B + verge dodge, ship; then 1c.2 slip roads + 1c.5 bridges (+ cheeky extras),
                  then speed cameras, then debris / roadside, each shipped LIVE as it works (user testing while out; no questions possible).
              [x] TIMERS (2026-10-06, LIVE): CATCH THEM 8 -> 15 s, SOFT: closing on the leader refills it (HUD "CLOSING IN n"), hovering
                  <= 40 m past the screen edge holds it up to 10 s, not trying = runs out (tools/_flowtest.mjs ALL OK: not trying ends 15 s
                  after it leaves the screen; closing 1.5 m/s never ends). PULLING AWAY unchanged (8 s). OFF-ROAD 6 -> 10 s and PAUSED
                  within 16 m of the edge or while heading back > 1.5 m/s (tools/_offtest.mjs ALL OK). Rules card updated.
              [x] B — FASTER / RACING (2026-10-06, LIVE, user gave freedom): throttle floor 0.6 -> 0.85, corner share 0.33-0.42 -> 0.42-0.54,
                  follows closer (0.55 g), feathering only for yaw BEYOND the bend, plans with lane-changing traffic's TARGET lane (traffic.js
                  car._trOff), VERGE DODGE: lines 0.9 m inside the tarmac edge (half on the grass verge... no: the tarmac edge + verge strip),
                  only on straights, -40 score so only when clearly quicker, capped at +8 m/s over the car passed. MEASURED pacesuite 18
                  races vs A: mean 133.4 -> 138.2 km/h, under 130 km/h 40 -> 35 %, bad races 2 -> 1. HONEST: weavecheck 1-2 of 45 close
                  passes now CLIP at 150 km/h (were 0) - "racing, not a sunday drive"; seed 1234 Realish: two racers wedge and stop
                  (in-game the stuck-reset frees them after 3 s). A full verge dodge 0.4 m from the edge = cars off far (5-7 of 9 bad) - not shipped.
              [x] 1c.2 SLIP ROADS + 1c.5 BRIDGES + EXTRAS (2026-10-06, LIVE, awaiting the phone verdict): off-slips every 2-4 km on straights
                  (tapering tarmac lane off the hard-shoulder side, 150 m, edge lines, 3/2/1 countdown posts, a blue EXIT sign with a silly
                  name, ends at a field GATE - drivable, the off-road timer applies); BRIDGES every 1.1-2.4 km: ROAD (cars on it), RAIL
                  (sleepers, two tracks, masts), FOOT (people), RIVER under the motorway (water + banks, parapet walls); abutments solid,
                  out on the grass. EXTRAS (~1 in 6): a COW on a road bridge, a CONE on a footbridge, a BOAT stuck by a river bridge, a
                  SMILEY SOLAR FARM in a field. None on WALLED. tools/_slipcheck.mjs ALL OK (12 km x 3 seeds x 4 presets: 3-4 slips, 4-9
                  bridges each, 0 solid corners on the road or AI verge strip); pacesuite with them: 0/9 bad, mean 151 km/h;
                  tools/_bridgeshots.mjs photographed every kind at 390x844 + 844x390, no page errors. Fixed from the photos: the slip's
                  start stub poked out of the verge; the river was painted OVER the motorway (now stops at the parapets).
                  NOT DONE: ON-slips (merging in) - the spec had them; off-slips first. A slip is not a road for the AI / traffic.
              [x] 1c.6 SPEED CAMERAS (2026-10-06, LIVE): every gantry; > 70 mph = white FLASH + "YOU GOT CAUGHT" card (km/h + mph +
                  FINE -$100 + $10 per mph over, x2 past 170 mph) top right portrait / left column landscape (photographed: top right in
                  landscape covered ABS/TCS), the camera box flashes; count + fines per run on the card; fastest catch + total count +
                  fines kept (localStorage rac3r.cams) for missions later. Not charged to any money (there is no wallet yet). Rules card
                  added. tools/_camcheck.mjs ALL OK (65 mph never; 90 mph caught at all 4 gantries, $300; 200 mph $2800).
              [x] ROADSIDE DEBRIS (2026-10-06, LIVE): cones.js DEBRIS - pallet + box break on hit 1 (splinters / flattened cardboard,
                  drive-over), crate + sandbag on hit 2 (splinters / sand), bin / barrel (rolls) / lost exhaust / bumper knocked about,
                  never break; TARP always flat, dragged a little, no slowdown. ~1 in 2 of the highway litter + scatters (37 / km at
                  litter 1; the LITTER slider scales it). Squares only (render.js drawDebris). tools/_debrischeck.mjs ALL OK; pacesuite
                  0/9 bad, 151 km/h; objcheck unchanged (its 2 FAILs - killder 6 moved, mid-crash > 0.5 ms - fail the same on the
                  build before, machine load); photographed (tools/_debrisshots.mjs), no page errors.
              [x] HIGHWAY JUDDER (user, 2026-10-06: "i still see some judder on mobile on infinite levels - guess thats as chunks load")
                  (LIVE, render.js; ENGINE.md "HIGHWAY JUDDER"). NOT the road chunks (~2 ms) - the GROUND TILES: 45 ms each at CPU x4,
                  ~10 a second at speed. Tile painting 45 -> 18 ms (CPU scratch, no GPU readback; hill-shade one fill per shade, same
                  pixels per tools/tilediff.mjs); p95 frame 100 -> 33 ms, frames > 40 ms 122 -> ~50 per 20 s. The stand-in under a
                  missing tile now follows the road (was dark squares after 1 km). Tools: hwjudder.mjs, hwprofile.mjs.
              [ ] HIGHWAY PERF, NEXT: with 5 AI + traffic the PHYSICS is the cost on a slow phone (applyGround: ~22 height lookups per car
                  per step, each a subtrack query for the camber; stepAI). Ask the user how it feels after the tile fix first.
              FEEDBACK (user, 2026-10-06, after phone-testing the above; verbatim + status in HANDOVER.md §3):
              [x] CATCH THEM only when the SLOWEST rival is off screen ahead (you are last); anyone behind / on screen = race free.
                  LIVE (hwrace.js createHwFlow + rules card). _flowtest ALL OK (2 new scenarios).
              [ ] story-mode time / distance limit for highway races ("perhaps ... when its relevant") - with story mode.
              [~] JUDDER "like a skip or a camera issue": MEASURED camera 0 skips (tools/hwwobble.mjs); slow frames at CPU x4 remain;
                  the pixel-locked zoom steps every 5-8 frames (0.6 %). Tile TIME budget LIVE (frames > 40 ms 53 -> 20 / 20 s). Three zoom
                  changes tried + reverted. Next: user tries ?nolock=1.
              [~] AI "race aggressively, they queue in lanes, use the edges, weave like a street racer": HWT knobs rp / mvk / cm added
                  (defaults = old). Every looser weighting measured 2-9 of 45 weavecheck clips for 0-3 km/h - NOT shipped. Next: an
                  OVERTAKE manoeuvre (structural). Table in HANDOVER §3.3.
              [x] BRIDGES + SLIPS v2 (2026-10-06, LIVE, AWAITING THE PHONE VERDICT; highway.js approaches / river / sideStep, render.js
                  drawBridge, lab.js coverCut). ALL presets incl. WALLED (gaps in the wall). Slips: 1/4 short (gate, as before), 1/2 LONG
                  300-420 m curving off screen to a gate, 1/4 the SECRET SIDE ROAD (14 m out alongside, follows the bends, 250-750 m, merges
                  back into the hard shoulder; same signs as any exit). Guard: the side road = road; up any other slip the countdown WAITS
                  and only the far-out reset ends it, as "EXIT TAKEN — BACK TO THE MOTORWAY". Bridges: approaches 150 m each side (tarmac road
                  with lines / ballast + rails / dirt path), MOVING cars both ways, walkers (+ dog), a TRAIN every 14-30 s (draw only, wall
                  clock). River = the REAL puddle water (a 'wet' cover: grip, spray, tiles) 150 m each side + dirt banks, dry under the
                  motorway. Long things are CUT SHORT where the road swings back over them; scenery keeps off them.
                  ALSO: the road's SHAPE now has its own random stream (st.grnd) - so EVERY SEED'S ROAD IS A NEW SHAPE from this build
                  (was shared with the dressing; any scenery change re-rolled the road). Tools: _slipcheck (extended), _guardtest (new),
                  _bridgeshots2 (new) ALL OK; treadmillcheck ALL OK. pacesuite: off-road "BAD" runs appear on BOTH builds of the same new
                  roads (HWNOX=1, no extras: 1/9; with: 2/9 on set A, 0/9 on set B) - the extra one was racers spun off at a slip mouth.
              [x] SCENERY v2 (2026-10-06, LIVE, awaiting the phone verdict): farm stretches now half the road - a patchwork of FIELDS
                  each side (wheat / rapeseed = long-grass grip drawn as crops, meadow = long grass, pasture = grass + sheep / cows,
                  ploughed = dirt, farmyard = gravel + barns + bales), HEDGES round each (solid, 5 m gap, trees in them), now and then a
                  VILLAGE (lane, houses both sides, church). Nothing on the motorway / side road / bridge approaches / rivers / slips
                  (tools/_scenerycheck.mjs: 12 roads x 15 km ALL OK; ~150-170 fields per 15 km; 60 fps in the photos). Not on walled.
              [x] (= S-B, done 2026-10-07) LAB CRASH-TEST AREA (user, 2026-10-06, VERBATIM): "when done with scenerey, slip rds n bridges as its probs quick compared to
                  adjusting the ai racers, can we add some of every object laid out nicely ready to test crash into ect into he lab level, maybe
                  extend the bottom of the map ? with some strips of all the different tarmacs and stuff, the objects can be at the end of the
                  lanes make it fun and useful. make sure to include all the cones tyres tarpulins bins... boxes haybails pallets any others i
                  missed"  -> AFTER scenery, BEFORE the AI work. Coverage test: every loose-object kind + every surface must appear (rule 18).
              PHONE VERDICT on bridges + slips + scenery (user, 2026-10-06 late), VERBATIM:
                "soemthing is broken and occasionally leaves patches of dirt on highway levels, maybe it just shows from underneath ? but it
                only seems to happen after longer drives / with ai on
                most things tested great tho, but i will list problems or changes
                catch them timer never seems to time out it fails to count down.
                didnt see slip roads on dual carriage way version of highways ? or should i test more maybe i missed it
                still getting judder but i see thats on ya list
                and how many crashes a race is ok ? id say lower difficulties up to like 10 or more in a three lap race lol maybe, and at harder
                difficulties maybe 5 or less - crashes are real and if they feel real and racing scenarios occur thats better coz its fun, so long
                as ai are fast dont care about safety too  much and know how to drive and try to dodge stuff, most importantly its a race so they
                should be trying not to slow down too much or stay still or wait... they can block other drivers ect if it happens and stuff like
                i say its real racing"
              [x] DIRT PATCHES: FIXED - wear cells were never dropped on the endless road, so new ground built over an old worn cell
                  kept its dirt (look AND grip); the map grew all drive. lab.js pruneWear after every rebuild (tools/_wearleak.mjs: 3075 -> ~250
                  cells over 40 km, stale cells 2-10 -> 0).
              [x] CATCH THEM: FIXED - every cancel (a rival spun off / dropped behind you, or flicked on screen at the edge) restarted the
                  full 15 s, so it never reached 0. Now it RESUMES where it stopped (+1 s per s you were back in touch), with a 2 s grace for
                  edge flicker. tools/_flowtest 11 scenarios ALL OK (3 new).
              [x] slips on DUAL: they ARE there (tools/_firstslip: first exit 0.8-2.9 km in, then every 2-4 km; 2-4 per 12 km, like motorway).
              [ ] AI crash budget: low difficulty ~10+ per 3-lap race OK, hard <= 5; fast, dodge, never wait / sit still; blocking OK.
              SCENERY CHANGE (user, 2026-10-06 late, VERBATIM): "hedges around fields in scenery should be should be long grass, and jsut
                reuse mud and grass or long grass textures for field, and maybe colour them"
              [x] hedges -> a LONG GRASS border strip (drive-through, no barrier); fields -> the existing grass / long grass / mud looks,
                  tinted (wheat gold, rapeseed yellow); ploughed = MUD (look = grip). (Measured first: with solid hedges pacesuite
                  went 2/9 -> 3/9 BAD, seed 4242 d0 off-road 0 -> 1852 car-steps; HWNOF=1 back to 2/9.)
              ROUND 7 — THE USER'S ANSWERS TO THE "NEXT 10" (2026-10-06 late), VERBATIM (numbers = HANDOVER §5):
                "Okay I'll test consider testing ongoing while you work on other stuff and we can come back to it ask me if I forget
                 2. Yes please, make it rectangular  and extend downwards with lab floor texture
                 3.  Ok will add it to the test report aka 1.
                 4. Okay chat away let's solve this, I imagine it'll be lots of small changes and frequent test
                 5. Yes and they can bring new traffic which can merge over haha
                 6. Yes but low priority - also we want to make a dessert / canyon scenery version,  and a mountain road scenery one - in
                    test mode scenery should be randomised - so it might be the country side farm scenery or canyon or mountain pass
                    scenery maybe one other style
                 7.  Yeah and more just that behaviour fix I think that's covered in 4. tho really but working order is ok just keep clear
                    record of that convo about ai behaviour for when we come to build it
                 8. Yes and ideally school buses and articulated Lorrie's but feel free to wait until we build them as playable vehicles to
                    reuse as traffic
                 9. Yikes that sounds bad can I get an fps counter somewhere to help spot issues while in test
                 Also can we have a to test feature list somewhere in the pause menu while we are testing it should be updated when we add
                 new features and remove approved features. Talk to me more about this idea if needed or you think it's bad
                 10. Yeah
                 Also: Can we make Cows and sheep impactable ?  Sheep can be like a tyres impact weight but burst into white particles
                 how's [cows] should stay solid and be heavier more like hay bails impact weight
                 Canyon maps should have severe terrain off the road - to act as cliff edges almost… and deep gullies ect High roll risk ect
                 The road surface terrain should be normal or kinda smooth tho and long winding and S ing corners
                 And mountain pass can also be semi extreme terrain off the road but quite varied like mountain terrain. Its road surface
                 terrain should be quite severe tho with lots of steep hills and bumps or sharper long cambered corners
                 Help round up the todo and look for holes in the development ask me questions and probe me for specifics on ideas where needed
                 The goal is to put this on apple App Store and android in the end - and sure we comply and discuss any changes needed
                 Probe me menu art references / talk to me about them / remaking them for our game in that 3D style. For example the garage
                 shot the vehicle should change as you cycle thru in garage. Yes I know this more work and requires art for each vehicle/
                 maybe redrawing the ones we have to match a mix to the references and this talk to me about how much work this is / is it
                 worth it best just draw the menu screens only. Talk to me about stuff when we come to do it - ensure this is all digested
                 and on the to do List
                 report back after each stage. only proceed when cleared"
                + "there no menu art ref yet" (so: ASK for references when we reach the menu art; none in art/ yet).
              WORKING RULE FROM THIS ROUND: STAGES. Report back after each one; do NOT start the next until the user clears it. Phone
                testing runs alongside: ASK the user for verdicts if they forget (the open list = the TEST QUEUE, S-A).
              DIGESTED INTO THE LIST ([ ] = not started; Qn = a question waiting on the user, QUESTIONS below):
              [x] S-A  DONE 2026-10-06 late (awaiting phone verdict): src/testlist.js TEST_LIST (7 entries) -> pause "TESTING · N" -> cards
                       WHERE / TRY / WRONG IF, newest first, BACK + RESUME; FPS strip top right under DISTANCE / LAP: now + LOW (worst
                       0.4 s window of ~10 s, reset on restart), amber < 50, red < 30. game.testMode (true until Story). uicheck OK
                       (fps rect added), tools/_testlistshots.mjs ALL OK both sizes. — the original proposal:
              [ ] S-A  TEST QUEUE + FPS in the PAUSE MENU (user's idea, item 9 + "to test" list). Proposal: a TESTING panel in pause = the
                       features awaiting a verdict, each with "what to try / what counts as wrong", plus FPS (live + worst of the last
                       10 s). ONE file (src/testlist.js) updated in the same task as each feature; approved items deleted. Q1, Q2.
              [x] S-B  DONE 2026-10-07 (LIVE, awaiting phone verdict; testlist 'labext'; ENGINE.md "LAB EXTENSION"): floor 520 x 1000 m
                       (LAB_BOUNDS, y to 740), old square byte-identical (_labcheck vs sb-base/lab-ground.json); 17 CRASH LANES y 296-520
                       (one per surface, 156 objects, all 19 kinds); OFF-ROAD AREA y 548-732 (grass / long grass / mud bog / sand / gravel,
                       dirt loop + jump straight, hills to 4.9 m, natural terrain). _labcheck ALL OK, _labshots ALL OK 56 fps both sizes,
                       regression suite = baseline (blendcheck's 5 us FAIL is OLD, on the Sandbox). — the original item:
              [ ] S-B  LAB CRASH-TEST AREA: the lab RECTANGULAR, extended DOWNWARDS (south) in the lab floor texture; drag lanes of every
                       surface, every loose object at the lane ends. Q3, Q4.
              PHONE NOTES (user, 2026-10-07), VERBATIM:
                "Tyre tracks on mud seem to vanish or morph weirdly as the surface gets degraddd to thick mud - the vector change should
                 darken if anything and make it a dip yeah ? / Mud on road seems to have gone thanks / Still judder but keep it /
                 Discuss making cars simple meshes with pixel art textures if that's not already how we do it - I jsut think it could
                 improve graphics and control maybe and save menu screen garage graphics for every car"
                + to the S-B report: "1. sure [S-C next] 2. i dont see judder atm keep the test reminder 3. this already happened with a
                 previous agent [the AI design chat] ill try n find the transscript / it might be buried somewhere check"
                + "that url didnt work ?" (2026-10-07: the new tunnel tested OK from here - 200, game loads in Edge, IPv4 + IPv6 DNS OK).
              ORDER (user, 2026-10-07): "cow n sheep then mud fix ? and then yeah lets discuss the ai fix /update and the car mesh chat"
                -> 1 S-C cows + sheep, 2 the mud bug below, 3 the AI chat + the car mesh chat (talk, no code).
              VERDICT (user, 2026-10-07): "yes / and all tested good, keep judder on the list still plz until i say / mud, fix and then ai
                chat" -> S-B lab extension + S-C cows / sheep APPROVED (testlist entries deleted); judder STAYS until the user says.
              USER (2026-10-07, during the mud fix): "specificly top left corner of knob hill when multiple cars have passed it, it seems to
                forget / cut of tyre marks in a clean line, some stay but most go, maybe its terrain who knows... report back dont spend too
                long chasing small bugs"
              [x] BUG  MUD -> THICK MUD: FIXED 2026-10-07 (LIVE, awaiting phone verdict; testlist 'mudtracks'; tools/_mudtracks.mjs).
                       CAUSE (measured): the tracks were never wiped. THICK MUD used the same mark colour as mud (58,42,30), and that IS
                       thick mud's own ground colour (#3a291d), so once a cell wore to thick mud the tracks went 11 -> 7 luminance darker
                       than their ground and got lost in its ripple art. FIX: thick mud has its own wetter, darker mark (MARK_THICK_MUD
                       34,23,15 @ 0.17), so tracks on it are 11 -> 16 (pass 4) -> 20 (pass 6) darker than their ground. Softened from a
                       first try (22,14,9 @ 0.26) that photographed near-black. THE DIP already worked and was measured: the rut deepens
                       2.5 / 5 / 11 / 17 cm over passes 1 / 2 / 4 / 6 (mud cap 15 cm, thick mud cap 22 cm, real height, shaded).
              [x] BUG  KNOBHILL MARKS CUT OFF IN A CLEAN LINE: FIXED 2026-10-07 (LIVE, awaiting phone verdict; testlist 'markedge';
                       tools/_markedge.mjs). CAUSE (measured): the marks layer (604 m square) slid along with the car on EVERY level
                       (built for the endless highway, 2026-10-05). Past 136 m from the middle (Knobhill's top-left corner is ~240 m out),
                       it moved and everything beyond a straight line on the far side was cut off. Not terrain. FIX (marks.js follow): a
                       level whose whole fence fits in the layer never moves it. Only the highway and the 1000 m-tall LAB still follow
                       (the lab can still lose far-away marks south of the old square: it does not fit, by design). Before: test mark 79
                       -> 5 alpha after a corner trip; after: 79 -> 82 (Knobhill), 79 -> 79 (Slidden Hill).
              [x] dirtroad fix 2: APPROVED (user: "Mud on road seems to have gone") - testlist entry deleted.
              [ ] judder: kept open in the test list (user: "keep it" / "dont see judder atm keep the test reminder").
              [ ] DISCUSS: cars as simple MESHES + pixel-art textures (graphics, control?, reuse for the garage menu art) - talk first.
              [x] FIND the earlier AI design chat: searched both chat logs (.claude + .cline sessions); quotes added to AI DESIGN NOTES.
              (the mud bug ties to the user's 2026-10-04 ask, TODO SURFACE EVOLUTION: "Mud turns to thick mud / vector dips" and "Does
               repeatedly driving over mud create vector dips ? If not it should although only smallish maybe it can increase with passes")
              [x] S-C  DONE 2026-10-07 (LIVE, awaiting phone verdict; testlist 'animals'; ENGINE.md "COWS + SHEEP"): field animals are
                       LOOSE OBJECTS now (cones.js). Sheep 12 kg, pops into white FLUFF (drive-over) above 13.4 m/s (30 mph); cow 250 kg,
                       solid, TIPS above 17.9 m/s (40 mph). Lab: sheep lane = long grass (+ bins), cow lane = grass (+ crates). Measured
                       (_animalcheck): sheep 30 km/h pushed (car -0.4 km/h), 70 popped (-0.6); cow 40 km/h upright (car -14.6, bale -14.2),
                       90 tipped (-47). _labcheck 21 kinds, _scenerycheck / _debrischeck / _slipcheck ALL OK, photos 60 fps, no page errors.
                       NOTE: highway LOW fps dipped to 24 in one photo run, right after launch (the first window spawning) - not new, watch.
              [ ] S-C  COWS + SHEEP IMPACTABLE: sheep = a tyre's weight (12 kg class), burst into WHITE particles; cows solid + heavy like a
                       bale (250 kg). Q5.
              [ ] S-D  AI BEHAVIOUR: the DESIGN CHAT (AI DESIGN NOTES below), then many small changes + frequent tests.
              [ ] S-E  ON-SLIPS that MERGE IN and BRING NEW TRAFFIC that merges over.
              [ ] S-F  SCENERY STYLES, randomised in test mode: FARM (have), CANYON / DESERT, MOUNTAIN PASS, + one more. Q6, Q7.
                       CANYON: off-road SEVERE (cliff-like edges, deep gullies, high roll risk); road smooth-ish, long winding S-bends.
                       MOUNTAIN PASS: off-road semi-extreme, varied; road SEVERE (steep hills, bumps, sharper long CAMBERED corners).
              [ ] S-G  Road furniture (low priority): lay-bys + SOS phones, services, central reservation, cat's eyes.
              [ ] S-H  Camera judder: the user tries ?nolock=1 via the test queue (S-A), then fix.
              [ ] S-I  Vans, SCHOOL BUSES, ARTICULATED LORRIES: fine to wait until they exist as PLAYABLE vehicles, then reuse as traffic.
              [ ] S-J  Story-mode time / distance limit for highway races (later).
              [ ] S-K  MENU ART in a "3D style"; the garage shot shows the car you cycle to. NO references yet: ask first. Q8-Q10.
              [ ] S-L  APP STORE + GOOGLE PLAY release: compliance list, discuss changes. Q11-Q14.
                   APP PLAN (owner, 2026-10-13): after the overhaul. 1) app wrapper (e.g. Capacitor, M),
                   measure the judder with ?meter=1; 2) only if it still judders, native touch input
                   passed to the game (M). A fully native rewrite (L) is not recommended.
                   HIGHWAY REBUILD (owner, 2026-10-13): later, build a NEW endless-highway version
                   designed from the ground up not to judder, phone-tested as it is built (the
                   feature is a key selling point). Start from the two judder reports.
              AI DESIGN NOTES (the record the user asked for: "keep clear record of that convo about ai behaviour"). Add to it each round.
                AGREED SO FAR (user, 2026-10-06): racing line + awareness / avoidance; per-racer personality; "try hard to win", let chaos
                  happen; crashes fine if they feel real. BUDGET: low difficulty ~10+ incidents per 3-lap race, hard <= 5. "fast ... know
                  how to drive and try to dodge stuff ... trying not to slow down too much or stay still or wait ... they can block other
                  drivers". Expect lots of small changes + frequent tests.
                THE EARLIER AI TALK, FOUND 2026-10-07 in the old chat logs (user asked: "already happened with a previous agent"),
                  VERBATIM - the ones NOT already quoted above / in 1c:
                  2026-10-04: "really need ai to drift and handbrake sometimes / aggressive off road driving They also seem to all aim for
                    the racing line a bit too hard / at the start of races and it causes crashes - maybe just increase crash awareness a tiny
                    bit and increase how easily they will try overtaking or avoiding while not slowing down too much or at all"
                  2026-10-06: "ai should swim, race and drive aggresievly, they tend to que in lanes on the highway still, not use the edges
                    of the road or weave through traffic like a real street racer"
                  (already in TODO: "ai should go off road to dodge if its quicker ... not on a sunday drive" l.135; "ignore lanes and go fast
                  dodging traffic" l.103; "waits doesnt weave" l.107; "race within the class" l.426; the 2026-10-06 "looser approach" answer 3
                  below.) No longer design conversation was found: the AI direction was only ever agreed in these messages.
                WHAT EXISTS (aidriver.js): 5 difficulties (pace / line quality / wander / mistakes) x 5 PERSONAS dealt round the field
                  (quick, steady, aggressive, defensive, balanced; aggression + defence 0-1). Highway: the WEAVER (hwrace.js). MEASURED
                  problems: racers QUEUE behind traffic / each other instead of committing to a gap; they spin off and beach (slip
                  mouths); pacesuite: 3-7 of 18 runs have a racer far off the road.
                THE CHAT, ROUND 1 (user, 2026-10-07, verbatim): "ok but patience they should never really wait imo, just try harder and go
                  faster, and make less mistakes with higher difficulty, / block ect too maybe / and yeah like racing line awareness with
                  randomised drift based on driver skill and roll chance per section ect simple enough and should work ? / a. yes but patience
                  should be tweaked as below into drive out of a situation / reset if super slow / stuck / b. and incident should be a full
                  crash or well off track, rubbing is racing as they say so small contact / track drift is ok.. / c. it should try to drive it
                  self out, if it falls super far behind / stays off track too long / stays still / drives too slow for too long, ect it can
                  reset / d. ideally it should be one behviour engine that accounts for both , because we are going to try n keep it simple and
                  elt racing happen naturally... / mmhh not yet its still useful its not a full build yet in regards to itch.io question /
                  work order is ai first"
                  -> AGREED: (1) NO WAITING: patience is replaced by "try harder": stuck behind = push for a gap, never sit. (2) Difficulty =
                  faster + fewer mistakes (+ blocking). (3) Racing-line awareness + a per-SECTION mistake ROLL (chance from skill) that
                  makes it run wide / drift. (4) INCIDENT = a full crash or WELL off track; rubbing and small track drift do not count.
                  (5) STUCK: drive itself out first; RESET only if super far behind / off track too long / still / too slow too long.
                  (6) ONE behaviour engine for circuit + highway. (7) itch: KEEP the test UI for now (not a full build).
                OTHER NOTES, same message (verbatim): "still getting judder on infinite highway levels, tested n seen on motor way and
                  ?nolock=1 didnt solve it if anything maybe made it worse.." / "sound is an issue, it wasnt playing before it is now which
                  is cool but it sounds awful too high pitched, should be different for different cars, should be deepish and sound like a
                  car, van truck ect, impact sounds, skid sounds unique for each surface, wheel spin sounds, brake squeel, indicators, horn
                  ? anything else obvious missing, / try n work efficiently if you think this is going to be a large task push back and
                  suggest an alternate route"
                ROUND 1 BUILT 2026-10-07 (LIVE, testlist 'ainowait'; circuits only, aidriver.js):
                  - INCIDENT is measured now: tools/aifieldcheck.mjs + aifieldsuite.mjs count WELL OFF (> 4 m past the edge), SPIN
                    (> 70 deg slide), BIG HIT (a new touch at > 6 m/s closing) and RESET. Rubbing does not count.
                  - NEVER WAIT: a pass is tried after 0.15-0.6 s behind (was 0.3-1.5), 60-100 % commit per corner (was 30-90), and held
                    up it pushes up to 3 % harder. Defence (blocking) now scales with difficulty as well as persona.
                  - DRIVE ITSELF OUT: under 1.5 m/s for 1.2 s -> reverse 1-1.5 s with the wheel turned toward the road; gives up after
                    3 tries in 15 s, THEN the game resets it (main.js). The old under-1 m/s-for-3 s reset is still a backstop.
                  - MEASURED (aifieldsuite, 24 races x 6 cars x 3 laps, damage on), per race:
                      easy (Mobile)  before 2.8 incidents, 183 passes / 24   after 5.4 incidents, 221 passes
                      hard (Real)    before 6.2 incidents, 182 passes / 24   after 6.4 incidents, 235 passes
                  - THE BUDGET IS NOT MET YET: easy wants 10+, hard <= 5. Hard is ALREADY worse than easy, BEFORE this round: harder
                    = faster = closer racing = more big hits. Tried + REVERTED: more per-corner mistakes on easy + a cleaner, wider
                    attack on hard -> hard went UP to 7.0. Next round = the SECTION ROLL design (below), not knob-twiddling.
                  - Highway AI (hwrace.js) is a SEPARATE driver: no drive-out yet. ONE ENGINE for both = the next AI step.
                USER, AFTER TESTING AI ROUND 1 (2026-10-07, verbatim): "oh shit is it not a good idea to merge the ai engines ? i wouldve
                  thought one engine is better and cheaper, check this into the work agreement to not do stuff like this, no 2 engines then 1
                  engine, it should be forseen or asked at least... / Joker lane detection needs to be wider on knob hill - it's easy to come
                  off the road shoot wide and cause a defection bug where it doesn't detect you've done it and then when you do it again it
                  gives penalty for multiple jokers... / Ai still seem slow on surface transitions - they should be fast / predict it and
                  drive to the condition aggressively - make them go fast and steer ect to handle it - / This is noticeable on knobhill too
                  where they seem to slow as they choose to take joker and drive centre lane rather than cutting the entry and sliding in for
                  max speed / ramping up got this with difficulty high / Natural driving behaviour over fixed rails / Ai should try to avoid
                  other cars and players in all directions although they may not be able to but they can gently try / again this should
                  create natural driving dynamics / Simple rules to create complex behaviour / Okay upon testing new ai / As above / Surface
                  transition and lane choice are issues / Ai on high way should also have a chance of taking slip roads good or bad / But
                  difficulty is getting too hard and there isn't enough crashes we'll combat this by increase the skill difference across ai
                  drivers so Some end up significantly lower on all difficulties and lower the skill ceiling for easier modes progressively
                  too / All difficulties could have more wreck less driving and crashes / Scale by hardly increasing the error chance on
                  hardest modes and quite dramatically increasing it on lower difficulties / for the todo later... / sound needs a volume
                  control / mute button in pause menu too please - kinda high priority coz its annoying before we do the sound fix
                  upgrade... / mud test passed - just to check its limited how deep it can vector terrain down ? so it doesnt error ever
                  yeah and how deep ? / strong can it get ? / tidy up folder and project - push to itch again / after bad crashes the car
                  shouldnt drive well / at all / when hitting barriers on corners it seems to crash n roll the wrong way ? or is that an
                  illusion ? and like tyres can cars have a chance to roll over objects if they roll / ask any questions needed to clarify /
                  also frames never dropped below 50fps in the whole testing session / and okay add sound in 4 steps to the todo impliment
                  them and get them checked at each stage / say ai feel better already just some tweaking... observered reversing out of
                  incidents and generally driving faster and more wreckless and natural, it could maybe be increased still tho please /
                  there should ideally be less incidents on harder modes, maybe increase the ai awarness of objects / increase attempts to
                  avoid objects / cars"
                  -> VERDICTS: mudtracks PASSED (deleted). AI round 1 "feel better already" (ainowait kept: tweaking continues).
                     Frames >= 50 fps all session (the highway judder is NOT a frame-rate drop: keep 'judder').
                  -> ORDER (this session): 1 VOLUME / MUTE in the pause menu (high). 2 Joker detection wider (Knobhill bug). 3 answer:
                     rut depth caps. 4 tidy + push itch. 5 questions (crash handling, rolls, the AI round 2 plan). THEN AI round 2
                     (ONE engine, surface prediction, joker entry, all-round avoidance, slip roads, skill SPREAD), then SOUND S1-S4,
                     each phone-checked.
                [x] VOLUME / MUTE in the pause menu: DONE 2026-10-07 (LIVE, testlist 'sound'; tools/_volcheck.mjs ALL OK). Slider 0-100 % +
                    MUTE / UNMUTE under RESUME; remembered (localStorage rac3r.vol / rac3r.mute); the HUD volume chip still cycles.
                [x] JOKER DETECTION: DONE 2026-10-07 (LIVE, testlist 'joker'; tools/_jokerline.mjs ALL OK). Was a 7 m circle at the lane's
                    middle (13 m across). Now a LINE across the lane at the gate, counted when CROSSED, lane half-width + 8 m each side
                    (~26 m across), never on the main road, ONCE PER LAP (no double joker from crossing back). AI use the same line.
                [x] RUT DEPTH (user asked): capped. Mud 15 cm, thick mud 22 cm, sand 12, gravel 8 (lab.js RUT max). Measured after 400
                    passes: 22 cm at the cell centre, 14.7 cm under a wheel (smoothed between cells), heights finite. It cannot grow.
                [x] TIDY 2026-10-07: root stray files (cf_*.log, tunnel*.log, get_url.py, serve.py, test.txt, url_out.txt), backups bak2-9,
                    251 photos older than 3 days and 3 old steer scratch tools MOVED (not deleted) to _archive/tidy-2026-10-07/.
                    (The user had said "LEAVE THEM" for the root files earlier; "tidy up folder and project" now -> archived, recoverable.)
                [x] ITCH: pushed build #2084224 (userversion 2026-10-07c) to fuzzlepun/rac3r:html5, test UI kept.
                    USER (2026-10-07, new session): "dont update itch until told to" -> NO butler push until the user says so.
                [ ] ROLL DIRECTION (checked in code 2026-10-07): a hard SIDE hit always rolls the car AWAY from the impact (damage.js
                    sideKick dir = -side). Right for a car T-boned while still; WRONG for a car sliding INTO a barrier - it should trip
                    over its leading side and roll TOWARD the wall. Likely what the user saw. Fix needs the user's OK (question asked).
                [ ] DAMAGE IS MILD BY DESIGN today (damage.js): grip at most -20 %, power -15 %, a pull, punctures, lost wheels; the
                    "too injured" reset. Question asked: how badly should a wreck drive.
                ANSWERS (user, 2026-10-07, verbatim): "great / 1. yes same ai and id say realistic, so a-b / 2.yes / 3..yes ride up n fall
                  down, but only if rolling, mid crash roll over, yeh not under normal driving they are fine as they are atm, if this is huge
                  work or likely to spend n age debugging maybe skip / 4. avoidance should be weighted with difficulty, not just aggresive
                  joker enteries but that seems on rails a bit still / yes / sorry what order you never suggested a work order - write a hand
                  over for the next agent"
                  -> AGREED: (1) WRECK DAMAGE realistic, player + AI the same: a bad crash = LIMP (power down, heavy pull, top-speed cap),
                     the worst = STALLED (needs RESET). (2) ROLL DIRECTION: a car sliding INTO something trips over its leading side and
                     rolls TOWARD it (T-boned while still: away, as now). (3) ROLL OVER OBJECTS: ONLY while already rolling / mid-crash; a
                     rolling car rides up loose objects and falls off. Normal driving unchanged. SKIP if it turns into a long debug.
                     (4) AI avoidance WEIGHTED BY DIFFICULTY (harder = more awareness / avoidance = fewer incidents). The joker should be
                     less "on rails" in general, not just a more aggressive entry. The AI R2 order below: "yes".
                  -> WORK ORDER (written into HANDOVER.md 3a-NEXT, 2026-10-07): 1 AI R2 (one engine) -> 2 damage limp / stall -> 3 roll
                     direction -> 4 rolling over objects (skippable) -> 5 SOUND S1-S4 -> 6 highway judder.
                [ ] AI R2 (later, "for the todo"): ONE driver for circuit + highway. Skill SPREAD wider (some drivers well below on every
                    difficulty; lower the skill CEILING progressively on easier modes). Error chance: barely up on the hardest,
                    dramatically up on the easiest. MORE awareness / avoidance of objects + cars in ALL directions (gently) so hard
                    modes have FEWER incidents. Predict surface changes + drive them aggressively. Joker: cut the entry, slide in.
                    Highway: chance to take a slip road, good or bad. "Simple rules -> complex behaviour", "natural over fixed rails".
                    PLAN (drafted 2026-10-07 new session, NOT AGREED - shown to the user, no code yet). User: "ok do 1. only".
                    TODAY (read in code): aidriver.js createAIDriver = circuit (precomputed racing line + speed profile, Stanley steer,
                      dodge-round-a-car, attack / cover, mistakes per corner, drift / handbrake, joker, DRIVE OUT). hwrace.js createHwDriver
                      = highway (road frame s/off, 11-line WEAVER scoring free road, MIRROR, verge dodge, curvature speed, its own Stanley,
                      NO drive-out, NO mistakes). Shared only: aiTraits. main.js picks one by LEVEL.endless (l.216, 245).
                    SHAPE: ONE createAIDriver(level, traits) in aidriver.js. The road is read through a small TRACK ADAPTER (circuit = the
                      racing line; highway = highway.js roadFrame / roadPose), so ONE planner / speed / steer / mistakes / drive-out runs on both.
                      hwrace.js keeps ONLY race rules (grid, flow / CATCH THEM, put-back); createHwDriver is deleted, not kept beside it.
                      The lateral planner = the weaver's line scoring (it already looks at all cars ahead + the mirror) with the racing line
                      as its home line on circuits -> avoidance in all directions on circuits too, and less "on rails".
                    STAGES (each measured before / after; R2.1 changes nothing you can feel, R2.2 is the phone test):
                      R2.1 MERGE: highway driving moved into aidriver.js behind the adapter. Gate: weavecheck 0 hits (same as now),
                           pacesuite A + B within noise, aifieldsuite d0 + d4 unchanged. Drive-out then works on the highway too.
                      R2.2 BEHAVIOUR (one knob table by difficulty): skill SPREAD (backmarkers on every difficulty, ceiling lowered on easy);
                           ERROR chance (Real ~ +10 %, Mobile ~ x3) on both modes; AVOIDANCE weighted by difficulty (look-ahead, mirror time,
                           margin up with difficulty); SURFACE PREDICTION (grip ahead read off the ground, no lift at the change).
                           Target: aifieldsuite easy >= 10 incidents / race, hard <= 5; highway: pacesuite incidents same direction.
                      R2.3 JOKER less on rails (cut the entry, slide in; the planner, not a fixed branch path) + HIGHWAY SLIP ROADS (a chance
                           per slip, good or bad: rejoin via the side road, or a dead end -> drive-out / reset). aijokercheck + _slipcheck.
                    ANSWERS (user, 2026-10-07, verbatim): "A / highway ai cars should make mistakes too, / traffic must stay as is / stop n
                      let me test every stage and write a handover too, its important this isnt a back step / 2.3 should be solved by
                      painting slip roads with the same sub track the main highway gets ? if thats a good idea and if thats how highways work"
                      -> AGREED: shape A. Highway AI get MISTAKES (R2.2). TRAFFIC (traffic.js) UNTOUCHED. STOP after EVERY stage for a phone
                         test + a HANDOVER update. NOT A BACK STEP: every stage A/B'd against the baselines below. R2.3 slips: check below.
                    [x] R2.1 MERGE BUILT + LIVE 2026-10-07 (testlist 'ai1engine'; AWAITING THE PHONE VERDICT - R2.2 waits for it).
                      What: hwrace.js createHwDriver MOVED into aidriver.js as roadDriver (not exported) behind ONE createAIDriver
                      (level.endless -> road frame); DRIVE OUT shared (driveOut()) so highway AI now reverse out too. main.js + 8 tools
                      repointed. hwrace.js = race rules only. traffic.js NOT touched. Script: shots/look/r2/merge.mjs; backups
                      shots/look/r2/bak-{aidriver,hwrace,main}.js. Numbers: shots/look/r2/ (base-* = before, live) + shots/next/shots/look/r2.
                      MEASURED:
                      - IDENTITY (merge with drive-out OFF, NOOUT=1): weavecheck d2 + d4 IDENTICAL line for line; hwracecheck seed 4242 d2
                        IDENTICAL (also old vs old: deterministic); pacesuite A mean 128.8 = 128.8 km/h, same BAD 3/9 (off-road 5296 -> 5303
                        car-steps on one run: noise-level, 0.1 %).
                      - WITH drive-out (what is live): weavecheck 0 hits d2 + d4 (= before). pacesuite A 128.8 -> 129.1 km/h, BAD 3 -> 3,
                        racer-racer contact 2471 -> 992; B 134.7 -> 136.3 km/h, BAD 1 -> 1, rr 2901 -> 898, off-road 6880 -> 4938.
                        (the drive-out unpicks tangled / beached racers: seed 9001 d0 97 -> 111 km/h.) tools/_hwdriveout.mjs ALL OK (3 beached
                        cases: 2 drove out, 1 gave up -> reset, never sat still).
                      - CIRCUITS (code path unchanged): aifieldsuite d0 5.4 -> 5.3 incidents / race, d4 5.6 -> 6.0. Single races are
                        bit-identical old vs new; the suite's 6-at-a-time parallel runs vary a few races between runs (CPU-timing order), so
                        these are the same within noise (user: "crashes will vary race to race only averages will show it").
                        PROOF it is the tool, not the merge: the OLD code (shots/look/r2/old = pre-merge copy) on brands-snatch d4 seed 23
                        gave 15 incidents in the baseline suite and 24 run alone; the NEW code 20 / 18. Seed 7: old = new exactly. Hard
                        re-run on the new code: 6.0 then 6.1 / race (old 5.6). Circuit code path is byte-identical (only driveOut() was
                        extracted). R2.2 must judge on several suite runs averaged, not one.
                      - _aismoke live: Knobhill + highway, 5 AI each, page errors NONE.
                    R2.1 PHONE VERDICT (user, 2026-10-07, verbatim): "ai is noticably better, still maybe waits too long on highways (doesnt
                      need lane awareness ) maybe increase dodging... / whats next ?"
                      -> R2.1 APPROVED (testlist 'ai1engine' deleted). NEW for R2.2: HIGHWAY AI WAIT LESS + DODGE MORE, no lane awareness
                         needed (it has none: the weaver ignores lanes; the waiting = following behind a blocked line). Known from 2026-10-06
                         (hwrace comments): the no-queue knob rp + looser commit cm/mvk gave +3 km/h but weavecheck hits 0 -> 9 of 45, so
                         this needs the R2.2 AVOIDANCE work with it (more awareness = safe to dodge more), measured with weavecheck + pacesuite.
                    USER NOTE (2026-10-07, after R2.1, verbatim): "exit of jokers still seems slow n on rails a bit" -> joker EXIT (merge back
                      onto the racing line) is slow + rail-like. Goes with R2.3 "joker less on rails" (entry was already noted).
                      DIAGNOSIS (MEASURED, tools/_jokerexit.mjs [level] [car] [diff] [seed], d4): the joker is a FIXED branch path = the
                      lane's middle line grafted onto the racing line with only 15-35 m of smoothing (aidriver.js branch / branches).
                      - The graft makes a fake HAIRPIN at each end: Knobhill R 19 m at the entry, R 18 at the exit (on tarmac, mu 1.06);
                        Slidden R 21-27 at the exit. A driver would use the lane's 12 m width + the track's 13-14 m and open the exit out.
                      - Coming out of that hairpin it is FULL THROTTLE but crawling: Knobhill exit plan 91 km/h, the AI does 43 (m 130);
                        Slidden plan 107, the AI 58 (m 170). The slow exit = a too-tight line it can only accelerate out of, not timidity.
                      - ON RAILS: it tracks the branch within 0.2-0.9 m the whole way (no wander / width use on the branch: latLim = 2 m).
                      FIX OPTIONS (for the user): (a) re-lay the branch as a WIDE line - min-curvature inside the lane + the road at both
                      ends, like the main racing line (the slow kink goes away); (b) + on the branch the normal wander / width / dodging
                      (latLim = lane half width, not 2 m); (c) R2.3 proper: no fixed branch at all, the planner picks the joker as a
                      second road (the slip-road frame idea). (a)+(b) are small; (c) is the R2.3 rework.
                      USER (2026-10-07, verbatim): "oh ok yeah make sure its all logged and in handover..." -> AGREED ORDER (HANDOVER §3a-R2):
                    [ ] R2.J  JOKER (a)+(b): wide branch line + normal width / wander / dodging on it. NEXT - waiting for the user's go.
                    [ ] R2.2a HIGHWAY: wait less, dodge more (no lane awareness), awareness by difficulty, highway mistakes.
                    [ ] R2.2b CIRCUITS: skill spread, mistakes by difficulty, avoidance by difficulty, surface prediction.
                    [ ] R2.3  slips + side road as road frames; the joker as a planner choice (option c).
                      Each: build -> A/B vs baseline (averaged) -> testlist entry -> STOP for the phone test -> HANDOVER update.
                    SLIP ROADS ANSWER (user Q, 2026-10-07: "painted with the same sub track the main highway gets?"): YES, good idea + that is
                      how real roads work (a slip is its own short road with its own centreline, joined at a diverge/merge point). TODAY a slip
                      is only a tarmac ribbon (lv.lanes) + a centreline in its prop (o.line); the side road a point list (st.side.pts). The AI
                      only knows the main road frame. R2.3 plan: give each slip / side road a road frame the SAME shape as the main one (points
                      with s / heading / curvature) and let roadDriver switch frames at the diverge (a per-slip chance, by skill / persona),
                      back at the merge (side road) or into drive-out / reset at a dead-end gate. No new driver, no change to traffic.
                    RISKS: circuit feel the user called "better already" must not regress (aifieldsuite + aidrivecheck lap times A/B);
                      the weaver was tuned hard against spins (weavecheck) - R2.1 must reproduce it exactly before anything changes.
                [ ] DAMAGE: after a bad crash the car should drive badly / not at all (Q: below).
                [ ] ROLLS: barrier hits on corners seem to roll the wrong way (check); cars can ride up / roll over objects (Q: below).
                [ ] SOUND S1-S4 (plan below; agreed 2026-10-07 "add sound in 4 steps ... get them checked at each stage").
                SOUND PLAN (proposed 2026-10-07, NOT agreed; audio.js today = 3 oscillators + 3 noise beds, ONE car only):
                  WHY HIGH: pitch = rpm/60 x cyl/2 straight onto a triangle wave, so a 4-cyl at 6000 = 200 Hz, a whiny buzz. Fix (S1,
                  small): per-vehicle VOICE table by `kind` (hatch / saloon / muscle / truck / van ...): pitch x 0.5 (firing order
                  "lump"), a sub-octave, a lower filter, plus a little rpm-locked roughness. S2 (small): skid sound per SURFACE (tarmac
                  squeal, gravel crunch, mud squelch, grass swish, snow creak) + wheelspin + brake squeal at low speed. S3 (small):
                  one-shot IMPACTS scaled by hit energy (car / wall / cone / bale / sheep "fwump"), HORN key, INDICATOR tick. S4
                  (bigger, later): AI + traffic cars audible by distance. Recorded samples would beat synthesis for "sounds like a
                  car" but need assets + licences: the user's call.
                PROPOSED SHAPE (for the chat, NOT agreed): (1) DEFINE an "INCIDENT" so the budget can be measured. (2) Three visible dials
                  per racer: AGGRESSION (how small a gap it takes), RISK (how near the grip limit / the edge), PATIENCE (how long it sits
                  behind before forcing it; low = never waits). Difficulty scales SKILL, not timidity. (3) COMMIT: a started pass finishes
                  or bails decisively, no dithering. (4) NEVER STILL: a floor on time spent under its cruising pace; stuck -> reset
                  sooner. (5) Every change measured (pacesuite: pace, passes / km, incidents per race vs the budget) + a phone test.
              HOLES FOUND IN THE LIST (raised 2026-10-06 late, for the user to prioritise): ONBOARDING for store players (first launch is
                test-mode menus; needs a real start / tutorial); SAVES are localStorage (an app needs a migration plan + "erase data");
                CONTROLS (tablets, notches / safe areas, controllers); AUDIO (no music, no volume / mute settings); a PERF target device
                list; LOCALISATION (English only: decide if menus must allow longer text); PRIVACY POLICY URL + support contact (both
                stores require them); STORY / CAREER + championships + the 2026-10-04 event list: not started (the game's spine).
              QUESTIONS FOR THE USER (asked 2026-10-06 late; answers go here verbatim): Q1-Q14 as in the chat report of that date
                (test list where / FPS where / lab size / lane layout / animal hits / 4th scenery / canyon road type / menu art refs /
                art scope / who draws / car names + trademarks / money / how we ship + dev accounts / age rating + data).
              ANSWERS to Q1-Q14 (user, 2026-10-06 late), VERBATIM:
                "q1 only in test for now / q2 in the corner always or its to hard to read in time / q3 go 1k why not fill the other area
                 with an off road test area with some test hills grass and dirt with active terrain or whatever we call our simulated
                 terrain / q4 ideally one for each but maybe mix some if needed n space is limited / q5 no gore and yes say sheep should
                 explode into white fluff over like 30mph and sure cows can tip if its not expensive and cows tip over 40mph / q6 costal is
                 a great shout / q7 it should vary in the test menu still we can use the same mechanics / q8 just wait on that its not
                 ready yet please / skipping those qs [Q9, Q10] / q11 ok / q12 ok, later ? / q13 not yet my friend might tho / q14 ok /
                 great note the gaps you found too into the todo / and ok do s-a"
                MEANING: S-A test list = TEST MODE only; FPS ALWAYS in a corner (test mode). S-B lab ~1 km tall; the spare area = an
                OFF-ROAD TEST AREA (test hills, grass + dirt, the natural / active terrain); one object kind per lane (mix if space is
                short). S-C no gore; SHEEP burst into white fluff above ~30 mph (13.4 m/s); COWS can tip, above ~40 mph (17.9 m/s), if
                cheap. S-F 4th style = COASTAL. Canyon / mountain road types VARY in the test menu, same mechanics. S-K menu art: WAIT
                (user not ready); Q9 / Q10 skipped, ask again then. Q11 OK = make the car names / badges our own before the store.
                Q12 money: later. Q13 no dev accounts yet (a friend might). Q14 OK = no accounts, no tracking, saves on the phone.
                The HOLES list above is now part of the TODO (S-M below).
              [ ] S-M  STORE-READINESS HOLES (from HOLES FOUND above): onboarding / tutorial, save migration + erase data, controls
                       (tablets, safe areas, controllers), audio (music, volume / mute), perf target devices, localisation decision,
                       privacy policy + support contact, story / career spine. Prioritise with the user before the store work (S-L).
              [ ] S-L+ car names / badges / shapes made our own (Q11 OK) — before any store build.
              ANSWERS (user, 2026-10-06, to the handover's report), VERBATIM:
                1 "ok" (timers accepted).
                2 "yeah generation seemed fine, but i think it was a camera issue causing the jerk / judder, explore that please / fix it if you can."
                3 "yeah im not sure what ideas your trying it was never discussed, it probably should be i can help, - do we not think giving ai racers,
                  good awareness / avoidance, the subtrack / racing line for for tracks or infinite highway like levels, and make them just try hard to
                  go fast and win, will create natural events accidents and stop things being boring processions ? if its too locked down it either has
                  to be super complicated for it to be any good n computationally expensive potentially where as my suggested looser approach means cars
                  will behave randomly and naturally too, we can keep most of what we have probably im just discussing and seeing what you think works
                  best as your the expert haha"  -> DISCUSS the approach with the user BEFORE any AI code (lesson: experiments were never agreed).
                4 "rivers were okay.. but water seemed to be painted and not our water texture ? was that on purpose for compute cost ? but yeha please do
                  bridges, make the cars n stuff move across if you can hhaa that would be cool but only if cheap enough / yeah all the types of highway
                  should have bridges and slip roads you can take,"
                5 "and yeah scenery too please sounds good"
                ORDER: "lets do scenery and slip roads ect first and do ai last as thats where we got stuck so nothing else got shipped"
                -> ORDER NOW: (a) bridges + approaches + moving deck traffic + river in the real water texture + slips off screen / rejoin, ALL
                   presets (walled too: "all the types of highway"); (b) scenery; (c) camera judder; (d) AI - discuss first.
              [ ] B — WEAVE MORE (was: after the user's verdict on A): follow closer (aB 0.55 measured +9 km/h but chaotic alone), plan by
                  where the gaps WILL be, longer swerves in steps (reach blocks most passed-up lines).
            DONE 2026-10-06: weaving highway AI (weavecheck 0/0/0 all diffs), EVENT RULES walkthrough (guide.js RULES), podium = top-down cars. NEXT: slip roads + bridges, then cameras, debris/roadside, THEN AI pace.
          TRAFFIC ANSWER restated (user, same evening): "should VS AI races on the highway have traffic? YES and maybe with a SLIDER for
            DENSITY in tests" -> DECIDED: option A + a density slider in Test Mode setup.
  TRACK MENU (user, 2026-10-05 late, verbatim): "can tracks get a MENU LAYER for CIRCUIT TYPE and stick appropriate tracks in the
    correct category". [ ] NOT STARTED — category list proposed + asked first (menu.js trackSelect has one flat grid of ~25 cards).
  USER (2026-10-04): "LEVELS ARE MOST IMPORTANT".
  6 [ ] WEATHER + TIME (user, 2026-10-04): RAIN / WET and SNOW / ICY conditions, set by SEASON + CONDITIONS + CHANCE; air TEMP and
        SURFACE conditions follow (wet tarmac, standing water, snow cover, ice — the existing covers / wear / tyre temperature); DAY + NIGHT
        so the headlights matter; TIME PASSES SUBTLY during an event. (Ties in with tyres: wets, studded, heat windows.)
  2 [ ] EVENT OBJECTIVES framework (score / targets / timer / win-lose in the HUD + results): TIME TRIALS + DRIVING CHALLENGES
        (basic -> hard), GYMKHANA, CONE BOWLING, PARKING exercises, PARK-ON-THE-TRAILER, DAMAGE HIGH SCORE (crash mode).
  3 [ ] CIRCUITS: MONACO-like street track, NUERBURGRING-like (time trial + races), STADIUM RX (tunnel / jump) + TRUCK stadium,
        off-road race layouts.
  4 [ ] VEHICLES for them: police car (fast, semi all-terrain tyres), getaway car, traffic cars, monster truck, trophy truck,
        pick-up, bangers + caravans.
  5 [ ] POLICE CHASE / GETAWAY on a cliff road / motorway with basic TRAFFIC AI (play either side). Championships later.
