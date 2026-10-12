// lab.js — THE SCENE, as data (PLAN.md / CLAUDE.md §6: never hard-code a position that should be a
// number in a file; the first request after the first drive is "move that three metres closer").
//
// A proving-ground floor: pale, bounded by a hazard kerb (A4), with painted figures that give the eye
// something to measure speed and drift angle against, and cones to aim at.
export * from "./world/bounds.ts";
export * from "./world/state.ts";
export * from "./world/surfaces.ts";
export * from "./world/barriers.ts";
export * from "./world/course.ts";
export * from "./world/subtrack.ts";
export * from "./world/levels/lab-extension.js";
export * from "./world/zones.js";
export * from "./world/terrain.js";
export * from "./world/wear.js";
export * from "./world/tyrewall.js";
export * from "./world/levels/index.js";
export * from "./world/blend.js";
export * from "./world/load.js";
export * from "./world/colours.ts";
export { trackKit } from "./world/levels/kit.js";
export { BRANDS_DROPPED } from "./world/levels/brands-snatch.js";
