# Foreman handover

Written on the owner's request, 2026-10-17 (main 8edf8e4). Read `CLAUDE.md`, then `NOTES.md` (the
owner's rules, decisions, measured lessons and the routine - not repeated here), then `TODO.md`, then
this page.

## Where things stand

The plain test link is the approved game. Approved by the owner on the phone and now the default
(each switch `=0` brings back the old path):

| What | Switch | Since |
|---|---|---|
| Ground on the GPU, zoom hold, smooth zoom, frame pacing, minimap (highway too), grippier grass | `gpupaint`, `zoomhold`, `minimap`, `hwmap`, `grassgrip`, `vsync` | 10-15 / 10-16 |
| Cars drawn at screen resolution on the 2D screen canvas (look B) | `sharpcars` | 10-16 |
| Skid marks drawn on the screen canvas (no quiver) | `sharpmarks` | 10-17 |
| Joker lane on the minimap; RESET in the joker back onto the lane | `jokerfix` | 10-17 |
| 12 ground lookups a car a step instead of ~22 | `groundlookup` | 10-17 |

Tried and removed (do not repeat without a new reason; why in `NOTES.md` / `TODO.md`): tiles tracing
only their part of the ribbon (`ribboncull`), cars drawn by WebGL with the art buffer uploaded every
frame (`gpucars`), the menu recording (parked).

## Next (the owner's order)

1. **Track edges jiggle or dance** (owner 10-17, "like the tyre tracks were"). Not assessed yet. Find
   WHICH edges first: phone-size photos / frame pairs at speed. Candidates: the ribbon's white edge
   lines and curved kerbs (painted into the ground tiles in art pixels, drawn by the GPU with the
   sharp filter), or the per-frame deck (runoff, floor-edge kerb, paint) drawn into the art buffer at
   1.3 CSS px per art pixel - the same 3-pixel steps the marks had. If it is the deck, the marks fix
   (`render/screen.ts`: blit the art buffer, draw on the screen canvas, carry on) is the pattern.
2. **Main menu still sluggish** (owner 10-17). Measure on the phone first: `?report=1` does not record
   the menu (the meter is only fed in a session); add a menu report, then propose (fewer demo cars, a
   cheaper demo race, the recording made from the deterministic runtime).
3. **Rain and weather.** The owner's answers are in `TODO.md` "GRASS GRIP + WATER": rain is a WEATHER
   choice in the event setup; puddles likelier in dips, less on hills; wet grip and faster wear per
   surface combination. Start by bringing the owner the wet-grip / wet-wear table to agree.
4. Smaller: fold `glpaint.ts` / `glshade.ts` into `render/glprogram.ts`; props, cones and barriers are
   still drawn in the art buffer (they may crawl like the cars did: ask before touching them); the old
   test-list entries (straightoutta, sound, joker, markedge, ainowait, judder) still wait for a verdict.

## Picking up

- Test server: `node serve.mjs` in `Desktop/G/rac3r` (serves the clone's checkout; keep it on
  `origin/main`) + the cloudflared tunnel. PIDs in `GamesStudio/tools/logs/rac3r-pids.txt`; the tunnel
  URL is in `GamesStudio/tools/logs/rac3r-tunnel.err`. Phone reports go to
  `GamesStudio/tools/logs/rac3r-phone-report.jsonl` (`node tools/phonereport.mjs <log> --since <UTC>`).
- Saved references for main 8edf8e4 (`.renderhash`, `.simhash`, `.worldhash`): copy them into the
  worktree's `tools/` from the previous foreman's scratchpad
  `AppData/Local/Temp/claude/C--Users-Admin-Desktop-G-car-sim/1db38863-a214-4ad6-9a79-7cde47066581/scratchpad/refs/`.
  The served clone's own `tools/.renderhash` is older: do not use it.
- `simhash` and `renderhash` take `RAC3R_QUERY=<switch>=0` to prove an old path.
- The laptop has 6 GB. Claude Code cancels background runs when memory runs low (twice on 10-17):
  run `renderhash` / `simhash` in the foreground (each under 10 minutes), one at a time. The owner
  allowed closing apps to free memory (the DuckDuckGo browser is the big one; never the test server,
  the tunnel or Claude).
- Verify before committing and check the result: piping `npm run verify` into `tail` hides a failure
  from `&&` (it happened once on 10-17; caught before the push).
- Bigeon worker: still out of OpenRouter credit; the foreman does the work and pushes to main itself
  (`NOTES.md` routine).
