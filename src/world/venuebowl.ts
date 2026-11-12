// world/venuebowl.ts - A STADIUM'S OWN DRESSING (world/venuescenery.ts builds the rest; The Bird's
// Mess's): its stands' seat colours and its roof ring's steel lattice (VenueSpec.bowlLook), and
// the litter laid by hand on its apron (VenueSpec.litter). A venue that asks for neither is built
// as it was.
import type { Site } from "./venuesite.ts";
import type { Cone, Prop } from "./types.ts";

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
 * The litter laid by hand (spec.litter: a stadium's apron), each loose object where it was put.
 * @param site the venue's builders' state
 * @returns the loose objects
 */
export function venueLitter(site: Site): Cone[] {
  return (site.build.spec.litter || []).map((item) => {
    const [x, y] = site.place(item.at);
    return { x, y, kind: item.kind, ...(item.col ? { col: item.col } : {}) };
  });
}
