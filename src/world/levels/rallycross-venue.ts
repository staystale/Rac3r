// world/levels/rallycross-venue.ts - A VENUE'S RALLYCROSS LAYOUT AS A LEVEL (for a NEW rallycross
// venue from the map; the old stages stay as they are - owner 11-10: "keep the originals"): the
// venue's level (world/venue.ts) with the joker rule, the rallycross dressing - hay bales round the
// corners where no wall stands and both sides of the loose stretches lined, bales
// between the joker and the lap where they run apart - and the rallycross bushes.
import { looseRadius, tidyLoose, venueBuild, venueLevel } from "../venue.ts";
import { isNearLine } from "../venuegeo.ts";
import { FIX } from "../../core/fixes.ts";
import { venueJoker } from "../venuejoker.ts";
import { SURFACES } from "../surfaces.ts";
import { jokerApproach, jokerArrow } from "./slidden-hill.ts";
import { jokerBales, rxDress } from "./kit.ts";
import { RX_BUSHES } from "./bushes.ts";
import type { VenueSpec } from "../venue.ts";
import type { Cone, JokerRule, Lane, Level, Point, Solid, Subtrack } from "../types.ts";

// the joker rule (the old Knobhill's and Slidden Hill's: 30 s for a missed or a second joker, 5
// laps a race), and the gate's reach at the joker lane's middle
const JOKER_PENALTY_S = 30, JOKER_LAPS = 5, JOKER_GATE_R = 7;
// (?jokerarrow=1) the mouth's arrow tipped this far toward the way the joker bends (rad, the lap
// arrow's old tilt), judged this far along it (m), and a bend under this is straight on (rad)
const JOKER_ARROW_TIP_RAD = 0.35, JOKER_TURN_AHEAD_M = 30, JOKER_TURN_MIN_RAD = 0.3;
// m past a prop's solid box a dressing tyre or bale keeps
const SOLID_PAD_M = 0.5;

/**
 * The loose objects with none on the joker lane's road: the corner bales go round the lap's
 * outside where no wall stands, and where the joker branches off a corner that outside is the
 * joker's way in or out (L.A. Lively: 3 bales on its lane, one 4.1 m off its centre). The bales
 * between the joker and the lap are laid 0.9 m or more clear of it, so they stay.
 * @param cones the loose objects
 * @param lane the joker lane
 * @returns the objects kept
 */
function clearJokerLane(cones: Cone[], lane: Lane): Cone[] {
  const half = lane.width / 2;
  return cones.filter((cone) => !looseRadius(cone)
    || !isNearLine(lane.pts, cone.x, cone.y, half + looseRadius(cone)));
}

/**
 * Whether a point lies in (or within SOLID_PAD_M of) a solid prop's turned box.
 * @param solids the level's solids
 * @param x world x
 * @param y world y
 * @returns true when in one
 */
function inSolid(solids: Solid[], x: number, y: number): boolean {
  return solids.some((solid) => {
    const cosR = Math.cos(solid.rot || 0), sinR = Math.sin(solid.rot || 0);
    const offX = x - solid.x, offY = y - solid.y;
    return Math.abs(offX * cosR + offY * sinR) < solid.w / 2 + SOLID_PAD_M
      && Math.abs(-offX * sinR + offY * cosR) < solid.h / 2 + SOLID_PAD_M;
  });
}

/**
 * A venue's rallycross layout as a level.
 * @param spec the venue
 * @param layout its rallycross layout (spec.joker names it)
 * @param levelId the level id
 * @param name the level's name
 * @returns the level
 */
export function rallycrossLevel(spec: VenueSpec, layout: string, levelId: string,
  name: string): Level {
  const level = venueLevel(spec, layout, levelId, name);
  const sub = level.subtrack!, lane = venueJoker(venueBuild(spec), layout)!;
  const loose = sub.sectors.filter((sector) => sector.surface === SURFACES.dirt)
    .map((sector): Point => [sector.startDist, sector.endDist]);
  // (none in a prop: a corner's tyre block landed in a marshal post's hut)
  const bales = rxDress(sub, level.lanes || [], level.cones, loose)
    .filter((cone) => !inSolid(level.solids || [], cone.x, cone.y));
  const cones = [...level.cones, ...bales];
  const mid = lane.pts[Math.floor(lane.pts.length / 2)];
  // (tidied as the venue's own: none on another or on a barrier)
  // (the rallycross bushes, but on a venue with none: a street course's)
  const kept = tidyLoose([...cones, ...jokerBales(sub, lane, cones)], level.barriers || [], sub,
    level.covers || []);
  return { ...level, ...(spec.bushless ? {} : { bushes: RX_BUSHES }),
    cones: clearJokerLane(kept, lane),
    joker: { gate: { x: mid[0], y: mid[1], r: JOKER_GATE_R }, penalty: JOKER_PENALTY_S,
      laps: JOKER_LAPS,
      arrows: jokerArrows(sub, lane) } };
}

/**
 * The joker's painted arrows: one in its mouth along the lane (with ?jokerarrow=1 tipped toward the
 * way it bends next: it is a corner), one on the lap before it. The lap's
 * one is tilted 0.35 rad toward the joker's side (Slidden Hill's, where the joker leaves at an
 * angle); with ?jokerarrow=1 it points at the mouth's arrow instead - where the joker runs
 * straight on and the lap turns away (L.A. Lively), the tilt aimed it 20 deg into the barrier
 * beside the mouth (-70 deg against the lane's -90).
 * @param sub the raced road
 * @param lane the joker lane
 * @returns the arrows
 */
function jokerArrows(sub: Subtrack, lane: Lane): JokerRule['arrows'] {
  const mouth = jokerArrow(sub, lane.pts), approach = jokerApproach(sub, lane.pts);
  if (FIX.jokerarrow && mouth && approach) {
    approach.rot = Math.atan2(mouth.y - approach.y, mouth.x - approach.x);
    mouth.rot += JOKER_ARROW_TIP_RAD * jokerTurnSide(lane.pts, mouth);
  }
  return [mouth, approach].filter(Boolean);
}

/**
 * Which way the joker lane bends after its mouth: the sign of the heading change from the mouth to
 * JOKER_TURN_AHEAD_M along it (L.A. Lively's turns left, -90 to -164 deg over 36 m).
 * @param pts the joker lane's points
 * @param mouth the mouth's arrow (on one of them)
 * @returns +1, -1, or 0 where it runs straight
 */
function jokerTurnSide(pts: Point[], mouth: { x: number; y: number; rot: number }): number {
  let start = 0;
  pts.forEach(([x, y], i) => {
    if (Math.hypot(x - mouth.x, y - mouth.y) < Math.hypot(pts[start][0] - mouth.x,
      pts[start][1] - mouth.y)) start = i;
  });
  let along = 0, end = start;
  while (end < pts.length - 1 && along < JOKER_TURN_AHEAD_M) {
    along += Math.hypot(pts[end + 1][0] - pts[end][0], pts[end + 1][1] - pts[end][1]);
    end++;
  }
  const last = pts[end], before = pts[Math.max(start, end - 1)];
  const heading = Math.atan2(last[1] - before[1], last[0] - before[0]);
  const turn = Math.atan2(Math.sin(heading - mouth.rot), Math.cos(heading - mouth.rot));
  return Math.abs(turn) < JOKER_TURN_MIN_RAD ? 0 : Math.sign(turn);
}
