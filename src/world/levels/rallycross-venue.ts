// world/levels/rallycross-venue.ts - A VENUE'S RALLYCROSS LAYOUT AS A LEVEL (for a NEW rallycross
// venue from the map; the old stages stay as they are - owner 11-10: "keep the originals"): the
// venue's level (world/venue.ts) with the joker rule, the rallycross dressing - hay bales round the
// corners where no wall stands and both sides of the loose stretches lined, bales
// between the joker and the lap where they run apart - and the rallycross bushes.
import { tidyLoose, venueBuild, venueLevel } from "../venue.ts";
import { venueJoker } from "../venuejoker.ts";
import { SURFACES } from "../surfaces.ts";
import { jokerApproach, jokerArrow } from "./slidden-hill.ts";
import { jokerBales, rxDress } from "./kit.ts";
import { RX_BUSHES } from "./bushes.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level, Point, Solid } from "../types.ts";

// the joker rule (the old Knobhill's and Slidden Hill's: 30 s for a missed or a second joker, 5
// laps a race), and the gate's reach at the joker lane's middle
const JOKER_PENALTY_S = 30, JOKER_LAPS = 5, JOKER_GATE_R = 7;
// m past a prop's solid box a dressing tyre or bale keeps
const SOLID_PAD_M = 0.5;

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
  return { ...level, bushes: RX_BUSHES,
    cones: tidyLoose([...cones, ...jokerBales(sub, lane, cones)], level.barriers || [], sub,
      level.covers || []),
    joker: { gate: { x: mid[0], y: mid[1], r: JOKER_GATE_R }, penalty: JOKER_PENALTY_S,
      laps: JOKER_LAPS,
      arrows: [jokerArrow(sub, lane.pts), jokerApproach(sub, lane.pts)].filter(Boolean) } };
}
