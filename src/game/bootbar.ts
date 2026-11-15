// game/bootbar.ts - THE BOOT BAR: the loading screen at the page's first
// load. The page puts it up before the code has loaded (index.html #bootbar: the pane, LOADING, the
// game's name, the bar) and eases the bar toward the code's share over the time the code took on
// this device the last time (or a guess), on the compositor, so it moves while the code downloads
// and while main.ts builds the world and the menu. When main.ts is done this takes the screen
// over (menu/loadscreen.ts takeBootScreen) and eases on through the rest of the menu's wait -
// its first frame drawn, then the fonts its text asked for - then the bar fills, flashes blue (two
// blinks) and fades into the menu, as the loading screen does (loading.ts flashThenHide). The logo
// and the track thumbnails are not waited for (the menu never has: MEASURED, holding for them made
// the menu later - tools/scratch/_bootbar.mjs, TODO.md). The menu race behind it runs as it would
// without it. Both stages' times are kept for the next load's pacing.
import { takeBootScreen } from '../menu/loadscreen.ts';
import { CREEP_SHARE, flashThenHide } from './loading.ts';

// where the stages' times are kept between loads (index.html reads it before the code runs)
const STORE_KEY = 'rac3r.bootbar';
// ms the menu may take to be ready before the bar ends anyway: a font that never comes must not
// leave the screen up
const READY_MAX_MS = 8000;
// the code's share of the bar, and ms the menu's wait is thought to take, when the page set none
const CODE_SHARE_FALLBACK = 0.8;
const READY_FALLBACK_MS = 600;

/**
 * Resolves after the next frame has been drawn (a task after it).
 * @returns the promise
 */
function nextFrameDrawn(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

/**
 * The menu ready: its first frame drawn, then the fonts its text asked for in it loaded (a font
 * that fails counts as done).
 * @returns resolves when ready
 */
function menuReady(): Promise<unknown> {
  return nextFrameDrawn().then(() => document.fonts.ready).catch(() => undefined);
}

/**
 * Keeps the two stages' times for the next load's pacing (nothing if storage is refused).
 * @param codeMs ms from the page opening to the code's work done
 * @param readyMs ms the menu then took to be ready
 */
function keepTimes(codeMs: number, readyMs: number): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ codeMs: Math.round(codeMs),
      readyMs: Math.round(readyMs) }));
  } catch {
    // (paced by the guesses next time)
  }
}

/**
 * The code has run (main.ts, the menu shown or the boot tap up): the page's boot bar eases on
 * through the menu's wait, then fills, flashes and fades. Nothing when the page put no bar up.
 * @param hasMenu false with no menu (?menu=0, the test tools): the bar ends at once, over the boot
 *   tap
 */
export function endBootBar(hasMenu: boolean): void {
  const screen = takeBootScreen();
  if (!screen) return;
  const root = document.getElementById('bootbar')!;
  const codeMs = performance.now();
  const codeShare = Number(root.dataset.share) || CODE_SHARE_FALLBACK;
  const readyGuessMs = Number(root.dataset.readyMs) || READY_FALLBACK_MS;
  screen.progress(codeShare + (1 - codeShare) * CREEP_SHARE, readyGuessMs);
  const cap = new Promise((resolve) => setTimeout(resolve, READY_MAX_MS));
  Promise.race([hasMenu ? menuReady() : Promise.resolve(), cap]).then(() => {
    if (hasMenu) keepTimes(codeMs, performance.now() - codeMs);
    flashThenHide(screen, 0, () => true, () => undefined);
  });
}
