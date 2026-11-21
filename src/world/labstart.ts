// world/labstart.ts - THE LAB'S START SPOT, one for every vehicle: the middle of the lane between
// the two rows of street lights (y 27 and 41: 7 m each side), 10 m from the lights along it (x -46
// and -26), facing east down the open lane. (The old spot on the skidpad ring stood 1.3 m off a
// row of lights with one 2.3 m ahead: the 2.55 m Scanyah could not drive straight out;
// tools/scratch/_labstart.mjs lists what stands round a spot.)

/** A start spot: its middle (world m) and heading (rad). */
interface StartSpot { x: number; y: number; heading: number }

/** The Lab's start spot (its spawn and its painted start box). */
export const LAB_START: StartSpot = { x: -36, y: 34, heading: 0 };
