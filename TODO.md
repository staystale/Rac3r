# RAC3R - open work

New session? Read `CLAUDE.md`, then `NOTES.md`, then this file. Open items only: finished work is in
the git history (this file was swept on 2026-10-19: every finished entry deleted; the owner's
decisions and the measured lessons live in `NOTES.md`). `docs/handover-2026-11-08.md` is the
last handover, written on request.

## NEXT - ORDER AGREED 11-07 (owner: "ok let's do 1. first and proceed in this order")

1. EVERY CIRCUIT AS ITS REAL VENUE AT 1/2 OF REAL SIZE (owner 11-07, round 2: "let's make all tracks
   1/2 size ... about the right time for a lap"; the old circuits were 0.45-0.47, Thruston 0.32).
   Brands, the pilot (GP + Indy one venue), PASSED 11-08: the default, the old build deleted. Then
   every track the same way (rally stages in, ovals made real, test levels stay, lap counts kept).
   Owner 11-07: real boundaries, roads, grandstands, pits, parking, surroundings - "one track like
   the real thing that can be modified simply", "the same decorations for both" layouts, "logical
   realistic", "keep our art style". ONE VENUE per circuit: every road piece exists every time, a
   layout is the ordered list of pieces it races (the rest closed by tyres at the junctions), one
   set of scenery for every layout. Source: OpenStreetMap (tools/osmvenue.mjs -> world/levels/
   venues/*.ts, real metres; the Brands OSM loops read 1929 / 3900 m vs the official 1944 / 3916 m)
   checked against the MSV venue map (art/ref/bh-indy-msv.png) and Wikipedia.
   ROUND 1 (3/4) owner verdict: "quite broken" - a road through the first trap, black wire fences,
   gaps in the barriers, bridges that made no sense, a messy trap behind the pits, doubled
   floodlights in tyre rings. ROUND 2 UNDER TEST 11-07 (world/venue.ts, venuegeo.ts, venueedge.ts,
   venuescenery.ts; levels/brands-venue.ts): GP 1959 m, Indy 970 m; the map stepped back from the
   road by the game road's extra width (makePlacer) so real gaps hold; a SEALED EDGE - one Armco
   line each side of every layout road (behind the real traps, 5 m past the edge elsewhere, never
   past a bend's radius on its inside), open only at the pit lane's ends and a layout's junctions,
   flared smooth ends; two tyre rows only in front of Armco behind a trap; the CATCH FENCE (new
   kind, light posts + mesh, weaker than Armco: dents from 1.5 m/s, tears ~77 km/h square) behind
   the Armco at the stands and banks; NO wire fences; the real traps / paddocks / car parks as
   shaped ground (Zone.poly: physics, tile painting, natural edge blending); bridges along the road
   they carry at the real angle, approaches beyond the deck; tunnel portals (new prop) where the
   real tunnels pass under the track; service roads only outside the edge and joined up; parked
   cars (new prop) in the car parks, race trucks in rows in the paddocks; pit lane lines (paint
   kind 'line'); 5 grandstands, 16 buildings, garages, marshal posts behind the Armco, boards on
   it. The corner floodlights are placed before the lap pylons on every level (the 2.6 m double at
   Brands, 3.1 m at Slidden Hill). Long barriers are skipped by their box in collision.
   Checks: barriercheck all OK both layouts, propcheck clear, no floodlight doubles, worldhash SAME
   off. Shots: tools/scratch/_venueshots.mjs <level> "" "dist,x:y,..." (ZOOM, VIEW, WAIT env).
   On pass: delete the old Brands build, then the next track. Not yet: kerbs on the closed GP loop.
   ROUND 3 (owner 11-07): Armco as the old Brands had it, slightly more - behind traps, before hazards
   (buildings, bridge decks, portals, another stretch of track) - a catch fence INSTEAD where
   spectators are (never both), open run-off elsewhere ("running off into the trees is good
   gameplay"); trucks / parked cars only where they fit (no building, road or pit apron); closing
   tyre rows clear of the raced road; a smoother pit lane; boards behind their rail; roads that go
   somewhere (tools/venueaudit.mjs: overlaps + dead ends - clean on both layouts); bridge and
   tunnel roads joined smoothly (world/venuejoin.ts). NEXT (owner OK 11-07, asked again 11-08):
   DRIVABLE BRIDGES AND TUNNELS as one layer system - a car on a deck or in a tunnel stays on that
   level until it leaves by an end: parapets / tunnel walls hold it, the deck's tarmac underfoot, no
   contact with the cars on the track, no marks or smoke on the track, no lap counted, drawn above
   the track (deck) or hidden under it (tunnel).
   BUILT 11-08 behind ?crossings=1 (world/crossings.ts, crossinggeo.ts; tools/crossingcheck.mjs:
   both Brands layouts all OK - on at one end, held by the walls, off at the other; a ground car
   cannot get on from the side; a car on the track below stays on the ground). UNDER TEST.
   ROUND 2 (owner 11-08: "snap" at the ends, "no transparent car", marks on decks/ramps): the
   bridge's ramps drawn under the cars (deck over), a tunnel car hidden only under the ground (no
   faint car), each crossing's own marks layer (marks.ts).
   ROUND 3 (owner 11-08: "the rest is a pass"): the footpath tunnel drivable (a mouth needs room to
   drive out: it runs on under Cooper Straight, 103 m), the ways rise / dip as terrain, smoke under
   decks, a lying tyre driven over only by a tractor-high car. Then (owner: "water can drip up thru
   the tunnels", "should work like any other surface") a crossing has its own ground (world/
   deckwear.ts): leaks and glass land there, not on the track beneath. ALL PASSED 11-08: the
   default, the switch gone.
   CATCH FENCES round 3 (owner: "still too strong ... catch n drag"): tear from ~40 km/h, grab a
   sliding car (0.6 kept a step), a tear tangles and drags the car 1 s. PASSED 11-08.
   CRASH BENCH (owner 11-08: 20 cars at 120 mph into a 3 x 100 tyre wall on Armco; "keep working
   into in the future ... drop no less than like 40 fps" - THE TARGET: 40 fps at the worst on the
   owner's phone, the gameplay unchanged): FESTIVAL OF SPLAT
   (world/levels/crashbench.ts; ?level=crash-bench) and tools/crashbench.mjs (same scene, timed,
   seeded fingerprint). Found: 94 % of a step in the loose objects - every moving object paired
   with every other (~900 burst tyres: ~400 000 pairs a step). Exact fixes (fingerprint the same):
   the box reject first, a crowd (>64 movers) paired through a grid - the impact's second 59 -> 15
   ms a step, worst 84 -> 29 (desktop). ROUND 2 (11-08, exact, fingerprint f3d8ec4d the same): the
   crowd's indices sorted as numbers (a typed array: the compare function was 12 % of a step);
   searched in cells of the reach + 0.5 m, a mover refiled when pushed > 0.25 m (exact by
   construction - the old fixed 2.5 m allowance searched ~16x the area: ~35 000 pairs a step for
   ~1 000 near enough); a barrier's segments boxed in runs of 8 and met by the reach a touch needs,
   not the cars' 4 m pad. Back to back on the desktop, the impact's second: median 13.7 -> 6.9 ms a
   step, p95 22 -> 10.7, worst 26-37 -> 14-17; loose objects ~60 % of it, the 20 cars' own physics
   ~2 ms. Tried, no gain: a distance test before each car's hitByCar. DRAWING (11-08, the real
   game on the laptop at phone size: tools/scratch/_benchreport.mjs, _benchprof.mjs): through the
   impact 5-14 fps, sim 45-97 ms and draw 28-95 ms a frame (a slow frame takes up to 12 steps the
   next). NOT the ~1000 loose objects (~4 % of the impact's CPU; ~2 ms a frame once settled) but
   the dented cars' pictures, made again at each damage step, each reading its sprite back from
   the GPU (getImageData 22 % of the impact's CPU). Now each sprite is read once and a dented
   sprite's own pixels kept (render/spritepixels.ts): 22 -> 9.7 %, every picture the same as
   drawn (tools/scratch/_spritework.mjs: 285 dented / lost-part / rolled pictures). Left: the
   first read of each car's clean sprites (~5 %), each thrown part's picture (~4 %).
   PASSED 11-08 (owner: "ok pass"). THE PHONE (3 runs, &report=1, 440x751 Safari): the impact's
   worst half second 40-43 fps, then 56-60 with ~950 tyres down; the impact itself ~6 frames over
   0.25 s at 36-51 ms - sim 12-22 ms (4-6 steps, ~3 ms a step: twice the laptop), draw 9-26 ms
   (4 normally; the first frame paints 9 ground tiles as the camera zooms in). Two hitches before
   the crash in every run: ~150 ms at 0.6 s (the texture warm-up, warmMs 143) and 72-102 ms at the
   restart (zoomed out to 0.8 px/m, GPU uploads, our JS 15-25 ms). ROUND 3 (11-08, exact): each
   car's clean sprite and its rolled faces made when it is first drawn and read one a frame
   (render/spritepixels.ts readSoon / readNextSprite, game/loop.ts) - read backs in the impact
   22 % (round 1) -> 7.6 -> 3.6 % of its CPU (laptop profile), every picture the same. Left there:
   the thrown parts' pictures (~3 %). NEXT: the owner's phone run; then, if still short,
   settled tyres asleep sooner / a burst's tyres capped (behaviour, ask first). Also: objcheck fails on main too (Killder: 6 of 1118 objects at rest move
   at load).
   ROLLS (owner 11-08, later): the rolling crash relook - check which way a car rolls from an
   impact ("sometimes it seems to roll the wrong way"), and whether a car can roll over things
   (tyres, fences).
   CI (owner 11-08: "30 mins is too long", OK to the plan): no checks job on a push to main (the
   branch's run covers the same commit), the screen checks only when screens change, no doubled
   verify (.github/workflows/checks.yml).
   PERFORMANCE CHECK 11-08 (CPU x4 lap, tools/framecheck.mjs): Brands work median 12.7 ms, p95
   24-29 (Thruston 13.2 / 23.0; Castle Cum 24.4 / 39.1 - the heaviest, older); crossings on: no
   measurable cost. Fixed: Brands was built at page load (7.3 s of level import here, now 0.85 s).
   CATCH FENCES (owner 11-08): tear from ~63 km/h square (was ~77) and SHRED (armcodent.ts) - PASSED
   11-08, with the crash parts' drive-over chance by ground clearance.
   OWNER RULE (11-07): never the black wire / rope fence ('fence' barrier) - the old levels still
   use it (Castle Cum, Thruston): replace as each gets its venue pass.
   CREDITS PASSED 11-08 (menu/credits.ts, on the main menu): "made by G"; the owner wants a studio
   name (a parody pun) - to be picked. Add a line there with anything else the game takes.
2. NEW UK TRACKS at that scale (Snetterton, Donington Park, + Silverstone / Oulton Park) - names
   agreed first.
3. ROLLING LOOK - smoother than the dice flip on the same physics; mockup first.
4. SIDE DRAFTING (Naffcar first), then the Naffcar extras (air brakes, aero upgrades, Dieatona).
5. MORE HIGHWAY FLAVOURS.
6. SMALL: Brands Snatch Indy's garage barrier on a lane (barriercheck); the highway AI dodging (owner
   "let's leave it for now").
- WATCH: an AI F1 field spins more since the real aero passed (12 races: incidents 56 -> 92, spins
  14 -> 37 - the brakes, no ABS, locked by a full pedal: look at the AI's braking on a car without
  ABS when it comes up); once, the menu race on the highway sat still (cars at 0 km/h) - not
  reproduced in 3 more runs.

## OWNER 11-07 - ORDER AGREED (owner: "1. ok 2. ok 3 ok")

1. DONE 11-07: the GitHub `checks` workflow (below, Tools that are wrong).
2. PASSED + DEFAULT 11-07 (owner: "pass"): R7 ?menurand - the menu race on a random circuit / oval / rallycross track
   each time (never the one just raced), the highway (a random road type) one time in five
   (game/menuflow.ts menuLevel). tools/scratch/_menurand.mjs, 10 visits: 8 tracks, the highway
   twice (interstate, dual), every camera car + 4 AI driving, the menu open in 0-165 ms, no errors.
   + a random FIELD of 5-20 cars (owner: "does the menu race vary the ai amount 5-20 randomly? if so
   pass"; ?menuai=N still sets it): _menucount.mjs 20 visits 5..20 cars, all spawned; _menurand.mjs
   14-20 cars, all moving, frames 17.7 ms (95 % under 18.5) on the laptop. Owner tests for lag.
   + the camera car on ANY grid slot, even odds (owner: "is grid position randomised too for the
   menu?" - it was always pole; game/grid.ts drawGridSlot): _menucount.mjs 20 visits P1..P20.
   + behind the menu the highway is framed as a circuit (owner: "for the menu race the observed car
   is off set too much"): no road-ahead lead there (render/camera.ts, CamState.menuView) - the car
   in the middle, not 3/4 down (_menurand-2 / -5 shots).
3. DECIDED 11-07 (owner: "ok approved"; "no just all levels 3/4 size please"): Brands Snatch Indy
   was built to scale as two test levels (?indyscale, commits 58bfa07..b2af16d, then removed): the
   traced map calibrated to the real 1944 m lap (the map's scale bar read 1.2 % short: 0.660 real m
   a px), the hills' reach and height scaled with it (same slopes). The owner tried the road width
   to scale too (the real Indy 9 m -> 9 / 6.75 m): "maybe the previous widths were better" - KEEP
   13 m. Picked: 3/4 OF REAL LENGTH, the 13 m road. Measured at 3/4 (10 AI, 90 s): 85 km/h vs
   70 today, off the track 6.6 %, 56 fps.
- NEXT BIG ONE (owner 11-07): REWORK EVERY LEVEL TO 3/4 OF REAL SIZE, the 13 m road - every track
  with a real counterpart (Thruston, Castle Cum, Brands Snatch GP + Indy, Knobhill, Slidden Hill,
  the ovals by their real ones), each calibrated to its real lap length (as the Indy: the map's
  scale bar can be off), the hills scaled with it. Today 0.41-0.48 of real, so about 1.6-1.8x
  bigger: Brands GP ~2.9 km a lap, about 0.6 x 1 km. AND CHECK + ADJUST THE COSMETICS (owner:
  "check and adjust the cosmetic buildings etc all fit and scale nicely too"): buildings,
  grandstands, pits and garages, bridges, gravel traps, tyre walls / Armco, marshal posts, trees
  and bushes - placed by map pixel today, so they move with the map but keep their size; check
  each fits (barriercheck, propcheck, the dropped-props list) and looks right in phone shots. The
  world machinery for big levels is there (the floor rectangle, the windowed tyre-mark layer);
  watch load time, memory (~6 GB laptop, the phone), the overview picture cap (OVERVIEW_MAX_PX),
  bush / tree counts, lap times and the AI on each. One level at a time, each behind a switch.
  Plan with the owner before starting (a big job).
- NEW UK TRACKS (owner 11-07), at 3/4 of real size with the 13 m road: SNETTERTON, DONINGTON PARK,
  and "a couple other well known uk tracks" - suggest SILVERSTONE and OULTON PARK (or CADWELL
  PARK). Each traced from a real map, a PARODY PUN name agreed with the owner first (NOTES: silly
  names - not one we already have).
4. PASSED + DEFAULT 11-07 (owner: "ok pass"; carpaint, carlooks, carreal - switches and old
   paths deleted; ?f1aero still under test): CARS (mockup first): every car LOOKS LIKE ITS REAL COUNTERPART - rework any that do not
   (owner: "reworking any cars that don't look like their real counter part"); a THIRD colour;
   EVERY car has at least TWO decoratable parts; RIM COLOUR ("so we know it was yours when you
   crash haha"); the AI liveries use them so a 20-car field all differ. Garage paint.
   MOCKUP 11-07 (waiting for the owner): https://claude.ai/artifact/4JLNiDzANWjesxFyx98FtK - a live
   paint shop (one row of part buttons BODY / SECOND / THIRD / RIMS + one palette), the zone test
   (tools/scratch/_carzones.mjs: body red, trim green - the second colour shows on 6 cars, barely on
   5, NOT AT ALL on 8: Golf, M135i, 3 Series, V70, Fastrac, Naffcar (its blue is fixed), Lambo,
   Autograss Special), the looks audit (redraw: Golf + M135i (one shared body), quattro S1, F1, F2,
   Naffcar (the Chevelle body), Micra R1, Autograss Special; small fix: 3 Series bonnet, Fiesta RX
   wings), and the second / third part of each car. tools/scratch/_carsheet.mjs: the sheet.
   OWNER 11-07: "the original paint shop layout was fine - only the car selected"; the audit "seems
   accurate"; "make sure all cars have clearly paintable 2nd parts and some 3rd"; rims + gold and
   chrome; "can chrome and gold be for every colour body second n 3rd too ... a colour swatch the
   line below". STAGE 1 UNDER TEST 11-07 (?carpaint): the paint shop as before + THIRD and RIMS
   rows, chrome + gold below the 16 on every row, rims STOCK; every car's second part is a big one
   (mostly the roof; zone test _carzones.mjs ... carpaint=1), a third on all; stock colours keep
   each car's look (carpaint.ts PAINT_STOCK; off vs on sheet _stock-offon.png same); AI fields
   get a third colour and rims by slot; simhash SAME off. STAGE 2 next: the redraws (Golf, M135i,
   quattro S1, F1, F2, Naffcar, Micra R1, Autograss Special; 3 Series bonnet, Fiesta RX wing).
   RIMS (owner 11-07: "the top of the tyre shouldn't be coloured ... the thing that should be
   coloured by rim colour is when your wheel comes off ... laying flat"; "different rims? spoke
   patterns"): under ?carpaint a mounted wheel shows only its tread; a torn-off wheel lying flat
   shows its rim colour and SPOKES (render/wheelface.ts; owner: "I'm ok with our current steel
   look but just some others is good too; tyres should be round like they are now" - STEEL is the
   loose tyre exactly as it was, its rim ring in the rim colour; five, mesh, split, dish inside the
   same rim;
   _spokesheet.mjs, _loosewheel.mjs); the paint shop has a SPOKES row and a picture of the wheel
   lying loose; the AI get a pattern by slot.
   STAGE 2 UNDER TEST 11-07 (?carlooks, with ?carpaint): the redraws in render/carlooks.ts - Golf
   (short bonnet, C-pillars, GTI line), M135i (long bonnet, kidneys), quattro S1 E2 (vents,
   blisters, splitter, wing), F1 / F2 (full-width wings, thin nose, coke-bottle sidepods, halo),
   Next Gen (bonnet panel, sticker lamps, spoiler), Micra R1 (round, oval lamps), the autograss
   buggy (open frame, cage, engine out back); 3 Series bonnet two clean lines; Fiesta RX wing
   deeper. Same sizes (physics boxes). Old vs new: _looks.png. simhash SAME off.
   ROUND 2 (owner 11-07: "F1 cars look a bit strange and shouldn't their tyres be wider? vehicles
   tyres / rims should be realistic along with tyre profile"; "rims should be a choice next to
   tyres on the menu"; "should the gold be rounder"; a reference picture of a pixel F1): the F1 / F2
   redrawn after the reference on a sprite as wide as the front tyres (arched front wing, the
   nose in the accent, suspension arms, fat sidepods over the floor with the cockpit at their
   front, engine-cover accent lines, diffuser, rear wing); EVERY CAR'S TYRES at their REAL width
   and diameter, front and rear apart (carpaint.ts TYRE_LOOK - drawing only, the physics' wheelR
   untouched); a loose wheel at its real tyre + rim size (the sidewall profile its own), the hub
   and hole ROUND; RIMS is its own garage screen next to TYRES (colour + spokes + the wheel shown
   lying loose), the paint shop back to BODY / SECOND / THIRD + number.
   ROUND 3 (owner 11-07: "make f1 cars look better more like modern f1 cars realistic ... realistic
   tyres / wheel weight ... also grip, downforce ... make sure any emitted bumper or wheel is
   correct too"): CRASH PARTS (?carlooks, drawing only - world/debris.ts partLook): a bumper as wide
   as its car; an open-wheeler sheds its FRONT WING (track + 0.3 m), REAR WING (1 m) or a SIDEPOD
   panel in its colours; a rolling loose wheel at its real diameter and width (_partshot.mjs).
   F1 PHYSICS AUDIT (tools/scratch/_f1grip.mjs) - PLAN SHOWN TO THE OWNER, waiting: ours 4.4 m long,
   wheelbase 2.9, track 1.85 (real 2022: ~5.6 m, 3.6, ~1.6 - the stubby look is the physics box);
   braking 1.8-2.3 g (real ~4-5 g at speed); downforce = weight at 200 km/h (real ~1.5x there);
   cornering 2.9 g at 200, 3.7 at 250, 4.7 at 300 km/h (real ~4-5 g in fast corners); wheel
   inertia scales with car mass (F1 15 kg an axle at the tread - about real).
   OWNER "yes" + "make sure all cars get the same attention": UNDER TEST ?carreal (carreal.ts) - every
   car at its real size where it was off > ~3 % (Golf 4.27 x 1.80, wb 2.63, 62 % front; M135i 4.33,
   wb 2.69; Chevelle 5.01 x 1.93, wb 2.845; S1 E2 wb 2.224; V70 wb 2.755; Next Gen 2.0 wide, track
   1.67; Micra 3.72 x 1.66; tracks of the 3 Series, WRX, S13); F1 5.6 m, wb 3.6, track 1.62, ClA 5.6
   (40/60), brakes 6 g, wheels 27 kg an axle; F2 5.22, wb 3.135, ClA 3.6, 5 g, 24 kg. The Fastrac
   not checked (no sure figures). MEASURED _f1grip: F1 braking (best pedal) 1.7 / 2.4 / 4.3 g at 80 /
   200 / 300 km/h (was 1.8 / 2.0 / 2.2), cornering 3.2 / 4.2 / 4.9 g at 200 / 250 / 300 (2.9 / 3.7 /
   4.7); no ABS (as the real car) - full pedal locks (1.3 g at 80). FIELDS (aifieldsuite d2, 12
   races): F1 incidents 56 -> 111 (seeds 7,3,11) and 55 -> 83 (5,19,23), hits 14 -> 40; Golf 22 ->
   35. Split: the size alone 133, the aero + brakes + wheels alone 114; not the brakes (old limit:
   114); not stale carstats (re-measured: F1 gripG 1.83 -> 1.87). LIKELY ROOT: the tracks are
   0.41-0.48 of real, so a real-size car is ~2x too big for them (the 3/4 track rework). Owner to
   decide: wait for the tracks, ship and accept, or dig into the AI.
   PASSED + DEFAULT 11-07 ?f1aero (owner: "I think f1 aero passed - it's realistic enough unless the
   numbers disagree"): re-measured at the cars' own size - F1 braking 3.0 / 4.3 g at 200 / 300 km/h
   (was 2.0 / 2.2), cornering 3.1 / 4.8 g (2.9 / 4.7); AI F1 fields incidents 56 -> 92 (spins).
   OWNER: "stop - the cars need to match the sizes they were ish but in proportional shape to size,
   or it'll change too much". ?carreal is now DRAWING ONLY: each car drawn in its real car's
   proportions at its own length (render/cars.ts drawnSpec, carreal.ts realShape), the physics as
   it was (CARREAL=1 simhash SAME), the tyres drawn to the same scale. (The real shape in the
   physics, tried: F1 56 -> 90 incidents - its track 1.85 -> 1.27 m; Chevelle 30 -> 46; Golf 22 ->
   20.) ?f1aero apart: the F1 / F2 real downforce, brakes, wheel weight (carreal.ts F1_AERO).
   CRASH PARTS round 2 (owner, a shot of an F1 with its wing still on beside the bar it shed: "the
   emitted part ... doesn't match what's on the car ... the emitted parts can be damaged slightly"):
   a thrown part is CUT FROM ITS CAR'S OWN SPRITE (render/carparts.ts: bumper / wing / panel, an
   open-wheeler's front wing / rear wing / sidepod) - its shape, paint and accents - chipped at the
   edges, scuffed, dented, sometimes bent (seeded); the car is drawn WITHOUT it from then on (a
   closed car's bare structure, an open-wheeler's part gone) until a repair (_partshot.mjs).
   AFTER THE PASS (owner: "do all cars have vehicle accurate bumpers / pieces to emit?"; "seems like
   golf etc wasn't emitting"): the same rule for every car (damage by the speed change, not the
   car - _parttest.mjs: no part under ~8 m/s, ~0.9 a head-on hit at 12 m/s, always at 18); a real
   Golf crash at 22 m/s (_crashparts.mjs) shed its front bumper - thrown ahead under the car hit,
   a 3-4 px strip in body colour, easy to miss: bumpers now cut 5 px deep (~0.3 m, the lamps in
   it); the autograss buggy sheds its nose / side pods as an open car (its wing / panel cuts were
   empty; _partsheet.mjs). WISHBONES ("don't line up or move with steering on f1 / f2"): drawn
   with the wheels now (render/cars.ts drawWishbones) - two arms from the chassis to each hub, the
   front track rods turning with the wheel (_steershot.mjs).
   PASSED + DEFAULT 11-07 (owner: "parts coming off pass"): ?partsoff (owner: "can they have a chance to come off in smaller knocks but keep
   it low and if it comes off it shouldn't be on the car also"): a corner hit of 0.08-0.3 knocks
   its part off up to 6 % of the time (world/debris.ts SMALL_P; _parttest: dv 5 m/s 0-3 %, 8 m/s
   5-10 %, was 0; 12+ as before); a lost part is CLEARED from the car, only a dark structure
   line on its inner edge (render/carparts.ts atInner; _lostsheet.mjs).
   + (owner: "doors should be drawn laying flat when emitted ... like all parts, other than
   wheels"): a closed car's thrown part is drawn LYING FLAT on its face at its real size
   (render/carparts.ts flatPart: a bumper as wide as the car with its lamps, grille / tail lamps and
   plate - a muscle car's chrome, a stock car's steel; a wing with its wheel arch and indicator; a
   door with its window frame, crease, handle, pinstripe); an open car's (F1 wings, pods, the
   buggy's nose) stays cut from the sprite - seen from above it is lying flat; the damage lighter
   (chips 8 %, dents 4 %); _flatsheet.mjs.
   NEXT TO DISCUSS (owner: "can worse crashes have a chance to emit more parts like exhaust and
   engine blocks and any others you think are good - discuss first; they should all be accurate to
   the vehicle"; then "your choice sounds good - how about wishbones and suspension struts too?
   size / their sharpness ... how likely they are to cause punctures"). PASSED + DEFAULT 11-07 ?bigparts:
   carbits.ts (each car's exhaust pipes + layout, bonnet, boot lid or spoiler, engine place +
   cylinders + layout); world/debris.ts bigParts - a BIG_HIT (0.5+) end-on corner: bonnet 14 %,
   exhaust 17 %, boot / spoiler 12 % (both corners: ~2x a crash), a side hit a mirror 12 %, the
   engine only from 0.8 at its own end 4 %; a wheel off takes a strut 40 % / wishbone 25 % (an open
   car two wishbones 60 / 25 %). _bittest.mjs (100 hits, Golf): 50 km/h front bonnet 28, rear
   exhaust 40 / boot 20; 80 km/h engine 10. Masses / sizes (cones/coneConsts.ts DEBRIS: engine 140
   kg), punctures by sharpness (physics/punctures.ts: run over a wishbone 14 %, strut 10 %, engine
   12 %, spoiler 6 %, bonnet / boot 3 %, mirror 2 %). Drawn: the bonnet / boot / spoiler cut from
   the sprite (they lie flat); the exhaust, mirror, wishbone, strut, engine drawn for the car
   (render/carparts.ts drawnBit); the car shows the bay, an engine in it unless gone, the wing
   left out by its painter (spec.noWing), mirror and pipes gone. _bitsheet.mjs, _crashparts.mjs.
   + ROLLS (owner: "maybe rolling increases the chance for all parts as it's a hectic crash"): each
   time the body meets the ground (damage.ts hitRoll) the face that hit sheds what it carries
   (world/debris.ts rollParts: a side - its mirror, doors, wings, the spoiler; the roof - the boot
   lid / spoiler, mirrors, bonnet, exhaust; back on the wheels - bumpers, exhaust, rarely the
   engine), the harder the likelier. _rolltest.mjs, a Golf, a 1-turn roll from 8 rad/s, per 100
   rolls: mirror 93, door 66, wing 45, boot 21, bumper 21, exhaust 15, bonnet 10, engine 1.
   (Wheels still come off as before - owner: "I see them upon more testing".)
   11-07 later (owner: "front wishbones etc don't link up to the body on f1 car? no drive shafts
   either; can drive shafts also be an object that can come out"): the open cars' arms meet the
   NOSE at the front axle and the GEARBOX at the rear (they started at the sidepods' width, in mid-
   air), the buggy has them too, DRIVE SHAFTS to the driven wheels (render/cars.ts drawWishbones:
   by spec.drive); a driven wheel torn off may throw its drive shaft (50 %: world/debris.ts
   wheelBits; 8 kg, puncture 6 % run over, drawn with its CV boots). ROLL SPARKS ("if they land on
   their wheels again they can continue sparking - check it can't spark on soft surfaces even if
   rolling"): car.sparks cleared when the roll ends back on the wheels (only a reset did), none
   while on its wheels mid-tumble, the ground read under the car (was the surface it tipped over
   on): _rollspark.mjs - 0 sparking steps on grass, 0 after landing. HIGHWAY BALES ("I hit one and
   it was hard"): PASSED + DEFAULT 11-07 (owner: "nice flip that") - loose objects as everywhere else (highway/fields.ts
   addBale; were solid props): _hwbale.mjs, a 90 km/h hit bursts one into straw. MENU HIGHWAY TRAFFIC ("no traffic on menu highway
   races?"): on - it was left out when the menu raced only circuits (game/session.ts).

Then, to work through when it fits (owner 11-07, not ordered):
- HIGHWAY LINE: "does the ai need a racing line on highway? if not can we get rid of it - it's
  causing all the ai to swarm to the centre upon start". READ: the highway line (ai/roadLine.ts)
  is the carriageway's MIDDLE; since lineback (passed 11-07) every line the gap picker tries pays
  LINE_COST 3 a m off it (ai/gapPick.ts placeCost), and the rejoin steers back to it - so the
  grid is drawn to the middle. Likely fix (one AI): on a road with no fast line (a straight
  carriageway, every lane as quick) the line costs nothing anywhere on the road - measure the
  start (_rollhw.mjs) and weavecheck / pacesuite first. Ask before building.
  PASSED + DEFAULT 11-07 (owner: "lanes pass too") ?hwlanes (owner "carry on"): a line may have LANES (ai/roadLine.ts: the highway's
  lane centres) - every lane as good as the line: a driver KEEPS ITS LANE (driverLane.ts laneStep:
  no blend onto the middle at the start; held while it goes round a car - a lane read mid-move ran
  away with the move, weavecheck 0 -> 4 hits - then the nearest lane, the move folded in), the gap
  picker's line cost from the nearest lane (gapPick.ts placeCost). _hwstart.mjs (9 AI, 2 runs):
  8-12 s after the green, within 1.5 m of the middle 31-44 % -> 11-21 %, spread 2.0-2.5 -> 3.2-3.4 m;
  weavecheck 0 = 0; pacesuite (deterministic): racer contact 714 -> 409, racer-traffic 2 -> 103 -
  8 of 9 races near clean, ONE pile-up (seed 77 d2: rr 402, rt 80) has nearly all of it (off: rr
  spread over 5 races); passes 3.4 -> 4.7 / km, mean 128 -> 129 km/h.
- HIGHWAY TOO EASY: "ai don't dodge properly" - find out what they miss (traffic, the player,
  wrecks) with a measure first.
- MORE HIGHWAY FLAVOURS once the above is worked out.
- ONLINE MULTIPLAYER (with I): a player too far behind is LEFT BEHIND (the endless road would grow
  past memory) - a hard limit by time or distance; the place at that limit is the result (first
  out of a 10-car race = 10th).
- COLOURED SPRINGS AND DAMPERS with the SUSPENSION UPGRADE (owner 11-07: "can upgraded suspension
  have different colour springs and dampers - when we do that"): the upgrade's brand colours on
  the strut a wheel throws (render/carparts.ts flatStrut) - with the upgrade system.
- ANTENNAS + A CB RADIO (owner 11-07: "the subtle accents make a huge difference to the players eye -
  even a few pixels can hint at things like antenna - maybe cars should have antenna? bolt on push
  to talk cb radio as an upgrade? ... talk to me about it when it comes to sound"): a few-pixel
  antenna on the cars that have one (roof / wing whip, a rally car's), and a bolt-on CB radio
  UPGRADE with push-to-talk - DISCUSS WITH THE OWNER when the sound work (G) comes up.
- ROLLING LOOK (owner 11-07: "a discussion about how cars look when rolling / if they are actually
  3d or not? I assume not - if not their animation when rolling needs to look more smooth and less
  dice roll but still work that way underneath"): NOT 3D - a rolled car is drawn as flat FACES
  (top / side / underside, render/cardamage.ts rolledFaces + drawFaces) picked and squashed by the
  roll angle, so it flips face to face like a die. DISCUSS: smoother in-betweens (more faces / a
  continuous squash and shade by the angle, the side face growing as the top shrinks) on the same
  roll physics underneath (roll.ts). Mockup / plan with the owner first.
- SIDE DRAFTING ("especially for naffcar"): the wake (physics/wake.ts) beside a car, not only
  behind it. With it the Naffcar extras from the roadmap (docs/specs/roadmap-2026-10-03.md G):
  active AIR BRAKES / cowl flaps, aero parts as upgrades; and DIEATONA (below).

## Where we are (2026-11-04)

- DEFAULT 11-04 (owner: "lean hud pass"; the car list, TUNE panel - and src/tune.ts, its data - CLEAR, their
  keys and the guide's CAR + TRACK step deleted): hudlean (owner: "remove any in game tuning so no car changing once
  a race has started remove the button / list also remove tune and clear tyre marks - pause
  restart and reset can stay") - no car / level chip, no TUNE, no CLEAR, nor their keys (c, l,
  1-5, [ ]); the RESTART row takes the top-left on a phone (hud/layout.ts). uicheck with it: HUD
  reachable, no overlaps at 6 sizes (its car-chip tap test skipped under the switch).
- TRIED 11-04, NOT kept: ?aiclear, the unified clearest line (owner "yes": check the corner line on
  arrival for oil / glass, loose objects, lamp posts AND stopped cars; apex shifts, then moves across
  the whole corner of 1.5 / 2.5 m, up to 0.8 m past the edge). _stopcar.mjs, 9 runs: off 412 hits,
  apex shifts only 409 (no gain), with the moves across 578 (WORSE). The last-moment dodge (R5)
  already does the stopped car better: a line chosen on arrival is wrong once the car is shoved,
  and a whole-corner move runs the line where it should not. Owner to say how to go on.
- PASSED + DEFAULT 11-07 (owner: "make those tweaks and then it's a pass", with ?lineback / ?onroad):
  ROUND 3 - ON THE TRACK the soft rejoin again (owner: the 8 deg return "correct[s] on track a bit
  aggressively to the racing line and cause[s] crashes ... softer when on track so they keep their
  natural line finding"); OFF IT the angle grows 3 deg a second off, 8 -> 14 deg ("the longer they
  are off the track the harder they try"). Longest trip 4-5 -> 3.6-3.8 s (20 AI, dry x2, rain);
  fields 2 x 24 races: incidents 117 = 117, passes 366 -> 398, contact 309 -> 311 s (seed noise:
  one set 65 vs 57, the other 52 vs 60). ?rejoinfast ROUND 2 (owner: "I think the return to track is too soft still";
  "they drive wide for the most the next straight"; "steering harder the further away ... a great
  idea"). The off-track-only 3.5 m cap is replaced by ONE rule: come back AT AN ANGLE, as a racer
  does - the cap aims the car 8 deg across its line, never more than the gap left (ai/rejoin.ts
  RETURN_ANGLE), on the track or off it. A cap growing with the gap (0.5 m a m) asked more turn than
  the grip has (full lock, lifting); 6 deg left 10 s trips on the grass; 10 deg cut back across the
  pack (7-10 spins, 58-62 km/h). 8 deg (real game, stock car oval, 20 AI, 3 runs): 68-72 km/h, 3-5
  spins, racing off the track 1.4-2.6 %, the longest trip 4-5 s; circuit fields incidents 54 ->
  49, contact 69 -> 59 s, passes 95 = 95. First-corner spins in the rain (owner): not reproduced -
  rain 0.8, 20 AI, diff 2: 0 spins at the first corner in 3 runs.
- PASSED + DEFAULT 11-07 (owner: "puddle rule seemed to work fine - that can pass"): ?wetrace - owner: "ai shouldn't avoid water / puddles tho, they seem to
  actively steer and slow to avoid? they should dodge at speed and remain racing, maybe ideally
  avoiding water if they can but without slowing too much"; "in rain they should look for dry
  lines forming / stay on the track even if covered in water, just a soft / attempted dodge of
  water is ok"; "keep it simple - simple rules to create complex behaviour". CAUSE (read): the
  racing line is made once at the start from a grip map that saw the puddles there (its surface
  bias is for dirt vs tarmac), so it went round them; the speed plan re-read the grip at every
  change of water and braked for each puddle on the line. RULE: standing water is not planned
  round - the line and the speed plan read the (damp) ground under a puddle (ai/line.ts lineMu);
  the driver's feel for grip handles the slip; the damp stays in, so the racing line (driven
  dry first) is the drying line; a puddle on a corner's line is a hazard like oil and glass - the
  corner line moves off it if a way is free (ai/cornerLine.ts). MEASURED (real game, Thruston,
  ?rain=0.8, 6 AI, 2 runs each): off, the AI never touched a puddle (0-0.8 % of their time);
  planning 0 / 30 / 60 / 100 % of a puddle's grip loss all gave 73-76 km/h and 3-8 % off the
  track (the rain's own) - so none (the simplest).
- PASSED + DEFAULT 11-07 (with ?rejoinfast): ?onroad (with ?lineback) - owner, with a photo of grooves worn in the
  grass of the stock car oval "after 1 lap", 21 cars: "still loads of cars driving wide". THE
  FULL GRID was the difference (tests had 6 AI). MEASURED in the REAL GAME (tools/scratch/
  _ovalfield.mjs: rolling start, player on autopilot, 20 AI, diff 2): AI off the track 5.8 % of
  the time (6 AI: 0.3 %), 19 % in the 10 s after the green, up to 25 m past the edge. Rule (owner
  OK): past the track's edge only round a car stopped or crawling (< half my speed) - a racing car
  is passed on the track or followed (ai/driverTraffic.ts offTrackOk). With ?lineback&onroad:
  3.5 % (peak 8.4 %, furthest ~10 m). STILL OPEN: the rest is the post-green CRUSH at the first
  bend - cars jam to ~8 m/s and some drift far off their target (a trace: target ~3 m off the
  line, the car 7 -> 17 m off, into the infield) and then recover slowly across the grass
  (spun / pointing the wrong way). tools/scratch/_wide.mjs ROLL=1 recreates it in node (TRACE=<car>,
  FREELOG=<reason>).
  ROUND 2 (owner 11-05: "still seems like ai is racing wide off the track on stock car ... full
  grid or not it shouldn't happen"; "they should get back to the track smoothly but quickly like a
  real racer"): photos (tools/scratch/_ovalshot.mjs) show the groove INSIDE the inner kerbs; the
  real-game log (_ovalfield.mjs OFFLOG=1: each off-track car's state) found (a) after a MISTAKE a
  car drove along the grass 5-11 m out for 10 s up to 29 m/s - the soft rejoin cap (0.7-1.2 m)
  barely closed it; (b) ?onroad let the field past the edge if a crawling car was ANYWHERE ahead
  (after a first-bend crash: everyone). Now ?rejoinfast: past the edge the rejoin cap is 3.5 m
  (ai/rejoin.ts REJOIN_OFF) - the look before pulling on still holds it for a car arriving; and
  ?onroad counts a crawling car only IN MY WAY (driverTraffic.ts MARGIN_WAY). MEASURED (real game,
  20 AI, "racing off the track" = past the edge above 10 m/s): plain 3.6 %, lineback+onroad 1.7 /
  3.8 %, + rejoinfast 1.2 / 1.0 %; longest trip on the grass 5.8 s plain, 6.4 / 16.2 s ->
  4.4 / 2.0 s. Fields: incidents 55 -> 56, passes 92 -> 95. Highway: weavecheck 0; pacesuite 0
  bad, racer contact 714 (lineback alone 58, plain 186) - FROM ?onroad (racers no longer use the
  verge round each other), traffic contact 2 - told the owner.
- PASSED + DEFAULT 11-07 (with ?rejoinfast): ?lineback - owner: "some ai seem to drive very wide around the outside
  of the track? especially noticeable on stockcar track"; "no going 10m wide seems wild".
  MEASURED (tools/scratch/_wide.mjs: a field on the stock car oval; share of the race off the
  line, why): a lone car is > 2 m off 2 % of the time, a field 14-33 %. Two causes: (1) the gap
  picker had nothing saying the racing line is quicker - round a pack it took the free line by
  the outside wall, then kept it (its commit bonus) while any car was in reading distance; (2) an
  attack round the outside aimed 1 m inside the far edge - 10-11 m off an inside line. Fix:
  every line the picker tries pays LINE_COST 3 a m off the racing line (ai/gapPick.ts
  placeCost), and an attack aims BESIDE the car attacked (ALONG_GAP + 0.3 m), no wider than
  that edge (ai/driverLane.ts attackAim). 4 seeds: by the wall (> 8 m) 2.8 -> 1.9 % of the time;
  2-4 m off goes up (racing side by side in an attack). Fields (4 tracks x 3 seeds): incidents
  57 -> 42, contact 48 -> 49 s, passes 87 -> 100. Highway: weavecheck 0; pacesuite 130.7 km/h,
  racer contact 186 -> 58, traffic 99 -> 51. TRIED, NOT kept: the gap picker going round only
  cars I close on (> 1 m/s slower) - the highway's racer contact 186 -> 1196.
- PASSED + DEFAULT 11-04 (owner: "pass both", with ?oneai / ?brakeread): ?hwshare (AI rework R8 stage 1, one AI; owner "ok") - the highway driver
  gets the circuit driver's reflexes: the foot that feathers wheelspin (ai/driverFoot.ts, now any
  driver) and the road read ahead by skill, 2.6 .. 3.8 s (was 3.2 for all; weaver.ts look).
  pacesuite (9 races): mean 129.2 -> 131.2 km/h, contacts / off-road the same, 0 bad; weavecheck
  45 scenarios: 0 hits, 0 spins either way. STAGE 2 (one steering law) TRIED 11-04, NOT kept -
  no single setting works on both: the highway's law with a speed-blended aim (heading < 20 m/s,
  course > 35) kept circuit laps as quick but highway races got 3x the racer contact (99 -> 305);
  the course aim everywhere kept the highway as it was but circuit fields got 28-68 % more
  incidents (Realish 113 -> 144, Real 103 -> 173). Patch kept: tools/scratch/_oneai-stage2.patch
  + _oneai-steerLaw.ts. Owner to say (one law needs more work, or the steering stays per road).
- PASSED + DEFAULT 11-04 (owner: "ok pass both"; formation starts "pass"): ?oneai (AI rework R8 stages 2-4, one AI; with ?hwshare). DONE ON THE FLIP: the weaver (ai/weaver*.ts, 790 lines) and game.start.drv deleted; driveOut moved to ai/driveOut.ts; the old car look (dodge.ts lookAhead 0.8 .. 2.1 s) replaced by the gap look (2.6 .. 3.8 s); switches hwshare / oneai / brakeread gone - the circuit
  driver drives the highway: the circuit's steering law (ai/steerLaw.ts), a line down the middle
  of the lanes made per road piece and smoothed (ai/roadLine.ts), and GAP SPOTTING for every
  driver (ai/gapPick.ts: lines across the room scored by free road ahead, read 2.6 .. 3.8 s by
  skill; round on the road first; boxed in -> late braking, 90 % planned). MEASURED: weavecheck
  45 scenarios 0 hits at diff 2 and 4 (the circuit driver alone: 29-30); pacesuite 9 races
  130.0 km/h (stage 1 131.2), 0 bad, 0 off-road; circuit fields (4 tracks x 3 seeds, diff 4)
  incidents 67 -> 29, contact 126 -> 45 s, passes 115 -> 101 (off runs vary 96-118). Tried and
  NOT kept (weavecheck repeats exactly: 13 -> 18 hits): more room with closing speed, a
  lane-changing traffic car's target lane, no swerving past a car alongside. On a pass: delete
  the weaver's steering / speed / lines (one system), the switch and the hwshare / oneai paths.
  HIGHWAY ROLLING START (owner 11-04 on the test: "rolling starts seem not to hold formation on
  highways"): the race driver ignored the hold and raced for its line before the green - cars
  strayed up to 5 m off their grid lanes and 9.6 m out of place (tools/scratch/_rollhw.mjs). Now
  the circuit's formation (ai/formation.ts) runs the highway too, read along the road: lane drift
  <= 0.08 m (the old highway AI 0.24), place slip <= 4.8 m (the same as before - 6 s is too short
  to settle every launch). On a pass also delete game.start.drv (the highway's old start driver).
  THEN (owner: "can we fix that"): one car ran 4.5 m into the next slot mid-launch - every car aimed
  at the pace from a standstill, so a driver with more power (traits.power) launched harder at the
  same throttle. Now the field keeps station on the POLE's own speed (the pole aims at the pace):
  closest pair 0.71 -> 3.3-3.5 m (old game 2.3-3.1), place slip <= 0.2 m; circuit rolling starts
  (_rollstart.mjs naffcar / stock-car) unchanged, closest 4.06 / 3.66 m (was 3.89 / 3.68).
- PASSED + DEFAULT 11-04 (owner: "ok pass both"): ?brakeread - owner: AI "crash into the back of me
  coming into a corner a little too often", "don't seem to be great at avoiding even on highest
  difficulty can we ramp that more", "ai should dodge here n over take". CAUSE (tools/scratch/
  _reartest.mjs: a careful lead - the bench driver, braking early as a careful player does - with 3
  AI behind): following assumed the car ahead slows as the AI itself would there (its own profile),
  so behind an early braker it arrived 4.3 m/s too fast with 0.93 brake on. Now each driver READS
  the car ahead's braking (its slowing, differenced over 0.1 s), half of it at skill 0 .. all of it
  at skill 1, and - only where there is no way round (sitting behind, or boxed in) - keeps a speed
  it can still match it by (ai/dodge.ts readBraking / matchSpeed); with a side free it still goes
  round. MEASURED rear test (3 tracks x diff 2/4 x 2 seeds): nose-tail touches 389 -> 200, hard
  (> 3 m/s) 6 -> 7 (those are swerves begun too late, not following); fields incidents 64 -> 48,
  contact 48 -> 37 s, passes 94 = 94; highway unchanged (weavecheck 0, pacesuite 0 bad).
- PASSED 11-04 (owner: "that seems way better pass both"), now the default, switches deleted:
  ?halfcar - racing's overlap rule (owner: "if a car
  has the lead (half a car) over another car they have the priority on racing line and the car
  behind even if it's side by side still yields to it"): half a car or more ahead keeps its line
  (no chopping across: it holds where it is if its line closes on the other); the car behind,
  its line across the leader, drops 0.5 m/s under it to tuck in behind; truly side by side as
  before (both keep 2.4 m, the inside gets the corner). Fields (4 tracks x 3 seeds, diff 4):
  incidents 62 -> 40, contact 50 -> 72 s, passes 119 -> 94 (noisy).
  ?rejoinlook - look before pulling on (owner: "make cars look before pulling onto the track"; "yes
  mirror check"): a car at / past the edge coming in by > 1 m holds its place on the edge until no
  car on the track arrives within 1.5 s (the gap picker's mirror) or sits alongside on the lines it
  would cross (ai/gapPick.ts rejoinClear). Fields: incidents 44 -> 49, contact 64 -> 42 s, passes
  122 -> 145 (noisy; rejoins are rare there). Highway with both: weavecheck 0 hits d2/d4;
  pacesuite 129.8 km/h, 0 bad, 0 off-road, rr 347 -> 186, rt 393 -> 99.
- AI ORDER (owner 11-04): R6 SKIPPED ("doesn't seem like an issue anymore"), R8 one AI
  DONE 11-04 (passed, default); NEXT R7 (a menu race on a random track, a chance of the highway) -
  ask before building. R4 part 2 (felt
  grip) not needed (measured); weak-driver OVERDRIVE declined - "only push up crashes", not unless
  the owner says. Always get permission before building. DEFAULT 11-04 (owner: "mark jump pass for now unless I see it
  again" - WATCH for it): markjump (owner: "a rim mark appeared after I reset my car / on soft
  surfaces like it shouldn't", a phone shot) - MEASURED (_resetmark.mjs, _aireset.mjs): the player's
  RESET draws nothing after (rims cleared, 0 stamps, 0 cells worn, also with two tyres on the rim);
  an AI RESET (game/ai.ts aiReset) stroked each wheel's mark from its old spot to its new one -
  36 m across the grass (39 stamps in 0.3 s after, 22 with the guard). marks.ts stampWheel: a
  wheel that moves > 3 m in a step starts a new mark (the wear's own guard, wear.ts). The brown
  square under a car that ran off on a rim is its DIG (rims wear soft ground 3x, passed 11-03).
- DEFAULT 11-04 (owner: "ok pass"): dodgefar (owner: "nudge up dodging? so drivers look and swerve slightly
  further ahead but still a gradient with skill"; "make them avoid lamppost too in case they end up
  off track") - cars read 0.8 (skill 0) .. 2.1 s (skill 1) ahead (was 0.6 .. 1.6), loose objects
  0.3 s further (ai/dodge.ts); standing lamp posts within 45 m join each AI's obstacles (game/ai.ts)
  and are steered round off the road too (driverTraffic.ts offRoadSkip). MEASURED: stopped car (9
  runs) 413 -> 346 hits; fields (6 seeds) Realish incidents 102 -> 85, Real 138 -> 115, passes
  228 -> 210 / 268 -> 219; lamps knocked down (15 AI x 90 s, Thruston + Brands + Castle Cum) 6 -> 3.
  Off-track dodging: round a car in the way the AI may use 0.8 m past the edge, 2.5 m round a
  stopped / slow one (driverTraffic.ts WIDE / WIDE_SLOW). NEXT (owner "yes"): one line choice per
  corner clear of everything (oil, glass, cones, tyres, stopped cars, posts), wide / just off the
  edge if needed, the fastest clear one, by skill.
- DEFAULT 11-04 (owner: "test passed"): ailook (owner: "the different way approach sounds like a good idea") -
  on arriving at a corner a driver checks the line it chose through it for fresh oil / glass (its
  middle and wheels) and takes the nearest earlier / later apex (b +-0.3, +-0.6) that misses it;
  a weak driver may not see it (half the time at skill 0); once a corner, a few dozen map reads.
  MEASURED (_oilline.mjs, 9 runs): on the oil 46.3 -> 36.6 s (Thruston 14.3 -> 8.0, Castle Cum
  13.8 -> 8.6, Brands 18.2 -> 20.0: no near line misses it there); off-road 17.2 -> 19.0 s. Tries up
  to +-1.2 ran Brands wide (2-3 -> 10-11 s off-road): kept to +-0.6. On the oil the AI already
  slows (its plan's grip) and its foot / slide control manage it (owner asked; felt grip needless).
- DEFAULT 11-04 (owner: "pass and yes please" - the next step wanted): ailines (owner: AI should not all follow one line; vary by corner and
  lap, pros consistent; "keep it computationally cheap") - ai/cornerLine.ts: through each corner
  a driver holds the racing line SHIFTED ALONG the track by b (late +, early -; 20 m at b = 1,
  tapering to the corner's ends); b = its habit for that corner (spread 0.15 skill 1 .. 0.9 skill
  0, a good driver leaning late for a car with power over grip) + a fresh draw each arrival (0.14
  .. 0.73). A sideways nudge was tried first: the road clamped it (the line is by the edge in,
  at the apex and out). Cost: a lookup + a cosine a step (the windows once per line). MEASURED
  (_lines.mjs ghosts, Thruston 6 x 5 laps): spread between drivers 15 m either side of the apex
  0.10 -> 0.26 m; lap to lap 0.05 m (skill 0.92) .. 0.12-0.25 m (weaker); laps +-0.2 s. Fields (6
  seeds): Mobile incidents 75 -> 72, Realish 116 -> 115.
  TRIED 11-04 and NOT kept (owner: "yes please" to both; tools/scratch/_oilline.mjs, _lines.mjs):
  (1) a line round FRESH OIL / GLASS (wear cells read along the line ahead, handed to the loose-
  object step-round): 4 versions, every one put the field on the oil MORE (9 runs 44.9 -> 62.8 s)
  - a cell at a time stepped onto the next cell, a circle round a long patch sent it across the
  road through it, a swerve judged on the swerved line let go into it; a different way needed
  (owner to say). The AI already SLOWS for oil on its line (its grip map). (2) THE NEXT CORNER (a
  late apex before a long straight, earlier before a short one): no change, +-0.1 s every driver
  on 3 circuits - the racing line is built from the whole lap and already allows for it.
- DEFAULT 11-04 (owner: "they seem to dodge better at harder
  difficulty to me so pass"): aidodge (AI rework R5; owner: skilled drivers avoid collisions more;
  "do improved dodging first or it's going to increase crashes") - MEASURED (_stopcar.mjs: a car
  stopped across the racing line past the tightest corner, 6 AI x 3 laps): 11-34 hits at 50-90
  km/h, the most skilled driver no better (4-14). Causes: a car was a POINT (~2.1 m kept from its
  centre); one 1.1 s look-ahead for all against a 2.5 m/s swerve; no braking to make the swerve;
  and the ATTACK logic picked the stopped car as a car to pass and drove into it at racing pace.
  Now (ai/dodge.ts): a car's real size across my path, 0.6 (skill 0) .. 1.6 s (skill 1) ahead,
  braking until the swerve fits, a stopped / crawling car never an attack or cover target. Hits
  Thruston 11 -> 10, Brands 34 -> 8, Castle Cum 32 -> 20; the skilled driver 0 / 1 / 1. Fields (6
  seeds): Realish incidents 103 -> 106, Real 113 -> 99 (noise both ways). NEXT (owner): lines by
  driver and corner (habits, a fresh choice per corner for traffic / hazards / the next corner,
  skill = consistency), CHEAP.
- DEFAULT 11-04 (owner: "both seems like pass"): aigrip (AI rework R4 part 1, A9 icy starts) - MEASURED
  (_icestart.mjs, Thruston, ice laid over the grid, 6 cars): the AI held full throttle - a muscle
  car's rears spun at 32 m/s at 0.3 m/s, 3-10 m in 10 s, still 9-13 s (reset after 3); then its
  slide FEEL (a slip angle, noise at a crawl) shut the throttle and DRIVE OUT reversed it on the
  ice. Now: the foot feathers GROSS spin (ai/driverFoot.ts: 2.5 m/s + 2 x (1 - skill) let through,
  or 25-60 % of road speed), the feel waits for 4 m/s, and drive-out and the game's stuck reset
  call a car going forwards and gaining 0.08 m/s TRYING. Muscle 5-14 m, hatches 14-33 m (stuck
  ones 1 -> 14, 0 -> 23); dry launches muscle 99-113 -> 107-122 m, hatch same; RX races (rally,
  Knobhill + Slidden, 3 seeds) same or 0.2-2 s faster. ROUND 2 (owner: "shouldn't ai especially
  more skilled ones realise the slip and feather the throttle? like players have to"): on GRIPPY
  ground the foot holds 12 % (skill 1) .. 37 % (skill 0) of road speed, loose still 25-60 %:
  muscle at Brands exit spin 2.9 -> 2.3 m/s (peak 9.9 -> 7.1), 76.9 -> 75.5 s a lap; Mobile
  driver 4.9 -> 2.9 m/s, Real 3.5 -> 1.9 (worse drivers spin more, react later - owner OK); RX
  races and icy starts the same. Part 2 (B3 felt grip) MEASURED 11-04
  (_feltgrip.mjs: a lone AI with its tyre grip x0.85 / x0.7 / x0.8 it does not know about) - no
  problem to fix: Thruston 46.8 -> 47.2 / 49.2 s, Brands 72 -> 73.5 s, never off, no spins (its
  slide / understeer feedback catches it); the grip it plans by is what is drawn (covers). ON HOLD
  - owner to discuss (weak drivers over-driving on purpose would be a behaviour choice, not a fix).
- DEFAULT 11-04 (owner: "both seems like pass"): puffroom (owner: "smoke dust and other things still seem to pop out /
  vanish sometimes? can we make that cost less / increase the budget?") - MEASURED Knobhill 60 s
  (_puffwatch, _fxpools): 5 AI never filled the 640 puff pool; 19 AI sat at 640 and cut 1796-3781
  puffs short, and filled the 400 crash chips (830 vanished ON SCREEN). Now (render/fxroom.ts):
  puffs 1600 and drawn for less (one transform a pass, the colour set on change, off-screen
  undrawn); chips 1200, a full pool drops the farthest chip, faded over 1 s if on screen. 19 AI:
  puffs cut short 0; chips vanishing on screen 830 -> 21. Draw ms at CPU x4: 49.3 -> 47.0 median,
  64.7 -> 53.1 p95 (cheaper with more on screen).
- DEFAULT 11-04 (owner: "okay pass"): aibands (owner: "ok" to: difficulty drives skill, risk and aggression
  together; the sliders out of the player's setup) - presets RISK 0.38 .. 0.5 .. 0.62 and
  AGGRESSION 0.40 .. 0.5 .. 0.60, Mobile .. Realish .. Real (ai/tune.ts); in a field a driver
  0.1 skill above the centre takes +0.03 risk (ai/traits.ts SKILL_RISK), the crash cost of risk
  still on the weak; AI DRIVERS only with ?dev (menu/setup.ts aiPanel). Fields 6 seeds: Mobile
  incidents 67 -> 70, passes 243 -> 256; Real 83 -> 94 (Naffcar 24 -> 46), passes 156 -> 150.
- WATCH (11-04, seen once in 4 menucheck runs, 844x390, the MENU DEMO car hatch-rwd stuck at
  v 0.0): "[car sim] car state went bad - recovered with a reset. Cause: vehicle: non-finite
  state [x] = NaN {vLong: NaN, vLat: NaN, slipF: NaN, slipR: 0, FzF: 6989.6}" x3. Not seen on
  the commit before nor on 3 reruns; the game recovered it. New - find the cause if it comes back.
- OWNER 11-04 on the AI DRIVERS sliders: "maybe I don't need the sliders, leave em for now and
  discuss how it works with me ... maybe I'll ask you to remove them as we don't need normal
  players having this control". Also: "worse drivers might take risks but not be able to
  control the car and crash; skilled drivers would take more risks maybe but control the car,
  crash less and overtake more" - to discuss (the presets move only SKILL today).
- DEFAULT 11-04 (owner: "ok pass"; the panel kept for now - owner: "leave em for now and
  discuss how it works with me ... maybe I'll ask you to remove them"): aisliders (AI rework R3 + K15; the owner's OK'd mockup, "leave it as
  is and let me test") - test setup AI DRIVERS > (menu/aidrivers.ts): the five difficulties as
  presets (CUSTOM once a dial moves), six field dials (ai/tune.ts: skill, spread, risk,
  aggression, defence, mistakes), the field's skill strip, RESET, BACK; remembered
  (carsim.aitune). Per driver (ai/traits.ts tunedTraits): RISK (persona + chance round the
  dial) -> braking grip K_BRAKE + 0.1 x (risk - 0.5), pace +3 % a unit, mistakes x (1 + 1.2 x
  (risk - 0.5) x (1 - skill)) - a risky weak driver crashes more, a skilled one hardly (owner:
  "higher skill drivers ... faster and more aggressive and still not crash too much"); SKILL ->
  pace +6 % a unit over the difficulty's centre, aggression +0.2 a unit, a weak driver's power
  down to 0.95 at skill 0 (owner: "keep it but not that extreme"). Presets alone ~ as before
  (fields 6 seeds: Realish incidents 88 -> 86, Real 78 -> 89, noise). "AI should try to avoid
  crashing, especially high skilled" -> R5.
- DEFAULT 11-04 (owner: "pass"): jokerflow (owner: "some cars still turn slow for jokers tho rather
  than flowing in / out naturally") - the joker branch was the lane's CENTRELINE glued to the
  line: R 19 m kink in (AI 85 -> 32 km/h), R 18-26 m out (34-41 km/h where the line runs 70-80),
  though Knobhill's lane is 12 m wide. Now its own minimum-curvature line in the road + lane, ends
  tangent (ai/branchline.ts), 50 m in / 60 m out to blend: tightest R ~36 m, in 92 -> 59 km/h,
  rejoin plan 43 -> 104 km/h. Joker lap cost (aijokercheck, 3 seeds): Knobhill +6.5 -> +3.2 s,
  Slidden +4.4 -> +2.0 s; gates still 1; Knobhill off-road 6.0 -> 4.6 s a race.
- OWNER 11-04: "Highway and circuit ai should be the same ai" - ONE driver (today: the circuit
  driver, ai/driverDrive.ts, and the highway's weaver, ai/weaver*.ts, behind one createAIDriver).
  Added to the AI plan as R8 - owner 11-04: "work in order" (last, after R7).
- DEFAULT 11-04 (owner: "ok pass"): aiweave (AI rework R2, the weave fix; ai/rejoin.ts) - no scripted
  wander; a car off its target and not making a move (dodge / attack / cover) rejoins SOFTLY
  (the steering's lateral error capped 1.2 m skill 0 .. 0.7 m skill 1); the bends ahead are
  taken for where the car really is and will be, never for its own mistake. MEASURED
  (_rejoin.mjs, lone car knocked 3 m aside at 6 places): distance lost Thruston 36.5 -> 10.1 m,
  Brands 28.9 -> 16.7; steer peaks 0.3-0.55 -> 0.06-0.44; swing past the line up to 1.9 m ->
  ~0 (one mid-corner knock at Brands 1.4 m). Lone laps same. Fields (12 seeds x 4 circuits):
  Mobile incidents 171 -> 143, contact 755 -> 609 s, passes 551 -> 425; Realish incidents 173
  -> 172, contact 501 -> 463 s, passes 367 -> 370; best laps same (Real not finished: the run
  was stopped for low memory). Field runs are NOT deterministic - use 12+ seeds.
- DEFAULT 11-04 (owner: "quiet bridge pass"): bhquiet - Brands Snatch's two road bridges carry no traffic (owner: the
  cars "vanish when off the bridge / looks fake"; render/props/bridges.ts prop.quiet).
- DEFAULT 11-04 (owner: "mostly good ... generally ok"; switches and old paths deleted;
  highway pacesuite with it: mean 125.2 -> 126.7 km/h, racer contact 383 -> 342, no wrecks):
  aireact (AI rework R1) - an AI thinks every 1/60 s (skill 1) .. 1/30 s
  (skill 0), staggered; pedals glide between thinks, the HANDS steer every step onto the line the
  last think chose (holding / gliding the steering lost 0.5-0.8 s a lap at Naffcar; hands: none).
  Lone car laps same; 4 circuits x 6 seeds x 3 difficulties: best laps within noise, contact /
  incidents / passes noise both ways. 20 AI, CPU x4 (_aiprof): thinking 3.3 -> 2.1 ms a step,
  sim 14.0 -> 12.3 ms a step. ?skillband (owner 11-04) - skill centred by difficulty, Mobile 0.3
  .. Realish 0.5 (default, unchanged) .. Real 0.7, spread by persona + chance (Mobile 0.04-0.72,
  Real 0.44-1.00); Mobile incidents 70 -> 91 (6 seeds), Real same (12 seeds). Owner 11-04: "maybe
  more skilled drivers can avoid collisions even more" -> R5 (dodging by skill). Tools:
  tools/scratch/_reactab.mjs (TOGGLE=, SEEDS=), _skills.mjs, _aiprof Q=.
- DEFAULT 11-03 (owner: pass; every switch and old path deleted, each proved against its tested
  switch - simhash SAME, menucheck, phone shots): REAL CARS (every car on its real counterpart,
  parody names, best-launch 0-100 in the garage); smokelinger, aidust, puffpool (smoke / dust no
  longer evicted early); jokerhint; pit garages solid all round; muscle tyres (fit by class AND
  rim; the Chevvy on Good Yeah Polyglass GT; Micky Tomson ET Streat, BF Goodwrench Radial T/A);
  Castle Cum's DUNFLOP footbridge; Brands Snatch's bridges (Hailwood Hill footbridge, two GP road
  bridges); THE PIXEL MENUS (the owner's logo + "A DRIVING SANDBOX", logo colours, pixel-art
  shaded buttons, ember = locked in, electric-blue blink on press, Silkscreen / Press Start 2P /
  VT323 with one set of digits, landscape a finger in from the notch); THE TEST GARAGE (main
  menu STORY / TEST MODE / SETTINGS; test setup names SELECTED CAR above GARAGE and keeps its
  choices; SELECT locks a car in; TRY + BUY (greyed) in the shops; stock + the tried difference
  in ember); up to 10 AI (a - / + ticker, ten liveries); K12 MUD (rain leaves packed dirt wet
  dirt, mud ploughs 0.35 / thick 0.9, mud tyres plough less, The Rough Patch mud + thick mud
  hills); RESET puts the car all four wheels on the road; BELLY drag (ground clearance in mud /
  sand / ruts, world/belly.ts); the tractor on FIRESTONED Field Luggers and 4WD like the real
  Fastrac.
- DEFAULT 11-03 late (owner: "no issues"): UP TO 20 AI (ai20: MAX_AI 20, twenty liveries),
  aifast (resting loose objects skipped, smoke skips far cars), aisafe (an AI reset mid-step no
  longer throws on joker tracks: _p null in stepAIJoker / recoverAI). Owner's phone (report):
  Thruston 20 AI ~3.5 min sim 2 / draw 2 ms a frame, 0.22 % slow; Knobhill 20 AI at night ~3.7
  min, 0.04 % slow, no reload. The ONE reload (Knobhill, before aisafe: the browser dropped the
  tab, a fresh page) did not come back; laptop at the phone's size (_memprobe) found no leak
  (canvases ~90 MB + JS 35 MB, flat). Owner waived simhash for this round; plain link checked
  with 20 AI, no page errors.
- THE AI REWORK design: docs/specs/ai-rework.md (rounds R0-R7) - owner OK 11-04; R0, R1, R2 done; R3 next (mockup first).
- DEFAULT 11-04 (owner: "Pass"; switches and old paths deleted): drycover - oil / glass / radiator drips never DRAWN
  on a dry track (render/glfield.ts draw skipped the whole field with no weather cover; the
  cells were there and slippery; leaks themselves fine: _leakwatch 4 radiators / 21 cars a min,
  resets mend them - owner: keep). rimsoft - a rim or hub (no tyre) laid tyre marks and
  ordinary wear on soft ground: now no mark, and it DIGS (owner: "degrade soft surfaces faster")
  3 passes a cell - _rimwear: 12 of 12 cells worn a grade vs tyres 5 of 14 (was 1 of 11).
  bushmark - the bush surface's long-grass mark stamped the marks layer OVER standing bushes
  (_bushshot: 676 -> 536 stamps). leafpop - a car BODY ploughing into a bush (owner: the
  body, not the wheels) throws leaf pixels: over the cars while high, then under (render only).
- NEXT (owner order 11-03; 11-03 late: "let's work on AI only"): 1 the AI REWORK (design first,
  agreed before building; GOAL: 20 cars in a race without performance issues, PHONE first, laptop
  too. MEASURED 11-03 late (_aiprof): NO 20-car jump - ~0.15 ms a car a physics step, linear; the
  17.5 ms was the catch-up loop on a flat-out laptop; see the design page); 2 the UPGRADE SYSTEM with the agreed garage
  (below); 3 SOUND (ask about every sound first); 4 STORY (its garage, money, BUY & FIT, "buy
  what you last tested" with tick / untick).
- OWNER IDEAS / WAITING (not ordered yet): SPARKS ON BARE RIMS (a wheel spinning on its rim
  throws sparks by its own speed, the normal spark look once it rolls); TRACK REALISM for every
  circuit (each against its real map + photos, a gap list and screenshots first - Brands
  Snatch's bridges done); CARS LOOK LIKE THEIR REAL COUNTERPARTS (next time we do vehicles or
  visuals); MORE VEHICLES (e.g. an M3 as its own car); SUSPENSION TRAVEL (with the suspension
  upgrade: bottoming out, and it takes clearance in mud - world/belly.ts).
- OWNER 11-03 late, AFTER THE AI: BRANDS SNATCH INDY AT REAL SCALE and at 3/4 scale (two test
  levels: the track surface to scale + AI to race, no full scenery; the circuits are 0.41-0.48 of
  real so their corners are tighter than real - "the full size might be too big still but who
  knows"; needs the world / tyre-mark layer bigger than the shared 520 m). CAR COLOURS: every
  vehicle gets a SECOND and maybe a THIRD colour, changeable in the garage paint (and the AI
  liveries use them, so a 20-car field all differ) - mockup first.
- THE AGREED GARAGE (owner 11-03, mockup "RAC3R Menu Redesign"; MENU REDESIGN just below): the menu
  look is DONE (default); the garage LAYOUT (upgrade bars heading each section, a stat opens its
  upgrade screen, TOUGHNESS, TRAVEL, the units chip) comes with the upgrade system; TEST garage
  TRY vs STORY garage BUY, test wear never reaches story, paint costs in story.

- MENU REDESIGN (owner 11-03, the agreed design; the look is DONE, the garage part comes with the
  upgrade system): LOGO = the owner's own image (pixel shard letters,
  burst, electric blue 3) with its sub line changed to "A DRIVING SANDBOX" in the same chunky
  pixel type. COLOURS = the logo's: near-black, ember red to orange for actions, burnt brown edges,
  electric blue (the 3) for selected / better. NO smooth gradients: buttons PIXEL-ART SHADED (flat
  middle for the words, light top-left bevel, dark bottom-right, 2 px checker dither between shades,
  a few highlight pixels). TYPE: headers / buttons Silkscreen + Press Start 2P (bigger: buttons
  17 px, titles 22 px); stats, numbers and small labels VT323 (18-21 px); ONE set of digits
  (EVERY number in the pixel header face Silkscreen - stat values too - so a 4 is always the
  same 4 and nothing sits off its line; owner 11-03). GARAGE: the upgradeable
  parts' level bars head the sections they apply to (Engine, Drivetrain, Suspension, Body,
  Quality; "also" where two parts move a stat); tap a stat or section -> its upgrade screen
  (levels, now vs that level, gains, price); TOUGHNESS (new, Body: how easily the car is hurt, per
  car from its real build - F1 easy, Volvo / tractor hard, realistic at both ends; measured from a
  50 km/h wall hit); TRAVEL (new: a suspension travel limit - bottoming out, owner: ok); UNITS one
  game-wide setting, a KM/H / MPH chip in the garage and the speedo tap. Every number measured.
- The plain link is the approved game. DEFAULT 10-24 / 10-25 (owner
  "all pass"; every switch and old path deleted, each proved SAME against the tested switch):
  highway street lights L4b + the solid grid; traffic seated when woken, the Sandbox puddles,
  meltwater, ice cracks (E); reversing lights; event lighting F; car lamps that flicker then
  settle by damage; wooden marshal huts that smash; hot brake glow (builds over ~3 hard stops,
  handbrake heats the rears, cold again on RESTART / RESET as the tyres); trees D part 1
  (trunk-only solid, canopies over the cars and dark at night, seasons, firs, weather snow).
  Earlier 10-24: A1-A13 fixes, grass G1, mud M1.
- TYPESCRIPT CONVERSION: DONE 11-03 (src/ is all TypeScript; Queue 2).
- ORDER (owner 10-25): 1 BUSHES (D part 2) - DEFAULT 10-25 (owner: pass); 2 car systems C
  (design + mockup approved 10-25; ROUND 1 - C1 + C2, metal on ground, stingers, highway
  hedges, sparks, crash sparks, flip ramp - DEFAULT 10-25 (owner: all pass); round 2
  C3-C5 DEFAULT 10-25 (owner: pass); C6 oil DEFAULT 10-25 (owner: all pass); C7 debris
  DEFAULT 10-26; C8 post hits, C9 armco dents, C10 open wheels DEFAULT 10-26 - C DONE);
  3 the wearcheck rewrite - DONE 10-26 (tools only, all OK).
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

## OWNER LIST 2026-11-01 (digested; ORDER AGREED: bugs round -> 1 DRIVING ROOT FIX -> 2 AI B)

Owner 11-01: "focus on 1 (driving root fix, real ABS) and then 2 (AI rework B)". Code checked for
each bug below (suspect = read in the code, not yet reproduced; every fix reproduced first).

BUGS (S-M each; ONE test round before the root fix - owner 11-01: OK)
- K1 [DEFAULT 11-02, owner: pass] WET TRAILS ON DRY-LOOKING TARMAC (after snow / ice, or damp with no rain). CAUSE (code):
  world/wet.ts buildDamp gives any hard ground the wet mark from dampness 0.3 up; damp lasts
  after the rain stops and meltwater sets it to 0.88-1.0 (coverfield.ts setMeltSoak). OWNER
  RULE: a wet trail only in a PUDDLE or while it is RAINING; elsewhere normal rubber marks.
  Grip of damp ground unchanged (look only). S. OWNER 11-01: only HEAVY rain lays trails on
  damp ground; light rain / drizzle: only puddles. BUILT ?heavywet=1 (marks.ts markOf, rain
  0.7+): soaked track, no rain / light 0.45 / heavy 1 - trail share 1/1/1 off, 0/0/1 on.
  RAIN AND TYRES (owner asked): yes - wet ground cools tyres (damp coolK up to 0.18, a puddle
  0.20, physics/tyreheat.ts groundCool); falling rain has no extra term. No change unless asked.
- K2 [DEFAULT 11-02, owner: pass] MENU RACE: the camera car never resets for damage. CAUSE (code): game/sim.ts demoInput
  resets it only when stopped 3 s or 30 m astray, and without a repair; the menu's AI rivals
  already use the race rule (game/ai.ts stepAIInjury). Fix: the camera car uses that same rule
  (one system). S. BUILT ?menureset=1 (game/sim.ts demoInput): wrecked -> reset + mended.
- K3 AI SLOW DOWN AND WEAVE (Thruston and others; the menu race runs on Thruston). LEADS:
  Thruston's racing line has a seam (a 1.385 m segment and a turn spike at its last point,
  tools/scratch/_lineseam.mjs, 10-24); the off-line corner slow-down (ai/driverDrive.ts: a car
  inside the line slows by sqrt((R - x) / R)) and the scripted wander. Reproduce on every
  circuit, fix the cause; anything rooted in line-following goes into B. S-M.
  FOUND 11-02 (owner: check the line / subtrack for sharp awkward turns and objects;
  tools/scratch/_lineaudit.mjs, _seamdrive.mjs): (1) LAP SEAM - subtrack.ts resamplePath
  leaves a stub last segment (lap not a multiple of 1.5 m: Killder 0.07 m, Sweaty Lamb 0.44,
  Castle Cum 0.46, Slidden 0.83, Thruston 1.39); line.ts smoothLine assumes even spacing and
  kinks the line there (R 0.6 m Killder): a lone AI brakes 11 -> 5 m/s at Killder's line,
  28.5 -> 24 at Castle Cum's (target 50 just past it). (2) CENTRELINE KINKS the 8 m-arc rMin
  check misses: Thruston 222 m (R 7 in a 46 m bend), Brands Indy 271 m; line kinks Castle Cum
  583, Knobhill 739, Test Track 679 / 724. (3) OBJECTS: none on any racing line; cones /
  tyre stacks 1.6-2.6 m off it (Test Track, Sandbox, Sweaty Lamb 558-591 m) count only for a
  car off its line. PLAN (asked): even resample (step = lap / round(lap / 1.5)) + a short-arc
  kink pass in traceTrack, behind a switch, then re-audit and a field run.
  DEFAULT 11-02 (owner: "evenlap pass"). BUILT ?evenlap=1 (world/subtrack.ts resampleEven + maskKinks: 3 m-arc R < 30 and < 0.6 x
  the 8 m R; read as core/fixes.ts loads - the circuits trace at import): audit 0 kinks / seams
  on all 8 traced circuits; a lone AI over the line Killder 6.1 -> 17.4 m/s, Castle Cum 24.3 ->
  31.8. 5-AI field swings off the line a lap (noisy, cars on cars): Thruston 5.6 -> 4.5, Castle
  Cum 7.2 -> 8.3. OVALS (owner: weaves before the start / finish): no seam or kink (built from
  apexes, not traced); a lone AI holds its line (no reversals); field swings ~1-2 a lap, 3/4
  round other cars, spread round the lap, not at the line (_ovalswing.mjs); the rolling start
  holds columns within 1 m. NOTE for B: Naffcar has no racecraft corners (bends R 85 > CORNER_R
  70): tow passes only.
- K4 [DEFAULT 11-02, owner: pass] TYRE MARKS FADE IN RANDOM SQUARE CHUNKS. CAUSE (code): marks.ts fadeBlocks halves one
  hashed eighth-by-eighth block of the marks layer every 0.5 s - blocks, not age. WANTED: oldest
  first, newest last, no patches. Plan: each mark remembers when it was laid and fades by its
  age (same ~2-3 min life); design + cost measured first. M. OWNER 11-01: oldest first, SMALL
  bits at a time (not the big panels), same life. BUILT ?markage=1 (marks.ts fadeAged: 16 px
  cells ~3.8 m, newest mark's age; fade from 90 s, 5 steps of 12 s): skid A at 0 s, B at 60 s -
  A 60/22/0 % at 90/120/150 s while B stays 100 %, then B; cost 0.28 ms a game second.
  ROUND 2 (owner 11-02: "better but still a bit chunky"): 8 px cells (~1.9 m), 16 steps of 15 %
  every 4 s from 90 s (gone ~2.6 min): A 85/62/38/28/17/12/0 % every 10 s; 1.1 ms a game second.
- K5 [DEFAULT 11-02, owner: pass] TREES AT NIGHT: a lighter edge round the canopy. Suspects: render/light.ts puts the dark
  back over each canopy as one square (render/trees.ts traceCanopies) while the drawn canopy is
  offset squares + a shadow offset down-right, and the light map's scaling softens the edge.
  Night photo first, fix the cause. S. CAUSE: the two fills' part-covered edge px came out
  less dark than both (rim 154 vs grass 131, canopy 69). BUILT ?treenight=1: the canopy squares
  on whole light-map px (render/trees.ts) - edge now 131 -> 98 -> 69, no rim.
- K6 [DEFAULT 11-02, owner: pass] HIGHWAY: snow the AI drove over ahead (off screen) is fresh again when you get there.
  SUSPECT (code): world/wear.ts pruneWear (each highway rebuild) drops any cell whose ground
  layers no longer equal cell.orig - weather snow comes from the cover field, not layersAt, so
  AI-made cells may be dropped as "changed". Reproduce, then fix at the cause. S-M. CAUSE
  CONFIRMED: getCell keeps the ground UNDER a field cover as orig, the prune compared the cover:
  every cell under weather snow / water went at each rebuild. BUILT ?hwsnow=1 (wear.ts
  groundOrig): snow highway, 3 AI - cells 410 -> 151 in 5 s off; grow 40 -> 1266 on.
- K7 [DEFAULT 11-02, owner: pass] A LOST WHEEL can still leak, burst, go to the rim and wear. CAUSE (code): only
  openwheel.ts and tyreheat.ts check car.wheelOff; tyrepressure.ts, punctures.ts, tyrewear.ts,
  metalscrape.ts (rim), bushes / debris / stingers do not. OWNER: a hub may spark on hard
  ground; nothing else can happen to a wheel that is gone; the car still takes damage. S. BUILT
  ?wheelgone=1 (world/wheels.ts wheelGone at tyrepressure / tyrewear / metalscrape / marks /
  HUD): wheel off + burst asked, 20 s - off: leaks, wears; on: full, no wear, hub sparks.

FEATURES
- K8 [DEFAULT 11-02, owner: pass] MENU RACE camera car = the player's car (the garage choice / last used), not the fixed
  hatch-rwd (main.ts DEMO_CAR). Its paint / number too. S. BUILT ?menucar=1 (menuflow.js
  enterMenu: profile.active + its livery).
- K9 AI CARS get their race NUMBER painted on (the garage's paint + number system) and brighter,
  more varied colours (look change: mockup first). S-M.
- K10 [DEFAULT 11-02, owner: pass] RANDOM AI NUMBERS (not 1, 2, 3 ...): unique per event, never the player's, the same on the
  car and on the scoreboard / results. S. OWNER 11-01: a driver KEEPS their number across
  events (Story); TEST MODE deals random numbers each event. BUILT ?ainumbers=1 (grid.js
  aiNumbers; also K9's painted number - spec.num): 6 deals all unique, never your #7.
- K11 [DEFAULT 11-03: up to 10 AI, a ticker; 20 is the AI rework goal] UP TO 10 AI: setAI caps at 5 (main.ts). Measure first: AI ms per car (laptop profile) and a
  phone ?report=1 race at 10; grid slots on the shortest tracks. M. Owner to decide on numbers.

- K16 DRIVER NAMES: every AI racer gets a name (parody puns, the NOTES rule), shown with the
  number on the scoreboard / results; the PLAYER can set their own name in settings, with the
  usual safeguarding (no swearing, slurs or racism; a word filter that also catches spaced /
  leetspeak spellings). Where it shows and where the setting lives (no SETTINGS screen yet - G):
  proposal / mockup first. S-M.

- K17 [DEFAULT 11-02, owner: pass] HUD FLASHES "like crazy" driving off the track (owner 11-02, new). Not reproduced on the
  laptop at first. Owner: test link only, after damage, off road. FIXED in ?wheelgone: with a
  wheel off marks.ts lists 3 wheels, particles.ts picked wheels[rand*4] -> undefined.spray threw
  every few frames on loose ground, the frame died before the HUD (tools/scratch/_hudflash2.mjs:
  3 flashes + page errors -> 0). Spray now picks from the list's length.
- K18 MENU RACE ON A RANDOM TRACK each time, or the last track raced - highway levels too
  (owner 11-02). Today fixed to Thruston (main.ts DEMO_LEVEL); the highway needs its own AI
  (weaver / hwFlow) and the camera car's driver there. M. Which: random, last, or a mix - ask.
- K19 STORMS + LIGHTNING (owner idea 11-02): a weather kind above heavy rain - flashes lighting
  the night layer for a frame or two, darker sky, gusts (rain angle), thunder later (sounds: ask
  first). Design + Safari cost first. M.
- K20 HEAT SHIMMER, subtle (owner idea 11-02): hot / superhot days, a faint wobble over hot
  tarmac in the distance. Needs a per-frame screen distortion - a WebGL pass or a cheap 2D
  approximation; measure the phone cost first (Safari holds frames). M, maybe L.

FOLDED INTO 1 - THE DRIVING ROOT FIX (wheel spin as real state; plan first, then build)
- DEFAULT 11-02 (owner: "pass"; old law, ABS cap and switch deleted, simhash SAME against main
  c47623c with ?wheelspin=1). BUILT ?wheelspin=1 (11-02, owner: "ok"; physics/wheelspin.ts): each axle's wheel speed is state
  (engine, brakes, tyre; 4 substeps, implicit), ONE combined slip law (kappa / alpha over their
  peaks -> the lateral curve's shape; pure cornering = the old curve), ABS that dumps / snaps /
  creeps (rear on its whole slip: EBD), AWD centre coupling, rev limiter + revs off the driven
  wheels. tools/scratch/_rootbench.mjs, all 19 cars, off -> on: ABS pulses 0 -> 9-18 a s; swerve
  under full ABS (0.05 lock) 0.1 -> 3.5-9.7 m, body slip 1-3 deg, locked 0-0.3 m; ABS stop 2-5 %
  shorter than locked (was = locked); launch / top within ~10 % (AWD mud same after the
  coupling); judder (max accel step) 3-12 -> 1-5; hbcheck means within 6 deg, same BACK count;
  lone AI laps within 0.5 s; +1.2 us a car step. OPEN for the owner: threshold braking still no
  better than locking (the roster's brake bias 0.82 front locks the front first - K13); light
  cars slide more braking hard into a turn (0.2 lock: Mini 44 deg body slip); ABS marks faint
  dashes (6 % of a stop past 2.2 m/s slip). carstats re-measured and committed 11-02 (owner OK).
- Real ABS (A10): pulsing, staggered marks, steering kept, shorter stops than locked.
- K12 [DEFAULT 11-03, owner: pass - see Where we are] MUD HILLS: some cars barely climb rallycross hills; stopped / reset in wet mud they cannot
  pull away. Measure each car's climb and launch on wet mud vs real figures; with real wheel
  spin, traction on loose ground comes from the tyre law, not a patch.
- K13 GRIP / SPEED / TORQUE / STEERING REALISM: a measured balance pass against real figures
  (0-100, braking g, cornering g, top speed per car); drifting a little is OK but the OWNER
  TUNES how far (a table of the measured gaps first, owner picks).
  MEASURED 11-02 (tools/scratch/_k13.mjs brakes + grip at 60 / 150, _k13b.mjs power / circle;
  table sent to the owner): road cars corner 1.33-1.57 g (real 0.8-1.1); several engines far
  above real (muscle 1653 hp vs ~450, Naffcar 2438 vs ~670, tractor 1441 vs ~350, Lambo 1078 vs
  610), top speed held by extra drag; front brake share 0.70-0.86 makes the best pedal = locked
  (at 0.65: 1-9 m shorter, single-seaters 35 -> 26 m, threshold braking pays); a locked stop
  only ~4 % longer than ABS (real 15-30 %); top speeds mostly within 10 %; turning circles 7-10 m
  (real 10-12). Six dials offered (A keep / B halfway / C real): brake balance, locked grip,
  tyre grip, power, top speed, turning circle; my picks C, C, B, C outliers, follows, A. Each
  picked dial to be built as a numeric test switch (0 = now, 1 = real) for the owner to tune.
  BUILT 11-02 (realism.ts; all off simhash SAME). At 1 / 1 / 0.5 / 1: locked stop ~20 % longer
  than ABS (was 4 %), ABS 32-41 m, road cars 1.1-1.3 g, hatch 0-100 6.8 s, muscle 5.3, Mini 9.9,
  Lambo top 344; brakecheck BACK 12 -> 5 (Naffcar / F1 rotate more, none backwards);
  aidrivecheck pro laps 8-14 % slower, no time off the road (Naffcar was off 2 s before).
  The muscle car still tops out at 205 (its gearing; real 250).
- K14 LOOSE-GROUND SIDE GRIP (owner idea): turning / drifting on gravel and sand (dirt a bit)
  builds a berm of loose stuff against the tyre's sidewall - lateral grip that grows with the
  slide instead of pure sliding. To DISCUSS: a slip-dependent "plough" side force (the surfaces
  already carry plough / rough), scaled by surface and depth (dig.ts dents).

FOLDED INTO 2 - AI REWORK B (design agreed first)
- K15 TEST MODE AI SLIDERS: one per behaviour axis - skill, risk, pace, line precision, mistake
  (crash) chance, aggression, defence, anything else the AI uses. OWNER: a slider raises the whole
  field's chance but a better driver keeps a lower one (slider x the driver's own multiplier) -
  how it works now and what is best to be discussed with the owner first.
  HOW IT WORKS NOW (ai/traits.ts): a difficulty is the field's centre (pace, lineQ, wander,
  mistake, slip); each AI gets a personality (quick / steady / aggressive / defensive / balanced)
  and a skill 0-1 that scales wander, mistakes and slip (x1.4 at skill 0 .. x0.6 at skill 1) and
  nudges lineQ and precision. Wander is a SCRIPTED sine drift off the line, and lineQ pulls the
  target towards the track's middle - deviation is drawn, not earned.
  OWNER OBSERVATION: off the line the AI slows to get back on it. WANTED: go fast, follow the
  line SOFTLY from wherever they are; deviation only as a RESULT (low skill, mis-braking, too
  fast, a crash, a less than optimal line) - emergent behaviour from simple rules. Fits B1-B3.
  OWNER 11-01: KEEP what we have, adjust it - NOT a total rebuild. Each racer may have its own
  idea of the ideal line, and it may change to overtake, to block, or for the surface.

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
   OVERNIGHT 11-02/03 (owner: "work thru as much type script conversion as possible"): DONE and on
   main, each batch proved against main 10a3f89 (simhash SAME, worldhash SAME, renderhash SAME on
   test-track / knobhill / highway where it draws; menucheck / uicheck / inputcheck / garage
   where it applies): batch 1 (13 leaf files), 2 cones (6), 3 HUD (7), 4 menus (4), 5b input,
   roll, raceflow, 5c audio, guide, carstats (the generator writes typed TS), marks, the
   highway (7) - 44 files.
   11-03: marks, stagegen, then the GAME FLOW (state, grid, controls, rules, order, ai, loop,
   menuflow, session, sim) + main.ts - DONE: src/ is all TypeScript (no .js left). game/state.ts
   types the Game and the shared variables; proved simhash SAME, worldhash SAME, renderhash SAME
   (test-track / knobhill / highway), menucheck / inputcheck / settingscheck / uicheck /
   bundlecheck ok. One system on the way: one tape Streamer type (vehicle.ts; was three).
   LEFT for the types (not behaviour): two Surface types (cars.ts, world/types.ts) and the
   renderer's / HUD's car shapes are narrower than the traffic's and the highway flow's - loop.ts
   hands them the game with a cast. One car type later.
   FOUND on the way (behaviour kept, for the owner): the joker turn-off hint on the lap panel
   never shows (hud/laps.ts: no joker arrow carries its track distance d); JokerRule.estCost is
   read but never set (an unfinished car's joker always costs 5 s); carstats are a little stale
   (a re-measure moves 6 numbers by 0.1 since the 11-03 physics passes).
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
   lamps streamed with the road (spawn ahead, cull behind, like highway/litter.ts) and a spatial
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
- A5 Mont Brakefade's corner ice does not melt (a generated stage's ice covers, stagegen.ts) - and
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
  game/sim.ts game.cones.add) as DEBRIS kinds bumper (exists) + new wing / panel with the car's
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
  FOUND 10-26 (code): only the F1 (track-rwd) and F2 (f2-rwd) have wheels outside the body box
  (box 1.30 m wide, wheels 2.17 m across); every collision tested the box only. OWNER 10-26:
  wheels hit everything (cars, walls, posts, trees, cones); wheel to wheel a HARD KICK (owner to
  test); rip-off from ~40 km/h; build then photograph.
  BUILT behind ?openwheel=1 (physics/openwheel.ts; contact.ts carContacts -> wheelContacts,
  barriers.ts wheel edges + wheel boxes vs solids, cones/coneCar.ts wheelsContact, damage.ts
  wheelImpact): each exposed wheel a tyre box (r 0.33 m); wheel on body bounce 0.25, wheel on
  wheel 0.6 with 1.5x the spin; a hit into a wheel rips it off by chance 30 % at 40 km/h -> every
  time at 80 km/h, and 60 % of the hit lands on that corner. MEASURED (_c10.mjs, the game's own
  collision code, two F1s at 120 Hz): side by side they touch at 2.17 m (was 1.30 m); a front
  wheel into a leader's rear wheel at +5 m/s spins the follower 1.12 rad/s, speeds traded; along
  armco the centre keeps 1.45 m (was 1.10); a lone wheel into a tree trunk 20 tries: 30 km/h
  0 ripped, 40 km/h 5, 60 / 80 km/h 20 (a trunk strike - C8 post - wrecks the corner, which
  loses its wheel by the old rule anyway). Photo _c10shots.mjs: wheel off, 0 page errors.
  DEFAULT 10-26 (owner: "pass"; ?openwheel deleted). CAR SYSTEMS C (C1-C10) DONE.
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
  strip, to test rolling / sliding sparks): world/flipramps.ts (roll.ts tripCheck asks it),
  render/flipramps.ts. 5 m x 0.6 m rising to 0.8 m; one side's wheels up it at 7+ m/s roll the car.
  SPARKS while crash rolling too (owner), flung behind the way the car MOVES (sliding / rolling),
  hard ground only (roll.ts car.sparks: any roll phase at 3+ m/s on hard ground).
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
lights), world/lampplan.ts (corner floodlights + tyre rings via cones.ts, villages, fairy
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

- FOUND 11-07: `barriercheck brands-snatch-indy` FAILS (before ?indyscale too): a garage building (77
  pts, 9.2 m from the centreline) has 4 points on a lane - the pit lane's taper or a bridge
  approach; look like Thruston's (a wall on the edge) or a real overlap. CI checks only Thruston.
- FIXED 11-07 (owner: "1. ok"): an intended difference is TAGGED in the commit message -
  [sim] / [world] / [look] - and its hash is then reported, not failed; settingscheck asks ?ai=99
  -> 20 (MAX_AI); barriercheck allows a wall ON a lane's edge (0.1 m: Thruston's garage front is
  the pit lane's edge, 4.50 m from its middle); menucheck: the podium goes on to the table by
  itself after 2.5 s, slower than a CI shot - it taps RESULTS if still there, then waits for the
  table. WAS: TO FIX (owner 11-04: "add that to the todo to fix / look at"): the GitHub `checks` workflow
  (.github/workflows/checks.yml) FAILS on every push to main (since ~10-19; `verify` is the
  gate, so nothing is blocked - but it is meant to be the regression suite). What it does: saves
  the proof hashes on the commit before (level data, simulation, pixels) and compares the pushed
  commit to them, plus runs the browser checks (tools/runall.mjs). Run 41916952871 (11-04):
  - simhash DIFFERENT on 8 levels and renderhash DIFFERENT on most levels: EXPECTED on a commit
    that changes the AI / the look (it fails "on purpose"), so it is red on almost every push -
    nobody reads it. Wants: a way to mark an intended change (e.g. a commit tag that re-bases),
    or report-only for these.
  - settingscheck: `?ai=9&diff=7&traffic=3` wants aiCount 5 but gets 9 - STALE test (10 AI are
    allowed since K11); fix the expectation.
  - barriercheck: a `building` barrier has 10 points on a lane (21.5 m from the centreline) -
    find the level and whether the lane or the building is wrong.
  - menucheck: at 844x390 the RESULTS tap times out (60 s) - real or stale; look.
  - renderhash shards take 15-37 min each (no GPU: software WebGL).

- FIXED 10-26 (owner: "do wear check only"): `tools/wearcheck.mjs` REWRITTEN to today's rules
  (it failed 14 on a correct game: old rules, a moved art table, test puddles the cover field
  ignored, ice found by a field the cover field no longer sets). 33 checks, all OK 3 runs in a
  row: grass chain, worn dirt by heat / damp, mud only thickens damp, loose ground, snow / packed
  snow / ice by temperature, the real car over the Lab's ice, puddles (3 passes, hot 2, rain
  tyres 1; churned in on soft ground ~78 %, the rest taken by the tyres), dragged water, damp
  drying, grip, art coverage. `tools/phase1check.mjs` 3 had the same stale "mud at 6" (fixed).
  TIDIED 10-26 (owner: "make sure it's all tidied"): world/wear.ts's header comments were stale (snow "packs
  to ice", standing water "cold tyres add nothing", dryAmount's standing branch no longer used:
  puddleClearBy answers every standing pass) - rewritten; dead branches removed (simhash SAME).
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
