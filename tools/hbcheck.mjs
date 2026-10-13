// The user STILL reports going backwards on the handbrake. My benches said it holds — but they have
// been wrong about this twice by assuming a perfect counter-steer. Test the honest cases.
import { makeCar, step, reset, neutralInput, DT } from '../src/vehicle.js';
import { CAR_IDS } from '../src/cars.ts';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

function run(id, v0, hbMs, mode) {
  const car = makeCar(id); reset(car,0,0,0);
  car.vx = v0; car.gear = 4; car.rpm = 5000;
  const inp = { ...neutralInput() };
  let peak=0, minV=99, backSteps=0; const hist=[];
  for (let i=0;i<120*6;i++){
    const t=i*DT;
    const beta = Math.atan2(car.t.vLat, car.t.vLong); hist.push(beta);
    const d = hist[Math.max(0,hist.length-1-Math.round(0.25/DT))];
    // progressive handbrake exactly as input.js ramps it (0.1 s slew both ways)
    const hbT = t < hbMs/1000 ? 1 : 0;
    inp.handbrake = clamp((inp.handbrake||0) + clamp(hbT - (inp.handbrake||0), -DT/0.10, DT/0.10), 0, 1);
    if (mode === 'hold')        inp.steer = 0.9;                       // panic: keep the lock on
    else if (mode === 'centre') inp.steer = t < hbMs/1000 ? 0.9 : 0;   // let go of the wheel
    else                        inp.steer = t < hbMs/1000 ? 0.9 : clamp(d*2.0,-1,1);
    inp.throttle = t > hbMs/1000 + 0.2 ? 0.8 : 0;
    if (process.env.FOOTBRAKE) { inp.brake = inp.handbrake; inp.handbrake = 0; }
    step(car,inp,DT);
    peak = Math.max(peak, Math.abs(Math.atan2(car.t.vLat, car.t.vLong)*57.3));
    minV = Math.min(minV, car.t.vLong);
    if (car.t.vLong < -0.5) backSteps++;
  }
  return { peak, minV, backSteps };
}
for (const mode of ['hold','centre','counter']) {
  console.log(`\n--- steering after the flick: ${mode.toUpperCase()}`);
  console.log('car             20m/s 600ms        28m/s 600ms        28m/s 1000ms');
  for (const id of CAR_IDS) {
    const cells = [[20,600],[28,600],[28,1000]].map(([v,ms]) => {
      const r = run(id, v, ms, mode);
      return `${r.peak.toFixed(0).padStart(3)}deg ${r.minV < -0.5 ? 'BACK '+String(r.backSteps).padStart(3) : ' ok      '}`;
    });
    console.log(`${id.padEnd(13)} ${cells.join('  ')}`);
  }
}
