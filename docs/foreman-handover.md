# Foreman handover

Written on the owner's request, 2026-10-17 afternoon (main a6d421a). Read `CLAUDE.md`, then
`NOTES.md` (the owner's rules, decisions, measured lessons and the routine - not repeated here), then
`TODO.md`, then this page.

## Where things stand

The plain test link is the approved game. Approved on the owner's phone and made the default today
(each switch `=0` brings back the old path; the verdicts and numbers are in `TODO.md`):

| What | Switch |
|---|---|
| Track edges hold still while the view zooms: GPU ground tiles at their exact place | `exacttiles` |
| Pause menu HUD › list: minimap, progress bar, lap timer, speedo, tyre / damage each on / off | `hudmenu` |
| Tyre / damage OFF means off, even when damaged | `tyreoff` |
| Menu: no fly-in behind it; thumbnails painted at load; long-grass blades stroked once | `menufast` |
| Loading: the game as ONE bundled file from the test server (`serve.mjs` `/__bundle.js`) | `bundle` |
| Loading: menu thumbnails saved on the device per game version (`src/menu/thumbcache.js`) | `thumbcache` |

The owner's phone, menu shown after: 2.49 s before, 1.15 s on the first load of a new version,
0.53 s once the thumbnails are saved. TEST MODE answers in ~1 ms (was 193 + 68 ms). The texture
blade masks are NOT pixel-identical (one palette shade on ~0.2 % of long-grass pixels): accepted by
the owner; renderhash references were re-saved for it.

Tried and dropped today (do not repeat without a new reason): painting thumbnails per list when it
opens (the TEST MODE screen shows ~15 of the 18); reusing the blades' Path2D (the stroke is 94 % of
the cost, not the path); chasing the menu's "judder throughout" (phone reports and a screen
recording: 1-5 % off-beat frames in every mode, Safari's cadence, owner: "it's ok").

## Next (the owner has not chosen between these yet)

1. **One ~125 ms frame just after the menu shows**, in every phone run (fresh tab, home screen,
   old link and new). Our sim + draw are 2-4 ms in it and the texture warm-up 4-7 ms, so it is
   outside our timed code. Candidates to measure, not guess: the menu's first DOM layout / font
   paint, a garbage collection, a WebGL program compiled on first use. Look at the frame's report
   numbers (`phonereport`, frame fields below) and a laptop long-task trace first.
2. **Rain and weather** (the next feature): the owner's answers are in `TODO.md` "GRASS GRIP +
   WATER". Start by bringing the wet-grip / wet-wear table per surface to agree.
3. Smaller: if the one long-grass texture hitch (~110 ms on the phone, now the only heavy warm-up)
   is ever felt, the agreed option B is texture painting on a worker (OffscreenCanvas, exact
   pixels, M; the itch build must carry the worker). Also still open from before: fold
   `glpaint.ts` / `glshade.ts` into `render/glprogram.ts`; props, cones and barriers still drawn in
   the art buffer (ask first); the old testlist entries (straightoutta, sound, joker, markedge,
   ainowait, judder) wait for a verdict. The test-mode FPS strip covers the ABS chip with the tyre
   diagram on below 420 px tall: the owner said leave it (it does not touch the iPhone).

## Picking up

- Test server: `node serve.mjs` in `Desktop/G/rac3r` + the cloudflared tunnel; PIDs in
  `GamesStudio/tools/logs/rac3r-pids.txt` (server 6236, tunnel 1408 now). **Restart the server
  whenever `serve.mjs` changes** (it was restarted twice today): stop it by PID, then start it
  hidden in `Desktop/G/rac3r` with `RAC3R_REPORT_LOG` set to
  `GamesStudio/tools/logs/rac3r-phone-report.jsonl` (else the phone reports go to the temp folder),
  stdout / stderr to `rac3r-serve.log` / `.err` in the same folder, and write the new PID to the
  pids file. Other changes only need the served clone moved to `origin/main`.
- The bundle: the phone gets `/__bundle.js` (rebuilt when a source file changes, gzipped ~190 KB,
  fingerprint of `src/` from `tools/lib/buildid.mjs` as `globalThis.__RAC3R_BUILD__`). Every tool
  runs under automation and gets the separate modules (index.html checks `navigator.webdriver`), so
  the proofs never see the bundle. To test the bundle in Playwright, override
  `Navigator.prototype.webdriver` to false in an init script.
- Phone report (`?report=1`): it records the menu too, posts what is waiting when the tab is left,
  and carries `loadMs` (page open -> menu shown). Frame fields: 0 dt, 1 sim ms, 2 draw ms, 3 steps,
  4 tiles, 5 highway slides, 6 px per metre, 7 GPU uploads, 8 mipmaps, 9 menu up, 10 menu taps
  ignored (ghost window), 11 slowest menu button handler ms, 12 texture warm-up ms.
  `node tools/phonereport.mjs <log> --since <UTC>` prints MENU runs separately.
- New tool: `tools/edgecheck.mjs` (does the white edge line move rigidly; `--control` = the noise
  floor). Session scripts worth reusing (not in the repo) are in this session's scratchpad
  `AppData/Local/Temp/claude/C--Users-Admin-Desktop-G-car-sim/7cf1146b-847b-4367-b9ce-df4dcaa62695/scratchpad/`:
  `carjitter.mjs` (every car's on-screen jitter), `menustart.mjs` / `bootprofile.mjs` (long tasks
  and a CPU profile of the start), `loadsplit2.mjs` (download vs start-up, with request latency),
  `texcost.mjs` / `texsame.mjs` (texture cost and pixel identity), `mp4times.mjs` +
  `video/seek.html` + `videoseek.mjs` (an owner's screen recording frame by frame; no ffmpeg on the
  laptop, so frames are read by seeking a served page).
- Saved references for main a6d421a: `renderhash-ref-menufast.json` in the same scratchpad (copy to
  the worktree's `tools/.renderhash`). Physics and levels did not change today, so the `.simhash` /
  `.worldhash` from `.../1db38863-a214-4ad6-9a79-7cde47066581/scratchpad/refs/` still apply.
- The worktree `Desktop/G/rac3r-wt` is clean on a6d421a (remove it per the `NOTES.md` routine, or
  reuse it after `git checkout --detach origin/main`).
- Pushing: `gh` is not installed: read the `verify` check-run from the public API with curl. Run
  the push chain with `set -e` and an explicit check of the verify result: a `;` chain once carried
  on past a failed local verify today (main's protection refused the push; nothing reached main).
- Bigeon worker: still out of OpenRouter credit; the foreman does the work and pushes to main itself.
