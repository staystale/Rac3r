# Foreman handover

Written on the owner's request, 2026-11-07 (main at the commit that adds this page).
Read `CLAUDE.md`, then `NOTES.md` (the owner's rules, decisions, measured lessons and the routine -
not repeated here), then `TODO.md` (its top: **NEXT - ORDER AGREED 11-07**), then this page.

## Where we are

- **The plain link is the approved game; the test list (`src/testlist.ts`) is EMPTY** and
  `src/core/fixes.ts` FIX has no switches.
- **itch.io is BEHIND:** the last push is build #2300680 (`2026-11-04-4f8d865`). Everything below
  is newer. Push only when the owner says (recipe at the end).
- **The GitHub `checks` workflow is green again** (fixed 11-07). A commit MEANT to change the
  simulation / AI says `[sim]` in its message, level data `[world]`, pixels `[look]` - that hash
  is then reported, not failed. Untagged, a difference fails.

## Passed and the default since the last handover (11-04 .. 11-07)

AI:
- **Racing line back** (`ai/gapPick.ts placeCost` LINE_COST 3 a m off the line; attacks aim
  BESIDE the car attacked, `driverLane.ts attackAim`), **off the track only round a stopped /
  crawling car** (`driverTraffic.ts offTrackOk`), **the rejoin** (`ai/rejoin.ts`: soft on the
  track; off it back at 8 deg growing 3 deg/s to 14 deg the longer it is off).
- **Standing water not planned round** (`ai/line.ts lineMu` reads the damp ground under a
  puddle; a puddle on a corner's line is a hazard like oil - `cornerLine.ts`).
- **Highway lanes** (`ai/roadLine.ts` lanes, `driverLane.ts laneStep`): every lane is as good as
  the line - a driver keeps its lane, held while it goes round a car, then the nearest lane. (A
  lane read mid-move ran away with the move: weavecheck 0 -> 4 hits - the hold fixes it.)

Menu:
- **The menu race** (`game/menuflow.ts menuLevel`): a random circuit / oval / rallycross track,
  the highway 1 in 5 (random road type, WITH traffic now), 5-20 cars, the camera car on any grid
  slot; on the highway the camera frames the car as on a circuit (`CamState.menuView`).

Cars (the big round, item 4):
- **Paint parts** (`carpaint.ts PAINT_STOCK`, `menu/garage.ts`): BODY / SECOND / THIRD, chrome +
  gold on every row; every car's second part is big (mostly the roof), each has a third; AI
  fields use all of them. **RIMS** is its own garage screen beside TYRES: colour + spokes (STEEL =
  the old look, FIVE / MESH / SPLIT / DISH - `render/wheelface.ts`), seen only on a wheel lying
  loose (a mounted wheel shows its tread).
- **Redraws** (`render/carlooks.ts`): Golf, M135i, quattro S1 E2, F1 / F2 (after the owner's
  reference picture: arched wing, accent nose, fat pods, diffuser), Next Gen, Micra R1, the
  autograss buggy; 3 Series bonnet, Fiesta RX wing.
- **Real shapes, DRAWN** (`carreal.ts realShape`, `render/cars.ts drawnSpec`): each car drawn in
  its real car's proportions AT ITS OWN LENGTH; the physics as it was (owner: "match the sizes
  they were ish ... or it'll change too much"). TRIED: the real size in the physics - AI F1
  fields crashed twice as often (the tracks are half scale).
- **Real tyres** drawn at their real width / diameter, to the car's scale (`carpaint.ts
  TYRE_LOOK`); **open-wheeler wishbones and drive shafts** drawn with the wheels, the fronts'
  track rods steering (`render/cars.ts drawWishbones`).
- **F1 / F2 real aero, brakes, wheel weight** (`carreal.ts F1_AERO`): F1 braking 3.0 / 4.3 g at
  200 / 300 km/h, cornering 3.1 / 4.8 g. WATCH: AI F1 fields spin more (12 races 56 -> 92
  incidents) - the AI's full pedal locks a car without ABS.

Crashes:
- **Parts** (`world/debris.ts`, `render/carparts.ts`): a bumper / wing / door off from a hard hit
  (now and then from a smaller one, up to 6 %); the car shows it GONE (a structure line left);
  a closed car's part drawn LYING FLAT (bumper with lamps and plate, wing with its arch, door
  with its window); an open car's cut from its sprite.
- **Bad-crash bits** (`carbits.ts` per car): exhaust (its real pipes), bonnet / boot lid / spoiler
  (cut from the sprite), mirror, rarely the engine (its cylinders); a wheel off takes its strut /
  wishbones / drive shaft; ROLLS shed what the face that hit carries. Each bit's mass, size and
  puncture risk by its sharpness (`cones/coneConsts.ts DEBRIS`, `physics/punctures.ts`).
- **Roll sparks** stop when the car lands on its wheels, never on soft ground (`roll.ts`).
- **Highway bales** are loose objects (nudged, burst into straw) - were solid props.

Tracks:
- **Brands Snatch Indy to scale** was tried as two test levels and removed; DECIDED: 3/4 of real
  length, the 13 m road (the next big job).

## NEXT (the owner's order, 11-07: "let's do 1. first and proceed in this order")

1. **Every level to 3/4 of real size** (TODO "NEXT BIG ONE"). PLAN WITH THE OWNER FIRST. Pilot ONE
   track - Brands Snatch Indy (the calibrated trace is in git: commit 58bfa07,
   `world/levels/brands-indy-scale.ts`, calibrated to the real 1944 m lap) - with its scenery
   (pits, garages, gravel traps, grandstands, bridges, trees) resized to fit, behind a switch,
   owner test, then the rest. Watch load time, memory, the overview picture cap, AI lap times.
2. **New UK tracks** at that scale: Snetterton, Donington Park, + Silverstone / Oulton Park
   (parody names agreed first).
3. **Rolling look:** smoother than the dice flip, same roll physics underneath; mockup first.
4. **Side drafting** (Naffcar first), then the Naffcar extras (air brakes, aero upgrades,
   Dieatona).
5. **More highway flavours.**
6. Small: Brands Snatch Indy's garage barrier on a lane (`barriercheck brands-snatch-indy`); the
   highway AI dodging (owner: "let's leave it for now").

Later, waiting on something: antennas + a CB radio (with the sound), coloured springs / dampers
(with the upgrades), the online "left behind" rule (with multiplayer).

## How the owner works (this session)

- Every change behind a `?switch`, measured, a test link; on "pass" the default, the switch AND
  the old path deleted, TODO updated, CI, main, the served clone moved. Direct fix requests and
  flips are fine without asking; new builds and big plans are proposed first.
- The owner tests on the phone and often sends several messages while you work - answer each.
- Measure before reporting (a tool number + a phone-size shot); say plainly what got worse.
- "Keep it simple - simple rules to create complex behaviour"; one AI, one rule set everywhere.

## Tools added this round (`tools/scratch/`)

`_hwstart.mjs` (highway start spread), `_menurand.mjs` / `_menucount.mjs` (menu races; HW=1
forces the highway), `_carsheet.mjs`, `_carzones.mjs` (paint zones), `_paintshot.mjs` (garage
screens), `_spokesheet.mjs`, `_loosewheel.mjs`, `_steershot.mjs`, `_f1grip.mjs` (a car's g by
speed), `_parttest.mjs` / `_bittest.mjs` / `_rolltest.mjs` (what a hit / a roll throws),
`_crashparts.mjs` (a real crash), `_partsheet.mjs` / `_flatsheet.mjs` / `_bitsheet.mjs` /
`_lostsheet.mjs` (parts drawn), `_rollspark.mjs`, `_hwbale.mjs`, `_ovalfield.mjs` (real-game
field), `_ovalshot.mjs`. `tools/weavecheck.mjs`'s trace (WVONE) reads today's AI state.

## itch.io push (owner says when)

`npm run build` in the worktree; stage in a new `GamesStudio/ready-to-play/rac3r-<date>/`:
`dist/index.html`, `dist/game.js`, the repo's `manifest.webmanifest` (the build does not copy it)
AND `dist/assets/` (fonts + logo; drop `fonts/README.md`; no `game.js.map`);
`node tools/scratch/_staticcheck.mjs <folder>` (both phone sizes: missing none, no errors);
`BUTLER_API_KEY=<wharf line of Desktop/ITCH-API-KEYS.txt, read inline, never printed>
GamesStudio/tools/butler/butler.exe push <folder> fuzzlepun/rac3r:html5 --userversion
<date>-<commit>`; `butler status fuzzlepun/rac3r:html5` until the build is up.

## Picking up

- Worktrees: `Desktop/G/rac3r-wt` (the work, detached on main) and `rac3r-wt2` (proofs). The
  served clone `Desktop/G/rac3r` is detached on origin/main.
- Test server `node serve.mjs` and cloudflared are running (`GamesStudio/tools/logs/
  rac3r-pids.txt`: server 19356, tunnel 9764); the link today is
  https://coalition-tramadol-hydraulic-dam.trycloudflare.com (also in
  `GamesStudio/tools/logs/rac3r-tunnel.err`). If it stops resolving, Cloudflare dropped the quick
  tunnel: stop the cloudflared PID, start `GamesStudio/tools/cloudflared.exe tunnel --url
  http://localhost:8080` with stderr to that log, update `rac3r-pids.txt`, give the owner the new
  link.
- To main: commit in a worktree, `node tools/verify.mjs` (check its exit code), push
  `HEAD:refs/heads/foreman/<name>`, wait for the `verify` run (`C:/Users/Admin/tools/gh/bin/gh.exe
  run list --workflow verify`, run inside the repo), push `HEAD:refs/heads/main` (retry), delete
  the branch, move the served clone (`git fetch -q && git checkout -q --detach origin/main`).
- Edit scripts: write a `.cjs` to the scratchpad with the Write tool and run it with node (bash
  heredocs with quotes break); an Edit needs a Read first.
- Lint: max-len 100, complexity 15, max 80 lines a function / 800 a file, id-length >= 3.
- The laptop has ~6 GB: heavy tools one at a time; a background job killed for memory is not
  restarted without asking.
