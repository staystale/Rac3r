// carpaint.ts - (owner 11-07, item 4): the stock look of every car's new paint parts and
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
  'ordi-a4': { third: '#9aa0a8' },
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
  'porch-gt3r': { third: '#16181d' },
  'bmv-m4gt3': { third: '#16181d' },
  'seven-420r': { third: '#f2a900' },
  'transfit-van': { third: '#1d3f9a' },
  'transfit-lwb': { third: '#1d3f9a' },
  'transfit-swb': { third: '#1d3f9a' },
  'transfit-custom': { third: '#1d3f9a' },
  'effing-tt': { third: '#e0603a' },
  'civvic-btcc': { third: '#16181d' },
  'toyoter-corolla': { third: '#16181d' },
  'bmv-e36peak': { third: '#1c69d4' },
  'defunder-110': { third: '#16181d' },
  'focust-st': { third: '#16181d' },
  'cleo-cup': { third: '#16181d' },
  'cleo-rs200': { third: '#16181d' },
  routemonster: { third: '#e8dcb0' },
  'skool-bus': { third: '#16181d' },
  'scanyah-r450': { third: '#16181d' },
  'saxo-kit': { third: '#1d3f9a' },
  'strange-l322': { third: '#c9ccd4' },
  'saxo-vtr': { third: '#16181d' },
  'seat-ibiza': { third: '#16181d' },
  'tesla-m3': { third: '#16181d' },
  ts010: { third: '#16181d' },
  'rebelion-r13': { third: '#c8342a' },
};
/**
 * A rim choice's colour: a palette colour, a RIM_FINISH name, or empty for the stock rims.
 * @param rims the choice
 * @returns the colour, or undefined (stock)
 */
export const rimColour = (rims?: string) => (rims ? RIM_FINISH[rims] || rims : undefined);
// each car's REAL TYRES, for drawing only (owner 11-07: "vehicles tyres / rims should be
// realistic along with tyre profile"; the physics' own wheelR / tyreWidth are untouched - several
// are still the shared default): front width, rear width, tyre diameter, rim diameter, all m.
// From the size on the real car (width / profile R rim); EST where it varies by event.
export const TYRE_LOOK: Record<string, { wF: number; wR: number; dia: number; rim: number }> = {
  'hatch-fwd': { wF: 0.225, wR: 0.225, dia: 0.639, rim: 0.457 },   // 225/40 R18
  'hatch-rwd': { wF: 0.225, wR: 0.245, dia: 0.629, rim: 0.457 },   // 225/40 + 245/35 R18
  'saloon-rwd': { wF: 0.225, wR: 0.245, dia: 0.634, rim: 0.432 },   // 225/45 + 245/40 R17
  'wrz-awd': { wF: 0.225, wR: 0.225, dia: 0.634, rim: 0.432 },   // 225/45 R17
  'estate-4x4': { wF: 0.235, wR: 0.235, dia: 0.645, rim: 0.457 },   // 235/40 R18
  'ordi-a4': { wF: 0.225, wR: 0.225, dia: 0.654, rim: 0.406 },   // EST 225/55 R16
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
  // 30/68-18 + 31/71-18 (one diameter: the mean of 680 and 710 mm)
  'porch-gt3r': { wF: 0.300, wR: 0.310, dia: 0.695, rim: 0.457 },
  'bmv-m4gt3': { wF: 0.300, wR: 0.310, dia: 0.71, rim: 0.457 },   // 30/68-18, 31/71-18
  'seven-420r': { wF: 0.195, wR: 0.195, dia: 0.576, rim: 0.381 },   // 195/50 R15
  'transfit-van': { wF: 0.215, wR: 0.215, dia: 0.660, rim: 0.381 },   // 215/65 R15
  'transfit-lwb': { wF: 0.235, wR: 0.235, dia: 0.712, rim: 0.406 },   // EST 235/65 R16
  'transfit-swb': { wF: 0.195, wR: 0.195, dia: 0.654, rim: 0.381 },   // EST 195/70 R15
  'transfit-custom': { wF: 0.215, wR: 0.215, dia: 0.686, rim: 0.406 },   // EST 215/65 R16
  'effing-tt': { wF: 0.343, wR: 0.343, dia: 0.991, rim: 0.432 },   // EST 39 x 13.5 R17
  'civvic-btcc': { wF: 0.265, wR: 0.265, dia: 0.66, rim: 0.457 },   // 265/660 R18
  'toyoter-corolla': { wF: 0.265, wR: 0.265, dia: 0.66, rim: 0.457 },   // 265/660 R18
  'bmv-e36peak': { wF: 0.33, wR: 0.33, dia: 0.68, rim: 0.457 },   // EST 330/680-18
  'defunder-110': { wF: 0.235, wR: 0.235, dia: 0.806, rim: 0.406 },   // 235/85 R16
  'focust-st': { wF: 0.235, wR: 0.235, dia: 0.647, rim: 0.483 },   // 235/35 R19
  'cleo-cup': { wF: 0.2, wR: 0.2, dia: 0.62, rim: 0.432 },   // 20/62-17
  routemonster: { wF: 0.27, wR: 0.54, dia: 1.03, rim: 0.508 },   // 10.00-20, twin at the rear
  'skool-bus': { wF: 0.28, wR: 0.56, dia: 1.05, rim: 0.572 },   // 11R22.5, twin at the rear
  'scanyah-r450': { wF: 0.315, wR: 0.63, dia: 1.01, rim: 0.572 },   // 315/70 R22.5, twins
  'saxo-kit': { wF: 0.205, wR: 0.205, dia: 0.607, rim: 0.381 },   // EST 205/55 R15
  'strange-l322': { wF: 0.255, wR: 0.255, dia: 0.763, rim: 0.483 },   // EST 255/55 R19
  'saxo-vtr': { wF: 0.185, wR: 0.185, dia: 0.559, rim: 0.356 },   // 185/55 R14
  'seat-ibiza': { wF: 0.185, wR: 0.185, dia: 0.603, rim: 0.381 },   // EST 185/60 R15
  'tesla-m3': { wF: 0.235, wR: 0.235, dia: 0.669, rim: 0.457 },   // EST 235/45 R18
  'cleo-rs200': { wF: 0.215, wR: 0.215, dia: 0.625, rim: 0.432 },   // 215/45 R17
  ts010: { wF: 0.29, wR: 0.355, dia: 0.71, rim: 0.457 },   // EST 290/640-17, 355/710-18
  'rebelion-r13': { wF: 0.3, wR: 0.31, dia: 0.71, rim: 0.457 },   // EST 30/68-18, 31/71-18
};
