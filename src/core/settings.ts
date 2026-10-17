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
  gpuPaint: boolean;             // floor + zones painted by the GPU (glpaint.ts); off: ?gpupaint=0
  zoomHold: boolean;             // the speed zoom holds, then glides (camera.ts); off: ?zoomhold=0
  minimap: boolean;              // the road-ahead minimap (hud/minimap.js); off: ?minimap=0
  menuVideo: boolean;            // ?menuvideo=1 (parked): the recorded race behind the menu
  grassGrip: boolean;            // grippier dry grass (surfaces.ts); ?grassgrip=0 = the old grip
  hwMap: boolean;                // the minimap on the highway too; ?hwmap=0 = not there
  sharpCars: boolean;            // crisp cars on the screen canvas (render.ts); ?sharpcars=0 off
  sharpMarks: boolean;           // skid marks on the screen canvas (render.ts); ?sharpmarks=0 off
  jokerFix: boolean;             // joker lane on the minimap, RESET back onto it; ?jokerfix=0 off
  groundLookup: boolean;         // fewer ground lookups under the wheels (wear.ts); =0 the old
  exactTiles: boolean;           // GPU ground tiles at their exact place (tiles.ts); =0 off
  hudMenu: boolean;              // the pause menu's HUD list (menu/race.js); ?hudmenu=0 off
  tyreOff: boolean;              // tyre / damage OFF stays off when damaged (hud.js); =0 pops up
  menuFast: boolean;             // ?menufast=1: no fly-in behind the menu, thumbnails at load
  noShade: boolean;              // ?noshade: skip the hill shading (perf A/B)
  grassEnds: "round" | "square";   // ?grass=square: square grass blade ends (cheaper; A/B)
  surfaceTextures: boolean;       // ?tex=0: paint surfaces live, not pre-painted textures (A/B)
  meter: boolean;   // ?meter=1 or ?report=1: the frame meter records each frame
  meterOverlay: boolean;   // ?meter=1 only: the meter's graph drawn on screen
  report: boolean;  // ?report=1: the meter's frames posted to the test server (ui/report.ts)
  audio: boolean;   // ?noaudio=1: never start Web Audio (phone judder test)
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
    // default since 2026-10-16 (owner approved on the phone); =0 brings the old path back
    gpuPaint: params.get('gpupaint') !== '0',
    zoomHold: params.get('zoomhold') !== '0',
    // default since 2026-10-16 (owner: "mini map tests good"); then the pause setting decides
    minimap: params.get('minimap') !== '0',
    menuVideo: params.get('menuvideo') === '1',
    grassGrip: params.get('grassgrip') !== '0',
    // default since 2026-10-16 (owner: "highway mini map approved")
    hwMap: params.get('hwmap') !== '0',
    // default since 2026-10-16 (owner: "the change seems to have worked"): the cars turned and
    // scaled at screen resolution
    sharpCars: params.get('sharpcars') !== '0',
    // default since 2026-10-17 (owner: "both fixes tested and working"): the skid marks at
    // screen resolution
    sharpMarks: params.get('sharpmarks') !== '0',
    // default since 2026-10-17 (owner approved): the joker lane on the minimap; RESET puts the car
    // back on the joker lane where it came off
    jokerFix: params.get('jokerfix') !== '0',
    // default since 2026-10-17 (owner: "seems okay"): 12 ground lookups a car a step, not ~22
    groundLookup: params.get('groundlookup') !== '0',
    // default since 2026-10-17 (owner: "test passed track edges don't wiggle"): the ground tiles
    // placed exactly on the GPU ground, not on whole art pixels, so the track edges hold still
    // while the zoom moves
    exactTiles: params.get('exacttiles') !== '0',
    // default since 2026-10-17 (owner: "test approved"): HUD > in the pause menu, an ON / OFF per
    // HUD piece
    hudMenu: params.get('hudmenu') !== '0',
    // default since 2026-10-17 (owner: "test passed"): the tyre / damage diagram OFF in the HUD
    // list means off, even when the car is damaged
    tyreOff: params.get('tyreoff') !== '0',
    // ?menufast=1 (owner phone test pending): the menu's race starts on the car (no fly-in) and the
    // track thumbnails are painted while the game loads, not on the TEST MODE tap
    menuFast: params.get('menufast') === '1',
    noShade: params.has('noshade'),
    grassEnds: params.get('grass') === 'square' ? 'square' : 'round',
    surfaceTextures: params.get('tex') !== '0',
    meter: params.get('meter') === '1' || params.get('report') === '1',
    report: params.get('report') === '1',
    // ?report=1 alone records without the graph: a full-resolution graph redrawn every frame may
    // itself cost frames on the phone (its drawing is outside the timings it reports)
    meterOverlay: params.get('meter') === '1',
    vsync: params.get('vsync') !== '0',
    audio: params.get('noaudio') !== '1',
    autopilot: params.get('autopilot') === '1' || autopilotKmh(params) > 0,
    autopilotKmh: autopilotKmh(params),
    churn: churnKind(params),
    noNatClear: params.get('nonat') === '1',
    skipLayers: new Set((params.get('skip') || '').split(',').filter(Boolean)),
  };
}
