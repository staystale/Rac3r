import fs from 'node:fs';
function sub(path, old, nu) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(old)) throw new Error(`MISSING in ${path}: ${old.slice(0, 70)}`);
  fs.writeFileSync(path, s.replace(old, () => nu));
}
const W = 'src/physics/tyrewear.ts';
sub(W, `/**
 * Whether a hit on loose debris,`, `/**
 * A set's health for the tyre shop (owner 11-02: "can it show the grip reduction / puncture %
 * chance along with it, so a player can see it increase in between races"): the grip its worst
 * axle has lost, dry and on soaking ground, and the chance a minute that its most worn tyre
 * punctures from wear alone (heat above the window adds more, while driving).
 * @param wear the four tyres' wear, 0..1 (FL FR RL RR)
 * @returns the dry and wet grip lost (shares) and the puncture chance a minute
 */
export function setHealth(wear: number[]): { dryLoss: number; wetLoss: number; punctMin: number } {
  const front = [wear[0] || 0, wear[1] || 0], rear = [wear[2] || 0, wear[3] || 0];
  const dry = Math.min(wornGrip(front[0], front[1]), wornGrip(rear[0], rear[1]));
  const wet = Math.min(wornGrip(front[0], front[1], 1), wornGrip(rear[0], rear[1], 1));
  const worst = Math.max(0, Math.max(...wear) - WORN_RISK_FROM) / (1 - WORN_RISK_FROM);
  return { dryLoss: 1 - dry, wetLoss: 1 - wet,
    punctMin: 1 - Math.exp(-WORN_RISK_PER_S * worst * worst * 60) };
}

/**
 * Whether a hit on loose debris,`);
const G = 'src/menu/garage.js';
sub(G, `import { wearColour } from '../physics/tyrewear.ts';`, `import { wearColour, setHealth } from '../physics/tyrewear.ts';
import { showSpecSheet } from './specsheet.ts';`);
sub(G, `  addButton(menu, buttonRow, 'TYRES', () => showTyreShop(menu));`, `  addButton(menu, buttonRow, 'TYRES', () => showTyreShop(menu));
  addButton(menu, buttonRow, 'SPEC SHEET', () => {
    const car = ROSTER.find((x) => x.id === menu.profile.active);
    showSpecSheet(menu, car.id, car.name, () => showGarage(menu));
  });`);
sub(G, `  info.innerHTML += \`<div class="stats"><span>THIS SET</span>\`
    + \`<b style="color:\${wearColour(worn, COL)}">\${Math.round(worn * 100)}% WORN</b></div>\`;`,
`  // what the wear costs (physics/tyrewear.ts setHealth): grip lost, the puncture chance
  const health = setHealth((menu.profile.tyreWear || {})[carId] || [0, 0, 0, 0]);
  const pct = (share) => (share < 0.0005 ? '0' : (share * 100).toFixed(share < 0.1 ? 1 : 0));
  info.innerHTML += \`<div class="stats"><span>THIS SET</span>\`
    + \`<b style="color:\${wearColour(worn, COL)}">\${Math.round(worn * 100)}% WORN</b>\`
    + \`<span>GRIP LOST</span><b style="color:\${wearColour(worn, COL)}">\${pct(health.dryLoss)}% \`
    + \`DRY · \${pct(health.wetLoss)}% WET</b>\`
    + \`<span>PUNCTURE RISK</span><b style="color:\${wearColour(worn, COL)}">\`
    + (health.punctMin > 0 ? \`\${pct(health.punctMin)}% A MINUTE\` : 'NONE (UNDER 70% WORN)')
    + \`</b></div>\`
    + '<div class="sub" style="text-align:left">Hot tyres (over their window) add to the risk.'
    + '</div>';`);
console.log('ok');
