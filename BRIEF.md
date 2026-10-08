# RACER — build doc

The user's brief as supplied (2026-09-27), verbatim below. `CLAUDE.md` is how to build it; `TODO.md` is the
live queue. Anything not in this document is not agreed — see **OPEN QUESTIONS** at the foot, which is the
only part of this file Claude wrote.

---

## TASK: Build a 2D Top-Down Pixel Art Car Physics Simulator & Upgrade Game

You are an expert game developer building a high-fidelity 2D top-down pixel art car physics simulator in a
single-page HTML5/Canvas/JavaScript application.

---

## 1. TECHNICAL STACK & ARCHITECTURE
- **Environment:** Standalone HTML5 Canvas + Vanilla JavaScript (or Planck.js / lightweight Box2D port
  embedded via CDN). No bloated frameworks.
- **Visuals:** Retro 2D pixel art style (crisp nearest-neighbor scaling), dynamic tire skid marks, simple
  particle exhaust, screen shake on collision.
- **Audio:** Web Audio API oscillator-based synthesized engine sounds tied to RPM, tire squeal noise on
  lateral slip.

---

## 2. INPUT SYSTEM (TOUCH + KEYBOARD)
Abstract inputs into a normalized state object:
`{ steer: [-1..1], throttle: [0..1], brake: [0..1], handbrake: boolean, shiftUp: boolean, shiftDown: boolean }`

- **Keyboard:**
  - Steering: `A` / `D` or `Left` / `Right`
  - Throttle: `W` or `Up`
  - Foot Brake / Reverse: `S` or `Down`
  - Handbrake: `Space`
  - Shifting: `E` (Shift Up), `Q` (Shift Down)
- **On-Screen Mobile Controls:**
  - Left side: Virtual analog stick or responsive Left/Right touch zones.
  - Right side: Dedicated buttons for Throttle, Foot Brake, and Handbrake.
- **Transmission Modes (Configurable in UI):**
  - `Automatic`: Shifts automatically based on optimal RPM power curves.
  - `Sequential`: Manual up/down clicks (`Q`/`E` or UI buttons).
  - `Full Manual`: Direct gear control with stall/over-rev penalties.

---

## 3. DRIVING & COLLISION PHYSICS
- **Top-Down Friction Physics:**
  - Resolve forward and lateral velocity vectors for front and rear axles separately.
  - Apply lateral friction counter-forces up to the maximum grip limit:
    `max_grip = tyre_friction_coefficient * axle_weight_distribution`
  - When lateral force exceeds grip threshold, initiate tire slide/drift.
- **Braking & Lockup:**
  - Brake torque opposes wheel rotation; if brake torque > grip, tires lock up, leaving skid marks and
    extending stopping distance.
  - Handbrake locks rear axle immediately to trigger oversteer and drift entries.
- **RPM & Powertrain Math:**
  - `target_rpm = vehicle_speed * current_gear_ratio * final_drive`
  - `rpm_acceleration = engine_power / (drivetrain_inertia + wheel_weight)`
  - Gear ratios determine top speed per gear and RPM drop after upshifts.
- **Collisions:**
  - Rigid body restitution bounces the car off barriers/track borders.
  - Compute impact impulse force: `impulse = (delta_velocity * car_mass) / delta_time`.
  - Trigger collision sound, screen shake, and chassis damage calculation proportional to impulse.

---

## 4. COMPONENT & 10-PIP UPGRADE SYSTEM
Cars are built from distinct modules. Each module has multiple Levels, and each Level has **10 progressive
pips**:
- **Pips 1 to 9:** Incremental, low-cost linear stat increases.
- **Pip 10 (Level Up):** Major performance milestone; unlocks higher max revs, gear ratios, or tire
  compounds at a higher cost.

### Component Mapping:
1. **Engine:** Increases peak torque and power; boosts acceleration, RPM climb rate, and overall top speed.
2. **Gearbox:** Cuts shift latency, broadens usable powerband, unlocks additional forward gears.
3. **Drivetrain:** Reduces rotational inertia; increases RPM response speed and throttle punch.
4. **Tyres:** Increases lateral friction coefficient and drift recovery; shortens braking distances.
5. **Suspension:** Improves body rigidity, minimizes weight transfer lag, stabilizes high-speed cornering.
6. **Chassis / Structure:** Adjusts base curb weight and torsional rigidity; determines crash durability and
   impact absorption.
7. **Brakes:** Increases clamp force and raises lockup threshold.
8. **Fuel Tank:** Balances fuel capacity (endurance) against fluid weight penalty.

### Car Archetypes & Hard Caps:
- **Classic Estate/Wagon:** Heavy base weight, maximum crash strength, lower ceiling on tire grip and top
  speed.
- **Hot Hatch / Muscle:** High raw engine power potential, moderate weight, loose rear end.
- **Open-Wheel / Track Spec:** Featherweight, highly sensitive to gearing and grip, near-zero collision
  durability.

---

## 5. UI, GARAGE & GAMEPLAY LOOP
1. **The Garage Screen:**
   - Visual stat meters: **Grip, Top Speed, Acceleration, Weight, Rigidity, Strength, Braking**.
   - Component upgrade panel displaying current component level, 10-pip progress bar, cost, and stat
     previews.
   - Cosmetic wheel/rim and body paint selector.
2. **The Track / Race Loop:**
   - Asphalt circuit with checkpoints, start/finish line, timing gates, and rigid wall barriers.
   - Finish races in Top 3 to earn currency:
     - 1st Place: 100% purse
     - 2nd Place: 60% purse
     - 3rd Place: 35% purse
   - Reinvest race winnings into pip upgrades and test modifications immediately on the track.

---

## EXECUTION ORDER FOR AGENTS
1. **Step 1:** Implement the 2D physics vehicle model (longitudinal throttle, lateral slip friction,
   keyboard + touch controls) on an HTML5 canvas.
2. **Step 2:** Add powertrain mechanics: engine RPM curves, multi-gear transmission logic,
   automatic/manual modes, skid particles, and collisions.
3. **Step 3:** Implement the data layer: Car archetypes, components, and the 10-pip upgrade calculator that
   live-updates physics parameters.
4. **Step 4:** Build the Garage UI, HUD readouts, asphalt circuit tilemap with collision bounds, lap timer,
   and race prize payout loop.

---
---

## ADDED BY THE USER AFTER THE FIRST PLAYTESTS (2026-09-27) — spec, not yet built

### Tyres as a CHOICE, with brands
Tyres become a purchasable choice rather than just a stat line, the way they are in real life. Several
manufacturers, each making a RANGE — road, dirt, and so on — with genuinely different specs, so each is
good for different things and the pick depends on the event. Brand names are meant to be silly and
faintly rude-sounding; the user gave **Kum**, **Spum** and **Creem** as examples of the register.

This lands naturally on the existing seam: a tyre is already nothing more than mu, slideGrip, caF/caR
and tyreWidth in cars.js, plus the surface.mu multiplier that is currently always 1.0 and exists
precisely so a tyre can be good on one surface and bad on another. No engine work is needed — it is a
data table and a menu.

### Progression
All cars start at base spec and are taken progressively up. This is the brief's existing 10-pip system
(§4), now confirmed as the next direction of travel after the lab.

## OPEN QUESTIONS — not in the brief, must be decided before the code that depends on them
*(Claude's list. Answers get written in here as they are agreed, and this section shrinks to nothing.)*

1. **Screen orientation.** Landscape, portrait, or both. Decides the whole HUD lane allocation and the touch
   layout (`CLAUDE.md` §4).
2. **Rivals.** Are there AI cars on track, or is "Top 3" measured against fixed target times / ghosts? The
   brief's payout table implies opponents; racing AI is the single biggest hidden scope item in this
   document.
3. **The broke-player floor** (rule 7). As written, 4th place pays nothing, so a player whose car cannot make
   the podium has no way to earn the upgrade that would get them there. Needs an answer before the economy
   is built.
4. **Fuel and damage: persistent or per-race?** Decides whether they are constant pressures needing a
   tolerance floor (rule 8) or just in-race resources.
5. **Physics: custom vehicle model or Planck.js?** (Claude's recommendation: custom — see `CLAUDE.md` §8.)
6. **What a pip is worth, in lap seconds.** The measurable bar this whole progression is judged against
   (`CLAUDE.md` §3, §8).
7. **Do all three archetypes exist at launch**, or is one shipped first and the others added once the
   handling model is settled?
8. **What the player sees change on the car** when a component levels up (§4: legible on the body).

---

## OVAL TRACKS DESIGN & POLISH SPEC (2026-10-01)
*As requested by user: detailed design standard for making the oval circuits functional, beautiful, and authentic to grassroots motorsport.*

### 1. Circuit Standards & Containment
- **Containment Rule:** All track splines, kerbs, runoff zones, and perimeter buildings must fit strictly within $X, Y \in [-240, 240]\text{ m}$, providing at least 60m of clear buffer from the world perimeter fence ($FENCE = 302\text{ m}$). No circuit element may ever intersect the world boundary.
- **Direction:** All oval circuits run **counter-clockwise (turning left)**. Subtrack splines must anchor index 0 (`dist = 0`) **precisely at the start/finish line ($x = 0$)**, ensuring that lap timing, distance interpolation, and visual grid lines are 100% synchronized.
- **Boundary Markings:** Tarmac and competition circuits carry continuous white painted outer verge lines; unpaved surfaces (autograss, dirt, mud) omit white highway lines, using natural grass fringes and red/white apex kerbs instead.

### 2. Solid Impactable Obstacles (`obstacleClamp`)
Grandstands, marshal towers, and concrete pit walls must be **solid physical barriers**, not ghosted background decorations:
- Each structure is registered in `LEVEL.obstacles` with real-world AABB dimensions `[x, y, w, h]`.
- Resolved every fixed 120 Hz step via `obstacleClamp(car)`: computes the vehicle corner penetration against the obstacle box, pushes the vehicle to the shallowest boundary, and inverts penetrating velocity with $0.35$ elastic rebound.
- Dampens snagging yaw rate by $50\%$ and triggers proportional screen shake and collision audio.

### 3. Dynamic Multi-Layer Surface Wear
Unpaved circuits (autograss, dirt) must evolve dynamically as cars race over them:
- **Layering Order:** In `render.js`, the rendering pass order must be:
  1. `drawFloor()` (base terrain: grass)
  2. `drawZones()` (ground patches: short grass, mud, gravel)
  3. `drawTrackRibbon()` (road ribbon: dirt, grass, tarmac)
  4. `drawWear()` (progressive tyre paths: dark mud ruts carved into dirt and grass)
  5. `drawKerb()` (rumble kerbs stay crisp and clean on top)
  6. `drawPaint()` (start/finish grid lines)
  7. `drawMarks()` (rubber skid marks)
- **Wear Thresholds:** Dirt roads must degrade to deep, heavy mud (`SURFACES.mud`) after **2 tyre passes**. When worn, `groundAt(x, y)` dynamically shifts tyre friction to $\mu = 0.45$, engages ploughing drag ($1.60\text{ m/s}^2$), and switches particle effects to heavy dark mud clods.

### 4. Environmental Storytelling & Scenery Detailing
- **Grass Track (Autograss Circuit):**
  - Mixed surface: mowed grass straights and warm earth dirt sweepers that churn into dark mud ruts along the racing line.
  - Bolted 3-tyre apex clipping barriers marking inside corners.
  - Vintage touring caravan with cream body, dual burnt-orange/chocolate coachline stripes, tow hitch, jockey wheel, mounted green gas bottle, and pop-up roof vent.
  - 3-tier wooden winner's podium carrying gold, silver, and bronze trophy cups with chequered flag bunting.
  - Covered wooden spectator grandstand with corrugated zinc canopy and fluttering pennants.
- **Stock Car Oval (Banger Racing):**
  - Tarmac with broken rumble sections entering corners.
  - Continuous bolted tyre wall along the inside verge separating the track from the infield.
  - Abandoned banger cars with welded triangular iron roof fins, driver race numbers (`42`, `17`, `88`, `03`), visible H-frame roll-cages, and sponsor stencils (*"BILL'S SCRAP"*).
  - Elevated wooden marshal lookout tower with ladder, yellow caution flag, and chequered flag.
  - Sponsor hoardings with humorous parodies from the brief (*"SPUM TYRES"*, *"CREEM MOTOR OIL"*, *"SLAG HEAP SCRAP"*).
- **Naffcar Speedway (Super Speedway):**
  - 22m-wide high-grip competition racetarmac with $18^\circ$ corner banking ($F_{\text{bank}} = -m \cdot g \cdot \sin(\theta)$) providing 4,000+ N of inward centripetal holding force.
  - 3D steel space-frame lattice truss overhead gantry with 5 glowing circular LED start pods and digital lap display.
  - Concrete pit wall with triangular tyre crash attenuators, team toolboxes, and stacked Goodyear racing slicks.


---
## 2026-10-03 — NEW USER SPECS
Tyres + fitment, track builder + circuit roster (Castle Cum, Thruston, Slidden Hill), menus / garage / Test Mode, AI drivers, aerodynamics, and the real-car parody naming rule are in `SPECS-2026-10-03.md` (verbatim). The digest and open questions are in TODO.md "ROADMAP (2026-10-03)".
