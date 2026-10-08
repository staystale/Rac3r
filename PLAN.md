# PLAN — Slice 1: THE LAB

**Goal:** an empty white test floor with one base hatchback and some cones. It drives, it feels good, and it
leaves tyre marks that are *accurate to what the car is actually doing* — lock-up under hard braking, arcs
under a drift, rear-only under the handbrake. Nothing else.

This is the feel box. Everything in `BRIEF.md` after it (garage, pips, tracks, rivals, money) is built on top
of the numbers this slice produces, so those numbers have to be measured, not guessed.

**Read before starting:** `CLAUDE.md` in full, **especially §8**, then `BRIEF.md`. This plan assumes both.

---

## Decisions already made (do not re-open without asking)

| Decision | Answer |
|---|---|
| Platform layout | **Detect and serve both.** One responsive layout with a `touch` / `pc` mode; both are maintained forever and both get checked on every layout change. |
| Touch controls | **Floating thumb stick (left) + three pedals (right):** throttle, brake, handbrake. Stick is drag-from-anywhere in the left half. |
| Camera | **Fixed north-up, follows the car**, with a small lead in the direction of travel. World never rotates (keeps nearest-neighbour pixels crisp). |
| Handling target | **Grippy, drifts on provocation.** Holds a line when driven properly; the rear steps out on handbrake, a throttle stab mid-corner, or a lift. |
| Physics | **Hand-written vehicle model. No Planck.js / Box2D.** (`CLAUDE.md` §8 says why.) |
| Cars in the lab | **Five, in one data table, with a selector** — front, rear and four-wheel drive all testable back to back. See *The roster* below. |

## Amendments — written 2026-09-27, before Step 0

The user said: *"Make any changes you see fit that will cause issues later first"*, and *"make sure graphics
are cute realistic detailed and clear"*. Seven gaps in the spec above, each one a thing that would have had to
be unpicked later rather than decided now. **These override the sections below where they collide.**

**A1 — ART DIRECTION CHANGED: no low-res pixel buffer.** `BRIEF.md` §1 asks for "retro 2D pixel art (crisp
nearest-neighbour scaling)" and the Step 0 / `lab.js` sections below implement it as a `320×180`-ish buffer
upscaled by an integer. That is directly incompatible with *cute, realistic, detailed and clear*: at 844×390
the buffer is 422×195, which makes a 4 m car about 40 px long and throws away every detail we would draw on
it. **We render at device resolution instead** (DPR capped at 2), with cars drawn as procedural canvas art —
body, glass, lights, panel lines, steered front wheels, soft contact shadow — not bitmaps. Detailed at any
size, no asset pipeline, and it scales from a 390 px phone to a desktop without a second art pass. The
Step 0 buffer maths and the `imageSmoothingEnabled = false` line below are void, except on the marks layer
blit. *(Reversible: it is one flag in `render.js`. If it looks wrong, say so and we go back.)*

**A2 — `PPM` (pixels per metre) was never specified, and it is the most load-bearing missing number in the
document.** Every sprite size, mark width, camera framing and the "can the player see the corner coming"
question depends on it, and it appeared nowhere. Set **`PPM = 16`** at DPR 1, in ONE exported constant.
That frames 52 m across a 844 px landscape phone and 24 m across a 390 px portrait one — enough to see a
slalom, tight enough that a 4 m car is a clearly-drawn 64 px object. Expect to move it; it is one number.

**A3 — the marks layer resolution is raised 8 → 10 px/m**, because at 8 px/m and a render of 16 px/m every
skid mark is upscaled 2× and reads soft and blocky next to a sharply-drawn car — the marks are the showcase of
this slice and must not be the worst-looking thing in it. 160 m × 10 px/m = 1600², ≈ 10.2 MB backing store
(was 6.5 MB at 1280²). **And every stamp is clamped to the canvas bounds**: outside them the stamp is a
silent no-op, which is exactly the class of failure `CLAUDE.md` rule 1 is about.

**A4 — the floor has a boundary, and it is visible.** The spec says "floor extents" and never says what
happens at the edge. Unstated, the car drives off into infinite white while the marks canvas quietly stops
accepting stamps. The floor is **the same 160 × 160 m as the marks canvas**, with a painted hazard kerb drawn
at the edge so it is legible from inside. Wall collision arrives with the cones in Step 6; until then the car
may cross it, but the kerb tells the player they have.

**A5 — REVERSE was missing entirely, and a cone lab cannot work without it.** `BRIEF.md` §2 maps `S`/Down to
"Foot Brake / Reverse"; `PLAN.md` mentions brake only. The first time the car noses into a cone cluster or the
kerb it is stuck, and that arrives as a bug report. Rule: **brake held for > 0.4 s at under 0.5 m/s engages
reverse**, throttle-from-rest re-engages first. One gear ratio, capped at 8 m/s. Reverse is the same model
with a negative gear ratio — no special case in `vehicle.js`.

**A6 — one `surface` multiplier into the grip term, now.** Friction is
`mu = car.mu * surface.mu * mods.gripLat`, with `surface.mu = 1.0` for the lab floor and nothing else defined
this slice. It is one multiplier and it defaults to a no-op (`CLAUDE.md` rule 6); adding it after the tyre
model is tuned means re-tuning every number in the bench grid against a new surface term.

**A7 — brake force stated in newtons, not as a bias.** "Brake force opposes `vLong`, split 62 % front" plus
"`brakeMaxDecel 1.0 g`" is not implementable as written — the per-axle lock-up test in step 7 needs a force to
compare against `Fmax`. It is: `Fb = brakeMaxDecel * m * g * input.brake`, then `FbF = Fb * bias`,
`FbR = Fb * (1 - bias)`, each compared against its own axle's `Fmax` for the lock-up flag.

---

## NOT in this slice — do not build them
No garage, no pips or upgrades, no money, no track, no rivals, no lap timing beyond a stopwatch, no damage
model, no fuel. The five cars are **a data table and a cycle button**, nothing more — no unlocks, no costs,
no stat screens. If you find yourself writing any of those, stop.

The **`mods` seam goes in from the first line anyway** (`CLAUDE.md` §8): `vehicle.js` reads every tunable
through a `mods` object of multipliers, all defaulting to `1.0`. That costs nothing now and is the difference
between slice 3 being an afternoon and being a rewrite.

---

## Files

```
car sim/
  index.html            canvas + one module script, nothing else
  serve.mjs             static server, no-store, port 8080
  src/
    main.js             boot, fixed-step accumulator, resize, dev flags, window.__game
    input.js            normalized input state; keyboard + touch; pc/touch detect
    vehicle.js          THE MODEL. Knows nothing about upgrades, cones, or rendering.
    cars.js             base stats (hatch) + the default mods table
    marks.js            world-space skid-mark layer + stamping rules
    lab.js              the scene: floor extents, cone layout as data, reset
    render.js           low-res buffer, camera, sprites, marks blit, particles
    hud.js              speed / tacho / gear / shift light, touch overlay drawing, dev overlay
    audio.js            OPTIONAL, last (see Step 6)
  tools/
    probe.mjs           headless physics bench — the instrument. Node, no canvas.
    devshot.mjs         CDP screenshots, 3 sizes × 2 input modes
    overlap.mjs         text-overlap harness (port from ../BitterTrade/_overlap.mjs)
```

Native ES modules, no bundler, no build step. Relative paths only (it has to run from a folder on itch.io).

---

## The model — write it exactly like this

Fixed step **dt = 1/120 s**, accumulated in `main.js`; **never pass the frame delta to the vehicle**
(`CLAUDE.md` §8). Cap the accumulator at 5 steps per frame and drop the remainder, so a background tab does
not produce a 400-step catch-up.

State per car: `x, y` (m, world), `vx, vy` (m/s, world), `heading` (rad), `yawRate` (rad/s), `rpm`, `gear`,
`shiftTimer`.

Per step:

1. **To body frame**
   `vLong =  vx*cos(h) + vy*sin(h)`
   `vLat  = -vx*sin(h) + vy*cos(h)`
2. **Steering.** Target angle from `input.steer`; rate-limit to 4 rad/s; speed-sensitive limit
   `deltaMax = 0.56 rad * (1 - 0.6 * min(1, |vLong|/40))` (32° parked, ~13° at 40 m/s). This single line is
   most of what stops a phone player spinning on every straight.
3. **Slip angles** (guard the divide — `CLAUDE.md` §8, rule 20; `eps = 0.5`):
   `aF = atan2(vLat + yawRate*lf, abs(vLong) + eps) - delta * sign(vLong || 1)`
   `aR = atan2(vLat - yawRate*lr, abs(vLong) + eps)`
4. **Vertical loads** with longitudinal transfer, clamped ≥ 0:
   `FzF = m*g*lr/L - m*aLongPrev*cgH/L`,  `FzR = m*g*lf/L + m*aLongPrev*cgH/L`
   (`aLongPrev` = last step's longitudinal acceleration. One step of lag is fine and is much more stable than
   solving it implicitly.)
5. **Longitudinal force.** Engine torque from the curve at `rpm`, × gear × final drive × 0.9 efficiency ÷
   wheel radius, zeroed while `shiftTimer > 0`. Brakes per A7: `Fb = brakeMaxDecel*m*g*input.brake`, split
   `bias` front / `1-bias` rear, opposing `vLong`. Then drag `-0.38*vLong*|vLong|` and rolling resistance
   `-0.015*m*g*sign(vLong)`.
6. **Grip limit per axle, as a friction ellipse.** `Fmax = car.mu * surface.mu * mods.gripLat * Fz` (A6).
   Longitudinal demand takes
   priority; the lateral capacity left over is `FyMax = Fmax * sqrt(max(0, 1 - (Fx/Fmax)^2))`.
   **This is the mechanism that makes "drift on provocation" work** — full throttle in second eats the rear
   axle's lateral budget, so the tail comes round. Do not fake it with a drift button.
7. **Lateral force:** `Fy = clamp(-Calpha * alpha, ±FyMax)`. `Fy` at the clamp ⇒ that axle is **sliding**;
   record the flag and the slip speed. Under **lock-up** (brake demand > `Fmax`) or **handbrake**, that axle
   uses `muSlide` instead of `mu` and its `Calpha` drops to 30 %.
8. **Integrate.** `ax = (FxTotal - FyF*sin(delta)) / m`, `ay = (FyF*cos(delta) + FyR) / m`, rotate back to
   world, `yawRate += (lf*FyF*cos(delta) - lr*FyR) / Izz * dt`, `heading += yawRate*dt`.
9. **Low-speed blend.** Below 1.5 m/s, lerp `vLat` and `yawRate` toward a kinematic
   (`yawRate = vLong*tan(delta)/L`) result, and below 0.15 m/s with no throttle, snap to rest. Skipping this
   gives a car that shivers and creeps at a standstill and it will look like a bug in the friction model.
10. **Assert finite** on `x, y, vx, vy, heading, yawRate, rpm` every step while `?dev=1`. Throw loudly — a
    silent `NaN` is a vanished car (`CLAUDE.md` §8).

**Powertrain.** `rpmTarget = |vLong| / wheelR * gearRatio * finalDrive * 60/(2π)`, clamped to
`[idle, redline]`; `rpm` chases it at a rate set by drivetrain inertia (first cut: `rpm += (target-rpm) * 12 *
dt`, plus free revving when the clutch is open during a shift). Auto: up at 6200, down below 2600, with a
0.25 s torque cut. Sequential: `Q`/`E` or paddles. Over-rev and stall penalties are **full-manual only** and
are not in this slice.

---

## The roster (`cars.js`) — five cars, one table, starting values to be measured and moved

Every car is the **same model with different numbers**. If a car needs a special case in `vehicle.js`, the
seam has been broken (`CLAUDE.md` rule 6) — the difference belongs in this table.

Shared where not stated: `cgH 0.52`, `wheelR 0.30`, `mu 1.00`, `muSlide 0.75`, `shiftTime 0.25 s`,
`brakeMaxDecel 1.0 g`. `Izz ≈ mass*(len² + wid²)/12`. `drive`: **1.0 = front, 0.0 = rear, 0.5 = four-wheel.**

| id | name | mass | lf / lr | body | drive | brake bias F | CαF / CαR | μ | peak torque | gears | what it is for |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `hatch-fwd` | Hatch FWD | 1150 | 1.10 / 1.40 | 4.0×1.7 | **1.0** | 0.65 | 70k / 76k | 1.00 | 150 Nm @ 4000 | 5 | The honest hatchback. Understeers on power, slides **only** on the handbrake. The control case. |
| `hatch-rwd` | Hatch RWD | 1150 | 1.25 / 1.25 | 4.0×1.7 | **0.0** | 0.62 | 70k / 76k | 1.00 | 150 Nm @ 4000 | 5 | Same shell, rear drive. The drift teacher — the car the mark showcase is tuned on. |
| `estate-4x4` | Estate 4×4 | 1450 | 1.35 / 1.35 | 4.7×1.8 | **0.5** | 0.60 | 82k / 88k | 1.00 | 210 Nm @ 3200 | 5 | Heavy, planted, four-wheel drive. Long lazy four-wheel slides, heavy marks, hard to provoke and hard to stop. |
| `muscle-rwd` | Muscle | 1500 | 1.30 / 1.30 | 4.8×1.9 | **0.0** | 0.58 | 78k / 80k | 0.98 | 420 Nm @ 3400 | 4 | Torque far beyond the rear tyres. Power oversteer in any gear; the loudest marks in the lab. |
| `track-rwd` | Track spec | 650 | 1.35 / 1.25 | 3.9×1.8 | **0.0** | 0.66 | 105k / 112k | 1.28 | 260 Nm @ 7000 | 6 | Featherweight, huge grip, low inertia. Barely slides — and snaps fast when it does. Redline 9000. |

Torque curves: give each a 6–8 point table, not a single peak number. Start from the hatch's shape
(`900:95, 2000:132, 3000:145, 4000:150, 5000:143, 6000:126, 6500:108`) scaled to the peak, with the muscle's
shifted down the rev range and the track car's up.

`CαR > CαF` on every car gives gentle understeer at small slip (planted, forgiving) while the friction
ellipse still lets power or handbrake break the rear away — that combination *is* the agreed feel.

### The one implementation detail that makes drive layout real
**Split the drive force between the axles by `drive`, then let each axle's friction ellipse eat its own
lateral budget.** `FxF = Fdrive * drive`, `FxR = Fdrive * (1 - drive)`. That is the whole mechanism: on the
FWD car, full throttle spends the *front* axle's grip, so it pushes wide and will not power-oversteer; on the
RWD car it spends the rear's, so the tail comes round; the 4×4 spends half of each and slides at all four
corners. If drive force is applied to the body as a single force instead, **all five cars will behave
identically** and you will be looking at `CLAUDE.md` rule 1 — so prove it with the bench below before
tuning anything.

### Selector
- **Data:** the roster is an array; `?car=<id>` picks one at load (for `devshot.mjs` and `probe.mjs`).
- **PC:** keys `1`–`5`, and `[` / `]` to cycle.
- **Mobile:** a single chip in the HUD showing the current car's name. Tap it to expand a one-row list of
  five; tap a name to pick; tap anywhere else to close. Collapsed by default, one thing expanded at a time,
  tap consumed so it never reaches the world (`CLAUDE.md` §4).
- **Switching resets the car** to origin, stationary, facing north — and **keeps the marks on the floor**, so
  the same corner can be driven in two cars and the two signatures compared side by side. That comparison is
  the point of the selector; do not clear the floor on a car change.
- Switching must be instant. If it stutters, the roster is being rebuilt instead of swapped.

---

## Skid marks (`marks.js`) — the showcase, so get the rules right

One **world-space offscreen canvas**, 160 × 160 m at **10 px/m = 1600 × 1600** (≈ 10.2 MB — see A3; was
8 px/m). Stamps outside the bounds are clamped, not silently dropped. Stamp into it; never
re-stroke old marks per frame (`CLAUDE.md` §8). A "clear marks" button in the lab HUD; no fade in this slice.

Four contact points, computed from the axle positions and track width (1.5 m), each with its previous
world position. Per step, per wheel:

- **Slip speed** = magnitude of the contact patch's velocity relative to where a rolling tyre would be going:
  lateral component from that axle's `vLat ± yawRate*l`, longitudinal component from lock-up (= `|vLong|`
  when locked, else 0).
- **Tolerance floor:** stamp nothing below **1.5 m/s** of slip. Without it, every gentle corner smears the
  floor and the marks stop meaning anything (this is `CLAUDE.md` rule 8 applied to feedback).
- **Stamp** a line from previous to current wheel position, width `tyreWidth` (minimum 2 px so it survives
  the pixel buffer), `alpha = 0.12 + 0.5 * min(1, (slip - 1.5) / 6)`, colour a dark neutral
  (`rgba(40,38,42,α)`) — not black, so overlaps deepen instead of flattening.
- **Situation must be legible, and this is the acceptance test:**
  | Situation | What the marks must look like |
  |---|---|
  | Hard braking to lock-up | Four straight parallel lines, front pair darker (62 % bias), no curvature |
  | Power-on drift | Two curved arcs from the rear only, widening as yaw builds, front clean |
  | Handbrake turn | Rear pair appears instantly and sweeps a tight arc; fronts stay clean until the slide runs wide |
  | Trail-braking into a slide | Front pair curving (front lateral) then rear joining as the tail comes round |
  | Normal fast cornering | **No marks at all** |

---

## The lab scene (`lab.js`)

- **White floor**, a very pale cool grey (`#f2f2f4`) with a faint 5 m grid (`#e6e6ea`) so speed and drift
  angle are readable, and a subtle vignette. Marks and cones must pop against it — that is the whole point of
  a white floor. Bounded at 160 × 160 m by a painted hazard kerb (A4).
- **Cones as data:** an array of `{x, y}`, maybe 20, scattered in loose clusters with a rough slalom line and
  a small box to spin inside. Static until Step 6, then knockable.
- Reset (`R` / a HUD button) puts the car back at origin, stationary, facing north. Clear marks separately.
- Camera: follow with lead `pos + vel * 0.35`, smoothed (`lerp 8/s`), no rotation. Renders at **device
  resolution, `PPM = 16` px/m at DPR 1, DPR capped at 2** (A1, A2). The low-res integer-scale buffer that was
  specified here is void; `imageSmoothingEnabled = false` survives only on the marks-layer blit.

---

## Instrumentation — build it in Step 1, before the car is drawn

**`tools/probe.mjs`** imports `vehicle.js` directly and runs scripted inputs headlessly. It is the
instrument the whole project will be tuned with (`CLAUDE.md` §8), so it exists before the renderer.
Four benches and their target windows for the stock hatch:

| Bench | Inputs | Target |
|---|---|---|
| Standing acceleration | full throttle, auto box | 0 → 27 m/s in **9–11 s** |
| Braking | from 27.8 m/s, full brake | stops in **38–45 m**, tyres locked |
| Skidpad | constant radius 40 m, find max steady speed | peak lateral **0.85–1.00 g** |
| Handbrake turn | 15 m/s, full lock + handbrake | yaw ≥ 90° within **1.2 s**, then recoverable |
| Fuzz | 60 s of random inputs | zero non-finite values, car still on the floor |

**Run all five benches for all five cars and print the grid.** It takes one extra loop and it is the rule 1
detector for the whole slice: if the FWD and RWD hatches — identical but for one number — come back with the
same skidpad speed and the same handbrake yaw, `drive` is not wired into the axle split and no amount of
tuning will fix it. The grid should show the estate slowest to stop, the track car fastest everywhere, the
muscle car unable to use its torque in first, and the FWD hatch failing the handbrake bench's *recovery*
rather than its yaw.

Print the measured numbers as a table. **Write the measured figures into the comment beside each constant you
move** (`CLAUDE.md` §3) so the next person sees what has been tried.

`?dev=1` overlay: per-axle slip angle, `Fz`, `Fy`, `Fy/FyMax`, sliding and locked flags, slip speed; body
`vLong/vLat`, yaw rate, rpm, gear, and raw input values. Expose everything on `window.__game`.

---

## Steps, in order

**Step 0 — scaffold.** `index.html`, `serve.mjs` (port 8080), white floor, grid, kerb, and the resize / DPR /
`PPM` maths (A1, A2 — *not* the low-res buffer). Photograph at 1280×720, 844×390 and 390×844 and confirm the
grid is crisp, square and correctly scaled in all three. *No car yet.*

**Step 1 — the model, measured before it is seen.** `vehicle.js` + `cars.js` (all five cars) +
`tools/probe.mjs`. Run the five benches **for every car**. **Do not proceed until the hatch pair sits inside
its windows and the five cars are visibly different from each other** in the grid, and report it. If a number
will not come in, say which and by how much — do not carry on and hope it feels fine (`CLAUDE.md` §1).

**Step 2 — drive it.** Render the car sprite (4.0 × 1.7 m, top-down pixel art, dark rim so it reads against
white, front clearly distinguishable), camera, keyboard input, cones drawn as static markers. Drive it
yourself through CDP with scripted key holds, photograph a straight, a corner and a spin. This is the first
"does it feel right" checkpoint — report it and expect to iterate here.

**Step 2b — the selector.** Keys `1`–`5` and `[`/`]`, `?car=` at load. Drive all five, photograph each, and
report in one sentence per car whether it feels like what the table says it is. The mobile chip comes with
the rest of the touch HUD in Step 5.

**Step 3 — powertrain + tacho.** RPM, gears, auto and sequential, the 0.25 s cut. Tacho with a shift light in
the HUD (the silent twin of the engine note, `CLAUDE.md` §8). Speed readout in km/h.

**Step 4 — marks.** `marks.js` per the rules above. Verify **each of the five situations** in the table with
scripted inputs, photograph each one, and check the frame cost with the layer heavily used, not empty
(`CLAUDE.md` §3). Report the five screenshots.

**Step 5 — touch.** Thumb stick + three pedals, `pointer: coarse` detection with `?touch=1` / `?pc=1`
overrides, multi-touch (stick and throttle at once — test it, it is the commonest touch bug), and taps
consumed so a thumb never reaches the world. Minimum 44 px targets, 12 px margins. Run `overlap.mjs` and
photograph both modes at all three sizes.

**Step 6 — the last 10 %.** Knockable cones (circle vs car body, impulse out, friction to a stop), a small
screen shake and a dust puff on impact, both on the **wall clock**. Then, only if everything above passes:
`audio.js` — one oscillator for engine note tied to rpm, filtered noise for squeal driven by the slip speed
you already compute, behind a tap-to-enable. Audio is the first thing to cut if the slice is getting big.

**Step 7 — deliver.** Push to itch (`CLAUDE.md` §5) or serve a tunnel, hand over the link, a short list of
what to test, and what would count as wrong. Update `TODO.md`. Write `ENGINE.md` describing the model **as
built**, with the measured bench table in it.

---

## Phase 2: F1 Physics & Assists Overhaul

*(Added 2026-10-01 after the Track car physics hit a fundamental mathematical ceiling)*

The user requires the `track-rwd` car to handle like an authentic F1 car (massive downforce, stick-like grip at high speeds, and extreme power capable of wheelspinning to 200 km/h in 1st gear) AND requires **Traction Control (TCS)** and **Launch Control** to be toggleable for high-end cars.

1.  **Driver Assists (`src/input.js`, `src/hud.js`, `src/vehicle.js`)**
    - `cars.js` must support a `hasAssists: true` flag.
    - `hud.js` must render a "TCS ON/OFF" toggle chip.
    - `vehicle.js` must intercept `throttle` during high-slip events (TCS) and hold optimal RPM during stationary full-throttle launches (Launch Control) based on the `assistsActive` state.
2.  **Aero Load Sensitivity (`src/vehicle.js`)**
    - The current `TUNE.loadSens` formula heavily penalizes `mu` when `Fz` spikes. When massive aerodynamic downforce is applied, the tyre's friction coefficient plummets to the minimum floor, perfectly cancelling the grip gain.
    - **Plan:** Decouple mechanical load transfer (which *should* penalize `mu`) from aerodynamic downforce (which *adds* grip without adding mass).
3.  **Dynamic Cornering Stiffness (`src/vehicle.js`)**
    - Peak slip angle is calculated as $aPeak = D / C_{\alpha}$. When downforce triples $D$, but $C_{\alpha}$ remains fixed, the peak slip angle stretches out to 20+ degrees. An F1 car needs peak grip at ~5-7 degrees.
    - **Plan:** Scale $C_{\alpha}$ (`caEff`) linearly with the effective vertical load ratio (`Fz / FzNom`) so the tyre carcass "stiffens" under downforce, keeping the slip curve tight and responsive.

---

## What would count as this slice being wrong

- The car feels different on desktop and on the phone → the fixed step is not fixed.
- It grips the same whatever you do, or slides the same whatever you do → the friction ellipse is not
  biting; instrument `Fy/FyMax` before touching a constant (rule 1).
- **The five cars feel like the same car with different sprites** → the drive force is not being split per
  axle by `drive`. This is the single most likely failure in the slice. The FWD hatch must refuse to
  power-oversteer and the muscle car must struggle to put its torque down, or nothing is wired up.
- Changing car clears the floor, or stutters → the marks layer is being rebuilt on a swap.
- Marks under ordinary cornering, or no marks under a handbrake turn → the slip-speed floor or the axle
  flags are wrong.
- The car shivers or drifts at a standstill → the low-speed blend.
- The car disappears → a `NaN`; the guards in step 3/10 were skipped.
- Thumb stick and throttle cannot be held at once → touch identifiers are not being tracked per pointer.
- Frame cost climbs as the floor fills with marks → marks are being re-stroked instead of stamped.

---

## Phase 3: The Grand Vision (Endgame Roadmap)

*(Digested from user brief 2026-10-01)*

This phase outlines the architecture and content requirements for the final, full-release version of Rac3r.

### 1. The Damage & Economy System
- **Damage Model:** Add basic crumpling/denting initially, scaling up to part failures (punctures, broken glass, wheels falling off, engine failure, fuel leaks/fires).
- **Wear & Tear:** Steering/suspension take minor wear from normal use; heavy damage from crashes. Damage is tallied over a race/championship.
- **Garage Repairs:** Fix damage between events using race winnings.
  - *Repair:* Full price, guaranteed fix.
  - *Bodge it:* Cheap, but carries a chance of part failure during the next event.
- **Component Upgrades:** Cars start limited. Upgrading components improves their base stats (e.g., downforce, engine block) until they reach their "best" form.
- **Persistent Tyres:** Tyres are bought and fitted per-car. Options include slicks, normal, ice chains, sand paddles. They affect durability, surface grip, and wheelspin. You only pay for tyres when changing them (plus wear and tear).

### 2. The Dynamic Environment & Surfaces
- **Dynamic Degradation:** Long grass -> Short grass (2 passes) -> Dirt -> Mud (3 passes).
- **New Surfaces:**
  - *Dirt Road:* Slippy/grippy hybrid (between gravel and mud), capable of holding speed.
  - *Race Tarmac:* Smooth, high grip.
  - *Broken Tarmac / Bumps:* Uneven surfaces physically unsettle the suspension and steering.
- **Overlays:** Ice, Snow, Rain, Puddles, and Oil patches that can be applied to any road surface.
- **Physics Jumping:** Implement true, physics-based jumping/air-time (replacing the current "cheap" application).

### 3. The Oval Tracks
Tracks require an invisible `Subtrack` layer matching the road shape for safe recovery routing (already scaffolded, needs refinement).
- **Grass Track (Oval):** Dirt/mud/grass surface. Inside kerb, beat-up chain-link fence outside. Muddy infield with a podium, caravan, and tyre stacks. Muddy pit area and grandstands outside.
- **Stock Car (Oval):** Tarmac/broken tarmac. Neat tyre stacks, crashed/parked cars in the infield. Tarmac pit area and official box outside.
- **Naffcar (Large Oval):** Gently banked corners (steeper on outer edges). Full race tarmac, inner/outer kerbs. Proper overhanging start lights, stadium grandstands, and a driveable pit lane.

### 4. Progression & The Intro Sequence
- **The Lab Test:** Players start in a beat-up FWD coupe in the lab. A guided 1-lap test involves navigating gates (pairs of cones).
- **Difficulty Suggestion:** The game scores the player based on time, missed gates, and hit cones, then suggests one of 5 difficulties:
  1. *Mobile game* (easiest)
  2. *Game*
  3. *Realish*
  4. *Real but you're rich*
  5. *Real* (hardest)
  - *(Players can skip the test and pick manually).*
- **Garage UI:** Persistent race numbers applied across all owned cars. Guided, skip-able tutorials for each new menu section (Races, Upgrades, etc.).

### 5. The Massive Car Roster
All cars will use a pixel art style (to be defined) and have sarcastic/parody names.
- **15 Rally Cars** (e.g., Peugeot 106 up to Group B)
- **10 Bangers** (Coupes)
- **10 Everyday Cars** (and modded variants)
- **10 Drift Cars** (MX5 to Supra)
- **10 Muscle Cars**
- **10 Sports Cars**
- **10 Super Cars**
- **5 F1 Variants** (across F3, F1, Formula E)
- **5 Naffcars** (NASCAR parodies)
- **3 Pick-up Trucks**
- **2 Land Lovers** (Land Rover parodies - excellent in mud/snow, low top speed)
- **5 Heavy Off-Roaders** (Tractors, tracked Russian vehicles, modern 4x4s)

### 6. UI & QoL Fixes
- **Reset vs Restart:**
  - Rename current `RESET` (which clears marks/scene) to **`RESTART`** (restarts level/event).
  - Create a new **`RESET`** button that places the car back on the nearest track edge (using the Subtrack proximity), pointing the right way, without clearing race progress or colliding with objects.
- **Fence Graphics:** Improve the look of the chain-link fence (less basic/chunky, more realistic) while maintaining performance.
- **Bug Fix:** Prevent cars getting wedged/stuck in the fence coliders.
