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
  tilePx: number;                // ?tilepx=N: css px per ground tile side (default 256; A/B)
  rain: number | null;           // ?rain=0.6: the track this wet, 0-1, and raining (weather test)
  night: number | null;          // ?night=0.8: this dark, 0-1 (lighting test, world/daylight.ts)
  maxDpr: number | null;         // ?dpr=2: the sharpness cap (default render.ts MAX_DPR 1.5)
  noShade: boolean;              // ?noshade: skip the hill shading (perf A/B)
  meter: boolean;   // ?meter=1 or ?report=1: the frame meter records each frame
  meterOverlay: boolean;   // ?meter=1 only: the meter's graph drawn on screen
  report: boolean;  // ?report=1: the meter's frames posted to the test server (ui/report.ts)
  audio: boolean;   // ?noaudio=1: never start Web Audio (phone judder test)
  noNatClear: boolean;   // ?nonat=1: the highway slide keeps the terrain height cache (judder test)
  skipLayers: Set<string>;   // ?skip=props,barriers: layers not drawn (phone judder bisect)
  churn: '' | 'pictures' | 'objects';   // ?churn=: judder mechanism test (memory churn)
  autopilot: boolean;   // ?autopilot=1: the AI drives the player car (phone frame tests, no touch)
  autopilotKmh: number;   // ?autopilot=120: hold the autopilot car at this speed (0 = no cap)
  hwLead: boolean;   // ?hwlead=1: PULLING AWAY only when you really lead (A11, ai/hwFlow.ts)
}

function autopilotKmh(params: URLSearchParams): number {
  const kmh = +(params.get('autopilot') || 0);
  return kmh > 1 ? kmh : 0;
}

// ?rain=: how wet the track is (and how hard it rains), 0-1; ?rain alone = 0.6
function rainLevel(params: URLSearchParams): number | null {
  if (!params.has('rain')) return null;
  const level = params.get('rain') === '' ? 0.6 : +params.get('rain')!;
  return Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : null;
}

// ?night=: how dark it is, 0-1 (the night layer and the field's headlights); ?night alone = 0.8
function nightLevel(params: URLSearchParams): number | null {
  if (!params.has('night')) return null;
  const level = params.get('night') === '' ? 0.8 : +params.get('night')!;
  return Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : null;
}

// the weather test tools: ?rain= a fixed wet track, ?night= a fixed dark
function weatherSettings(params: URLSearchParams) {
  return { rain: rainLevel(params), night: nightLevel(params) };
}

function churnKind(params: URLSearchParams): '' | 'pictures' | 'objects' {
  const kind = params.get('churn');
  return kind === 'pictures' || kind === 'objects' ? kind : '';
}

// ?dpr=: the screen sharpness cap, 1-2 device px per CSS px (default render.ts MAX_DPR)
function maxDpr(params: URLSearchParams): number | null {
  if (!params.has('dpr')) return null;
  return Math.max(1, Math.min(2, +params.get('dpr')! || 2));
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
    // get('tilepx')!: null only means no ?tilepx=, where +null is 0 and the || falls back to 256
    tilePx: +params.get('tilepx')! || 256,
    ...weatherSettings(params),
    maxDpr: maxDpr(params),
    noShade: params.has('noshade'),
    meter: params.get('meter') === '1' || params.get('report') === '1',
    report: params.get('report') === '1',
    // ?report=1 alone records without the graph: a full-resolution graph redrawn every frame may
    // itself cost frames on the phone (its drawing is outside the timings it reports)
    meterOverlay: params.get('meter') === '1',
    audio: params.get('noaudio') !== '1',
    autopilot: params.get('autopilot') === '1' || autopilotKmh(params) > 0,
    autopilotKmh: autopilotKmh(params),
    churn: churnKind(params),
    noNatClear: params.get('nonat') === '1',
    skipLayers: new Set((params.get('skip') || '').split(',').filter(Boolean)),
    hwLead: params.get('hwlead') === '1',
  };
}
