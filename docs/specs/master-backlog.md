# Master backlog (triaged owner list)

Moved here verbatim from TODO.md; open items are listed in TODO.md.

## MASTER BACKLOG — the user's long list (originally sent to DeepSeek), TRIAGED 2026-10-03 by Claude
Nothing below is to be built without talking first (user: "talk to me before making changes ... don't assume";
keep it light — itch.io limit 1 GB, the shipped game is 364 KB today).

### ORDER (user, 2026-10-03)
1. [x] DONE: camera fly-in from the whole level at level start + water mixing as a % chance (1-3 passes). Also: kerbs
   drawn last and never covered by patches (user screenshot).
2. Tyre temperature + the surface items (blending first).
   TYRE TEMP DECIDED (user, 2026-10-03): start COLD (warm them up). The car itself shows only realistic feedback —
   fainter tyre marks when cold, rubber balling (marbles) in the working window, smoke when too hot; popping waits for
   DAMAGE. Numbers only in an OPTIONAL damage / tyre-temp HUD, switchable on and off (off by default).
   [x] model + feedback built (ENGINE.md "Tyre temperature"; tools/tyrecheck.mjs).
   NOTE: the TRACK CAR leaves the road on the Test Track in the lap driver EVEN WITH TYRES PINNED WARM (17.5 s off)
   — pre-existing, belongs to step 3 (track car / aero).
3. Check ESC / TCS / ABS, aero and the track car's driving.
4. Gravity-vector terrain — DECIDED: arrows bake to a HEIGHT MAP (slopes, banking, crests, airtime from the suspension).
5. Pixel art — DECIDED: EVERYTHING pixel art, as realistic as possible within the style.
   APPROVED 2026-10-03 from the ?pixel=1 mock-up (art/reference style, car ~70 art px): CONVERT EVERYTHING, pixel becomes
   the DEFAULT (?smooth=1 keeps the old renderer), HUD stays CRISP (full resolution). Squares not circles for patches /
   transitions / wear / stones. Steps: default on > 8 hand-tuned car sprites (sheet review) > cones/tyres/stacks sprites >
   square particles > check marks + props.
   [x] default on, 8 car sprites (sheet sent), cones/tyres sprites, square particles, palette-snapped ground, squares.
   [x] skid marks crisp; covers as squares; props photographed — read fine through the pixel buffer.
   [x] BUG (user): water on dirt never became mud — soft bases now churn in 1-3 passes of any tyre.
   [x] TYRES (user, 2026-10-03) DONE — see ENGINE.md "HARD TO OVERHEAT": heat up too easily and pass the good range too easily. Overheating must be HARD:
       long burnouts to pop them (pop waits for damage), EXCESSIVE drifting on tarmac to overheat, and off-road
       surfaces should barely warm them. Measure with tools/tyrecheck.mjs, retune, write before/after in comments.
   [x] USER RULE (2026-10-03): "Surface visuals should be accurate to their affects" — DONE: tools/visualcheck.mjs; kerbs
       were on the wrong side (fixed), pad aprons, sector seams, cover squares. Distinct textures are enough (user).
       Puddles on dirt still brown-on-brown: user did not ask for a change after the rule — leave unless asked.
   [-] (was) — what is drawn must match what the
       physics does: same edges, same extent, and a surface that grips differently must LOOK different (puddles on dirt
       read as dirt but are slippery). Proposed: (1) cover physics on the same 0.5 m squares as drawn; (2) water reads
       as water on every base; (3) tools/visualcheck.mjs: drawn pixels vs groundAt() on every level, report mismatches.

### Also (user, 2026-10-03): a basic HOW TO PLAY guide on first play — SKIPPABLE and easy to REPLAY. (CLAUDE.md §4:
    the walkthrough is required and is updated in the same task as any mechanic that changes it.)
    DECIDED (user, 2026-10-03, next session): FIRST TASK. Form = CARD OVERLAY that POINTS TO and HIGHLIGHTS the
    control it is talking about. APPROVED shape: pauses after the fly-in, dims the screen, cut-out + pulsing
    outline on the target, card with an arrow, NEXT / SKIP / dots, once per device. Cards (all four groups):
    steer, pedals, hand + R, speed/tacho (+ lap on circuits), car/level chip, RESTART/RESET/CLEAR, tyres + surfaces.
    Replay: a small "?" chip at the end of the RESTART/RESET/CLEAR row.
    - [x] BUILT 2026-10-03 (ENGINE.md "HOW TO PLAY guide"): src/guide.js, "?" chip, H key; tools/guidecheck.mjs (6 sizes x 2
      levels, proven to fire); photographed at 844x390, 390x844, 360x640, 1280x720. AWAITING the user's phone verdict.
    GRASS TOO SLIPPY (user, 2026-10-03: "what's happened grass seems way too slippy"). INVESTIGATED: nothing changed —
    A/B of the archived Gemini build vs now on forced grass, 4 cars: IDENTICAL accel / braking / cornering (rear-drive
    cars spin at 50 km/h with 0.35 steer, as before). Wear makes grass GRIPPIER (-> dirt 0.56 / mud 0.45). The real
    issue: grass mu 0.34 (Gemini, 2026-10-01, no reason recorded) is LOWER than mud 0.45 and thick mud 0.38 —
    the order is upside down. Proposed: raise grass above mud. Awaiting the user's call on the numbers.
    - [x] ROOT CAUSE (user: "only on the naffcar track"): the BANKING force acted on grass/run-off beyond |x| 130 and
          always to the car's left — FIXED 2026-10-03 (ENGINE.md "NAFFCAR BANKING"). Hands-off drift 22-30 m -> 0.1 m.
    - [ ] Naffcar V8 fails the lap driver on its own track (12.7 s off the road; was 13.8 before the fix) -> step 3.
    - [x] DECIDED (user): grass grip is FINE now. Long grass should GRAB slightly until worn to short grass (2 passes):
          plough 0.10 -> 0.35 — DONE 2026-10-03 (measured in the lab.js comment).
    APPROVED ORDER (user, 2026-10-03: "Ok 1, 2 and 3 then"): 1 guide fixes -> 2 aids + handling -> 3 terrain.
    HEIGHT MADE VISIBLE + SUSPENSION TEST ZONE (user, 2026-10-03, verbatim): "can we make sure banked surfaces are
    clearly show with brighter spots and shadowing same with bumps and dips. Can we add some bumps and dips to the lab
    level and mark it out as a suspension test zone". FOLDED INTO STEP 3 (terrain) — propose the shape there.
    Facts: bumps already have per-kind shading (render.js drawBumps); banking has NO visual and NO height (a force in
    applyGround); no "dip" kind exists; suspension samples the ground at each AXLE centre, not per wheel (no roll), so
    one-sided bumps are not felt.
    GUIDE FIXES — DONE 2026-10-03 (user approved "1"): HOLD R reverses (R brakes first if rolling; no pedal swap;
          tools/reversecheck.mjs rewritten, 5 cases x 8 cars OK); RESET on non-circuit levels uses breadcrumbs ~2 s back
          (browser: drove 49 m, RESET put it 42.5 m back, not at the spawn); RESTART / RESET / tyres cards reworded.
          FOUND, for step 2: (a) NO rolling resistance or engine braking — a released car coasts almost freely
          (5.5 -> 5.4 m/s in 1 s); (b) RESET (vehicle.js reset()) also makes the tyres COLD again — unintended?
    GUIDE AUDIT vs the code (user, 2026-10-03: "check the rest of the guide is true and correct"). (items below now DONE)
    - [ ] REVERSE (user: "it should work how the card says and the game is wrong"). Today R is a TOGGLE (<1 m/s), then
          BRAKE drives backwards and GAS brakes (vehicle.js ~311-323). Make it: HOLD R = drive backwards (ramped like
          GAS); BRAKE always brakes; GAS always drives forward; no pedal swap. PC: hold Z.
    - [ ] RESET on levels with no circuit (The Lab) goes to the SPAWN, not "near where you left it": main.js reads
          `breadcrumbs` but nothing ever records one. Fix: record the last safe spot while driving.
    - [ ] Wording: RESTART card says "everything reset", but the Grass Track's random layout is kept; the Lab has no
          start line. Tyres card: cold tyres only lose grip on hard surfaces (off-road ignores temperature).
    - Checked TRUE: steer zone (left 55%), ramped gas/brake, lift-off catches a slide (MEASURED: every car straight
      in 0.4-2.2 s), handbrake locks the rears, auto box + red shift bar, lap panel, car picker, CLEAR = marks only,
      covers change as driven, TUNE > TYRE HUD, "?" / H replay.
    Stray old files (cf_*.log, tunnel*.log, get_url.py, serve.py, test.txt, url_out.txt): user said LEAVE THEM.

### Already done — disposed of
- Snow turns to ice with repeated passes (now: freezes OR melts). Wet tarmac dries when driven. Wet/snow/ice are
  LAYERS over any surface. Freeze when braking mid-jump (fixed). Mud -> thick mud. Water + grass/dirt -> mud.
  Jumps removed from the Surface Sandbox.

### Partly done
- Hot tyres / passes clear wet, snow, ice — PASSES done; HEAT waits for tyre temperature.
- Remove the old jumps everywhere — Sandbox done; Lab (ramp, table, humps) and Test Track (table) still have them;
  replace with the GRAVITY-VECTOR terrain below, not just delete.
- TCS button — EXISTS BUT DOES NOTHING (hud/main toggle car.assistsActive; vehicle.js never reads it). ABS absent.
- Track RESET — today: nearest centreline point not beyond driven progress, facing along the track. Spec wants
  more (below).
- Water mixing — happens over 3 passes; the list says "instantly". QUESTION OPEN.

### A. Feel & controls (playtesters + user)
- Camera starts very zoomed out at level start and flies in, so you see the level.
- Zooming out under acceleration a bit easier.
- Steering: wider joystick input range / less sensitive near centre; full lock too easy and not always grippy;
  more realistic steering angles.
- Throttle ramp slightly longer for finer control.
- Front tyres do not grip enough (repeated).
- Downforce does not work correctly on the track car; aero should be real on any car with aero stats, and later
  an UPGRADE (spoilers etc).
- TCS (fix) and ABS as small toggle buttons near the controls, on the cars that should have them.
### B. Bugs
- Judder at high speed — needs a fresh report: still happening? which car / surface?
### C. Tyres
- Per-tyre TEMPERATURE (4 wheels), read through grip. Cold = less grip on tarmac only (off-road unaffected).
  Heating: wheelspin (driven wheels: FWD/RWD/4WD differ), cornering (fronts more), drifting (outside tyres).
  Cooling: grass, ice, snow, mud, or not driving. Effects: rubber balling, tyre smoke, eventually popping.
  Hot tyres clear wet / snow / ice faster (scale ICE_SCRUB etc).
- TYRE TYPES with MANUFACTURERS (some make only performance, some only off-road) and a TREAD system. Every tyre
  has its own grip / slip / per-surface character. Classes: used road, road, performance road, off road, mud,
  sand, snow, snow & ice, ice, rally, rallycross, race, high-performance race, track spec, Naffcar.
### D. Surfaces
- Tyre marks INCREASE grip where laid (tarmac, concrete, ice, gravel, sand, snow — NOT mud). Rubber as a
  paintable surface (braking zones on race tracks).
- Wet tyre marks: leaving water you carry wet marks briefly, slightly slippy, evaporate quickly. Water + rubber
  = very slippery, dries fast.
- Surface CARRY-OVER: leaving snow, ice, mud, grass, dirt, sand, gravel you drag traces onto the next surface;
  some evaporate, sand and gravel do not.
- Surface BLENDING at change points (queued separately above).
- GRAVITY-VECTOR TERRAIN: each grid square holds 1-8 force arrows, strength 0-10 -> banking, camber, hills,
  slopes, bowls, gullies, pits. NASCAR banking (flat at the bottom, steep at the top) must be controllable.
  Baked per level, cheap at runtime, smoothed by averaging (with control over how smooth). Editable in a level
  editor by tapping squares / selecting track sections. Mud repeatedly driven can spawn pits. Replaces jumps:
  harsh crests at speed lose grip until landing; airborne cars pass OVER cones / tyres.
### E. Crashes (ONLY once damage exists)
- (user, 2026-10-03, during the pixel pass) cars need ROLL-ANGLE sprites (on side, on roof, in between) and DAMAGE
  sprites. The pixel sprites are GENERATED (render.js pixelCar), so these are generator parameters (panel dents, glass
  cracked/missing, parts missing, roll state), built WITH the damage system, not drawn by hand.
- Rollover: chance from impact speed, takeoff / landing unevenness, slide angle, surface (per-surface %);
  landing on a cone / tyre / car = high chance; can roll several times, onto side or roof, then slide.
  Needs top-down sprites at roll angles / upside down.
- Damage: steering, engine, chassis degrade or break; body crumples, drops parts.
- A car sliding on its roof/side changes the ground: grass -> dirt, dirt -> mud, snow -> ice, instantly.
### F. World
- Weather + time of day + season: lighting, temperature, rain / snow / sun / hot sun. Temperature drives
  evaporation, mud drying to dirt, tyre warm-up and how much surfaces cool tyres. Simple but real.
### G. Bigger / later — discuss before anything
- Level select with the track shape and a zoomed-out preview (when menus exist).
- MULTIPLAYER, probably peer-to-peer (one hosts, others join). PLAN ONLY — needs a long conversation first.
- Pixel art / graphics pass — discuss. REFERENCE (user, 2026-10-03): art/reference/car-ref-*.jpg — top-down cars,
  ~4-5 colour palettes, hard 1 px dark outline, flat shading, black glass, detail as pixel clusters (decals,
  chrome strips, grille, lights), ~70 x 22 px. Note PLAN.md A1 retired an earlier low-res pixel buffer.
- Deterministic track-edge RESET (user's spec; the C# was reference, not the method): freeze progress at the
  exact boundary-crossing point (corner cutting gains nothing), respawn on the outer verge of the side you left
  by, heading 10-25 deg inward to rejoin, instant (state cached while driving validly, no search on trigger).
