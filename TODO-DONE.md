# RAC3R - finished work

The record moved out of `TODO.md` on 11-11 (owner: "Can we move done things on the todo to a
TODO-DONE file so we aren't always reading a huge list of completed tasks"). Everything here is
finished - passed, defaulted, approved, dropped by the owner, or superseded - kept as written,
with its measured numbers and the owner's verdicts. Every NEXT, "next", "waiting" or "owner to
decide" below is history: what is still open is in `TODO.md` (an open plan's full original
wording is kept here too, marked in [brackets]). The sections are the old file's, newest first.

Where to look: championships and venues - CHAMPIONSHIPS, NEXT 11-07; the highways (traffic, Deaf
Valley, stations, bridges, junctions, police) - THE OWNER'S LIST 11-10; cars, paint, crash parts,
rolls - OWNER 11-07; the AI rework - Where we are 11-04; the driving root fix, the K list - OWNER
LIST 11-01; TypeScript, mud, grass, lamps - Queue; weather, surfaces, car systems, damage,
lighting, bushes and trees - OWNER LIST 10-24; the checking tools - Tools that are wrong.

## PASSED 11-14 (owner: "Pass all three") - THE LAP LENGTHS AS DATA and THE RALLY STAGES' THUMBNAILS, now the default

The switches `?lapdata=1` and `?stagethumbs=1` and their old paths removed (the menu always reads
laplengths.ts and the shipped stage thumbnails). The owner's phone (report 11-14, all switches on):
35 menu taps, 4 over 100 ms. The third passed then, `?onestart=1`, is made the default with the
smooth fly-in (its code is under that work). As recorded in TODO section 2:

MENU TAPS answered in 120-230 ms (six in one session). MEASURED (foreman, laptop CPU x4,
tools/scratch/_menutaps.mjs, every button two screens deep): the slowest open a TRACK LIST -
TEST MODE > ALL TRACKS 249 ms, > RALLY STAGES 240 ms; then STEERING CONTROLS 118, TEST MODE 114,
CREDITS 96, SETTINGS 80. Profiled (cold): ALL TRACKS' card list asks each venue's lap LENGTH
(menu/tracks.ts addLength -> category.ts lapOf -> venue.ts venueLap -> venueBuild -> traceLayout,
the whole trace: tracedRadii, maskKinks) - 3.6 s of the profile at x4, only to print a length.
Owner 11-14: "It should come from a pre measured set of data": BUILT (foreman) behind
`?lapdata=1` - world/levels/laplengths.ts from tools/laplengths.mjs (--check in runall); with
it no list's open takes a task over 50 ms at x4 (without: 2-3.4 s on the first list opened).
TEST MODE itself (foreman, profiled): the 9 rally stages had no shipped thumbnail (thumbs.mjs
and thumbcheck never added the stages), so its open BUILT each to paint one - 2.3 s at x4.
Owner 11-14 "Yes, fix it": BUILT behind `?stagethumbs=1` (0.04-0.05 s); thumbcheck now fails
on a stage without one. The settings / steering / credits screens' 80-120 ms is the menu
race behind them, no needless work found. PRE-BUILT TRACKS dropped (owner asked; measured:
15 MB gzipped for all, Spa 1.2 MB; the phone builds Spa in 0.2-0.3 s and works offline).


## PASSED 11-14 (owner: "Pass, fix drops next") - PERFPASS, the speed fixes, now the default

The switch `?perfpass=1` and the old paths deleted (the onLane walk, the whole-list cone step, the
whole-list night walks, the per-lamp head lists, the old canopy walk); the memory budget's canvas list
now also pruned as it grows (it only grew between level loads). Old code with PERFPASS=1 against the
new code: worldhash SAME on every level, simhash SAME (13 runs), renderhash at night SAME (Spa, X
Gayms). The owner's phone (reports 11-14): 60 fps on every track raced (dt median 17 ms; slow frames
0.2-0.6 % over thousands of frames). As recorded in TODO section 2:

PERFORMANCE AUDIT (owner 11-13: "we need to hit 60fps on every track on most devices - We must
have major inefficiencies in our raw code? Can we fix them and keep it within our rules and
working the same"): the worker measures every level (framecheck CPU x4 and x1, 20 AI, day and
night, and the menu view), the drawing per layer (drawload) and the per-frame CPU profile, and
ranks the inefficiencies. No code change until the owner picks; each fix then behind its own
switch, proven the same (renderhash / worldhash / simhash). The owner's phone (report 11-13):
the MENU judders on big tracks (X Gayms, Le Mans: 11-16 missed frames in 5 s, our JS 5-12 ms).
PERFPASS (owner 11-13: "Yes to all", "Give them all to me behind one switch"), behind ONE
switch `?perfpass=1`, a commit each, each proven the same (simhash on/off both seeds, worldhash,
renderhash at night, a deliberate break each):
1 onLane by a lane reach grid; 2 the loose objects sleep on an awake list; 3 the barrier clamp by
a segment grid; 4 the night layer (canopies by the prop grid, the season once a call, tree
kinds kept, the light props and caravans listed, off-map head glows skipped, no lists a lamp);
5 a memory budget (180 MB: least-played built levels go back to their stub before a new build).
Built and proven; handed to the foreman for the phone test. MEASURED with the switch on (fixed
framecheck, 20 AI, our JS work median ms off -> on): CPU x1 Spa 17.9 -> 14.7 day, 27.5 -> 15.0
night; Sillystone 28.7 -> 15.7, 24.4 -> 15.5; Le Manky no clear change (noise both ways). CPU x4
(still 12 steps a frame): Spa 388 -> 248, 351 -> 222; Sillystone 312 -> 166, 327 -> 198; Le
Manky 222 -> 228, 247 -> 185.
framecheck fixed first (it never started the race). The audit's findings (live race, 20 AI):
framecheck timed a frozen grid: every framecheck number before the fix was draw only.
CPU x1 median day / night ms: Sillystone 23.9 / 26.4, Brands Snatch 16.7 / 28.1, Spa 19.6 /
  16.7, Snoozuka 19.2 / 18.2; the menu view 3.5-7. CPU x4: every level spiralled to 12 sim
  steps a frame (137-344 ms); the menu view 80-127 ms.
The sim is 64-75 % of a frame: the AI 33-38 %, onLane 17.8 % (Spa) / 6.8 % (Snoozuka), the
  world clamps 10-12 %, the ground samples 10-11 %, the loose objects 8-10 %, the barrier clamp
  5-7 %; the night layer walks every prop (Spa: 8 000 trees) several times a frame.
Not in this pass: the ground-sample share, the AI index, car pictures, menu tiles, HUD text.
  The step cap (MAX_STEPS 12) stays as it is (owner: removed).
The memory budget: owner 11-13 "Yes" (iPhone browsers report no memory). The long-session
  leak run was offered and declined ("No").


## PASSED 11-14 (owner: "Ok pass") - HOLY JEEZ, the Holjes rallycross, now a normal level

The switch `?holyjeez=1` removed; worldhash of the old code with HOLYJEEZ=1 against the new code: SAME
on every level. The owner's phone (report 11-14, 20 AI, night): 21 761 frames, dt median 17 ms,
0.36 % slow. The answers and the build as recorded in TODO 3b:

HOLY JEEZ QUESTIONS ANSWERED (owner 11-13: "Yes"): the fail points are the big crest jump after
the start and the tight gravel hairpin at the top, both at their real size; the joker as the real
race runs it (once, at the gravel split); dressed with pine forest, the crowd on the hillside and
the campers and caravans of the summer race weekend. Time and weather: the world clock (NOTES).
The map: OSM has every piece tagged asphalt / gravel and the joker (4 pieces).
HOLY JEEZ BUILT, TO REVIEW (worker, ?holyjeez=1): traced at full size, the joker, the start
lane; the joker island's Armco joined at the nose (tidyEdge, evenEdge: no doubled run); the crest
hump moved onto the road (it stood 18 m off it: no car flew) - now airborne up to 0.9 s flat out;
the campers moved onto the map (they stood past its west edge), the crowd's bank 24 m nearer the
hill gravel, flags, a TV tower, the paddock's transporters; least radius 15.3 m, the top
hairpin 19.5 m (no minR); the thumbnail; the map's edge held 150 m past the top hairpin; the
grid along the start lane two abreast like every level's (owner 11-14: "Race grids arnt 3
abreast", "2 abreast, longer lane"): the lane run on 89 m back past the map's dead end, bending
east clear of the stand and the building (VenueSpec.startLane back, gridRoomM 162 m; every other
level's grid slot for slot the same) - 21 of 21 on the lane, the nearest tree 11 m from a car's
centre; the 20-AI race on both seeds (PC): no car off the road or stopped in the first 12 s after
the green, 20 of 21 finished. worldhash SAME (PC); venueaudit, barriercheck, propcheck OK (laptop). The numbers: TODO-DONE once passed; the worker's hand-back until then.

## PASSED 11-13 (owner: "Ok keep it / For fast loading") - the faster level build (fastbuild), now the default

The switch and the old code paths deleted; worldhash of the old code with FASTBUILD=1 against the new
code: SAME on every level. The owner's phone (report 11-13): Spa from LAUNCH to driving 0.31 / 0.20 s
with it, 0.18 s without - the phone builds a level far faster than CPU x4 predicted (10-12 s), so the
gain is for slower devices. The record as it stood under test:

- FASTBUILD (`?fastbuild=1`; the foreman's shape, owner "Ok"): a level builds faster, the same
  level. The venue builders' hottest questions (node --cpu-prof, Sillystone: distToLine 0.77 s, of
  it the edge's lane check 0.31 s, the roads' junction / join / bypass checks 0.34 s) ask the
  line's box first (venuegeo.ts isWithinLine / isBeyondLine: a line too far to be nearer skipped);
  the edge's two all-against-all questions use a grid (world/edgegrid.ts: withoutDoubles' used
  points, dropFacing's rim samples - the Nordschleife's 20 km rim, ~0.9 s); one building asked
  about alone is tested by its own cells (venuesite.ts inBuilding: a grid was built for each,
  ~0.15 s); a lone road's lookup straight (edgeClear). The same answers: worldhash with it on SAME
  on every level (and L.A. Lively loose, ?xgaymsloose=1); with it off worldhash SAME and
  renderhash (Sillystone, X Gayms) SAME. BUILD (node tools/loadtime.mjs, cold, off -> on, ms):
  Sillystone National 2063 -> 1191, Nordschleife 1871 -> 881, Sillystone 1813 -> 1117, Spa 1719
  -> 1293, Yas Marina 1078 -> 764, Dieatona 1024 -> 811, Suzuka 1014 -> 722, Le Manky 1006 ->
  627, Bathworst 996 -> 648, Monza 931 -> 681, Stade de Prance 934 -> 375, The Bird's Mess 909 ->
  398, X Gayms 481 -> 417; every level 32.3 -> 22.9 s (-29 %), none slower. IN THE BROWSER
  (tools/browserload.mjs, CPU x4, opening to drawn, off / on twice): Sillystone 13.3 / 13.2 ->
  10.6 / 10.7 s, Spa 12.1 / 12.1 -> 10.5 / 10.7, Nordschleife 12.2 / 12.0 -> 8.9 / 8.8, Yas
  Marina 9.9 / 10.2 -> 8.6 / 8.7, X Gayms 6.1 / 6.0 -> 5.8 / 5.7. MEMORY: the build's peak JS heap
  (node, young space 1 MB, two runs each) Sillystone 136 / 129 -> 73 / 67 MB, Spa 80 / 79 -> 70 /
  73, Nordschleife 93 / 94 -> 89 / 82; held after the build the same (41.6, 45.0, 52.1-52.2 MB):
  the grids are not kept. Browser (tools/scratch/_memprobe.mjs 20 60, Spa, Sillystone,
  Nordschleife, X Gayms, The Bird's Mess, Knobhill, with it on): canvases 79-112 MB, JS heap 62 ->
  97-99 MB flat after the third level (the foreman's run without it: 82-114, 63 -> ~100).
  WRONG: anything different on the track, a slower load, a crash or a reload.

## PASSED 11-13 (owner: "Loose layout is a pass") - X Gayms' loose layout (xgaymsloose), now the default

- X GAYMS LOOSER (`?xgaymsloose=1`; owner 11-13: "loosen up the track so it's more natural and
  unique and less boxy n precise"; the shape agreed): L.A. Lively re-laid from the same generator
  (`tools/scratch/_lalivelydata.mjs loose` -> venues/lalivelyloose.ts; the plain link's lalively.ts
  byte for byte as it was). Kept: the figure of eight, the bridge at 90 deg, the joker and its
  jump, the blocks, stands, flags, dressing. CORNERS (vertex turn, radius): out of the avenue a
  fast SWEEPER into the east lot (L61, r38) and up it (L29, r36); a corner that TIGHTENS onto the
  north street (L51 r28, then L52 r14); a KINK along it (R20, r30); the north corner (L97, r18);
  the south corner (R97, r24); the south street bending (L11, r150) to the start; into the west
  lot (R47, r26), a HAIRPIN (R153, r15), back across the lot (L56, r28) and the avenue's bend
  (R40, r40). 923 m (942), dirt 43 % (43). Moved: the offices west of the hairpin (-205,45 ->
  -228,72), two litter heaps, the transporters, the TV platform and the show cars (off the new
  line); nothing left out; least radius 10 m (VenueSpec.minR: the venues' 15.5 opened the
  hairpin across its own legs). CHECKS (on vs today's): lap rally-4x4 58.8 s (59.3), rx-super
  57.5 (58.0), 0 s off the road; worst kink 7.3 deg over 1.5 m (6.9), no fold, kerbside none
  too tight; crossingcheck OK; crossover 20 AI seeds 1 / 2: 0 on the wrong level (the flagged
  cars are the joker's branch, as today's); portal drives clean; barriercheck OK, propcheck
  nothing on a light; venueaudit 2 fold-backs at the strip's west end and 4 Armco ends by the
  joker (today's 3), sealing 20 escape blocks (17: all the joker's strip, as today's); free ends
  1 (2); portalflare 9-11 deg, no barrier in a wall; jokercost 3.9 s (5.1); aijokercheck 5
  seeds, one gate each (seed 3 never jokers, as today's); gap jump cleared from 60 km/h (the
  same); AI over it 20 AI seed 1 18 cleared / 2 short (17 / 3), seed 2 16 / 5 short / 2 no
  flight (19 / 1), none stuck. FRAMES (framecheck CPU x4, 20 AI, work median off / on / off /
  on): night 20.2 / 22.2 / 18.4 / 21.6 (frames over 33 ms 242 / 292 / 174 / 278), day 20.7 /
  13.3 / 14.4 / 17.5 - night about +2.5 ms both pairs; the CPU profile's loop is not slower
  (9.0 vs 9.2 s). Worldhash and renderhash with it off SAME.
  WRONG: a corner that still reads square, a kink or fold in the road, a car stuck, Armco ending
  in the open, anything on the road, the jump not cleared from 60 km/h.
  PASSED 11-13 (owner: "Loose layout is a pass"). ON THE PHONE (the owner's report, 11-13): 5.4
  min by day at 0.17 % slow frames, 2.6 min at night in snow at 0.04 % slow (draw 3 ms) - the
  night +2.5 ms measured on the laptop did not show on the phone; a 31 min session, 13 level
  visits, no reload. Now the default: the switch and the old layout deleted, the generator's
  one layout written to venues/lalively.ts.

## PASSED 11-13 (owner: "Pass") - the road in a crossover's cut (cutroad) and the joker arrows (jokerarrow), both now the default

Switches and their old paths deleted; the plain link draws and lays them as `?cutroad=1&jokerarrow=1`
did (worldhash SAME, renderhash xgayms SAME against the switches-on reference). The records as
they stood under test:

- THE ROAD IN A CROSSOVER'S CUT (`?cutroad=1`; owner 11-13 on X Gayms: "strange road terrain on
  tunnel cross over area", "very uniform and not like the rest of the track"). CAUSE: the open
  cut is the portal's ramp (8 m of each 9 m portal), and render/props/venueprops.ts drawTunnel
  painted it in five OPAQUE shades over the ground - the road's texture, wear and edge lines
  hidden down the whole cut, the first shade (#3b3e45) lighter than race tarmac (#2d303a): a step
  where the road met it. (The crossing's own wear and tyre marks were drawn over it already.) Now
  the race road's part of the ramp is darkened by black at 0 / 17 / 33 / 50 / 67 % (to the old
  darkest shade over race tarmac at the mouth), the floor beside the road to the walls in the old
  opaque shades. Every race-road crossover: X Gayms, The Bird's Mess, Stade de Prance, Wobbly,
  Snoozuka, Moanaco - all showed it (shots/cutroad, each cut both lanes and 30 m outside, day,
  night, wet, 844x390 and 390x844, off and on). Road tunnels and the pit tunnel unchanged.
  Renderhash with it off (those six levels) SAME, worldhash SAME. FRAMES (framecheck CPU x4, 20
  AI, night, barriercull and xgaymsprops on, work median off / on / off / on): X Gayms 20.6 /
  17.4 / 17.1 / 19.6, The Bird's Mess 19.3 / 19.7 / 20.0 / 19.5 - noise.
  WRONG: flat bands across the road in the cut, a step or seam where it starts, the lines or wear
  stopping at the cut, grass or pavement showing in it.

- JOKER ARROW (`?jokerarrow=1`; owner 11-13: "the first joker arrow is a bit wonky not pointing
  correctly", X Gayms): the arrow on the lap before the joker (slidden-hill.ts jokerApproach) is
  tilted 0.35 rad toward the joker's side - Slidden Hill's, where the joker leaves at an angle. On
  L.A. Lively the joker runs straight on (-90 deg) and the lap turns away, so the tilt aimed it at
  -70 deg, into the barrier beside the mouth. Now a venue joker's lap arrow points at the mouth's
  arrow (-97 deg there). The mouth's arrow (owner: "Can we tip the second arrow to remind you it
  is a corner tho") is tipped 0.35 rad toward the way the joker bends in its next 30 m (-90 ->
  -110 deg: L.A. Lively's turns left). Worldhash with it on: only xgayms differs (Knobhill and Slidden Hill keep
  their own).

## PASSED 11-13 (owner: "Ok pass") - barrier culling, X Gayms' dressing and its joker way clear, now the default

- JOKER WAY CLEAR (`?jokerclear=1`; owner 11-13: "Hay bales are blocking the entrance and exit
  of the joker", X Gayms): the corner bales (kit.ts rxDress) go round the lap's outside where no
  wall stands, and where the joker branches off a corner that outside is its way in or out. MEASURED
  (the joker lane's centreline, its half width 6.5 m + a bale's 0.8 m): 3 bales on L.A. Lively's
  lane, at (145.9, -116.1) 4.1 m off its centre, (143.8, -118.5) and (9.7, -118.5) at its edge.
  Now (world/levels/rallycross-venue.ts clearJokerLane) no loose object stands on a venue joker
  lane's road; the bales between the joker and the lap (laid 0.9 m or more clear of it) stay.
  Worldhash with it on: only xgayms differs (every other rallycross venue had none there).
  Shots: shots/jokermouth-before and -clear (tools/scratch/_jokermouthshots.mjs, AT=14,132).
- BARRIER CULLING BY STRETCH (`?barriercull=1`; owner 11-13: "sure"): render/props/fence.ts
  skipped a barrier only when its whole box was off screen, so X Gayms' 1723 m of Armco in 7 runs
  round whole blocks was stroked and posted every frame. Now each barrier is cut into ~30 m
  stretches with their own boxes; only those on screen are stroked (each run of them as one line)
  and posted (from the whole line's running distance). Pit wall and rock wall drawn whole.
  MEASURED (framecheck CPU x4, 20 AI, our work a frame, median, off / on / off / on; frames over
  33 ms): X Gayms night 22.8 / 18.7 / 22.2 / 17.0 (284 / 160 / 281 / 105), day 15.8 / 16.0 /
  14.1 / 14.7 (63 / 74 / 49 / 44); The Bird's Mess night 20.4 / 20.1 / 20.6 / 20.3, day 17.8 /
  17.2 / 17.8 / 17.3; Knobhill night 17.8 / 17.0 / 17.5 / 17.0, day 15.3 / 15.2 / 14.0 / 12.1;
  Nordschlep night 20.7 / 22.8 / 22.5 / 21.3, day 15.2 / 18.6 / 19.9 / 19.5 (noise both ways).
  CPU profile, X Gayms night: drawBarriers 468 -> 63 ms of a ~12 s run (5.3 -> 0.7 % of the loop).
  PIXELS: the same frame drawn off / on in one frozen page, 64 shots (X Gayms, The Bird's Mess,
  Dieatona, Le Manky; 844x390 and 390x844, two zooms): 37 identical, the rest differ on <= 0.25 %
  of pixels by at most 5 levels of 255 along rail edges (the browser's anti-aliasing of a shorter
  path: a plain canvas test stroking a line whole and only its on-screen part differs the same
  way); a deliberate fault (posts out of phase) differs by 140 levels. Renderhash (X Gayms, The
  Bird's Mess, Knobhill, Dieatona): the plain link SAME as the base; with the switch 15 of 20
  captures the same, 5 by that anti-aliasing. Worldhash with it on SAME.
  WRONG: a barrier missing, cut short or flickering at the screen edge, posts jumping, a gap or
  kink in a rail, a slower frame than without the switch.

- X GAYMS DRESSING (`?xgaymsprops=1`; owner 11-13: "Can we finish jazzing up the xgaymes like
  we did other stadiums"): L.A. Lively gets the stadiums' pass. EVEN EDGE (VenueSpec.evenEdge):
  free ends 2 -> 2 (both ends of the joker strip's U of Armco by the north corner, 7.8 m apart,
  the bales between: past the 6 m join), kink points 4 -> 5 (all where the north street's rail
  meets the joker's at its inside corner, an L by design), jog points 53 -> 49; the barriers by
  the jump moved 0.16 m at most. TUNNEL MOUTHS (portalflare): the south portal's runs had been
  tidied round its walls to the lintel corners (a 45 deg hook, the wall's end 1.2 m nearer the
  road than the run) - such a run now goes to the wall's mouth corner when no run ends there
  (portalflare.ts mouthFor; no stadium has one: worldhash SAME). Sharpest turn over the last 20 m
  74 / 46 / 61 / 61 -> 9 / 9 / 10 / 10 deg, 3.0-3.2 m from the walls (2.1-2.7), no barrier in a
  wall (portaltouch). DRESSING (the stadiums' kits, now tools/scratch/_dresskits.mjs, in orange,
  black and white): the paddock in the lot east of the convention hall (4 transporters, 2 team
  cars, flight cases, spare tyres, a motorhome with a car and bins), a TV camera platform west of
  the jump's stand, fans at its east end and at the start's stand's west end, 3 show cars in the
  infield; 15 props, 14 loose, none left out; one joker bale (-9, -102) is dropped by the eased
  Armco (the even edge keeps loose objects off it). CHECKS (on): barriercheck, propcheck (nothing
  on a light), crossingcheck, portal drives OK; venueaudit and sealing as with it off (3 Armco ends
  by a road; 17 escape blocks, the joker strip); lap rally-4x4 59.4 -> 59.3 s, rx-super 58.0 ->
  57.9; the gap jump (held speeds) the same; AI over it (20 AI, seeds 1-12) short landings 16 ->
  29, 9 of them one pile-up on seed 6 (seeds 7-12: 10 / 10). FRAMES (framecheck CPU x4, 20 AI,
  barriercull on both sides, work median off / on / off / on, then on / off / on / off): night
  17.2 / 19.4 / 16.7 / 22.1, 19.4 / 19.1 / 16.6 / 19.2; day 18.5 / 17.3 / 12.2 / 20.3, 16.7 /
  15.2 / 16.5 / 15.9 - about +1 ms, not consistent; profile drawProps +0.2 ms a frame.
  Worldhash with it off SAME (every level).
  WRONG: a kink or step in the Armco, an end meeting nothing, a wall end sticking out at a tunnel
  mouth, a prop on the road, a barrier, a lamp or a flag, a slower frame.
- HAY BALES (?jokerclear=1): owner 11-13 on the shots, "yes hay bales look better after your change".
  PASSED 11-13 (owner: "Ok pass"): all three the default, the switches and testlist entries gone.

## PASSED 11-13 (owner: "Pass") - X Gayms / L.A. Lively, now the default

- X GAYMS / L.A. LIVELY (`?xgayms=1`; owner 11-12: "the worker can move on to the next levels / tracks";
  testlist xgayms; TEST MODE > RALLYCROSS). The X Gayms rallycross course in the streets round an
  arena, laid by hand (tools/scratch/_lalivelydata.mjs; not traced): a 942 m figure of eight on the
  street grid, the north-south street UNDER the avenue at 90 deg (the stadiums' crossover system,
  spareM 1.5, clearM 3.5 - at 2.4 two corners by the south portal stayed open), tarmac streets and
  three dirt lots (43 % dirt, the dirt a piece's surface over the street, as every rallycross lap),
  concrete off the road. THE JOKER (the shared rule: once a race, 30 s): a dirt lane round the north
  lot's outside, 52 m longer, with the 16 m (52 ft) GAP JUMP on its straight - a 2 m kicker over
  10 m (terrain ramp, red lip), the gap, a 2 m landing deck (terrain table), each five pieces side
  by side so the whole road is the jump (one piece was full height only on the lane's middle: the
  AI, on its line, 0-3 of 20 cleared it). No new physics, no AI change. Its look: blocks round it
  (the arena, halls, offices, shops, a hotel, a parking deck, studios), bleachers at the start, the
  jump and the avenue with orange / black / white flags, 15 floodlight pylons, litter; the world's
  clock and weather (no eventHour). MEASURED: the jump held at a speed (tools/scratch/_gapjump.mjs,
  on the middle and 5 m off it) - rally-4x4 / rx-super clear from 60 km/h, hatch-fwd / muscle-rwd
  from 70; at 100 km/h 31-40 m (to the end of the landing's run down); short ones land 10-15 m
  past the lip, in the gap or on the landing's face: no damage, none stuck. The AI (20 cars on
  their last lap, tools/scratch/_aigapcheck.mjs): 19 / 19 / 19 of 20 cleared (seeds 1 / 2, and
  rx-super), landing 15-22 m past the lip, 1 / 0 / 1 short, none stuck. Joker cost (jokercost,
  the careful autodriver): 5.4-5.9 s (real ones ~1-2 s). lapdriver: rally-4x4 59.3 s, rx-super
  58.0 s, 0.0 s off. aijokercheck: 5 seeds, the gate once each. crossovercheck (20 AI, seeds 1 / 2):
  43 / 42 passes under, 43 / 45 over, 0 on the wrong level, 0 wall hits by the crossover; the 5 / 3
  cars it flags (progress jump 114-117 m) are joker cars (line index jump 147: the AI's joker
  branch) - the lap's nearest point skips along while a car is off on the joker. Portals 0.00 deg
  off their lane, 12 drives clean; crossingcheck, barriercheck, propcheck, solidcheck OK; sealing
  (_moseal FAR 25) 0 escapes but the joker's own run-off (the tool reads distance off the lap
  only); venueaudit: 3 Armco ends by a road - the noses between the joker and the lap. Frames
  (framecheck CPU x4, 20 AI, our work a frame, median; Knobhill RX the same session): day 13.0
  (12.5), night 17.5 (16.1); frames over 33 ms at night 122 / 570 (66). Worldhash with the switch
  off: SAME.
  ROUND 2 (owner 11-12: "Nah it's fine" to the joker's cost; "street lamps please"; the night cost
  "yes", look into it): STREET LAMPS - the lamp plan's street lights along every straight of the
  lap (Level.streetLamps, world/lampplan.ts: the start straight's rule run round the whole lap,
  every 34 m, the sides in turn, none where the road bends) - 22 on L.A. Lively, 12.5-16.5 m off
  the road's centre behind the barriers (their arms 10 m off it at the nearest), with the 15
  pylons and 6 plan floodlights; propcheck: nothing on a light. NIGHT COST, MEASURED (framecheck
  CPU x4, 20 AI, our work a frame, median, Knobhill back to back; this session's laptop slower
  than the first round's): before the lamps night 25.7 / 26.0 (Knobhill 19.8 / 21.3), frames over
  33 ms 398 / 429 (253 / 292); day 20.4 / 21.5 (17.9 / 17.2). After: night 23.6 / 23.8 (19.4 /
  20.6), over 33 ms 355 / 355 (238 / 265); day 20.9 / 21.3 (16.6 / 17.1) - the lamps cost
  nothing measurable. THE CAUSE IS THE BARRIERS' DRAWING: with ?skip=barriers X Gayms is 19.9 at
  night, 16.1 by day (Knobhill's), and the profile has drawBarriers at 4.5 % of the loop (Knobhill
  0). Its 1723 m of Armco (1234 points, a post every 2 m) lies in 7 runs, each round a whole block
  - render/props/fence.ts culls a barrier only when its whole box is off the screen, so all of it
  is stroked and posted every frame (The Bird's Mess: 1016 m, skip=barriers saves 0.9 ms). Shared
  rendering code: not changed - a question for the owner (cull by stretch, which every venue
  would gain from).
  PASSED 11-13 (owner: "Pass"): the default, the switch and testlist entry gone.

## PASSED 11-12 (owner: "Pass") - menu pictures fill in (thumbfill) and lights clear of tyres (tyrelights), both now the default

- THUMBFILL (`?thumbfill=1`; owner 11-12, a photo of TEST MODE with half the category pictures
  missing, "This seems to happen when loading menu?"; testlist thumbfill): the 52 shipped track
  thumbnails are read one by one in the background after the page opens (menu/thumbfiles.ts), and
  a screen opened before they arrived showed only what had come - and stayed so. Now each missing
  one holds its place and is drawn in as it arrives (menu/tracks.ts addThumb, whenThumbArrives).
  WRONG: a card still without its picture after a few seconds, a jump as one arrives.

- TYRELIGHTS (`?tyrelights=1`; owner 11-12: "Tyres placed over lights on birds mess and probs
  others check please"; testlist tyrelights). Every level's lights (its own floodlight pylons and
  the lamp plan's) checked by drawn footprint (a pylon 1.2 m round, a street light's post 0.3 m)
  against every loose object (the level's and the corner floodlights' tyre rings) and every other
  light - tools/propcheck.mjs now does it on every level. FOUND: The Bird's Mess - the lamp plan's
  corner floodlight (inside the west sweeper) stood 3.2 m from one of the stadium's own pylons, its
  ring of tyres over that pylon's base (2 stacks); Naffcar - a plan floodlight 6 m from one of the
  level's own pylons (no tyres, two lights side by side). Every other level clear. THE CAUSE: a
  level's own pylons are props, not solids, so the lamp plan never saw them. Now (world/
  lampplan.ts nearOwnPylon) a planned light keeps LAMP_APART_M (8 m) off them: The Bird's Mess's
  corner light moved to 11.2 m off the pylon, Naffcar's plan light off its pylon. MEASURED
  (propcheck, every level): with the switch off and ?birdsmess=1 2 things on a light (the check
  fires), with ?tyrelights=1 0; with every switch off 0 (Naffcar's pair is 6 m apart, not on each
  other's footprint). Worldhash with every switch off SAME. WRONG: a tyre or prop over a light's
  base, two lights side by side, a corner floodlight without its tyre ring.

## PASSED 11-12 (owner: "That's all pass") - The Bird's Mess (birdsmess) and the stadium dressing (stadiumprops), both now the default

- STADIUMPROPS (`?stadiumprops=1`; owner 11-12: "All stadiums could be jazzed up with some props
  etc; bird mess also has some slightly messy Armco / fences"; testlist stadiumprops; Wobbly,
  Stade de Prance, The Bird's Mess). THE BARRIERS: where a stadium's two lanes run apart (the
  corners either side of the crossover, the inner lane 32 m in, not 20) the Armco between them
  zig-zagged between the two lanes' rims (0.5-1.5 m), and two runs there stopped 2-3 m short of the
  run beside them (The Bird's Mess and Stade de Prance, by the lens east / west of the
  crossover). Now (VenueSpec.evenEdge, world/stadiumtidy.ts) each Armco run and catch fence is
  eased (Taubin smoothing: a wave under ~10 m damped, a bend's radius kept, no point moved more
  than 0.8 m, the points by a portal and the ends fixed) and each free end carried on to the run
  beside it (cut back first where it ran in beside it, so nothing doubles; the run met split
  there, a joint). MEASURED (tools/scratch/_barrierends.mjs): free ends 2 / 2 / 0 -> 0 / 0 / 0,
  kink points (over 25 deg) 3 / 10 / 7 -> 0 / 5 / 3 (Bird's Mess / Stade de Prance / Wobbly).
  THE TUNNEL MOUTHS (owner 11-12 on The Bird's Mess: "Armco are close to the tunnel too and a bit
  messy still"; all three alike): each run's end was carried to the mouth's wall corner in a hook -
  3-5 m square across from the run (the run between the lanes turning 44-70 deg at once toward the
  lens), and six ran 0.11-0.25 m into a wall over 1.0-1.4 m. Now (world/portalflare.ts) a run's
  last stretch is laid along the road out of the mouth: the corner's own offset for 3 m (in line
  with the wall), then eased to the run's offset (smoothstep, ending where the run lies along the
  road within tan 17 deg, else at most tan 48 deg - a short run into the lens). MEASURED
  (tools/scratch/_portalflare.mjs, the 12 mouth ends): the sharpest turn over the last 20 m, the
  worst four, 70 / 44 / 61 / 26 -> 15 / 24 / 10 / 12 deg (all 12: 2-26, one - The Bird's Mess
  portal 2's run between the lanes - 12 -> 26 as it now curves round); every run 3-20 m back
  3.0-3.2 m from the walls (was 1.7-2.7); portaltouch: no barrier inside a wall (was 0.11-0.25 m
  in), the length within 0.3 m of a wall 1.0-1.4 -> 0.3-0.4 m, at the corner itself; kink points
  (whole level) 0 / 5 / 3 -> 3 / 6 / 4, the tapers' ends; portal drives (centre, +-5, +-6 m)
  clean, sealing 0 escapes, barriercheck, venueaudit (nothing overlaps), crossingcheck OK on all
  three; worldhash with the switch off SAME.
  THE DRESSING, each stadium its own (the generator's DRESS kits of existing kinds, laid after the
  boards and kept 2.5 m off them and 1.5 m off every barrier - VenueSpec.dress, world/
  venuebowl.ts): Wobbly (red, blue, white; all in the infield - its apron between the catch
  fence and the flags is a few metres) transporters, the podium and its crowd, show cars, a TV
  camera platform, cones; Stade de Prance (blue, white, red) a paddock (two transporters, cars,
  flight cases, spare tyres) and a row of transporters on the long north apron, a TV camera
  platform, a motorhome with its bins, fans, show cars in the infield, cones, tyres; The Bird's
  Mess (red, gold) transporters, a paddock, a motorhome, a TV camera platform, a red steel
  sculpture, show cars, fans, bins. Nothing inside the catch fence, nothing over the track.
  FRAMES (framecheck, CPU x4, 20 AI; our work a frame, median, switch off -> on; frame median
  35-36 ms in every run): Wobbly day 30.9 -> 33.6, again (on first) 29.9 -> 29.6; night 37.2 ->
  35.3. Stade de Prance day 23.7 -> 24.6; night 25.1 -> 28.5, again (on first) 23.9 -> 27.8. The
  Bird's Mess day 29.1 -> 29.0; night 36.7 -> 35.5. Stade's night is the one pair slower both
  times (+3.5 ms); its CPU profile is the same on and off (drawImage 14.0 / 14.3%, no dressing
  painter in the top 25) and drawload counts less drawing with it on (off-screen rects 929 -> 820,
  screen strokes 197 -> 177) - not found; the laptop's tile cost this session 7-9 ms (4 ms earlier).
  Worldhash with the switch off: SAME (every level, and The Bird's Mess with
  ?birdsmess=1). Checks with it on: barriercheck, propcheck, venueaudit (nothing overlaps),
  sealing 0 escapes, portal drives (centre, +-5, +-6 m) clean, crossingcheck OK on all three.
  WRONG: an Armco run with a kink or a step, an end that meets nothing, a prop on a fence, over
  the track or hiding the line, a board moved, a lower frame rate.

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

## PASSED 11-12 (owner: "The rest is pass") - the tunnel lights (coverlight)

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
  FAILED 11-12 ("Lights show thru the side of tunnels tho / on top monaco"): a car OUTSIDE the
  tunnel was never clipped - on the road before the mouth its headlights ran on over the slats
  (tools/scratch/_tunnelleak.mjs: the car stopped, a photo lamps off and lamps on, the difference
  is its light). COVERLIGHT (`?coverlight=1`): a car not in a tunnel has its light clipped off
  every slat of a slatted cover within its light's reach (render/coverlight.ts clipOffCovers; one
  box test per cover out of reach). The photo before the mouth: the beam stops at the slats, the
  open cut before them still lit. And (owner 11-12, a photo: "still happening on the side of
  moanaco tunnel") a car IN the tunnel turned toward a wall lit slat-shaped patches past it: its
  clip was one even-odd path of the walls and the slats, and a slat's end out past a wall was
  inside the slat and outside the walls - so lit. Now the walls are clipped first, then the slats
  off that (render/light.ts clipToCut). The photo turned 0.9 rad at five stops: the beam ends at
  the wall. And a car in a bent tunnel's last cut lit nothing past its mouth (tools/lightleak.mjs:
  0% of the road ahead lit) - the straight ones' open ground past each mouth was missing: now
  from each mouth's own line out (render/coverlight.ts traceMouthOpen): 100%. lightleak on Moanaco
  (the tunnel, both footbridges; 45 stops): 0 leaks with the switch, 6 without. WRONG as above,
  and light on the slats from a car approaching, leaving or beside the tunnel, or past its side,
  or the road ahead dark as a car leaves the tunnel.
  And (owner 11-12, a photo of The Bird's Mess: "Lights don't show in tunnel ... surely we can
  make it work n look like real life") a car under a straight tunnel's whole cover put every lamp
  out (render/light.ts lampsHidden), so under a stadium crossover's short bridge it lit nothing,
  not even the road past the far mouth. Now its light is never put out, only clipped
  (clipToCut: off the cover, out of both mouths and into the open cuts) - as a real tunnel seen
  from above. lightleak gains DARK (a car in a tunnel lighting almost none of the open road 4-28 m
  ahead) and a 6 m band past a tunnel's walls (a barrier 25 m off flagged as a leak before).

## PASSED 11-12 (owner: "mostly pass"; the slatted tunnel's lights failed, still open) - the
performance round and the stadium crossovers

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

## PASSED 11-12 (owner: "All / Pass") - the 11-11 test round

Every switch below made the default and deleted 11-12 (roadparity, bridgecars, railbridges,
roadtunnels, wobbly, stadeprance, police, trainlights, moveover, roadrage, stationstops), the
old paths gone; the tunnel light fix, police livery and the stadium rework passed with them.

- POLICE (`?police=1`; Highway to Hull, any road, traffic on; ROUND 4 of the owner's list, design
  agreed 11-11). Police cars are traffic cars (BMV 3 Serious / Volvoh V70 Arr, white, a roof light
  bar), cruising either way or waiting at the roadside (a forecourt, a lay-by, the hard shoulder).
  HEAT 0-3 small yellow stars over the LIGHTS row: a speed camera, over 70 mph within 30 m of one
  (100 mph: 2), flashing the lights / an unsignalled lane change within 60 m of one, a crash near
  one, a pile-up. Each star sends a chaser (the racing AI, you its target, harder each star, up to
  170 / 200 / 230 km/h). LOST THEM: no chaser within 200 m for 10 s. BUSTED: a chaser within 1 m
  while you are under 2 m/s for 3 s - the card, the fine ("TEST MODE: NOT CHARGED"), the police
  gone, a reset. No siren sound yet. MEASURED: a camera at 140 km/h - 1 star, a chaser within 30 m
  11 s later; 1 / 2 / 3 stars - 1 / 2 / 3 chasers within 40 m in 10-14 s; stopped, BUSTED 4.2-5.8 s
  after; lost 10-17 s after the last sighting; no BACK TO THE ROAD left after a bust; switch off
  identical. WRONG: stars for nothing, no chase, chasers stuck or flying, an unfair BUSTED, never
  escaping. Owner 11-11: "police seem good".
  ANY LAW BREAKER (owner 11-11 "they should target AI / anyone who's breaking the rules", "pursue
  the closest law breaker"; ai/policeHeat.ts stepHeats, ai/trafficPolice.ts pickTarget): every
  driver has its own heat by the same rules - you, the AI rivals, the traffic (speeders, quicker
  drivers, a crasher; the camera and police-due are yours only; a crash counts against the one
  moving into the other); each star anyone gains sends a chaser (3 at most), and each chaser goes
  after the closest driver with heat on its level, looked at again every 2 s (a new one only when
  under 3/4 of the distance); one ahead of its stopped target, out of sight, is sent round behind
  it; a ram eases off once touching (it shoved a braking rival on at 35-49 km/h). Busted: an AI
  rival held 6 s on the brakes, then its own reset; a traffic driver put away; you as before - only
  your chasers go. Your stars, LOST THEM and BUSTED are yours only. MEASURED (_police.mjs PART=
  others, you clean on the shoulder): a rival past a police car at 140-150 km/h - its 1 star, yours
  0, the chaser after the rival; pulled over, BUSTED 17 s later and held; a speeder past one at
  170 km/h - its 2 stars, yours 0, 2 chasers after it (not caught: it outran them); a rival 40 m
  ahead and a traffic car 233 m ahead, 1 star each - both chasers after the rival (the first 150 m
  from it, 356 m from the other); your own scenarios unchanged (camera 1 star, chase 1-3 chasers
  within 40 m in 10-13 s, BUSTED 5-7 s after stopping, lost 10 s after the last sighting). WRONG:
  police chasing you when someone nearer broke the rules, you getting stars for what a rival did,
  an AI never let go after a bust, a chaser flicking between two.
  MORE LIGHTS (owner 11-11 "slightly brighter / bigger reach and more lights - some on the front
  grille / back window"; render/lightbar.ts, light.ts): while chasing, the bar's lit half brighter
  (a white core) with a small blue halo by day, two blue flashers in the grille and two in the back
  window flashing against the bar's side; at night each glows - the bar's reach 4 -> 7 m, a
  flasher's 2.6 m. Photographed chasing, day and night, 844x390 and 390x844. WRONG: lights while
  cruising or waiting, flashers off the grille / back window, a glow on a car not chasing.
- ROADPARITY (`?roadparity=1`; Highway to Hull, the WALLED and DEAF VALLEY roads). Every endless
  road built alike, only the look apart: the road dressed 320 m behind its end so a junction is laid
  ahead; junctions on the walled road (the wall open at the slips); Deaf Valley's exits, services,
  bridges and junctions by the countryside's rules (the rock walls open where they pass, only a
  gorge keeps them off). MEASURED (10 km, 2 seeds): Deaf Valley exits 1-4 (countryside 1-3),
  services 2-3 (3), bridges 5-6 (3-6); the junction drive 11 of 11, 0 resets. WRONG: a slip into
  rock or a wall, a junction where a wall stands, things popping in ahead.
- BRIDGECARS (`?bridgecars=1`; Highway to Hull, traffic on). Two real traffic cars a road bridge,
  up its left lane, over the deck, round a turning place and back; asleep past 300 m. MEASURED
  (90 s by 7 bridges): each car over the deck 3 times, 17-47 km/h, never stuck, none rolled. WRONG:
  cars stuck, off the bridge road, flying, popping in close, lag.
- RAILBRIDGES (`?railbridges=1`; Highway to Hull, rail bridges and Deaf Valley's trestles). Drivable
  along the track (a 7 m deck on ballast - not a road: BACK TO THE ROAD counts on it); the train
  hits you (placed by the world's sim clock; a car hit carried at 80 % of its speed). MEASURED: over
  and off both ways, 0 wall hits; a car stopped on the deck kicked 17.6 m/s by a freight, 25.6 by a
  passenger train. WRONG: stuck on it, the train passing through you or not hitting you, no
  countdown on it.
- ROADTUNNELS (`?roadtunnels=1`; Highway to Hull, a third of the road bridges). A road under the
  motorway instead of over it, a portal each side. MEASURED (crossingcheck, 4 roads): through both
  ways, 0 wall hits, no way in from the side. WRONG: seen while under the motorway, stuck in a
  portal, a way in from the side.
- WOBBLY (`?wobbly=1`; TEST MODE > RALLYCROSS). Wobbly Stadium, the Race of Champions track at
  Wembley (2007-08): two lanes interwoven round the bowl, one crossover bridge, at full size (~800
  m in a ~210 x 170 m bowl; NOTES: A STADIUM TRACK IS BUILT AT FULL SIZE); a lap, then VS AI.
  WRONG: a car seen under the bridge, a way off the lanes, a car stuck at the crossover.
- STADEPRANCE (`?stadeprance=1`; TEST MODE > RALLYCROSS). Stade de Prance, the ROC track in Paris
  (2004-06), from the same generator (tools/scratch/_rocdata.mjs): 966 m, an oval bowl with a roof
  ring, gravel on both lanes' west hairpin. WRONG: as Wobbly.
- THE STADIUMS REWORKED 11-11 (both switches; owner: "a bit bland", "soften up the track layout",
  "the starting format is wrong", "tunnel cuts thru an Armco", "tunnels and edges misaligned"):
  the ROC START (Level.splitStart: you and the rival side by side on the two lanes, each timed
  over 1 full lap from its own line, the podium on time; TEST MODE defaults 1 rival, 1 lap, both
  adjustable); every corner its own (radius, leaning sides, a kink or double apex; Wobbly 772 m,
  Stade de Prance 951 m); ~900 tyre stacks a level, 15 boards, flags; the crossover's portals
  along the road (world/venuecross.ts, as Moanaco's bent tunnel - Snoozuka moved 0.03 m) and the
  parapets' Armco stopped at the portals (Snoozuka's too). MEASURED (_rocrace.mjs): the cars 20 m
  apart at the lights, each timed over one lap (Wobbly 45-46 s, Stade de Prance 56-58 s); sealing
  0 escapes; crossingcheck OK on Snoozuka, Brands, Moanaco, both stadiums. WRONG: the rival not
  alongside at the lights, a lap ending early or late, Armco across a portal, a gap in the fence,
  a tyre or board on the road. THEN (owner 11-11: start "on the gravel facing the same way but on
  different lanes where they race back to their start line"; "a test menu option like other rally
  cross events", "pressing this button should auto set" 2 cars): the start line on the outer lane's
  gravel (Wobbly the north straight, Stade de Prance the south-west), the rival's line painted on
  the inner lane's gravel alongside (world/splitstart.ts; the same way, Wobbly 20 m apart, Stade de Prance 30 m);
  setup's
  PRACTICE / HEAD-TO-HEADBUTT · 1 LAP row (the event sets 1 rival and 1 lap, both still
  adjustable). MEASURED (_rocrace.mjs): the cars 20 m apart side by side on the gravel, Wobbly
  46.39 / 46.54 s, Stade de Prance 56.87 / 56.96 s, each one lap back to its own line.
  THE CROSSOVER FIXED 11-11 (owner: "the tunnel is wonky now"; branch foreman/portals): a
  straight X - two straight diagonals 25 deg off the lanes, the inner lane 30 m in along that
  straight, the underpass straight from mouth to mouth (NOTES: A STADIUM'S CROSSOVER IS A
  STRAIGHT X); the abutment slats gone, every barrier end by a portal carried on to its wall
  corner. Wobbly 782 m, Stade de Prance 949 m. MEASURED (tools/scratch/_portalcheck.mjs): the 4
  portals 0.05-0.45 deg off their lane at the mouth, centred (0.00 m); 24 drives at 15 m/s
  through the tunnel both ways and along the bridge road's edges, 0 hits; sealing 0 escapes.
  WRONG: a portal askew of its lane or opening onto grass, Armco sticking out past a portal, a
  car caught on a portal's corner.

- POLICE LIVERY (in ?police=1; owner 11-11 "police liveries / hi-vis strips ... like real cars";
  render/carsprite.ts paintPolice): the Battenberg check (blue / fluorescent yellow) down both
  flanks and across the bonnet's and boot's edges, a hi-vis strip, a white roof with a roof number
  (the digits ~3 px on a phone: a number panel, not readable), the light bar ahead of it.
- TRAINLIGHTS (`?trainlights=1`; owner 11-11 "Do trains have lights at night?"; render/eventglows.ts
  trainLights): at night a rail bridge's train throws a headlight pool ~16 m up the track, its
  windows lit warm (strong: WINDOW in eventglows.ts); Deaf Valley's freight a headlight and a dim
  cab. WRONG: no lights, lights off the train, lights by day.
- TUNNEL LIGHT (a fix, no switch; owner 11-11 "tunnels still show lights thru the edges"; render/
  light.ts clipToCut): a car in a tunnel lights only its own cut - no light on the portal walls,
  lintel, slats or the ground over it (Brands, Moanaco photographed before / after); driving out its
  beam still spreads ahead. Seen, not fixed: in a highway road tunnel (?roadtunnels=1) a car's beam
  does not show at all (likely under the motorway's dark).

- MOVEOVER (`?moveover=1`; owner 11-11 "Can traffic move over for police", "flashing a traffic AI
  [to] encourage them but not guarantee them to move over"; ai/trafficYield.ts through trafficLane.ts
  chooseLane): a car of our way with a chasing police car (its lights on) closing up behind it in
  its lane within 90 m moves a lane left (signalling, clear for the whole move) or, in the nearside
  lane, edges 1.6 m toward the hard shoulder (where it is 2 m or more), its left indicator on, and
  goes nowhere to its right meanwhile; the other way is unaffected. You flashing your lights at the
  car ahead of you in your lane within 60 m: a 50 % chance it does the same for 8 s (it eases to
  85 % of its speed to drop in behind a car alongside); one that cannot (no lane, a car alongside)
  does not. MEASURED (tools/scratch/_police.mjs PART=traffic4, you up the shoulder at 150 km/h, 2
  stars): 8 cars had a chaser closing in their lane - 4 moved a lane left (6-53 m ahead of it) and
  3 edged to the shoulder; switch off, the same run: 3 moved left (keeping left), 0 edged. 30 cars
  flashed from 30 m behind in the middle lane: asked 12; at traffic 0.6 1 moved over, 11 had a car
  alongside on their left all the way; at traffic 0.3 3 of 12 moved over (9 boxed in). WRONG: cars
  moving right into the police, cutting into a car, every flashed car obeying.
- ROADRAGE (`?roadrage=1`; owner 11-11 "flashing the same car multiple times make them act like
  police no lights ... they are angry"; ai/trafficYield.ts noteFlash, ai/trafficPolice.ts makeAngry
  / stepAngry): the same car flashed 3 times inside 20 s gets angry for 30-45 s - the police's chase
  driver at its wheel (the racing AI, you its target, tailgating, ramming at 2 stars' closing speed)
  with no lights or livery, its headlights (their beams at night, a white halo by day) and brake
  lights flashing together; then it calms down and drives on as traffic (or out of 200 m it gives
  up). It is no police car to the heat (it gives no stars, cannot bust you; its rams are not your
  offence). MEASURED (_police.mjs): flashes ignored, ignored, angry; angry 44 s, within 10 m of you
  41 s, touching 35 s, then calm; your stars 0 -> 0. WRONG: anger after one flash, never calming,
  stars from it alone.
- STATIONSTOPS (`?stationstops=1`; owner 11-11 "Can traffic use petrol stations"; ai/trafficFuel.ts,
  the breakdowns' TrafficBroke / roadside road / PARKED): a nearside car of our way 70-170 m short
  of a roadside station (a lay-by's, Deaf Valley's LAST GASP - not a services', behind its side
  road) stops there 15 % of its passes: left indicator, slows to 29 km/h by the forecourt, eased
  across it, stops level with the pumps at the canopy's road-side edge (5.2 m in from the station's
  middle - under the canopy a car is hidden), 10-20 s, then pulls out once the nearside lane is
  clear 70 m back (right indicator); 25 % of the cars put back ahead by a station are already at
  its pumps. MEASURED (_police.mjs, you at 54 km/h, 10 km each): dual 0 stops, twisty 2, Deaf
  Valley motorway 3 (8-9 s at the pumps; one hurt doing it) - a stop you have passed is put back
  out of sight before it finishes (as any car behind you); at the 2.6 m-in stop before, on the dual
  one put there was 19 s at the pumps, pulled out and back in its lane. In the real game (a car put
  at the pumps, tools/scratch/_traffic4shots.mjs WHAT=pumps): waited, then pulled out indicating
  right; photographed at the pumps (half under the canopy) and pulling out. WRONG: stopping in the road, into the pumps, pulling out into a car.

## The old TODO.md header (superseded 11-11)

# RAC3R - open work

New session? Read `CLAUDE.md`, then `NOTES.md`, then this file. Open items only: finished work is in
the git history (this file was swept on 2026-10-19: every finished entry deleted; the owner's
decisions and the measured lessons live in `NOTES.md`). `docs/handover-2026-11-08.md` is the
last handover, written on request.

## CHAMPIONSHIPS - PLAN AGREED 11-09 (owner: "F1 / Gt / Maybe btcc not dtm", "Sst it is then",
"Dakar ok", "Wrc ok", "we forgot rally cross", "your suggested working order for this is fine")

[The plan's full wording as agreed - the record. The open items are in TODO.md OPEN 3b / 3c;
MOANACO passed 11-11 (the default); WOBBLY and STADE DE PRANCE are under test (TODO.md
UNDER TEST).]

The venue helper builds the tracks one at a time, each behind its own switch (the brief:
docs/handover-2026-11-08.md); the main session reviews each and merges it. Names agreed with the
owner before they ship (proposed below).
1. F1: Sillystone (have), Monaco (Moanaco), Spa (Spa-Frankenchumps), Monza (Monzarella), Suzuka
   (Snoozuka), Yas Marina (Yass Marina). GT: Nurburgring (Nerdburgring, the Nordschleife as the
   "Nordschlep"), Le Mans (Le Manky, the "Mulsanity" straight), Spa, Bathurst (Bathworst), the
   Dieatona road course (have); Dubai (Dubious Autodrome) a possible extra. BTCC: the UK venues
   we have (Brands, Donington, Thruxton, Oulton, Croft, Snetterton, Knockhill, Silverstone) - no
   new tracks. ORDER: Spa, Monza (the simplest), then SIMPLE versions of the long ones (the
   Nordschleife ~10 km, Le Mans ~7 km at 1/2) for the owner to test on the phone first, Monaco
   (streets, walls, the tunnel) last. MOANACO built 11-11 by the venue helper
   (levels/moanaco-venue.ts; paved, its parks, street trees): PASSED 11-11, the default.
2. WRC: one famous stage per rally remade from the map data as the venues are (Col de Turini,
   Ouninpohja, Sardinia, Safari, Acropolis; Sweaty Lamb is Wales).
3. DAKAR: open desert, checkpoint gates, other racers, Deaf Valley's terrain; short stages (3-6
   min). NO EXTRA HAZARDS (owner 11-09: "jsut what's there terrain cactus other racers ect rocks
   surfaces ect is dangerous enough"). Navigation proposed: normal - a big arrow at the screen's
   edge to the next checkpoint, its distance; hard - the compass bearing and distance only, read in
   the pause menu as a road book (the owner's idea); a missed checkpoint a time penalty.
   NAVIGATION DECIDED (owner 11-10): a MAP in the pause menu - a pixel-art map of the area, as a
   real one would be but not exact, looking like a BOOK (the book's surface textured with our
   terrain look); like a real map and unclear: NO "you are here", only landmarks, rock features and
   the like; a procedural stage's map spawned from the SAME SEED as the stage, so they match. And a
   small pixel-art COMPASS on screen for those levels / events. ("ask any questions when we come to
   do it".)
4. SST (Stadium Super Trucks): "keep it simple 5-10 tracks and a couple different trucks with
   different specs"; a mix of tracks (street circuits, our circuits, stadium) with jump ramps
   (world/flipramps.ts exists).
5. RALLYCROSS: the RX tracks and cars we have (Knobhill RX, Slidden Hill; the Fjord Fiester RX)
   plus more (owner 11-09: "is there not more uk rally cross tracks ?", "I thought America had some
   stadium ones with jumps tunnels ect ?"): UK - Pembrey, Croft's RX layout (on the Croughed
   venue), Blyton; the US stadium / Nitro RX style - gap jumps over the track, crossovers on a
   bridge (both systems exist); a World RX one or two (Holjes). Names to agree.
   NEW TRACKS (owner 11-10: "Yes and some head to head swap over tracks ! Tarmac and
   dirt / gravel like other rally cross stuff I've seen. Discuss"): the old stages stay as they are
   ("keep the originals"); new ones from the map (Pembrey, Blyton) and a stadium one, plus a
   HEAD-TO-HEAD SWAP-OVER track - two parallel lanes that cross on a bridge so each car runs both,
   mixed tarmac and gravel. AGREED 11-10 (owner: "Side by side ace make them all or at least 4+",
   "tarmac plus dirt x games make 52 gap version", "Make the stadiums that were around the tracks
   if we can creative license allowed", the event HEAD-TO-HEADBUTT, "wobbly is great"):
   - the Race of Champions stadium format: two interwoven lanes side by side joined by one
     crossover bridge, so each car covers both - ONE path crossing itself (Snoozuka's crossover
     system: world/trackunder.ts), the two cars started half a path apart, side by side; tarmac
     with gravel in the same places on both lanes. 1v1 heats (best of three, a knockout bracket)
     AND a 4-car race round the whole path. The stadium round it (stands, the bowl), creative
     licence allowed. WOBBLY STADIUM first (Wembley, ROC 2007-08: BUILT 11-11 behind ?wobbly=1 -
     the track and the stadium, raced as a lap / VS AI; the 1v1 heats and the bracket a game mode to
     agree with the owner first); STADE DE PRANCE next (Paris, ROC 2004-06: BUILT 11-11 behind
     ?stadeprance=1 - an oval bowl with a roof ring, from the same shared generator); then 3+ more
     ROC stadiums (NAMES APPROVED 11-10: The Bird's Mess 2009, Accordion Stadium
     2025, Dusseldork Arena 2010-11). Built by the venue helper, reviewed by the foreman, passed by
     the owner.
   - X GAMES RALLYCROSS, Los Angeles 2012: tarmac and dirt round the streets, the joker's 52 ft
     (16 m) dirt-to-dirt GAP JUMP (terrain ramps: the game's airtime and landings). Names approved
     11-10: X GAYMS (the owner's), the course L.A. LIVELY.
   - THE WEMBLEY STOCK CAR TRACK (owner 11-10: "add the Wembley stock car arena too ... it can size
     match with the current stock car circuit or relative if it's bigger irl"): the old Wembley's
     speedway track round the pitch, 345 m real (378 yd: Wembley Lions, Wikipedia), stock cars there
     from 1955 - smaller than our Stock Car oval (551 m), so built at its size (Wembley's shape, a
     ~550 m lap), in the old stadium's bowl (its twin towers): OLD WOBBLY (approved 11-10).
6. DEMOLITION DERBY (owner 11-10: "Demolition derby levels classic tarmac circle - and we can reuse
   stock car tracks ect for that too"): a classic tarmac circle arena, and a derby mode on the stock
   car tracks (Stock Car, Grass Track, the Wembley oval). Questions when we come to it (the AI
   ramming, how a car is out, the winner).
CARS: talk to the owner once the tracks are done (trucks, a Dakar car / truck).

## THE OWNER'S LIST (11-10: "Add this to the todo and work thru it logically") - in this order

[Rounds 1-3 passed or dropped, except 12c's PARITY, R3, R4 and R5 - under test, short entries
in TODO.md UNDER TEST; round 4 (police) under test; round 5 open - in TODO.md OPEN 3a. The Deaf
Valley exit names (12b) are a question in TODO.md.]

ROUND 1, QUICK FIXES (each behind its own switch, one test link) - BUILT 11-10; owner "1-7 pass"
(11-10): 1-5 the default (switches deleted); 6 passed on the old version - its fix, 6b and 6c
under one more look (PASSED 11-11, the default):
1. Goodwoody renamed BAD WOOD ("Rename goodwoody to bad wood"). ?badwood=1 (the id stays).
2. The HUD on by itself where the difficulty allows it ("Hud should be on automatically if it can
   be on for that difficulty level"). ?hudon=1: the minimap, progress bar, track temperature
   and tyre / damage diagram on by default in every mode (REAL still locks the minimap and the
   gauge off); the earlier choices start afresh once. Shot: RICH, a fresh device, all on.
3. A reset puts the hazard lights on for 3 s ("resets ... should put hazards on for 3 seconds").
   ?resethazard=1 (game/resethazard.ts; the player's and an AI car's reset): 2999 ms after a reset,
   off at 3.6 s.
4. The steering stick's area size in the control settings, today's size the least ("start size of
   the steering stick area should be a thing so user can increase that - current size should be
   minimum"). ?sticksize=1: STICK SIZE in STEERING CONTROLS, 38 px (today's, OFF) to 76 px.
5. Bushes: no terrain look on them - drawn on top, working the same ("Don't apply terrain to bushes
   it's making them look weird"). ?bushflat=1: a bush's shade cells unshaded (render/glshade.ts,
   world/wear.ts bushAt) - shot on Killder's steepest bush: its colours kept, not washed pale.
6. Traffic both ways from ONE density slider, even amounts each way ("not enough cars on my side of
   the road and too many on the oncoming side"). ONE slider already - each way PER_LANE x
   lanes; your way's cars were put back 300-470 m ahead and, at about your speed, kept out of
   sight ahead. ?trafficeven=1: put back 140-300 m ahead, and a third of those you pass come back
   from behind as faster drivers (125-150 km/h: owner "can cars on my side come up behind me
   still", "I want them too like a real road"). MEASURED (tools/scratch/_trafficsides.mjs, traffic
   0.6, cars within 300 m): a single carriageway yours 1.9 -> 2.3-2.6 (the other way 3.2-3.3), the
   dual 5.3-5.5 -> 6.6-6.7 (5.7); at 90 km/h on the dual 3.9 -> 4.7.
   FIXED 11-10 (the "come up behind" part did not work: a car put back behind you, out of sight,
   went again the next step - at 90 km/h 0-1 came past in 90 s): every car of your way is dealt
   its driver as it joins (ai/trafficKinds.ts: cruising, a fifth quicker at 125-150 km/h), put back
   behind you when it is faster than you (and kept while it catches you up), ahead when slower;
   one pulling away out of sight past 400 m is put back where you will meet it; a quicker driver
   keeps its speed through lane changes. At ~74 km/h on the motorway 16 came past in 120 s. A
   single carriageway's traffic still queues behind you (it does not use the other lane).
   PASSED 11-11 (owner: "Ok pass"): the default, switch deleted.
   6b. SPEEDERS (owner 11-10: "can we make a small % of the traffic speed and get in the way ect",
   "They can jsut adopt the racing ai I guess"): BUILT 11-10 behind ?speeders=1 (ai/
   trafficSpeeder.ts): 1 in 15 of your way's cars, the racing AI at its wheel near a real car, held
   at 150-180 km/h, weaving and cutting in; out of sight carried with quick lane changes, either
   side, tailgating. Owner: "speeders can crash ... check they do dodge too" - on the motorway the
   ones seen passed clean; on the twisty two-way road the two seen both crashed (the road's own
   wrecks the same with or without them: 5 / 4 / 6 in 120 s).
   PASSED 11-11 (owner: "Ok pass"): the default, switch deleted.
   6c. BREAKDOWNS ("pull into hard shoulders if they have an issue ect haha"): BUILT 11-10 behind
   ?breakdowns=1 (ai/trafficBreak.ts): a nearside car now and then indicates, slows, pulls onto the
   hard shoulder (the verge where a reset would find room, on a road without one) and stops,
   hazards on; 1 in 25 put back ahead already stopped there; it waits for you. Motorway, 6.2 km:
   3 seen (2 pulling over, 1 stopped).
   PASSED 11-11 (owner: "Ok pass"): the default, switch deleted.
7. Still traffic goes after a while, and after a bad crash it waits ~10 s then is removed ("so it
   doesn't block roads"). Built behind ?trafficclear=1 (a still wreck gone even in view after
   10 s, any other still car after 15 s) - DROPPED 11-10 before the test (owner: "let's roll back
   the traffic clear rule I like it keep it how it was"): still traffic goes once out of view, as
   before.
ROUND 2, DEAF VALLEY:
8. Resets between lay-bys "seem to sometimes set on a road" - meant, or a fault? Find out.
9. More reset spots ("not many lay-bys and it's quite hard to make progress"): lay-bys more often,
   half on / half off the verge where there is little room.
   8-9 BUILT 11-10 behind ?vergereset=1 (highway/vergeback.ts): the cause - a reset went to the
   last lay-by behind however far, and with none left in the road's window to the shoulder's
   offset, inside the lane's edge (the "set on a road"); and back to the same lay-by each time
   (MEASURED, tools/scratch/_vergespots.mjs, a reset every 6 s: all 20 to the lay-by 87 m back).
   Now a lay-by within 40 m behind, else the verge where you are (the car clear off the road where
   there is no barrier, rock or drop, half on where there is not; 10 m further back each try, up
   to 150 m), else a lay-by within 150 m; Deaf Valley's lay-bys every 160-260 m (was 250-400).
   30 resets: 26 off the road, 3 half on, 1 in a lay-by; median 4 m back, most 41. Along the high
   road's gorge Armco there is no verge: a lay-by or the lane's edge there.
   PASSED 11-11 (owner: "Ok pass"): the default, switch deleted.
10. The junk: "not seeing much road side junk ... never seen a cow skull" (a skull is ~5 CSS px at
    speed: its size?); cactus in patches too, and more single ones spread out.
    BUILT 11-10 behind ?desertmore=1 (owner, on the way: "Junk levels should be controlled by the
    slider in test menu and should be consistent across levels", "Obviously split by asthetic
    still"): Deaf Valley had no share of the shared litter (highway/dress.ts skipped it) and its own
    junk fixed - MEASURED, tools/scratch/_junkcount.mjs, on screen a km: crates 0.2-0.8, drums
    0-0.6, tyres 1.4-1.5, shacks 0-0.4; the countryside's litter 84 a km. Now the shared litter
    there too, in the desert's kinds (highway/litter.ts desertLitter: a cone a skull / drum /
    crate, a bin a drum, a sandbag a crate, a tarp a pallet; no chevrons or cone tapers; none where
    the ground is not clear), and its own heaps, shacks, wrecks and skulls by the slider too: 88-90
    a km at LITTER 1, none at 0, ~205 at 3. Cactus patches (4-9 round a spot) and far singles.
    Skull size: owner "Skulls are fine as they are". Then (owner: "The slider should affect the
    amount of junk cactus / cow skulls and barrels", "Seems like you mixed up the two types of road
    litter ... Cow skulls cactus and barrels burnt out cars should only be for Death Valley ... tyres
    no wheel inside / And tarps barrels pallets tyres (with wheel as we have now) ect / To be country
    side litter"): every cactus by the slider too; the desert's litter skulls, oil drums and BARE
    tyres only (no pallets, tarps, boxes, crates); the countryside's as it was. Through the menu
    (tools/scratch/_littermenu.mjs): Deaf Valley OFF 0, 1.0x 164, 3.0x 399; the countryside 11 /
    102 / 198 (its litter worked; Deaf Valley's had no slider on the plain link).
    Owner 11-11 ("too many barrels not enough cactus on certain floor types", the rock's edge "has
    colour jutting thru the face - it should be one object"): the shared litter landed on the rock
    walls' bands (MEASURED, tools/scratch/_desertmix.mjs, 6 km: 52 - 19 drums, 22 tyres, 11 skulls);
    now none behind a face (0). Drums one pick in four (was one in two), the dunes the open
    desert's patches too, a barrel cactus at a canyon wall's foot: canyon cacti 59 -> 122 (junk
    85 -> 67), dunes 42 -> 86 (junk 68 -> 91), drums 228 -> 101 in all.
    Then (owner 11-11, a photo: "square colouring coming past rock face edge"): the rock look's
    pieces were 16 m rectangles along the ROAD; where a wall flares off at a canyon's end, or bends,
    one end stood out past the face. Now each lies along the face, set back to its deepest point
    over the piece, its length kept to the face (canyon.ts rockGround). MEASURED (tools/scratch/
    _rockoverhang.mjs, 5 km): corners past the face, off the rock, by > 0.5 m - twisty and motorway
    many, worst 5.0 m -> none; within 0.15 m for 95 % (was 3.0 m). The plain link (the look is the
    default).
    PASSED 11-11 (owner: "Ok pass"): the default, switch deleted.
ROUND 3, THE OTHER HIGHWAYS:
11. Petrol stations on the other highway levels, reset spots too. BUILT 11-11 behind ?hwstations=1
    (highway/stations.ts, laybys.ts, extras.ts): on the dual carriageway (our side) and the single
    lane (both sides, staggered) a lay-by now and then is a ROADSIDE STATION - 28 m deep on
    concrete, the shop, two pumps under the canopy in its brand's colours (world/stationbrands.ts:
    SHALL, SMELL, ESS-NO, GULP, TAXACO), its board before it - every 2-3 km; a reset past one goes
    to its forecourt's front. On the motorway, the interstate and the walled road a SERVICES every
    4-5 km (WELCOME BRAKE, ROADTHIEF, EXTORTION): the slip signs with its name, the side road past
    a station and the services hall (the wall round it). The guard counts a forecourt and a yard
    as road. MEASURED (tools/scratch/_stations.mjs): dual 5 stations in 8.9 km, single lane 3 in
    4 km, motorway services at 1.4 / 5.8 / 10.3 km, walled 1.4 / 6.4 / 10.9; nothing standing on a
    lot; photos driving and still (STILL=1).
    PASSED 11-11 (owner: "Ok pass"): the default, switch deleted.
12. Lamps on the central reservation. Owner 11-10: services with their own slip road on the
    motorways "yeah", the names "perfect" (SHALL, SMELL, ESS-NO, GULP, TAXACO; WELCOME BRAKE,
    ROADTHIEF, EXTORTION), the reservation's lamps "Instead" of the verge ones. BUILT 11-10 behind
    ?medianlamps=1 (highway/roadlamps.ts layReservationLamps, world/lamps.ts twin heads): on a road
    with a central reservation a twin-arm column every 68 m in its middle (on the barrier where
    there is one), an arm and head over each carriageway - each side a pool every 68 m as before,
    half the posts; the verges dark. Motorway: 27 lamps loaded, all twin; photos day and night.
    PASSED 11-11 (owner: "Ok pass"): the default, switch deleted.
12b. Deaf Valley's motorways (owner 11-11: "No lamppost of Death Valley motorways exits ?", then
    "it should be built similarly"): they had no lamps, slips, bridges or services (dress.ts dressed
    the theme on its own). BUILT 11-11 behind ?desertroads=1 (highway/dress.ts layDesertExtras,
    extras.ts isOpenGround): a road with a central reservation there gets the motorway's slips,
    bridges and services (with ?hwstations=1) only where the ground is open - desert or dunes from
    100 m before to 560 m after, never a canyon wall or a gorge; no rivers, no side roads; the exits
    named SADWATER, FURNACE CREAK, STOVEPIPE HELLS, ZABRISKIE POINTLESS, DEVIL'S GOLF CORSE, LAST
    CHANCE (REALLY), NOTHING FOR 200 MI, HULL (STILL NOT) (names to approve); the reservation's
    twin columns with ?medianlamps=1. MEASURED (tools/scratch/_desertroads.mjs, motorway 10 km):
    services at 3.1 / 7.9 km, an exit at 7.4, bridges 4.6 (rail), 6.8 (foot), 8.4 / 10.9 (road),
    170 lamps; nothing on a slip's tarmac, no lane in a rock (0). Photos day and night.
    The bridges in the desert's look (owner 11-11: "different looking bridges and train bridges ...
    to match the Death Valley asthetic"; chose the timber trestle, and "No footbridges there"):
    road bridges sun-bleached sand concrete, rusted railings, dusty pickups; rail bridges an old
    timber trestle (bents, ties, two rails) with a freight train, a locomotive and 6-9 wagons;
    footbridges and rivers road bridges instead (render/props/bridges.ts BRIDGE_LOOKS, look
    'desert'). Photographed: the trestle at 4.6 km, a road bridge at 6.8.
    Then (owner 11-11: on Deaf Valley roads "none at all" - bridges, stations): the twisty canyon
    road (the default) had none - only a road with a central reservation got them. Now every road
    there, as the countryside's have them (lamps still only in a reservation). MEASURED
    (_desertroads.mjs, 10 km): twisty 2 exits, 2 road bridges, 3 LAST GASP stations; the first
    stations come at ~2.8 km and the first bridge at 4.5-6.5 km (only on open ground).
    PASSED 11-11 (owner: "Ok pass"): the default, switch deleted.
12c. THE HIGHWAY'S BRIDGES AND TUNNELS WORK (owner 11-11: "Those bridges look trash make sure they
    work too like all bridges and tunnels should"; chose: exits lead up to them, real traffic over
    them, rail bridges drivable, road tunnels too), in rounds:
    R1 road bridges drivable - BUILT 11-11 behind ?drivebridges=1 (highway/bridgeways.ts, extras.ts,
       cuts.ts): the venue bridge (world/crossings.ts, render/props/venueprops.ts - ramps, deck,
       walls, its look; Deaf Valley's in sand concrete, CONCRETE pal 'desert'); its approach roads
       lined up with the deck's road; the crossings in slots kept as the road streams (a dropped
       bridge's slot goes to the next). A car on a deck counts as on a lane (no BACK TO THE ROAD)
       and not as going the wrong way; loose objects (litter, cones) meet only cars on the ground
       (cones/coneStep.ts - a car on a deck stopped on the verge's litter below it). The painted
       cars over road bridges are gone with it (R3 brings real ones). MEASURED (tools/crossingcheck
       .mjs highway [road] [scenery]): countryside motorway 2 bridges, Deaf Valley motorway and
       twisty, countryside twisty - on / off both ways, the walls hold, none on from the side, a
       car beneath stays on the ground: all OK; Brands' 3 still OK. In the game (_bridgeshot.mjs):
       up the ramp, over, off the far end at 108 km/h; photos day, both sizes, both sceneries.
       PASSED 11-11 (owner: "Ok pass"): the default, switch deleted.
    LIGHTS ON A DECK (owner 11-11, photos of a car on a bridge at night - its beam cut off at the
       deck's edge, no glow): the night layer put the dark back over every deck after EVERY car's
       light, the car on it too. Now the ground's cars' first, the dark over the decks, then the
       decks' cars' beams and glows (render/light.ts paintUnderDecks, isOnLevel). The plain game
       (a fix). Photographed (tools/scratch/_decknight.mjs, Brands, night 0.9): before the beam from
       the deck's edge and no tail glow; now from the lamps, the tail red; a car beneath still dark.
       PASSED 11-11 (owner: "Ok pass"): its test entry deleted.
    DEAF VALLEY'S BRIDGES TOO RARE (owner 11-11: "Didn't see a single bridge on Death Valley dual
       carriage way after 5km"): a bridge waited for the exits' 660 m of open ground and the
       countryside's 900 m bend radius. Now 60 m of open ground either side and a 500 m radius
       there (extras.ts BRIDGE_OPEN_M, DESERT_BRIDGE_RADIUS_M). MEASURED (tools/scratch/
       _hwextras.mjs, every road, 2 seeds, 10 km): Deaf Valley first bridge 4.6-9.3 km (twice none)
       -> 1.4-3.9, 0-4 -> 4-6 a road, the longest gap 3.9 km; the countryside unchanged (1.0-3.6,
       4-6); crossingcheck all OK, nothing on a slip.
       PASSED 11-11 (owner: "Ok pass", with 12b): the default, switch deleted.
    R2 JUNCTIONS - PASSED 11-11 (owner: "ok pass"): the default, switch deleted. Built (owner: "Roundabouts", "A few", past them EXIT
       TAKEN as now; highway/junctions.ts, ringgeo.ts, extras.ts buildJunction): about one road
       bridge in four (a roll owed to the next that fits) is a dumbbell junction - an off-slip 120 m
       before it up to a roundabout on its road past the left ramp (12 m of straight between them),
       an on-slip down 120 m after, a second roundabout past the far ramp; laid back over the road
       just dressed (the road ahead is not built), its ground cleared of lamps, props (by their
       size: a butte) and litter (game/sim.ts culls what was streamed). Not on the walled road
       (its wall is built). Off the motorway on a lane, or 16 m out, the wrong-way check rests.
       MEASURED (tools/scratch/_junctions.mjs, 12 km, every road): 0-3 a road (none on the walled),
       nothing on a slip or ring, no ring over the motorway; _junctiondrive.mjs (off-slip, round,
       over, round, back, on-slip) on 11 junctions over both sceneries and seeds: all 38 points, 0
       resets. Photos countryside and Deaf Valley.
    [UNDER TEST 11-11 from here to round 4: roadparity, bridgecars, railbridges, roadtunnels -
    the short entries in TODO.md UNDER TEST.]
    PARITY - BUILT 11-11 behind ?roadparity=1 (owner: "Walled levels should work the similar as
       possible to other highway levels", Deaf Valley "both types should work the same just have
       a asthetic difference"): the road dressed 80 points (320 m) behind its newest (highway.ts
       dressLag), so a junction is laid AHEAD where it falls due, before the walls, rock and lamps
       there; junctions on the walled road (the wall open at the slips); Deaf Valley's exits,
       services, bridges and junctions by the countryside's rules - only a gorge on their side keeps
       them off - the rock walls open where they pass (canyon.ts isWallOpen: gapL / gapR / sideOff).
       MEASURED (_hwextras.mjs, 10 km, 2 seeds): Deaf Valley exits 1-4 (countryside 1-3), services
       2-3 (3), bridges 5-6 (3-6); _junctions.mjs: junctions on every road incl. Deaf Valley's
       walled, nothing on them; _junctiondrive.mjs (a careful driver: 6 m/s on rings and ramps -
       faster, the desert's sand beside the bridge road slides you into a ramp wall): 11 of 11 all
       38 points, 0 resets. Switch off: identical to the plain game.
    R3 BRIDGE TRAFFIC - BUILT 11-11 behind ?bridgecars=1 (ai/trafficBridge.ts): two real traffic
       cars a road bridge, a loop up its left lane, over the deck, round a turning place in the
       country and back (round a junction's rings), the autopilot at the wheel through the
       traffic's physics (trafficPhys.ts drivePhysics), asleep past 300 m; in the traffic's live
       list (drawn, collided). MEASURED (tools/scratch/_bridgecars.mjs, 90 s by a bridge): 7 bridges
       (plain, junctions, Deaf Valley, walled, dual, twisty) - each car over the deck 3 times,
       17-47 km/h, never stuck, none rolled. Photographed one on the deck beside you.
    R4 RAIL BRIDGES - BUILT 11-11 behind ?railbridges=1 (world/trains.ts, worldclock.ts,
       crossings.ts railCrossing / meetTrain, highway/bridgeways.ts): a rail bridge a crossing along
       its track - its 7 m deck between walls, on ballast (crossinggeo.ts deckSurface), ramps up from
       its ballast approaches - not a road: the off-road guard's countdown runs on it (owner 11-11: "train
       tracks are not road ... the back to the road timer should still come up"); its train placed
       by the world's sim clock (advanced once a physics step, game/sim.ts), one function for the
       drawing and the physics; a car its cars overlap is put beside them and carried at 80 % of
       the train's speed (the speed change is the hit's damage). MEASURED (tools/scratch/
       _railbridge.mjs): over and off both ways, 0 wall hits; a car stopped on the deck met by a
       freight (Deaf Valley) kicked 17.6 m/s and carried 70 m, by a passenger train 25.6 m/s, 35-52
       m. The train's drawing the same with the switch off. Photographed a car on a rail ramp.
    R5 ROAD TUNNELS - BUILT 11-11 behind ?roadtunnels=1 (highway/extras.ts buildUnderpass,
       bridgeways.ts): a third of the plain road bridges a road under the motorway instead - a
       portal each side 3 m past the edge (the wall's on the walled road), facing, paired by `pair`:
       the venues' drivable tunnel (world/crossings.ts tunnelCrossing), its approaches as a
       bridge's. MEASURED (tools/crossingcheck.mjs, WANT=tunnel highway ...): countryside motorway
       and walled, Deaf Valley motorway and twisty - through both ways 0 wall hits, the walls hold,
       none in from the side, a car on the motorway over it stays on the ground: all OK. Photos:
       the portals either side, the car hidden under the motorway.
[UNDER TEST 11-11: police - the short entry in TODO.md UNDER TEST; the siren is a question there.]
ROUND 4, POLICE ON THE HIGHWAYS (a design to agree first): waiting in lay-bys and petrol stations,
    cruising as traffic either side; they chase you / try to crash into you after: speeding past a
    speed camera nearby (that raises the chance they come; otherwise random), crashing, flashing
    your lights, changing lane without indicating; speeding hard raises the chance; a big pile-up
    brings them. A police car too damaged goes, until the next random one ("to keep it chill").
    DESIGN AGREED 11-11 (owner): caught = boxed in and stopped for 3 s -> BUSTED, a fine as the
    speed camera's (none in Test Mode), then a reset; escape = out of sight ~10 s and they give
    up; a heat level of 1-3 small YELLOW STARS above the lights / indicator buttons, filled by the
    triggers, setting how many come and how hard they ram; no name on the cars, just blues and
    twos (blue roof lights, siren; a visual twin for the siren); the chase driver is the racing AI
    with the player as its target ("for now": may be made more aggressive later).
    MORE AGREED 11-11 (owner): EVERY highway road, both sceneries; 1 / 2 / 3 police cars at 1 / 2 /
    3 stars, ramming harder each star. Over 70 mph (113 km/h) raises the chance one spawns in the
    next 500 m - so does setting off a speed camera; a speed camera catching you is 1 star, and so
    is speeding within 30 m of a police car. After BUSTED (the fine paid, none in Test Mode): back on
    the road at the nearest safe spot ahead as a reset, the car mended, the heat cleared, the
    police gone. Wobbly Stadium's ROC heats / bracket: later, after police.
    BUILT 11-11 behind ?police=1 (ai/trafficPolice.ts, ai/policeHeat.ts, game/police.ts,
       render/lightbar.ts, hud/heat.ts): police cars ARE traffic cars (BMV 3 Serious / Volvoh V70
       Arr, white, a roof light bar - dark blue while cruising or waiting, flashing left / right
       while chasing, a blue glow at night); dealt now and then as cars are put back, either way,
       and every 400 m you drive a 35 % chance (70 % while due) of one of ours placed ahead out of
       sight - half of those waiting at the roadside (beside a station's canopy, in a lay-by, else
       the hard shoulder / verge) until you pass. HEAT 0-3 stars (tiny yellow stars over the
       LIGHTS row; a blue light flashing behind them while a chaser sees you = the siren's twin):
       a camera >= 1; over 70 mph within 30 m of a police car >= 1, over 100 mph >= 2; flashing
       the lights / an unsignalled lane change within 60 m of one >= 1 (not +1: in a chase every
       swerve would add up); a crash into a car there +1; a pile-up you were in (3 cars hurt in
       6 s) +1. Over 70 mph and a camera make police due for the next 500 m. Each star gained
       sends a chaser (one in sight joins, else one from 110-170 m behind, out of view) - the
       racing AI with you as its target (it does not dodge you; within 30 m, the way clear, it
       steers at its seat - behind, your left, your right - closing 3 / 6 / 10 m/s faster than you
       at 1 / 2 / 3 stars; a slow car it creeps up to and holds against); up to 170 / 200 /
       230 km/h. ESCAPE: no chaser within 200 m on your level for 10 s -> LOST THEM, they give up.
       BUSTED: a chaser within 1 m (box to box) while you are under 2 m/s for 3 s -> the BUSTED
       card (landscape centred under the buttons, portrait under the top-right column), a fine
       $500 / 1000 / 2000 shown "TEST MODE: NOT CHARGED", every police car gone, the heat cleared,
       a normal reset (doReset: mended, our hard shoulder / a lay-by - behind you, as the R key);
       the notice line cleared, and (with the switch) every reset clears the off-road guard's
       memory (highway.ts rehome: its time, warning, exit taken, last distance out, speed back
       in). MEASURED (tools/scratch/_policebust.mjs, a bust 12 m off the road): before, BACK TO
       THE ROAD 10 shown in 20 of 30 samples over the 3 s after the reset (a stale notice - the
       guard's own warning was already clear); after, 0 of 30.
       A police car too damaged (or rolled) for 2 s is gone. NO SIREN SOUND (pending the owner).
       MEASURED (tools/scratch/_police.mjs; scenarios on the countryside motorway, seed 4242):
       camera at 140 km/h -> 1 star, a chaser in sight at once, within 30 m 11.0 s later;
       past a police car at 130 km/h -> 1 star, at 175 km/h -> 2; unsignalled lane change beside
       one -> 1, signalled -> 0; lights on/off in 0.4 s by one -> 1, on then off 3 s later -> 0;
       1 / 2 / 3 stars -> 1 / 2 / 3 chasers, all within 40 m at 10.6 / 10.5 / 14.2 s, your damage
       after 30 s 0.01 / 0.04 / 0.68; stopped with 2 stars (95 km/h) BUSTED 4.2 s after, with 3
       (130 km/h) 5.8 s after, the police all gone; at 260 km/h up the hard shoulder LOST THEM
       10-17 s after the last sighting; a wrecked chaser gone 2.0 s later. In the real game (the
       autopilot, 4 runs) BUSTED in 3 within 45 s of stopping, the 4th just after. SURVEY (5 km at 95 km/h
       on every road, both sceneries, 2 seeds): 1-14 police cars met within 150 m a run (one every
       0.4-5 km; the most oncoming, cruising), ours waiting 0-4 a run (hard shoulder, lay-by /
       verge; never on a forecourt in these 100 km - stations are 2-3 km apart); at that legal
       speed stars came only from the driver's own unsignalled lane changes or crashes near one
       (8 runs of 20), every one lost again. Photographed (tools/scratch/
       _policeshots.mjs, 844x390 and 390x844, day and ?night=0.9): the bar unlit and chasing, the
       night glow, 1 and 3 stars, a chase, the BUSTED card. Switch off: _hwextras.mjs 10 identical
       to main, simhash SAME.
ROUND 5, LOADING AND SPEED: open - moved to TODO.md OPEN 3a.

## NEXT - ORDER AGREED 11-07 (owner: "ok let's do 1. first and proceed in this order")

[All passed or superseded. Open leftovers, in TODO.md: Brands' GP-loop kerbs, the studio name,
objcheck at Killder, the fuller Nordschlep / Le Manky, Fartmoor, the wooden-fence reservation;
questions: the black wire fence, Dongington's catch fence. The early ROLLS lines are answered
by the later ROLLS entry (passed 11-08); the NEXT VENUES all passed 11-09 (git 3195055,
a0e20b1); the Le Manky fences NEXT by THE WORLD CIRCUITS' FENCES (passed 11-10).]

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
   floodlights in tyre rings. ROUND 2 (was under test 11-07; passed - see NOTES/git) (world/venue.ts, venuegeo.ts, venueedge.ts,
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
   cannot get on from the side; a car on the track below stays on the ground). (Was under test; passed - see NOTES/git.)
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
   the thrown parts' pictures (~3 %). PASSED 11-08 (owner: "much better"; phone, 1 run): the
   impact's worst half second 49 fps (was 40-43), 5 frames over 25 ms (6-10), worst 44 ms
   (45-51). PASSED + DEFAULT 11-08 (owner: "crash bench approved pass seems to stay above 40fps
   or better and seems better / unaffected damage crash wise"): burstcap (a stack holds together
   while 400+ loose objects move), tyresleep (a tyre sliding flat stops at 0.25 m/s), stackvary
   (stacks 1-4 high by where they stand, a burst by chance - none under 2.5 m/s, sure from 9 -
   throwing its own tyres, its height as its shadow: render/stackshadow.ts); switches deleted.
   Crash bench load (objects moving, summed over the impact's first 2 s, 4 seeds) -11 / -31 /
   -15 %, all three -44 %. objcheck counts bursts over 40 tries (12 m/s 40/40, 6 m/s 19/40, 2 m/s
   0/40). Also: objcheck fails on main too (Killder: 6 of 1118 objects at rest move
   at load).
   ROLLS (owner 11-08, later): the rolling crash relook - check which way a car rolls from an
   impact ("sometimes it seems to roll the wrong way"), and whether a car can roll over things
   (tyres, fences).
   CI (owner 11-08: "30 mins is too long", OK to the plan): no checks job on a push to main (the
   branch's run covers the same commit), the screen checks only when screens change, no doubled
   verify (.github/workflows/checks.yml).
   PERFORMANCE CHECK 11-08 (CPU x4 lap, tools/framecheck.mjs): Brands work median 12.7 ms, p95
   24-29 (Thruston 13.2 / 23.0; Castle Kum 24.4 / 39.1 - the heaviest, older); crossings on: no
   measurable cost. Fixed: Brands was built at page load (7.3 s of level import here, now 0.85 s).
   CATCH FENCES (owner 11-08): tear from ~63 km/h square (was ~77) and SHRED (armcodent.ts) - PASSED
   11-08, with the crash parts' drive-over chance by ground clearance.
   TALL FENCES PASSED + DEFAULT 11-08 (owner: "chain link fences should be tall ... can't of
   objects passing over it"): no loose object hops a catch fence or a building, even one already
   hopping a low barrier (cones/coneWalls.ts TALL); Armco still hopped (tyrewallcheck: 0/80 over a
   catch fence, ~30 % over Armco).
   START CRASHES (owner 11-08: "cars crash on start too much ... wide close to the pit wall / dirt";
   "the fix should come from adjusting the racing line there" - a start-lane rule was tried and
   dropped): PASSED + DEFAULT 11-08 - the racing line leaves an edge with a barrier within 3.5 m of
   it (no run-off) 2.5 m more room (ai/line.ts wallLimits). tools/scratch/_startcrash.mjs (20 AI on
   the game's grid, 3 seeds): Castle Kum venue wall hits 23 -> 10, hard car hits 31 -> 8; old level
   31 -> 7, 38 -> 11. Alone: Slidden Hill 56.3 -> 49.1 s, Stock Car 26.7 -> 23.5 s, the rest within
   0.3 s. Checked 11-08: the cars a spread field puts off the road 100-150 m past Castle Kum's
   line are wheels over the INSIDE of a ~100-130 m bend (grass, no barrier; a lone AI laps it
   clean) - not crashes; left as it is (owner OK).
   ROLLS (owner 11-08: "sometimes it seems to roll the wrong way"; tools/scratch/_rollway.mjs): a
   hard side hit always rolled a car away from the impact - right when struck, wrong when it slid
   into the thing (into Armco: away 46 of 46). PASSED + DEFAULT 11-08 (owner: "cars seem to roll
   the right way now"): a car sliding more than 2 m/s into what it hit trips over toward it and
   carries half that speed on (damage.ts sideKick, roll.ts carryOver) - into Armco toward 45 of
   45; T-boned still away. PASSED + DEFAULT 11-08 (owner: "roll over" pass): a car rolling
   faster than 5 rad/s goes over Armco, the wire fence and loose objects up to 60 kg, never a catch
   fence, wall, pit wall or building (physics/tumble.ts).
   THE ROLLED CAR AS A BODY (owner 11-08 on the F1 + Micra test: "looks like a pass mostly",
   "make sure all cars are done and it's on main"): DEFAULT 11-08 for every car, the old box of
   faces deleted (render/cardamage.ts sideSprite / underSprite / rolledFaces). render/rollbody.ts:
   each column a cross-section in the real roof line (render/carprofile.ts), 12 pictures a turn
   in bands, the livery from the car's own top sprite on its sides, damage carried; a slight blur
   and whoosh arcs over the body fading with the spin; at most one body made a frame (11-24 ms on
   the laptop, tools/scratch/_rollbody.mjs). physics/rollshape.ts: spin kept by roundness, a dig
   by sharpness, the chance to rest on a side (F1 / F2 3 %, Huracan 10 %, 300 rolls: F1 10, F2 1,
   Huracan 15 on a side). An open car rolling sheds its wings and sidepods and may lose wheels
   (world/debris.ts openRollParts, physics/openwheel.ts rollRipWheels). For the owner's check
   on the phone: the colours, the whoosh, a hitch as a roll starts.
   CASTLE KUM (renamed from Castle Cum, owner 11-08) PASSED 11-08 with its round after the pass:
   the fence audit (catch fence only Folly - Quarry, 336 m; Armco on OSM's rails elsewhere), the
   control tower with its cab and mast and the red marshals' tower by the line, both to scale;
   Brands' Armco joins its catch fence without a flare (owner: "looks ok to me", "castle Kum is
   pass").
   OWNER RULE (11-07): never the black wire / rope fence ('fence' barrier) - the old levels still
   use it (Thruston): replace as each gets its venue pass.
   CASTLE KUM VENUE (levels/castle-cum-venue.ts, OSM data
   venues/castle-cum.ts; the venue helper): the 1999 layout, 1485 m (real 2977), the old lines at
   the Esses / Bobbies closed by tyres, no gravel traps (real: grass to tyre walls - spec.tyreWalls
   at Quarry + Tower), catch fences on the banks, no bridge or tunnel over the track (real), the
   skid pan kept (spec.pads). No wire fence. Owner 11-08: no footbridge where none is real; the
   edge "like the real track where possible" - Armco where the real rails are (spec.followRails,
   data.rails from OSM + spec.railsSeen from aerials), the old lines inside the edge. PASSED 11-08
   (owner: "castle cum pass"): the default, the old build, its switch and traced-map credit gone.
   Then (owner 11-08): the control tower (OSM's, 14 x 8 m) drawn as the tower prop with its cab
   and mast, the red marshals' tower by the line (spec.landmarks, to scale); the FENCE AUDIT ("caged
   in on straights"): a catch fence only where a source shows one (Folly - Avon Rise - Quarry, 336
   m), Armco on the real rails at the Esses and Dean Straight (bank fenced: false); a barrier end
   keeps 4 m off the pit lane; Brands' Armco no longer flares across a catch fence (one end).
   (Was under test; passed - see NOTES/git.)
   CREDITS PASSED 11-08 (menu/credits.ts, on the main menu): "made by G"; the owner wants a studio
   name (a parody pun) - to be picked. Add a line there with anything else the game takes.
2. NEW UK TRACKS at that scale (Snetterton, Donington Park, + Silverstone / Oulton Park) - names
   agreed first. ORDER (owner 11-08): Castle Kum's venue passes -> SNETTERTON next, as SNOTTERTON
   (owner 11-08) -> then back to converting the old levels (Thruston, Knobhill, ...).
   SNOTTERTON BUILT 11-08 behind ?snotterton=1 (levels/snotterton-venue.ts, OSM data in
   venues/snotterton.ts; the venue helper): the 300 / 200 / 100 one venue, 2389 / 1600 / 785 m (real
   4779 / 3219 / 1577), the 100 run anticlockwise by Firmans; spec.starts (the 100 by Tyrrells),
   spec.minR 11 (the real hairpins), a warp widening Firmans; one barrier on the midline between a
   road's close stretches; stands, banks, the bridge over Bentley Straight. PASSED + DEFAULT 11-08
   (owner: "snotterton looks like a straight pass"); left as built: the open grass edges (OSM maps no
   barriers there), the 100's start by Tyrrells, Brands without the new no-flare-back rule.
   THRUSTON VENUE BUILT 11-08 behind ?thrustonvenue=1 (levels/thruston-venue.ts, OSM data in
   venues/thruston.ts; the venue helper): 1892 m (real 3793, OSM 3771), the airfield inside (OSM
   runways, taxiways, apron as zones; the hangars), the tunnel under the start straight, the pits,
   the grandstands at Club, the viewing banks (the BARC visitor guide), the skid pan. PASSED +
   DEFAULT 11-10 (owner: "the 4 things waiting all approved"): the old thruston.ts and its
   traced-map credit gone.
   ROUND 2 (owner 11-08: "lost some features the original had", "aeroplanes and stuff around the
   edges"): six light aircraft on the grass aircraft stands (OSM parking positions; the old level's
   colours, a Cessna's 11 m span at 1/2), the race trucks on the Main Apron (the paddock), the
   hedgerow trees along the real hedges (the west side's, as the old woods).
   DIEATONA BUILT 11-08 behind ?dieatona=1 (levels/dieatona-venue.ts, OSM data in venues/dieatona.ts;
   the venue helper): the 2.5-mile tri-oval (2016 m) and the road course (2883 m) one venue, the real
   banking (31 / 18 / 3 deg, camber sections with a fixed side), the SAFER wall, Lake Lloyd (scenery
   water), the turn 1 and turn 4 tunnels, the frontstretch stands, rolling start, a mown skull in the
   tri-oval grass. PASSED + DEFAULT 11-10 (owner: "all approved"); the old Naffcar Speedway stays
   as the classic.
   (Owner 11-10 on the rallycross stages: "keep the originals they are great / no rebuild for
   them" - the rebuilt Knobhill rallycross below is gone, the old level stays; Knobhill Circuit
   stays behind ?knobhillvenue=1.)
   KNOBHILL VENUE BUILT 11-09 behind ?knobhillvenue=1 (levels/knobhill-venue.ts, OSM data in
   venues/knobhill.ts; the venue helper): the rallycross as the Knobhill level (686 m, OSM 1384 real:
   the real gravel through the infield from Leslie's to Hislop's, 40 % loose; the real joker round
   Taylor's hairpin, the lap cutting up the escape road) and the International circuit as
   Knobhill Circuit (988 m, real 2039). Venue system: a loose race piece's dirt sector, spec.joker.
   Knobhill Circuit PASSED + DEFAULT 11-10 (owner: "all approved"); the old knobhill.ts STAYS as
   the rallycross (owner 11-10: "keep the originals").
   SLIDDEN HILL VENUE (built 11-09 behind ?sliddenhillvenue=1) REVERTED 11-09 (owner: "Looks messed
   up revert to what we had before and leave the tracks as the are now"): the old slidden-hill.ts
   stays. NO MORE CONVERSIONS of the old levels (owner 11-09 on the ovals: "don't touch ovals
   then"; the rally stages too): the venue helper moves onto NEW tracks ("Move the helper onto new
   tracks") - Donington Park next from this list, as DONGINGTON PARK (owner 11-09: "Can we call it
   dongington"; id 'dongington').
   TEST MODE LAYOUTS PASSED + DEFAULT 11-09 (owner: "Menu layout pass"): a venue with more than one
   layout in a category is one card (Level.venue), then its layouts, then the setup; BACK from the
   setup returns to the layouts (menu/tracks.ts showLayoutList; tools/scratch/_layoutshot.mjs).
   The Test Track is listed under TEST GROUNDS (owner 11-09: "The test track should go with other
   test tracks"; category.ts menuCatOf - still lit and rained on as a circuit).
   DONGINGTON PARK BUILT 11-09 behind ?dongington=1 (levels/dongington-venue.ts, OSM data in
   venues/dongington.ts; the venue helper; the owner picked the name): the GP (2010 m, real 4020) and
   the National (1599 m, real 3149) one venue, venue: 'Dongington Park' (one card);
   Armco on OSM's rails, the four real tunnels, the Hollywood grandstand, the pit garages, the valley
   down Craner to the Old Hairpin (EU-DEM heights). PASSED + DEFAULT 11-09 (owner: "Donnington is
   pass"); left as built: the catch fence in front of the Hollywood grandstand (no source shows it;
   asked, no answer yet). NEXT: Silverstone (working name Sillystone, ?sillystone=1).
   SILLYSTONE BUILT 11-09 behind ?sillystone=1 (levels/sillystone-venue.ts, OSM data in
   venues/sillystone.ts; the venue helper; working name, one constant): the GP (Arena, 2946 m, real
   5891) and the National (1321 m, real 2639) one venue; both pit lanes (the Wing's, its entry cut
   inside Club laid as mapped: spec.pitCuts; the National pits'), the Wing as the garages, 32 stands,
   the bridges / footbridges / tunnels OSM maps, the Stowe circuit closed in the infield. The
   International not built (its links mapped as estimates). PASSED + DEFAULT 11-09 (owner:
   "Otherwise it's a pass" - everything on the round's link).
   OULTON PORK BUILT 11-09 behind ?oultonpork=1 (levels/oultonpork-venue.ts, OSM data in
   venues/oultonpork.ts; the venue helper): the International, the Island and the Fosters (as
   FROSTERS: Foster's is a lager brand) one venue. PASSED + DEFAULT 11-09 (owner: "Pass for oulton
   pork"). ITS REAL ARMCO (owner: "Yes do those all"): traced from aerial photos by the helper
   (levels/oultonpork-venue.ts OP_RAILS, Old Hall's outside a tyre wall at its real place), PASSED
   + DEFAULT 11-09.
   START CRASHES (owner 11-09: "a lot of crashes on silver stone"), PASSED + DEFAULT 11-09: the
   pit wall back to 5 m by a bend, the gantry's far leg behind the edge, catch fences set back to
   10 m, street lights only along the straight 6-12 m out (NOTES: nothing solid nearer the road
   than its run-off). The grid left as it is (the back of the grid's hits were the lamps: 47 -> 2
   in the first 5 s of 21 starts). LAP LENGTHS on the TEST MODE cards, PASSED + DEFAULT 11-09.
   NEXT VENUES (owner 11-09: "Yes do those all"; the helper, one at a time behind a switch):
   CADWALLOP PARK (Cadwell, built behind ?cadwallop=1), MALARKEY PARK (Mallory), ANGLESLEAZY
   (Anglesey), GOODWOODY (Goodwood), CROUGHED (Croft, the owner's name).
   WORLD CIRCUITS (owner 11-09, through the foreman: the F1 and GT seasons will use them; the
   helper, one at a time behind a switch): SPA-FRANKENCHUMPS (Spa-Francorchamps), then MONZARELLA
   (Monza). SPA-FRANKENCHUMPS BUILT 11-09 behind ?spa=1 (levels/spa-venue.ts, OSM data in
   venues/spa.ts; the venue helper): the GP circuit, 3484 m (real 7004, OSM 7002), the start under
   the gantry, the F1 pit lane (its exit loop inside La Source cut: it joins before La Source), the
   circuit's barriers (OSM walls and guard rails) followed, 19 gravel traps, 4 drivable tunnels
   (the start straight, Raidillon, Blanchimont, Paul Frere), the grandstands, paddocks and car
   parks, EU-DEM heights as 14 hills (Eau Rouge 392 m up to Malmedy 470, down to Paul Frere 365).
   PASSED + DEFAULT 11-09 (owner: Spa passed; the pit exit before La Source is fine; the names
   FRANKENCHUMPS and 'WORLD CIRCUIT · GP' kept). Left out: the support pit lane, the motorcycle
   chicane, the Ster and Malmedy tunnels. Then (owner 11-09: yes to a per-venue tree count): the
   Ardennes forest behind ?spaforest=1 - 8000 trees (spec.trees; the other venues keep 260). CPU x4 frame work in the
   forest (tools/scratch/_framecheckat.mjs, Kemmel / Pouhon / Blanchimont) 12.5-13.7 -> 16.7-17.6
   ms: every prop was tested twice a frame for the screen (render/props.ts). FIXED 11-10 (owner:
   "Ok"): render/propgrid.ts files the props by 32 m cell, a frame tests the cells round the
   screen - forest work median 16.9-17.0 -> 12.8-12.9 ms, p95 28.8-29.1 -> 22.5-22.9, the same
   as without the forest (13.0-13.7); identical pixels (renderhash, and _renderhashat.mjs at the
   three corners in the forest). PASSED + DEFAULT 11-10 (owner: "123 all pass").
   WORLD CIRCUITS (owner 11-09: "categorise stuff") PASSED + DEFAULT 11-10 (passed with the
   Nordschleife's link): a TEST MODE category for the world championship circuits
   (Spa-Frankenchumps, Monzarella, the Nordschlep) - the menu listing only (category.ts
   LISTED_UNDER), still circuits by kind (lamps, weather, the menu race).
   MONZARELLA PASSED + DEFAULT 11-10 (owner: "123 all pass"; built 11-09, levels/monza-venue.ts, OSM data in venues/monza.ts; the
   venue helper): the GP circuit, 2889 m (real 5793, OSM 5801), the start at the head of the grid,
   the pit lane, OSM's gravel traps (mapped as sand: tools/venues/monza.json "traps"), barriers
   both sides all round (the aerial photographs; OSM maps only the pit straight's rails), catch
   fences at its many grandstands, 2 drivable tunnels under the pit straight, 3 footbridges, the
   Junior link closed by tyres, EU-DEM heights as two hills (181 m at the Parabolica to 199 at the
   Lesmos). Left out: the old banked oval (its north banking crosses the circuit on a race-width
   bridge), the Pirelli ruins, the escape road and the motorcycle chicane at the first chicane, two
   tunnels whose far roads are not kept. With it (venuescenery.ts): one bridge a
   crossing - a footbridge's stairs mapped as bridges stood a second deck on Monza's, and at
   Sillystone two footbridges stood on the road bridge by the Wing (now the road bridge alone).
   NERDBURGRING NORDSCHLEP (the Nurburgring Nordschleife) PASSED + DEFAULT 11-10 (owner: "Mean pass
   but it's incredibly long haha 7min lap") as a SIMPLE first build (owner 11-09: the long tracks simple first, to try the frame rate and the feel;
   levels/nordschlep-venue.ts, OSM data in venues/nordschlep.ts; the venue helper): the lap, 10420 m
   (real 20832, OSM 20772), its barriers all round (OSM's guard rails, walls and fences), the woods
   at 260 trees, a grid at T13, EU-DEM heights as 70 hills (340-629 m); no pit lane, roads,
   buildings or stands (tools/venues/nordschlep.json leaveOut), no GP circuit yet. The Karussell's
   legs warped apart. MEASURED: build 2.1 s (node), the AI line 1.3 s on its first car (Spa 0.3),
   JS heap 66-69 MB with 10 AI (Spa 49-54), CPU x4 work p95 78-83 ms against Spa's 46 - the
   kerbs drawn lap-long on every tile (NOTES); a lap 476 s for the scripted driver. KERB AND PROP
   SPEED-UPS 11-10 (owner: "Ok" - identical pixels): render/kerbs.ts (each kerb's teeth found once,
   a kerb off the tile skipped: 1502 teeth a tile -> 21) and render/propgrid.ts; CPU x4 work at
   2000 / 5000 / 8000 m, alternated with main: p95 47.2-48.5 -> 28.1-29.5 ms, worst 74-107 ->
   49-73, the kerbs 14 % of the profile -> under 0.4. Renderhash SAME (Spa, the Nordschlep, Brands,
   the highway, a forest stage).
   LE MANKY BUILT 11-10 behind ?lemans=1 as a SIMPLE first build (owner 11-10: the long tracks
   simple first; levels/lemans-venue.ts, OSM data in venues/lemans.ts; the venue helper): the
   Circuit de la Sarthe's 24-hour lap, 6812 m (real 13626, OSM 13627) with the Mulsanne
   chicanes, mostly over closed public road (the D338, D140, D139: tools/venues/lemans.json
   "roadRace", new in osmvenue.mjs, opt-in), its barriers (the walls and fences OSM maps beside
   the track, followed), the woods at 260 trees, a grid on the start straight, EU-DEM heights as 25
   hills (44 m at the Virage du Karting to 83 m at the Dunlop bridge); no pit lane, roads,
   buildings or stands, no Bugatti circuit. Listed under WORLD CIRCUITS ('WORLD CIRCUIT · 24
   MINUTES', owner 11-10: "world circuit 24minutes lol"). MEASURED: build 0.9 s (node), the AI line 0.5 s on its first car, JS heap 59-62 MB
   with 10 AI, CPU x4 work median 11.5-11.8 ms, p95 24.2-29.6 (the Nordschlep 28.0-28.5, Spa
   23.3-23.4), a lap 252 s for the scripted driver. Open run-off (no OSM wall within reach) at
   the Dunlop curve, the Esses, Tertre Rouge's exit, before the first chicane, Mulsanne,
   Indianapolis's approach, the Porsche curves and Maison Blanche. PASSED + DEFAULT 11-10
   (owner: "Pass"). Next (owner 11-10): fences at the open run-off, "wooden fences or chain link
   fences and mix it up so it's not always Armco" - the world circuits have a lot of Armco.
   SNOOZUKA BUILT 11-10 (was behind ?suzuka=1) (the name confirmed by the owner 11-10;
   levels/suzuka-venue.ts, OSM data in venues/suzuka.ts; the venue helper): the Suzuka Circuit as a
   FULL venue, 2904 m (real 5807, OSM 5813) - the pit lane, OSM's gravel traps (mapped as sand),
   barriers both sides all round (a line 10 real m off each side from the aerial photographs, as
   Monzarella's, with OSM's walls and fences), grandstands and catch fences, the access tunnels,
   the woods at 260 trees, boards (DUNFLOP, PIRRELLY, GOOD YEAH, SNOOZUKA), SRTM heights as 20
   hills (EU-DEM is Europe only; credited). THE CROSSOVER: the Degner-to-hairpin leg in a cut
   and under the back straight, the race road's own underpass (NOTES: A ROAD THAT CROSSES
   ITSELF). MEASURED: build 3.5 s (node), the AI line 0.3-0.4 s on its first car, JS heap 52-57
   MB with 10 AI, CPU x4 work median 13.7-16.8 ms, p95 28.7-29.7 (Spa 13.6-15.5 / 22.7-26.5),
   three 20-car starts (seeds 7 / 8 / 9): barrier hits 0 / 0 / 0, hard car hits 1 / 5 / 5; a lap
   137 s for the scripted driver. PASSED + DEFAULT 11-10 (owner: "Snoozuka is a pass").
   THE WORLD CIRCUITS' FENCES 11-10 (was behind ?fences=1) (owner 11-10: "maybe use wooden fences or
   chain link fences and mix it up so it's not always Armco", "mostly Armco is ok if the track is
   like that irl just mix it up a bit"; world/venuefences.ts, VenueSpec.mixFences on Spa,
   Monzarella, the Nordschlep, Le Manky, Snoozuka): every rail a world circuit followed was built
   as Armco whatever the map calls it (real m, both sides: Spa walls 10.1 km, fences 2.9, guard
   rail 0.8; the Nordschleife guard rail 41.2, fences 11.7; Le Mans walls 23.8, fences 5.4) -> a
   mapped fence nearest the track a chain link fence where it stands (no trap or tyre wall
   there), the open run-off a wooden fence set back to 15 m past the edge; walls and guard rails
   stay Armco. MEASURED (tools/scratch/_fencemix.mjs): Spa Armco 93 -> 75 %, chain link 7 -> 25;
   Le Manky Armco 100 -> 87 %, chain link 2, wood 10, open run-off 9.5 -> 0.3 % of the sides; the
   Nordschlep 100 -> 99 % Armco (its fences stand behind the guard rail); Monzarella as before.
   Switch off: worldhash SAME, simhash SAME. barriercheck all OK. 20-car starts (seeds 7-9) at Le
   Manky and Spa the same either way (no barrier reached); Le Manky CPU x4 work median 12.6 ->
   12.3 ms, p95 27.1 -> 26.4. A fence gives where Armco holds: wood from ~20 km/h, chain link
   tears and drags (world/armcodent.ts). PASSED + DEFAULT 11-10 (owner: "As are fences").
   SHIPPED THUMBNAILS 11-10 (owner: "Yes"): the first TEST MODE tap after an update painted every
   track's thumbnail (a light build each) - MEASURED, tools/scratch/_menuload.mjs on the laptop: 37 s
   before the 11-10 venues, 49-64 s with them, Spa alone 6.5 s; CI's menucheck timed out on it. Now
   tools/thumbs.mjs paints them once into assets/thumbs (46, 1.6 MB), the menu reads them in the
   background (menu/thumbfiles.ts) and paints only a level without one; the per-version saved cache
   (thumbcache.ts, the bundle fingerprint) gone. After: the tap 0.8-1.0 s (CPU x4 5.1), the menu up
   2.5-5.7 s as before (3.0-5.1); menucheck passes both sizes; tools/thumbcheck.mjs in the suite.
   THE GROUND COVERS COMPACT 11-10 (owner: "Yass please"): a merged cover's cells as grid coordinates in
   typed arrays, its rim / ground lookups / filing as indices, each cover's cells the same (its unused
   rim gone) - MEASURED (tools/scratch/_coverheap.mjs, Yass Marina, forced GC): JS heap 47.8 -> 33.5 MB,
   156 249 cells either way; CPU x4 work the same (median 13.4 / 13.5 ms).
   TIDIER VENUES (the overlap fixes: tyre walls in two neat rows, nothing piled up) PASSED 11-10
   (owner: "Rider walls pass"; on the plain link since 11-09, its test list entry gone).
   YASS MARINA BUILT 11-10 (was behind ?yasmarina=1; the name approved 11-10; levels/yasmarina-venue.ts,
   OSM data in venues/yasmarina.ts; the venue helper): the Yas Marina Circuit's 2021 GP lap as a
   FULL venue, 2632 m (real 5281, OSM 5303) - the pit lane with its EXIT IN A TUNNEL under the
   first corner, drivable (the lane runs on round the corner's outside, down a cut, under the
   track and up inside it to rejoin; NOTES: A PIT LANE THAT RUNS ON), the W hotel's bridge over the
   track (a footbridge: its stair towers 14.5 m off the centre, no solid on the road), the marina's
   water, barriers both sides all round (a line 10 real m off each side from the aerial
   photographs, with OSM's walls: Armco 73 %, catch fence 27 %, wood 0, open run-off 5.3 % of the
   sides), grandstands with catch fences (the North Grandstand round the hairpin as its three
   parts), boards (PIRRELLY, FIRESTONED, GOOD YEAH, YASS MARINA), SRTM heights as 3 hills (a flat
   island; credited). OSM maps no gravel traps beside the lap (asphalt run-off). MEASURED: build
   3.7-4.0 s (node), the AI line 0.24-0.29 s on its first car, JS heap 67-71 MB with 10 AI (Spa
   55-59), CPU x4 work median 11.4-12.8 ms, p95 34.9-35.1 (Spa 14.5-23.5 / 26.9-42.7, its second
   round slow throughout), three 20-car starts (seeds 7 / 8 / 9): barrier hits 2 / 2 / 0 (at the
   first corner, 1-4 m/s), hard car hits 3 / 5 / 1; a lap 126 s for the scripted driver; the pit
   lane end to end at 30 km/h touching nothing (tools/scratch/_pitdrive.mjs). Left as the map has
   them (venueaudit notes): a road carried off at the map's reach ends 30 m short of the level's
   bounds (venueroads.ts carryOff takes the bounds before venueBounds adds its margin), a spur
   joined along its road, a footpath tunnel's road beside the pit exit, 8-9 m between the pit wall
   and the Armco where the pit roads leave the track. The marina's water costs heap and tile paints
   (NOTES: A BIG WATER IS HUNDREDS OF THOUSANDS OF CELLS) - the cover cells filed by place
   (owner 11-10: "Yes"; render/ground/covers.ts: work p95 32-34 -> 26-29 ms). PASSED + DEFAULT
   11-10 (owner: "all pass, except on the first corner, the tunnel and arm code seem to interact
   ... give them both a bit more space"): the pit tunnel's way in 4 m further out, its way out 2 m -
   the Armco 2.2 m off the way in (was 0.5 into it), 3.4 m off its road (0.3); the pit lane driven
   end to end at 30 km/h, crossingcheck / barriercheck / propcheck all OK.
   BATHWORST PASSED 11-11 (owner: "Ok pass"): the default, switch deleted.
   BATHWORST BUILT 11-10 behind ?bathurst=1 (the name approved 11-10; levels/bathurst-venue.ts, OSM
   data in venues/bathurst.ts; the venue helper): the Mount Panorama Circuit as a FULL venue, 3107
   m (real 6213, OSM 6204) - a public road raced ("roadRace", as Le Manky's): Pit Straight, Hell
   Corner, UP Mountain Straight, Griffins Bend, The Cutting, Reid Park, Sulman Park, McPhillamy
   Park, Skyline, DOWN the Esses, The Dipper, Forrest's Elbow, Conrod Straight, The Chase, Murray's
   Corner. SRTM heights as 40 hills (rms 1.4 m on the lap): 698 m on Pit Straight to 875 m over
   Skyline, 87.7 m in the game (the same slopes: The Cutting 12-17 %, the Esses' drop 20 %). The
   pit lane and pits inside Pit Straight (mapped as two service roads, traced again as the pit
   lane; laid as mapped round Hell Corner: pitCuts), the grid by the pit straight's footbridge,
   OSM's walls and fences followed with the walls hard by the road (runoffM 3; NOTES: A WALL AT THE
   REAL ROAD'S EDGE, A VENUE'S OWN RUN-OFF), OSM's sand as traps, its grandstands with catch
   fences, the footbridges over Pit Straight and Conrod, boards (DUNFLOP, PIRRELLY, BATHWORST, GOOD
   YEAH, FIRESTONED); listed under WORLD CIRCUITS ('WORLD CIRCUIT · MOUNTAIN'). MEASURED: the edge
   (tools/scratch/_fencemix.mjs) Armco 94 %, catch fence 5 %, wood 1 %, open run-off 2.1 % of the
   sides (OSM maps concrete walls nearly all round; mixFences keeps a wall Armco); the crests: the
   careful driver leaves the ground in 1 of the 19 cars (the drift S13, 0.08 s at 211 km/h on
   Mountain Straight; crestcheck); the sharpest crests Skyline 111 m and The Cutting 97 m (game
   radius: weightless at 119 / 111 km/h; the careful driver 61-75 / 63-87 km/h); build 2.3-3.2 s
   (node), the AI line 0.27-0.35 s on its first car, JS heap 52-55 MB with 10 AI (Spa 56-60), CPU
   x4 work median 12.5-15.4 ms, p95 25.8-32.2 (Spa 14.8-17.7 / 27.7-33.1); three 20-car starts
   (seeds 7 / 8 / 9): barrier hits 0 / 1 / 2, hard car hits 1 / 8 / 7; a 300 s 20-car race (~2
   laps): barrier hits 16, hard car hits 22, off the road 28 (Spa 8 / 17 / 32); a lap 137 s for the
   scripted driver. venueaudit notes: two roads ending a few m short of what they meet (a paddock's
   corner, the map's edge), a road beside another for 26 m, two crossings with no junction.
3. ROLLING LOOK - smoother than the dice flip on the same physics; mockup first.
4. SIDE DRAFTING (Naffcar first) PASSED + DEFAULT 11-08 (owner: "Pass"): physics/wake.ts part 5 - a nose
   alongside a car's rear quarter, up to +20 % drag on it and -6 % on the car alongside, gone by 1.2 m
   between the doors, by how much the car's flanks catch the air (Naffcar 1 .. F1 0.15);
   tools/scratch/_sidedraft.mjs. Next: the Naffcar extras (air brakes, aero upgrades, Dieatona).
   FIX 11-09 (owner: "woosh marks next to the car when I'm parked still"): a still car sat in the
   wake of cars driving off ahead (a 23 % tow, so the tow cue's streaks) and pulled at a passing
   car's tail; now the tow, the push and the side draft act only between cars at DRAFT_V (43 km/h)
   or more, and a car in the air or alone is reset to none (tools/scratch/_wakestill.mjs: parked
   0.771 -> 1.000; the moving tow 0.705 and side draft 1.129 / 0.961 unchanged).
5. ONCOMING TRAFFIC (owner 11-09: "give all levels an apposing road with oncoming traffic"),
   PASSED + DEFAULT 11-09 on the motorway, interstate, dual carriageway and walled roads: the other
   carriageway past a central barrier (highway/road.ts laneGeo, traffic TrafficCar.dir). NEXT
   (owner 11-09): the central reservation varied by road and at random - a JERSEY barrier that
   flips a car hit fast, Armco, chain link, a wooden fence; Deaf Valley's single carriageway both
   ways (owner: "they can crash when passing it's ok").
   MORE HIGHWAY FLAVOURS (owner 11-08: the current roadside is COUNTRYSIDE; then CANYON - "Death
   Valley", as DEAF VALLEY - and FARTMOOR, a super country lane with crossroads and traffic):
   DEAF VALLEY PASSED + DEFAULT 11-09 (owner: "Ok Death Valley pass maybe more cactus in the desert";
   the desert's cacti x1.5 again; the switch gone; the countryside's random biomes and the rolling
   car's fall / slope with it). NEXT: its traffic (owner: "traffic doesn't seem to work?" - off on
   the canyon road until it can come the other way: round 2). Was: round 1 behind ?canyon=1 (passed - see NOTES/git) (highway/canyon.ts: rock walls, cactus, open desert;
   round 2 oncoming traffic, round 3 crests and dips). 11-09 (owner): a THEME of Highway to Hull
   ("should come under highway levels and be a theme choice": presets.ts HW_THEMES); on gravel
   with sand / dirt patches ("leave colour of surfaces alone"); ROUND 1b (highway/desertplan.ts):
   CANYON 500 m (owner: "slightly less frequent / shorter sections"), the HIGH road 800 m - a ledge
   with a gorge one side or both made of TERRAIN (owner: "no high edges jsut a drop ... use terrain
   to make it genuinely slopped": highway/gorge.ts through level.roadside -> world/terrain.ts,
   the road lookup reaching 50 m; Armco on half the falling sides), windier (R 40-90 bends), then
   OPEN DESERT 900 m - straighter ("some straight road sections too": 65 % straight, 712 m the
   longest), a dry wash or a rise beside the road; rock formations (buttes, hoodoos, arches:
   world/formations.ts); cacti loose, snapping into spiny pulp with a high puncture chance.
   physics/steepground.ts: ground steeper than ~56 deg ahead is a wall (an impact), a landing
   after airtime faster than 13 m/s crashes (and may tumble); a rolling car falls to the ground
   and feels the slope (roll.ts rollFall / slopePull). tools/scratch/_gorgefall.mjs (40 / 70 /
   110 km/h over an open lip: all end in the gorge, damaged), _canyonshot, _gorgeprofile,
   _canyonroad. simhash SAME on every run (the rolling fall / slope behind ?canyon=1 too).
   ROUND 1c 11-09 (owner): the stretches in a RANDOM order and lengths from the road's seed
   ("endless roads should cycle randomly": desertplan.ts; the countryside's biomes too, dress.ts,
   ?canyon=1), DUNES ("sand dunes yeah": ridges with slip faces) and rolling ground ("more varied
   and random terrain"), patches parallel to the road and blended ("speckles and fade": streamed
   edge squares, world/load.ts), a landing no longer tumbles you ("shouldn't automatically make you
   roll"), twice the cacti, rusted-out cars, cattle skulls, road signs, the LAST GASP gas station
   (its apron tapering in and out off the road). The highway AI holds back grip by a falling edge
   (ai/roadLine.ts EDGE_GRIP: the autopilot had drifted into a gorge at 170 km/h; now 2.5 m worst
   off the centre line). simhash SAME. Tumbleweed: later (cost). Brands Indy's garage barrier on a lane
   (item 6): clear since the venue rebuild (barriercheck all OK 11-08).
   DEAF VALLEY'S JUNK 11-10 behind ?desertjunk=1 (owner 11-09: "Burned-out cars, Crates and oil
   drums, Tumbleweed, Old tyres and a shack"): heaps of crates and drums, old tyres, tin shacks,
   tumbleweed on the breeze. FIX 11-10 (owner: "Not seeing cow skulls or tumble weed", "I don't
   think it's their look I jsut didn't see them"): MEASURED, tools/scratch/_junkseen.mjs (2 min
   on each road, traffic): 0.8-1.6 skulls and 1.1-1.4 tumbleweed on screen a km, 1.4-2 s each,
   0-0.5 tumbleweed a km on the road in front of the car (woken 140 m off, most crossed behind it)
   -> three times the tumbleweed, nearer the road, each woken in time to be on the road 50 m
   ahead of the car that comes (its lead: m to the road's middle over the breeze across it), and
   a skull by the verge as often again: 4.6-5.0 skulls and 5.2-6.1 tumbleweed on screen a km,
   3.3-4.6 a km on the road ahead. 52 fps (51 before). A skull is ~5 CSS px wide at speed (the
   ground's speckles' size); the owner keeps its look. Owner 11-10: "Ok Death Valley is better"
   and "cow skulls should be collidable objects with a puncture risk": with the switch the skulls
   are loose objects (cones/coneConsts.ts DEBRIS skull, 8 kg), knocked and broken at the first
   hit into bone shards; a hit has a pallet's chance at a tyre (15 %: its horns), a second on the
   shards 5 % (pallet nails 3, cactus spines 15). MEASURED (tools/scratch/_skullhit.mjs, at 20
   m/s from 15 m, three runs of 30): of the cars that reached a skull all but one broke it (the
   rest never came within 2 m - the rough ground threw them), a tyre went on 6 of 47 broken (13 %);
   _desertjunk.mjs switch off: skulls 0.95 a km as before; worldhash (and the highway) SAME, simhash
   SAME. PASSED + DEFAULT 11-10 (owner: "they can straight pass no need for me to test"): the
   junk, the tumbleweed and the loose skulls always; the skull prop and its drawer gone.
   THE ROCK'S TERRAIN LOOK (owner 11-10: "Can we give everything the terrain look like the canyon ...
   the rock would benefit - although it should still be a wall"; mockup "pass"): the band behind
   each rock wall's face laid as ground in a red rock look (render/ground/art.ts redrock: stones,
   grain, faint strata streaks; highway/canyon.ts rockGround), its back blended into the desert as
   the patches are; the wall still the wall (its face's shadow, lip, soft strata; the flat fill
   gone). PASSED + DEFAULT 11-10.
6. SMALL: Brands Snatch Indy's garage barrier on a lane (barriercheck); the highway AI dodging (owner
   "let's leave it for now").
- WATCH: an AI F1 field spins more since the real aero passed (12 races: incidents 56 -> 92, spins
  14 -> 37 - the brakes, no ABS, locked by a full pedal: look at the AI's braking on a car without
  ABS when it comes up); once, the menu race on the highway sat still (cars at 0 km/h) - not
  reproduced in 3 more runs.

## OWNER 11-07 - ORDER AGREED (owner: "1. ok 2. ok 3 ok")

[All passed or superseded (the 3/4-size rework by the 1/2-size venues; the rolling look by the
rolled car as a body, 11-08). Open leftovers, in TODO.md: coloured springs, antennas / CB radio,
the Naffcar extras, multiplayer's left-behind rule, the highway AI's dodging (parked).]

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
  with a real counterpart (Thruston, Castle Kum, Brands Snatch GP + Indy, Knobhill, Slidden Hill,
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
   paths deleted; ?f1aero passed later - see below): CARS (mockup first): every car LOOKS LIKE ITS REAL COUNTERPART - rework any that do not
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
   line below". STAGE 1 (was under test 11-07; passed - see NOTES/git) (?carpaint): the paint shop as before + THIRD and RIMS
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
   STAGE 2 (was under test 11-07; passed - see NOTES/git) (?carlooks, with ?carpaint): the redraws in render/carlooks.ts - Golf
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
   OWNER "yes" + "make sure all cars get the same attention": (was under test; passed - see NOTES/git) ?carreal (carreal.ts) - every
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
  ROOF FLAPS (physics/roofflaps.ts: two plates up on the Naffcar's roof when it travels
  backwards fast, their drag) PASSED + DEFAULT 11-10 (owner: "the 4 things waiting all approved").

## Where we are (2026-11-04)

[All passed, or tried and not kept. Open leftovers, in TODO.md: the agreed garage, sound, story,
ideas and watches; the binned HUD text branch is a question there.]

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
  228 -> 210 / 268 -> 219; lamps knocked down (15 AI x 90 s, Thruston + Brands + Castle Kum) 6 -> 3.
  Off-track dodging: round a car in the way the AI may use 0.8 m past the edge, 2.5 m round a
  stopped / slow one (driverTraffic.ts WIDE / WIDE_SLOW). NEXT (owner "yes"): one line choice per
  corner clear of everything (oil, glass, cones, tyres, stopped cars, posts), wide / just off the
  edge if needed, the fastest clear one, by skill.
- DEFAULT 11-04 (owner: "test passed"): ailook (owner: "the different way approach sounds like a good idea") -
  on arriving at a corner a driver checks the line it chose through it for fresh oil / glass (its
  middle and wheels) and takes the nearest earlier / later apex (b +-0.3, +-0.6) that misses it;
  a weak driver may not see it (half the time at skill 0); once a corner, a few dozen map reads.
  MEASURED (_oilline.mjs, 9 runs): on the oil 46.3 -> 36.6 s (Thruston 14.3 -> 8.0, Castle Kum
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
  Thruston 11 -> 10, Brands 34 -> 8, Castle Kum 32 -> 20; the skilled driver 0 / 1 / 1. Fields (6
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
  Castle Kum's DUNFLOP footbridge; Brands Snatch's bridges (Hailwood Hill footbridge, two GP road
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

[All passed (K9: the numbers with K10, the colours with the 11-07 car paint; K13's realism dials
passed 11-02, core/fixes.ts). Open leftovers, in TODO.md: K16 driver names; ideas K14, K19, K20.]

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
  Castle Kum 0.46, Slidden 0.83, Thruston 1.39); line.ts smoothLine assumes even spacing and
  kinks the line there (R 0.6 m Killder): a lone AI brakes 11 -> 5 m/s at Killder's line,
  28.5 -> 24 at Castle Kum's (target 50 just past it). (2) CENTRELINE KINKS the 8 m-arc rMin
  check misses: Thruston 222 m (R 7 in a 46 m bend), Brands Indy 271 m; line kinks Castle Kum
  583, Knobhill 739, Test Track 679 / 724. (3) OBJECTS: none on any racing line; cones /
  tyre stacks 1.6-2.6 m off it (Test Track, Sandbox, Sweaty Lamb 558-591 m) count only for a
  car off its line. PLAN (asked): even resample (step = lap / round(lap / 1.5)) + a short-arc
  kink pass in traceTrack, behind a switch, then re-audit and a field run.
  DEFAULT 11-02 (owner: "evenlap pass"). BUILT ?evenlap=1 (world/subtrack.ts resampleEven + maskKinks: 3 m-arc R < 30 and < 0.6 x
  the 8 m R; read as core/fixes.ts loads - the circuits trace at import): audit 0 kinks / seams
  on all 8 traced circuits; a lone AI over the line Killder 6.1 -> 17.4 m/s, Castle Kum 24.3 ->
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

[All done. Tech debt left, in TODO.md: the two Surface types, JokerRule.estCost, carstats, the
thick mud edge lines (the joker hint was fixed by jokerhint, passed 11-03).]

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

[A-F done. G sound + settings, H upgrades, I multiplayer moved to TODO.md OPEN 3d; Q9's car
mud / dust and wet sheen are small items there.]

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
  track tyres 51 % of dry grip; Castle Kum soaked +15-22 % lap time; heavy rain flooded 98 % of
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
  Castle Kum): oil racetarmac mu 0.350 (dry 1.060); the car on it reads 'oil'; one oil cell in a
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
  MEASURED (_debris.mjs, Castle Kum): 12 hits from 50 km/h (mended between) knocked off 15 parts
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
  MEASURED 10-26 (tools/scratch/_c8measure.mjs, hatch into a Castle Kum street light / a tree):
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
  MEASURED 10-26 (tools/scratch/_c9measure.mjs, hatch into Castle Kum's longest armco run):
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
  MEASURED (_waterdrag.mjs, 20 one-cell puddles on Castle Kum tarmac, a wheel down each line a
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
  stopped. Real game (_engineshots.mjs, Castle Kum autopilot, fast leak): empty 40 s, 115 C
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
- MELTWATER (coverfield.ts, weather.ts setMeltSoak). CAUSE (_meltwater.mjs, Castle Kum, a
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

G. SOUND + SETTINGS: open - moved to TODO.md OPEN 3d.

H. UPGRADES + GARAGE + TYRE PRESSURE: open - moved to TODO.md OPEN 3d.

I. MULTIPLAYER: open - moved to TODO.md OPEN 3d.

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

[Each kept as one line in TODO.md IDEAS / PARKED; the full wording here.]

- Judder: the held frames are Safari's (NOTES); owner: "ignore judder, it's ok atm". Before
  itch: a screen recording from the home-screen app.
- itch.io: pushed 10-24 (build #2201136); push again only when the owner says. The PAGE PICTURES
  are ready but not uploaded (owner: another time): GamesStudio/ready-to-play/rac3r-page-2026-10-24
  (cover 630x500 + 8 shots); upload on the edit page (by hand, or via Claude in Chrome).
- The lean drawing plan (paused 10-17, default kept); fixed zoom steps (only for the lean path).
- The minimap may be simplified if ever needed (owner offered; no need measured).
- Outside TEST MODE the setup's SEASON slider gives way to the global season (with Story mode).

## STILL OPEN from the older lists (swept 2026-10-18)

[STORY MODE, UPGRADES + PROGRESSION and BRIEF.md's questions moved to TODO.md OPEN 3d.
DIEATONA built (passed 11-10). The DRIVING items done: the root fix (11-02), K13's dials (11-02:
a locked stop ~20 % longer than ABS, the Naffcar no time off the road). Tyre marks /
contamination are in TODO.md IDEAS.]

The lists written 09-27 .. 10-04 were checked against the code; what is done was deleted (git has
it): hold-R reverse, RESET breadcrumbs, the grass track's random layout every load, the cover
layers (snow / ice / water over any surface, melting, freezing), mud ruts and dips, tyre heat per
wheel and cooling, weather drying water, mark fade, the speed zoom, the garage (classes, paint +
number, the tyre brands SPUM / KUM / DUNFLOP / PIRRELLY), the bigger lab, audio, screen shake.

GAME (owner decides the order):
- STORY MODE, UPGRADES + PROGRESSION, BRIEF.md's questions: open - moved to TODO.md OPEN 3d.
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

[All fixed; barriercheck brands-snatch-indy clear since the venue rebuild (all OK 11-08).]

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
