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
  glGround: boolean;             // ?glground=0: the ground tiles in the 2D art buffer, not WebGL
  gpuPaint: boolean;             // ?gpupaint=1: floor and zones painted by the GPU (glpaint.ts)
  zoomHold: boolean;             // ?zoomhold=1: the speed zoom holds, then glides (camera.ts)
  noShade: boolean;              // ?noshade: skip the hill shading (perf A/B)
  grassEnds: "round" | "square";   // ?grass=square: square grass blade ends (cheaper; A/B)
  surfaceTextures: boolean;       // ?tex=0: paint surfaces live, not pre-painted textures (A/B)
  meter: boolean;   // ?meter=1: on-screen frame meter (perf, phone)
  report: boolean;  // ?report=1: the meter's frames posted to the test server (ui/report.ts)
  audio: boolean;   // ?noaudio=1: never start Web Audio (phone judder test)
  keepFrame: boolean;   // ?keepframe=1 (tools): the GPU canvas keeps its frame to be read back
  vsync: boolean;   // ?vsync=0: no frame pacing (default on: whole display refreshes, pacing.ts)
  noNatClear: boolean;   // ?nonat=1: the highway slide keeps the terrain height cache (judder test)
  skipLayers: Set<string>;   // ?skip=props,barriers: layers not drawn (phone judder bisect)
  churn: '' | 'pictures' | 'objects';   // ?churn=: judder mechanism test (memory churn)
  autopilot: boolean;   // ?autopilot=1: the AI drives the player car (phone frame tests, no touch)
  autopilotKmh: number;   // ?autopilot=120: hold the autopilot car at this speed (0 = no cap)
}

function autopilotKmh(params: URLSearchParams): number {
  const kmh = +(params.get('autopilot') || 0);
  return kmh > 1 ? kmh : 0;
}

function churnKind(params: URLSearchParams): '' | 'pictures' | 'objects' {
  const kind = params.get('churn');
  return kind === 'pictures' || kind === 'objects' ? kind : '';
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
    glGround: params.get('glground') !== '0',
    gpuPaint: params.get('gpupaint') === '1',
    zoomHold: params.get('zoomhold') === '1',
    noShade: params.has('noshade'),
    grassEnds: params.get('grass') === 'square' ? 'square' : 'round',
    surfaceTextures: params.get('tex') !== '0',
    meter: params.get('meter') === '1' || params.get('report') === '1',
    report: params.get('report') === '1',
    vsync: params.get('vsync') !== '0',
    audio: params.get('noaudio') !== '1',
    keepFrame: params.has('keepframe'),
    autopilot: params.get('autopilot') === '1' || autopilotKmh(params) > 0,
    autopilotKmh: autopilotKmh(params),
    churn: churnKind(params),
    noNatClear: params.get('nonat') === '1',
    skipLayers: new Set((params.get('skip') || '').split(',').filter(Boolean)),
  };
}
