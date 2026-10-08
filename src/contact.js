// contact.js — CAR-TO-CAR CONTACT (2026-10-04, AI stage 1; user: "full contact"). Every pair of cars is tested as two oriented boxes with
// the separating-axis test (the same test solidClamp uses for props). On overlap: the two are pushed apart along the axis of least
// overlap, split by mass; if they are closing, an impulse along that axis (restitution CAR_E), a little sideways scrub (CAR_SCRAPE), and
// a yaw kick from where the contact is relative to each centre — so a tap on the rear quarter turns a car, a straight shunt does not.
// Damage comes later (roadmap F); this only moves cars. Units: metres, seconds, kg.
const CAR_E = 0.25;         // bounciness of a car-to-car hit
const CAR_SCRAPE = 0.12;    // share of the sideways relative speed removed per contact (door-rubbing friction)

function axes(car) {
  const c = Math.cos(car.heading), s = Math.sin(car.heading);
  return { c, s, hl: car.spec.len * 0.48, hw: car.spec.wid * 0.48 };
}

// returns true if they touched (for sound / shake / tools)
export function carContact(a, b) {
  const A = axes(a), B = axes(b);
  const dx = b.x - a.x, dy = b.y - a.y;
  const rA = Math.hypot(A.hl, A.hw), rB = Math.hypot(B.hl, B.hw);
  if (dx * dx + dy * dy > (rA + rB) ** 2) return false;
  let best = Infinity, nx = 0, ny = 0;
  for (const [ux, uy] of [[A.c, A.s], [-A.s, A.c], [B.c, B.s], [-B.s, B.c]]) {
    const pa = A.hl * Math.abs(A.c * ux + A.s * uy) + A.hw * Math.abs(-A.s * ux + A.c * uy);
    const pb = B.hl * Math.abs(B.c * ux + B.s * uy) + B.hw * Math.abs(-B.s * ux + B.c * uy);
    const d = dx * ux + dy * uy, ov = pa + pb - Math.abs(d);
    if (ov <= 0) return false;
    if (ov < best) { best = ov; const sg = d >= 0 ? 1 : -1; nx = ux * sg; ny = uy * sg; }   // n points from a to b
  }
  const ma = a.spec.mass, mb = b.spec.mass, im = 1 / ma + 1 / mb;
  // separate, split by mass (the lighter car moves more)
  a.x -= nx * best * (1 / ma) / im; a.y -= ny * best * (1 / ma) / im;
  b.x += nx * best * (1 / mb) / im; b.y += ny * best * (1 / mb) / im;
  // contact point: halfway between the two centres, moved onto the contact line
  const px = (a.x + b.x) / 2, py = (a.y + b.y) / 2;
  const rax = px - a.x, ray = py - a.y, rbx = px - b.x, rby = py - b.y;
  // point velocities (v + w x r)
  const vax = a.vx - a.yawRate * ray, vay = a.vy + a.yawRate * rax;
  const vbx = b.vx - b.yawRate * rby, vby = b.vy + b.yawRate * rbx;
  const rvx = vbx - vax, rvy = vby - vay, vn = rvx * nx + rvy * ny;
  if (vn >= 0) return true;                       // already separating
  const Ia = ma * (a.spec.len ** 2 + a.spec.wid ** 2) / 12, Ib = mb * (b.spec.len ** 2 + b.spec.wid ** 2) / 12;
  const raxn = rax * ny - ray * nx, rbxn = rbx * ny - rby * nx;
  const j = -(1 + CAR_E) * vn / (im + raxn * raxn / Ia + rbxn * rbxn / Ib);
  const jx = nx * j, jy = ny * j;
  a.vx -= jx / ma; a.vy -= jy / ma; b.vx += jx / mb; b.vy += jy / mb;
  a.yawRate -= (rax * jy - ray * jx) / Ia; b.yawRate += (rbx * jy - rby * jx) / Ib;
  // scrub: a little of the sideways relative speed, split by mass
  const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty, jt = -vt * CAR_SCRAPE / im;
  a.vx -= tx * jt / ma; a.vy -= ty * jt / ma; b.vx += tx * jt / mb; b.vy += ty * jt / mb;
  const hit = Math.min(1, -vn * 0.08);
  a.shake = Math.min(1, (a.shake || 0) + hit); b.shake = Math.min(1, (b.shake || 0) + hit);
  return true;
}

// every pair once
export function carContacts(cars) {
  let n = 0;
  for (let i = 0; i < cars.length; i++) for (let k = i + 1; k < cars.length; k++) if (carContact(cars[i], cars[k])) n++;
  return n;
}

// SLIPSTREAM (2026-10-04, AI stage 3): a car in another's WAKE loses drag — the tow that lets a follower close up on a straight and
// try a pass into the next braking zone (stage 2's circuits were processions: 3 held passes in a 6-car, 3-lap race). The wake runs
// DRAFT_LEN m back from a car above DRAFT_V m/s, DRAFT_W m wide; the cut is largest right behind it and fades to 0 at the end.
// Sets car.dragMul (vehicle.js reads it; default 1 = no tow). Every car, the player too.
const DRAFT_LEN = 28, DRAFT_W = 1.6, DRAFT_MAX = 0.45, DRAFT_V = 12;
export function slipstream(cars) {
  for (const a of cars) {
    let cut = 0; const ch = Math.cos(a.heading), sh = Math.sin(a.heading);
    for (const b of cars) {
      if (b === a || b.vx * b.vx + b.vy * b.vy < DRAFT_V * DRAFT_V) continue;
      const rx = b.x - a.x, ry = b.y - a.y, f = rx * ch + ry * sh;
      if (f < 3 || f > DRAFT_LEN) continue;
      const bh = Math.cos(b.heading) * ch + Math.sin(b.heading) * sh; if (bh < 0.9) continue;   // same direction only
      const l = Math.abs(-rx * sh + ry * ch); if (l > DRAFT_W) continue;
      cut = Math.max(cut, DRAFT_MAX * (1 - (f - 3) / (DRAFT_LEN - 3)) * (1 - 0.5 * l / DRAFT_W));
    }
    a.dragMul = 1 - cut;
  }
}
