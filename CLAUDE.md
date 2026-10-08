# RAC3R - engineering guide

Top-down, phone-first racing game. Native ES modules and HTML5 canvas. No bundler, no build step.
Run: `node serve.mjs`, open http://localhost:8080. Debug flags: `?dev=1`, `?seed=N`.

Where things live:
- `TODO.md` - the live queue. Start here.
- `ENGINE.md` - as-built reference. Search it; do not read it end to end.
- `BRIEF.md`, `PLAN.md`, `SPECS-*.md` - design intent.
- `src/testlist.js` - the in-game list of features awaiting a phone test.
- `tools/` - headless checks and screenshot scripts.

Git, GitHub, itch.io, tunnels and where secrets live are documented in `../README.md`.

Old versions of this file, with the full project history, are in git. Do not rebuild them here.

## 1. Working with the owner

- Discuss before building anything large. Propose the shape, get a yes, then build.
- One task at a time: questions, build, hand over, stop.
- Do not change established visuals without asking. If something draws wrongly, fix the cause.
- Report what was measured, with numbers, not what was intended. Say so when a change failed.
- The owner playtests on a phone. End each piece of work with what to look at and what would count
  as wrong. State the scope limit first (for example "circuits only").
- Hand over major changes as soon as they work. Do not stack features on an untested change.
- Keep `src/testlist.js` current. Each handed-over feature gets an entry in the same task.
- Update `TODO.md` and the as-built docs in the same change as the code. Build docs never drift.
- The live folder is live. Never leave the game broken between two edits.
- Hard is good, unfair is not. Anything invisible, unexplained or unavoidable that punishes the
  player is a bug.
- Do not push to itch.io until told. Never put keys, tokens or tunnel URLs in the repo.

## 2. Code standards

These apply to all new and changed code. Existing code that breaks them is tracked in `TODO.md`
under CODE QUALITY OVERHAUL. When you touch a function, bring it up to standard.

### Naming
- Names are whole words that say what the thing is: `deltaX`, `speedMetresPerSecond`,
  `nearestBarrierSegment`. Never `dx`, `sp`, `qx`, `k`, `g`, `cu`.
- A single letter is allowed only for a loop index in a loop of about 3 lines, and for `x`/`y`/`z`
  coordinates.
- Put units in the name or the doc comment: `lengthMetres`, `timeoutSeconds`, `angleRadians`.
- Functions are verbs (`findNearestSegment`). Booleans read as questions (`isOnRoad`, `hasFinished`).
- Constants are `UPPER_SNAKE_CASE` with a comment giving the unit and why that value.
- Do not reuse a name for a different thing in another file (`step`, `draw`, `hit`, `reset`).
  Prefix with the system: `stepVehicle`, `drawSkidMarks`.

### Structure
- One file, one responsibility. Aim for under 500 lines. Over 800 means split it.
- One function, one job. Aim for under 40 lines. Over 80 means split it.
- One statement per line. Maximum line length 100 characters. No dense one-line blocks.
- No hidden globals. Every value a file uses is imported, or passed in as a parameter. Nothing is
  read from `window`, `globalThis` or a variable that another file merely happens to define.
  `window.__game` is the single exception, for test harnesses.
- Prefer passing a small, explicit object over importing a large shared module for one value.
- Public functions get a JSDoc comment: what it does, parameters with units, return value.
- Comments explain why, and what was measured. Do not write history ("added 2026-10-04"), user
  quotes or incident stories in code or docs. Git has the history.
- Remove dead code. Do not comment it out.

### No duplication
- Before writing a function, list, table or constant, search for an existing one. Extend it.
- Do not build a second version of a system (driver, physics path, renderer, menu, sound voice)
  beside an existing one. If there is a real reason, ask first and spell out the trade-off.
  Never leave "merge them later" as a TODO.
- Shared helpers (clamp, lerp, hash, vector maths) live in one module and are imported.

### Performance
- Never do work per frame that scales as objects times world size. Example to avoid: every cone
  testing every track tile or barrier segment each frame.
- Use a spatial index (uniform grid or similar) for nearest and overlap queries. Build it when the
  level loads.
- Sleep idle objects. An object that has not moved takes no per-frame work until something wakes it.
- No allocation in per-frame code paths: reuse arrays and objects.
- Cap every list that grows (skid marks, particles, debris) and drop the oldest.
- Budget per frame, measured on a phone-class device. Measure before and after every performance
  change, under the same load. A change of 1 ms or less is noise until a back-to-back A/B shows
  otherwise.
- Test at real entity counts, with the capped lists full, not empty.

## 3. Simulation rules

1. Identical outcomes across different inputs mean a bug, not a balance problem. Instrument the
   mechanism with a per-step dump before tuning.
2. Fixed physics step (start at 120 Hz) with an accumulator. Never pass frame `dt` to the vehicle.
   Never clamp `dt`; loop.
3. Two clocks. Sim time: vehicle, wear, damage, lap timing (exact, frame-rate independent).
   Wall clock: skid fade, particles, shake, camera, flashes. Do not mix them.
4. One seam between engine and game: a `mods` object of multipliers. Defaults are no-ops (1.0, or
   0 for additive). Engine code never knows what an upgrade or part is called.
5. Guard every division and normalisation (zero speed, zero length, zero wheelbase). Assert finite
   on position, velocity, heading and RPM behind the dev flag. Check anything fed to canvas calls
   for NaN: a browser throws where a stub does not.
6. Never gate a core process on a resource that can reach zero. Constant pressures (wear, fuel,
   damage) need a tolerance floor below which they cost nothing.
7. Read live state in the HUD, not the purchase flag.
8. Explicit integration needs coefficients well under 0.5 per step. Compute into delta buffers,
   then apply once.
9. Anything asleep, culled or frozen ignores what you do to it. Wake it first. A force scaled by
   a static body's mass is Infinity.
10. Do not tune on noise. Measure continuously over a long run, not on spot samples. Alive scenes
    (traffic, wandering AI) never settle: measure the thing you care about.
11. Hidden numbers (grip, wear, heat, slip) must be viewable on `?dev=1` and from a script, before
    the system that uses them is built.
12. Tables (reactions, pairings, content lists) need a coverage test that walks the whole content
    list and reports gaps.

## 4. Verification

- Measure, do not read. Write a throwaway script, run it, delete it (or keep it in `tools/`).
- `node --check` does not prove an ES module loads. After a change, import the module
  (`node -e "import('./src/X.js')"`), or for browser-only files load the page and read page errors.
- Visual change: screenshot the real game in a real browser at 844x390 and 390x844, and look at it.
  A headless logic test does not prove it looks right.
- Text drawn to canvas: run the text-overlap check at several screen sizes.
- Before and after a visual or physics fix, run the same tool and report every side effect.
- Run `tools/propcheck.mjs` after adding scenery. Check whole footprints, not centres.
- A test that has never failed is unproven. Reintroduce the bug once to see it fire.
- Run AI checks one level per process, or the same level list on both sides of a comparison.
  Clear level state (for example wear) between runs in one process.
- Test both seeds. A scene can settle on one and fail on the other.
- Never measure frame time while another browser tool is running.
- Check the browser console first when part of the UI vanishes. A missing import only throws when
  that line runs.

## 5. Design principles

- Systems feed each other. Each feature should plug into the chain of cause and effect, not sit
  beside it. Nothing arrives at random: events are caused by what the player did.
- What the player invests in should be visible on the car, not only in a menu.
- If the player cannot see it, it does not exist. Size, contrast, a dark rim, motion for urgency.
- HUD: each screen corner has one owner. Canvas HUD does not take part in layout, so reserve room
  explicitly. Nothing essential lives in a closable panel. A tap on the HUD must not reach the
  world. Margins 12 px, touch targets 30 px minimum (44 px if used repeatedly).
- Release every touch control on blur, visibility change, pointer cancel and lost pointer capture,
  or a system gesture leaves a pedal held.
- Every audio cue has a visual twin, because the phone is often muted.
- Every floating number says what it is, in the colour for that state. Batch tick-by-tick
  numbers; cap what is on screen.
- Colours carry meaning from one small table. Never choose a colour ad hoc.
- Surface state you already compute before building something new.
- A first-run walkthrough is kept current in the same task as any mechanic that changes it.
- Levels and tracks are data, not code: geometry, checkpoints and the racing line live in a data
  file. "Move that corner" must be a number change. State the base surface under any wet, snow or
  ice layer; ask if the design does not say.
- If the owner says a layout "doesn't read right", re-lay it from the shape. Do not patch it.
  Keep the old version runnable for comparison until the new one is approved.
- A traced track needs a minimum corner radius (half width + kerb + margin) before kerbs go on.

## 6. Building a level

1. Ask one round of structured questions first: reference, time of day, features, what the player
   is meant to fail at, the risky bonus, the surface under any cover.
2. Build it as data, with a header comment listing contents and intended failure.
3. Check with numbers at real entity counts, including with the level's big event running.
4. Screenshot at phone size and as a whole-map overview, and look.
5. Register it. If shared code changed, re-test every earlier level.
6. Hand over: link, what to test, what would count as wrong.

Tools for tracing a real track (`mapgrid`, `traceoverlay`, `kerbside`) and checking a level
(`barriercheck`, `solidcheck`, `lapdriver`, `crestcheck`, `framecheck`, `profile`) are in `tools/`.

## 7. Environment

- Windows, PowerShell. Use full paths. Commands time out at about 30 s: run long tools hidden,
  write output to a file, and poll it.
- Edit through the editor tool, in chunks of about 6000 characters or fewer. Put comments on their
  own line: a trailing `//` on a patched line swallows the rest of that line.
- `lab.js` is order-sensitive (a `const` must be declared before use). Check each new name's
  declaration order before saving.
- One dev server (`serve.mjs`) at a time. Start and stop processes by PID. Never kill by image
  name: other projects share this machine.
- Do not leave stray processes running.

