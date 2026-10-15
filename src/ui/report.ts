// PHONE FRAME REPORT (?report=1, with the frame meter): every REPORT_FRAMES frames the phone posts
// its frame timings to the test server (serve.mjs /__report), so the foreman can read what the
// owner's phone does instead of guessing from a desktop browser with the CPU slowed down. A frame
// whose dt is long while sim + draw were short points at the GPU, the compositor or a garbage
// collection between frames, not at our code.

const REPORT_FRAMES = 300;   // frames per post (~5 s)

/** One frame: dt, sim ms, draw ms, physics steps, tiles painted, highway slides. */
export type ReportFrame = [number, number, number, number, number, number];

/**
 * Creates the reporter.
 * @param query the page query (which link the owner opened)
 * @param level the level id now, read at each post
 * @returns add(frame) per frame
 */
export function createReporter(query: string, level: () => string) {
  const frames: ReportFrame[] = [];
  const session = Math.random().toString(36).slice(2, 8);
  let part = 0;
  return {
    /**
     * Records one frame; posts the batch when it is full.
     * @param frame the frame's numbers
     */
    add(frame: ReportFrame) {
      frames.push(frame);
      if (frames.length < REPORT_FRAMES) return;
      const body = JSON.stringify({
        session, part: part++, query, level: level(), userAgent: navigator.userAgent,
        dpr: devicePixelRatio, width: innerWidth, height: innerHeight,
        frames: frames.splice(0, frames.length),
      });
      fetch('/__report', { method: 'POST', body, keepalive: true }).catch(() => {});
    },
  };
}
