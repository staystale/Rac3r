# Foreman handover

Written on the owner's request, 2026-10-24 (~14:55Z; main at f3fb58c "Mud M1 the default" plus this
page). Read `CLAUDE.md`, then `NOTES.md` (the owner's rules, decisions, measured lessons and the
routine - not repeated here), then `TODO.md` (its "OWNER LIST 2026-10-24" section is the plan), then
this page.

## Where we are

- **The plain link is the approved game; the test list is EMPTY.** Today's MUD M1 is the default
  (owner: "all pass", circuits and highway): mud thickens only with water; a level's own mud and
  thick mud dry in the heat in patches (world/levelmud.ts: pieces seeded as wear cells at an
  event's start, each piece steps at 90 % of its own cells, specks dry on a timer); the highway's
  ploughed fields dry in random blocks (world/fieldblocks.ts) and stream in as dry as the dry
  spell so far; worn dirt goes to mud by a chance falling with heat and to gravel by one rising
  with heat (dig.ts wornDirtTo); drying mud makes the AI read the grip again. The switch and the
  old rules are DELETED (one system).
- **itch.io is up to date:** https://fuzzlepun.itch.io/rac3r, channel html5, build #2201136
  (userversion 2026-10-24-f3fb58c), pushed on the owner's say-so. Recipe below. The owner was
  told to revoke the API keys pasted in chat; ask for a fresh wharf key next time.
- **CI:** the pixel check now runs as 4 parallel shards (`renderhash --shard k/4`, its own job);
  menucheck / guidecheck wait for what they check (60 s) and menucheck names a failing step.
  The `checks` job compares each push to its parent, so a commit that changes behaviour on
  purpose (f3fb58c: the mud default) fails there by design; the next push compares against it.
  Watch the next run: menucheck's taps got a 60 s wait after "tap RESULTS" timed out on CI.
- **The GitHub CLI** is installed portable at `C:/Users/Admin/tools/gh/bin/gh.exe`, logged in as
  staystale (`gh run view <id> --log-failed -R staystale/Rac3r`; job logs via
  `gh api --allow-escape-sequences repos/staystale/Rac3r/actions/jobs/<id>/logs`).

## NEXT (agreed order, TODO.md "OWNER LIST 2026-10-24")

1. **A fixes, one bundled test link:** A1 dawn / dusk light blending, A2 lights through bridges,
   A3 grid / rolling starts (cars weave, crash before the start, start off their slot - the
   player too), A4 oval / stock car AI wiggle at the start / finish, A5 Mont Brakefade's ice
   (weather only: no level-drawn snow / ice; snow themes bias the weather), A6 rain grip (small
   damp loss, puddles the real one, fewer / smaller puddles), A7 wear under spin / lock on every
   surface, A8 handbrake heat, E gravel -> sand. Each its own switch + testlist entry.
2. **Queued before:** grass G1, the HUD text fix, highway lamps L4b.
3. **TypeScript conversion overnight** (when the owner says they are going to sleep) - BEFORE
   the AI rework and car systems (owner: don't do things twice).
4. **B AI rework** (own switch): one skill number driving the existing knobs, a separate risk
   draw, FELT GRIP instead of the grip map (owner said yes), never waiting, dodging, a cost
   budget. Agree the architecture with the owner first; fix the broken highway AI tools on the
   way.
5. **C car systems**, then crash consequences; D trees and bushes; F lighting; G sound /
   settings / Slave FM (the owner's own project on the laptop - read only, never change it;
   stream at slaveFM.duckdns.org; ask about every sound first); H upgrades with Story; I
   multiplayer (talk it through first). ABS realism = the driving ROOT FIX (wheel spin state).

## Proofs and references

- Worktree `Desktop/G/rac3r-wt2` is on f3fb58c (+ this page); `rac3r-wt` is old (c56f656). The
  served clone `Desktop/G/rac3r` is detached on origin/main.
- References in `rac3r-wt2/tools/` (gitignored): `.simhash` = the mud default (saved with
  ?mudwater=1 on 1a1e66b; SAME on f3fb58c); `.worldhash` re-saved on f3fb58c (the highway's zones
  carry the field blocks). **`.renderhash` is STALE** (it predates the new dry-plough texture,
  which shifts the seeded random stream on 11 levels): re-save it on main first, in 4 parts
  (`node tools/renderhash.mjs save --shard k/4` for k = 1..4, one after another).
- Probes kept (`tools/scratch/`): `_mudwater` (thicken + drying shares by level), `_mudedges`
  (when pieces step vs their cells), `_dirtmud` (dirt -> mud / gravel by temperature),
  `_hwplough` / `_hwblocks` (highway fields: area, blocks, rebuild cost), `_hwfieldshots`
  (photos; pauses the sim via game/state.js shared.paused), `_mudwatershots` (drying in the
  real game, frame times, photos), `_staticcheck` (the static build as itch serves it).

## Lessons from today

- **The laptop (6 GB):** a full renderhash got stopped for low memory twice; in 4 parts it runs.
  DuckDuckGo (the owner tests in it) takes 0.5-1 GB: ASK before closing it (NOTES).
- **Never edit `src/` in the worktree a proof runs from** (I did once; harmless, but it muddles
  the result).
- **A new SURFACE_ART texture moves renderhash** on most levels (the warm-up order / seeded
  stream), with no change to what the game does: prove it by removing the texture once.
- **Pieces of level mud must count only their own surface's cells** (a box reaches into the
  neighbour), and wait for 90 % of them, not all: long lanes kept muddy edges for minutes.
- **Highway fields:** you pass one in under a minute; drying takes minutes - so a field arrives
  as dry as the dry spell so far.

## itch.io push (owner says when)

1. `npm run build` in the worktree (bundles to `dist/`: index.html, game.js, game.js.map).
2. Stage index.html, game.js, manifest.webmanifest (not the map) in a new folder under
   `GamesStudio/ready-to-play/` (10-24: `rac3r-2026-10-24`).
3. Test it as itch serves it: `node tools/scratch/_staticcheck.mjs <folder>` (no errors, no
   missing files, menu and a race at 844x390 / 390x844).
4. `BUTLER_API_KEY=<wharf key from the owner> GamesStudio/tools/butler/butler.exe push <folder>
   fuzzlepun/rac3r:html5 --userversion <date>-<commit>`; check with `butler status`. The key
   never goes in a file.

## Picking up

- Test server `node serve.mjs` PID 6236 and cloudflared 1408 (running); the link is in
  `Desktop/G/GamesStudio/tools/logs/rac3r-tunnel.err`. Phone reports: `node tools/phonereport.mjs
  ../GamesStudio/tools/logs/rac3r-phone-report.jsonl --since <UTC>`.
- To main: commit in a worktree, push `HEAD:refs/heads/foreman/<name>`, wait for `verify` (gh
  run list ... -w verify), push `HEAD:refs/heads/main`, delete the branch, move the served clone.
