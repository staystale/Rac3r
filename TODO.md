# RAC3R - open work

Only what still needs looking at: what is on the phone now, what is being built, what is open.
Finished work (passed, defaulted, dropped, superseded, with its measured numbers and the owner's
verdicts) is in `TODO-DONE.md` and git; the owner's rules, decisions and lessons are in `NOTES.md`.

## 1. UNDER TEST (on the phone now)

The live list is `src/core/fixes.ts` FIX (a switch there = under test) and `src/testlist.ts`. Each
build's full record (what was built, every number) is in `TODO-DONE.md` under its round.

The 11-11 round (14 entries, 11 switches) passed 11-12, and the performance round (carcache,
carcull, the texture warm-up) and the stadium crossovers passed 11-12 ("mostly pass"), their
records in `TODO-DONE.md` (PASSED 11-12). On the phone now:

- Nothing.

## 2. BEING BUILT

- SPEED, NEXT (owner 11-14 on PERFPASS: "Still seems to drop slightly at times / starting levels
  seems to drop / be slow"; "Pass, fix drops next"). From the phone reports (11-14, ?report=1):
  - LEVEL STARTS: the first ~5 s hold several 150-370 ms frames (Spa 25 of them): the ground and
    pictures made while driving. The LOADING SCREEN (below) does that work before the start.
  - THE FLY-IN (foreman, laptop CPU x4, tools/scratch/_flyprof.mjs, Spa): most of a fly-in frame
    is drawing every prop and loose object one by one (zoomed out: Spa's 8 000 trees and 3 329
    cones each frame; drawProps 1.76 s, drawCones 1.03 s of 4.55 s drawing), not the whole-level
    picture. See SMOOTH FLY-IN.
  - IN RACE: 0.3-0.6 % slow frames, nearly all ZOOMED OUT while new ground tiles go to the GPU.
    Measure first, then spread the uploads over frames (or paint ahead), behind its own switch.
    READ FROM THE REPORTS (foreman, 11-14 14:00-18:00, the owner's phone, 118 674 in-race frames
    after each run's first 600, the fly-ins and the phone's sleeps left out): 473 slow (0.40 %),
    329 of them 26-35 ms (one refresh missed); 72 over 50 ms (one in ~1 650 frames, ~27 s): our
    JS 32, GPU uploads 13, tiles 3, none of those 24. The one real cluster: YAS MARINA (night,
    heavy rain) - six frames of 81-299 ms DRAW (sim 5-15 ms, 2-3 uploads); Le Manky two of 39 ms
    draw. Next: what that Yas Marina draw is (night + rain + zoom), before any change.
  - MENU TAPS: the track lists' lengths and the rally stages' thumbnails PASSED 11-14 (TODO-DONE).

- THE LOADING SCREEN, THE RESTART FIX, THE SMOOTH FLY-IN and THE NIGHT FLY-IN: PASSED 11-14
  (TODO-DONE). Next on it: a LOADING BAR AT THE FIRST PAGE LOAD (owner 11-14: "There's no loading
  bar when the game first loads"): the same panel and bar from the page's first paint (index.html,
  before the code runs), filling as the code, fonts and menu thumbnails load, the blue flash, then
  the menu; behind its own switch.
- BOOT BAR (owner 11-14: "There's no loading bar when the game first loads"): PASSED 11-15 with
  the logo, the default (TODO-DONE).
- LOGO FADE (owner 11-15: no "cheap version of the logo first"): PASSED 11-15, the default
  (TODO-DONE). The test tools (navigator.webdriver) get no boot bar: they click to start at once.

- PASSED 11-15, now the default (TODO-DONE): the forest stage's build leak (and Croughed RX's
  bales), WANTED LEVEL LOST, the weather's notices on MOBILE only, the menu race's NaN, the RX
  walkthrough line. FROM IT (owner 11-15: "Seems ok yes"): the AI's wide-window read with a negative
  clock and a recovery that does not clear a NaN tyre wear - BUILT as plain guards, passed 11-15 with stopped-car avoidance
  (3a2 item 10 below).
- THE JOKER LINE ON ITS OWN ROW: PASSED 11-15, the default (TODO-DONE).
- THE AI EXTRAS (owner passed the list 11-15 morning; JOB 2, one switch each):
  2a. THE AI'S OWN PUT-BACKS BY YOUR RESET'S RULES (bug 4 Q8): BUILT behind the AI crash put-back rule (passed 11-15, the default)
  (FIX.aireset, game/ai.ts; testlist 'aireset'): a rolled AI once still and a too-injured one after
  its pause are put back as the stuck put-back is - from where it last was on the road but never
  ahead of where it is, the next spot 6 m further back while a racer is on it; on the endless road
  the hard-shoulder spot stepped back until clear of every car (you, racers, traffic). MEASURED
  (tools/scratch/_aiputback.mjs, the real game: an AI 30 m back down the run-off from its last spot
  on the road, its injury pause ended; then with that put-back's spot taken by another AI): off -
  put back 24-25.5 m AHEAD of where it was on Thruston, Knobhill RX and a forest stage, onto the
  other AI on Knobhill RX and the stage; on - 4.5-5.9 m behind, and 10.5-11.6 m behind with the spot
  taken, on no car. The endless road (twisty): a racer on the spot - on no car either way (the old
  spot already steps past racers; the traffic is the new part). In the field (tools/scratch/
  _stuckai.mjs, 180 s, seeds 1 and 2, Thruston / Brands / Knobhill RX / a stage / the twisty and
  the motorway): roll and injury put-backs 15 off, 16 on; ahead 0 / 0; onto a car 2 (the twisty)
  / 0; the stuck put-backs as before (98 / 93).
- THE GROUND AT THE ZOOM'S DENSITY + THE PC LOADING DRAW-IN, and THE HIGHWAY OFF-ROAD JERK:
  PASSED 11-15, the default (TODO-DONE).
- THE FRAME-DROP HUNT, PREP: ?gpustat=1 PASSED 11-16, the default with every ?report=1
  (TODO-DONE). The phone's numbers decide what next; nothing is changed yet.

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

### 3a2. The owner's list of 11-13 (bugs first, then tracks: "Do all tracks first", then cars)

GO 11-14 (owner: "yes ok to all", "bugs first"): the BUGS (1-10) now, in order, each behind its
own switch; EVERY FIX CHECKED GAME WIDE (owner: "F1 bug jsut f1 cars or all cars make sure fixes
like this get checked game wide / Same for the next"): a car fix on every car, a reset or HUD fix
in every mode (circuit, RX, stage, highway). ITCH.IO: only when ALL these bugs are fixed and
passed, with solid features only (owner: "Only after all bugs").

BUGS (each behind its own switch, measured, then a test link):
1-2. FRONT TYRES and the ROLLED CAR'S SIDE: PASSED 11-14 (TODO-DONE).
1b. BUG 1 CONTINUED, THE FRONT TYRE SMOKE: PASSED 11-15, the default (TODO-DONE).
3. THE HUD COVERS THE PLAYER'S CAR: PASSED 11-15, the default (TODO-DONE).
4. RESETS NEVER AHEAD, NEVER ONTO A CAR, THE POLICE LEFT: PASSED 11-15, the default (TODO-DONE).
5. WRONG WAY ON HIGHWAYS too quick: PASSED 11-15, the default (TODO-DONE).
6. A HIGHWAY RACE WON BY PULLING AWAY while OFF THE ROAD: PASSED 11-15, the default (TODO-DONE).
7-8. ROLLING STARTS HOLD A SPEED and STUCK AI AND TRAFFIC: PASSED 11-15 (TODO-DONE).
9. AI SLOW ON SLIPPERY SURFACES, and the PACE dial: PASSED 11-15, the default (TODO-DONE), the
   live pause-menu dials removed; the AI DRIVERS presets settled (skill +0.10, risk / aggression /
   PACE +0.03 on every difficulty; values and numbers in TODO-DONE). LEFT AS BUILT (no owner
   decision): the MISTAKES THAT SPIN (ai/driverSlide.ts spinChance, spinSteer) - inert in
   practice, 0 spins in 160 runs (the most a car turned from one was 0.66 rad; a spin is 1.22).
10. HIGHWAY AI AND ONCOMING TRAFFIC, and two racers put back onto one spot: PASSED 11-15, the
    default (TODO-DONE).
    STOPPED-CAR AVOIDANCE + THE TWO GUARDS (with the start fix): PASSED 11-15 ("Much better", "Yes"),
    the default (TODO-DONE).
    ROLLING STARTS ON THE SINGLE LANE (owner 11-15: "Rolling start on single lane roads tho seem to
    suffer from the start issue ... It's bad"; "they weave out of oncoming traffic and brake because
    someone weaved and then it gets worse and they don't dodge well enough"): BUILT behind
    the rolling-start fix (passed 11-15, the default) (FIX.rollfix; ai/driverDrive.ts plannedLat, ai/driverTraffic.ts; testlist
    'rollfix'). TRACED (tools/scratch/_rollstop.mjs, a per-car trace at the twisty road's green):
    the racers read the cars from where they MEANT to be across the road before the oncoming car's
    keep-to-your-side clamp, so an oncoming car in its own lane was "in the way" and FOLLOWED - its
    speed, coming at them, made their target -3 to -20 m/s: the field braked to a stop at the green,
    then the stopped-car brake judged the stopped cars and the chain went on. The same start before
    stopped-car avoidance (round57, pre57 worktree): twisty 54 / 55 km/h in the 10 s after the
    green, spread 224 / 252 m; Deaf Valley 58 / 59 km/h, 219 / 243 m - as bad: it was the
    oncoming-car read, not the new brake. FIX: where I mean to be is kept to my side while an
    oncoming car keeps me there; an oncoming car beyond my side's limit is passed, not followed;
    the gap picker's room and the brake's plan never into the other way's lane then; and the
    stopped-car brake: no car counts as stopped through a rolling start's formation and 2 s past
    its green, and "much slower" is under half my own speed (no 5 m/s floor). MEASURED
    (_rollstop, seeds 1 / 2, off / on; 10 s after the green: the car-s judging a stopped car, the
    racers' mean km/h, the field's spread / largest gap; to 60 s: brake events, chained, touches):
    - twisty: judging 10.3 / 10.5 -> 0.0 / 0.3; 54 / 55 -> 95 / 102 km/h; spread 225 / 253 ->
      75 / 189 m (largest gap 210 / 234 -> 36 / 146); brake events 6 / 53 -> 14 / 8, chained 0 /
      1 -> 0 / 0; touches 5 / 8 -> 6 / 1.
    - Deaf Valley (single lane): 8.9 / 5.3 -> 1.0 / 0.5; 58 / 60 -> 90 / 91 km/h; spread 219 /
      249 -> 120 / 173 m; brake events 11 / 21 -> 3 / 11, chained 2 / 0 -> 0 / 1; touches 5 / 3
      -> 4 / 5.
    - dual, motorway, Deaf Valley dual, Naffcar, Dieatona: the start the same (10 s spread and
      speed equal); judging to 60 s dual 1.3 / 34.9 -> 1.2 / 43.5 car-s, motorway 24.4 / 13.2 ->
      11.7 / 11.2, Deaf Valley dual 0 / 17.5 -> 0 / 1.3, Naffcar 13.0 / 30.3 -> 12.5 / 15.6.
    - Stock Car: 106 / 41 brake events (48 / 23 chained) off, 115 / 38 (55 / 21) on, touches
      68 / 44 -> 71 / 43 - unchanged by this; before stopped-car avoidance 69 / 54 touches, the
      same 72 / 74 km/h. Its pile of touches is the oval's own (19 cars in a short bowl).
    STANDING GRIDS AND RUN-INS (the "much slower" change reaches circuits too): _gridstart Brands
    and Knobhill RX seeds 1, 2: 100 m / 250 m times and spreads identical off / on, touches in 30
    s 55 / 33 -> 60 / 32 (Brands), 30 / 52 -> 36 / 53 (Knobhill). _pileups 240 s seeds 1-3:
    Brands touches 291 -> 257, per incident 2.75 -> 3.29, per 10 km 3.55 -> 2.61, into a stopped
    racer 23 -> 34, at 15 km/h+ 77 -> 77, lap 86.5 -> 86.7 s; Knobhill 354 -> 348, 3.37 -> 2.88,
    4.83 -> 5.64, 53 -> 60, 107 -> 109, lap 57.5 -> 58.0 s (these swing 10-20 % by seed).
11. MINIMAP (fuel stations, slip roads, police): PASSED 11-15, the default (TODO-DONE).
12. CHEVRON BOARDS by the real-life rule: PASSED 11-15, the default (TODO-DONE).
13. BARRELS (crash cushions): PASSED 11-15, the default (TODO-DONE).
14. PARKED POLICE wake when passed with a star; speeding past one gives a star: PASSED 11-15, the default
    (TODO-DONE). OWNER 11-15: the wake counts for ANY driver with heat ("Everyone breaking the law"); 60 m
    witness OK; no cap or spread needed ("police already bother whoever is nearest").
15. TRAFFIC LEAVES BY THE SLIPS, STOPS FOR FUEL, JOINS FROM THE ON-RAMPS: PASSED 11-16 with the rates
    raised to a measured 2 in 12 / 5 in 40, the default (TODO-DONE).
15b. FUEL MISSES CARRIED ON (owner 11-16: "Fuel misses stay left for the next station: YES"): BUILT
    behind ?fuelcarry=1 (FIX.fuelcarry, ai/trafficTrips.ts goForFuel / goForNextStation; testlist
    'fuelcarry'): a car going for fuel that is in reach with the pumps taken tries again while still
    in reach; one past its station (not in the nearside lane in time, or the pumps never free) stays
    in the nearside lane and goes for the next station ahead. The roll unchanged (FUEL_ROLL 0.36).
    MEASURED (tools/scratch/_hwtrips.mjs, 480 km: motorway / dual x countryside / Deaf Valley x seeds
    4242 / 7 / 11, 40 km each, traffic 0.6, the laptop; off is JOB 1's run of the same):
    | | pulled in of the cars passing | traffic | police | won | missed | carried on |
    |---|---|---|---|---|---|---|
    | off | 58 / 433 (13.4 %) | 40 / 363 (11.0 %) | 18 / 70 (25.7 %) | 164 / 414 | 84 | - |
    | on | 63 / 448 (14.1 %) | 42 / 355 (11.8 %) | 21 / 93 (22.6 %) | 183 / 437 | 7 | 17 |
    | on, roll 0.32 | 62 / 432 (14.4 %) | 42 / 344 (12.2 %) | 20 / 88 (22.7 %) | 161 / 423 | 2 | 22 |
    (the misses nearly gone, the share pulling in the same within the runs' noise, ~1.7 % either way at
    this size - so the roll is kept; the owner's 5 in 40 is 12.5 %). Leaving 15.1 % on (16.0 % off: a
    car waiting for its next station rolls for no slip). Joins 8, 5 merged, 3 held. Traffic step
    121-256 us (node). PROOF: switch off, _hwtrips 160 km (seeds 4242 / 7) the same line for line as
    the base (round95) but the step timings.

RACE TRACKS:
16. PIT STOPS - ALL QUESTIONS ANSWERED 11-15 (build after the 10 cars, one switch):
    - ON in F1 / GT / endurance-type real races of MORE THAN 3 LAPS on proper circuits over ~2 km; off
      for sprints, rallycross, stock cars, stages, the highway; test mode: a PIT STOPS on/off option.
    - COMPULSORY only where the real rules make it so (F1 dry: two compounds); extra stops always allowed.
    - Pit lanes: the 20 venues with one mapped; ADD Le Manky and the Nordschleife from the map data.
    - The stop: the driver stops in the box THEMSELVES (no auto-steer; 30 %+ in the box opens the picture
      menu: repairs, tyres same again / wets / slicks / the car's own choices); its time = the player's
      own taps + ~0.5 s, then the race start's GO reused. No pit crew.
    - Fuel: every car carries fuel (its weight counts), topped up per race automatically, refuelling only
      where a race needs it; charged in career / story later.
    - Pit lane: automatic limiter, no penalty. AI: the same rules, a short skill-based delay for the menu.
    - Cost: free in test mode, charged later.
    - WALKTHROUGH (owner 11-15: "Make sure it's all explained in the walk thru the first time an event of
      that type ect starts"): the event rules walkthrough (guide.ts RULES) gets pit-stop cards shown the first
      time a race WITH pit stops starts: the pit lane and limiter, stopping in your box, the menu, compulsory
      stops where they apply, fuel.
17. LITTER / JUNK on race tracks: very light (props we have). To discuss.
18. F1 vs WORLD CIRCUITS in the menu (split where a level opens a sub-menu).

TRACKS (after the RX queue in 3b): DRIFT tracks (none yet; the drift cars exist), PIKES PEAK, other
hill climbs and time attacks.

CARS (after the tracks; FIRST: every car's updated pictures, its rolls and its damage, checked;
"Don't build new cars until that's settled"). A few of each type, real-life copies with parody
names: lorries and artics with CARGO a separate option (flatbed, box, haulage, military, fuel,
milk: fuel and milk spill), a car transporter (loaded and empty), vans, 4x4 trucks, trophy trucks,
Dakar support trucks, a monster truck, Land Rovers, Range Rovers, touring cars, more rally / RX /
Group B, the Toyota TS010 and the Rebellion (Le Mans prototypes), a Porsche 911 GT3 R, a Caterham,
Clio Cup, Saxo Max; buses (school bus, bus, double decker) and everyday cars (Focus, Ibiza, a
"Freeari", Mercedes, Audi, electric: Tesla, BYD and worse) as TRAFFIC and drivable. The Pikes Peak
cars: the Hoonigan pink Porsche, the BMW E36.
CAR TOOLS (owner: "tools first"): BUILT 11-15 - tools/newcar.mjs <id> (every check for one car on
one sheet, shots/newcar/<id>/) and tools/newcarstart.mjs (a new car's starting row from the nearest
car, the real numbers filled in); NOTES "Tools worth knowing". The real cars' published top speed
and 0-100 are in tools/lib/realfigures.mjs (EST where marked; none for the builds and classes).
FOUND while building them (nothing changed): src/carstats.ts, the garage's measured numbers, is
out of date for the Formula Won (saved 347 km/h, 2.8 s, 32.3 m, 1.83 g; measured now 349, 2.9,
34.0, 1.87 - re-run tools/carstats.mjs); tools/tyrecheck.mjs's full run fails 5 of its claims on
the base (the burnout and drift times of the hatch-rwd, the muscle car, the F1 and the Naffcar: the
tyres heat faster than its limits; it is not in CI) - its --car mode shows those times unjudged.
UNDER THE SKIN: BUILT 11-16 behind ?underskin=1 (FIX.underskin, render/underskin.ts; testlist
'underskin'; ENGINE.md UNDER THE SKIN): what a lost panel shows, by each car's real layout (carbits.ts
mount, radiator): bonnet - engine (along / across) behind the radiator, a mid-engined car's front lid
two corner radiators; boot - the engine where it sits behind (no car in the roster yet); wing - the
well reaches 0.45 m in (was 3 px, all tyre), grey, the corner's arms and a driven wheel's drive shaft
(the open cars' drawing) and the strut's top; bumper - the crash bar, and the radiator where it sits
(the S1 and the RX supercar at the back); open cars - a sidepod its radiator, nose / tail their crash
structures, the buggy its frame tubes; a DOOR shows nothing new (asked). PHOTOS (the second PC,
tools/scratch/_partsoff.mjs, every car, front set and rear set, 844x390, 390x844 and a close-up, off
and on): no page errors. COST: framecheck Brands, 19 AI + you all in the hatch-rwd, every car's
panels off at frame 30, CPU x4 on the PC (on, off, on, off): work median 172.3 / 167.0 / 172.4 /
168.1 ms, p95 208.9 / 221.9 / 206.3 / 202.1, worst 255.9 / 348.9 / 244.9 / 270.6 (the PC's x4 with
20 cars is the catch-up loop, ~170 ms a frame either way); a car's picture made every frame
(tools/scratch/_underskincost.mjs, laptop, x1): frame median 1.6-1.7 ms off, 1.9 on (+0.2-0.3 ms each
time a car loses a part or its crush changes a step; nothing on the frames between).
PROOF: switch off, renderhash SAME (the PC, thruston, brands-snatch, knobhill: ~3-7 min a level
there without a GPU, so not all; CI runs the rest).
FAILED ON THE PHONE 11-16 (owner: "We're getting a lot of see thru cars when damaged and it's not showing
wishbones drive shafts or suspension beneath clearly / Also bumpers ect not denting and showing invisibly
connected to car after crash / denting"; "it can be gaps where there is in real life but if it should
expose something like wishbone or engine ect it should"; a lost DOOR shows the floor + sill; "Can the
radiator move back when the front of the car deforms from crashes? Like in real life"). FIXED behind
the same switch (render/cardamage.ts, render/underskin.ts, render/cars.ts; tools/scratch/_skinshots.mjs
photographs every car crushed as a ~0.5 hit leaves it with its parts off - front, side, rear, and a
lighter dent with nothing off - on tarmac). FOUND, the see-through: (1) the dent band's PRIMER CHIPS
and pale creases (grey ~150, random single pixels across the whole band, the windows too) read as
holes showing the road on grey tarmac; (2) the crumpled edge was cut per pixel at random (each
pixel's own jag), leaving speckled holes inside the crush and loose pixels past it. The floating
look: (3) the under-skin layer was painted at each part's place on the clean car, so a crushed end's
radiator, crash bar and its bay stood out past the dented edge, "invisibly connected". FIX: the
crumpled edge cut in 2 px teeth along it (one depth a tooth: no holes, nothing loose); the dent band
FOLDED - the fold dark, a darker fold line every 2 px with a light crease between, fading over the
band, no chips (the bumpers and panels show their dent at a phone's size); the under-skin painted
only where the crushed body still is; each end's crush pushes its radiator, beam and crash cans back
by its own depth (+1 px) and the engine with them once they meet; a side's crush pushes a lost
door's sill in. Readable at a phone's size: a wing's well a dark cavity with the arms, drive shaft
and spring bright steel two px wide; behind a lost bumper a dark under-tray, the light beam just
inside the car's end on its two crash cans; a lost DOOR the sill (the body's paint, darkened), the
floor and carpet; a front-engined car's lost boot lid its floor and spare wheel. Real gaps stay
(through a wheel well past the tyre to the ground). PHOTOS (the laptop, every car - the 19 and the six
behind their switches - 844x390, 390x844, close-up and the phone's view cropped, the base round93
and the fix, both with ?underskin=1): no page errors; no speckled holes, no structure past a dented
edge on any. COST (the second PC, framecheck Brands, 19 AI + you in the hatch-rwd, every car crushed
and its panels off at frame 30, CPU x4, base / fix / base / fix): work median 172.7 / 164.1 / 161.6 /
175.1 ms, worst 240.7 / 270.6 / 394.0 / 266.2 (the PC's catch-up loop: no difference to read);
a car's picture made every frame (tools/scratch/_underskincost.mjs, the laptop, x1, the hatch-rwd, ?underskin=1): frame median 1.8 / 2.0 ms on the base, 2.1 / 2.1 with the fix (+0.1-0.3 ms each time a car loses a part or its crush steps; nothing on the frames between). PROOF: switch off, renderhash SAME (the PC: thruston, brands-snatch, knobhill).
THE 10 NEW CARS (owner-approved names 11-16; one switch and one hand-back each; src/newcars.ts):
1. PORCH 911 GT3 ARR (Porsche 911 GT3 R, 992): BUILT 11-16 behind ?porch=1 (FIX.porch; testlist
   'porch'), with a new class GT (sub GT3; fits Pre-Spun, Semi-Slick, Wet, the Pirrelly slicks).
   Real: 1,250 kg, ~416 kW flat six behind the rear axle, 9,250 rpm, 6-speed, RWD, 4,619 x 2,050
   mm, wheelbase 2,507, 30/68-18 / 31/71-18. EST (unpublished): 490 Nm, the ratios and final
   drive, Cd 0.45 x 2.1, 39 / 61, downforce ClA 2.1 (the GT3 RS's 409 kg at 200 km/h), mu 1.6.
   tools/newcar.mjs porch-gt3r (second PC; every step ran clean): top 280 km/h (real ~285 EST),
   0-100 3.0 s (none published), 100-0 30.6 m, grip 1.47 g at 60 km/h, 40-100 2.35 s; tyres all
   OK but the 80 s drift (too hot at 6 s, pop point at 20 s: section 7 fails on the base too);
   partcheck all 10 kinds OK; AI x6 Realish seed 7: Thruston 184 s, 0 incidents, laps 56.4-62.3 s
   (the Lamburghini 193 s, 1 incident); Sweaty Lamb (loose) 408 s, 15 incidents (14 offs, 1
   spin), laps 116.5-138.1 s (the Lamburghini 381 s, 16). Under ?underskin=1 its front lid shows
   the central radiator, its engine lid the flat six; the wing goes with the lid (carbits
   wingOnLid). PROOF, switch off (PC, base round82): worldhash (--highway 20), simhash, renderhash
   (thruston, brands-snatch, highway) SAME; switch on: simhash SAME (no level uses the car).
   QUESTIONS for the owner: the GT class (or ROAD / Sports), its tyres, the 992 (or the 991),
   the wing with the lid, the switch name, the stock livery (white, red roof and wing).
2. CATERPILLAR SEVEN (Caterham Seven 420R): BUILT 11-16 behind ?seven=1 (FIX.seven; testlist
   'seven'), ROAD / Sports. Real: 560 kg, Duratec 2.0 157 kW / 203 Nm in front, RWD (de Dion),
   wheelbase 2,225, 1,575 wide, 195/50 R15, no ABS / TC; 219 km/h, 0-60 mph 3.8 s. EST: the length
   (3,100), track 1.30, 7,800 rpm, the six-speed's ratios and final drive 4.1, 47 / 53, mu 1.36,
   Cd 0.7 x 1.25 m^2 (the area set to reach 219 km/h: 231 at 1.1). tools/newcar.mjs seven-420r
   (second PC, with &underskin=1; every step ran clean): top 224 km/h (real 219), 0-100 4.2 s
   (real ~3.9 EST from 0-60 3.8), 100-0 51.1 m (no ABS: full pedal locks, as the other no-ABS cars
   48-59 m), grip 1.23 g, 40-100 3.52 s, wheelspin on tarmac too, gravel power-on body slip 75 deg;
   tyres all OK but the 80 s drift (as the base); partcheck all 9 kinds OK; AI x6 Realish seed 7:
   Thruston 206 s, 2 incidents (2 offs), laps 61.8-74.0 s; Sweaty Lamb (loose) 515 s, 35
   incidents (28 offs, 7 spins), laps 138.5-176.3 s (the Lamburghini 381 s, 16; the Porch 408 s,
   15). FOUND (not changed): in that loose run AI #4 was given 4 laps, one of 31.8 s (the others
   ~145-176 s) - a lap counted short; not seen in the other cars' runs. Under ?underskin=1 its
   bonnet shows the four behind the nose cone's radiator, its wings the arms (rear: drive
   shafts). PROOF (PC, base round83): switch off worldhash (--highway 20), simhash, renderhash
   (thruston, brands-snatch, highway) SAME; switch on simhash SAME.
   QUESTIONS for the owner: the model (420R or another Seven), the exhaust's side (EST right),
   the stock look (aluminium, green nose and wings, yellow stripe); its front cycle wings are part
   of the body picture, so they do not turn with the wheels.
3. FJORD TRANSFIT (Ford Transit Mk8 290 L2 H2 FWD 2.0 EcoBlue 130 PS): BUILT 11-16 behind
   ?transfit=1 (FIX.transfit; testlist 'transfit'), drivable as ROAD / Van (a new type) and in the
   highway traffic. Real: 1,997 kg, 96 kW / 385 Nm across the front, FWD, 5,531 x 2,059 x 2,490 mm,
   wheelbase 3,300, track 1,503 / 1,486, 215/65 R15, ABS + ESC, top gear 2.30 overall (its 1,850 rpm
   at 100 km/h). EST: the torque band, 4,500 rpm, the lower ratios, Cd 0.37 x 4.4, 58 / 42, CG 0.75
   m, van tyres' grip mu 0.9 (at 1.1 it held 1.0 g, on its roll limit; at 0.9 0.82 g, a real van's
   ~0.78). TRAFFIC (ai/trafficCtx.ts VEH 2.4; a car not in the roster is left out, so switch off
   the mix is unchanged): it stands for all vans at 17 % of the picks, the vans' share of Great
   Britain's traffic (DfT 2023); tools/scratch/_trafficmix.mjs, 20 000 draws: 16.8 %, ~1 car in 6.
   tools/newcar.mjs transfit-van (second PC, with &underskin=1; every step ran, the crash picture on
   its retry): top 148 km/h (~155 EST), 0-100 14.1 s, 100-0 51.2 m, grip 0.82 g, 40-100 10.9 s;
   tyres all OK; partcheck all 10 kinds OK; AI x6 Thruston 273 s, 0 incidents, laps 83.6-99.2 s;
   Sweaty Lamb 560 s (the cap), 50 incidents of which 48 put-backs: from ~447 s the vans sit in
   first at full throttle on the gravel / sand, front wheels spinning, and give up again and again
   (the Chevelle there: 455 put-backs; the Golf and the V70 none) - FOUND, not changed.
   HIGHWAY TRAFFIC, switch off -> on (PC): trafficcheck (not in CI; 10 FAILs on the base) 10 -> 11:
   motorway pop-out fail gone; dual contacts 92 -> 66 steps, off the carriageway 6 825 -> 5 706;
   walled contacts 933 -> 1 127, off 12 666 -> 8 449, and one wreck (185 car-steps: a saloon into a
   hatch, no van; laptop run with the cars named); one contact with a van in the run (a van onto a
   slow saloon). hwracecheck (motorway, d2, 0.6, seed 4242): ALL OK both; racer-traffic contact 1
   -> 2 steps, racer-racer 372 -> 0, mean pace 115 -> 130 km/h (a different mix, different gaps).
   PROOF (PC, base round84): switch off worldhash, simhash (on its re-run: the first timed out on a
   cold page load), renderhash (thruston, brands-snatch, highway) SAME; switch on simhash DIFFERENT
   in highway-traffic only (the mix) - [sim].
   QUESTIONS for the owner: the model, the van share (17 %), a van paint mix (real ones mostly
   white; they take the cars' mix now), the long stop that comes with van grip, the exhaust side.
4. FJORD EFFING-150 TROPHY TRUCK (an open-class Ford F-150 trophy truck): BUILT 11-16 behind
   ?trophy=1 (FIX.trophy; testlist 'trophy'), OFF-ROAD / Trophy truck (a new type). Real (Auto
   Bild's track test): 850 PS, a 7.2 V8 set back, RWD, wheelbase 3.15, ~2.5 t, ~60 cm clearance on
   80-90 cm of travel. EST: 900 Nm, 6,500 rpm, a three-speed automatic (TH400) + 5.0, 5.6 x 2.35 m,
   track 2.0, 39 x 13.5 R17, Cd 0.6 x 3.2, 50 / 50, CG 0.95 m, springs 0.9 Hz, desert tyres mu 1.0
   (1.15 held 1.09 g on tarmac). tools/newcar.mjs effing-tt (second PC, &underskin=1): top 236 km/h
   (~225 EST), 0-100 6.7 s, 100-0 69.2 m (no ABS), grip 0.88 g, 40-100 5.5 s, gravel power-on
   body slip 63 deg; tyres all OK but the 80 s drift (as the base); partcheck all 9 kinds OK; AI
   x6 Thruston 246 s, 4 incidents, laps 73.1-90.8 s (#4 again given a 26.3 s lap, as on car 2);
   its LOOSE step on the Sahara stage FAILED (aifieldcheck, like stagecheck, cannot load a
   generated stage) - run on Sweaty Lamb instead: 560 s (the cap), 723 put-backs, 0-1 laps each;
   two trucks with no contact 74 put-backs; one alone laps (aidrivecheck 171.8 s, the Sport quattro
   121.3 s) - the bogging found on car 3 (the van, the Chevelle), worse: FOUND, not changed.
   ROUGH GROUND in the real game (tools/scratch/_rolljump.mjs, ?autopilot, 150 s real, PC):
   Sahara stage - the truck 1.41 km, top 87 km/h, 1 jump (0.22 s), landing x1.94, 0 rolls, 1
   put-back; the Sport quattro 2.04 km, top 118, 2 jumps (0.63 s), landing x2.60, 0 rolls. Deaf
   Valley single lane - the truck seed 1: 3.41 km, top 163, 1 jump (1.84 s), landing x2.60, 1 roll
   (reset); seed 2: 3.32 km, top 173, 2 jumps (1.82 s), x2.60, 2 rolls (one to its roof, both
   reset); the BMV M135i seed 1: 4.04 km, top 174, 2 jumps (0.37 s), x1.50, 0 rolls, 3 put-backs
   (seed 2 timed out on its page load, not re-run). PROOF (PC, base round85): switch off
   worldhash, simhash, renderhash (thruston, brands-snatch, highway) SAME; switch on simhash SAME.
   QUESTIONS for the owner: the open class (850 PS) or a Spec truck (525 hp); its estimated size
   and tyres; it rolled in each Deaf Valley run (1-2 in 150 s) - right for a tall truck?; its
   long name runs past the landscape garage's picker.
   GRIP UP (owner 11-16: "trophy trucks grip was a bit low ... both slightly, try loose mostly and
   a tiny rise on tarmac too"): its own factory set, desert tyres as the Dunflop All-Terrain
   (tarmac x0.98, gravel / dirt x1.12, grass / sand x1.15; it plough less), and mu 1.0 -> 1.07.
   tyrecheck peak lateral g (working): tarmac 0.89 -> 0.93 (+4.5 %), gravel 0.59 -> 0.70 (+19 %);
   steady grip at 60 km/h (tools/scratch/_surfgrip.mjs): tarmac 0.88 -> 1.00, gravel 0.66 -> 0.73,
   dirt 0.62 -> 0.69, grass 0.42 -> 0.52, sand 0.40 -> 0.47 - that sweep is coarse (it jumps: 0.88 up
   to mu 1.04, 1.02 at 1.05), and it is the garage's grip figure too (now 1.0 g); 0-100 6.7 -> 6.5
   s, 100-0 69.2 -> 66.1 m. PC, before -> after: Sweaty Lamb AI x6 (seed 7) - 560 s (the cap) both,
   resets 454 -> 111, laps 0-2 -> 2-3 each (one counted 1.2 s: the short-lap credit, known); the
   Sahara stage (seed 1) 1.39 -> 1.77 km, top 87 -> 94, 1 -> 0 put-backs, 0 rolls both; Deaf Valley
   seed 1 3.31 -> 3.69 km, top 181 -> 201, rolls 1 -> 2 (both onto the roof); seed 2 2.81 -> 2.46 km,
   top 157 -> 165, rolls 1 -> 2. Switch off and on: simhash SAME. QUESTIONS: the stock tyre (Pre-
   Spun no longer fits it, as the muscle car's and the tractor's own sets); it rolls a little
   more on Deaf Valley with the grip (2 a run, not 1).
5. HONDER CIVVIC TYPE ARR BTCC (Honda Civic Type R FK8 BTCC, NGTC 2018-21, before the hybrid):
   BUILT 11-16 behind ?civvic=1 (FIX.civvic; testlist 'civvic'), with a new class TOURING (sub
   BTCC; fits the GT class's tyres: Pre-Spun, Semi-Slick, Wet, the Pirrelly slicks - newcars.ts
   NEW_CLS_IDS). Real: 2.0 turbo four across the front, 350+ bhp (261 kW), FWD, Xtrac six-speed
   sequential, 1,280 kg with the driver, 4,557 x 1,875 mm (NGTC's width), wheelbase 2,700, Goodyear
   265/660 R18 slicks, no ABS / TC; 145-160 mph quoted at Thruxton, 0-60 mph ~4.0 s quoted for a
   BTCC car. EST: 450 Nm (3,500-5,500), 261 kW at 6,500, 7,000 rpm, the ratios and final drive
   3.0, Cd 0.40 x 2.1, 58 / 42, track 1.68, CG 0.45 m, downforce ClA 0.35 / 0.45, mu 1.5, springs
   2.4 Hz. tools/newcar.mjs civvic-btcc (second PC, &underskin=1; every step ran clean): top 249
   km/h (~250 EST), 0-100 4.7 s (~4.3 EST: front-drive, traction-limited off the line), 100-0
   46.5 m (no ABS), grip 1.39 g, 40-100 3.61 s, wheelspin on tarmac too, gravel power-on body slip
   4 deg; tyres all OK but the 80 s drift (as the base); partcheck all 10 kinds OK; AI x6 Realish
   seed 7: Thruston 197 s, 2 incidents (1 off, 1 spin), laps 59.1-69.9 s (the Porch 184 s, the
   Lamburghini 193 s); Sweaty Lamb (loose, aifieldcheck run apart) 439 s, 13 incidents (13 offs),
   laps 124.7-151.3 s (the Lamburghini 381 s, 16; the Porch 408 s, 15). Under ?underskin=1 its
   bonnet shows the four across behind the radiator; the wing goes with the tailgate (carbits
   wingOnLid). PROOF (PC, base round86): switch off worldhash (--highway 20), simhash, renderhash
   (thruston, brands-snatch, highway) SAME; switch on simhash SAME (no level uses the car).
   QUESTIONS for the owner: the TOURING class (or ROAD / Hatch) and its tyres (the real ones are
   Goodyear slicks: GOOD YEAH has none for it); the FK8 pre-hybrid (no hybrid boost: that would
   be a new mechanic); the stock look (white, a red roof, a black wing, splitter and mirrors; no
   sponsor livery); the side exit on the left (EST); the wing going with the tailgate (as the
   Porch) or able to break off alone; its long name wraps to three lines in the landscape
   garage's picker and pushes its "1 / 1" out of sight.
6. LEND ROVER DEFUNDER 110 (Land Rover Defender 110 Station Wagon 2.2 TDCi, 2012-16): BUILT 11-16
   behind ?defunder=1 (FIX.defunder; testlist 'defunder'), drivable as OFF-ROAD / 4x4 (a new type)
   and in the highway traffic. Real (Land Rover): the Puma 2.2 diesel four along the front, 90 kW
   at 3,500, 360 Nm at 2,000, six-speed manual 5.443 2.839 1.721 1.223 1.0 0.794, the transfer's
   high range 1.211 on 3.538 axles (4.285), permanent 4WD, 1,987 kg, 4,785 mm with the spare on the
   door x 1,790, wheelbase 2,794, 235/85 R16, ABS + traction control; 145 km/h, 0-100 15.8 s. EST:
   the torque band (2,000-2,400), 4,500 rpm, Cd 0.55 x 2.8, 52 / 48, track 1,486, CG 0.8 m, the
   all-terrain tyres' mu 0.85, springs 1.1 Hz; the low range not modelled (no new mechanic).
   TRAFFIC (ai/trafficCtx.ts VEH 0.4; left out with the switch off): it stands for the Land Rovers,
   ~3.4 % of the cars (1.1 M of GB's ~34 M licensed cars, DfT / DVLA licensing data via a tracker);
   tools/scratch/_trafficmix.mjs, 20 000 draws: 3.2 % of the picks alone (~1 car in 31), 2.6 % with
   the Transfit on too (~1 in 38; the vans 16.8 -> 16.3 %). tools/newcar.mjs defunder-110 (second
   PC, &underskin=1; every step ran, the crash picture on its retry): top 148 km/h (real 145), 0-100
   13.2 s (real 15.8: 16 % quick - not changed, a question), 100-0 53.7 m, grip 0.81 g (tyrecheck
   working: tarmac 0.77, gravel 0.52), 40-100 11.15 s, gravel power-on body slip 9 deg; tyres all OK;
   partcheck all 10 kinds OK; AI x6 Thruston 276 s, 1 incident, laps 84.1-99.7 s; Sweaty Lamb 519 s,
   6 incidents (4 offs, 2 spins), every car 3 laps, laps 160.8-178.7 s (no bogging, unlike the van
   and the truck). Rolled pictures rest on a side most (166 of 300; the Civvic 98). ROUGH GROUND
   (_rolljump.mjs, 150 s real, seed 1, PC): Sweaty Lamb - 1.88 km, top 81, 1 jump (0.43 s), x2.24,
   0 rolls (the V70 2.22 km, top 102, 1 jump 0.68 s, x2.60, 0 rolls); Deaf Valley - 3.56 km, top
   134, 0 jumps, 0 rolls, 1 put-back (the V70 3.66 km, top 170, 3 jumps, 1 roll to its side, 2
   put-backs). HIGHWAY TRAFFIC, switch off -> on (PC): hwracecheck (motorway, d2, 0.6, seed 4242)
   ALL OK both, racer-traffic contact 1 -> 61 steps, racer-racer 372 -> 15, mean pace 115 -> 120
   km/h; trafficcheck (not in CI) 10 FAILs both, but it does not repeat run to run (the same code
   twice: dual off the carriageway 2,701 and 14,383 car-steps) - with every car named (a copy with
   TFDBG fixed: its contact print threw on a car not in the list) no Defunder is in any contact,
   off-road or wreck line; switch on, walled: one wreck (a Golf and a V70 rolled). PROOF (PC, base
   round88): switch off worldhash (--highway 20), simhash, renderhash (thruston, brands-snatch,
   highway) SAME; switch on simhash DIFFERENT in highway-traffic only (the mix) - [sim].
   QUESTIONS for the owner: the classic Defender (to 2016) or the new one (2020 on); OFF-ROAD / 4x4
   or ROAD; its share (it stands for the Land Rovers, ~1 in 31); the 0-100 (13.2 s against 15.8:
   slower shifts or drivetrain losses would close it); the stock look (green, a white roof, black
   arches and bumper); the exhaust on the left (EST).
LAUNCHES (owner 11-16 on the Civvic: "touring car not wheel spinning when pulling away seems
unlikely", both with and without TCS; option C: "if you are holding throttle off the start, you
will be revving up effectively off the start, like in real life"): BUILT 11-16 behind
?launchramp=1 (FIX.launchramp; testlist 'launchramp'). FOUND: the physics spins the Civvic's
fronts (headless, floored at once: from 0.16 s, for 5.1 s); the player's held-button ramp
(src/input.ts, 0.26 at once to full over 1.5 s) kept every car from spinning in its first ~1 s
(first spin: the Golf 0.90 s, the M135i 0.97, the Chevelle 1.20, the Civvic 1.37; the Mini never).
NOW: a throttle that goes down at a standstill (under 0.5 m/s) is full at once and stays full while
held; a press on the move ramps as before. REAL GAME (tools/scratch/_launchgame.mjs, the player's
own input path, a free start on Thruston, the first 3 s, off -> on; aids off / on): first spin -
the Civvic 1.4 -> 0.2 s (both), the Golf 0.9 -> 0.1, the M135i 1.0 -> 0.1, the Chevelle 1.2 -> 0.1,
the Sport quattro 1.2 -> 0.1; the Mini and the V70 no spin either way; km/h at 3 s, aids off / on:
the Civvic 42 / 51 -> 45 / 58, the Golf 41 / 44 both, the M135i 46 / 52 -> 43 / 50, the Chevelle 32 /
38 -> 29 / 38, the Mini 38 -> 47, the V70 58 -> 65, the S1 84 / 88 -> 88 / 89. START TYPES (the
Civvic, aids off): a standing grid (Thruston, 5 AI) or a stage start (Sweaty Lamb, 5 AI) with the
gas held through the countdown - the same either way (the ramp is full by the green: first spin
4.1 s / 4.0 s, the same 50 / 51 of 90 samples spinning); the gas let go in the countdown and pressed
at the green - first spin 5.6 -> 4.4 s (Thruston), 5.3 -> 4.3 s (Sweaty Lamb); the highway's rolling
start (the formation drives the car) - the same either way; a free start on Sweaty Lamb 1.1 -> 0.1
s; lift and press again at 30 km/h - the ramp the same either way (0.41, 0.56, 0.70, 0.85 at 0.3 s
steps). The AI is not touched (input.ts is the player's only); simhash, switch off and on, SAME
(PC; it drives the player with its own input). NOT TESTED: a RESET put-back that rolls on at
speed (by construction: it is over 0.5 m/s, so the ramp applies; a throttle held for 1.5 s is
full either way), a phone's touch pedal (the same path as the key), the walkthrough (no card:
not a new mechanic). QUESTION for the owner: a stab of the gas from rest is now full throttle,
so a gentle pull-away from rest is no longer possible on the button (the ramp was made for that,
11-02); right?

### 3b. Tracks (the venue helper builds, the foreman reviews, the owner passes; one switch each)

- THE ROC STADIUMS ARE ENOUGH (owner 11-12: "I think that's enough stadiums haha unless the track
  is really special - we have enough for a short championship or two"): Wobbly, Stade de Prance and
  The Bird's Mess built; ACCORDION STADIUM (Sydney 2025) and DUSSELDORK ARENA (2010-11) not built
  unless their track is really special.
- X GAYMS RALLYCROSS, the course L.A. LIVELY: PASSED 11-13, the default (TODO-DONE).
- OLD WOBBLY (approved 11-10): the old Wembley's stock car / speedway track round the pitch, 345 m
  real (378 yd), so built at its size (Wembley's shape, a ~550 m lap) in the old stadium's bowl
  with its twin towers ("it can size match with the current stock car circuit or relative if it's
  bigger irl").
- NEW RALLYCROSS TRACKS (owner 11-10: "keep the originals" - the old stages stay as they are; "Side by
  side ace make them all or at least 4+"). QUEUED for the worker after the performance audit. Owner
  11-13: the REAL ONES FIRST - Holjes, Croft's RX layout, Pembrey, Blyton - then a NITRO-STYLE one
  OUTDOORS (not a stadium: a gap jump over the track, a crossover bridge, banked dirt turns), then
  the HEAD-TO-HEAD SWAP-OVER (two parallel lanes crossing on a bridge, mixed tarmac and gravel).
  NAMES (owner 11-13: "Ok yea names work"): Holjes = HOLY JEEZ (PASSED), Croft RX = CROUGHED RX (PASSED; its own
  full-size level of the Croughed venue; the half-size circuit unchanged), Pembrey = PEMBREEZY, Blyton
  Park = BLIGHTY PARK, the Nitro-style one (after Glen Helen) = GLEN HELLISH, the swap-over = SWAPSIES. Real (traced, real tarmac / gravel
  split, real jumps, real joker), at FULL SIZE as the other short courses (NOTES: track scale), not
  stiff or boring, with the props pass and the barrier check in the first hand-over (NOTES: every
  new track). One switch each. PEMBREEZY ALSO AS A ROAD CIRCUIT (owner 11-13: "Pembreezy for an all
  tarmac race track too"): the Pembrey circuit, all tarmac, at share 0.5 like the other circuits,
  from the same map download as its RX lap. SHARE THE BUILD (owner 11-13: "use the same track where
  possible to save reloading / rebuilding"): a venue's layouts at the SAME scale share one build
  (world/venue.ts venueBuild), and each level, once built, is kept for the session; a short course
  at full size (share 1) beside a half-size circuit is its own build of the same map data.
  HOLY JEEZ PASSED 11-14: TODO-DONE.
  HOLY JEEZ FIRS PASSED 11-15: TODO-DONE.
  CROUGHED RX PASSED 11-15 WITHOUT A JOKER (owner: "no joker if it's not there in real life"):
  TODO-DONE.
  PEMBREEZY (the circuit and Pembreezy RX) PASSED 11-16 with its fences tidied: TODO-DONE. OPEN
  (owner to decide on the frame numbers there): thin the RX's remaining mapped tyre walls?
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
- WATCH (found 11-15, section 2 THE MENU RACE'S NaN): a NaN car state once in menucheck (11-04).

## 5. QUESTIONS FOR THE OWNER

- ANSWERED 11-15: CROUGHED RX'S JOKER - none (owner: "no joker if it's not there in real life");
  the hand-laid loop removed, the level passed (TODO-DONE).
- CROUGHED RX'S START (worker 11-15): no source found says where Croft's rallycross grid stood.
  Built: the grid on the circuit's Main Straight (the start lane), the line where it meets the lap
  north of the pits, the first corner Clervaux (a 2016 report: "spun into the gravel at the first
  corner" - Clervaux's trap). RECOMMENDED: keep it.
- CROUGHED RX'S BIG SCREEN (worker 11-15): no screen prop exists (existing props only): a board
  labelled LIVE stands in by the start. RECOMMENDED: a big-screen prop (new art) if you want one.
- ANSWERED 11-14: Deaf Valley's exit names KEPT ("There ok for Death Valley"); the countryside
  highway levels: names in the same style if they lack them ("I think it has them tho already") -
  check, make them only where missing. CHECKED (foreman): the countryside list exists, with four
  plain real towns; owner "Pun them": GHOULE, SKUNKTHORPE, BRIGGADOON, HOWDY-DEN behind
  `?exitpuns=1` (highway/extras.ts SLIP_NAMES); PASSED 11-15, the default.
- ANSWERED 11-14: Dongington Park's catch fence in front of the Hollywood grandstand KEPT (owner:
  "Keep dongerton catch fence"); its test-list reminder removed.
- ANSWERED 11-14: GitHub tidied (owner: "The 108 only"): the 109 branches whose every change is in
  main deleted; kept: experiment/hudtext and 14 old versions / October experiments (worker/091,
  093, 119, 224; foreman/birdsmess, dongington-venue, moanaco-venue, police, police2, portals,
  snotterton-venue, stadiumtyres, thruston-venue, wobbly-venue).
- ANSWERED 11-14: the black wire / rope fence replaced on the old levels too ("Replace it there
  too"; "Oh is that not already done"). CHECKED (foreman): it IS already done - no level builds a
  'fence' barrier any more (all 63 levels and the stages built and counted: 0). Closed.
- PARKED 11-15 (owner: no siren "until we do all sound" - "With sound" meant WITH THE SOUND
  PASS, misread as a go): off the test link and the test list; the code stays behind `?siren=1`,
  off, for the sound pass. Was: a police SIREN. BUILT 11-15 behind `?siren=1` (FIX.siren; env
  SIREN=1), to approve: a police car chasing - its light bar flashing (`car.blues`) - sounds; a
  cruising or waiting one (and an angry driver) is silent. Synthesised as the engine is
  (`audiosiren.ts`, no files): the UK two-tone, 600 / 800 Hz, ~0.6 s each (the wail and the yelp
  are one constant, `SIREN_TONE`). The nearest 2 chasers heard at most (`game/sirens.ts`); level by
  distance (half at 30 m, silent past 260 m), duller far off, panned left / right; no Doppler
  (the engine has none). Through the master gain (SOUND slider, MUTE); silent on the menu, at
  pause, behind the loading screen and a walkthrough, at the chase's end, while the page is
  hidden. Visual twins already there: the flashing light bar and the HUD's flashing blue behind
  the stars; nothing visual added. MEASURED (laptop): the live game (tools/scratch/_siren.mjs):
  1-2 voices while chasers are lit, 0 at pause (2 again on RESUME), 0 within 0.5 s of the heat
  clearing, 0 on the MAIN MENU; the siren's frame step 0.009 ms (CPU x1) / 0.035 ms (x4); frame
  work with 3 chasers, off / on: x1 median 9.5 / 8.0 ms, x4 79.1 / 78.7 ms (noise). Its level
  (rendered, tools/scratch/_sirenwav.mjs): at 25 m ~11 dB under the engine at 110 km/h, ~6 dB
  under it passing at ~10 m. Switch off: worldhash, simhash (all runs), renderhash (highway) SAME.
  AT THE SOUND PASS, OWNER TO HEAR: the pattern (two-tone / wail / yelp), its level, Doppler.
