// input.js — one normalized input state, keyboard + touch. The vehicle never sees an event.
//
// { steer: [-1..1], throttle: [0..1], brake: [0..1], handbrake, shiftUp, shiftDown }
//
// Touch scheme, decided in PLAN.md before any movement code existed: floating thumb stick
// anywhere in the LEFT half, three pedals on the RIGHT (throttle / brake / handbrake).
// Multi-touch by pointerId — holding the stick and the throttle at once is the commonest touch
// bug, so pointers are tracked individually and never shared. Every HUD/pedal touch is CONSUMED
// (CLAUDE.md §4).

// r 36 -> 40 (requirement: driving buttons slightly larger, only a small bit) px; >=44px targets
// via r*2 = 72
export const PEDAL = { r: 40, gap: 12, margin: 16 };

// PROGRESSIVE BRAKE. A button is 0 or 1, so on a phone you could only ever stamp on the pedal —
// which is exactly the input that locks all four wheels and stops SLOWEST. Holding ramps the
// pedal from a gentle initial bite to full over BRAKE_RAMP, which gives a touch player the analog
// control a real pedal has, and makes threshold braking something you can actually do with a
// thumb. Wall clock: this is about how long a human held a button, not about sim time (CLAUDE.md
// rule 5).
const BRAKE_MIN = 0.28;    // initial bite on a quick stab
// PROGRESSIVE HANDBRAKE, for the same reason and with a sharper ramp. MEASURED: as a
// binary button the handbrake broke the rear away identically however it was used — drift angle
// came out 95 / 95 / 95 deg at steering locks of 0.4, 0.6 and 0.9. The player's main input did
// not change the outcome, which is CLAUDE.md rule 1 and exactly why the drift felt
// uncontrollable. A real handbrake is modulated by how far you pull it; now a stab gives a light
// drag and a hold gives full lock. PROGRESSIVE THROTTLE, same idea as the brake. A button is 0 or
// 1, so on a phone every pull-away was a full-throttle one — which
// on a rear-drive car is a wheelspin, not a start. Holding ramps it, so a stab feathers and a
// hold floors it. RELEASE IS INSTANT on purpose: lifting off is the exit from a drift (measured —
// it recovers every car every time), so it must stay crisp.
const THR_MIN = 0.26;      // initial opening on a quick stab
// 0.50 -> 0.75 (requirement: it goes to max throttle slightly too quickly — it should ramp up the
// longer you hold it, only over a very short period, but slightly longer than now). R uses the same
// ramp.
const THR_RAMP = 0.75;     // s to full throttle

// HANDBRAKE: a short slew BOTH WAYS rather than a hold-ramp (requirement: very short like 0.1
// seconds). Instant on/off is a force step, and today has repeatedly shown that a discontinuous
// force is a judder. 0.1 s each way smooths the edge without costing the duration control that
// makes drift entry modulable — holding longer still means more rotation.
const HB_SLEW = 1 / 0.10;  // units per second, up AND down
// 0.50 -> 0.25 (requirement: holding brake should be foot-to-the-floor braking). A tap still bites
// lightly.
const BRAKE_RAMP = 0.25;   // s to reach full pedal

// 52 px meant a full-right to full-left correction was a 104 px thumb drag — too slow to catch a
// slide on a phone, which is most of why a handbrake flick "could not be fought". 38 makes the
// counter-steer a flick of the thumb rather than a sweep of the hand.
const STICK_MAX = 38;          // px of travel for full lock

const KEYMAP = {
  a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right',
  w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down',
  ' ': 'hand', e: 'shiftUp', q: 'shiftDown', z: 'reverse', t: 'toggleTcs',
};

/**
 * Is the touch scheme in force (mode forced to touch, or auto on a coarse pointer)?
 * @param {object} state the input state returned by createInput
 * @returns {boolean}
 */
function isInputTouch(state) {
  return state.mode === 'touch' ||
    (state.mode === 'auto' && matchMedia('(pointer: coarse)').matches);
}

/**
 * The pedal circles, laid out from the bottom-right corner.
 * @param {number} width canvas width in px
 * @param {number} height canvas height in px
 * @returns {Array<{name: string, x: number, y: number, r: number}>}
 */
function findPedalHits(width, height) {
  // laid out from the bottom-right corner; the four corners have owners (CLAUDE.md §4)
  const { r: radius, gap, margin } = PEDAL;
  const x = width - margin - radius;
  const yThrottle = height - margin - radius;
  const yBrake = yThrottle - radius * 2 - gap;
  const xHand = x - radius * 2 - gap;
  return [
    { name: 'throttle', x, y: yThrottle, r: radius },
    { name: 'brake', x, y: yBrake, r: radius },
    { name: 'handbrake', x: xHand, y: yThrottle, r: radius },
    { name: 'reverse', x: xHand, y: yBrake, r: radius * 0.66 },   // small R, above the handbrake
  ];
}

// THE HUD IS TESTED FIRST. MEASURED BUG, (requirement: I can't change vehicle): the steering stick
// claims the whole left 55% of the screen, and the car chip and RESET both live
// inside that zone — so on a phone every tap on them was swallowed as a steering drag and never
// reached the HUD. CLAUDE.md §4 says a tap on the HUD must never also reach the world; this was
// the same rule inverted, with the world eating the HUD. Controls win, always, and they win
// before anything else.
/**
 * Decide which control a pointer-down lands on.
 * @param {object} core shared handler state (opts used for hudDown)
 * @param {number} tapX x in canvas px
 * @param {number} tapY y in canvas px
 * @param {number} width canvas width in px
 * @param {number} height canvas height in px
 * @returns {string|null} 'hud', a pedal name, 'stick', or null for a world tap
 */
function pickInputTarget(core, tapX, tapY, width, height) {
  if (core.opts.hudDown && core.opts.hudDown(tapX, tapY)) return 'hud';
  for (const pedal of findPedalHits(width, height)) {
    // generous hit radius: a thumb is not a mouse
    if (Math.hypot(tapX - pedal.x, tapY - pedal.y) <= pedal.r * 1.35) return pedal.name;
  }
  if (tapX < width * 0.55) return 'stick';
  return null;
}

/**
 * Pointer down: claim the pointer for a control, or record a world tap.
 * @param {object} core shared handler state
 * @param {PointerEvent} event
 * @returns {void}
 */
function onInputPointerDown(core, event) {
  const { state, canvas, owners } = core;
  const rect = canvas.getBoundingClientRect();
  const tapX = event.clientX - rect.left, tapY = event.clientY - rect.top;
  const hit = pickInputTarget(core, tapX, tapY, rect.width, rect.height);
  if (hit === 'stick') {
    owners.set(event.pointerId, 'stick');
    state.stick.active = true;
    state.stick.ox = tapX; state.stick.oy = tapY;
    state.stick.x = tapX; state.stick.y = tapY;
  } else if (hit === 'hud') {
    owners.set(event.pointerId, 'hud');      // consumed by a control; never reaches the world
  } else if (hit) {
    owners.set(event.pointerId, hit);
    state.pedals[hit] = true;
  } else {
    // did not hit a control: it is a world tap (the car selector chip claims its own in hud.js)
    state.tapped = { x: tapX, y: tapY };
  }
  try {
    canvas.setPointerCapture?.(event.pointerId);
  } catch { /* pointer already gone (iOS took it) */ }
  event.preventDefault();
}

/**
 * Pointer move: drag the stick if this pointer owns it.
 * @param {object} core shared handler state
 * @param {PointerEvent} event
 * @returns {void}
 */
function onInputPointerMove(core, event) {
  const { state, canvas, owners } = core;
  const who = owners.get(event.pointerId);
  if (who !== 'stick') return;
  const rect = canvas.getBoundingClientRect();
  state.stick.x = event.clientX - rect.left;
  state.stick.y = event.clientY - rect.top;
  event.preventDefault();
}

/**
 * Pointer up / cancel / lost capture: release whatever this pointer held.
 * @param {object} core shared handler state
 * @param {PointerEvent} event
 * @returns {void}
 */
function onInputPointerUp(core, event) {
  const { state, owners } = core;
  const who = owners.get(event.pointerId);
  if (who === 'stick') { state.stick.active = false; state.stick.x = state.stick.ox; }
  else if (who && who !== 'hud') state.pedals[who] = false;
  owners.delete(event.pointerId);
  event.preventDefault();
}

// STUCK CONTROLS ON iOS (user: rapid taps / holds / several fingers left throttle,
// brake or steering ON). When iOS takes over a touch for a system gesture (magnifier, callout,
// pinch, edge swipe) the pointerup never comes, so the owner map keeps a pedal held for ever.
// Three layers: (1) stop the gestures starting — non-passive touch handlers that preventDefault
// on the canvas (the CSS alone does not stop the long-press magnifier on iOS); (2) release
// EVERYTHING when the page loses focus or is hidden; (3) when the last finger leaves the
// screen, nothing can still be held, whatever events went missing. tools/inputcheck.mjs drives
// each case.
/**
 * Release every held control: pointers, stick, pedals and keys.
 * @param {object} core shared handler state
 * @returns {void}
 */
function releaseAllInput(core) {
  const { state, owners, keys } = core;
  owners.clear();
  state.stick.active = false; state.stick.x = state.stick.ox;
  for (const pedalName in state.pedals) state.pedals[pedalName] = false;
  keys.clear();
}

/**
 * Touch end / cancel in the capture phase: when the last finger has left, release everything.
 * @param {object} core shared handler state
 * @param {TouchEvent} event
 * @returns {void}
 */
function onInputLastFinger(core, event) {
  if (event.touches.length === 0 && core.owners.size) releaseAllInput(core);
}

/**
 * Prevent the default of a cancelable event (stops iOS gestures on the canvas).
 * @param {Event} event
 * @returns {void}
 */
function blockInputEvent(event) { if (event.cancelable) event.preventDefault(); }

/**
 * The public input state object: presentation fields the HUD draws, plus the resolved axes.
 * @param {object} opts the createInput options (mode)
 * @returns {object} the fresh input state
 */
function makeInputState(opts) {
  return {
    steer: 0, throttle: 0, brake: 0, shiftUp: false, shiftDown: false,
    // presentation only — the HUD draws these, the model never reads them
    mode: opts.mode || 'auto',        // 'touch' | 'pc' | 'auto'
    stick: { active: false, ox: 0, oy: 0, x: 0, y: 0 },
    pedals: {},                       // name -> bool, for drawing the pressed state
    tapped: null,                    // {x,y} of a tap that no control consumed, cleared each frame
    brakeHeld: 0,                     // s the brake has been down, for the progressive ramp
    thrHeld: 0,                       // s the throttle has been down, for the progressive ramp
    revHeld: 0,                       // s R has been down — R ramps like the throttle
    handbrake: 0,                     // 0..1, slewed both ways (see HB_SLEW)
  };
}

/**
 * Resolve the steering axis from the stick or the keyboard.
 * @param {object} state the input state
 * @param {Set} keys the held key actions
 * @returns {void}
 */
function resolveInputSteer(state, keys) {
  if (state.stick.active) {
    const dx = state.stick.x - state.stick.ox;
    state.steer = Math.max(-1, Math.min(1, dx / STICK_MAX));
  } else if (!isInputTouch(state) || keys.size) {
    state.steer = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
  } else {
    state.steer = 0;
  }
}

/**
 * Resolve throttle, brake, handbrake, reverse and shifts from keys and pedals for one frame.
 * @param {object} state the input state
 * @param {Set} keys the held key actions
 * @param {number} wallDt wall-clock seconds since the last frame
 * @returns {void}
 */
function resolveInputPedals(state, keys, wallDt) {
  // Keyboard and stick are BOTH raw [-1..1]; the road-wheel rate limit in vehicle.js does the
  // smoothing, so one path serves both and a keyboard player and a thumb player feel the same
  // car.
  const kThrottle = keys.has('up') ? 1 : 0;
  const kBrake = keys.has('down') ? 1 : 0;
  const thrDown = Math.max(kThrottle, state.pedals.throttle ? 1 : 0) > 0;
  state.thrHeld = thrDown ? state.thrHeld + wallDt : 0;
  state.throttle = thrDown
    ? Math.min(1, THR_MIN + (1 - THR_MIN) * (state.thrHeld / THR_RAMP))
    : 0;

  const brakeDown = Math.max(kBrake, state.pedals.brake ? 1 : 0) > 0;
  state.brakeHeld = brakeDown ? state.brakeHeld + wallDt : 0;
  state.brake = brakeDown
    ? Math.min(1, BRAKE_MIN + (1 - BRAKE_MIN) * (state.brakeHeld / BRAKE_RAMP))
    : 0;
  const hbDown = keys.has('hand') || !!state.pedals.handbrake;
  const hbTarget = hbDown ? 1 : 0;
  const hbStep = HB_SLEW * wallDt;
  state.handbrake += Math.max(-hbStep, Math.min(hbStep, hbTarget - state.handbrake));
  // R is a pedal now (hold to reverse), ramped exactly like the throttle
  const revDown = keys.has('reverse') || !!state.pedals.reverse;
  state.revHeld = revDown ? state.revHeld + wallDt : 0;
  state.reverse = revDown ? Math.min(1, THR_MIN + (1 - THR_MIN) * (state.revHeld / THR_RAMP)) : 0;
  state.shiftUp = keys.has('shiftUp');
  state.shiftDown = keys.has('shiftDown');
}

export function createInput(canvas, opts = {}) {
  const state = makeInputState(opts);

  // shared handler state: the public object above plus the closure variables the handlers share
  const core = {
    state, canvas, opts,
    keys: new Set(),
    // pointerId -> { kind: 'stick' | pedal name }
    owners: new Map(),
  };
  const keys = core.keys;
  const isTouch = () => isInputTouch(state);
  state.isTouch = isTouch;

  // ---------- keyboard
  addEventListener('keydown', (event) => {
    const action = KEYMAP[event.key.toLowerCase()];
    if (action) { keys.add(action); event.preventDefault(); }
    if (opts.onKey) opts.onKey(event.key.toLowerCase());
  });
  addEventListener('keyup', (event) => {
    const action = KEYMAP[event.key.toLowerCase()];
    if (action) { keys.delete(action); event.preventDefault(); }
  });

  // ---------- touch / pointer
  state.pedalHits = findPedalHits;

  canvas.addEventListener('pointerdown', (event) => onInputPointerDown(core, event));
  canvas.addEventListener('pointermove', (event) => onInputPointerMove(core, event));
  canvas.addEventListener('pointerup', (event) => onInputPointerUp(core, event));
  canvas.addEventListener('pointercancel', (event) => onInputPointerUp(core, event));
  canvas.addEventListener('lostpointercapture', (event) => {
    if (core.owners.has(event.pointerId)) onInputPointerUp(core, event);
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  const releaseAll = () => releaseAllInput(core);
  state.releaseAll = releaseAll;
  for (const evName of ['touchstart', 'touchmove', 'touchend'])
    canvas.addEventListener(evName, blockInputEvent, { passive: false });
  addEventListener('gesturestart', blockInputEvent, { passive: false });     // iOS pinch
  const lastFinger = (event) => onInputLastFinger(core, event);
  addEventListener('touchend', lastFinger, { capture: true });
  addEventListener('touchcancel', lastFinger, { capture: true });
  addEventListener('blur', releaseAll);
  addEventListener('pagehide', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

  // ---------- resolve, once per frame
  state.update = function update(wallDt = 1 / 60) {
    resolveInputSteer(state, keys);
    resolveInputPedals(state, keys, wallDt);
    return state;
  };

  state.consumeTap = function consumeTap() {
    const tap = state.tapped; state.tapped = null; return tap;
  };

  return state;
}
