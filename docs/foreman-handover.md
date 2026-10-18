# Foreman handover

Written on the owner's request, 2026-10-18 (evening; main at the "handover for 10-18 evening"
commits). Read `CLAUDE.md`, then `NOTES.md` (the owner's rules, decisions, measured lessons and the
routine - not repeated here), then `TODO.md` ("Where we are": the LIGHTING, SUN TEMPERATURE,
PERFORMANCE PASS and MUD + GRASS entries), then this page.

## Where we are

- **The test list is EMPTY.** Everything built today is approved and the DEFAULT, each with an
  `=0` switch back to the old path (table below).
- **NEXT, in order:**
  1. **GLOWS INTO THE DARK LAYER (owner said yes: "push that fix"; "didn't you fix lights?").** The
     coloured glows (indicators amber, brake / tail / rain lights red; `render/light.ts drawGlows`,
     ~24 small additive `lighter` draws a frame on the screen canvas at night) become part of the
     one light map: rubbed out of the dark like the beams and pools, with their colour as a tint in
     the same pass - one full-screen lay a frame, no separate glow draws. Behind its own switch,
     photos at night (indicator, brake, rain light) before / after, then the owner's phone test.
     The look changes slightly (a tint in the dark, not an added brightening) - the owner knows.
  2. **MUD M1 + GRASS G1** (approved "sounds good"; plan in `TODO.md` MUD + GRASS), each behind its
     own switch, photos first for the grass look. Open question there: should a level's own
     painted mud dry in the heat too? Not built until answered.
  3. **Highway lamps (L4b)**: lamps streamed with the road (like `highway/litter.js` loose objects:
     spawn ahead, cull behind) and a spatial grid for the clamp (solidClamp walks every lamp per
     car per step: fine at ~30 a level, not at hundreds).
- **Performance pass: closed for now** (owner: "both seem good"). Highway dry 0.33-0.75 % slow,
  night 0.45 % vs day 0.33 %, snow / dry both fine, our JS ~2 ms; the laptop profile of the highway
  is the same dry and in rain. Possible small win later: the HUD text redrawn every frame (~3.5 %
  of our time on the laptop profile).

## Built today (all default; `=0` = the old)

| switch | what |
|---|---|
| `?lamps` | street lights and floodlight pylons as SOLID lamps on every level but the highway (`world/lampplan.ts`, by `world/levels/category.ts`): circuits - street lights on the start straight + pylons every ~140 m outside; ovals ~70 m; RX ~110 m; rally stages - pylons at the start and finish only; test grounds - a pylon ring + a LAMP ALLEY nearest the spawn. On from dusk (darkness 0.3). Knock-downs (`world/lampdamage.ts`): nudge = lean + flicker (lit), hard hit = dims by degrees, ~47 km/h snaps a street light (the car goes on, losing 35 % of its closing speed), a fallen post is debris, flatter each pass (4 passes to flat); pylons lean <= 0.1 rad, lose a head per hard hit, never fall; RESTART stands them up |
| `?daytime` | THE GAME CLOCK (`world/clock.ts`): one global time / season / moon, saved (own storage key), runs in events at 24x (1 day = 1 real hour), a season = 7 days, UK-like sunrise / sunset, golden hour orange (dawn pink), dusk -> night ~45 min, nights 0.70 (full moon) - 1.00 (new moon, 8-day cycle), cloud dims the day and hides the moon. TEST MODE setup: TIME OF DAY (LIVE or START HOUR). The menu race shows the global time and season |
| `?suntemp` | air +-2.5 C and the sun's heat on the track follow the clock's sun (none at night, all at noon): the track cools at dusk |
| `?fieldlights` | AI / traffic headlights follow the light level, not the player's LIGHTS button (manual, own car only) |
| `?nightpics` | at night the car pictures leave out the unused beam room (same pixels; small saving) |

Always on (no switch; drawn only with darkness > 0): the NIGHT LAYER (`render/light.ts`) - a light
map the art buffer's size + 2 art px past every edge (the "dancing light edge" fix), the dark
filled in the sky's colour, headlight beams (soft, 32 m) and lamp pools rubbed out, laid over the
screen once a frame under the HUD with blending; one beam per headlight in the dark (the car
picture's old yellow beam only by day); then the glows on top (item 1 above folds them in).
`?night=0..1` is a test tool that fixes the darkness (overrides the clock).

## Open with the owner

- Level mud drying in the heat (above, item 2).
- When the story mode comes: outside TEST MODE the setup's SEASON slider should give way to the
  global season.

## Owner rules learned today (also in NOTES.md / memory)

- Light comes from where the lamp's body is: a pylon's pool around the pylon, a street light's
  under its head. I once aimed pylon pools at the track on my own - undone. **Ask before changing
  a look the owner did not ask for.**
- Lighting before the performance pass; the pass only when the owner complains (they did: highway
  judder - measured, closed above).

## How the systems fit

- `world/daylight.ts` - DAYLIGHT {darkness, rgb, fieldLights}; `setSky` from the clock.
- `world/clock.ts` - CLOCK, `stepClock` (game/loop.js, every sim step: the sky 4x a second, the
  time only in a session), `startEventClock` (menuflow.js launch / enterMenu), `sunShareNow`,
  `clockLine`.
- `world/lamps.ts` - `activeLamps()` built per level (the level's pylons + `planLamps`),
  `resetLamps` (session.js doRestart), `updateLampLight` (render.ts, once a frame: flicker);
  clamped in `world/barriers.ts solidClamp` (`clampToSolid` with the lamp; `driveOverPost` when
  down).
- `render/props/lamps.ts` draws the street lights (overhead) and fallen posts / planned pylons
  (ground); `render/props/buildings.ts drawPylon` reads its lamp (`lampOfProp`).
- `render/light.ts` - the night layer: `createNight` (light map, `drawPools`, beams, `drawGlows`).
- `world/weather.ts aimTemps` - the temperature targets (the sun's share); `ui/report.ts` - phone
  reports carry the hour and darkness (`phonereport` prints them).

## Proofs and references

- simhash refs re-saved on the new defaults (suntemp, lamps, daytime); renderhash refs re-saved on
  lamps + daytime; worldhash ref re-saved (Castle Cum back to its pre-lamps data) - all in the
  worktree `Desktop/G/rac3r-wt/tools/`. With `lamps=0&daytime=0` (and `suntemp=0`) everything was
  SAME vs the morning's refs.
- renderhash runs at the clock's default 10:00 (day): it never draws the night layer. Photograph
  night changes. Probes in `tools/scratch/`: `_nightshots`, `_glowshots`, `_rearshots`,
  `_lampshots`, `_lamphits`, `_lampmaps`, `_lampflood`, `_lampplan` (counts / ms per level),
  `_dayshots`, `_menusky`, `_skycurve`, `_suntemp`, `_nightedge` (screen-edge darkness),
  `_picarea` (car / light picture pixels a frame), `_rainrepaint`, `_lamptouch`.

## Lessons from today

- A layer laid at the frame's sub-pixel shift must reach past the screen edges, or a strip along
  one edge flickers lit / dark as the camera moves.
- Light is smooth: blend it when scaling up; nearest scaling made beam / pool edges crawl.
- `npm run verify | tail -1 && ...` does NOT stop on failure (tail returns 0): check the text
  (`v=$(npm run verify | tail -1); [ "$v" = "verify: OK" ] || exit 1`).
- The Write tool refuses a file not read this session - and a chained commit still runs: check
  the write succeeded before committing (this page went in one commit late).
- Reflow a long comment block as a whole; hand-wrapping one line pushes the overflow on.
- On the highway "slow with tiles" is not a cause: tiles paint almost every frame there.

## Picking up

- Test server and tunnel running (`serve.mjs` PID 6236, cloudflared 1408; the link in
  `GamesStudio/tools/logs/rac3r-tunnel.err`); the served clone `Desktop/G/rac3r` is detached on
  origin/main - never `git checkout main` there; `git checkout -q --detach origin/main`.
- Worktree `Desktop/G/rac3r-wt` on main, clean after this commit.
- `gh` is not on the Bash PATH: read check-runs with curl (`api.github.com/repos/staystale/Rac3r/
  commits/<sha>/check-runs`, the `verify` run).
- The owner's highway autopilot link: plain + `?menu=0&guide=0&rules=0&level=highway&autopilot=1
  &report=1` (tap once to start). `?autopilot=1` alone opens the menu (launch from TEST MODE).
