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
