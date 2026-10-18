// PHONE FRAME REPORT (?report=1, with the frame meter): every REPORT_FRAMES frames the phone posts
// its frame timings to the test server (serve.mjs /__report), so the foreman can read what the
// owner's phone does instead of guessing from a desktop browser with the CPU slowed down. A frame
// whose dt is long while sim + draw were short points at the GPU, the compositor or a garbage
// collection between frames, not at our code.
import { WEATHER } from "../world/weather.ts";
import { FIELD } from "../world/coverfield.ts";
import { DAYLIGHT } from "../world/daylight.ts";
import { CLOCK, calendarAt } from "../world/clock.ts";

const REPORT_FRAMES = 300;   // frames per post (~5 s)

/**
 * The weather a post was measured in (tools/phonereport.mjs prints it): its kind, the track and
 * air temperatures, rain / snow falling, the track's wetness and the cover field's levels.
 * @returns the weather now
 */
function weatherNow() {
  const round = (value: number) => Math.round(value * 100) / 100;
  return { kind: WEATHER.kind, trackC: round(WEATHER.trackC), airC: round(WEATHER.tempC),
    rain: round(WEATHER.rain), snow: round(WEATHER.snow), wetness: round(WEATHER.wetness),
    field: { water: round(FIELD.water), snow: round(FIELD.snow), ice: round(FIELD.ice) },
    // the time of day (the game clock) and how dark it was
    hour: CLOCK.isOn ? round(calendarAt(CLOCK.eventS).hour) : null,
    dark: round(DAYLIGHT.darkness) };
}

/** One frame: dt, sim ms, draw ms, physics steps, tiles painted, highway slides, css px per
 * metre (the zoom), GPU texture uploads, mipmap builds; the menu up (1 / 0), menu taps ignored
 * (a new screen's ghost-click window), the slowest menu button handler (ms), the texture warm-up
 * since the last frame (ms, main.js). */
export type ReportFrame = [number, number, number, number, number, number, number, number, number,
  number, number, number, number];

/**
 * Creates the reporter.
 * @param query the page query (which link the owner opened)
 * @param level the level id now, read at each post
 * @param loadMs ms from the page opening to the menu shown, or null (no menu)
 * @returns add(frame) per frame, and flush() to post what is waiting (the page is being left)
 */
export function createReporter(query: string, level: () => string,
    loadMs: () => number | null = () => null) {
  const frames: ReportFrame[] = [];
  const session = Math.random().toString(36).slice(2, 8);
  let part = 0;
  /** Posts the frames waiting, if any. */
  const post = () => {
    if (!frames.length) return;
    const body = JSON.stringify({
      session, part: part++, query, level: level(), loadMs: loadMs(),
      userAgent: navigator.userAgent,
      dpr: devicePixelRatio, width: innerWidth, height: innerHeight,
      // opened from the home screen (a full-screen web app), not in a Safari tab
      homeScreen: matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches
        || (navigator as Navigator & { standalone?: boolean }).standalone === true,
      weather: weatherNow(),
      frames: frames.splice(0, frames.length),
    });
    fetch('/__report', { method: 'POST', body, keepalive: true }).catch(() => {});
  };
  return {
    /**
     * Records one frame; posts the batch when it is full.
     * @param frame the frame's numbers
     */
    add(frame: ReportFrame) {
      frames.push(frame);
      if (frames.length >= REPORT_FRAMES) post();
    },
    flush: post,
  };
}
