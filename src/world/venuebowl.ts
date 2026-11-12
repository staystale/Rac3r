// world/venuebowl.ts - A STADIUM'S OWN DRESSING (world/venuescenery.ts builds the rest; The Bird's
// Mess's): its stands' seat colours and its roof ring's steel lattice (VenueSpec.bowlLook), the
// litter laid by hand on its apron (VenueSpec.litter), and a dressing pass's props and loose
// objects laid after the boards (VenueSpec.dress), each kept clear of them. A venue that asks for
// none of these is built as it was.
import { resample } from "./venuegeo.ts";
import { isAnyPointWithin, makePointGrid } from "../core/pointgrid.ts";
import type { PointGrid } from "../core/pointgrid.ts";
import type { Site } from "./venuesite.ts";
import type { VenueSpec } from "./venue.ts";
import type { Barrier, Cone, Point, Prop } from "./types.ts";

// m: a dressing item keeps this far clear of a board's face and ends (the boards are laid first:
// a prop near one pushed it along its fence - world/venueposts.ts boardOnArmco)
const DRESS_BOARD_M = 2.5;
// m: a loose dressing item's reach round its spot (the largest, a motorhome, 2.4 m)
const LOOSE_REACH_M = 2.5;
// m: and this far clear of a barrier (behind the Armco and the catch fence, never on them)
const DRESS_BARRIER_M = 1.5;

type Landmark = NonNullable<VenueSpec['landmarks']>[number];
type Litter = NonNullable<VenueSpec['litter']>[number];

/**
 * A grandstand's own seats, where the venue's bowl has a look of its own.
 * @param site the venue's builders' state
 * @returns the fields to add to the stand's prop (none: the stands' usual seats)
 */
export function bowlSeats(site: Site): Partial<Prop> {
  const look = site.build.spec.bowlLook;
  return look ? { seats: look.seats } : {};
}

/**
 * A roof ring's slice under the venue's own look: its membrane and the steel lattice over it (the
 * lattice's beams laid by the slice's seed: render/props/scenery.ts drawRoofLattice).
 * @param site the venue's builders' state
 * @param kind the building's kind in the data (the generator's roof slices: 'roof')
 * @param seed the slice's index
 * @returns the fields to lay over the block's (none: a plain roof)
 */
export function bowlRoof(site: Site, kind: string, seed: number): Partial<Prop> {
  const look = site.build.spec.bowlLook;
  return look && kind === 'roof' ? { roof: look.roof, lattice: look.lattice, seed } : {};
}

/**
 * A loose object laid by hand, where it was put.
 * @param site the venue's builders' state
 * @param item the object (real m)
 * @returns the loose object
 */
function litterAt(site: Site, item: Litter): Cone {
  const [x, y] = site.place(item.at);
  return { x, y, kind: item.kind, ...(item.col ? { col: item.col } : {}),
    ...(item.rot === undefined ? {} : { rot: item.rot }) };
}

/**
 * A landmark as a prop: a prop kind at its real spot, size m across, scaled with the map; a long
 * one len m along, turned rot; a flag its colour; a crowd its own seed.
 * @param site the venue's builders' state
 * @param mark the landmark (real m)
 * @returns the prop
 */
function landmarkAt(site: Site, mark: Landmark): Prop {
  const [x, y] = site.place(mark.at), size = mark.size * site.build.scale, { rot, col } = mark;
  return { kind: mark.kind, x, y, size, w: (mark.len || mark.size) * site.build.scale,
    h: size, ...(rot === undefined ? {} : { rot }), ...(col ? { col } : {}),
    ...(mark.seed ? { seed: mark.seed } : {}) };
}

/**
 * The landmarks the map does not carry (spec.landmarks).
 * @param site the venue's builders' state
 * @returns the props
 */
export function venueLandmarks(site: Site): Prop[] {
  return (site.build.spec.landmarks || []).map((mark) => landmarkAt(site, mark));
}

/**
 * Whether a point lies on a board or within DRESS_BOARD_M of one.
 * @param boards the boards
 * @param point the point
 * @param reach the item's own half size, m
 * @returns true when it does
 */
function nearBoard(boards: Prop[], [x, y]: Point, reach: number): boolean {
  return boards.some((board) => {
    const cosR = Math.cos(board.rot || 0), sinR = Math.sin(board.rot || 0);
    const dx = x - board.x, dy = y - board.y, grow = DRESS_BOARD_M + reach;
    return Math.abs(dx * cosR + dy * sinR) < (board.w || 18) / 2 + grow
      && Math.abs(-dx * sinR + dy * cosR) < (board.h || 1.2) / 2 + grow;
  });
}

/**
 * A prop's middle and its two ends along its long side.
 * @param prop the prop
 * @returns the points
 */
function propSpots(prop: Prop): Point[] {
  const half = (prop.w || 0) / 2, cosR = Math.cos(prop.rot || 0), sinR = Math.sin(prop.rot || 0);
  return [-half, 0, half].map((along): Point => [prop.x + cosR * along, prop.y + sinR * along]);
}

/** What a dressing item keeps clear of: the boards, and the barriers' points in a grid. */
interface DressBlockers { boards: Prop[]; rails: PointGrid }

/**
 * What the dressing keeps clear of, gathered once (a build-time lookup).
 * @param props the props laid so far (the boards among them)
 * @param barriers the edge's barriers
 * @returns the boards and the barriers' points, half a metre apart, in a grid
 */
function dressBlockers(props: Prop[], barriers: Barrier[]): DressBlockers {
  return { boards: props.filter((prop) => prop.kind === 'board'),
    rails: makePointGrid(barriers.flatMap((barrier) => resample(barrier.pts, 0.5))) };
}

/**
 * Whether a dressing item's spot is clear of every board and barrier.
 * @param blockers the boards and barriers
 * @param spot the spot
 * @param reach the item's own half size there, m
 * @returns true when clear
 */
const isDressClear = (blockers: DressBlockers, spot: Point, reach: number): boolean =>
  !nearBoard(blockers.boards, spot, reach)
  && !isAnyPointWithin(blockers.rails, spot[0], spot[1], reach + DRESS_BARRIER_M);

/**
 * The dressing pass's props (spec.dress), laid after the boards: one by a board or a barrier
 * left out.
 * @param site the venue's builders' state
 * @param props the props laid so far (the boards among them)
 * @param barriers the edge's barriers
 * @returns the props
 */
export function venueDress(site: Site, props: Prop[], barriers: Barrier[]): Prop[] {
  const dress = site.build.spec.dress?.props || [];
  // (a venue with no dressing builds nothing for it)
  if (!dress.length) return [];
  const blockers = dressBlockers(props, barriers);
  return dress.map((mark) => landmarkAt(site, mark))
    .filter((prop) => propSpots(prop).every((spot) => isDressClear(blockers, spot,
      (prop.h || 1) / 2)));
}

/**
 * The litter laid by hand (spec.litter: a stadium's apron) and the dressing pass's loose objects
 * (spec.dress, one by a board or a barrier left out).
 * @param site the venue's builders' state
 * @param props the props laid (the boards among them)
 * @param barriers the edge's barriers
 * @returns the loose objects
 */
export function venueLitter(site: Site, props: Prop[], barriers: Barrier[]): Cone[] {
  const dress = site.build.spec.dress?.litter || [];
  const blockers = dress.length ? dressBlockers(props, barriers) : null;
  return [...(site.build.spec.litter || []).map((item) => litterAt(site, item)),
    ...dress.map((item) => litterAt(site, item))
      .filter((cone) => isDressClear(blockers!, [cone.x, cone.y], LOOSE_REACH_M))];
}
