// ai/circuit.js — the racing AI driver for circuits: createAIDriver (split from aidriver.js).
// The cautious BENCH driver stays in autodrive.js (lap tools, menu demo, pace car).
//
// USER SPEC (2026-10-04): AI know RACING LINES and how to overtake; SURFACE AWARENESS (stay on faster / grippier ground when quicker);
// the difficulty is the CENTRE of a GRADIENT across the field ("some drive better, some quicker, some more defensive, some more
// aggressive"); VARIATION OFF THE LINE grows as difficulty drops ("worse AI more random, better AI like a professional: fast and on line");
// difficulty comes from "how fast, how few mistakes, racing lines, tactics like pit stops and joker laps, deviation from the line"; the AI
// should feel like it's SCRABBLING for victory or making GENUINE SUBTLE DRIVING ERRORS that lead to crashes and / or slower laps; take
// JOKER laps randomly / tactically; AVOID waiting for or crashing into other cars, deviating from its chosen path to do it; on Slidden
// Hill take the TRADITIONAL START (the RX start straight), not a dash to the nearest bit of lap.
//
// 4. DRIVING: Stanley steering onto the path + a lateral target (wander, mistakes, avoidance), target speed = profile x pace.
import { parkMiller } from "../core/random.ts";
import { debugValue } from "../core/debug.ts";
import { querySubtrack } from "../world/tyrewall.ts";
import { GRAVITY } from "../cars.js";
import { aiTraits } from "./traits.ts";
import { K_BRAKE, OBST_CLEAR, racingLine, nearestIdx, carGrip, profileOf } from "./line.ts";
import { roadDriver, driveOut } from "./weaver.ts";
import type { Level } from "../world/types.ts";
import type {
  AiCar, CircuitState, DriveCtx, HighwayLevel, JokerCtx, Lead, Threat,
} from "./types.ts";

const WANDER_EDGE = 1.1;     // m: the lateral target never puts the car's centre closer than this to the road edge
const ATK_KB = 0.12;         // extra braking grip planned while ATTACKING (late braking into the corner)
const YIELD = 0.05;          // speed given up to a car alongside on the inside (x 1.2 - defence)
const ALONG_GAP = 2.7;       // m kept from a car alongside by an attack or a cover move
const HB_R = 25, HB_LOOSE = 8, HB_TURN = 1.4, HB_T = 0.25;   // handbrake turns: apex R (m, + HB_LOOSE on loose ground), corner turn (rad), pull (s).
// MEASURED (aidrivecheck, HB on/off, Realish + Real, hatch + 4x4): Slidden / Knobhill / Castle Cum within 0.1 s, Sweaty Lamb +0.2..+0.7 s,
// 6 pulls per 2 min at Slidden, 4 at Sweaty Lamb — it is FLAVOUR (the user's "drift and stuff"), not pace. A heading-error trigger fired ~never.
const WIDE = +(debugValue("WIDE") ?? 0.8), WIDE_SLOW = 2.5;   // m past the usual edge allowed to get round a car / a slow or stopped one
const UNDER_LOOSE = 0.35;    // throttle kept through a front slide on loose ground (off road, dirt, gravel)
// MEASURED (aifieldsuite Realish, 24 races): before start-contacts 765, contact 231 s, resets 14, passes 118; 6 s / 0.8 m: 564, 258 s, 17,
// 219; 9 s / 1.3 m (kept): 492, 212 s, 9, 192 (off-road +12 %)
const START_BLEND = 9, START_GAP = 1.3;   // s to ease from the grid lane onto the line; m more room alongside then
const DRIFT_SLIP = 0.22, DRIFT_MAX = 0.4, DRIFT_R = 35;   // + only in corners with an apex tighter than DRIFT_R m (hairpins / junctions)   // rad: the rear slip a drifting AI holds, and where it gives up and catches it
const EDGE_DRIFT = 2.0, DRIFT_BAN = 60;
// NEVER WAIT (user, 2026-10-07: "patience they should never really wait imo, just try harder and go faster"): seconds of being held up before
// a pass is tried were 0.3-1.5 s (by aggression), now 0.15-0.6; the chance to commit to one per corner 30-90 % -> 60-100 %; and sat behind
// a car it PUSHES HARDER, up to HARDER faster the longer it is held.
const HARDER = 0.03, HARDER_T = 4;

// ---------------------------------------------------------------- the driver
// drive(car, dt, ctx): ctx = { cars: [other car objects], lap: current lap (1-based), laps: race length }. Other cars may carry
// _jokers (jokers taken) for the joker tactics.
export function createAIDriver(level: Level, traits = aiTraits(4, 0, 1)) {
  // the ENDLESS highway has no closed lap to plan a line round: the same driver reads the road frame instead (roadDriver above)
  // (cast: an endless Level is the highway's level, whose road fields ai/types.ts HighwayLevel describes)
  if (level.endless) {
    return roadDriver(
      level as unknown as HighwayLevel, traits,
      parkMiller(((traits.seed || 4242) * 31 + 7) % 2147483647 || 1),
    );
  }
  // (! : racingLine has just made the branches)
  const L = racingLine(level), main = L, B = level._branches!, n = L.n;
  const rnd = parkMiller(traits.seed || 4242);
  const w1 = rnd() * 6.28, w2 = rnd() * 6.28;
  const jLaps = (level.joker && level.joker.laps) || 5;
  // the joker PLAN: a lap drawn from a spread (rarely the first, when the field is packed), tactics can override it on the day
  const jPlan = (() => { const r = rnd(), cum = [0.12, 0.35, 0.6, 0.82, 1.0]; for (let k = 0; k < cum.length; k++) if (r < cum[k]) return Math.min(jLaps, k + 1); return jLaps; })();
  const st: CircuitState = { path: main, i: null, vT: 0, t: 0, lap: 0, jokers: 0, jPlan, jWant: false, jDecLap: -1, jForget: rnd() < (traits.slip || 0),
    mist: null, mistCorner: -1, dodge: 0, follow: false, cap: 0, lastDist: 0, pushing: false, thrUntil: 0,
    atk: null, atkCorner: -1, hbCorner: -1, hbUntil: 0, cover: null, covCorner: -1, leadCar: null, behindT: 0 };

  function advance(car: AiCar) {
    const P = st.path, pts = P.pts, N = P.n;
    let bi = st.i!, bd = Infinity;   // (! : drive finds its place before it calls advance)
    for (let o = -4; o <= 30; o++) {
      let i = st.i! + o; if (P.closed) i = (i + N) % N; else if (i < 0 || i >= N) continue;
      const q = (pts[i].x - car.x) ** 2 + (pts[i].y - car.y) ** 2; if (q < bd) { bd = q; bi = i; }
    }
    if (P === main && st.i! > N * 0.8 && bi < N * 0.2) st.lap++;
    st.i = bi; st.lastDist = Math.sqrt(bd);
    // off the end of a branch: back onto the line where it merged
    // (! : a branch always has rejoin)
    if (P !== main && bi >= N - 2) { st.path = main; st.i = P.rejoin!; advance(car); }
  }
  function decideJoker(ctx: JokerCtx, lap: number, laps: number) {
    st.jDecLap = lap;
    if (!B.joker || st.jokers > 0) { st.jWant = false; return; }
    if (lap >= laps) { st.jWant = !st.jForget; return; }      // last chance (a low-skill driver may simply forget: +30 s)
    if (lap === st.jPlan) { st.jWant = true; return; }
    // TACTICS: stuck behind someone -> "jump" them with the joker (more likely the more aggressive); a rival right behind who has
    // already jokered -> cover them now before they gain the clean air (more likely the more defensive)
    const me = ctx.self; let ahead = false, coverIt = false;
    for (const c of ctx.cars || []) {
      const dx = c.x - me.x, dy = c.y - me.y, f = dx * Math.cos(me.heading) + dy * Math.sin(me.heading), d = Math.hypot(dx, dy);
      if (f > 0 && d < 30) ahead = true;
      if (f < 0 && d < 25 && (c._jokers || 0) > 0) coverIt = true;
    }
    st.jWant = (ahead && rnd() < 0.2 + 0.5 * traits.aggression) || (coverIt && rnd() < 0.2 + 0.5 * traits.defence);
  }
  function startMistake(cIdx: number) {
    const r = rnd(), kind = r < 0.4 ? 'late' : r < 0.65 ? 'early' : r < 0.85 ? 'throttle' : 'lift';
    st.mist = { kind, sev: Math.min(1, (0.3 + 0.7 * rnd()) * (1.2 - traits.skill)), corner: cIdx, inside: false, t: 0 };
  }

  function drive(car: AiCar, dt = 1 / 120, ctx: DriveCtx = {}) {
    st.t += dt;
    const sp = car.spec, v = Math.hypot(car.vx, car.vy);
    if (st.i === null) {
      // the START: a car sitting on the RX start straight drives it (user: "the traditional start"), else the line
      if (B.start && querySubtrack(level.subtrack!, car.x, car.y).dist > L.hw && Math.hypot(...(() => { const k = nearestIdx(B.start.pts, car.x, car.y), p = B.start.pts[k]; return [p.x - car.x, p.y - car.y]; })()) < 12) {
        st.path = B.start; st.i = nearestIdx(B.start.pts, car.x, car.y);
      } else { st.path = main; st.i = nearestIdx(main.pts, car.x, car.y); }
    }
    advance(car);
    // ---- DRIVE ITSELF OUT (user, 2026-10-07: "it should try to drive it self out, if it falls super far behind / stays off track too long /
    // stays still / drives too slow for too long, ect it can reset"). Nearly still for DRIVE_OUT_T s after the green (nose in a wall, beached,
    // tangled with a car) -> REVERSE for ~1-1.5 s with the wheel turned to swing the nose back toward the road, then drive on. The game's
    // reset (main.js) is the LAST resort now: it waits longer, so this gets two or three tries first.
    // (! : st.i was set just above)
    { const o = driveOut(st, car, v, dt, ctx, rnd, () => st.path.pts[st.i!].h); if (o) return o; }
    const lap = ctx.lap || Math.max(1, st.lap), laps = ctx.laps || jLaps;
    const P = st.path, pts = P.pts, N = P.n, idx = (k: number) => (P.closed ? ((k % N) + N) % N : Math.max(0, Math.min(N - 1, k)));
    const bi = st.i; let prof = profileOf(P, sp, main);
    const others = ctx.cars || [];
    // BATTLING (user: "scrabbling for victory"): a car within 25 m -> push a little harder, and err a little more
    st.pushing = others.some((c) => Math.hypot(c.x - car.x, c.y - car.y) < 25);
    const push = (st.pushing ? 1 + 0.02 * traits.aggression : 1) * (st.atk ? 1 + 0.02 * traits.aggression : 1) * (1 + HARDER * Math.min(1, (st.behindT || 0) / HARDER_T));

    // ---- JOKER: decide once per lap ~220 m before the branch; take it at the switch point
    let jCap = Infinity;
    if (B.joker && P === main) {
      const dSw = (((B.joker.switchI! - bi) % n) + n) % n * L.sp;
      if (dSw < 220 && st.jDecLap !== lap) decideJoker({ ...ctx, self: car }, lap, laps);
      if (st.jWant) {
        const vJ = profileOf(B.joker, sp, main)[0], aB = K_BRAKE * carGrip(sp).brakeG * GRAVITY * 0.8;
        jCap = Math.sqrt(vJ * vJ + 2 * aB * dSw);
        if (dSw <= 3) { st.path = B.joker; st.i = 0; st.jokers++; st.jWant = false; }
      }
    }

    // ---- MISTAKES (user: "genuine subtle driving errors that lead to crashes and / or slower lap times"), drawn per corner ~45 m out
    let latT = 0, vMul = 1, thrForce = false;
    if (P === main) {
      const cA = L.cid[(bi + Math.round(45 / L.sp)) % n];
      if (cA >= 0 && cA !== st.mistCorner) { st.mistCorner = cA; st.mist = null; if (rnd() < traits.mistake * (st.pushing ? 1.6 : 1)) startMistake(cA); }
      const m = st.mist;
      if (m) {
        const C = L.corners[m.corner], inC = L.cid[bi] === m.corner, pastApex = inC && ((bi - C.apex + n) % n) < n / 2;
        if (inC) m.inside = true;
        if (m.inside && !inC) st.mist = null;    // through the corner: done
        else if (m.kind === 'late' && !pastApex) vMul = 1.06 + 0.14 * m.sev;                  // brakes late: runs wide, maybe off
        else if (m.kind === 'early' && !pastApex) latT += C.turn * (1 + 2 * m.sev);            // turns in early: clips the inside
        else if (m.kind === 'lift') vMul = 1 - (0.05 + 0.1 * m.sev);                           // hesitates: just slow
        else if (m.kind === 'throttle' && pastApex && !m.fired) { m.fired = true; st.thrUntil = st.t + 0.3 + 0.5 * m.sev; }   // too much, too soon: a slide
      }
    }
    if (st.t < st.thrUntil) thrForce = true;

    // ---- the line: less of its width for lower skill (lineQ), plus a slow WANDER, bigger for less skilled drivers
    const lineOff = P === main ? pts[bi].off! : 0;   // (! : the racing line has off at every point)
    latT += -lineOff * (1 - traits.lineQ);
    latT += traits.wander * (0.6 * Math.sin(st.t * 0.37 + w1) + 0.4 * Math.sin(st.t * 0.83 + w2));
    // THE START (user, 2026-10-04: "they aim for the racing line a bit too hard at the start of races and it causes crashes — increase crash
    // awareness a tiny bit, more willing to overtake / avoid, without slowing down"): from the moment it moves off, the car KEEPS ITS GRID
    // LANE (its offset from the line when it set off) and eases onto the line over START_BLEND s; in that phase cars alongside get more
    // room (START_GAP) and a car ahead is gone round rather than followed.
    if (st.goT == null && v > 2 && P === main) { st.goT = st.t; const p0 = pts[bi]; st.gridLat = (car.x - p0.x) * -Math.sin(p0.h) + (car.y - p0.y) * Math.cos(p0.h); }
    const startK = st.goT == null ? 1 : Math.max(0, 1 - (st.t - st.goT) / START_BLEND);
    if (startK > 0 && P === main && st.gridLat != null) latT += st.gridLat * startK;

    // ---- OTHER CARS (user: "avoid waiting for or crashing into other cars, deviating from its chosen path"): a car ahead in the way
    // -> pick the side with room and go round it (that IS the overtake); no room -> sit behind it, matching its speed; a car alongside
    // -> keep a gap; a faster car close behind -> a defensive driver covers its side a little
    const prec = traits.prec ?? 0.5, clear = 2.3 - 0.4 * traits.aggression, gapF = (6.5 - 2.5 * traits.aggression) * (1.15 - 0.35 * prec);
    const latLim = P === main ? L.hw - WANDER_EDGE : 2;
    const ch = Math.cos(car.heading), sh = Math.sin(car.heading);
    let dodgeT = 0, followCap = Infinity, conflict = false, lead: Lead | null = null, threat: Threat | null = null, side = 0; const alg: number[] = [];
    const myLat = st.dodge + latT;
    for (const c of others) {
      const rx = c.x - car.x, ry = c.y - car.y, f = rx * ch + ry * sh, l = -rx * sh + ry * ch;
      if (f < -15 || f > 8 + v * 1.1 || Math.abs(l) > 8) continue;
      // its lateral place relative to MY path
      let ci = bi, cd = Infinity; const span = Math.round((Math.max(0, f) + 12) / P.sp);
      for (let o = -Math.round(16 / P.sp); o <= span; o += 1) { const k = idx(bi + o), q = (pts[k].x - c.x) ** 2 + (pts[k].y - c.y) ** 2; if (q < cd) { cd = q; ci = k; } }
      const p = pts[ci], oc = (c.x - p.x) * -Math.sin(p.h) + (c.y - p.y) * Math.cos(p.h);
      const vAlong = c.vx * ch + c.vy * sh;
      if (f > 2.5 && f < 22 && Math.abs(oc - myLat) < clear + 0.8 && (!lead || f < lead.f)) lead = { c, f, oc, vAlong };
      if (f < -3 && f > -16 && vAlong > v - 1 && (!threat || f > threat.f)) threat = { c, f, oc };
      if (st.atk && c === st.atk.car) {
        // the car being ATTACKED: no following gap once we are moving over (only a real overlap close up holds us back)
        if (f > 2.5 && f < 5 && Math.abs(oc - myLat) < 1.5) followCap = Math.min(followCap, vAlong + 0.5);
        if (f < 4.5 && f > -4.5) alg.push(oc);
        continue;
      }
      if (f > 2.5) {
        // FOLLOWING only while closing, with a short gap: it rubs and bumps in braking zones (aifieldcheck: ~6 s of contact per 3 laps
        // of 6 cars at Realish). USER (2026-10-04, after testing it): "contact is ok … it felt ok before, put it back" — a strict
        // speed-based gap (zero contact, but a procession: 1 position change in 3 laps) was tried and REVERTED.
        if (v - vAlong > -0.5 && Math.abs(oc - myLat) < clear) {
          conflict = true;
          // GO ROUND, DON'T QUEUE (user, 2026-10-04: "AI still seem to almost queue and wait rather than overtake and avoid blocking cars,
          // even if it's slightly off track"): the room to pass may use WIDE m past the usual edge (wheels on the grass), WIDE_SLOW for a
          // car that is much slower or stopped (spun, beached); once a side is chosen it no longer matches the car ahead's speed unless
          // still overlapping it close up. (Was: room inside the edge only, and it slowed to follow whenever within gapF + 4 m even with a
          // side chosen. The room test also subtracted latT — wrong whenever the driver was wandering.)
          const slowBlock = vAlong < Math.min(0.7 * v, v - 4) || vAlong < 6;
          const wide = latLim + (slowBlock ? WIDE_SLOW : WIDE);
          const cands = [oc + clear, oc - clear].filter((o) => Math.abs(lineOff + o) <= wide).sort((a, b) => Math.abs(a - myLat) - Math.abs(b - myLat));
          if (cands.length && f > 3) { dodgeT = cands[0] - latT; if (Math.abs(lineOff + cands[0]) > latLim) { st.wide = wide; st.wideUntil = st.t + 1.2; } }
          if (!cands.length || (f < gapF && Math.abs(oc - myLat) < 1.6)) {
            let capF = vAlong + Math.max(0, f - gapF) * 0.7;
            // ANTICIPATION (prec): the car ahead will slow to (about) the profile where it is now, so arrive gapF behind at that speed
            // instead of reacting once it brakes — the nose-to-tail hits in braking zones (aifieldsuite: ~40 % of contact events)
            if (prec > 0) { const vL = Math.min(vAlong, prof[idx(ci + Math.round(6 / P.sp))] * traits.pace), aB = 0.6 * carGrip(sp).brakeG * GRAVITY * (car.surface.mu || 1);
              capF = Math.min(capF, capF * (1 - prec) + prec * Math.sqrt(vL * vL + 2 * aB * Math.max(0, f - gapF))); }
            followCap = Math.min(followCap, capF);
          }
        }
      } else if (f > -4) {
        if (f > -2.5) side = side || Math.sign(oc - myLat);
        alg.push(oc);
        const gapA = 2.4 + START_GAP * startK;
        if (Math.abs(oc - myLat) < gapA) { conflict = true; dodgeT = myLat + Math.sign(myLat - oc || 1) * (gapA - Math.abs(oc - myLat)) - latT; }
      } else if (!conflict && traits.defence > 0.5 && vAlong > v + 0.5 && f > -14) {
        dodgeT = Math.max(-1.2, Math.min(1.2, (oc - latT) * 0.5)) * traits.defence;
      }
    }
    // ---- OBSTACLES (user, 2026-10-04: "AI need to see tyres and cones as obstacles — although optional ones haha — but try and avoid them
    // on rally stages / tracks"): ctx.obstacles = loose objects near this car ({ x, y, r }, main.js). One in my path ahead, on the road ->
    // step round it on the side with room; no room -> drive through (optional). Cars come first: only when no car is in the way. A more
    // precise driver sees it further ahead.
    if (!conflict && ctx.obstacles && ctx.obstacles.length) {
      const reach = 6 + v * (0.6 + 0.6 * prec); let best = null;
      for (const o of ctx.obstacles) {
        const rx = o.x - car.x, ry = o.y - car.y, f = rx * ch + ry * sh; if (f < 2 || f > reach) continue;
        const l = -rx * sh + ry * ch; if (Math.abs(l) > 8) continue;
        const k = idx(bi + Math.round(f / P.sp)), q = pts[k], oc = (o.x - q.x) * -Math.sin(q.h) + (o.y - q.y) * Math.cos(q.h);
        if (Math.abs((P === main ? lineOff : 0) + oc) > (P === main ? L.hw + 0.5 : 6)) continue;   // off the road: not in the way
        if (Math.abs(oc - myLat) < o.r + OBST_CLEAR && (!best || f < best.f)) best = { f, oc, r: o.r };
      }
      if (best) {
        const w = best.r + OBST_CLEAR + 0.2;
        const cands = [best.oc + w, best.oc - w].filter((o) => Math.abs((P === main ? lineOff : 0) + o) <= latLim).sort((a, b) => Math.abs(a - myLat) - Math.abs(b - myLat));
        if (cands.length) { conflict = true; dodgeT = cands[0] - latT; st.obst = (st.obst || 0) + dt; }
      }
    }
    // ---- RACECRAFT (stage 3, 2026-10-04; user: "real overtakes, real defending, scrabbling for victory"). Stage 2 only went round a car
    // that was already in the way, so circuits were processions (aifieldsuite, Realish: 35 held passes in 12 six-car 3-lap races, Brands
    // and Naffcar ~0). ATTACK: sat behind the same car (longer for the cautious) with a corner coming -> commit to a side for that corner:
    // the INSIDE, unless the car ahead already covers it, then round the OUTSIDE for the switch-back; brake later (K_BRAKE + ATK_KB) and
    // push a little. Ends past the apex, once ahead, if it drops back or after 7 s. DEFENCE: a car closing behind with a corner coming ->
    // a defensive driver (chance = defence) moves over to COVER THE INSIDE once, and pays for the tighter line (3 % slower in the corner).
    if (P === main) {
      if (lead) st.nearT = (st.nearT || 0) + dt;
      if (lead && lead.c === st.leadCar) st.behindT += dt; else { st.leadCar = lead ? lead.c : null; st.behindT = 0; }
      const cur = L.cid[bi]; let nc = -1, nd = 0;
      for (let o = 1, m = Math.round(150 / L.sp); o < m; o++) { const c = L.cid[(bi + o) % n]; if (c >= 0 && c !== cur) { nc = c; nd = o * L.sp; break; } }
      const past = (pl: { corner: number }) => pl.corner >= 0 && cur === pl.corner && ((bi - L.corners[pl.corner].apex + n) % n) < n / 2;
      if (st.atk) { const A = st.atk, f = (A.car.x - car.x) * ch + (A.car.y - car.y) * sh;
        if (f < -5 || f > 35 || st.t - A.t0 > (A.corner < 0 ? 9 : 7) || past(A)) st.atk = null; }
      if (!st.atk && lead && nc >= 0 && nc !== st.atkCorner && nd > 15 && nd < 140 && lead.vAlong < v + 2
        && st.behindT > Math.max(0.15, 0.6 - 0.5 * traits.aggression)) {
        st.atkCorner = nc;
        if (!debugValue("NOATK") && rnd() < 0.6 + 0.4 * traits.aggression) {
          const turn = L.corners[nc].turn, leadAbs = lineOff + lead.oc;
          const side = Math.sign(leadAbs) === turn && Math.abs(leadAbs) > 0.4 * latLim ? -turn : turn;
          st.atk = { car: lead.c, side, corner: nc, t0: st.t }; st.nAtk = (st.nAtk || 0) + 1;
        }
      }
      // TOW PASS (ovals, long straights: no corner close enough to brake into): in the slipstream of the same car for a while -> pull
      // out to the side with more room and drive past on the extra speed (contact.js slipstream)
      if (!st.atk && lead && (nc < 0 || nd > 140) && (car.dragMul ?? 1) < 0.85 && st.behindT > Math.max(0.3, 1 - 0.7 * traits.aggression)
        && st.t - (st.towT || -99) > 4) {
        st.towT = st.t;
        if (!debugValue("NOATK") && rnd() < 0.6 + 0.4 * traits.aggression) {
          const leadAbs = lineOff + lead.oc, ahead = pts[idx(bi + Math.round(80 / P.sp))].turn || 1;
          const sd = Math.abs(leadAbs) > 0.3 * latLim ? -Math.sign(leadAbs) : ahead;
          st.atk = { car: lead.c, side: sd, corner: -1, t0: st.t }; st.nAtk = (st.nAtk || 0) + 1;
        }
      }
      // GIVING ROOM: a car alongside on the INSIDE of the corner we are entering, and we are not attacking -> concede a little (a
      // defensive driver less), as real drivers do rather than turn in on it
      const insideOf = cur >= 0 ? L.corners[cur].turn : nc >= 0 && nd < 40 ? L.corners[nc].turn : 0;
      if (!st.atk && side && side === insideOf) vMul *= 1 - YIELD * (1.2 - traits.defence);
      if (st.cover && (past(st.cover) || st.t - st.cover.t0 > 6)) st.cover = null;
      if (!st.cover && !st.atk && threat && threat.f < -5 && nc >= 0 && nc !== st.covCorner && nd < 110) {
        st.covCorner = nc;
        if (!debugValue("NOCOV") && rnd() < (0.5 + 0.5 * (traits.prec ?? 0.5)) * traits.defence) st.cover = { side: L.corners[nc].turn, corner: nc, t0: st.t };
      }
      if (st.atk) { conflict = true; dodgeT = st.atk.side * (latLim - 1.0) - lineOff - latT; prof = profileOf(P, sp, main, K_BRAKE + ATK_KB); }
      else if (st.cover) { conflict = true; dodgeT = st.cover.side * 0.6 * latLim - lineOff - latT; }
      // never squeeze a car that is ALONGSIDE: the racecraft target keeps ALONG_GAP from it (attacks ignored it: side contact
      // 41 -> 110 events on one Thruston run, MEASURED)
      if (st.atk || st.cover) { let tg = latT + dodgeT; for (const a of alg) if (Math.abs(tg - a) < ALONG_GAP) tg = a + Math.sign(myLat - a || 1) * ALONG_GAP; dodgeT = tg - latT; }
      st.cc = cur >= 0 ? cur : nd < 80 ? nc : -1;
    } else { st.atk = null; st.cover = null; st.cc = -1; }
    const rate = st.atk ? 3.5 : 2.5;
    st.dodge += Math.max(-rate * dt, Math.min(rate * dt, dodgeT - st.dodge)) * (conflict ? 1 : 0.5);
    st.follow = followCap < Infinity;
    latT += st.dodge;
    const edge = st.t < (st.wideUntil || 0) ? st.wide! : latLim;   // past the usual edge only while going round a car (above)
    latT = Math.max(-edge, Math.min(edge, lineOff + latT)) - lineOff;
    // OFF THE LINE INTO A CORNER (an attack, a cover, a dodge, a wander): the profile is for the racing line's radius; x m further INSIDE
    // at the apex is a radius R - x, so the corner speed drops by sqrt((R - x) / R). Without it attackers ran wide on the exit
    // (aifieldsuite Realish off-road 142 -> 299 car-s, MEASURED).
    // (applied in the SPEED section: every bend ahead within braking distance, not only the "corners" — Naffcar's banked turns are
    // wider than CORNER_R, and tow passes on their inside slid off: off-road 0 -> 14 car-s, MEASURED)

    // ---- steering: Stanley on the path + latT at the front axle (the bench driver's controller)
    const fx = car.x + ch * sp.lf, fy = car.y + sh * sp.lf;
    let fi = bi, fd = Infinity; for (let o = -2; o <= 10; o++) { const k = idx(bi + o), q = (pts[k].x - fx) ** 2 + (pts[k].y - fy) ** 2; if (q < fd) { fd = q; fi = k; } }
    const look = Math.round((2 + v * 0.15) / P.sp), ahead = pts[idx(fi + look)], p = pts[fi];
    let psi = ahead.h - car.heading; psi = Math.atan2(Math.sin(psi), Math.cos(psi));
    const cross = (fx - p.x) * -Math.sin(p.h) + (fy - p.y) * Math.cos(p.h) - latT;
    const deltaS = psi + Math.atan2(-1.2 * cross, v + 2) - 0.03 * (car.yawRate - v * Math.tan(car.delta) / sp.L);
    const muHere = car.surface.mu * sp.mu;
    // cap: the kinematic angle for the grip-limited turn + a front slip allowance (the bench cap pinned at ~0.1 at 35 m/s: ran wide)
    const LOCK = sp.steerMax || 0.56;
    const cap = Math.min(1, (1.3 * sp.L * muHere * GRAVITY / Math.max(4, v * v) + 0.12) / LOCK);
    // OVERSTEER (rear slip past ~10 deg): no cap, so it can countersteer; UNDERSTEER (front past ~8 deg): more lock only scrubs, so
    // lift and brake to get the front back (MEASURED: Sweaty Lamb's S at sF 0.27 rad, then a spin at sR -0.78)
    // LOOSE SURFACES (user, 2026-10-04: "slow down weirdly on surface changes, dirt to tarmac — they should predict it and speed up").
    // loose = 0 on tarmac (mu 1) .. 1 at mu 0.5. MEASURED (tools/aisurface, rally-4x4 Real): 19 of 26 Slidden surface changes lifted > 0.3 s
    // with the target still above the speed — mostly WHEELSPIN halving the throttle (normal on dirt), then the front-slip "understeer"
    // lift. On loose ground: no wheelspin cut, and 0.06 rad more front slip before the understeer lift -> 10 of 26; laps (Real) Knobhill
    // 47.6 -> 45.8 hatch / 41.5 -> 40.5 4x4, Sweaty Lamb 128.5 -> 125.2 / 114.4 -> 112.7, Slidden 55.9 -> 55.1, tarmac unchanged.
    // TRIED and REJECTED (same tool): more rear slip before lifting, a later slide catch and power through the slide — each alone harmless,
    // together the 4x4 left the road at Knobhill / Sweaty Lamb (16-31 s off a lap).
    const loose = Math.max(0, Math.min(1, (1 - car.surface.mu) / 0.5));
    const sF = Math.abs(car.t.slipF || 0), sR = Math.abs(car.t.slipR || 0);
    // DRIFT HOLD (user, 2026-10-04: "really need AI to drift and handbrake sometimes / aggressive off-road driving"): on loose ground, in a
    // corner, in a car with the drive at the back (RWD / rear-biased AWD), a slide is HELD — the rear kept near DRIFT_SLIP with the throttle,
    // countersteer free — instead of caught at 0.18 rad (which lifted and tiptoed). Past DRIFT_MAX it is caught as before. A bolder driver
    // (aggression) drifts more often (decided per corner).
    const inCorner = P === main && L.cid[bi] >= 0;
    if (inCorner && st.driftCorner !== L.cid[bi]) { st.driftCorner = L.cid[bi]; st.driftOn = st.t > (st.driftBan || 0) && rnd() < (debugValue("DRIFT") as number ?? (0.45 + 0.5 * traits.aggression)); }
    // ... and never near the road edge (a held drift there ran a Rally car off Sweaty Lamb 12 s a lap): within EDGE_DRIFT m it catches
    const pb = pts[bi], edgeRoom = P === main ? L.hw - Math.abs(lineOff + (car.x - pb.x) * -Math.sin(pb.h) + (car.y - pb.y) * Math.cos(pb.h)) : 0;   // m from the car to the nearer edge
    const drifting = st.driftOn && inCorner && loose > 0.3 && (sp.drive ?? 1) < 0.5 && sR > 0.12 && sR < DRIFT_MAX && v > 6 && edgeRoom > EDGE_DRIFT && pts[L.corners[L.cid[bi]].apex].R < DRIFT_R;
    const over = sR > 0.18 && v > 5 && !drifting, under = sF > 0.14 + 0.06 * loose && v > 5 && !over && !drifting;
    const steer = over || drifting ? Math.max(-1, Math.min(1, deltaS / LOCK)) : Math.max(-cap, Math.min(cap, deltaS / LOCK)); st.cap = cap;

    // ---- SPEED: the profile (it already brakes for what is ahead) x pace x mistakes, capped by the joker approach and traffic
    let vT = Infinity; const span = Math.round((3 + v * 0.25) / P.sp);
    for (let o = 0; o <= span; o++) vT = Math.min(vT, prof[idx(bi + o)]);
    if (P === main && Math.abs(latT) > 0.3) {
      const aB = (debugValue("AI_KB") as number || K_BRAKE) * pts[bi].mu * carGrip(sp).brakeG * GRAVITY, far = Math.round((v * v / (2 * aB) + 15) / P.sp);
      for (let o = 0; o <= far; o += 2) { const k = idx(bi + o), q = pts[k], x = (lineOff + latT - q.off!) * q.turn;
        if (x > 0.3 && q.R < 400) { const vk = prof[k] * Math.sqrt(Math.max(0.4, (q.R - x) / q.R)); vT = Math.min(vT, Math.sqrt(vk * vk + 2 * aB * o * P.sp)); } }
    }
    vT = Math.min(vT * traits.pace * push * vMul, jCap, followCap);
    st.vT = vT;
    // (no WHEELSPIN cut any more: it halved the throttle on tarmac too, so a car coming off dirt with its wheels still spinning lifted at
    // the transition — the user's 'still slow down on transition change'. MEASURED without it (aidrivecheck, 6 levels x 3 cars x Realish +
    // Real): 0 to 0.6 s faster everywhere, nothing slower; aisurface Slidden 4x4: 8 -> 6 lifts at changes.)
    const slideR = sR, feel = Math.max(0, 1 - Math.max(0, slideR - 0.07) / 0.12);
    // OFF ROAD / LOOSE (user, 2026-10-04: "they still slow down like mad off road / changing surfaces"): on loose ground a sliding front
    // is the surface, not a mistake — keep driving (UNDER_LOOSE throttle) and never brake for it. MEASURED before (aifieldcheck SURF,
    // Brands + Castle Cum, 6 cars): on grass / dirt the AI braked 26-36 % and lifted 13-33 % of the time, front slip > 0.14 for 19-40 %.
    // ...only OFF THE PLANNED SURFACE (the car on clearly worse ground than its racing line: off the road, onto a loose patch). On a loose
    // line (Sweaty Lamb's gravel) the old lift + brake stays: applied there too, the 4x4 at Real left the stage 16 s a lap (MEASURED).
    const offPlan = P === main && car.surface.mu < 0.85 * (pts[bi].mu || 1);
    const looseUnder = under && loose > 0.3 && offPlan;
    if (drifting) { st.driftT = (st.driftT || 0) + dt; st.lastDrift = st.t; }
    // a drift that ran it OFF the road: it backs off drifting for DRIFT_BAN s (a driver who scares himself)
    if (edgeRoom < -0.5 && st.t - (st.lastDrift ?? -99) < 2) { st.driftOn = false; st.driftBan = st.t + DRIFT_BAN; }   // off within 2 s of a drift
    let throttle = drifting ? Math.max(0.25, Math.min(1, 0.6 + (DRIFT_SLIP - sR) * 3)) * (v < vT * 1.1 ? 1 : 0.4) : looseUnder ? Math.min(UNDER_LOOSE, v < vT ? (vT - v) * 0.6 : 0) : under ? 0 : over ? (v < vT ? Math.min(0.2, (vT - v) * 0.6) : 0) : v < vT ? Math.min(1, (vT - v) * 0.6) * feel : 0;
    if (thrForce && v < vT * 1.1) throttle = 1;
    let brake = v > vT + 0.3 ? Math.min(1, (v - vT) * 1.5) * Math.max(0.6, 1 - Math.abs(steer) / 0.5) : 0;
    if (under && !looseUnder && v > 0.85 * vT) brake = Math.max(brake, 0.35);
    if (over || drifting) brake = 0;
    // HANDBRAKE TURNS (user, 2026-10-04: "they should also use handbrake and drift and stuff"): into a HAIRPIN (apex R < HB_R) before the
    // apex, a big turn still ahead (> HB_TURN rad) and moving -> one pull of HB_T s per hairpin, off the throttle,
    // full lock that way: the rear steps out and the car pivots. The better driver times it (skill), a weaker one sometimes doesn't bother.
    let handbrake = 0;
    if (P === main && v > 6 && (debugValue("HB") ?? 1)) {
      const c = L.cid[bi], C = c >= 0 ? L.corners[c] : null;
      // turn-in: a corner that turns > HB_TURN rad in all (summed once along its run) with an apex tighter than HB_R (+ HB_LOOSE on loose
      // ground), the apex within ~0.8 s
      if (C && C.angle === undefined) { let sum = 0; for (let i = C.start; L.cid[i] === c; i = (i + 1) % n) { const d = pts[(i + 1) % n].h - pts[i].h; sum += Math.atan2(Math.sin(d), Math.cos(d)); } C.angle = Math.abs(sum); }
      const toApex = ((C ? C.apex : bi) - bi + n) % n;
      if (C && C.angle! > HB_TURN && pts[C.apex].R < HB_R + HB_LOOSE * loose && toApex < n / 2 && toApex * L.sp < 0.8 * v + 6 && st.hbCorner !== c) {
        st.hbCorner = c; if (rnd() < 0.5 + 0.5 * traits.skill) st.hbUntil = st.t + HB_T;
      }
      if (st.t < st.hbUntil) { handbrake = 1; throttle = 0; brake = 0; st.hbN = (st.hbN || 0) + 1; }
    }
    return { steer: handbrake ? Math.sign(steer || psi) * Math.max(Math.abs(steer), 0.9) : steer, throttle, brake, handbrake };
  }
  // put back on the road by the game (stuck / broken): find its place again, forget the dodge and any mistake in progress
  const relocate = () => { st.i = null; st.path = main; st.dodge = 0; st.mist = null; st.thrUntil = 0; st.revUntil = 0; st.slowT = 0; st.outN = 0; st.giveUp = false; };
  return { drive, state: st, total: L.total, traits, relocate };
}
export type AIDriver = ReturnType<typeof createAIDriver>;
