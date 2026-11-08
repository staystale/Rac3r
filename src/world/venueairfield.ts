// world/venueairfield.ts - AN AIRFIELD INSIDE A VENUE (world/venuescenery.ts builds the rest;
// Thruxton's): its paved runways, taxiways and aprons as tarmac, a grass runway mown short, and
// light aircraft parked on its grass stands.
import { SURFACES } from "./surfaces.ts";
import { inZones, outlineZone, pastRim } from "./venueedge.ts";
import { inBuilding, onLanes, placeAll } from "./venuesite.ts";
import type { Site } from "./venuesite.ts";
import type { Point, Prop, Zone } from "./types.ts";

// real m: a light aircraft's wingspan (a Cessna 172's 11 m)
const REAL_PLANE_SPAN_M = 11;

/**
 * Light aircraft parked on an airfield's grass stands (spec.planes, one a colour): stands picked by
 * the venue's seed, each plane on its stand's middle along it, at a real light aircraft's size
 * (PLANE_SPAN_M) at the venue's scale, clear of every road, paved zone and building.
 * @param site the venue's builders' state
 * @param zones the zones (a plane keeps off a paved one)
 * @param solids the props standing (a plane keeps off them)
 * @returns the plane props
 */
export function venuePlanes(site: Site, zones: Zone[], solids: Prop[]): Prop[] {
  const colours = site.build.spec.planes || [], planes: Prop[] = [];
  const stands = (site.build.spec.data.aero || []).filter((way) => way.kind === 'stand')
    .map((way) => placeAll(site, way.pts));
  const paved = zones.filter((zone) => zone.surface === SURFACES.tarmac);
  const span = REAL_PLANE_SPAN_M * site.build.scale;
  while (stands.length && planes.length < colours.length) {
    const pts = stands.splice(Math.floor(site.rnd() * stands.length), 1)[0];
    const [fromX, fromY] = pts[0], [toX, toY] = pts[pts.length - 1];
    const x = (fromX + toX) / 2, y = (fromY + toY) / 2, rot = Math.atan2(fromY - toY, fromX - toX);
    const corners = [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([along, across]): Point =>
      [x + Math.cos(rot) * along * span / 2 - Math.sin(rot) * across * span / 2,
        y + Math.sin(rot) * along * span / 2 + Math.cos(rot) * across * span / 2]);
    if (corners.some(([cornerX, cornerY]) => onLanes(site.lanes, cornerX, cornerY, 1)
      || inZones(paved, cornerX, cornerY) || inBuilding([...solids, ...planes], cornerX, cornerY, 1)
      || pastRim(site.rims, cornerX, cornerY) < 1)) continue;
    planes.push({ kind: 'plane', x, y, rot, col: colours[planes.length], size: span,
      w: span, h: span });
  }
  return planes;
}

/**
 * An airfield's paved runways, taxiways and aprons as tarmac, a grass runway as mown grass (a
 * grass taxiway or apron is the field it lies in), placed and scaled as the map is.
 * @param site the venue's builders' state
 * @returns the zones
 */
export function venueAero(site: Site): Zone[] {
  const zones: Zone[] = [];
  for (const way of site.build.spec.data.aero || []) {
    const grass = way.surface === 'grass';
    if (way.kind === 'stand' || (grass && way.kind !== 'runway')) continue;
    const surface = grass ? SURFACES.grassShort : SURFACES.tarmac, pts = placeAll(site, way.pts);
    if (way.area) { zones.push(outlineZone(pts, surface)); continue; }
    // a line: each stretch a box its width wide (the joints overlap)
    const half = way.width * site.build.scale / 2;
    for (let i = 1; i < pts.length; i++) {
      const [fromX, fromY] = pts[i - 1], [toX, toY] = pts[i];
      const len = Math.hypot(toX - fromX, toY - fromY) || 1;
      const alongX = (toX - fromX) / len * half, alongY = (toY - fromY) / len * half;
      const box = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([end, side]): Point => {
        const [baseX, baseY] = end < 0 ? [fromX, fromY] : [toX, toY];
        return [baseX + alongX * end - alongY * side, baseY + alongY * end + alongX * side];
      });
      zones.push(outlineZone(box, surface));
    }
  }
  return zones;
}
