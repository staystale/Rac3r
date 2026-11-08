// world/levels/castle-cum-venue.ts - CASTLE CUM AS THE REAL VENUE (world/venue.ts): the real
// Castle Combe Circuit (Wiltshire) from OpenStreetMap (venues/castle-cum.ts) at 1/2 of real
// length with the 13 m road. One layout: the circuit with the two chicanes of 1999 (the Esses
// and Bobbies; the old aerodrome lines beside them stay as road, closed by tyres). Checked against
// Wikipedia and racingcircuits.info (2.977 km; the OSM loop reads 3006 m), the circuit's own site
// sign (the corners, the viewing banks, the paddock, the skid pan and kart track outside
// Hammerdown) and aerial photographs (the red and white tyre walls at Quarry and Tower, grass
// run-off and no gravel traps, no bridge or tunnel over or under the race track: its footbridges
// cross the ring road and the paddock road - owner 11-08: "keep them out if they're not there").
// The edge is the real circuit's (owner 11-08: "keep it like the real track where possible"):
// Armco where its rails are (OSM, and two seen on the aerial photographs), the tyre walls, a catch
// fence instead on the viewing banks, the old lines inside it. The frame is turned as the old
// level was: the start straight across the bottom, run right to left, the lap clockwise. The
// hills are the old level's (the Avon Rise crest before Quarry, the run down to Tower, Folly's
// bumps) at the same corners.
import { CASTLE_CUM_VENUE } from "./venues/castle-cum.ts";
import { venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

export const CASTLE_CUM_SPEC: VenueSpec = {
  id: 'castle-cum',
  data: CASTLE_CUM_VENUE,
  share: 0.5,
  // m: the real road (about 10 m on the aerial photographs)
  realRoadM: 10,
  calibrate: { layout: 'circuit', realLapM: 2977 },
  // the start / finish line on the start straight, by the control tower
  start: [184.3, 467.8],
  pitLane: 'Pit Lane',
  // real m (the venue scales reach and height with the map): the Avon Rise crest before Quarry,
  // broader than the old level's (the longer run from Folly reaches it faster) - light, not flying
  // (tools/crestcheck 290-370: lowest load 0.82-0.90 at race pace, flat out at most 0.07 s off the
  // ground, as the old crest), the broad rise before Tower (you brake for it going downhill) and
  // the bumps at Folly
  hills: [
    { kind: 'hump', x: -407, y: 244.3, r: 76, h: 1.8 },
    { kind: 'hump', x: 239.2, y: -316.3, r: 100, h: 1.8 },
    { kind: 'hump', x: -64.4, y: 458.4, r: 6, h: 0.1 },
    { kind: 'dip', x: -88.5, y: 457.1, r: 6, d: 0.09 },
    { kind: 'hump', x: -113.1, y: 453.4, r: 6, h: 0.1 },
    { kind: 'dip', x: -129.8, y: 434, r: 6, d: 0.09 },
    { kind: 'hump', x: -152.9, y: 425.7, r: 6, h: 0.1 },
  ],
  // the viewing banks (the site sign): outside Folly and Avon Rise, round Quarry, outside the
  // Esses' old line and along Dean Straight. A catch fence only where the real place has one
  // (owner 11-08: "feels a little caged in on straights"): the debris fencing at Folly and Quarry
  // (PistonHeads 19.12.2001: Camp, Folly, Quarry) and along Avon Rise (aerial photographs); at the
  // Esses (OSM: a 1 m wooden railing on the bank) and on Dean Straight the viewers stand behind
  // the circuit's rail (OSM guard rails): Armco there
  banks: [
    { pts: [[-199.7, 436.8], [-259.3, 400.2], [-320.2, 361.1], [-383.9, 308.2]], r: 14, h: 2.6 },
    { pts: [[-506.9, 241], [-583, 210.8], [-607.5, 124.8], [-561.5, 56.5]], r: 14, h: 3 },
    { pts: [[-327.2, -160.7], [-291.1, -196.5], [-255, -232.3]], r: 14, h: 2.6, fenced: false },
    { pts: [[470, 101.8], [452.3, 176.2], [432.9, 243.8], [415.8, 301.3]], r: 14, h: 4,
      fenced: false },
  ],
  // the boards stand on Armco (world/venueedge.ts boardOnArmco): Castle Combe's is round Tower
  boards: [
    { at: [301.3, -351.6], label: 'CASTLE CUM' },
    { at: [380.6, -331.2], label: 'KUM TYRES' },
    { at: [416.8, -284], label: 'SPUM OIL' },
  ],
  // the red and white tyre walls (aerial photographs): round the outside of Quarry and Tower
  tyreWalls: [
    [[-539.3, 213], [-567.8, 191.8], [-583.7, 167.5], [-586.8, 139.4], [-579.1, 99]],
    [[416.8, -284], [404.7, -308.3], [380.6, -331.2], [339.6, -349.6], [301.3, -351.6]],
  ],
  // the skid pan beside the kart track outside Hammerdown (the site sign, aerial photographs; 8 m
  // further out than mapped, clear of the ring road stepped out from the track): the wet surface
  // sample the old level had (owner: the test surfaces stay)
  pads: [{ at: [-156, -364], w: 44, h: 38, rot: 0.3, surface: 'wet' }],
  // the red-orange steel marshals' tower (Marshal Post 1, ukcircuits.net) just past the line,
  // right behind the pit wall (the start straight photograph; aerial photographs: its crown
  // about 4.5 m across, 20 m past the line): between the wall and the pit lane
  landmarks: [{ at: [163.8, 481.8], kind: 'sculpture', size: 4.5 }],
  // the hand finish (game m): the Quarry Bar stands beside the ring road outside Quarry (our
  // placing pushed it onto the road, which broke round it): back off the road
  finish: { move: [{ at: [-282.4, 116.1], by: [-2, 6] }] },
  // the edge as the real circuit's: Armco where its rails are (owner 11-08: "keep it like the real
  // track where possible"), the catch fence instead on the viewing banks
  followRails: true,
  // rails on the aerial photographs that OSM does not map: from Tower's tyre wall up the outside
  // to Bobbies, and beside the old line's far end at Bobbies
  railsSeen: [
    [[415.7, -283.2], [419.6, -245], [424.3, -209.6], [426.4, -184.6], [426.6, -153.5],
      [427.4, -133.8]],
    [[441.4, -9.7], [451.3, 64.6]],
  ],
  seed: 1950,
};

// the one layout, built on first use (world/load.ts buildLevel): a venue takes seconds to build
// on a phone
export const CC_VENUE_LEVEL: Level = ({ id: 'castle-cum', name: 'Castle Cum',
  _build: () => venueLevel(CASTLE_CUM_SPEC, 'circuit', 'castle-cum', 'Castle Cum') } as Level);
