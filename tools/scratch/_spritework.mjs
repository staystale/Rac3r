// _spritework.mjs - the damaged car pictures as pixel hashes, to prove a change to how they are
// made leaves every pixel the same: each car of the roster at several damage states - its dented
// top sprite (render/cardamage.ts damagedSprite), that sprite with parts lost (render/carparts.ts
// withoutParts) and its rolled faces (underside, both sides). Run on two builds and compare the
// printed hash. node tools/scratch/_spritework.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1`);
  await page.waitForTimeout(1500);
  const result = await page.evaluate(async (dump) => {
    const cars = await import('/src/cars.ts'), veh = await import('/src/vehicle.ts');
    const parts = await import('/src/render/carparts.ts');
    const drawn = await import('/src/render/cars.ts');
    const damage = await import('/src/render/cardamage.ts');
    const renderer = window.__game.renderer, painter = damage.createCarDamage({});
    // what DRAWING a picture gives (as the game does each frame): drawn onto a canvas of its own
    // and read there - a picture's own first read back can rasterise it differently (Chrome keeps
    // a canvas's drawing as a list until it is read, and rasterises it by the canvas's mode then)
    const shown = (canvas) => {
      const copy = document.createElement('canvas');
      copy.width = canvas.width;
      copy.height = canvas.height;
      const copyCtx = copy.getContext('2d', { willReadFrequently: true });
      copyCtx.drawImage(canvas, 0, 0);
      return copyCtx.getImageData(0, 0, copy.width, copy.height).data;
    };
    const hashOf = (canvas) => {
      const data = shown(canvas);
      let hash = 7;
      for (let i = 0; i < data.length; i++) hash = (Math.imul(hash, 31) + data[i]) >>> 0;
      return hash;
    };
    // [crushL, crushS, wheels off, roof] - a light knock, a front-left hit, a wreck rolled
    const states = [
      [[0.1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], 0],
      [[0.6, 0.3, 0, 0], [0.4, 0, 0, 0], [1, 0, 0, 0], 0],
      [[0.9, 0.7, 0.5, 0.8], [0.6, 0.5, 0.7, 0.3], [1, 0, 0, 1], 0.7],
    ];
    let all = 7, pictures = 0;
    const each = [];
    for (const row of cars.ROSTER) {
      const car = veh.makeCar(row.id);
      car.spec = drawn.drawnSpec(cars.applyLivery(car.spec, null));
      car.num = 3;
      const sprite = renderer.pixelCar(car.spec);
      for (const [crushL, crushS, wheels, roof] of states) {
        car.crushL = crushL; car.crushS = crushS; car.wheelOff = wheels.map(Boolean);
        car.roofDmg = roof; car.dmg = crushL.map((value, i) => Math.max(value, crushS[i]));
        const dented = painter.damagedSprite(car, sprite);
        const lost = parts.withoutParts(car.spec, dented, 'bumper:0,wing:1,panel:2');
        const faces = [Math.PI, Math.PI / 2, -Math.PI / 2]
          .flatMap((phi) => painter.rolledFaces(car, dented, phi));
        const named = [['dent', dented.c], ['lost', lost.c],
          ...faces.map((face, i) => [`face${i}`, face.cv])];
        const label = `${row.id} s${states.findIndex((state) => state[0] === crushL)}`;
        for (const [name, canvas] of named) {
          const hash = hashOf(canvas);
          all = (Math.imul(all, 31) + hash) >>> 0;
          pictures++;
          each.push(`${label} ${name} ${hash.toString(16)}`);
          if (`${label} ${name}` === dump) {
            each.push(`DUMP ${canvas.width}x${canvas.height} ` + Array.from(shown(canvas))
              .join(','));
          }
        }
      }
    }
    return { line: `${pictures} pictures, hash ${all.toString(16)}`, each };
  }, process.env.DUMP || '');
  console.log(result.line);
  // EACH=1: every picture's own hash (car, damage state, picture); DUMP=<that label>: its pixels
  if (process.env.EACH) console.log(result.each.join('\n'));
} finally {
  await browser.close();
  server.stop();
}
