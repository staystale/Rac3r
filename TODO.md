# RAC3R - open work

Only what still needs looking at: what is on the phone now, what is being built, what is open.
Finished work (passed, defaulted, dropped, superseded, with its measured numbers and the owner's
verdicts) is in `TODO-DONE.md` and git; the owner's rules, decisions and lessons are in `NOTES.md`.

## 1. UNDER TEST (on the phone now)

The live list is `src/core/fixes.ts` FIX (a switch there = under test) and `src/testlist.ts`. Each
build's full record (what was built, every number) is in `TODO-DONE.md` under its round.

The 11-11 round (14 entries, 11 switches) passed 11-12, its record in `TODO-DONE.md` (PASSED
11-12). On the phone now:

- BIRDSMESS (`?birdsmess=1`; TEST MODE > RALLYCROSS; testlist birdsmess). THE BIRD'S MESS, the ROC
  track in the Bird's Nest (Beijing 2009), from the shared generator (tools/scratch/_rocdata.mjs
  birdsmess; close to, not traced - no plan supplied): 1015 m, a fat egg in a near-elliptical bowl
  (superellipse power 2.15): a sweeping south-east, a tight north-east hairpin, the north side
  pinched in (the lap's one bend the other way), a tighter north-west, one long west sweeper; the
  crossover a straight X west of the south straight's middle (spareM 1.5 / clearM 2.4, the lane
  gap 32 m there, as the others). Tarmac, gravel on both lanes' east end (the start straight and
  the hairpin), the pitch grass. A NIGHT RACE (Level.eventHour 22, when the setup's TIME is LIVE)
  under 17 floodlight pylons round both lanes (16 m off, every 55 m) plus the lamp plan's 3. ITS
  OWN DRESSING: red seats (VenueSpec.bowlLook), the roof ring a steel lattice (both outside the
  catch fence, nothing over the track), red and gold flags, the Nest's criss-cross mown into the
  pitch, litter heaps behind the barriers (tyres, pallets, barrels, a tarp: VenueSpec.litter),
  13 boards (the register's names, HEAD-TO-HEADBUTT, THE BIRD'S MESS). MEASURED: the portals
  0.13 / 1.41 deg off their lane, centred; 20 edge drives at 15 m/s (centre, +-5, +-6 m) 0 hits
  (at +-6.5 m 3 snag, as Stade de Prance's); sealing 0 escapes; barriercheck, propcheck,
  venueaudit (nothing overlaps), solidcheck OK; crossovercheck 20 AI x 120 s, two seeds: 0 cars
  on the wrong level, 76 / 83 passes; lapdriver 71.6 s, 0 m off; a real race with 20 AI (two
  seeds) 57-61 s winners, no errors. Frame (CPU x4, 20 AI, night): work median 30.5 / 30.2 ms
  against Stade de Prance's 28.5 / 28.8 (frame median 35.5 both; the pools' drawImage +1.5% of
  the profile); with carcull + carcache 18.0 ms frame median. Worldhash with the switch off:
  SAME. WRONG: a stretch of road too dark to read, anything over the track or a car, a car on
  the road touching a portal, a way off the lanes.

- CARCACHE (`?carcache=1`; ROUND 5's performance pass, owner 11-12 "Ok" to the plan; testlist
  carcache): with a grid of open-wheelers the cars' painting was 28% of a frame and their
  suspension arms, a pixel at a time, half of that (MEASURED, Spa 20 AI, CPU x4, CDP profile).
  Each wheel's fixed arms (the arms, a driven wheel's shaft and joints) painted once per car type
  and stamped; only the track rod drawn live (render/cars.ts stampFixedArms). MEASURED: the arms
  951 -> 528 ms of a 10 s profile; our work a frame 29.4 / 28.5 -> 25.9 / 25.8 ms (median, two
  runs each), p95 43 -> 39 ms. The pixels: the same where the car's picture sits on whole pixel
  blocks; at zooms where the arms fall half a pixel off them the stamp draws them crisp where
  fillRect blurred their edges (0.007% of a frame's pixels, renderhash with RAC3R_CAR=track-rwd).
  WRONG: arms missing or misplaced, not turning with the steering, a lower frame rate.

- TEXTURE WARM-UP NEVER ENDED (the same pass; a fix, no switch, no look - CI's renderhash on every
  level is its proof; no testlist entry, nothing to see): the texture cache held 24 of the 27
  surfaces, so the idle warm-up evicted what it painted and repainted one every 60 ms all session
  (render/textures.ts createTextureCache: its capacity now every surface's). MEASURED, Spa at CPU
  x4: the warm-up 1371 -> 288 ms of a 10 s profile (its last textures, then done); with
  ?carcull=1, frame median 34.7 -> 18.1 ms, frames over 33 ms 290 -> 237 of 570. Watch the phone
  report's "slow with GPU uploads" on the next run: some were these repaints.

- CARCULL (`?carcull=1`; the same pass; testlist carcull): what the "AI cost" of a full grid
  really was - not the AI's driving (outside the profile's top 40) but its cars' drawing: every
  AI car's picture painted afresh each frame, the ones off the view too (highway traffic was
  culled, the AI was not; CDP profile, test track 20 AI, CPU x4: the cars' drawing 3.9 s of an
  8.2 s loop). An AI car more than 12 m off the view is not drawn (render/screen.ts
  forEachDrawnCar isNearView). MEASURED, Spa 20 AI, CPU x4: our work a frame 29.3 -> 19.9 ms
  (median), p95 42.0 -> 31.6 ms. The pixels: renderhash SAME (Spa, Thruston) once a car's lamps
  have their own random numbers (render/carlamps.ts lampRandom; before, a car's first lamp read
  took the looks' shared stream, so a car not drawn shifted every later puff - Spa's dust only,
  shotdiff 0.3-1.1%). That stream of its own is on for everyone: the puffs' random numbers moved
  ([look], no change in kind). WRONG: an AI car popping in at the screen's edge, a car's lamps or
  wheels odd as it comes into view.

- STADIUM CROSSOVERS, ROOM AT THE PORTALS (owner 11-12: "the tunnel still just touches some
  barriers"; testlist stadeprancebarriers; Stade de Prance and Wobbly): a car on a road's edge
  met the end of a portal's wall (the cut 0.6 m wider than the road) and the barrier at a lintel's
  corner (1.05 m past the bridge road's edge). The cut now 1.5 m wider each side, the lintels
  2.4 m further out (VenueSpec.crossover spareM / clearM; Snoozuka unchanged), the lane gap at
  the crossover 32 m; each barrier meets a portal at its wall's inner mouth corner (flared in) or
  its lintel corner, no connector or V left beside a wall. MEASURED: the walls 8.56-8.65 m from
  the road under's centre (2.1 m past its edge), the lintel corners 2.49 m past the bridge road's
  edge; 24 drives at 15 m/s (centre, +-5 m) and 16 at +-6 m clean on both; portals 0.14-1.76 deg
  off their lane; sealing 0 escapes; worldhash: only the two stadiums change. WRONG: a car on the
  road touching a portal or its Armco, Armco across a portal, a gap or pocket by a portal.

- LIGHTS IN A SLATTED TUNNEL (owner 11-12: "lights seem to turn off in tunnels they shouldn't";
  testlist tunnellights): measured at night (tools/scratch/_tunnellights.mjs, headlights on,
  stopped on the road, in the first cut, under the cover, in the last cut) in every tunnel kind:
  the stadium crossovers, Snoozuka's crossover and its four road tunnels (the highway's side-road
  underpass is the same straight tunnel) light their open cuts and hide the car and its lamps
  under the whole cover - right. Moanaco's tunnel, covered in slats with gaps the car is seen
  through, put out every lamp of a car under it (render/light.ts: underground, no beams and no
  glows). Now a car's lamps are hidden only under a cover that hides the whole stretch; under
  slats they light, clipped off the slats (clipToCut). MEASURED (Moanaco, under the slats): the
  tail-light glow 31.2 -> 37.3 and the road ahead 37.7 -> 40.1 (brightness); Snoozuka's 20 stops
  the same within 2. WRONG: a car seen between the slats with its lamps out, light on a slat or
  through a solid cover.

## 2. BEING BUILT



## 3. OPEN, IN THE OWNER'S ORDER

### 3a. The owner's list (11-10: "Add this to the todo and work thru it logically"), round 5

ROUND 5, LOADING AND SPEED:
13. The first load is long, and a circuit loads slower than "I'm able to drive faster than circuits
    even load in an f1" - fix.
14. If a wait cannot be avoided: a loading bar of our cars driving right to left into a traffic jam
    / a wall, crashing and stacking.
15. A performance pass once the list is recorded and its simple parts fixed.
    Owner 11-10: "loading is only if we need it hopefully our performance pass will solve this and
    frame rate dropping below 60 on some tracks with large grids" - so the performance pass FIRST
    (the load times and the big-grid frame rate), the loading bar (14) only if a wait is left.

### 3b. Tracks (the venue helper builds, the foreman reviews, the owner passes; one switch each)

- THE REST OF THE ROC STADIUMS (names approved 11-10): THE BIRD'S MESS (Beijing 2009: BUILT 11-12
  behind ?birdsmess=1, section 1), ACCORDION STADIUM (Sydney 2025), DUSSELDORK ARENA (2010-11). The format as Wobbly's: two interwoven lanes
  side by side, one crossover bridge (one path crossing itself: world/trackunder.ts), tarmac with
  gravel in the same places on both lanes; the stadium round it, "creative license allowed".
- X GAYMS RALLYCROSS, the course L.A. LIVELY (Los Angeles 2012; names approved 11-10): tarmac and
  dirt round the streets, the joker's 52 ft (16 m) dirt-to-dirt GAP JUMP (terrain ramps: the game's
  airtime and landings) - "tarmac plus dirt x games make 52 gap version".
- OLD WOBBLY (approved 11-10): the old Wembley's stock car / speedway track round the pitch, 345 m
  real (378 yd), so built at its size (Wembley's shape, a ~550 m lap) in the old stadium's bowl
  with its twin towers ("it can size match with the current stock car circuit or relative if it's
  bigger irl").
- NEW RALLYCROSS TRACKS (owner 11-10: "keep the originals" - the old stages stay as they are): from
  the map - Pembrey, Blyton, Croft's RX layout (on the Croughed venue); a US stadium / Nitro RX one
  (gap jumps over the track, crossovers on a bridge - both systems exist); a World RX one or two
  (Holjes); a HEAD-TO-HEAD SWAP-OVER (two parallel lanes crossing on a bridge, mixed tarmac and
  gravel). "Side by side ace make them all or at least 4+". Names to agree.
- DEMOLITION DERBY (owner 11-10: "Demolition derby levels classic tarmac circle - and we can reuse
  stock car tracks ect for that too"): a classic tarmac circle arena, and a derby mode on the stock
  car tracks (Stock Car, Grass Track, Old Wobbly). Questions when we come to it (the AI ramming, how
  a car is out, the winner).

### 3c. CHAMPIONSHIPS (plan agreed 11-09: "F1 / Gt / Maybe btcc not dtm", "Sst it is then", "Dakar
ok", "Wrc ok", "we forgot rally cross", "your suggested working order for this is fine")

Names agreed with the owner before they ship (the register: NOTES.md ONE PARODY PER REAL NAME).
1. F1 / GT / BTCC: every planned track is built and passed (F1: Sillystone, Moanaco, Spa-
   Frankenchumps, Monzarella, Snoozuka, Yass Marina; GT: the Nerdburgring Nordschlep, Le Manky,
   Spa, Bathworst, the Dieatona road course; BTCC: the UK venues we have - no new tracks). Open:
   the championships themselves; DUBAI (Dubious Autodrome) a possible extra.
2. WRC: one famous stage per rally remade from the map data as the venues are (Col de Turini,
   Ouninpohja, Sardinia, Safari, Acropolis; Sweaty Lamb is Wales).
3. DAKAR: open desert, checkpoint gates, other racers, Deaf Valley's terrain; short stages (3-6
   min). NO EXTRA HAZARDS (owner 11-09: "jsut what's there terrain cactus other racers ect rocks
   surfaces ect is dangerous enough"); a missed checkpoint a time penalty. NAVIGATION DECIDED (owner
   11-10): a MAP in the pause menu - pixel art, like a real map but not exact, looking like a BOOK
   (its surface in our terrain look), unclear as a real one: NO "you are here", only landmarks and
   rock features; a procedural stage's map from the SAME SEED as the stage. And a small pixel-art
   COMPASS on screen for those events. ("ask any questions when we come to do it".)
4. SST (Stadium Super Trucks): "keep it simple 5-10 tracks and a couple different trucks with
   different specs"; street circuits, our circuits and stadiums, with jump ramps
   (world/flipramps.ts exists).
5. RALLYCROSS: the RX tracks and cars we have (Knobhill RX, Slidden Hill; the Fjord Fiester RX) plus
   the new tracks above. The event HEAD-TO-HEADBUTT (the ROC format): 1v1 heats (best of three, a
   knockout bracket) AND a 4-car race round the whole path - the heats and the bracket a game mode
   to agree with the owner first, after the police (owner 11-11).
6. DEMOLITION DERBY (above).
CARS: talk to the owner once the tracks are done (trucks, a Dakar car / truck).

### 3d. The older open plans (in this order)

The owner's orders as agreed: 10-25 "Then (owner to order): ... sound + settings G, Story +
upgrades H, new levels (Dieatona), multiplayer I"; 11-03 "2 the UPGRADE SYSTEM with the agreed
garage (below); 3 SOUND (ask about every sound first); 4 STORY". The 10-24 order: "9 G sound /
settings -> 10 H upgrades with Story mode -> 11 I multiplayer (spike earlier, to keep the sim
ready for it)".

G. SOUND + SETTINGS (M): pause menu SOUND sub-menu (car, environment, radio channel, menu: each a
volume + mute); a SETTINGS screen off the main menu with the same and the GENERAL DIFFICULTY;
TEST MODE's difficulty applies to that event only; the main difficulty (settings) is for Story.
BANNERS (owner): an option in settings; the difficulty sets its default (on for easy, fewer on
hard, forced OFF on the hardest), changeable without changing difficulty; TEST MODE may change
it for the event. SLAVE FM: the owner's own project on the laptop (read it, NEVER change it);
stream at slaveFM.duckdns.org. SOUNDS: consult the owner on every sound before building it,
and a test to approve - no running ahead.
- ANTENNAS + A CB RADIO (owner 11-07: "talk to me about it when it comes to sound"): a few-pixel
  antenna on the cars that have one, a bolt-on CB radio UPGRADE with push-to-talk - discuss then.

H. UPGRADES + GARAGE + TYRE PRESSURE (XL, with Story mode): every car's today = level 5 of 10;
level 1 near scrap (worn, issues likely). Engine (top speed, acceleration, heat / seize
resistance), Body (every damage and puncture chance; trim colour above 5), Drivetrain
(acceleration, shift speed, grinding chance), Suspension (usable grip; how much the ground steers
you), Quality (random faults: punctures, leaks, 1-30 s power losses with smoke). Tyre pressure in
the garage. New garage screens. Needs C first (the systems it upgrades). Percentages: proposed
after measuring today's chances (Q8).
- [ ] UPGRADES + PROGRESSION: every car from base spec up (BRIEF.md's 10-pip system; the mods seam
  exists, every multiplier 1.0); limited by SERIES ELIGIBILITY (over-upgrade and the car no longer
  qualifies); mods shown with the stats ("Engine v2: top speed +10 mph"). Not started.
- THE AGREED GARAGE (owner 11-03, mockup "RAC3R Menu Redesign"; the menu look is done): the
  upgradeable parts' level bars head the sections they apply to (Engine, Drivetrain, Suspension,
  Body, Quality); tap a stat -> its upgrade screen (levels, now vs that level, gains, price);
  TOUGHNESS (Body, per car from its real build, measured from a 50 km/h wall hit); TRAVEL (a
  suspension travel limit: bottoming out, clearance in mud - world/belly.ts); UNITS one game-wide
  setting (a KM/H / MPH chip). TEST garage TRY vs STORY garage BUY; test wear never reaches story;
  paint costs in story.
- With it: COLOURED SPRINGS AND DAMPERS with the suspension upgrade (owner 11-07; the strut a wheel
  throws in its brand colours, render/carparts.ts flatStrut); the Naffcar extras (active AIR
  BRAKES / cowl flaps, aero parts as upgrades; roadmap G).

STORY (Story mode with its garage, money, BUY & FIT, "buy what you last tested" with tick / untick):
- [ ] STORY MODE: ROOKIE SEASON (grass track, stock car, time trials: hillclimb / runway cones) ->
  ROOKIE 2 (similar events, track variations, harder to win); we pick the events; money / points
  also for NOT finishing top 3; replayable events / championships for more money (finish 5th,
  earn, upgrade, come back and win). Not started (the menu shows Story locked). Outside TEST MODE
  the setup's SEASON slider gives way to the global season then.
- [ ] BRIEF.md open questions before the economy: rivals vs ghosts, the broke-player floor, fuel /
  damage persistence, what a pip is worth in lap seconds.

I. MULTIPLAYER (XL): possible on the web now - WebRTC works in Safari and inside an iPhone app
wrapper, so it is built once. Needs a small signalling server (room codes) and a relay for strict
networks; one phone hosts the race (best connection, measured in the lobby), the others send
inputs and get the cars back. A SPIKE (two phones on the tunnel) before committing.
- Owner (10-24): "Multiplayer: no rush; talk it through in detail when we get there."
- A player too far behind is LEFT BEHIND (the endless road would grow past memory): a hard limit by
  time or distance; the place at that limit is the result (first out of a 10-car race = 10th).
- The other players' cars are drawn through the same off-view cull as the AI's (render/screen.ts
  forEachDrawnCar; CARCULL), or a full online grid loses it. Every phone must build the same world:
  worldhash (tools/worldhash.mjs) is the check that the build is identical.

### 3e. Small open items

- FARTMOOR (owner 11-08): a highway theme - a super country lane with crossroads and traffic.
- THE WOODEN-FENCE CENTRAL RESERVATION (11-09 NEXT on the varied reservation): the varied
  reservation passed 11-09 (git 3195055; the dual carriageway has wood 15 %, highway/presets.ts) -
  check with the owner whether anything is left, else close it.
- BRANDS SNATCH: kerbs on the closed GP loop (11-07: "Not yet").
- THE NORDSCHLEP and LE MANKY in full (both passed 11-10 as SIMPLE first builds): the pit lanes,
  roads, buildings and stands; the Nurburgring GP circuit; the Bugatti circuit.
- DRIVER NAMES (K16): every AI racer a name (parody puns, the NOTES rule) with the number on the
  scoreboard / results; the player sets their own in settings with safeguarding (no swearing, slurs
  or racism; a filter that catches spaced / leetspeak spellings). Proposal / mockup first. S-M.
- THE STUDIO NAME in the credits (menu/credits.ts says "made by G"): a parody pun, to be picked; a
  line there for anything else the game takes.
- CARS IN THE WEATHER (Q9 ideas, approved 10-24): mud and dust building up on the car body; a wet
  sheen on cars in rain.
- TECH DEBT: objcheck fails on main (Killder: 6 of 1118 objects at rest move at load);
  JokerRule.estCost is read but never set (an unfinished car's joker always costs 5 s); thick mud
  road stretches keep their white edge lines (road.ts strokeRibbonEdge omits dirt / mud / grass, not
  thick mud); two Surface types (cars.ts, world/types.ts) and the renderer's / HUD's car shapes
  narrower than the traffic's (loop.ts casts) - one car type; carstats a little stale (a re-measure
  moved 6 numbers by 0.1 after 11-03); KNOWN BUGS (tools/runall.mjs KNOWN): racecheck, an RX race
  with two jokers - case C stuck on lap 3, no +30 s penalty.

## 4. IDEAS / PARKED (one line each; the full wording is in TODO-DONE.md)

- Judder: Safari's held frames - "ignore judder, it's ok atm"; before itch a screen recording.
- itch.io: build #2201136 (10-24); push only when the owner says; the page pictures ready, unloaded.
- The lean drawing plan (paused 10-17) and fixed zoom steps (only for the lean path).
- The minimap simplified, if ever needed (owner offered; no need measured).
- Outside TEST MODE the setup's SEASON slider gives way to the global season (with Story mode).
- STORMS + LIGHTNING (K19): flashes, darker sky, gusts; thunder later (sounds: ask). Cost first.
- HEAT SHIMMER (K20): a faint wobble over hot tarmac; measure the phone's cost first.
- LOOSE-GROUND SIDE GRIP (K14): a berm against the sidewall on gravel / sand - to discuss.
- SPARKS ON BARE RIMS by the wheel's own spin (a wheel spinning on its rim).
- MORE VEHICLES (e.g. an M3 as its own car).
- Tyre marks adding grip on the racing line; mud carried onto tarmac - not built, ASK if wanted.
- The highway AI's dodging (owner: "let's leave it for now"; "ai don't dodge properly").
- Weak drivers over-driving on purpose (felt grip, R4 part 2) - on hold, owner to discuss.
- WATCH: an AI F1 field spins more since the real aero (its braking without ABS) - when it comes up.
- WATCH: the menu race on the highway sat still once (cars at 0 km/h) - not reproduced.
- WATCH: markjump (a rim mark after a reset, 11-04) - "unless I see it again".
- WATCH: a NaN car state once in menucheck (11-04, the menu demo car) - find it if it comes back.

## 5. QUESTIONS FOR THE OWNER

- Deaf Valley's exit names (12b, passed 11-11 with them in, "names to approve"): SADWATER, FURNACE
  CREAK, STOVEPIPE HELLS, ZABRISKIE POINTLESS, DEVIL'S GOLF CORSE, LAST CHANCE (REALLY), NOTHING
  FOR 200 MI, HULL (STILL NOT) - approved?
- Dongington Park: the catch fence in front of the Hollywood grandstand (no source shows it; left
  as built 11-09; asked, no answer yet) - keep it?
- The binned HUD text experiment (10-25): delete its branch `experiment/hudtext` on GitHub?
- The black wire / rope fence: the rule (11-07) is never to use it and to replace it as each old
  level gets its venue pass, but NO MORE CONVERSIONS (11-09: "keep the originals") leaves it on the
  old levels kept as they are - replace it there anyway, or leave them?
- A SIREN for the police (none yet): build one for your approval?
