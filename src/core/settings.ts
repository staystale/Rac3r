// Every page-link setting (?name=value), read ONCE from location.search into one typed object.
// Parses and defaults are exactly what main.js, highway.js, render.ts and render/tiles.ts
// each did on their own.

export interface Settings {
  dev: boolean;                  // ?dev: developer mode
  carId: string | null;          // ?car=ID: the starting car, raw (main.js checks it vs CAR_IDS)
  aiCount: number;               // ?ai=N: AI cars in the race, 0-5 (default 0)
  // DIFFICULTY (PLAN.md §4: 0 Mobile game .. 4 Real; aidriver.js DIFFICULTIES): the centre of
  // the field's spread.
  aiDifficulty: number;          // ?diff=N: AI difficulty, 0-4 (default 2), or setup's row
  trafficDensity: number;        // ?traffic=X: highway traffic density, 0-1.5 (default 0.6)
  litter: number | null;         // ?litter=N: litter on endless levels, 0-3 (null = level's own)
  menu: string | null;           // ?menu=1|0: raw; 1 forces the menu, 0 skips it
  menuAi: number;                // ?menuai=N: AI cars behind the menu, 0-5 (default 4)
  guide: string | null;          // ?guide=1|0: raw; 1 forces HOW TO PLAY, 0 skips it
  rules: string | null;          // ?rules=1|0: raw; 1 forces the event rules, 0 skips them
  levelId: string | null;        // ?level=ID: the level to start on, raw (null = no ?level)
  inputMode: "touch" | "pc" | "auto";   // ?touch / ?pc: force touch or pc controls
  highwayDebug: string | null;   // ?hw=NAME: road preset of the debug highway (tools)
  noLock: boolean;               // ?nolock: pixel-locked view off (A/B for tools/wobblecheck)
  tilePx: number;                // ?tilepx=N: css px per ground tile side (default 256; A/B)
  tileGpu: boolean;              // ?tilegpu: paint tiles straight on the GPU canvas
  noShade: boolean;              // ?noshade: skip the hill shading (perf A/B)
}


export function readSettings(search: string): Settings {
  const params = new URLSearchParams(search);
  return {
    dev: params.has('dev'),
    carId: params.get('car'),
    aiCount: Math.max(0, Math.min(5, +(params.get('ai') || 0))),
    aiDifficulty: Math.max(0, Math.min(4, params.has('diff') ? +params.get('diff')! : 2)),
    trafficDensity:
      params.has('traffic') ? Math.max(0, Math.min(1.5, +params.get('traffic')!)) : 0.6,
    litter: params.has('litter') ? Math.max(0, Math.min(3, +params.get('litter')!)) : null,
    menu: params.get('menu'),
    menuAi: params.has('menuai') ? Math.max(0, Math.min(5, +params.get('menuai')!)) : 4,
    guide: params.get('guide'),
    rules: params.get('rules'),
    levelId: params.has('level') ? params.get('level') : null,
    inputMode: params.has('touch') ? 'touch' : params.has('pc') ? 'pc' : 'auto',
    highwayDebug: params.get('hw'),
    noLock: params.has('nolock'),
    // get('tilepx')!: null only means no ?tilepx=, where +null is 0 and the || falls back to 256
    tilePx: +params.get('tilepx')! || 256,
    tileGpu: params.has('tilegpu'),
    noShade: params.has('noshade'),
  };
}
