// ai/circuit.js — the racing AI driver for circuits: createAIDriver (split from aidriver.js).
// The cautious BENCH driver stays in autodrive.js (lap tools, menu demo, pace car).
//
// USER SPEC (2026-10-04): AI know RACING LINES and how to overtake; SURFACE AWARENESS (stay on
// faster / grippier ground when quicker); the difficulty is the CENTRE of a GRADIENT across the
// field ("some drive better, some quicker, some more defensive, some more aggressive"); VARIATION
// OFF THE LINE grows as difficulty drops ("worse AI more random, better AI like a professional:
// fast and on line"); difficulty comes from "how fast, how few mistakes, racing lines, tactics like
// pit stops and joker laps, deviation from the line"; the AI should feel like it's SCRABBLING for
// victory or making GENUINE SUBTLE DRIVING ERRORS that lead to crashes and / or slower laps; take
// JOKER laps randomly / tactically; AVOID waiting for or crashing into other cars, deviating from
// its chosen path to do it; on Slidden Hill take the TRADITIONAL START (the RX start straight), not
// a dash to the nearest bit of lap.
//
// 4. DRIVING: Stanley steering onto the path + a lateral target (wander, mistakes, avoidance),
// target speed = profile x pace.
import { parkMiller } from "../core/random.ts";
import { debugValue } from "../core/debug.ts";
import { querySubtrack } from "../world/tyrewall.ts";
import { GRAVITY } from "../cars.ts";
import { aiTraits } from "./traits.ts";
import { K_BRAKE, OBST_CLEAR, racingLine, nearestIdx, carGrip, profileOf } from "./line.ts";
import { roadDriver, driveOut } from "./weaver.ts";
import type { Level } from "../world/types.ts";
import type {
  AiCar, CircuitState, DriveCtx, HighwayLevel, JokerCtx, Lead, Threat,
} from "./types.ts";

// m: the lateral target never puts the car's centre closer than this to the road edge
const WANDER_EDGE = 1.1;
// extra braking grip planned while ATTACKING (late braking into the corner)
const ATK_KB = 0.12;
const YIELD = 0.05;          // speed given up to a car alongside on the inside (x 1.2 - defence)
const ALONG_GAP = 2.7;       // m kept from a car alongside by an attack or a cover move
// handbrake turns: apex R (m, + HB_LOOSE on loose ground), corner turn (rad), pull (s).
const HB_R = 25, HB_LOOSE = 8, HB_TURN = 1.4, HB_T = 0.25;
// MEASURED (aidrivecheck, HB on/off, Realish + Real, hatch + 4x4): Slidden / Knobhill / Castle Cum
// within 0.1 s, Sweaty Lamb +0.2..+0.7 s, 6 pulls per 2 min at Slidden, 4 at Sweaty Lamb — it is
// FLAVOUR (the user's "drift and stuff"), not pace. A heading-error trigger fired ~never. m past
// the usual edge allowed to get round a car / a slow or stopped one
const WIDE = +(debugValue("WIDE") ?? 0.8), WIDE_SLOW = 2.5;
// throttle kept through a front slide on loose ground (off road, dirt, gravel)
const UNDER_LOOSE = 0.35;
// MEASURED (aifieldsuite Realish, 24 races): before start-contacts 765, contact 231 s, resets 14,
// passes 118; 6 s / 0.8 m: 564, 258 s, 17, 219; 9 s / 1.3 m (kept): 492, 212 s, 9, 192 (off-road
// +12 %)
// s to ease from the grid lane onto the line; m more room alongside then
const START_BLEND = 9, START_GAP = 1.3;
// + only in corners with an apex tighter than DRIFT_R m (hairpins / junctions)   // rad: the rear
// slip a drifting AI holds, and where it gives up and catches it
const DRIFT_SLIP = 0.22, DRIFT_MAX = 0.4, DRIFT_R = 35;
const EDGE_DRIFT = 2.0, DRIFT_BAN = 60;
// NEVER WAIT (user, 2026-10-07: "patience they should never really wait imo, just try harder and
// go faster"): seconds of being held up before
// a pass is tried were 0.3-1.5 s (by aggression), now 0.15-0.6; the chance to commit to one per
// corner 30-90 % -> 60-100 %; and sat behind
// a car it PUSHES HARDER, up to HARDER faster the longer it is held.
const HARDER = 0.03, HARDER_T = 4;

// ---------------------------------------------------------------- the driver
// drive(car, dt, ctx): ctx = { cars: [other car objects], lap: current lap (1-based), laps: race
// length }. Other cars may carry _jokers (jokers taken) for the joker tactics.
export function createAIDriver(level: Level, traits = aiTraits(4, 0, 1)) {
  // the ENDLESS highway has no closed lap to plan a line round: the same driver reads the road
  // frame instead (roadDriver above) (cast: an endless Level is the highway's level, whose road
  // fields ai/types.ts HighwayLevel describes)
  if (level.endless) {
    return roadDriver(
      level as unknown as HighwayLevel, traits,
      parkMiller(((traits.seed || 4242) * 31 + 7) % 2147483647 || 1),
    );
  }
  // (! : racingLine has just made the branches)
  const line = racingLine(level), main = line, branches = level._branches!, count = line.n;
  const rnd = parkMiller(traits.seed || 4242);
  const wanderPhaseA = rnd() * 6.28, wanderPhaseB = rnd() * 6.28;
  const jLaps = (level.joker && level.joker.laps) || 5;
  // the joker PLAN: a lap drawn from a spread (rarely the first, when the field is packed),
  // tactics can override it on the day
  const jPlan = (() => {
      const roll = rnd(), cum = [0.12, 0.35, 0.6, 0.82, 1.0]; for (
      let band = 0; band < cum.length; band++) if (roll < cum[band]) return Math.min(
      jLaps, band + 1); return jLaps; })();
  const state: CircuitState = {
    path: main, i: null, vT: 0, t: 0, lap: 0, jokers: 0, jPlan, jWant: false, jDecLap: -1, jForget:
        rnd() < (traits.slip || 0),
    mist: null, mistCorner: -1, dodge: 0, follow: false, cap: 0, lastDist: 0, pushing: false,
        thrUntil: 0,
    atk: null, atkCorner: -1, hbCorner: -1, hbUntil: 0, cover: null, covCorner: -1, leadCar: null,
        behindT: 0
    };

  function advance(car: AiCar) {
    const path = state.path, pts = path.pts, size = path.n;
    // (! : drive finds its place before it calls advance)
    let bestIdx = state.i!, bestDist2 = Infinity;
    for (let offset = -4; offset <= 30; offset++) {
      let i = state.i! + offset;
      if (path.closed) i = (i + size) % size;
      else if (i < 0 || i >= size) continue;
      const dist2 = (pts[i].x - car.x) ** 2 + (pts[i].y - car.y) ** 2;
      if (dist2 < bestDist2) {
        bestDist2 = dist2;
        bestIdx = i;
      }
    }
    if (path === main && state.i! > size * 0.8 && bestIdx < size * 0.2) state.lap++;
    state.i = bestIdx; state.lastDist = Math.sqrt(bestDist2);
    // off the end of a branch: back onto the line where it merged
    // (! : a branch always has rejoin)
    if (path !== main && bestIdx >= size - 2) {
      state.path = main;
      state.i = path.rejoin!;
      advance(car);
    }
  }
  function decideJoker(ctx: JokerCtx, lap: number, laps: number) {
    state.jDecLap = lap;
    if (!branches.joker || state.jokers > 0) { state.jWant = false; return; }
    // last chance (a low-skill driver may simply forget: +30 s)
    if (lap >= laps) {
      state.jWant = !state.jForget;
      return;
    }
    if (lap === state.jPlan) { state.jWant = true; return; }
    // TACTICS: stuck behind someone -> "jump" them with the joker (more likely the more
    // aggressive); a rival right behind who has
    // already jokered -> cover them now before they gain the clean air (more likely the more
    // defensive)
    const selfCar = ctx.self; let ahead = false, coverIt = false;
    for (const other of ctx.cars || []) {
      const dx = other.x - selfCar.x, dy = other.y - selfCar.y, along = dx * Math.cos(
          selfCar.heading) + dy * Math.sin(selfCar.heading), gap = Math.hypot(dx, dy);
      if (along > 0 && gap < 30) ahead = true;
      if (along < 0 && gap < 25 && (other._jokers || 0) > 0) coverIt = true;
    }
    state.jWant = (ahead && rnd() < 0.2 + 0.5 * traits.aggression) || (
        coverIt && rnd() < 0.2 + 0.5 * traits.defence);
  }
  function startMistake(cIdx: number) {
    const roll = rnd(), kind = roll < 0.4 ? 'late' : roll < 0.65 ? 'early' : roll < 0.85 ?
        'throttle' : 'lift';
    state.mist = {
      kind, sev: Math.min(1, (0.3 + 0.7 * rnd()) * (1.2 - traits.skill)), corner: cIdx, inside:
          false, t: 0
    };
  }

  /** Puts a car that has no place yet on the RX start branch or the main line. */
  function placeAtStart(car: AiCar) {
    // the START: a car sitting on the RX start straight drives it (user: "the traditional
    // start"), else the line
    if (branches.start && querySubtrack(level.subtrack!, car.x, car.y).dist > line.hw &&
        Math.hypot(...(() => {
        const nearest = nearestIdx(branches.start.pts, car.x, car.y), point = branches.start.pts[
        nearest]; return [point.x - car.x, point.y - car.y]; })()) < 12) {
      state.path = branches.start; state.i = nearestIdx(branches.start.pts, car.x, car.y);
    } else { state.path = main; state.i = nearestIdx(main.pts, car.x, car.y); }
  }

  /** Decides the joker once per lap, takes it at the switch point; returns the speed cap. */
  function jokerStep(car: AiCar, ctx: DriveCtx, path: typeof state.path, nearIdx: number,
      lap: number, laps: number) {
    const spec = car.spec;
    let jCap = Infinity;
    if (branches.joker && path === main) {
      const dSw = (((branches.joker.switchI! - nearIdx) % count) + count) % count * line.sp;
      if (dSw < 220 && state.jDecLap !== lap) decideJoker({ ...ctx, self: car }, lap, laps);
      if (state.jWant) {
        const jokerSpeed = profileOf(branches.joker, spec, main)[0],
            brakeDecel = K_BRAKE * carGrip(spec).brakeG * GRAVITY * 0.8;
        jCap = Math.sqrt(jokerSpeed * jokerSpeed + 2 * brakeDecel * dSw);
        if (dSw <= 3) {
          state.path = branches.joker;
          state.i = 0;
          state.jokers++;
          state.jWant = false;
        }
      }
    }
    return jCap;
  }

  /** Applies the running mistake to the line (latT) and the speed (vMul); may arm the throttle. */
  function applyMistake(mist: NonNullable<typeof state.mist>, nearIdx: number) {
    let latT = 0, vMul = 1;
    const corner = line.corners[mist.corner], inC = line.cid[nearIdx] === mist.corner,
        pastApex = inC && ((nearIdx - corner.apex + count) % count) < count / 2;
    if (inC) mist.inside = true;
    if (mist.inside && !inC) state.mist = null;    // through the corner: done
    // brakes late: runs wide, maybe off
    else if (mist.kind === 'late' && !pastApex) vMul = 1.06 + 0.14 * mist.sev;
    // turns in early: clips the inside
    else if (mist.kind === 'early' && !pastApex) latT += corner.turn * (1 + 2 * mist.sev);
    // hesitates: just slow
    else if (mist.kind === 'lift') vMul = 1 - (0.05 + 0.1 * mist.sev);
    // too much, too soon: a slide
    else if (mist.kind === 'throttle' && pastApex && !mist.fired) {
      mist.fired = true;
      state.thrUntil = state.t + 0.3 + 0.5 * mist.sev;
    }
    return { latT, vMul };
  }

  /** Draws a mistake per corner ~45 m out and applies the running one: line, speed, throttle. */
  function mistakeStep(path: typeof state.path, nearIdx: number) {
    let latT = 0, vMul = 1;
    if (path === main) {
      const cornerAhead = line.cid[(nearIdx + Math.round(45 / line.sp)) % count];
      if (cornerAhead >= 0 && cornerAhead !== state.mistCorner) {
        state.mistCorner = cornerAhead;
        state.mist = null;
        if (rnd() < traits.mistake * (state.pushing ? 1.6 : 1)) startMistake(cornerAhead);
      }
      const mist = state.mist;
      if (mist) ({ latT, vMul } = applyMistake(mist, nearIdx));
    }
    return { latT, vMul, thrForce: state.t < state.thrUntil };
  }

  /** Shapes the lateral target: racing-line share, wander and the grid lane at the start. */
  function laneStep(car: AiCar, path: typeof state.path, nearIdx: number, speed: number,
      latIn: number) {
    const pts = path.pts;
    let latT = latIn;
    // ---- the line: less of its width for lower skill (lineQ), plus a slow WANDER, bigger for less
    // skilled drivers
    // (! : the racing line has off at every point)
    const lineOff = path === main ? pts[nearIdx].off! : 0;
    latT += -lineOff * (1 - traits.lineQ);
    latT += traits.wander * (
        0.6 * Math.sin(state.t * 0.37 + wanderPhaseA) + 0.4 * Math.sin(
        state.t * 0.83 + wanderPhaseB));
    // THE START (user, 2026-10-04: "they aim for the racing line a bit too hard at the start of
    // races and it causes crashes — increase crash awareness a tiny bit, more willing to overtake /
    // avoid, without slowing down"): from the moment it moves off, the car KEEPS ITS GRID LANE (its
    // offset from the line when it set off) and eases onto the line over START_BLEND s; in that
    // phase cars alongside get more room (START_GAP) and a car ahead is gone round rather than
    // followed.
    if (state.goT == null && speed > 2 && path === main) {
      state.goT = state.t;
      const here = pts[nearIdx];
      state.gridLat = (car.x - here.x) * -Math.sin(here.h) + (car.y - here.y) * Math.cos(here.h);
    }
    const startK = state.goT == null ? 1 : Math.max(0, 1 - (state.t - state.goT) / START_BLEND);
    if (startK > 0 && path === main && state.gridLat != null) latT += state.gridLat * startK;
    return { latT, lineOff, startK };
  }

  /** Flags a battle (car within 25 m); returns the push factor on the pace. */
  function battleStep(car: AiCar, others: AiCar[]) {
    // BATTLING (user: "scrabbling for victory"): a car within 25 m -> push a little harder, and
    // err a little more
    state.pushing = others.some((other) => Math.hypot(other.x - car.x, other.y - car.y) < 25);
    return (state.pushing ? 1 + 0.02 * traits.aggression : 1) * (
        state.atk ? 1 + 0.02 * traits.aggression : 1) * (
        1 + HARDER * Math.min(1, (state.behindT || 0) / HARDER_T));
  }

  /** Steps round a loose obstacle (cone, tyre) in the way; the dodge target, or null. */
  function obstacleStep(car: AiCar, ctx: DriveCtx, path: typeof state.path, nearIdx: number,
      idx: (pos: number) => number, speed: number, prec: number, lineOff: number,
      myLat: number, latLim: number, latT: number, dt: number) {
    const pts = path.pts, cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
    let dodge: number | null = null;
    const onLine = path === main ? lineOff : 0;
    // ---- OBSTACLES (user, 2026-10-04: "AI need to see tyres and cones as obstacles — although
    // optional ones haha — but try and avoid them
    // on rally stages / tracks"): ctx.obstacles = loose objects near this car ({ x, y, r },
    // main.js). One in my path ahead, on the road ->
    // step round it on the side with room; no room -> drive through (optional). Cars come first:
    // only when no car is in the way. A more
    // precise driver sees it further ahead.
    if (ctx.obstacles) {
      const reach = 6 + speed * (0.6 + 0.6 * prec); let best = null;
      for (const obstacle of ctx.obstacles) {
        const relX = obstacle.x - car.x, relY = obstacle.y - car.y,
            fwd = relX * cosH + relY * sinH;
        if (fwd < 2 || fwd > reach) continue;
        const lat = -relX * sinH + relY * cosH; if (Math.abs(lat) > 8) continue;
        const pos = idx(nearIdx + Math.round(fwd / path.sp)), pathPt = pts[pos], obstLat = (
            obstacle.x - pathPt.x) * -Math.sin(pathPt.h) + (obstacle.y - pathPt.y) * Math.cos(
            pathPt.h);
        // off the road: not in the way
        if (Math.abs(onLine + obstLat) > (path === main ? line.hw + 0.5 : 6)) continue;
        if (Math.abs(obstLat - myLat) < obstacle.r + OBST_CLEAR && (
            !best || fwd < best.f)) best = {
          f: fwd, oc: obstLat, r: obstacle.r
        };
      }
      if (best) {
        const clearance = best.r + OBST_CLEAR + 0.2;
        const cands = [best.oc + clearance, best.oc - clearance].filter(
            (cand) => Math.abs(onLine + cand) <= latLim).sort(
            (first, second) => Math.abs(first - myLat) - Math.abs(second - myLat));
        if (cands.length) {
          dodge = cands[0] - latT;
          state.obst = (state.obst || 0) + dt;
        }
      }
    }
    return dodge;
  }

  function drive(car: AiCar, dt = 1 / 120, ctx: DriveCtx = {}) {
    state.t += dt;
    const spec = car.spec, speed = Math.hypot(car.vx, car.vy);
    if (state.i === null) placeAtStart(car);
    advance(car);
    // ---- DRIVE ITSELF OUT (user, 2026-10-07: "it should try to drive it self out, if it falls
    // super far behind / stays off track too long / stays still / drives too slow for too long, ect
    // it can reset"). Nearly still for DRIVE_OUT_T s after the green (nose in a wall, beached,
    // tangled with a car) -> REVERSE for ~1-1.5 s with the wheel turned to swing the nose back
    // toward the road, then drive on. The game's reset (main.js) is the LAST resort now: it waits
    // longer, so this gets two or three tries first. (! : st.i was set just above)
    {
      const out = driveOut(state, car, speed, dt, ctx, rnd, () => state.path.pts[state.i!].h);
      if (out) return out;
    }
    const lap = ctx.lap || Math.max(1, state.lap), laps = ctx.laps || jLaps;
    const path = state.path, pts = path.pts, size = path.n, idx = (pos: number) => (
        path.closed ? ((pos % size) + size) % size : Math.max(0, Math.min(size - 1, pos)));
    const nearIdx = state.i!; let prof = profileOf(path, spec, main);
    const others = ctx.cars || [];
    const push = battleStep(car, others);

    // ---- JOKER: decide once per lap ~220 m before the branch; take it at the switch point
    const jCap = jokerStep(car, ctx, path, nearIdx, lap, laps);

    // ---- MISTAKES (user: "genuine subtle driving errors that lead to crashes and / or slower lap
    // times"), drawn per corner ~45 m out
    const mistakes = mistakeStep(path, nearIdx);
    let vMul = mistakes.vMul;
    const thrForce = mistakes.thrForce;

    // ---- the line, the wander and the start lane
    const lane = laneStep(car, path, nearIdx, speed, mistakes.latT);
    let latT = lane.latT;
    const lineOff = lane.lineOff, startK = lane.startK;

    // ---- OTHER CARS (user: "avoid waiting for or crashing into other cars, deviating from its
    // chosen path"): a car ahead in the way -> pick the side with room and go round it (that IS the
    // overtake); no room -> sit behind it, matching its speed; a car alongside -> keep a gap; a
    // faster car close behind -> a defensive driver covers its side a little
    const prec = traits.prec ?? 0.5, clear = 2.3 - 0.4 * traits.aggression, gapF = (
        6.5 - 2.5 * traits.aggression) * (1.15 - 0.35 * prec);
    const latLim = path === main ? line.hw - WANDER_EDGE : 2;
    const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
    let dodgeT = 0, followCap = Infinity, conflict = false, lead: Lead | null = null, threat:
        Threat | null = null, side = 0;
    const alg: number[] = [];
    const myLat = state.dodge + latT;
    for (const other of others) {
      const relX = other.x - car.x, relY = other.y - car.y, fwd = relX * cosH + relY * sinH,
          lat = -relX * sinH + relY * cosH;
      if (fwd < -15 || fwd > 8 + speed * 1.1 || Math.abs(lat) > 8) continue;
      // its lateral place relative to MY path
      let closeIdx = nearIdx, closeDist2 = Infinity;
      const span = Math.round((Math.max(0, fwd) + 12) / path.sp);
      for (let offset = -Math.round(16 / path.sp); offset <= span; offset += 1) {
        const slot = idx(nearIdx + offset), dist2 = (pts[slot].x - other.x) ** 2 + (
            pts[slot].y - other.y) ** 2;
        if (dist2 < closeDist2) {
          closeDist2 = dist2;
          closeIdx = slot;
        }
      }
      const point = pts[closeIdx], otherLat = (other.x - point.x) * -Math.sin(point.h) + (
          other.y - point.y) * Math.cos(point.h);
      const vAlong = other.vx * cosH + other.vy * sinH;
      if (fwd > 2.5 && fwd < 22 && Math.abs(otherLat - myLat) < clear + 0.8 && (
          !lead || fwd < lead.f)) lead = {
        c: other, f: fwd, oc: otherLat, vAlong
      };
      if (fwd < -3 && fwd > -16 && vAlong > speed - 1 && (!threat || fwd > threat.f)) threat = {
        c: other, f: fwd, oc: otherLat
      };
      if (state.atk && other === state.atk.car) {
        // the car being ATTACKED: no following gap once we are moving over (only a real overlap
        // close up holds us back)
        if (fwd > 2.5 && fwd < 5 && Math.abs(otherLat - myLat) < 1.5) followCap = Math.min(
            followCap, vAlong + 0.5);
        if (fwd < 4.5 && fwd > -4.5) alg.push(otherLat);
        continue;
      }
      if (fwd > 2.5) {
        // FOLLOWING only while closing, with a short gap: it rubs and bumps in braking zones
        // (aifieldcheck: ~6 s of contact per 3 laps of 6 cars at Realish). USER (2026-10-04, after
        // testing it): "contact is ok … it felt ok before, put it back" — a strict speed-based gap
        // (zero contact, but a procession: 1 position change in 3 laps) was tried and REVERTED.
        if (speed - vAlong > -0.5 && Math.abs(otherLat - myLat) < clear) {
          conflict = true;
          // GO ROUND, DON'T QUEUE (user, 2026-10-04: "AI still seem to almost queue and wait
          // rather than overtake and avoid blocking cars,
          // even if it's slightly off track"): the room to pass may use WIDE m past the usual edge
          // (wheels on the grass), WIDE_SLOW for a
          // car that is much slower or stopped (spun, beached); once a side is chosen it no longer
          // matches the car ahead's speed unless
          // still overlapping it close up. (Was: room inside the edge only, and it slowed to
          // follow whenever within gapF + 4 m even with a
          // side chosen. The room test also subtracted latT — wrong whenever the driver was
          // wandering.)
          const slowBlock = vAlong < Math.min(0.7 * speed, speed - 4) || vAlong < 6;
          const wide = latLim + (slowBlock ? WIDE_SLOW : WIDE);
          const cands = [otherLat + clear, otherLat - clear].filter(
              (cand) => Math.abs(lineOff + cand) <= wide).sort(
              (first, second) => Math.abs(first - myLat) - Math.abs(second - myLat));
          if (cands.length && fwd > 3) {
            dodgeT = cands[0] - latT;
            if (Math.abs(lineOff + cands[0]) > latLim) {
              state.wide = wide;
              state.wideUntil = state.t + 1.2;
            }
          }
          if (!cands.length || (fwd < gapF && Math.abs(otherLat - myLat) < 1.6)) {
            let capF = vAlong + Math.max(0, fwd - gapF) * 0.7;
            // ANTICIPATION (prec): the car ahead will slow to (about) the profile where it is now,
            // so arrive gapF behind at that speed
            // instead of reacting once it brakes — the nose-to-tail hits in braking zones
            // (aifieldsuite: ~40 % of contact events)
            if (prec > 0) {
              const leadSpeed = Math.min(
                  vAlong, prof[idx(closeIdx + Math.round(6 / path.sp))] * traits.pace),
                  brakeDecel = 0.6 * carGrip(spec).brakeG * GRAVITY * (car.surface.mu || 1);
              capF = Math.min(capF, capF * (1 - prec) + prec * Math.sqrt(
                  leadSpeed * leadSpeed + 2 * brakeDecel * Math.max(0, fwd - gapF)));
              }
            followCap = Math.min(followCap, capF);
          }
        }
      } else if (fwd > -4) {
        if (fwd > -2.5) side = side || Math.sign(otherLat - myLat);
        alg.push(otherLat);
        const gapA = 2.4 + START_GAP * startK;
        if (Math.abs(otherLat - myLat) < gapA) {
          conflict = true;
          dodgeT = myLat + Math.sign(myLat - otherLat || 1) * (
              gapA - Math.abs(otherLat - myLat)) - latT;
        }
      } else if (!conflict && traits.defence > 0.5 && vAlong > speed + 0.5 && fwd > -14) {
        dodgeT = Math.max(-1.2, Math.min(1.2, (otherLat - latT) * 0.5)) * traits.defence;
      }
    }
    // ---- OBSTACLES (user, 2026-10-04: "AI need to see tyres and cones as obstacles — although
    // optional ones haha — but try and avoid them
    // on rally stages / tracks"): ctx.obstacles = loose objects near this car ({ x, y, r },
    // main.js). One in my path ahead, on the road ->
    // step round it on the side with room; no room -> drive through (optional). Cars come first:
    // only when no car is in the way. A more
    // precise driver sees it further ahead.
    if (!conflict) {
      const around = obstacleStep(car, ctx, path, nearIdx, idx, speed, prec, lineOff, myLat, latLim,
          latT, dt);
      if (around !== null) {
        conflict = true;
        dodgeT = around;
      }
    }
    // ---- RACECRAFT (stage 3, 2026-10-04; user: "real overtakes, real defending, scrabbling for
    // victory"). Stage 2 only went round a car
    // that was already in the way, so circuits were processions (aifieldsuite, Realish: 35 held
    // passes in 12 six-car 3-lap races, Brands
    // and Naffcar ~0). ATTACK: sat behind the same car (longer for the cautious) with a corner
    // coming -> commit to a side for that corner:
    // the INSIDE, unless the car ahead already covers it, then round the OUTSIDE for the
    // switch-back; brake later (K_BRAKE + ATK_KB) and
    // push a little. Ends past the apex, once ahead, if it drops back or after 7 s. DEFENCE: a car
    // closing behind with a corner coming ->
    // a defensive driver (chance = defence) moves over to COVER THE INSIDE once, and pays for the
    // tighter line (3 % slower in the corner).
    if (path === main) {
      if (lead) state.nearT = (state.nearT || 0) + dt;
      if (lead && lead.c === state.leadCar) state.behindT += dt;
      else {
        state.leadCar = lead ? lead.c : null;
        state.behindT = 0;
      }
      const cur = line.cid[nearIdx]; let nextCorner = -1, nextDist = 0;
      for (let offset = 1, limit = Math.round(150 / line.sp); offset < limit; offset++) {
        const cid = line.cid[(nearIdx + offset) % count];
        if (cid >= 0 && cid !== cur) {
          nextCorner = cid;
          nextDist = offset * line.sp;
          break;
        }
      }
      const past = (plan: { corner: number }) => plan.corner >= 0 && cur === plan.corner && (
          (nearIdx - line.corners[plan.corner].apex + count) % count) < count / 2;
      if (state.atk) {
        const attack = state.atk, fwd = (attack.car.x - car.x) * cosH + (
            attack.car.y - car.y) * sinH;
        if (fwd < -5 || fwd > 35 || state.t - attack.t0 > (attack.corner < 0 ? 9 : 7) || past(
            attack)) state.atk = null;
        }
      if (!state.atk && lead && nextCorner >= 0 && nextCorner !== state.atkCorner &&
          nextDist > 15 && nextDist < 140 && lead.vAlong < speed + 2
        && state.behindT > Math.max(0.15, 0.6 - 0.5 * traits.aggression)) {
        state.atkCorner = nextCorner;
        if (!debugValue("NOATK") && rnd() < 0.6 + 0.4 * traits.aggression) {
          const turn = line.corners[nextCorner].turn, leadAbs = lineOff + lead.oc;
          const attackSide = Math.sign(leadAbs) === turn && Math.abs(leadAbs) > 0.4 * latLim ?
              -turn : turn;
          state.atk = {
            car: lead.c, side: attackSide, corner: nextCorner, t0: state.t
          };
          state.nAtk = (state.nAtk || 0) + 1;
        }
      }
      // TOW PASS (ovals, long straights: no corner close enough to brake into): in the slipstream
      // of the same car for a while -> pull out to the side with more room and drive past on the
      // extra speed (contact.js slipstream)
      if (!state.atk && lead && (nextCorner < 0 || nextDist > 140) && (car.dragMul ?? 1) < 0.85 &&
          state.behindT > Math.max(0.3, 1 - 0.7 * traits.aggression)
        && state.t - (state.towT || -99) > 4) {
        state.towT = state.t;
        if (!debugValue("NOATK") && rnd() < 0.6 + 0.4 * traits.aggression) {
          const leadAbs = lineOff + lead.oc, ahead = pts[
              idx(nearIdx + Math.round(80 / path.sp))].turn || 1;
          const passSide = Math.abs(leadAbs) > 0.3 * latLim ? -Math.sign(leadAbs) : ahead;
          state.atk = {
            car: lead.c, side: passSide, corner: -1, t0: state.t
          };
          state.nAtk = (state.nAtk || 0) + 1;
        }
      }
      // GIVING ROOM: a car alongside on the INSIDE of the corner we are entering, and we are not
      // attacking -> concede a little (a defensive driver less), as real drivers do rather than
      // turn in on it
      const insideOf = cur >= 0 ? line.corners[cur].turn : nextCorner >= 0 && nextDist < 40 ?
          line.corners[nextCorner].turn : 0;
      if (!state.atk && side && side === insideOf) vMul *= 1 - YIELD * (1.2 - traits.defence);
      if (state.cover && (past(state.cover) || state.t - state.cover.t0 > 6)) state.cover = null;
      if (!state.cover && !state.atk && threat && threat.f < -5 && nextCorner >= 0 &&
          nextCorner !== state.covCorner && nextDist < 110) {
        state.covCorner = nextCorner;
        if (!debugValue("NOCOV") && rnd() < (
            0.5 + 0.5 * (traits.prec ?? 0.5)) * traits.defence) state.cover = {
          side: line.corners[nextCorner].turn, corner: nextCorner, t0: state.t
        };
      }
      if (state.atk) {
        conflict = true;
        dodgeT = state.atk.side * (latLim - 1.0) - lineOff - latT;
        prof = profileOf(path, spec, main, K_BRAKE + ATK_KB);
      }
      else if (state.cover) {
        conflict = true;
        dodgeT = state.cover.side * 0.6 * latLim - lineOff - latT;
      }
      // never squeeze a car that is ALONGSIDE: the racecraft target keeps ALONG_GAP from it
      // (attacks ignored it: side contact 41 -> 110 events on one Thruston run, MEASURED)
      if (state.atk || state.cover) {
        let target = latT + dodgeT;
        for (const alongOther of alg) if (
            Math.abs(target - alongOther) < ALONG_GAP) target = alongOther + Math.sign(
            myLat - alongOther || 1) * ALONG_GAP;
        dodgeT = target - latT;
      }
      state.cc = cur >= 0 ? cur : nextDist < 80 ? nextCorner : -1;
    } else { state.atk = null; state.cover = null; state.cc = -1; }
    const rate = state.atk ? 3.5 : 2.5;
    state.dodge += Math.max(-rate * dt, Math.min(rate * dt, dodgeT - state.dodge)) * (
        conflict ? 1 : 0.5);
    state.follow = followCap < Infinity;
    latT += state.dodge;
    // past the usual edge only while going round a car (above)
    const edge = state.t < (state.wideUntil || 0) ? state.wide! : latLim;
    latT = Math.max(-edge, Math.min(edge, lineOff + latT)) - lineOff;
    // OFF THE LINE INTO A CORNER (an attack, a cover, a dodge, a wander): the profile is for the
    // racing line's radius; x m further INSIDE at the apex is a radius R - x, so the corner speed
    // drops by sqrt((R - x) / R). Without it attackers ran wide on the exit (aifieldsuite Realish
    // off-road 142 -> 299 car-s, MEASURED). (applied in the SPEED section: every bend ahead within
    // braking distance, not only the "corners" — Naffcar's banked turns are wider than CORNER_R,
    // and tow passes on their inside slid off: off-road 0 -> 14 car-s, MEASURED)

    // ---- steering: Stanley on the path + latT at the front axle (the bench driver's controller)
    const frontX = car.x + cosH * spec.lf, frontY = car.y + sinH * spec.lf;
    let frontIdx = nearIdx, frontDist2 = Infinity;
    for (let offset = -2; offset <= 10; offset++) {
      const pos = idx(nearIdx + offset), dist2 = (pts[pos].x - frontX) ** 2 + (
          pts[pos].y - frontY) ** 2;
      if (dist2 < frontDist2) {
        frontDist2 = dist2;
        frontIdx = pos;
      }
    }
    const look = Math.round((2 + speed * 0.15) / path.sp), ahead = pts[idx(frontIdx + look)],
        frontPt = pts[frontIdx];
    let psi = ahead.h - car.heading; psi = Math.atan2(Math.sin(psi), Math.cos(psi));
    const cross = (frontX - frontPt.x) * -Math.sin(frontPt.h) + (frontY - frontPt.y) * Math.cos(
        frontPt.h) - latT;
    const deltaS = psi + Math.atan2(-1.2 * cross, speed + 2) - 0.03 * (
        car.yawRate - speed * Math.tan(car.delta) / spec.L);
    const muHere = car.surface.mu * spec.mu;
    // cap: the kinematic angle for the grip-limited turn + a front slip allowance (the bench cap
    // pinned at ~0.1 at 35 m/s: ran wide)
    const LOCK = spec.steerMax || 0.56;
    const cap = Math.min(
        1, (1.3 * spec.L * muHere * GRAVITY / Math.max(4, speed * speed) + 0.12) / LOCK);
    // OVERSTEER (rear slip past ~10 deg): no cap, so it can countersteer; UNDERSTEER (front past ~8
    // deg): more lock only scrubs, so lift and brake to get the front back (MEASURED: Sweaty Lamb's
    // S at sF 0.27 rad, then a spin at sR -0.78) LOOSE SURFACES (user, 2026-10-04: "slow down
    // weirdly on surface changes, dirt to tarmac — they should predict it and speed up"). loose = 0
    // on tarmac (mu 1) .. 1 at mu 0.5. MEASURED (tools/aisurface, rally-4x4 Real): 19 of 26 Slidden
    // surface changes lifted > 0.3 s with the target still above the speed — mostly WHEELSPIN
    // halving the throttle (normal on dirt), then the front-slip "understeer" lift. On loose
    // ground: no wheelspin cut, and 0.06 rad more front slip before the understeer lift -> 10 of
    // 26; laps (Real) Knobhill 47.6 -> 45.8 hatch / 41.5 -> 40.5 4x4, Sweaty Lamb 128.5 -> 125.2 /
    // 114.4 -> 112.7, Slidden 55.9 -> 55.1, tarmac unchanged. TRIED and REJECTED (same tool): more
    // rear slip before lifting, a later slide catch and power through the slide — each alone
    // harmless, together the 4x4 left the road at Knobhill / Sweaty Lamb (16-31 s off a lap).
    const loose = Math.max(0, Math.min(1, (1 - car.surface.mu) / 0.5));
    const slipFront = Math.abs(car.t.slipF || 0), slipRear = Math.abs(car.t.slipR || 0);
    // DRIFT HOLD (user, 2026-10-04: "really need AI to drift and handbrake sometimes / aggressive
    // off-road driving"): on loose ground, in a
    // corner, in a car with the drive at the back (RWD / rear-biased AWD), a slide is HELD — the
    // rear kept near DRIFT_SLIP with the throttle,
    // countersteer free — instead of caught at 0.18 rad (which lifted and tiptoed). Past DRIFT_MAX
    // it is caught as before. A bolder driver
    // (aggression) drifts more often (decided per corner).
    const inCorner = path === main && line.cid[nearIdx] >= 0;
    if (inCorner && state.driftCorner !== line.cid[nearIdx]) {
      state.driftCorner = line.cid[nearIdx];
      state.driftOn = state.t > (state.driftBan || 0) && rnd() < (
          debugValue("DRIFT") as number ?? (0.45 + 0.5 * traits.aggression));
    }
    // ... and never near the road edge (a held drift there ran a Rally car off Sweaty Lamb 12 s a
    // lap): within EDGE_DRIFT m it catches
    // m from the car to the nearer edge
    const nearPt = pts[nearIdx], edgeRoom = path === main ? line.hw - Math.abs(
        lineOff + (car.x - nearPt.x) * -Math.sin(nearPt.h) + (car.y - nearPt.y) * Math.cos(
        nearPt.h)) : 0;
    const drifting = state.driftOn && inCorner && loose > 0.3 && (spec.drive ?? 1) < 0.5 &&
        slipRear > 0.12 && slipRear < DRIFT_MAX && speed > 6 && edgeRoom > EDGE_DRIFT && pts[
        line.corners[line.cid[nearIdx]].apex].R < DRIFT_R;
    const over = slipRear > 0.18 && speed > 5 && !drifting,
        under = slipFront > 0.14 + 0.06 * loose && speed > 5 && !over && !drifting;
    const steer = over || drifting ? Math.max(-1, Math.min(1, deltaS / LOCK)) : Math.max(
        -cap, Math.min(cap, deltaS / LOCK));
    state.cap = cap;

    // ---- SPEED: the profile (it already brakes for what is ahead) x pace x mistakes, capped by
    // the joker approach and traffic
    let targetSpeed = Infinity; const span = Math.round((3 + speed * 0.25) / path.sp);
    for (let offset = 0; offset <= span; offset++) targetSpeed = Math.min(
        targetSpeed, prof[idx(nearIdx + offset)]);
    if (path === main && Math.abs(latT) > 0.3) {
      const brakeDecel = (debugValue("AI_KB") as number || K_BRAKE) * pts[nearIdx].mu * carGrip(
          spec).brakeG * GRAVITY, far = Math.round(
          (speed * speed / (2 * brakeDecel) + 15) / path.sp);
      for (let offset = 0; offset <= far; offset += 2) {
        const pos = idx(nearIdx + offset), bend = pts[pos], x = (
            lineOff + latT - bend.off!) * bend.turn;
        if (x > 0.3 && bend.R < 400) {
          const bendSpeed = prof[pos] * Math.sqrt(Math.max(0.4, (bend.R - x) / bend.R));
          targetSpeed = Math.min(
              targetSpeed, Math.sqrt(bendSpeed * bendSpeed + 2 * brakeDecel * offset * path.sp));
        }
        }
    }
    targetSpeed = Math.min(targetSpeed * traits.pace * push * vMul, jCap, followCap);
    state.vT = targetSpeed;
    // (no WHEELSPIN cut any more: it halved the throttle on tarmac too, so a car coming off dirt
    // with its wheels still spinning lifted at
    // the transition — the user's 'still slow down on transition change'. MEASURED without it
    // (aidrivecheck, 6 levels x 3 cars x Realish +
    // Real): 0 to 0.6 s faster everywhere, nothing slower; aisurface Slidden 4x4: 8 -> 6 lifts at
    // changes.)
    const slideR = slipRear, feel = Math.max(0, 1 - Math.max(0, slideR - 0.07) / 0.12);
    // OFF ROAD / LOOSE (user, 2026-10-04: "they still slow down like mad off road / changing
    // surfaces"): on loose ground a sliding front is the surface, not a mistake — keep driving
    // (UNDER_LOOSE throttle) and never brake for it. MEASURED before (aifieldcheck SURF, Brands +
    // Castle Cum, 6 cars): on grass / dirt the AI braked 26-36 % and lifted 13-33 % of the time,
    // front slip > 0.14 for 19-40 %. ...only OFF THE PLANNED SURFACE (the car on clearly worse
    // ground than its racing line: off the road, onto a loose patch). On a loose line (Sweaty
    // Lamb's gravel) the old lift + brake stays: applied there too, the 4x4 at Real left the stage
    // 16 s a lap (MEASURED).
    const offPlan = path === main && car.surface.mu < 0.85 * (pts[nearIdx].mu || 1);
    const looseUnder = under && loose > 0.3 && offPlan;
    if (drifting) { state.driftT = (state.driftT || 0) + dt; state.lastDrift = state.t; }
    // a drift that ran it OFF the road: it backs off drifting for DRIFT_BAN s (a driver who scares
    // himself)
    // off within 2 s of a drift
    if (edgeRoom < -0.5 && state.t - (state.lastDrift ?? -99) < 2) {
      state.driftOn = false;
      state.driftBan = state.t + DRIFT_BAN;
    }
    let throttle = drifting ? Math.max(0.25, Math.min(1, 0.6 + (DRIFT_SLIP - slipRear) * 3)) * (
        speed < targetSpeed * 1.1 ? 1 : 0.4) : looseUnder ? Math.min(
        UNDER_LOOSE, speed < targetSpeed ? (targetSpeed - speed) * 0.6 : 0) : under ? 0 : over ? (
        speed < targetSpeed ? Math.min(0.2, (targetSpeed - speed) * 0.6) : 0) :
        speed < targetSpeed ? Math.min(1, (targetSpeed - speed) * 0.6) * feel : 0;
    if (thrForce && speed < targetSpeed * 1.1) throttle = 1;
    let brake = speed > targetSpeed + 0.3 ? Math.min(1, (speed - targetSpeed) * 1.5) * Math.max(
        0.6, 1 - Math.abs(steer) / 0.5) : 0;
    if (under && !looseUnder && speed > 0.85 * targetSpeed) brake = Math.max(brake, 0.35);
    if (over || drifting) brake = 0;
    // HANDBRAKE TURNS (user, 2026-10-04: "they should also use handbrake and drift and stuff"):
    // into a HAIRPIN (apex R < HB_R) before the apex, a big turn still ahead (> HB_TURN rad) and
    // moving -> one pull of HB_T s per hairpin, off the throttle, full lock that way: the rear
    // steps out and the car pivots. The better driver times it (skill), a weaker one sometimes
    // doesn't bother.
    let handbrake = 0;
    if (path === main && speed > 6 && (debugValue("HB") ?? 1)) {
      const cornerId = line.cid[nearIdx], corner = cornerId >= 0 ? line.corners[cornerId] : null;
      // turn-in: a corner that turns > HB_TURN rad in all (summed once along its run) with an apex
      // tighter than HB_R (+ HB_LOOSE on loose
      // ground), the apex within ~0.8 s
      if (corner && corner.angle === undefined) {
        let sum = 0;
        for (let i = corner.start; line.cid[i] === cornerId; i = (i + 1) % count) {
          const step = pts[(i + 1) % count].h - pts[i].h;
          sum += Math.atan2(Math.sin(step), Math.cos(step));
        }
        corner.angle = Math.abs(sum);
      }
      const toApex = ((corner ? corner.apex : nearIdx) - nearIdx + count) % count;
      if (corner && corner.angle! > HB_TURN && pts[corner.apex].R < HB_R + HB_LOOSE * loose &&
          toApex < count / 2 && toApex * line.sp < 0.8 * speed + 6 &&
          state.hbCorner !== cornerId) {
        state.hbCorner = cornerId;
        if (rnd() < 0.5 + 0.5 * traits.skill) state.hbUntil = state.t + HB_T;
      }
      if (state.t < state.hbUntil) {
        handbrake = 1;
        throttle = 0;
        brake = 0;
        state.hbN = (state.hbN || 0) + 1;
      }
    }
    return {
      steer: handbrake ? Math.sign(steer || psi) * Math.max(Math.abs(steer), 0.9) : steer,
          throttle, brake, handbrake
    };
  }
  // put back on the road by the game (stuck / broken): find its place again, forget the dodge and
  // any mistake in progress
  const relocate = () => {
    state.i = null;
    state.path = main;
    state.dodge = 0;
    state.mist = null;
    state.thrUntil = 0;
    state.revUntil = 0;
    state.slowT = 0;
    state.outN = 0;
    state.giveUp = false;
  };
  return { drive, state: state, total: line.total, traits, relocate };
}
export type AIDriver = ReturnType<typeof createAIDriver>;
