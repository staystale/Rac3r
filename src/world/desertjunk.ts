// world/desertjunk.ts - the sizes of DEAF VALLEY's roadside junk and gas station, in a prop's own
// frame (metres; the station's +y away from the road), shared by what is drawn (render/props/
// desertjunk.ts) and what is solid (world/barriers.ts).
//   wreck       a rusted-out car, WRECK_M long and wide
//   gasstation  the LAST GASP shop (GAS_SHOP: centre x, y, w, h) behind its apron, two pumps
//               (GAS_PUMPS) under the canopy (GAS_CANOPY; its posts GAS_POSTS solid)

export const WRECK_M: [number, number] = [4.2, 1.8];
// shack       a tin shack, SHACK_M long and wide, its lean-to off the back of it
export const SHACK_M: [number, number] = [5.2, 3.6];
export const GAS_SHOP: [number, number, number, number] = [0, 13, 14, 7];
export const GAS_PUMPS: [number, number, number, number][] = [[-4, -1, 1.2, 2.2],
  [4, -1, 1.2, 2.2]];
export const GAS_CANOPY: [number, number, number, number] = [0, -1, 16, 8];
export const GAS_POSTS: [number, number][] = [[-6.5, -4], [6.5, -4], [-6.5, 2], [6.5, 2]];
