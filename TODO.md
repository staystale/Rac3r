# RAC3R - open work

Only what still needs looking at: what is on the phone now, what is being built, what is open.
Finished work (passed, defaulted, dropped, superseded, with its measured numbers and the owner's
verdicts) is in `TODO-DONE.md` and git; the owner's rules, decisions and lessons are in `NOTES.md`.

## 1. UNDER TEST (on the phone now)

The live list is `src/core/fixes.ts` FIX (a switch there = under test) and `src/testlist.ts`. Each
build's full record (what was built, every number) is in `TODO-DONE.md` under its round.

The 11-11 round (14 entries, 11 switches) passed 11-12, and the performance round (carcache,
carcull, the texture warm-up) and the stadium crossovers passed 11-12 ("mostly pass"), their
records in `TODO-DONE.md` (PASSED 11-12). ?underskin (the damage look), ?carparts (steps 1-6:
each car's own crash parts) and ?carshade (every closed car shaded) PASSED 11-17, the default
(TODO-DONE, PASSED 11-17, THE PASS BATCH 4). ?dmgmore (the rolled cars, dragging) PASSED 11-17, the default (TODO-DONE, PASSED 11-17, MORE DAMAGE).
?dmgmore2, ?marktrack, ?scanyah (the tractor) and ?tipping PASSED 11-17, the default (TODO-DONE). On the phone
now: nothing until the Scanyah trailer (?trailer) lands.
?resetclean (bugs 1 + 2, the reset) and ?lamps (bug 5, the headlights) PASSED 11-21, the
default (TODO-DONE, PASSED 11-21, RESET CLEAN AND LAMPS).
?trailer, ?boxhold and ?gridlen PASSED 11-21, the default (TODO-DONE, PASSED 11-21, THE
TRAILER, BOXHOLD, GRIDLEN).
?fpshud, ?marksage (tyre marks on big levels), ?blighty and ?flagfix PASSED 11-21, the default (TODO-DONE,
PASSED 11-21, FPS ROW, MARKS, BLIGHTY, THE FLAG).
(Their records: TODO-DONE, PASSED 11-17, THE TRACTOR AND THE TWO-WHEEL STATE; and MORE DAMAGE 2 AND
MARK TRACK.)

## 2. BEING BUILT

- THE OWNER'S LIST OF 11-21 ("digest and fit into the todo ... discuss anything needed before
  actioning"; each item gets a brief plan / the cause before any build, behind its own switch):
  BUGS
  1. RESET STUCK: after a reset the car sometimes cannot pull away - not the slippery-ground case
     (that is fine) - find it.
  2. RESET ROLLED: a reset sometimes leaves the car upside down, or keeps its momentum, after a crash.
     PASSED 11-21 (?resetclean), the default (TODO-DONE, PASSED 11-21, RESET CLEAN AND LAMPS).
  3. NO CHEQUERED FLAG at the finish (seen at Angle Sleezy); every AI race must have a finish.
     PASSED 11-21 (?flagfix), the default (TODO-DONE, PASSED 11-21, ... THE FLAG).
  4. TYRE MARKS CUT OFF in straight lines on one surface (Snoozuka, a couple of turns before the
     tunnel; other tracks too) - a ground-tile edge?
     PASSED 11-21 (?marksage), the default (TODO-DONE, PASSED 11-21, ... THE FLAG).
  5. HEADLIGHT GLOW drawn behind the lamp, on the car's own body: each car's lamps light only what
     a real one would, with their own shape and reach.
     PASSED 11-21 (?lamps), the default (TODO-DONE, PASSED 11-21, RESET CLEAN AND LAMPS).
  6. PEMBREEZY AI: odd behaviour - put back whatever the earlier "fix" changed so it drives like
     every other level; check the line for kinks, queuing, braking on straights (suspect: the
     brake-and-steer-to-avoid rule, to tune with the rest of the AI).
  AI (one phase, the AI rework / tune - the parked ?pbzline / ?driftbrake and 3e's case with it)
  7. THE AI WAITS behind traffic and the police dodge traffic better than racers - find the bug
     (fixes went in before); explain to the owner how the AI looks ahead; make it aware of other
     racers, traffic, police and angry (aggro) cars.
  8. TRAFFIC DODGES RACERS too, gently, by its drivers' skill.
  9. TUNE THE AI with the skill sliders across a range of levels: few crashes (not none), faster
     laps, real racing (rubbing, overtakes, the field moving - not a parade), first corners not
     chaos; fast cars in big packs on tight first corners crash too much now. OWNER 11-21: first-
     corner contact is OK but like real racing, not a pile-up every time; cars behind a crash weave
     and avoid it well and only sometimes add to it.
     THE OWNER'S TESTS FOR THE TUNE (11-21: "it should be possible to test and prove"), measured
     before / after on many levels, seeded, on the PC: (a) FASTER lap times; (b) crashes - mostly
     small, now and then a big one, not a pile-up every race; (c) NO random braking halfway down a
     straight (a per-car brake / lift trace on straights: zero without a real reason); (d) cars do
     not want to touch but are happy to run close (contacts down, close-running time up).
     OWNER 11-21: "we ideally want to TUNE our racer AI not change it - but do what's needed, discuss
     first as always": the sliders / numbers first; a code change only where a bug needs it, planned first.
     THE TUNE PLAN, owner yes 11-21 (?aitune, Worker A): K_BRAKE up on tarmac AND loose ("let the ai
     drivers correct" - no slow loose driving, no odd surface changes); the pedal feed-forward if
     dabbing stays; followers copy the leader's braking but still race; pile-ups by better dodging
     (faster reactions / prediction), NOT lower aggression; close-running clearance; the "why held"
     trace on the highway AND circuits. ONE BASE AI, highway-only tweaks only where essential.
  10. ROLLING STARTS: after the GREEN the cars still move a bit uniform, as a block - each should
     race its own line from the green (owner 11-21: b). PASSED 11-21, the default (TODO-DONE,
     PASSED 11-21, THE ROLLING GREEN AND THE HIGHWAY FAN): each AI's own reaction at the green, a
     few jumping it, the start phase from the release; the highway start's slide to one lane fixed.
  11. AI HANDBRAKE use; drifting later (drift modes / tracks / events).
  FEATURES
  12. FLASHING: racers may flash a car blocking them (traffic or a racer). Traffic flashed moves
     over; flashed too much (a chance) it gets mad and chases whoever flashed it (an AI or the
     player). Racers never get mad or move for a flash, but may flash in races. Flashing works only
     with working headlights; dead lamps cannot. OWNER 11-21: the PLAYER flashes with the existing
     lights switch (on / off rapidly) - no new button; damaged FLICKERING lamps act as a flash all the
     time (they annoy the traffic ahead). OWNER 11-21 on the plan: the flicker as it is (3-8 s after
     a hit, then it settles), on the sim clock; it counts as flashing; NO single-flash anger (3
     strikes only); three flickers anger as three flashes; the racers' flicker flashes traffic too
     and a car angered by a racer chases that racer; racers never get mad.
     BUILT (Worker C 11-21) behind ?lampflash=1 (physics/lampsim.ts, game/flashes.ts, ENGINE:
     FLASHING THE TRAFFIC; the walkthrough's FLASH THEM card on the highway rules). MEASURED
     (tools/scratch/_lampflash.mjs, the motorway, autopilot 100 km/h, a car put 35 m ahead):
     a RACER's corner hit to 0.25 - its lamp flickered ~5 s, the car ahead got 2 flashes, the
     third made it angry at that racer inside 3 s, and it closed 33 -> 3-4 m on the racer over
     the next 9 s; no racer ever angry. YOUR corner hit (twice): the lamp flickered ~3 s and
     settled dead once, steady once; the car ahead got 2 flashes and moved over (half do) before
     a third. Headlights smashed (0.4): a hand flash reached no one (whole: 1). The FLASH THEM card
     photographed at 390x844 and 844x390 (fits, points at LIGHTS). A flicker of 2.4 s or more is 3
     flashes: a car ahead that stays in your lane through it gets angry. AWAITING THE PHONE TEST.
  13. FPS counter as a HUD-list toggle.
     PASSED 11-21 (?fpshud), the default (TODO-DONE, PASSED 11-21, ... THE FLAG).
  14. CAMERA SHAKE in crashes: it already exists (owner 11-21: "there is but it's ok let's leave it
     for now"; it may have changed since the camera keeps the player's car clear of the HUD). Parked.
  15. HIGHWAY: a city theme, Stockholm ("getaway"), beside Country and Deaf Valley (owner: yes -
     motorways, tunnels, bridges over water). OWNER 11-21 on the plan: the name GETAWAY STOCKHOLM;
     all 5 road types; tunnels SLATTED as Moanaco's; water NOT walled all the way (gaps, weak
     fences - you can go in); its own colder season numbers in the one weather system (snow banks
     only if the game has them); the existing cars reweighted, no new ones; the same police for now;
     blue signs; Worker C writes the silly signs, the owner approves; police and other speeders
     slightly up (numbers proposed, not set). Build order: (1) card, city stretches, buildings,
     noise walls, signs; (2) water and long bridges; (3) tunnels; (4) climate, traffic, police -
     each to the phone before the next. Drive on the left kept (foreman confirming).
     STEP 1 BUILT (Worker C 11-21) behind ?stockholm=1 (highway/city.ts, ENGINE: GETAWAY
     STOCKHOLM). MEASURED (tools/scratch/_citylots.mjs, node, the first city stretch 400-2100 m,
     3 seeds): share of each side that is a lot - motorway 64%, interstate 59%, dual 61%, walled
     48%, single lane 64% (the rest: slips / approaches / lay-bys 2-8%, the side road 0-17%, gaps
     and bends 16-37%); no building or noise wall on the road or any lane (0 of 576-776 checked
     per road type: a lot is laid once the side road along it is known); photos
     tools/scratch/_city-*-390x844 / 844x390, no page errors. The silly
     signs (presets.ts CITY_SIGNS) FOR THE OWNER TO APPROVE. AWAITING THE PHONE TEST.

- THE 11-16 QUEUE (every item owner-approved after a brief plan; details in each worker's TODO
  entry as it lands):
  - THE SCANYAH TRAILER (Worker A's joint, finished by Worker C), ?boxhold and ?gridlen PASSED
    11-21, the default (TODO-DONE, PASSED 11-21, THE TRAILER, BOXHOLD, GRIDLEN). Later trailer types:
    a flatbed with visible cargo first (owner: "I don't mind").
  - WORKER B (paused): damage items 4 and 3 passed 11-17, the default. Blighty Park
    RX and the Outer circuit: finished by Worker C 11-21 behind ?blighty=1 (3b below).
  - PARKED: PIT STOPS (item 16 below) - owner 11-16: "needs more work and discussion, I have images
    to use" - ask for the images; the limiter per venue (80, 60 at tight ones), the AI's strategy
    simple. ?pbzline / ?driftbrake for the AI tune (3e). ?siren for the sound pass.

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
15b. FUEL MISSES CARRIED ON: PASSED 11-16, the default (TODO-DONE).

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
18. F1 vs WORLD CIRCUITS in the menu: PASSED 11-16, the default (TODO-DONE, PASSED 11-16, THE PASS
    BATCH 3).
19. LOW RANGE: PASSED 11-17, the default (TODO-DONE, PASSED 11-17, LOW RANGE).

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

THE 10 NEW CARS (owner-approved names 11-16; one switch and one hand-back each; src/newcars.ts):
1-7 PASSED 11-16, the default with the launches (owner: "all pass apart from my earlier comments"):
   the Porch 911 GT3 Arr, the Caterpillar Seven, the Fjord Transfit, the Fjord Effing-150 Trophy
   Truck, the Honder Civvic Type Arr BTCC, the Lend Rover Defunder 110, the Fjord Focust ST - their
   records in TODO-DONE (PASSED 11-16, THE NEW CARS 1-7 AND THE LAUNCHES). The Mini that never
   spins at a launch: left for now (owner).
   THE FOCUST AS A HATCH and THE SHORT-LAP CREDIT / ROLLGUARD: PASSED 11-16, the default
   (TODO-DONE, PASSED 11-16, THE PASS BATCH).
   OPEN, one switch and one hand-back each:
8 / 8b. THE CLEO CUP (now the Clio III Cup) AND THE CLEO RS 200, THE TRANSFITS LWB AND SWB, the
   Saxo Max, the Strange Rover and the Saxo VTR: PASSED 11-16, the default (TODO-DONE, PASSED
   11-16, THE PASS BATCH).
9 / 10. THE TS010 (reshaped) AND THE ROUTEMONSTER (its wheels, glass, mirrors), and cars 13 / 14,
   THE TESLA and THE M4 GT3: PASSED 11-16, the default (TODO-DONE, PASSED 11-16, THE PASS BATCH 2).
   The two-wheel tipping state (?tipping) and the Scanyah tractor (?scanyah): PASSED 11-17, the
   default (TODO-DONE, PASSED 11-17, THE TRACTOR AND THE TWO-WHEEL STATE). Every car's own crash
   parts (?carparts) and the shading (?carshade): PASSED 11-17 (TODO-DONE, THE PASS BATCH 4).

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
  (owner 11-16: the tyre walls "fine as they are").
  BLIGHTY PARK (the RX and the Outer circuit) PASSED 11-21, the default (TODO-DONE).
  THE RX's PUT-BACKS (owner 11-16: "investigate", ~32 a 20-AI race, half at lap 1200-1300 m): FOUND
  (tools/scratch/_pbzoff.mjs - the racing AI alone, rx-super, difficulty 2, seeds 1-5 x 5 laps, every
  excursion past the edge + 1 m off the joker lane; a per-step trace of the driver's target speed,
  pedals and held drift): off the road 42.1 s in 25 laps, 25 excursions, all on the outside of three
  places in the gravel section, 13 of them within 1.5 m of a bale or tyre stack (Croughed RX 0-3.7 s,
  0-2; Holy Jeez 8.5 s, 2; Knobhill 10.4 s, 10 - the same tool and car):
  - lap 1200-1230 m, the left-hander after the gravel hairpin, toward the joker's mouth (out 1.3-14 m,
    the Armco and bales between the lap and the joker lane): the HELD DRIFT on loose ground starts on
    the approach (1170 m) and holds the throttle (0.3-0.8) with no brake through it (ai/driverPedals.ts
    pedals: no brake while drifting), so the car reaches the apex at 72-77 km/h against its 50 km/h
    plan and runs wide; or, drifting at the apex at the plan's speed, the drift's throttle carries it
    out.
  - lap 1310-1355 m and 1440-1545 m, the gravel S-bends: the racing line swings to its 1.6 m margin
    (ai/line.ts LINE_MARGIN) at the outside edge on each exit and the car, at the plan's speed (1330)
    or at full throttle out of the bend (1450-1480, 64-88 km/h), runs 1-6 m past it onto the grass,
    where the bale rows stand 0-3 m off.
  In a race those cars are hit or stop in the bales and are put back. PROPOSED (owner to choose; no
  change made): (1) LEVEL DATA, behind a switch - Pembreezy RX's line kept further from the edge on its
  gravel (a level field for loose-sector line margin). MEASURED as a throwaway (the same tool, not
  kept): 2.6 m -> off 21.0 s, 15 excursions, 1 by a bale, the 25 laps +39 s (~1.6 s a lap); 3.6 m ->
  15.2 s, 13, 2, +18 s. The 1200 m corner stays (its cause is the drift). (2) THE AI (shared, needs the
  owner's OK): no held drift while the car is over its speed plan (brake first) - every loose level
  would change. (3) Bales further out at the three exits - hides it, not proposed.
  OWNER 11-16: fix 1 and fix 2 YES, fix 3 no ("Fix it don't hide it"); "ideally not be a new system
  just a tune of an old one".
  FIX 1 BUILT behind ?pbzline=1 (FIX.pbzline; Level.looseLineMargin, set on Pembreezy RX only; ai/line.ts
  looseLimits - the line's own edge limits, the LINE_MARGIN it keeps, made LOOSE_LINE_M on the level's
  loose sectors; testlist 'pbzline'): 2.6 m in the commit (the owner picks 2.6 or 3.6).
  MEASURED (_pbzoff, the AI alone, 25 laps; off / 2.6 / 3.6): off the road 52.8 / 41.0 / 15.3 s,
  excursions 31 / 24 / 9, within 1.5 m of a bale or tyre 14 / 7 / 1; the 25 laps 2015 / 2030 / 1999 s
  (no lap-time cost to read: the earlier throwaway gave +39 s at 2.6 and +18 s at 3.6 - noise at 25
  laps; the same tool's base run gave 42.1 s and 52.8 s off on two runs). THE FULL FIELD
  (tools/scratch/_pbzrace.mjs on the second PC, 20 AI, 4 laps, rx-super; off / 2.6 m / 3.6 m, seed 1
  then 2): put back 23 / 28, 29 / 23, 34 / 22 a race - half to nine tenths of them at lap
  1100-1300 m (20 / 11, 14 / 15, 26 / 17), the corner after the gravel hairpin whose cause is the
  held drift (fix 2); AI off the road a median 32.9 / 26.9, 36.9 / 23.6, 28.4 / 21.4 s a race; 20 of
  20 AI finished every race; the tool's own driver
  (no put-back) stuck on the gravel in every race, as before. So the line margin alone does not cut
  the field's put-backs; the lone AI's excursions it does (above). PROOF: switch off, simhash SAME
  (13 runs, and a drive run on Pembreezy RX), worldhash --highway 20 SAME (the PC, the base round98
  against the fix).
  FIX 2 BUILT behind ?driftbrake=1 (FIX.driftbrake; ai/driverPedals.ts pedals - the existing drift
  rule tuned, no new system: a drift with the car more than DRIFT_OVER_MS, 1.5 m/s, over its speed
  plan is not held - no drift throttle, and it brakes as any car too fast; testlist 'driftbrake').
  MEASURED, the lone AI (_pbzoff, Pembreezy RX, rx-super, difficulty 2, seeds 1-5 x 5 laps; off /
  on): off the road 46.9 / 11.2 s, excursions 26 / 9 (at 1200-1250 m 7 / 0, 1300-1350 m 6 / 1,
  1450-1500 m 12 / 8), the 25 laps 1979 / 1969 s. THE AI CHECK SET with Math.random seeded (the AI
  tools are not repeatable run to run - wear and debris draw Math.random; a measuring preload gave
  the same number twice; every figure is off / on, summed or meant over the runs):
  - aijokercheck (rx-super, difficulty 4, seeds 1-3 x 3 random seeds, a race's mean s / off s):
    Pembreezy RX 391.6 / 28.7 -> 380.1 / 19.6; X Gayms 220.7 / 24.0 -> 222.0 / 17.3; The Bird's
    Mess 246.2 / 3.3 -> 237.4 / 1.7; Stadeprance 227.0 / 1.2 -> 225.9 / 0.1; Holy Jeez 237.0 / 7.6
    -> 238.9 / 7.6; Knobhill, Slidden Hill, Old Wobbly the same (within 0.4 s). Gates 1 a race as
    before.
  - aifieldcheck (6 AI, 3 laps, difficulty 2, seeds 1-2 x 2 random seeds; off s / incidents /
    resets): Pembreezy RX 918 / 142 / 11 -> 574 / 92 / 3; Knobhill 350 / 55 / 2 -> 325 / 52 / 2;
    Sweaty Lamb (rally-4x4) 725 / 119 / 0 -> 603 / 96 / 0; Holy Jeez 336 / 67 / 0 -> 349 / 59 / 0;
    Grass Track (hatch-rwd) 22 / 4 / 1 -> 33 / 7 / 0 (WORSE, small numbers).
  - aidrivecheck (12 loose levels x rx-super, rally-4x4, hatch-rwd x difficulty 0 / 2 / 4, 2
    random seeds; lap s / off s, all levels): 4853 / 281 -> 4856 / 279, 4363 / 462 -> 4364 / 443,
    4190 / 697 -> 4196 / 681. WORSE: Killder difficulty 4 off 185 -> 197 s, Knobhill difficulty 4
    29 -> 33 s, Grass Track difficulty 4 laps +3.3 s (its off 18 -> 11 s). Thruston (tarmac) the
    same.
  - hwracecheck (90 s, difficulty 2, traffic 0.6; twisty 4242, twisty 7, motorway 4242; 2 random
    seeds): the same, every figure.
  - THE FULL FIELD (_pbzrace, the second PC, 20 AI, 4 laps, rx-super, seed 1 / 2; fix 1's off run
    -> on): put back 23, 28 -> 9, 5 a race (at lap 1100-1300 m 20, 11 -> 1, 1), AI off the road a
    median 32.9, 26.9 -> 11.4, 9.8 s; the tool's own racing driver (no put-back), stuck on the
    gravel in every race before, FINISHED both (5.6, 8.4 s off) - so the race closed when it did
    (347, 361 s; before, 534 s at the grace limit) with the AI on 62, 66 of their 80 laps (2, 6
    finished): put back 0.29, 0.35 -> 0.15, 0.08 an AI lap. No page errors.
  PROOF: switch off, simhash SAME (13 runs; the second PC, the base round101 against the fix).
  NOT TESTED: rally stages (generated, aidrivecheck covers Sweaty Lamb and Killder only), the
  other start types (rolling, the RX start lane but Slidden Hill's, standing on the highway), the
  wet and snow (ground under the drift law changes), circuits' gravel traps (the law is off on
  tarmac), difficulty 1 and 3, the player's own car (untouched: the AI only), phones.
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
- RACE CONVERSIONS AND SERIES ENTRY (owner 11-16): a road car is upgraded INCREMENTALLY, through the
  normal upgrade levels (nothing new), towards its one-make race version: the road Renolt Cleo RS
  200 (Clio III 200 Cup) towards the Cleo Cup race car (switched to the Clio III Cup to pair); the
  road Citrone Saxo towards SAXMAX spec. Story entry rule, owner: "you can't enter Sax Max
  Championship in story mode until you've upgraded your car ... max out bodywork ... because that
  would cover strength and weight". So BODY must cover weight (a stripped, lighter shell) as well
  as strength - today's plan has Body as damage and puncture chance only: confirm when H is built.
  ROAD CARS ARE STOCK (owner 11-16): every road car is its real base standard spec. A championship
  sets its own limits (the series baseline, caps, weight limits); the player upgrades up to them,
  and if over a limit must downgrade, or buy another car - the player juggles it. Upgrades and
  downgrades both exist.
  AI CARS VARY TOO (owner 11-16): each AI car's upgrade level is spread between the series'
  bottom and top limits, like driver skill, so the field has variety.
- THE REPAIR BILL (owner 11-16): after a Story race, back in the garage, the bill pops up, part by
  part (what is missing or broken, a price each), and the player pays it or goes into DEBT.
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

- OWNER BUG 11-21 "Resetting doesn't heal the trailer for the truck" - FOUND + BUILT (Worker C)
  behind ?trailheal=1: RESET (game/session.ts doReset) mended only the tractor (damage.ts repair:
  dents, crush, lost parts, glass, suspension, wheels, tyres, hanging parts; the bill kept); the
  trailer is a car of its own and was never mended. Now it is mended the same way. MEASURED
  (tools/scratch/_trailheal.mjs, the same damage on both, R): off the trailer kept all of it
  (dents 2.20, 3 parts off, a wheel off, 1.8 tyres flat), on all zeros as the tractor, on Thruston
  and the Lab; photos before / after. RESTART has the same gap (the trailer keeps its damage, the
  tractor is mended) - not changed: an owner question. AWAITING THE PHONE TEST.
- OWNER BUG 11-21 "Lorry cab rolled has no windows? ... Lorries should have side windows like real
  life" - FOUND + BUILT (Worker C) behind ?cabglass=1. THE CAUSE: not the paint - a rolled car's
  side picture (render/carprofile.ts paintSideProfile) has ONE glass band from the waist to the
  roof line, made for cars; the Scanyah's band was its length's last 5 % (the windscreen's rake),
  so its cab's side was all paint; the vans' bands ran up to the roof (windows over 1 m tall), the
  school bus's was one pillarless strip and the Routemaster's one band over both decks. THE FIX:
  each lorry, truck, van and bus has its own side windows (EST from photos): the Scanyah's door
  window high on the cab and the screen's edge; each Transfit's cab door window and screen edge;
  the trophy truck's door window; the farm tractor's tall cab glass round its B-pillar; the school
  bus's ten bays and driver's window; the Routemaster's six upper and five lower bays and the
  half-cab's window. MEASURED (tools/scratch/_cabglass.mjs: a REAL roll - roll.ts startRoll on a
  sideways slide, as a side impact starts it - on Deaf Valley's road, paused on its side): all 9
  on their side at 844x390 and 390x844, by day and at night (the trophy truck landed on its roof
  at 844x390 night in 6 tries), photos and close-ups tools/scratch/cabglass/, the Scanyah, the
  buses and the trophy truck off too; no page errors. partcheck (CABGLASS=1): all 18 kinds OK.
  The Defender keeps the car band (a 4x4's, as the cars). AWAITING THE PHONE TEST.
- OWNER BUG 11-21 "Road markings skipping about on the highway level Devils" (Deaf Valley: no level
  is named Devil; its sign DEVIL'S GOLF CORSE) - FOUND + BUILT (Worker C) behind ?dashphase=1. THE
  CAUSE: the lane dashes are painted into ground tiles that are kept (render/tiles.ts) with the
  canvas dash pattern, which runs along the stroked line's own length from the road window's first
  point (phased by sub.sBase). A lane line off the centre is longer or shorter than the road on a
  bend, so each time the window drops road behind, a spot's dashes move along the line; tiles
  painted before and after a move do not line up. Every endless road with lanes off the centre
  (the countryside the same), not the single lane (its one dashed line is the centre line).
  MEASURED (tools/scratch/_dashphase.mjs, in node, 6 km): a spot's dash phase moved per window move
  (every ~300 m) motorway 2.37 m median, p95 4.28 m (of the 9 m pattern); interstate 1.93 / 4.09
  m; single lane 0. THE FIX (render/lanedash.ts): each dash laid where the road's absolute distance
  is in the first 3 m of each 9 m - a dash start's world spot moved 0.000 m between windows
  (motorway 476, interstate 738 checks). Looks the same (photos _canyondashoff / on). AWAITING THE
  PHONE TEST.
- FOR THE AI REWORK / TUNE (owner 11-16: "still looks like on tarmac Pembreezy too many drivers
  come off the track - maybe this should be saved for the ai rework / tune as they seem to go off
  to regularly / pile up on first corner"; "that the same on dongington ect"): the AI on
  Pembreezy's tarmac, Dongington and other circuits leave the track too often and pile up at the
  first corner. PARKED HERE TOO (owner: "Yes they should wait too"): the two built Pembreezy RX
  fixes, ?pbzline=1 (the line margin on its gravel) and ?driftbrake=1 (no held drift over the
  speed plan), stay behind their switches, off the test list, numbers in TODO 3b. Not fixed now: measure it with the AI tools (seeded,
  tools/scratch/_seedrandom.mjs) as the first case of the AI tune, beside ?driftbrake / ?pbzline.
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
