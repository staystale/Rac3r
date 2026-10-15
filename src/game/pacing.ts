// FRAME PACING (default; ?vsync=0 = off). Safari reports frame times rounded to whole
// milliseconds (MEASURED on the owner's iPhone, ?report=1: 17 ms x3217, 16 ms x1866, 18 ms x266,
// pairs like 24 + 10, while the display ran a steady 16.68 ms). Moving the world by those numbers
// moved it unevenly while the frames were shown evenly: the camera follows the car, so the ground
// shook by up to ~2 px a frame.
// Here a frame advances game time by a WHOLE number of display refreshes: the refresh interval is
// learned from the frames, the rounding is carried over (never shown), and a frame that really
// missed a refresh still counts as two.

// a gap this long (ms) is a pause or a background tab, not a frame: resync, do not pace it
const RESYNC_MS = 250;
// how fast the learned refresh interval follows the frames (per frame)
const LEARN_RATE = 0.02;
// a timestamp this close (ms) to a whole number of refreshes is already even: it is used as it
// is, so a precise clock (desktop browsers, the deterministic tools) gives exactly the old times
const EXACT_MS = 0.05;

/**
 * Creates the frame pacer.
 * @returns step(now, last): the ms of game time this frame
 */
export function createFramePacer() {
  let interval = 1000 / 60;            // the display refresh, ms (learned)
  let shown: number | null = null;     // the time of the last refresh paced, ms
  return {
    /**
     * The ms of game time for this frame: whole display refreshes since the last one.
     * @param now this frame's requestAnimationFrame timestamp, ms
     * @param last the previous frame's timestamp, ms
     * @returns ms of game time
     */
    step(now: number, last: number) {
      const raw = now - last;
      if (shown === null || raw <= 0 || raw > RESYNC_MS) { shown = now; return raw; }
      // learn from frames that look like one refresh (a missed refresh would pull it up)
      if (raw > interval * 0.5 && raw < interval * 1.5) interval += (raw - interval) * LEARN_RATE;
      const before = shown;
      const refreshes = Math.max(1, Math.round((now - shown) / interval));
      shown += refreshes * interval;
      // already even, or drifted more than a refresh from the real clock: the real time
      const offBy = Math.abs(now - shown);
      if (offBy < EXACT_MS || offBy > interval) shown = now;
      return shown - before;
    },
    /** the learned refresh interval, ms (for the tools) */
    get interval() { return interval; },
  };
}
