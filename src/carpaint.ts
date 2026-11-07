// carpaint.ts - ?carpaint (owner 11-07, item 4): the stock look of every car's new paint parts and
// the rims' finishes (cars.ts applyLivery / stockPaint, render/carsprite.ts).
// CHROME and GOLD: two finishes beside the palette, for every part (owner 11-07: "add gold and
// chrome too"; "can chrome and gold be for every colour body second n 3rd too")
export const RIM_FINISH: Record<string, string> = { chrome: '#d6d9df', gold: '#c9a227' };
// each car's STOCK second (trim), third and rims where the new parts need them -
// the real car's look (a roof in body colour where the real car has one). The roster's own trim
// stays for the old sprites, where it barely shows on most cars.
export const PAINT_STOCK: Record<string, { trim?: string; third?: string; rim?: string }> = {
  'hatch-fwd': { trim: '#4a8fd4', third: '#c8342a' },
  'hatch-rwd': { trim: '#e0603a', third: '#16181d' },
  'saloon-rwd': { trim: '#a9aeb6', third: '#4a4f58' },
  'wrz-awd': { trim: '#1d3f9a', third: '#1d3f9a' },
  'estate-4x4': { trim: '#4f6b52', third: '#2f4433' },
  'muscle-rwd': { third: '#b3252f' },
  'rally-4x4': { trim: '#f0f0ea', third: '#12325f' },
  'track-rwd': { third: '#e23b2e' },
  'f2-rwd': { third: '#e23b2e' },
  naffcar: { trim: '#1d3f8f', third: '#d23b2a' },
  tractor: { trim: '#2e7d32', third: '#2e7d32', rim: '#fbc02d' },
  'mini-fwd': { third: '#f0f0ea' },
  'lambo-awd': { third: '#16181d' },
  'mikra-r1': { trim: '#f0f0ea', third: '#c8342a' },
  'kit-2l': { third: '#c8342a' },
  'rx-super': { trim: '#e0603a', third: '#16181d' },
  'banger-f2': { third: '#3a3d45' },
  'grass-special': { trim: '#c9ccd4', third: '#3a3d45' },
  'drift-s13': { trim: '#f0f0ea', third: '#e86fa8' },
};
/**
 * A rim choice's colour: a palette colour, a RIM_FINISH name, or empty for the stock rims.
 * @param rims the choice
 * @returns the colour, or undefined (stock)
 */
export const rimColour = (rims?: string) => (rims ? RIM_FINISH[rims] || rims : undefined);
// ?carlooks: each car's REAL TYRES, for drawing only (owner 11-07: "vehicles tyres / rims should be
// realistic along with tyre profile"; the physics' own wheelR / tyreWidth are untouched - several
// are still the shared default): front width, rear width, tyre diameter, rim diameter, all m.
// From the size on the real car (width / profile R rim); EST where it varies by event.
export const TYRE_LOOK: Record<string, { wF: number; wR: number; dia: number; rim: number }> = {
  'hatch-fwd': { wF: 0.225, wR: 0.225, dia: 0.639, rim: 0.457 },   // 225/40 R18
  'hatch-rwd': { wF: 0.225, wR: 0.245, dia: 0.629, rim: 0.457 },   // 225/40 + 245/35 R18
  'saloon-rwd': { wF: 0.225, wR: 0.245, dia: 0.634, rim: 0.432 },   // 225/45 + 245/40 R17
  'wrz-awd': { wF: 0.225, wR: 0.225, dia: 0.634, rim: 0.432 },   // 225/45 R17
  'estate-4x4': { wF: 0.235, wR: 0.235, dia: 0.645, rim: 0.457 },   // 235/40 R18
  'muscle-rwd': { wF: 0.215, wR: 0.215, dia: 0.657, rim: 0.356 },   // F70-14 ~ 215/70 R14
  'rally-4x4': { wF: 0.225, wR: 0.225, dia: 0.613, rim: 0.406 },   // EST 225/45 R16 (tarmac)
  'track-rwd': { wF: 0.305, wR: 0.405, dia: 0.720, rim: 0.457 },   // F1 2022: 305 / 405, 720 mm
  'f2-rwd': { wF: 0.270, wR: 0.370, dia: 0.700, rim: 0.457 },   // EST F2 18-inch
  naffcar: { wF: 0.330, wR: 0.330, dia: 0.712, rim: 0.457 },   // EST Next Gen 18-inch
  tractor: { wF: 0.600, wR: 0.600, dia: 1.551, rim: 0.711 },   // 600/70 R28, all four the same
  'mini-fwd': { wF: 0.145, wR: 0.145, dia: 0.486, rim: 0.254 },   // 145/80 R10
  'lambo-awd': { wF: 0.245, wR: 0.305, dia: 0.672, rim: 0.508 },   // 245/30 + 305/30 R20
  'mikra-r1': { wF: 0.195, wR: 0.195, dia: 0.576, rim: 0.381 },   // 195/50 R15
  'kit-2l': { wF: 0.205, wR: 0.205, dia: 0.607, rim: 0.381 },   // EST 205/55 R15
  'rx-super': { wF: 0.235, wR: 0.235, dia: 0.620, rim: 0.432 },   // EST 235/40 R17
  'banger-f2': { wF: 0.185, wR: 0.205, dia: 0.552, rim: 0.330 },   // EST 185/60 + 205/60 R13
  'grass-special': { wF: 0.175, wR: 0.205, dia: 0.575, rim: 0.330 },   // EST 175/70 + 205/60 R13
  'drift-s13': { wF: 0.215, wR: 0.235, dia: 0.626, rim: 0.432 },   // EST 215/45 + 235/40 R17
};
