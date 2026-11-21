// world/labstart.ts - ?labstart: THE LAB'S START SPOT, one for every vehicle. The old spot, on the
// skidpad ring, stood 1.3 m off a row of street lights with one 2.3 m ahead: a car cleared it, the
// 2.55 m Scanyah stood against it and could not drive straight out. The new spot is the middle of
// the lane between the two rows of lights (y 27 and 41: 7 m each side), 10 m from the lights
// along it (x -46 and -26), facing east down the open lane (tools/scratch/_labstart.mjs lists what
// stands round a spot).
import { FIX } from '../core/fixes.ts';

/** A start spot: its middle (world m) and heading (rad). */
interface StartSpot { x: number; y: number; heading: number }

// the old spot, and the new one in the open
const OLD_START: StartSpot = { x: -28.3, y: 28.3, heading: 0 };
const NEW_START: StartSpot = { x: -36, y: 34, heading: 0 };

/** The Lab's start spot (its spawn and its painted start box). */
export const LAB_START: StartSpot = FIX.labstart ? NEW_START : OLD_START;
