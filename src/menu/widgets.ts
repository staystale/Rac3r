import { GHOST_MS } from './style.ts';
import { MENU_COL } from './palette.ts';

// MENU TAPS for the phone report (?report=1, game/loop.ts): taps a new screen ignored (inside its
// GHOST_MS window) and the slowest button handler, since the last frame took them
const menuTaps = { ignored: 0, handlerMs: 0 };

/** What the widgets read of the menu context (menu.ts builds it). */
export interface MenuCtx { root: HTMLElement; openedAt: number }

/**
 * The menu taps since the last call, then starts counting again.
 * @returns taps ignored, the slowest handler in ms
 */
export function takeMenuTaps() {
  const taps = { ...menuTaps };
  menuTaps.ignored = 0;
  menuTaps.handlerMs = 0;
  return taps;
}

/**
 * Empties the menu root and adds a fresh pane (and stamps the ghost-click guard).
 * @param menu the menu context
 * @param wide true for the 720 px pane, false for the 320 px one
 * @returns the new pane element
 */
export function addPane(menu: MenuCtx, wide: boolean): HTMLElement {
  menu.openedAt = performance.now();
  menu.root.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'pane';
  panel.style.width = wide ? 'min(720px, calc(100% - 24px))' : 'min(320px, calc(100% - 24px))';
  menu.root.appendChild(panel);
  return panel;
}

// how long a pressed button blinks before it acts (menu/pixelstyle.ts .hit)
const PRESS_BLINK_MS = 160;

/**
 * Adds a menu button; its click is ignored while disabled or inside the ghost-click window.
 * @param menu the menu context
 * @param parent element to append to
 * @param label button HTML
 * @param onClick click handler
 * @param [cls] class name
 * @param [disabled] true to lock the button
 * @param [tag] small red tag after the label
 * @returns the button
 */
export function addButton(menu: MenuCtx, parent: HTMLElement, label: string, onClick: () => void,
  cls = '', disabled = false, tag = ''): HTMLButtonElement {
  const button = document.createElement('button');
  button.innerHTML = label + (tag ? `<span class="tag">${tag}</span>` : '');
  if (cls) button.className = cls;
  button.disabled = disabled;
  button.addEventListener('click', (evt) => {
    evt.stopPropagation();
    if (disabled) return;
    const tapAt = performance.now();
    if (tapAt - menu.openedAt <= GHOST_MS) {
      menuTaps.ignored++;
      return;
    }
    // the handler's own time, not the press blink before it (that wait is wanted, owner 11-03)
    const act = () => {
      const actAt = performance.now();
      onClick();
      menuTaps.handlerMs = Math.max(menuTaps.handlerMs, performance.now() - actAt);
    };
    // the press shows - electric blue, two blinks - then the button acts (owner 11-03)
    if (button.classList.contains('hit')) return;
    button.classList.add('hit');
    setTimeout(() => {
      button.classList.remove('hit');
      // only if its screen is still up (a race may finish, or a tool open results, mid-blink)
      if (button.isConnected) act();
    }, PRESS_BLINK_MS);
  });
  parent.appendChild(button);
  return button;
}

/**
 * Creates an element with HTML content and an optional class, and appends it to parent.
 * @param parent element to append to
 * @param tag tag name
 * @param html inner HTML
 * @param [cls] class name
 * @returns the new element
 */
export function addElement(parent: HTMLElement, tag: string, html: string,
  cls?: string): HTMLElement {
  const elem = document.createElement(tag);
  elem.innerHTML = html;
  if (cls) elem.className = cls;
  parent.appendChild(elem);
  return elem;
}

/**
 * Draws a level's painted thumbnail into a new canvas and returns it.
 * @param thumb the cached thumbnail canvas
 * @returns a canvas holding a copy of the thumbnail
 */
export function copyThumb(thumb: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = thumb.width;
  canvas.height = thumb.height;
  canvas.getContext('2d')!.drawImage(thumb, 0, 0);
  return canvas;
}

/**
 * Draws the workshop lift: a pixel floor, two lift arms, the car top-down on it, scaled up on
 * whole pixels.
 * @param canvas canvas to draw into
 * @param spr the car sprite ({ c: canvas })
 */
export function drawLift(canvas: HTMLCanvasElement, spr: { c: HTMLCanvasElement }): void {
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = MENU_COL.lift.floor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = MENU_COL.lift.panel;
  for (let x = 0; x < canvas.width; x += 24) ctx.fillRect(x, 0, 12,
    canvas.height);      // floor panels
  ctx.fillStyle = MENU_COL.lift.stripe;
  ctx.fillRect(0, canvas.height - 10, canvas.width,
    4);                                 // hazard stripe
  const scale = Math.max(1, Math.floor(Math.min((canvas.width - 60) / spr.c.width, (canvas.height
    - 40) / spr.c.height)));
  const drawW = spr.c.width * scale, drawH = spr.c.height * scale,
    x = Math.round((canvas.width - drawW) / 2), y = Math.round((canvas.height - drawH) / 2) - 4;
  ctx.fillStyle = MENU_COL.lift.arm;
  ctx.fillRect(x - 10, y + drawH * 0.2, drawW + 20, 6);
  ctx.fillRect(x - 10, y + drawH * 0.8 - 6, drawW + 20, 6);   // lift arms
  ctx.fillStyle = MENU_COL.lift.post;
  ctx.fillRect(x - 16, y - 6, 8, drawH + 12);
  ctx.fillRect(x + drawW + 8, y - 6, 8, drawH + 12);           // posts
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(x + 4, y + 6, drawW,
    drawH);                                                  // shadow
  ctx.drawImage(spr.c, x, y, drawW, drawH);
}
