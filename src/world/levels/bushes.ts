// BUSH PLANS (world/bushplan.ts grows them): where a level's bushes go, by kind.
import type { BushPlan } from '../types.ts';

// RALLY: close to the road (the bush you clip cutting a corner), 1.2 m off the edge at least
export const RALLY_BUSHES: BushPlan = { every: 14, band: [2.5, 9], clear: 1.2, treeShare: 0.3 };
// RALLYCROSS: off the verges, between the dressing and the fences
export const RX_BUSHES: BushPlan = { every: 22, band: [10, 30], clear: 7, treeShare: 0.3 };
// CIRCUITS: well back behind the verges and run-off, by the woods
export const CIRCUIT_BUSHES: BushPlan = { every: 26, band: [16, 45], clear: 12, treeShare: 0.35 };
// TEST TRACKS (Test Track, Sandbox): a few off the verges to aim at
export const TEST_TRACK_BUSHES: BushPlan = { every: 30, band: [8, 25], clear: 6, treeShare: 0 };
// THE LAB: sample beds on its grass quarter (north-west), clear of the ice and snow sheets
export const LAB_BUSHES: BushPlan = { every: 0, band: [0, 0], clear: 0, treeShare: 0,
  beds: [[-40, -60], [-70, -95], [-110, -60], [-150, -110], [-60, -140], [-200, -60],
    [-225, -125], [-30, -215], [-215, -225]] };
// THE ROUGH PATCH: in its long-grass meadow and on its rolling grass
export const ROUGH_BUSHES: BushPlan = { every: 0, band: [0, 0], clear: 0, treeShare: 0,
  beds: [[-130, 600], [-150, 690], [-110, 650], [-200, 630], [90, 640], [120, 700],
    [150, 580], [0, 680], [-60, 630], [60, 575]] };
