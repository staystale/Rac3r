// guide.js — HOW TO PLAY: a card overlay that POINTS AT the control it is talking about (user,
// 2026-10-03).
//
// CLAUDE.md §4: the first-run walkthrough is required, and it is UPDATED IN THE SAME TASK as any
// mechanic or control that changes it. The cards are data (CARDS below); add or edit a row,
// nothing else.
//
// Shape (approved): shown once per device after the level fly-in; the sim PAUSES while it is open
// (main.js); the screen dims with a hole cut round the target, the hole's rim pulses, and a card
// sits clear of it with an arrow. NEXT / SKIP / progress dots. Replayed from the "?" chip on the
// button row (or H on a keyboard).
//
// TARGETS ARE READ FROM hud.layout() AND input.pedalHits() EVERY FRAME — the same geometry the HUD
// draws and hit-tests with — so a highlight can never sit somewhere the control is not, in any
// orientation.
//
// While open, the guide consumes EVERY tap (main.js asks it first), so a tap on a card can never
// steer or press a pedal (CLAUDE.md §4: a tap on the HUD must never also reach the world).

import { COL } from "./world/colours.ts";
import { LEVEL } from "./world/state.ts";

const MARGIN = 12;
const KEY = 'carsim.guideSeen';

// target(scene) returns a screen rect {x,y,w,h} or null (a card with no target sits centred).
// scene = { L: hud layout, W, H, touch, pedals: input.pedalHits(), car screen rect,
// hint: PC key-hint rect }
const CARDS = [
  {
    title: 'STEER',
    touch: 'Drag anywhere on the left half of the screen to steer. '
      + 'Small thumb moves make small corrections.',
    pc: 'A / D or the arrow keys steer.',
    target: (scene) => scene.touch
      ? {
        x: MARGIN, y: scene.H * 0.42, w: scene.W * 0.55 - MARGIN * 2, h: scene.H * 0.58 - MARGIN,
      }
      : scene.hint,
  },
  {
    title: 'GAS + BRAKE',
    touch: 'Hold to press harder: a tap feathers, a hold floors it. '
      + 'Lift off the gas to catch a slide.',
    pc: 'W / S, or up / down. Hold to press harder; a tap feathers. '
      + 'Lift off the gas to catch a slide.',
    target: (scene) => scene.touch ? circles(scene.pedals, ['throttle', 'brake']) : scene.hint,
  },
  {
    title: 'HANDBRAKE + REVERSE',
    touch: 'HAND locks the rear wheels: flick it to start a slide. '
      + 'Hold R to reverse: it brakes first if you are still rolling.',
    pc: 'SPACE is the handbrake: flick it to start a slide. '
      + 'Hold Z to reverse: it brakes first if you are still rolling.',
    target: (scene) => scene.touch ? circles(scene.pedals, ['handbrake', 'reverse']) : scene.hint,
  },
  {
    // DRIVER AIDS (2026-10-03). Only some cars have them, so the card points at the chips when
    // this car does.
    title: 'ABS + TCS',
    text: (scene) => (scene.aids
      ? 'Driver aids. ABS stops the wheels locking when you brake. '
        + 'TCS stops wheelspin and catches slides. They flash when working. '
        + 'Tap to switch them off for the real challenge'
        + (scene.touch ? '.' : ' (or B / T).')
      : 'Some cars have driver aids: ABS stops the wheels locking, TCS stops wheelspin and '
        + 'catches slides. This one has none — it is all you.'),
    target: (scene) => scene.aids,
  },
  {
    title: 'SPEED + GEARS',
    text: (scene) => 'Speed, gear and revs. The gearbox is automatic; '
      + 'the bar flashes red at the shift point.'
      + (LEVEL.subtrack ? ' Below it: your lap time and best lap.' : ''),
    target: (scene) => LEVEL.subtrack ? union(scene.L.speed, scene.L.lap) : scene.L.speed,
  },
  {
    title: 'CAR + TRACK',
    text: () => 'Tap here to pick a car and a level. '
      + 'Each car drives differently: front, rear or four-wheel drive.',
    target: (scene) => scene.L.chip,
  },
  {
    title: 'RESTART / RESET / CLEAR',
    text: () => 'RESTART: back to the start, with cones, marks, worn ground, tyre heat and lap '
      + 'times reset. RESET: back '
      + (LEVEL.subtrack
        ? 'onto the track near where you left it.'
        : 'to where you were a couple of seconds ago.')
      + ' CLEAR: wipe the tyre marks.',
    target: (scene) => union(scene.L.restart, scene.L.reset, scene.L.clear),
  },
  {
    title: 'TYRES + SURFACES',
    text: () => 'Tyres start COLD: on tarmac they need warming up for full grip (off-road it '
      + 'makes no difference). Every surface grips differently, and snow, ice and water change '
      + 'as you drive over them. TUNE > TYRE HUD shows tyre temperatures.',
    target: (scene) => scene.carRect,
  },
  {
    title: 'DAMAGE + TRACK LIMITS',
    text: () => 'Big hits DAMAGE the car (pull, less grip and power, punctures); the little car '
      + 'by your speed shows where. RESET mends it; hits still go on the REPAIR bill. '
      + 'Cutting the track costs time or puts you back.',
    target: (scene) => scene.carRect,
  },
  {
    title: 'THAT\'S IT',
    text: (scene) => scene.menu
      ? 'Tap II to pause: restart, change track, or see this again under HOW TO PLAY.'
      : scene.touch
        ? 'Tap ? any time to see this again.'
        : 'Press H or click ? any time to see this again.',
    target: (scene) => scene.L.help,
  },
];

// EVENT RULES (user, 2026-10-05: "rules to events should be EXPLAINED the FIRST TIME you do them,
// and shown WALK-THROUGH style, if needed"). The same card overlay, pointing at the HUD that
// matters; opened by main.js when an event STARTS for the first time on this device (remembered per
// event in localStorage 'carsim.rulesSeen'), PAUSING the sim before the lights; replayed from the
// pause menu. key = main.js eventKind(): 'race' (VS AI, circuit), 'rx' (RX race), 'stage' (rally
// stage), 'highway' (VS AI on the endless road), 'endless' (the endless road, solo).
const NOTICE = (scene) => ({
  x: scene.W / 2 - Math.min(150, scene.W * 0.4), y: scene.H * 0.3 - 26,
  w: Math.min(300, scene.W * 0.8), h: 52,
});
const LIGHTS = (scene) => ({
  x: scene.W / 2 - Math.min(scene.W, scene.H) * 0.22, y: scene.H * 0.2,
  w: Math.min(scene.W, scene.H) * 0.44, h: Math.min(scene.W, scene.H) * 0.19,
});
export const RULES = {
  highway: [
    {
      title: 'HIGHWAY RACE',
      text: () => 'A ROLLING START: the game drives everyone in formation behind the red lights. '
        + 'When they go GREEN it is yours — floor it.',
      target: LIGHTS,
    },
    {
      title: 'NO LAPS, NO FINISH LINE',
      text: () => 'The road never ends. You win by GETTING AWAY: weave through the traffic and '
        + 'leave every rival off the BOTTOM of the screen.',
      target: (scene) => scene.carRect,
    },
    {
      title: 'THE COUNTDOWNS',
      text: () => 'All rivals off the bottom: PULLING AWAY counts down — hold them off and you '
        + 'win. Race freely while anyone is still with you. Only when you are LAST and even the '
        + 'slowest rival is off the TOP: CATCH THEM counts down (15 s) — get it back on screen '
        + 'or the race is over. Closing in on it holds the clock (CLOSING IN).',
      target: NOTICE,
    },
    {
      title: 'YOUR POSITION',
      text: () => 'Here: your place, the distance, and the gap to the car ahead (AHEAD) or your '
        + 'lead over the one behind (LEAD).',
      target: (scene) => scene.L.lap,
    },
    {
      title: 'TRAFFIC IS REAL',
      text: () => 'The traffic is not racing — it drives, changes lane (watch the indicators) '
        + 'and brakes. Hit it and you both take damage. A wreck stops with its hazards on.',
      target: (scene) => scene.carRect,
    },
  ],
  endless: [
    {
      title: 'HIGHWAY TO HULL',
      text: () => 'An endless motorway. Drive as far as you can — the DISTANCE and your BEST are '
        + 'here. Hull never gets closer.',
      target: (scene) => scene.L.lap,
    },
    {
      title: 'STAY ON IT',
      text: () => 'Go the wrong way, drop back, or wander far off the road and you are put back '
        + 'in the left lane. Running wide starts a countdown: get back on the road before it '
        + 'ends.',
      target: NOTICE,
    },
    {
      title: 'TRAFFIC IS REAL',
      text: () => 'The traffic drives, changes lane (watch the indicators) and brakes. '
        + 'Hit it and you both take damage.',
      target: (scene) => scene.carRect,
    },
    {
      title: 'SPEED CAMERAS',
      text: () => 'Every gantry has a camera. Go under one over 70 mph and you are CAUGHT: your '
        + 'speed and a fine (the faster, the bigger). Your fastest catch is kept.',
      target: (scene) => scene.carRect,
    },
  ],
  race: [
    {
      title: 'RACE START',
      text: () => 'Wait for the lights: three reds, then GREEN — go. Everyone is held until then.',
      target: LIGHTS,
    },
    {
      title: 'POSITION + LAPS',
      text: () => 'Your place and lap are here. The race ends once the top three are home — '
        + 'it always waits for you to finish.',
      target: (scene) => scene.L.lap,
    },
    {
      title: 'TRACK LIMITS',
      text: () => 'Cutting the track gains you nothing: a big cut puts you back where you left '
        + 'the road.',
      target: NOTICE,
    },
  ],
  rx: [
    {
      title: 'RALLYCROSS',
      text: () => 'A race of laps on mixed surfaces from the lights. '
        + 'Your lap and the JOKER status are here.',
      target: (scene) => scene.L.lap,
    },
    {
      title: 'THE JOKER LAP',
      text: () => 'Once in the race you MUST take the JOKER — the longer branch with the arrows. '
        + 'Miss it, or take it twice, and it costs +30 s.',
      target: (scene) => scene.L.lap,
    },
  ],
  stage: [
    {
      title: 'RALLY STAGE',
      text: () => 'Point to point against the clock, cars starting 30 s apart. '
        + 'Your time runs from the START line to the FINISH.',
      target: (scene) => scene.L.lap,
    },
    {
      title: 'CUTS COST TIME',
      text: () => 'Cutting corners off the road adds a time penalty to your stage time.',
      target: NOTICE,
    },
  ],
};
const RULES_KEY = 'carsim.rulesSeen';
export function rulesSeen(kind) {
  try {
    return (JSON.parse(localStorage.getItem(RULES_KEY) || '{}'))[kind] === 1;
  } catch { return false; }
}
function markRules(kind) {
  try {
    const seenKinds = JSON.parse(localStorage.getItem(RULES_KEY) || '{}');
    seenKinds[kind] = 1;
    localStorage.setItem(RULES_KEY, JSON.stringify(seenKinds));
  } catch { /* fine */ }
}

function union(...rects) {
  const left = Math.min(...rects.map((rect) => rect.x)),
    top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.w)),
    bottom = Math.max(...rects.map((rect) => rect.y + rect.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}
function circles(pedals, names) {
  return union(...pedals.filter((pedal) => names.includes(pedal.name)).map((pedal) => ({
    x: pedal.x - pedal.r, y: pedal.y - pedal.r, w: pedal.r * 2, h: pedal.r * 2,
  })));
}
const inRect = (point, rect) => rect && point.x >= rect.x && point.x <= rect.x + rect.w
  && point.y >= rect.y && point.y <= rect.y + rect.h;
const overlaps = (first, second) => first.x < second.x + second.w && second.x < first.x + first.w
  && first.y < second.y + second.h && second.y < first.y + first.h;

// where a ray from rect's centre towards point target leaves rect
function edgePoint(rect, target) {
  const midX = rect.x + rect.w / 2, midY = rect.y + rect.h / 2,
    dx = target.x - midX, dy = target.y - midY;
  const scale = Math.min(
    dx ? (rect.w / 2) / Math.abs(dx) : Infinity,
    dy ? (rect.h / 2) / Math.abs(dy) : Infinity,
  );
  return { x: midX + dx * scale, y: midY + dy * scale };
}

function roundedRectPath(ctx, rect, rad) {
  ctx.moveTo(rect.x + rad, rect.y);
  ctx.arcTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, rad);
  ctx.arcTo(rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h, rad);
  ctx.arcTo(rect.x, rect.y + rect.h, rect.x, rect.y, rad);
  ctx.arcTo(rect.x, rect.y, rect.x + rect.w, rect.y, rad);
  ctx.closePath();
}

function wrap(ctx, text, maxW) {
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    const trial = line ? line + ' ' + word : word;
    if (line && ctx.measureText(trial).width > maxW) {
      out.push(line);
      line = word;
    } else line = trial;
  }
  if (line) out.push(line);
  return out;
}

export function createGuide() {
  let seen = false;
  try {
    seen = localStorage.getItem(KEY) === '1';
  } catch { /* no storage: shows every load, which is harmless */ }
  let idx = -1;                 // -1 = closed
  let pulse = 0;                // wall clock (rule 5)
  // the geometry drawn last frame — hit() tests exactly what was drawn
  let last = null;
  let deck = CARDS, deckKind = null;   // HOW TO PLAY, or an event's RULES (openRules)

  function close() {
    idx = -1;
    last = null;
    if (deckKind) markRules(deckKind);
    else {
      seen = true;
      try { localStorage.setItem(KEY, '1'); } catch { /* fine */ }
    }
    deck = CARDS; deckKind = null;
  }
  const next = () => { if (++idx >= deck.length) close(); };

  function draw(ctx, game, layout, viewW, viewH, wallDt, renderer) {
    if (idx < 0) return;
    pulse += wallDt;
    const touch = game.input.isTouch();
    // the car on screen, for the tyres card; at least a thumb's width so the hole reads as a hole
    const half = Math.max(30, 3 * renderer.PPM);
    const ccx = renderer.sx(game.car.x), ccy = renderer.sy(game.car.y);
    const font = (size, weight = 600) =>
      `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    ctx.font = font(11);
    const hintW = ctx.measureText(
      'W/S drive   A/D steer   SPACE handbrake   B abs   T tcs   R reset   H help',
    ).width;
    const aids = game.car.spec.aids;
    const aidRect = aids
      ? [aids.abs && layout.absChip, aids.tcs && layout.tcsChip].filter(Boolean)
      : [];
    const scene = {
      L: layout, W: viewW, H: viewH, touch, pedals: game.input.pedalHits(viewW, viewH),
      carRect: { x: ccx - half, y: ccy - half, w: half * 2, h: half * 2 },
      hint: { x: MARGIN, y: viewH - MARGIN - 18, w: hintW, h: 20 },
      aids: aidRect.length ? union(...aidRect) : null,
      menu: !!game.menuMode,
    };
    const card = deck[idx];
    const text = card.text ? card.text(scene) : touch ? card.touch : card.pc;
    const raw = card.target(scene);
    const reach = 6;
    const target = raw && {
      x: raw.x - reach, y: raw.y - reach, w: raw.w + reach * 2, h: raw.h + reach * 2,
    };

    // ---- dim everything except the target
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, viewW, viewH);
    if (target) roundedRectPath(ctx, target, 10);
    ctx.fillStyle = 'rgba(8,9,12,0.62)';
    ctx.fill('evenodd');
    if (target) {
      ctx.beginPath();
      roundedRectPath(ctx, target, 10);
      // a DARK RIM under the amber: photographed 2026-10-03, amber alone nearly vanished on the
      // light Lab floor
      ctx.strokeStyle = 'rgba(20,22,27,0.85)';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(pulse * 5);
      ctx.strokeStyle = COL.warn;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ---- the card: size it, then place it clear of the target
    const cardW = Math.min(300, viewW - MARGIN * 2), pad = 12, lineH = 17;
    ctx.font = font(13, 500);
    const lines = wrap(ctx, text, cardW - pad * 2);
    const btnH = 36;
    const cardH = pad + 18 + 6 + lines.length * lineH + 10 + btnH + pad;
    const clampX = (x) => Math.max(MARGIN, Math.min(viewW - MARGIN - cardW, x));
    const clampY = (y) => Math.max(MARGIN, Math.min(viewH - MARGIN - cardH, y));
    const gap = 22;   // room for the arrow
    let box = null;
    if (target) {
      const tcx = target.x + target.w / 2, tcy = target.y + target.h / 2;
      const cands = [
        { x: clampX(tcx - cardW / 2), y: target.y + target.h + gap },
        { x: clampX(tcx - cardW / 2), y: target.y - gap - cardH },
        { x: target.x + target.w + gap, y: clampY(tcy - cardH / 2) },
        { x: target.x - gap - cardW, y: clampY(tcy - cardH / 2) },
      ];
      box = cands.map((cand) => ({ ...cand, w: cardW, h: cardH }))
        .find((spot) => spot.x >= MARGIN && spot.y >= MARGIN
          && spot.x + spot.w <= viewW - MARGIN && spot.y + spot.h <= viewH - MARGIN
          && !overlaps(spot, target));
    }
    // no clean spot (a target that fills the screen) or no target: centre it
    if (!box) box = {
      x: Math.round(viewW / 2 - cardW / 2), y: Math.round(viewH / 2 - cardH / 2),
      w: cardW, h: cardH,
    };

    // ---- arrow from the card to the target
    if (target && !overlaps(box, target)) {
      const from = edgePoint(box, { x: target.x + target.w / 2, y: target.y + target.h / 2 });
      const tip = edgePoint(target, { x: box.x + box.w / 2, y: box.y + box.h / 2 });
      const len = Math.hypot(tip.x - from.x, tip.y - from.y);
      if (len > 8) {
        const dirX = (tip.x - from.x) / len, dirY = (tip.y - from.y) / len;
        ctx.strokeStyle = COL.warn;
        ctx.fillStyle = COL.warn;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(tip.x - dirX * 8, tip.y - dirY * 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tip.x, tip.y);
        ctx.lineTo(tip.x - dirX * 10 - dirY * 6, tip.y - dirY * 10 + dirX * 6);
        ctx.lineTo(tip.x - dirX * 10 + dirY * 6, tip.y - dirY * 10 - dirX * 6);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.beginPath();
    roundedRectPath(ctx, box, 10);
    ctx.fillStyle = 'rgba(20,22,27,0.97)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = COL.warn;
    ctx.font = font(14, 700);
    ctx.fillText(card.title, box.x + pad, box.y + pad + 9);
    ctx.fillStyle = COL.hudText;
    ctx.font = font(13, 500);
    lines.forEach((line, i) => ctx.fillText(
      line, box.x + pad, box.y + pad + 18 + 6 + i * lineH + lineH / 2,
    ));

    // buttons: NEXT (or DONE) on the right, SKIP left of it, dots on the left
    const btnY = box.y + box.h - pad - btnH;
    const nextB = { x: box.x + box.w - pad - 84, y: btnY, w: 84, h: btnH };
    const skipB = { x: nextB.x - 8 - 66, y: btnY, w: 66, h: btnH };
    const lastCard = idx === deck.length - 1;
    ctx.beginPath();
    roundedRectPath(ctx, nextB, 8);
    ctx.fillStyle = 'rgba(76,194,160,0.95)';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = font(12.5, 700);
    ctx.fillStyle = '#0d1a16';
    ctx.fillText(lastCard ? 'DONE' : 'NEXT', nextB.x + nextB.w / 2, nextB.y + btnH / 2);
    if (!lastCard) {
      ctx.beginPath();
      roundedRectPath(ctx, skipB, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fill();
      ctx.fillStyle = COL.hudText;
      ctx.font = font(12, 600);
      ctx.fillText('SKIP', skipB.x + skipB.w / 2, skipB.y + btnH / 2);
    }
    const dotsW = skipB.x - box.x - pad - 6;
    const step = Math.min(11, dotsW / deck.length);
    for (let i = 0; i < deck.length; i++) {
      ctx.beginPath();
      ctx.arc(box.x + pad + 4 + i * step, btnY + btnH / 2, i === idx ? 3.5 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = i === idx ? COL.warn : 'rgba(255,255,255,0.30)';
      ctx.fill();
    }
    ctx.restore();
    last = { box, nextB, skipB: lastCard ? null : skipB, target };
  }

  // While open, EVERY tap is consumed. Only NEXT and SKIP do anything — a stray tap must not skip
  // a card.
  function hit(point) {
    if (idx < 0) return false;
    if (last && inRect(point, last.nextB)) next();
    else if (last && inRect(point, last.skipB)) close();
    return true;
  }

  function key(name) {
    if (name === 'escape') close();
    else if (name === 'enter' || name === ' ' || name === 'arrowright') next();
  }

  return {
    draw, hit, key, close,
    open() { deck = CARDS; deckKind = null; idx = 0; pulse = 0; },
    // an event's rules walkthrough (RULES[kind]); false if there is none
    openRules(kind) {
      if (!RULES[kind]) return false;
      deck = RULES[kind];
      deckKind = kind;
      idx = 0;
      pulse = 0;
      return true;
    },
    get kind() { return deckKind; },
    get active() { return idx >= 0; },
    get seen() { return seen; },
    get card() { return idx; },
    get last() { return last; },
    get count() { return deck.length; },
  };
}
