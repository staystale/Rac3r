# The AI rework (B) - the design (owner OK 11-04)

Owner 11-01: KEEP what we have, adjust it - not a total rebuild. Owner 11-03: goal 20 AI cars in a
race without performance issues, the PHONE first (laptop too). Every round below is its own
`?switch` and its own phone test; nothing is built before the owner OKs this page.

## What the measuring found (11-03, laptop, Thruston, `tools/scratch/_aiprof.mjs`)

- NO 20-CAR JUMP. The AI costs ~0.15 ms a car a physics step at 5, 10 and 20 cars (120 steps a
  second): sim 1.9 / 2.6 / 4.6 ms a step at 5 / 10 / 20 AI. Car-to-car checks are small (0.3 ms a
  step at 20). The 17.5 ms a frame read on 11-03 was the CATCH-UP LOOP: a laptop already flat out
  ran extra physics steps in a late frame (up to 12), which made the next frame later still.
- Where a car's 0.15 ms goes: ~1/3 reading the ground under its wheels (terrain height, the
  track query, ruts, belly), ~1/3 its physics (vehicle step, wheel spin, loads, tyre heat),
  ~1/3 the driver's thinking (`drive`: the line profile, traffic, racecraft, steering) - which
  runs every physics step, 120 times a second.
- Also growing with cars: the loose objects (all ~1100 stepped every step, at rest or not) and
  the smoke / dust air (every puff x every car each frame, trig first). Both trimmed by `?aifast`.
- The phone is not CPU-bound at 5 AI (~1 ms sim). Its 20-car number comes from the `?ai20`
  `&report=1` run; the laptop numbers are for A/B only.

## The rounds (each a switch, a phone test, then the default; sizes S / M / L)

R0 `ai20` + `aifast` + `aisafe` (DONE 11-03, the default; phone: 20 AI at sim 2 / draw 2 ms a frame): up to 20 AI, ten more liveries; the resting-object
skip and the far-puff skip (simhash SAME). The phone run sets the budget for R1.

R1 REACTION TIME (M; DONE 11-04, the default: the steering is NOT glided - MEASURED, a
held or glided wheel lost 0.5-0.8 s a lap at Naffcar - the hands steer every step onto the line
the last think chose; skill by difficulty `?skillband` with it, owner 11-04) - the driver thinks every 2-4 steps instead of every step, BY SKILL: a top
driver every 1/60 s, a weak one every 1/30 s, staggered round the field so they never all think
on the same step. Between thinks the controls glide to the new aim (steering rate-limited,
pedals ramped) - never a step change. A real driver's reaction is 0.15-0.3 s, so this is
realistic, and it cuts the thinking cost by 2-4x (~0.6 ms a step at 20). Proof: lap times and
the field's resets / crashes per lap (aifieldsuite, pacesuite) the same within noise.

R2 THE WEAVE FIX (M; DONE 11-04, the default, ai/rejoin.ts) - owner: "go fast, follow the line softly from wherever they are; deviation
only as a RESULT". Out: the scripted sine wander (`ai/driverLane.ts`) and the off-line slow-down
(`ai/driverSteps.ts`: a car inside the line slows by sqrt((R - x) / R)). In: a car off its line
aims back to it along a soft rejoin (longer for a calmer / better driver) and takes the corner
at the speed of the path it is ACTUALLY on (tighter only if it really is). Deviation then comes
from what already exists or comes in R3-R5: each driver's own idea of the line (it may change to
overtake, to block, or for the surface), mis-braking (the mistake chance per corner), too much
speed, felt grip, contact.

R3 SKILL + RISK (B1, B2) and the TEST SLIDERS (K15) (M; DONE 11-04, the default) - one SKILL (0-1) per driver drives
pace, line precision, mistakes, reaction (R1) and dodging (R5), with a small top-speed loss for
low skill; a separate RISK (later braking, faster entries, smaller gaps). Test setup gets
sliders (skill, risk, aggression, defence, mistakes): a slider moves the FIELD, each driver keeps
its own offset, so a better driver stays better (owner 11-01). Setup screen mockup first.

R4 FELT GRIP + ICY STARTS (B3, A9) (M) - each driver keeps a running sense of grip from what its
tyres feel (slip vs force) and brakes for corners by it, plus seeing visible ice / water / snow
ahead (confidence by skill). Launch by traction, so an AI on ice pulls away instead of being
reset.

R5 DODGING BY SKILL (B5) (M) - one look-ahead probe per car on the grids that already exist
(loose objects, barriers, cars - a crashed or stopped car too). Owner 11-03: a better driver sees
it EARLIER (look-ahead ~0.6 s of travel at skill 0 .. ~1.6 s at skill 1) and dodges more neatly
(a smaller, smoother swerve); a weak one late and big. Its cost measured against R1's saving.

R6 NEVER WAIT (B4) (S) - what is left after `ainowait`: go round when blocked, push through
slower when not, reverse out after a few seconds, reset only when really stuck; highway racers
not lane-bound, indicators on a lane change.

R7 MENU RACE ON A RANDOM TRACK (K18) (M) - each menu race picks a random circuit, with a chance
of a highway level (owner 11-03: yes); the highway needs the camera car on the highway's own AI
driver.

R8 ONE AI (owner 11-04: "Highway and circuit ai should be the same ai") (L) - one driver for
every level: the highway's weaver (ai/weaver*.ts: its own road frame, line scoring, mirror,
Stanley and speed) folded into the circuit driver (ai/driverDrive.ts), the highway a path like
any other (the road's lanes as width, traffic as cars), so reaction (R1), the rejoin (R2),
skill / risk (R3), felt grip (R4) and dodging (R5) work there too. Order: last (owner: "work in
order").

Total: L (seven phone rounds). Order as listed; R1 first because it pays for R2-R5.

## Other things the measuring turned up (to fix where they fit)

- CATCH-UP LOOP (`game/loop.ts MAX_STEPS = 12`): a late frame on a busy device runs up to 12
  physics steps (0.1 s of game), making the next frame later: slow devices spiral. A cap of ~4
  (the game slows a touch instead of lurching) is a FEEL change - owner to decide; S.
- REPEATED "WHERE AM I ON THE TRACK" lookups per car per step (the ground's banking / camber /
  kerbs, the driver's path index, the barriers): one shared lookup per car per step, simhash
  SAME; S-M, with R1.
- `aiWant` builds a fresh list of every other car for every AI every step (cheap today: 0.03 ms
  a step at 20); folded into R1.
- `_aicost.mjs` took ONE smoothed reading 8 s in: noisy, and blind to the catch-up loop. Use
  `_aiprof.mjs` (median / p95 / max, steps a frame, ms a step, inclusive cost by subsystem).
- In reserve (NOTES 10-17, saved): off-screen AI physics at half rate - not needed while the phone
  holds 20 at ~2 ms.
- Draw cost grows with cars too (laptop 3.9 -> 5.9 ms a frame from 5 to 20 AI): read the phone's
  draw ms in the `?ai20` report before R1.
