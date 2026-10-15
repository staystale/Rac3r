// ai/weaverLine.ts: the highway driver's lateral plan: it scores a spread of lines across the
// road a few times a second, picks one, and eases its lateral target toward it.
import { GRAVITY, HWT, LAT_R, LOOK_T, N_LINES } from "./weaverCtx.ts";
import type { Step, Wvr } from "./weaverCtx.ts";
import type { RoadBlock } from "./types.ts";

/** The best line so far: how much road it had before the costs, and why it was chosen. */
interface Way {
  raw: number;
  off: number;
  why: string;
}

/** The lateral offset of candidate line `lineNo`: the planned base, a verge or an even spread. */
function lineOff(wvr: Wvr, step: Step, lineNo: number) {
  const { state } = wvr;
  const { vLo, vHi, minOff, maxOff } = step;
  return lineNo === N_LINES ? state.base!
    : lineNo === N_LINES + 1 ? vLo
    : lineNo === N_LINES + 2 ? vHi
    : minOff + (maxOff - minOff) * lineNo / (N_LINES - 1);
}

/** The free road along a line: unblocked, or the gap and what is kept of the blocker's speed. */
function freeScore(step: Step, block: RoadBlock | null) {
  const { vAl } = step;
  // free road along it: unblocked = LOOK_T s of road (+ a bonus); blocked = the gap + what
  // is kept of the blocker's speed
  let score = block
    ? (block.side ? -999 : Math.min(block.gap, vAl * LOOK_T) + Math.max(0, block.v) * 1.2)
    : vAl * LOOK_T + 60;
  // NO QUEUEING BEHIND A RIVAL (HWT.rp): a line whose blocker is ANOTHER RACER close ahead
  // is worth less, so it pulls out and
  // races it side by side instead of sitting in its slipstream
  // (requirement: they tend to que in lanes on the highway still... weave through traffic like a
  // real street racer).
  // OFF BY DEFAULT - not proven (HANDOVER §3). MEASURED pacesuite, 9 races x seed sets A
  // (4242,77,1234) / B (31,555,9001):
  // baseline 151.0 / 139.3 km/h; rp 40 + cm 12 + mvk 0.6 = 154.0 / 136.1, 0 bad, BUT
  // weavecheck 9 of 45 hit (baseline 0)
  if (block && !block.side && block.o && !block.o.traffic && block.gap < 60)
    score -= (HWT.rp ?? 0) * (1 - block.gap / 60);
  return score;
}

/** Where a line is headed for: itself, or a reach-sized step toward it (null = not clear). */
function aimAt(step: Step, off: number) {
  const { frame, vAl, reach, blockOn } = step;
  // REACH: no line further across than a swerve can make in ~1.5 s at this speed (MEASURED
  // weavecheck: a 7 m jump asked at 240 km/h
  // put the car 18 deg to the road and into the grass)
  // a line FURTHER than reach is headed for in reach-sized STEPS (the plan re-thinks every
  // ~0.15 s), if the step point is clear
  let aim = off;
  if (Math.abs(off - frame.off) > reach) {
    if (!HWT.step) return null;
    aim = frame.off + Math.sign(off - frame.off) * reach;
    const stepBlock = blockOn(aim);
    if (stepBlock && (stepBlock.side
      || stepBlock.gap < 4 + 2 * Math.max(0, vAl - stepBlock.v))) return null;
  }
  return aim;
}

/** The costs of a swerve: the move, the hard shoulder and the verge. */
function swerveCost(wvr: Wvr, step: Step, off: number, score: number) {
  const { state, level } = wvr;
  const { frame, speed, geo, minOff, maxOff } = step;
  // (MEASURED weavecheck: costed from where the car IS, any tracking lag dragged the plan
  // after it - toward the car being passed)
  const move = Math.abs(off - state.base!) + 0.3 * Math.abs(off - frame.off);
  // swerving costs; the line already chosen is worth a lot (COMMIT: MEASURED weavecheck, a
  // 6 m bonus let it flip between two lines
  // 3 m apart every 0.2 s and slalom into the car it was passing)
  // swerve cost x HWT.mvk, commit bonus HWT.cm (defaults = the shipped behaviour). A
  // looser setting was tried (the
  // queueing) - MEASURED weavecheck hits of 45: cm 12 / mvk 0.6 = 9, cm 25 / mvk 0.6 = 8,
  // cm 25 / mvk 0.8 = 2, default = 0
  score -= move * (1.5 + speed * 0.05) * (HWT.mvk ?? 1)
    - (Math.abs(off - state.base!) < 0.6 ? (HWT.cm ?? 25) : 0);
  // the hard shoulder: a last resort
  if (off < -geo.hw + level._cfg.shoulder) score -= 8;
  // the verge: only when it is clearly quicker
  if (off < minOff - 0.1 || off > maxOff + 0.1) score -= (HWT.vgc ?? 40);
  return score;
}

/** The costs of the way across: a car in the middle or in the mirror, a step not yet open. */
function pathCost(step: Step, off: number, aim: number, way: Way, score: number) {
  const { frame, blockOn, mirror } = step;
  if (Math.abs(aim - frame.off) > 1.2) {
    const mid = blockOn((aim + frame.off) / 2);
    if (mid && mid.gap < 1) {
      score -= 400;
      if (way.off === off) way.why = 'mid';
    }
  }
  if (Math.abs(aim - frame.off) > (HWT.mth ?? 1.2)
    && (mirror(aim) || mirror((aim + frame.off) / 2))) {
    score -= 400;
    if (way.off === off) way.why = 'mirror';
  }
  // the way across must be open
  if (aim !== off && way.off === off) way.why = 'stepped';
  return score;
}

/** Scores line `lineNo` (null = not a candidate): where it aims, its score and its raw score. */
function scoreLine(wvr: Wvr, step: Step, lineNo: number, way: Way) {
  const { state } = wvr;
  const { frame, minOff, maxOff, blockOn, reach } = step;
  const off = lineOff(wvr, step, lineNo);
  if (lineNo > N_LINES && (off === minOff || off === maxOff)) return null;
  const block = blockOn(off);
  let score = freeScore(step, block);
  const raw = score;
  if (raw > way.raw) {
    way.raw = raw;
    way.off = off;
    way.why = Math.abs(off - frame.off) > reach ? 'reach' : 'cost';
  }
  const aim = aimAt(step, off);
  if (aim == null) return null;
  score = swerveCost(wvr, step, off, score);
  score = pathCost(step, off, aim, way, score);
  if (!block && (!state.free
    || Math.abs(off - frame.off) < Math.abs(state.free.off - frame.off)))
    state.free = { off, score };
  return { aim, score, raw };
}

/** Scores every line and plans the best one. */
function pickLine(wvr: Wvr, step: Step) {
  const { state } = wvr;
  let best = state.line!, bestScore = -Infinity, bestRaw = 0;
  state.free = null;
  const way = { raw: -Infinity, off: 0, why: '' };
  for (let lineNo = 0; lineNo <= N_LINES + 2; lineNo++) {
    const cand = scoreLine(wvr, step, lineNo, way);
    if (!cand) continue;
    if (cand.score > bestScore) {
      bestScore = cand.score;
      best = cand.aim;
      bestRaw = cand.raw;
    }
  }
  state.base = best;
  state.why = { ...way, chosen: best, chosenRaw: bestRaw };
}

/** Chooses a line a few times a second (not while holding station). */
export function chooseLine(wvr: Wvr, step: Step) {
  const { state, agg } = wvr;
  const { dt } = step;
  if ((state.think -= dt) <= 0) {
    state.think = 0.08 + 0.14 * (1 - agg);
    if (!step.hold) pickLine(wvr, step);
  }
}

/** A little wander on top of the plan, and the abort of a swerve into a closing car. */
export function wanderStep(wvr: Wvr, step: Step) {
  const { state, traits } = wvr;
  const { mirT, mirror, vLo, vHi } = step;
  // a little WANDER (difficulty) on top of the plan - NOT folded into it (MEASURED weavecheck:
  // added to the plan at every re-think it
  // accumulated and walked the line into the car being passed)
  // ABORT a swerve already under way when the mirror shows a car closing on the side it is
  // moving to (MEASURED hwracecheck seed 1234,
  // Real: the line was chosen while the road was clear; a car 30 km/h quicker came up into it
  // 0.3 s later and they touched side to side)
  if (mirT && (HWT.abort ?? 1) && Math.abs(state.tv || 0) > 0.2
    && mirror(state.tgt! + Math.sign(state.tv!) * 0.6)) {
    state.base = state.tgt;
    state.think = Math.min(state.think, 0.05);
  }
  state.line = Math.max(vLo, Math.min(vHi, state.base!
    + Math.sin(state.t * 0.4 + state.ph) * Math.min(0.4, (traits.wander || 0) * 0.2)));
}

/** Eases the lateral target toward the line; returns what blocks the target now. */
export function aimTarget(wvr: Wvr, step: Step) {
  const { state, agg } = wvr;
  const { dt, vAl, grip, blockOn } = step;
  // the lateral target eases toward the chosen line at LAT_R (faster when a crash is close: a
  // real swerve)
  const here = blockOn(state.tgt!),
    urgent = here && here.gap < 6 + Math.max(0, vAl - here.v) * 0.8;
  // A SWERVE HAS INERTIA: the target's sideways speed ramps at aLat (a share of grip) and eases
  // in to stop on the line. MEASURED (hwracecheck, Real difficulty): an instant 6.5 m/s sideways
  // step spun cars at 150 km/h on a straight (rear slip 0.6 rad)
  const latR = LAT_R * (urgent ? 1.6 : 1) * (0.8 + 0.4 * agg),
    aLat = (urgent ? 0.3 : 0.18) * grip * GRAVITY, latDist = state.line! - state.tgt!;
  const vWant = Math.sign(latDist) * Math.min(latR, Math.sqrt(2 * aLat * Math.abs(latDist)));
  state.tv = (state.tv || 0)
    + Math.max(-aLat * dt, Math.min(aLat * dt, vWant - (state.tv || 0)));
  state.tgt! += state.tv! * dt;
  if (Math.abs(latDist) < 0.02 && Math.abs(state.tv) < 0.2) {
    state.tgt = state.line;
    state.tv = 0;
  }
  return here;
}
