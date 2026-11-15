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
  walkthrough line. OPEN from it (owner asked): the AI's wide-window read with a negative clock
  (ai/) and a recovery that does not clear a NaN tyre wear - plain guards, recommended yes.
- THE JOKER LINE ON ITS OWN ROW (owner 11-15: "new line always so it never covers"). BUILT behind
  `?jokerrow=1` (FIX.jokerrow; hud/laps.ts lapJokerRowShown, hud/layout.ts; testlist 'jokerrow').
  MEASURED (tools/scratch/_jokerrowshots.mjs, Knobhill RX race, 3 AI, Edge): the lap panel's second
  row has 104 px between its insets, P2/4 takes 25.9; JOKER TAKEN ✓ (83.4 px) ran 5.4 px into it
  and +30 s EXTRA JOKER (84.0) 5.9 px, the rest clear by 6-27 px. The panel is the same 120 px at
  every screen size, so the overlap was the same in landscape. ON: with AI cars the panel is one
  13 px row taller (36 -> 49) and every joker line sits alone on the third row (shrunk to the
  panel's width if ever needed); what hangs under the panel (track gauge, FPS strip, cone tally,
  the ABS / TCS chips' clearance) moves down with it. Solo (no position) the joker keeps row two.
- THE GROUND AT THE ZOOM'S DENSITY + THE PC LOADING DRAW-IN (owner's friend 11-15, Windows Chrome
  2109x1250 dpr 1, Stade de Prance: "it did the loading bar ... then i saw all the tiles slowly
  draw in"; the foreman: the zoomed-out ground cost behind the highway jerk). BUILT behind
  `?tiledensity=1` (FIX.tiledensity; render/tilesSteps.ts, tilesDensity.ts; testlist 'tiledensity').
  CAUSE, MEASURED: every tile is painted at zoom 1 and shrunk by the GPU, so zoomed out at 0.30 the
  view needs ~11x the tiles, each painted and uploaded at full density. The fly-in of a small level
  starts above the tiles' hand-over zoom (Stade de Prance at 2109x1250: 0.315), so it draws tiles
  from its first frame; the loading screen had painted only the hand-over view round the car (558
  tiles) and uploaded none, so the first frame after the bar uploaded 304 at once (draw 109 ms on
  the phone report), and the tile cache's 200 could not hold the ~430-tile view, so it painted 4
  a frame for 2.6 s (tools/scratch/_loadtiles.mjs: 4 tiles + 4 uploads a frame, frames 1-80 after
  the bar). The photo strip after the bar (tools/scratch/_loadtiles.mjs SHOTS) shows the outer ring
  and the left loop missing at 0 ms off, all there on.
  THE BUILD: tiles at the coarsest of zoom 1 / 0.5 / 0.354 still as dense as the screen (zoom
  0.5-1 unchanged: zoom 1); a new step readied over the whole view, one paint and two uploads a
  frame, before it is drawn; the cache sized to the real screen; behind the bar every tile of the
  fly-in's path planned at the real screen, painted and uploaded.
  LOADING, BEFORE -> AFTER (laptop, x1, _loadtiles: the bar's time from the tap; tiles / uploads
  after the bar; the most uploads in one frame; the fly-in's worst frame):
  - Stade de Prance 2109x1250: bar 1821 -> 1827 ms; after it 468 tiles / 473 uploads -> 220 / 0;
    most uploads in a frame 304 -> 0; worst fly-in frame 263 -> 98 ms (strip runs, slowed by the
    photos; without photos 240 -> 70-98 ms).
  - Spa 2109x1250: bar 3367 -> 3314 ms; uploads after the bar 505 -> 28, most in a frame 332 -> 2;
    worst 278 -> 204 ms.
  - The owner's phone size 440x738 dpr 3: Stade de Prance bar 965 -> 1041 ms, Spa 2277 -> 2676 ms
    (one run each; the 24-run batch below has the phone sizes 0.06-0.6 s QUICKER); uploads after
    the bar 83-84 -> 0-6.
  - 24 runs (Stade de Prance, Thruston, Spa, the Llanfairsheepdip stage x 844x390, 390x844 dpr 3,
    1920x1080 and 2560x1440 at dpr 1 and 2): the most uploads in one frame after the bar 2-610 ->
    0-4 (the PC sizes 218-610 -> 2-4); the fly-in's worst frame on the PC sizes 169-1588 ->
    28-260 ms; the bar's time -1.4 to +0.08 s on the PC sizes, -0.6 to -0.02 s on the phone sizes.
  THE HIGHWAY, OFF -> ON (laptop x1, _hwoffroad, two 40 s runs each): ON THE ROAD tiles painted a
  second 31-33 -> 10-11, uploads 25-27 -> 7-8, frames with 6+ uploads 107-121 -> 1-3; OFF THE
  ROAD tiles 22 -> 7, uploads 18 -> 7, 6+ upload frames 74-77 -> 6. (The laptop's frame gaps
  do not show uploads: the phone judges.)
  THE LOOK (zoomcheck Thruston, CPU raster, the same world square across the zooms: change between
  neighbouring zooms 0.5-0.9 % off; on, the same down to 0.46, then 2.6 % at the 0 -> 0.5 step
  (0.46 -> 0.44) and 3.7 % at the 0.5 -> 0.354 step (0.34 -> 0.32): the thin white edge lines and
  the fine cracks on the tarmac drawn at the coarser density, no brightness flash. Real-browser
  sweep 1 -> 0.3 -> 1 (tools/scratch/_zoomshots.mjs, 844x390 and 390x844, photos looked at): off
  vs on at the same zoom differ 0-0.4 % at zoom 0.5-1 (the noise of a live scene), 0.4-2.4 % at
  0.3-0.48 (the edge lines and cracks; nothing missing, nothing moved).
  PROOFS (second PC, against round54 70e91a0a): renderhash --only highway,thruston SAME with
  the switch off; SAME with it on too (its captures never zoom out below 0.5: the coarse steps
  are proved by zoomcheck and the photos above, not by renderhash). simhash / worldhash not run
  (no simulation or level code touched).
- THE HIGHWAY OFF-ROAD JERK (owner 11-15: "seems jerky when off road on highways now ? 60 down to
  58 regularly"). `?tileahead=1` FAILED ON THE PHONE 11-15 (owner: "It seems worse on": 116
  frames a minute over 20 ms with it, 31 s, night, rain, against 53-92 earlier that day without;
  uploads 46 a second against ~31) and was REMOVED; the work goes on as `?tiledensity=1` (below).
  READ FROM THE PHONE (tools/phonereport.mjs and scratch readers, highway runs zoomed out, frames
  over 20 ms a minute after each run's first 600 frames, pauses left out): 11-12 17-30; 11-13
  40-48; 11-14 / 11-15 83-102 (11-15 11:54, hwdodge: 55). sim and draw ~4 + 3 ms, slow or not.
  Tiles and uploads a second the SAME on both sides (~30): not more ground built. What a slow
  frame FOLLOWS (the frame before it): 6+ texture uploads (a row of tiles scrolling into view at
  once - uploads come as 0 or 6+) 4.6-12 % slow on 11-14/15 (11-12/13: 0.7-2.1 %); a frame that
  painted 4 tiles (the view outran the look-ahead) 23-28 % (11-12/13: 2.8-18 %); a quiet frame
  (no tile, our JS <= 6 ms) 1.2-2.1 % (0.4-0.7 %). So EVERY kind of frame got about twice as
  likely to miss, the bursts most. Other levels vary by run more than by day (frames over
  20 ms, Spa: 11-12 0.40 %, 11-13 1.9-2.6 %, 11-14 noon 0.49 %, 11-14 evening 1.7-2.2 %). One
  11-13 highway run went 0.3 % -> 2.5-3.3 % in its 6th minute, sim 3 -> 5 ms and draw 2 -> 4 ms
  together (at the game's dawn): the same code, mid-run.
  WHAT CHANGED 11-13 -> 11-14: NOT FOUND. The ground code did not change in between (tiles.ts:
  trackCanvas and the loading screen's prepareAround only); perfpass, the loading screen,
  onestart, smoothfly and lap data went in. LAPTOP A/B, the 11-13 build (ec84b67d) against now,
  the same drive (tools/scratch/_hwoffroad.mjs, 440x738 dpr 3, seed 1, 40 s, two runs each):
  frames over twice the median work, x2 on the road 7.5 (crashed early) / 4.6 % vs 6.4 / 3.4 %,
  off the road 5.2 / 6.3 % vs 8.3 / 15.1 %; x4 mixed both ways; tiles and uploads a second
  alike. No difference above the run-to-run noise; the phone's own GPU and memory cannot be
  measured here.
  THE FIX (the bursts): the look-ahead box is centred 0.8 s of the car's motion ahead, its tiles
  kept on the GPU, and ONE tile a frame - the one nearest the ground about to scroll in - is
  painted and uploaded (or a painted one uploaded); nothing on a frame that painted in view.
  MEASURED (laptop, CPU x1, three 40 s runs each, off -> on): ON THE ROAD (~37 m/s, zoomed
  out) frames with 6+ uploads 186 / 148 / 163 -> 0 / 0 / 1, the most in a frame 17 -> 4-7,
  frames painting 2+ tiles 27-56 -> 3-7, uploads a second 32-38 -> 42-46 (every tile painted
  is uploaded now); OFF THE ROAD (~17 m/s) 6+ uploads 73-75 -> 1-2, the most 17-19 -> 10-12, 2+
  tiles 23-27 -> 14-15. The laptop's own frame gaps did not change (over 20 ms: on the road
  15-23 -> 17-26 a minute, off 9-12 -> 8-12: its GPU takes the uploads in its stride); the
  phone is the judge (&report=1). Alternate frames for the paint and the upload was tried:
  half the rate, the view outran it at 38 m/s (2+ tile frames 30 -> 96-142). PROOFS (second
  PC): renderhash --only highway,thruston against 22511d59 SAME with the switch off and SAME
  with it on (the same pixels in its stepped captures); simhash / worldhash not run (no
  simulation or level code touched).

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
   BUILT 11-15 behind ?aislide=1 (FIX.aislide, ai/driverSlide.ts; testlist 'aislide'; ENGINE.md
   THE AI'S SLIDES BY THE GROUND), the owner's GO in four steps, each measured with _aislip:
   1. HOLD A SLIDE: the tyre law now writes each axle's peak slip angle (car.t.aPeakR: tarmac
      ~0.12 rad, gravel ~0.19, sand ~0.16, wet / snow / ice the 0.10 floor); on ground under mu
      0.7 (not tarmac, wet or dry) a rear slide in a corner going the corner's way is held on the
      throttle at 1.25 x that (0.15-0.30 rad) - the loose hairpins' drift law, now any corner and
      every rear- or four-wheel-driven driver - with 2 m x sqrt(0.6 / mu) to the edge (ice ~4.5
      m); the catch, the understeer lift and the slip feel read the ground's peak too. TRIED: wet
      tarmac in it (mu 0.85 threshold) - off the road 7 -> 24 s over the runs, out; the 2 m edge
      on ice - off 48 -> 86 s, so the room grows as the grip falls.
   2. COMMIT OFF TARMAC: a 2WD car plans 1.12 x the corner grip on mu 0.25-0.7 (gravel, grass,
      sand, mud, snow). MEASURED alone: every car +1-3 % a lap; the 2WD cars no more offs, the
      AWD cars 1-3 s more off a lap on gravel and snow, every car more off on ice (65 vs 48 s) -
      so 2WD only, not ice.
   3. KERBS: the line did NOT use them - it kept its middle 1.6 m inside the road's edge and the
      kerbs lie outside the edge (render/kerbs.ts, halfW to halfW + 2.4 m). Now beside a kerb it
      may come to 0.6 m of the edge (~0.3 m of wheel on the kerb), and the driver's lateral clamp
      lets it. Tarmac circuits change: alone +0.6 % a lap, no offs.
   4. MISTAKES BY SKILL: there already were (ai/driverLane.ts: per corner, by the driver's own
      random stream, severity larger the lower the skill: late / early / throttle / lift).
      MEASURED before: of 90 at Realish and 200 at Mobile none spun or left the road on tarmac or
      gravel. Now while a 'late' or 'throttle' one runs the catch is x (1 + 1.5 x severity),
      nothing held, no understeer lift on a 'late' one, and both twice as big.
   MEASURED, all four on (the laptop - the second PC ran 5x slower beside the other worker's
   renderhash; _aislip, Thruston + Knobhill laid in each surface, one flying lap, top difficulty,
   traits seeds 1 and 2, per car class over 8 runs: lap off -> on, sliding s / lap, off s / lap):
   - gravel 2WD 58.4 -> 57.0 s (+2.6 %), sliding 2.8 -> 3.3, off 0.7 -> 0.9; AWD 57.3 -> 57.0
     (+0.6 %), 4.7 -> 6.8, 1.4 -> 1.6. sand 2WD +0.1 %, 4.0 -> 5.5, off 0; AWD +0.3 %, 5.8 ->
     7.8, 1.9 -> 2.4. grass 2WD 71.4 -> 70.6 (+1.1 %), off 1.5 -> 3.5 (5 -> 11 offs); AWD
     +0.6 %, off 4.8 -> 4.2. snow 2WD +1.0 %, 10.3 -> 12.7, off 0; AWD +0.9 %, 12.4 -> 13.8,
     1.5 -> 1.4. ice 2WD 140.8 -> 139.5 (+2.0 %, laps over 7: one unfinished before, none
     after), spins 8 -> 3, off 5.7 -> 7.2; AWD +0.3 %, off 7.6 -> 5.4. tarmac -0.1 % both
     (the kerbs; no offs), wet -0.2 / -0.6 %. No spins anywhere but ice.
   - BY SKILL (Realish, 5 drivers each, 3 laps, hatch + 4x4, both seeds, 120 runs a side):
     mistakes slid (rear past its peak 0.3 s+) tarmac 9 of 42 -> 17 of 43, gravel 10 of 42 ->
     22 of 41; still NO mistake spun or left the road on tarmac or gravel (one on ice, either
     side); gravel offs 2 -> 32 (1 -> 36 s over 40 runs: brushes past the edge), laps 1.5-1.7 %
     quicker; ice the same mess either way (spins 23 -> 27, unfinished 3 -> 5). The weakest
     drivers drew the fewest mistakes in these runs (their dice), so by-skill counts are thin.
   - THE HOLD ANGLE (owner: "see if greater angle speeds up lap times"; HOLD_K 1.25 built, 1.6
     and 2.0 tried with HOLD_MAX raised 0.30 -> 0.45 - at 1.6 gravel's hold sat on 0.30): laps
     within 0.3 s of 1.25 on every surface and class (gravel 2WD 57.0 / 57.1 / 57.1, AWD 57.0 /
     56.9 / 56.9; snow 2WD 84.1 / 84.0 / 84.2; ice 2WD 139.5 / 139.7 / 142.5, spins 3 / 3 / 6),
     sliding much the same (the hold only acts once the rear is past half the hold, and the
     cars rarely get the rear out that far on the throttle). A bigger angle does not speed them
     up. OWNER TO DECIDE the angle (1.25 kept).
   NOT MEASURED: a full field (contact), the real weather's patches, the native loose levels'
   own laps (Sweaty Lamb photographed only), mud.
10. HIGHWAY AI AND ONCOMING TRAFFIC, and two racers put back onto one spot: PASSED 11-15, the
    default (TODO-DONE).

HIGHWAYS:
11. MINIMAP: fuel stations, exits / road splits / slip roads, police.
12. CHEVRON SIGNS in the country highways' lay-bys; on Deaf Valley too, fewer.
13. BARRELS (impact attenuators) at the ends of central reservations, walled edges and slip-road
    barriers, as in real life; infinite highways only. A barrel hit sprays water 2-6 squares.
14. PARKED POLICE wake when passed with a wanted level on.
15. TRAFFIC (and unaggravated police) stop for fuel now and then and take slip roads (the petrol
    station stops exist, ai/trafficFuel.ts, 11-11: check how often); aggravated police as now.

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
