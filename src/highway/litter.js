// highway litter: the roadside debris, verge litter, tyre stacks, cone tapers and loose objects.
// Split out of highway.js.
import { STEP } from "./presets.js";
// the roadside debris mix (weights by repetition: pallets / boxes / tarps are what really ends up
// on a hard shoulder) + paint for bins, barrels, bumpers, tarps
const DEBRIS_PICK = [
  "pallet",
  "pallet",
  "box",
  "box",
  "crate",
  "bin",
  "sandbag",
  "barrel",
  "exhaust",
  "bumper",
  "tarp",
  "tarp",
];
const DEBRIS_COL = ['#2f5d3a', '#2b56b5', '#c8302c', '#3a3f47', '#d6a21e', '#2f6fb0'];
/**
 * A chevron sign on the outside of a tight bend (one per 48 m, 4.5 m off the edge).
 * @param {object} ctx the dress context
 * @param {Function} addLoose adds a loose object tagged with its road distance
 * @param {number} i road point index
 * @param {number} dist road distance at i
 * @returns {void}
 */
function layChevron(ctx, addLoose, i, dist) {
  const { road, halfWidth, pointAt } = ctx;
  const curv = road[i].curv;
  if (Math.abs(curv) > 1 / 650 && i % 12 === 0) {
    const dir = Math.sign(curv),
      pos = pointAt(i, -dir * (halfWidth + 4.5));
    addLoose({ kind: "chevron", x: pos.x, y: pos.y, rot: pos.rot + (dir * Math.PI) / 2 }, dist);
  }
}

/**
 * Lone litter on both verges (~0.8 per 10 m), now and then on the hard shoulder.
 * @param {object} ctx the dress context
 * @param {object} loot the loose helpers (looseRand, addLoose, chance)
 * @param {number} i road point index
 * @param {number} dist road distance at i
 * @returns {void}
 */
function layVergeLitter(ctx, loot, i, dist) {
  const { halfWidth, pointAt } = ctx, cfg = ctx.level._cfg;
  const { looseRand, addLoose, chance } = loot;
  // ~0.8 per 10 m of verge (screenshot: 0.18 per 20 m read as bare)
  if (i % 4 === 0)
    for (const side of [-1, 1])
      if (looseRand() < chance(0.32)) {
        const onShoulder = side < 0 && cfg.shoulder >= 2 && looseRand() < 0.15,
          off = onShoulder
            ? -halfWidth + 0.4 + looseRand() * (cfg.shoulder - 0.8)
            : side * (halfWidth + 0.8 + looseRand() * 6);
        // (user: "I want to SEE some debris"): ~1 in 2 of the litter (and of the
        // scatters) is ROADSIDE DEBRIS (cones.js DEBRIS kinds), the rest tyres + cones
        const pos = pointAt(i, off),
          roll = looseRand();
        addLoose(
          roll < 0.45
            ? {
                kind: DEBRIS_PICK[(looseRand() * DEBRIS_PICK.length) | 0],
                x: pos.x,
                y: pos.y,
                rot: looseRand() * 6.28,
                col: DEBRIS_COL[(looseRand() * DEBRIS_COL.length) | 0],
              }
            : roll < 0.7
              ? { kind: "tyre", x: pos.x, y: pos.y, rot: looseRand() * 6.28 }
              : { kind: "cone", x: pos.x, y: pos.y, rot: looseRand() * 6.28 },
          dist
        );
      }
}

/**
 * DEBRIS SCATTERS (screenshots: lone 0.8 m tyres barely read at the treadmill
 * zoom): ~1 per 130 m, 4-7 mixed tyres + cones spread over 8 m of one verge, a few spilling
 * up to the edge line.
 * @param {object} ctx the dress context
 * @param {object} loot the loose helpers (looseRand, addLoose, chance)
 * @param {number} i road point index
 * @returns {void}
 */
function layDebrisScatter(ctx, loot, i) {
  const { halfWidth, road, pointAt } = ctx;
  const { looseRand, addLoose, chance } = loot;
  if (i % 8 === 0 && looseRand() < chance(0.25)) {
    const side = looseRand() < 0.5 ? -1 : 1,
      count = 4 + ((looseRand() * 4) | 0);
    for (let idx = 0; idx < count; idx++) {
      const j = Math.min(road.length - 1, i + ((looseRand() * 3) | 0)),
        pos = pointAt(j, side * (halfWidth + 0.6 + looseRand() * 7));
      {
        const roll2 = looseRand();
        addLoose(
          roll2 < 0.4
            ? {
                kind: DEBRIS_PICK[(looseRand() * DEBRIS_PICK.length) | 0],
                x: pos.x,
                y: pos.y,
                rot: looseRand() * 6.28,
                col: DEBRIS_COL[(looseRand() * DEBRIS_COL.length) | 0],
              }
            : roll2 < 0.75
              ? { kind: "tyre", x: pos.x, y: pos.y, rot: looseRand() * 6.28 }
              : { kind: "cone", x: pos.x, y: pos.y, rot: looseRand() * 6.28 },
          road[j].s
        );
      }
    }
  }
}

/**
 * A stray TYRE STACK pile now and then (every 50th point).
 * @param {object} ctx the dress context
 * @param {object} loot the loose helpers (looseRand, addLoose, chance)
 * @param {number} i road point index
 * @param {number} dist road distance at i
 * @returns {void}
 */
function layTyreStacks(ctx, loot, i, dist) {
  const { halfWidth, pointAt } = ctx;
  const { looseRand, addLoose, chance } = loot;
  if (i % 50 === 0 && looseRand() < chance(0.22)) {
    const side = looseRand() < 0.5 ? -1 : 1,
      base = pointAt(i, side * (halfWidth + 3 + looseRand() * 4));
    const count = 3 + ((looseRand() * 4) | 0);
    for (let idx = 0; idx < count; idx++)
      addLoose(
        {
          kind: "tyrestack",
          x: base.x + (looseRand() - 0.5) * 2.4,
          y: base.y + (looseRand() - 0.5) * 2.4,
        },
        dist
      );
  }
}

/**
 * A CONE TAPER closing the hard shoulder every ~1.6 km.
 * @param {object} ctx the dress context
 * @param {object} loot the loose helpers (addLoose, density)
 * @param {number} i road point index
 * @param {number} dist road distance at i
 * @returns {void}
 */
function layConeTaper(ctx, loot, i, dist) {
  const { halfWidth, road, pointAt } = ctx, cfg = ctx.level._cfg;
  const { addLoose, density } = loot;
  if (
    density > 0 &&
    cfg.shoulder >= 2 &&
    Math.floor(dist / 1600) !== Math.floor((dist - STEP) / 1600) &&
    dist > 600
  )
    for (let idx = 0; idx < 8; idx++) {
      const j = Math.min(road.length - 1, i + idx * 2),
        pos = pointAt(j, -halfWidth + 0.4 + (cfg.shoulder - 0.6) * (idx / 7));
      addLoose({ kind: "cone", x: pos.x, y: pos.y, rot: 0 }, road[j].s);
    }
}

/**
 * LOOSE ROADSIDE (user: "as it's open sided, be LITTERED with TYRES and CONES and
 * have appropriate CHEVRON signs for the corners"): knockable cones.js objects into `loose` (the
 * level's cones at a restart, else streamed in by main.js), open presets only. CHEVRONS on the
 * outside of every bend tighter than R 650, one per 48 m, 4.5 m off the edge (behind the armco
 * where there is one), arrows pointing the way it turns; LITTER on both verges (a lone tyre, a
 * cone, now and then on the hard shoulder); a stray TYRE STACK pile now and then; and a CONE
 * TAPER closing the hard shoulder every ~1.6 km.
 * @param {object} ctx the dress context
 * @returns {void}
 */
export function layLooseRoadside(ctx) {
  const { level, state, road, firstIdx, endIdx, loose } = ctx;
  if (!level._cfg.walls && loose) {
    const looseRand = state.lrnd,
      addLoose = (obj, dist) => {
        obj._s = dist;
        loose.push(obj);
        return obj;
      };
    // LITTER DENSITY (user: "they should be RANDOM and also have a SLIDER for frequency
    // / density"; default 1 = as tested and seen): lv.litter x every litter chance (setup's LITTER
    // slider, 0 = none .. 3 = a scrapyard); chevrons are signs, not litter
    const density = level.litter ?? 1, chance = (prob) => Math.min(0.95, prob * density);
    const loot = { looseRand, addLoose, chance, density };
    for (let i = firstIdx; i < endIdx; i++) {
      const dist = road[i].s;
      layChevron(ctx, addLoose, i, dist);
      layVergeLitter(ctx, loot, i, dist);
      layDebrisScatter(ctx, loot, i);
      layTyreStacks(ctx, loot, i, dist);
      layConeTaper(ctx, loot, i, dist);
    }
  }
}
