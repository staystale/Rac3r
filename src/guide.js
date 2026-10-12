// guide.js — HOW TO PLAY: a card overlay that POINTS AT the control it is talking about (user, 2026-10-03).
//
// CLAUDE.md §4: the first-run walkthrough is required, and it is UPDATED IN THE SAME TASK as any mechanic or
// control that changes it. The cards are data (CARDS below); add or edit a row, nothing else.
//
// Shape (approved): shown once per device after the level fly-in; the sim PAUSES while it is open (main.js);
// the screen dims with a hole cut round the target, the hole's rim pulses, and a card sits clear of it with an
// arrow. NEXT / SKIP / progress dots. Replayed from the "?" chip on the button row (or H on a keyboard).
//
// TARGETS ARE READ FROM hud.layout() AND input.pedalHits() EVERY FRAME — the same geometry the HUD draws and
// hit-tests with — so a highlight can never sit somewhere the control is not, in any orientation.
//
// While open, the guide consumes EVERY tap (main.js asks it first), so a tap on a card can never steer or
// press a pedal (CLAUDE.md §4: a tap on the HUD must never also reach the world).

import "./world/load.js";   // the world is set up before this file runs (as importing lab.js did)
import { COL } from "./world/colours.ts";
import { LEVEL } from "./world/state.js";

const M = 12;
const KEY = 'carsim.guideSeen';

// target(ctx) returns a screen rect {x,y,w,h} or null (a card with no target sits centred).
// ctx = { L: hud layout, W, H, touch, pedals: input.pedalHits(), car screen rect, hint: PC key-hint rect }
const CARDS = [
  {
    title: 'STEER',
    touch: 'Drag anywhere on the left half of the screen to steer. Small thumb moves make small corrections.',
    pc: 'A / D or the arrow keys steer.',
    target: (c) => c.touch ? { x: M, y: c.H * 0.42, w: c.W * 0.55 - M * 2, h: c.H * 0.58 - M } : c.hint,
  },
  {
    title: 'GAS + BRAKE',
    touch: 'Hold to press harder: a tap feathers, a hold floors it. Lift off the gas to catch a slide.',
    pc: 'W / S, or up / down. Hold to press harder; a tap feathers. Lift off the gas to catch a slide.',
    target: (c) => c.touch ? circles(c.pedals, ['throttle', 'brake']) : c.hint,
  },
  {
    title: 'HANDBRAKE + REVERSE',
    touch: 'HAND locks the rear wheels: flick it to start a slide. Hold R to reverse: it brakes first if you are still rolling.',
    pc: 'SPACE is the handbrake: flick it to start a slide. Hold Z to reverse: it brakes first if you are still rolling.',
    target: (c) => c.touch ? circles(c.pedals, ['handbrake', 'reverse']) : c.hint,
  },
  {
    // DRIVER AIDS (2026-10-03). Only some cars have them, so the card points at the chips when this car does.
    title: 'ABS + TCS',
    text: (c) => (c.aids
      ? 'Driver aids. ABS stops the wheels locking when you brake. TCS stops wheelspin and catches slides. They flash when working. Tap to switch them off for the real challenge'
        + (c.touch ? '.' : ' (or B / T).')
      : 'Some cars have driver aids: ABS stops the wheels locking, TCS stops wheelspin and catches slides. This one has none — it is all you.'),
    target: (c) => c.aids,
  },
  {
    title: 'SPEED + GEARS',
    text: (c) => 'Speed, gear and revs. The gearbox is automatic; the bar flashes red at the shift point.'
      + (LEVEL.subtrack ? ' Below it: your lap time and best lap.' : ''),
    target: (c) => LEVEL.subtrack ? union(c.L.speed, c.L.lap) : c.L.speed,
  },
  {
    title: 'CAR + TRACK',
    text: () => 'Tap here to pick a car and a level. Each car drives differently: front, rear or four-wheel drive.',
    target: (c) => c.L.chip,
  },
  {
    title: 'RESTART / RESET / CLEAR',
    text: () => 'RESTART: back to the start, with cones, marks, worn ground, tyre heat and lap times reset. RESET: back '
      + (LEVEL.subtrack ? 'onto the track near where you left it.' : 'to where you were a couple of seconds ago.') + ' CLEAR: wipe the tyre marks.',
    target: (c) => union(c.L.restart, c.L.reset, c.L.clear),
  },
  {
    title: 'TYRES + SURFACES',
    text: () => 'Tyres start COLD: on tarmac they need warming up for full grip (off-road it makes no difference). Every surface grips differently, and snow, ice and water change as you drive over them. TUNE > TYRE HUD shows tyre temperatures.',
    target: (c) => c.carRect,
  },
  {
    title: 'DAMAGE + TRACK LIMITS',
    text: () => 'Big hits DAMAGE the car (pull, less grip and power, punctures); the little car by your speed shows where. RESET mends it; hits still go on the REPAIR bill. Cutting the track costs time or puts you back.',
    target: (c) => c.carRect,
  },
  {
    title: 'THAT\'S IT',
    text: (c) => c.menu ? 'Tap II to pause: restart, change track, or see this again under HOW TO PLAY.'
      : c.touch ? 'Tap ? any time to see this again.' : 'Press H or click ? any time to see this again.',
    target: (c) => c.L.help,
  },
];

// EVENT RULES (user, 2026-10-05: "rules to events should be EXPLAINED the FIRST TIME you do them, and shown WALK-THROUGH style, if
// needed"). The same card overlay, pointing at the HUD that matters; opened by main.js when an event STARTS for the first time on this
// device (remembered per event in localStorage 'carsim.rulesSeen'), PAUSING the sim before the lights; replayed from the pause menu.
// key = main.js eventKind(): 'race' (VS AI, circuit), 'rx' (RX race), 'stage' (rally stage), 'highway' (VS AI on the endless road),
// 'endless' (the endless road, solo).
const NOTICE = (c) => ({ x: c.W / 2 - Math.min(150, c.W * 0.4), y: c.H * 0.3 - 26, w: Math.min(300, c.W * 0.8), h: 52 });
const LIGHTS = (c) => ({ x: c.W / 2 - Math.min(c.W, c.H) * 0.22, y: c.H * 0.2, w: Math.min(c.W, c.H) * 0.44, h: Math.min(c.W, c.H) * 0.19 });
export const RULES = {
  highway: [
    { title: 'HIGHWAY RACE', text: () => 'A ROLLING START: the game drives everyone in formation behind the red lights. When they go GREEN it is yours — floor it.', target: LIGHTS },
    { title: 'NO LAPS, NO FINISH LINE', text: () => 'The road never ends. You win by GETTING AWAY: weave through the traffic and leave every rival off the BOTTOM of the screen.', target: (c) => c.carRect },
    { title: 'THE COUNTDOWNS', text: () => 'All rivals off the bottom: PULLING AWAY counts down — hold them off and you win. Race freely while anyone is still with you. Only when you are LAST and even the slowest rival is off the TOP: CATCH THEM counts down (15 s) — get it back on screen or the race is over. Closing in on it holds the clock (CLOSING IN).', target: NOTICE },
    { title: 'YOUR POSITION', text: () => 'Here: your place, the distance, and the gap to the car ahead (AHEAD) or your lead over the one behind (LEAD).', target: (c) => c.L.lap },
    { title: 'TRAFFIC IS REAL', text: () => 'The traffic is not racing — it drives, changes lane (watch the indicators) and brakes. Hit it and you both take damage. A wreck stops with its hazards on.', target: (c) => c.carRect },
  ],
  endless: [
    { title: 'HIGHWAY TO HULL', text: () => 'An endless motorway. Drive as far as you can — the DISTANCE and your BEST are here. Hull never gets closer.', target: (c) => c.L.lap },
    { title: 'STAY ON IT', text: () => 'Go the wrong way, drop back, or wander far off the road and you are put back in the left lane. Running wide starts a countdown: get back on the road before it ends.', target: NOTICE },
    { title: 'TRAFFIC IS REAL', text: () => 'The traffic drives, changes lane (watch the indicators) and brakes. Hit it and you both take damage.', target: (c) => c.carRect },
    { title: 'SPEED CAMERAS', text: () => 'Every gantry has a camera. Go under one over 70 mph and you are CAUGHT: your speed and a fine (the faster, the bigger). Your fastest catch is kept.', target: (c) => c.carRect },
  ],
  race: [
    { title: 'RACE START', text: () => 'Wait for the lights: three reds, then GREEN — go. Everyone is held until then.', target: LIGHTS },
    { title: 'POSITION + LAPS', text: () => 'Your place and lap are here. The race ends once the top three are home — it always waits for you to finish.', target: (c) => c.L.lap },
    { title: 'TRACK LIMITS', text: () => 'Cutting the track gains you nothing: a big cut puts you back where you left the road.', target: NOTICE },
  ],
  rx: [
    { title: 'RALLYCROSS', text: () => 'A race of laps on mixed surfaces from the lights. Your lap and the JOKER status are here.', target: (c) => c.L.lap },
    { title: 'THE JOKER LAP', text: () => 'Once in the race you MUST take the JOKER — the longer branch with the arrows. Miss it, or take it twice, and it costs +30 s.', target: (c) => c.L.lap },
  ],
  stage: [
    { title: 'RALLY STAGE', text: () => 'Point to point against the clock, cars starting 30 s apart. Your time runs from the START line to the FINISH.', target: (c) => c.L.lap },
    { title: 'CUTS COST TIME', text: () => 'Cutting corners off the road adds a time penalty to your stage time.', target: NOTICE },
  ],
};
const RULES_KEY = 'carsim.rulesSeen';
export function rulesSeen(kind) { try { return (JSON.parse(localStorage.getItem(RULES_KEY) || '{}'))[kind] === 1; } catch { return false; } }
function markRules(kind) { try { const o = JSON.parse(localStorage.getItem(RULES_KEY) || '{}'); o[kind] = 1; localStorage.setItem(RULES_KEY, JSON.stringify(o)); } catch { /* fine */ } }

function union(...rs) {
  const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y));
  const x1 = Math.max(...rs.map((r) => r.x + r.w)), y1 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function circles(pedals, names) {
  return union(...pedals.filter((p) => names.includes(p.name)).map((p) => ({ x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 })));
}
const inRect = (p, r) => r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// where a ray from rect r's centre towards point q leaves r
function edgePoint(r, q) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, dx = q.x - cx, dy = q.y - cy;
  const s = Math.min(dx ? (r.w / 2) / Math.abs(dx) : Infinity, dy ? (r.h / 2) / Math.abs(dy) : Infinity);
  return { x: cx + dx * s, y: cy + dy * s };
}

function rr(g, r, rad) {
  g.moveTo(r.x + rad, r.y);
  g.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
  g.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad);
  g.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
  g.arcTo(r.x, r.y, r.x + r.w, r.y, rad);
  g.closePath();
}

function wrap(g, text, maxW) {
  const out = [];
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (line && g.measureText(t).width > maxW) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

export function createGuide() {
  let seen = false;
  try { seen = localStorage.getItem(KEY) === '1'; } catch { /* no storage: shows every load, which is harmless */ }
  let idx = -1;                 // -1 = closed
  let pulse = 0;                // wall clock (rule 5)
  let last = null;              // the geometry drawn last frame — hit() tests exactly what was drawn
  let deck = CARDS, deckKind = null;   // HOW TO PLAY, or an event's RULES (openRules)

  function close() {
    idx = -1; last = null;
    if (deckKind) markRules(deckKind); else { seen = true; try { localStorage.setItem(KEY, '1'); } catch { /* fine */ } }
    deck = CARDS; deckKind = null;
  }
  const next = () => { if (++idx >= deck.length) close(); };

  function draw(g, game, L, W, H, wallDt, renderer) {
    if (idx < 0) return;
    pulse += wallDt;
    const touch = game.input.isTouch();
    // the car on screen, for the tyres card; at least a thumb's width so the hole reads as a hole
    const half = Math.max(30, 3 * renderer.PPM);
    const ccx = renderer.sx(game.car.x), ccy = renderer.sy(game.car.y);
    const font = (s, w = 600) => `${w} ${s}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    g.font = font(11);
    const hintW = g.measureText('W/S drive   A/D steer   SPACE handbrake   B abs   T tcs   R reset   H help').width;
    const aids = game.car.spec.aids;
    const aidRect = aids ? [aids.abs && L.absChip, aids.tcs && L.tcsChip].filter(Boolean) : [];
    const c = {
      L, W, H, touch, pedals: game.input.pedalHits(W, H),
      carRect: { x: ccx - half, y: ccy - half, w: half * 2, h: half * 2 },
      hint: { x: M, y: H - M - 18, w: hintW, h: 20 },
      aids: aidRect.length ? union(...aidRect) : null,
      menu: !!game.menuMode,
    };
    const card = deck[idx];
    const text = card.text ? card.text(c) : touch ? card.touch : card.pc;
    const raw = card.target(c);
    const P = 6;
    const t = raw && { x: raw.x - P, y: raw.y - P, w: raw.w + P * 2, h: raw.h + P * 2 };

    // ---- dim everything except the target
    g.save();
    g.beginPath();
    g.rect(0, 0, W, H);
    if (t) rr(g, t, 10);
    g.fillStyle = 'rgba(8,9,12,0.62)';
    g.fill('evenodd');
    if (t) {
      g.beginPath(); rr(g, t, 10);
      // a DARK RIM under the amber: photographed 2026-10-03, amber alone nearly vanished on the light Lab floor
      g.strokeStyle = 'rgba(20,22,27,0.85)'; g.lineWidth = 6; g.stroke();
      g.globalAlpha = 0.55 + 0.45 * Math.sin(pulse * 5);
      g.strokeStyle = COL.warn; g.lineWidth = 3; g.stroke();
      g.globalAlpha = 1;
    }

    // ---- the card: size it, then place it clear of the target
    const cw = Math.min(300, W - M * 2), pad = 12, lh = 17;
    g.font = font(13, 500);
    const lines = wrap(g, text, cw - pad * 2);
    const btnH = 36;
    const ch = pad + 18 + 6 + lines.length * lh + 10 + btnH + pad;
    const clampX = (x) => Math.max(M, Math.min(W - M - cw, x));
    const clampY = (y) => Math.max(M, Math.min(H - M - ch, y));
    const G = 22;   // room for the arrow
    let box = null;
    if (t) {
      const tcx = t.x + t.w / 2, tcy = t.y + t.h / 2;
      const cands = [
        { x: clampX(tcx - cw / 2), y: t.y + t.h + G },
        { x: clampX(tcx - cw / 2), y: t.y - G - ch },
        { x: t.x + t.w + G, y: clampY(tcy - ch / 2) },
        { x: t.x - G - cw, y: clampY(tcy - ch / 2) },
      ];
      box = cands.map((p) => ({ ...p, w: cw, h: ch }))
        .find((b) => b.x >= M && b.y >= M && b.x + b.w <= W - M && b.y + b.h <= H - M && !overlaps(b, t));
    }
    // no clean spot (a target that fills the screen) or no target: centre it
    if (!box) box = { x: Math.round(W / 2 - cw / 2), y: Math.round(H / 2 - ch / 2), w: cw, h: ch };

    // ---- arrow from the card to the target
    if (t && !overlaps(box, t)) {
      const a = edgePoint(box, { x: t.x + t.w / 2, y: t.y + t.h / 2 });
      const b = edgePoint(t, { x: box.x + box.w / 2, y: box.y + box.h / 2 });
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len > 8) {
        const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
        g.strokeStyle = COL.warn; g.fillStyle = COL.warn; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x - ux * 8, b.y - uy * 8); g.stroke();
        g.beginPath(); g.moveTo(b.x, b.y);
        g.lineTo(b.x - ux * 10 - uy * 6, b.y - uy * 10 + ux * 6);
        g.lineTo(b.x - ux * 10 + uy * 6, b.y - uy * 10 - ux * 6);
        g.closePath(); g.fill();
      }
    }

    g.beginPath(); rr(g, box, 10);
    g.fillStyle = 'rgba(20,22,27,0.97)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 1; g.stroke();
    g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillStyle = COL.warn; g.font = font(14, 700);
    g.fillText(card.title, box.x + pad, box.y + pad + 9);
    g.fillStyle = COL.hudText; g.font = font(13, 500);
    lines.forEach((ln, i) => g.fillText(ln, box.x + pad, box.y + pad + 18 + 6 + i * lh + lh / 2));

    // buttons: NEXT (or DONE) on the right, SKIP left of it, dots on the left
    const by = box.y + box.h - pad - btnH;
    const nextB = { x: box.x + box.w - pad - 84, y: by, w: 84, h: btnH };
    const skipB = { x: nextB.x - 8 - 66, y: by, w: 66, h: btnH };
    const lastCard = idx === deck.length - 1;
    g.beginPath(); rr(g, nextB, 8); g.fillStyle = 'rgba(76,194,160,0.95)'; g.fill();
    g.textAlign = 'center'; g.font = font(12.5, 700); g.fillStyle = '#0d1a16';
    g.fillText(lastCard ? 'DONE' : 'NEXT', nextB.x + nextB.w / 2, nextB.y + btnH / 2);
    if (!lastCard) {
      g.beginPath(); rr(g, skipB, 8); g.fillStyle = 'rgba(255,255,255,0.10)'; g.fill();
      g.fillStyle = COL.hudText; g.font = font(12, 600);
      g.fillText('SKIP', skipB.x + skipB.w / 2, skipB.y + btnH / 2);
    }
    const dotsW = skipB.x - box.x - pad - 6;
    const step = Math.min(11, dotsW / deck.length);
    for (let i = 0; i < deck.length; i++) {
      g.beginPath(); g.arc(box.x + pad + 4 + i * step, by + btnH / 2, i === idx ? 3.5 : 2.5, 0, Math.PI * 2);
      g.fillStyle = i === idx ? COL.warn : 'rgba(255,255,255,0.30)'; g.fill();
    }
    g.restore();
    last = { box, nextB, skipB: lastCard ? null : skipB, target: t };
  }

  // While open, EVERY tap is consumed. Only NEXT and SKIP do anything — a stray tap must not skip a card.
  function hit(p) {
    if (idx < 0) return false;
    if (last && inRect(p, last.nextB)) next();
    else if (last && inRect(p, last.skipB)) close();
    return true;
  }

  function key(k) {
    if (k === 'escape') close();
    else if (k === 'enter' || k === ' ' || k === 'arrowright') next();
  }

  return {
    draw, hit, key, close,
    open() { deck = CARDS; deckKind = null; idx = 0; pulse = 0; },
    // an event's rules walkthrough (RULES[kind]); false if there is none
    openRules(kind) { if (!RULES[kind]) return false; deck = RULES[kind]; deckKind = kind; idx = 0; pulse = 0; return true; },
    get kind() { return deckKind; },
    get active() { return idx >= 0; },
    get seen() { return seen; },
    get card() { return idx; },
    get last() { return last; },
    get count() { return deck.length; },
  };
}
