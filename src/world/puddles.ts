// WEATHER PUDDLES AND SNOW PATCHES (weather R4, ?weather=1). ONE water system: a puddle is the
// existing standing-water cover ('wet', wear.ts), a snow patch the existing 'snow' cover; here
// they come and go with the weather instead of being placed by hand.
//
// SITES: each level with a lap gets puddle sites once, from its own seeded stream: along the track
// and just off it, and over the whole floor (owner: anywhere), water more likely in a DIP of the
// terrain and less on a crest (water runs downhill), bigger in a dip. SNOW can lie anywhere (a
// site of the floor holds snow more often than water), in wider patches. A site FILLS in rain
// once the ground is soaked, DRAINS very slowly in a dry spell (faster when hot); snow SETTLES
// while it snows below freezing and MELTS into a puddle when it warms. A site shows in STEPS
// sizes, so the ground repaints only when one changes step; neighbours that grow into each other
// merge, as the ground draws every cover of a kind as one union (render/ground/covers.ts).
//
// The puddles the levels had are the weather's now: with ?weather=1 every hand-placed and blended
// puddle goes, except SCENERY water (Cover.water: rivers, lakes, fords - permanent) and the Lab's
// test features (levels without a lap). TYRES clear standing water in 3 passes, rain tyres in 1
// (owner); soft ground still churns to mud. MUD dries back to dirt in a dry spell (owner).
//
// THE COLD (owner): below freezing a puddle turns to ICE (and thaws back above 1 C), worn mud may
// freeze over, and scenery water may freeze over when it is properly cold. AN EVENT'S START
// (owner: variety) may follow earlier rain - some sites already part full - or lying snow; dealt
// from the event's seeded stream (weather.ts weatherRandom), so a restart deals the same.
import { LEVEL } from "./state.ts";
import { WEATHER, weatherRandom } from "./weather.ts";
import { heightAt } from "./terrain.ts";
import { FX0, FX1, FY0, FY1 } from "./bounds.ts";
import { seededRng } from "./blend.ts";
import { wearMap, wearDirty, WEAR_CELL, layersAt, wearKey } from "./wear.ts";
import type { Cover, CoverId, Layers, Level, PuddleSite, WearCell } from "./types.ts";

/** An area of ground, m. */
type Area = { x0: number; y0: number; x1: number; y1: number };

// m between candidate sites along the lap, and the most sites a level gets
const SITE_SPACING = 22, MAX_SITES = 48;
// the chance a candidate becomes a site: on level ground, and how much a dip / crest of DIP_REF m
// (the ground there against the mean 6 m around) adds / takes off
const SITE_CHANCE = 0.18, DIP_GAIN = 0.5, CREST_LOSS = 0.12, DIP_REF = 0.15, DIP_PROBE = 6;
// the share of track sites that can hold snow
const SNOW_SITE_CHANCE = 0.35;
// THE FLOOR: about this many more sites over the rest of the level (the grid spacing follows its
// area, at least FIELD_SPACING_MIN m), the share of floor points that can hold snow, and a snow
// patch's size against a puddle's
const FIELD_SITES = 110, FIELD_SPACING_MIN = 22, FIELD_SNOW_CHANCE = 0.6, SNOW_SIZE = 1.4;
// fill a second at rain 1 (a dip's catch more; heavy rain fills one in ~75 s, owner: quicker),
// once the ground is this wet; drain a second per C of track temperature in a dry spell (20 C:
// ~13 min empty; 40 C: ~6)
const FILL_PER_S = 1 / 75, FILL_FROM_WETNESS = 0.4, DRAIN_PER_S_PER_C = 1 / (900 * 20);
// snow a second at snow 1 while the track is below SNOW_BELOW_C (~1 min); melt per C above it
const SNOW_PER_S = 1 / 60, SNOW_BELOW_C = 1, MELT_PER_S_PER_C = 1 / 3000;
// a puddle FREEZES below FREEZE_BELOW_C (per C colder, a second; at -3 C a full one in ~15 s) and
// THAWS above THAW_ABOVE_C
const FREEZE_BELOW_C = 0, FREEZE_PER_S_PER_C = 1 / 60, THAW_ABOVE_C = 1, THAW_PER_S_PER_C = 1 / 120;
// SCENERY water freezes over below this (a chance a second; at the start: likelier the colder)
// and thaws above THAW_ABOVE_C; worn MUD likewise, cell by cell
const WATER_FREEZE_BELOW_C = -2, WATER_FREEZE_PER_S = 1 / 240, WATER_THAW_PER_S = 1 / 120;
const MUD_FREEZE_BELOW_C = -1, MUD_FREEZE_PER_S = 1 / 90, MUD_THAW_PER_S = 1 / 60;
// AN EVENT'S START: the chance it rained before (winter, spring, summer, autumn), the share of
// sites holding water then; the chance snow lies on a cold start
const RAINED_BEFORE = [0.5, 0.45, 0.2, 0.55], PUDDLED_SHARE = 0.6, SNOW_LYING = 0.6;
// the sizes a site shows: STEPS steps, from STEP_MIN of its full size
const STEPS = 4, STEP_MIN = 0.45;
// how much water a site on flat ground gathers before it shows (a dip's at once): catchK runs
// CATCH_MAX - CATCH_SPAN .. CATCH_MAX (buildPuddleSites)
const SHOW_FROM_FLAT = 0.3, CATCH_MAX = 1.3, CATCH_SPAN = 0.6;
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
export const groundDirtyAreas: Area[] = [];

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

/** How likely a point gathers water: more in a dip, less on a crest. */
function waterChance(dip: number): number {
  return SITE_CHANCE + DIP_GAIN * Math.max(0, Math.min(1, dip))
    - CREST_LOSS * Math.max(0, Math.min(1, -dip));
}

/** A new site at a point: its size and catch by the dip (no catch: a snow-only site). */
function makeSite(x: number, y: number, rot: number, dip: number, wet: boolean, snowy: boolean,
    random: () => number): PuddleSite {
  const deep = Math.max(0, Math.min(1, dip)), big = 1 + 0.3 * deep;
  return { x, y, w: (5 + 6 * random()) * big, h: (3 + 3 * random()) * big, rot,
    catchK: wet ? CATCH_MAX - CATCH_SPAN + CATCH_SPAN * deep : 0, snowy, water: 0, ice: 0,
    snow: 0, shown: '', covers: {} };
}

/** The sites along the lap: on the track and just off it. */
function trackSites(sub: NonNullable<Level['subtrack']>, random: () => number): PuddleSite[] {
  const sites: PuddleSite[] = [];
  for (let dist = SITE_SPACING / 2; dist < sub.totalDist && sites.length < MAX_SITES;
    dist += SITE_SPACING) {
    const point = sub.pts[Math.min(sub.pts.length - 1,
      Math.round((dist / sub.totalDist) * sub.pts.length))];
    const side = (random() * 2 - 1) * (sub.width / 2 + 3);
    const x = point.x + point.nx * side, y = point.y + point.ny * side;
    const dip = dipAt(x, y) / DIP_REF;
    if (random() >= waterChance(dip)) continue;
    sites.push(makeSite(x, y, point.heading + (random() - 0.5) * 0.6, dip, true,
      random() < SNOW_SITE_CHANCE, random));
  }
  return sites;
}

/** The sites over the rest of the floor: a jittered grid, water by the dip, snow anywhere. */
function floorSites(random: () => number): PuddleSite[] {
  const sites: PuddleSite[] = [], width = FX1 - FX0, height = FY1 - FY0;
  const spacing = Math.max(FIELD_SPACING_MIN, Math.sqrt((width * height) / (FIELD_SITES * 1.4)));
  for (let gridX = FX0 + spacing / 2; gridX < FX1; gridX += spacing) {
    for (let gridY = FY0 + spacing / 2; gridY < FY1; gridY += spacing) {
      const x = gridX + (random() - 0.5) * spacing * 0.8;
      const y = gridY + (random() - 0.5) * spacing * 0.8;
      const dip = dipAt(x, y) / DIP_REF;
      const wet = random() < waterChance(dip), snowy = random() < FIELD_SNOW_CHANCE;
      if (wet || snowy) sites.push(makeSite(x, y, random() * Math.PI, dip, wet, snowy, random));
    }
  }
  return sites;
}

/**
 * The level's puddle and snow sites, from its own seeded stream: along the lap, then the floor.
 * @param level the level (with a lap)
 * @returns the sites
 */
export function buildPuddleSites(level: Level): PuddleSite[] {
  const sub = level.subtrack;
  if (!enabled || level.endless || !sub) return [];
  const random = seededRng(level.id + ':puddles');
  return [...trackSites(sub, random), ...floorSites(random)];
}

/** What a site shows now: its kind and size step ('' = nothing). */
function siteLook(site: PuddleSite): string {
  if (site.snow > 0) return 'snow' + Math.ceil(site.snow * STEPS);
  if (site.ice > 0) return 'ice' + Math.ceil(site.ice * STEPS);
  // a dip shows its water first, flatter ground once more has gathered (not all at once)
  const showFrom = Math.max(0.02, SHOW_FROM_FLAT * (CATCH_MAX - site.catchK) / CATCH_SPAN);
  if (site.water > showFrom) return 'wet' + Math.ceil(site.water * STEPS);
  return '';
}

/** The cover a site shows at a look (cached per site and look). */
function siteCover(site: PuddleSite, look: string): Cover {
  const cached = site.covers[look];
  if (cached) return cached;
  const step = +look.slice(-1), kind = look.slice(0, -1) as CoverId;
  const size = (STEP_MIN + (1 - STEP_MIN) * (step / STEPS)) * (kind === 'snow' ? SNOW_SIZE : 1);
  const cover: Cover = { x: site.x, y: site.y, w: site.w * size, h: site.h * size,
    cover: kind, shape: 'ellipse', rot: site.rot };
  site.covers[look] = cover;
  return cover;
}

/** The ground a site or cover can cover, as a dirty area (its full size, both axes). */
function areaOf(shape: { x: number; y: number; w: number; h: number }): Area {
  const reach = Math.max(shape.w, shape.h) * SNOW_SIZE / 2 + 1;
  return { x0: shape.x - reach, y0: shape.y - reach, x1: shape.x + reach, y1: shape.y + reach };
}

/**
 * Whether a wear cell takes the cover over it now: water, snow or ice the weather laid follows it
 * (receded, frozen, thawed); bare ground takes new snow or ice, and water when it rains (a puddle
 * tyres cleared refills); frozen mud keeps its own ice.
 * @param cell the wear cell
 * @param want the cover over it now, or null
 * @returns true to take it
 */
function followsCovers(cell: WearCell, want: string | null): boolean {
  const lying = cell.cover;
  if (!lying) return !!want && (want !== 'wet' || WEATHER.rain > 0);
  const weatherLaid = lying === 'wet' || lying === 'snow' || lying === 'ice';
  return cell.standing && !cell.frozeMud && weatherLaid && want !== lying;
}

/**
 * One wear cell follows the covers over it now (resyncCells).
 * @param cell the wear cell (changed in place)
 * @param layers the static layers at its centre, with the new covers
 */
function resyncCell(cell: WearCell, layers: Layers): void {
  const want = layers.cover, was = cell.cover || cell.base;
  if (followsCovers(cell, want)) {
    cell.cover = want || null;
    cell.standing = true;
    cell.dry = 0;
    cell.passes = 0;
    cell.scrub = 0;
  }
  cell.orig = want || layers.base;
  const now = cell.cover || cell.base;
  if (now !== was) {
    cell.current = now;
    wearDirty.push(cell);
  }
}

/**
 * The wear cells in an area follow its covers' new looks, so physics and the drawn ground agree.
 * @param area the area
 */
function resyncCells(area: Area): void {
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
function applyLooks(changed: (PuddleSite | Cover)[]): void {
  const shown: Cover[] = [];
  for (const cover of LEVEL._staticCovers || []) {
    shown.push(cover._frozen ? iceTwin(cover) : cover);
  }
  for (const site of LEVEL._puddleSites || []) {
    if (site.shown) shown.push(siteCover(site, site.shown));
  }
  LEVEL.covers = shown;
  for (const shape of changed) {
    const area = areaOf(shape);
    groundDirtyAreas.push(area);
    resyncCells(area);
  }
  // the AI's speed plan reads the ground's grip again (line.ts regripPath)
  if (changed.length) WEATHER.epoch++;
}

/** Scenery water as ice: the same shape (cached on the water cover). */
function iceTwin(cover: Cover): Cover {
  if (!cover._iceTwin) {
    cover._iceTwin = { x: cover.x, y: cover.y, w: cover.w, h: cover.h, cover: 'ice',
      shape: cover.shape, rot: cover.rot, cut: cover.cut };
  }
  return cover._iceTwin;
}

/** Freezes or thaws scenery water over a tick (a chance a second, seeded); returns the changed. */
function stepSceneryWater(seconds: number): Cover[] {
  const trackC = WEATHER.trackC, changed: Cover[] = [];
  if (trackC >= WATER_FREEZE_BELOW_C && trackC <= THAW_ABOVE_C) return changed;
  for (const cover of LEVEL._staticCovers || []) {
    if (!cover.water) continue;
    const freeze = !cover._frozen && trackC < WATER_FREEZE_BELOW_C
      && weatherRandom() < WATER_FREEZE_PER_S * seconds;
    const thaw = cover._frozen && trackC > THAW_ABOVE_C
      && weatherRandom() < WATER_THAW_PER_S * seconds;
    if (freeze || thaw) {
      cover._frozen = !cover._frozen;
      changed.push(cover);
    }
  }
  return changed;
}

/** Freezes a site's water below freezing, thaws its ice above, over a tick. */
function freezeSite(site: PuddleSite, seconds: number): void {
  const trackC = WEATHER.trackC;
  if (trackC < FREEZE_BELOW_C && site.water > 0) {
    const frozen = Math.min(site.water,
      (FREEZE_BELOW_C - trackC + 1) * FREEZE_PER_S_PER_C * seconds);
    site.water -= frozen;
    site.ice = Math.min(1, site.ice + frozen);
  } else if (trackC > THAW_ABOVE_C && site.ice > 0) {
    const thawed = Math.min(site.ice, (trackC - THAW_ABOVE_C) * THAW_PER_S_PER_C * seconds);
    site.ice -= thawed;
    site.water += thawed;
  }
}

/** Moves one site's water and snow by the weather over a tick. */
function stepSite(site: PuddleSite, seconds: number): void {
  const trackC = WEATHER.trackC;
  freezeSite(site, seconds);
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

/** Freezes worn mud over in the cold (an ice cover a slide scrubs through), thaws it back. */
function freezeMud(seconds: number): void {
  const trackC = WEATHER.trackC;
  const freezing = trackC < MUD_FREEZE_BELOW_C, thawing = trackC > THAW_ABOVE_C;
  if (!freezing && !thawing) return;
  for (const cell of wearMap.values()) {
    const freeze = freezing && !cell.cover && !!MUD_DRIES_TO[cell.base]
      && weatherRandom() < MUD_FREEZE_PER_S * seconds;
    const thaw = thawing && !!cell.frozeMud && cell.cover === 'ice'
      && weatherRandom() < MUD_THAW_PER_S * seconds;
    if (!freeze && !thaw) continue;
    cell.cover = freeze ? 'ice' : null;
    cell.frozeMud = freeze;
    cell.standing = true;
    cell.scrub = 0;
    cell.current = cell.cover || cell.base;
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
  const frozen = stepSceneryWater(seconds);
  if (changed.length || frozen.length) applyLooks([...changed, ...frozen]);
  dryMud(seconds);
  freezeMud(seconds);
}

/**
 * Deals one site's start: water if it rained before (some sites, part full; frozen when cold),
 * snow lying in a snow site on a cold start.
 * @param site the site
 * @param rained whether it rained before the start
 * @param snowLying whether snow lies at the start
 */
function dealSite(site: PuddleSite, rained: boolean, snowLying: boolean): void {
  const puddled = rained && weatherRandom() < PUDDLED_SHARE + (WEATHER.rain > 0 ? 0.4 : 0);
  site.water = puddled ? Math.min(1, (0.25 + 0.6 * weatherRandom()) * site.catchK) : 0;
  site.ice = 0;
  if (WEATHER.trackC < FREEZE_BELOW_C) {
    site.ice = site.water;
    site.water = 0;
  }
  site.snow = snowLying && site.snowy ? 0.3 + 0.5 * weatherRandom() : 0;
  site.shown = siteLook(site);
}

/**
 * Starts the puddles of an event (wear.ts has just been cleared), dealt from its seeded stream:
 * did it rain before (always when it rains or the track is still wet; else the season's chance),
 * is snow lying, is the scenery water frozen over. The race behind the menu (no weather) is dry.
 */
export function resetPuddles(): void {
  if (!enabled) return;
  tickS = 0;
  const sites = LEVEL._puddleSites || [], trackC = WEATHER.trackC;
  const rained = WEATHER.rain > 0 || WEATHER.wetness > 0.1
    || weatherRandom() < RAINED_BEFORE[WEATHER.season];
  const snowLying = trackC < SNOW_BELOW_C && (WEATHER.snow > 0 || weatherRandom() < SNOW_LYING);
  for (const site of sites) dealSite(site, rained, snowLying);
  const water = (LEVEL._staticCovers || []).filter((cover) => cover.water);
  for (const cover of water) {
    const chance = trackC <= -5 ? 0.85 : trackC <= WATER_FREEZE_BELOW_C ? 0.5 : 0;
    cover._frozen = chance > 0 && weatherRandom() < chance;
  }
  applyLooks([...sites, ...water]);
}
