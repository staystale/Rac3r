import type { Rect } from "./types.ts";

// bounds.js — the world edge (floor, kerb, run-off, fence, bounds). Moved verbatim out of lab.js.

// MEASURED: at 100 (a 200 m floor) the hatch used 83% of the lab just reaching 100 km/h. 150 fixed that
// but the cars then got much faster again and crossed 300 m in ~5 s (photographed, car off the map).
export const BASE_FLOOR = 260;   // the standard world (generated stages build in it, whatever level is current)
export let FLOOR = 260;   // let (2026-10-05): per level — LEVEL.floor (the endless highway: 100 km); setLevel sets it        // m half-extent -> a 520 x 520 m floor, ~9 s end to end at 216 km/h.
export const GRID = 5;           // m, faint grid spacing

// THE EDGE, from the inside out:  floor -> KERB -> run-off -> FENCE.
//
// The kerb is an OBSTACLE, not a barrier. It is a raised bump you ride OVER: onto it (springs compress,
// briefly heavy), across the crest, off the far side (ground drops away, wheels go light, and fast
// enough they leave it entirely) and down into the gravel run-off — where a fence is waiting that you
// can try to clear or dodge. The fence is the only thing that actually stops you.
//
// REWRITTEN 2026-09-28. This used to hand vehicle.js a scripted "you are airborne for 0.6 s". It now
// hands it nothing but a HEIGHT and a GRIP, and the car's own suspension decides what that feels like.
// So a kerb strike works identically whether you are straight, turning, or sideways on the handbrake:
// the edge does not know, and does not need to.
export const KERB_W = 3.5;           // m across the strip
export const KERB_H = 0.10;          // m at the crest. Real kerbs and rumble strips are 0.05-0.12.
export const KERB_MU = 0.70;         // grip on the strip itself — painted concrete, not tarmac
export const KERB_RIDGE = 0.005;     // m amplitude of the rumble ridges. MEASURED 2026-09-28: 0.013
                                     // swung vertical load by 1.90 just DRIVING ALONG the strip at 25
                                     // m/s, i.e. repeatedly airborne. A real rumble strip buzzes the car,
                                     // it does not unload the tyres — a tyre with a 0.30 m radius bridges
                                     // most of a ridge. 0.005 gives a 0.35 swing, which is a shake.
export const KERB_RIDGE_L = 1.8;     // m between ridges. Long enough to survive a 120 Hz sim at 40 m/s
                                     // without aliasing (5+ samples per ridge); shorter ones beat badly.

export const RUNOFF_W = 42;          // m of gravel between the kerb and the fence. MEASURED 2026-09-28:
                                     // at 30 m a car entering at 20 m/s still reached the fence at 10
                                     // m/s, so the trap never actually caught anyone — it was just a
                                     // slippery strip in front of a wall.
export const RUNOFF_MU = 0.55;       // gravel: you can drive on it, badly
export const RUNOFF_ROUGH = 0.004;   // m of surface noise — a constant shake, so gravel FEELS like gravel.
                                     // 0.008 held load at 0.68 permanently; gravel should be rough, not a
                                     // hammer, and the grip penalty is what actually punishes you here.
export let FENCE = FLOOR + RUNOFF_W;   // the actual barrier (follows FLOOR)
// THE FLOOR RECTANGLE (S-B, 2026-10-06; user: the lab "about 1 km tall and rectangular, extended downwards"): where the floor edge is on
// each side - the kerb, run-off and fence follow it (groundAt, fenceClamp, render.ts drawRunoff / drawKerb / drawFence, cones.js).
// LEVEL.bounds { x0, x1, y0, y1 }; without it the square +-FLOOR (every other level, unchanged). FENCE stays FLOOR + RUNOFF_W.
export let FX0 = -FLOOR, FX1 = FLOOR, FY0 = -FLOOR, FY1 = FLOOR;
// metres PAST the floor edge at a point (negative inside): the square's max(|x|, |y|) - FLOOR, for any rectangle
export function edgeOut(x: number, y: number): number { const ex = Math.max(x - FX1, FX0 - x), ey = Math.max(y - FY1, FY0 - y); return ex > ey ? ex : ey; }

export function setFloor(floor: number): void { FLOOR = floor; FENCE = FLOOR + RUNOFF_W; }
export function setRect(rect: Rect | undefined): void {
  FX0 = rect ? rect.x0 : -FLOOR;
  FX1 = rect ? rect.x1 : FLOOR;
  FY0 = rect ? rect.y0 : -FLOOR;
  FY1 = rect ? rect.y1 : FLOOR;
}
