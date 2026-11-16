// carbits.ts - (owner 11-07: "can worse crashes have a chance to emit more parts like
// exhaust and engine blocks ... they should all be accurate to the vehicle"; "how about things like
// wishbones and suspension struts too? ... size / their sharpness ... how likely they are to cause
// punctures"): each car's own BITS - its exhaust, the panel at each end, where its engine sits and
// what it is - so what a bad crash throws out is that car's. world/debris.ts throws them,
// render/carparts.ts draws them.

/** What a car has to lose. */
export interface CarBits {
  // the exhaust: how many tailpipes and where (sides = one each side, left = all on the left,
  // centre / quad = in the middle, stack = a vertical stack - the tractor)
  pipes: number; pipesAt: 'sides' | 'left' | 'right' | 'centre' | 'stack';
  front: 'bonnet' | 'none';   // the panel over the front
  rear: 'boot' | 'spoiler' | 'none';   // the boot lid / tailgate, or a wing on it
  // where the engine sits: ahead of the cabin, between the cabin and the rear axle, or behind the
  // rear axle (the 911)
  engine: 'front' | 'mid' | 'rear';
  cyl: number; layout: 'inline' | 'v' | 'flat';   // what it is
  // how the engine lies (along the car or across it) and where the radiator sits: what shows
  // under a lost panel (render/underskin.ts)
  mount: 'long' | 'trans'; radiator: 'front' | 'rear' | 'sides';
  // the wing stands on the boot lid (the 911 GT3 R's swan necks): it goes when the lid goes
  wingOnLid?: boolean;
  // its glass against a car's (1): how much a broken corner's windows throw (world/debris.ts)
  glass?: number;
  // its mirrors where they are not a car's: the shares of its length they sit between, and the
  // thrown mirror's size on its arm, px (render/carparts.ts)
  mirror?: { from: number; until: number; px: [number, number] };
  // an ELECTRIC car (the Tesla): no exhaust and no engine to lose, its frunk under the bonnet
  // (render/underskin.ts), no petrol stations (ai/trafficTrips.ts)
  electric?: boolean;
}

/** A side panel's drawing: a car's door, the bus's cab door or lower-deck skirt panel, a van's
 * sliding door. */
export type DoorShape = 'door' | 'cab' | 'skirt' | 'sliding';
/** One side panel at a damage corner: where it spans (shares, 0 tail .. 1 nose), its drawing. */
export interface SidePanel { at: [number, number]; shape: DoorShape }
/** A car's DOORS (?carparts): each side's, front first, as the shares of its length it spans. */
export interface CarDoors {
  // [from, until], 0 tail .. 1 nose; one a side on a 2-door, two on a 4-door, none on an open car
  doors: [number, number][];
  // a stock car's welded door skin: a steel sheet, no window
  sheet?: boolean;
  // a vehicle whose sides differ (the bus, the vans): each damage corner's own panel, null none
  corners?: (SidePanel | null)[];
  // its bumpers drawn as its own parts, front and rear (the bus: its radiator grille, its
  // platform's staircase panel with the grab pole)
  bumpers?: ['grille', 'staircase'];
  // its bumpers' own material where not the body's paint (step 4): black plastic (the Mk8
  // Transits), grey plastic (the Mk7), black steel (the Defender), steel tube (the trophy truck,
  // the stock car), the tractor's front weight; none - it has none (the Seven)
  bumper?: 'black' | 'grey' | 'steel' | 'tube' | 'weight' | 'none';
  // its mirrors (step 5) where its painter draws them: the share of its length they start at, on
  // the body's edge rows (rim) or just outside them, their colour; none - it has none
  mirrors?: CarMirrors | 'none';
  // step 6, its extras: a spare wheel on the rear door (the Defender: thrown as a loose wheel); a
  // split tailgate (the Range Rover: its glass upper and drop-down lower halves, each its own
  // part); a rear lid where it has none in its bits (the Huracan's engine cover), its span
  spare?: boolean;
  splitTailgate?: boolean;
  rearLid?: [number, number];
  // its rear doors a pair, each its own part (the vans' twin rear doors)
  twinRear?: boolean;
  // its glass with its own parts (the bus's two decks: 8)
  glass?: number;
}

/** A car's mirrors on its sprite (?carparts step 5). */
export interface CarMirrors { at: number; rim?: boolean; col: 'paint' | 'third' | 'black';
  big?: boolean }

// the mirrors' places (each painter's: render/carsprite.ts cabin - just outside the edge at the
// roof's end, in the paint; carlooks.ts mirrorCaps - the third colour; the new cars' painters -
// on the body's edge rows at the windscreen's foot, the third colour)
const edgePaint = (share: number): CarMirrors => ({ at: share, col: 'paint' });
const rimThird = (share: number): CarMirrors => ({ at: share, rim: true, col: 'third' });

/**
 * A Transit's big black mirrors where its painter draws them: at its windscreen's foot, the
 * same on every wheelbase (counted from the nose: the L2's 0.735).
 * @param lengthM the Transit's length, m
 * @returns its mirrors
 */
const transitMirrors = (lengthM: number): CarMirrors => ({ at: 1 - 0.265 * 5.531 / lengthM,
  col: 'black', big: true });

/**
 * A Transit's side panels: the cab doors behind the front wheels, the sliding door on the
 * nearside (+y) behind the cab; none at the offside rear. The cab and the slide are the same on
 * every wheelbase, so their places are counted from the nose (the L2's shares, EST from its side
 * view: the cab door 0.56-0.74, the slide 0.32-0.555 of its 5.531 m).
 * @param lengthM the Transit's length, m
 * @returns the four corners' panels
 */
function transitPanels(lengthM: number): (SidePanel | null)[] {
  const fromNose = (share: number) => 1 - (1 - share) * 5.531 / lengthM;
  const cab: SidePanel = { at: [fromNose(0.56), fromNose(0.74)], shape: 'door' };
  return [cab, cab, null, { at: [fromNose(0.32), fromNose(0.555)], shape: 'sliding' }];
}

// the shares a car's doors span (EST from the cars' side views: the front door from the
// windscreen's foot back, a 4-door's rear door to the rear wheel's arch, a 2-door's one long door)
const FOUR_DOORS: [number, number][] = [[0.48, 0.68], [0.3, 0.48]];
const TWO_DOORS: [number, number][] = [[0.4, 0.68]];
// each car's doors (the vans and the bus: ?carparts step 2; the single-seaters and the buggy have
// their own open parts)
export const CAR_DOORS: Record<string, CarDoors> = {
  'hatch-fwd': { doors: FOUR_DOORS, mirrors: { at: 0.585, col: 'third' } },   // Golf: 5-door
  'hatch-rwd': { doors: FOUR_DOORS, mirrors: { at: 0.525, col: 'third' } },   // M135i F20: 5-door
  'saloon-rwd': { doors: FOUR_DOORS, mirrors: edgePaint(0.575) },
  'wrz-awd': { doors: FOUR_DOORS, mirrors: edgePaint(0.575) },
  'estate-4x4': { doors: FOUR_DOORS, mirrors: edgePaint(0.585) },
  'muscle-rwd': { doors: [[0.38, 0.66]], mirrors: edgePaint(0.485) },   // Chevelle: coupe door
  'rally-4x4': { doors: [[0.4, 0.66]], mirrors: edgePaint(0.555) },
  naffcar: { doors: [[0.36, 0.64]], sheet: true, mirrors: edgePaint(0.565) },
  // Fastrac: the cab's door (EST, both sides), its front weight
  tractor: { doors: [[0.38, 0.56]], bumper: 'weight' },
  'mini-fwd': { doors: [[0.4, 0.66]], mirrors: edgePaint(0.645) },
  'lambo-awd': { doors: [[0.44, 0.68]], mirrors: edgePaint(0.48), rearLid: [0.08, 0.42] },
  'mikra-r1': { doors: TWO_DOORS, mirrors: edgePaint(0.605) },
  'kit-2l': { doors: TWO_DOORS, mirrors: edgePaint(0.555) },
  'rx-super': { doors: TWO_DOORS, mirrors: edgePaint(0.525) },
  'banger-f2': { doors: [[0.36, 0.62]], sheet: true, bumper: 'tube', mirrors: edgePaint(0.605) },
  'drift-s13': { doors: TWO_DOORS, mirrors: edgePaint(0.555) },
  'porch-gt3r': { doors: [[0.44, 0.7]], mirrors: rimThird(0.57) },
  'bmv-m4gt3': { doors: [[0.38, 0.64]], mirrors: rimThird(0.625) },
  // the Seven: no doors, no bumpers, its little mirrors on the screen's frame (not thrown)
  'seven-420r': { doors: [], bumper: 'none', mirrors: 'none' },
  'effing-tt': { doors: [[0.42, 0.62]], bumper: 'tube', mirrors: 'none' },
  'civvic-btcc': { doors: FOUR_DOORS, mirrors: rimThird(0.625) },
  'toyoter-corolla': { doors: FOUR_DOORS, mirrors: rimThird(0.625) },   // Corolla: the 5-door
  'defunder-110': { doors: [[0.47, 0.62], [0.32, 0.47]], bumper: 'steel',
    mirrors: { at: 0.655, col: 'third' }, spare: true },
  'focust-st': { doors: FOUR_DOORS, mirrors: rimThird(0.635) },
  'cleo-cup': { doors: TWO_DOORS, mirrors: rimThird(0.635) },
  'cleo-rs200': { doors: TWO_DOORS, mirrors: rimThird(0.635) },
  ts010: { doors: [[0.46, 0.62]], mirrors: 'none' },   // the canopy's small doors
  'rebelion-r13': { doors: [[0.48, 0.66]], mirrors: 'none' },   // R13: the canopy's doors
  'saxo-kit': { doors: TWO_DOORS, mirrors: rimThird(0.635) },
  'strange-l322': { doors: FOUR_DOORS, mirrors: { at: 0.62, col: 'third' }, splitTailgate: true },
  'saxo-vtr': { doors: TWO_DOORS, mirrors: rimThird(0.635) },
  'tesla-m3': { doors: FOUR_DOORS, mirrors: rimThird(0.655) },
  // step 2: the Transits - two cab doors, the nearside slide, the twin rear doors
  'transfit-van': { doors: [], corners: transitPanels(5.531), twinRear: true, bumper: 'black',
    mirrors: transitMirrors(5.531) },
  'transfit-lwb': { doors: [], corners: transitPanels(5.981), twinRear: true, bumper: 'black',
    mirrors: transitMirrors(5.981) },
  'transfit-swb': { doors: [], corners: transitPanels(4.863), twinRear: true, bumper: 'grey',
    mirrors: transitMirrors(4.863) },
  // the Routemaster (no passenger doors: the open rear platform): the driver's cab door on the
  // offside (-y) front, the lower deck's riveted side panels elsewhere (EST places), its radiator
  // grille and staircase panel for bumpers, the glass of its two decks
  routemonster: { doors: [], corners: [{ at: [0.72, 0.8], shape: 'cab' },
    { at: [0.52, 0.72], shape: 'skirt' }, { at: [0.3, 0.5], shape: 'skirt' },
    { at: [0.3, 0.5], shape: 'skirt' }], bumpers: ['grille', 'staircase'], glass: 8 },
};

// ?carparts step 3: the cars whose REAR WINGS are bolted on and come off - the race cars' composite
// panels and arches, the Defender's aluminium body, the Seven's cycle wings, the trophy truck's
// fibreglass, the tractor's mudguards; every other closed car's are welded quarter panels (they
// crush, not fly off); the single-seaters and the buggy keep their own open parts
const BOLTED_REAR_WINGS = new Set(['porch-gt3r', 'bmv-m4gt3', 'civvic-btcc', 'toyoter-corolla',
  'cleo-cup', 'saxo-kit', 'kit-2l', 'rx-super', 'rally-4x4', 'drift-s13', 'naffcar', 'ts010',
  'rebelion-r13', 'defunder-110', 'seven-420r', 'effing-tt', 'tractor']);

/**
 * ?carparts: whether a car's rear wing is a welded quarter panel (not thrown: it crushes).
 * @param carId the car
 * @returns welded
 */
export const isRearWingWelded = (carId: string) => !!CAR_DOORS[String(carId).split('#')[0]]
  && !BOLTED_REAR_WINGS.has(String(carId).split('#')[0]);

/**
 * ?carparts: a car's own row (its doors and parts), or none.
 * @param carId the car
 * @returns its row
 */
export const doorsOf = (carId: string): CarDoors | undefined =>
  CAR_DOORS[String(carId).split('#')[0]];

/**
 * ?carparts: the drawing of the side panel at a damage corner.
 * @param carId the car
 * @param corner the damage corner
 * @returns its shape, or 'sheet' (a stock car's skin)
 */
export function doorShape(carId: string, corner: number): DoorShape | 'sheet' {
  const row = doorsOf(carId);
  if (row?.corners) return row.corners[corner]?.shape ?? 'door';
  return row?.sheet ? 'sheet' : 'door';
}

/**
 * ?carparts: the door at a damage corner - the front corners a car's front door, the rear its
 * rear door; null where it has none there (a 2-door's rear corner: a side hit dents it and breaks
 * glass, nothing comes off); undefined for a car with no row (its parts as before).
 * @param carId the car
 * @param corner the damage corner (0, 1 front)
 * @returns the door's [from, until] shares, null, or undefined
 */
export function doorAt(carId: string, corner: number): [number, number] | null | undefined {
  const row = CAR_DOORS[String(carId).split('#')[0]];
  if (!row) return undefined;
  if (row.corners) return row.corners[corner]?.at ?? null;
  return row.doors[corner < 2 ? 0 : 1] ?? null;
}

/**
 * Whether a car has no such part to lose: an electric car's exhaust or engine.
 * @param bits the car's bits
 * @param kind the part
 * @returns it has none
 */
export const hasNo = (bits: CarBits, kind: string) => !!bits.electric
  && (kind === 'exhaust' || kind === 'engine');

// (the radiators: the Sport quattro S1 E2 carried its radiator at the back, as World RX supercars
// do (EST for the Fiesta RX); the autograss buggy's transverse four and rear radiator EST; the
// F1 / F2 in the sidepods; the Huracan's at the front, ahead of its mid V10)
export const CAR_BITS: Record<string, CarBits> = {
  // Golf GTI Mk7: one tailpipe each side, the tailgate, the transverse 2.0 four
  'hatch-fwd': { pipes: 2, pipesAt: 'sides', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 4, layout: 'inline', mount: 'trans', radiator: 'front' },
  // M135i: twin pipes on the left, the tailgate, the straight six
  'hatch-rwd': { pipes: 2, pipesAt: 'left', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 6, layout: 'inline', mount: 'long', radiator: 'front' },
  // E46 330i: twin on the left, the boot lid, the straight six
  'saloon-rwd': { pipes: 2, pipesAt: 'left', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 6, layout: 'inline', mount: 'long', radiator: 'front' },
  // GD WRX: one fat pipe, the boot WING, the flat four
  'wrz-awd': { pipes: 1, pipesAt: 'right', front: 'bonnet', rear: 'spoiler', engine: 'front',
    cyl: 4, layout: 'flat', mount: 'long', radiator: 'front' },
  // V70 R: one each side, the tailgate, the five
  'estate-4x4': { pipes: 2, pipesAt: 'sides', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 5, layout: 'inline', mount: 'trans', radiator: 'front' },
  // Chevelle SS 454: dual exhaust, the boot lid, the big-block V8
  'muscle-rwd': { pipes: 2, pipesAt: 'sides', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 8, layout: 'v', mount: 'long', radiator: 'front' },
  // Sport quattro S1 E2: one pipe, the rear WING, the five
  'rally-4x4': { pipes: 1, pipesAt: 'right', front: 'bonnet', rear: 'spoiler', engine: 'front',
    cyl: 5, layout: 'inline', mount: 'long', radiator: 'rear' },
  // F1 2022: the one central pipe, no bonnet (its wings come off as parts), the V6 behind the
  // driver
  'track-rwd': { pipes: 1, pipesAt: 'centre', front: 'none', rear: 'none', engine: 'mid',
    cyl: 6, layout: 'v', mount: 'long', radiator: 'sides' },
  'f2-rwd': { pipes: 1, pipesAt: 'centre', front: 'none', rear: 'none', engine: 'mid', cyl: 6,
    layout: 'v', mount: 'long', radiator: 'sides' },
  // Next Gen: side pipes on the right, the spoiler, the V8
  naffcar: { pipes: 2, pipesAt: 'right', front: 'bonnet', rear: 'spoiler', engine: 'front',
    cyl: 8, layout: 'v', mount: 'long', radiator: 'front' },
  // Fastrac: the vertical stack, the bonnet, the straight six
  tractor: { pipes: 1, pipesAt: 'stack', front: 'bonnet', rear: 'none', engine: 'front', cyl: 6,
    layout: 'inline', mount: 'long', radiator: 'front' },
  // Mini Cooper S: one pipe, the boot lid, the A-series four
  'mini-fwd': { pipes: 1, pipesAt: 'right', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 4, layout: 'inline', mount: 'trans', radiator: 'front' },
  // Huracan: four in the middle, the front lid, the V10 behind the seats
  'lambo-awd': { pipes: 4, pipesAt: 'centre', front: 'bonnet', rear: 'none', engine: 'mid',
    cyl: 10, layout: 'v', mount: 'long', radiator: 'front' },
  // Micra R1: one pipe, the tailgate, the three
  'mikra-r1': { pipes: 1, pipesAt: 'right', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 3, layout: 'inline', mount: 'trans', radiator: 'front' },
  // 306 Maxi: one pipe, the tailgate, the four
  'kit-2l': { pipes: 1, pipesAt: 'right', front: 'bonnet', rear: 'boot', engine: 'front', cyl: 4,
    layout: 'inline', mount: 'trans', radiator: 'front' },
  // Fiesta RX: one pipe, the big WING, the four
  'rx-super': { pipes: 1, pipesAt: 'right', front: 'bonnet', rear: 'spoiler', engine: 'front',
    cyl: 4, layout: 'inline', mount: 'trans', radiator: 'rear' },
  // BriSCA F2: one pipe, the boot lid, a four
  'banger-f2': { pipes: 1, pipesAt: 'right', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 4, layout: 'inline', mount: 'long', radiator: 'front' },
  // the autograss buggy: one pipe, no panels, the four behind the driver
  'grass-special': { pipes: 1, pipesAt: 'right', front: 'none', rear: 'none', engine: 'mid',
    cyl: 4, layout: 'inline', mount: 'trans', radiator: 'rear' },
  // Silvia S13: one pipe, the DUCKTAIL on the boot, the SR20 four
  'drift-s13': { pipes: 1, pipesAt: 'right', front: 'bonnet', rear: 'spoiler', engine: 'front',
    cyl: 4, layout: 'inline', mount: 'long', radiator: 'front' },
  // 911 GT3 R: twin pipes in the middle, the front lid over the central radiator, the engine lid
  // with the swan-neck wing on it, the flat six behind the rear axle
  'porch-gt3r': { pipes: 2, pipesAt: 'centre', front: 'bonnet', rear: 'boot', engine: 'rear',
    cyl: 6, layout: 'flat', mount: 'long', radiator: 'front', wingOnLid: true },
  // M4 GT3: a pipe out of each side ahead of the rear wheels (EST), the boot lid with the wing on
  // it, the straight six along the front
  'bmv-m4gt3': { pipes: 2, pipesAt: 'sides', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 6, layout: 'inline', mount: 'long', radiator: 'front', wingOnLid: true },
  // Seven 420R: the side exhaust (EST on the right), the louvred bonnet, no boot lid, the Duratec
  // four lengthways behind the radiator in the nose cone
  'seven-420r': { pipes: 1, pipesAt: 'right', front: 'bonnet', rear: 'none', engine: 'front',
    cyl: 4, layout: 'inline', mount: 'long', radiator: 'front' },
  // Transit FWD: one pipe under the back (EST on the left), the bonnet, the rear doors, the
  // EcoBlue four across the front
  'transfit-van': { pipes: 1, pipesAt: 'left', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 4, layout: 'inline', mount: 'trans', radiator: 'front' },
  // F-150 Trophy Truck: a pipe out each side of the bed (EST), the bonnet, an open bed (no lid),
  // the V8 set back behind the front axle, the radiators in the bed
  'effing-tt': { pipes: 2, pipesAt: 'sides', front: 'bonnet', rear: 'none', engine: 'front',
    cyl: 8, layout: 'v', mount: 'long', radiator: 'rear' },
  // Civic Type R BTCC: the side exit on the left (EST), the bonnet, the tailgate with the wing on
  // it, the 2.0 turbo four across the front, the radiator in the nose
  'civvic-btcc': { pipes: 1, pipesAt: 'left', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 4, layout: 'inline', mount: 'trans', radiator: 'front', wingOnLid: true },
  // Corolla BTCC: the side exit on the left (EST), the bonnet, the hatch with the wing on it, the
  // 2.0 turbo four across the front, the radiator in the nose
  'toyoter-corolla': { pipes: 1, pipesAt: 'left', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 4, layout: 'inline', mount: 'trans', radiator: 'front', wingOnLid: true },
  // Defender 110: one pipe out on the left behind the rear wheel (EST), the bonnet, the side-hung
  // rear door, the Puma four along the front, the radiator in the nose
  'defunder-110': { pipes: 1, pipesAt: 'left', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 4, layout: 'inline', mount: 'long', radiator: 'front' },
  // Focus ST Mk4: one tailpipe each side, the tailgate, the 2.3 four across the front
  'focust-st': { pipes: 2, pipesAt: 'sides', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 4, layout: 'inline', mount: 'trans', radiator: 'front' },
  // Clio Cup V: one pipe (EST: left of centre), the tailgate with the wing on it, the 1.3 four
  // across the front, the radiator in the nose
  'cleo-cup': { pipes: 2, pipesAt: 'centre', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 4, layout: 'inline', mount: 'trans', radiator: 'front' },
  // Clio 200 Cup: twin pipes in the middle of the diffuser, the tailgate, the F4R across the
  // front, the radiator in the nose
  // Transit L3 RWD: one pipe on the left (as the L2), the bonnet, the rear doors, the 2.0 along
  // the car (RWD), the radiator in the nose
  // Transit Mk7 SWB FWD: one pipe on the left, the bonnet, the rear doors, the 2.2 across the
  // front, the radiator in the nose
  'transfit-swb': { pipes: 1, pipesAt: 'left', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 4, layout: 'inline', mount: 'trans', radiator: 'front' },
  'transfit-lwb': { pipes: 1, pipesAt: 'left', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 4, layout: 'inline', mount: 'long', radiator: 'front' },
  // Routemaster: one pipe (EST: left), the bonnet, no boot (the open rear platform), the AV590
  // six along the front, the radiator in the nose; its glass two decks of windows (~5 x a car's),
  // its big mirrors on their arms at the cab's front corners
  routemonster: { pipes: 1, pipesAt: 'left', front: 'bonnet', rear: 'none', engine: 'front',
    cyl: 6, layout: 'inline', mount: 'long', radiator: 'front', glass: 5,
    mirror: { from: 0.9, until: 0.97, px: [8, 4] } },
  // Saxo Kit Car: the side pipe on the right (EST, as the 306 Maxi's), the tailgate, the 1.6 four
  // across the front, the radiator in the nose
  'saxo-kit': { pipes: 1, pipesAt: 'right', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 4, layout: 'inline', mount: 'trans', radiator: 'front' },
  // Range Rover L322 4.4: a pipe each side (EST), the bonnet, the split tailgate, the V8 along
  // the front, the radiator in the nose
  'strange-l322': { pipes: 2, pipesAt: 'sides', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 8, layout: 'v', mount: 'long', radiator: 'front' },
  // Saxo VTR: one tailpipe on the left (EST), the tailgate, the 1.6 across the front
  'saxo-vtr': { pipes: 1, pipesAt: 'left', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 4, layout: 'inline', mount: 'trans', radiator: 'front' },
  // Model 3: no pipes, the frunk under the bonnet (the front motor under it), the radiator in the
  // nose; the rear motor under the boot floor
  'tesla-m3': { pipes: 0, pipesAt: 'centre', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 0, layout: 'inline', mount: 'trans', radiator: 'front', electric: true },
  'cleo-rs200': { pipes: 2, pipesAt: 'centre', front: 'bonnet', rear: 'boot', engine: 'front',
    cyl: 4, layout: 'inline', mount: 'trans', radiator: 'front' },
  // TS010: twin pipes in the diffuser (EST), the front clip, the rear clamshell with the wing on
  // it, the V10 behind the driver, the radiators in the sidepods
  ts010: { pipes: 2, pipesAt: 'centre', front: 'bonnet', rear: 'boot', engine: 'mid',
    cyl: 10, layout: 'v', mount: 'long', radiator: 'sides', wingOnLid: true },
  // R13: twin pipes high in the tail (EST), the front clip, the engine cover with the wing on its
  // pylon, the V8 behind the driver, the radiators in the sidepods
  'rebelion-r13': { pipes: 2, pipesAt: 'centre', front: 'bonnet', rear: 'boot', engine: 'mid',
    cyl: 8, layout: 'v', mount: 'long', radiator: 'sides', wingOnLid: true },
};

/**
 * A car's bits (any car not listed: a front-engined four with a bonnet and a boot).
 * @param carId the car (an AI's "id#n" too)
 * @returns its bits
 */
export function bitsOf(carId: string): CarBits {
  return CAR_BITS[String(carId).split('#')[0]] || CAR_BITS['hatch-fwd'];
}
