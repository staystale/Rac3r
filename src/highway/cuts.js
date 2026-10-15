// highway cuts: slip road / bridge / river bookkeeping (keep-out rects, cut-short polylines, the
// secret side road, approaches, river covers). Split out of highway.js.
import { SURFACES } from "../world/surfaces.ts";
import { STEP } from "./presets.js";
import { ease } from "./road.js";
import { clearFields } from "./fields.js";
// ---- SLIP ROADS, BRIDGES, CHEEKY EXTRAS. Each is ONE prop (render.ts draws it, physics reads it):
// no new system. OFF-SLIP (kind 'slip'): leaves the LEFT edge (the hard shoulder side) at SLIP_DEG,
// a tapering lane 5 m wide, SLIP_LEN m long, ending in a field gate; its surface is tarmac (lab.js
// zoneAt reads lv.lanes - the existing pit-lane ribbons), a SLIP sign + a countdown board (3 / 2 /
// 1 bars) before it. Driving up it is off the motorway (the guard's OFF countdown applies, by
// design: it goes nowhere). BRIDGES (kind 'bridge'): drawn OVER everything (render.ts OVERHEAD),
// deck across the road at an angle, with what it carries: 'road' (a lane + a car or two, parapets),
// 'rail' (sleepers + rails, no trains), 'foot' (narrow, people). UNDER the motorway: kind 'river'
// (water band across, the motorway on a viaduct: parapets both sides) - drawn under the road, never
// on it. Only their PIERS / abutments are solid, and those stand SLIP_CLEAR m outside the tarmac (+
// off the verge strip the AI dodges on). EXTRAS (rare): a COW on a road bridge, a CONE on a
// footbridge, a small BOAT stuck under a river bridge, a SMILEY SOLAR FARM. v2 (requirement:
// bridges / slip roads should extend off the screen... slip roads should lead off screen not just
// stop, although some can... and some can follow along side the main motorway and has a chance to
// rejoin, as a secret chance path); "all the types of highway should have bridges and slip roads
// you can take"; "make the cars n stuff move across if you can"):
// - every off-slip looks the same from the motorway (signs, exit board). 1 in 4 stops at a gate
// after SLIP_LEN; 1 in 2 runs LONG (SLIP_LONG m, curving away) to a gate off screen; 1 in 4 is the
// SECRET SIDE ROAD (sideStep): alongside, SIDE_GAP m out, following the motorway's bends, then
// merging back into the hard shoulder. The side road counts as ON the road (highwayGuard); on any
// other slip the off-road countdown waits and only the far-out reset ends it ("EXIT TAKEN").
// - road / rail / foot bridges get APPROACHES (approaches): a lane ribbon (tarmac / gravel
// ballast / dirt path) APP_LEN m out each side along the deck axis; render.ts drawBridge draws
// their markings and the MOVING cars / walkers / trains (wall clock, no physics).
// - a RIVER (river) is a real 'wet' COVER (the same water as every puddle: grip, spray, drawn
// into the ground tiles) with dirt banks (zones), cut out where the motorway crosses on its
// parapets (cover.cut: lab.js coverAt + render.ts coverCells), APP_LEN m each side.
// - anything long that leaves the road (approach, river, long slip) is CUT SHORT
// where the road later swings back across it (cuts).
// - the WALLED preset gets them too: a gap in the left wall / armco where a slip leaves or the side
// road runs (P[j].gapL). All the new random choices draw from st.xrnd, so the road's own shape
// stream (st.rnd) is unchanged by them.
export const SLIP_EVERY = [2000, 4000],
  BRIDGE_EVERY = [1100, 2400],
  SLIP_LEN = 150,
  SLIP_DEG = 9,
  SLIP_W = 5,
  PIER = 6;
export const SIDE_W_HALF = 2.5,
  SLIP_LONG = [300, 420],
  SIDE_GAP = 14,
  SIDE_OUT = 140,
  SIDE_IN = 140,
  SIDE_RUN = [250, 750],
  APP_LEN = 150,
  APP_STEP = 8;
// KEEP-OUT areas for scenery (trees, rocks, barns, solar farms): rects { x, y, ax, ay (unit axis),
// hu, hv }
export function blocked(keep, x, y, radius) {
  for (const rect of keep) {
    const dx = x - rect.x,
      dy = y - rect.y,
      along = dx * rect.ax + dy * rect.ay,
      across = -dx * rect.ay + dy * rect.ax;
    if (Math.abs(along) < rect.hu + radius && Math.abs(across) < rect.hv + radius) return true;
  }
  return false;
}
const SCENERY = { tree: 3, rock: 3, block: 8, solarfarm: 16 };
export function keepOut(level, rect, dist) {
  // a feature that needs the GROUND (approach, river, slip) drops any field / village under it,
  // whole (scenery, fieldsA below)
  if (rect.field == null) clearFields(level, rect);
  rect._s = dist;
  level._hw.keep.push(rect);
  const kept = level.props.filter(
    (prop) => !SCENERY[prop.kind] || !blocked([rect], prop.x, prop.y, SCENERY[prop.kind])
  );
  if (kept.length !== level.props.length) {
    level.props.length = 0;
    level.props.push(...kept);
  }
}
// CUT SHORT. c = { pts (outward polyline, truncated in place), s, w, skip: [s0, s1] (road distances
// never tested: its own stretch), after }. A road point within reach of a polyline point (k >= 1)
// cuts the polyline before that point.
export const cutSkips = (cut, dist) => dist >= cut.skip[0] && dist <= cut.skip[1];
export function cutBy(level, cut, x, y) {
  const thr = (level._hw.geo.hw + cut.w / 2 + 3) ** 2, road = cut.pts;
  for (let idx = 1; idx < road.length; idx++)
    if ((road[idx][0] - x) ** 2 + (road[idx][1] - y) ** 2 < thr) {
      road.length = idx;
      cut.after();
      return;
    }
}
export function addCut(level, cut) {
  const state = level._hw;
  cut._s = cut.s;
  state.cuts.push(cut);
  for (let j = 0; j < state.pts.length; j += 2)
    if (!cutSkips(cut, state.pts[j].s)) cutBy(level, cut, state.pts[j].x, state.pts[j].y);
}
// THE SECRET SIDE ROAD, one road point at a time (built with the road, so it follows every bend):
// stores its centre's offset to the LEFT of the centreline as P[i].sideOff (the guard reads it).
// Pieces are flushed at the end of each dress call (sideFlush).
export function sideStep(level, i, pointAt) {
  const state = level._hw,
    sideRoad = state.side;
  if (!sideRoad) return;
  const road = state.pts,
    along = road[i].s - sideRoad.s0,
    halfWidth = state.geo.hw,
    total = SIDE_OUT + sideRoad.run + SIDE_IN;
  if (along > total) {
    sideFlush(level, true);
    state.side = null;
    state.nextBridge = Math.max(state.nextBridge, road[i].s + 150);
    return;
  }
  const blend =
    along < SIDE_OUT
      ? ease(along / SIDE_OUT)
      : along < SIDE_OUT + sideRoad.run
        ? 1
        : 1 - ease((along - SIDE_OUT - sideRoad.run) / SIDE_IN);
  const off = halfWidth - 2.6 + (SIDE_GAP + 2.6) * blend;
  road[i].sideOff = off;
  road[i].gapL = 1;
  if (i % 3 === 0 || along + STEP > total) {
    const pos = pointAt(i, -off);
    sideRoad.pts.push([pos.x, pos.y]);
    if (off > halfWidth + 2.5) sideRoad.mpts.push([pos.x, pos.y]);
  }
  // ~100 m pieces, so each is dropped behind with its own stretch of road (one long piece would
  // vanish while its end was on screen)
  if (sideRoad.pts.length >= 9) sideFlush(level, false, road[i].s);
}
export function sideFlush(level, end, sNext) {
  const state = level._hw,
    sideRoad = state.side;
  if (!sideRoad) return;
  if (sideRoad.pts.length >= 2)
    level.lanes.push({
      pts: sideRoad.pts,
      width: SLIP_W,
      surface: SURFACES.tarmac,
      _s: sideRoad.sPiece,
    });
  // its edge lines (render.ts drawSlip), only where it has left the motorway's tarmac
  if (sideRoad.mpts.length >= 2)
    level.props.push({
      kind: "slip",
      line: sideRoad.mpts,
      w: SLIP_W,
      nose: false,
      x: sideRoad.mpts[0][0],
      y: sideRoad.mpts[0][1],
      _s: sideRoad.sPiece,
    });
  // the next piece starts on this one's last point (no seam); sPiece = the road distance it is
  // dropped behind with
  const last = sideRoad.pts[sideRoad.pts.length - 1],
    lastM = sideRoad.mpts[sideRoad.mpts.length - 1];
  sideRoad.pts = end || !last ? [] : [last];
  sideRoad.mpts = end || !lastM ? [] : [lastM];
  sideRoad.sPiece = sNext ?? state.pts[state.pts.length - 1].s;
}
// a bridge's APPROACHES: straight on along the deck axis from the outer face of each abutment (cut
// short where the road comes back)
export function approaches(level, bridge, dist) {
  const half = bridge.wid / 2,
    carries = bridge.carries,
    axisX = Math.cos(bridge.rot),
    axisY = Math.sin(bridge.rot);
  const width = carries === "road" ? 7 : carries === "rail" ? 5.5 : 2.4,
    surface =
      carries === "road" ? SURFACES.tarmac : carries === "rail" ? SURFACES.gravel : SURFACES.dirt;
  bridge.appL = [APP_LEN, APP_LEN];
  bridge.appW = width;
  bridge.reach = half + 3 + APP_LEN;
  keepOut(
    level,
    { x: bridge.x, y: bridge.y, ax: axisX, ay: axisY, hu: half + 4 + APP_LEN, hv: width / 2 + 4 },
    dist
  );
  [-1, 1].forEach((sign, sideIdx) => {
    const pts = [];
    for (let along = 0; along <= APP_LEN + 1e-6; along += APP_STEP) {
      const offset = sign * (half + 3 + along);
      pts.push([bridge.x + axisX * offset, bridge.y + axisY * offset]);
    }
    const lane = { pts, width: width, surface, _s: dist };
    level.lanes.push(lane);
    addCut(level, {
      pts,
      s: dist,
      w: width,
      skip: [dist - 80, dist + 80],
      after: () => {
        lane._segs = null;
        bridge.appL[sideIdx] = Math.max(0, (pts.length - 1) * APP_STEP);
      },
    });
  });
}
// a RIVER under the motorway: per side, one water cover + two dirt bank strips, from just inside
// the parapet to APP_LEN m beyond it. The cover's `cut` removes the part under the motorway exactly
// (lab.js coverAt + render.ts coverCells): in the river's frame the road edges are u = v tan(skew)
// +- e.
export function river(level, bridge, dist) {
  const state = level._hw,
    riverW = bridge.ww,
    tanSkew = Math.tan(bridge.skew),
    roadEdge = bridge.roadHw / Math.cos(bridge.skew),
    axisX = Math.cos(bridge.rot),
    axisY = Math.sin(bridge.rot);
  const coverStart = Math.max(1, roadEdge - Math.abs(tanSkew) * (riverW / 2 + 1.2) - 0.5);
  bridge.reach = roadEdge + APP_LEN;
  keepOut(
    level,
    {
      x: bridge.x,
      y: bridge.y,
      ax: axisX,
      ay: axisY,
      hu: roadEdge + APP_LEN + 2,
      hv: riverW / 2 + 5,
    },
    dist
  );
  for (const sign of [-1, 1]) {
    const water = {
      cover: "wet",
      shape: "rect",
      rot: bridge.rot,
      h: riverW,
      cut: { ox: bridge.x, oy: bridge.y, tn: tanSkew, e: roadEdge },
      _s: dist,
    };
    const banks = [-1, 1].map((bankSide) => ({
      surface: SURFACES.dirt,
      rot: bridge.rot,
      h: 1.2,
      _s: dist,
      sv: bankSide,
    }));
    const put = (len) => {
      const along = sign * (coverStart + len / 2);
      Object.assign(water, { x: bridge.x + axisX * along, y: bridge.y + axisY * along, w: len });
      delete water._cells;
      // the banks start at the parapet line (never on the motorway's tarmac)
      for (const bank of banks) {
        const across = bank.sv * (riverW / 2 + 0.6),
          alongBank =
            sign *
            (roadEdge +
              Math.abs(tanSkew) * (riverW / 2 + 1.2) +
              (len - (roadEdge - coverStart)) / 2);
        Object.assign(bank, {
          x: bridge.x + axisX * alongBank - axisY * across,
          y: bridge.y + axisY * alongBank + axisX * across,
          w: Math.max(0.5, len - (roadEdge - coverStart)),
        });
      }
      state.coversDirty = true;
    };
    put(roadEdge - coverStart + APP_LEN);
    state.covers.push(water);
    level.zones.push(...banks);
    const pts = [];
    for (let along = 0; along <= APP_LEN + 1e-6; along += 10) {
      const offset = sign * (roadEdge + along);
      pts.push([bridge.x + axisX * offset, bridge.y + axisY * offset]);
    }
    addCut(level, {
      pts,
      s: dist,
      w: riverW,
      skip: [dist - 80, dist + 80],
      after: () => put(Math.max(0.5, roadEdge - coverStart + 10 * (pts.length - 1) - 6)),
    });
  }
}
// the level's covers = the highway's own (rivers) + the level's generated inclusions; a NEW array
// so render.ts re-merges them
export function syncCovers(level) {
  const state = level._hw;
  state.coversDirty = false;
  level._coversBase = state.covers;
  level.covers = [...state.covers, ...((level._incl && level._incl.covers) || [])];
}
