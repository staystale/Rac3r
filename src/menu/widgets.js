import { GHOST_MS } from './style.js';

// MENU TAPS for the phone report (?report=1, game/loop.js): taps a new screen ignored (inside its
// GHOST_MS window) and the slowest button handler, since the last frame took them
const menuTaps = { ignored: 0, handlerMs: 0 };

/**
 * The menu taps since the last call, then starts counting again.
 * @returns {{ignored: number, handlerMs: number}} taps ignored, the slowest handler in ms
 */
export function takeMenuTaps() {
  const taps = { ...menuTaps };
  menuTaps.ignored = 0;
  menuTaps.handlerMs = 0;
  return taps;
}

/**
 * Empties the menu root and adds a fresh pane (and stamps the ghost-click guard).
 * @param {object} menu the menu context
 * @param {boolean} wide true for the 720 px pane, false for the 320 px one
 * @returns {HTMLElement} the new pane element
 */
export function addPane(menu, wide) {
  menu.openedAt = performance.now();
  menu.root.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'pane';
  panel.style.width = wide ? 'min(720px, calc(100% - 24px))' : 'min(320px, calc(100% - 24px))';
  menu.root.appendChild(panel);
  return panel;
}

/**
 * Adds a menu button; its click is ignored while disabled or inside the ghost-click window.
 * @param {object} menu the menu context
 * @param {HTMLElement} parent element to append to
 * @param {string} label button HTML
 * @param {Function} onClick click handler
 * @param {string} [cls] class name
 * @param {boolean} [disabled] true to lock the button
 * @param {string} [tag] small red tag after the label
 * @returns {HTMLButtonElement} the button
 */
export function addButton(menu, parent, label, onClick, cls = '', disabled = false, tag = '') {
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
    onClick();
    menuTaps.handlerMs = Math.max(menuTaps.handlerMs, performance.now() - tapAt);
  });
  parent.appendChild(button);
  return button;
}

/**
 * Creates an element with HTML content and an optional class, and appends it to parent.
 * @param {HTMLElement} parent element to append to
 * @param {string} tag tag name
 * @param {string} html inner HTML
 * @param {string} [cls] class name
 * @returns {HTMLElement} the new element
 */
export function addElement(parent, tag, html, cls) {
  const elem = document.createElement(tag);
  elem.innerHTML = html;
  if (cls) elem.className = cls;
  parent.appendChild(elem);
  return elem;
}

/**
 * Draws a level's painted thumbnail into a new canvas and returns it.
 * @param {object} thumb the cached thumbnail canvas
 * @returns {HTMLCanvasElement} a canvas holding a copy of the thumbnail
 */
export function copyThumb(thumb) {
  const canvas = document.createElement('canvas');
  canvas.width = thumb.width;
  canvas.height = thumb.height;
  canvas.getContext('2d').drawImage(thumb, 0, 0);
  return canvas;
}

/**
 * Draws the workshop lift: a pixel floor, two lift arms, the car top-down on it, scaled up on
 * whole pixels.
 * @param {HTMLCanvasElement} canvas canvas to draw into
 * @param {object} spr the car sprite ({ c: canvas })
 */
export function drawLift(canvas, spr) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#23262e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#2b2f39';
  for (let x = 0; x < canvas.width; x += 24) ctx.fillRect(x, 0, 12,
    canvas.height);      // floor panels
  ctx.fillStyle = '#e8a13a';
  ctx.fillRect(0, canvas.height - 10, canvas.width,
    4);                                 // hazard stripe
  const scale = Math.max(1, Math.floor(Math.min((canvas.width - 60) / spr.c.width, (canvas.height
    - 40) / spr.c.height)));
  const drawW = spr.c.width * scale, drawH = spr.c.height * scale,
    x = Math.round((canvas.width - drawW) / 2), y = Math.round((canvas.height - drawH) / 2) - 4;
  ctx.fillStyle = '#5a5f6d';
  ctx.fillRect(x - 10, y + drawH * 0.2, drawW + 20, 6);
  ctx.fillRect(x - 10, y + drawH * 0.8 - 6, drawW + 20, 6);   // lift arms
  ctx.fillStyle = '#3a3e4a';
  ctx.fillRect(x - 16, y - 6, 8, drawH + 12);
  ctx.fillRect(x + drawW + 8, y - 6, 8, drawH + 12);           // posts
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(x + 4, y + 6, drawW,
    drawH);                                                  // shadow
  ctx.drawImage(spr.c, x, y, drawW, drawH);
}
