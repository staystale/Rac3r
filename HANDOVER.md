# HANDOVER — RAC3R (car sim), 2026-10-07 (end of session) — for a CLEARED context

**NEWEST FIRST: §3a-R2 (AI ROUND 2 - where it stands and the agreed order). Older work orders below it are history.**
**START AT §3-NEXT BELOW (the work order).** Then read in this order: this file → `CLAUDE.md` §1 (how the user works — it OVERRIDES your defaults; incl. the new rule "let them
test MAJOR changes ASAP" and the "Saving time, credits and mistakes" list) and §2 → `TODO.md` item **1c** (the highway block: the
user's DECISIONS and FEEDBACK, verbatim) → only then the code you need. `ENGINE.md` (1600+ lines) is the as-built record: GREP it,
don't read it. Full older history (AI stages 1-4, levels, itch.io, regression suite): `_archive/HANDOVER-2026-10-05.md`.

The game is **RAC3R**: top-down pixel-art phone-first driving sim. Native ES modules + canvas, no bundler, no build step, **no git**.

---

## 1. Setup — where things are
- **Folder: `C:\Users\Admin\Desktop\G\GamesStudio\car sim`** (`Desktop\G\car sim` is an empty old folder — use FULL paths).
- **Live link: https://consideration-workforce-directive-cgi.trycloudflare.com** (local :8080). Server `serve.mjs` PID **25072**,
  tunnel `cloudflared` PID **18760** (restarted 2026-10-07: the old tunnel had lost its connection; new URL); PIDs in `..\tools\logs\carsim-pids.txt`. The server sends
  `no-store`, so a plain phone refresh gets new code. **Keep the tunnel UP**; stop/restart ONLY by PID (other projects share the
  machine). If the URL changes, tell the user. Curl it before giving it out.
- **The live folder IS the live game** — the user may be playing while you edit. Never leave a file broken between edits.
- **Shell is Windows PowerShell** (30 s per command). What works:
  - Multi-edit patches: `node tools/_patch.mjs shots/look/pN.json` with `[[file, oldText, newText], ...]` — exact text, refuses
    to write anything if one `oldText` is missing, strips a BOM. (PowerShell `.Replace` chains with quotes broke repeatedly.)
  - Editor tool: `new_text` ≤ ~6000 chars — write big files in parts.
  - Syntax check a src file as a MODULE: `Copy-Item src\X.js chk.mjs; node --check chk.mjs; Remove-Item chk.mjs`.
    Browser-only files (main / menu / render / hud / guide) also need a page load: `menucheck` / `rulesshots` print pageerrors.
  - Long or browser tools: `Start-Process -WindowStyle Hidden -FilePath node -ArgumentList ... -RedirectStandardOutput
    shots/look/x.txt -RedirectStandardError shots/look/x-err.txt`, then poll the file with `Start-Sleep`.
  - Gotchas: `Add-Content` writes CRLF; `Set-Content -Encoding UTF8` writes a BOM; `R` is a built-in alias; PowerShell functions
    can't assign outer variables without `$script:`.
- Playwright for browser tools: `GamesStudio/BitterTrade/node_modules` (launch `channel: 'msedge'`). You can LOOK at PNGs (read_files).
- Stray old files (cf_*.log, get_url.py, serve.py, test.txt, url_out.txt) were MOVED to `_archive/tidy-2026-10-07/` (user asked
  "tidy up folder and project", 2026-10-07). Edit `shots/next/src` first, check, then copy to `src/`; keep both identical.
- **itch.io: DO NOT PUSH until the user says so** (user, 2026-10-07: "dont update itch until told to").
- **itch.io:** `fuzzlepun/rac3r:html5`, last build **#2084224** (userversion 2026-10-07c). Stage = `..\ready-to-play\rac3r`
  (index.html + src/*.js). Push: `..\tools\butler\butler.exe push <stage> fuzzlepun/rac3r:html5 --userversion <date>` with the
  wharf key from `C:\Users\Admin\Desktop\ITCH-API-KEYS.txt` in `$env:BUTLER_API_KEY` (never copy the key into the project). Test UI
  stays ON in the itch build (user: "not a full build yet").

## 2. How the user works (full list: CLAUDE.md §1)
- **Discuss before building anything large; get a yes.** Present 2-3 concrete options, then one open question.
- **NEW 2026-10-06: "let me test major changes asap."** The moment a major change works, STOP and hand it over (link, "refresh",
  test list). Don't stack the next feature on an untested big one; don't batch big changes in one hand-over.
- **Test notes / bugs come FIRST.** Record every note VERBATIM in `TODO.md` in the same turn.
- Measure, don't guess; say "measured" only for numbers a tool printed. Photograph visuals at 390x844 and 844x390 and LOOK.
- End every report with a short phone test list: what to try, and what would count as WRONG. Honest numbers, brief.
- Don't "fix" a feel they've approved. Pixel-art rule: squares, not circles. Keep it light (itch.io target).

## 3-NEXT — THE WORK ORDER (agreed with the user 2026-10-07; their words verbatim in TODO.md, search "ANSWERS (user, 2026-10-07")
Rules for every step: build in `shots/next/src` → measure with a tool (before AND after) → copy to `src/` → add a `src/testlist.js`
entry → update TODO / ENGINE.md / this file → STOP and give the user the link + a phone test table. One step per hand-over.
New CLAUDE.md rule (user insisted): **ONE SYSTEM, NOT TWO THEN ONE** - extend what exists or ASK; never "build separate, merge later".

**1. AI ROUND 2 = ONE DRIVER for circuits AND the highway** - IN PROGRESS: (a) DONE + approved as R2.1; the remaining items are now
   staged as R2.J / R2.2a / R2.2b / R2.3 -> see §3a-R2 for the CURRENT order and state. Original agreed contents:
   a. ONE engine: hwrace.js's highway behaviour (lines / traffic weave / mirror) becomes part of aidriver.js, or both call one shared
      core. PLAN IT FIRST and show the user the plan (it is large - CLAUDE.md: discuss before building anything large).
   b. Skill SPREAD wider: some drivers well below the field on EVERY difficulty; the skill CEILING lowered progressively on easier
      modes. Error chance: barely up on the hardest, dramatically up on the easiest.
   c. AVOIDANCE WEIGHTED BY DIFFICULTY: more awareness of cars / players / objects in ALL directions (gently), so HARD has FEWER
      incidents than easy (today it is the reverse: hard 6.4 vs easy 5.4 per race).
   d. SURFACE TRANSITIONS: predict them and drive into them fast + aggressively (the user still sees AI slow down there).
   e. JOKER + lanes less "on rails": cut the joker entry and slide in for max speed (Knobhill), and generally less rail-like lines.
   f. HIGHWAY: a chance to take a slip road, good or bad.
   Measure: `DMG=1 node tools/aifieldsuite.mjs <diff 0-4>` (24 races; prints INCIDENTS per race + passes; ~2.5 min, run in a
   hidden process). Baselines in TODO "ROUND 1 BUILT". Target: easy 10+ incidents / race, hard <= 5. `tools/_aismoke.mjs live
   knobhill` / `highway` = the real game with 5 AI, no page errors. aifieldcheck takes `AINEXT=1` for `src/aidriver.next.js`.
**2. DAMAGE: LIMP then STALL** (player + AI the same, "realistic"). damage.js `derive()` is mild today (grip -20 %, power -15 %).
   A bad crash -> LIMP (power well down, heavy pull, top-speed cap); the worst -> STALLED (no drive until RESET). The AI's
   drive-out / reset (aidriver DRIVE OUT, main.js stepAI giveUp) must still recover a stalled AI.
**3. ROLL DIRECTION:** damage.js sets `car._sideKick = { dir: -Math.sign(l) }` = always rolls AWAY from the hit. A car SLIDING INTO
   a barrier should trip over its leading side and roll TOWARD it (T-boned while still: away, as now). Use the slide direction.
**4. ROLLING OVER OBJECTS** (SKIPPABLE - user: "if this is huge work or likely to spend an age debugging maybe skip"): only while a
   car is ALREADY rolling (roll.js phase 'rolling'), it rides up loose objects (cones.js) and falls off. Normal driving unchanged.
**5. SOUND S1-S4**, each phone-checked before the next (plan in TODO "SOUND PLAN"): S1 deeper per-vehicle engine voices (it is too
   high: pitch = rpm/60 x cyl/2 onto a triangle wave); S2 per-surface skids + wheelspin + brake squeal; S3 impacts by energy + horn
   + indicators; S4 other cars audible by distance. Ask before using recorded samples (assets / licences).
**6. HIGHWAY JUDDER:** still seen; `?nolock=1` did NOT help ("maybe made it worse"); frames stayed >= 50 fps, so it is not frame
   rate - suspect camera / interpolation / frame pacing. Tools: tools/hwjudder.mjs, hwprofile.mjs, wobblecheck. Keep 'judder'.

**Open on the phone test list (src/testlist.js), as of the end of this session:** sound (pause slider + mute), joker (wide + once a lap),
markedge (Knobhill marks), ainowait (AI round 1), judder (keep until the user says). (ai1engine = R2.1: approved + deleted.) Approved + deleted this session: animals, labext, mudtracks, dirtroad.
**Car-mesh chat** (cars as simple meshes + pixel textures, garage art reuse) was promised and has NOT happened - offer it when there
is a natural break; talk only, no code.

## 3a-R2 (2026-10-07, newest session) — AI ROUND 2: R2.1 LIVE + APPROVED; NEXT = R2.J joker exit (waiting for the user's "go")
- User: "ok do 1. only" / shape "A" / "highway ai cars should make mistakes too" / "traffic must stay as is" / "stop n let me test every
  stage and write a handover too, its important this isnt a back step" / "dont update itch until told to". Verbatim + plan: TODO.md AI R2.
- **R2.1 DONE (merge, no behaviour change except highway drive-out):** ONE `createAIDriver` in `src/aidriver.js`; the highway weaver is
  `roadDriver` in the same file (picked when `level.endless`); `driveOut()` is shared. `src/hwrace.js` = grid / put-back / CATCH THEM flow
  only. `createHwDriver` no longer exists (main.js + tools repointed). `traffic.js` untouched. itch NOT pushed.
- Proof: identity A/B with `NOOUT=1` = identical weavecheck / hwracecheck / pacesuite; live numbers in TODO "R2.1 MERGE BUILT". Backups:
  `shots/look/r2/bak-*.js`. Re-run the merge on a fresh copy: `node shots/look/r2/merge.mjs <dir>` (refuses if an anchor is missing).
- **aifieldsuite is NOISY run to run** (parallel CPU timing): the OLD code gave 15 then 24 incidents on the same Brands seed 23 race.
  Average 2-3 suite runs before trusting a circuit incident number. A pre-merge copy for A/B: `shots/look/r2/old` (run tools from inside it).
- **R2.1 APPROVED** (user, verbatim: "ai is noticably better, still maybe waits too long on highways (doesnt need lane awareness)
  maybe increase dodging..."). testlist 'ai1engine' deleted. Highway wait-less / dodge-more folded into R2.2 (TODO "R2.1 PHONE VERDICT").
- **JOKER EXIT** (user, verbatim: "exit of jokers still seems slow n on rails a bit"). DIAGNOSED, NOT FIXED (TODO "USER NOTE ... jokers"):
  the joker is a FIXED branch path (aidriver.js `branch()` / `branches()`) = the lane's centreline glued to the racing line with only
  15-35 m of smoothing -> a fake HAIRPIN at each join (Knobhill R 19 m in / R 18 m out; Slidden R 21-27 out). Out of it the AI is at
  full throttle but crawling: Knobhill exit plan 91 km/h vs AI 43; Slidden 107 vs 58. On rails: it tracks the branch within 0.2-0.9 m
  (`latLim` = 2 m off the main line). Tool: `tools/_jokerexit.mjs [level] [car] [diff] [seed]` (honours AINEXT=1 for a patched copy).
- **AGREED ORDER (user, 2026-10-07: "oh ok yeah" to the proposal), each = build -> measure vs baseline -> STOP for the phone test -> handover:**
  1. **R2.J JOKER (a)+(b)** - (a) re-lay the joker branch as a WIDE min-curvature line through the lane AND the road at both joins
     (as racingLine() does for the lap) so the fake hairpins go; (b) on the branch, normal wander / road-width use / dodging (latLim =
     the lane's half width, not 2 m). Gates: `_jokerexit` exit speed up, `aijokercheck` (1 gate a race, lap times not worse, off-road not
     up), `aifieldsuite` Knobhill-style levels not worse (AVERAGE 2-3 runs). Testlist entry: Knobhill + Slidden, watch the joker exit.
  2. **R2.2a HIGHWAY** - wait less + dodge more (NOT lane awareness: the weaver ignores lanes; the waiting = following behind a line it
     thinks is blocked), awareness by difficulty, highway MISTAKES (user asked). Warning: loosening the commit alone (HWT rp / cm / mvk,
     2026-10-06) gave +3 km/h but weavecheck hits 0 -> 9 of 45, so awareness has to come with it. Gates: weavecheck 0 hits, pacesuite A+B.
  3. **R2.2b CIRCUITS** - one knob table by difficulty: skill SPREAD, mistake chance (hard barely up, easy ~x3), avoidance by difficulty,
     surface prediction. Target aifieldsuite easy >= 10, hard <= 5 incidents / race (24-race AVERAGES only).
  4. **R2.3** - slips + side road as their own road frames (TODO "SLIP ROADS ANSWER": yes, that is how real roads work) and the joker
     as a planner choice instead of a fixed branch (option c).
  (User did not answer split vs together for R2.2 explicitly - the split above is the proposal they said "yeah" to; confirm on handover.)
- **NOTHING IS MID-BUILD.** Live = R2.1 (approved). No code changed since; only `tools/_jokerexit.mjs` added. itch NOT pushed.

## 3a-LATEST (2026-10-07, late). LIVE + on itch #2084224: pause-menu SOUND slider + MUTE (remembered), JOKER detection as a crossed LINE ~26 m wide, once a lap (Knobhill bug). Tidy: strays + old photos/backups moved to _archive/tidy-2026-10-07. CLAUDE.md: new rule ONE SYSTEM NOT TWO THEN ONE. Testlist: sound, joker, ainowait, markedge, judder. Questions OUT to the user (damage feel, roll direction, rolling over objects, AI round 2 plan). Work order after answers: AI R2 (ONE engine) -> SOUND S1-S4 (phone-check each) -> judder.

## 3a-NEWEST (2026-10-07). **AI ROUND 1 LIVE** (never wait, drive out when stuck, incidents measured; ENGINE.md "AI ROUND 1"; TODO AI DESIGN NOTES; testlist ainowait). Budget not met yet (hard 6.4/race, easy 5.4). NEXT: AI round 2 = ONE engine (circuit + highway) + the per-section mistake roll. Then SOUND (user: too high pitched, per-vehicle, per-surface skids, impacts, horn, indicators: plan in TODO) and the highway JUDDER (?nolock=1 did not help).

## 3a-NEWER (2026-10-07). **MUD TRACKS + KNOBHILL MARKS FIXED + LIVE** (ENGINE.md "MUD TRACKS + MARKS LAYER EDGE"; TODO; testlist mudtracks + markedge; tools/_mudtracks.mjs, tools/_markedge.mjs; backups shots/look/bak12-*). Animals + labext APPROVED (entries deleted); judder stays until the user says. NEXT: the AI design chat, then the car-mesh chat (talk, no code); ask about hiding the test UI on itch.

## 3a-NEW (2026-10-07). **S-B LAB EXTENSION DONE + LIVE** (crash lanes + off-road area; ENGINE.md "LAB EXTENSION"; TODO S-B; testlist
`labext`). _labcheck + _labshots ALL OK, regression suite = baseline. Awaiting the phone verdict. NEXT stage: ask the user (S-C animals,
S-H judder, or S-D the AI design chat). The rest of the older state below still stands.
Same day: ITCH pushed (build #2082983, 2026-10-07). Keys on the user's desktop: `C:\Users\Admin\Desktop\ITCH-API-KEYS.txt` (user asked).
Earlier AI chat quotes found + added to TODO "AI DESIGN NOTES". **S-C COWS + SHEEP DONE + LIVE** (ENGINE.md "COWS + SHEEP", testlist
`animals`, backups shots/look/bak11-*). NEXT (user's order): the MUD -> THICK MUD tracks bug, THEN the AI chat + the car-mesh chat (talk only).

## 3a. STATE AT HANDOVER (2026-10-06, late) — everything below is LIVE, all checks green, awaiting the user's phone verdict
The user's ORDER (TODO 1c "ANSWERS" + "PHONE VERDICT", verbatim): bridges + slips -> scenery -> LAB CRASH-TEST AREA -> camera judder ->
AI LAST, after a DESIGN CHAT (discuss before coding).
- **BRIDGES + SLIPS v2** — phone-tested: "most things tested great". Slips: 1/4 short (gate), 1/2 long (curve off screen), 1/4 the
  secret SIDE ROAD (rejoins). Bridges road / rail / foot / river with moving traffic, walkers, trains. On all presets incl. walled.
  Dual slips DO exist (user asked): first exit 0.8-2.9 km in, then every 2-4 km (`tools/_firstslip.mjs`).
- **SCENERY v2** (highway.js `fields()` / `village()`, stream `st.frnd`; half the road is farm biome): fields as rotated zones each side
  (wheat / rapeseed = long grass, meadow, pasture + sheep / cows, ploughed = MUD, farmyard = gravel + barns + bales), a 2.5 m LONG-GRASS
  border round each (zone `hedge: true`, look `hedgerow` — NO barrier, per the user), trees in it; villages every 3-7 km. Looks reuse
  the grass / long grass / mud textures RECOLOURED (render.js `recolour`). Not on walled. `clearFields` drops a field whole when a later
  feature (approach, river, slip) needs its ground.
- **FIXED this round (user's phone report):**
  - DIRT PATCHES on the highway: worn cells were never dropped on the endless road, so new ground built over an old worn cell kept its
    dirt (look + grip). lab.js `pruneWear(x, y, far)` after every rebuild. Measured over 40 km: 3075 -> ~250 cells, stale 2-10 -> 0.
  - CATCH THEM never ran out: each cancel restarted the full 15 s. hwrace.js now RESUMES (`cdLeft` + time away), GRACE 2 s for edge
    flicker, a gap jump > 8 m re-seeds the closing rate. `_flowtest` 11 scenarios ALL OK.
- **MEASURED, not a scenery problem:** pacesuite on 6 fresh seeds: fields 3/18 BAD vs `HWNOF=1` (no fields) 7/18. The off-road "BAD"
  runs are the AI itself (spins, beaching at slip mouths) — for the AI work.
- **AI CRASH BUDGET (user, verbatim in TODO 1c):** low difficulty ~10+ incidents per 3-lap race OK, hard <= 5. Fast, dodge, NEVER wait
  or sit still; blocking is fine — "its real racing". Agreed direction: racing line + awareness / avoidance + per-racer personality.
- **Backups:** `shots/look/bak8-{highway,render,lab}.js` = before scenery; `bak7-*` = before bridges v2. Staging copy `shots/next/`
  (index.html + src, in sync with live; open `/shots/next/index.html`).
- **Node-only A/B switches:** `HWNOX=1` (no slips / bridges / extras), `HWNOF=1` (no fields). render.js `debugZoom(z)` pins the zoom.
- **Checks (all green at handover):** `_slipcheck`, `_guardtest`, `treadmillcheck`, `_scenerycheck`, `_flowtest`, `_wearleak`;
  photos `_bridgeshots2`, `_sceneryshots` (60 fps, no page errors). `pacesuite` is ~50 s — run it hidden (Start-Process) and poll.

## 3. (HISTORY) EARLIER FEEDBACK (2026-10-06, after phone-testing §3b), VERBATIM, AND WHERE EACH STANDS
> **"mostly okay i still see some judder, it almost looks like a skip or like a camera issue tho, but maybe its the drawing of the
> blocks... the catch them / loosing them warnings and timers should only show if the slowest ai has passed you/ is going off screen
> ahead, otherwise you should be free to race, perhaps we add a timer or distance limit for story mode when its relevant... ai should
> swim, race and drive aggresievly, they tend to que in lanes on the highway still, not use the edges of the road or weave through
> traffic like a real street racer. bridges / slip roads should extend off the screen, coz currenrly the bridges have no connecting
> roads so it looks silly, and slip roads should lead off screen not just stop, although some can... and some can follow along side
> the main motorway and has a chance to rejoin, as alike secret chance path, also i thought we were going to vary sceneary along side
> the road more like farms or long grass hedges and small towns ect..."**

1. **TIMERS — DONE, LIVE** (`hwrace.js createHwFlow`): CATCH THEM now runs only when EVERY rival is ahead of you and the SLOWEST one
   (`top` is now the LAST AI) is off screen. Anyone behind you or on screen = no clock. PULLING AWAY unchanged. Rules card (guide.js
   highway, THE COUNTDOWNS) updated. `tools/_flowtest.mjs` + 2 scenarios (a rival behind / the slowest on screen): ALL OK.
   NOT done: a story-mode time / distance limit ("perhaps ... when its relevant" — with story mode, later).
2. **JUDDER — MEASURED, NOT FIXED. Report the findings and ask.** New `tools/hwwobble.mjs [s] [cpu] [ai] [traffic]` (per frame: camera,
   car on screen, zoom, and the DRAWN zoom `renderer.drawnN`):
   - The CAMERA never skips: 0 jumps > 3 px in 900-1200 frames, CPU x1 and x4, 5 AI + traffic. The car holds still on screen.
   - Slow frames remain at CPU x4 (p95 33 ms: ground tiles + physics). On a slow phone that is a "skip".
   - Suspect for "a camera issue": the PIXEL-LOCKED zoom (render.js frame(): N art px per tile) steps every 5-8 frames at highway
     speed; each step rescales the whole picture ~0.6 % (2.5-3 px at the screen edge): the pixel ground "breathes".
   - TRIED, REVERTED (not live; `updateZoom` is as before): 5 s speed average + wider dead band (still a step every 6 frames);
     hold-then-burst zoom (same); zoom snapped to exact tile steps (fewer steps, but 2.6-4.9 px jumps on 84 frames: worse).
   - LIVE: a per-frame TIME budget for tiles (`tileBudget()` / `takeTile()`: 1 tile always, more while < 6 ms spent, max 4): frames
     > 40 ms 53 -> 20 per 20 s at CPU x4. `?tilepx=128` (option only, default 256): 8 ms tiles but 3x the stand-in frames — no.
   - Next: (a) ask the user to try the game with `?nolock=1` (pixel lock off) — if the judder goes, it is the zoom step;
     (b) a zoom that only ever changes in whole-tile-pixel steps with a long hold; (c) physics cost with AI (TODO "HIGHWAY PERF").
3. **AI QUEUEING — EXPERIMENTED, NOTHING SHIPPED (the driver behaves exactly as before).** New `HWT` knobs in `hwrace.js` (node tools
   only; defaults = old behaviour): `rp` (cost of a line blocked by a RIVAL < 60 m ahead), `mvk` (swerve-cost multiplier), `cm`
   (commit bonus). MEASURED (pacesuite 9 races; seed sets A = 4242,77,1234 / B = 31,555,9001; weavecheck = 45 close passes):
   | setting | pace A / B km/h | bad A / B | weavecheck hits |
   |---|---|---|---|
   | baseline (live) | 151.0 / 139.3 | 0 / 0 | 0 |
   | cm 12, mvk 0.6 | 152.0 / 137.1 | 0 / 0 | 9 |
   | cm 12, mvk 0.6, rp 40 | 154.0 / 136.1 | 0 / 0 | 9 |
   | cm 25, mvk 0.8, rp 40 | 146.7 / 134.6 | 0 / 0 | 2 |
   | cm 12, mvk 0.6, rp 80 | 148.4 / 133.4 | 0 / 0 | - |
   Also REJECTED: `step` (far lines in steps) 2/9 bad; `rch` 1.5 2/9 bad; `vgc` 15 (cheaper verge) 1/9 bad; `mcap` 0.15 1-3/9 bad;
   `wt` 0.16 0/9 on A, 1/9 on B. Conclusion: re-weighting the line choice gains 0-3 km/h and makes close passes clip. The queueing is
   structural — 46-59 % of "a better line passed up" is REACH (hwracecheck). Next idea: a real OVERTAKE manoeuvre (pick a gap, commit to
   a 2-phase swerve with its own safety check), not more weights. Ask the user whether 1-2 clips in 45 is acceptable for aggression.
4. **BRIDGES / SLIPS OFF SCREEN — NOT STARTED.** Plan: 'road' / 'rail' bridges get approaches running ~150 m out each side along the
   deck axis (`pr.rot`, highway.js extras): a `lv.lanes` ribbon for a road, a drawn bed for rail; the river already runs 40 m past
   the deck — extend to ~150 m. Slips: most run 300+ m and curve off screen (gate at the end or none); ~1 in 4 bends back alongside
   the motorway and REJOINS (the "secret" path) — then highwayGuard must count "on a lane" as on the road (its `out` is |off| - hw).
5. **SCENERY — NOT STARTED.** dress() has 3 biomes (farm / forest / rocky every 2.2 km): trees, rocks, 'block' barns. Plan: FIELDS as
   rotated `lv.zones` (crops / ploughed / grassLong; give them `_s` and add 'zones' to the trim list in stepHighway), HEDGEROWS along
   field edges (a new 'hedge' prop or rows of small tree squares) + gates, SMALL TOWNS (clusters of small 'block' houses + a church
   on a side lane). Watch tile cost (drawZones paints every zone per tile: few, big zones) and none on walled.

Backups before this round: `shots/look/bak6-{highway,render,hwrace}.js` (bak5-render.js = before the tile fix). A/B scratch
already deleted (`shots/look/suite-*.txt` = pacesuite's own copies, safe to delete).

## 3b. EARLIER THIS SESSION (2026-10-06) — LIVE, phone-tested by the user ("mostly okay")
Faster highway AI (B); timers (CATCH 15 s soft, OFF-ROAD 10 s); slip roads + bridges + extras; speed cameras; roadside debris;
ground-tile speed-up (45 -> 18 ms at CPU x4) + the stand-in following the road. Details: TODO.md 1c, ENGINE.md.

## 4. State — done and live, awaiting the user's phone verdict
- **Track menu**: TEST MODE → CHOOSE A TYPE (Circuits / Rally Stages / Rallycross / Ovals (with Grass Track) / Endless Roads / Test
  Grounds / All Tracks) → that type's list. `menu.js` `CATS` + `CAT_OF` + `catOf()` (an unknown level falls into Circuits).
- **Highway traffic** (`src/traffic.js`): real physics cars, 90-110 km/h, keep left, indicate 1.3 s then cross at 0.9 m/s, follow +
  emergency brake, lean away, wreck → hazards, recycled only OFF screen. LOD: kinematic unless near you or an AI. Sliders TRAFFIC
  0-150 % (default 60 %), LITTER 0-3×; `?traffic=` / `?litter=`.
- **VS AI on the highway** (`src/hwrace.js`): rolling start, CATCH THEM (15 s, soft) / PULLING AWAY (8 s), results by distance. Driver =
  the WEAVER + the MIRROR (A) + the faster defaults (B, §3).
- **Road furniture** (§3 items 3-5): slips, bridges (road / rail / foot / river), cow / cone / boat / smiley solar farm, speed
  cameras on every gantry, debris. None on the WALLED preset.
- **EVENT RULES walkthrough** (`guide.js RULES`) — every new mechanic gets its card in the same task (CLAUDE.md §4).

## 5-NEW. ROUND 7 SUPERSEDES THE LIST BELOW — TODO.md 1c "ROUND 7" (stages S-A .. S-L, the AI DESIGN NOTES, Q1-Q14, the holes).
**WORK IN STAGES: report after each, start the next ONLY when the user clears it.** Testing runs alongside — ASK for verdicts.
Stage 1 (record + questions) done 2026-10-06 late. ANSWERS to Q1-Q14 logged verbatim in TODO 1c (+ S-M store holes). S-A DONE
(the pause TESTING list from src/testlist.js + the FPS / LOW strip top right, test mode) — waiting on its phone verdict + clearance
for the next stage (suggest S-B lab 1 km + off-road area, or S-C animals). KEEP src/testlist.js CURRENT (CLAUDE.md).

## 5. NEXT — the user's order (TODO.md 1c), as of the 2026-10-06 late handover
1. **Phone verdict** on this round (scenery look, long-grass edges, the dirt-patch fix, CATCH THEM now ends). Bugs first, verbatim.
2. **LAB CRASH-TEST AREA** (user, verbatim in TODO 1c): extend the BOTTOM of the lab map; strips of EVERY surface (all tarmacs, gravel,
   dirt, grass x3, mud x2, sand, snow, ice, wet, concrete, broken, kerb) as drag lanes; at the END of each lane EVERY loose object laid
   out to crash into — cones, tyres, tyre stacks, bales, pallets, boxes, crates, bins, sandbags, barrels, tarps, exhausts, bumpers,
   chevrons, flags, tape posts (+ bangers / caravan / podium?). Coverage test: every kind in cones.js + every SURFACES id appears.
   Watch: the lab floor is one square FLOOR (260) shared by kerb / runoff / fence code — extend south as zones INSIDE it, or give the lab
   its own bigger floor (LEVEL.floor) and re-check the benches (drag strip y 240, suspension zone y 162-214). Show options first.
3. **CAMERA JUDDER** (user: "still getting judder"). Measured before: camera 0 skips (hwwobble), the pixel-locked zoom steps every
   5-8 frames. Ask the user to try `?nolock=1`; if it helps, smooth the zoom; else profile frames on a phone-like CPU x4.
4. **AI DESIGN CHAT, then the AI rework** — options from the agreed direction + the crash budget above; per-racer aggression / risk /
   patience; commit to gaps; never wait. Also: racers beaching at slip mouths (stuck-reset ~3 s). A/B with pacesuite on BOTH seed sets.
5. **ON-SLIPS** (merging in) — still open from 1c.2.
6. **Road furniture still open:** lay-bys + SOS phones, services, central reservation, cat's eyes.
7. **AI racers faster everywhere** (circuits too — user: "then work on making ai racers faster").
8. **Vans / lorries** in traffic; traffic on walled untested.
9. **Phone perf** with 5 AI + traffic (untested on a real device); the draw spike on a crash (fps -> 20 headless portrait).
10. Later: a story-mode time / distance limit for highway races (the user's "perhaps").
- After each step: measure, update `ENGINE.md` + `TODO.md` + this file's §3a / §5, hand over with a phone test list.

## 6. Code map (highway work)
- `src/highway.js` — presets (`HW_PRESETS`: motorway 3×3.65 m + 3.3 m shoulder, interstate 4×3.7, dual 2×3.4, walled),
  `createHighway(seed, preset)`, `stepHighway` (the treadmill: road rebuilt ~300 m ahead), `highwayGuard` / `highwayRespawn`,
  `roadFrame(lv, x, y, hintS)` → `{s, off}`, `roadPose(lv, s, off)` → `{x, y, h}`, `roadSpan(lv)`. Road points `lv._hw.pts`
  (`.s`, `.curv`, 4 m apart); lane centres `lv._hw.geo.centres`, half width `geo.hw`; `lv._cfg.shoulder`; litter `lv.litter`.
- `src/hwrace.js` — `createHwDriver(lv, traits)` → `{ drive(car, dt, {cars, hold}), state {line, base, tgt, tv}, relocate() }`;
  `hwFrames(lv, cars)` sets `car._hwf = {s, off, v}` once per step; `hwGrid`, `hwGridSpan`, `hwPutBack`, `createHwFlow`.
  Traits come from `aidriver.js aiTraits(diff, i, n, seed)` (pace, prec, aggression, wander).
- `src/traffic.js` — `createTraffic()`; `clearAround(x, y, r)`, `clearSpan(sA, sB)`, `stats()`; `PER_LANE` 6, `MAX_CARS` 24.
- `src/main.js` — `spawnAI` (l.178), `armStart / atPace / stepStart` (213-229), `aiReset` (317), `stepAI` (329; each AI's `cars`
  = you + AI + traffic), `doRestart` (511), `launch(level, car, opts)` (709), `eventKind` (735). `window.__game` for tools.
- `src/guide.js` — `CARDS` (HOW TO PLAY) + `RULES` decks. `src/menu.js` — menu, setup, pause, results / podium. `src/hud.js`.
- Circuit AI (unchanged this round): `src/aidriver.js` (racing line + measured-grip speed profile, 5 difficulties × 5 personas),
  `src/autodrive.js` (the cautious bench driver — don't replace it).

## 7. Tools (node unless marked)
- `tools/_testlistshots.mjs` — the FPS strip + pause TESTING list in the real game at 390x844 / 844x390 (photos shots/look/sa-*.png;
  counts match src/testlist.js; BACK returns to PAUSED; no page errors). ~50 s, run it hidden. Last: ALL OK.
- `tools/weavecheck.mjs [diff]` — the weaver vs scripted slow cars, 45 scenarios; `WVONE=seed/v/pattern` traces one, `WVALL=1` all.
- `tools/hwracecheck.mjs [s] [diff] [traffic] [preset]` — a full highway race. `HRDBG=1` off-road detail; `HRTRACE=1 HRT0= HRT1=` a
  0.25 s trace of car #1. ~40 s per 60 s, so run it hidden. Last: motorway d2/0.6, d4/1, dual d0/1 ALL OK, 0 off-road.
- `tools/trafficcheck.mjs [dens] [s/phase]`, `tools/treadmillcheck.mjs` (ALL OK), `tools/treadmillshots.mjs`.
- Browser (server on 8080): `tools/menucheck.mjs`, `tools/guidecheck.mjs` (10 cards OK at 6 sizes), `tools/rulesshots.mjs` (rules +
  podium photos + the pause check), `tools/_tfgame.mjs [dens] [nAI]` (scratch: the real game with traffic + AI, fps / sim ms).
- Circuit AI suite, the full regression list, itch.io push steps: `_archive/HANDOVER-2026-10-05.md` §4-§7.
- Scratch: `tools/_patch.mjs`; delete `shots/look/p*.json` after use.
- AI ROUND 2 (2026-10-07): `tools/_hwdriveout.mjs` (beached highway racer recovers - ALL OK), `tools/_jokerexit.mjs [level] [car] [diff]
  [seed]` (the joker branch per 5 m: radius, plan vs actual speed, throttle, how far off the path). Baselines + A/B outputs:
  `shots/look/r2/` (base-* = before R2.1) and `shots/next/shots/look/r2/`. Pre-merge code copy: `shots/look/r2/old`.
- Highway pace / perf (2026-10-06): `tools/pacesuite.mjs [label]` (9 races in parallel, ~50 s; `PSEEDS=31,555,9001` = seed set B;
  `HWT='{...}'` passes through) — always A/B on BOTH seed sets AND weavecheck (must stay 0 hits). `tools/hwjudder.mjs [s] [ai] [traffic]
  [cpu] [query]` (per-frame cost log), `tools/hwprofile.mjs` (CDP profile), `tools/hwwobble.mjs` (camera / zoom per frame),
  `tools/tilediff.mjs [level] [B path] [A query]` (two builds' ground tiles pixel by pixel). Browser tools: run hidden, ≤ 20 s waits.
- Highway content checks (2026-10-06 late): `_slipcheck`, `_guardtest`, `_scenerycheck` (fields: counts, off-road, cost), `_wearleak`
  (wear pruning over 40 km), `_flowtest` (CATCH THEM / PULLING AWAY, 11 scenarios), `_catchreal [src] [kmh] [seed]` (a real race vs a
  cruising player), `_firstslip` (where exits come). Photos: `_bridgeshots2 [preset] [base]`, `_sceneryshots [preset] [base]`.
  `PSEEDS` needs setting in the SAME process (Start-Process node with $env:PSEEDS set first) - a quoted list via powershell -Command broke.
