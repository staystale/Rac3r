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
- NIGHT CANOPY CUT ON THE ENDLESS ROAD (owner 11-14 "I don't see why we wouldn't do it"): BUILT behind
  `?nighthw=1` (render/canopystream.ts; the night worker): the still lights worked out per stretch
  as the props stream. Laptop, night 0.94, 90 s: countryside fly-in 3 of 23 canopies darkened
  (all 23 before), in race at most 5 of 5; a stretch walk at most 1.5 ms (11 walks); Deaf Valley no
  trees. renderhash highway at night off vs on SAME; fly-in photos byte-identical. NOT PROVEN by a
  caught break on the road (no tree in a light in any capture made): the owner's phone test is it.
  (TODO-DONE).
- BOOT BAR (owner 11-14: "There's no loading bar when the game first loads"). BUILT, behind
  `?bootbar=1` (worker, to review; ENGINE.md "One frame"):
  - 11-15 owner: "should show the racer logo or at least the 3 as big and blue like the logo". Now
    the logo (assets/logo.jpg, its box kept from the first paint); until it has come, RAC3R in words
    with the 3 big and in the logo's blue (_bootbar-1b-words photos). Also loads the menu's logo
    earlier.
  - From the page's first paint (index.html, before the code runs; the page reads the switch
    itself) the loading screen's pane: LOADING, RAC3R, the bar, over the boot screen. The words show
    once their faces load (font-display: block; the pane and bar at once).
  - The bar eases on the compositor through the code's download and main.ts's build (paced by the
    time they took on this device the last time, 3 s the first time), then through the menu's first
    frame and its fonts; then full, the blue flash (two blinks, 160 ms), the fade into the menu.
    The menu race behind it is untouched; with ?menu=0 (the tools) it ends at once.
  - NOT WAITED FOR: the logo and the first track thumbnails (the menu never waited for them; holding
    for them made the menu later: below). One line to add them back if wanted.
  - MEASURED (laptop, tools/scratch/_bootbar.mjs: a cold page, empty cache, 390x844, the bundle as
    the phone gets it, the menu race seeded to the same level both ways - the Nordschleife, the
    heaviest; medians of 5, ms from the page opening; off / on):
    CPU x1 - first paint 76 / 80, bundle in 59 / 88, menu built 2101 / 2177, its first frame
    2287 / 2362; on: the flash 2584, the fade starts 2778, the bar gone 3043. The MENU SEEN (off its
    first frame, on the fade's start) 2287 / 2778: +0.49 s, of it 0.42 s the bar's end after the
    menu's own first frame (fill 120 ms + flash 160 ms + the timers waiting behind the menu race's
    frames) and +75 ms the menu's own build (inside the runs' spread: off 2041-2708, on 2079-2447).
    CPU x4 - first paint 128 / 140, bundle 147 / 216, menu built 13289 / 12532, first frame
    14213 / 13468; on: flash 13904, fade 14153, gone 14516. Menu seen 14213 / 14153 (the bar's end
    0.69 s after its own first frame; run spread +-0.6 s).
    A 4G-LIKE LINE (100 ms, 500 KB/s, x1, 3 runs): bundle in 1694 / 1806 (+112: the bar's three
    font files, 38 KB, share the line; the test server sends everything no-store, so the menu
    fetches its own two again later - on itch.io they would be cached), first frame 4740 / 4945,
    menu seen 4740 / 5484 (+0.74 s).
    WITH THE LOGO AND THE FIRST THUMBNAILS WAITED FOR (tried, not kept): the bar's end 0.55 s after
    the menu's first frame at x1, 1.35 s on the 4G-like line (the 24 thumbnails, ~580 KB).
    THE FIRST PAINT: in a fresh browser's first load the plain page painted nothing until the menu
    (first paint 2.0-3.5 s in 5 of 5 such runs, the boot screen never seen); with the bar on 44-108
    ms in every run.
  - SO: nothing in the load itself is slower on the laptop (the code, the build and the first frame
    alike within the runs' spread); the menu shows 0.4-0.7 s after its first frame, the fill and
    the two blinks asked for plus the menu race's frames delaying their timers; on a slow line also
    the bar's 38 KB of fonts (+0.1 s).
  - PROOFS (laptop, against references saved on 7d2b5777): verify clean; simhash SAME off and with
    bootbar=1; worldhash SAME off and with BOOTBAR=1; _loadmenu all OK off and on; menucheck OK off,
    and on once WRONG - the menu demo car's NaN state at 390x844 (the WATCH below, 11-04: it came
    back), OK on the rerun; settingscheck FAILS 42 of 42 links on noLoadScreen ('got false, want
    undefined') - the same on 7d2b5777 itself (the ?loadscreen=0 setting it does not know yet).
  - PHOTOS (tools/scratch/_bootbarshots.mjs, 844x390 and 390x844): _bootbar-1-nofonts (the pane and
    bar, the words waiting for their faces), -2-partfull, -3-flash, -4-menu.

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
1b. BUG 1 CONTINUED, THE FRONT TYRE SMOKE (owner 11-14: "I think it's part of the same bug but
   check obviously"; "there's still smoke coming from the
   front tyres a lot do the time when their shouldn't be", "the smoke should be the same for all
   tyres within reason as different tyres have different heat specs"). BUILT 11-14 behind
   ?tyresmoke=1 (FIX.tyresmoke, env TYRESMOKE=1; testlist 'tyresmoke'; render/tyresmoke.ts).
   MEASURED (tools/scratch/_tyresmoke.mjs, headless, every car, aids off and on, tarmac, 18 C;
   per tyre: % of the time smoking, mean strength 0..1 while smoking, puffs a second):
   - the old rule (heat from 60 C, any slip over 2 m/s, gripping or not) smokes a front tyre
     wherever it is warm and slips: a held 1.1 g corner at 144 km/h, fronts smoking 0-76 % of the
     time (WRZ 76 %, 67 % while gripping; estate 73, kit car 57, hatch-rwd 51, lambo 47); any
     slide of an 85 C (in-window) front 80-100 % (understeer at full lock), faint (0.07-0.11);
     in AI racing laps fronts 0-21 % of the time (Thruston 0-17, Spa 1-21), faint (<= 0.04),
     ~1-2 points of it gripping, the rest gentle slides just past 2 m/s.
   - THE RULE built, the same for all four tyres: smoke only past grip (the axle spins, locks or
     slides, physics/tyreheat.ts scrubs); the heat share from a quarter of the window's width
     below the top of the tyre's own window (spec.tyreOpt; stock 65-110 C: 98.75 C) to 55 C over
     it, on the passed curve (faint and progressive when cooler, the 0.08 faintest puff, linger
     and smoke over the car unchanged); a locked or spinning tyre's surface counts up to 30 C
     hotter by its slip share (the same rubber rubs round through the patch: without it a 4 s
     lock-up from 85 C did not smoke at all, the burnouts at 5-70 % of their puffs).
   - OLD -> NEW, means over every car (front pair | rear pair, % of time, puffs/s):
     racing Thruston F 5 % 0.03 -> 1 % 0.02 | R 6 % 0.14 -> 5 % 0.10; Spa F 8 % 0.06 -> 1 % 0.01 |
     R 10 % 0.19 -> 5 % 0.08; fast 1.1 g corner F 20 % 1.2 -> 5 % 0.5 (gripping fronts none);
     steady 0.7 g corner none either way; understeer at 85 C F 97 % 3.4 -> 37 % 2.0 (smoke left
     only where the driven fronts spin or run over the window); ten hard stops F 22 % 0.73 ->
     14 % 0.78 | R 32 % 3.6 -> 29 % 4.4; lock-up F 87 % 3.05 -> 79 % 2.69 | R 85 % 2.66 -> 68 %
     2.15; burnout (8 s from cold) F 13 % 1.24 -> 12 % 1.88 | R 27 % 2.84 -> 24 % 4.10; donut
     F 38 % 4.9 -> 33 % 6.2 | R 50 % 11.7 -> 45 % 12.9; hot slide (130 C) F 88 % 10.4 -> 88 %
     10.4 | R 85 % 12.1 -> 83 % 16.8. Aids on: the same pattern (ABS cars barely lock: lock-up
     F 55 % 1.85 -> 48 % 1.63).
   - Other windows follow the tyre: Wet (40-85) on a dry road smokes more (lock-up 4x), Drift
     (80-150) much less (hot slide fronts 10.0 -> 1.0 puffs/s), Semi-Slick (75-120) a little less.
   - Burnouts start ~0.5 s later and run thicker (each car 5-9 points less of the time, 20-60 %
     more puffs: the muscle car 50 % 2.0 -> 41 % 2.4, the F2 72 % 11.7 -> 67 % 16.3). A full
     throttle launch's light wheelspin barely smokes now (old 0-47 % of the time at <= 0.03,
     new 0-6 %). The 4x4s, the saloon and the RX car do not spin up held by the brake: no burnout
     smoke under either rule.
   - PROOFS (laptop, against a7233a37): simhash SAME switch off and with tyresmoke=1 (all 13
     runs, 441c130c...); worldhash SAME off and TYRESMOKE=1; renderhash --only thruston,knobhill
     SAME off and SAME on (its 20 s drives leave the tyres at 43-57 C: no smoke under either
     rule, so the pixel check cannot see the switch; the photos do).
3. THE HUD COVERS THE PLAYER'S CAR on the highways: the car must never be under a control or HUD.
   BUILT 11-15 behind ?hudclear=1 (testlist 'hudclear'). MEASURED (tools/scratch/_hudcover.mjs on
   the PC: the game's autopilot, touch controls, 10 phone sizes - 844x390, 667x375, 932x430,
   915x412, 740x360 and each upright - x 9 runs: Thruston, Knobhill RX, a rally stage, the Lab, the
   highway as motorway, twisty, Deaf Valley, interstate and walled; the car's footprint read
   against the HUD's own pixels every 12 frames). OFF, the car under the HUD on every upright
   phone on every highway (390x844: 12-21 % of the samples, up to 85 % of the car hidden; 375x667
   up to 45 %; 360x740 up to 50 %), mostly under the ABS / TCS chips and the pedals, as the road's
   bends slide the car sideways 3/4 down the screen; elsewhere: the Lab under the chips
   (844x390, 667x375, 740x360), Knobhill RX under the chips (667x375, 740x360), a stage under
   RESTART (915x412), a circuit under the ABS chip (375x667). ON: never under a control, panel,
   pedal or the minimap in any of the 90 runs; left only a moment under the passing overlays
   (the speed camera's flash, the finish flag), not avoided by design. The view: the push moves
   with its speed changing at most 3 px / frame / frame (render/hudclear.ts followPush), so the
   largest change of the car's per-frame move on screen is 3.0-8.2 px, as off (the hand-over
   from the fly-in; resets aside, the same frames off and on); the aid chips taken away and
   given back mid-push (APPEAR, 667x375 Lab, 390x844 twisty): no jump over 4 px, never covered.
   The push reads the car where the follow put it, so it cannot fight the look-ahead.
4. RESETS: never put you ahead of where you were (inline or behind only); a car in the way: the
   next free spot BEHIND; a reset does not clear the police (they go only when too damaged, or
   having caught someone).
   BUILT 11-15 behind ?resetback=1 (FIX.resetback, game/resetspot.ts; testlist 'resetback'). Every
   reset of yours: R / the RESET button (and the bust's, a car change's), the endless road's
   wrong-way / off-road / exit guard, a big cut's put-back (a circuit race), the Lab's breadcrumbs.
   - NEVER AHEAD: a circuit, stage or joker-lane reset goes RESET_BACK (4 m) behind the EARLIER of
     where the car left the road and where it is now (it went off and came back down the run-off);
     the endless road's guard from the car's own road distance, not the furthest point reached.
   - A CAR IN THE WAY (a racing AI; on the endless road a police car): the next free spot 6 m
     further back (up to 40 tries; the guard's rolling put-back keeps 1.5 s of its speed clear in
     front); a stage never into its gap between the stop zone and the run-up.
   - THE POLICE STAY: the reset clears only the other traffic within 30 m (as before); the police
     go only when wrecked or after a bust (ai/trafficPolice.ts, unchanged).
   MEASURED (tools/scratch/_resetback.mjs, the second PC, the real game; OLD = the switch off):
   - Back down the run-off 30 m, 9 m out, RESET (3 spots each): OLD +24..+25.5 m AHEAD of the car
     on Thruston (free drive and race), Knobhill RX, a generated stage, Sweaty Lamb; NEW -4.5..-6 m.
   - The reset's spot taken by an AI car: OLD lands on it (all 12 spots, and the cut put-back);
     NEW 6 m behind it, on no car. The joker lane: OLD +21 m ahead / on the car; NEW -4 / -12 m.
   - The endless roads (motorway, twisty, Deaf Valley): the wrong-way guard OLD +32..+35 m ahead
     (motorway), +10 m (twisty), NEW 6-8 m behind on the motorway (a lay-by road: the last
     lay-by behind the car, 88-241 m); the off-road guard on the motorway OLD +13..+15 m,
     NEW -4..-8 m (the lay-by roads: a lay-by behind either way); R as before (-3..-5 m); R
     and the wrong-way guard onto an AI: OLD on it (all six), NEW clear
     (R 10 m back; the guard 33-45 m back on the motorway, the lay-by before on Deaf Valley, 193 m);
     a chasing police car 6-21 m away at an R: OLD cleared (all three roads), NEW still there.
   - 1 m past a stage's start line: OLD and NEW behind (-4.5 / -6 m: the run-up behind the line);
     the Lab: 29.7 m back along its way, both (no road, no other car there).
5. WRONG WAY ON HIGHWAYS too quick (highway.ts BACK_T 1.2 s, BACK_M 30 m): time to turn round,
   to spin or crash, to roll back a little.
   BUILT 11-15 behind ?wrongway=1 (FIX.wrongway; testlist 'wrongway'): BACK_T 1.2 -> 4 s moving
   back down the road faster than 3 m/s, BACK_M 30 -> 50 m behind the furthest point (BACK_V 3 m/s,
   the off-road guard and the put-back unchanged). The endless roads only (circuits, stages, RX and
   the Lab have no wrong-way guard).
   MEASURED, headless, every car (tools/scratch/_wrongway.mjs; flat tarmac, the phone's pedal
   ramps; worst car, its back-run = the guard's clock / metres back from the furthest point):
   - TURN ROUND from rest facing back (full lock, throttle): 1.45 s / 8.3 m (RX Supercar; the
     median car 0 s / 3.3 m); a three-point turn 0 s / 0.8 m.
   - SPINS at 20, 30, 40 m/s (full lock and the handbrake 0.8 s, then the brake): 0 s / 0.1 m (the
     cars stop facing 59-111 deg; past 90 deg the U-turn after it adds the turn's numbers).
   - CRASHES, head-on at 25 + 25 m/s, both braking 1 s after the hit: into the same car up to
     1.32 s / 6.9 m; into the heaviest traffic car (the muscle car, 1730 kg) up to 3.06 s / 35 m
     (the Grass Special and the Mini; median 1.57 s / 11 m). Today's guard fires on 15 of 19.
   - REVERSING: today's guard fires on every car after 1.7-2.5 s, 6.9-7.6 m of reversing.
   PROPOSED AND BUILT: 4 s (the worst crash knock-back 3.1 s + 30 %) and 50 m (the worst
   knock-back 35 m + 15 m). Deliberate wrong-way driving is still reset, now after 3.7-5.2 s and
   31-50 m.
   THE REAL GAME (tools/scratch/_wrongwaygame.mjs, the second PC, the player's input scripted;
   motorway, twisty, Deaf Valley, walled x hatch, RX Supercar, tractor, F2, alone; a race with 2
   AI and traffic on the motorway): OLD - reversing 15 m reset on all 16 (1.7-2.6 s, 7 m), knocked
   back at 8 m/s reset on all 16 (1.2 s), the RX Supercar's turn round reset on all 4 roads; NEW -
   none of those reset (up to 19 m reversed, 12 m back in a turn round, 12 m knocked back);
   reversing on (80 m) resets at 4.5-5.4 s, 22-34 m back, driving the wrong way at 3.7-5.2 s,
   31-50 m back, as the old one did at 1.7-2.6 s and 7-10 m.
6. A HIGHWAY RACE WON BY PULLING AWAY while OFF THE ROAD: not allowed (owner 11-13). Off the road
   still counts in a race to a line or against the clock.
   BUILT 11-15 behind ?offroadwin=1 (FIX.offroadwin; testlist 'offroadwin'). HOW IT IS WON NOW
   (ai/hwFlow.ts dueKind): every rival over 5 m behind you on the road (road distance, the
   car's projection on the road, wherever it is) and off screen -> PULLING AWAY 8 s -> you win.
   Nothing asks where your car is, so it is won off the road three ways: on the verge (0-8 m
   out, no off-road countdown at all), in the band 8-16 m out (the countdown shows but never
   runs: highway.ts OFF_NEAR), and further out, where the 8 s beats the guard's 10 s; and the
   PULLING AWAY notice covered the guard's BACK TO THE ROAD one.
   BUILT: the getaway's count runs only while your car's middle is inside the road's edge
   (highway.ts playerOutM, the guard's own measure: a lay-by, a forecourt and the side road are
   road; the verge, a slip road and the fields are not), and starts again from 8 s each time you
   come back to it. A race to a line or against the clock unchanged (off the road counts).
   MEASURED (tools/scratch/_offroadwin.mjs, the second PC, a race with 2 AI, your car 400 m
   ahead carried at 45 m/s; motorway, twisty, Deaf Valley): OLD - won by the getaway at 8.0 s
   from the verge (4 m out), the band (12 m) and the fields (30 m) on all three roads, and
   still off the road at 8 s in the "back" case; NEW - no win in 20 s on the verge or in the
   band; in the fields the guard puts you back at 10 s and the getaway wins 8 s later ON the
   road (motorway, Deaf Valley; twisty: a lay-by far back, no win in 20 s); 12 m out for 10 s
   then on the road: won at 18.0 s, on the road. Unchanged both ways: on the road won at 8.0 s;
   over a line 300 m on, 12 m out: finished at 6.7-6.8 s; the clock out at 6.0 s, 12 m out.
7. ROLLING STARTS: the AI holds a SPEED, not a throttle (faster cars bump slower ones).
   BUILT 11-15 behind ?rollhold=1 (FIX.rollhold; testlist 'rollhold'; the rolling start's hold
   only, game/order.ts + ai/formation.ts). CAUSE: the formation's throttle was capped at 0.55,
   and the pole car rose to the pace as fast as its car did there; the others hold their slots
   behind it (headless, 0-16 m/s at 0.55: RX Supercar 1.8 s, Lamborghini 2.9, Mini 7.7, tractor
   17.3), so a weak car fell out of its slot and the stronger one behind ran into it. BUILT: the
   pace rises at 2.5 m/s2 from the start's clock to 16 m/s (6.4 s; every car but the tractor can:
   at its best throttle the Mini 4.9 s, the muscle car 4.7), for every car, and each car's
   throttle is what holds its speed (up to 1). After the green: nothing changed.
   MEASURED (tools/scratch/_rollhold.mjs, the second PC, the real game, 5 AI of your class, your
   car saloon (a mixed road-car field), Naffcar (one model) or the banger (bangers + Grass
   Specials), 3 runs each, every frame to 5 s after the green; OLD / NEW):
   - bumps before the green: Naffcar Speedway + Stock Car 3 of 18 runs / 0; Dieatona 2 of 9 / 0;
     the highway 0 of 9 / 0 (each a weak car hit from behind: Mini by Lamborghini 11.5 / 16.0
     m/s, banger by Grass Special 11.8 / 17.2, saloon by hatch 15.3 / 17.4). An earlier run of the
     tool (each launch read before its new start was armed) counted 9 + 9.
   - widest speed spread across the field once moving: ovals 7.8 / 2.2 m/s, Dieatona 6.8 / 1.0,
     highway 4.5 / 2.2; closest bodies (no bump): ovals 0.92 / 4.1 m, Dieatona 3.98 / 4.31 m,
     highway (side by side) 1.71 / 1.74 m.
   - the green: ovals 9.1-9.9 s -> 11.0-11.3 s, Dieatona 10.1-11.0 -> 12.0-12.1 s (the slower
     rise); the highway's at 6.0 s as before, the pace there then 15 m/s (was up to 16).
   - bumps in the 5 s after the green (racing, not changed): 18 / 14 over the same 36 runs.
8. STUCK AI AND TRAFFIC: reset or vanish after 5-10 s stuck.
   BUILT 11-15 behind ?stuckreset=1 (FIX.stuckreset, game/aistuck.ts; testlist 'stuckreset').
   HOW IT WAS (game/ai.ts stepAIStuck): an AI put back after 3 s under 1 m/s, or when its drive-outs
   gave up (3 reverses inside 15 s), 4 m behind where it last was on the road; highway traffic: a
   still car out of view recycled after 6 s, one in view (a wreck) stays.
   MEASURED (tools/scratch/_stuckai.mjs: the real game, deterministic, nothing drawn, your car on
   ?autopilot, 180 s a run; Thruston, Brands, Knobhill, Spa, Naffcar (rolling start) with 19 AI,
   Grass Track 12; RX Knobhill 19, Holy Jeez and X Gayms 12; the forest and Sahara stages; the
   highway race (motorway, twisty: 5 AI, traffic 1.5); free drive (motorway, twisty, Thruston); the
   Lab. STUCK = an AI after its green gaining under 3 m of race progress for 5 s or more;
   tools/scratch/_stucksum.mjs checks the logs):
   - OLD: most stuck spells are lap-1 pile-ups the cars crawl out of in 5-10 s (Brands 14 of 16,
     Knobhill 11 of 11). MISSED: cars rocking on their drive-outs (over 1 m/s while reversing, so
     the 3 s clock starts again: 10-15 s; Knobhill RX: one car put back 5 times into the same jam at
     one bank); two cars bogged in the Sahara's sand at ~2 m/s, 20-31 s at a time (8 spells over 12
     s). FALSE: a stage's later starters put back at ~10 s while still WAITING AT THEIR START (the
     drive-out's hold is your start, not theirs: 3 tries -> give up -> reset 4-6 m back) - both
     stages, every run. PUT-BACKS AHEAD: 7 in the Sahara, +1 058 m (a car crossing the sand to a
     later stretch of the stage had its last on-road point there), 1 on twisty; ONTO another car:
     1-3 a circuit or RX run, 3 in the Sahara. TRAFFIC: a wreck in view stays (25.6 s on
     twisty to the run's end; 54-95 s round your stopped car in an earlier run).
   - BUILT: STAYED - within 5 m of one spot for 6 s - or NO PROGRESS - under 4 m/s with no 3 m of
     race progress in 10 s - put back; never while the start holds it (a stage's own start too) or a
     crash plays out; not while QUEUED (a car close in front facing its way, under 2 m/s, not itself
     stood put over 1 s: then it is a pile-up and the pile is put back) or PULLING AWAY (forwards
     and gaining, never backed up). The 3 s and give-up resets are off; the drive-outs, the
     highway's off-road rule, the roll and injury resets unchanged. The put-back is your reset's:
     never ahead of where the car is, the next free spot 6 m back past a car (the highway: its
     hard-shoulder spot 15 m back, then 6 m further back at a time past you, the racers and the
     traffic). Traffic: a car standing still 6 s, not broken down, at a pump, a
     police car or queued behind a still car within 8 m, goes - in view too - and rejoins off screen
     as a recycled car.
   - NEW (the same 17 runs): no stuck spell over 10.3 s anywhere (old: up to 31.1 s; 13 over 12 s);
     no put-back ahead (old 8), none onto a car (old 1-3 a run), none at a stage's
     start (old: every run); the Sahara and forest stages no put-backs at all (old 28 and 10);
     traffic standing stuck in view at most 6.5 s (old 25.6 s). MORE PUT-BACKS IN LAP-1 PILE-UPS: in
     the first 45 s Brands 12 (old 1), Spa 5 (2), Knobhill RX 5 (3) - cars that used to crawl out of
     a pile in 5-10 s are put back at 6 s (see the question in the hand-over). QUEUES: your car
     stopped on the motorway with the traffic queued behind (180 s): the queued cars in view stay
     (24-90 s, as off), the wreck among them goes at 6 s (off: 54.7 s to the run's end). One
     put-back with a slow car 10-12 m in front at 40 deg (Knobhill): not in its path, so not a
     queue. Left as before (not stuck handling): two racers flung 40 m off the highway in the same
     step are put back onto one spot, and an injured racer's put-back can land on a traffic car (off
     and on alike, 1-4 a twisty run). Photos (tools/scratch/_stuckshot.mjs, 844x390 and 390x844): an
     AI stranded with no power on Thruston put back after 6 s, behind, then a second time, behind
     again; a highway wreck 25 m ahead of you gone at 7.5 s (off: still there).
   - PROOFS (laptop, against a700d67a): simhash switch off SAME (441c130c..., all 13 runs);
     worldhash --highway 20 SAME off and on; renderhash --only thruston,highway SAME off and on (its
     20 s drives have no stuck car). simhash ON [sim] DIFFERENT in 4 runs: the two stages from 10 s
     (old: a later starter put back while waiting at its start, the give-up reset; new: not),
     knobhill and knobhill-rx from 43.5 s (a racer put back at another moment, then the wake and
     contacts).
9. AI SLOW ON SLIPPERY SURFACES (measure first: an AI change).
10. HIGHWAY AI NOT DODGING ONCOMING TRAFFIC: back on (owner 11-13). Before: "ai don't dodge
    properly", to measure what they miss (traffic, the player, wrecks); parked 11-10 ("let's leave
    it for now").

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
  NAMES (owner 11-13: "Ok yea names work"): Holjes = HOLY JEEZ (PASSED), Croft RX = CROUGHED RX (its own
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
  HOLY JEEZ FIRS (owner 11-14: "Yes, mostly firs"), BUILT, TO TEST (`?hjfirs=1`): a level's own
  share of firs as level data (Level.firShare; render/trees.ts picks each tree's kind by its seed
  against it, FIR_SHARE 0.4 on a level without one); Holy Jeez 0.85 (holjes-venue.ts): 1 717 of
  its 2 022 trees firs (805 off), the rest leafy trees that colour in autumn and go bare in
  winter. Every reader of a tree's kind follows the share: the drawing (race, fly-in pictures,
  seasons) and the night canopy cut (traceCanopiesNear). Proofs (laptop): renderhash with the
  switch on SAME against the base on Spa, Knobhill RX and the forest stage by day and at night
  (night=0.94), Holy Jeez DIFFERENT (t14, t20, damaged); off, Holy Jeez SAME day and night;
  worldhash off SAME, on only Holy Jeez differs (the level field: the same 2 077 props); simhash
  SAME on (all 13 runs and a Holy Jeez drive) and off. The menu thumbnail has no trees: painted
  on / off, 0 px differ - not repainted (the committed one differs by 96 px at the start lane from
  today's painting, on and off alike: not this change).
  CROUGHED RX QUESTIONS ANSWERED (owner 11-14): the player fights the GRAVEL HAIRPIN, the
  TARMAC-TO-GRAVEL changes (grip changing through the lap, braking on the wrong surface punished),
  the JOKER choice; dressed like a UK round (grass banks, hospitality units, a big screen, flags).
  Weather from the world weather only, nothing forced. The map: tools/venues/croughed.osm.json way
  108510895 "Rallycross" (with "Club Link", "Chicane"), as knobhill.json's rx layout; the surfaces
  from the circuit's own RX map.
  CROUGHED RX BUILT, TO REVIEW (worker 11-15, ?croughedrx=1): its own full-size build of the
  circuit's map (tools/venues/croughedrx.json; croughed.json and the circuit's two levels untouched:
  worldhash SAME). THE SURFACES: the Rallycross way carried with surface=gravel (the map leaves it
  off; the source in the config: BRX reports - "Croft's loose-surface hairpin", dust "on the gravel
  parts" - and aerial photographs, ESRI World Imagery, showing the loose track from the chicane
  round the hairpin to the Main Straight); Clervaux, Hawthorn and the chicane tarmac: 1255 m, tarmac
  0-520 m, gravel 520-1255 m (59 %). THE GRAVEL HAIRPIN at its real radius (12.8 m traced, minR 10).
  THE GRID two abreast on the Main Straight (the start lane): 21 slots on the lane 3.2 m off its
  centre, the nearest tree 41 m. THE JOKER: none at the real Croft - a hand-laid gravel loop in the
  infield (section 5's question), the island's Armco joined at its noses. DRESSED: grass banks with
  catch fences (inside the hairpin, between the start lane and the return leg, inside Hawthorn),
  crowds, Union flags, hospitality units, transporters, a TV tower, boards (the big screen a LIVE
  board: section 5). CHECKS: lapdriver's flying lap 0.0 s off (rally-4x4 67.2 s, rx-super 65.7,
  hatch-rwd 72.4, track-rwd 60.4; from the grid 0.5-2.3 s off where the autodriver crosses from the
  lane to the lap, which it does not follow - the racing AI alone, 160 s on three seeds: 0.0 s off);
  THE 20-AI RACE (4 laps): seed 1 all 20 AI finished (the test's own player car stuck at the
  hairpin's entry), seed 2 the race closed at 251 s when that car won, every AI 2-4 laps done, none
  stopped; the field's offs and resets in traffic at the chicane's turn onto the gravel and the
  hairpin's entry (resets 5 and 4 there), no page errors; aijokercheck 3 seeds: one joker each;
  jokercost 10.1-11.4 s (Holy Jeez's real joker 7.5-8.6 s by the same tool); no air anywhere
  (crestcheck). barriercheck OK; propcheck clean; venueaudit: one Armco end at the joker's nose (as
  Holy Jeez's), short Armco runs of 23 m (the island) and 6 m (by the Back Straight), a farm road
  ending in its farmyard (mapped). FRAMES (laptop, 20 AI, work median, Croughed RX / Knobhill RX):
  x1 day 11.3 / 14.6, night 12.6 / 14.3 ms; x4 day 212.5 / 195.3, night 188.5 / 206.1 (both in the
  catch-up loop, 12 steps, as calibrated). worldhash with the switch off SAME as main's with
  CROUGHEDRX=1 on every level; simhash SAME. Thumbnail painted.
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

- CROUGHED RX'S JOKER (worker 11-15, `?croughedrx=1`): Croft ran NO joker (BRX reports 2017 and
  2018: "there is no joker at Croft", "Not having a joker lap at Croft isn't ideal"), and no map
  or source shows one. You asked for the joker choice, so one is built by hand (NOT REAL): a
  gravel loop into the open infield east of the return leg, 23 m longer (jokercost 10-11 s with
  the autodriver against Holy Jeez's real joker 7.5-8.6 s by the same tool). RECOMMENDED: keep
  it (the joker choice you asked for); the other answers: no joker (the real race), or another
  place for it.
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
  `?exitpuns=1` (highway/extras.ts SLIP_NAMES).
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
