// PHONE FRAME REPORT (?report=1, with the frame meter): every REPORT_FRAMES frames the phone posts
// its frame timings to the test server (serve.mjs /__report), so the foreman can read what the
// owner's phone does instead of guessing from a desktop browser with the CPU slowed down. A frame
// whose dt is long while sim + draw were short points at the GPU, the compositor or a garbage
// collection between frames, not at our code.

const REPORT_FRAMES = 300;   // frames per post (~5 s)

/** One frame: dt, sim ms, draw ms, physics steps, tiles painted, highway slides, css px per
 * metre (the zoom), GPU texture uploads, mipmap builds; the menu up (1 / 0), menu taps ignored
 * (a new screen's ghost-click window), the slowest menu button handler (ms). */
export type ReportFrame = [number, number, number, number, number, number, number, number, number,
  number, number, number];

/**
 * Creates the reporter.
 * @param query the page query (which link the owner opened)
 * @param level the level id now, read at each post
 * @param loadMs ms from the page opening to the menu shown, or null (no menu)
 * @returns add(frame) per frame
 */
export function createReporter(query: string, level: () => string,
    loadMs: () => number | null = () => null) {
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
        session, part: part++, query, level: level(), loadMs: loadMs(),
        userAgent: navigator.userAgent,
        dpr: devicePixelRatio, width: innerWidth, height: innerHeight,
        // opened from the home screen (a full-screen web app), not in a Safari tab
        homeScreen: matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches
          || (navigator as Navigator & { standalone?: boolean }).standalone === true,
        frames: frames.splice(0, frames.length),
      });
      fetch('/__report', { method: 'POST', body, keepalive: true }).catch(() => {});
    },
  };
}
