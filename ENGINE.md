# ENGINE — the vehicle model AS BUILT

Slice 1: the lab, five cars, marks, touch, knockable cones, and a live tuning panel. Rewritten
2026-09-27 after a playtest pass that changed the handling model substantially. **This file describes
the code that exists.** `PLAN.md` is the plan; where they disagree, this file is right.

---

## The two clocks (CLAUDE.md rule 5)

| FIXED SIM STEP (`DT = 1/120 s`) | WALL CLOCK |
|---|---|
| velocity, slip, yaw, weight transfer | camera follow/lead lerp |
| rpm, gear, shift timer | shift-light flash |
| skid-mark stamping (world bookkeeping) | dust puffs, fps, brake-light glow |
| cone motion and collision | — |

`main.js` accumulates wall time and calls `step(car, input, DT)` in a loop, **max 5 steps per frame**,
dropping the remainder. The vehicle never receives a frame delta.

## The seam (CLAUDE.md rule 6)

Every tunable reaches the model through `car.mods` — `power, shiftTime, inertia, gripLat, gripLong,
brakeTorque, mass, rigidity` — each defaulting to **1.0**, plus `car.surface.mu`. Nothing in the model
knows what an upgrade, a pip or an archetype is. An archetype is a row in `cars.js`.

Global model *shape* lives in one mutable `TUNE` object in `vehicle.js`, which the in-game panel writes
to while driving.

---

## THE TYRE CURVE — the heart of the handling, and what the playtest changed

The first build used `Fy = clamp(−Cα·α, ±μFz)`. Measured occupancy over 12 s runs killed it:

- a **gentle weave** spent **56%** of its time with the front axle saturated and sliding, at 28° of body
  slip. A gentle weave should not slide at all.
- a **normal** sinusoidal steer input reached **90°** of body slip — it spun the car.
- cause: that law saturates at `μFz/Cα` = **4.6° front, 4.3° rear**. A real tyre peaks near 8°. It hit
  its ceiling at half the slip angle it should, then was a flat plateau with no progressive feel,
  followed by a hard switch into a sliding regime at `0.75μ` — a 25% instant grip cliff **and** a
  direction change. That combination is what the user described as "super slippy, strange drift
  dynamics".

**Now:** one continuous curve. It rises to a rounded peak at ~7.4° carrying the same initial cornering
stiffness Ca, then decays gently to slideGrip (0.85) of peak past it. BOTH regimes take their magnitude
from this one curve via curveFactor() — that shared curve is what removed the force step between them,
and it was the root cause of both the spin bug and the judder. See "The spin bug" below.

**Steering lock is derived, not guessed:** `L·μ·g/v² + peak slip angle`, times `steerHeadroom` (1.75) so
the limit can be deliberately exceeded. In reverse it is cut to 62% and reverse is capped at 5.5 m/s —
a reversing car steers on its *trailing* axle and is genuinely unstable, which at 8 m/s with full lock
put the rear at 16° of slip and broke it away.

**Weight transfer runs through the suspension.** Braking loads the front axle, which raises its peak
grip (`D = μ·Fz` feeds the curve) and sharpens turn-in; accelerating unloads it and makes the car push
wide. That was always physical, but it was *instant*. A first-order lag (`transferTau`, 0.18 s, divided
by `mods.rigidity`) makes it a transient you can use — which is what makes trail-braking a technique
rather than a number.

**Yaw damping is one-sided.** It opposes only yaw *in excess* of what the steering asked for, so a held
corner is untouched while a spin or pendulum is arrested. Damping it symmetrically was worse than not
damping at all: it *added* yaw when the car was turning less than commanded, forcing it to follow the
steering angle regardless of grip (measured 1.22 rad/s against a grip-limited maximum of 0.49).

**Yaw inertia is 2.4× the textbook box value, and mass is +25%.** This number has moved three times in a
day, which is itself the lesson: 2.8 → 1.4 → 2.4. It went to 2.8 to stop a flick spinning the car; was
re-measured against the finished tyre model and found to be *suppressing* the drift to 18°, so dropped
to 1.4; then raised to 2.4 alongside the mass and grip increases once the power went up, because a
heavier, more powerful car needs the inertia to match. **A constant tuned against a model that has since
changed is a lie** — re-measure it after every change to the thing it was balancing against, which is
why `tools/` has a harness for each of these behaviours rather than a note saying "feels right".

### Where the drive layout lives

`FxF = Fdrive · drive`, `FxR = Fdrive · (1 − drive)`, and each axle's friction ellipse then eats its own
lateral budget. Apply drive to the body as one force and all five cars behave identically — which is
why the bench has a dedicated detector for it.

---

## MEASURED BENCH GRID — `node tools/probe.mjs`

```
         car   drv    kg   0-27s    vmax  brake m   brk g  lock%  lat g  hb deg  pwrOn d   NaN
   hatch-fwd   FWD  1440    5.73    76.6     33.3    1.26     98   1.44      71      0.0     0
   hatch-rwd   RWD  1440    4.33    76.6     32.7    1.30     97   1.43      70     39.0     0
  estate-4x4   4WD  1810    4.26    72.1     33.1    1.27     99   1.37      70      0.0     0
  muscle-rwd   RWD  1880    3.87   103.1     33.2    1.27     97   1.40      70     52.3     0
   track-rwd   RWD   815    2.95   100.2     29.1    1.42     73   1.75      71     58.9     0
```

**`pwrOn d`** — degrees of body slip added by flooring it mid-corner — is the rule-1 detector: FWD 0.0°
and 4×4 0.0° against RWD hatch 39.0°, muscle 52.3° and track 58.9°. The bench alarms if the two hatches
ever match.

**Donuts.** All three rear-drive cars hold a sustained donut (true wheelspin, yaw ~0.9 rad/s) at
**0.6–0.7× power**; the FWD hatch and the 4×4 estate cannot power-donut at *any* power, which is correct
and is the clearest proof the per-axle drive split is real.

**Judder is fixed** — track car max jerk **413 → 29**, muscle **112 → 1**. See "The spin bug" below; it
was the same root cause.

**`lat g` lands at exactly μ** for every car. That is the correct physical bound (both axles saturate),
and it is also why lat g *cannot* tell the five cars apart — nor can the handbrake bench, which runs at
zero throttle where drive layout is irrelevant.

**KNOWN REGRESSION, not yet fixed:** `bestPed` is now **1.0** for every car, meaning full pedal is once
again the shortest stop and threshold braking is no longer a skill. Raising grip to μ 1.25 outran the
1.35 g brake force, so the front no longer locks early enough to cost distance. Brake force needs to go
to roughly 1.7 g to restore it — it is a row in the TUNE panel, so it can be found by feel.

---

## THE SPIN BUG — root-caused and fixed, 2026-09-27

Reported as "drifting just rolls backwards", and crucially **it happened without the handbrake** —
which ruled the handbrake out entirely. Reproduced bare: throttle + steer, muscle car, no handbrake.
Body slip ran 0 -> -48 -> -87 -> -118 -> -142 deg with vLong reaching -1.9 m/s.

**Mechanism, measured by dumping both axles' yaw contributions:** the front moment sat at +8000 N.m for
the ENTIRE spin while the rear only reached -6000, so the net stayed POSITIVE from 0.17 s to 2.17 s and
nothing ever restored it. While the rear is wheelspinning it puts ~85% of its friction into forward
thrust and only ~53% into lateral; the front, not spinning, keeps its full lateral force. So under
sustained throttle the front permanently out-torques the rear. More power made it strictly worse — the
3x the muscle car was given is what caused the spin it was given the power to fix.

**Fix:** the rolling and sliding laws now take their magnitude from ONE shared curve (`curveFactor`),
evaluated at the axle's combined slip. Previously the sliding branch used a flat mu*slideGrip*Fz 
which disagreed with the ellipse-limited rolling law by up to 2.8x at the hand-over. That single
mismatch was BOTH the spin and the track-car judder.

| | before | after |
|---|---|---|
| muscle spin | -142 deg, ran backwards | -78 deg, recovers to -17, never backwards |
| track judder (max jerk) | 218 | 29 |
| muscle judder | 112 | 1 |

The sliding magnitude is FLOORED at `slideGrip`: `curveFactor` is a lateral curve and returns zero at
 is a lateral curve and returns zero at zero slip angle, so using it raw gave a straight-line wheelspinning tyre no force at all and no car
could accelerate (measured: vmax 0 for four of five). Mass +25%, yaw inertia 1.4 -> 2.4 and grip +15%
went in alongside, all of which the user had already found by hand on the TUNE panel.

Remaining: with the throttle literally pinned for five seconds and ZERO steering correction the RWD
hatch still spins (172 deg). At 0.7 throttle it reaches 4 deg, and with any driver correction it is a
40 deg drift. That is a deliberate spin, not a defect.

## THE HIGH-SPEED SPIN — the real one, 2026-09-27

Reported as a handbrake bug, then a braking bug. It was neither: it reproduces while COASTING at 45
m/s with a steady steering input, no brake and no throttle. At 35 m/s the identical input is stable.

**Measured mechanism.** In a developed slide both axles sit at essentially the same slip angle, so
FyF and FyR are nearly equal — but not quite: the front carries slightly more load because the car is
decelerating. The dump showed Mfront +10976 against Mrear -10635, a NET of +341 N.m that never goes
negative and rotates the car forever. The algebra generalises: a decelerating, sliding car has a
destabilising yaw moment of mu * transfer * L, for ANY geometry.

**Why it only appeared at speed.** The tyres damp yaw through the difference between front and rear
slip angles, which is yawRate * L / v — it SHRINKS as speed rises. At 45 m/s in a full slide slipF and
slipR were within 0.4 deg of each other, so the tyres contributed almost no damping. Making the cars
much faster is what drove them into a region they had never reached.

**Ruled out by measurement, each with numbers:** the handbrake (happens without it); the foot brake
(happens coasting); brake authority (identical 173 deg at 1.35 g and 0.80 g); brake bias (identical at
0.62 and 0.80, where the rear never locks); CG height (0.52 to 0.36, no change); steering amount (spins
at 0.1 as readily as 0.9); steering headroom (spins even at 1.00, i.e. exactly the grip limit); and a
steeper tyre falloff at high slip (no change — the slip-angle difference is ~10x too small to matter).

**The fix: aerodynamic directional stability, which was missing entirely.** A car sliding at beta
presents its flank to the airflow; the sideforce is 0.5 * rho * A_side * Cy * v^2 * sin(beta) and it
acts at a centre of pressure BEHIND the CG, pushing the tail back into line. It is derived from
geometry — side area from the car length, CP at 0.15 * length aft — not from a tuned constant, and it
is the only stabiliser that GROWS with speed, which is precisely where the problem was. Real cars are
directionally stable at speed for exactly this reason.

Also added: **tyre load sensitivity** (grip is not proportional to load; mu falls as the tyre is
loaded, 0.35 swept under hard braking). And the track car needed its brake bias moved 0.66 -> 0.76,
because its rear was locking under braking and spinning it — 124 deg down to 9.

**Result, every car, every speed tested:** coasting at 45 m/s 24-47 deg, braking flat out with the
wheel held 8-84 deg, handbrake flick with the lock held 31-71 deg. Nothing runs backwards anywhere.

## "BRAKING MAKES YOU GO BACKWARDS" — it was literal, 2026-09-27

Reported three times; I kept looking at the tyre model and kept finding nothing, because the cause was
not in the physics at all. Holding the brake at a standstill engages REVERSE (amendment A5), and in
reverse the pedals SWAP — throttle = input.brake. So the brake a player was ALREADY holding became the
accelerator. Measured on every car: brake from 30 m/s, stops at 2.6 s, reverse engages at 3.0 s,
travelling backwards at 5.6 m/s, all from ONE continuous brake press.

**Why no harness caught it.** Every braking and spin bench measured body slip only while speed > 3 m/s,
to avoid atan2 noise near a standstill. A car that had STOPPED and then driven off backwards was
invisible to all of them. The reports were right and the instruments were blind — the failure was not
the model, it was that I kept trusting benches that could not see the thing being described.

**Fix:** a brake press that began while MOVING can never arm reverse. Stop, release, press again — the
deliberate gesture — and reverse engages as before. tools/reversecheck.mjs now tests BOTH directions:
a held brake must stop and stay stopped, and a fresh press must still reverse.

## THE INTEGRATION BUG — "it slides weird, not how a car should", 2026-09-27

The one the user kept pointing at while I kept looking at tyres. It was in the integrator.

Body-frame velocity is integrated with the centripetal terms (dvLong/dt = ax + r*vLat,
dvLat/dt = ay - r*vLong). Those equations already carry the frame rotation, so the components they
produce belong to the END-of-step body frame. The code projected them back to world using the START
heading — and there was even a comment confidently explaining why that was correct. It was not. It
under-rotated the velocity vector by yawRate*dt EVERY step.

Harmless in a straight line. A systematic, accumulating error exactly when the car is rotating fast —
which is every slide, which is what felt wrong.

**Measured on a steady-state circle, which must hold a constant radius:**

| | radius drift over 3 s |
|---|---|
| start-of-step basis (wrong) | -29.07 m |
| end-of-step basis (right) | -5.59 m |

Five times better, and it changed the feel everywhere: handbrake turns went from sliding sideways to
actually turning (hb t90 became reachable again at 1.3-1.6 s, having been unreachable), donut yaw rose
from 0.72 to 1.17-1.25 rad/s, and judder fell again.

**The lesson worth keeping:** a confident comment explaining why something is correct is not evidence.
That comment sat there through every other investigation and steered me away from the real bug.

## BRAKING WHILE TURNING — the last one, 2026-09-27

Found only by reproducing the exact input the user described: turn for 0.8 s, THEN brake, steering
held. Four of five cars rotated past 90 deg and the nose swung 110-116 deg.

**Mechanism, from the trace.** At turn-in the front reached full grip almost instantly while the rear
was still at nothing — FyF 10178 N against FyR -89 N, a net yaw moment of +12658 N.m that spun the car
up to 0.66 rad/s before the rear contributed anything. Then under braking the REAR LOCKED and stayed
locked, so it had no lateral grip left to damp the yaw, and the slip angle grew all the way to 77 deg
as the car slowed. A car with locked rear wheels spins; that is why ABS and EBD exist.

**Fix: brake bias moved strongly FORWARD on every car** (0.58-0.66 -> 0.82-0.86), which is where real
cars put it and for exactly this reason. Braking in a straight line went from 91 deg of slip to 2-15,
and braking in a turn from 4/5 cars spinning to none going backwards and 4 of 5 under 41 deg.

Two things were tried on the way and MEASURED not to help, so they are recorded rather than left in
looking clever: brake authority (identical at 1.35 g and 0.90 g) and tyre relaxation length (kept
anyway at 0.55 m because it IS real, but at 35 m/s its time constant is 16 ms and the transient it
would damp lasts 0.7 s, so it could never have been the cure).

It also fixed the threshold-braking regression as a side effect: bestPed is back to 0.75-0.9, so
stamping on the pedal costs distance again.

## JUDDER — FIXED, 2026-09-28. 413 -> 12.

The cause, dumped: in a sustained powerslide the rear sat exactly on the traction limit and flipped in
and out of the wheelspin branch every few steps, swinging longitudinal force by ~6.8 kN (FxR chattering
439, 218, 837, 583, 314, 29 and then JUMPING to 6783 in one step). The two force laws were near
OPPOSITES at the hand-over — rolling gave full Fx and almost no Fy, sliding almost no Fx and full Fy.

**The fix is a properly shared friction circle.** One friction budget between the two directions: take
both demands and, if together they exceed it, scale BOTH by the same factor. No branch and no
threshold, so there is nothing left to chatter. It also removes a genuine modelling error — the old
code gave longitudinal demand priority, which let a tyre at 30 deg of slip still deliver its full
longitudinal force.

**The scale is LAGGED (CIRCLE_TAU, 60 ms), and that is what made it usable.** Without the lag a gear
shift drops Fx to zero in a moment, the freed budget lands on Fy all at once, and the track car spiked
to 223 — which is exactly why the first attempt at the circle was reverted. The budget cannot be handed
between directions faster than the carcass can take it up.

| | max jerk, track car |
|---|---|
| first report | 413 |
| after the yaw-damping and clutch fixes | 63 |
| lagged friction circle | **12** |

Every other car is now 5-8. Two earlier attempts are recorded above rather than deleted: cross-fading
the laws (drift 49 -> 101 deg and backwards) and hysteresis on the spin state (63 -> 175). Both were
wrong because they tried to smooth between two answers that were each wrong; the circle replaces both.

## Marks

`SLIP_FLOOR = 2.2 m/s` of contact-patch slip before anything is stamped, and stamps are gated on
**0.10 m of travel** rather than per step — so darkness means slip, not speed or frame rate. Stamping
every step made marks compound to solid black within a few frames.

Measured against the real game: handbrake turn 282, full-pedal stop 294, muscle power-on 614, gentle
cornering 8 (a keyboard proxy — with analog steering the physics-level figure is 0%). Frame cost is flat
as the floor fills: **17.7 ms empty → 17.8 ms with a floor full of rubber** at 844×390 DPR 3.

**Correction to `PLAN.md`'s acceptance table:** a straight-line lock-up shows **two** lines, not four —
the rear wheels track over the fronts, so the marks overlay. Four appear only when the car rotates.

## Cones

`cones.js`. **One-way**: the car knocks the cone, the cone never pushes the car (2 kg against 1150 kg is
a 0.17% speed change). Oriented-box vs circle, then
`v_cone = v_contactPoint + 1.45 × closingSpeed × normal`, capped at 26 m/s. The first cut gave the cone
0.85× the car's velocity, so it travelled *slower* than the thing that hit it and got bulldozed along
the bumper down the whole straight. Toppled and standing are different silhouettes, not the same blob
recoloured.

## INVESTIGATION: "drifting slides backwards" / "not enough power" — 2026-09-27

The user reported both while my benches said the drift was 57° and never ran backwards. **The benches
were wrong**, and the reason is worth keeping: they recovered the car with a *perfect, zero-latency*
counter-steer. Re-run with a realistic driver — 250 ms reaction, thumb moving at 3.5/s — the car is
**not recoverable in 5 of 6 cases**, settling at 37–41° and staying sideways.

**Power is not the lever, measured.** Rear forward thrust is 7639 N straight and 4729 N at 80° of
drift — but that is the *tyre's* limit, not the engine's. Past the traction limit more torque only
makes more wheelspin. Holding throttle at 1×, 2× and 3× power gave "drove out / still sideways / drove
out": noise, no trend. Tripling the muscle car's power could not have fixed this.

**Nor is rear grip.** slideGrip 0.88 drove out; 0.94 and 1.00 stayed sideways at 37–41°. More grip
sustains the slide angle rather than hooking up. The shipped defaults are the best of everything tested.

**The physics is correct.** Lifting off recovers the car every time, from every car, ending at 0°.
Holding the throttle sustains the drift. That is exactly how a rear-drive car behaves — the exit is the
right foot, not the steering, and not more power.

**The real defect was that the handbrake was a BINARY button**, so it broke the rear away identically
however it was used: drift angle came out 95 / 95 / 95° at steering locks of 0.4, 0.6 and 0.9. The
player's main input did not change the outcome — CLAUDE.md rule 1. It is now progressive (see below),
and holding it longer now maps monotonically to a bigger angle: 70° → 74° → 93° → 180°.

**Still open:** steering lock *still* barely affects the drift angle, and a 200 ms stab gives a worse
angle (100°) than a 300 ms one (70°). I hypothesised that a partial handbrake parks the rear on the
rolling/sliding boundary and chatters — **tested and disproved**, only one transition per run. The
remaining suspect is the same law-mismatch that causes the track-car judder.

## Progressive brake

A touch button is 0 or 1, so on a phone you could only ever stamp on the pedal — which is exactly the
input that locks all four wheels and stops slowest. Holding the brake now ramps it from an initial
bite of 0.28 to full over **0.5 s** (`BRAKE_MIN` / `BRAKE_RAMP` in `input.js`), on the wall clock,
because it is about how long a human held a button. Measured: 80 ms gives 0.41 pedal, 200 ms 0.59,
350 ms 0.79, 500 ms 1.00. The model still just sees a 0..1 brake input — nothing in the physics
changed. The HANDBRAKE ramps the same way but faster — 0.30 to full lock over 0.35 s — which is what
gave the player control over drift entry at all.

## The TUNE panel

`src/tune.js` plus the TUNE chip. Fourteen live parameters — grip, tyre stiffness, peak slip, slide
grip, steer lock, momentum, yaw damping, power, mass, drive layout, brake bias, brake force,
weight-shift lag, drag. Each is a data row with get/set/range, and **both the drawing and the
hit-testing walk that one list**, so a button can never be drawn somewhere its tap is not. Rows write to
`car.spec` (per-car, discarded on a car change), `car.mods` (the upgrade seam) or `TUNE` (global shape).
Changed rows mark themselves amber and are read live off the car. RESET TUNING restores stock.

## The kerb

A 4 m rumble strip inside the boundary, drawn so you can see what is about to unsettle you. On it,
grip falls to 0.72 and a small alternating yaw nudge shakes the car. Cross it OUTWARD above 16 m/s and
it launches you: car.air seconds during which the tyres make no force at all. Past the kerb is a wall
with a soft bounce — without it the car sailed off the map and stayed airborne, because the kerb band
kept re-triggering outside the floor.

It is wired entirely through the existing seam: the lab sets car.surface.mu and car.air, and
vehicle.js still knows nothing about kerbs — only that the ground is slipperier and that sometimes
there is nothing to push against. That hook has been a no-op since the first day waiting for exactly
this (amendment A6).

A top-down view has no height, so the jump reads through SIZE and SHADOW SEPARATION: the car rides up
toward the camera and its shadow falls away beneath it, both on a sine through the arc.

## Camera

The zoom holds a CONSTANT TIME-TO-HORIZON rather than easing along a speed curve: you always see
LOOKAHEAD (2.6 s) of road, so the distance visible scales directly with how fast you are covering it.
Measured: 37 m at rest, 44 m at 70 km/h, 88 m at 132, 122 m at 189 — a steady 2.3-2.5 s throughout.

Everything that converts metres to pixels goes through one accessor, PPMz(). The car was briefly drawn
from the raw PPM and so appeared to SWELL as the world zoomed out around it.

## Drawing the car

The whole car is authored at a FIXED reference scale (CAR_REF_PPM = 22) and the canvas is scaled as a
unit. The body outline used to be built from metres x ppm while the DETAIL — shut lines, lights,
mirrors, wing thickness, corner radii, stroke widths — was written in raw pixels, so as the camera
zoomed the shell scaled and the details did not and the car visibly changed proportion. Fixing the
literals one by one would have missed some; scaling the canvas means nothing CAN be missed.

Wheels are drawn UNDER the bodywork with their centre on the body edge, so the outer half shows. At the
true track width they were invisible; drawn last they looked like they were floating through the car.

## Rendering

Device resolution, DPR capped at 2. `PPM = clamp(min(W,H)/17, 18, 26)` so the car is the same fraction
of the screen in portrait, landscape and on desktop. Cars are drawn procedurally per `kind`, not
blitted: body gradient, dark rim, greenhouse, shut lines, mirrors, lights, and front wheels carrying the
real steering angle. Floor is 300 × 300 m; the marks layer is 7 px/m (2100², ~17.6 MB).

## Harnesses

`probe.mjs` (6 benches × 5 cars), `markcheck.mjs` (marks discipline), `conecheck.mjs`, `perf.mjs` (frame
cost with the layer full), `devshot.mjs` (real-browser screenshots), `uicheck.mjs` (touch reachability
**and** a control-overlap assertion at six screen sizes — proven to fire by reintroducing the bug).

## Handover Note (F1 Physics / Aero)

**To Claude:** The user has requested that the `track-rwd` car behave authentically like an F1 car (massive downforce at speed, very grippy, high-speed cornering). However, the current physics model heavily punishes massive downforce via the `loadSens` calculation (making mu plummet) and by implicitly stretching the peak slip angle (`D / Ca`) because `caF` / `caR` don't scale dynamically with the aerodynamic load.
Previous attempts to fix this by capping `loadSens` and scaling `caEff` caused unstable twitchiness at low speeds, and pushing `mu` up ruined the realistic slick feel. The Track spec in `cars.js` has been cleanly reverted to its original state so you have a stable baseline. You will need to carefully re-architect the load sensitivity and cornering stiffness rules in `vehicle.js` to allow aerodynamic load to increase grip *without* breaking the mechanical handling model at low speeds.

**CORRECTION, 2026-10-03 (Claude):** the note above says the `caEff` attempt was reverted. **It was not** —
`caEff = ca * loadRatio` and the 1.8 load-ratio cap are still live in `axle()` in `vehicle.js`, and they
caused the freeze below. They are left in (they are part of how the track car currently handles and the
bench grid was measured with them), but treat that block as unfinished work, not a settled model.

## AIRBORNE BRAKE FREEZE — fixed 2026-10-03. `node tools/airbrake.mjs`

**Symptom (user):** "the game freezes or breaks if you jump when braking." Also reported as RESTART/RESET
"broken" and probably as the mobile "zoomed in / offset" screen — all one bug.

**Chain, measured:** an axle in the air has `Fz = 0` → braking marks it locked → the sliding branch of
`axle()` computes `aPeakS = FmaxRoll / caEff = 0 / 0 = NaN` → the car's x/y become NaN on the FIRST
airborne step (8 of 8 cars) → `groundAt(NaN)` finds no surface → `step()` throws on `surface.mu` →
the frame loop (no try/catch, `requestAnimationFrame` at the END) never ran again. The screen froze on its
last good frame; RESTART still reset the car's data, which is why it looked like the buttons were broken.

**Fix, at source:** `axle()` returns zero force when `Fz <= 1 N`. A tyre in the air does nothing. This
also removed a second bug on the same path: with no load, the friction budget of 0 skipped its own
scaling, so throttle and brakes still pushed the car while it was flying.

**Safety net, `main.js`:** the car is checked finite every step (not only on `?dev=1`); a bad state is
logged once to the console and the car is reset near its last good position. `requestAnimationFrame`
is now called FIRST in the loop, and `audio.update` runs after the sim inside a try — measured: with a
NaN car, audio threw every frame BEFORE the sim, so even the recovery could never run.

**Measured after:** `tools/airbrake.mjs` 32/32 (8 cars × brake / handbrake / throttle / brake+steer in
the air) finite, all land and drive on. `tools/probe.mjs` unchanged (rule-1 check FWD 1.1° vs RWD 35.7°).
Real browser: jump + brake, no page errors; an injected NaN recovers in one step with one console line.

**Known, not fixed (small):** `reset()` puts the body at height 0 whatever the ground height is, so a
RESET onto a raised surface (a table-top, a ramp) gives the car a hard bounce on the first step.

## Harnesses added / repaired 2026-10-03
- `tools/airbrake.mjs` — the regression test above. Exit code 1 on any failure.
- `tools/uicheck.mjs`, `devshot`, `hunt`, `markcheck`, `conecheck`, `perf` — Playwright path moved to
  `Desktop/G/GamesStudio/BitterTrade/node_modules` (moved there 2026-10-03; the plant-simulator copy no longer exists). If that moves again,
  it is the one `import ... playwright/index.mjs` line at the top of each.
- `tools/headless.mjs` (DeepSeek) renders into a STUB canvas. It cannot see NaN/overlap/layout bugs —
  CLAUDE.md §3 — use `uicheck.mjs` / `devshot.mjs`, which drive a real browser.

## Outer tyre walls — 2026-10-03
`outerTyreWall(subtrack, { margin, spacing, clear })` in `lab.js` lays ordinary knockable `tyrestack`
objects along the OUTSIDE of a circuit (the side of the centreline facing away from the loop's centroid),
spaced along the wall's own path. Props are kept clear via `propClearance()`; anything within the track
width + 1 m of the road is dropped. Used on Grass Track (margin 3 m, 507 stacks) and Stock Car (margin 2 m
so it runs in front of the sponsor boards, 611 stacks). Nothing in the physics changed — cones.js already
only collides objects with the car, so cost is linear: cone step 0.18 ms/step at 627 objects.
Measured: a car at 22 m/s goes through the wall losing ~1.5 m/s; it is a visual edge and a scatter
hazard, not a barrier. Placement check / plot: see the repair-pass notes; re-run `node tools/uicheck.mjs`
after any HUD change (it now includes the cone tally).

## Surface graphics + ground tiles — 2026-10-03
**Ask:** "All surfaces should have unique and noticeable graphics so we can easily and instantly tell them
apart." Photographed before: every surface was a colour + the same square speckle; grass/short grass,
tarmac/race tarmac, wet/broken, sand/gravel, mud/dirt read as pairs, and long grass was on no level.

**Now:** `SURFACE_ART` in render.js gives each surface a base colour + pattern LAYERS built from
world-locked, view-culled, batched primitives (`PRIM`: grain, stones, blades, stripes, ripples, blobs,
rings, cracks, sheen). Signatures: tarmac aggregate / race tarmac smooth + rubber streaks / broken cracks +
patches / dirt pebbles / mud dark pools / thick mud ridged ruts + gloss / gravel round stones / sand
ripples / grass mown stripes / long grass blade tufts / snow drift shadows / ice sheen + white cracks /
wet puddles + reflections + rain rings. grass and grassShort are deliberately identical (identical physics).
New surface `thickMud` (lab.js; mu 0.38, longK 0.70, plough 1.9 — sized under the 2WD stall line: after
6 s full throttle 2WD cars reach ~3 m/s, 4x4s 10-12, tractor 1.3). Lab test panels added for long grass
and thick mud at (-143,-106) and (-77,-106), a spot scanned clear of cones, bumps, paint and spawn.

**Cost, and the GROUND TILES that pay for it** (Stock Car, 4x CPU throttle, 4 s run, 240 = clean 60 fps):
no patterns live 229 frames · patterns live 130 · one big cache 193 (each repaint a 100-200 ms raster
hitch) · **tiles 231** (worst hitch 33 ms). Floor + zones + ribbon are painted into 256 px world-aligned
tiles at zoom steps of 2^(1/3); at most TILE_BUDGET (2) new tiles per frame, the previous zoom step's
tiles stand in during a zoom change; 48 tiles cached (~48 MB at dpr 2). Wear, marks, kerbs, bumps,
props, cones and the car are still drawn live on top. The lab's warm light pool is now centred on the
world origin (a screen-centred gradient cannot be split across tiles).
Re-shoot the comparison: see TODO "SURFACE EVOLUTION"; perf: real-browser 4x-throttle run (pattern in
this section) — the JS timer alone under-reports it, because canvas rasterisation happens after the call.

## Cover layers + layered wear — 2026-10-03. `node tools/wearcheck.mjs`
A wear cell has a BASE (wears by passes: long grass > short grass @2 > dirt @4 > mud @6 > thick mud @9) and
an optional COVER (snow / ice / puddle) that protects it. Snow packs to ice after 4 passes; ice is scrubbed
through ONLY by a sliding or locked wheel (slip > 2 m/s, 2 m of slip per cell) and exposes the base, which
then wears by its own rules. Puddles scale their base (mu x0.72, +0.6 plough, wet marks/spray) instead of
replacing it with wet-tarmac grip. Covers are level data (`LEVEL.covers`, placed with `onTrack()` on
circuits) and a snow/ice ZONE is a cover over `zone.under` (default tarmac). One rule table — the old code had
two with different numbers and the only test exercised the one the game never used.
Measured with the real car on the lab ice sheet: 6 coasting passes wear 0/80 cells; one locked-brake pass
scrubs 32 cells to grass; 6 more passes turn those to mud. Wear clock is global (was per car: switching car
stopped wear counting). Rendering: covers and wear are BAKED INTO THE GROUND TILES — base wear UNDER covers,
changed covers OVER them (the reverse ate puddles on the Grass Track, user-reported). Changed cells mark
their tiles stale; stale tiles repaint within the tile budget. Worn cells draw as soft discs.

## Grass Track layout — 2026-10-03 (second pass, after the user found random sectors "too uniform")
`randomiseGrassTrack()` in lab.js, run by `setLevel` every load (RESTART keeps it). The BASE is fixed: dirt on
both oval ends, short grass on both straights (runs under 20 m absorbed — the raw corner test produced 23
slivers). Every load scatters 46 random PATCHES (`LEVEL.patches`, 1-5 m ellipses) of long grass, mud, thick mud,
dirt or grass over the racing surface, picked by whether they sit on a straight or a corner. Patches are real
ground: `layersAt` reads them before the zone, so they grip, wear and draw as their surface. Three hard-edged
mud rectangles at the outer edges (Gemini) were removed — their straight sides cut the track edge.

## Objects hit each other — 2026-10-03. `node tools/objcheck.mjs`
cones.js `collideObjects()`: circle-circle impulse with restitution (cone 0.45, tyre 0.35, stack 0.25, props
0.15), positional correction by inverse mass, glancing spin; a stack hit above 3.8 m/s bursts (`burstStack`,
shared with the car path), a cone above TOPPLE_V topples. Only MOVING objects are tested — against a
persistent grid of the resting objects (built on reset, re-filed when something stops) and each other.
Measured: tyre 10 m/s knocks a cone to 10.9 m/s; fast tyre bursts a stack, slow one shoves it; every level
at rest: 0 objects move; car 22 m/s into the Stock Car wall knocks 12 (was 9). Cost mid-crash 233-279 us per
step against a 235 us no-collision baseline (grid rebuilt every step was 446; movers-vs-list 437-626).

## Puddles mix, ice takes passes, wet dries — 2026-10-03 (user feedback while testing)
- A puddle is churned away in PUDDLE_PASSES (3) and leaves WATER_MIX of its base: grass/dirt -> mud, mud ->
  thick mud, sand -> gravel, gravel -> mud; tarmac just dries. (Before this, puddles were permanent.)
- ICE_SCRUB 2 -> 7 m of slip: one locked pass no longer breaks ice (measured: 0 cells), three do (26 cells).
  When tyre temperature exists, hot tyres should scale ICE_SCRUB down — nothing else.
- A WET zone is now a cover over tarmac like snow/ice, so wet panels and sectors DRY where driven. Wet art has
  blue-ish puddles; broken tarmac lost its circles (cracks only). All in tools/wearcheck.mjs.

## Surface Sandbox — rebuilt 2026-10-03 as a real circuit
A 1,669 m subtrack (lab.js SB_*) through every surface in order: race tarmac, tarmac, broken (kerbed chicane),
gravel, dirt, sand, mud, thick mud, long grass, short grass, snow, ice, wet. Covers on the road (puddles, black
ice, a snow drift, ice on grass), infield test pads (wet, snow, ice, mud, gravel, sand) and long-grass
patches, cone gates every 18 m, tyre-stack barriers outside four corners, grandstand + chequered line. NO
JUMPS (user). Lap timer / RESET come from the subtrack. Everything is placed by distance along the lap
(sbAt), and kerbs/barriers find inside/outside from curvature, so moving an apex keeps them right.
Geometry: tightest radius 11.8 m, nearest other part of the track 49.7 m, max extent 213 m. Verified: lap
counter ticks in the real game; scripted laps clean (below).

## Scripted lap driver — 2026-10-03. `node tools/lapdriver.mjs [level] [car]`
The benchmark CLAUDE.md §8 asks for. Stanley steering (heading-to-tangent + cross-track at the front axle),
a GRIP-LIMITED steering cap (~L*mu*g/v^2), corner speed sqrt(0.40*mu*g*R) with braking planned at 0.30*mu*g,
braking only in a straight line, throttle backed off as the rear slides. Each was a measured failure first
(see the comments in the file). Clean laps, 0.0 s off the road:
  sandbox: hatch-rwd 117.9 s, rally-4x4 108.8 s, muscle-rwd 115.8 s · test-track hatch 50.6 s ·
  grass-track hatch 37.9 s (layout is random per load) · stock-car hatch 28.5 s.
It is a CAREFUL driver — consistent rather than fast — so compare runs with each other, not with a human.
- (later, same day, user) SNOW packs for SNOW_TO_ICE (4) passes, then becomes ICE or MELTWATER by chance
  (SNOW_MELT_CHANCE 0.5; measured 14 ice / 26 water over 40 cells). SCRUBBED ICE leaves MELTWATER, not bare
  ground — a puddle over the base, which then churns into WATER_MIX: ice over grass ends as mud (measured).
  Meltwater draws as the base plus a water tint (blue on grass, brown on dirt/mud).

## Level fly-in + kerbs on top — 2026-10-03
FLY-IN (playtesters; DeepSeek's version had been reverted): each level start opens on the whole level (track
bbox, or the floor), holds FLY_HOLD 0.45 s, then eases in over FLY_TIME 1.5 s (ease-in-out in log zoom; the pan
leads the zoom). The ground TILES cannot serve a sweep through ~11 zoom steps (photographed as a blurred smear,
user: "struggles and glitchy"), so while zoom < FLY_HANDOVER 0.28 a one-off OVERVIEW image of the whole level is
drawn instead — FLAT COLOURS (with patterns it cost 3.9 s to rasterise at 4x throttle; flat: 0.6 s, once, in the
hold) — while the close-up tiles round the car are pre-painted FLY_PREFETCH 2 per frame on the EVEN zoom steps
only; after the hand-over the flight uses those even steps. Measured: no blur, median 33 ms/frame at 4x
throttle during the flight. Guarded against an unmeasured canvas (a ?level= link loads before W is known:
zFit 0 -> log -Infinity -> NaN zoom -> "createRadialGradient non-finite"). MARKS_MAX 30000 caps any one
pattern layer call, everywhere.
KERBS are drawn LAST on the ground (drawCurvedKerbs, split out of drawTrackRibbon) and win over random patches
in layersAt — wear and patches were painting over them (user screenshot).

## Tyre temperature — 2026-10-03. `node tools/tyrecheck.mjs`
Four tyres (car.tyreT, deg C; index 0 F+y, 1 F-y, 2 R+y, 3 R-y — +y is the car's RIGHT). HEAT = friction work
per axle (sliding/spinning/locked: |F| x slipSpeed; rolling: |Fy| x |lateral patch speed| + ~8% longitudinal
slip x |Fx|), split left/right by lateral load transfer (0.5 - ay*cgH/(track*g)), / TYRE_HEAT_CAP 2200 J/C.
COOL = (0.010 + 0.0010 x speed + surface.coolK) x (T - ambient 18 C). Surfaces carry `hard` (tarmac family,
kerb, lab, wet) and `coolK` (snow/ice 0.15, wet 0.10, puddles >= 0.12, all other loose 0.06) — data, not names.
GRIP: only on hard surfaces, per axle the mean of tyreGrip(T): spec.tyreColdGrip (0.86) at ambient rising to
1.0 at spec.tyreOpt[0] (65), 1.0 to tyreOpt[1] (105), then -0.4%/C to 0.72. Tyres start COLD every reset.
Measured: straight cruise 30 s stays 18-20 C; clean 0.8 g corner 30 s: outside tyres 54-58, inside 29-30;
12 s power slide: rears 166-184; 4 s burnout: driven tyres ~110 (FWD fronts / RWD rears / 4x4 both); peak
lateral g on tarmac cold 1.18 / working 1.37 / overheated 1.12, gravel 0.87 at any temperature; from 100 C,
10 s coasting: tarmac 83, grass 53, snow 33. First calibration cooled with a 17 s time constant (a clean corner
reached only 30 C) — see the comment on TYRE_COOL.
SEEN, not shown as numbers (user): cold tyres lay faint marks (marks.js, alpha x 0.3..1 by temperature), warm
working tyres shed rubber MARBLES beside the line, tyres over 115 C that slide SMOKE (render.js addSmoke).
Hot tyres also clear covers faster: ice scrub x(1 + (T-60)/30), and a pass over snow/water by a tyre over 80 C
counts twice half the time. OPTIONAL tyre HUD (TUNE panel footer, off by default, remembered per device): four
coloured temperatures in the speed panel; uicheck covers both modes. Bursting waits for the damage system.
Bench note: tools/probe.mjs now runs on cold tyres (hatch braking 38.1 m, lateral 1.39 g) — still in target.
REVISED same day after the user drove it:
- GRIP ORDER (user): cold < warm < hot (peak) > too hot > cold. tyreGrip: 0.86 at ambient, 0.97 at 65 C, 1.00 from
  90 to 110 C, then -0.15%/C floored at 0.90 — overheated is never worse than cold (first cut went to 0.72).
  Measured peak lateral g on tarmac: 18 C 1.178 < 65 C 1.330 < 100 C 1.373 > 150 C 1.289.
- HARDER TO WARM (user): TYRE_HEAT_CAP 2200 -> 3500, cooling x0.8. 30 s clean cornering now 43-45 C (part-warm);
  120 s reaches 66-71 C; 4 s burnout ~77 C; a 20 s power slide still overheats the rears (173-194 C).
- COLD MARKS (user: "cold tyres don't really leave skid marks"): none below 35 C, full from ~90 C. Measured on the
  marks layer, a locked stop from 86 km/h: cold tyres 253 px at alpha 0.09 vs warm 658 px at 0.51 (~7% of the ink) —
  the faint tail exists because the skid itself heats the fronts 18 -> 59 C within the stop.
- MARBLES (user: "a bit obvious"): chance 0.35 -> 0.08, smaller and fainter.
- COOLING by surface (user: "cold and wet surfaces should cool tyres faster"): snow / ice 0.25, puddles 0.20, wet
  tarmac 0.18, thick mud 0.12, mud 0.10, dry loose ground 0.06, hard dry surfaces 0. From 100 C, 10 s coasting:
  tarmac 86, grass 55, wet tarmac 29, snow 24.
- OVERHEAT HOLDS (user-reported bug: "too hot just rolls over and starts cold again"): the guard reset anything over
  400 C to ambient. Now NaN-only, capped at TYRE_T_MAX 260 and held until it cools; bursting waits for damage.
  tyrecheck 6: 60 s pinned burnout peaks at 260 and never drops below 200.
- TYRE HUD is now a little top-down CAR, FRONT up, wheels filled with their temperature colour, numbers beside
  them — the outline the damage display will reuse.

**CORRECTION (2026-10-03, later):** the "Objects hit each other" section above says object hits cost about the same
as the no-collision path (235 us baseline). That baseline was a single noisy A/B. Measured properly — both paths in
the SAME run (tools/objcheck.mjs) — the object system mid-crash costs 237-297 us/step with object hits against
86-156 us without. Part of that is simply MORE GAME (15 objects knocked instead of 9, so more debris to simulate).
It is well inside budget (gate: < 0.5 ms per physics step, ~6% of a 60 fps frame at 2 steps/frame), but it is not
free. The per-step closure and per-contact array allocations were removed along the way.

## Surface blending at change points — 2026-10-03. `node tools/blendcheck.mjs`
lab.js buildBlend / prepareLevel. Generated as PATCHES (real ground — grip, wear, graphics), looked up through
PATCH_GRID (6 m cells): (a) track sector changes — each side scattered into the other, density triangular,
peaking at the change point, zero at BLEND_W 6 m; (b) loose road edges — the road drags onto the verge and the
verge creeps onto the road; (c) natural zone edges (never boxed / rounded test pads). Kerbs always win.
User refinements: SMALL patches (0.4-1.4 m) and ONLY LOOSE surfaces travel — a hard surface (tarmac family,
lab floor, wet tarmac) never scatters onto anything. Seeded per level (fixed every load); the Grass Track re-rolls.
Measured: 3,400+ patches over all levels, 0 hard; falloff 102/61/41/21/14/4 per metre from the change point
(first cut snapped to the ~4 m track samples and clumped: 89/1/25/70 — now interpolated); 628 kerb points under
patches all still read KERB; groundAt 3.0 us with 1,466 patches. Frame cost unchanged (A/B blend off vs on within
noise; after the fly-in: 227-228 of 240 frames at 4x throttle). Covers (puddle / snow / ice edges) not blended yet.
NOTE for perf tests: measure AFTER the level's fly-in — its one-off overview paint and tile prefetch otherwise
drag a 4 s window down to ~170 frames and look like a regression.

## Water dries by tyre heat; cleaner track sides — 2026-10-03 (user, after driving)
- WATER: a pass adds dryness by tyre temperature (lab.js dryAmount). STANDING water (level puddles, meltwater
  from scrubbed ice or melted snow) needs HOT tyres — cold tyres never clear it (weather will, later); DAMP ground
  (wet zones / sectors, wet tarmac) forms a dry line with cold tyres slowly and warm tyres fast. When dry it still
  mixes with its base (WATER_MIX). Measured (wearcheck 3c, 4b, 4c): puddles on sand / gravel / grass — never in 60
  cold passes, 4 passes at 110 C leaving gravel / mud / mud; meltwater survives 6 cold passes, hot passes leave
  mud; lab wet panel: dry line after 17 cold passes, 3 at 100 C. Replaces the 40%-per-pass churn of ANY tyre.
- ICE: hot tyres help less — scrub x1 at 60 C to x1.67 at 120 C (was up to x3).
- TRACK SIDES: the loose-road edge blend is now a thin, sparse fringe (18% per metre, within ~1.7 m of the edge);
  the verge no longer creeps onto the road. Sector-change blending is unchanged.

## PIXEL ART — the default renderer since 2026-10-03 (?smooth=1 for the old one). `node tools/spritesheet.mjs`
User: "everything pixel art, realistic-ish", car ~70 px like art/reference/car-ref-*.jpg; approved from a ?pixel=1
mock-up; HUD stays CRISP. render.js:
- The WORLD draws into a low-res buffer: one art pixel = PIXEL_CSS 1.3 css px = an integer pk device px; `dpr`
  becomes the buffer's effective dpr, so every draw function and every ground tile works unchanged at low res;
  frame() blits the buffer up with smoothing off. renderer.ctx (the HUD's) is always the full-res screen.
- CARS: generated pixel sprites (pixelCar), one generator per kind (hatch, estate, muscle, rally, track, stock =
  Naffcar, tractor) on an integer grid at SPRITE_PPM 17.3 art px/m: 1 px dark outline, flat paint + one light band,
  black glass, shut lines, mirrors, lights, a 3x5 pixel digit font for roof numbers. Wheels are separate blocks so
  the fronts steer. Reviewed on tools/spritesheet.mjs (in-game shots + raw sprites x6) -> art/sprite-sheet.png.
  Roll-angle and DAMAGE sprites are planned as generator parameters, built with the damage system.
- CONES and TYRES: pixel sprites (pixel-round via pdisc, never an anti-aliased arc): upright / knocked cone,
  flat tyre with a see-through hole, stack with a raised top ring, side-on rolling tyre.
- GROUND tiles are PALETTE-SNAPPED once when painted (paletteSnap: 32768-entry LUT to the surfaces' own colours,
  each translucent layer blended only over its own base — blending over every base gave ~1,500 shades and the blur
  survived). SQUARES NOT CIRCLES (user): blend patches and Grass Track spots are 0.5-1.5 m squares on a 0.5 m world
  grid (physics uses the same squares), worn cells are squares, stones / blobs are square, rings are dropped.
- PARTICLES: square, grid-snapped, alpha in 4 steps.
Measured: frames at 4x throttle after the fly-in 213-227 of 240 (same as smooth); p95 spikes up to 26 ms when new
tiles are painted + snapped. - COVERS (puddles, snow, ice): drawn as the 0.5 m grid squares inside the shape, with a square rim (coverCells);
  physics keeps the exact shape. SKID MARKS: the marks layer is blitted with smoothing OFF, so marks are hard blocks.
- PROPS (caravan, bangers, grandstands, gantry, podium, boards, pylons) are the smooth drawings rasterised through the
  low-res buffer — photographed, they read as pixel art; dedicated sprites only if the user asks.


## WATER ON SOFT GROUND CHURNS (2026-10-03, fourth water pass) — lab.js passCell, tools/wearcheck.mjs 3c/4b
User: "water on dirt ... should become mud when driven over". MEASURED BUG: standing water mixed into its base only once
DRIED, and standing water only dries above 60 C, so a puddle on dirt never became mud in normal driving. Now: over any base
with a WATER_MIX rule (grass, dirt, mud, sand, gravel) every pass of ANY tyre has WATER_CHURN_CHANCE 0.4 to churn it,
and the 3rd pass always does (pure 40% measured worst cases of 9-12 passes). Measured over 200 puddles each: 1.8-2.0
passes on average, worst 3. Tarmac puddles keep the heat / weather rule (cold never, 110 C in 4 passes).

## VISUALS MATCH PHYSICS (user rule, 2026-10-03: "surface visuals should be accurate to their effects") — tools/visualcheck.mjs
Distinct textures per surface are enough (user); the rule is that what is DRAWN at a spot is what you DRIVE ON there.
tools/visualcheck.mjs paints each level flat through the real renderer (renderer.debugFlat: base colours, no patterns,
the same layers frame() draws) and compares every 0.5 m pixel with groundAt(). Gate 0.5% per level; a correct level
measures 0.14-0.33% (anti-aliased kerb teeth and edge lines). Proved to fire by reintroducing the kerb bug (2.7-3.4%).
Found and fixed with it:
- KERBS ON THE WRONG SIDE. querySubtrack called the +normal side 'right'; drawCurvedKerbs calls it 'left'. Every
  curved kerb you could see was plain grass, and the kerb you bumped over was invisible on the other side of the track.
  Physics moved to the drawing (the drawn kerbs are the approved ones). Grass Track 2.86% -> 0.21%, Stock Car 3.62% -> 0.33%.
- ROUNDED TEST PADS: drawn with rounded corners and a 1.2 m tarmac apron; physics was the plain rectangle, so the apron
  drove as grass. zoneAt now uses inRoundRect + PAD_APRON (change it with drawZones).
- SECTOR CHANGES were drawn at the first track sample past the boundary, up to ~3 m late. drawTrackRibbon now cuts each
  span at the exact boundary (sectorCut, bisected on sectorAt — the physics' own rule).
- COVERS (puddles, snow, ice) grip on the same 0.5 m squares they are drawn as (coverAt tests the centre of the point's
  square, COVER_SQ; render.js coverCells uses the same grid).
- Damp 'wet' zones drive as water on their base but are drawn with the wet-tarmac art: deliberate (damp dries under cold
  tyres, a standing puddle does not); the tool accepts it.

## TYRES: HARD TO OVERHEAT (user, 2026-10-03) — vehicle.js TYRE_HEAT, lab.js HEAT_OFFROAD, tools/tyrecheck.mjs section 7
User: "heat up too easy and pass the good range too easy ... long burnouts to pop them, excessive drifting on tarmac to
overheat, off-road surfaces shouldn't get them up much". MEASURED before: a tarmac drift was too hot in 2.3 s and at
260 C in 8 s (faster than a burnout); a gravel drift reached 260 C in 14 s. Fix (physical, all data):
- slide heat saturates with slip speed (slipSat 4 m/s) and the tyre's share falls with ground speed (roadV 12 m/s):
  sliding over fresh road heats the road; a pinned burnout keeps it all — so burnouts pop and drifts only overheat
- surface.heatK: loose ground gets HEAT_OFFROAD 0.15 of it (the slip happens in the ground)
- tyre heat capacity scales with car mass (ref 1440 kg) — the tractor popped in a 14 s burnout before
After (hatch-rwd): burnout too hot 18 s, 260 C 57 s; drift warm 13 s, too hot 27 s, never 260 C; off-road drift 21-25 C
at 30 s; clean cornering unchanged (warm at ~80 s). Every car: burnout pop 40-72 s (4x4 estate never), tarmac drifts
never pop except the tractor (~44 s: its slow "drift" is a burnout on giant wheels).

## HOW TO PLAY guide — 2026-10-03 (user). `src/guide.js`, `node tools/guidecheck.mjs`
- A card overlay that POINTS AT what it describes: the screen dims, a hole is cut round the target (pulsing amber rim
  over a dark rim — amber alone vanished on the light Lab floor, photographed), a card sits clear of it with an arrow.
  NEXT / SKIP / progress dots; DONE on the last card. Keys: Enter / Space / Right = next, Esc = skip.
- 8 cards, as DATA (CARDS in guide.js): steer, gas + brake, handbrake + reverse, speed + gears (+ lap on circuit
  levels), car + track chip, RESTART / RESET / CLEAR, tyres + surfaces (points at the car), "?" to replay.
  Touch and PC have their own wording; on PC the control cards point at the key-hint line.
- Targets come from hud.layout() / input.pedalHits() every frame — the same geometry the HUD draws and hit-tests.
  Card placement: below, above, right, left of the target, first that fits on screen without covering it; else centred.
- Opens by itself ONCE per device (localStorage carsim.guideSeen, guarded), after the first fly-in lands. The sim
  PAUSES while it is open (main.js: no fixed steps, accumulator zeroed). It consumes every tap; only NEXT/SKIP act.
- Not auto-opened under automation (navigator.webdriver), so existing harnesses are unaffected. ?guide=1 forces it,
  ?guide=0 suppresses it.
- Replay: "?" chip at the end of the button row (after VOL wide, after CLEAR narrow). At 360 px it would hit the speed
  panel, so it drops to row three, left, hidden while the dropdown / TUNE panel own that lane. H on a keyboard.
- guidecheck: 6 sizes x Lab + Grass Track — every card on screen, clear of its target, NEXT inside it, stray taps
  neither advance nor steer, sim paused, DONE closes + marks seen, "?" reopens. PROVEN (rule 19): served a guide.js
  that places cards on their targets -> 54 failures. uicheck's overlap list now includes "?".
- RULE (CLAUDE.md §4): any control or mechanic change updates its card in the same task.

## NAFFCAR BANKING only on the banked track, pushing INWARD — 2026-10-03 (user: "grass seems way too slippy" — Naffcar)
- BUG: applyGround applied mass*g*sin(0.31) = ~4.3 kN to the car's LEFT whenever |x| > 130 — on grass, run-off and
  infield too, whichever way the car faced. MEASURED, grass, straight, hands off, 50 km/h, 2 s: rear-drive cars spun
  (60-89 deg slip), FWD hatch shoved 30 m sideways; inside 130 m dead straight.
- FIX (lab.js bankAt): only within the track ribbon (+1.5 m for kerbs) in the turns, toward the infield side of the
  centreline normal, projected on the car's lateral axis. After: same test 0.0-0.1 m sideways, slip < 2 deg; on the
  track in both turns the force points to the infield.
- Lap driver on Naffcar unchanged for hatch-rwd 38.4 / muscle 36.5 / track 32.6 s (on track, laps run anticlockwise,
  so "left" was already the inside). The Naffcar V8 FAILS the lap driver before AND after (13.8 -> 12.7 s off the
  road): pre-existing, step 3 (handling).
- Grass grip itself is unchanged since the Gemini build (A/B, 4 cars, identical). Grass mu 0.34 < mud 0.45 is still
  an open question to the user.

- 2026-10-03 follow-up (user): grass grip stays 0.34 ("grass is fine now"). LONG GRASS grabs: plough 0.10 -> 0.35 —
  0-50 km/h +1.0 s vs short grass, coast-down distance roughly halved; wears to short grass in 2 passes as before.

## HOLD R TO REVERSE + RESET breadcrumbs — 2026-10-03 (guide audit; user: "the card is simple, the game is wrong")
- vehicle.js: R is a pedal (0..1, ramped like GAS in input.js). R while rolling forward brakes; below 1 m/s reverse engages
  and R drives backwards. Release R -> back to forward gear below 1 m/s (or GAS below -0.5 m/s). GAS while rolling
  back = brake. BRAKE always brakes and can never select reverse. tools/reversecheck.mjs: 5 cases x 8 cars OK.
- main.js: breadcrumbs were read by doReset() but never written. Now every 0.5 s while moving > 3 m/s and grounded
  (position + direction of TRAVEL), 12 kept; RESET without a circuit uses the one ~2 s back.
- Found: no rolling resistance / engine braking (coast 5.5 -> 5.4 m/s in 1 s); reset() resets tyre temps (so RESET
  cools the tyres). Both queued for step 2.

## TYRE FLEX HEAT + RESET keeps heat — 2026-10-03 (user: "semi easy to get warm, but you'd have to try to overheat")
- vehicle.js TYRE_FLEX { k 0.07, T 85, vRef 12 }: a GRIPPING axle warms its tyres toward 85 C at k x (force/load) x
  tyre share x speed factor; zero above 85 C and zero while sliding / spinning / locked, so only slip work overheats.
  First cut (k 0.09, all axles) took the drift's too-hot time 27 -> 17 s; restricting to gripping axles restored 27 s.
- MEASURED (tyrecheck): 30 s hard cornering outside 43-45 -> 79-81 C, inside 26 -> 51 C; 2 min 82-83 C (plateau);
  drift too hot 27 s, burnout 18 s / pop point 57 s — unchanged; 30 s cruise at 90 km/h 18-26 C.
- main.js doReset keeps the tyre temperatures across RESET; RESTART and a car change still start cold.

## ENGINE BRAKING — 2026-10-03 (step 2)
- Rolling resistance already existed (rollC 0.015 = ~0.015 g). Missing: engine braking. Now off the gas, in gear and rolling
  the way the gear drives, a force of ENGINE_BRAKE (0.18) x m x g x rev fraction acts through the DRIVEN wheels.
- Torque-scaled (0.25 x drive torque) was tried first: muscle 0.51 g / track 0.45 g from a lift — a brake. Rejected.
- MEASURED 100 -> 50 km/h lift-off: hatch 47.5 -> 13.3 s, muscle 36.9 -> 10.3, track-rwd 30.4 -> 9.8. Slide recovery on a
  lift 0.47-2.68 s (unchanged), judder bench unchanged, reversecheck OK.
- Knock-on: flex heat (TYRE_FLEX) uses CORNERING force only — with Fx included, a bang-bang 90 km/h cruise warmed the rears to
  46 C. Now 22 C.

## DRIVER AIDS — 2026-10-03 (user verdict: "work great"). tools/aidcheck.mjs
- cars.js aids: hatches + estate ABS+TCS, muscle ABS. On by default; chips above the pedals (green on, amber flash working), B / T keys.
- ABS: brake per axle capped at 0.92 of grip left after cornering. Mid-corner full brake at 100 km/h: fronts no longer lock, car turns 11-48 deg (was 0-1); stops unchanged.
- TCS traction: engine cut above 0.8 m/s wheelspin; slippery launches 50-60 m of spin -> 3-22 m.
- TCS stability: direct yaw moment capped at one wheel braked at its limit + its drag + throttle cut; slip-angle first; gentle understeer correction; only above 10 m/s. Slides 48->15, 26->14, 24->8 deg; clean cornering unchanged.
- Engine braking capped at half the driven-wheel grip; throttle ramp 0.75 s.

## BRAKES + HEAT SPIKE FIX — 2026-10-03 (user reports after the aids)
- FLEX HEAT SPIKE: over the Test Track table with the handbrake on, the fronts gained +203 C in ONE step (airborne axle: Fz 0,
  lagged Fy 7.6 kN -> force/max(1,Fz) ~ 7600). Now: grounded axles only (Fz > 5% static), load floored at 25% static,
  utilisation capped at muBase, and the flex step capped so it cannot overshoot TYRE_FLEX.T. Jump slide now +2.9 C.
  tools/tyrecheck.mjs section 8 (jump slide, jump brake, braking slide grass -> tarmac): no step > 2 C, no event > 15 C.
- BRAKES: brakeMaxDecel 1.35 -> 1.8 (warm tyres since flex heat out-gripped the old brakes: rally/track/naffcar could not lock).
  Brake pedal ramp 0.5 -> 0.25 s. HANDBRAKE OVERRIDES TCS stability while pulled + ESC.hbHold 0.6 s.

## TERRAIN — step 3, 2026-10-03. tools/terraincheck.mjs
User: "make sure banked surfaces are clearly shown with brighter spots and shadowing, same with bumps and dips"; "vector dips
... push in all 8 directions, out and in"; chose pixel hill-shading, a Lab suspension zone (whoops, dips + compressions,
washboard, banked bowl), old jumps rebuilt as terrain, ruts that deepen.
- HEIGHT = lab.js bumpAt: bump shapes (hump, dip, ramp, table, kerb, washboard, bowl) + bankHeightAt (banking) - rutAt (ruts).
  The suspension reads it per axle (groundAt h) as before. smooth=true drops kerb ridges, washboard and curved kerbs.
- SLOPE FORCE (applyGround): F = -m g grad(smooth h), averaged under the 4 wheels, capped at 45 deg, grounded only, to body
  frame -> car.slopeLong / slopeLat -> vehicle.js Fxbody / Fybody. Measured: hump OUT 8/8 sides, dip IN 8/8, washboard 0.
- BANKING: bankHeightAt — across the track in the turns, 0 at the inside edge to tan(bank) x width at the outside, then a
  16 m back slope; turns blended in over |x| 100..160. Replaces the sideways bank force. Naffcar laps unchanged (all clean).
  First cut blended over 30 m (a 23% ramp at 200 km/h) and an 8 m back slope (52 deg) — both lengthened.
- RUTS: passCell digs RUT[base] per pass (mud 2.5 cm / max 15, thick mud 3 / 22, sand 2 / 12 at 50%, gravel 1.5 / 8 at
  35%); rutAt bilinear between cell centres. Measured on a mud panel: 2.5 -> 22 cm over 8 passes; the groove pulls in.
- HILL-SHADING (render.js hillShade, after the palette snap): per 0.5 m cell, light from the top-left, sqrt response (a 0.3 m
  whoop must read), 4 bands, WARM light / COOL shadow (toward white was invisible on the lab floor; multiply was invisible on
  dark race tarmac). The hump / ramp / table hand art is gone (it doubled up with the shading); the ramp's red lip stays.
- Lab SUSPENSION ZONE at x -245..0, y 166..214: whoops 0.15-0.40 m, dips 0.15-0.45 m + a 0.8 m compression, 50 m washboard,
  a bowl (flat to 6 m, 2.5 m wall at 18 m). Painted box + lanes + labels. At 50 km/h: whoops 1.95x load and 0.74 s air,
  dips 2.2x, washboard 20x the chatter of flat floor.
- Overhead props (the Naffcar gantry) are drawn after the cars (render.js OVERHEAD).

## TERRAIN FOLLOW-UPS + CAMERA — 2026-10-03 (user playtest notes)
- RENDER INTERPOLATION (main.js): each step stores car._p; the frame draws the car between _p and now by acc/DT; reset()
  clears _p. MAX_STEPS 5 -> 12 (wallDt is capped at 0.1 s). CAMERA (render.js follow): rigid on the car + a smoothed lead
  (cam.lx/ly). Measured at 200 km/h in a browser: drawn car vs a smooth path worst 1.4 m -> 0.2 cm; car on screen sd 0.02 px.
- VERT_G 1.4 (vehicle.js): free fall and the suspension load use g x 1.4; grip / weight still g. Airtime ~-30%.
- Hill-shading: + tanh(h / 0.25) x 0.9 height tint, slope term x 0.55: raised = lighter, sunken = darker.
- Slope force per axle (weight share) -> car.slopeYaw; BUMP_STEER k 1 x front weight x (hL - hR - plane), clamped 0.4 m.
- Stopped-car hold (vehicle.js): rest-snap / low-speed blend skipped when slope pull > SLOPE_ROLL 0.06 g along or SLOPE_SLIDE
  0.35 g across.
- Bowl: dug in (floor -h to r0, sin^2 wall to 0 at R). The raised first version was a 2.17 s ramp.

## REV LIMITER — 2026-10-03 (found by tools/carstats.mjs)
- There was none: rpm was clamped at the redline but torque kept flowing, so top gear ran to drag alone (naffcar 759 km/h).
  Now torque x clamp((1.02 redline - roadRpm) / (0.02 redline)), roadRpm from |vLong| — NOT wheel speed (that cut the engine
  in every wheelspin launch: muscle 0-100 3.5 -> 7.8 s). Tops: hatch 250, estate 219, muscle 208, rally 246, track 298, naffcar 296.

## MENUS — 2026-10-03 (?menu=1 until the look is approved). src/menu.js, tools/menucheck.mjs
- DOM screens over the canvas; pixel UI style (2 px outlines, square corners, hard shadows, HUD colours). mode 'menu' runs a
  DEMO LAP: the car is driven by src/autodrive.js (moved out of tools/lapdriver.mjs — identical laps; also the AI seed).
- Test Mode: track select (renderer.thumbnail paints each level once), setup (Solo; AI locked), LAUNCH -> session. The HUD
  "?" chip is the PAUSE chip ('II') with menus on; the pause pane freezes the sim like the guide does.
- Garage: renderer.pixelCar on a drawn lift; stats from src/carstats.js, MEASURED by tools/carstats.mjs (re-run after car or
  model changes). Profile carsim.profile.v1 in localStorage: unlocked (all seeded), active car, last level.
- GHOST CLICK: the pause chip tap's follow-up click hit RESUME in portrait; every new pane ignores clicks for 350 ms.

## TCS TOO STRONG — 2026-10-03 (user: "making the hatch RWD nearly undrivable")
- Stability reference yaw now includes the car's own understeer gradient (linear bicycle model); dead band ESC.dead + 25% of
  |yawRef|; engine cut only when OVERSTEERING past the band or body slip > 1.5 x betaLim. Traction: allowed slip = max(1.2 m/s,
  10% of road speed), slope 0.35. Gentle 72 km/h corner: aid 3.0 -> 0.4 s, no engine cut. tools/aidcheck.mjs guards it.

## CAMBER + PERF — 2026-10-03
- CAMBER (lab.js camberHeightAt, LEVEL.camber): per subtrack point, + camber in corners (maxDeg at refR or tighter), a crown on
  straights, signed per-section overrides { from, to, deg } for off-camber; smoothed +-6 points; built UP from the ground; eased
  back over `edge` m beyond the ribbon. Test Track: 4 deg / 40 m, 2% crown. All cars lap it clean (muscle was 12 s off).
- Lit shading is NEUTRAL white except on near-white ground (warm there): the Test Track table read yellow-brown before.
- PERF (tools/framecheck.mjs, CPU x4): subtrack lookup grid (SUB_CELL 16 m, pad 18 m — the old 5 m pad cut the camber /
  back-slope lookups short); one subtrack query per height lookup; hill-shading heights on a 1 m grid (0.5 m where washboard);
  ZSTEP 2; levelOverview() stands in for unpainted ground; TILE_BUDGET 1. Tile 34 -> 22 ms; worst frame 150-283 -> 50-67 ms.
- 2026-10-03: menus APPROVED and made the default start (MENU unless ?menu=0 or navigator.webdriver; ?menu=1 forces).

## NATURAL GROUND — 2026-10-03 (user: gravel small dips/bumps, mud medium aggressive, grass rolling hills, sand whoops)
- lab.js naturalHeightAt: four smooth value-noise families (small 2.5 m, medium 4.5 m sharpened, rolling 26 m + half octave,
  whoops 6 m squared); NAT_SURF sets each base surface's amplitudes (gravel 4.5 cm small; mud 10 / thick mud 15 cm medium;
  grass 22-30 cm rolling; sand 15 cm whoops; dirt small + rolling; hard surfaces none). Amplitudes on a 3 m grid (one
  layersAt per cell, number keys, flat fast path), bilinear between cell centres -> no step at a surface edge. Seeded per level.
- PERF: hill-shading now draws translucent squares (same colours; no getImageData readback). Tile at CPU x4 back to ~20-21 ms
  WITH natural ground everywhere (readback on every grass tile had pushed it to ~30 ms).

## SURFACE INCLUSIONS — 2026-10-03 (lab.js INCLUDE / buildInclusions)
- Approved table (gravel: sand / dirt; dirt: gravel / mud; grass: long grass / dirt / mud; long grass: short / mud; snow <-> ice;
  mud: thick mud / puddles; thick mud: puddles; sand: gravel; broken tarmac: gravel / puddles; tarmac: broken). Scanned on a 6 m
  grid, one roll per point, seeded per level (Grass Track per layout). Ground patches = 1-2 overlapping SQUARES on the 0.5 m
  grid (sq: true — the pixel rule); puddles / snow / ice = covers (capped 30). Never in boxed test panels or under hand-placed covers.
- User, on first sight: "too much too often" -> INCL_RATE 0.1 of the count, patches 0.75-2 m. ~700-800 patches per level.

## THRUSTON (re-laid) + AUTO KERBS + BARRIERS + ROTATED ZONES + CONCRETE — 2026-10-03/04
- Thruston traced from the real Wikimedia map (369 m = 255 px) at 0.47, clockwise from the line; Complex shallower and Club spread
  so the tightest corner is 10.4 m (8 m-arc measure). Laps (lapdriver): track-rwd 49.4, naffcar 50.8, rally 52.8, muscle 55.2,
  hatches 57.6-57.7, estate 58.3, tractor 72.2 s; all 0.0 s off.
- autoKerbs(st, { maxR, exitR, heavyR }): inside kerb over each corner's apex region (R < 1.6 x its min), outside exit kerb on
  corners tighter than exitR, heavy kerbs under heavyR. Thruston: maxR 70, exitR 30, heavyR 22.
- Zones accept rot (zoneAt rotates the point; drawZones clips in the zone frame and paints in world frame).
- SURFACES.concrete (mu 0.90, hard, smooth) + SURFACE_ART concrete.
- BARRIERS: LEVEL.barriers [{ kind, pts }] (armco / wall / pitwall / fence / building solid; line not). barrierClamp: car
  corners vs segments, push out, restitution 0.3, scrape 0.85, yaw x0.6, shake. alongTrack(sub, d0, d1, offset|fn, step) builds
  a polyline offset from the centreline. Drawn at exactly BARRIER_HALF. Built 2026-10-03; NOT yet placed on any level.

## STUCK CONTROLS ON iOS — 2026-10-04 (user: rapid taps / holds / several fingers left pedals ON). `node tools/inputcheck.mjs`
- input.js: non-passive touchstart/move/end preventDefault on the canvas + gesturestart (stops the magnifier / callout / pinch
  taking the touch); releaseAll() on blur, pagehide, visibilitychange(hidden), and when the LAST finger leaves the screen
  (window touchend/touchcancel, capture) whatever events went missing; lostpointercapture = pointerup; setPointerCapture
  guarded (threw on a pointer iOS had already taken). Menu buttons are DOM (click) so unaffected; audio unlock is on window.
- inputcheck: touchcancel, blur, a ghost pointerdown with no up, an ordinary second finger (must NOT release the first),
  20 rapid taps. Proven: with the release paths disabled cases 2 + 3b FAIL. uicheck / menucheck / guidecheck still OK.

## RESET ON CIRCUITS — 2026-10-04 (user: "behind / in line with where you left the track, half on half off, random close angle
## back onto the track, not on the racing line"). `node tools/resetcheck.mjs [level...]`
- main.js: updateRecoveryTracking keeps lastOnTrack {dist, signed offset} while |offset| <= width/2. doReset: RESET_BACK 4 m
  behind it, car centre ON THE EDGE of the side it left by (onTrack(sub, d, side*width/2) — lab.js onTrack now exported), nose
  RESET_ANG 5-15 deg (random) back toward the road. Falls back to the nearest point if the car was never on the road; non-circuit
  levels keep breadcrumbs. Cleared on restart / level change. Was: nearest CENTRELINE point, dead straight.
- MEASURED: 16/16 (Thruston, Test Track, Naffcar, Grass Track; both sides; 4.7-12.6 m behind — onTrack snaps to the sample
  point before d and long straights are sparse; offset = edge +-0; nose 5.3-14.7 deg inward).

## TILE POP-IN ON PC — 2026-10-04 (user: "block loading is chunky / visible on PC"). Measured with a 1600x900 autodrive lap.
- A PC screen needs ~3x a phone's tiles; at TILE_BUDGET 1 the flat whole-level stand-in showed in 159 of 600 frames (Test
  Track) / 167 (Thruston). render.js: running average tile cost (tileAvg, starts 20 ms = phone); when a frame has NOTHING
  missing and tileAvg < AHEAD_MAX_MS (9), paint one tile of the view AHEAD_S (0.6 s) of travel ahead. renderer.standInFrame
  counts stand-in frames. MEASURED: 159 -> 85 (Test Track), 167 -> 16 (Thruston); PC slow frames unchanged (1).
  Phone-ish (844x390, CPU x4, tiles ~21 ms) never qualifies: A/B old vs new 59/61 vs 58/71 frames over 33 ms, same tiles = noise.
- NOT a loading artefact: the diagonal light/dark edge across the Test Track road is a surface-sector change; the regular
  horizontal bands on grass are the 4 m MOWN STRIPES (SURFACE_ART grass). Asked the user which "lines" they meant.

## THRUSTON RE-TRACED — 2026-10-04 (user: "unfinished, kerbs still broken on tight corners, not like the real corner";
## chose "real shape, round corners"). `tools/traceoverlay.mjs`, `tools/kerbside.mjs`, `tools/thrustonshots.mjs`
- Centreline re-read off the map at 4x zoom on a 10 px grid (TH_MAP, map px; game = (px - 480|338) x 0.47). The previous trace
  drifted off the real track (Cobb -> Seagrave, whole south side) — tools/traceoverlay.mjs draws a level over its map to check.
- lab.js traceTrack(): centripetal Catmull-Rom through the points (no cusps where points bunch) -> resample 1.5 m -> Taubin smoothing
  over +-3 samples (MEASURED corner-edge flicker 84 -> 36; straight lines between points put all the turning AT the points) ->
  open only corners under rMin (R over an 8 m arc from SEGMENT headings — the chord measure read Club 11.7 m when it was 6.6).
  createSubtrack(..., dense = true) takes the points as they are. rMin 15.5 -> min R 15.9 m (Campbell), lap 1225 m.
- autoKerbs: minTurn 20 deg (a kink is not a corner), mergeGap 12 m (same-side pieces join), inside kerb width capped at
  0.3 x (R - half width) so its inner edge stays >= 0.7 of the outer. 55 fragments -> 18 kerbs.
- kerbside.mjs now reports KERB FANS (inner/outer radius of an inside kerb < 0.6). Old trace: 9 fans (Complex R 9-14, Club R
  10-12 with 2.4-3 m kerbs); new: none. (A per-metre "kink" check was tried first and did NOT catch the old trace — 8.3 deg/m.)
- Moved by distance to the new corners: Seagrave bump 306, bumpy Goodwood 575-640, Club tyre markers 1126-1176 + apex cone
  1146; gantry over the line (d 3) and grandstand OUTSIDE the S/F straight (d 1188-1228, off -14) via thProp(); the stand is
  solid through an invisible 'building' barrier (first use of LEVEL.barriers; obstacles are axis-aligned only).
- Laps (lapdriver): track-rwd 54.6, naffcar 56.0, rally 58.5, muscle 60.6, hatches 62.9-63.1, estate 63.7, tractor 71.1 s;
  all 0.0 s off. Slower than the last trace (49-72) — more of the real corners. framecheck thruston (CPU x4) 66 slow frames
  of 570 (was 79). Old traces: _archive/thruston-retrace-2026-10-03.js, _archive/thruston-old-layout.cjs.

## THRUSTON PITS + PERIMETER — 2026-10-04 (user: race-day photos for pits / perimeter; "if you need ARMCO or FENCES, do").
## `tools/barriercheck.mjs`, `tools/thrustonshots.mjs`
- NEW: LEVEL.lanes [{ pts, width, surface }] — a ribbon of one surface along an open polyline (lab.js laneAt, checked in zoneAt
  AFTER the track, so the track wins at a junction; render.js drawLanes paints lanes into the tiles UNDER the ribbon to match).
- Pit lane (from the map: INSIDE, Club -> line): concrete, 9 m, alongTrack 1178 -> 48 with the offset easing 4 -> 17 -> 4 over 28 m
  (smoothstep), so it peels off after Club and rejoins before Allard (track R >= 67 m there). Pit wall (red/white/blue) at +10
  where the lane has separated (1201 -> 25), yellow line at +15.5, garages in 4 blocks flush with the lane (new prop 'garages':
  dark slate roof, unit lines, red KUM TYRES banner on the lane side; the first cut — light roof, 1.3 m banner — vanished into the
  concrete and read as a red wall, photographed) + an invisible 'building' barrier along their front; control tower (new prop
  'tower') behind; boards THRUSTON / KUM TYRES / SPUM OIL off the track.
- Armco at -16 on the OUTSIDE of Allard, Campbell, Seagrave, Goodwood, Church, Woodham; catch fence at -22 at Church; spectator
  banks = humps (r 7, h 1.2-1.4) at Church (-31) and Noble (+27). drawBarriers now culls off-screen barriers.
- MEASURED: barriercheck all solid barriers >= 2 m clear of the road, none on the lane (proved to fail on a barrier at -7.5);
  physics reads concrete on the lane; crash tests in the live game: Armco at Goodwood 30 m/s -> bounced at offset -13.5 (rail
  -16); pit wall 20 m/s -> stopped at 9.6 (wall 10); garages 15 m/s -> stopped. All 8 cars' laps unchanged (0.0 s off).
  Frame cost: A/B with and without the pits 69 vs 71-74 slow frames of 570 at CPU x4 = noise.

## THRUSTON TIDY + DECORATION + SOLID PROPS + TYRE WALLS — 2026-10-04 (user: "pits look messy, parts overlapping; the old runway
## bugs in and out of existence; isn't there more decorating?"; "make trees, planes etc collidable"; "lots of tyres between the
## track and the Armco"). Tools: `solidcheck`, `thrustondeco` (photos), `profile` (CPU profile of a lap), `barriercheck`.
- RUNWAY FLICKER = a render bug: drawZones culled zones on the UNROTATED w x h box, so a long rotated runway was skipped by every
  tile > 11 m from its centre line. Now culled on the rotated footprint; rotated-zone texture painted only over the part in view.
- MESS: the SW-NE runway ran ~26 m past its real end, under the pit lane (shortened to the map's end); the 4 garage blocks stepped
  and overlapped on the curve (now ONE 'garagerow' prop drawn from front/back/banner polylines); alongTrack snapped to samples
  and used each sample's own normal, so at 17 m out the lane / wall / garages WOBBLED by metres (now smoothOnTrack: lerped
  position, normal averaged over +-4 samples); blend + inclusion patches chewed lane edges (dropped where they touch a lane).
- Lanes drawn piece by piece (segment rects + a disc per point, same winding) = exactly laneAt's distance rule; the first cut
  (one polygon, averaged normals) pinched at corners. Pattern only over the part in view.
- INFIELD from the map + 1945 RAF photo (art/ref/may45.jpg): paddock (paved apron, 18 m) with 6 transporters; WW2 taxiways in
  BROKEN tarmac; north apron; hangar road + 3 hangars (east of it — west put two ON the track, measured 4.8 m); 6 light aircraft
  on the grass parking; windsock; tower redrawn (the first read as a swimming pool); Club grandstand (solid); earth BANKS round
  the outside Club -> Noble + Woodham Hill Bank + Church + Noble (humps every 4 m — at 10 m they were separate blobs), all
  road-filtered; 94 trees (west woods + hedgerow), road-filtered; 10 marshal posts. Bump lookups now through a 16 m grid.
- SOLIDS: LEVEL.solids from solidsFromProps (hangar, grandstand, tower, truck, plane = fuselage + wing + tailplane, marshal post,
  board, windsock, tree = half its canopy, gantry legs); solidClamp = car box vs prop box, separating-axis test (the corner-only
  barrier test can miss a trunk between two corners), barrier response. solidcheck: every kind stops / bounces a 15 m/s car, a
  sideways slide into a tree too; with solids switched off it FAILS (tree driven through).
- TYRE WALLS: two staggered rows of knockable tyrestacks (0.95 m apart) at -14 / -15 in front of every Armco run: 1077 stacks.
- FRAME COST, back to back at CPU x4 (the earlier "71" was a quieter hour — compare only back to back): before decoration 84 vs
  after 83 slow frames of 570; ground tile 23.0 -> 26.5 ms (banks + infield shading). Tyre walls +8 slow frames (88/90 -> 100/95):
  drawing ~120 stacks in view. Next lever if felt: draw untouched stacks into the tiles. All laps unchanged.

## CASTLE CUM — 2026-10-04 (parody of Castle Combe). `ccshots`, `crestcheck`, `traceoverlay castle-cum art/ref/cc2.png 0.358 637 532`
- Traced from the official map (art/ref/cc2.png, 385 m = 448 px) at 0.358 game m/px (0.42 of real — user: BIGGER so the chicanes
  keep their shape), clockwise from the line. traceTrack rMin 15.5, width 13: lap 1338 m, min R >= 15.5, 0 folds, 0 kerb fans. The
  first read of Dean Straight ran ~15 px east of the real line (overlay) — re-read. Corner distances in the lab.js header.
- NEW: trackKit(sub, seed, lanes) — at / rot / prop / clear (off road, off lanes, inside the floor) / bank / along / rnd. Use it
  for every new level. ringAround(sub, margin, lim) — a perimeter road from the track's OUTLINE (an offset looped back on itself
  inside the Esses' left-handers, photographed); here opened at the paddock and joined to its ends, routed round the pit entry.
- ELEVATION (user: "felt — light over the top"), tools/crestcheck.mjs [--flat]: AVON RISE hump r 30 h 0.95 at 296 m — careful lap
  0.83-0.87 load; FLAT OUT: hatches 136-144 km/h -> 0.45-0.49, rally 182 -> 0.25, track car 192 -> just lifts (0.01 s). TOWER
  drop: r 45 h 1.6 put every car airborne flat out -> r 50 h 0.9: over the crest hatches 0.60, rally 0.23, track 0.14, muscle /
  naffcar lift 0.07-0.09 s. (A window that includes Tower itself measures the crash off the corner, not the crest.)
- Scenery: pit lane OUTSIDE (Camp -> before Folly, as the corner guide says), pit wall, yellow line, red sculpture, race control,
  paddock with 10 transporters, Tavern clubhouse + admin, Avon + Dunlop FOOTBRIDGES (new overhead prop; text never upside
  down), old-layout escape roads at the Esses + Bobbies (broken tarmac), Bobbies "concrete strip" braking marker, Armco + tyre
  walls at Quarry / Old Paddock / Tower, Camp bank fence, viewing banks (Folly, Quarry, Esses, Bobbies, Camp), kart track + skid
  pan (wet) + Octagon beyond the ring road, 110 trees, marshal posts, boards. New props: footbridge, sculpture, block.
- Laps (lapdriver, all 0.0 s off): track 57.8, naffcar 59.4, rally 62.1, muscle 64.5, hatches 67.1-67.2, estate 67.9, tractor 76.7 s.
- PERF: lanes now cull SEGMENT by segment (the ring road's box is the whole map, so every tile built all of it and painted a
  tile of pattern to clip away): Castle Cum ground tile 45.7 -> 29.1 ms, slow frames 86 -> 76 of 570 (Thruston 25-26 ms).
- tools/wearcheck 3c is FLAKY (Math.random churn: 0-3 of 29 cells, threshold fails at 3) — pre-existing, logged in TODO.

## SLIDDEN HILL + THE JOKER / RX RACE — 2026-10-04 (parody of Lydden Hill RX). `racecheck`, `jokercost`, `crestcheck`, `ccshots '<json>' <level>`, `wideshot`
- Traced from the official RX map (art/ref/ly2.png = Wikimedia Lydden_Hill_-_Rallycross.svg, black tarmac / yellow gravel), 0.30 game
  m/px: lap 1136 m from the JUNCTION where the start straight meets the loop. Sectors from the map's colour changes: dirt 202-361
  (Chessons Drift) and 978-1101 (the run back) — HARD DIRT with the dirt inclusion table (gravel + mud patches) (user).
- LANES: the START STRAIGHT (RX grid, dead end, used once) and the JOKER (inner gravel arc, Chaikin-smoothed OPEN path — traceTrack is
  for closed loops only). LEVEL.joker = { gate (lane midpoint, r 7), penalty, laps 5, arrows }.
- JOKER COST (tools/jokercost: the lap with branch -> rejoin swapped for the joker): rally +1.8 s (real RX range), track car +6.4,
  hatch +7.4 (slow on dirt). At the +5 s penalty first chosen a road car was FASTER skipping it -> penalty 10 s.
- RX RACE (main.js race / stepRace / stepJoker; menu setup PRACTICE | RX RACE · 5 LAPS on a joker level; launch(level, car, { rx })):
  clock from the first move off the grid; finished when lapState.lap > 5; total = time + (joker ? 0 : penalty). HUD: the existing
  lap panel shows LAP n/5 + race time, JOKER TO DO / JOKER DONE, then FINISH + total (+10 s NO JOKER). No new HUD lane.
- ARROWS (render drawArrows, wall clock pulse, outlined): user "closer and more clearly pointing at the joker, vanish when taken" —
  the first one sat at the split pointing along both routes (they part slowly: 1 m apart at 72 m, 11 m at 112 m). Now one on the
  track 9 m before the split turned 32 deg toward it, one on the joker's gravel mouth. game.jokerTaken (practice too) hides them;
  RESTART brings them back.
- THE HILL: one cos^2 hill over North Bend (8 m, r 105 m, steepest ~12 % = Hairy Hill). At driving speed the crest takes load to
  0.70-0.83, no air. (Flat out THROUGH North Bend is a crash off the bank, not a crest test.)
- Scenery via trackKit: Armco + 2-row tyre walls at Paddock Hill / Chessons / North Bend (outside) and Devil's Elbow (+ side: a LEFT
  hairpin), banks round the bowl, paddock beside the grid with lorries + CHESSONS clubhouse, start-light gantry, 130 trees, posts.
- Laps (all cars clean on the loop; "3.7 m off" for every car is the start straight's dead end near the junction — identical for
  the tractor at 68 km/h, so it is geometry, not driving): track 53.5, naffcar 55.2, rally 57.6, muscle 60.0, hatches 61.8-61.9,
  estate 61.8, tractor 68.2 s.
- (later the same day, user on the phone) ONE arrow, "where the red arrow is" (hand-drawn on a screenshot): on the track at its right
  edge at 98 m, aimed at the joker's gravel mouth (lane pt 30). The start straight was MOVED 8 m away from the loop's run back (centres
  were 10-15 m apart with two 14 m roads = overlapping) and a 2-row TYRE WALL fills the grass between them (user: "a tyre wall between
  the main straight and the start straight"), filtered off both roads. tools/racecheck: A no joker -> FINISH +penalty, B joker -> no
  penalty, practice never starts a race: all OK. Lap driver "12.1 m off" for every car = the start straight, not driving.

## TYRES vs WALLS — 2026-10-04 (user: "tyres should interact with Armco — a chance to pass over in high impact is ok"). `tyrewallcheck`
- cones.js hitWalls(k) for every MOVING object: circle vs each solid barrier segment (BARRIER_HALF) and each LEVEL.solids box; push
  out, restitution 0.3, scrape 0.8. A hit faster than OVER_V 9 m/s has OVER_CHANCE 0.3 to sail over (once per flight). MEASURED
  (a lone stack fired at Goodwood's Armco): 8 m/s 20/20 stay out of the rail; 16 m/s 26/80 over (33 %). The test PROVED: on the old
  code 0/20 stay out (they ended inside the rail) and 80/80 went through. (First versions of the test passed on the old code too:
  at 5 m/s the stack stopped short; with the wall's other stacks present the fired one burst on the second row.)
- PERF note: Slidden Hill 113 slow frames of 570 at CPU x4 (~870 tyre stacks to draw). Next lever: draw RESTING stacks into the tiles.

## JOKER RULE: EXACTLY ONCE — 2026-10-04 (user: "harsh, real-ish"). FIA: a missed joker = time penalty (30 s usually quoted); extra jokers
## go to the stewards. Here: missed OR each extra = +30 s. main.js stepJoker counts gate ENTRIES (game.jokers); HUD "JOKER x2: +30 s" in the
## race, "+30 s NO JOKER" / "+30 s EXTRA JOKER" at the finish. tools/racecheck: A none, B one, C two (laps 2 + 3).

## SWEATY LAMB — 2026-10-04 (parody of Sweet Lamb, the Welsh gravel stage). `stagecheck`, `ccshots '<json>' sweaty-lamb`, `wideshot`
- No published map (rally-maps needs a browser): designed from the photos (art/ref/sl1-5.jpg) + facts (4.24 km gravel, 123 m of climb):
  farm-yard start by black corrugated sheds, the valley floor, a WATER SPLASH (stream = a chain of puddle covers that churn to mud),
  four switchback hairpins up the valley side = the SPECTATOR BOWL (banks inside the hairpins, marquees), over the crest of one cos^2
  hill (18 m, r 175), a KICKER on the fast descent, flying FINISH, STOP board, then the untimed FARM ROAD (broken tarmac) back round to
  the start (user: "both" — RESTART or drive back). One closed loop (2064 m: stage 1300 + farm road 763) so RESET / tracking / the
  autodriver all work. Width 10, rMin 12, no kerbs (a rally stage has none), base LONG GRASS (moorland), stage surface RALLY GRAVEL.
- STAGE TIMING (main.js stepStage, LEVEL.stage.finish): READY -> crossing the start line (track distance wraps past 0) -> RUNNING ->
  passing the finish distance -> DONE (best kept). Driving the farm road round starts a new run at the line; RESTART = READY (spawn 6 m
  behind the line). HUD lap panel: STAGE + clock / CROSS THE LINE / BEST, then FINISH + time / NEW BEST.
- MEASURED (stagecheck, careful autodriver): track 65.2, naffcar 67.6, rally 70.1, estate 74.6, muscle 75.5 (4.4 s off — slides on
  gravel), hatches 76.5-77.4, tractor 82.9 s; 0.2-0.5 s airborne at the kicker. "About a minute" for a player. NOTE: the track car
  beats the rally car on gravel because tyre TYPES per car do not exist yet (roadmap A3 tyre MVP) — not a level problem.
- Closest switchback legs 39 m apart (road 10 m); no folds.

## RESET ON TERRAIN LAUNCHED THE CAR — fixed 2026-10-04 (user: "resetting on terrain causes the car to get stuck pulling away"). `resetterraincheck`
- vehicle.js reset() zeroes ground + suspension heights; on a hill the first lab.js applyGround derivative read the whole hill as one
  step. MEASURED: reset 7.5 m up Sweaty Lamb -> 106 m into the air, 0 km/h after 3 s ("stuck"); Slidden Hill 67 m; Castle Cum's 1.1 m
  crest 1.1 s of air. Now reset sets car.groundInit = false and the first applyGround puts ground AND body at the local height with
  zero vertical speed: 59-73 km/h after 3 s, no air, everywhere. Covers RESET, RESTART, level changes and every tool.

## WATER (and every cover) DRAWN AS ONE BODY — 2026-10-04 (user: "puddles / streams / bodies of water should connect if touching")
- render.js mergedCovers / drawCoversMerged (pixel mode): per cover kind, the UNION of every cover's 0.5 m cells (= what coverAt answers,
  so still visuals = physics); each tint fills once, sheen clipped to the union, ONE rim round the outside. Was: each puddle its own fill
  + rim, so a stream of overlapping puddles read as a string of beads with rims inside each other. Photographed: one continuous stream.

## SWEATY LAMB V2 + HAY BALES + CONE COUNTER — 2026-10-04 (user feedback while driving). `stagecheck`, `balecheck`
- V2 (user: "a bit basic — more unique corners, slightly longer, same map size; more tyres, cones, flags"): 1822 m of stage (was 1300)
  + a 164 m farm road back. Corners in order: square left, dog-leg square right, valley ESSES, the SPLASH, SE sweeper, TYRE CHICANE
  (3x3 stack blocks, alternating sides), square left, HAIRPIN ROUND THE TREE, left kink, HAIRPIN 2, CREST YUMP, right-left FLICK,
  downhill sweeper, SQUARE RIGHT junction, HAIRPIN AT THE TOP (second hill), long DESCENT, WIGGLE, FINISH. Closest separate road parts
  35 m, min R 11.5. MEASURED stage times (careful autodriver): track 115.6, naffcar 119.6, rally 125.1, muscle 130.5, estate 133.6,
  hatches 134.0-135.4, tractor 140.1 s (v1 was 65-83 s) — a player ~1:40. Dressing: chevrons (drawn 1.6x), cones on apexes, flags,
  red spectator TAPE (barrier 'line', col), marquees, start arch (gantry), service vans, sheds, the farm POND (joins the stream).
- HAY BALES (user: "like tyres but heavier — hit them and they move; they explode with dust and slow you down a lot"; then "more round
  the corners"): cones.js kind 'bale', 250 kg, r 0.8, restitution 0.08, drag 6.5; a car hit above 5 m/s BURSTS it to 'straw' (flat,
  no longer solid, drawn as scattered straw squares) with a big straw-dust cloud (render BALE_DUST) and the car loses 22 % of its
  speed on top of the momentum it gave the bale (impulse cap 8 m/s vs 2.5 for others). MEASURED (balecheck, hatch coasting): 8 km/h
  nudge -> bale slides 2.1 m, stays whole; 60 km/h -> straw + dust, -20.4 km/h; a tyre stack at 60 -> -1.5 km/h. Placed on EVERY
  corner of the stage from its curvature (autoKerbs' corner finder, < 45 m, > 25 deg), every 2.1 m along the outside: 347 bales.
  Frame cost (CPU x4): 45 slow frames of 570.
- CONE COUNTER (user: "should only count cones, not tyres; only when asked for, not on most race tracks"): cones.knocked / total
  count kind 'cone' only; the HUD tally shows only where LEVEL.coneCount (The Lab, Test Track).

## BRANDS SNATCH GP + INDY — 2026-10-04 (parody of Brands Hatch). One builder, two levels: lab.js brandsLevel(id, name, mapPts)
- Traced from the official map (art/ref/bh2.png = Wikimedia Brands_Hatch_2003.svg, 300 m = 460 px) at 0.31 game m/px; the GP and Indy
  laps share BH_TOP (Brabham -> Paddock Hill -> Hailwood -> Druids -> Graham Hill -> Cooper -> Surtees) then BH_GP (Pilgrims, Hawthorns,
  Westfield, Dingle Dell, Sheene, Stirlings, Clearways) or BH_INDY (McLaren) back to Clark Curve. GP 1835 m, Indy 904 m; min R 16; the
  overlay sits on the real line all round (tools/traceoverlay brands-snatch art/ref/bh2.png 0.31 635 895).
- HILLS from the contour map (art/ref/bh1.png, 115-145 m), ~half height: Paddock Hill plunge (dip 4 m), Druids on its rise, Pilgrims
  Drop into the valley and out up Hawthorn Hill (dip 4.5 m), Dingle Dell, the high ground west. Driving speed: load 0.74-0.91 at the
  crests; flat out over Paddock Hill ~0.25 s of lift (the real plunge does that).
- GRAVEL TRAPS generated on the OUTSIDE of every real corner (autoKerbs finder R < 45, turn > 35 deg): 12 m deep LANES of rally gravel,
  apex -> +30 m; Armco behind each + two staggered tyre rows, all SPLIT wherever they would come within half width + 4 m of any road or
  cross another trap / the pit lane (barriercheck caught 2 runs crossing a neighbouring trap). 7 traps GP, 6 Indy.
- Pit lane inside Brabham (concrete, eased in/out), pit wall, yellow line, garages 5 m deep (10 m reached Cooper Straight 34 m away,
  photographed) with a solid front split round traps, main grandstand + Paddock Hill + Clearways stands, race control above Druids,
  paddock lorries in the infield, 160 trees (the GP loop runs through woods), marshal posts.
- Laps (all 0.0 s off): GP track 73.0, naffcar 74.8, rally 78.7, muscle 81.5, hatches 84.5-84.9, estate 86.0, tractor 103.1 s;
  Indy track 40.1, naffcar 41.2, rally 43.3, muscle 45.0, hatches 46.4-46.8, estate 47.0, tractor 52.8 s.
  Frame cost (CPU x4) GP: 107 slow frames of 570 (~1000 tyre stacks) — same lever as Slidden Hill (bake resting stacks into tiles).

## TRACKS QUIVER AT SPEED — fixed 2026-10-04 (user: "tracks seem to quiver and shake at speed"). `tools/shimmercheck.mjs [level]`
- MEASURED (Brands GP, phone size, ~88 km/h): every ground tile blitted at a FRACTIONAL ART-pixel position (500/500 frames) and tiles of
  one frame at MIXED widths (317/500): tile edges were rounded in CSS px (an art pixel is 1/dpr CSS px) and each edge separately, so the
  pixel-art ground was resampled differently every frame as the speed-zoom and camera moved = a shimmer the whole screen.
- render.js frame(): for DRAWING only, the zoom is quantised so a tile of the current step is a whole number of art pixels wide (steps
  ~0.5 %), the camera snapped to a whole art pixel, tile edges rounded in art pixels; the smoothed zoom is restored after the frame.
  AFTER: fractional 0/500, mixed widths 29/500 (the frames where the zoom steps). Thruston 12/500.

## PROPS ON THE ROAD — fixed 2026-10-04 (user: "a truck across the Brands GP track", "a hut across the road at the exit of Druids, Indy").
- brandsLevel's filter skipped big props (lorries, race control, grandstands) and tested only CENTRES. Now every prop's footprint (+1.5 m)
  is sampled against road + pit + traps; race control takes the first clear spot outside Druids. tools/propcheck.mjs samples EVERY
  level's solids against its road: all clear; on the old filter it FAILS (race control x2 + the lorry).
- SECOND PASS (user: "still shaking or wiggling as I drive" -> after this: "deffo seems better now"). tools/wobblecheck.mjs measured the
  first fix's cost: snapping the camera to whole art pixels made the world move in uneven 1-2 art-pixel steps — camera jerk median 1.46
  px/frame, max 8.8 (unlocked 0.03). Now the world is DRAWN at the snapped camera (tiles stay crisp: 0/500 fractional) and the finished
  art-pixel image is SHIFTED by the leftover fraction in device pixels when blitted (subX/subY): jerk back to 0.03. No edge gaps (0 px).
  And the speed-zoom BREATHED with every lift and squeeze (screen edge moved 1.14 px/frame median, 14.6 max): the zoom now follows a
  slow-averaged speed (~1.5 s) at 0.9/s with a 4 % dead band -> 0.39 median, 2.5 max. ?nolock=1 turns the lock off (A/B).

## KNOBHILL — 2026-10-04 (parody of Knockhill, the rallycross layout). Decisions (user): tarmac circuit + infield dirt, dry, hills felt.
- Traced from Wikimedia Knockhill_circuit_map.png (art/ref/kh3.png; 100 m = 76 px) at 0.62 game m/px: lap 931 m, min R 15.8, 37 % DIRT
  (real RX lap 39 %): tarmac start straight -> Duffus Dip -> Scotsman -> Butchers -> chicane -> bottom straight -> Clark's, then dirt
  (where the real circuit's tarmac runs) up past Hislop's, round the hairpin, back onto the start straight. No published RX map.
- JOKER: a dirt loop off the LEFT of the bottom straight after turn 4 (the real joker entry is "after turn 4, on the left"). The first
  loop (34 m deep) cost 7-16.5 s (tools/jokercost); shallow version: rally +3.2 s, track +4.8, hatch +12.8 (slow on dirt); penalty 30 s
  per miss / extra (the Slidden Hill rule). ONE arrow on the left edge after the chicane, aimed at the mouth.
- Hills: Duffus Dip (dip 3.5 m), CLARK'S blind uphill crest (hump 2.2 m, r 32: load 0.25-0.45 at ~55-60 km/h — "onto two wheels"
  territory, no air), the hairpin on the hill top. Gravel traps + Armco + tyre walls on the tarmac corners only; tyre walls on dirt
  corners; no kerbs on dirt. Stands at the start, Duffus Dip, Clark's; race control; paddock lorries; farmland trees. Footprint-checked.
- Laps (all 0.0 s off): track 45.6, naffcar 47.0, rally 48.4, muscle 51.0, estate 52.2, hatches 53.5-53.6, tractor 57.6 s.
- JOKER ARROW ACROSS THE TRANSITION (user, 2026-10-04, phone screenshot with their car parked on the edge as the example): lab.js
  jokerArrow(sub, jokerPts) centres the ONE arrow where the joker's centre line crosses the road edge (half tarmac, half dirt) and aims
  it along the joker. Used by Slidden Hill and Knobhill (measured: 7.5 / 7.0 m from the centreline, half widths 7 / 6.5). Photographed.

## RALLYCROSS DRESSING — 2026-10-04 (user: "a couple more hay bales and tyres around Slidden Hill and Knobhill"; "only where there isn't
## Armco / tyre walls already"; "hay bales between the joker and the normal track — a clear barrier")
- lab.js rxDress(sub, lanes, existing, lined): knockable bales every 2.2 m on the OUTSIDE of each corner (hw + 4.5) EXCEPT within 6 m of an
  existing tyre wall (the first pass doubled them up in front of Slidden Hill's walls — photographed by the user), a 2 x 3 tyre block on
  each inside apex, and on Knobhill bales along both sides of the dirt section every 4.4 m. All off road / lanes / 1.6 m from others.
- jokerBales(sub, joker, existing): bales down the middle of the grass strip between the joker and the main road, >= 3.3 m off the road
  edge (clear of kerbs — first cut sat on one) and 0.9 m off the joker edge, only where the strip is >= 4.2 m (mouth and exit stay open).
  Knobhill's joker moved ~4 m further out so the strip exists (was 1-2 m): joker cost now rally +5.2 s, track +6.6 s (penalty 30 s).
- Counts: Slidden Hill 60 bales + 873 tyre stacks; Knobhill 180 bales + 256 stacks. None on any road.
- PERF NOTE: a frame check showed Slidden Hill at 315-390 slow frames of 570 — taken while tools/racecheck ran a second browser at full
  speed in the background. Re-measured clean afterwards (see below). Never take frame numbers while another browser tool is running.

## AI STAGE 1 — SEVERAL CARS AT ONCE — 2026-10-04 (user: up to 5 AI, full contact, same car as the player in other colours + numbers)
- main.js game.ai = [{ car, drv }]: real cars (makeCar of the player's model, spec copied with its own id + paint/trim so the sprite cache
  gives each its livery; car.num 2-6) on a staggered grid behind the spawn; stepped on the SAME fixed step with every clamp + applyGround +
  step; a car that throws is put back on the road. Drawn interpolated like the player. Respawn on restart / level change / car change.
  Test Mode setup: SOLO | VS AI + 1-5 (launch opts.ai); ?ai=N for tools. The AI are HELD on the grid (brake) until the player throttles —
  stand-in for the start lights (stage 4). Driven by autodrive for now (stage 2 makes them race).
- contact.js carContact: car vs car oriented boxes (SAT), separation split by mass, impulse along the normal (e 0.25) + scrub (0.12) + yaw
  from the contact point. cones.step(cars) / hitByCar: objects integrate once, tested against every car.
- PERF (5 AI, Thruston): first cut 570/570 slow frames at CPU x4. Profiled + fixed, results bit-identical:
  * objects: resting ones found per car from the rest grid, sorted by a fixed index (grid ORDER changed the car's speed loss between
    hits — objcheck's Stock Car crash knocked 9-11 instead of 15; list order restored -> 15);
  * autodrive at(): binary search (was 12 % of the frame);
  * querySubtrack: numeric grid key + squared distances (3x faster, 0 mismatches / 32k points on 8 tracks);
  * applyGround LOCAL HINT: 34 lookups per car per step now search the 43 segments round the car's nearest one, accepted only on the road
    (legs >= 33 m apart); off the road = full search. 0.0 difference after 20 s on 4 tracks.
  NOW: CPU x1 1/570 slow frames, x2 63/570, x4 544/570 (a slow phone still overloads: next levers — AI cars' ground sampling, the
  physics step budget). 0 AI unchanged (83-96/570). tools/aicheck.mjs drives the real menu flow.

## START LIGHTS, ROLLING STARTS, RACE POSITION, MPH, AI MARKS — 2026-10-04 (user requests during AI stage 1). `startcheck`, `aicheck`
- START LIGHTS (main.js armStart / stepStart / startHeld, hud.js drawLights): any race (VS AI or RX race); three reds one per second with
  3-2-1, then GREEN + GO!, gone 1.2 s later. Every car (player + AI) held until green - 0.12 s (the "split second before"). Sim time.
  ROLLING START (LEVEL.rollingStart: Naffcar, Stock Car): grid 120 m further back, the game drives EVERY car (player too) at 16 m/s in grid
  order behind red ("ROLLING START"), green as the front car crosses the line, all released; lap / race timing starts at green.
  startcheck: standing — held at 0 km/h with the player flooring it, released at green, timing from green; rolling — all at 58 km/h,
  green at the line; lights gone 2 s after green. BUG (user): "lights don't vanish" — the start clock stopped at green, so "1.2 s after
  green" never came; it now keeps running.
- AI MARKS (user: "AI share tyre tracks? it gets messy quick"): marks.js keyed wheels fl/fr/rl/rr for EVERY car, so a stamp joined one
  car's wheel to another car's — lines across the track. Keys now per car (car._markId).
- RACE POSITION (user): every car's progress round the lap, unwrapped across the line, ranked each step (main.js stepOrder); lap panel
  shows P n/N (gold when leading) whenever AI are out.
- MPH (user: "tapping the speed should change it to mph"): tap the speed panel; localStorage carsim.units.
- AI grid follows the player's spawn when it is off the lap (Slidden Hill's RX start straight): straight back along its heading.


## AI STAGE 2 — THE RACING AI — 2026-10-04 (src/aidriver.js; autodrive.js stays the bench / demo / rolling-start pace driver)
User spec: racing lines + overtaking; surface awareness; difficulty = centre of a gradient (better / quicker / defensive / aggressive);
line deviation grows as difficulty drops; difficulty = pace, mistakes, line, tactics (jokers, later pits), deviation; "scrabbling for
victory" + genuine subtle errors; jokers random / tactical; avoid other cars; Slidden's traditional start.
- RACING LINE (per level, cached on LEVEL._line, ~40-120 ms): min-CURVATURE descent (bi-Laplacian, k = 40/20/10/5/2.5 m then k = 1) on
  lateral offsets within half width - 1.6 m; the inside of a tight centreline turn limited to 0.6 R (it folded on Slidden's hairpin);
  a gentle pull (0.1) off cross-sections with grip < 0.9 x the best there. MEASURED BUGS on the way: neighbour-midpoint smoothing is
  curve-SHORTENING (Naffcar line glued to the inside, -9.4 m everywhere); interleaved k-chains zig-zag without a k = 1 pass.
- SPEED PROFILE (per path per car model): sqrt(0.88 x R/(R+6) x mu x gripG x g x R), gripG / brake100 from carstats.js; backward
  braking pass at 0.70 of brake grip. Steering cap = kinematic angle for 1.3 x grip + 0.12 rad slip (the bench cap pinned at 0.1 rad at
  35 m/s). Oversteer (rear slip > 0.18): cap off to countersteer, no brake; understeer (front slip > 0.14): lift + 0.35 brake.
- DIFFICULTY (pace / line use / wander m / mistake per corner / joker blunder): Mobile 0.80/0.55/1.8/0.20/0.12, Game 0.86/0.72/1.2/
  0.12/0.06, Realish 0.91/0.86/0.7/0.07/0.02, Rich 0.95/0.94/0.35/0.035/0.005, Real 0.985/1/0.12/0.015/0. PERSONAS dealt round the
  field from a per-race seed: quick (+2% pace, ragged), steady (on line, few errors), aggressive (tighter gaps, bumps), defensive
  (covers), balanced. Battling (car within 25 m): +2% x aggression pace, mistakes x1.6.
- MISTAKES drawn ~45 m before each corner: late braking (runs wide), early turn-in (clips the inside), too much throttle on exit (a
  slide), hesitation (slow). Severity from skill.
- JOKER: branch path (main line 25 m -> joker lane -> merge 15-35 m on). Plan lap from 12/23/25/22/18 %; tactics: stuck behind a car
  within 30 m -> take it now (aggression); a rival close behind who has jokered -> cover (defence); last lap forced unless a blunder.
  MEASURED (aijokercheck, rally-4x4 Real, 3 seeds x 2 levels): 1 gate entry each, on the planned lap; costs the AI 4-6 s.
- START LANE: a spawn off the lap on a lane (Slidden's RX straight) -> the AI drive that lane first. MEASURED in game (aistage2check):
  5 AI, worst 2.4 m from their path through the start.
- AVOIDANCE: a car ahead in the way while closing -> pass on the side with room (that is the overtake), no room -> follow at a short
  gap; alongside -> keep 2.4 m; a faster car behind -> defensive drivers cover a little. A zero-contact speed-based gap was tried and
  REVERTED at the user's word ("contact is ok … put it back"). MEASURED (aifieldcheck Thruston, 6 hatches, Realish, 3 laps): 6.0 s of
  contact in 83 events (70 nose-tail), 3 order changes, no resets.
- LAPS (aidrivecheck, Real, clean): Thruston hatch 43.1 (bench 60.7), Castle Cum 47.0 (64.6), Brands GP 66.7 (81.7), Knobhill 48.2
  (55.3), Slidden 55.6 (60.8), Sweaty Lamb 147.3 (144.5 — the stage still costs it), Naffcar 30.0 (36.6). Mobile is 10-25 % slower and
  goes off now and then.
- main.js: spawnAI -> createAIDriver(LEVEL, aiTraits(aiDiff, i, n, seed)); stepAI passes { cars, lap, laps }; AI joker gate counted
  into car._jokers; stuck < 1 m/s for 3 s after green -> reset to the road + drv.relocate(). ?diff=0-4; setup row MOBILE..REAL
  (localStorage carsim.aidiff).

## AI STAGE 3 — RACECRAFT — 2026-10-04 (src/aidriver.js "RACECRAFT"; src/contact.js `slipstream`; stage 2 kept in _archive/aidriver.stage2.js)
User spec: real overtakes (out-braking, switch-backs, using the dodge to pass on the inside), real defending, "scrabbling for victory";
KEEP CONTACT AT TODAY'S LEVEL. Benchmark: `tools/aifieldsuite.mjs [diff]` = aifieldcheck x 4 circuits (Thruston, Castle Cum, Brands GP,
Naffcar) x 6 seeds, 6 hatches, 3 laps; PASSES = a pair swapping order and HOLDING it 3 s after the first 12 s. One 12-race suite was
pure noise (same code: 52 vs 73 passes) — decide on the 24-race suite only.
- SLIPSTREAM (every car, player too): a car up to 28 m behind another (>12 m/s, same heading, within 1.6 m laterally) loses up to 45 % of
  its drag, fading with distance. `car.dragMul` (vehicle.js drag line; default 1).
- ATTACK: sat behind the same car (1.5 s cautious .. 0.3 s aggressive) with a corner 15-140 m ahead -> chance 0.3 + 0.6 x aggression to
  commit for that corner: the INSIDE, or round the OUTSIDE when the car ahead already covers the inside (the switch-back); target
  latLim - 1 m off centre; brakes later (K_BRAKE + ATK_KB 0.12); +2 % x aggression. Ends past the apex / once 5 m ahead / 35 m behind / 7 s.
  TOW PASS where no corner is near (ovals, long straights): in the slipstream (dragMul < 0.85) of the same car -> pull out to the side with
  room (Naffcar's banked turns are wider than CORNER_R, so stage 3 v1 never attacked there).
- DEFENCE: a car closing within 16 m behind, BEFORE it is alongside (one move, not under braking), a corner < 110 m -> chance 0.8 x
  defence to cover the inside (0.6 x latLim) to the apex. GIVING ROOM: a car alongside on the inside of the corner -> give up 5 % x
  (1.2 - defence) of speed. Attacks and covers keep ALONG_GAP 2.7 m from a car alongside.
- OFF-LINE SPEED: x m further inside than the line at a bend within braking distance -> that bend's speed x sqrt((R - x) / R).
- MEASURED (24 races, Realish): stage 2 (no draft) passes 63 | contact 184.6 s / 2476 events (side 460) | resets 2 | off-road 277 car-s.
  Slipstream alone (12 races) passes FELL 35 -> 24 (followers bunched behind and were capped). v1 attack: 134 passes but contact
  232 s, side events x3 (attacks ignored a car alongside; covers moved under braking). FINAL: passes 97-103 (x1.6) | contact
  192-196 s (+5 %, fewer events) | resets 4-6 | off-road 518-528 car-s (x1.9: ~3.6 s per car per race, scrabbling; per-seed noise is
  large — seed 5 on Naffcar has 0). Solo laps unchanged (aidrivecheck, 4 levels x 3 diffs, within 0.2 s). aijokercheck OK.
  In game: aistage2check Thruston + Slidden OK (its path limit on the LINE is now half the road + 1 m: attacks leave the line on purpose).
- JOKER COST (open, needs the user): the AI loses 4.4 s (Slidden) / 5.4 s (Knobhill) on the joker; it is the LANE, not the AI — R 20-35 m
  dirt hairpins (mu 0.56) cap anyone at ~13 m/s; the bench hatch loses 7.4 s there too (jokercost). A smoother merge did not help
  (15/60/40 m: 4.31 s). Real RX ~1-3 s -> open the joker lanes up = a level change, ask first.
- Test hooks: `globalThis.__NOATK / __NOCOV` (aifieldcheck NOATK=1 / NOCOV=1), `AINEXT=1` (tools load src/aidriver.next.js), `OFFLOG=1`
  (every off-road excursion with the AI's state), `NODRAFT=1`.

## MENU RACE + BOOT SCREEN — 2026-10-04
- User: "just use the updated AI / 5-car race event for the menu screen". main.js: DEMO_LEVEL thruston, DEMO_CAR hatch-rwd, DEMO_AI 4
  (?menuai=N for A/B), DEMO_DIFF 3 (Rich). The camera car is driven by createAIDriver too (drive(car, wallDt, ctx) once per frame, as the
  old autodrive demo was); armStart() gives no lights in menu mode; launch() resets aiDiff from ?diff / the setup row. Stuck camera car
  (> 3 s under 2 m/s or 30 m off its path) -> nearest centreline point + relocate().
- MEASURED (tools/menurace.mjs, CPU x4): 1 car median 17.7 ms, slow (> 25 ms) 13 % / 11 %; 5 cars median 18 ms, slow 33 % / 33 %
  (landscape / portrait). Unthrottled: 53-56 fps, no errors. menucheck OK at both sizes.
- Boot screen: index.html #boot = "RAC3R / loading…" (user: "remove the initial tap to play lab screen"); the THE LAB / tap to drive text
  is set by main.js only in no-menu mode (?menu=0 or webdriver = the tools).

## AI STAGE 4 — RACE FLOW (part 1: circuits + RX) + TRACK CUTS — 2026-10-04 (src/raceflow.js; main.js startFlow / gridPos / trackCut;
## menu.js results + LAPS row; hud.js drawFlag / drawNotice). Old files: _archive/pre-stage4, _archive/pre-cuts.
User (decided 2026-10-04): short GRACE for the player once the top 3 are home, but timed events must work LIKE REAL LIFE ("simulate /
estimate"); PODIUM then TABLE; LAPS in setup; GRID random, biased FRONT on easy and BACK on hard; joker lanes LEFT as they are.
- A RACE = any VS AI or RX race on a lap circuit (not a stage, not the menu). Laps: setup LAPS row (1-10; default 3, RX its joker laps);
  RX race.laps follows it. Time runs from the GREEN for everyone (the player's RX timer now too: it ran from the first move, 0.44 s apart).
- raceflow: per car laps (lap 1 from the green), best, finish; states racing -> grace (top 3 home, GRACE 5 s or until the player is
  home) -> done; a player home in the top 3 waits at most 15 s. CLASSIFIED ON TIME + penalties: unfinished = ESTIMATE (now + distance
  left / last lap's pace), "~" in the table; RX: no joker yet with > 0.6 lap left = + its cost (estCost, 5 s), not the penalty; an
  estimate > 2 x the winner = DNF, last. Flags: one when the winner is home ("#n WINS" / "YOU WIN!"), one at the end ("FINISH"), a
  waving chequer band over the whole screen, 1.5 s wall time. Results 1.6 s after the end: podium (2.5 s or tap) -> table (POS, car
  colour + number, TIME, GAP, BEST, PEN) -> RESTART / TRACK SELECT / MAIN MENU.
- PROGRESS FIX: a car starting OFF the lap (Slidden's RX start lane) counts from where it JOINS the lap (the AI used to count the start
  lane as a lap); on the lane it ranks by distance down it. Out of the track's range (querySubtrack dist Infinity, trackDist 0) the
  progress HOLDS (the 0 dragged it back to the line).
- GRID: player slot weights exp(GRID_BIAS[diff] x slot / n), GRID_BIAS -2.2 / -1.1 / 0 / 1.1 / 2.2 (Mobile .. Real); the AI fill the
  other slots; rolling start goes green when the POLE car crosses.
- TRACK CUTS: wholly off the road (centre > half width + 1 m), the NET (progress gained - distance driven) over the excursion; back on
  the road, >= CUT_MIN 15 m = a cut. RX race / rally stage: +1 s per 5 m, min 2 s (into the result / stage time; notice "TRACK CUT +n s").
  Circuit race: >= 25 m -> put back where it left the road, progress restored (notice "TRACK CUT — PUT BACK"); smaller: nothing.
  Practice: nothing. MEASURED: tools/cutcheck.mjs Thruston + Brands (put back, prog 24 / 36 m), Slidden RX (+58-61 s for a 260 m
  shortcut). Normal racing clipped one inside by 8-10 m (2 cars, Castle Cum) -> CUT_MIN 8 -> 15. Bugs on the way: a "teleport" guard
  dropped the very jump a cut makes; a clamp at 0 lost the gain (it only arrives on rejoining).
- MEASURED (tools/racecheck4.mjs): Thruston 1 lap 5 AI (player driven by the AI) OK; Thruston parked player -> DNF OK; Slidden RX 3 laps
  portrait OK (every car 1 joker, start lane not counted); Castle Cum 3 laps OK. menucheck OK. Photos shots/look/race4-*.png, cut-*.png.
- NOT YET: rally STAGES (Sweaty Lamb) with AI = staggered-start time trial (part 2).

## AI FEEDBACK ROUND 1 — 2026-10-04 (aidriver.js; tools/aisurface.mjs)
- SURFACE CHANGES (user: "slow down weirdly on surface changes, dirt to tarmac — predict it and speed up"): aisurface (rally-4x4 Real,
  Slidden): 19 of 26 changes lifted > 0.3 s with the target above the speed. Cause: WHEELSPIN halved the throttle (normal on dirt), then
  the understeer lift. Fix: loose = (1 - mu) / 0.5 clamped; no wheelspin cut on loose ground; understeer lift at front slip 0.14 + 0.06 x
  loose. -> 10 of 26; Real laps Knobhill 47.6 -> 45.8 hatch / 41.5 -> 40.5 4x4, Sweaty Lamb 128.5 -> 125.2 / 114.4 -> 112.7, Slidden
  55.9 -> 55.1; tarmac unchanged. Rejected: later slide catch + power through it + more rear slip (together: 16-31 s off a lap).
- HANDBRAKE TURNS (user: "use handbrake and drift"): corners turning > 1.4 rad with apex R < 25 m (+8 on loose), apex within 0.8 s:
  one 0.25 s pull, full lock, off the throttle; chance 0.5 + 0.5 x skill per corner. Lap-time neutral (flavour).
- TRACK CUT FIX (user: "the track cut triggers on joker laps — it shouldn't"): a car on any LEVEL.lanes lane (joker, RX start, pits) is
  not off the road; an excursion that touches one is dropped. Verified: RX races at Slidden + Knobhill, joker forced -> 0 cut penalties;
  cutcheck Slidden still +58 s for a real cut.

## AI FEEDBACK ROUND 2 — 2026-10-04 (aidriver.js; tools aifieldsuite FOLLOW metric, surfacegrip, aislow)
- QUEUEING (user: "AI still queue and wait rather than overtake and avoid blocking cars, even if slightly off track"): the room to pass may
  use WIDE 0.8 m past the usual edge, WIDE_SLOW 2.5 m round a much slower / stopped car; with a side chosen it no longer matches the car
  ahead's speed unless overlapping close up; BUG fixed: the room test subtracted the driver's own wander offset. aifieldsuite Realish (24
  races): following 219 -> 83 car-s, passes 72 -> 149, contact 197.5 -> 208.6 s (events 2666 -> 2321), off-road 491 -> 511.
- PRECISION by difficulty (user: "tighter, faster driving at harder difficulty", "crashing should reduce"): traits.prec = diff / 4 +
  (skill - 0.5) x 0.2; following gap x (1.15 - 0.35 prec); the car ahead's braking for the corner ANTICIPATED (arrive gapF behind at the
  profile speed where it is). Real: contact 241.5 -> 198.9 s, resets 10 -> 3, off-road 545 -> 495; Mobile: contact 240.5 -> 225.2.
- SURFACES again (user: "still slow down on transition change", "drive slow on slippy surfaces"): tools/surfacegrip — real cornering grip
  on loose ground is x0.82-0.95 of what the AI assumes (the targets are NOT too cautious); but with 0.35 rad of body slip the 4x4 gets
  +22 % on gravel (1.05 g vs 0.86) = DRIFTING is the missing pace (needs a slide-holding controller: proposed, not built). tools/aislow:
  the transition lift was the WHEELSPIN throttle cut (tarmac after dirt, wheels still spinning) -> removed: 0-0.6 s faster everywhere.
  Mud: flat out and still ~40 % under target = the surface's drag (physics, same for the player).
- OBSTACLES (user: "AI need to see tyres and cones as obstacles — optional — but try and avoid them on rally stages / tracks"):
  (1) racingLine: a resting cone / tyre / stack / bale INSIDE the road pulls that side's limit to r + OBST_LINE 1.6 m from it (unless the
  road left would be < 3 m); (2) drive(): ctx.obstacles (main.js: objects within 45 m, refreshed 0.25 s) — one in the path ahead and no
  car in the way -> step round on the side with room, else drive through. tools/aiobstacles (Sweaty Lamb, 2 laps): knocked 58-63 -> 0
  (with r + 1.1 m: 38 — tracking error); laps unchanged on 5 levels except the cone course Test Track +0.1-0.5 s.

## AI STAGE 4 PART 2 — RALLY STAGE WITH STAGGERED STARTS — 2026-10-04 (raceflow stage mode; main.js gridPos / startAtOf / carHeld)
- VS AI on a stage level (Sweaty Lamb): single file back from the spawn (9 m apart), slot k released STAGGER 6 s after slot 0 (was 10:
  a 39 s wait when last of 5); the player's slot by the same difficulty-biased draw as the grid. Your lights count to YOUR start
  ("START IN n", then the reds in the last 3 s, GO!). Each car's stage time = crossing the start line -> the finish distance. The event
  ends once you finish and the rest have too, or 10 s later; a car still on the stage is ESTIMATED as elapsed x finish / distance done
  ("~"); one under 5 % of the way, or > 2 x the winner, is DNF. Track cuts: +1 s per 5 m for everyone on a stage.
- MEASURED: racecheck4 sweaty-lamb 3 AI (player driven by the AI): YOU 1:57.27, #2 1:59.94, #3 ~2:00.28, #4 ~2:01.50 — OK. Photos
  shots/look/stage-start-844/390.png.

## AI FEEDBACK ROUND 3 — OFF ROAD + DIRT -> TARMAC — 2026-10-04 (aidriver.js looseUnder / offPlan; aifieldcheck SURF=1)
- User: "they still slow down like mad off road / changing surfaces" ("mostly dirt to tarmac"); "cars should generally accelerate / drift
  more when off road". aifieldcheck SURF (6-car races): on grass / dirt the AI braked 26-36 % and lifted 13-39 % of the time — the
  front-slip "understeer" reflex (lift + brake 0.35). FIX: OFF THE PLANNED SURFACE (car mu < 0.85 x its line point's mu) a front slide on
  loose ground keeps UNDER_LOOSE 0.35 throttle and never brakes. Off-road speed: Brands dirt 17 -> 28 m/s, grass 24 -> 26; Castle Cum dirt
  16 -> 25, grass 16 -> 25; a Castle Cum race 162 -> 155 s. Suite (24 races, Realish): passes 106 -> 145, contact 180 -> 211 s, off-road
  607 -> 651. Applied on ALL loose ground first: Sweaty Lamb 4x4 Real left the stage 16 s a lap -> limited to off-plan (112.9 s, 1.8 off).
- Dirt -> tarmac traced (tmp d2t trace, Slidden hatch Real): full throttle the moment it reaches tarmac; the slow bit BEFORE is the dirt
  hairpin itself (R ~15 m: ~9 m/s for any car). Lifts at changes now: hatch 0-3 per lap, 4x4 4-19 (gravel slip-feel).
- TRIED, NOT SHIPPED: extra rear-slide tolerance off-plan (OFF_SLIDE 0.12-0.2): one race each, mixed (Brands dirt 28 -> 21, Castle Cum
  grass 25 -> 27) = noise; a looser slip-feel on loose for the 4x4: Sweaty Lamb off 6-51 s.
- REWORKED 2026-10-04 (user: "staggered stage timing doesn't work — it's like a normal race rather than starting IN BETWEEN other opponents
  on a rally stage TIME-WISE"): REAL INTERVALS, STAGE_GAP_S 30. You always start at the normal lights. Cars drawn BEFORE you are placed down
  the stage where their own pace takes them in (k x 30 - 4) s (aidriver lineRun: profile x pace + an acceleration limit; predicted
  Realish hatch stage 117.6 s vs 117-121 measured), already driving, timed from k x 30 s before your green; cars AFTER you queue behind
  and go 30 s apart. A car 3 s past the finish leaves the road (it used to drive the liaison back into the queue). Estimates: under a
  quarter of the stage -> its predicted time (lineRun), else elapsed x finish / done. MEASURED (racecheck4 sweaty-lamb 4 AI): starts
  -90 / -60 / -30 / you / +30 s; YOU 1:56.91, #2 1:57.54, #3 1:59.32, #4 2:00.48, #5 ~2:00.63 — OK.

## AI FEEDBACK ROUND 4 — THE REAL "DIRT -> TARMAC" BUG: A KINK IN THE RACING LINE — 2026-10-04
- User (third time): "Slidden Hill dirt to tarmac, the AI still slows down!!". A LINE DUMP at the surface changes found it: the racing
  line's surface bias jerked the line sideways where a surface edge crosses the road at an angle (half-dirt cross-sections) — R 19-26 m
  on a straight (R 150-2000 either side), which the speed profile braked for: 20 -> 11 m/s at Slidden d 363; R 8 at d 1102; the same at
  Knobhill. Rounds 1-3 (wheelspin cut, understeer reflex) were real but smaller; this was the one the user kept seeing.
- FIX (aidriver racingLine): the cross-section grip map is averaged along the track +-MU_SMOOTH 20 m before the bias reads it, so the
  line eases across a surface change. Min R at the changes: Slidden 19 -> 126 m, 8 -> 91 m. LAPS (aidrivecheck, Real hatch / 4x4):
  Slidden 54.7 -> 46.0 / 49.5 -> 41.2, Knobhill 45.5 -> 42.6 / 40.1 -> 37.1, Sweaty Lamb 125.7 -> 117.7 / 113.2 -> 105.4, Thruston
  (one surface) unchanged. aijokercheck OK.

## DAMAGE — 2026-10-04 (src/damage.js; vehicle.js reads car.wreck; main.js hit() around every collision; render.js damagedSprite /
## paint chips / smoke; hud.js tyre diagram; raceflow + menu REPAIR column; guide card). Old files: _archive/pre-damage.
User (decided): "full damage but limited"; RESET repairs, but every hit is COUNTED as a repair cost — charged at the end of a Story race,
SHOWN in Test mode, never charged; pit repairs in certain events (ASK when); an AI too injured RESETS; AI by the same rules; "cars should
crumple, dent, chip and emit their coloured paint pixels"; "use the existing tyre / car indicator for damage".
- IMPACT = the velocity change a collision resolve imposes in one step (walls / barriers / props via the clamps, car-to-car via contact.js,
  heavy objects via cones.js): under DMG_FLOOR 2.5 m/s nothing (the tolerance floor); above, 0.026 x (dv - 2.5)^1.4 shared over four
  corners by where it came from. MEASURED (dmgtest): head-on 10 km/h 0.01 / corner, 20: 0.10, 35: 0.29, 50: 0.54, 80: 1.0 front; in
  game (crash test, solid prop): 30 km/h £208, 60 km/h £1,087-1,138 + smoke, 45 km/h offset: one corner wrecked.
- EFFECTS (limited): axle grip x (1 - 0.2 x avg), puncture x0.7 (25 % chance from a single 0.3+ corner hit), power x (1 - 0.15 x worst
  front), steering pull TOE 0.008 x (right - left front) — 0.04 turned the car 40 deg in 3 s hands-off; 0.008: 8 deg (a pull you
  correct). Never a DNF: RESET (player) / tooInjured (AI: avg > 0.6, a corner >= 0.95, or 2 punctures) mend the car; the bill stays.
- LOOK: per-car damaged sprite (rebuilt per 0.1 change): CRUMPLE (corner cut back on a jagged diagonal), DENT (darkened band), CHIP
  (primer pixels); paint-coloured CHIPS (+ primer / trim) flung from the hit corner, skid to a stop, lie 4-8 s (cap 400); grey smoke
  from a front past 0.5; the tyre diagram appears by itself once hurt (quarters amber / red, white-ringed wheel = puncture).
- RESULTS: REPAIR £ per car; "YOUR REPAIRS £n — TEST MODE: SHOWN, NOT CHARGED". Photos shots/look/damage-844/390.png,
  race4-table-castle-cum-drive-390.png. uicheck / guidecheck / menucheck OK.
- V2 (user, after v1: "not accurate to the 1/4 damaged; wheels don't come off in large impacts; paint doesn't emit; really hard to cause,
  unrealistic"; "cars don't dent — they should clearly dent if hit"; old files _archive/pre-damage2): FLOOR 2.5 -> 1.5 m/s, K 0.026 ->
  0.035; SCRAPES (0.12-1.5 m/s per step while > 3 m/s): 0.008 x speed x time on the touching side + a few chips every 0.06 s. Each corner
  keeps crushL (end-on) and crushS (side-on): the sprite pushes each EDGE in by its two corners' crush, sloped between them (front / rear
  up to 26 % of the length, sides 34 % of the width), a DARK FOLD line at the new edge, a pale crease only with real depth, graded dent
  shading + primer chips behind; crush under 0.6 art px not drawn (v2a drew a pale speckled outline from scrapes). WHEEL OFF: a single
  hit adding >= 0.4 to a corner ending >= 0.85 -> the wheel becomes a loose rolling tyre (cones.add), that axle x0.45 grip, a pull
  (TOE_OFF 0.02) and rolling drag x5; AI with a wheel off reset. Chips 2-3 art px, 8-60 per hit, 6-12 s. Diagram: lost wheel = dark slot,
  red X. MEASURED: crash test 30 km/h £410, 60 km/h front-left wheel off (front grip 0.40) £2,063; aifieldcheck DMG=1 Thruston 2 laps:
  bills £2-1,442, no damage resets, 2nd laps 44.1-44.9 s (as without damage) — pace barely touched.
- BROKE THE LIVE GAME ~5 min: a "// comment" appended mid-line swallowed render.js code; node --check passed, the browser threw
  "Unexpected token export". CLAUDE.md §1 now: import-test every patched module before it goes live.

## ROLLOVERS + SIDE / ROOF SLIDES — 2026-10-04 (src/roll.js; damage.js hitRoll / roofDmg; render.js rolledFaces / sideSprite / underSprite /
## silhouette / sparks; main.js; cars.js cg + rideH). Old files: _archive/pre-roll.
User: "the roll over system should be included in damage"; "can we get roll overs and side and roof slides"; "easier to give cars cg and
ride height"; "the shadow should be a darker copy of the sprite"; then "rollover is triggered a bit too easily — conditional to surfaces,
a % chance to roll or slide per floor grid / bunch"; "looks a bit strange and cubey as it rolls — expected a bit".
- cars.js: per-car cg + rideH (hatch 0.53-0.55 / 0.13-0.14, estate 0.66 / 0.21, muscle 0.50, rally 0.52 / 0.20, track 0.36 / 0.07,
  naffcar 0.48, tractor 1.05 / 0.45). Handling still uses the shared, approved cgH 0.52 (unify = the user's call). SSF = track / 2 cg.
- TRIP (per ground cell, CELL_M 2 m): sliding sideways over the ground's speed v x (SSF / 1.44) -> one roll of pct % x min(2, over / 5) x
  stability per cell crossed, else it slides. v / pct: gravel 9 / 6, dirt 9.5 / 5, sand 8.5 / 8, mud 10 / 4, grass 11 / 3, long grass
  10.5 / 4, snow 12 / 1.5, kerb 11 / 4, ice never, hard 19 / 1.5. Also a hard SIDE impact (damage.js sideKick, dv > 7 x stability) and a
  crooked LANDING (> 0.35 s in the air, 4+ m/s sideways: 30 %). MEASURED (rolltest, 20 trials, hatch sideways): grass 60 km/h 1/20
  (v1 19/20), 70: 8/20; gravel 60: 5/20 (v1 17/20); tarmac 90: 0/20; estate gravel 50: 7/20; track car gravel 90: 3/20; tractor grass
  50: 9/20. Outcomes spread over wheels / side / roof (random spin 0.7-1.3 x, each ground contact keeps 0.6-0.8 of it).
- ROLLING: rate ~0.95 x sideways speed + 2 rad/s (cap 14); each quarter turn = a ground contact: speed x0.86, hitRoll (side: crushS on
  that side; roof: roofDmg + cracked glass / pressed cabin in the sprite) + paint chips; under 2.4 rad/s it falls onto the nearest face.
  SLIDES: body friction (tarmac 0.45 with SPARKS, grass 0.55, loose 0.7, snow 0.28, ice 0.1). Player: input ignored, notice "ON YOUR
  ROOF / SIDE — RESET"; RESET (vehicle.reset clears car.roll). AI: reset once still for 1.5 s. No tyre marks while rolling.
- LOOK: the box rolled phi about its long axis seen from above — top (damaged sprite), underside (floor pan, rails, axles, exhaust), and
  the -y / +y side faces (doors, windows, wheels, lights), each at its projected place and width; SHADOW = a darker silhouette copy of the
  drawn sprite(s), offset by ride height. Photos shots/look/roll-0..7.png, roll-end.png. Known: reads a bit "cubey" (the user: expected).
- In races (racecheck4 Brands + Slidden, 2 laps, 6 cars): 0 rolls, 0 damage resets.
- AI RESET at the TRACK EDGE (user: "reset AI should reset like the player's, at the edge of the track"): each car keeps its last point on
  the road (progressOf); stuck / too injured / overturned AI go RESET_BACK 4 m behind it, centred on the edge it left by, nose 5-15 deg
  back on. MEASURED (aireset test): 6.99 m from the centre on a 7 m half width, 4 m behind the exit.
- ROLL CHANCE v3 (user: "getting in the way of drifting — closer to 90 deg, higher speeds, below 60 mph low; long grass / sand / mud / deep
  mud / snow higher; dirt / gravel / grass medium-low; hard low, broken tarmac a little higher"): per 2 m cell crossed, pct x ANGLE (0
  under sin 0.8 = 53 deg of slide, 1 at 90) x SPEED ((v / 60 mph)^4 below, rising to x2.5 above) x stability. pct: long grass 5, sand 6,
  mud 5, thick mud 7, snow 5; dirt 2.2, gravel 2.6, grass 1.8, kerb 1.5; broken 0.9; hard 0.5; ice 0.3. MEASURED (rolltest2, hatch, 30
  slides to a stop each): 45 deg drift 0 % everywhere at 30-90 mph; 90 deg at 30-45 mph 0-13 %, at 60 mph high-tier 23-50 %, medium 17 %,
  broken 10 %, tarmac 3 %; at 75 mph 50-90 % off-road, broken 17 %, tarmac 0 %.
- DAMAGED ROLL FACES (user: "cars that lost their front half still show it when they roll"; "balanced against compute"): the top-view
  crush pass is now crushTop(car, sprite, withRoof) — the top sprite and the UNDERSIDE share it (a lost wheel's tyre cleared from the
  underside); the side faces get their own pass (ends cut by that side's crushL, the panel dented / chipped along its length by crushS, a
  crushed roof pushes the cabin down, a lost wheel erased). Built lazily the first time a damaged car rolls, cached per car + per damage
  step (car._dface) — nothing per frame. Photos shots/look/dmgroll-0..5.png (front wrecked, FL wheel off, roof 0.5: 0 / 40 / 90 / 130 /
  180 / -90 deg).

## KILLDER — 2026-10-04 (lab.js KD_*; Kielder Forest rally parody; menu kind RALLY STAGE · FOREST). Old lab: _archive/pre-killder.
DECIDED (user): fast + flowing; "be liberal with hay bales, tyres, cones, flags and other event decorations"; staggered-start stage.
- 1966 m of gravel stage + 215 m dirt liaison (one closed loop, LEVEL.stage like Sweaty Lamb); tightest R 24 m (2 junction hairpins);
  the road never within 32 m of itself. Big CREST (r 22, h 1.8), THE JUMP (r 8, h 1.3), 2 top-road crests, 2 hills, spectator banks.
  KIELDER WATER (wet covers) by the dam straight, a forest pond, a service park with 3 trucks + marquees, start + finish arches.
- DRESSING: every autoKerbs corner (maxR 70): bales lining the outside, 2 chevrons, 3 apex cones, 3 flags; 3-deep tyre walls at the
  junction hairpins + the log-pile square; spectator tape + marquees at the hairpins + the jump; 7 log piles; marshal posts every
  240 m, 5 sponsor boards, flag pairs every 120 m; TREE WALLS 14-20 m out both sides (v1 had plantations only: open grass beside the
  road, photographed) + plantations: 555 trees, 282 bales, 234 tyre stacks, 92 flags.
- MEASURED: propcheck clear; aidrivecheck clean on every difficulty (Real 4x4 99.7 s, hatch 110.2 s); racecheck4 VS AI 3 (staggered):
  96.9-99.4 s, no damage / rolls / resets; framecheck CPU x4: median 16.7 ms, 92 slow frames of 570 (Sweaty Lamb 29) — the GROUND
  TILES (149 painted vs 89: a faster stage crosses more ground; trees cost nothing measurable) -> the open "paint tiles off the main
  thread" item.
- CHEVRONS + FLAGS NOT SOLID any more (all levels): flimsy signs on stakes; as solid walls one tore a rally car's front wheels off and
  rolled it at a Killder corner exit (photographed).
- GRAVEL TRAPS (user: "easier to roll over on than normal gravel, quite slowing / grabbing but semi low friction"): the trap surface
  (lab.js SURFACE_TRAP: mu 0.55, plough 5-7.5 m/s^2 graded to the fence) was missing from roll.js — it rolled like tarmac and slid
  with sparks. Now pct 14 (rolltest2, 90 deg sideways: 60 mph 40 % vs rally gravel 20 %, 45 mph 3 %), body friction 0.85, no sparks.
- LANDING ROLLS (user, after Killder: "a little easy to roll over on landing"): was 30 % for any landing with 4 m/s sideways; now 6+ m/s
  sideways AND a slide past 30 deg, up to 20 % at 12 m/s, x stability.

## TWO NEW CARS — 2026-10-04 (cars.js; render.js 'saloon' / 'wrz' bodies + spec.rim; aidriver aiK; carstats regenerated)
User: "two new vehicles — a BMW 3 series 2000s and a Subaru WRX classic 2005 saloon". Parody names, easy to change.
- BMV 3 SERIOUS (saloon-rwd, E46 330i-ish): 1450 kg, 50/50 on a 2.72 m wheelbase, RWD, ABS + TCS, straight-six CURVE_SALOON (peak 730
  game Nm at 3500, 6500 redline), 5-speed 4.23-1.00 x 3.07. Silver, kidney grille, bonnet roundel, window trim.
- SUBAROO WRZ (wrz-awd, GD WRX-ish): 1410 kg, 60 % on the nose (lf 1.01 / lr 1.515), symmetrical AWD (drive 0.5), ABS only, turbo
  flat-four CURVE_WRZ (soft under 2500, peak 745 at 3600, 7000 redline), 5-speed x 4.44. World Rally Blue, bonnet scoop, boot wing,
  GOLD wheels (spec.rim, drawn on the wheels).
- carstats (measured): BMV 242 km/h, 0-100 3.9 s, 33.0 m, 1.36 g; WRZ 243 km/h, 2.9 s, 32.2 m, 1.51 g (hatch 4.3 s / 1.41 g, Rally
  2.8 s / 1.51 g) — the real-world ratios on the roster's scale.
- AI LAPS (aidrivecheck Real): Thruston hatch 43.1 / BMV 41.7 / WRZ 39.4 / Rally 38.4; Slidden 46.1 / 45.5 / 41.6 / 41.2; Sweaty Lamb
  118.0 / 116.4 / 108.7 / 105.5. aiK (cars.js, per-car AI confidence on the plan, default 1): the WRZ at 1.0 ran 3 m/s hot into Sweaty
  Lamb gravel corners and slid off 25 s a lap (front-heavy AWD); 0.94: 2.9 s off, faster laps, tarmac +0.8 s.
- uicheck OK with 10 cars in the chip list; garage photos shots/look/garage-saloon-rwd.png, garage-wrz-awd.png.

## CHEVRONS + FLAGS KNOCKABLE — 2026-10-04 (lab.js after LEVELS; cones.js TOPPLES; render.js drawCones)
User: "chevrons and flags aren't impactable? I thought you were going to make stuff like that heavy but impactable". Every level's chevron
boards (45 kg on their posts, r 1.1) and flag poles (12 kg, r 0.35) move at load from the static props into the loose objects: they
topple like cones, get flung, lie flat (chevron face up with its posts, flag pole down, cloth crumpled). MEASURED (knock test, 60 km/h
straight into one on the road): chevron flung 10.4 m, flag 9.0 m, both down; scrape-level damage (£3-4). objcheck / balecheck /
tyrewallcheck OK. Killder: 24 chevrons + 92 flags now objects.

## QUICK FIXES — 2026-10-04 (late) (user spec dump; TODO "USER SPEC DUMP")
- NEW CARS v2: WRZ rear-biased 36/64, 57 % front, +12 % boost (carfeel: 40-100 2.05 -> 1.92 s, gravel power-on body slip 31 -> 52 deg, yaw
  44 -> 58 deg/s; Rally 70 / 74); sprites redrawn from the real cars (BMV: taper, power-dome creases, kidneys, angel eyes, roundel, sunroof,
  L-tails, silver rims; WRZ: meshed scoop, blob-eyes, hex grille + star, fog pods, arch flares, full-width wing on uprights, fat exhaust,
  gold rims). Garage lift now draws the wheels (renderer.pixelCarWithWheels).
- FLAG: only when YOU finish (raceflow myPlace), a waving 18 x 11 chequered cloth on a pole, shaded by the wave slope, swept in 1.5 s, "YOU
  WIN!" / "Pn — FINISH". RACES WAIT FOR YOU (no grace timeout; unfinished AI estimated). AIDS: the AI mirror your ABS / TCS switches.
- JOKER: + an on-road approach arrow 30 m before the turn-off on the joker side, angled in; HUD "JOKER >>>" flashing within 140 m.
- CHEVRONS / FLAGS: 2 distinct impacts (> 0.3 s apart) -> flat, out of the collisions (driven over).
- ROLL: snow pct 5 -> 11 (90 deg at 60 mph: 60 %); speed factor 0 below 39 mph, ((v - 39) / 21 mph)^2 to 60 mph, rising above.
- MUD DIPS exist (lab.js RUT).
- ROLL ranking (user: "sand highest, snow a close second"): sand pct 6 -> 22. rolltest2 90 deg at 60 mph: sand 63 %, snow 53 %, trap 27 %, thick mud 23 %, gravel 7 %; 75 mph: 97 / 90 / 60 / 87 / 67.
- AI START (user: "aim for the racing line too hard at the start -> crashes"): each AI keeps its GRID LANE from moving off and eases onto the
  line over START_BLEND 9 s, +START_GAP 1.3 m alongside meanwhile. aifieldsuite Realish 24 races: start contacts 765 -> 492, contact 231 ->
  212 s, resets 14 -> 9, passes 118 -> 192, off-road +12 %.
- AI DAMAGE RESET WAIT (user: "wait a moment, worse damage longer, max 2-3 s, so we can see crashes play out"): 1 + 2 x severity s coasting on
  light brakes (severity = mean corner damage + 0.4 for a lost wheel). Measured 2.3 s (moderate), 3.0 s (wheel off).
- RALLY TAPE (lab.js after LEVELS: posts; cones.js sections / stepTape / crossesCar; render.js drawTape): posts (4 kg, topple) every 4 m on
  both sides of every corner (inside half width + 2.5 m, outside + 5.5 m) on stage / joker levels + the old red spectator lines; a section
  snaps when a car crosses it over 1.5 m/s (Liang-Barsky segment vs car box) or its posts are pulled 1.8x apart; 45 % sticks to that car as
  a fluttering streamer (14 s). Posts: Sweaty Lamb 663, Killder 393, Slidden 174, Knobhill 178. framecheck Sweaty Lamb CPU x4: 28 -> 30
  slow frames (median 17.7 both). Photo shots/look/tape.png.
- AI DRIFT HOLD (user: "really need AI to drift and handbrake sometimes / aggressive off-road"): on loose ground, in corners with an apex under
  DRIFT_R 35 m, in rear-drive / rear-biased cars (drive < 0.5), decided per corner (0.45 + 0.5 x aggression): the rear held near DRIFT_SLIP
  0.22 rad on the throttle, countersteer free, caught past 0.4; never within 2 m of the edge; an off within 2 s of a drift bans drifting 60 s.
  MEASURED (scratch drift test, diff 3, 2 laps): slide s/lap Killder Rally 0.3 -> 3.3, WRZ 2.3, Knobhill Rally 1.2 / WRZ 1.3; laps unchanged
  except Sweaty Lamb Rally 105.5 -> 111.5 with 7.7 s off (narrow gravel: the 78 %-rear car runs wide) — accepted ("a little messy is good").
  Tried: 0.32 / 0.55 everywhere (Sweaty Rally off 12 s), 0.3 / 0.5 in tight corners (off 9-14 s).
- TAPE ON CARS: 14 s, 60 % knocked off per fresh impact (damage.js), cleared by vehicle.reset.
- LIGHTS + INDICATORS + PEDALS (user: "working headlights + a button bottom-left with indicators; driving buttons slightly larger"): hud.js
  bottom-left row ◄ LIGHTS ► (46 x 34, tap consumed before steering); keys G / Q / E; car.lightsOn -> two gradient beams 190 art px ahead +
  bright lamps (render.js); car.indicator -1 / 1 -> amber corner lamps at 1.5 Hz, cancelled like a stalk (turned that way, then back to
  centre) or after 8 s; AI mirror your lights; PEDAL.r 36 -> 40. uicheck (6 sizes) + inputcheck OK.

## Garage step 1: CLASSES (user, 2026-10-04: "proposed split")
cars.js `CLASSES` (ROAD Hatch/Saloon/Estate/Sports/Muscle · RALLY 1L/2L/2L+/Group B · RALLYCROSS · STOCK / GRASS · OVAL · SINGLE-SEATER
F1/F2/FE · DRIFT · OFF-ROAD / ODD) + `cls`/`sub` on every ROSTER row; `classOf(id)`. menu.js `carPicker(p, onPick)`: CLASS ◀ ▶ and TYPE ◀ ▶
(only classes / types you own a car in, ALL first; starts on the active car's class), then the car ◀ ▶ within the filter with "class ·
type · k/n" under the name. Used by race setup and the garage (which also lists CLASS in the stats). Measured: scratchpad classshot.mjs
(cycles every class, 0 errors), shots/look/garage-classes.png, setup-classes.png (844x390).

## Fixes (user, 2026-10-04): joker HUD on the wrong tracks; tape across the Knobhill joker mouths
- MEASURED: after an RX race, the in-game level switch (selectLevel) kept `race.on`, so Thruston / Sweaty Lamb / Test Track all showed
  LAP n/5 + JOKER TO DO (jkleak.mjs: race.on=true on all 4). Now selectLevel clears it on a level without a joker (4/4 false), and the
  HUD's RX panel also requires LEVEL.joker. The "JOKER ›››" flash waits for the start (rc.started; it flashed in the countdown).
- Tape (lab.js post-pass): no post within half a lane width + LANE_CLEAR 2.5 m of a ROAD lane (lanes without `out`: joker, RX start,
  pit, service); gravel traps may still be crossed. The run's idx gap leaves that section open. Knobhill tape sections 164 -> 159;
  shots/look/joker-knobhill-in/out.png show both mouths clear.
- The desktop keys hint moved above the LIGHTS row (it overlapped it).
- Seen, not yet fixed: AI Naffcars are ids 'naffcar#n', so render's `spec.id === 'naffcar'` drew them as plain muscle cars (fix lands
  with paint: base id).

## Garage step 2: PAINT + NUMBER (user, 2026-10-04: "palette + number + preview")
cars.js PALETTE (16) + applyLivery(spec, {paint, trim, num}) (missing = the roster's own). menu.js paintShop(): BODY / TRIM swatches,
NUMBER −10 − + +10 (0 = none), live preview on the lift, STOCK, APPLY saves profile.livery[id]; launch passes it; main.launch applies it.
render.js: sprite caches keyed by id + paint + trim + num (pixelCar, wheels, side / under faces); numPanel draws a white panel + 3x5
digits at scale 2 on the roof (rally: replaces the roundel; saloon: replaces the sunroof; stock car: replaces the "42"), the nose on the
open-wheeler (scale 1), the bonnet on the tractor. AI unnumbered (offer). Fixed with it: AI Naffcars ('naffcar#n') drew as muscle cars.
Measured: paintshot.mjs (#27 yellow / black saved, in-race spec carries it, 0 errors); shots/look/paint-shop.png, paint-race.png,
paint-numbers-sheet.png (all 10 bodies).
- The Subaroo WRZ moved ROAD/Sports -> RALLY/2L+ (user). The picker restyled (user: "unclear / spaced weirdly — grouped and coloured"):
  one boxed group, rows CLASS (amber tag) / TYPE (teal) / CAR (white), each TAG ◀ value ▶ with the value in the tag's colour.

## Lamps break with damage (user, 2026-10-04: "headlights should vanish with damage appropriately")
render.js lamp(c) per corner (damage.js corners): full to LAMP_OK 0.15, flicker + dim to LAMP_GONE 0.35, then out. Headlight beam + lamp,
indicators, brake lights. shots/look/lamps-clean / lamps-frontleft (FL 0.6: that beam + indicator gone, the right one still lit).

## Tape goes up in a puff (user, 2026-10-04: "tape should vanish into a cloud of particles after multiple hits")
cones.js: the snap is hit 1; the next distinct hit (a car through the gap >= TAPE_REHIT 0.5 s later, or posts torn > 3x rest) = TAPE_GONE
2: the section is gone and a puff queued (tapePuffs); render.js bursts 22 red / white flecks per stub (the chip system, 0.5-1.6 s). A
streamer that leaves a car (timed out / knocked off by an impact) puffs too; a reset (streamers = null) does not. tapepuff.mjs: hits 2,
gone, 0 errors; shots/look/tapepuff-2-gone.png.

## AI race within the class (user, 2026-10-04: "AI should race within the class — an option to force them to use your car")
main.js aiCarIds(): 'class' = a shuffled deck of YOUR car's class (seeded per race; a one-car class repeats); 'same' = your car. Setup
row AI: CLASS CARS / AI: YOUR CAR (shown with VS AI, remembered in profile.aiCars, default CLASS). A launch without opts.aiCars (tools,
the menu race) keeps 'same' so AI measurements stay like for like. aidriver already keys stats / profiles by base id. jktake.mjs:
hatch-rwd class -> hatch-rwd, muscle, hatch-fwd, saloon, estate; same -> 5 x hatch-rwd; rally -> rally / wrz mix; naffcar -> 5 x naffcar.

## Joker HUD switches as it happens (user, 2026-10-04)
The gate counts mid-lane (Knobhill lane pt 22/48), so the first half of the lane still flashed "JOKER ›››". stepJoker now flags
game.inJokerLane (off the main road, within the lane through the gate) and game.jokerAt. HUD line: TO DO -> ››› -> IN JOKER › ->
JOKER TAKEN ✓ (flashing 2 s) -> JOKER DONE ✓. shots/look/jokerhud-1-inlane / 2-taken / 3-done.

## Garage step 3: TYRES (user, 2026-10-04: "do your recommended", 4 brands / 15 types, "Creem is an oil brand")
cars.js: SURF_GROUP (hard / wet / loose / soft / snow), TYRE_BRANDS (SPUM budget, KUM road + track, DUNFLOP rally + off-road, PIRRELLY
race), TYRES (15: grip per group, heat window opt / peak / cold, heatHard, slide (Drift), fits by class, price, note), applyTyre(spec,
id) (Pre-Spun / no fit = no tyre object: the stock car EXACTLY). vehicle.js: muBase x tyre.bySurf[surface]; FmaxSlide x tyre.slide;
heat-up x heatHard on hard ground. main.launch applies opts.tyre; menu tyreShop() (brands as coloured groups, NO FIT locked, bars per
surface with a white STOCK line, grip / heat window / heats-up / price "FREE IN TEST"; FIT saves profile.tyres[id]); the garage shows
TYRES and GRIP with the tyre (and STOCK). AI run stock tyres. tools/tyregrip.mjs (hatch-rwd, steady g @ 60 km/h):
  STOCK = PRE-SPUN exactly: tarmac 1.413 / wet 1.053 / gravel 0.857 / grass 0.428 / snow 0.429 g, heat30s 148 C
  semi-slick tarmac +17% wet -15% | road-sport +9% | tarmac-rally +13% | kum-wet wet +25% | gravel gravel +23% tarmac -6% (216 C)
  soft-gravel gravel +29% tarmac -10% (205 C) | studded snow +72% tarmac -11% | mud-plugger grass +26% | drift 125 C (coolest)
shots/look/tyre-shop.png, tyre-garage.png; tyreshot.mjs: fit saved, carried into the event (spec.tyre gravel, opt [45,90]); the F1 car
offered Pre-Spun + the 3 Pirrellys only.

## Nine new cars (user, 2026-10-04: "an old classic Mini, a Lamborghini, and fill those classes")
cars.js ROSTER + curves; render.js bodies (mini, lambo v2 wedge, mikra, kit, rxcar, banger, grass, drift; F2 = the 'track' body).
New per-car fields: steerMax (vehicle.js lock; aidriver / autodrive divide by it — the drift car's 49 deg angle kit), cyl (audio).
tools/carstats.mjs (garage numbers, written to src/carstats.js), after one tune pass (drag / gearing):
  Minnie Cooped S   ROAD Hatch    193 km/h 5.6 s  690 kg FWD     Lamburghini Hurrikan ROAD Sports 312 km/h 2.4 s 1420 kg 4WD
  Nissun Mikra R1   RALLY 1L      201 km/h 5.2 s  980 kg FWD     Pugeot 306 Maxxi     RALLY 2L    221 km/h 4.2 s 1000 kg FWD
  Fjord Fiester RX  RX Supercar   226 km/h 2.4 s 1300 kg 4WD     BriSKA F2 Stocker    STOCK Stock 191 km/h 4.1 s 1150 kg RWD
  Autograss Special STOCK Grass   184 km/h 3.5 s  650 kg RWD     Nissun Sylvya S13 D  DRIFT Pro   258 km/h 3.8 s 1220 kg RWD
  Formula Too       SINGLE F2     270 km/h 3.0 s  755 kg RWD     (F1 'Track spec' 298 km/h 2.8 s)
  GRIP (steady g at 60 km/h on the throttle) reads low for power-limited cars: kit 1.14, drift 1.01 — honest, left.
AI (aidrivecheck realish/real): Thruston mini 46.4 / lambo 40.8 / f2 43.3 (F1 42.1) / drift 48.5 / banger 44.9, all 0 off. Knobhill +
Sweaty Lamb: mikra, grass clean; rx 3.3-3.6 s off; kit 1.7 s Knobhill, 8.7 s Sweaty Lamb (one spot ~1712 m; aiK 0.94 / 0.9 did not
help — left stock, like the Rally car's accepted 7.7 s). shots/look/new-cars-sheet.png.
- AI CLASS picks: your TYPE when it has 2+ cars (parity: a hatch race = hatches + Mini), else the class.
- HUD dropdown (19 cars + 14 levels overflowed a phone): flows into columns above the LIGHTS row, rows 26 px; long names shrink to
  fit (label maxW). shots/look/dropdown-19.png.

## Tyres v2: nine surfaces (user, 2026-10-04: "tyre stats don't show all the surfaces they affect — mud etc isn't shown ever")
v1 had 5 groups (GRASS hid mud + sand, GRAVEL hid dirt, SNOW hid ice). cars.js TYRE_SURFS = tarmac (+ kerb, concrete, broken), wet,
gravel, dirt, grass (all lengths), mud (+ deep mud), sand, snow, ice; every tyre a number per surface; the shop draws 9 bars. Measured
(tyregrip, hatch-rwd): Pre-Spun = stock on all 9; mud-plugger mud +33% grass +23% sand +13% tarmac -8%; studded snow +60% ice +55%;
all-terrain mud +18% sand +15%; gravel gravel +23% dirt +15%. shots/look/tyre-shop.png.

## Point-to-point stages + the STAGE GENERATOR (user, 2026-10-04: "rally stages are circular often — mostly a LINE"; "procedural";
## "levels are most important"; "keep it pretty"; then "rally stages should be SET, other events might need procedural"; "silly names")
- ENGINE: lab.js ghostSegment(sub, i): the loop is closed by ONE invisible segment (out of the lookup grid, skipped by the querySubtrack
  hint, not drawn — render.js sidAt 'ghost' in spans + edge lines). Start line stays d 0, so timing / grid / lineRun / resets unchanged.
  Post-passes are now finishLevel(lv) (tape + knockable signs) for generated levels. New surface PACKED SNOW (mu 0.36; tyres = snow).
  New props: rock (solid; grey / red desert, snow caps), crowd (spectators), tree pal 'dry' + snow caps. sub.noLines: no edge lines.
- src/stagegen.js: a self-avoiding road (straights, sweepers, mediums, chicanes, squares, hairpins) inside the FLOOR box, SPACE-SEEKING
  (best of 6 candidates by free space at + ahead of the end) with backtracking; stop zone (backs up until one fits); run-up 45 m; tyre
  walls at both ends. Themes FOREST gravel / ALPINE tarmac (armco, rocks, ice in hairpins, broken patches) / SNOW packed snow (ice
  patches, snowy pines) / DESERT dirt (sand patches, red rocks, scrub); every corner chevrons + bales/armco + apex cones + flags,
  hairpins tyre walls + tape + crowds, crests / JUMPS with boards + crowds, marshals, sponsor boards, gantries, service park.
  tools/stagegencheck.mjs (36 combos x 5 seeds): short / medium reliable; long 2.0-2.7 km in the 520 m box (LONG = 2.4 km target).
- SET STAGES (8, tools/stageseeds.mjs picks; attempt 0 so each rebuilds in ~5-35 ms at boot), after Killder: Llanfairsheepdip,
  Pen-y-cowpatt (forest), Col de Fromage, Mont Brakefade (alpine), Ikeaflatpack, Brrrmeatballen (snow), Sahara Sandpants, Wadi Dusty
  Bin (desert). The STAGE GENERATOR card (theme / length / corners / seed / NEW STAGE, road map) stays for test mode + other events.
- AI (aidrivecheck, new stage mode start -> finish): all 8 finish; hatch realish 106-204 s, 0-11 s off. KNOWN: the Rally AI goes well
  off on a few (Llanfairsheepdip ~1453 m, 18-31 s; Col de Fromage 26 m @537 Real; Pen-y-cowpatt 15 m @309 Real) — random, not in every
  run; same family as the accepted Sweaty Lamb wildness. Loose objects per stage ~700-1750 (tape posts + tyres): perf to check.

## HIGHWAY TO HULL — the endless motorway (user, 2026-10-05: "an infinite highway level with procedural turns and terrain")
- src/highway.js: a ~1.6 km road WINDOW (AHEAD 1100 / BEHIND 450 m) grown ahead and dropped behind every ~300 m; each rebuild is a new
  subtrack closed by ghostSegment. stepHighway returns how far the window start moved; main.js shifts lastOnTrack / trackD by it.
  Straights / sweepers / bends steered back toward the base heading (cannot cross itself); biomes farm / forest / rocky; armco on
  bends, gantries every 3 km, silly signs every 700 m, hump hills. 3 lanes of dashes phased by sub.sBase. HUD DISTANCE + BEST
  (localStorage rac3r.hwbest). Solo only (VS AI marked SOON).
- WORLD SIZE per level: lab.js FLOOR / FENCE are `let`, set in setLevel from LEVEL.floor (highway 100 km). BASE_FLOOR = 260 is what
  stagegen.js builds in (so a stage generated while the highway is current is unchanged). marks.js follow() re-centres the skid layer.
- ENDLESS GUARDS (MEASURED 2026-10-05): buildInclusions' FLOOR-wide 6 m scan (~1e9 cells: froze the Test Mode menu, node out of heap)
  -> skipped when LEVEL.endless; drawFence along the 100 km edge (55-105 ms frames) -> skipped, as are drawRunoff / drawKerb.
  After: tools/highwaycheck.mjs 10 km bounded (props <= 247, bumps 8, barriers 6, rebuild <= 15 ms, 0 s off); browser 16.7 ms median
  frames at CPU x1 (Thruston the same); at CPU x4 p95 ~100-150 ms at 210 km/h = tile painting (getImageData palette snap), not the road.

## HIGHWAY v2 — THE TREADMILL, step 1c.1 (user, 2026-10-05; spec + decisions in TODO.md 1c). v1 kept in _archive/pre-treadmill/
- UP THE SCREEN, camera FIXED / upright (user's choice): the heading stays within cfg.maxDeg of straight up (-y) — motorway 60,
  interstate 45, dual 60 — so the road always climbs the screen and cannot cross itself. A curve turns back toward up once past half
  the limit; its turn is capped by the room left.
- SMOOTH JOINS: every element is a CLOTHOID (curvature 0 -> k linear ramp, hold, ramp -> 0), so heading AND curvature are continuous
  at every join. K_RATE 5e-5 /m caps how fast curvature changes. MEASURED: with a 30 m minimum ramp the dual's R 120-200 bends jumped
  5.7e-4 per 4 m step and the bench driver ran wide out of an S-bend (2.5 s off at 4.5 km); with K_RATE all 3 presets 0.0 s off over
  10 km, max jump 2.0e-4 per step.
- LANES ARE CONFIG (HW_PRESETS: lanes, laneW, shoulder, edge, maxDeg, radius ranges, mix): motorway 3 x 3.65 + 3.3 m hard shoulder
  (14.9 m; solid line sub.laneSolid), interstate 4 x 3.7 (19.0 m), dual 2 x 3.4 (8.0 m). laneGeo(cfg) gives width / lane centres /
  dash and solid offsets. ?hw=interstate|dual tries a preset. Flavour levels (canyon...) = a new preset + createHighway(seed, preset).
- TREADMILL CAMERA (render.js follow): on LEVEL.endless the lead is NOT the velocity but highway.js camDir (the chord over the next
  ~60 m of road) x 0.26 of the view height, capped sideways at 0.2 W — the car sits ~3/4 down the screen, the road ahead above it.
- WINDOW: road kept >= 300 m behind (SPAWN_S 40 -> 300: at 40 the raw road start was inside a zoomed-out view) and 1100 m ahead; the
  view is <= ~170 m. Rebuild <= 4 ms (node). World FLOOR 1e6 m (the road drifts up ~0.8 km per km; 1000 km before any edge).
- THE GUARD (highwayGuard -> main.js): rolling back > 3 m/s for 1.2 s, or 30 m behind your furthest point -> 'WRONG WAY — RESET';
  35 m past the road edge -> 'OFF THE MOTORWAY — RESET'. Put back in the LEFT lane 6 m short of the furthest point, facing up the
  road, rolling at max(15 m/s, 60 % of your speed), repaired, HUD notice. treadmillcheck: fires 1.7-1.8 s into a reverse, all presets.
- TOOLS: tools/treadmillcheck.mjs [km] [car] (node: geometry, window, guard, per preset); tools/treadmillshots.mjs [preset] (browser:
  the car's on-screen extent over a drive + photos + the reverse notice).
- ROUND 2 (user phone feedback, 2026-10-05):
  - LEAN BIAS ("it always aims diagonally LEFT"): MEASURED tools/headingcheck.mjs — the old rule only turned back past half the limit,
    so the road sat on one side for km (live seed LEFT -16..-58 deg from 0.5 to 4.5 km; seed 7: 69 % left, one 12.9 km run). Now a
    TARGET LEAN that alternates sides (35-100 % of the limit, held 0.5-1.6 km). After, 4 seeds x 4 presets x 30 km: left/right 29-54 %
    each, mean lean within +-6 deg, longest one-side run 1.8-4.0 km, 19-30 side swaps.
  - GOING WIDE ("wider / a timer to return"): 8 m past the edge starts a 6 s HUD countdown "BACK TO THE ROAD n" (back = cancelled);
    only 70 m out resets at once. treadmillcheck: 20 m out -> reset at 6.00 s; back after 3 s -> cancelled.
  - WALLED preset (user: "some levels should be more walled in"): cfg.walls = a continuous barrier kind both sides (concrete 'wall',
    1.2 m off the edge, 120 m pieces dropped behind with the rest), no armco runs.
  - ROAD TYPE row in Test Mode setup (lv.roadTypes; MOTORWAY / INTERSTATE / DUAL C/WAY / WALLED) -> launch opts.road ->
    setHighwayPreset (bumps lv._layout -> sub.layoutId so cached ground tiles repaint). Photographed: shots/look/tm-setup-port.png.
- LOOSE ROADSIDE (user, 2026-10-05: "as it's open sided, be littered with tyres and cones and have appropriate chevron signs for the
  corners"). Open presets only (walled: none). highway.js dress() puts KNOCKABLE cones.js objects (the same cone / tyre / tyrestack /
  chevron as every other level: topple, roll, burst, chevrons flat after 2 hits) on the verges, each tagged _s = its road distance:
  - CHEVRONS: outside of every bend tighter than R 650, one per 48 m, 4.5 m off the edge, arrows pointing into the turn.
  - LITTER: lone tyres / cones on both verges (0.8 per 10 m, 15 % of the left ones on the hard shoulder); DEBRIS SCATTERS of 4-7
    (~1 per 130 m, photographed: lone 0.8 m tyres barely read at treadmill zoom); a stray tyre-stack pile (~1 per 900 m); and a
    CONE TAPER closing the hard shoulder every 1.6 km. Never in a driving lane.
  - STREAMING: the first window goes into lv.cones (cones.js reset() reads it, so RESTART rebuilds it). Later stretches queue in
    _hw.looseNew; main.js hands them to game.cones.spawn() and, when the road window drops points behind, game.cones.cull() drops
    every object with _s behind the window (a tyre knocked up the road goes with the stretch it came from; burst tyres inherit _s).
  - Own RNG stream (_hw.lrnd): sharing the road's rnd made each litter tweak re-roll the road shape (it moved the dual preset off the
    bench line). Road shapes are back to exactly the approved ones.
  - MEASURED treadmillcheck 10 km x 3 open presets: 1065-1261 placed, 7-101 chevrons (dual bends most), 0 on the inside of a bend
    (checked from GEOMETRY + the arrow direction, not the curv field), 0 in a lane, max 215-237 live, cones.step + stream 7-8 us/step.
    In view (+-85 m): 9-32 objects. treadmillshots motorway: fps 55-60 phone portrait, no page errors.
  - Not mine, still open: tools/objcheck.mjs "killder 1067 objects at rest: 6 moved" FAILS with or without this change.

## START GRIDS (user, 2026-10-05: "grid starts are wonky / player too close to other cars / not in a grid formation")
- MEASURED (tools/gridcheck.mjs, 5 AI, 8 levels): slots out of order (slot 2 at 4.5 m back, slot 1 at 9 m), pole on the CENTRELINE with
  its neighbours 1.0-1.6 m away box to box, and on the Test Track the player's pole stayed on the spawn while the grid counted back from
  totalDist - 15 -> YOU overlapped AI 5 (-0.07 m). On pole the player was never moved onto the grid at all (gridSlot > 0 check).
- NOW (main.js gridPos): every slot, pole included, counts back from the SPAWN's road distance, GRID_STEP 7 m per slot, alternating
  columns GRID_LAT 3.2 m either side (narrower on narrow roads); the player is always placed on their slot. After: slots in order,
  closest pair 3.3-5.4 m on every level, no overlaps; startcheck all OK (standing + rolling). aifieldcheck Thruston hatch Realish x6
  seed 7 1 lap, old vs new grid (GRID=new): START contact events 13 -> 1, contact 15.3 -> 7.9 s, passes 10 -> 12 (one seed).

## HIGHWAY AI v2 — THE WEAVER + EVENT RULES + PODIUM (user, 2026-10-06: "ai on highways should ignore lanes and go fast dodging traffic and weaving thru like the player would"; "rules to events should be explained the first time you do them, walk-thru style"; "podium looks broken, just use normal top down cars")
- src/hwrace.js createHwDriver v2: no lanes. Every 0.08-0.22 s (aggression) it scores 11 lateral lines across the carriageway (EDGE_M 1.8 m inside each edge; hard shoulder -8) by free road: unblocked = vAl x LOOK_T 3.2 + 60; blocked = min(gap, vAl x LOOK_T) + 1.2 x blocker v; a car beside us blocks every line on its far side (-999). Cost: swerve distance x (1.5 + 0.05 v) from the PLAN (st.base) + 0.3 x from where the car is; +25 for staying on the plan; reach cap 14 - 0.17 v m; -400 if a swerve's mid-point is occupied. Blocker half-width = both half-widths + margin (0.55 + 0.25 x (1 - prec)) + 0.04 x closing speed.
- The target line has inertia: sideways speed ramps at 0.18 mu g (0.30 urgent), max LAT_R 3.0 m/s (x1.6 urgent). Wander is added on top of the plan, not folded into it.
- Steering: Stanley on the COURSE angle (velocity, not heading), + the swerve's feed-forward, - 0.12 x (yaw rate - road yaw rate), - 0.02 x lateral-speed error, heading-to-road capped at 4/v rad, counter-steer 0.9 x rear slip above 0.08. Throttle capped by turn rate (x (1 - 0.6 turn)). Front-axle frame from the car's own frame + heading (a 2nd roadFrame search snapped to the wrong point).
- MEASURED failures, each fixed in turn (tools/weavecheck.mjs, NEW: 45 scenarios per difficulty): edge 1 m -> grass at 227 km/h; instant sideways step -> spins at 150 km/h; plan costed from the car's position -> drifted into the car it was passing; a 6-point commit bonus -> line flip-flop every 0.2 s; an extra aim term -> spins in 17/45; 7 m jumps at 240 -> 18 deg to the road; heading not course -> 0.5 m steady drift in bends; full throttle mid-swerve (Real) -> rear slip 0.3-0.8. Final: diff 0-4, 0 hits / 0 spins / 0 > 1 m wide (diff 2: 4 at exactly 1.0 m). hwracecheck motorway d2/0.6, d4/1, dual d0/1 ALL OK, 0 off-road.
- KNOWN, user test note same day: "slow, waits, doesnt weave around traffic". Leads (one trace): kC cut to 0.33-0.42 caps the bends near 170 km/h; following law vT = B.v + room x 0.7 drops to 29 km/h behind 100 km/h traffic; the reach cap + commit bonus + mid-point veto keep it boxed. Neither tool measures PACE yet. -> HANDOVER.md 3.
- guide.js RULES decks (highway 5, endless 3, race 3, rx 2, stage 2) + openRules(kind); main.js eventKind() + rulesPending (after HOW TO PLAY, after the fly-in, sim paused); localStorage carsim.rulesSeen; ?rules=1 / 0; pause menu EVENT RULES. tools/rulesshots.mjs: lights clock 1.92 s when the rules opened, 2.28 s 350 ms after the last card closed (the tool cannot tell if anything ran while a card was open), no page errors at 390x844 / 844x390. guidecheck 10 cards OK at 6 sizes.
- Podium: api.carSprite(spec, null, true) = pixelCarWithWheels, rotated nose up, 2x CSS (was the body-only sprite squashed into 40 x 64).

## HIGHWAY AI PACE — MEASUREMENT (2026-10-06, no behaviour change)
- `tools/hwracecheck.mjs [s] [diff] [traffic] [preset] [seed]` now prints PACE per racer from green+5 s: mean / min km/h, % under 130,
  free-road mean (no traffic 150 m ahead), % stuck (traffic < 40 m ahead in path, not 15 km/h quicker), traffic passes per km, and what LIMITS
  the speed each step (follow = the follow law under the corner cap and v at target; emerg = brakeX; corner; feather = throttle at thrCap; full).
  While following: is it a racer or traffic, gap, an open line > 2.5 m across, and a > 10 m better line passed up because of reach / mid / cost.
- `src/hwrace.js`: `HWT` = JSON from env `HWT` in node, `{}` in the browser (defaults = the old constants, re-measured identical).
  Knobs: kC kCp kB (corner), aB (follow decel share of mu g), wt (follow time gap), fl (follow floor x B.v), rk, mcap (closing-speed margin cap),
  tn (turn-feather grip share), thr (throttle floor), step (head for out-of-reach lines in reach-sized steps). `st.dbg` / `st.why` / `st.free`
  are read by the tools only. `tools/_freeroad.mjs` = one weaver on an empty road.
- MEASURED: corner cap limits < 3 % of the time; following 12-72 %; empty road: turn feathering 63-96 %. Baseline fails off-road on seeds 77 / 1234.

## HIGHWAY AI — THE MIRROR (2026-10-06, live)
- `hwrace.js createHwDriver`: `mirror(off)` = true if a car within 60 m behind (or alongside) and CLOSING would reach us inside `mirT` s
  (HWT.mir, default 2.5) and its body + margin overlaps `off`. In the line choice a swerve > 1.2 m is costed -400 if the target or its mid-point
  is mirrored (as the existing mid-way block). A swerve already moving (|tv| > 0.2) is ABORTED (base = where the target is now, re-think in
  0.05 s) when the side it moves to is mirrored (HWT.abort, default 1). Cause: traced seeds 77 / 1234 / 555, racers swerved into a faster racer
  coming from behind; the follower braked on the shoulder and spun.
- `tools/pacesuite.mjs [label] [s]`: hwracecheck x 3 seeds x d0/d2/d4 in parallel -> one table (pace + contacts + off-road + BAD runs);
  `PSEEDS` overrides the seeds. MEASURED, 18 races (seeds 4242 77 1234 31 555 9001): bad 7 -> 2, off-road car-steps 13079 -> 4006,
  mean 126.7 -> 133.4 km/h; racer-racer contact steps 757 -> 864. weavecheck unchanged.

## HIGHWAY AI — FASTER (B) + VERGE DODGE (2026-10-06, live)
- New defaults in `hwrace.js` (all still `HWT` knobs): throttle floor `thr` 0.85 (was 0.6); corner share `kC` 0.42 + `kCp` 0.12 x prec
  (was 0.33 + 0.09); follow decel `aB` 0.55 x mu g; `tx` 1 = turn feathering counts only yaw BEYOND the road's own bend, `tn` 0.8;
  `pred` 1 = a lane-changing traffic car (`traffic.js` read-only `car._trOff`) blocks its target lane too; `verge` 1 = two extra lines
  `vgm` 0.9 m inside the tarmac edges, only where |curv| < 1/1500, never walled / held, cost `vgc` 40, capped `vgv` 8 m/s over the car
  passed. MEASURED pacesuite 18 races: mean 133.4 -> 138.2 km/h, under 130 40 -> 35 %, bad 2 -> 1. weavecheck: 1-2 of 45 clip at
  150 km/h (accepted, user: "racing not a sunday drive"). REJECTED: verge lines 0.4 m from the edge on any non-outside bend (V1-V3):
  5-7 of 9 races with cars far off-road.
- pacesuite BAD now counts FAR off-road (> 3 m past the edge: `hwracecheck` "far off"), not touching the verge, which the dodge does on purpose.

## HIGHWAY FURNITURE — SLIPS, BRIDGES, CAMERAS, DEBRIS (2026-10-06, live)
- `highway.js extras(lv, i, s, at, mk, R)` from `dress()` (not walled): OFF-SLIP every 2-4 km where |curv| < 1/900 from 60 m before to
  150 m after: a `lv.lanes` tarmac ribbon (lab.js laneAt, render drawLanes; starts 2.6 m INSIDE the edge so its round end hides under
  the road) + prop 'slip' (render drawSlip: edge lines) + 'slipcount' posts + a blue 'board' (pr.blue) + a 'gate' (solid). BRIDGE every
  1.1-2.4 km: prop 'bridge' carries road / rail / foot (OVERHEAD, drawn after the cars; abutments solid, out past hw + PIER) or prop
  'river' (ground, drawn before the cars, water clipped at the parapets via pr.skew / pr.roadHw; 'wall' barriers both sides). Extras at
  1/6: cow, cone, boat; 'solarfarm' rare. `lanes` are dropped behind with the window and cleared on reset. tools/_slipcheck.mjs.
- `speedCamera(lv, car)` after stepHighway: a gantry crossed this step (road distance) at > CAM_MPH 70 -> { kmh, mph, fine = 100 + 10
  per mph over, x2 past 100 over }. main.js keeps game.camCaught / camFines / camCount, localStorage `rac3r.cams` {count, fines, fastest};
  hud drawCamera (flash + card; landscape: left column). tools/_camcheck.mjs, tools/_camshots.mjs.
- v2 (2026-10-06, live; supersedes the first bullet where they differ): `extras(lv, i, s, at, mk)` runs on EVERY preset and draws from
  `st.xrnd`; the road SHAPE (nextElement) draws from `st.grnd`, dressing from `st.rnd`, loose litter from `st.lrnd` (all seeded off
  lv.seed). Slip `type`: short (25 %: 150 m + gate) / long (50 %: 300-420 m, bends 18-40 deg away, gate; `addCut`) / side (25 %:
  `st.side`, built per road point by `sideStep` — P[i].sideOff = its centre's offset LEFT, P[i].gapL = no left wall / armco there;
  ~100 m `lv.lanes` pieces + edge-line 'slip' props with nose:false, flushed by `sideFlush`). Bridges: `approaches()` = 2 lanes of
  APP_LEN 150 m along the deck axis (tarmac 7 m / gravel 5.5 / dirt 2.4); `pr.appL` = their lengths after cuts, `pr.reach` widens the
  render cull; render drawBridge draws lines / rails and the movers from `performance.now()` + `pr.phase` (cars both ways, walkers,
  a train per `pr.trainEvery` s). River: `river()` = per side one 'wet' cover in `st.covers` (lv.covers via `syncCovers`, new array so
  render re-merges) with `cut {ox, oy, tn, e}` = the dry band under the motorway (lab.js `coverCut`, used by coverAt AND render
  coverCells) + dirt bank zones (lv.zones, dropped with the window). `st.keep` = scenery keep-out rects (`keepOut` also deletes trees /
  rocks / barns / solar farms already there); `st.cuts` = long things cut short by any later road point within reach (`cutBy`).
  highwayGuard: on the side road out = 0; out > OFF_SOFT on tarmac (any lane) holds the countdown and the reset reads "EXIT TAKEN —
  BACK TO THE MOTORWAY". render coverCells scans the rotated box's extents (was a square of the long side). Node-only `HWNOX=1` = no
  extras. Tools: _slipcheck (+ no water / no lane on the motorway, side road tarmac), _guardtest, _bridgeshots2.
- highway SCENERY v2 (2026-10-06): `fields(lv, i, at, clear, biome)` per road point, farm biome only, not walled; stream `st.frnd`.
  Per side a field every 75-150 m of road, 1-2 rows deep, starting hw + 11 (right) / hw + 25 (left, past the side road band): a ROTATED
  zone {surface = physics, art = look (render SURFACE_ART wheat / rapeseed / plough; painted in the field's own frame so the rows run
  along it)}, two `hedge` barriers (BARRIER_HALF 0.7: the car AND loose objects bounce off), trees in the far hedge, bales / beasts /
  barns by type. `village()` every 3-7 km: a 5 m tarmac lane ~40 m out, `block` houses (house / church flags). Every piece carries
  `field: id`; its keep rect too. REVISED same night (user): NO hedge barrier - a `grassLong` zone HEDGE_W 2.5 m bigger all round, listed
  AFTER the field (first zone wins), look `hedgerow`; looks are existing textures recoloured (render.js `recolour(id, base, cols)`);
  plough = mud. WEAR on the endless road: lab.js `pruneWear(x, y, far)` after each rebuild drops cells > far m away or whose clean ground
  (`cleanAt`) is no longer what they were worn from. hwrace CATCH THEM: a cancel stores cd (`cdLeft`); due again it resumes at
  min(HW_CATCH, cdLeft + time away); GRACE 2 s keeps a running clock through brief drop-outs; a gap jump > 8 m re-seeds gapRate. `keepOut(k)` with no field id calls `clearFields` = drop every field it overlaps, whole. `roomFor`
  = no keep overlap + 9 rect points clear of the road. zoneAt: rotated zones reject on radius, trig cached (q._r/_co/_si).
- `cones.js DEBRIS` {mass, r, breaks, into, flat}: distinct impacts 0.6 s apart (one pass shoves it ~0.4 s); at `breaks` with rel > 2
  m/s -> its flat BROKEN kind (out of all collisions, drag 7). Tarp: never solid, dragged 8 %/step by a car over it. Placed by the
  highway litter (~45 % of litter, 40 % of scatters). tools/_debrischeck.mjs, tools/_debrisshots.mjs.

## HIGHWAY JUDDER — GROUND TILES (2026-10-06, live; user: "judder on mobile on infinite levels - guess thats as chunks load")
- MEASURED (new `tools/hwjudder.mjs` = per-frame interval / sim / draw / tile / window-move log, `tools/hwprofile.mjs` = CDP sampling
  profile; highway, phone landscape dpr 3, CPU x4, the player driven by the weaver at 130-240 km/h): the road window moving
  (stepHighway, ~2 ms) is NOT the judder. GROUND TILES are: ~10 a second scroll in at speed, each 45 ms. Inside a tile: paletteSnap's
  getImageData (a GPU readback, ~half) and hillShade's up to 4096 fillRects with a fresh rgba() string each (~a quarter).
- Fixes (render.js): tiles drawn + snapped on a CPU scratch canvas (`willReadFrequently`), the snapped pixels put once into the tile's
  own GPU canvas (a CPU tile canvas alone halved the tile but re-uploaded every tile every frame: drawImage 4.8 -> 11.4 %). hillShade
  gathers its cells into one path per shade (~9 fills, not thousands). `?tilegpu=1` = the old tile path, for A/B.
- Same pixels: new `tools/tilediff.mjs` (render.js `debugTile`) vs the old path: highway 0.00 % px differ; Test Track 4 % of pixels by
  1 / 255 (blend rounding), none by more.
- Result, ai 0 traffic 0, 20-30 s: tile 45 -> 17-19 ms; p95 frame 100 -> 33 ms, p99 117 -> 67 ms, frames > 40 ms 122 -> 34-71.
  test-track framecheck (CPU x4): tile 19.3 -> 13.9 ms, frames > 33 ms 57 -> 58 (circuits are not tile-bound).
- STAND-IN: the level overview (painted once at the start) under missing tiles was the FIRST road window, so after ~1 km a missing tile
  showed a dark "nothing" square. Now on an endless level it is repainted (512 px) every 500 m of road, and the fill under it is
  the level's base colour (grass). hwjudder: frames with the car outside the overview 137 -> 0.
- STILL HEAVY: with 5 AI + traffic at CPU x4 the SIM is the cost (sim 26 ms / frame, median frame 35 ms): stepAI 23 %, applyGround
  15 % (bumpAt -> slopeAt does ~22 height lookups per car per step, each with a querySubtrack because the highway has camber).

## LAB EXTENSION — CRASH LANES + OFF-ROAD AREA (S-B, 2026-10-07, live; user: "some of every object laid out nicely ready to crash into", lab "1k", "off road test area with some test hills grass and dirt with active terrain")
- The lab floor is a RECTANGLE: `lab.js LAB_BOUNDS {x0 -260, x1 260, y0 -260, y1 740}` -> `FX0/FX1/FY0/FY1` + `edgeOut(x, y)`; kerb, run-off,
  fence (`fenceClamp`), render.js drawRunoff / drawKerb / drawFence and cones.js clamps all read it. Other levels keep the +-FLOOR square.
- CRASH LANES y 296..520: `LAB_LANES` = 17 lanes (every SURFACES id but kerb), 11 m wide, x -245..215, pitch 14 m, boxed zones (no blend /
  inclusions). Drive WEST -> EAST; `laneObjects` lays one object kind per lane from x 168 (19 kinds: thickMud = exhaust + bumper, packedSnow =
  chevron + flag). 156 objects. Boards label each lane. Wet lane = a puddle cover over tarmac (dries where driven, like the wet panel).
- OFF-ROAD AREA y 548..732: `LAB_OFFROAD_ZONES` (grass, long-grass meadow, mud bog + thick-mud core, sand, gravel, a dirt loop + a dirt jump
  straight) + `LAB_OFFROAD_BUMPS` (ramp, table top, hills 1.6-5 m, whoops, two hollows, washboard). Natural terrain (NAT_SURF) on grass / dirt /
  mud / sand; all of it wears.
- Checks: `tools/_labcheck.mjs` (old square identical to `shots/look/sb-base/lab-ground.json` from `_labbase.mjs`; coverage; edges; off-road;
  other levels) ALL OK. `tools/_labshots.mjs` (photos `shots/look/sb-*.png`, cone + banger hits) ALL OK, 56 fps both sizes, no page errors.
  Regression suite (`sb-base/` old vs new-*) unchanged; blendcheck's 5 us Sandbox FAIL was already failing before.

## COWS + SHEEP (S-C, 2026-10-07, live; user: "Sheep can be like a tyres impact weight but burst into white particles / [cows] solid and heavier more like hay bails"; "no gore ... sheep explode into white fluff over like 30mph ... cows tip over 40mph")
- Field animals were `kind: 'beast'` PROPS (scenery, not solid). Now LOOSE OBJECTS (cones.js) kinds `sheep` / `cow`: highway.js `fields(..., loose)`
  pushes them into the loose stream (lv.cones / st.looseNew, `field` id kept). `clearFields` drops a cleared field's waiting animals and adds
  its id to `st.goneFields`; main.js culls the live ones (`game.cones.cull`).
- SHEEP 12 kg, r 0.55, rest 0.2: hit above `SHEEP_POP_V` 13.4 m/s -> kind `fluff` (BROKEN set: flat, drive-over) + 5 `fluff` hits -> render.js
  `FLUFF_PUFF` white cloud. COW 250 kg, r 1.0, rest 0.1, car impulse cap 8 (as a bale): hit above `COW_TIP_V` 17.9 m/s -> `tipped` (still solid;
  drawn on its side, legs out). Drag: cow 6.5 (heavy), sheep 4.5.
- Lab: grass lane = cow + crate, long-grass lane = sheep + bin (animals first). `_labcheck` KINDS = 21.
- Checks: `tools/_animalcheck.mjs [src]` (one animal alone, car driven through at 30/70 and 40/90 km/h; highway stream + cleared fields) ALL OK;
  `tools/_animalshots.mjs [base]` photos shots/look/sc-*.png, 60 fps, no page errors.

## MUD TRACKS + MARKS LAYER EDGE (2026-10-07, live; user: tracks on mud "vanish or morph weirdly as the surface gets degraded to thick mud"; Knobhill top-left marks "cut of ... in a clean line")
- THICK MUD has its OWN mark, `MARK_THICK_MUD` (lab.js; 34,23,15 @ 0.17). Before, it shared MARK_MUD (58,42,30), which is thick mud's own ground colour (#3a291d), so tracks were never removed, they went invisible on the cell they had just worn. Measured by tools/_mudtracks.mjs as `markDark`, how much darker the marks make the ground under the wheel line: before 9 / 11 / 7 / 8 (passes 1 / 2 / 4 / 6), after 9 / 11 / 16 / 20.
- THE DIP was already real and is unchanged: RUT in lab.js, mud +2.5 cm a pass (cap 15), thick mud +3 cm (cap 22). Measured 2.5 / 5 / 11 / 17 cm over passes 1 / 2 / 4 / 6, in bumpAt so the suspension and hill-shading both see it.
- marks.js `follow()` now returns early when the level's fence (FX0..FX1, FY0..FY1 + RUNOFF_W) fits inside MARK_EXTENT and the layer is still at the origin. Before, every level slid the 604 m layer once the car was past 136 m, cutting off marks on the far side in a straight line. Still follows: the endless highway, and the 1000 m-tall lab (it does not fit, so marks far south of the old square can still drop). tools/_markedge.mjs: a test mark goes 79 -> 5 alpha before, 79 -> 82 after (Knobhill), and 79 -> 79 (Slidden Hill).

## AI ROUND 1 � NEVER WAIT + DRIVE OUT + INCIDENTS (2026-10-07, live; the AI design chat, TODO "AI DESIGN NOTES")
- INCIDENT (user: "a full crash or well off track, rubbing is racing"): tools/aifieldcheck.mjs counts WELL OFF (centre > INC_OFF = 4 m past the edge, once per trip), SPIN (> 70 deg slide above 5 m/s, once per 3 s), BIG HIT (a NEW touch at > INC_HIT = 6 m/s closing) and RESET. aifieldsuite prints "INCIDENTS diff d: n in 24 races = x per race".
- NEVER WAIT (aidriver.js): held-up time before an attack 0.15-0.6 s (by aggression), commit chance 0.6 + 0.4 x aggression, tow pass after 0.3-1 s; push x (1 + HARDER 0.03 x min(1, behindT / 4 s)). Cover chance = (0.5 + 0.5 x prec) x defence.
- DRIVE OUT (aidriver.js, top of drive): v < 1.5 m/s for DRIVE_OUT_T 1.2 s after the green -> { reverse: 1, steer toward the line heading } for 1-1.5 s. 3 tries in 15 s -> state.giveUp -> main.js stepAI resets it (as stuckT > 3 still does). relocate() clears it.
- MEASURED per race (24 x 6 cars x 3 laps, DMG=1): Mobile 2.8 -> 5.4 incidents, passes 183 -> 221; Real 6.2 -> 6.4, 182 -> 235. Budget (easy 10+, hard <= 5) NOT met. Hard > easy even before. REVERTED: mistake 0.32 / 0.18 on easy + less late-brake and a wider gap alongside on hard (Real -> 7.0).
- tools/_aismoke.mjs [base] [levels]: the real game with 5 AI, no page errors on knobhill + highway.

## PAUSE SOUND + JOKER LINE (2026-10-07, live)
- menu.js pause: SOUND slider (0-100, step 5) + MUTE/UNMUTE when act.audio is given (main.js openPause passes audio). audio.js loads/saves rac3r.vol + rac3r.mute in localStorage; masterGain starts at 0 when muted.
- main.js JOKER: jokerLine(J) = the lane tangent at the point nearest the gate, half = lane.width / 2 + JOKER_SPAN (8 m). crossedJoker(J, px, py, x, y): the step's segment crosses the line within half of the gate AND the crossing point is > JOKER_ROAD (1 m) past the circuit's edge. Player: once per lapState.lap (game.jokerLap); AI: once per lap of c._prog. Falls back to the old circle if a level has no lane. window.__game.crossedJoker for tools/_jokerline.mjs.


## AI ROUND 2.1 — ONE AI DRIVER (2026-10-07, live; user: "same ai", shape A; CLAUDE.md ONE SYSTEM NOT TWO THEN ONE)
- `src/aidriver.js createAIDriver(level, traits)` is the ONLY racing driver. Circuits: the racing line + speed profile, as before.
  `level.endless` (the highway): `roadDriver(lv, traits, rnd)` in the same file = the old hwrace.js WEAVER, moved unchanged (11 scored
  lateral lines, mirror, verge dodge, curvature speed, Stanley on the road frame from highway.js `roadFrame / roadPose / roadSpan`).
- `driveOut(st, car, v, dt, ctx, rnd, roadH)` is shared: under 1.5 m/s for 1.2 s -> reverse 1-1.5 s, wheel toward the road heading; 3 tries
  in 15 s -> `st.giveUp` -> main.js `aiReset`. NEW on the highway (it had none). `NOOUT=1` (node only) switches it off for A/B.
- `src/hwrace.js` keeps the race only: `hwFrames`, `hwGrid / hwGridSpan`, `hwPutBack`, `createHwFlow` (CATCH THEM / PULLING AWAY), `HW_*`.
- The highway rolling-start pace driver (main.js armStart) is `createAIDriver(LEVEL, aiTraits(4, 0, 1))` on endless levels.
- traffic.js unchanged. Tools: weavecheck / hwracecheck / _freeroad / _catchreal / hwjudder / hwprofile / hwwobble / _dirtroad use createAIDriver;
  `tools/_hwdriveout.mjs` = beached highway racer recovers (ALL OK). Numbers: TODO.md "R2.1 MERGE BUILT".
- KNOWN (measured 2026-10-07, not yet fixed): the JOKER branch (`branch()` / `branches()`) is the lane centreline glued to the racing line
  with 15-35 m of smoothing, so each join is a tight kink (Knobhill R 18-19 m, Slidden R 21-27 m) and the AI exits at ~half the planned
  speed; on the branch `latLim` is 2 m, so it tracks the path within ~1 m. `tools/_jokerexit.mjs` shows it. Fix = R2.J (TODO).

