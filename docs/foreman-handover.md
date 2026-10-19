# Foreman handover

Written on the owner's request, 2026-10-19 (~11:20Z; main at the "WebGL2 is the ground" commit
5751272 plus the handover commits). Read `CLAUDE.md`, then `NOTES.md` (the owner's rules,
decisions, measured lessons and the routine - not repeated here), then `TODO.md` (rewritten 10-19:
open work only, 130 lines), then this page.

## Where we are

- **Under the owner's test: `gpuonly`** (the testlist entry). The CPU ground is deleted; WebGL2
  is THE ground. Owner: "do it and let me test - if it's a problem we revert". Revert = `git
  revert 5751272` (one commit; the proofs before it are on c56f656).
- **The ONE-SYSTEM CLEAN-UP is done** (owner 10-18: "make sure we only have one system for
  everything"): every approved switch's old path deleted - groups 1 lights + time (baed231), 2
  weather / surfaces / tyres (93d3fe7), 3 drawing (86cbd8d), 4 HUD / menus (9ac696a), the
  unapproved experiments (c56f656: menu video, one canvas, tile GPU, square blades, no lock), the
  CPU ground (5751272). Every step proved SAME (worldhash / simhash / renderhash; photos for the
  GPU field and the menus). What remains as `?` switches are test tools only (`?night=`,
  `?rain=`, `?report=1`, `?skip=`, `?dpr=`, `?autopilot=`, `?seed=`, `?tilepx=`, `?noshade`).
  NEW RULE (NOTES, memory): on the owner's OK the old path is DELETED, no `=0` kept.
- **NEXT: the TYPESCRIPT CONVERSION, overnight** - owner: "wait on the conversion until I say I'm
  about to sleep, then do as much as you can over night and I'll check in the morning". The plan
  (TODO.md Queue 2): the remaining .js files converted in place with types, batch by batch, each
  proved SAME (worldhash, simhash, renderhash) and pushed: 1 small leaf files, 2 cones, 3 HUD, 4
  menus, 5 highway, 6 game flow, 7 top level. New modules are .ts already.
- After it, the owner orders the queue (TODO.md): the HUD text fix (measured A/B, default only
  if better), mud M1, grass G1, highway lamps L4b, then the bigger game items (story mode,
  upgrades, levels / DIEATONA, cars).

## Today's changes the next foreman must know

- **The pause menu alarm clock** (gold seven-segment, `menu/pauseclock.ts`) and **the glows in
  the night layer** are approved. The night layer (`render/light.ts`) is the ONLY light: car
  pictures paint lamps only; lamp pools have a warm tint; street-light heads glow there.
- **The GPU ground rebuilds a lost context** (`render/glground.ts watchContext` + `buildParts`):
  Safari may drop WebGL under memory pressure; before, the game fell back to the CPU ground until
  a reload. Tested with WEBGL_lose_context (`tools/scratch/_contextloss.mjs`: lost, restored,
  ground back, no page errors). No WebGL2 at all: index.html shows "could not load: this browser
  has no WebGL2, which the game needs".
- **renderhash now draws the real GPU ground** (no `gpupaint=0` pin): ~2 min a level, ~30 min for
  all 14 (it was 7 min on the CPU ground). Budget overnight proofs for it.
- **worldhash** (a node tool) now builds levels as the game does: the weather makes the puddles,
  so 9 levels lost their hand-placed puddle covers in its data (checked: only those).
- **phonereport** flags a run capped at 30 fps (iOS Low Power Mode / a hot phone): the owner's
  "major lag" on 10-18 night was Low Power Mode while charging (every frame 33 ms, menu too).

## Proofs and references

- Worktrees: `Desktop/G/rac3r-wt2` (where the work was done; on main) and `Desktop/G/rac3r-wt`
  (also on main). The served clone `Desktop/G/rac3r` is detached on origin/main - never work
  there; move it with `git checkout -q --detach origin/main`.
- References (gitignored, in `rac3r-wt2/tools/`): `.renderhash` = the GPU ground on c56f656 (SAME
  on 5751272), `.simhash` (SAME since 10-18's last re-save), `.worldhash` (re-saved on 86cbd8d,
  the weather's puddles), `.samecode` (saved mid-group 2; re-save before using it). Copies in the
  session scratchpad: `renderhash-gpu-ref.json`, `renderhash-cpu-ref-c56f656.json` (the old CPU
  ground's, no longer used).
- Scratch probes made today (`tools/scratch/`): `_glowmapshots`, `_pauseclock` (needs `?menu=1`
  and key `p` to pause under automation), `_lamppools`, `_puddlecovers`, `_contextloss`; and in
  the session scratchpad `_fieldshots.mjs` (GPU cover field photos, compare with
  `tools/shotdiff.mjs`), `_hudlist.mjs` (pause menu + HUD list photos), `_levelparts.mjs`
  (worldhash data per key, to see WHAT differs), `edit.mjs` (exact-match multi-edit helper: it
  fails unless each string matches once - the safe way to make long edits).

## Lessons from today

- **The laptop has ~6 GB and ~1-1.8 GB free.** Claude Code killed background jobs twice for low
  memory: never run a photo browser next to a proof; one heavy browser tool at a time. The owner
  said "close anything you need on the laptop" (DuckDuckGo closed by PID: +0.7 GB).
- **The GitHub API (anonymous) allows 60 calls an hour**: polling CI every 10-15 s hit the limit;
  poll every 30-40 s, start after ~40 s. `curl api.github.com/rate_limit` (free) shows the reset.
- **CI `checks` (the suite vs the base) has FAILED on every main commit since b2dbcf8** (10-18,
  before this session); `verify` (the gate) passes. Not yet diagnosed (TODO): run
  `npm run suite` locally when the laptop is free; the job's log needs a GitHub login.
- Headless node tools (worldhash, wear checks) run the modules WITHOUT main.js: a switch whose
  module default differed from the game's default made them test the old path. With the switches
  gone they test the game.
- Long inline scripts in the Bash tool fail to parse (quotes, `${}`): write them to a file.
- A probe's `page.evaluate(import('/src/...'))` reaches the game's own modules (same URLs);
  `shared.menu` is null under `?menu=0` and under automation unless `?menu=1`.
- The Write tool refuses a file not read this session, and a chained commit still runs: this page
  first went in empty of its update (edc196a); check the write before committing.

## Picking up

- Test server `node serve.mjs` PID 6236 and cloudflared 1408 (running; `Desktop/G/GamesStudio/
  tools/logs/rac3r-pids.txt`); the link is in `rac3r-tunnel.err` there. Phone reports:
  `node tools/phonereport.mjs ../GamesStudio/tools/logs/rac3r-phone-report.jsonl --since <UTC>`.
- `gh` is not on the Bash PATH: read check runs with curl (`repos/staystale/Rac3r/commits/<sha>/
  check-runs`, the `verify` run).
- To main: commit in a worktree, push `HEAD:refs/heads/foreman/<name>`, wait for `verify`, push
  `HEAD:refs/heads/main`, delete the branch, move the served clone.
