// hud/fpstoggle.ts - THE FPS COUNTER AS A HUD-LIST ROW: the pause menu's
// HUD list (game/menuflow.ts hudActions) turns it on or off in any mode, remembered on the device;
// until it is set it shows as before - in test mode only (hud/controls.ts drawHudFps).

// the device's choice (localStorage), null until the player sets it
const FPS_KEY = 'carsim.hud.fps';
let chosen: boolean | null = null;
try {
  const stored = localStorage.getItem(FPS_KEY);
  chosen = stored === '1' ? true : stored === '0' ? false : null;
} catch { /* no storage: the default */ }

/**
 * Whether the FPS counter shows: the player's choice, else test mode only.
 * @param testMode the game is in test mode
 * @returns it shows
 */
export const isFpsShown = (testMode: boolean | undefined): boolean =>
  chosen !== null ? chosen : !!testMode;

/**
 * The HUD list's FPS row set: shown or not, remembered on the device.
 * @param shown shown or not
 */
export function setFpsShown(shown: boolean): void {
  chosen = shown;
  try {
    localStorage.setItem(FPS_KEY, shown ? '1' : '0');
  } catch { /* no storage: this session only */ }
}
