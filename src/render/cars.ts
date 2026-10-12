// The CARS layer of render.ts (phase 4 split): drawPixelCar and the garage lift sprite.
import { SPRITE_PPM } from "./shared.ts";
import type {
  Cam, CarSprite, RenderCar, RenderCarSpec, RollFace, SideSprite, SilCanvas, View,
} from "./types.ts";

// what createCars destructures from the renderer and the sprite layers
interface CarsHelpers {
  PPMz: () => number;
  sx: (wx: number) => number;
  sy: (wy: number) => number;
  pixelCar: (spec: RenderCarSpec) => CarSprite;
  damagedSprite: (car: RenderCar, sp: CarSprite) => CarSprite;
  silhouette: (cv: SilCanvas) => HTMLCanvasElement;
  rolledFaces: (car: RenderCar, sp: CarSprite, phi: number) => RollFace[];
  drawFaces: (faces: RollFace[], Lp: number, sil: boolean, off: number) => void;
  faceCache: Map<string, CarSprite | SideSprite>;
}

export function createCars(view: View, cam: Cam, helpers: CarsHelpers) {
  const {
    PPMz, sx, sy, pixelCar, damagedSprite, silhouette, rolledFaces, drawFaces, faceCache,
  } = helpers;
  function drawPixelCar(car: RenderCar) {
    const s = car.spec, sp0 = pixelCar(s), sp = car.dmg ? damagedSprite(car, sp0) : sp0, u = PPMz() / SPRITE_PPM;
    view.ctx.save();
    view.ctx.translate(sx(car.x), sy(car.y));
    view.ctx.rotate(car.heading);
    view.ctx.scale(u, u);
    // shadow: a darker copy of the sprite, offset down-right by the car's ride height (cars.js rideH)
    const shOff = 2 + Math.round((s.rideH || 0.13) * 10);
    if (car.roll && car.roll.phi) {
      const faces = rolledFaces(car, sp, car.roll.phi);
      view.ctx.globalAlpha = 0.3; drawFaces(faces, sp.Lp, true, shOff + 2); view.ctx.globalAlpha = 1;
      drawFaces(faces, sp.Lp, false, 0);
      view.ctx.restore();
      return;
    }
    view.ctx.globalAlpha = 0.3; view.ctx.drawImage(silhouette(sp.c), -sp.Lp / 2 - 2 + shOff, -sp.Wp / 2 - 2 + shOff); view.ctx.globalAlpha = 1;
    // wheels: pixel blocks, the fronts turned by the steering angle
    const tyreL = s.kind === 'track' ? 14 : s.kind === 'tractor' ? 15 : 11, tyreW = s.kind === 'track' ? 6 : 4;
    // at the body's EDGE so they poke out at the sides like the reference sprites (pass 1 hid them under the body)
    const hw = Math.max((s.trackWidth || 1.5) / 2 * SPRITE_PPM, sp.Wp / 2) + (s.kind === 'track' ? 1 : 0);
    for (const [ax, side, st, ci] of [[s.lf, -1, car.delta, 0], [s.lf, 1, car.delta, 1], [-s.lr, -1, 0, 2], [-s.lr, 1, 0, 3]]) {
      if (car.wheelOff && car.wheelOff[ci]) { view.ctx.fillStyle = '#2b2d33'; view.ctx.fillRect(Math.round(ax * SPRITE_PPM) - 2, Math.round(side * hw) - 1, 4, 2); continue; }   // DAMAGE: wheel gone, a hub stub
      view.ctx.save();
      view.ctx.translate(Math.round(ax * SPRITE_PPM), Math.round(side * hw));
      view.ctx.rotate(st);
      const big = s.kind === 'tractor' && ax < 0;                     // tractor: huge rear wheels, yellow rims
      const tl = big ? 20 : tyreL, tw = big ? 7 : tyreW;
      view.ctx.fillStyle = '#16171c'; view.ctx.fillRect(-tl / 2, -tw / 2, tl, tw);
      view.ctx.fillStyle = '#3a3d47'; view.ctx.fillRect(-tl / 2 + 2, -tw / 2, tl - 4, 1);
      if (s.kind === 'tractor') { view.ctx.fillStyle = '#fbc02d'; view.ctx.fillRect(-2, -1, 4, 2); }
      else if (s.rim) { view.ctx.fillStyle = s.rim; view.ctx.fillRect(-2, -1, 4, 2); }   // coloured wheels (the Subaroo's gold)
      view.ctx.restore();
    }
    view.ctx.drawImage(sp.c, -sp.Lp / 2 - 2, -sp.Wp / 2 - 2);
    // DAMAGE (damage.js): a dark crushed block on each hurt corner, growing with the damage, a pale crease along its edge; a punctured
    // wheel shows a bright rim. Squares, not curves (pixel rule).
    if (car.punct) for (let c = 0; c < 4; c++) {
      if (car.punct[c]) { view.ctx.fillStyle = '#c9c9d2'; view.ctx.fillRect(Math.round((c < 2 ? s.lf : -s.lr) * SPRITE_PPM) - 2, Math.round((c % 2 ? 1 : -1) * hw) - 1, 4, 2); }
    }
    // brake lights glow when braking (a live overlay on the sprite)
    // HEADLIGHTS (user, 2026-10-04: "all cars have working headlights"): two soft beams ahead (drawn in the car's frame, art px), brighter
    // lamps; INDICATORS: amber at the front + rear corners of that side, blinking ~1.5 Hz (wall clock)
    // LAMPS BREAK WITH DAMAGE (user, 2026-10-04: "headlights should vanish with damage appropriately"): every lamp lives on its corner
    // (damage.js: 0 front -y, 1 front +y, 2 rear -y, 3 rear +y). Full up to LAMP_OK, then it flickers and dims, out from LAMP_GONE
    // (~a 25-30 km/h head-on on that corner). Headlight beam + lamp, brake light and indicator alike.
    const LAMP_OK = 0.15, LAMP_GONE = 0.35;
    const lamp = (c: number) => {
      const d = car.dmg ? car.dmg[c] : 0;
      if (d <= LAMP_OK) return 1;
      if (d >= LAMP_GONE) return 0;
      const k = 1 - (d - LAMP_OK) / (LAMP_GONE - LAMP_OK);
      return Math.random() < 0.1 + 0.5 * (1 - k) ? 0 : k;
    };
    if (car.lightsOn) {
      for (const [y, cn] of [[-sp.Wp / 2 + 4, 0], [sp.Wp / 2 - 4, 1]]) {
        const lk = lamp(cn);
        if (!lk) continue;
        const gr = view.ctx.createLinearGradient(sp.Lp / 2, 0, sp.Lp / 2 + 190, 0); gr.addColorStop(0, 'rgba(255,244,200,' + (0.34 * lk).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,244,200,0)');
        view.ctx.fillStyle = gr; view.ctx.beginPath(); view.ctx.moveTo(sp.Lp / 2 - 1, y - 2); view.ctx.lineTo(sp.Lp / 2 + 190, y - 34 + (y > 0 ? 30 : 0)); view.ctx.lineTo(sp.Lp / 2 + 190, y + 34 - (y < 0 ? 30 : 0)); view.ctx.lineTo(sp.Lp / 2 - 1, y + 2); view.ctx.closePath(); view.ctx.fill();
        view.ctx.fillStyle = '#fffbe6'; view.ctx.fillRect(sp.Lp / 2 - 3, y - 2, 3, 4);
      }
    }
    // HAZARDS (car.hazard, a crashed traffic car): both sides at once
    if ((car.indicator || car.hazard) && Math.floor(performance.now() / 333) % 2 === 0) for (const ind of car.hazard ? [-1, 1] : [car.indicator!]) {   // ! : indicator or hazard was truthy above
      const y = ind < 0 ? -sp.Wp / 2 : sp.Wp / 2 - 3; view.ctx.fillStyle = '#ffa630';
      const sd = ind < 0 ? 0 : 1;
      if (lamp(sd)) view.ctx.fillRect(sp.Lp / 2 - 4, y, 3, 3);
      if (lamp(sd + 2)) view.ctx.fillRect(-sp.Lp / 2 + 1, y, 3, 3);
    }
    if (car.brakeLight! > 0.05) {   // undefined > 0.05 is false
      view.ctx.fillStyle = '#ff4a3a';
      if (lamp(2)) view.ctx.fillRect(-sp.Lp / 2, -sp.Wp / 2 + 2, 2, 3);
      if (lamp(3)) view.ctx.fillRect(-sp.Lp / 2, sp.Wp / 2 - 5, 2, 3);
    }
    view.ctx.restore();
  }

  // the GARAGE lift (user, 2026-10-04: "some vehicles aren't showing their wheels in garage mode"): the body sprite only carries the
  // body — the game draws the wheels separately (they steer) — so the lift gets a composite: wheels as drawPixelCar draws them, then
  // the body. Same { c, Lp, Wp } shape; cached per car.
  function pixelCarWithWheels(spec: RenderCarSpec) {
    const k = 'wheels:' + spec.id + spec.paint + spec.trim + (spec.num || 0); if (faceCache.has(k)) return faceCache.get(k);
    const sp = pixelCar(spec), s = spec;
    const tyreL = s.kind === 'track' ? 14 : s.kind === 'tractor' ? 15 : 11, tyreW = s.kind === 'track' ? 6 : 4;
    const hw = Math.max((s.trackWidth || 1.5) / 2 * SPRITE_PPM, sp.Wp / 2) + (s.kind === 'track' ? 1 : 0);
    const padY = Math.max(0, Math.ceil(hw + 4 - sp.Wp / 2)), c = document.createElement('canvas'); c.width = sp.c.width + 4; c.height = sp.c.height + padY * 2;
    const gx = c.getContext('2d')!, cx = c.width / 2, cy = c.height / 2;
    for (const [ax, side] of [[s.lf, -1], [s.lf, 1], [-s.lr, -1], [-s.lr, 1]]) {
      const big = s.kind === 'tractor' && ax < 0, tl = big ? 20 : tyreL, tw = big ? 7 : tyreW, x = Math.round(cx + ax * SPRITE_PPM), y = Math.round(cy + side * hw);
      gx.fillStyle = '#16171c'; gx.fillRect(x - tl / 2, y - tw / 2, tl, tw);
      gx.fillStyle = '#3a3d47'; gx.fillRect(x - tl / 2 + 2, y - tw / 2, tl - 4, 1);
      if (s.kind === 'tractor') { gx.fillStyle = '#fbc02d'; gx.fillRect(x - 2, y - 1, 4, 2); } else if (s.rim) { gx.fillStyle = s.rim; gx.fillRect(x - 2, y - 1, 4, 2); }
    }
    gx.drawImage(sp.c, Math.round(cx - sp.c.width / 2), Math.round(cy - sp.c.height / 2));
    const out = { c, Lp: sp.Lp, Wp: sp.Wp + padY * 2 }; faceCache.set(k, out); return out;
  }

  return { drawPixelCar, pixelCarWithWheels };
}
