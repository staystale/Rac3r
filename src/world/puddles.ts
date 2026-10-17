// WEATHER PUDDLES AND SNOW PATCHES (weather R4, ?weather=1). ONE water system: a puddle is the
// existing standing-water cover ('wet', wear.ts), a snow patch the existing 'snow' cover; here
// they come and go with the weather instead of being placed by hand.
//
// SITES: each level with a lap gets puddle sites once, from its own seeded stream: along the track
// and just off it, more likely in a DIP of the terrain and less on a crest (water runs downhill),
// bigger in a dip. Some sites can hold SNOW (a lower chance, owner). A site FILLS in rain once the
// ground is soaked, DRAINS very slowly in a dry spell (faster when hot); snow SETTLES while it
// snows below freezing and MELTS into a puddle when it warms. A site shows in STEPS sizes, so the
// ground repaints only when one changes step; neighbours that grow into each other merge, as the
// ground draws every cover of a kind as one union (render/ground/covers.ts).
//
// The puddles the levels had are the weather's now: with ?weather=1 every hand-placed and blended
// puddle goes, except SCENERY water (Cover.water: rivers, lakes, fords - permanent) and the Lab's
// test features (levels without a lap). TYRES clear standing water in 3 passes, rain tyres in 1
// (owner); soft ground still churns to mud. MUD dries back to dirt in a dry spell (owner).
import { LEVEL } from "./state.ts";
import { WEATHER } from "./weather.ts";
import { heightAt } from "./terrain.ts";
import { seededRng } from "./blend.ts";
import { wearMap, wearDirty, WEAR_CELL, layersAt, wearKey } from "./wear.ts";
import type { Cover, Layers, Level, PuddleSite, WearCell } from "./types.ts";

// m between candidate sites along the lap, and the most sites a level gets
const SITE_SPACING = 22, MAX_SITES = 48;
// the chance a candidate becomes a site: on level ground, and how much a dip / crest of DIP_REF m
// (the ground there against the mean 6 m around) adds / takes off
const SITE_CHANCE = 0.18, DIP_GAIN = 0.5, CREST_LOSS = 0.12, DIP_REF = 0.15, DIP_PROBE = 6;
// the share of sites that can hold snow
const SNOW_SITE_CHANCE = 0.35;
// fill a second at rain 1 (a dip's catch more), once the ground is this wet; drain a second per C
// of track temperature in a dry spell (20 C: ~13 min empty; 40 C: ~6)
const FILL_PER_S = 1 / 180, FILL_FROM_WETNESS = 0.6, DRAIN_PER_S_PER_C = 1 / (900 * 20);
// snow a second at snow 1 while the track is below SNOW_BELOW_C; melt a second per C above it
const SNOW_PER_S = 1 / 150, SNOW_BELOW_C = 1, MELT_PER_S_PER_C = 1 / 3000;
// the sizes a site shows: STEPS steps, from STEP_MIN of its full size
const STEPS = 4, STEP_MIN = 0.45;
// s between updates (fills move slowly; the ground repaints at most this often)
const TICK_S = 1;
// MUD DRYING: a s per C of track temperature to dry one step (mud -> dirt, thick mud -> mud; 20 C:
// ~4 min), only in a dry spell and above MUD_DRY_FROM_C
const MUD_DRY_PER_S_PER_C = 1 / (240 * 20), MUD_DRY_FROM_C = 5, DRY_SPELL_WETNESS = 0.15;
const MUD_DRIES_TO: Record<string, string> = { mud: 'dirt', thickMud: 'mud' };
// a tyre's WET grip from which it is a rain tyre (cars.ts: KUM Wet 1.22, PIRRELLY Full Wet 1.35)
const RAIN_TYRE_WET = 1.2;

let enabled = false;
let rainTyre = false;
let tickS = 0;

/** Areas of ground whose look changed (a puddle grew or shrank): render/tilesWear repaints them. */
export const groundDirtyAreas: { x0: number; y0: number; x1: number; y1: number }[] = [];

/**
 * Turns weather puddles on (?weather=1, at start-up).
 * @param isOn true to let the weather make and take puddles
 */
export function setWeatherPuddles(isOn: boolean): void { enabled = isOn; }

/**
 * The tyre of the car whose wheels are being passed over the ground (wear.ts stepWear).
 * @param tyre the fitted tyre, or null (Pre-Spun)
 */
export function setPassTyre(tyre: { grip: Record<string, number> } | null | undefined): void {
  rainTyre = !!tyre && (tyre.grip.wet ?? 1) >= RAIN_TYRE_WET;
}

/**
 * How much one tyre pass clears of a cell's standing water (owner: 3 passes, rain tyres 1), or
 * null to keep the old rule (no weather puddles, or damp ground).
 * @param standing whether the water is standing (a puddle)
 * @returns the dryness the pass adds, or null
 */
export function puddleClearBy(standing: boolean): number | null {
  return enabled && standing ? (rainTyre ? 1 : 1 / 3) : null;
}

/**
 * The level's own covers with its puddles left out when the weather makes them (scenery water and
 * the Lab's test features stay).
 * @param level the level
 * @param covers its hand-placed and blended covers
 * @returns the covers to keep
 */
export function staticCovers(level: Level, covers: Cover[]): Cover[] {
  if (!enabled || level.endless || !level.subtrack) return covers;
  return covers.filter((cover) => cover.cover !== 'wet' || cover.water);
}

/** How far the ground at a point sits below the mean of the ground around it, m (+ = a dip). */
function dipAt(x: number, y: number): number {
  const around = (heightAt(x + DIP_PROBE, y) + heightAt(x - DIP_PROBE, y)
    + heightAt(x, y + DIP_PROBE) + heightAt(x, y - DIP_PROBE)) / 4;
  return around - heightAt(x, y);
}

/**
 * The level's puddle sites, from its own seeded stream.
 * @param level the level (with a lap)
 * @returns the sites
 */
export function buildPuddleSites(level: Level): PuddleSite[] {
  const sub = level.subtrack;
  if (!enabled || level.endless || !sub) return [];
  const random = seededRng(level.id + ':puddles'), sites: PuddleSite[] = [];
  for (let dist = SITE_SPACING / 2; dist < sub.totalDist && sites.length < MAX_SITES;
    dist += SITE_SPACING) {
    const point = sub.pts[Math.min(sub.pts.length - 1,
      Math.round((dist / sub.totalDist) * sub.pts.length))];
    const side = (random() * 2 - 1) * (sub.width / 2 + 3);
    const x = point.x + point.nx * side, y = point.y + point.ny * side;
    const dip = dipAt(x, y) / DIP_REF;
    const chance = SITE_CHANCE + DIP_GAIN * Math.max(0, Math.min(1, dip))
      - CREST_LOSS * Math.max(0, Math.min(1, -dip));
    if (random() >= chance) continue;
    const big = 1 + 0.3 * Math.max(0, Math.min(1, dip));
    sites.push({ x, y, w: (5 + 6 * random()) * big, h: (3 + 3 * random()) * big,
      rot: point.heading + (random() - 0.5) * 0.6,
      catchK: 0.7 + 0.6 * Math.max(0, Math.min(1, dip)),
      snowy: random() < SNOW_SITE_CHANCE, water: 0, snow: 0, shown: '', covers: {} });
  }
  return sites;
}

/** What a site shows now: its kind and size step ('' = nothing). */
function siteLook(site: PuddleSite): string {
  if (site.snow > 0) return 'snow' + Math.ceil(site.snow * STEPS);
  if (site.water > 0) return 'wet' + Math.ceil(site.water * STEPS);
  return '';
}

/** The cover a site shows at a look (cached per site and look). */
function siteCover(site: PuddleSite, look: string): Cover {
  const cached = site.covers[look];
  if (cached) return cached;
  const step = +look.slice(-1), size = STEP_MIN + (1 - STEP_MIN) * (step / STEPS);
  const cover: Cover = { x: site.x, y: site.y, w: site.w * size, h: site.h * size,
    cover: look.startsWith('snow') ? 'snow' : 'wet', shape: 'ellipse', rot: site.rot };
  site.covers[look] = cover;
  return cover;
}

/** The ground a site can cover, as a dirty area (its full size, both axes). */
function siteArea(site: PuddleSite) {
  const reach = Math.max(site.w, site.h) / 2 + 1;
  return { x0: site.x - reach, y0: site.y - reach, x1: site.x + reach, y1: site.y + reach };
}

/**
 * One wear cell follows the covers over it now (resyncCells).
 * @param cell the wear cell (changed in place)
 * @param layers the static layers at its centre, with the new covers
 */
function resyncCell(cell: WearCell, layers: Layers): void {
  const want = layers.cover, was = cell.cover || cell.base;
  if (!want && cell.standing && (cell.cover === 'wet' || cell.cover === 'snow')) {
    cell.cover = null;
  } else if (want && !cell.cover && (want === 'snow' || WEATHER.rain > 0)) {
    cell.cover = want;
    cell.standing = true;
    cell.dry = 0;
    cell.passes = 0;
  }
  cell.orig = want || layers.base;
  const now = cell.cover || cell.base;
  if (now !== was) {
    cell.current = now;
    wearDirty.push(cell);
  }
}

/**
 * The wear cells under a site follow its new look: water that receded leaves the cell, new water
 * or snow lies on a bare cell (rain refills a puddle tyres cleared), so physics and the drawn
 * ground agree with the covers.
 * @param site the site
 */
function resyncCells(site: PuddleSite): void {
  const area = siteArea(site);
  for (let cellI = Math.floor(area.x0 / WEAR_CELL); cellI <= area.x1 / WEAR_CELL; cellI++) {
    for (let cellJ = Math.floor(area.y0 / WEAR_CELL); cellJ <= area.y1 / WEAR_CELL; cellJ++) {
      const cell = wearMap.get(wearKey(cellI, cellJ));
      if (cell) resyncCell(cell, layersAt((cellI + 0.5) * WEAR_CELL, (cellJ + 0.5) * WEAR_CELL));
    }
  }
}

/**
 * Puts the sites' looks into the level's covers; the ground over changed sites repaints, the AI
 * reads the grip again.
 * @param changed the sites whose look changed
 */
function applyLooks(changed: PuddleSite[]): void {
  const shown: Cover[] = [];
  for (const site of LEVEL._puddleSites || []) {
    if (site.shown) shown.push(siteCover(site, site.shown));
  }
  LEVEL.covers = [...(LEVEL._staticCovers || []), ...shown];
  for (const site of changed) {
    groundDirtyAreas.push(siteArea(site));
    resyncCells(site);
  }
  // the AI's speed plan reads the ground's grip again (line.ts regripPath)
  if (changed.length) WEATHER.epoch++;
}

/** Moves one site's water and snow by the weather over a tick. */
function stepSite(site: PuddleSite, seconds: number): void {
  const trackC = WEATHER.trackC;
  if (WEATHER.wetness >= FILL_FROM_WETNESS) site.water += WEATHER.rain * FILL_PER_S * site.catchK
    * seconds;
  if (WEATHER.rain < 0.05) site.water -= Math.max(0, trackC) * DRAIN_PER_S_PER_C * seconds;
  if (site.snowy && trackC < SNOW_BELOW_C) site.snow += WEATHER.snow * SNOW_PER_S * seconds;
  if (site.snow > 0 && trackC > SNOW_BELOW_C) {
    const melted = Math.min(site.snow, (trackC - SNOW_BELOW_C) * MELT_PER_S_PER_C * seconds);
    site.snow -= melted;
    site.water += melted;
  }
  site.water = Math.max(0, Math.min(1, site.water));
  site.snow = Math.max(0, Math.min(1, site.snow));
}

/** Dries worn mud back toward dirt in a dry spell (owner), a tick at a time. */
function dryMud(seconds: number): void {
  const trackC = WEATHER.trackC;
  if (WEATHER.wetness > DRY_SPELL_WETNESS || WEATHER.rain > 0 || trackC < MUD_DRY_FROM_C) return;
  for (const cell of wearMap.values()) {
    const next = MUD_DRIES_TO[cell.base];
    if (!next || cell.cover) continue;
    cell.mudDry = (cell.mudDry || 0) + trackC * MUD_DRY_PER_S_PER_C * seconds;
    if (cell.mudDry < 1) continue;
    cell.mudDry = 0;
    cell.base = next;
    cell.current = next;
    wearDirty.push(cell);
  }
}

/**
 * One sim step of the puddles (every TICK_S they move): fill, drain, settle, melt; the level's
 * covers follow when a site changes step; mud dries.
 * @param dt sim seconds
 */
export function stepPuddles(dt: number): void {
  if (!enabled) return;
  tickS += dt;
  if (tickS < TICK_S) return;
  const seconds = tickS;
  tickS = 0;
  const changed: PuddleSite[] = [];
  for (const site of LEVEL._puddleSites || []) {
    stepSite(site, seconds);
    const look = siteLook(site);
    if (look !== site.shown) {
      site.shown = look;
      changed.push(site);
    }
  }
  if (changed.length) applyLooks(changed);
  dryMud(seconds);
}

/**
 * Starts the puddles of an event (wear.ts has just been cleared): a wet start already has puddles
 * in the dips, a snowy one snow in its snow sites; a dry start none.
 */
export function resetPuddles(): void {
  if (!enabled) return;
  tickS = 0;
  const sites = LEVEL._puddleSites || [];
  const raining = WEATHER.rain > 0 && WEATHER.wetness >= FILL_FROM_WETNESS;
  const snowing = WEATHER.snow > 0 && WEATHER.trackC < SNOW_BELOW_C;
  for (const site of sites) {
    site.water = raining ? Math.min(1, 0.5 * site.catchK) : 0;
    site.snow = snowing && site.snowy ? 0.5 : 0;
    site.shown = siteLook(site);
  }
  applyLooks(sites);
}
