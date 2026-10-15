// contact.js — CAR-TO-CAR CONTACT (AI stage 1; user: "full contact"). Every pair of
// cars is tested as two oriented boxes with the separating-axis test (the same test solidClamp
// uses for props). On overlap: the two are pushed apart along the axis of least overlap, split
// by mass; if they are closing, an jolt along that axis (restitution CAR_E), a little
// sideways scrub (CAR_SCRAPE), and a yaw kick from where the contact is relative to each centre
// — so a tap on the rear quarter turns a car, a straight shunt does not.
// Damage comes later (roadmap F); this only moves cars. Units: metres, seconds, kg.
const CAR_E = 0.25;         // bounciness of a car-to-car hit
// share of the sideways relative speed removed per contact (door-rubbing friction)
const CAR_SCRAPE = 0.12;

// returns true if they touched (for sound / shake / tools)
export function carContact(firstCar, secondCar) {
  // no allocation per call (memory diet: plain locals, no axes objects)
  const aCos = Math.cos(firstCar.heading), aSin = Math.sin(firstCar.heading),
    aHl = firstCar.spec.len * 0.48, aHw = firstCar.spec.wid * 0.48;
  const bCos = Math.cos(secondCar.heading), bSin = Math.sin(secondCar.heading),
    bHl = secondCar.spec.len * 0.48, bHw = secondCar.spec.wid * 0.48;
  const dx = secondCar.x - firstCar.x, dy = secondCar.y - firstCar.y;
  const radiusA = Math.hypot(aHl, aHw), radiusB = Math.hypot(bHl, bHw);
  if (dx * dx + dy * dy > (radiusA + radiusB) ** 2) return false;
  let best = Infinity, nx = 0, ny = 0;
  for (let axis = 0; axis < 4; axis++) {
    const axisX = axis === 0 ? aCos : axis === 1 ? -aSin : axis === 2 ? bCos : -bSin;
    const axisY = axis === 0 ? aSin : axis === 1 ? aCos : axis === 2 ? bSin : bCos;
    const reachA = aHl * Math.abs(aCos * axisX + aSin * axisY)
      + aHw * Math.abs(-aSin * axisX + aCos * axisY);
    const reachB = bHl * Math.abs(bCos * axisX + bSin * axisY)
      + bHw * Math.abs(-bSin * axisX + bCos * axisY);
    const gap = dx * axisX + dy * axisY, overlap = reachA + reachB - Math.abs(gap);
    if (overlap <= 0) return false;
    if (overlap < best) {
      best = overlap;
      const sign = gap >= 0 ? 1 : -1;
      nx = axisX * sign;
      ny = axisY * sign;   // n points from the first car to the second
    }
  }
  const massA = firstCar.spec.mass, massB = secondCar.spec.mass,
    invMassSum = 1 / massA + 1 / massB;
  // separate, split by mass (the lighter car moves more)
  firstCar.x -= nx * best * (1 / massA) / invMassSum;
  firstCar.y -= ny * best * (1 / massA) / invMassSum;
  secondCar.x += nx * best * (1 / massB) / invMassSum;
  secondCar.y += ny * best * (1 / massB) / invMassSum;
  // contact point: halfway between the two centres, moved onto the contact line
  const contactX = (firstCar.x + secondCar.x) / 2, contactY = (firstCar.y + secondCar.y) / 2;
  const rax = contactX - firstCar.x, ray = contactY - firstCar.y,
    rbx = contactX - secondCar.x, rby = contactY - secondCar.y;
  // point velocities (v + w x r)
  const vax = firstCar.vx - firstCar.yawRate * ray, vay = firstCar.vy + firstCar.yawRate * rax;
  const vbx = secondCar.vx - secondCar.yawRate * rby, vby = secondCar.vy + secondCar.yawRate * rbx;
  const rvx = vbx - vax, rvy = vby - vay, normalSpeed = rvx * nx + rvy * ny;
  if (normalSpeed >= 0) return true;                       // already separating
  const inertiaA = massA * (firstCar.spec.len ** 2 + firstCar.spec.wid ** 2) / 12,
    inertiaB = massB * (secondCar.spec.len ** 2 + secondCar.spec.wid ** 2) / 12;
  const raxn = rax * ny - ray * nx, rbxn = rbx * ny - rby * nx;
  const jolt = -(1 + CAR_E) * normalSpeed
    / (invMassSum + raxn * raxn / inertiaA + rbxn * rbxn / inertiaB);
  const joltX = nx * jolt, joltY = ny * jolt;
  firstCar.vx -= joltX / massA;
  firstCar.vy -= joltY / massA;
  secondCar.vx += joltX / massB;
  secondCar.vy += joltY / massB;
  firstCar.yawRate -= (rax * joltY - ray * joltX) / inertiaA;
  secondCar.yawRate += (rbx * joltY - rby * joltX) / inertiaB;
  // scrub: a little of the sideways relative speed, split by mass
  const tangentX = -ny, tangentY = nx,
    tangentSpeed = rvx * tangentX + rvy * tangentY,
    tangentImpulse = -tangentSpeed * CAR_SCRAPE / invMassSum;
  firstCar.vx -= tangentX * tangentImpulse / massA;
  firstCar.vy -= tangentY * tangentImpulse / massA;
  secondCar.vx += tangentX * tangentImpulse / massB;
  secondCar.vy += tangentY * tangentImpulse / massB;
  const hit = Math.min(1, -normalSpeed * 0.08);
  firstCar.shake = Math.min(1, (firstCar.shake || 0) + hit);
  secondCar.shake = Math.min(1, (secondCar.shake || 0) + hit);
  return true;
}

// every pair once
export function carContacts(cars) {
  let count = 0;
  for (let i = 0; i < cars.length; i++)
    for (let other = i + 1; other < cars.length; other++)
      if (carContact(cars[i], cars[other])) count++;
  return count;
}

// SLIPSTREAM (AI stage 3): a car in another's WAKE loses drag — the tow that lets a
// follower close up on a straight and try a pass into the next braking zone (stage 2's circuits
// were processions: 3 held passes in a 6-car, 3-lap race). The wake runs DRAFT_LEN m back from a
// car above DRAFT_V m/s, DRAFT_W m wide; the cut is largest right behind it and fades to 0 at
// the end. Sets car.dragMul (vehicle.js reads it; default 1 = no tow). Every car, the player too.
const DRAFT_LEN = 28, DRAFT_W = 1.6, DRAFT_MAX = 0.45, DRAFT_V = 12;
export function slipstream(cars) {
  for (const car of cars) {
    let cut = 0;
    const cosHeading = Math.cos(car.heading), sinHeading = Math.sin(car.heading);
    for (const other of cars) {
      if (other === car || other.vx * other.vx + other.vy * other.vy < DRAFT_V * DRAFT_V) continue;
      const relX = other.x - car.x, relY = other.y - car.y,
        forward = relX * cosHeading + relY * sinHeading;
      if (forward < 3 || forward > DRAFT_LEN) continue;
      const alignment = Math.cos(other.heading) * cosHeading + Math.sin(other.heading) * sinHeading;
      if (alignment < 0.9) continue;   // same direction only
      const lateral = Math.abs(-relX * sinHeading + relY * cosHeading);
      if (lateral > DRAFT_W) continue;
      cut = Math.max(
        cut, DRAFT_MAX * (1 - (forward - 3) / (DRAFT_LEN - 3)) * (1 - 0.5 * lateral / DRAFT_W));
    }
    car.dragMul = 1 - cut;
  }
}