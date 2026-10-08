# CAR SIM — working agreement

**The brief is `BRIEF.md`** (arrived 2026-09-27). **`§8` is the read of it against the hard-won rules — read
that before writing a line.** The current task is in `PLAN.md`; the live queue is `TODO.md`.

This file is the accumulated operating knowledge of four finished builds on this machine:

| Project | Folder | What it taught |
|---|---|---|
| **AREOLE** (plant / solar-system survival sim) | `../plant simulator/`, `../CactusAPP/` | the engine seam, sub-stepping, diffusion fields, photograph-it, HUD standard |
| **BLAZE CAPITAL** (physics arson puzzle) | `../Arsonpro/` | Matter.js discipline, the level recipe, joint rules, phone-first HUD |
| **PAVEMENT EMPIRE** (ant swarm / dig sim) | `../Penzants/` | hundreds-of-entities performance, re-lay don't patch, editing discipline |
| **BITTER TRADE** (apothecary shop sim) | `../BitterTrade/` | layout testing, hidden-numbers overlay, travel-time budgets, spiral-proofing |

**None of the rules below are theory. Every one of them is a bug that cost real hours.** Do not re-learn
them here.

---

## 0. PICKING IT UP COLD — the first five minutes

1. Read the build doc (`BRIEF.md`), then this file.
2. Read `TODO.md` — **START HERE** once it exists. It holds where the balance sits, what is queued, and the
   user's own priority order. It outranks any older planning doc.
3. **Run the thing and LOOK at it** before changing anything (§5).
4. If the work is VISUAL, verify it by photographing the real game in a real browser — never with a
   synthetic harness (§3).

---

## 1. HOW THE USER WORKS — read this first

Standing preferences. **These override your defaults.**

- **Discuss before building anything large. Get permission before code changes.** Propose the shape, get a
  yes, then build. Do not arrive with a finished thing nobody asked for.
- **One task at a time.** Questions up front → build → deliver (link + what to test) → stop and ask for the
  next. If you get stuck, stop and ask; do not improvise a second feature to get around the first.
- **Plan first, then code, then sync the docs.** In that order, every time: add or tick the item in
  `TODO.md`, make the change, then update the as-built doc so it matches the code. Planning docs may run
  ahead of the code; **build docs may never drift from it**.
- **Watch for bloat.** Every addition is a cost. If a feature can be three lines instead of a subsystem,
  make it three lines. "More code" is never the deliverable.
- **Never change established visuals unilaterally.** If it is on screen and it already looks how they want
  it, propose first. Hard rule, not a courtesy. When something is drawn off-screen or wrong, fix the
  *cause* — do not move the agreed layout to hide it.
- **Hard is good; unfair is not.** Bad choices and passivity should cost the player, quickly. Being punished
  by something invisible, unexplained or unavoidable is a bug.
- **Slow burn.** When in doubt: smaller steps, weaker player, more hostile world, more beautiful moment.
- **Say the honest state.** If a change did not work, say so, with the numbers. An optimistic report that
  later collapses costs far more than an unwelcome one now. Report what you measured, not what you intended.
- **Tell them what to test.** They playtest **on a phone**. Finish every piece of work with a short, specific
  list of what to look at and what would count as it being wrong — never "let me know how it goes".
- **Let them test MAJOR changes ASAP** (user, 2026-10-06: "remember let me test major changes asap"). The
  moment a major change works (a new AI, a new mode, a new system, anything that changes how the game
  plays or looks), STOP and hand it over: the link, "refresh", the test list. Do not stack the next feature
  or a polish pass on top of an untested big change; do not batch several big changes into one hand-over.
  Small follow-ups can ride along; anything they would notice in play goes to them first.
- **Keep `src/testlist.js` current** (user, 2026-10-06: the in-game TESTING list, pause menu, test mode). Every
  feature handed over for a phone test gets an entry IN THE SAME TASK (where / try / wrong); when the user
  approves one, delete its entry and log the verdict in TODO.md. The list in the game = the list in the chat.
- **They will interrupt mid-task, with bugs and with design ideas.** Bugs are priority: fix, verify, tell
  them to reload, return to what you were doing. Ideas are spec: write them into `BRIEF.md` or `TODO.md` in
  the same turn, before they are lost.
- **Design conversation works best as structured previews plus open prompts, alternated** — give them three
  concrete options to react to, then one open question, rather than a wall of prose.
- **The live folder is live.** They may be testing while you edit. Do not leave the game in a broken state
  between two edits if you can land them as one.

### Saving time, credits and mistakes (user asked, 2026-10-04: "update the working agreement as we work")
**Add a line here whenever a session teaches something.** Each is a real cost from this project.
- **Don't "fix" a feel the user has just approved.** They said "contact is ok"; I tightened the AI following anyway and had to revert
  ("it felt ok before, put it back"). A tool number that looks bad is a question for the user, not a licence to change the feel.
- **Clear level state between runs in one node process** (`clearWear()`): wear from the previous run changed the bench lap 60.8 -> 52.4 s.
- **Sessions get cut off.** Update `HANDOVER.md` §4 + tick `TODO.md` after EACH finished item, not at the end. A cut-off
  session must leave the next one a correct "where we are" in under a minute.
- **Cold start = HANDOVER.md, then TODO.md's PLAN block, then only the code you need.** Do not re-read ENGINE.md /
  SPECS end to end; grep them.
- **Before RE-LAYING a level, keep the old one runnable** (e.g. `?level=thruston-old` or a copy in `_archive`) and show
  the user both. Thruston's re-lay was judged worse than the old one, which survived only in a temp scratchpad patch.
- **Reference images and look/ photos go in the project** (`art/ref/`, `shots/look/`), not the session scratchpad —
  scratchpads are per-session temp and tools with a hardcoded scratchpad path break next session.
- **Traced track shapes need a minimum corner radius** (half width + kerb + margin; Thruston uses 15.5 m) before kerbs go on
  them. A tight corner looks fine in the overview and terrible at 844x390 (kerbs fan into wedges). `kerbside.mjs` checks folds
  AND kerb fans. **Say "measured" only for numbers a tool printed** — a diagnosis read off a photo is a guess until a tool agrees.
- **Patch scripts go through the Write tool, not a bash heredoc**: template literals and quotes inside a heredoc broke the
  shell parse (nothing ran, a wasted round). Write the .cjs to the scratchpad, then `node` it.
- **lab.js is ORDER-SENSITIVE (const before use) and it is the LIVE game.** Twice on 2026-10-04 a data block landed above what it
  used and the phone got a dead page for a minute. Patch scripts: write to `src/lab.next.js`, `node -e "import('./src/lab.next.js')"`,
  and only then copy it over lab.js. Check `grep -n "^const X"` for every name a new block uses.
- **Never measure frame time while another browser tool runs** (2026-10-04: a background racecheck tripled Slidden Hill's slow frames).
- **A frame-time change is noise until an A/B on the same run says otherwise.** The machine's load moves the median by ~1 ms
  between hours; compare with/without in back-to-back runs before optimising or reporting a cost.
- **A visual fix gets the SAME tool before and after, measuring every side effect** (2026-10-04: the pixel lock fixed the tile shimmer
  and silently made the camera stutter 50x worse — `wobblecheck` would have caught it before the user did). Keep an A/B flag (?nolock=1).
- **Check a prop's whole FOOTPRINT, never its centre, and never exempt "big" props from the road check** (a lorry and race
  control stood on Brands Snatch's road). `tools/propcheck.mjs` covers every level — run it after adding scenery.
- **aidrivecheck with SEVERAL levels in one process is order-dependent** (2026-10-04: Knobhill before Thruston made the AI 9 s slower on
  Thruston with unchanged code; a clean harness showed no leak). A/B one level per process, or the same level list on both sides.
- **Isolate before you combine:** three AI loose-surface tweaks were each harmless and together threw the 4x4 off the road; one piece
  (wheelspin) was the real cause of the user's complaint. A/B each part separately with the tool that measures the complaint.
- **When the user names a PLACE ("Slidden, dirt to tarmac"), dump the racing line + speed profile THERE first** (R, mu, target v per
  point). Three rounds went into the driver's reflexes (real, but small) before a line dump showed a KINK at the surface edge — the bug the
  user kept seeing, worth 3-8 s a lap. Look at the plan before tuning the driver.
- **`node --check` is NOT a load test for an ES module** (2026-10-04: a `// comment` appended mid-line swallowed the rest of render.js's
  line; --check passed, the browser threw "Unexpected token export" and the LIVE game was dead until a tool happened to load it). After
  every patch: `node -e "import('./src/X.next.js')"` (render / hud / main need the browser: load the page and read pageerrors).
  SAME BUG AGAIN 2026-10-04 (paint patch: a trailing comment on a `const a = ..., b = ...` line; live down ~1 min). Cheap catch: copy each
  patched file to chk_X.mjs and node --check THAT (parsed as a module it fails). NEVER put a // comment on a patched line that continues.
- **iOS Safari:** any touch control needs release-on-blur/visibilitychange/pointercancel/lostpointercapture, or a
  system gesture leaves a pedal held forever.
- **ONE SYSTEM, NOT TWO THEN ONE** (user, 2026-10-07: "check this into the work agreement to not do stuff like this, no 2 engines then 1
  engine, it should be forseen or asked at least"). The highway got its OWN AI driver (hwrace.js) beside the circuit one (aidriver.js), and
  the merge became a later job: every AI change since has been done twice or done to only one. BEFORE building a second version of
  anything that already exists (a driver, a physics path, a renderer, a menu, a sound voice), EXTEND the existing one, or ASK the user
  first with the trade-off spelled out ("a separate X now is quicker; merging later costs Y"). Never leave "merge them" as a TODO.
- **itch.io pushes only when told** (user, 2026-10-07: "dont update itch until told to"). Live link + tunnel are fine; butler is not.
- **Say what does NOT cover a case** when handing over (the AI round 1 hand-over said "circuits only" only at the end): put the scope
  limit FIRST, so a phone test is not spent on a mode that was never changed.

---

## 2. ENGINEERING RULES LEARNED THE HARD WAY

1. **IDENTICAL OUTCOMES ACROSS DIFFERENT INPUTS MEAN A BUG, NOT A BALANCE PROBLEM.** When results do not
   vary with the inputs, stop tuning and instrument the mechanism. Four balance passes went into "fixing" a
   simulation that was pinned at zero because a function existed and was never called from anywhere. A
   per-tick dump of the driving variables would have found it in one pass.
2. **Verify by measurement, not by reading.** Write a throwaway `_test.mjs`, run it, delete it. Confidently
   correct changes are routinely, measurably wrong. Reading the code is a hypothesis, not a result.
3. **Do not tune on noise.** Before trusting a number, ask how it was sampled. The peak of a rare event
   measured from a handful of spot samples is a noisy statistic — you will tune it up and down and learn
   nothing. Measure occupancy continuously over a long run, not snapshots.
4. **Sub-step anything time-based. If your system takes `dt`, LOOP — do not clamp.** A clamped timestep ran
   a whole fluid system up to 32× slow at fast-forward and hid behind two other "fixes" before it was found.
5. **Sim time and wall-clock time are different clocks, and mixing them generates bugs.** Anything the
   player WATCHES (skids, sparks, particles, animations) runs on the wall clock, or it completes inside one
   frame at high speed and is never seen. Anything the world DOES runs on sim time. Bookkeeping must be
   speed-independent and accounted exactly.
6. **One seam between the game layer and the engine, and every default must be a no-op.** Nothing in the
   engine should know what an upgrade, a class or a part is — it reads multipliers out of one object
   (`state.mods`). Every modifier defaults to 1.0 (0 for additive ones), so an un-upgraded entity behaves
   exactly as it did before the system existed. If engine code ever reads a proper noun, the seam is broken.
7. **Never gate a core process entirely on a resource that can hit zero.** If progress is multiplied by
   cash/fuel/food, a player at zero is stuck at exactly zero and cannot earn the thing that unsticks them.
   Put in a floor, or run it on its own clock.
8. **Any CONSTANT pressure above the heal threshold is a death sentence, not a difficulty.** If a system
   only recovers below some level, a permanent pressure above it makes failure pure arithmetic with no
   counterplay. Constant hazards need a tolerance floor below which they cost nothing.
9. **Anything cyclic must be measured on something that does not vanish in that cycle.** A failure check
   gated on leaf area fired every autumn, when leaves are supposed to be gone. Measure on what persists.
10. **Report what is ON the entity, not what was BOUGHT.** A HUD reading the purchase flag announced a state
    that was untrue most of the time. Read live state.
11. **Explicit integration is only stable at low rates.** Diffusion/propagation coefficients must stay well
    under 0.5 per step or the field oscillates and destroys itself. Two-thirds of a winter's snow vanished
    silently at an array cap for want of one clamp.
12. **Compute into deltas, apply once.** Updating a field in place while reading it produces an instant
    cascade across the whole grid in one frame instead of a front that travels. Fill a delta buffer, then
    apply it.
13. **A symbol used but never imported only throws when that line runs.** If your frame loop catches and
    continues, this presents as "part of my UI vanished", not as a crash. When something is invisible, check
    the console before theorising.
14. **Clean up processes you start.** Dev servers and tunnels stack up invisibly and get this machine's
    memory guard to kill your work mid-session. One of each, always (§5).
15. **A benchmark measures what you actually built, not what you meant.** A build priced its whole toolset
    off a bench that fired every tool at the same target — and the table was junk, because the delivery
    mechanism was broken and half the tools never reached the target at all. Before trusting any comparison,
    verify the mechanism it depends on: fire one, watch it, confirm it arrives.
16. **Anything frozen, sleeping or culled ignores what you do to it.** If entities sleep for performance,
    anything acting on one must wake it first — otherwise the call succeeds, changes nothing, and you debug
    the wrong end for an hour. Worse in physics: a force scaled by the mass of a static body is Infinity,
    and the entity's position becomes NaN on the next frame.
17. **Things that are alive by design cannot be tested for "settled".** A scene with traffic, weather or
    wandering entities will never read as at-rest. Measure it before the first event fires, or measure the
    thing you actually care about (damage, position, state) rather than motion.
18. **A rule that never fires looks exactly like a rule that works.** Hand-written tables (reactions,
    pairings, part compatibility) rot silently when new content is added. Write a coverage test that walks
    the whole content list against the table and reports gaps, and run it whenever content is added.
19. **A layout test that has never failed is not a layout test.** Prove it by reintroducing the bug it is
    meant to catch and confirming it fires, then restore. (§3, the overlap harness.)
20. **Non-finite numbers are a silent renderer killer.** A real browser throws on a `NaN` gradient stop, arc
    radius or ellipse arg where a stub canvas shrugs. Assert finite on anything fed to the 2D context, and
    remember that one throw inside a caught frame loop reads as "half my UI disappeared".

---

## 3. PROCESS

**If a change is VISUAL, PHOTOGRAPH IT.** The single most expensive lesson available. Drive the real app in
a real browser and screenshot it. Counting draw calls is not looking at the picture.

> A snow system was "fixed" FIVE times off synthetic tests that were all correct and all irrelevant. The
> harnesses used three clouds; the real game used 120, which buried every column to its cap in two game
> days. Nucleation, drift and ground roughness all worked exactly as measured, and were completely
> invisible underneath a permanent white blanket. **A synthetic harness tests the code you wrote; a
> screenshot tests the game that exists.**

> **And a screenshot proves one screen at one size.** A three-line tutorial banner shipped with all three
> lines drawn on top of each other, unreadable, because every harness checked LOGIC and none checked
> LAYOUT. The user caught it, not the tests — *"you should be spotting issues like this."* The answer is a
> text-overlap harness: wrap `ctx.fillText`, record the bounding box of every string the game draws, and
> report any two on the same layer that overlap — across every panel, at four screen sizes. **Build it
> early and run it after ANY change that draws text.** (See `../BitterTrade/_overlap.mjs`.)

**Check layout in every orientation and at several widths, not just "it renders".** These are phone games
played portrait and landscape. Size circular and visual elements off `min(W,H)` or cap them to width; size
horizontal text off `W`. Test narrow.

**When you build a test harness, match the REAL entity counts.** Three of something is not a test of a
system that runs hundreds. One customer is not a test of a rush.

**Instrument before you tune.** Measure the current state → form a hypothesis about the mechanism → change
ONE thing → measure again → keep or revert. **Write the measured before/after into the comment next to the
constant you moved**, so the next person knows what has been tried and what it did.

**If you cannot measure it, the player cannot feel it — so cut it.** A build added a tool, then rewrote it
four times chasing an effect that never showed up in the numbers; its best result was 5% for a third of the
cost of the thing it was meant to help. It was deleted, and the deletion was the right call at
implementation one. Set the bar before you start: what number should move, and by how much?

**Leave the history in the comments.** The most valuable comments in a mature codebase are not what the code
does — they are what was tried, what it measured, and why it was rejected.

**Re-lay it rather than patch it.** When the user says a thing "doesn't read right" or "won't work like
that", that is a geometry or layout problem, not a tuning problem. A build patched an airport's layout three
times — one thing at a time — before giving up and re-laying the whole thing on one grid, which took less
time than any single patch round and actually worked. Hear "doesn't read right" as "start again from the
shape".

**A system the player reads by feel is a system YOU cannot debug by feel.** Any hidden number (grip, wear,
heat, tune, temperament) must be dumpable on a dev flag (`?dev=1`) and from a script, **before** the system
it describes is built. That overlay is not a nicety; it is the only instrument you will have.

### Editing without wasting an afternoon
Self-inflicted wounds, each one real time lost.

- **Put comments on their own line when patching.** Appending ` // why` to a replaced line swallows the rest
  of that line — every time. Five syntax errors in one session, each a file that looked fine in the diff.
- **Match anchors byte for byte, indentation included.** `    { const x` is not `      const x`. A pattern
  that misses is the commonest reason a "successful" edit changed nothing.
- **A multi-replacement script that throws part-way writes NOTHING.** Correct behaviour, but it means a
  failed run silently discards every edit you thought had landed. Re-read the file after a failure.
- **Prefer one careful edit to a chain of clever ones.** Regex sweeps over coordinates ("replace 2086 with
  2456") will hit numbers you did not mean, in places you will not look.
- **Test both seeds.** A scene can settle perfectly on one and tear itself apart on the other.

---

## 4. ART & DESIGN

### The thing worth protecting
**Systems that talk to each other.** In the plant sim: wind drifts snow → snow loads branches → load breaks
decayed wood → broken wood rots the soil → sour soil calls the pests that eat the roots that feed the leaves
that pay for everything. In the shop sim: a rushed pot scorches → the scorch smokes → smoke drifts into the
shop → patience drains → the customer walks → standing falls. Very few small games have that, and **it is
the whole asset**. Protect the web of consequence over any individual feature. Every new feature should plug
into the chain, not sit beside it.

**Nothing arrives arbitrarily.** Every event and hazard should be caused by something the player did. A
random event is noise; a caused event is a mechanic.

**The build must be legible on the body.** What the player invested in should visibly change what the thing
looks like — on the object itself, not in a menu. Weight it so the FIRST few steps of a line carry real
visual change, or intent only shows at depth, which a real run never reaches.

### Readability beats fidelity
**If the player cannot find it, it does not exist.** Fruit was photographed on a real canopy as orange specks
a few pixels across, lost among the leaves — the HUD said "4 RIPE" and the player genuinely could not see
them. Things that matter need size, contrast, a dark rim against busy backgrounds, separation from whatever
they are drawn on top of, and motion if they are urgent.

Related: **check what a thing is drawn *over*.** Fruit was drawn at exactly the node where that node's
foliage is drawn, so it was buried by definition.

### HUD discipline
- **The four corners have OWNERS.** Allocate screen space up front and let no two systems share a lane.
- **Canvas-drawn HUD does not participate in layout** and will happily draw through a DOM button. Reserve
  the room explicitly.
- **Nothing essential lives in a closeable panel.** Time control was lost that way; so was a death screen's
  restart button.
- **Collapsed by default.** A gauge is an icon until tapped, and only one expands at a time.
- **A tap on the HUD must never also reach the world.** Consume it.
- 12px minimum margins, touch targets ≥ 30px (≥ 44px for anything used repeatedly), 8px between controls.
  Check it at phone width, not just desktop.
- **Touch controls are day-one, not a port.** Decide the scheme before the movement code is written and
  photograph it at phone size. For a driving game this is the single highest-risk UX decision in the
  project — settle it first, in conversation, with pictures.
- **No player character and no aiming arc** unless the brief asks for one: tools and taps act where the
  player touches.

### Colour language
Colour carries meaning; never pick one ad hoc. Establish a small table up front — interactive, resource,
warning, danger, passive — plus a per-state colour, then use the SAME colour and label everywhere that state
appears, so a floating number and a warning line always agree.

### Feedback
- **A number with no label is meaningless.** Every floating number says WHAT happened, in that thing's colour.
- **Batch them.** Something ticking a fraction per frame must not emit a label per frame — accumulate and pop
  once the total is worth showing.
- **Cap what is on screen**; drop the oldest rather than stacking a wall of text.
- **Every audio cue needs a visual twin.** The user playtests on a phone which may be muted. If a pillar of
  the design is "you hear it", build the silent version at the same time as the sound, not afterwards.
- The cheapest large win in most builds is surfacing state you are ALREADY computing and throwing away.
  Check for that before building anything new.

### Tutorial
**A first-run walkthrough is required, and it is updated in the same task as any mechanic that changes it.**
Not a follow-up ticket. An outcome the player cannot diagnose from what the game tells them is a bug, not
difficulty.

---

## 5. THIS MACHINE, AND HOW THE USER SEES THE GAME

**Stack:** native ES modules, no bundler, no build step; HTML5 canvas; a small `serve.mjs` static server
with `no-store`/revalidate so a phone refresh always gets current code. Physics, if needed, is Matter.js —
let it own the dynamics and keep your own bookkeeping (integrity, wear, stress) as YOUR data on top of it
(rule 6).

**The user is NOT on the PC's Wi-Fi.** LAN URLs are useless to them. Two routes:

- **itch.io (preferred, since 2026-09-26).** All four games are live under the account `Fuzzlepun`, pushed
  with butler: `C:/Users/Admin/Desktop/G/GamesStudio/tools/butler/butler.exe`, staging in
  `../ready-to-play/<game>/` (static files only), `BUTLER_API_KEY=<key> butler.exe push
  ready-to-play/<game> fuzzlepun/<slug>:html5`. The user supplies the key. butler cannot create a page or
  set metadata — that is web-UI only. Slugs have no hyphens; check with the `my-games` API before pushing.
- **Cloudflare quick tunnel (legacy).** `"../tools/cloudflared.exe" tunnel --url http://localhost:<port>
  --no-autoupdate`. **Kill the old one first, by PID, never `taskkill /IM`** — other projects' tunnels run on
  this machine and killing theirs breaks their session. This box has ~6 GB and sits near 90%; its memory
  guard has killed the dev server and tunnel mid-session more than once, which is why itch.io replaced this.
  Old links keep working (same server, served from disk) — so "that didn't change anything" is never
  explained by a stale URL. Go and find the real bug. And never hand out a link you have not just curl'd.

**Photographing it:** headless Chrome over CDP from a Node script — `Emulation.setDeviceMetricsOverride`
(844×390 landscape / 390×844 portrait, DPR 3, mobile) plus `setTouchEmulationEnabled`, taps via
`Input.dispatchTouchEvent`, read HUD text back with `Runtime.evaluate`. Playwright exists in
`../plant simulator/plant-sim/node_modules` (launch with `channel: 'msedge'`) if that is easier. Expose the
whole game on `window.__game` so a harness can drive it, and support debug query params (`?dev=1`,
`?seed=5`).

**One `serve.mjs`, one tunnel, always.** And never kill another project's processes.

**Keep the tunnel UP (user, 2026-10-03: "the tunnel went down when you went down — keep it up").** Claude Code reaps
its OWN background shells when the machine runs low on memory while the session is idle (this box sits near
0.4 GB free). So start the server and tunnel as INDEPENDENT Windows processes, never as session background tasks:
`Start-Process node serve.mjs` (WorkingDirectory = the game) and `Start-Process GamesStudio/tools/cloudflared.exe`
`tunnel --url http://localhost:8080 --no-autoupdate`, hidden, logs + PIDs in `GamesStudio/tools/logs/` (the URL is
in carsim-tunnel.err). Stop them only by those PIDs.

---

## 6. BUILDING A LEVEL / A STAGE — the recipe

**FAST PIPELINE for a real-track parody (worked out on Thruston + Castle Cum, 2026-10-04):** (1) Wikimedia Commons API search for
"<track> track map.svg" -> download the PNG thumb via the API's thumburl (Special:FilePath gets rate-limited) into art/ref/; also the
circuit's own site map / a corner guide for names + direction. (2) `tools/mapgrid.mjs` crops -> read the centreline in map px.
(3) `traceTrack(MAP, { mpp, cx, cy, rMin: 15.5 })` + `createSubtrack(..., dense = true)` + `autoKerbs(minTurn 20, mergeGap 12)`;
check with `traceoverlay` (fits the map?) and `kerbside` (folds, kerb fans). (4) Measure corner distances (nearest point to named
map px), then ALL scenery by distance + offset through `trackKit` (filters off road / lanes / floor). Perimeter road =
`ringAround`, never an offset. (5) `barriercheck`, `solidcheck`, `lapdriver` x 8 cars, `crestcheck --flat` for any elevation,
`framecheck` + `profile`, photos (`ccshots`-style) at 844x390, overview. Ask the one round of questions BEFORE step 3, with
the research in hand so the options are concrete.

One level (or day, or track) is **one task**: ask, build, deliver, then the next.

1. **Ask first.** One round of structured questions: style/reference, time of day, features, the hidden
   chains, what the player is meant to fail at, and the protected item. No assuming.
   **Covers need a base (user, 2026-10-03):** wet, snow and ice are layers OVER a surface. If a track design
   does not say what is underneath them, ASK — never assume tarmac.
2. **Build it as data, not code** — a table the sim reads, with a header comment listing what is in it,
   every hidden chain, and the intended failure. Never hard-code a position that should be a number in a
   file; the first thing you will be asked for is "move that three metres closer".
3. **Check with numbers, not vibes.** Run it headless at real entity counts and report the measured figures:
   the money, the failures, the frame cost per step, and the budget that defines the design (for a driving
   game: lap time, time at full throttle vs. braking, seconds of travel vs. seconds of acting). Measure
   again with the level's big event running, not only at rest.
4. **Photograph it** at phone size (844×390) and whole-map fit, and LOOK at it.
5. **Test every hidden chain with a script**, and write the measured result (seconds, $) into the header
   comment.
6. **Register it**; if the engine or the shared kit changed, re-test every previous level.
7. **Deliver**: the link, what to test, and what would count as wrong.

---

## 7. THE BUILD DOC — arrived 2026-09-27

It is in `BRIEF.md`, verbatim, with an **OPEN QUESTIONS** list appended that is the only part Claude wrote.
§8 below is the read of it against §2. What was asked of the doc when it landed, kept here as the recipe for
next time:

1. Save it as `BRIEF.md` in this folder. Keep unagreed sections marked **[PROPOSAL]**.
2. Read it against §2 and write a **§8 NOTES SPECIFIC TO THIS PROJECT** into this file — one paragraph per
   rule that the design points straight at. On previous projects that section was the most useful page in
   the repo. For a car sim, expect at minimum:
   - **What the fixed internal step is, and what runs on it** (rule 4/5). Vehicle dynamics, tyre load and
     wear on sim time at a fixed step; skid marks, dust, camera shake and damage flashes on the wall clock.
   - **Where the engine/game seam is** (rule 6) — one `mods` table carrying grip, power, mass, wear and
     payout multipliers, every one defaulting to 1.0, and nothing in the physics that knows a part's name.
   - **Which hidden numbers need the dev overlay before the system is built** (§3) — grip, slip angle,
     temperature, wear, fuel, damage.
   - **Which pressures are constant** (rule 8) — wear, fuel burn, heat, damage, rain — and what their
     tolerance floor is.
   - **Which resource can hit zero and gate the loop** (rule 7) — cash for repairs is the classic spiral;
     prove a deliberately awful run can climb out.
   - **The control scheme, decided and photographed at phone size before movement code exists** (§4).
3. Then propose the **first slice** — the smallest thing that is playable and shows the core feel — and wait
   for a yes before writing code.

Ask these before building anything:

- **What is the fantasy?** Racing against opponents, driving as craft, hauling, destruction, building and
  tuning, or survival on a road?
- **What is the camera?** Top-down, side-on, chase, or fixed per-stage. This decides everything about art.
- **What is the economy, and what is the dopamine tick?** Where does the number go up, and what pays for
  what?
- **What is the causal chain?** The thing that makes it this team's game rather than a driving toy: what
  feeds what, and which failure cascades. Name it before the first line of code.
- **What is the protected thing** in a stage — the tempting, risky bonus?
- **Phone portrait, landscape, or both?**

---

## 8. NOTES SPECIFIC TO THIS PROJECT

Written 2026-09-27 from `BRIEF.md` against §2. Each note names the rule it comes from. Nothing here is a
change to the brief — where the brief and a rule collide, it is flagged as an open question in `BRIEF.md`.

**THE LAP-TIME BENCHMARK IS THE INSTRUMENT THIS WHOLE GAME IS BUILT ON. BUILD IT BEFORE THE ECONOMY.**
(rules 1, 2, 3, 15; §3.) Eight components × ten pips × multiple levels × three archetypes is a tuning space
no amount of driving can cover, and "Pips 1 to 9: incremental, low-cost linear stat increases" is a direct
invitation to ship 27 purchases the player cannot feel. The answer is a **scripted driver that runs a
headless lap** — fixed inputs or a simple racing-line follower — reporting lap time, top speed reached,
seconds at full throttle, seconds with a locked or sliding tyre, and total slip. Then every pip is answerable
with a number: *how many tenths?* Set the bar in advance — a pip that cannot move lap time is a pip that must
be cheaper, merged, or cut (§3: if you cannot measure it, the player cannot feel it). **And verify the
benchmark before trusting its table** (rule 15): watch one lap of the scripted driver in the real game with
your own eyes. A bench where the driver understeers into every wall prices every component wrongly and looks
exactly like a balance problem.

**Sub-step the vehicle at a fixed internal rate; never hand it the frame `dt`** (rule 4). Tyre friction near
the grip limit is a stiff system — at 60 Hz and 40 m/s a car covers two thirds of a metre per step, and the
lateral force it should have felt halfway through the corner is never applied. Loop the physics at a fixed
step (start at 120 Hz, measure) and consume leftover time as an accumulator. The failure mode is not a crash:
it is that the car grips differently on a good phone than a bad one, and every tuned number becomes a lie.

**Split the clocks explicitly** (rule 5). On the **fixed physics step**: velocity, slip, RPM, gear state,
fuel, wear, damage, lap and split timing. On the **wall clock**: skid-mark fade, exhaust particles, screen
shake, the shift light's flash, damage flashes, camera lerp. Lap times are bookkeeping and must be exact and
frame-rate independent — accumulate them from the fixed step, never from `performance.now()` deltas across a
stutter.

**Guard every division in the tyre model, or the car will vanish** (rule 20). Slip angle is
`atan2(lateral, |forward|)`, the friction direction is a normalised velocity vector, and weight transfer
divides by wheelbase — all of which are fine until the car is stationary, which it is on frame one of every
race. One `NaN` propagates into position within two steps and the car is gone, silently, because the frame
loop caught the draw error. Assert finite on position, velocity, heading and RPM every step while building,
behind the dev flag.

**One seam: a `mods` table the physics cannot see past** (rule 6). The pip calculator's whole output is a
flat object of multipliers — `power`, `torqueCurve`, `shiftTime`, `inertia`, `gripLat`, `gripLong`,
`brakeTorque`, `mass`, `rigidity`, `fuelCap` — every one defaulting to **1.0**, so a stock car drives exactly
as it did before the upgrade system existed. Nothing in the vehicle model may contain the words "engine
level", "pip" or "wagon". Archetypes are a base-stats table plus a sprite plus a cap table, and nothing else.
This is also what makes the benchmark cheap: the harness sets `mods` directly and never touches the garage.

**Hard caps are where "identical outcomes" will come from** (rule 1). If the estate's grip cap clamps below
what its first tyre level already delivers, every tyre purchase after that does nothing and three archetypes
converge into one car with different sprites. Dump, for each archetype, the value of every stat at pip 0 and
at every cap, and confirm the cap is above the reachable range at launch. Where a cap does bite, the garage
must **say so on the meter** (§4, rule 10) — a greyed-out head-room marker, not a silent purchase.

**"Top 3 pays, 4th pays nothing" is rule 7 with the safety off.** A player whose car cannot make the podium
has no income, and no income means no upgrade, and no upgrade means no podium. That is a dead save arriving
from a reasonable decision. It needs one of: a participation payment that always covers an entry fee, an
always-winnable bottom tier, or rival speed scaled to the player's own build. **Prove it by scripting a
deliberately awful run** — cheapest car, worst upgrade order, finishing 5th — and confirming it can climb
out. That test is worth more than any amount of tuning (this is the Bitter Trade lesson repeated).

**Fuel weight and chassis damage are constant pressures, so they need tolerance floors** (rule 8). The brief
prices the fuel tank as capacity against weight — fine — but if fuel burn plus a damage-driven performance
loss puts the car below the pace needed to podium, the race is decided by arithmetic before the first corner.
A light scrape must cost nothing. If damage persists between races and repairs cost money, that is rules 7
and 8 **together**, the dangerous combination: a bad crash takes the money that would have fixed the car. Put
a floor on repair cost, or keep damage per-race.

**Read the car, not the receipt** (rule 10). The HUD and garage meters show the live computed value — current
grip with this tyre on this surface at this load, current power at these revs — not "Tyres: Level 2". A
player who has bought a level whose effect is capped away must see the true number.

**The tacho needs a visual twin because the phone is muted** (§4). Synthesised engine note tied to RPM and a
squeal on lateral slip are the brief's feedback channel, and on a silent phone that channel does not exist.
Every audio cue ships with its silent partner in the same task: a tacho with a shift light for revs, a
visible tyre-smoke puff and a skid mark for slip, a flash and shake for impact. Build both or neither.

**Touch controls are the highest-risk decision in this document, and they are decided first** (§4). The brief
asks for steering plus throttle plus foot brake plus handbrake plus two shift buttons — six controls, on a
phone, while steering. That is more than the screen has room for at 30 px minimum targets, so something
merges (auto throttle? brake-on-release? automatic transmission as the default and sequential as an opt-in?).
Decide it in conversation with a picture at 844×390 **before the movement code is written**, and remember the
tap-consumption rule: a thumb on the throttle must never also reach the world.

**Recommendation: write the vehicle model by hand; do not put the car in Planck.js.** The brief offers it as
an option. Per-axle lateral friction, brake lockup and a handbrake are around 150 lines of vector maths that
we need full control of to instrument (rule 2) and to keep the `mods` seam clean (rule 6); a rigid-body engine
hides the exact quantities the benchmark needs behind a solver, and rule 16's Infinity-from-static-mass trap
lives in exactly this kind of code. Wall collisions do not need a solver either — segment barriers plus an
impulse reflection give the brief's `impulse = Δv·m / Δt` directly. Blaze Capital uses Matter.js because
buildings need a constraint solver; a racer does not.

**Skid marks are the one unbounded array in the design.** They accumulate for a whole race at every locked or
sliding tyre, four per car. Cap the buffer and drop the oldest (§4 feedback discipline applies to marks as
well as numbers), draw them to an offscreen surface rather than re-stroking thousands of segments every frame,
and measure the frame cost with the buffer **full**, not empty (§3: match real counts).

**The tilemap is data, not code, and the racing line is data too.** Track geometry, checkpoints, timing gates
and barriers live in a file — the first request after the first lap time comes back will be "move that
corner", and that must be a number in a file, not a refactor. If a scripted driver exists (it must), its
racing line belongs in the same file as the track.
