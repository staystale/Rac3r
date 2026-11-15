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
- RX WALKTHROUGH (owner 11-15: "maybe just say not all races have jokers and don't show the joker
  hud stuff when not needed"): BUILT behind `?rxguide=1` (guide.ts RULES.rx): " Not every
  rallycross has a joker." added to the first card. The joker HUD and steps ALREADY show only on a
  joker level (Croughed RX races as a lap race: the race walkthrough, no joker line). Photos
  tools/scratch/_rxguide-*.
- LOGO FADE (owner 11-15: no "cheap version of the logo first"): PASSED 11-15, the default
  (TODO-DONE). The test tools (navigator.webdriver) get no boot bar: they click to start at once.

- THE FOREST STAGE'S BUILD LEAK (owner 11-15: "Eww fix that issue Forrest building"). BUILT behind
  `?forestseed=1` (FIX.forestseed; testlist 'forestseed'; world/load.ts buildLevel, bounds.ts
  inStandardFloor). CAUSE: a level built on first use read the floor of the level set before it -
  kit.ts trackKit clear and rxDress free keep props and bales 5-6 m inside the live FLOOR - and the
  tape runs were numbered on from every level taped before. Not a random seed: the stage's own
  generator is seeded; Math.random seeded before each build changed nothing. MEASURED
  (tools/scratch/_buildorder.mjs: each of the 50 lazily built levels built in the standard world
  and again right after other levels, back to its stub between): OFF, 12 of 50 differ - the 8 set
  rally stages and the forest stage gain 7-26 trees at their edge after a big venue (forest 827 ->
  853 props after Spa or Croughed RX; 827 after Naffcar or Lab), Croughed RX gains 32-41 bales
  and stacks round Clervaux and Hawthorn (355 loose objects alone, 367 after Croughed, 387 after
  Thruston, 396 after Spa), and X Gayms and Holy Jeez only their tape ids. ON: 0 of 50 differ,
  after Spa, Naffcar, Croughed RX or the highway (a 100 km floor). The level is always the
  "built alone" one, so in the game: the stages lose the extra edge trees they had after a big
  menu-race track (the menu race picks a random circuit, oval or RX track, or the highway).
  CROUGHED RX KEEPS ITS BALES (owner rule "never change what's passed"): a rallycross venue's
  bales and tyre stacks are kept inside the level's OWN floor (rallycross-venue.ts passes
  level.floor to kit.ts rxDress), as the tape is: Croughed RX (546 m) 396 loose objects after
  every level (the standard 260 m world dropped 41 of them: 355). ON, MEASURED again: 0 of 50
  levels differ by build order (after Spa, Naffcar, the highway); Croughed RX, Holy Jeez and X
  Gayms after Spa, Naffcar, Croughed, Thruston: the same (396 / 545 / 585); every other lazily
  built level the same count as before. (In node the highway does not load: "after the
  highway" is after the level before it.) worldhash (LEVELS order): OFF SAME as round49
  (330cae71); ON against the old ?forestseed=1, only Croughed RX (cones 355 -> 396); ON against
  OFF, the tape ids on the tape levels and Croughed RX 367 -> 396 loose objects.
- OLD BANNERS, NO NEW ONES (owner 11-15: no new banners ever; "it should be clear from the game
  what's happening"). BUILT, each behind its own switch (testlist 'wantedlost', 'weathermobile'):
  - `?wantedlost=1` (FIX.wantedlost, game/police.ts): shaking off the police reads WANTED LEVEL
    LOST, not LOST THEM (CATCH THEM / CLOSING IN / PULLING AWAY are the racers'). FITS
    (tools/scratch/_noticeshots.mjs: the escape made by the game's own police step on the
    highway, the box measured as drawHudNotice lays it): 274 x 46 px, 285 px clear each side at
    844x390, 58 px at 390x844, over no HUD piece (LOST THEM: 165 px); photos looked at.
  - `?weathermobile=1` (FIX.weathermobile, game/loop.ts): the weather's notices only on the
    MOBILE difficulty (shared.aiDiff 0), the weather changing as before. MEASURED
    (tools/scratch/_weathernotice.mjs, laptop, Thruston, winter SEASON weather, 600 s, two seeds,
    MOBILE and REALISH): the weather's changes identical off and on (seed 1: rain at 264 s; seed
    2: snow at 219 s, rain at 566 s); notices OFF on both modes (RAIN STARTING; SNOW FALLING, RAIN
    STARTING), ON on MOBILE only, none on REALISH. Not photographed: the notice is the same line
    as before, its words unchanged.
  - PROOFS (every 11-15 switch here off - forestseed, wantedlost, weathermobile, menunan; the
    second PC against db2919a2, both before and after the menunan commit): simhash SAME (all 13
    runs); renderhash SAME on Thruston and the highway; worldhash --highway 20 SAME (laptop).
- THE MENU RACE'S NaN (TODO 4 WATCH 11-04, again 11-14 in menucheck at 390x844). FOUND AND FIXED
  behind `?menunan=1` (FIX.menunan, game/pacing.ts; testlist 'menunan').
  TRIPWIRE (tools/scratch/_menunan.mjs): the menu opened many times over five sizes, each frame
  the camera car's state and input in a ring, dumped when the game recovers a NaN. LAPTOP, 40
  races of 15 s: 4 froze (Dieatona Road, X Gayms, Anglesleazy National, Sillystone); the second PC,
  81 races: 8 froze (Castle Kum, Malarkey, Brands Indy, Croughed, Snotterton, Anglesleazy, the
  highway twice; every size, 844x390 too): each time the camera car's input steer NaN from the
  first frame, throttle 1, the car standing at its grid slot, recovered every step. CAUSE: the frame pacer returned a
  frame stamped before the last one as it is - NEGATIVE game time (the first frame can be: main.ts
  takes performance.now() after the frame began). The demo driver is driven with the frame's time
  (sim.ts demoInput; ?autopilot too): its clock went below 0, and ai/driverDrive.ts's 'wide'
  window test (state.t < (state.wideUntil || 0)) then read state.wide, never set: undefined, so
  its lateral target and steer were NaN (node: a first drive with -4 ms gives steer NaN; 0 ms and
  +16 ms do not). The NaN step left the car's tyre wear NaN, which no recovery clears, so it
  stayed frozen. FIX (a plain bug, the AI untouched): such a frame has 0 ms. Forced (_menunan
  AHEAD=30, the last frame time set 30 ms ahead): off, steer NaN for the next 6 frames, driver
  clock -0.41 s; on, steer finite, clock from 0. WITH THE SWITCH: laptop 0 of 40 races froze, the
  second PC 0 of 100 (off: 12 of 121, 10 %); menucheck with it OK at both sizes. simhash with
  ?menunan=1 SAME as without (the tools' stepped clock never stamps a frame early).
  NOT CHANGED (questions in the hand-over): the driver's wide-window test still reads an unset
  state.wide when its clock is negative (ai/ - not touched); a recovery does not clear a NaN tyre
  wear.

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
9. AI SLOW ON SLIPPERY SURFACES (measure first: an AI change).
   OWNER 11-15 GO (one switch, after bug 10): "they don't seem to deviate from racing line even if
   it's quicker ... slowly drive the racing line even if taking a bit of curb is quicker ... don't
   slide into corners even as a mistake"; "Ai should slide more on ice but try and go fast still".
   Build: hold a slide at each surface's own best slip angle (on ice slide MORE, still fast); more
   corner speed off tarmac; use kerbs / other lines when quicker (check the line first); mistakes
   by skill. (Option A as first written - catching slides earlier on ice - was the wrong way.)
   MEASURED 11-15, NOTHING CHANGED (tools/scratch/_aislip.mjs: node, one top-difficulty AI alone,
   its flying lap; Thruston and Knobhill with their tarmac given the grip numbers of each surface -
   mu, peakK, longK, plough - so the line and the plan read that grip too; hatch-rwd, rally-4x4,
   rx-super, f2-rwd; the FAIR REFERENCE is the same AI with its plan's corner and brake factors
   (ai/line.ts K_CORNER 0.88, K_BRAKE 0.70) scaled x1.15 / x1.3 / x1.5, and the same AI with its
   slip-feel throttle lifts taken out (NOFEEL), each in the tool only):
   - AGAINST THE GRIP: a lap on each surface over the tarmac lap, against sqrt(mu ratio) (a lap
     held by the grip alone): the 4x4 and the RX car match it within 4 % on every surface, both
     tracks (gravel x1.19-1.22 vs 1.23, snow x1.69-1.73 vs 1.71, ice x2.58-2.72 vs 2.80). The 2WD
     cars lose more on loose ground: hatch snow x1.87-1.90, sand x1.61-1.62 (vs 1.31: sand's plough
     drag too), grass / mud +3-7 %; F2 snow x1.85-1.93, grass x1.54-1.58, sand x1.43-1.52, ice
     x3.20 at Thruston; wet and gravel within 3 % for all but the F2 in the wet (x1.19-1.27,
     vs 1.14).
   - THE PLAN IS NOT THE CAUSE: scaled x1.15-1.5 the AI is 0-9 % quicker and stays on the road,
     but by as much on TARMAC (Thruston 6-8 %, Knobhill 0-4.5 %) as on slippery ground; the 4x4 and
     RX car gain 0-6 % on gravel, ice or grass, mostly nothing (already 1.2-11 s a lap off the road
     there). Apexes at 0.72-1.02 of the plan on every surface, tarmac 0.79-0.93.
   - WHERE THE 2WD TIME GOES: below its own target with the throttle part-open on the slip feel
     (wheelspin, rear slip) - F2 Knobhill snow 38.5 s of a 71.6 s lap, sand 27.5 s; hatch Thruston
     snow 18.6 s, ice 94 s of 201 s (part throttle 66-77 % of an icy lap; tarmac 14-42 %) - and full
     throttle short of the target (traction: the physics). TAKING THE LIFTS OUT IS SLOWER: F2 snow
     -8..-16 %, sand -58..-82 %, grass -7..-13 % with more off the road; hatch -0.1..-2 % (on ice at
     Thruston it did not finish the lap); 4x4 / RX within 2.3 %. The lifts are right: the loss is
     the car's traction, not the driver.
   - ON ICE the slides grow: rear-slide catches 10-67 s a lap, off the road 3-17 s a lap (4x4, RX,
     F2), the hatch at Knobhill 15.6 s in one run (a spin). The driver's slide limits are fixed
     angles (ai/driverSteps.ts slideStep: understeer lift past 0.14-0.20 rad front slip, catch past
     0.18 rad rear) while each surface's tyre peaks at its own slip (surfaces.ts peakK: ice 0.70,
     tarmac 1.00, snow 2.00, sand 2.20, gravel 2.40).
   - NOT MEASURED: the real weather (rain's wetness, snow and ice laid in patches), the native loose
     levels (Sweaty Lamb, Slidden Hill, the stages), TCS on, contact, a human reference (the
     scripted demo driver is 34 % slower on tarmac and does not finish an icy lap: no reference).
   OPTIONS (none built; A and B leave the AI on tarmac unchanged by construction):
   - A. Slide limits by the ground's peak slip: the lift / catch angles x the surface's peakK over
     tarmac's (tarmac x1). Expected: fewer slides and offs on ice; later lifts on gravel, snow and
     sand. Risk: the AWD cars are already at the edge on loose ground. S.
   - B. A plan bonus off tarmac for 2WD cars only (K x1.1-1.15 where mu < 0.8): measured +2-9 % a
     lap, 0 off for the hatch and the F2. Risk: more offs in traffic; the 4x4 / RX gain nothing. S.
   - C. Nothing: the AI tracks the grip; the 2WD cars are traction-limited, as yours are.
   RECOMMENDATION: ask where it was seen (car, level, weather). A 2WD car on snow or sand: C (it is
   the car) or B; the AI losing it on ice: A first, measured with _aislip, then in a field.
10. OWNER 11-15 GO: options A + B only ("C would be too much"); "Over take when clear not when
    oncoming is there - driver skill can say it makes mistakes or miss judges tho". Police contact
    measuring: no. Plus ?hwputback=1: two racers put back onto one spot (approved).
10. HIGHWAY AI NOT DODGING ONCOMING TRAFFIC: back on (owner 11-13). Before: "ai don't dodge
    properly", to measure what they miss (traffic, the player, wrecks); parked 11-10 ("let's leave
    it for now").
    MEASURED 11-15, NOTHING CHANGED (tools/scratch/_hwdodge.mjs: the real game, deterministic,
    nothing drawn, your car on ?autopilot, a highway race with 5 AI, 180 s, seeds 1 and 2; the
    twisty single carriageway at traffic 1.5 and 1.0, the motorway and Deaf Valley's dual
    carriageway at 1.5; every racer's body against every other car, a new touch = a hit; free drive
    has no racing AI - its speeders were not measured apart):
    - TWISTY (two-way): HEAD-ONS with oncoming traffic 3.3-9.7 per 10 racer-km (13, 7, 8, 18 hits
      in 17-23 km a run), 29 of 46 with the racer IN THE OTHER WAY'S LANE, 35 of 46 at over 15 m/s
      closing; near misses (2.5 m or less at over 15 m/s) 35-58 a run. The racers spend 22-33 % of
      their time in the other way's lane (the racing line uses the whole road). Standing cars and
      wrecks (many left by the head-ons) 6.1-12.3 hits per 10 km; police 7-22 (chases: who hit whom
      not split); same-way traffic 1.1-2.6; you 0.6-4.2.
    - MOTORWAY / DUAL: no oncoming (behind the median); same-way traffic 2.1-7.1 per 10 km, police
      3.4-9.1, you 1.4-3.0, standing 0-2.2, other racers 4.9-6.4.
    - WHAT IT SAW: 2.5-3 s before a head-on the oncoming car was OUTSIDE the window the driver reads
      cars in for 27 of 40 (100-180 m ahead and 8-70 m to the side: round a bend). That window
      (ai/driverTraffic.ts carsStep) is a box on the racer's own heading - |across| <= 8 m, ahead
      <= 8 m + closing x 2.6-3.8 s by skill - so on a twisty road a car round the next bend is not
      read until the bend opens out. 0.5-1 s before, most were braking (27 of 46) - too late at
      50-65 m/s closing.
    - WHAT IT DOES WITH ONE: an oncoming car is read as a slow car ahead (followAhead): it goes
      round it on the side nearest where it already is (so it can stay in the other way's lane)
      and brakes only when there is no time to swerve; nothing keeps it to its own side of a
      two-way road or stops it overtaking blind into a bend.
    - NOT TRACED: who started each police contact; the speeders in free drive; the other two-way
      roads (the twisty preset only).
    OPTIONS (none built; circuits must stay the same):
    - A. On the endless road read cars by their place along the road (the road frame's s / off, as
      the traffic does), not the heading box: an oncoming car round a bend read 2-3 s sooner. S-M.
    - B. On a two-way road, an oncoming car within ~4 s closing: the racer's target moves into its
      own lanes, and an overtake into the other lane needs that much clear road. M.
    - C. An oncoming car is passed on the racer's own side only (followAhead's side choice). S.
    RECOMMENDATION: A + C first (they reuse what is there), measured with _hwdodge against these
    numbers (head-ons, time in the other lane, the race's pace); B if head-ons stay above ~1 per 10
    km. Ask: may a racer still use the other lane to overtake on a clear straight?
    OWNER 11-15: A and B, not C ("Over take when clear not when oncoming is there - driver skill
    can say it makes mistakes or miss judges tho"). BUILT behind ?hwdodge=1 (FIX.hwdodge,
    ai/driverOncoming.ts; testlist 'hwdodge'): A - on the endless road the racers read cars by the
    road frames; B - on a two-way road the nearest oncoming car within 4 s of closing keeps the
    racer inside its own lanes (back over at a move's rate), and on its side it pulls out only with
    4 + 4 s clear; the judged time off by up to 35 % at skill 0 (the driver's own random stream),
    exact at skill 1. MEASURED (_hwdodge, the second PC, 180 s, seeds 1 and 2, off / on; the
    twisty single lane at traffic 1.5 and 1.0, the motorway, Deaf Valley's dual):
    - TWISTY HEAD-ONS 47 in 88.5 racer-km (5.3 per 10 km) -> 20 in 97.0 km (2.1): runs 10.4 -> 2.7,
      1.4 -> 3.6, 4.9 -> 2.3, 6.8 -> 0.6 per 10 km. NOT the target (well under 1). In the other
      way's lane 19-32 % of the time -> 8-16 %; kept to its side a quarter to two thirds of the
      time, over the middle line 5-10 % of that (up to 5.9 m: a slide wide in a bend or a car in the
      way, not traced). Near passes (2.5 m or less at over 15 m/s, lane-to-lane passing included)
      16-69 -> 52-132. PACE: racer-km in 180 s 88.5 -> 97.0 on the twisty runs (not crawling).
    - THE REST: Deaf Valley and the motorway have no oncoming cars in reach (behind the median),
      so only A applies: no head-ons either way; racer-on-racer hits on the dual 9.5 -> 12.6 and
      11.3 -> 22.4 per 10 km (seeds 1, 2), the motorway 1.2 -> 1.6 (seed 1, the run's last road
      timed out on the PC) and 11.2 -> 6.2. Police, same-way traffic and you: no clear change.
    - The remaining twisty head-ons: some with the racer well in its lane 1 s before and pushed
      or slid over in the last second, some at low closing speeds (a spun car) - not traced each.
    ?hwputback=1 (owner: "Two racers on highway fix approved"; FIX.hwputback, testlist
    'hwputback'): the off-road put-back through freeShoulderSpot. _stuckai hwtwisty (laptop, 180
    s): off - two racers put back in one step onto one spot (156.6 s, 1.6 m apart) and one onto a
    car (176.9 s); on - none from the off-road rule (the two injury put-backs near a car are not
    this rule).

HIGHWAYS:
11. MINIMAP: fuel stations, exits / road splits / slip roads, police.
12. CHEVRON SIGNS in the country highways' lay-bys; on Deaf Valley too, fewer.
13. BARRELS (impact attenuators) at the ends of central reservations, walled edges and slip-road
    barriers, as in real life; infinite highways only. A barrel hit sprays water 2-6 squares.
14. PARKED POLICE wake when passed with a wanted level on.
15. TRAFFIC (and unaggravated police) stop for fuel now and then and take slip roads (the petrol
    station stops exist, ai/trafficFuel.ts, 11-11: check how often); aggravated police as now.

RACE TRACKS:
16. PIT STOPS as in real life, cheap or free: each car its own box; stopped 30 %+ in the box opens
    a picture menu (damage, tyres: same again / wets / slicks, the car's own choices as quick
    buttons); the race goes on. Fuel: to agree. Questions first.
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
