// cones/coneCar.js: ONE CAR vs ONE OBJECT (multi-car: AI cars hit the same cones /
// tyres / bales): the contact, the momentum swap, and what the hit does to the object (topple,
// break, burst, tip, pop). Every function takes the one cones context made in cones.js.
import { debrisPunctures } from '../physics/tyrewear.ts';
import { noteHit } from '../physics/punctures.ts';
import { hasOpenWheels, wheelHalf } from '../physics/openwheel.ts';
import { CORNER_OF_WHEEL } from '../world/wheels.ts';
import {
  BALE_BURST_V, BALE_DRAG, BROKEN, COW_TIP_V, DEBRIS, MAX_CONE_V, RESTITUTION, SHEEP_POP_V,
  TOPPLE_V, TOPPLES, burstStack,
} from "./coneConsts.js";

/**
 * Drag a tarp along a little; a tarp never collides.
 * @param {any} obj the tarp
 * @param {any} car the car
 * @param {number} relX object x relative to the car
 * @param {number} relY object y relative to the car
 */
function dragTarp(obj, car, relX, relY) {
  const gap = Math.hypot(relX, relY);
  if (gap < 1.6 && Math.hypot(car.vx, car.vy) > 3) {
    obj.vx += (car.vx - obj.vx) * 0.08;
    obj.vy += (car.vy - obj.vy) * 0.08;
    obj.spin += (Math.random() - 0.5) * 2;
    obj.moved = true;
  }
}

/**
 * Push-out direction (car frame) for an object whose centre is inside the car's box.
 * @param {number} halfLen half the car length
 * @param {number} halfWid half the car width
 * @param {number} localX object x in the car frame
 * @param {number} localY object y in the car frame
 * @returns {number[]} the unit normal [nx, ny]
 */
function insideNormal(halfLen, halfWid, localX, localY) {
  const dRight = halfWid - localY, dLeft = localY - (-halfWid);
  const dFront = halfLen - localX, dBack = localX - (-halfLen);
  const minD = Math.min(dRight, dLeft, dFront, dBack);
  if (minD === dFront) return [1, 0];
  if (minD === dBack) return [-1, 0];
  if (minD === dRight) return [0, 1];
  return [0, -1];
}

/**
 * Collide the object with the car's body: push it out and find the closing speed.
 * @param {any} obj the object
 * @param {any} car the car
 * @param {number} relX object x relative to the car
 * @param {number} relY object y relative to the car
 * @param {any} [box] a box of the car's other than its body - an open wheel (fore, lateral: its
 *   centre in the car's frame; hl, hw: its half sizes; physics/openwheel.ts)
 * @returns {any} the contact, or null when the object is clear or moving away
 */
function bodyContact(obj, car, relX, relY, box = null) {
  const spec = car.spec, halfLen = box ? box.hl : spec.len / 2,
      halfWid = box ? box.hw : spec.wid / 2,
      cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  const offX = box ? box.fore : 0, offY = box ? box.lateral : 0;
  const localX = relX * cosH + relY * sinH - offX;
  const localY = -relX * sinH + relY * cosH - offY;
  const nearX = Math.max(-halfLen, Math.min(halfLen, localX));
  const nearY = Math.max(-halfWid, Math.min(halfWid, localY));
  const dx = localX - nearX, dy = localY - nearY;
  let dist = Math.hypot(dx, dy);
  const reach = obj.r;
  if (dist > reach) return null;

  let nx = 0, ny = 0;
  if (dist < 1e-4) {
    [nx, ny] = insideNormal(halfLen, halfWid, localX, localY);
    dist = 0;
  } else {
    nx = dx / dist;
    ny = dy / dist;
  }
  const wnx = nx * cosH - ny * sinH, wny = nx * sinH + ny * cosH;

  const push = reach - dist + 0.01;
  obj.x += wnx * push; obj.y += wny * push;

  // the touching point in the car's frame (a wheel's box sits off the centre)
  const pointX = nearX + offX, pointY = nearY + offY;
  const pvx = car.vx - car.yawRate * (pointX * sinH + pointY * cosH);
  const pvy = car.vy + car.yawRate * (pointX * cosH - pointY * sinH);
  const rel = (pvx - obj.vx) * wnx + (pvy - obj.vy) * wny;
  if (rel <= 0) return null;
  return { wnx, wny, nearX: pointX, nearY: pointY, pvx, pvy, rel };
}

const wheelOfCar = { fore: 0, lateral: 0, hl: 0, hw: 0 };
/**
 * Collide the object with an open-wheeler's exposed wheels (physics/openwheel.ts), when its
 * body missed it.
 * @param {any} obj the object
 * @param {any} car the car
 * @param {number} relX object x relative to the car
 * @param {number} relY object y relative to the car
 * @returns {any} the contact, or null
 */
function wheelsContact(obj, car, relX, relY) {
  if (!hasOpenWheels(car)) return null;
  [wheelOfCar.hl, wheelOfCar.hw] = wheelHalf(car);
  for (let wheel = 0; wheel < 4; wheel++) {
    if (car.wheelOff && car.wheelOff[CORNER_OF_WHEEL[wheel]]) continue;
    wheelOfCar.fore = wheel < 2 ? car.spec.lf : -car.spec.lr;
    wheelOfCar.lateral = (wheel % 2 === 0 ? 1 : -1) * (car.spec.trackWidth || 1.5) / 2;
    const contact = bodyContact(obj, car, relX, relY, wheelOfCar);
    if (contact) return contact;
  }
  return null;
}

/**
 * Momentum resistance on the car, then the object's new velocity and spin.
 * @param {any} obj the object
 * @param {any} car the car
 * @param {any} contact the contact from bodyContact
 * @returns {number} the object's speed after the hit
 */
function transferMomentum(obj, car, contact) {
  const { wnx, wny, nearX, nearY, pvx, pvy, rel } = contact;
  const rest = obj.kind === 'tyrestack' ? 0.25 : obj.kind === 'tyre' ? 0.35 : obj.kind
      === 'sheep' ? 0.2 : obj.kind === 'cow' ? 0.1 : RESTITUTION;
  if (obj.mass > 5) {
    const impulse = Math.min(obj.kind === 'bale' || obj.kind === 'cow' ? 8 : 2.5, (rel
        * obj.mass) / car.spec.mass);
    car.vx -= wnx * impulse;
    car.vy -= wny * impulse;
    car.yawRate -= (nearX * wny - nearY * wnx) * (impulse / (car.spec.len * 0.5));
  }

  obj.vx = pvx + wnx * rel * (1 + rest);
  obj.vy = pvy + wny * rel * (1 + rest);

  let speed = Math.hypot(obj.vx, obj.vy);
  if (speed > MAX_CONE_V) {
    obj.vx *= MAX_CONE_V / speed; obj.vy *= MAX_CONE_V / speed; speed = MAX_CONE_V;
  }
  obj.spin += (Math.random() - 0.5) * 6 + car.yawRate * 2;
  obj.moved = true;
  obj.hitCount = (obj.hitCount || 0) + 1;
  return speed;
}

/**
 * CHEVRONS + FLAGS (requirement: flat and driven over after 2 impacts): DISTINCT impacts (contacts
 * > 0.3 s apart; a contact spans several steps); the second leaves it flat
 * on the ground, out of the collisions.
 * @param {any} ctx the cones context
 * @param {any} obj the object
 */
function countChevronImpacts(ctx, obj) {
  if ((obj.kind === 'chevron' || obj.kind === 'flag')) {
    if (ctx.clock - (obj._lastHit ?? -9) > 0.3) obj.impacts = (obj.impacts || 0) + 1;
    obj._lastHit = ctx.clock;
    if (obj.impacts >= 2) { obj.flat = true; obj.down = 1; obj.vx *= 0.3; obj.vy *= 0.3; }
  }
}

/**
 * DEBRIS that breaks: DISTINCT impacts (> 0.3 s apart, as the chevrons); at `breaks` it
 * becomes its flat patch, out of the collisions.
 * @param {any} ctx the cones context
 * @param {any} obj the object
 * @param {number} rel closing speed
 */
function breakDebris(ctx, obj, rel) {
  const debris = DEBRIS[obj.kind];
  if (!(debris && debris.breaks)) return;
  // 0.6 s: one pass through it pushes it along for ~0.4 s (measured) = ONE impact
  if (ctx.clock - (obj._lastHit ?? -9) > 0.6) obj.impacts = (obj.impacts || 0) + 1;
  obj._lastHit = ctx.clock;
  if (obj.impacts >= debris.breaks && rel > 2) {
    obj.kind = debris.into; obj.mode = 'flat'; obj.mass = 40;
    obj.vx *= 0.4; obj.vy *= 0.4; obj.down = 1;
    for (let dust = 0; dust < 4 && ctx.hits.length < 24; dust++)
      ctx.hits.push({
        x: obj.x + (Math.random() - 0.5) * 1.6, y: obj.y + (Math.random() - 0.5) * 1.6,
        speed: 14, kind: debris.into === 'sand' ? 'bale' : 'tyre'
      });
  }
}

/**
 * ANIMALS (S-C): a sheep hit hard POPS into fluff; a cow hit hard TIPS (and stays a 250 kg
 * solid).
 * @param {any} ctx the cones context
 * @param {any} obj the object
 * @param {number} rel closing speed
 */
function hitAnimal(ctx, obj, rel) {
  if (obj.kind === 'sheep' && rel > SHEEP_POP_V) {
    obj.kind = 'fluff';
    obj.mode = 'flat';
    obj.mass = 40;
    obj.vx *= 0.3;
    obj.vy *= 0.3;
    obj.down = 1;
    for (let dust = 0; dust < 5 && ctx.hits.length < 24; dust++) ctx.hits.push({ x: obj.x
        + (Math.random() - 0.5) * 1.6, y: obj.y + (Math.random() - 0.5) * 1.6, speed: 16,
        kind: 'fluff' });
  }
  if (obj.kind === 'cow' && rel > COW_TIP_V && !obj.tipped) {
    obj.tipped = true;
    obj.spin += (Math.random() - 0.5) * 3;
  }
}

/**
 * Hitting an individual tyre can launch it into a roll or flip.
 * @param {any} obj the tyre
 * @param {number} speed its speed after the hit
 */
function launchTyre(obj, speed) {
  if (speed > 4.0 && Math.random() < 0.45) {
    obj.mode = 'roll';
    obj.down = 0;
  } else if (speed > 4.0 && Math.random() < 0.50) {
    obj.mode = 'flip';
    obj.flipPhase = 0;
    obj.flipSpeed = 12 + Math.random() * 8;
  } else {
    obj.mode = 'flat';
    obj.down = 1.0;
  }
}

/**
 * A bale hit hard bursts: straw everywhere, the car bogged in it.
 * @param {any} ctx the cones context
 * @param {any} obj the bale
 * @param {any} car the car
 */
function burstBale(ctx, obj, car) {
  obj.kind = 'straw';
  obj.mode = 'flat';
  obj.mass = 60;
  obj.vx *= 0.35;
  obj.vy *= 0.35;
  obj.down = 1;
  car.vx *= 1 - BALE_DRAG; car.vy *= 1 - BALE_DRAG;
  for (let dust = 0; dust < 5 && ctx.hits.length < 24; dust++) ctx.hits.push({ x: obj.x
      + (Math.random() - 0.5) * 2.4, y: obj.y + (Math.random() - 0.5) * 2.4, speed: 18,
      kind: 'bale' });
}

/**
 * What the hit does to the object itself: burst, launch, topple, and a dust record.
 * @param {any} ctx the cones context
 * @param {any} obj the loose object
 * @param {any} car the car
 * @param {any[]} newTyres receives the tyres a burst stack throws out
 * @param {number} rel closing speed
 * @param {number} speed the object's speed after the hit
 */
function afterHit(ctx, obj, car, newTyres, rel, speed) {
  // ---- Tyre stack shattering into 3 dynamic tyres (shared with object-object hits: burstStack)
  if (obj.kind === 'bale' && rel > BALE_BURST_V) {
    burstBale(ctx, obj, car);
  } else if (obj.kind === 'tyrestack' && (rel > 3.8 || obj.hitCount >= 2)) {
    burstStack(obj, newTyres);
  } else if (obj.kind === 'tyre') {
    launchTyre(obj, speed);
  }

  if (speed > TOPPLE_V && obj.down === 0 && TOPPLES.has(obj.kind)) {
    obj.down = 0.001;
    obj.ang = Math.atan2(obj.vy, obj.vx);
  }
  if (ctx.hits.length < 24) ctx.hits.push({ x: obj.x, y: obj.y, speed, kind: obj.kind });
}

/**
 * ONE CAR vs ONE OBJECT. Lifted out of step's loop unchanged except continue -> return, so a
 * single car behaves exactly as before (tools/objcheck, tyrewallcheck, balecheck).
 * @param {any} ctx the cones context
 * @param {any} obj the loose object
 * @param {any} car the car
 * @param {any[]} newTyres receives the tyres a burst stack throws out
 */
export function hitByCar(ctx, obj, car, newTyres) {
  const relX = obj.x - car.x, relY = obj.y - car.y;
  if (relX * relX + relY * relY > 16) return;
  // a burst bale / broken debris is a flat patch: you drive through it - a broken pallet's nails
  // may puncture a tyre (once a second at most)
  if (obj.kind === 'splinters' && relX * relX + relY * relY < 4
    && ctx.clock - (obj._nailT ?? -9) > 1) {
    obj._nailT = ctx.clock;
    // nails and debris let a tyre down slowly (damage.ts applyBurst)
    if (debrisPunctures(obj.kind, 0, false)) { car.burstTyre = 0; car.burstSlow = true; }
  }
  if (obj.kind === 'straw' || BROKEN.has(obj.kind)) return;
  // dragged along a bit
  if (obj.kind === 'tarp') { dragTarp(obj, car, relX, relY); return; }
  // a chevron / flag flattened by 2 impacts: driven over
  if (obj.flat) return;
  const contact = bodyContact(obj, car, relX, relY) || wheelsContact(obj, car, relX, relY);
  if (!contact) return;
  noteHit(car, obj.kind);
  const rel = contact.rel;
  const speed = transferMomentum(obj, car, contact);
  countChevronImpacts(ctx, obj);
  breakDebris(ctx, obj, rel);
  // hitting debris hard may puncture the front tyre on that side
  if (debrisPunctures(obj.kind, rel, !!DEBRIS[obj.kind])) {
    car.burstTyre = -Math.sin(car.heading) * relX + Math.cos(car.heading) * relY > 0 ? 0 : 1;
    car.burstSlow = true;
  }
  hitAnimal(ctx, obj, rel);
  afterHit(ctx, obj, car, newTyres, rel, speed);
}
