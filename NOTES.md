# RAC3R - working notes

The standing notes for whoever works on RAC3R: the owner's rules, decisions, measured lessons and the
routine. Read after `CLAUDE.md` and before `TODO.md`. Keep every entry short and current: edit an entry
in place, replace it when it changes, delete it when it no longer holds. This is not a log: history is
in git, open work in `TODO.md`. Write a handover document only when the owner asks for one.

## Owner rules

- TRACKS AND STADIUMS (11-10): "save tracks and stadiums for the worker to build and you to approve -
  and then let me approve" - the venue helper builds them, the foreman reviews (photos, numbers,
  CI) and merges behind a switch, then the owner passes it.

- Discuss before anything non-trivial: find the root cause, propose the fix with a size (S / M / L, a
  total for a plan), wait for a yes. No chains of experiments without telling the owner.
- One step at a time, then pause for the owner's phone verdict. Give tap-able links.
- The plain test link is the approved game. Anything new goes behind a `?switch` for a phone test
  first, even when the owner asked for it. On the owner's OK it becomes the default the same day
  and the OLD PATH IS DELETED (no `=0` kept), its testlist entry is deleted and the verdict noted
  in `TODO.md`.
- ONE SYSTEM FOR EVERYTHING (owner, 10-18: "we don't need old systems and new systems getting
  crossed up"): never two ways of doing one job (the car pictures' own daytime beam met the night
  layer at dusk). Before building, check nothing already does it; extend that instead.
- Links to the owner: the plain link plus only the switch under test, `&report=1` for a measured run.
  For a judder question ask for two runs back to back, with and without the switch, same level.
- When the owner reports something that looks wrong, fix it; do not spend effort proving whose fault
  it was. If asked to "fix it or undo it" and the cause is not found, undo.
- Bring mockups before building new UI or a new look (the car mockup: `tools/scratch/carmock.html`).
- Sounds: ask the owner about each sound before building it, then a test to approve (10-24).
- Test links may bundle several small changes (quicker for the owner); a big or important one
  (the AI rework) keeps its own switch (10-24).
- The owner tests in DuckDuckGo too (phone and laptop): ask before closing it on the laptop.
- Slave FM is the owner's own project on the laptop: read it if needed, NEVER change it.
- WEATHER ONLY (10-24): no level- or stage-drawn snow, ice or puddles - the weather lays them.
  SCENERY WATER (lakes, rivers, fords, the highway's rivers and canals) never evaporates but can
  freeze. The test levels' surface samples (Lab, Test Track pads, Sandbox, Lab extension, the
  Castle Kum skid pan) stay. A level with no setting for what lies under its snow: make a
  logical call (snow stages: the road from the stage's seed).
- HANDBRAKE HEAT (10-24): the handbrake heats the REAR tyres; the fronts heat only by the
  turning they do (never by the handbrake itself).
- Every car / track / stage / brand / generated name is a parody pun. A car is named after its REAL
  counterpart, close to the real thing but different (owner 11-03): BMV 3 Serious (BMW 3 Series),
  Subaroo WRZ, Lamburghini Hurrikan, Folksvagon Gulf GTEye. Every car is based on a real car
  (its ROSTER row in cars.ts: its weight, engine, gears, tyres and drag; realcars.ts the helpers).
- ONE PARODY PER REAL NAME (owner 11-03: "make sure all our naming conventions are consistent ...
  dont go generating similar different ones if we already have that name parody"). Check this
  register before naming anything; reuse the entry; add every new one here.
  BRANDS: Dunlop = DUNFLOP (the Castle Kum footbridge said DUMLOP: ?namefix), Avon = AVAN, Kumho = KUM,
  Pirelli = PIRRELLY, SPUM (budget tyres / oil), CREEM OIL, Goodyear = GOOD YEAH (owner 11-03), Mickey Thompson =
  MICKY TOMSON, BFGoodrich = BF GOODWRENCH, Firestone = FIRESTONED.
  CARS: VW = Folksvagon, BMW = BMV, Subaru = Subaroo, Volvo = Volvoh, Chevrolet = Chevvy, Audi =
  Ordi, JCB = JCBee, Mini = Minnie, Lamborghini = Lamburghini, Nissan = Nissun, Peugeot =
  Pugeot, Ford = Fjord, NASCAR = Naffcar, Formula One / Two = Formula Won / Too, BriSCA = BriSKA.
  TRACKS: Thruxton = Thruston, Castle Combe = Castle Kum (renamed from Castle Cum, owner 11-08),
  Brands Hatch = Brands Snatch,
  Knockhill = Knobhill, Lydden Hill = Slidden Hill, Kielder = Killder, Daytona = Dieatona,
  Snetterton = Snotterton (owner 11-08), Donington Park = Dongington Park, Silverstone =
  Sillystone, Oulton Park = Oulton Pork (its Foster's layout = Frosters), Cadwell Park = Cadwallop
  Park, Mallory Park = Malarkey Park, Anglesey = Anglesleazy, Goodwood = Goodwoody, Croft =
  Croughed (owner 11-09), Spa-Francorchamps = Spa-Frankenchumps (owner's brief 11-09), Le Mans =
  Le Manky (its Mulsanne straight, the Hunaudieres, = the Mulsanity; owner's brief 11-09), Suzuka =
  Snoozuka (the brief 11-09, confirmed by the owner 11-10), Yas Marina = Yass Marina (the brief
  11-10, the name approved), Bathurst = Bathworst (approved 11-10), Monaco = Moanaco (TODO.md
  CHAMPIONSHIPS 11-09; built behind ?moanacovenue=1 11-11, to pass). Approved 11-10: the Race of
  Champions head-to-head event = HEAD-TO-HEADBUTT; its stadiums Wembley = Wobbly Stadium, Stade de
  France = Stade de Prance, the Bird's Nest = The Bird's Mess, Accor Stadium = Accordion Stadium,
  Esprit Arena = Dusseldork Arena; the old Wembley (the Empire Stadium, its stock car oval) = Old
  Wobbly; X Games = X Gayms (the owner's), L.A. Live = L.A. Lively.
- No keys, tokens, tunnel URLs or process IDs in the repo. No itch.io push until the owner says so.
- The foreman may push to `main` once the change is proven (routine below).
- Keep the test server and the tunnel running.
- Check what tools and earlier work exist before building a new tool (`ls tools`, `git log --grep`,
  `TODO.md`, these notes); build a new one only for what is missing.
- Handovers only when the owner asks. Notes go here.
- Bigeon ideas and fixes go in the owner's idea file on the worker PC (SSH; see the owner's README).
- PERMISSION FIRST (owner 11-04: "always get permission first"): propose anything new and wait for
  the yes; a direct fix request or a default flip on a pass is fine. Stuck -> ask, nothing drastic.
- ONE AI, THE SAME EVERYWHERE (owner 11-04: "all ai behaves the same ... where possible"): one
  driver, one law, one set of numbers on circuits, stages and the highway; differences only from
  what it follows and each driver's traits.
- KEEP IT SIMPLE (owner 11-04: "just gotta keep it as simple as we can while avoiding behavioural
  issues"): an extra that does not measure better comes out. "It's ok for some crashes."
- AI RACECRAFT (owner 11-04): dodge and overtake first, brake when it must ("it should ideally
  avoid it not just brake ... although it should brake too if it needs to"); no queueing, no hard
  shoulder; half a car ahead owns the line; a car on the track has priority over one rejoining.

## Decisions (owner)

- CHAMPIONSHIPS (11-09, owner): F1, GT, BTCC (not DTM: the UK venues), WRC stages, Dakar, SST
  (Stadium Super Trucks) and rallycross; a decent set of tracks for each, not too many - tracks
  shared between championships where they can be (TODO.md CHAMPIONSHIPS). Cars after the tracks.
- ONE-SYSTEM CLEAN-UP (10-19, owner): every approved feature below is the only way the game does
  that job - the old paths and their `=0` switches are deleted (TODO.md lists the groups). What
  remain are test tools (`?night=`, `?rain=`, `?report=1`, `?skip=`, `?dpr=`, `?autopilot=`).
  The CPU ground was deleted too (10-19, owner: "do it and let me test"): WebGL2 is the ground.
- Ground drawn by the GPU (floor, zones, hill shading; fixed-density tiles for the rest), zoom hold
  with smooth moves, frame pacing, minimap (highway too), grippier grass, the Lab split: approved and
  default (10-15 / 10-16).
- Cars: look B, turned and scaled at screen resolution on the 2D screen canvas (`drawSharpCarLayers`),
  not strict pixel art; default since 10-16. Skid marks drawn on the screen
  canvas too (no quiver), and the joker lane on the minimap + RESET back onto it: default since 10-17. Ground tiles at their exact place on the GPU ground, so
  track edges hold still while zooming: default since 10-17. The pause menu's
  HUD list (each display piece on / off; controls never; tyre / damage OFF stays off when damaged):
  default since 10-17. Loading: the game as one bundled file from
  the test server and the menu thumbnails saved per version: default since 10-17 (`?bundle=0`); the tools (automation) always load the separate modules. The menu: no fly-in behind it, thumbnails
  painted while loading, long-grass blades stroked once (one palette shade off on ~0.2 % of
  long-grass pixels, owner accepted): default since 10-17. The long-grass textures
  painted while loading (the menu's ~125 ms frame): default since 10-17. Screen
  sharpness capped at 1.5 device px per CSS px (was 2): default since 10-17 (`?dpr=2` = old). The
  race start without the fly-in hand-over jolt: default since 10-17. Ground tile
  mipmaps built with the upload (no burst at a zoom-out): default since 10-18. All mud and
  thick mud freeze by the cover field's frost, driven or not: default since 10-18.
  Sand dents most easily (dry too, 45 cm floor), dry mud / thick mud dent at half the wet rate,
  a churned gravel puddle leaves dirt: default since 10-18. Gravel dents like
  sand but slower, both faster wet; frosty dry winters and ice melting at half
  snow's rate: default since 10-18. One cold-surface order (water over snow
  over ice; snow never on water; driven ice breaks to water), dry dirt -> mud
  1 in 4 and damp sand / gravel wear, tyre marks fading block by block, the track temp gauge
  and km/h-mph / C-F rows: default 10-18.
  Tyre-made covers drawn as the field's, tyres cooling toward a track / air mix with
  hot tyres clearing water / ice faster, water / ice / packed snow told apart: default 10-18.
  Pre-turned pixel art (RotSprite)
  was the alternative, not chosen.
- The A fixes (10-24, owner "all pass"): the sky's twilight colour only in its share of the dark
  and rain / snow easing in two stages; car light kept off bridge decks; every car held in its
  grid slot through a circuit's rolling start (ai/formation.ts); weather-only snow and ice
  (snow stages' road from their seed); damp ground a small grip loss with fewer, smaller
  puddles; locked wheels heating their tyres; dry gravel turning to sand when hot.
- Also 10-24 (owner: pass): PULLING AWAY only when you really lead; traffic eases onto its lane
  after a driven -> carried handover; punctures by what you hit (physics/punctures.ts table);
  short grass a pale striped lawn told apart from grass, grass with fine blades; the highway's
  street lights (one every 34 m, alternating sides, streamed with the road); a woken traffic car
  seated on the ground; the Sandbox keeps its sample puddles; melting snow / ice leaves its water
  (up to heavy rain's, the track damp while it melts); driven ice cracks (more grip, wears
  through faster, cracks spread a few metres). 10-25: reversing lights on every car (white
  lamps at the tail in reverse; at night a glow and a short dim beam; owner: "slightly bright"
  -> beam 0.25, glow 0.7 of a brake light's).
- Event lighting (10-25, owner "all pass", picks in TODO F): backlit boards (faint halo), marshal
  beacons, multi-coloured festoons on stands and rally fairy lights (following the road edge),
  the start gantry's light bar and start lights, pit lamps, caravan light spill (no windows:
  top-down), floodlights in tyre rings at the tightest corners, village street lights on
  generated stages; a knocked lamp settles - steady, or dies by how much light it lost.
- Also 10-25 (owner: pass): car lamps flicker after a hit, then work again or die by damage;
  wooden marshal huts that a hard hit smashes (pallets thrown, beacon out); hot brakes glow at
  night after several hard stops (handbrake: the rears), cold again on RESTART / RESET as the
  tyres; trees with a trunk-only solid, canopies over the cars and dark at night, leafy trees by
  the season and firs, snow from the weather. Bushes (10-25, owner: pass): square pixel clumps in
  their own greens that you drive through - heavy drag, a light dent, a puncture chance, leaves
  poking up over the cars - flattened to long grass; on rally stages, circuits, rallycross and
  the test levels.
- TypeScript conversion ON HOLD (owner 10-25): keep building in TypeScript, convert old .js later.
  A .js file a feature rewrites becomes .ts first, in its own commit proved SAME (damage.ts, 10-25);
  a .js file a feature only touches gets a one-line call into new .ts code.
- Car systems C (owner 10-25): integrate with the old systems and finish with ONE coherent system
  (punctures, grip, pull, drag, sparks, marks, water, smoke all extended, never duplicated).
  Answers: a burst goes flat in ~0.5 s, debris / nails / bush leak over 10-30 s; ~1 km flat to
  the rim; an overheated engine SEIZES (RESET mends); every car has both speedo lights; tyres
  squash progressively with pressure (mockup approved). A rim or a rolled body on hard ground
  may break it a grade (race tarmac -> tarmac -> broken).
- Binned 10-25 (owner: "park em : bin em"): the HUD text fix (no clear gain measured) and the
  GPU ground phase C (no phone gain). The 10-04 car feedback is out of date. Real ABS is wanted:
  the driving root fix (wheel spin as real state) is queued, plan first.
- Car systems C round 1 (10-25, owner: pass): punctures are leaks (a burst flat in ~0.5 s, debris /
  nails / bush over 10-30 s), tyres squash progressively by pressure, a flat reaches the rim by a
  rising chance (half by ~1 km), a rim or a rolled body on hard ground sparks and may break it a
  grade (race tarmac -> tarmac -> broken); no written PUNCTURE notice. Stingers (tyre spikes) on
  the Lab and Test Track. Highway hedges: one continuous line of bushes round every farm field.
  Also 10-25 (owner: all pass): sparks as pixel art on the screen canvas under the cars, glowing
  at night (no glow patch), while sliding AND crash rolling, behind the way the car moves, hard
  ground only; crash sparks from metal impacts at 25 mph+ (70 %, sprayed the way the car went
  in); brake glow orange -> red the hotter, outside the wheel, none while rolled; a lost wheel's
  tyre reads 0 C; wet trails per wheel; the Lab's flip ramp (an armco end) for testing rolls.
- Car systems C round 2 (10-25, owner: pass): engine heat - a thermostat holds ~88-90 C with a
  sound radiator on any day; a front hit cracks the radiator, power fades 115 -> 130 C, ~10 s at
  130 C (or no oil) SEIZES it (RESET mends; an AI resets); the speedo's thermometer and oil can;
  exhaust by throttle and cold, backfires, steam and engine smoke over the car. THE LEAK IS WATER
  (owner: "the same liquid" as the rain, behaving the same, more the worse the leak): it lands as
  the tyres' water in the wear cells, never a second water look.
- Oil, car systems C6 (10-25, owner: all pass): it ACTS LIKE WATER - one cover in the wear
  cells, whole cells, a third of the grip, black with a dark purple sheen and edges (pixel art),
  soaked up by loose ground, never dries; driven through it spreads a little the way the wheel
  went, water spreads it 50:50 a second; no oily tyres or oily marks (owner).
- Debris, car systems C7 (10-26, owner: all pass): a corner's hit of ~0.3 knocks off a bumper
  (one an end), wing or door panel in the car's paint; they stay, the oldest fading past 24;
  the car's own look keeps its dents (may revisit). Glass from cars with windows lies in the
  wear cells, glints with the view, swept by the first tyre (a puncture chance; 15 % of those
  a sudden pop). Oil that would spread spreads 75 %, wears away 25 % (10-26, owner: pass).
- Post hits, car systems C8 (10-26, owner: "=1 seems best"): a street light's post or a tree's
  trunk (not the floodlight pylons: a wide base) damages by the CLOSING speed, snap or bounce,
  in the spot it struck (physics/posthit.ts). Off centre 30 / 50 / 80 km/h = 0.21 / 0.54 / 1.00
  on that corner; lighter than a wall below ~70 km/h - picked over "never lighter than a wall"
  (=hard: 0.58 / 1.00 / 1.00). A post square on the nose cracks the radiator x1.5. No V dent.
- Armco dents, car systems C9 (10-26, owner: pass): a hit into an armco rail bows it back where it
  struck (world/armcodent.ts: up to 0.8 m, deeper per hit), a very hard one (~115 km/h square at
  the rail) tears a 4 m gap the car goes through; a bit softer than a wall (bounce 0.2, 0.9 of
  the damage). RESTART straightens them. The arena's edge fence is not armco here (left out).
  Paint scuffs / bent posts not done (owner: only if easy and worthwhile).
- Water dragged by the tyres (10-26, owner: pass): standing water driven through spreads as oil
  does - 25 % a pass, then 50:50 on into the next cell or used up (world/waterdrag.ts).
- Open wheels, car systems C10 (10-26, owner: pass): the F1 / F2's exposed wheels are boxes of
  their own (physics/openwheel.ts) - they hit cars, walls, armco, posts, trees and cones; wheel
  on wheel is a hard kick; a hit into a wheel rips it off by chance from 40 km/h (every time at
  80). Car systems C (C1-C10) is finished.
- Outer tyre walls (Grass Track, Stock Car): a fast car pushing through them is fine (owner
  10-25); they stay single rows of loose tyres.
- Order 10-25 (owner): bushes -> car systems C (when bushes pass) -> the wearcheck rewrite (when
  C passes).
- Not wanted / undone: the highway rebuild (cancelled 10-15), a fade at zoom steps, tiles tracing
  only their part of the ribbon (`?ribboncull`, undone 10-16), the WebGL cars (`?gpucars`, removed
  10-16), the menu recording (parked until after the graphics work).
- Order (10-17 night): the lean drawing plan is paused and today's default kept (the holds are
  Safari's, see Measured lessons). Off-screen AI at half rate: saved.
- Weather (10-18): approved and the default: the season / weather setup rows,
  changing weather, wet grip per surface, the wet look, puddles and snow from the weather (scenery
  water permanent), the cold freezing water; sliding wheels wear the ground twice.
  Tyre wear the default too (10-18, test open; RESTART = the set at the event's
  start, RESET keeps the race).
- Weather and tyres (10-18, owner "yes all"): approved - tyrefeel (tyres warm
  sooner and hold heat in their window, slides / spins / donuts wear 2-3x, hot slides more; cold
  slides no extra), ?morepuddles (more puddles than snow, half on the road, the racing line
  refills in the rain; snow unchanged), onepuddle (one puddle look: water tinted by its ground),
  packedwear (packed snow breaks into snow or ice 50:50), wettrail (wet tyre lines fade within
  10-50 m). Later (owner): T3 - tyres cool toward the air temperature, hot tyres clear water / ice
  faster.
- Cover field + winter logic (10-18, owner "all pass"): approved. Rain and snow build in small patches until they coat
  the track, heat dries / melts them
  back, all by weather and temperature, on every level (highway too); every level follows its
  weather (a snow stage may be played hot and melt; a desert snowed on). The level's own snow,
  ice, water and packed snow are field areas (start full, melt / dry); under them: the surface's
  own under, a road's tarmac, open snow ground's grass (owner: "depends on the track"; varied
  levels later). A normal track's settled start snow is about a quarter of the first try. The
  field is THE water / snow / ice system (the puddle sites, ?morepuddles, ?labweather and
  ?coverfield=0 deleted 10-18); scenery water stays permanent (freezes in the cold). Snow is drawn
  with opacity by depth (owner: keep).
- Weather (10-17): a season slider sets the chances of rain / snow / dry / hot / super hot, the
  temperature and the track condition; it can change mid-race; it must add no lag. One water
  system: the existing wet / puddle cover, extended, never a second one.
- Lighting (10-18): before the performance pass (that only if the owner complains); cost test
  first, then features one at a time. Light fixtures are solid; street lights knockable (nudge =
  wonk + flicker, hard hit = out by degrees, fallen = debris, mangled per hit); pools below a
  lamp; lamps and AI / traffic headlights follow the light level; the player's LIGHTS stay
  manual and do not switch anyone else's (10-18). The night
  layer cost nothing measurable on the phone (L1 passed). Full list in `TODO.md` LIGHTING.
- Time of day (10-18): ONE global game clock that holds for the story (runs while playing,
  saved); 1 game day = 1 real hour; a season = 7 game days; UK-like days with moon phases;
  a start-hour slider in TEST MODE only; the race behind the menu follows the global time and
  season. Lamps (every level, knock-downs) and the clock: approved 10-18 (owner "all pass").
  Light comes from where the lamp's body is (owner). THE NIGHT LAYER IS THE ONLY LIGHT (10-18):
  headlight beams (no picture beam by day: owner "onelight pass"), lamp pools with their warm
  tint (the pylon prop's own pool folded in: owner "it should all be on the new glow style"),
  the cars' lamp glows (a tint in the light map; owner: close is fine "so long as it's clear").
  The pause menu's gold alarm clock beside MUTE (the game time; glows after dark): 10-18.
  Their switches are deleted (the one-system clean-up).
- Code (owner, 10-18): new modules are TypeScript (.ts); the remaining .js files are older.
- Mud (10-24, owner "all pass"): mud thickens only with water; a level's own mud and the
  highway's ploughed fields (random blocks) dry in the heat; worn dirt goes to mud less and to
  gravel more the hotter and drier (one rule by temperature, not the weather kind).
- itch.io: pushed 10-24 on the owner's say-so (recipe in docs/foreman-handover.md; page photos:
  tools/scratch/_itchshots.mjs + _itchcover.mjs, uploaded by hand on the edit page); push again
  only when the owner says.
- CIRCUITS ARE VENUES (11-07, owner): every level with a real counterpart at 1/2 of its real
  length (owner: "1/2 size ... about the right time for a lap"; 3/4 was tried: too big) with the
  13 m road, built like the real place - its roads, boundary, grandstands, pits,
  paddocks - from OpenStreetMap, cross-checked with other sources ("use the internet and check
  multiple places"). One venue per circuit: a layout is the list of road pieces it races, every
  layout shares the venue's scenery. Brands first, then each track the same way. Credit what is
  used (menu/credits.ts): OSM (ODbL) and traced Wikimedia maps (CC BY-SA) require it. A venue is
  SEALED as a real circuit is (owner: "the only way on n off circuits should be pits / access
  lanes", "not random gaps in barriers"): continuous Armco with smooth flared ends, tyres only in
  front of it behind traps, a catch fence (weaker than Armco) where spectators are, NEVER the black
  wire fence; bridges and tunnels as the real ones, roads joined up; keep the game's art style.
- A ROLLED CAR IS ITS OWN SHAPE (11-08, owner, on the roll mockup and the F1 + Micra test): drawn
  2D but in the real car's shape ("not a clear cube", "windscreens are angled"), 12 frames a turn
  ("the sweet spot") in shaded bands, a slight blur and whoosh lines over the car that fade with
  the spin; the livery's four colours, rims and details right in every frame; its damage carried.
  It rolls by its shape: round keeps rolling, sharp digs in; F1-like and wide cars almost never
  rest on a side; an open car rolling breaks up (wings, sidepods, wheels). Front-to-back roll and
  suspension rock were put aside ("ignore front roll and suspension rock").
- A VENUE IS AS REAL AS IT CAN BE (11-08, owner, on Castle Kum): its edge follows the real
  circuit's ("keep it like the real track where possible") - Armco where the real one has guard
  rail (OSM, aerial photos), the real tyre walls, a catch fence where spectators are - with the
  sealed-edge rules; and nothing the real place does not have ("keep them out if they're not
  there": no footbridge over a track that has none). Brands was built to the earlier default
  (Armco behind traps and before hazards, open run-off elsewhere).
- A VENUE'S HAND FINISH (11-07, owner: "maybe if needs hand finish to get clean road connections"):
  the rules build the venue; where the real map's joints cannot be made clean by rule (our
  game-sized garages over the real paddock road, a bridge's ramp landing on a junction), the spec's
  `finish` (game m) moves a building off a road, cuts a road back, drops one, or lays a road drawn
  by hand (one whose end is on a road's end carries it on). Fix rule bugs at the root first; the
  finish is for what is particular to the place. tools/venueplan.mjs draws the built venue as a
  plan on a metre grid (lanes numbered, portals, barriers) to read the joints off.
- A venue's map is placed with the game's wider road pushing the scenery back; between two
  stretches of road the ground is squeezed (the push easing to nothing halfway), never pushed
  both ways (it folded 8 m of map over between Brabham and Cooper: torn paddocks, kinked roads).
- Tunnel portals are solid to everything laid after them; a tunnel's road carries on the road that
  ends at its mouth (cut back to where the curve runs on smoothly), never loops round to it.
- BRIDGES AND TUNNELS ARE DRIVABLE LEVELS (owner OK 11-07, passed 11-08): a car changes level only through an END (a ramp's foot, a portal's open end); on one it
  meets only its walls, its deck, the cars on it - nothing on the ground, no marks, no lap. The
  ground meets the ends as solid (ramp walls + abutment, portal walls + lintel). A tunnel car is
  seen only in the open cuts, hidden under the ground (owner 11-08: "if it's hidden it's hidden" -
  no faint car). Its way has the terrain's shape: a bridge rises (a sin^2 arch, 2.5 % of its length),
  a tunnel dips - gentle enough to go light, not fly (no air to 90 km/h). A tunnel's mouth opens
  onto room to drive out, else its portal walks on (the Brands footpath tunnel runs on under Cooper
  Straight). Smoke goes under what is overhead (a deck, a canopy). A crossing has its OWN GROUND:
  the same wear cells and rules as any ground, filed far off the map (world/deckwear.ts) - what a
  car lets go of on it (radiator water, oil, glass) lands there, looks, grips and dries as anywhere
  (owner: "it should work like any other surface"), never on the track beneath. tools/
  crossingcheck.mjs drives
  each one both ways.
- "Straight Outta Swindon" is a reserved name for a future highway level (the test straight that
  used it was removed 10-17).

## Measured lessons

- A CANVAS READ BACK STALLS AND CAN RASTERISE DIFFERENTLY (11-08): getImageData waits for all the
  drawing queued before it (the crash bench's re-dented cars: 22 % of the impact's CPU - read a
  sprite once, render/spritepixels.ts). Chrome keeps a canvas's drawing as a list and rasterises
  it by the canvas's mode when read: a canvas's own FIRST read back can differ from its second (a
  fractional clearRect's soft edge). Prove pictures by drawing a copy onto a canvas of its own and
  reading that (tools/scratch/_spritework.mjs).
- THE CRASH BENCH'S COST IS IN THE IMPACT'S FIRST SECONDS (11-08): ~950 thrown tyres all moving,
  and drawing as heavy as the physics (the dented cars, not the loose objects). A slow frame takes
  up to MAX_STEPS steps the next, so sim and draw feed each other: read sim and draw per frame
  (tools/scratch/_benchreport.mjs + &report=1), not one total.
- A LEVEL BUILT ON FIRST USE HAS NO TRACK UNTIL setLevel (11-08): tools/renderhash.mjs picked
  circuits by "has a subtrack" and silently dropped Brands from every pixel check after it went
  lazy. Pick levels by what they are (a _build without a stage gen is a circuit), or build them.
- TWO WORKERS, ONE TOOL PORT (11-10): every browser tool's server (tools/lib/browser.mjs) takes
  CHECK_PORT, 8090 by default, and a tool that finds the port taken talks to whichever server is
  there - another worktree's, serving other code (a FINISH row "missing" was the helper's build).
  Each worker its own CHECK_PORT (the foreman 8121+, the venue helper 8090-8110), and before
  stopping a server by PID, read its PARENT: the foreman stopped the helper's renderhash server
  taking it for an orphan of its own.
- A RED CI RUN IS A BUG UNTIL SHOWN OTHERWISE (11-08): the renderhash jobs failed for a day as a
  "tool failure" (reading 'mass') - it was the game: a torn-off driven wheel threw a drive shaft
  with no loose-object entry and the sim step threw. tools/partcheck.mjs now walks every car's
  every part; add a part kind and its DEBRIS entry in the same change.
- RENDERHASH COMPARES LIKE WITH LIKE (10-24): a level's hash depends on which levels ran before
  it in the same page - a --only list against a reference saved by --shard reads DIFFERENT on
  every level with no code change. Prove a change by running the SAME list (same --only or
  same --shard) on main and on the change, or against a reference saved with that list.
- The owner's iPhone 17 Pro Max (Safari, often the home-screen app) is the yardstick, not the laptop.
  Our JS takes ~4 ms of a 16.7 ms frame there: the phone is not CPU-bound. Laptop numbers at CPU x4
  overstate our cost; use them for A/B only, never as the reason for a change the owner will feel.
- GPU work helps visual problems (texture flicker at zoom), not speed on the phone - and it costs
  smoothness there: the WebGL ground under the 2D canvas made Safari hold 48-78 frames in 15 s at
  Castle Kum's corners, the CPU ground 9, the original build 0. Every new look is a per-frame cost
  for Safari: prove each with a held-frame recording before it becomes the default.
- The held frames are Safari's way of showing the page: the same default build in DuckDuckGo
  (iOS WebKit too) showed the owner no holds while a Safari tab held 42 in 10 s (10-17). The
  lean drawing only brought Safari to the original's level (0.3-0.6 a second). Test a Safari
  look in the home-screen app too before blaming our drawing.
- Never copy pixels between the 2D canvas and WebGL every frame: uploading the art buffer each frame
  took the phone's draw time from 3 to 7-8 ms and juddered.
- Felt judder comes and goes on the same build (two Castle Kum runs, same link: "juddery" and "fine",
  both ~0.4 % slow frames). One rough run is a reason for a back-to-back A/B, not proof.
- Safari rounds rAF timestamps to whole ms: frame pacing (`game/pacing.ts`) fixed the constant shake.
- The 136 m highway hitch was the skid-mark layer re-centring (26 MB copy); it now wraps.
- `preserveDrawingBuffer: true` on the WebGL canvas is needed on the iPhone (fewer slow frames).
- Held frames are invisible to rAF: an owner screen recording showed Safari holding ~6 frames a
  second at Castle Kum's corners while every rAF and physics step was on time. Count held frames in a
  recording (frames identical to the one before while things move), and count drawing work with
  tools/drawload.mjs; frame times alone cannot see this.
- In the recording counter (motion.html, frames shrunk to 220 px) the ground moves ~1.3 px a
  frame: its "1.5x / 0.5x step" counts are matching noise, not judder. Trust held frames only.
- The phone report's physics steps: 2 a frame on 97-99 % of race frames (lean, 10-17): the game
  moves evenly; what remains is how Safari shows it.
- Screen pixels cost frames on the iPhone even with our JS at 2-3 ms: sharpness 1.5 vs 2 halved
  the dropped frames in back-to-back races (4.5 vs 8.4 a minute); the owner saw no blur.
- Chrome's canvas picks its anti-aliasing method by a path's point count: clipping a path changes a
  few edge pixels, so "same shapes" is not "same pixels".
- Canvas 2D drawing is deferred until read: a getImageData / upload cost in a profile is often the
  painting itself.
- A CPU-backed texture pattern-filled onto a GPU-backed canvas is moved on every fill.
- Changing the sharpness (dpr) moves every zoom where the GPU ground changes method (1 screen px
  per tile px / texel): 1.5 put it at zoom ~0.5, mid speed, where a mipmap burst sat. Check
  zoom thresholds after any dpr / PPM change (tools/scratch/_zoomswitch.mjs).
- Track edges jiggled only while the zoom moved: tiles placed on whole art pixels under a GPU
  ground that zooms smoothly (up to 1.5 device px a frame). Measure motion against a control.
- The tyre marks quiver: the marks layer (4.2 px/m) is stretched ~3.6x nearest into the art grid each
  frame, so a mark pixel is 3 or 4 art px wide by camera position; now drawn on the screen canvas.
- Laptop frame numbers swing with the machine (Brands work median 20 ms one hour, 38 ms the next,
  main included): only compare A/B runs made back to back.
- The phone in Safari (tab or home screen) has 1-5 % off-beat frames (early or late) in every mode;
  a screen recording shows them as a frame held twice. Not our code (2-3 ms a frame): do not chase
  them as a menu or race problem without a back-to-back A/B.
- The test server sends the game as ~160 modules, never cached: over the tunnel that is seconds
  of load before our code runs; the bundle (one file, the default) fixed it. Measure the
  phone's load with `loadMs` (`phonereport` prints it).
- iOS LOW POWER MODE (and a hot phone, e.g. charging hard) caps Safari at 30 fps: every frame
  33 ms, the menu too, our JS 2-6 ms (10-18, felt as "major lag" and the ground painting falling
  behind). `phonereport` flags such a run (CAPPED AT ~30 fps); ask about it before chasing.
- `?report=1` records without drawing the meter graph (`?meter=1` shows it). It records the
  menu too: `phonereport` prints a MENU run (frame times, ignored taps, slowest tap handler).

- simhash / renderhash run the BROWSER game (main.ts applies the settings): prove an old path with
  RAC3R_QUERY=<switch>=0, never a node wrapper that sets a module flag (main.ts overrides it).
- The cover field costs ~nothing on the laptop GPU (Castle Kum race 54.2 vs 55.5 fps, a snow stage
  under a full coat 60): one full-screen pass reading one texel a pixel (rim reads only near
  patch edges); the catch is computed per 8 m chunk on the CPU within 2 ms a frame.

- renderhash draws the CPU ground (?gpupaint=0): it does not cover the GPU field shader
  (render/glfield.ts) - photograph GPU look changes and check page errors. tools/uicheck.mjs reads
  the HUD layout before a frame draws the tyre diagram: tools/scratch/_hudoverlap.mjs draws frames.
- The cover field, mud frost, mark fade and HUD gauge cost the phone nothing measurable (Castle
  Cum in snow, 10-18: 0.10 % slow frames).
- CI runners have no GPU: the WebGL2 ground runs in SwiftShader, 3-6 min a level for renderhash
  and the menu / guide checks several times slower than the laptop. Fixed sleeps time out there:
  wait for the condition. renderhash runs as 8 parallel shards (`--shard k/8`; 4 ran into the
  60 min job limit with the world circuits, 11-10).
- framecheck A/B: alternate the order (on, off, on, off). The first run after a pause painted 3x
  the tiles (385 vs 120) whichever side it was.
- Wear cells cost per cell where code walks them all (pruneWear each highway rebuild, the worn
  tiles' painter per tile): ~3 000 on a circuit measured nothing; ~15 000 (the highway's ploughed
  fields) is why fields dry in blocks, not cells.

- The tiles' palette is built from SURFACE_ART (render/tilesPalette.ts): a new look's colours
  move other pixels' nearest-colour snap. While under test, add them only with the switch on.
- DRAWING NEVER USES Math.random (10-25): the tools seed ONE Math.random for the page, so a look
  that drew from it (marbles in marks.ts, sparks, puffs) shifted every later dice roll of the
  physics and simhash read a look change as a race change. Looks use render/shared.ts fxRandom.
- Short-lived chips fade over their own life (render/particles.ts): by seconds left a spark
  (< 0.4 s) was never more than 40 % opaque - sparks existed but could not be seen.
- tools/framecheck.mjs does NOT drive the highway (its autodriver leaves the car parked there):
  A/B the highway with tools/scratch/_hwframes.mjs (the autopilot, CPU x4) instead.
- Odds rolled per wear cell scale with area (square bushes: the same per-cell puncture chance
  went 13 % -> 23 % of bushes vs round ones). Re-measure after any change of shape or size.

- AI COST IS LINEAR (11-03): ~0.15 ms a car a physics step on the laptop (ground reads, physics,
  the driver's thinking about a third each; car-to-car checks small). A "jump" read from one
  smoothed sample (game.simMs) on a flat-out laptop was the CATCH-UP LOOP (MAX_STEPS 12 steps a
  late frame) - read steps a frame and ms a step (tools/scratch/_aiprof.mjs), not one reading.
  The owner's phone holds 20 AI at sim 2 / draw 2 ms a frame.
- A page that jumps back to the menu on the phone is the BROWSER reloading the tab (the report
  shows a fresh page) - the game never reloads itself. Check memory at the phone's size
  (tools/scratch/_memprobe.mjs: live canvases + JS heap, page errors with their stacks).
- "It isn't happening" can be "it isn't DRAWN" (11-04): every leak and spill was in the wear
  cells and slippery, but the cover field's draw returned early on a dry day. Check the cells
  (tools/scratch/_leakwatch.mjs) AND a photo (_leakshot.mjs) before touching the sim.

- AI FIELD AND GHOST RUNS ARE NOT DETERMINISTIC (11-04): the same settings gave 3.2 / 4.9 s on an oil
  patch, 88 / 116 incidents. One run a side is noise: 9+ runs (3 circuits x 3 seeds) before
  believing a change, and a targeted tool for the behaviour itself (_stopcar, _rejoin, _icestart).
  tools/weavecheck.mjs IS deterministic (11-04: 13, 13, 13 on reruns): a change in its count is
  real. _reartest.mjs is not.
- FOLLOWING MUST READ THE CAR AHEAD'S BRAKING (11-04): it assumed the car ahead slows as the AI
  itself would there, so behind an early braker (a careful player) it arrived 4.3 m/s too fast.
- A FORMATION KEEPS STATION ON THE POLE'S SPEED, not the pace (11-04): from a standstill a
  stronger engine at the same throttle ran 4.5 m into the next slot.
- The loose-object STEP-ROUND is for small round things: a long ground patch (oil, glass) is not one
  obstacle, nor one per cell - every way tried put the field on the oil more (TODO 11-04).
- A ZONE'S EDGE IS BLENDED ~6 M EACH WAY (world/blend.ts), and an outlined zone's along its BOX, not
  its outline (11-08): Dieatona's skull as zones (2 m eyes) drew as a pale blob. A small pattern
  on the ground is authored PATCHES (crisp squares: VenueSpec.mown), not zones.
- A LAKE OF OVERLAPPING ELLIPSES SCALLOPS its shore ~9 % of its depth between slices (11-08): lay
  it as turned rectangles (world/venueoval.ts), finer on a small pond; trim a slice at a road
  rather than drop it (whole slices dropped left 40 m gaps in Lake Lloyd).
- WORLDHASH WITH A LEVEL SWITCH ON SHOWS LATER RALLY / RX LEVELS DIFFERENT (11-09): the rally tape's
  run ids come from one counter across every level built (world/load.ts tapeId), so a level with
  more or fewer tape runs shifts the ids of every stage and rx level after it. Compare their cones
  without the tape id before calling it a change (Knobhill venue: the same, ids apart).
- aidrivecheck counts a car on the joker lane as off (it is off the lap's road): JOKERROAD=1 counts
  it as road, to see a rallycross level's real offs.
- A VENUE'S START IS THE MAP'S POINT NEAREST spec.start (11-09): a straight the map draws as its two
  ends put Donington's line 111 m away, on the Melbourne Loop. spec.startOnLine takes the spot's
  foot on the line (Brands starts 18.6 real m from its nearest point too - left as approved).
- A NaN OR INFINITE POINT IN A ROAD RUNS resample() FOREVER (11-09): Silverstone's Wing pit lane,
  measured beyond the road's lookup inside Club, came out at Infinity and the next resample filled
  2 GB. A venue that runs out of memory: look for non-finite points first (spec.pitCuts lays such
  a stretch as mapped).
- TWO STRETCHES NEED 36 REAL M BETWEEN CENTRES FOR A BARRIER BETWEEN at 1/2 scale (11-09): the game
  road is 13 m, the edge keeps a barrier 2.5 m off each road. Lydden's Devil's Elbow ran 26 m from
  the gravel run and North Bend's legs 31 m apart: the roads touched, a car could cut half the lap.
  Measure the closest stretches of each layout (any two points over 60 lap m apart) and warp them
  apart (spec.warps); a lane beside the lap (a start straight) is held off it instead.
- resample() SPLITS EACH SEGMENT ON ITS OWN (11-09, owner on Sillystone: "sloppy place over lapping
  tyres"): a 1 m segment at 0.95 gives two points 0.5 m apart, so the tyre rows in front of the
  eased Armco (1 m points) stood twice as close as laid, on one another, at every venue. A row of
  things spaced by their size is laid with evenly() (the spacing carried round corners). The same
  round found a mapped tyre wall laid again over the edge's own two rows (three deep at
  Dongington), crossed closing rows where two pieces fork, an Armco zig-zag (a rim notch by a
  trap), Knobhill's joker bales at Infinity (a joker point past the lap's lookup reach) and a
  marshal hut's corner on a kerb. venueaudit counts tyres on tyres / barriers / kerbs, props on
  kerbs, loose objects at no place and barriers folding back; world/venue.ts tidyLoose drops any
  left (the first laid kept).
- A CAR COMING AT YOU IS NOT A STOPPED CAR (11-09, ?passcare=1): the gap picker scored a line's
  free road as the gap to the car on it, so on a two-way road a lane with a car 150 m off at a
  55 m/s closing speed looked as free as an empty one; the free road to it is what you cover before
  you meet (gap x speed / closing speed), and it is read as far ahead in time as a car going your
  way. hwracecheck's pace on a crashy road is not the game's: it never puts a wrecked racer back,
  so the field piles up behind it - compare the contact counts over several seeds.
- NEVER PUT BACKTICKS INSIDE A BASH COMMAND (11-09): a node -e edit with template strings inside
  double quotes ran their contents as shell commands (bash's command substitution). Write the
  edit script with the file tool and run it with node.
- ONCOMING TRAFFIC ON A SINGLE CARRIAGEWAY NEEDS RACERS THAT PASS WITH CARE (11-09, ?oncoming=1):
  Deaf Valley's two lanes with the other way's cars in the right one sent the racers head-on into
  them (tools/hwracecheck.mjs: racer-traffic contacts 244 steps, two wrecks, the field at 66 km/h).
  Reading them at the closing speed did not help, nor holding the racers' lanes to the left one
  (1260 contact steps): the racing line keeps the whole road and the passing has no 'is the other
  lane clear' judgement. Twin carriageways are safe (the barrier between); the single carriageway
  waits for that passing work.
- NOTHING SOLID NEARER THE ROAD THAN ITS RUN-OFF (11-09, the start crash review): 20-car starts
  (tools/scratch/_startcrash.mjs, which names a solid's hit by the solid's kind - the nearest
  barrier's name hid them) found the hardest hits on a start gantry's far leg (1.9 m past the edge,
  up to 39 m/s) and on street lights 2.5 m out, the 150 m before the line reaching into the corner
  before it at a half-size venue - and the pit wall, 3 m out, inside the first corner. A wall moved
  beyond 3.5 m stops narrowing the AI line (ai/line.ts WALL_NEAR): the field then uses the whole
  road there and its kerb, as by any Armco, so it is still hit, half as often.
- A FOLLOWED RAIL (spec.railsSeen) PUTS ARMCO AT THE RUN-OFF'S RIM, ~5 m past the edge, not where the
  rail is (11-09, Oulton Pork): it marks which stretches have Armco. Where the real barrier stands
  further back, lay it as spec.tyreWalls (the rim reaches the wall, two tyre rows in front): Old
  Hall's outside at its real 15-17 m (7.5-10 game m) took the start's hardest hit from 30.5 m/s
  (a parked car) to 13.8, where the rail's Armco at 5 m took 15.7 and doubled the hits. Two stretches
  close enough to share a barrier get one by rule - a traced line between them doubles it.
- A HAND FINISH'S drop / cut TAKES THE FIRST ROAD WITHIN 3 M of its spot (11-09, Oulton Pork): a
  spot by a junction cut the side road, not the one meant. Put the spot more than 3 m from every
  other road (tools/scratch/_lanelist.mjs lists each road's ends; `x y reach` those by a spot),
  and drop a finish entry the build warns "meets no road" about.
- A HAIRPIN TIGHTER THAN THE LEAST RADIUS IS EASED AWAY WHOLE, NOT JUST OPENED (11-09, Croughed):
  traceTrack opens a corner under spec.minR by smoothing it, and a U whose legs stand closer than
  twice minR (game) shrinks along its length until they are that far apart. Croft's Hairpin (legs
  33 m real, 17 game) went, the lap read 1616 m not 1711, and _closest.mjs found no close stretches
  (the legs were gone). Compare the traced lap with realLapM x share after every build; warp the
  legs apart (spec.warps) to twice minR.
- OSM MAY MAP A CIRCUIT'S BARRIERS AS barrier=wall (11-09, Croughed): one mapper drew Croft's with
  the raceways, on the lines the photos show (Spa's as walls and fences). tools/osmvenue.mjs reads
  guard_rail and jersey_barrier into data.rails, and the barrier ways its config lists ("rails":
  Spa); Croft's were laid as spec.railsSeen - leaving out the pit wall (world/venuepit.ts lays its
  own) and the walls round the paddock, the huts and a kart track.
- A PIT LANE THAT LOOPS ROUND INSIDE A HAIRPIN HAS NO ROOM AT 1/2 SCALE (11-09, Spa): La Source's
  pit exit turns 150 degrees inside the hairpin to join after it; at the game's scale the hairpin's
  two legs leave no room for a 9 m lane (it folded back, its wall on the lane). The loop is cut
  from the map (tools/venues/spa.json "trim") and the lane eases into the straight before it.
- A TUNNEL WHOSE FAR ROAD IS A PUBLIC ROAD IS DROPPED (11-09, Spa): the venue keeps service roads,
  not primary / secondary ones, and short pieces (under 30 m, or a stream bridge) are left out, so
  a tunnel's outer road can end in nothing and the tunnel goes. A hand-drawn road (spec.finish
  .roads) out to a building or a road gives it its far end (Paul Frere's tunnel).
- EVERY PROP IS TESTED FOR THE SCREEN TWICE A FRAME (11-09, Spa's forest): render/props.ts walks
  the whole list for the layers under and over the cars, so a prop's cost is paid wherever it
  stands. 8000 trees at Spa: CPU x4 work 12.5-13.7 -> 16.7-17.6 ms a frame (the scan ~8 % of a
  profile: drawPropList, propVisible, drawProps); a grid of props by cell would pay for the screen.
- A CATCH FENCE BREAKS WHERE TWO STANDS' SPECTATORS DO NOT MEET (11-09, Monza): the edge marks
  30 m round each stand's corners as watched; between two stands a few metres left over became
  Armco shorter than a run, dropped - a 4-8 m gap between two fence runs, and a fence jogging round
  a stand broke the same way. tools/scratch/_barriergaps.mjs (barrier ends 0.3-12 m from another
  barrier) finds them; the hand finish moves the stand (spec.finish.move).
- A ROAD THAT CROSSES ITSELF (11-10, Snoozuka's figure of eight; owner: "keep the figure-of-eight
  as a drivable bridge"): every lookup of "where on the lap is this point" took the NEAREST stretch,
  and on the bridge the road below is as near - MEASURED: on the 25 x 13 m of road over the cut the
  plain lookup took the road below for 99 of 325 points (the race order, the ground under the
  wheels, a reset, the AI's re-place, the minimap would all have jumped half a lap). Now the road
  below is the race road's own tunnel crossing (world/venuecross.ts portals, Crossing.track) and
  its segments are marked under (world/trackunder.ts): a car's lookups are made at its LEVEL
  (tyrewall.ts queriesAt / onGroundQuery: the ground's leave the stretch below out, the
  underpass's take only it); a car in it keeps its race progress along it; a reset never lands in
  its cut. Every build-time question still sees the whole road, and a level whose road never
  crosses itself has no marked segment - the same answers (worldhash, simhash). The bridge has
  its own parapets (underParapets: the edge stands neither over nor under a crossover), the
  road below is not drawn under the ground (road.ts ribbonSurfaceAt). Proved by
  tools/scratch/_crossovercheck.mjs (an AI field passing both legs: no progress jump, no car on
  the wrong level, the resets and re-place) and _crossovershots.mjs (the live game: the car in
  the cut, hidden under the bridge, the minimap); barriercheck, venueaudit and propcheck judge a
  barrier or a solid on the ground (the bridge's parapets are not on the road below).
- A TOOL PUTS A CAR DOWN WITH THE GAME'S reset (11-10, _crossovershots.mjs): a car moved by
  setting x and y keeps the height of where it was - 7 m below the back straight it popped out of
  the ground, flew and crashed on the bridge, a crash that was never the bridge's.
- A RACED PUBLIC ROAD'S NODES ARE HUNDREDS OF METRES APART (11-10, Le Manky): tools/osmvenue.mjs
  kept a feature within reachM of every 4th node of the race pieces - enough on a raceway, whose
  nodes are metres apart, but the D338's straight (raced with "roadRace") has a node every
  100-400 m, and the concrete walls beside the Hunaudieres fell out of reach (a 100 m stretch of
  the straight open both sides). A raced public road is now measured every 20 m along it; the
  other venues, which race no public road, write byte-identical files (all 17 configs rerun).
- AN ARMCO SIDE ALL ROUND IS A RING (11-10, the Nordschlep: no pit lane, barriers all round): the
  edge flared both ends of a whole-lap run apart at the lap's start - a 1.6 m gap, the two ends
  overlapping 14 m. A run that closes on itself is no longer flared (world/venueedge.ts).
- THE KERBS WERE DRAWN LAP-LONG ON EVERY GROUND TILE (11-10, the Nordschlep): road.ts
  drawCurvedKerbs tested every lap point against every kerb and drew every tooth of the lap on each
  tile (and overview) it painted - 49 000 tests and 492 teeth at Spa, 563 000 and 1502 on the
  10.4 km Nordschlep, 17 % of its CPU profile (spikes to 250-290 ms at CPU x4 as tiles paint).
  FIXED (owner 11-10: "Ok"): render/kerbs.ts finds each kerb's teeth once per subtrack and skips a
  kerb whose box misses the tile - 21 teeth a tile on the Nordschlep, the same pixels. Likewise
  render/propgrid.ts: props filed by 32 m cell, a frame tests the cells round the screen, not
  every prop twice. A per-frame or per-tile loop over the whole level is fine at 3 km and 500
  props; the long laps and the forest are where it shows. Tested exact by
  tools/scratch/_kerbcheck.mjs and _propgridcheck.mjs, and renderhash.
- A PIT LANE THAT RUNS ON (11-10, Yass Marina's pit exit tunnel under the first corner): a venue's
  pit lane was eased into the track at BOTH ends (its merges), but Yas Marina's runs on round the
  first corner's outside into a tunnel, and its exit lane comes up inside the corner. Now
  VenueSpec.pitHeld names the ends that do not merge (world/venuepit.ts: held at full clearance,
  the pit wall run on to them), finish.roads lays the two pit roads to the tunnel's mouths and
  VenueSpec.pitTunnel stands its portals (venuecross.ts pitTunnelPortals; world/crossings.ts
  pairs them as one crossing). MEASURED with tools/scratch/_pitdrive.mjs (a car down the whole
  pit path by pure pursuit, the game's world clamp): first the eased lane folded at the pit
  entry's corner and the car hit the pit wall; then a pit road still turning at a portal met the
  cut's walls - an 8 m straight run in and out of each mouth and the tunnel turned 40 deg to the
  track (a pit road beside it turns in less) gave a clean run, on the crossing from 327 to 383 m
  of 565. _pittunnelshots.mjs drives it in the live game.
- A U-SHAPED GRANDSTAND IS SLICED ACROSS ITS HAIRPIN (11-10, Yass Marina): osmvenue.mjs slices a
  long stand along its length, each slice its own box - Yas Marina's North Grandstand is one way
  wrapped round the old hairpin, so each slice's box spanned both legs and the hairpin between,
  one standing across the new hairpin's two legs (propcheck FAIL; moving it only put it on the
  next slice). The config's "skip" now leaves out any way (not only a raceway), and the stand is
  traced again in "extra" from its own nodes as its three parts (two legs and the north end).
  Likewise the "Grandstand Oasis" fan zones, read as stands by their names, skipped.
- A STREET CIRCUIT'S MAPPED FENCES ARE ON ITS WALLS (11-10, Yass Marina): OSM draws Yas Marina's
  debris fences on top of the concrete walls as barrier=fence and few of the walls, so the mixed
  fences (world/venuefences.ts) made it 91 % chain link (tools/scratch/_fencemix.mjs). Following
  only OSM's walls, with the aerial photographs' line 10 real m off each side as Snoozuka's: Armco
  73 %, catch fence 27 % (at the grandstands), wood 0, open run-off 5.3 % of the sides.
- A BIG WATER IS HUNDREDS OF THOUSANDS OF CELLS (11-10, Yass Marina's marina): the ground painter
  keeps a merged cover as one object per 0.5 m cell and filters every one on each tile it paints
  (render/ground/covers.ts filterCellsInView). The marina, 370 covers over 48 600 m2, is ~194 000
  cells (Snoozuka's ponds 38 000, Spa's 90): MEASURED JS heap 67-71 MB with 10 AI against Spa's
  55-59, covers.ts 6.6 % of the CPU x4 profile (Spa: not in its top 25), work p95 35 ms against
  Spa's 27. Proposed, not done: the cells filed by tile (as render/propgrid.ts files props).
- A WALL AT THE REAL ROAD'S EDGE LANDS ON THE GAME'S ROAD (11-10, Bathworst): Mount Panorama's
  concrete walls stand at the edge of an 8-9 m road, 4-5 real m off the centreline - at 1/2 scale,
  pushed out for the game's 13 m road (realRoadM), 5.75 m off: inside the 6.5 m half width. The edge
  looks for a followed rail from 0.5 m past the road's edge out (venueedge.ts railBeside), so it saw
  none there - open run-off, a wooden fence set back 15 m over Skyline. Where a mapped wall or fence
  stands within 10 real m of the centreline, a line 10 real m off that side is followed instead
  (railsSeen; 20 runs, 72 % of the sides): Armco 91 -> 94 %, wood 3 -> 1 %.
- A VENUE'S OWN RUN-OFF (11-10, Bathworst: "concrete walls right at the edge and little run-off"):
  the edge's barrier stood RUNOFF_M (5 m) past the road's edge wherever no trap, tyre wall or old
  piece set it; VenueSpec.runoffM gives a venue its own (world/venueedge.ts RimLines.runoff; no
  other venue gives one). Not below the edge's ROAD_CLEAR_M (2.5 m): MEASURED at 2 m the rim's
  points failed the road clearance and 80 % of the sides went open (barriers gone, marshal posts
  hit). At 3 m, a 300 s 20-car race (tools/scratch/_startcrash.mjs, seed 11, ~2 laps): barrier hits
  19, hard car hits 26, off the road 30 - at 5 m 20 / 24 / 27; Spa 8 / 17 / 32, Snoozuka 37 / 40 /
  58 (its portals' hits left out: the node tool has no crossings). The walls hard by the road
  catch a car off it sooner; the field does not pile up.
- A PIT WALL ROUND A TIGHT CORNER FOLDS BACK (11-10, Bathworst: its pit lane runs round the inside
  of Murray's Corner and Hell Corner): the wall's line, offset inside a corner tighter than its
  offset, stepped back on itself (venueaudit "barrier folds back" x6). world/venuepit.ts unfold
  drops a point whose step turns back more than a right angle; every other venue's wall the same
  (worldhash SAME).
- A RACE ROAD'S OWN TUNNEL ROUND A BEND (11-11, Moanaco: Boulevard Louis II under the shore's
  hotels, 356 real m bending 60 deg): a crossing is a straight way between its ends, and a 190 m
  game tunnel bowed 23 m off that line. VenueSpec.tunnel names the piece; the stretch is the race
  road's own underpass (trackunder.ts, as Snoozuka's) with no road over it - its portals on the
  road at each end (venuecross.ts roadPortals, the first carrying the road's centre as
  Prop.path), the crossing's walls along the road (crossings.ts bentTunnel), a car on only through
  a mouth (Crossing.mouth, not anywhere across the bend's span), the hidden stretch the walls'
  outline lintel to lintel (Crossing.hidden, render/screen.ts), the edge on past the portals to the
  lintels, a row of blocks over it (tunnelCover). Every other venue's crossings, edges and props
  the same (worldhash). crossingcheck drives a bent tunnel along its road (checkBent).
- A PIT LANE BETWEEN TWO ROADS 16-18 REAL M APART HAS NO ROOM AT 1/2 (11-11, Moanaco: the pit lane
  up from Rascasse beside the Rascasse approach): the lane is held 14.6 m off the road it runs
  beside, a barrier needs 2.5 m off a road's edge and a barrier's end 8.5 m off the lane's centre
  (venueedge.ts END_ROAD_M) - the lane overlapped the approach. A warp (14 real m over 40 m, the
  start straight's south end and Noghes with the lane) and the approach eased toward the harbour
  (up to 16 real m) gave 17.7 m; the lane's entry moved from the corner's apex (in its island at
  the game's widths) to Avenue du Port. tools/scratch/_moseal.mjs (a flood fill from the start,
  barriers and solids grown half a car) found each gap the eye missed.
- A STREET VENUE'S TOWN IS PAVED (owner 11-11 on Moanaco's town on grass: "make pavement or
  anything else you need"): VenueSpec.base sets the ground off the road (Moanaco: concrete, the
  existing ground art - pavements, quays and squares to the water's edge), its parks, gardens and
  woods laid as grass pads (OSM's outlines boxed, kept 13 m off the road: tools/scratch/
  _moparks.mjs, _mopads.mjs), its car parks left out (mown grass with parked cars). A concrete
  pit lane did not show on the concrete town: VenueSpec.pitSurface (Moanaco's tarmac, as the
  real one). Every other venue: grass and a concrete pit lane, as before (worldhash).
- A STAND BESIDE A ROAD WATCHES ITS FAR SIDE TOO (11-11, Moanaco): the edge marks 30 m round a
  stand's corners as watched, so a stand by the swimming pool turned 26 m of the road's other side
  (beside the pit lane) to catch fence - a run shorter than MIN_RUN_PTS, dropped: a 19 m gap. The
  pool's grandstands (N, O, P) were left out; T and K stand.
- A WALKING TRAIL'S BRIDGES ARE NOT OVER THE TRACK (11-10, Bathworst): the Mount Panorama
  Boardwalk runs beside the road, mapped with bridge=yes over drains by the walls and
  bridge=boardwalk along Skyline and the Esses; any bridge deck within 10.5 m of the centreline
  is a crossing (venuescenery.ts), so they stood 70 m footbridges along the track. The aerial
  photographs show none over the road: skipped in the config ("skip" leaves out any way).
- THE HILLS' FIT CAN SHARPEN A CREST (11-10, Bathworst): 40 cos^2 hills fitted to SRTM with 200 m
  ones among them made Skyline's crest 240 real m in radius against SRTM's 480 (and a 340 m game
  crest on Mountain Straight that SRTM does not have); without the 200 m hills: rms 1.2 -> 1.4 m on
  the lap, Skyline 380-430 m. tools/scratch/_crestmap.mjs lists every crest sharper than a radius
  with the speed that makes a car weightless there (v^2 = g R) against what the careful driver and
  a flat-out driver carry; tools/crestcheck.mjs the airtime by stretch.
- A RESET ON A TWO-WAY ROAD NEVER TAKES "THE NEAREST EDGE" (11-09, owner: "reset still can leave me
  on the opposite carriage way !"): the circuits' reset puts the car on the edge it left by, and a
  car thrown over the Jersey barrier left by the oncoming side's. Every endless-road reset - the R
  key, a stuck car, the off-road and wrong-way guards, an AI put back - goes to our hard shoulder
  (highway/road.ts shoulderOff), facing up the road; tools/scratch/_resetspots.mjs tries each.


## Routine

- Work in a worktree, never the served clone: `git worktree add -q --detach ../rac3r-wt origin/main`,
  then a node_modules junction (`cmd //c mklink //J ...rac3r-wt\node_modules ...rac3r\node_modules`).
  Clean up: `cmd //c rmdir` the junction first, then `git worktree remove --force ../rac3r-wt`; the
  clone's node_modules must still have 77 entries.
- Proofs: `npm run verify`; `node tools/settingscheck.mjs` for switches; `renderhash` (pixels, ~7 min)
  only for drawing changes, `simhash` / `worldhash` for physics / level changes. Reuse saved
  references (`tools/.renderhash` etc.) between changes instead of re-saving on the base. A change
  meant to alter pixels: prove the old path SAME with `RAC3R_QUERY=<switch>=0`, then save new ones.
- Photograph visual changes at 844x390 and 390x844 and look at them before reporting.
- A level added, or its look changed: `node tools/thumbs.mjs <id,...>` paints its menu thumbnail into
  assets/thumbs (shipped: src/menu/thumbfiles.ts; tools/thumbcheck.mjs, in the suite, fails on a
  level without one). The menu no longer paints them itself (11-10: the first TEST MODE tap after an
  update froze 37-49 s on the laptop painting all of them).
- To main: commit, `git push origin HEAD:refs/heads/foreman/<name>`, wait for EVERY check-run - `verify`,
  `checks` (the suite: menucheck, barriercheck ...) and the 8 renderhash shards (GitHub API
  `repos/staystale/Rac3r/commits/<sha>/check-runs`; 11-10: `verify` alone passed a commit whose
  `checks` failed), `git push origin HEAD:refs/heads/main`,
  delete the branch, then move the served clone: `git fetch -q origin && git checkout -q --detach
  origin/main`.
- Commit tags (11-07): a commit MEANT to change the simulation / the AI says [sim], level data
  [world], the pixels [look] - the `checks` workflow then reports that hash instead of failing it.
  Untagged, a difference fails: it was not meant. A level change that moves anything drawn (a
  board, a road) changes the pixels too: [world] [look] (the Brands board and loop, 11-08, failed
  renderhash on [world] alone). The push to main needs only `verify` on that commit; a red
  renderhash that shows only the meant levels is not a reason to run CI again.
- Phone runs: `node tools/phonereport.mjs <report log> --since <UTC time>`; the log path is in the
  owner's README / the test server's start-up.
- Long tools: run in the background, write to a file, poll it. One heavy browser tool at a time
  (6 GB laptop). Stop processes by PID only.
- Long inline text in the Bash tool can fail to parse: write scripts to a file and run them.
- `npm run verify | tail` returns tail's status: `set -o pipefail` before chaining a commit / push.
- Deleting lines: `sed '/pattern/d'` or a node script, not an Edit whose old text starts with a
  newline (it joined lines in CRLF-history files).
- Never edit `src/` in the worktree a proof is running from: the tools load it as they go.
- CI logs: the portable GitHub CLI, `C:/Users/Admin/tools/gh/bin/gh.exe run view <id>
  --log-failed -R staystale/Rac3r` (the anonymous API shows only pass / fail).
- A HELPER SESSION IN PARALLEL (the venue helper, 11-08): its own worktree (`Desktop/G/rac3r-venue`)
  and its own CHECK_PORT for its browser tools - the helper 8090-8110 (8103), the foreman 8121
  (11-10: both on 8097 once, and one stopped the other's server mid-renderhash). The tools start a
  server on 8090 by default, and one that finds another worktree's server answering USES IT - a
  proof then measures the other worktree's code. One heavy browser run at a time across both - the
  lock file `Desktop/G/.browser-busy` (who, what, when) around it. While the helper
  works, laptop frame times are noise: compare shares in a CPU profile, or wait.

## Tools worth knowing

- `tools/tilecost.mjs` (tiles by reason), `tools/framecheck.mjs <level> [query]` (frame times),
  `tools/profile.mjs`, `tools/phonereport.mjs`, `tools/renderhash.mjs` (`--only`, `--shots`),
  `tools/shotdiff.mjs`, `tools/zoomcheck.mjs`, `tools/scratch/carmock.html` (car drawing mockup),
  `tools/edgecheck.mjs` (does the white edge line move rigidly; `--control` = the noise floor),
  `tools/drawload.mjs` (drawing asked per frame, per layer: what Safari paints after our JS),
  `tools/scratch/_aiprof.mjs` (AI cost: ms a step, steps a frame, inclusive by subsystem, FOCUS=fn),
  `tools/scratch/_memprobe.mjs` (memory at the phone's size, page errors with stacks).
- Browser tools open the game with `gotoGame` (`tools/lib/browser.mjs`): the game starts by a
  dynamic import, so the page's load event comes before `window.__game`; and Edge 155 never runs
  Playwright's default animation-frame poll under the determinism script (use a timed poll).
  Tools not yet moved to it may read the game too early.
