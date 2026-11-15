// The ground tiles' density steps (tiles.ts). A tile painted at the zoom-1 step and shrunk by the
// GPU made a view zoomed out at ZOOM_MIN 0.30 need ~11x the tiles of zoom 1, each painted and
// uploaded at full density. A tile is painted at the coarsest of a few steps still at least as
// dense as the screen, so the GPU never enlarges one.

// the steps a tile may be painted at (zoom 2^(k/2): 1, 0.5, 0.354), finest first. Zoom 1 for the
// zoom range 0.5-1 (all zoomed-in play: nothing changes there); 0.354 covers ZOOM_MIN 0.30 at
// 1.18x the screen's density (0.25 would be blurred, enlarged 1.2x)
export const DENSITY_STEPS = [0, -2, -3];
// the zoom must be this much inside a coarser step's range before it is drawn (x zoom), and this
// near a finer step's limit for the finer one to be readied (/ zoom): a gap between the two, so
// the speed zoom wandering at a limit never flips the step back and forth
const COARSER_LAG = 1.1, FINER_EARLY = 0.95;

/**
 * The zoom of a step.
 * @param step the step
 * @returns the zoom
 */
export const zoomOfStep = (step: number) => Math.pow(2, step / 2);

/**
 * The coarsest step whose tiles are at least as dense as a view at this zoom.
 * @param zoom the view's zoom
 * @returns the step
 */
export function stepForZoom(zoom: number): number {
  for (let i = DENSITY_STEPS.length - 1; i >= 0; i--) {
    if (zoomOfStep(DENSITY_STEPS[i]) >= zoom) return DENSITY_STEPS[i];
  }
  return DENSITY_STEPS[0];
}

/**
 * The step the view wants given the one it is drawn at: a finer one as the zoom nears the drawn
 * step's limit (readied before it is needed), a coarser one once the zoom is well inside its
 * range, else the drawn one.
 * @param zoom the view's zoom
 * @param drawn the step drawn now
 * @returns the step wanted
 */
export function wantedStep(zoom: number, drawn: number): number {
  const finer = stepForZoom(zoom / FINER_EARLY);
  if (finer > drawn) return finer;
  const coarser = stepForZoom(zoom * COARSER_LAG);
  return coarser < drawn ? coarser : drawn;
}

/**
 * The lowest zoom a step is drawn at before the view moves to a coarser one.
 * @param step the step
 * @param zoomMin the camera's widest zoom
 * @returns the zoom
 */
export function lowestZoomOf(step: number, zoomMin: number): number {
  const index = DENSITY_STEPS.indexOf(step);
  const coarser = DENSITY_STEPS[index + 1];
  return coarser === undefined ? zoomMin : Math.max(zoomMin, zoomOfStep(coarser) / COARSER_LAG);
}
