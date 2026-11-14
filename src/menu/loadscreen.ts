// menu/loadscreen.ts - THE LOADING SCREEN's picture (?loadscreen=1; the flow is game/loading.ts):
// the track's name and a bar, in the menu's look - its pane (near-black, a 2 px black edge, the
// burnt-brown inner line, the hard shadow), its title face and ember red for the name, the side
// note face for LOADING, and a bar as the setup's (the well colour, the inner line) filled in the
// menu's ember accent. DOM, as the menu: it is up while the canvas is not drawn, and it takes every
// tap and touch so none reaches the world below.
import { MENU_FACES } from './pixelstyle.ts';
import { MENU_COL } from './palette.ts';

// ms the screen takes to fade out over the fly-in's first frames
const FADE_MS = 250;

const CSS = `
#loadscreen { position: fixed; inset: 0; z-index: 25; display: flex; align-items: center;
  justify-content: center; background: #101116; touch-action: none; pointer-events: auto;
  opacity: 1; transition: opacity ${FADE_MS}ms linear; }
#loadscreen.fading { opacity: 0; pointer-events: none; }
#loadscreen.gone { display: none; }
#loadscreen .pane { width: min(440px, calc(100% - 48px)); padding: 16px; display: flex;
  flex-direction: column; gap: 12px; background: rgba(12,11,16,.95); border: 2px solid #000;
  box-shadow: inset 0 0 0 2px #3a2018, 6px 6px 0 rgba(0,0,0,.6); }
#loadscreen .what { font-family: R3Small, monospace; font-size: 18px; color: ${MENU_COL.dim};
  letter-spacing: .02em; }
#loadscreen .name { font-family: R3Title, monospace; font-size: clamp(14px, 4.2vw, 22px);
  line-height: 1.35; letter-spacing: .02em; color: #ff4a1a; overflow-wrap: anywhere;
  text-shadow: 2px 2px 0 #000, 3px 3px 0 #5a2f1c; text-transform: uppercase; }
#loadscreen .well { height: 18px; background: ${MENU_COL.well}; border: 2px solid #000;
  box-shadow: inset 0 0 0 2px #3a2018; overflow: hidden; }
#loadscreen .fill { height: 100%; background: ${MENU_COL.accent}; transform-origin: 0 50%;
  transform: scaleX(0); will-change: transform; }
`;

/** The loading screen's controls. */
export interface LoadScreen {
  show: (name: string) => void;
  progress: (share: number, overMs: number) => void;
  hide: () => void;
}

/**
 * Stops a tap or touch on the screen reaching anything under it (the world, the boot tap).
 * @param event the event
 */
function swallow(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * Builds the screen once (hidden): its style, the pane, the name and the bar.
 * @returns show (at once, the bar empty), progress and hide (a short fade)
 */
export function createLoadScreen(): LoadScreen {
  const style = document.createElement('style');
  style.textContent = MENU_FACES + CSS;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.id = 'loadscreen';
  root.className = 'gone';
  root.innerHTML = '<div class="pane"><div class="what">LOADING</div><div class="name"></div>'
    + '<div class="well"><div class="fill"></div></div></div>';
  for (const kind of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click'])
    root.addEventListener(kind, swallow, { passive: false });
  document.body.appendChild(root);
  const nameEl = root.querySelector('.name') as HTMLElement;
  const fill = root.querySelector('.fill') as HTMLElement;
  let fadeTimer = 0;
  return {
    show(name: string) {
      clearTimeout(fadeTimer);
      nameEl.textContent = name;
      fill.style.transition = 'none';
      fill.style.transform = 'scaleX(0)';
      root.className = '';
      // (the empty bar laid out now, so the first progress eases from it)
      void fill.offsetWidth;
    },
    // the bar eases to share (0..1) over overMs on the compositor, so it moves while a long
    // piece of work holds the page
    progress(share: number, overMs: number) {
      fill.style.transition = `transform ${Math.max(0, Math.round(overMs))}ms ease-out`;
      fill.style.transform = `scaleX(${Math.max(0, Math.min(1, share))})`;
    },
    hide() {
      root.className = 'fading';
      fadeTimer = window.setTimeout(() => { root.className = 'gone'; }, FADE_MS);
    },
  };
}
