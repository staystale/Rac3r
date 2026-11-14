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
  - MENU TAPS: the track lists' lengths and the rally stages' thumbnails PASSED 11-14 (TODO-DONE).

- SMOOTH FLY-IN (owner 11-14 on ?loadscreen=1: "Still jerky after loading bar !?", "The loading
  screen was meant to fix this but ok if that works"). NEXT for the worker, after ?onestart=1,
  before the Holy Jeez firs. The phone report (11-14, Spa, after the blue flash, both times): the
  fly-in at ~4 fps for ~2 s - 10 frames of 180-360 ms each, our JS 19-26 ms of each (sim 0), 2 GPU
  uploads a frame. Suspect: the fly-in's whole-level picture (camera.ts startFlyIn paintOverview,
  2048 x 3219 on Spa, ~7x the screen's pixels) drawn scaled every frame. MEASURE what each fly-in
  frame costs (the picture's draw, the uploads, the tiles), then draw it from a picture sized to
  the screen (made behind the loading screen), behind `?smoothfly=1`. Pass bar: the phone's
  report, every fly-in frame on Spa under ~20 ms. Anglesleazy National: 2-3 hiccups only.
- LOADING SCREEN (owner 11-14: "Spa on start up / restart seems slow af", "a loading screen there
  to hide it while it loads and then it can drop us in when it's ready", "the race should only start
  after loading is done and the player is in so we don't get dropped in midway thru a count down").
  BUILT, behind `?loadscreen=1` (worker, to review; ENGINE.md "One frame"):
  - Shown at once on START and RESTART (every level): the track's name and a progress bar.
  - Behind it: the level build, the 20 AI lined up, the cones stood up, and the ground round the
    grid painted. Then it fades into the race.
  - The FLY-IN (the whole track, then easing in to the car) plays only AFTER loading is done, in
    full (owner 11-14: "it's a cool asthetic that shows you the track too"). The order: loading
    screen, then the fly-in, then the player on the grid, then the countdown. Its whole-level picture
    is made behind the loading screen, not in the fly-in's first frame.
  - The COUNTDOWN starts only after the fly-in, with the player in.
  - MEASURE FIRST where start and restart time goes. Spa's cold build is 1.3-1.8 s of JS on the
    laptop at CPU x1 (loadtime: scenery 1.13 s, of it bushes 0.28, the edge 0.24, trees 0.21, roads
    0.21). A restart rebuilds nothing but resets 3 329 cones, lines up the field, draws the
    fly-in's whole-level picture and repaints the ground: time each in the browser. Fix anything
    redone needlessly as a real saving, not only hidden.
  - MEASURED (laptop, tools/scratch/_startload.mjs, 20 AI, switch off; ms from the tap): Spa START
    x1 - the call 1690 (setLevel 1463: buildLevel 1106, prepareLevel 357), the first frame 1943 (the
    fly-in's, before the field exists), the field lined up 2543 (spawnAI 338, the AI's line built on
    a level's first race), the fly-in over 4650, green 6904; RESTART x1 - the call 61 (cones reset 4,
    the fly-in picture 36, resetPuddles 20), field 390, fly-in over 2250, green 4396. At x4: START
    call 7776, field 11388, fly-in over 17884 (its 1.95 s at ~500 ms frames: the full field's sim runs
    under it), green 22258; RESTART field 1686, green 12315. Knobhill RX x1 START green 4319, RESTART
    4017; x4 8294 / 6653. Redone needlessly (now behind ?onestart=1, below): a START on a new level runs
    the restart twice (selectLevel's and launch's: two cones resets, two field line-ups, the first
    fly-in picture thrown away; Spa x1 ~70 ms, x4 ~320 ms); every RESTART repaints the fly-in's
    whole-level picture (Spa 36 ms x1, 144 ms x4) though the level has not changed.
  - TAP TO THE LIGHTS (laptop, 20 AI; ms from the tap: off = the first frame / the countdown begins
    / green; on = the screen / the screen gone and the fly-in begins / the countdown / green):
    Spa START x1 off 1943 / 2543 / 6904, on 3 / 2452 / 4483 / 8422; RESTART x1 off 196 / 390 /
    4396, on 1 / 471 / 2385 / 6368. Knobhill RX START x1 off 145 / 404 / 4319, on 2 / 470 / 2377 /
    6357; RESTART off 30 / 92 / 4017, on 2 / 375 / 2287 / 6255. At x4: Spa START off 8815 / 11388 /
    22258, on 12 / 11080 / 15793 / 23460; RESTART off 978 / 1686 / 12315, on 5 / 1243 / 5194 /
    12758. Knobhill START off 531 / 1673 / 8294, on 7 / 1522 / 3761 / 9542; RESTART off 111 / 431 /
    6653, on 3 / 427 / 2453 / 7372. Off, the lights count during the fly-in (and the field appears
    0.1-2.6 s into it); on, the full fly-in (1.95 s at x1) comes first, so green is ~2 s later at x1
    and 0.4-1.2 s later at x4 (the fly-in no longer runs the field's sim). The race from its first
    step is the same with the switch on (tools/scratch/_loadsimcmp.mjs: Thruston, Knobhill RX, Spa,
    SAME).

- NOTHING REDONE AT A START (owner 11-14 on the two redos above: "Yes, fix both"). BUILT, behind
  `?onestart=1` (worker; ENGINE.md "One frame"), with or without `?loadscreen=1`. PASSED 11-14
  (owner: "Pass all three"); its switch is removed with the smooth fly-in, which builds on it:
  - A START on a new level runs the restart ONCE (the launch's; the level switch's is skipped).
  - A RESTART reuses the fly-in's whole-level picture (render/flypicture.ts), painted again only
    when what it shows can differ: another level or layout, a rebuilt patch list, the scenery water
    (a pond frozen or thawed at the start), the screen's scale; the endless road's every time. It
    holds no weather, time of day, light or wear. tools/scratch/_flykeep.mjs walks those cases.
  - THE RACE: a launch that switches level drew the grid slot and the AI's cars (spawnAI) twice
    from Math.random and kept the second; now once, so the same seed gives another (equally
    random) slot and field. tools/scratch/_onestartcmp.mjs (laptop, 5 AI, 600 sim steps; lab >
    Thruston, Thruston > Knobhill RX, and with ?loadscreen=1 also Thruston > Spa): off 4 draws, on 2;
    the race differs from step 2 (another grid slot); with the stream moved on 2 draws first, SAME
    at every step in all five. simhash (PC) SAME off and with onestart=1 (its runs open the page on
    the level they launch: no level switch); worldhash SAME off and with ONESTART=1.
  - MEMORY: the kept picture is 2048 px wide: Spa 2048x3219 (25 MB), Le Manky 31 MB, Knobhill
    9 MB, held between races (it was let go after the fly-in); counted by the memory budget and
    dropped after the built levels when short.
  - PIXELS: renderhash (PC; Thruston, Spa, Grass Track, Holy Jeez, Sahara Sandpants, the highway;
    a level takes ~3 min there, all 51 ~2.5 h: CI's shards run the rest with the switch off) SAME
    off and with onestart=1 against round27. tools/scratch/_flypixels.mjs (PC, renderhash's raster):
    the launch's and the restart's fly-in frames (5, 45, 95 frames in), Spa and Grass Track, SAME
    off vs on. _loadmenu (laptop, Knobhill, ?loadscreen=1, with tools/scratch/_withquery.mjs for
    onestart=1): all OK off and on.
  - TIMES (PC, tools/scratch/_startload.mjs, 20 AI, ms; off -> on; Spa x1 run twice):
    Spa x1 START: the call 1787/1772 -> 1711/1711, the restart in it 156/166 -> 91/84, paintOverview
    (with the stand-in's 1024 px picture) 108/119 -> 66/59; first frame 2266/2242 -> 2092/2096;
    green 7396/7396 -> 7126/7115. RESTART: the call 70/81 -> 26/23 (the picture 47/58 -> none);
    first frame 353/374 -> 228/225; green 4835/4788 -> 4725/4739.
    Spa x4 START: the call 7761 -> 7403, the restart in it 650 -> 401, paintOverview 435 -> 285;
    first frame 9928 -> 9016; field 12929 -> 11820; green 26085 -> 24426. RESTART: the call 313 -> 99
    (the picture 155 -> none); first frame 1605 -> 948; green 14187 -> 14030.
    Knobhill RX x1 START: the call 60 -> 50, the restart in it 23 -> 13; first frame 157 -> 136; green
    4360 -> 4268. RESTART: the call 8 -> 3; first frame 50 -> 33; green 4029 -> 4039.
    Knobhill RX x4 START: the call 242 -> 216, the restart in it 99 -> 62; first frame 671 -> 610;
    green 10214 -> 10161. RESTART: the call 39 -> 13; first frame 227 -> 121; green 8271 -> 8227.
    With ?loadscreen=1 (Spa x1): START the restart 47 -> 25 (the screen already made the picture
    once), screen gone 2740 -> 2655, green 8960 -> 8924; RESTART the picture 46 -> none, but the
    screen's stages go a frame each and it stays 300 ms at least: gone 479 -> 494, green 6657 ->
    6690 (no gain seen there). Single runs: green at x4 moved more than the work saved (frames).
    Ground tiles painted during a RESTART varied (Spa x1 off 37 / 7, on 108 / 42): not explained.

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

BUGS (each behind its own switch, measured, then a test link):
1. FRONT TYRES DO NOT HEAT (seen on the F1 car, Test Lab; "they should heat up the same as rear
   tyres"). MEASURED (headless, aids off and on, tarmac, 18 C): Formula Won, 20 s full-lock circle
   fronts 37 / 51 C, rears 175 / 260; five stops from 60 m/s fronts 18 C for the first 6 s, 42 C at
   the end, rears 165 (throttle wheelspin). The hatch's fronts reach 110. Cause: a gripping axle
   warms only by cornering flex (physics/tyreheat.ts: braking force left out, and the work is read
   against the load, which downforce inflates), so a front that never locks or slides gets no
   braking heat and no smoke. Fix to agree: braking work warms a gripping axle; flex against the
   static load.
2. ROLLED CAR'S SIDE SEE-THROUGH (should be the paint, here light blue): which car to find.
3. THE HUD COVERS THE PLAYER'S CAR on the highways: the car must never be under a control or HUD.
4. RESETS: never put you ahead of where you were (inline or behind only); a car in the way: the
   next free spot BEHIND; a reset does not clear the police (they go only when too damaged, or
   having caught someone).
5. WRONG WAY ON HIGHWAYS too quick (highway.ts BACK_T 1.2 s, BACK_M 30 m): time to turn round,
   to spin or crash, to roll back a little.
6. A HIGHWAY RACE WON BY PULLING AWAY while OFF THE ROAD: not allowed (owner 11-13). Off the road
   still counts in a race to a line or against the clock.
7. ROLLING STARTS: the AI holds a SPEED, not a throttle (faster cars bump slower ones).
8. STUCK AI AND TRAFFIC: reset or vanish after 5-10 s stuck.
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
  HOLY JEEZ FIRS (owner 11-14: "Yes, mostly firs"): a per-level tree mix (the share of firs, now
  render/trees.ts FIR_SHARE 0.4 for every level) as level data; Holy Jeez about 85 % firs; every
  other level unchanged (renderhash SAME). For the worker after the loading screen.
  CROUGHED RX QUESTIONS ANSWERED (owner 11-14): the player fights the GRAVEL HAIRPIN, the
  TARMAC-TO-GRAVEL changes (grip changing through the lap, braking on the wrong surface punished),
  the JOKER choice; dressed like a UK round (grass banks, hospitality units, a big screen, flags).
  Weather from the world weather only, nothing forced. The map: tools/venues/croughed.osm.json way
  108510895 "Rallycross" (with "Club Link", "Chicane"), as knobhill.json's rx layout; the surfaces
  from the circuit's own RX map.
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
