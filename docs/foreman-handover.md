# Foreman handover

Written on the owner's request, 2026-10-18 (main at the weather-default commit, plus this page).
Read `CLAUDE.md`, then `NOTES.md` (the owner's rules, decisions, measured lessons and the routine -
not repeated here), then `TODO.md` ("Where we are" and "GRASS GRIP + WATER" / "TYRE WEAR"), then
this page.

## Where we are

- **The judder question is closed (10-17 night).** The same default build in DuckDuckGo (iOS
  WebKit too) showed the owner no held frames; a Safari tab held 42 in 10 s. The "lean" drawing
  (`?glground=0&sharpcars=0&sharpmarks=0`) only brought Safari to the original build's level.
  Owner: "our default link is working pretty good - let's move on". The default drawing is kept.
  Before an itch.io release: record a race in the home-screen app (no Safari toolbar).
- **Weather is done and the DEFAULT** (owner, 10-18: "weather all pass"; `?weather=0` = off).
- **Sliding / crashing wheels wear the ground twice** - the DEFAULT (`?slidewear=0` = off).
- **Tyre wear is the DEFAULT, its test left open** (owner: "apply it to main and roll it back if
  needed"; `?tyrewear=0` = off; testlist `tyrewear`). RESTART = the set as at the event's start,
  RESET keeps the race as it is.
- **Puddles and snow can build up anywhere** (sites over the whole floor, `world/covergrid.ts`
  indexes the covers).
- **Today's weather tweaks** (cold freezes water, puddles before the start, faster build-up, the
  SNOW button) are in the default; testlist `wintertweaks` for the owner to confirm.
- **NEXT: LIGHTING / time of day** - approved to build, tested on its own switch. Not started.

## Weather - how it is built (all in `TODO.md` with the measurements)

- `world/weather.ts` - the state (wetness 0-1 in 10 steps, rain, snow, air and TRACK temperature,
  the kind of sky, the season) and the engine: the event setup's plan (SEASON / DRY / HOT / VERY
  HOT / RAIN / HEAVY RAIN / SNOW + a season slider), changes in the race in SEASON mode (seeded:
  a restart replays it), soaking and drying, the HUD notices. No plan (the menu's race, the
  tools) = dry, 18 C: the old game exactly.
- `world/wet.ts` - damp and puddle surfaces from the owner's table (`surfaces.ts WET_MU`), cached
  per step; the dry line per wear cell; the hot-weather rule (dirt wears to gravel).
- `world/puddles.ts` - puddle / snow / ice SITES per level (seeded; dips likelier), the start's
  deal, freezing and thawing, scenery water freezing over (`Cover.water`: Killder Water, Sweaty
  Lamb's stream / splash / pond - permanent water), mud drying and freezing, tyre clearing (3
  passes, rain tyres 1). Changed sites repaint only their ground squares
  (`render/tilesWear.ts staleCoverAreas`). The levels' own puddles go (the Lab keeps its test
  features).
- Tyres: `physics/tyres.ts tyreGripOn` (wet hard ground reads the WET column); tyres cool toward
  the track temperature (`tyreheat.ts`). The AI re-plans per wetness step (`ai/line.ts`
  `regripPath`; the highway weaver x `roadWetGrip`).
- The look: `render/glprogram.ts WET_GLSL` (the GPU ground darker and cooler in its own shaders;
  the 2D ground one multiply fill), `render/rain.ts` (rain streaks + splashes, snowflakes: one path
  each a frame, fixed pools).
- `?rain=0..1` - a fixed wet track (test tool, stays).

## Tyre wear (owner's design; the default, `?tyrewear=0` off)

`physics/tyrewear.ts`: wear from each wheel's friction work (the heat model's), faster above the
window, on the wrong ground, rain tyres x2.5 in the dry, dry tyres x0.6 in the wet; grip -20 % at
bald (more when wet); punctures from heat over the window and wear past 70 % only, debris 4 % on a
hard hit, splinters 1 %; crashes already puncture (`damage.js`). Saved per car in the profile
(session only); the garage's FIT is a new set and shows % WORN; the HUD wheel colour is the wear
(numbers = heat). Measured: 3 laps ~10 % of a set. SEEN, not changed: with the tyre diagram on, the
ABS / TCS buttons sit under the FPS panel (an old layout issue).

## LIGHTING - the owner's brief (next)

Weather changes the light; time of day an option that moves slowly and realistically through a
race; darker in winter (shorter days); pink sunrises, orange sunsets, moonlit nights, truly dark
nights where the headlights matter (cars have beams: `render/cars.ts drawHeadlights`); track /
street lights if not overkill. On its own switch, tested separately. THE RISK is Safari: every new
look is a per-frame cost there (`NOTES.md`). Ideas, not decided: tint the ground in the GPU
shaders as the wet look does (free); a low-res darkness / light map in the art buffer for night
(one canvas, no extra layer); measure each with `tools/drawload.mjs` and an owner screen recording
(held frames) before it becomes the default. CLAUDE.md: bring a mockup before a new look.

## Proofs and references

- Weather off (`?weather=0`): simhash SAME 13/13 at every step; the references were re-saved for
  the agreed changes (puddle grip, then the weather default). renderhash: SAME for the wet-look
  code; re-saved on the weather default. Saved in the worktree `Desktop/G/rac3r-wt/tools/`
  (`.simhash`, `.renderhash`, `.worldhash` - gitignored).
- Node-side wet tests: the AI tools run the game in Node without page links, so the weather is
  set by a wrapper: scratchpad `wetrun.mjs <wetness> <tool> [args]` (session 77157c93). Other
  scratch probes there: `wetgrip.mjs` (cornering g dry / damp / puddle per tyre), `weathersim.mjs`
  (30 sim minutes per season), `sites.mjs` / `cold.mjs` (sites, the start's deal, freezing,
  build-up), `tyrewearcal.mjs` (wear per race), `weatherrace.mjs` / `puddleshot.mjs` /
  `tyrehud.mjs` (browser photos), `pxsteps.mjs`, `stalebeat.mjs`.
- `tools/wobblecheck.mjs` no longer drives the car (its input hook); fix it only if needed.
- The recording counter (old session fff86173 scratchpad `vmotion.mjs` / `held.mjs`): trust held
  frames only; its "1.5x / 0.5x steps" are matching noise (`NOTES.md`).

## Picking up

- Test server and tunnel running (`serve.mjs` PID 6236, cloudflared 1408, in
  `GamesStudio/tools/logs/rac3r-pids.txt`); the served clone `Desktop/G/rac3r` is on main.
- Worktree `Desktop/G/rac3r-wt` on main, clean.
- The worker PC is shut down (the owner's request).
- `checks` on GitHub: it had failed for weeks; watch the next run after this push.
