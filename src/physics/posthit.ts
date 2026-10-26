// POST HITS (owner C8, ?posthit=1 / =hard): a narrow hard thing - a street light's post, a
// tree's trunk - takes a car's damage in ONE SPOT. Flat things (walls, armco, cars) and the
// floodlight pylons (a wide base) are left to damage.ts's flat rule. Measured before
// (tools/scratch/_c8measure.mjs): the flat rule read the damage off the car's speed change, so a
// street light that SNAPS (the car goes on through with 65 % of its speed) did 8x LESS damage at
// 50 km/h than a bounce at 45, and where the post struck was ignored (dead centre and 0.6 m off
// read the same).
// Here: the damage comes from the CLOSING SPEED into the post, snap or bounce (one curve, rising
// with speed; =1: 50 km/h ~0.55 on the corner hit off centre, ~70 km/h wrecks it), shared over the
// corners by WHERE it struck (dead centre: both fronts; off centre: mostly one corner), and a
// post square on the nose hits the radiator harder. The clamp notes the hit (world/barriers.ts
// clampToSolid); damage.ts hit takes it the same step.

// the speed change a post hit counts as, per m/s of closing speed (damage.ts's curve takes it):
// ?posthit=1 the agreed targets (lighter than a wall at the same speed, all of it in one spot);
// ?posthit=hard a wall's bounce (BARRIER_E 0.3: never lighter than a wall, in one spot)
const POST_DV = 0.73, POST_DV_HARD = 1.3;
// every corner keeps this much of a share (the body is one piece)
const SHARE_FLOOR = 0.03;
// a post within this of the nose's middle (share of the half width) hits the radiator, which
// then takes POST_RADIATOR x the front's damage (physics/engineheat.ts crackOnHit)
const RADIATOR_HALF = 0.45, POST_RADIATOR = 1.5;

let postDv = 0;
/**
 * Turns post hits on (?posthit=1 or ?posthit=hard, main.js).
 * @param mode '' off, '1' the agreed targets, 'hard' never lighter than a wall
 */
export function setPostHit(mode: string): void {
  postDv = mode === 'hard' ? POST_DV_HARD : mode === '1' ? POST_DV : 0;
}

/** Where a post struck, car frame (-1..1 along: rear..nose; -1..1 across), and how hard. */
export interface PostNote { along: number; across: number; into: number }

/** A car as a post hit reads it. */
export interface PostCar {
  x: number; y: number; heading: number;
  spec: { len: number; wid: number };
  _post?: PostNote | null;
}

/**
 * Whether a solid is narrow (a post hit): a street light's post or a tree's trunk.
 * @param kind the solid's kind ('tree') or the lamp's kind ('street')
 * @returns true when narrow
 */
export function isNarrow(kind: string): boolean {
  return postDv > 0 && (kind === 'tree' || kind === 'street');
}

/**
 * Notes a post hit on the car for this step's damage (the hardest of the step's counts).
 * @param car the car
 * @param x the post's middle, m
 * @param y the post's middle, m
 * @param into the closing speed into it, m/s
 */
export function notePost(car: PostCar, x: number, y: number, into: number): void {
  if (!(into > 0) || (car._post && car._post.into >= into)) return;
  const dx = x - car.x, dy = y - car.y;
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  const clamp = (value: number) => (value < -1 ? -1 : value > 1 ? 1 : value);
  car._post = {
    along: clamp((dx * cosH + dy * sinH) / (car.spec.len / 2)),
    across: clamp((-dx * sinH + dy * cosH) / (car.spec.wid / 2)),
    into,
  };
}

/**
 * Takes this step's post hit off the car.
 * @param car the car
 * @returns the note, or null
 */
export function takePost(car: { _post?: PostNote | null }): PostNote | null {
  const note = car._post || null;
  car._post = null;
  return note;
}

/**
 * The speed change a post hit counts as for damage.ts's impact curve.
 * @param note the hit
 * @returns m/s
 */
export const postDeltaV = (note: PostNote): number => note.into * postDv;

/**
 * The corners' shares of a post hit: by how near each corner is to where it struck.
 * @param note the hit
 * @returns the shares in damage.ts shares order (front two, then rear two), summing to 1
 */
export function postShares(note: PostNote): number[] {
  const weights = [[1, -1], [1, 1], [-1, -1], [-1, 1]].map(([alongSign, acrossSign]) =>
    ((1 + alongSign * note.along) / 2) * ((1 + acrossSign * note.across) / 2) + SHARE_FLOOR);
  const total = weights[0] + weights[1] + weights[2] + weights[3];
  return weights.map((weight) => weight / total);
}

/**
 * The scale on the radiator's crack: a post square on the nose hits it harder.
 * @param note the hit
 * @returns the scale
 */
export const radiatorScale = (note: PostNote): number =>
  note.along > 0.5 && Math.abs(note.across) < RADIATOR_HALF ? POST_RADIATOR : 1;
