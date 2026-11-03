import { THEMES } from '../stagegen.ts';

// the stage themes by key (stagegen.ts is JavaScript)
const THEME_NAMES = THEMES as Record<string, { name: string }>;
import { saveProfile } from './profile.ts';
import { addPane, addButton, addElement } from './widgets.ts';
import { KIND, catOf, showTrackList, addGenRows } from './tracks.ts';
import { showGarage } from './garage.ts';
import { hideMenu } from '../menu.ts';
import { buildLevel } from '../world/load.ts';
import { SEASON_NAMES, seasonForecast } from '../world/weather.ts';
import { CLOCK, clockLine } from '../world/clock.ts';
import type { Menu } from '../menu.ts';
import type { Level } from '../world/types.ts';
import type { SetupState, SetupUi } from './menutypes.ts';
import { MENU_COL } from './palette.ts';
import { FIX, MAX_AI } from '../core/fixes.ts';
import { ROSTER } from '../cars.ts';

// WEATHER: follow the SEASON (its chances; it can change in the race) or a fixed sky
const WEATHER_MODES = [['season', 'SEASON'], ['dry', 'DRY'], ['hot', 'HOT'],
  ['superhot', 'VERY HOT'], ['rain', 'RAIN'], ['heavy', 'HEAVY RAIN'], ['snow', 'SNOW']];
// the season of a month (0 = January): winter Dec-Feb, spring Mar-May, summer Jun-Aug
const SEASON_OF_MONTH = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 0];

// DIFFICULTY (PLAN.md §4; the centre of the field's spread — aidriver.js)
const DIFF = [['MOBILE', 'Mobile game'], ['GAME', 'Game'], ['REALISH', 'Realish'],
  ['RICH', "Real but you're rich"], ['REAL', 'Real']];

/**
 * Adds one labelled range slider row to the setup panel.
 * @param menu the menu context
 * @param panel the setup pane
 * @param label slider name
 * @param min lowest value
 * @param max highest value
 * @param stepV step
 * @param val start value
 * @param fmt value -> label text
 * @param set called with the new value on every input
 */
function addSetupSlider(menu: Menu, panel: HTMLElement, label: string, min: number, max: number,
  stepV: number, val: number, fmt: (value: number) => string, set: (value: number) => void) {
  const row = addElement(panel, 'div', '', 'row');
  row.style.alignItems = 'center';
  const labelEl = addElement(row, 'div', '');
  labelEl.style.cssText = 'width:120px;font-size:12px';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(stepV);
  input.value = String(val);
  input.style.cssText = 'flex:1;min-height:34px;accent-color:' + MENU_COL.accent;
  const showLabel = () => {
    labelEl.textContent = label + ' ' + fmt(+input.value);
  };
  input.addEventListener('input', () => {
    set(+input.value);
    showLabel();
    saveProfile(menu.profile);
  });
  row.appendChild(input);
  showLabel();
}

/**
 * Adds the setup title, the track description line and (generated stages) the generator rows.
 * @param menu the menu context
 * @param panel the setup pane
 * @param level the chosen level
 */
function addSetupHeader(menu: Menu, panel: HTMLElement, level: Level) {
  buildLevel(level);   // a set rally stage is generated on first use: its length is read below
  addElement(panel, 'h2', level.name);
  addElement(panel, 'div', level.endless ? 'ENDLESS MOTORWAY · HOW FAR CAN YOU GET?' : level.fixed
    ? `RALLY STAGE · ${THEME_NAMES[level.gen!.theme].name} · `
      + `${level.gen!.km!.toFixed(2)} KM · POINT TO POINT`
    : level.gen ? 'GENERATED RALLY STAGE · POINT TO POINT' : KIND[level.id] || 'TRACK', 'sub');
  if (level.gen && !level.fixed) addGenRows(menu, panel, level);
}

/**
 * Adds the ROAD TYPE buttons (endless highway, requirement: how do I test the lane presets — I
 * don't see any buttons): lanes / width / walls.
 * @param menu the menu context
 * @param panel the setup pane
 * @param level the chosen level
 * @param state the setup state (reads / writes road)
 */
function addRoadTypeRow(menu: Menu, panel: HTMLElement, level: Level, state: SetupState) {
  if (level.roadTypes) {
    const roadRow = addElement(panel, 'div', '', 'row');
    const roadBtns = Object.entries(level.roadTypes).map(([roadKey, name]) => addButton(menu,
      roadRow, name, () => {
        state.road = roadKey;
        roadBtns.forEach((button, i) => button.classList.toggle('on',
          Object.keys(level.roadTypes!)[i] === state.road));
      }, roadKey === state.road ? 'on' : ''));
  }
}

/**
 * Adds the TRAFFIC + LITTER sliders of an endless level (requirement: a slider in test mode for
 * traffic density, and one for the frequency / density of the roadside objects); remembered.
 * TRAFFIC 0-150 % (100 % = 6 cars a lane), LITTER 0-3 x.
 * @param menu the menu context
 * @param panel the setup pane
 * @param level the chosen level
 * @param state the setup state (reads / writes traffic, litter)
 */
function addTrafficSliders(menu: Menu, panel: HTMLElement, level: Level, state: SetupState) {
  if (level.endless) {
    addSetupSlider(menu, panel, 'TRAFFIC', 0, 1.5, 0.05, state.traffic, (value: number) => value
      ? Math.round(value * 100) + '%' : 'OFF', (value: number) => {
      state.traffic = menu.profile.traffic = value;
    });
    addSetupSlider(menu, panel, 'LITTER', 0, 3, 0.1, state.litter, (value: number) => value
      ? value.toFixed(1) + 'x' : 'OFF', (value: number) => {
      state.litter = menu.profile.litter = value;
    });
  }
}

/**
 * Adds the SOLO / VS AI buttons and the opponent-count row. VS AI (AI stage 1
 * preview): 1-5 opponents in the same car, different colours.
 * @param menu the menu context
 * @param panel the setup pane
 * @param state the setup state (reads / writes opponents, aiN; fills ui)
 */
function addOpponentCountRows(menu: Menu, panel: HTMLElement, state: SetupState) {
  const modeRow = addElement(panel, 'div', '', 'row');
  state.ui.bSolo = addButton(menu, modeRow, 'SOLO', () => {
    state.opponents = 0;
    state.paint();
  }, 'on');
  state.ui.bAI = addButton(menu, modeRow, 'VS AI', () => {
    state.opponents = state.aiN;
    state.paint();
  });
  state.ui.nRow = addElement(panel, 'div', '', 'row');
  if (FIX.ai10) {
    // ?ai10 (owner 11-03): a ticker, 1 .. MAX_AI, instead of a button per count
    const nudge = (delta: number) => {
      state.aiN = Math.max(1, Math.min(MAX_AI, state.aiN + delta));
      state.opponents = state.aiN;
      state.paint();
    };
    addButton(menu, state.ui.nRow, '−', () => nudge(-1));
    state.ui.nLbl = addElement(state.ui.nRow, 'div', '', 'val');
    state.ui.nLbl.style.cssText = 'flex:1;text-align:center;align-self:center';
    addButton(menu, state.ui.nRow, '+', () => nudge(1));
    state.ui.nBtns = [];
    return;
  }
  state.ui.nBtns = [1, 2, 3, 4, 5].map((count) => addButton(menu, state.ui.nRow!, String(count),
    () => {
      state.aiN = count;
      state.opponents = count;
      state.paint();
    }));
}

/**
 * Adds the DIFFICULTY row and its name line, and the AI CARS row: CLASS (each AI a car of your
 * class) or YOUR CAR (all the same as you); remembered.
 * @param menu the menu context
 * @param panel the setup pane
 * @param state the setup state (reads / writes diff, aiCars; fills ui)
 */
function addDifficultyRows(menu: Menu, panel: HTMLElement, state: SetupState) {
  try {
    const stored = localStorage.getItem('carsim.aidiff');
    if (stored != null) state.diff = Math.max(0, Math.min(4, +stored));
  } catch { /* default */ }
  state.ui.dRow = addElement(panel, 'div', '', 'row');
  state.ui.dBtns = DIFF.map(([name], i) => addButton(menu, state.ui.dRow!, name, () => {
    state.diff = i;
    try {
      localStorage.setItem('carsim.aidiff', String(i));
    } catch { /* fine */ }
    state.paint();
  }));
  state.ui.dName = addElement(panel, 'div', '', 'sub');
  state.aiCars = menu.profile.aiCars === 'same' ? 'same' : 'class';
  state.ui.aRow = addElement(panel, 'div', '', 'row');
  state.ui.bCls = addButton(menu, state.ui.aRow, 'AI: CLASS CARS', () => {
    state.aiCars = 'class';
    menu.profile.aiCars = state.aiCars;
    saveProfile(menu.profile);
    state.paint();
  });
  state.ui.bSame = addButton(menu, state.ui.aRow, 'AI: YOUR CAR', () => {
    state.aiCars = 'same';
    menu.profile.aiCars = state.aiCars;
    saveProfile(menu.profile);
    state.paint();
  });
}

/**
 * Shows / hides and highlights the opponent, difficulty and AI-car rows from the setup state.
 * @param state the setup state
 */
function paintSetupOpponents(state: SetupState) {
  const wid = state.ui as Required<SetupUi>;
  wid.bSolo.classList.toggle('on', state.opponents === 0);
  wid.bAI.classList.toggle('on', state.opponents > 0);
  wid.nRow.style.display = state.opponents ? '' : 'none';
  wid.nBtns.forEach((button, i) => button.classList.toggle('on', i + 1 === state.aiN));
  if (wid.nLbl) wid.nLbl.textContent = state.aiN + (state.aiN === 1 ? ' AI CAR' : ' AI CARS');
  wid.dRow.style.display = state.opponents ? '' : 'none';
  wid.dName.style.display = state.opponents ? '' : 'none';
  wid.dBtns.forEach((button, i) => button.classList.toggle('on', i === state.diff));
  wid.dName.textContent = 'AI: ' + DIFF[state.diff][1];
  wid.aRow.style.display = state.opponents ? '' : 'none';
  wid.bCls.classList.toggle('on', state.aiCars === 'class');
  wid.bSame.classList.toggle('on', state.aiCars === 'same');
}

/**
 * Adds the PRACTICE / RX RACE choice of a JOKER level: the RX race (5 laps from the grid, joker
 * once, missed = +5 s) next to free practice.
 * @param menu the menu context
 * @param panel the setup pane
 * @param level the chosen level
 * @param state the setup state (writes rxRace)
 */
function addRxRaceRow(menu: Menu, panel: HTMLElement, level: Level, state: SetupState) {
  if (level.joker) {
    const rxRow = addElement(panel, 'div', '', 'row');
    const practiceBtn = addButton(menu, rxRow, 'PRACTICE', () => {
      state.rxRace = false;
      practiceBtn.classList.add('on');
      rxBtn.classList.remove('on');
    }, state.rxRace ? '' : 'on');
    const rxBtn = addButton(menu, rxRow, `RX RACE · ${level.joker.laps} LAPS`, () => {
      state.rxRace = true;
      rxBtn.classList.add('on');
      practiceBtn.classList.remove('on');
    }, state.rxRace ? 'on' : '');
  }
}

/**
 * Adds the LAPS row (requirement: choose in setup): a race (VS AI or the RX race) is this many
 * laps; default 3, the RX race its joker laps. Wraps state.paint so the row follows the mode.
 * @param menu the menu context
 * @param panel the setup pane
 * @param level the chosen level
 * @param state the setup state (reads / writes laps, paint)
 */
function addLapsRow(menu: Menu, panel: HTMLElement, level: Level, state: SetupState) {
  const lRow = addElement(panel, 'div', '', 'row'), lLbl = addElement(lRow, 'div', '');
  lLbl.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;\
font-size:14px';
  // (the highway has no laps: a ROLLING START, and it ends when someone gets away off screen — a
  // line says so instead)
  const lPaint = () => {
    lLbl.textContent = state.laps + (state.laps === 1 ? ' LAP' : ' LAPS');
    lRow.style.display = (state.opponents || state.rxRace) && !level.endless ? '' : 'none';
    if (hwNote) hwNote.style.display = state.opponents ? '' : 'none';
  };
  const hwNote = level.endless ? addElement(panel, 'div',
    'ROLLING START · GET AWAY: LOSE THEM OFF THE BOTTOM OF THE SCREEN TO WIN · LET ONE GET AWAY \
OFF THE TOP AND IT IS OVER', 'sub') : null;
  addButton(menu, lRow, '−', () => {
    state.laps = Math.max(1, state.laps - 1);
    lPaint();
  });
  lRow.appendChild(lLbl);
  addButton(menu, lRow, '+', () => {
    state.laps = Math.min(10, state.laps + 1);
    lPaint();
  });
  const paint0 = state.paint;
  state.paint = () => {
    paint0();
    lPaint();
  };
  if (level.joker) for (const button of panel.querySelectorAll('button'))
    if (/PRACTICE|RX RACE/.test(button.textContent))
      button.addEventListener('click', () => lPaint());
}

/**
 * Adds the WEATHER rows: SEASON / DRY / HOT / VERY HOT / RAIN / HEAVY RAIN / SNOW,
 * the season slider and its forecast. Remembered in the profile; the first time, the season is
 * today's.
 * @param menu the menu context
 * @param panel the setup pane
 * @param state the setup state (writes weather)
 * @param level the level (a snowy one's theme biases the forecast)
 */
function addWeatherRows(menu: Menu, panel: HTMLElement, state: SetupState, level: Level) {
  const saved = (menu.profile.weather || {}) as { mode?: string; season?: number };
  const weather = { mode: saved.mode || 'season',
    season: saved.season ?? SEASON_OF_MONTH[new Date().getMonth()] };
  state.weather = weather;
  const remember = () => {
    menu.profile.weather = { ...state.weather };
    saveProfile(menu.profile);
  };
  addElement(panel, 'div', 'WEATHER', 'sub');
  const row = addElement(panel, 'div', '', 'row');
  const forecast = addElement(panel, 'div', '', 'sub');
  const paint = () => {
    buttons.forEach((button, i) => button.classList.toggle('on',
      WEATHER_MODES[i][0] === weather.mode));
    forecast.textContent = seasonForecast(weather.season, !!level.snowy)
      + (weather.mode === 'season' ? ' · CAN CHANGE IN THE RACE' : '');
  };
  const buttons = WEATHER_MODES.map(([mode, label]) => addButton(menu, row, label, () => {
    weather.mode = mode;
    remember();
    paint();
  }));
  addSetupSlider(menu, panel, 'SEASON', 0, 3, 1, weather.season,
    (value) => SEASON_NAMES[value], (value) => {
      weather.season = value;
      remember();
      paint();
    });
  // the slider row sits above the forecast line
  panel.appendChild(forecast);
  paint();
}

/**
 * Adds the LAUNCH button (starts the session with the chosen options) and BACK.
 * @param menu the menu context
 * @param panel the setup pane
 * @param level the chosen level
 * @param state the setup state
 */
function addLaunchButtons(menu: Menu, panel: HTMLElement, level: Level, state: SetupState) {
  const profile = menu.profile;
  addButton(menu, panel, 'LAUNCH ▶', () => {
    hideMenu(menu);
    menu.api.launch(level.id, profile.active,
      { rx: state.rxRace, ai: state.opponents, diff: state.diff, road: state.road,
        aiCars: state.aiCars,
        ...(state.weather ? { weather: state.weather } : {}),
        ...(state.time !== undefined ? { time: state.time } : {}),
        ...(level.endless ? { traffic: state.traffic, litter: state.litter } : {}),
        laps: state.opponents || state.rxRace ? state.laps : 0,
        livery: (profile.livery || {})[profile.active],
        tyre: (profile.tyres || {})[profile.active] });
  }, 'go');
  addButton(menu, panel, '◀ BACK', () => showTrackList(menu, profile.lastCat || catOf(level)));
}

/**
 * The TIME rows (TEST MODE only; owner: the story holds the global clock): LIVE
 * starts at the game clock's time, or a slider picks the hour the event starts at (the same
 * day); time runs on through the event either way. The line under them is the game clock now.
 * @param menu the menu context
 * @param panel the setup pane
 * @param state the setup state (writes time: null = live, or the hour)
 */
function addTimeRows(menu: Menu, panel: HTMLElement, state: SetupState) {
  state.time = state.time ?? null;
  addElement(panel, 'div', 'TIME OF DAY', 'sub');
  const row = addElement(panel, 'div', '', 'row');
  const line = addElement(panel, 'div', '', 'sub');
  const paint = () => {
    live.classList.toggle('on', state.time === null);
    line.textContent = 'GAME CLOCK: ' + clockLine(CLOCK.globalS, SEASON_NAMES)
      + (state.time === null ? '' : ' · THIS EVENT STARTS AT ' + String(state.time)
        .padStart(2, '0') + ':00');
  };
  const live = addButton(menu, row, 'LIVE', () => {
    state.time = null;
    paint();
  });
  addSetupSlider(menu, panel, 'START HOUR', 0, 23, 1, state.time ?? 12,
    (value) => String(value).padStart(2, '0') + ':00', (value) => {
      state.time = value;
      paint();
    });
  panel.appendChild(line);
  paint();
}

/**
 * TEST MODE step 2 (spec §4): the match setup of a level - solo or VS AI, laps, difficulty, the
 * car picker and LAUNCH.
 * @param menu the menu context
 * @param level the chosen level
 * @param kept the choices to start from (as they were before a garage visit)
 */
export function showSetup(menu: Menu, level: Level, kept: Partial<SetupState> = {}) {
  const panel = addPane(menu, false);
  addSetupHeader(menu, panel, level);
  const state = {
    road: level.roadType || null,   // endless highway road type
    traffic: menu.profile.traffic ?? 0.6,   // endless: traffic density
    litter: menu.profile.litter ?? 1,   // endless: roadside litter density
    opponents: 0,   // VS AI opponents (0 = solo)
    aiN: 5,   // how many opponents VS AI picks
    diff: 2,   // AI difficulty index into DIFF
    aiCars: 'class',   // AI cars: class or same
    rxRace: false,   // the RX race (joker level) rather than practice
    laps: level.joker ? level.joker.laps || 5 : 3,   // laps of a race
    ...kept,
    ui: {},   // the opponent / difficulty widgets paintSetupOpponents updates
    paint: () => {},   // repaints the setup rows (wrapped by the laps row)
  };
  addRoadTypeRow(menu, panel, level, state);
  addTrafficSliders(menu, panel, level, state);
  addOpponentCountRows(menu, panel, state);
  addDifficultyRows(menu, panel, state);
  state.paint = () => paintSetupOpponents(state);
  state.paint();
  addRxRaceRow(menu, panel, level, state);
  addLapsRow(menu, panel, level, state);
  state.paint();
  addWeatherRows(menu, panel, state, level);
  if (menu.api.daytime) addTimeRows(menu, panel, state);
  // (owner 11-03) no car picker here - the GARAGE picks it (your car named
  // above), and comes back to this setup with every choice as it was (AI, laps, RX, the hour)
  const car = ROSTER.find((row) => row.id === menu.profile.active)!;
  // the car you have, named above the button (owner: not inside it)
  addElement(panel, 'div', 'SELECTED CAR', 'sub');
  addElement(panel, 'div', car.name, 'selcar');
  addButton(menu, panel, 'GARAGE ›', () => {
    const { road, traffic, litter, opponents, aiN, diff, aiCars, rxRace, laps, time } = state;
    const choices = { road, traffic, litter, opponents, aiN, diff, aiCars, rxRace, laps, time };
    showGarage(menu, () => showSetup(menu, level, choices));
  });
  addLaunchButtons(menu, panel, level, state);
}
