// world/stationbrands.ts - the PETROL BRANDS of the endless roads' stations and the names of the
// MOTORWAY SERVICES (?hwstations=1; owner 11-10, the names: "Names are perfect"): each brand's
// colours - the canopy's band, the pumps, the shop's front - and the services hall's size in its
// own frame (m; +y away from the road), shared by what is drawn (render/props/desertjunk.ts) and
// what is solid (world/barriers.ts). Deaf Valley's LAST GASP keeps its own (no brand).

/** A petrol brand: its name and colours. */
export interface Brand { name: string; band: string; pump: string; front: string }

export const BRANDS: Brand[] = [
  { name: 'SHALL', band: '#f5c400', pump: '#dd1d21', front: '#dd1d21' },
  { name: 'SMELL', band: '#2f8f3a', pump: '#f5c400', front: '#2f8f3a' },
  { name: 'ESS-NO', band: '#e2231a', pump: '#1d3f8f', front: '#1d3f8f' },
  { name: 'GULP', band: '#f58025', pump: '#0a2d63', front: '#0a2d63' },
  { name: 'TAXACO', band: '#e1251b', pump: '#1b1b1b', front: '#e1251b' },
];

// the motorway services' names
export const SERVICE_NAMES = ['WELCOME BRAKE', 'ROADTHIEF', 'EXTORTION'];

/**
 * A brand by its name.
 * @param name the brand's name (a prop's brand)
 * @returns the brand, or null (LAST GASP's own colours)
 */
export const brandOf = (name?: string): Brand | null =>
  BRANDS.find((brand) => brand.name === name) ?? null;

// the services hall: centre x, y, width, depth, m (its front, -y, faces the road)
export const SERVICES_HALL: [number, number, number, number] = [0, 0, 26, 12];
