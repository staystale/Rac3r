// ai/weaverStep.ts: the highway driver's view of one step: the road around the car, the verge
// lines it may use, what blocks a lateral line and what the mirror shows.
import { EDGE_M, HWT } from "./weaverCtx.ts";
import type { Road, Step, Wvr } from "./weaverCtx.ts";
import type { AiCar, DriveCtx, RoadBlock, RoadFrame } from "./types.ts";

/** The verge lines (vLo, vHi): how far across the road a line may go. */
function vergeLimits(wvr: Wvr, road: Road) {
  const { level } = wvr;
  const { pts, frame, vAl, hold, geo, minOff, maxOff } = road;
  // THE VERGE DODGE (user: "ai should go off road to dodge if its quicker, just not
  // too far obviously"): two more lines, VERGE m past each edge (half the car on the grass), only
  // worth taking when the road is blocked: VERGE_COST + the grip it costs. Never on the outside
  // of a bend (armco there at hw + 1.8: highway.js) or on a walled preset. vLo / vHi = how far
  // the line may go.
  const kNow = (pts[Math.max(0, Math.min(pts.length - 1,
    Math.round((frame.s - pts[0].s) / 4) + Math.round(vAl * 1.5 / 4)))] || {}).curv || 0;
  const vgOK = (HWT.verge ?? 1) && !level._cfg.walls && !hold,
    vLo = vgOK && Math.abs(kNow) < 1 / 1500 ? -geo.hw + (HWT.vgm ?? 0.9) : minOff,
    vHi = vgOK && Math.abs(kNow) < 1 / 1500 ? geo.hw - (HWT.vgm ?? 0.9) : maxOff;
  return { vLo, vHi };
}

/** Makes the step's view of the road around `car` (and starts the line on the first step). */
export function makeStep(
  wvr: Wvr, car: AiCar, dt: number, ctx: DriveCtx, frame: RoadFrame, speed: number,
): Step {
  const { level, state } = wvr;
  const pts = level._hw.pts, vAl = frame.v, hold = !!ctx.hold;
  // the hard shoulder is road too, as for a player; lines stay EDGE_M inside the edges (MEASURED
  // hwracecheck: a 1 m margin on the outside of an R 730 at 227 km/h ran 1.5 m wide onto the
  // grass)
  const geo = level._hw.geo, minOff = -geo.hw + EDGE_M, maxOff = geo.hw - EDGE_M;
  const cars = ctx.cars || [], myW = car.spec.wid / 2;
  const grip = 0.94 * (car.spec.mu || 1), idx0 = Math.round((frame.s - pts[0].s) / 4);
  const road: Road = {
    car, dt, frame, pts, geo, speed, vAl, hold, minOff, maxOff, cars, myW, grip, idx0,
  };
  const { vLo, vHi } = vergeLimits(wvr, road);
  if (state.line == null) {
    state.line = state.base = Math.max(minOff, Math.min(maxOff, frame.off));
    state.tgt = state.line;
  }
  const mirT = HWT.mir ?? 2.5;
  // how far across one decision may take us: ~0.6 g sideways at low speed, falling with speed
  // (2.5 m at 240 km/h)
  const reach = Math.max(2.5, Math.min(maxOff - minOff, (14 - speed * 0.17) * (HWT.rch ?? 1)));
  return {
    ...road, vLo, vHi, mirT, blockOn: makeBlockOn(wvr, road), mirror: makeMirror(wvr, road, mirT),
    reach,
  };
}

/** A lane-changing car blocks the lane it is heading for too, from now (it is going there). */
function laneChangeBlock(
  wvr: Wvr, road: Road, other: AiCar, oFrame: RoadFrame, ahead: number, off: number,
  block: RoadBlock | null,
) {
  const { car, myW } = road;
  const { margin } = wvr;
  // WHERE IT WILL BE (HWT.pred): a lane-changing traffic car blocks its target lane too,
  // from now (it is going there)
  const trOff = (HWT.pred ?? 1) && other._trOff != null
    && Math.abs(other._trOff - oFrame.off) > 0.3 ? other._trOff : null;
  if (trOff != null && ahead > (car.spec.len + other.spec.len) / 2 + 1) {
    const hw2 = myW + other.spec.wid / 2 + margin;
    if (Math.abs(trOff - off) < hw2 && Math.abs(oFrame.off - off) >= hw2) {
      const trGap = ahead - (car.spec.len + other.spec.len) / 2;
      if (!block || trGap < block.gap) block = { gap: trGap, v: oFrame.v, o: other };
    }
  }
  return block;
}

/** Half the width a line keeps clear of `other`: both bodies, the margin and the closing speed. */
function halfWidth(wvr: Wvr, road: Road, other: AiCar, oFrame: RoadFrame) {
  const { myW, vAl } = road;
  const { margin } = wvr;
  // the margin GROWS with the closing speed (MEASURED weavecheck, Real: 0.55 m margin + ~0.5
  // m tracking error = a car's line that clips
  // the slow car at 75 km/h closing): 0.4 m more per 10 m/s closing
  return myW + other.spec.wid / 2 + margin
    + Math.min(HWT.mcap ?? 99, 0.04 * Math.max(0, vAl - oFrame.v));
}

/** A car right beside us blocks the line (side: on its far side we cannot swerve through it). */
function alongside(road: Road, other: AiCar, oFrame: RoadFrame, off: number, halfW: number) {
  const { frame } = road;
  const side = Math.sign(oFrame.off - frame.off),
    far = Math.sign(off - frame.off) === side
      && Math.abs(off - frame.off) > Math.abs(oFrame.off - frame.off) - halfW;
  if (far || Math.abs(oFrame.off - off) < halfW)
    return { gap: 0, v: oFrame.v, side: far, o: other };
  return null;
}

/** Makes blockOn: what blocks a lateral line `off`. */
function makeBlockOn(wvr: Wvr, road: Road) {
  const { car, cars, frame } = road;
  // what blocks a lateral line `off`: the nearest car ahead whose body (+ margin) overlaps it ->
  // { gap, v } (gap 0 = alongside), or a car right beside us on that side (side: we cannot swerve
  // through it)
  return (off: number) => {
    let block: RoadBlock | null = null;
    for (const other of cars) {
      const oFrame = other._hwf;
      if (!oFrame) continue;
      const ahead = oFrame.s - frame.s;
      if (ahead < -6 || ahead > 220) continue;
      block = laneChangeBlock(wvr, road, other, oFrame, ahead, off, block);
      const halfW = halfWidth(wvr, road, other, oFrame),
        beside = ahead < (car.spec.len + other.spec.len) / 2 + 1;
      if (beside) {
        const near = alongside(road, other, oFrame, off, halfW);
        if (near) return near;
        continue;
      }
      const gap = ahead - (car.spec.len + other.spec.len) / 2;
      if (Math.abs(oFrame.off - off) < halfW && (!block || gap < block.gap))
        block = { gap, v: oFrame.v, o: other };
    }
    return block;
  };
}

/** Makes the mirror: whether a faster car coming up from behind blocks the line `off`. */
function makeMirror(wvr: Wvr, road: Road, mirT: number) {
  const { car, cars, frame, myW, vAl } = road;
  const { margin } = wvr;
  // THE MIRROR: a FASTER car coming up from behind blocks a line it is on if it would arrive
  // within MIR_T s (MEASURED hwracecheck seed 77, Realish: a racer at 145 km/h moved 4.4 m left
  // into the line of one 18 m back at 177 km/h - the one behind braked on the hard shoulder,
  // spun, and both left the road; the driver only ever
  // looked at cars ahead, > 6 m back did not exist)
  // (MEASURED pacesuite, 18 races: bad runs 7 -> 2, off-road car-steps 13079 -> 4006, mean
  // 126.7 -> 133.4 km/h)
  return (off: number) => {
    if (!mirT) return false;
    for (const other of cars) {
      const oFrame = other._hwf;
      if (!oFrame) continue;
      const ahead = oFrame.s - frame.s, len = (car.spec.len + other.spec.len) / 2;
      if (ahead > len + 1 || ahead < -60) continue;
      const close = oFrame.v - vAl;
      if (close < 0.5 && ahead < -len) continue;
      if (ahead < -len && (-ahead - len) / close > mirT) continue;
      if (Math.abs(oFrame.off - off) < myW + other.spec.wid / 2 + margin) return true;
    }
    return false;
  };
}
