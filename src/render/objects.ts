// the OBJECTS layer of render.ts (phase 4 of the render.js split): pixel objects (cones, tyres),
// tape and debris. Moved verbatim.
import { parkMiller } from "../core/random.ts";
import { SPRITE_PPM } from "./shared.ts";
import type { Cam, Chip, RenderCone, TapeGame, View } from "./types.ts";
import { shade } from "../render.ts";   // read only at draw time (no load-time cycle)

// what createObjects destructures from the renderer and the particles
interface ObjectsHelpers {
  PPMz: () => number;
  toScreenX: (wx: number) => number;
  toScreenY: (wy: number) => number;
  roundRect: (
    g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number
  ) => void;
  chips: Chip[];
  MAX_CHIPS: number;
}

// a cached pixel sprite: its canvas and its size in px
interface ObjSprite {
  c: HTMLCanvasElement;
  size: number;
}

export function createObjects(view: View, cam: Cam, helpers: ObjectsHelpers) {
  const {
    PPMz, toScreenX, toScreenY, roundRect, chips, MAX_CHIPS,
  } = helpers;

  // ---------------------------------------------------------------- cones
  //
  // STANDING and TOPPLED must be unmistakable at a glance and at phone size (§4: if the player
  // cannot read it, it did not happen). Standing reads as concentric rings — the cone seen from
  // directly above. Toppled reads as a LONG shape lying in the direction it was hit, which is a
  // completely different silhouette rather than the same blob in a different colour.
  // ---------------------------------------------------------------- PIXEL OBJECTS (cones, tyres)
  // Generated pixel sprites, cached, drawn at the car's art scale (SPRITE_PPM) with smoothing off.
  // Round things are PIXEL-round — rasterised square by square (pdisc), never an anti-aliased arc.
  const objCache = new Map<string, ObjSprite>();
  function objSprite(
    key: string, size: number, paint: (g: CanvasRenderingContext2D, n: number) => void
  ): ObjSprite {
    let sprite = objCache.get(key);
    if (!sprite) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      // ! : a fresh canvas always has a 2d context
      paint(canvas.getContext('2d')!, size);
      sprite = { c: canvas, size };
      objCache.set(key, sprite);
    }
    return sprite;
  }
  // a pixel disc of radius rr centred in a size x size sprite (pixel centres inside the circle)
  function pdisc(ctx: CanvasRenderingContext2D, size: number, radius: number, col: string) {
    ctx.fillStyle = col; const mid = (size - 1) / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if ((x - mid) ** 2 + (y
      - mid) ** 2 <= radius * radius) ctx.fillRect(x, y, 1, 1);
  }
  function pixelObjectSprite(cone: RenderCone): ObjSprite | null {
    const mode = cone.mode || (cone.kind === 'tyrestack' ? 'stack' : cone.kind === 'tyre' ? 'flat'
      : 'cone');
    if (cone.kind === 'cone') {
      // lying on its side, tip to +x
      if (cone.down > 0.5) return objSprite('cone-down', 11, (ctx) => {
        ctx.fillStyle = '#b8410c'; ctx.fillRect(0, 2, 2, 7);                      // base
        for (let x = 2; x < 11; x++) {
          const half = Math.max(1, Math.round(3.4 - (x - 2) * 0.36));
          ctx.fillStyle = '#f26a1b';
          ctx.fillRect(x, 5 - half, 1, half * 2 + 1);
        }
        // reflective band
        ctx.fillStyle = '#f4f4f6'; ctx.fillRect(5, 3, 2, 5);
        ctx.fillStyle = '#ff9a55'; ctx.fillRect(2, 4, 7, 1);                       // highlight
      });
      // top-down: base, band, tip
      return objSprite('cone-up', 9, (ctx, size) => {
        pdisc(ctx, size, 4.4, '#b8410c');
        pdisc(ctx, size, 3.6, '#f26a1b');
        pdisc(ctx, size, 2.4, '#f4f4f6');
        pdisc(ctx, size, 1.4, '#f26a1b');
        ctx.fillStyle = '#ffb27a'; ctx.fillRect(4, 4, 1, 1);
      });
    }
    if (cone.kind === 'tyre' || cone.kind === 'tyrestack') {
      // on its tread
      if (mode === 'roll' || mode === 'flip' || mode === 'wobble') return objSprite('tyre-side',
        15, (ctx) => {
        ctx.fillStyle = '#16171c'; ctx.fillRect(0, 5, 15, 5);
        ctx.fillStyle = '#3a3d47'; for (let x = 1; x < 15; x += 3) ctx.fillRect(x, 5, 1, 5);
        ctx.fillStyle = '#6b6f7a'; ctx.fillRect(4, 6, 7, 1);
      });
      const stack = mode === 'stack';
      return objSprite(stack ? 'tyre-stack' : 'tyre-flat', 17, (ctx, size) => {
        pdisc(ctx, size, stack ? 8.2 : 7.2, '#0f1014');
        pdisc(ctx, size, stack ? 7.2 : 6.3, '#2a2c33');
        pdisc(ctx, size, stack ? 5.0 : 4.2, '#6b6f7a');
        pdisc(ctx, size, stack ? 3.6 : 3.0, '#1d1f25');
        // top ring glint, sponsor fleck
        if (stack) {
          ctx.fillStyle = '#4a4e58';
          for (let x = 4; x < 13; x++) ctx.fillRect(x, 2, 1, 1);
          ctx.fillStyle = '#f2c94c';
          ctx.fillRect(12, 6, 1, 2);
        }
        // the hole: ground shows through
        ctx.clearRect(7, 7, 3, 3);
      });
    }
    return null;
  }
  function drawPixelObject(cone: RenderCone) {
    const sprite = pixelObjectSprite(cone);
    if (!sprite) return false;
    const unit = PPMz() / SPRITE_PPM;
    view.ctx.rotate(cone.ang || 0);
    view.ctx.scale(unit, unit);
    view.ctx.drawImage(sprite.c, -sprite.size / 2, -sprite.size / 2);
    return true;
  }

  // RALLY TAPE (cones.js sections): red / white between its posts; a SNAPPED section hangs as two
  // short loose ends; tape STUCK to a car trails behind it as a fluttering streamer (wall-clock
  // flutter, fades after ~14 s)
  function drawTape(game: TapeGame) {
    const tapes = game.cones.tapes; if (!tapes || !tapes.length) return;
    const ppm = PPMz(), lineWidth = Math.max(1.5, 0.12 * ppm);
    view.ctx.save(); view.ctx.lineWidth = lineWidth; view.ctx.lineCap = 'butt';
    // TAPE PUFFS (cones.js: a section gone after its second hit; and a streamer coming off a car):
    // a burst of red / white flecks
    const puff = (x: number, y: number, vx: number, vy: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * 6.2832, speed = 0.8 + Math.random() * 3.2;
        if (chips.length >= MAX_CHIPS) chips.shift();
        chips.push({ x: x + (Math.random() - 0.5) * 0.6, y: y + (Math.random() - 0.5) * 0.6,
          vx: vx + Math.cos(angle) * speed, vy: vy + Math.sin(angle) * speed, age: 0, life: 0.5
          + Math.random() * 1.1, col: Math.random() < 0.5 ? '#e23b2e' : '#f2f2f2', sz: 2 });
      }
    };
    const puffQueue = game.cones.tapePuffs;
    if (puffQueue && puffQueue.length) {
      for (const burst of puffQueue) puff(burst.x, burst.y, burst.vx, burst.vy, 22);
      puffQueue.length = 0;
    }
    for (const sct of tapes) {
      if (sct.gone) continue;
      const startX = toScreenX(sct.a.x), startY = toScreenY(sct.a.y), endX = toScreenX(sct.b.x),
        endY = toScreenY(sct.b.y);
      if ((startX < -40 && endX < -40) || (startX > view.W + 40 && endX > view.W + 40)
        || (startY < -40 && endY < -40) || (startY > view.H + 40 && endY > view.H + 40)) continue;
      const seg = (fromX: number, fromY: number, toX: number, toY: number) => {
        view.ctx.setLineDash([0.5 * ppm, 0.5 * ppm]);
        view.ctx.strokeStyle = '#e23b2e';
        view.ctx.beginPath();
        view.ctx.moveTo(fromX, fromY);
        view.ctx.lineTo(toX, toY);
        view.ctx.stroke();
        view.ctx.lineDashOffset = 0.5 * ppm;
        view.ctx.strokeStyle = '#f2f2f2';
        view.ctx.beginPath();
        view.ctx.moveTo(fromX, fromY);
        view.ctx.lineTo(toX, toY);
        view.ctx.stroke();
        view.ctx.lineDashOffset = 0;
        };
      if (!sct.broken) seg(startX, startY, endX, endY);
      else {
        const dx = endX - startX, dy = endY - startY, span = Math.hypot(dx, dy) || 1,
          tail = Math.min(span * 0.35, 1.3 * ppm);
        seg(startX, startY, startX + dx / span * tail + dy / span * tail * 0.3, startY
          + dy / span * tail - dx / span * tail * 0.3);
        seg(endX, endY, endX - dx / span * tail + dy / span * tail * 0.3, endY - dy / span * tail
          - dx / span * tail * 0.3);
        }
    }
    view.ctx.setLineDash([]);
    const now = performance.now() / 1000, clock = game.cones.clock || 0;
    for (const car of [game.car, ...(game.ai || []).map((rival) => rival.car)]) {
      // null = reset (the car was teleported): no puff, just forget the count
      if (!car.streamers) { car._stN = 0; continue; }
      car.streamers = car.streamers.filter((streamer) => clock - streamer.born < 14);
      // a streamer lost since last frame (timed out, or knocked off by an impact in damage.js)
      // goes up in a puff behind the car
      if (car._stN != null && car.streamers.length < car._stN) {
        const ch0 = Math.cos(car.heading), sh0 = Math.sin(car.heading);
        for (let index = car.streamers.length; index < car._stN; index++) puff(car.x
          - ch0 * car.spec.len * 0.5, car.y - sh0 * car.spec.len * 0.5, car.vx * 0.5,
          car.vy * 0.5, 12);
        }
      car._stN = car.streamers.length;
      const cosHeading = Math.cos(car.heading), sinHeading = Math.sin(car.heading),
        speed = Math.hypot(car.vx, car.vy);
      const bxW = car.x - cosHeading * car.spec.len * 0.45, byW = car.y
        - sinHeading * car.spec.len * 0.45;
      car.streamers.forEach((streamer, index) => {
        // trails BEHIND the direction of travel (or the car's back when slow), fluttering
        const dirx = speed > 1 ? -car.vx / speed : -cosHeading, diry = speed > 1 ? -car.vy / speed
          : -sinHeading, side = (index - 1) * 0.35;
        view.ctx.beginPath();
        view.ctx.moveTo(toScreenX(bxW - sinHeading * side), toScreenY(byW + cosHeading * side));
        for (let step = 1; step <= 6; step++) {
          const along = step / 6, flutter = Math.sin(now * 14 + streamer.phase
            + along * 5) * 0.35 * along;
          view.ctx.lineTo(toScreenX(bxW - sinHeading * side + dirx * streamer.len * along
            - diry * flutter), toScreenY(byW + cosHeading * side + diry * streamer.len * along
            + dirx * flutter));
          }
        // streamers drawn thicker (photographed thin)
        view.ctx.lineWidth = lineWidth * 1.8;
        view.ctx.setLineDash([0.5 * ppm, 0.5 * ppm]);
        view.ctx.strokeStyle = '#e23b2e';
        view.ctx.stroke();
        view.ctx.lineDashOffset = 0.5 * ppm;
        view.ctx.strokeStyle = '#f2f2f2';
        view.ctx.stroke();
        view.ctx.lineDashOffset = 0;
        view.ctx.setLineDash([]);
        view.ctx.lineWidth = lineWidth;
      });
    }
    view.ctx.restore();
  }
  // ROADSIDE DEBRIS (cones.js DEBRIS): top-down squares, rotated with the object; broken ones are
  // a scatter of bits (seeded by home)
  const DEBRIS_KINDS = new Set(['pallet', 'box', 'crate', 'bin', 'sandbag', 'barrel', 'exhaust',
    'bumper', 'tarp', 'splinters', 'cardboard', 'sand', 'fluff']);
  function drawDebris(cone: RenderCone) {
    const ppm = PPMz(), rect = (x: number, y: number, width: number, height: number,
      col: string) => {
      view.ctx.fillStyle = col;
      view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
    };
    const shadow = (width: number, height: number) => {
      view.ctx.fillStyle = 'rgba(10,12,16,0.30)';
      view.ctx.fillRect((-width / 2 + 0.15) * ppm, (-height / 2 + 0.25) * ppm, width * ppm,
        height * ppm);
    };
    view.ctx.rotate(cone.ang || 0);
    switch (cone.kind) {
      case 'pallet': shadow(1.2, 1.0);
      rect(-0.6, -0.5, 1.2, 1.0, '#8a6a43');
      for (let plank = 0; plank < 4; plank++) rect(-0.6, -0.42 + plank * 0.26, 1.2, 0.08,
        '#5e4529');
      break;
      case 'box': shadow(0.8, 0.6);
      rect(-0.4, -0.3, 0.8, 0.6, '#b8925e');
      rect(-0.4, -0.04, 0.8, 0.08, '#d9c08a');
      break;
      case 'crate': shadow(1.0, 1.0);
      rect(-0.5, -0.5, 1.0, 1.0, '#7d5a32');
      rect(-0.42, -0.42, 0.84, 0.84, '#9b7444');
      rect(-0.5, -0.05, 1.0, 0.1, '#5e4529');
      rect(-0.05, -0.5, 0.1, 1.0, '#5e4529');
      break;
      case 'bin': shadow(0.7, 0.8);
      rect(-0.35, -0.4, 0.7, 0.8, cone.col || '#2f5d3a');
      rect(-0.35, -0.4, 0.7, 0.14, '#1f3d27');
      break;
      case 'sandbag': shadow(0.9, 0.5);
      rect(-0.45, -0.25, 0.9, 0.5, '#a89470');
      rect(-0.45, -0.25, 0.9, 0.08, '#c4b28c');
      break;
      case 'barrel': shadow(0.8, 0.8);
      rect(-0.4, -0.4, 0.8, 0.8, cone.col || '#2b56b5');
      rect(-0.25, -0.25, 0.5, 0.5, shade(cone.col || '#2b56b5', 0.8));
      rect(-0.07, -0.07, 0.14, 0.14, '#1c1d20');
      break;
      case 'exhaust': shadow(1.0, 0.25);
      rect(-0.5, -0.07, 0.8, 0.14, '#6a7077');
      rect(0.3, -0.13, 0.25, 0.26, '#4a4f57');
      break;
      case 'bumper': shadow(1.6, 0.3);
      rect(-0.8, -0.15, 1.6, 0.3, cone.col || '#c8302c');
      rect(-0.8, -0.15, 1.6, 0.07, 'rgba(255,255,255,0.3)');
      break;
      case 'tarp': rect(-0.9, -0.7, 1.8, 1.4, cone.col || '#2f6fb0');
      rect(-0.9, -0.2, 1.8, 0.12, 'rgba(255,255,255,0.18)');
      rect(0.2, -0.7, 0.12, 1.4, 'rgba(0,0,0,0.15)');
      break;
      default: {   // broken: a scatter of bits in its colour
        const rand = parkMiller(Math.floor(Math.abs((cone.hx || 0) * 73.1 + (cone.hy
          || 0) * 19.7)) % 9973 + 1);
        const cols = cone.kind === 'fluff' ? ['#f6f5ef', '#dcdbd2'] : cone.kind === 'sand'
          ? ['#c4b28c', '#a89470'] : cone.kind === 'cardboard' ? ['#b8925e', '#d9c08a']
          : ['#8a6a43', '#5e4529'];
        for (let bit = 0; bit < 14; bit++) {
          const angle = rand() * 6.283, radius = Math.sqrt(rand()) * 1.2, width = 0.12
            + rand() * 0.3, height = cone.kind === 'splinters' ? 0.08 : width;
          rect(Math.cos(angle) * radius - width / 2, Math.sin(angle) * radius - height / 2, width,
            height, cols[bit % 2]);
        }
      }
    }
  }
  function drawCones(cones: RenderCone[]) {
    for (const cone of cones) {
      const screenX = toScreenX(cone.x), screenY = toScreenY(cone.y);
      if (screenX < -60 || screenX > view.W + 60 || screenY < -60 || screenY > view.H
        + 60) continue;
      const down = cone.down;                       // 0 = upright, 1 = flat

      view.ctx.save();
      view.ctx.translate(screenX, screenY);
      if (cone.kind === 'bale' || cone.kind === 'straw') {
        const rect = (x: number, y: number, width: number, height: number, col: string) => {
          view.ctx.fillStyle = col;
          view.ctx.fillRect(x * PPMz(), y * PPMz(), width * PPMz(), height * PPMz());
        };
        view.ctx.rotate(cone.ang || 0);
        if (cone.kind === 'bale') {
          // ROUND HAY BALE from the top: straw square, darker spiral ring (squares — the pixel
          // rule)
          view.ctx.fillStyle = 'rgba(10,12,16,0.30)';
          view.ctx.fillRect(-0.8 * PPMz() + 0.3 * PPMz(), -0.8 * PPMz() + 0.45 * PPMz(),
            1.6 * PPMz(), 1.6 * PPMz());
          rect(-0.8, -0.8, 1.6, 1.6, '#c9a85a');
          rect(-0.55, -0.55, 1.1, 1.1, '#b48f45');
          rect(-0.3, -0.3, 0.6, 0.6, '#d8bb6e');
          rect(-0.08, -0.08, 0.16, 0.16, '#9a7836');
        } else {
          // BURST STRAW: a spread of loose straw squares, the same every frame (seeded by its home
          // position)
          const rand = parkMiller(Math.floor(Math.abs(cone.hx * 73.1 + cone.hy * 19.7)) % 9973
            + 1);
          for (let bit = 0; bit < 26; bit++) {
            const angle = rand() * 6.283, radius = Math.sqrt(rand()) * 1.8, width = 0.2
              + rand() * 0.35;
            rect(Math.cos(angle) * radius - width / 2, Math.sin(angle) * radius - width / 2,
              width, width, bit % 3 ? '#cfae62' : '#a8873f');
          }
        }
        view.ctx.restore(); continue;
      }
      if (cone.kind === 'sheep' || cone.kind === 'cow') {
        // SHEEP / COW (S-C: loose objects, cones.js; the old field look): a body square, a head
        // square at +x, a shadow. A TIPPED cow lies
        // on its side: four dark leg squares out, the head flat
        const ppm = PPMz(), rect = (x: number, y: number, width: number, height: number,
          col: string) => {
          view.ctx.fillStyle = col;
          view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
        };
        view.ctx.rotate(cone.ang || 0);
        if (cone.kind === 'cow' && cone.tipped) {
          rect(-0.9, -0.2, 2, 0.9, 'rgba(10,12,16,0.3)');
          rect(-1.1, -0.45, 2, 0.85, '#f0eee8');
          rect(-0.6, -0.45, 0.7, 0.4, '#1c1d20');
          for (const legX of [-0.9, -0.5, 0.15, 0.55]) rect(legX, 0.4, 0.2, 0.55, '#1c1d20');
          rect(0.9, -0.3, 0.55, 0.55, '#1c1d20');
          }
        else if (cone.kind === 'cow') {
          rect(-0.9, -0.35, 2, 1, 'rgba(10,12,16,0.3)');
          rect(-1.1, -0.5, 2, 1, '#f0eee8');
          rect(-0.7, -0.5, 0.6, 0.5, '#1c1d20');
          rect(0.2, 0, 0.5, 0.5, '#1c1d20');
          rect(0.9, -0.3, 0.55, 0.6, '#1c1d20');
        }
        else {
          rect(-0.45, -0.2, 1, 0.7, 'rgba(10,12,16,0.3)');
          rect(-0.55, -0.35, 1, 0.7, '#ecebe4');
          rect(-0.45, -0.25, 0.8, 0.5, '#f7f6f0');
          rect(0.42, -0.2, 0.32, 0.4, '#2a2a2c');
        }
        view.ctx.restore(); continue;
      }
      if (DEBRIS_KINDS.has(cone.kind)) { drawDebris(cone); view.ctx.restore(); continue; }
      if (cone.kind === 'tapepost') {
        // a tape POST: a dark stake (upright) or lying (knocked)
        const ppm = PPMz(); view.ctx.rotate(cone.ang || 0); view.ctx.fillStyle = '#3a2d21';
        if (down < 0.5) view.ctx.fillRect(-0.12 * ppm, -0.12 * ppm, 0.24 * ppm, 0.24 * ppm);
        else view.ctx.fillRect(-0.6 * ppm, -0.06 * ppm, 1.2 * ppm, 0.12 * ppm);
        view.ctx.restore(); continue;
      }
      if (cone.kind === 'chevron' || cone.kind === 'flag') {
        // a knockable CHEVRON board / FLAG (cones.js): upright as the old prop; once knocked (down
        // > 0.5) lying flat — the chevron face up
        // and darker, the flag pole down with its cloth crumpled beside it
        const ppm = PPMz(), rect = (x: number, y: number, width: number, height: number,
          col: string) => {
          view.ctx.fillStyle = col;
          view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
        };
        view.ctx.rotate(cone.ang || 0);
        if (cone.kind === 'chevron') {
          view.ctx.scale(1.6, 1.6);
          if (down < 0.5) {
            view.ctx.fillStyle = 'rgba(10,12,16,0.32)';
            view.ctx.fillRect(-1.6 * ppm + 0.3 * ppm, -0.25 * ppm + 0.5 * ppm, 3.2 * ppm,
              0.5 * ppm);
            rect(-1.6, -0.25, 3.2, 0.5, '#15171c');
            for (let col = 0; col < 3; col++) {
              rect(-1.25 + col * 1.0, -0.2, 0.25, 0.15, '#f2c21b');
              rect(-1.0 + col * 1.0, -0.075, 0.25, 0.15, '#f2c21b');
              rect(-1.25 + col * 1.0, 0.05, 0.25, 0.15, '#f2c21b');
            }
            }
          else {
            rect(-1.6, -0.5, 3.2, 1.0, '#15171c');
            for (let col = 0; col < 3; col++) {
              rect(-1.25 + col * 1.0, -0.4, 0.3, 0.3, '#b08c14');
              rect(-0.95 + col * 1.0, -0.15, 0.3, 0.3, '#b08c14');
              rect(-1.25 + col * 1.0, 0.1, 0.3, 0.3, '#b08c14');
            }
            // face up, its two posts
            rect(-1.5, 0.5, 0.15, 0.6, '#5a4632'); rect(1.35, 0.5, 0.15, 0.6, '#5a4632'); }
        } else {
          if (down < 0.5) {
            view.ctx.fillStyle = 'rgba(10,12,16,0.28)';
            view.ctx.fillRect(0.2 * ppm, 0.1 * ppm, 1.8 * ppm, 0.6 * ppm);
            rect(-0.15, -0.15, 0.3, 0.3, '#3a3f47');
            rect(0.15, -0.55, 1.3, 0.75, cone.col || '#c8302c');
            rect(0.15, -0.55, 1.3, 0.12, 'rgba(255,255,255,0.35)');
            }
          // pole down, cloth crumpled
          else {
            rect(-1.1, -0.06, 2.2, 0.12, '#5a5f68');
            rect(0.6, 0.06, 0.8, 0.5, cone.col || '#c8302c');
            rect(0.9, 0.2, 0.5, 0.3, shade(cone.col || '#c8302c', 0.7));
          }
        }
        view.ctx.restore(); continue;
      }
      if (drawPixelObject(cone)) { view.ctx.restore(); continue; }

      if (cone.kind === 'banger') {
        const ppm = PPMz();
        view.ctx.rotate(cone.ang);
        // Cast shadow
        view.ctx.fillStyle = 'rgba(10,12,16,0.44)';
        roundRect(view.ctx, -2.1 * ppm + 3, -1.0 * ppm + 4, 4.2 * ppm, 2.0 * ppm, 5);
        view.ctx.fill();
        // Dented banger body with primer & rust patches
        view.ctx.fillStyle = cone.paint || '#7c342a';
        roundRect(view.ctx, -2.1 * ppm, -1.0 * ppm, 4.2 * ppm, 2.0 * ppm, 4); view.ctx.fill();
        view.ctx.strokeStyle = '#181a1f'; view.ctx.lineWidth = 1.2; view.ctx.stroke();
        // Heavy triangular welded iron roof fin with driver number
        view.ctx.fillStyle = '#1e2129';
        view.ctx.fillRect(-0.4 * ppm, -0.15 * ppm, 1.4 * ppm, 0.3 * ppm);
        view.ctx.fillStyle = '#f8fafc';
        view.ctx.font = `900 ${Math.round(1.05 * ppm)}px Impact, ui-sans-serif, sans-serif`;
        view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
        view.ctx.fillText(cone.num || '42', 0.3 * ppm, 0);
        // Smashed windscreen & open cabin showing welded H-frame roll-bar
        view.ctx.fillStyle = '#14161c';
        roundRect(view.ctx, -0.8 * ppm, -0.75 * ppm, 1.9 * ppm, 1.5 * ppm, 2); view.ctx.fill();
        // Steel roll-cage crossbars
        view.ctx.strokeStyle = '#e2e8f0'; view.ctx.lineWidth = 1.5;
        view.ctx.beginPath();
        view.ctx.moveTo(-0.5 * ppm, -0.6 * ppm); view.ctx.lineTo(0.7 * ppm, 0.6 * ppm);
        view.ctx.moveTo(-0.5 * ppm, 0.6 * ppm); view.ctx.lineTo(0.7 * ppm, -0.6 * ppm);
        view.ctx.stroke();
        // Crumpled front wing & exposed radiator
        view.ctx.fillStyle = '#3a3e48';
        view.ctx.fillRect(1.8 * ppm, -0.6 * ppm, 0.3 * ppm, 1.2 * ppm);
        // Smashed headlight
        view.ctx.fillStyle = '#fff6dc';
        view.ctx.beginPath();
        view.ctx.arc(1.9 * ppm, -0.6 * ppm, 0.15 * ppm, 0, Math.PI * 2);
        view.ctx.fill();
        // Sponsor stencil on boot
        view.ctx.fillStyle = 'rgba(255,255,255,0.7)';
        view.ctx.font = `700 ${Math.round(0.35 * ppm)}px ui-monospace, monospace`;
        view.ctx.fillText("BILL'S SCRAP", -1.3 * ppm, 0);
        view.ctx.restore();
        continue;
      }

      if (cone.kind === 'caravan') {
        const ppm = PPMz();
        view.ctx.rotate(cone.ang);
        // Cast shadow
        view.ctx.fillStyle = 'rgba(10,12,16,0.40)';
        roundRect(view.ctx, -2.4 * ppm + 4, -1.1 * ppm + 5, 4.8 * ppm, 2.2 * ppm, 7);
        view.ctx.fill();
        // Steel A-frame tow hitch with black jockey wheel
        view.ctx.strokeStyle = '#5a6270'; view.ctx.lineWidth = Math.max(2, 0.14 * ppm);
        view.ctx.beginPath();
        view.ctx.moveTo(2.4 * ppm, -0.35 * ppm);
        view.ctx.lineTo(3.3 * ppm, 0);
        view.ctx.lineTo(2.4 * ppm, 0.35 * ppm);
        view.ctx.stroke();
        // Jockey wheel
        view.ctx.fillStyle = '#111';
        view.ctx.fillRect(3.1 * ppm, -0.15 * ppm, 0.3 * ppm, 0.3 * ppm);
        // Green gas bottle mounted on A-frame
        view.ctx.fillStyle = '#2d6a4f';
        roundRect(view.ctx, 2.5 * ppm, -0.2 * ppm, 0.4 * ppm, 0.4 * ppm, 2); view.ctx.fill();
        // Rounded retro tourer body in classic warm cream
        view.ctx.fillStyle = '#f4f0e6';
        roundRect(view.ctx, -2.4 * ppm, -1.1 * ppm, 4.8 * ppm, 2.2 * ppm, 6); view.ctx.fill();
        view.ctx.strokeStyle = '#9ca3af'; view.ctx.lineWidth = 1.2; view.ctx.stroke();
        // Burnt-orange & chocolate dual vintage beltline stripes
        view.ctx.fillStyle = '#c0561a';
        view.ctx.fillRect(-2.3 * ppm, -0.22 * ppm, 4.6 * ppm, 0.28 * ppm);
        view.ctx.fillStyle = '#5a280d';
        view.ctx.fillRect(-2.3 * ppm, 0.08 * ppm, 4.6 * ppm, 0.12 * ppm);
        // Pop-up roof vent hatch
        view.ctx.fillStyle = '#d8d4c8';
        roundRect(view.ctx, -0.4 * ppm, -0.4 * ppm, 0.8 * ppm, 0.8 * ppm, 2); view.ctx.fill();
        view.ctx.fillStyle = 'rgba(0,0,0,0.18)';
        view.ctx.fillRect(-0.4 * ppm, 0.3 * ppm, 0.8 * ppm, 0.1 * ppm); // vent shadow
        // Tinted panoramic front & rear windows with curtain borders
        view.ctx.fillStyle = '#1e293b';
        roundRect(view.ctx, 1.7 * ppm, -0.85 * ppm, 0.5 * ppm, 1.7 * ppm, 1.5); view.ctx.fill();
        roundRect(view.ctx, -2.2 * ppm, -0.85 * ppm, 0.5 * ppm, 1.7 * ppm, 1.5); view.ctx.fill();
        view.ctx.fillStyle = '#ffffff'; // White curtain trim
        view.ctx.fillRect(1.7 * ppm, -0.85 * ppm, 0.1 * ppm, 1.7 * ppm);
        view.ctx.fillRect(-1.8 * ppm, -0.85 * ppm, 0.1 * ppm, 1.7 * ppm);
        // Side door with handle
        view.ctx.strokeStyle = '#94a3b8'; view.ctx.lineWidth = 1;
        view.ctx.strokeRect(-0.8 * ppm, 0.4 * ppm, 1.0 * ppm, 0.7 * ppm);
        view.ctx.fillStyle = '#cbd5e1';
        view.ctx.fillRect(-0.7 * ppm, 0.65 * ppm, 0.15 * ppm, 0.15 * ppm); // handle
        // Amber side marker lights and red circular taillights
        view.ctx.fillStyle = '#f59e0b';
        view.ctx.fillRect(-1.0 * ppm, -1.15 * ppm, 0.2 * ppm, 0.1 * ppm);
        view.ctx.fillRect(1.0 * ppm, -1.15 * ppm, 0.2 * ppm, 0.1 * ppm);
        view.ctx.fillStyle = '#ef4444';
        view.ctx.beginPath();
        view.ctx.arc(-2.4 * ppm, -0.7 * ppm, 0.12 * ppm, 0, Math.PI * 2);
        view.ctx.fill();
        view.ctx.beginPath();
        view.ctx.arc(-2.4 * ppm, 0.7 * ppm, 0.12 * ppm, 0, Math.PI * 2);
        view.ctx.fill();
        view.ctx.restore();
        continue;
      }

      if (cone.kind === 'podium') {
        const ppm = PPMz();
        view.ctx.rotate(cone.ang);
        // Ground shadow
        view.ctx.fillStyle = 'rgba(10,12,16,0.38)';
        roundRect(view.ctx, -1.8 * ppm + 3, -1.0 * ppm + 4, 3.6 * ppm, 2.0 * ppm, 3);
        view.ctx.fill();
        // 3 stepped blocks: 2nd (left), 1st (center), 3rd (right)
        // Center 1st place tier
        view.ctx.fillStyle = '#b4783e';
        roundRect(view.ctx, -0.6 * ppm, -1.0 * ppm, 1.2 * ppm, 2.0 * ppm, 2); view.ctx.fill();
        view.ctx.strokeStyle = '#5a3512'; view.ctx.lineWidth = 1.2; view.ctx.stroke();
        // Left 2nd place tier
        view.ctx.fillStyle = '#9b622e';
        roundRect(view.ctx, -1.7 * ppm, -0.85 * ppm, 1.1 * ppm, 1.7 * ppm, 2); view.ctx.fill();
        view.ctx.stroke();
        // Right 3rd place tier
        view.ctx.fillStyle = '#874f20';
        roundRect(view.ctx, 0.6 * ppm, -0.75 * ppm, 1.1 * ppm, 1.5 * ppm, 2); view.ctx.fill();
        view.ctx.stroke();
        // Chequered bunting skirt along the front bottom
        const checkW = 0.3 * ppm;
        for (let checkX = -1.7 * ppm; checkX < 1.7 * ppm; checkX += checkW) {
          view.ctx.fillStyle = Math.floor(checkX / checkW) % 2 === 0 ? '#111' : '#fff';
          view.ctx.fillRect(checkX, 0.85 * ppm, checkW, 0.15 * ppm);
        }
        // Numerals 1, 2, 3
        view.ctx.fillStyle = '#ffffff';
        view.ctx.font = `900 ${Math.round(0.75 * ppm)}px ui-sans-serif, sans-serif`;
        view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
        view.ctx.fillText('1', 0, 0.3 * ppm);
        view.ctx.fillText('2', -1.15 * ppm, 0.3 * ppm);
        view.ctx.fillText('3', 1.15 * ppm, 0.3 * ppm);
        // Gold / Silver / Bronze trophy cups on the top steps!
        // 1st place Gold cup
        view.ctx.fillStyle = '#eab308';
        view.ctx.fillRect(-0.25 * ppm, -0.75 * ppm, 0.5 * ppm, 0.45 * ppm);
        view.ctx.fillRect(-0.15 * ppm, -0.3 * ppm, 0.3 * ppm, 0.15 * ppm);
        view.ctx.strokeStyle = '#ca8a04'; view.ctx.lineWidth = 1.2;
        // cup handles
        view.ctx.beginPath();
        view.ctx.arc(0, -0.52 * ppm, 0.35 * ppm, -0.6, 0.6);
        view.ctx.stroke();
        // 2nd place Silver cup
        view.ctx.fillStyle = '#cbd5e1';
        view.ctx.fillRect(-1.35 * ppm, -0.65 * ppm, 0.4 * ppm, 0.35 * ppm);
        view.ctx.fillRect(-1.25 * ppm, -0.3 * ppm, 0.2 * ppm, 0.12 * ppm);
        // 3rd place Bronze cup
        view.ctx.fillStyle = '#b45309';
        view.ctx.fillRect(0.95 * ppm, -0.55 * ppm, 0.4 * ppm, 0.35 * ppm);
        view.ctx.fillRect(1.05 * ppm, -0.2 * ppm, 0.2 * ppm, 0.12 * ppm);
        view.ctx.restore();
        continue;
      }
      view.ctx.restore();
    }
  }

  return { drawCones, drawTape };
}
