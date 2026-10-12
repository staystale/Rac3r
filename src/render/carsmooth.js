// The old VECTOR car (render.js split, phase 4), drawn only with ?smooth=1.
import { shade } from "../render.js";   // hoisted, only called at draw time (no cycle)

const CAR_REF_PPM = 22;         // the car is authored at this px/m and scaled as a unit

export function createCarSmooth(view, cam, helpers) {
  const { PPMz, sx, sy, roundRect } = helpers;
  // ---------------------------------------------------------------- the car
  function wheel(g, lengthM, widthM, ppm, steer) {
    g.save();
    g.rotate(steer);
    const l = lengthM * ppm, w = widthM * ppm;
    // tyre rubber
    g.fillStyle = '#222328';
    roundRect(g, -l / 2, -w / 2, l, w, Math.min(w / 2, 3));
    g.fill();
    // High-contrast rim/tyre border so tyre silhouette never blends into asphalt
    g.strokeStyle = '#5a5f70';
    g.lineWidth = 1.0;
    g.stroke();

    // Lighter face + rim hint
    g.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(g, -l * 0.28, -w * 0.30, l * 0.56, w * 0.60, 1.5);
    g.fill();

    // Metallic center lock nut
    g.fillStyle = '#b4bac8';
    g.beginPath();
    g.arc(0, 0, Math.min(2.5, w * 0.20), 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawCar(car, wallT) {
    const s = car.spec;
    const px = sx(car.x), py = sy(car.y);
    const L = s.len, Wd = s.wid;

    view.ctx.save();
    view.ctx.translate(px, py);
    view.ctx.rotate(car.heading);          // +x is forward, +y is the car's right

    // THE WHOLE CAR IS DRAWN AT A FIXED REFERENCE SCALE and then transformed to size.
    //
    // MEASURED BUG, 2026-09-28 (user: "the details on it still morph with zoom"). The body outline was
    // built from metres x ppm, but the DETAIL — shut lines, lights, mirrors, wing thickness, corner
    // radii, stroke widths — was written in raw pixels. So as the camera zoomed the shell scaled and
    // the details did not, and the car visibly changed proportion. Fixing the literals one by one would
    // have missed some; scaling the canvas instead means nothing CAN be missed, now or later.
    // HEIGHT: a top-down view has no vertical axis, so the cues are SIZE and SHADOW SEPARATION — the
    // car rides up toward the camera and its shadow slides out from under it.
    //
    // REWRITTEN 2026-09-28 (user: "jumping over the jump looks weird and poor... it should be small,
    // and it should be more of a feeling"). This used to read a jump TIMER and play a sine arc off it,
    // which is exactly why it read as an animation. It now reads car.z — the body's actual height in
    // metres, out of the suspension — so the picture is a readout of the physics and nothing else. A
    // kerb gives a few centimetres and barely changes the size; the shadow is what you notice. Only a
    // real launch gets big, and then it gets big because the car really is up there.
    const lift = Math.max(0, Math.min(1, car.z / 0.7));
    const u = (PPMz() / CAR_REF_PPM) * (1 + lift * 0.10);
    view.ctx.scale(u, u);
    const ppm = CAR_REF_PPM;   // everything below is authored at this scale and scaled as a whole
    const half = (Wd / 2) * ppm;
    const nose = (L / 2) * ppm, tail = -(L / 2) * ppm;

    // ---- contact shadow. MEASURED BUG, 2026-09-27 (photographed): this un-rotated the context so the
    // shadow stayed axis-aligned to the WORLD, and a cornering car trailed a grey slab at a completely
    // different angle to its own body. The shadow keeps the car's shape and rotation; only the light
    // DIRECTION is fixed, so the offset is rotated into car space instead.
    const lightWx = 3.5 + lift * 16, lightWy = 4.5 + lift * 20;   // shadow falls away as the car rises
    const ox = lightWx * Math.cos(-car.heading) - lightWy * Math.sin(-car.heading);
    const oy = lightWx * Math.sin(-car.heading) + lightWy * Math.cos(-car.heading);
    view.ctx.save();
    view.ctx.fillStyle = lift > 0.02 ? 'rgba(28,26,36,' + (0.17 + lift * 0.12).toFixed(3) + ')' : 'rgba(28,26,36,0.17)';
    roundRect(view.ctx, tail + ox, -half * 0.98 + oy, nose - tail, half * 1.96, 7);
    view.ctx.fill();
    view.ctx.restore();

    // Wheels sit at the body edge, drawn UNDER the bodywork. MEASURED BUG, 2026-09-28 (user:
    // "rally cars front wheels do not look like they turn"): the wheels sit at trackWidth/2, which is
    // INSIDE the bodywork, so they were almost entirely hidden — and the rally car's new arch
    // extensions covered the last sliver. Which way the front wheels point is the single most important
    // readability cue in a top-down driving game (it is written in the header of this file), so it
    // cannot be something the bodywork is allowed to hide.
    const drawWheels = () => {
      const isTrack = s.kind === 'track';
      const vhw = Math.max((s.trackWidth / 2) * ppm, half * (isTrack ? 1.05 : 1.0));
      for (const [ax, side, st] of [
        [s.lf, -1, car.delta], [s.lf, 1, car.delta], [-s.lr, -1, 0], [-s.lr, 1, 0],
      ]) {
        const curWw = isTrack ? (ax > 0 ? 0.31 : 0.42) : 0.26;
        const curWl = isTrack ? (ax > 0 ? 0.72 : 0.76) : 0.72;
        view.ctx.save();
        view.ctx.translate(ax * ppm, side * vhw);
        wheel(view.ctx, curWl, curWw, ppm, st);
        view.ctx.restore();
      }
    };

    // ---- body roll and pitch: shift the shell a whisker against the wheels using the accelerations we
    //      already compute. Costs two lines and sells the weight of the car (§4: surface state you are
    //      already computing).
    const rollPx = Math.max(-2.2, Math.min(2.2, (car.t.ay || 0) * 0.06));
    const pitchPx = Math.max(-2.2, Math.min(2.2, -(car.t.ax || 0) * 0.06));
    view.ctx.translate(pitchPx, rollPx);

    drawWheels();     // UNDER the bodywork — see the note above drawWheels

    const kind = s.kind;
    const bodyR = kind === 'track' ? 3 : 5;

    // ---- silhouette. Each kind gets its own proportions; `track` is authentic open-wheel F1.
    if (kind === 'track') {
      const vhw = Math.max((s.trackWidth / 2) * ppm, half * 1.05);
      // 1. Suspension wishbones: bright metallic graphite with high contrast
      view.ctx.strokeStyle = '#787e90';
      view.ctx.lineWidth = 1.6;
      for (const [ax, side] of [
        [s.lf, -1], [s.lf, 1], [-s.lr, -1], [-s.lr, 1],
      ]) {
        const wx = ax * ppm, wy = side * vhw;
        view.ctx.beginPath();
        view.ctx.moveTo(ax * ppm * 0.45, side * half * 0.35);
        view.ctx.lineTo(wx, wy);
        view.ctx.moveTo(ax * ppm * 1.05, side * half * 0.35);
        view.ctx.lineTo(wx, wy);
        view.ctx.stroke();
      }

      // 2. Sculpted Monocoque Tub + Sidepods (Coke-bottle aerodynamic tapering)
      const tubHalf = half * 0.36;
      const podHalf = half * 0.76;
      view.ctx.fillStyle = s.paint;
      view.ctx.beginPath();
      view.ctx.moveTo(nose * 0.95, 0);
      view.ctx.lineTo(nose * 0.45, -tubHalf);
      view.ctx.lineTo(nose * 0.10, -podHalf);
      view.ctx.lineTo(tail * 0.40, -podHalf * 0.95);
      view.ctx.lineTo(tail * 0.75, -tubHalf * 1.1);
      view.ctx.lineTo(tail * 0.95, -tubHalf * 0.85);
      view.ctx.lineTo(tail * 0.95, tubHalf * 0.85);
      view.ctx.lineTo(tail * 0.75, tubHalf * 1.1);
      view.ctx.lineTo(tail * 0.40, podHalf * 0.95);
      view.ctx.lineTo(nose * 0.10, podHalf);
      view.ctx.lineTo(nose * 0.45, tubHalf);
      view.ctx.closePath();
      view.ctx.fill();
      view.ctx.strokeStyle = '#323642';
      view.ctx.lineWidth = 1.8;
      view.ctx.stroke();

      // Livery racing stripe
      view.ctx.fillStyle = '#e03434';
      view.ctx.fillRect(tail * 0.70, -2, (nose - tail) * 0.75, 4);

      // 3. Sidepod radiator dark inlets
      view.ctx.fillStyle = '#14151a';
      view.ctx.fillRect(nose * 0.08, -podHalf + 1, ppm * 0.22, podHalf * 0.28);
      view.ctx.fillRect(nose * 0.08, podHalf * 0.72 - 1, ppm * 0.22, podHalf * 0.28);

      // 4. Front multi-element aerodynamic wing with endplates
      view.ctx.fillStyle = '#2a2d36';
      roundRect(view.ctx, nose * 0.90, -half * 0.98, ppm * 0.28, half * 1.96, 2);
      view.ctx.fill();
      view.ctx.strokeStyle = '#62687a';
      view.ctx.lineWidth = 1.2;
      view.ctx.stroke();

      // Front wing red cascade flap
      view.ctx.fillStyle = '#e03434';
      roundRect(view.ctx, nose * 0.82, -half * 0.92, ppm * 0.10, half * 1.84, 1);
      view.ctx.fill();

      // Front wing endplates (bright border so they pop against asphalt)
      view.ctx.fillStyle = '#181920';
      roundRect(view.ctx, nose * 0.76, -half * 1.01, ppm * 0.42, 2.5, 1);
      view.ctx.fill();
      view.ctx.strokeStyle = '#ffffff';
      view.ctx.lineWidth = 1;
      view.ctx.stroke();

      roundRect(view.ctx, nose * 0.76, half * 0.98, ppm * 0.42, 2.5, 1);
      view.ctx.fill();
      view.ctx.strokeStyle = '#ffffff';
      view.ctx.lineWidth = 1;
      view.ctx.stroke();

      // 5. Massive rear dual-element wing with endplates & rain light
      view.ctx.fillStyle = '#2a2d36';
      roundRect(view.ctx, tail * 0.92, -half * 0.98, ppm * 0.35, half * 1.96, 2);
      view.ctx.fill();
      view.ctx.strokeStyle = '#62687a';
      view.ctx.lineWidth = 1.2;
      view.ctx.stroke();

      // Rear wing DRS flap
      view.ctx.fillStyle = '#e03434';
      roundRect(view.ctx, tail * 0.82, -half * 0.92, ppm * 0.12, half * 1.84, 1);
      view.ctx.fill();

      // Rear wing endplates
      view.ctx.fillStyle = '#181920';
      roundRect(view.ctx, tail * 1.02, -half * 1.01, ppm * 0.50, 2.5, 1);
      view.ctx.fill();
      view.ctx.strokeStyle = '#ffffff';
      view.ctx.lineWidth = 1;
      view.ctx.stroke();

      roundRect(view.ctx, tail * 1.02, half * 0.98, ppm * 0.50, 2.5, 1);
      view.ctx.fill();
      view.ctx.strokeStyle = '#ffffff';
      view.ctx.lineWidth = 1;
      view.ctx.stroke();

      // Rear red LED rain / hazard safety light
      view.ctx.fillStyle = '#ff2222';
      view.ctx.beginPath();
      view.ctx.arc(tail * 0.98, 0, 2.5, 0, Math.PI * 2);
      view.ctx.fill();

      // 6. Cockpit, Halo structure & Driver Helmet
      view.ctx.fillStyle = '#15161c';
      view.ctx.beginPath();
      view.ctx.ellipse(-ppm * 0.08, 0, ppm * 0.38, tubHalf * 0.75, 0, 0, Math.PI * 2);
      view.ctx.fill();

      view.ctx.fillStyle = '#f0c030';
      view.ctx.beginPath();
      view.ctx.arc(-ppm * 0.10, 0, ppm * 0.18, 0, Math.PI * 2);
      view.ctx.fill();
      view.ctx.fillStyle = '#1c2230';
      view.ctx.fillRect(-ppm * 0.04, -ppm * 0.10, ppm * 0.08, ppm * 0.20);

      view.ctx.strokeStyle = '#282930';
      view.ctx.lineWidth = 2.2;
      view.ctx.beginPath();
      view.ctx.moveTo(-ppm * 0.32, -tubHalf * 0.7);
      view.ctx.lineTo(ppm * 0.14, 0);
      view.ctx.lineTo(-ppm * 0.32, tubHalf * 0.7);
      view.ctx.stroke();

      // Engine airbox scoop above driver head
      view.ctx.fillStyle = '#1c1d24';
      view.ctx.beginPath();
      view.ctx.ellipse(tail * 0.36, 0, ppm * 0.16, tubHalf * 0.45, 0, 0, Math.PI * 2);
      view.ctx.fill();
    } else {
      // a proper car shell: slightly narrower at the nose, rounded, with a gradient across the width
      view.ctx.beginPath();
      view.ctx.moveTo(nose - 4, -half * 0.88);
      view.ctx.quadraticCurveTo(nose, -half * 0.88, nose, -half * 0.62);
      view.ctx.lineTo(nose, half * 0.62);
      view.ctx.quadraticCurveTo(nose, half * 0.88, nose - 4, half * 0.88);
      view.ctx.lineTo(tail + 4, half * 0.96);
      view.ctx.quadraticCurveTo(tail, half * 0.96, tail, half * 0.7);
      view.ctx.lineTo(tail, -half * 0.7);
      view.ctx.quadraticCurveTo(tail, -half * 0.96, tail + 4, -half * 0.96);
      view.ctx.closePath();
      const bg = view.ctx.createLinearGradient(0, -half, 0, half);
      bg.addColorStop(0, shade(s.paint, 1.16));
      bg.addColorStop(0.42, s.paint);
      bg.addColorStop(1, shade(s.paint, 0.74));
      view.ctx.fillStyle = bg;
      view.ctx.fill();
      // DARK RIM (§4) — this is what stops the car dissolving into a pale floor
      view.ctx.strokeStyle = shade(s.paint, 0.45);
      view.ctx.lineWidth = 1.8;
      view.ctx.stroke();

      // greenhouse: windscreen, roof, rear screen. Proportions carry the archetype.
      const cabF = kind === 'muscle' ? 0.02 : kind === 'estate' ? 0.20 : 0.16;
      const cabR = kind === 'estate' ? -0.44 : kind === 'muscle' ? -0.40 : -0.36;
      const gh = half * 0.74;
      view.ctx.fillStyle = s.glass;
      view.ctx.beginPath();
      view.ctx.moveTo(L * cabF * ppm, -gh * 0.80);
      view.ctx.lineTo(L * cabF * ppm + 3, gh * 0.80);
      view.ctx.lineTo(L * cabR * ppm, gh);
      view.ctx.lineTo(L * cabR * ppm, -gh);
      view.ctx.closePath();
      view.ctx.fill();
      // roof panel in body colour over the middle of the greenhouse
      view.ctx.fillStyle = shade(s.paint, 1.04);
      const rf = L * (cabF - 0.06) * ppm, rr = L * (cabR + 0.06) * ppm;
      roundRect(view.ctx, rr, -gh * 0.92, rf - rr, gh * 1.84, 3);
      view.ctx.fill();
      view.ctx.strokeStyle = shade(s.paint, 0.55); view.ctx.lineWidth = 1; view.ctx.stroke();

      // estate roof rails — the silhouette cue that says "estate" at a glance
      if (kind === 'estate') {
        view.ctx.fillStyle = shade(s.paint, 0.6);
        roundRect(view.ctx, L * cabR * ppm, -gh * 0.95, (L * cabF - L * cabR) * ppm, 2, 1); view.ctx.fill();
        roundRect(view.ctx, L * cabR * ppm, gh * 0.95 - 2, (L * cabF - L * cabR) * ppm, 2, 1); view.ctx.fill();
      }
      // RALLY: roof scoop, bonnet vents, a big rear wing and arch extensions. The silhouette has to say
      // "rally car" at phone size, so it is all read from the outline rather than from detail.
      if (kind === 'rally') {
        // wide arch extensions, front and rear
        view.ctx.fillStyle = shade(s.paint, 0.62);
        for (const ax of [s.lf * ppm, -s.lr * ppm]) {
          roundRect(view.ctx, ax - 9, -half * 1.06, 18, half * 0.22, 2); view.ctx.fill();
          roundRect(view.ctx, ax - 9, half * 0.84, 18, half * 0.22, 2); view.ctx.fill();
        }
        // rear wing on end plates, clear of the body
        view.ctx.fillStyle = shade(s.paint, 0.5);
        roundRect(view.ctx, tail + 1, -half * 1.02, 6, half * 2.04, 2); view.ctx.fill();
        view.ctx.fillStyle = s.trim;
        roundRect(view.ctx, tail + 0, -half * 1.02, 3, 5, 1); view.ctx.fill();
        roundRect(view.ctx, tail + 0, half * 1.02 - 5, 3, 5, 1); view.ctx.fill();
        // roof scoop
        view.ctx.fillStyle = shade(s.paint, 0.55);
        roundRect(view.ctx, L * 0.04 * ppm, -half * 0.22, 10, half * 0.44, 2); view.ctx.fill();
        // bonnet vents
        view.ctx.fillStyle = 'rgba(24,22,30,0.55)';
        roundRect(view.ctx, nose - 17, -half * 0.42, 7, half * 0.20, 1); view.ctx.fill();
        roundRect(view.ctx, nose - 17, half * 0.22, 7, half * 0.20, 1); view.ctx.fill();
        // bonnet light pod
        view.ctx.fillStyle = '#fff4d2';
        roundRect(view.ctx, nose - 11, -half * 0.30, 5, half * 0.60, 2); view.ctx.fill();
      }
      // muscle car bonnet stripes + scoop
      if (kind === 'muscle') {
        view.ctx.fillStyle = 'rgba(28,26,32,0.55)';
        roundRect(view.ctx, L * 0.06 * ppm, -half * 0.30, nose - L * 0.06 * ppm - 2, half * 0.16, 1); view.ctx.fill();
        roundRect(view.ctx, L * 0.06 * ppm, half * 0.14, nose - L * 0.06 * ppm - 2, half * 0.16, 1); view.ctx.fill();
        view.ctx.fillStyle = shade(s.paint, 0.5);
        roundRect(view.ctx, L * 0.16 * ppm, -half * 0.34, 8, half * 0.68, 2); view.ctx.fill();
      }
      // tractor: wide rear fenders, yellow front grille, exhaust stack
      if (kind === 'tractor') {
        view.ctx.fillStyle = shade(s.paint, 0.65);
        roundRect(view.ctx, -s.lr * ppm - 10, -half * 1.08, 22, half * 0.32, 2); view.ctx.fill();
        roundRect(view.ctx, -s.lr * ppm - 10, half * 0.76, 22, half * 0.32, 2); view.ctx.fill();
        view.ctx.fillStyle = '#1e2024';
        view.ctx.beginPath(); view.ctx.arc(nose * 0.35, -half * 0.45, 3.5, 0, Math.PI * 2); view.ctx.fill();
        view.ctx.fillStyle = s.trim;
        roundRect(view.ctx, nose - 4, -half * 0.45, 3, half * 0.9, 1); view.ctx.fill();
      }

      // panel shut lines — cheap detail that reads as "a made object"
      view.ctx.strokeStyle = 'rgba(30,28,36,0.22)';
      view.ctx.lineWidth = 1;
      view.ctx.beginPath();
      view.ctx.moveTo(L * cabF * ppm, -half * 0.86); view.ctx.lineTo(L * cabF * ppm, half * 0.86);
      view.ctx.moveTo(L * cabR * ppm, -half * 0.9); view.ctx.lineTo(L * cabR * ppm, half * 0.9);
      view.ctx.stroke();

      // wing mirrors
      view.ctx.fillStyle = shade(s.paint, 0.8);
      roundRect(view.ctx, L * (cabF - 0.01) * ppm, -half * 1.04, 4, 3, 1); view.ctx.fill();
      roundRect(view.ctx, L * (cabF - 0.01) * ppm, half * 1.04 - 3, 4, 3, 1); view.ctx.fill();

      // lights: warm at the front, red at the back. The front end must be unmistakable.
      view.ctx.fillStyle = '#fff6dc';
      roundRect(view.ctx, nose - 5, -half * 0.58, 4, half * 0.30, 1.5); view.ctx.fill();
      roundRect(view.ctx, nose - 5, half * 0.28, 4, half * 0.30, 1.5); view.ctx.fill();
      // brake lights brighten under braking — a free, honest state readout (rule 10)
      const braking = car.t.lockedF || car.t.lockedR || (car.brakeLight || 0) > 0.05;
      view.ctx.fillStyle = braking ? '#ff5248' : '#a8302c';
      roundRect(view.ctx, tail + 1, -half * 0.62, 4, half * 0.34, 1.5); view.ctx.fill();
      roundRect(view.ctx, tail + 1, half * 0.28, 4, half * 0.34, 1.5); view.ctx.fill();
      if (braking) {
        view.ctx.globalAlpha = 0.5;
        view.ctx.fillStyle = '#ff6a60';
        roundRect(view.ctx, tail - 1, -half * 0.7, 7, half * 1.4, 2); view.ctx.fill();
        view.ctx.globalAlpha = 1;
      }

      // specular streak down the shoulder — the "realistic" bit; keep it subtle
      const sp = view.ctx.createLinearGradient(tail, 0, nose, 0);
      sp.addColorStop(0, 'rgba(255,255,255,0)');
      sp.addColorStop(0.5, 'rgba(255,255,255,0.30)');
      sp.addColorStop(1, 'rgba(255,255,255,0)');
      view.ctx.fillStyle = sp;
      roundRect(view.ctx, tail + 6, -half * 0.80, nose - tail - 12, 2.2, 1);
      view.ctx.fill();
    }

    view.ctx.restore();
  }

  return { drawCar };
}
