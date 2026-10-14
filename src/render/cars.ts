// The CARS layer of render.ts (phase 4 split): drawPixelCar and the garage lift sprite.
import { SPRITE_PPM } from "./shared.ts";
import type {
  Cam, CarSprite, RenderCar, RenderCarSpec, RollFace, SideSprite, SilCanvas, View,
} from "./types.ts";

// what createCars destructures from the renderer and the sprite layers
interface CarsHelpers {
  PPMz: () => number;
  toScreenX: (wx: number) => number;
  toScreenY: (wy: number) => number;
  pixelCar: (spec: RenderCarSpec) => CarSprite;
  damagedSprite: (car: RenderCar, sp: CarSprite) => CarSprite;
  silhouette: (cv: SilCanvas) => HTMLCanvasElement;
  rolledFaces: (car: RenderCar, sp: CarSprite, phi: number) => RollFace[];
  drawFaces: (faces: RollFace[], Lp: number, sil: boolean, off: number) => void;
  faceCache: Map<string, CarSprite | SideSprite>;
}

export function createCars(view: View, cam: Cam, helpers: CarsHelpers) {
  const {
    PPMz, toScreenX, toScreenY, pixelCar, damagedSprite, silhouette, rolledFaces, drawFaces,
      faceCache,
  } = helpers;
  function drawPixelCar(car: RenderCar) {
    const spec = car.spec, sp0 = pixelCar(spec),
      sprite = car.dmg ? damagedSprite(car, sp0) : sp0, scale = PPMz() / SPRITE_PPM;
    view.ctx.save();
    view.ctx.translate(toScreenX(car.x), toScreenY(car.y));
    view.ctx.rotate(car.heading);
    view.ctx.scale(scale, scale);
    // shadow: a darker copy of the sprite, offset down-right by the car's ride height
    // (cars.js rideH)
    const shOff = 2 + Math.round((spec.rideH || 0.13) * 10);
    if (car.roll && car.roll.phi) {
      const faces = rolledFaces(car, sprite, car.roll.phi);
      view.ctx.globalAlpha = 0.3;
      drawFaces(faces, sprite.Lp, true, shOff + 2);
      view.ctx.globalAlpha = 1;
      drawFaces(faces, sprite.Lp, false, 0);
      view.ctx.restore();
      return;
    }
    view.ctx.globalAlpha = 0.3;
    view.ctx.drawImage(
      silhouette(sprite.c), -sprite.Lp / 2 - 2 + shOff, -sprite.Wp / 2 - 2 + shOff,
    );
    view.ctx.globalAlpha = 1;
    // wheels: pixel blocks, the fronts turned by the steering angle
    const tyreL = spec.kind === 'track' ? 14 : spec.kind === 'tractor' ? 15 : 11,
      tyreW = spec.kind === 'track' ? 6 : 4;
    // at the body's EDGE so they poke out at the sides like the reference sprites
    // (pass 1 hid them under the body)
    const halfWidth = Math.max((spec.trackWidth || 1.5) / 2 * SPRITE_PPM, sprite.Wp / 2)
      + (spec.kind === 'track' ? 1 : 0);
    for (const [axleX, side, steer, corner] of [
      [spec.lf, -1, car.delta, 0], [spec.lf, 1, car.delta, 1],
      [-spec.lr, -1, 0, 2], [-spec.lr, 1, 0, 3],
    ]) {
      if (car.wheelOff && car.wheelOff[corner]) {
        // DAMAGE: wheel gone, a hub stub
        view.ctx.fillStyle = '#2b2d33';
        view.ctx.fillRect(
          Math.round(axleX * SPRITE_PPM) - 2, Math.round(side * halfWidth) - 1, 4, 2,
        );
        continue;
      }
      view.ctx.save();
      view.ctx.translate(Math.round(axleX * SPRITE_PPM), Math.round(side * halfWidth));
      view.ctx.rotate(steer);
      // tractor: huge rear wheels, yellow rims
      const big = spec.kind === 'tractor' && axleX < 0;
      const tyreLen = big ? 20 : tyreL, tyreWid = big ? 7 : tyreW;
      view.ctx.fillStyle = '#16171c';
      view.ctx.fillRect(-tyreLen / 2, -tyreWid / 2, tyreLen, tyreWid);
      view.ctx.fillStyle = '#3a3d47';
      view.ctx.fillRect(-tyreLen / 2 + 2, -tyreWid / 2, tyreLen - 4, 1);
      if (spec.kind === 'tractor') {
        view.ctx.fillStyle = '#fbc02d';
        view.ctx.fillRect(-2, -1, 4, 2);
      } else if (spec.rim) {
        // coloured wheels (the Subaroo's gold)
        view.ctx.fillStyle = spec.rim;
        view.ctx.fillRect(-2, -1, 4, 2);
      }
      view.ctx.restore();
    }
    view.ctx.drawImage(sprite.c, -sprite.Lp / 2 - 2, -sprite.Wp / 2 - 2);
    // DAMAGE (damage.js): a dark crushed block on each hurt corner, growing with the damage,
    // a pale crease along its edge; a punctured wheel shows a bright rim. Squares, not curves
    // (pixel rule).
    if (car.punct) for (let corner = 0; corner < 4; corner++) {
      if (car.punct[corner]) {
        view.ctx.fillStyle = '#c9c9d2';
        view.ctx.fillRect(
          Math.round((corner < 2 ? spec.lf : -spec.lr) * SPRITE_PPM) - 2,
          Math.round((corner % 2 ? 1 : -1) * halfWidth) - 1, 4, 2,
        );
      }
    }
    // brake lights glow when braking (a live overlay on the sprite)
    // HEADLIGHTS (user, 2026-10-04: "all cars have working headlights"): two soft beams
    // ahead (drawn in the car's frame, art px), brighter lamps; INDICATORS: amber at the
    // front + rear corners of that side, blinking ~1.5 Hz (wall clock)
    // LAMPS BREAK WITH DAMAGE (user, 2026-10-04: "headlights should vanish with damage
    // appropriately"): every lamp lives on its corner (damage.js: 0 front -y, 1 front +y,
    // 2 rear -y, 3 rear +y). Full up to LAMP_OK, then it flickers and dims, out from
    // LAMP_GONE (~a 25-30 km/h head-on on that corner). Headlight beam + lamp, brake light
    // and indicator alike.
    const LAMP_OK = 0.15, LAMP_GONE = 0.35;
    const lamp = (corner: number) => {
      const damage = car.dmg ? car.dmg[corner] : 0;
      if (damage <= LAMP_OK) return 1;
      if (damage >= LAMP_GONE) return 0;
      const intact = 1 - (damage - LAMP_OK) / (LAMP_GONE - LAMP_OK);
      return Math.random() < 0.1 + 0.5 * (1 - intact) ? 0 : intact;
    };
    if (car.lightsOn) {
      for (const [y, corner] of [[-sprite.Wp / 2 + 4, 0], [sprite.Wp / 2 - 4, 1]]) {
        const level = lamp(corner);
        if (!level) continue;
        const beam = view.ctx.createLinearGradient(sprite.Lp / 2, 0, sprite.Lp / 2 + 190, 0);
        beam.addColorStop(0, 'rgba(255,244,200,' + (0.34 * level).toFixed(3) + ')');
        beam.addColorStop(1, 'rgba(255,244,200,0)');
        view.ctx.fillStyle = beam;
        view.ctx.beginPath();
        view.ctx.moveTo(sprite.Lp / 2 - 1, y - 2);
        view.ctx.lineTo(sprite.Lp / 2 + 190, y - 34 + (y > 0 ? 30 : 0));
        view.ctx.lineTo(sprite.Lp / 2 + 190, y + 34 - (y < 0 ? 30 : 0));
        view.ctx.lineTo(sprite.Lp / 2 - 1, y + 2);
        view.ctx.closePath();
        view.ctx.fill();
        view.ctx.fillStyle = '#fffbe6';
        view.ctx.fillRect(sprite.Lp / 2 - 3, y - 2, 3, 4);
      }
    }
    // HAZARDS (car.hazard, a crashed traffic car): both sides at once
    // (the ! below: indicator or hazard was truthy above)
    if ((car.indicator || car.hazard) && Math.floor(performance.now() / 333) % 2 === 0)
    for (const ind of car.hazard ? [-1, 1] : [car.indicator!]) {
      const y = ind < 0 ? -sprite.Wp / 2 : sprite.Wp / 2 - 3;
      view.ctx.fillStyle = '#ffa630';
      const sideIdx = ind < 0 ? 0 : 1;
      if (lamp(sideIdx)) view.ctx.fillRect(sprite.Lp / 2 - 4, y, 3, 3);
      if (lamp(sideIdx + 2)) view.ctx.fillRect(-sprite.Lp / 2 + 1, y, 3, 3);
    }
    if (car.brakeLight! > 0.05) {   // undefined > 0.05 is false
      view.ctx.fillStyle = '#ff4a3a';
      if (lamp(2)) view.ctx.fillRect(-sprite.Lp / 2, -sprite.Wp / 2 + 2, 2, 3);
      if (lamp(3)) view.ctx.fillRect(-sprite.Lp / 2, sprite.Wp / 2 - 5, 2, 3);
    }
    view.ctx.restore();
  }

  // the GARAGE lift (user, 2026-10-04: "some vehicles aren't showing their wheels in garage
  // mode"): the body sprite only carries the body — the game draws the wheels separately
  // (they steer) — so the lift gets a composite: wheels as drawPixelCar draws them, then
  // the body. Same { c, Lp, Wp } shape; cached per car.
  function pixelCarWithWheels(spec: RenderCarSpec) {
    const key = 'wheels:' + spec.id + spec.paint + spec.trim + (spec.num || 0);
    if (faceCache.has(key)) return faceCache.get(key);
    const sprite = pixelCar(spec), carSpec = spec;
    const tyreL = carSpec.kind === 'track' ? 14 : carSpec.kind === 'tractor' ? 15 : 11,
      tyreW = carSpec.kind === 'track' ? 6 : 4;
    const halfWidth = Math.max((carSpec.trackWidth || 1.5) / 2 * SPRITE_PPM, sprite.Wp / 2)
      + (carSpec.kind === 'track' ? 1 : 0);
    const padY = Math.max(0, Math.ceil(halfWidth + 4 - sprite.Wp / 2)),
      canvas = document.createElement('canvas');
    canvas.width = sprite.c.width + 4;
    canvas.height = sprite.c.height + padY * 2;
    const gctx = canvas.getContext('2d')!, midX = canvas.width / 2, midY = canvas.height / 2;
    for (const [axleX, side] of [
      [carSpec.lf, -1], [carSpec.lf, 1], [-carSpec.lr, -1], [-carSpec.lr, 1],
    ]) {
      const big = carSpec.kind === 'tractor' && axleX < 0,
        tyreLen = big ? 20 : tyreL, tyreWid = big ? 7 : tyreW,
        x = Math.round(midX + axleX * SPRITE_PPM), y = Math.round(midY + side * halfWidth);
      gctx.fillStyle = '#16171c';
      gctx.fillRect(x - tyreLen / 2, y - tyreWid / 2, tyreLen, tyreWid);
      gctx.fillStyle = '#3a3d47';
      gctx.fillRect(x - tyreLen / 2 + 2, y - tyreWid / 2, tyreLen - 4, 1);
      if (carSpec.kind === 'tractor') {
        gctx.fillStyle = '#fbc02d';
        gctx.fillRect(x - 2, y - 1, 4, 2);
      } else if (carSpec.rim) {
        gctx.fillStyle = carSpec.rim;
        gctx.fillRect(x - 2, y - 1, 4, 2);
      }
    }
    gctx.drawImage(
      sprite.c, Math.round(midX - sprite.c.width / 2), Math.round(midY - sprite.c.height / 2),
    );
    const out = { c: canvas, Lp: sprite.Lp, Wp: sprite.Wp + padY * 2 };
    faceCache.set(key, out);
    return out;
  }

  return { drawPixelCar, pixelCarWithWheels };
}
