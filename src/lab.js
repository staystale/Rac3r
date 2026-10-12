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
export * from "./world/levels/lab-extension.ts";
export * from "./world/zones.ts";
export * from "./world/terrain.ts";
export * from "./world/wear.ts";
export * from "./world/tyrewall.ts";
export * from "./world/levels/index.ts";
export * from "./world/blend.ts";
export * from "./world/load.ts";
export * from "./world/colours.ts";
export { trackKit } from "./world/levels/kit.ts";
export { BRANDS_DROPPED } from "./world/levels/brands-snatch.ts";
