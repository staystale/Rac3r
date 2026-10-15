import { THEMES } from '../stagegen.js';
import { saveProfile } from './profile.js';
import { addPane, addButton, addElement } from './widgets.js';
import { KIND, catOf, showTrackList, addGenRows } from './tracks.js';
import { showCarPicker } from './garage.js';
import { hideMenu } from '../menu.js';

// DIFFICULTY (PLAN.md §4; the centre of the field's spread — aidriver.js)
const DIFF = [['MOBILE', 'Mobile game'], ['GAME', 'Game'], ['REALISH', 'Realish'],
  ['RICH', "Real but you're rich"], ['REAL', 'Real']];

/**
 * Adds one labelled range slider row to the setup panel.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {string} label slider name
 * @param {number} min lowest value
 * @param {number} max highest value
 * @param {number} stepV step
 * @param {number} val start value
 * @param {Function} fmt value -> label text
 * @param {Function} set called with the new value on every input
 */
function addSetupSlider(menu, panel, label, min, max, stepV, val, fmt, set) {
  const row = addElement(panel, 'div', '', 'row');
  row.style.alignItems = 'center';
  const labelEl = addElement(row, 'div', '');
  labelEl.style.cssText = 'width:120px;font-size:12px';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.step = stepV;
  input.value = val;
  input.style.cssText = 'flex:1;min-height:34px;accent-color:#e8a13a';
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
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {object} level the chosen level
 */
function addSetupHeader(menu, panel, level) {
  addElement(panel, 'h2', level.name);
  addElement(panel, 'div', level.endless ? 'ENDLESS MOTORWAY · HOW FAR CAN YOU GET?' : level.fixed
    ? `RALLY STAGE · ${THEMES[level.gen.theme].name} · ${level.gen.km.toFixed(2)} KM · POINT TO \
POINT`
    : level.gen ? 'GENERATED RALLY STAGE · POINT TO POINT' : KIND[level.id] || 'TRACK', 'sub');
  if (level.gen && !level.fixed) addGenRows(menu, panel, level);
}

/**
 * Adds the ROAD TYPE buttons (endless highway, requirement: how do I test the lane presets — I
 * don't see any buttons): lanes / width / walls.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {object} level the chosen level
 * @param {object} state the setup state (reads / writes road)
 */
function addRoadTypeRow(menu, panel, level, state) {
  if (level.roadTypes) {
    const roadRow = addElement(panel, 'div', '', 'row');
    const roadBtns = Object.entries(level.roadTypes).map(([roadKey, name]) => addButton(menu,
      roadRow, name, () => {
        state.road = roadKey;
        roadBtns.forEach((button, i) => button.classList.toggle('on',
          Object.keys(level.roadTypes)[i] === state.road));
      }, roadKey === state.road ? 'on' : ''));
  }
}

/**
 * Adds the TRAFFIC + LITTER sliders of an endless level (requirement: a slider in test mode for
 * traffic density, and one for the frequency / density of the roadside objects); remembered.
 * TRAFFIC 0-150 % (100 % = 6 cars a lane), LITTER 0-3 x.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {object} level the chosen level
 * @param {object} state the setup state (reads / writes traffic, litter)
 */
function addTrafficSliders(menu, panel, level, state) {
  if (level.endless) {
    addSetupSlider(menu, panel, 'TRAFFIC', 0, 1.5, 0.05, state.traffic, (value) => value
      ? Math.round(value * 100) + '%' : 'OFF', (value) => {
      state.traffic = menu.profile.traffic = value;
    });
    addSetupSlider(menu, panel, 'LITTER', 0, 3, 0.1, state.litter, (value) => value
      ? value.toFixed(1) + 'x' : 'OFF', (value) => {
      state.litter = menu.profile.litter = value;
    });
  }
}

/**
 * Adds the SOLO / VS AI buttons and the opponent-count row. VS AI (AI stage 1
 * preview): 1-5 opponents in the same car, different colours.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {object} state the setup state (reads / writes opponents, aiN; fills ui)
 */
function addOpponentCountRows(menu, panel, state) {
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
  state.ui.nBtns = [1, 2, 3, 4, 5].map((count) => addButton(menu, state.ui.nRow, String(count),
    () => {
      state.aiN = count;
      state.opponents = count;
      state.paint();
    }));
}

/**
 * Adds the DIFFICULTY row and its name line, and the AI CARS row: CLASS (each AI a car of your
 * class) or YOUR CAR (all the same as you); remembered.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {object} state the setup state (reads / writes diff, aiCars; fills ui)
 */
function addDifficultyRows(menu, panel, state) {
  try {
    const stored = localStorage.getItem('carsim.aidiff');
    if (stored != null) state.diff = Math.max(0, Math.min(4, +stored));
  } catch { /* default */ }
  state.ui.dRow = addElement(panel, 'div', '', 'row');
  state.ui.dBtns = DIFF.map(([name], i) => addButton(menu, state.ui.dRow, name, () => {
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
 * @param {object} state the setup state
 */
function paintSetupOpponents(state) {
  const wid = state.ui;
  wid.bSolo.classList.toggle('on', state.opponents === 0);
  wid.bAI.classList.toggle('on', state.opponents > 0);
  wid.nRow.style.display = state.opponents ? '' : 'none';
  wid.nBtns.forEach((button, i) => button.classList.toggle('on', i + 1 === state.aiN));
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
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {object} level the chosen level
 * @param {object} state the setup state (writes rxRace)
 */
function addRxRaceRow(menu, panel, level, state) {
  if (level.joker) {
    const rxRow = addElement(panel, 'div', '', 'row');
    const practiceBtn = addButton(menu, rxRow, 'PRACTICE', () => {
      state.rxRace = false;
      practiceBtn.classList.add('on');
      rxBtn.classList.remove('on');
    }, 'on');
    const rxBtn = addButton(menu, rxRow, `RX RACE · ${level.joker.laps} LAPS`, () => {
      state.rxRace = true;
      rxBtn.classList.add('on');
      practiceBtn.classList.remove('on');
    });
  }
}

/**
 * Adds the LAPS row (requirement: choose in setup): a race (VS AI or the RX race) is this many
 * laps; default 3, the RX race its joker laps. Wraps state.paint so the row follows the mode.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {object} level the chosen level
 * @param {object} state the setup state (reads / writes laps, paint)
 */
function addLapsRow(menu, panel, level, state) {
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
 * Adds the LAUNCH button (starts the session with the chosen options) and BACK.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {object} level the chosen level
 * @param {object} state the setup state
 */
function addLaunchButtons(menu, panel, level, state) {
  const profile = menu.profile;
  addButton(menu, panel, 'LAUNCH ▶', () => {
    hideMenu(menu);
    menu.api.launch(level.id, profile.active,
      { rx: state.rxRace, ai: state.opponents, diff: state.diff, road: state.road,
        aiCars: state.aiCars,
        ...(level.endless ? { traffic: state.traffic, litter: state.litter } : {}),
        laps: state.opponents || state.rxRace ? state.laps : 0,
        livery: (profile.livery || {})[profile.active],
        tyre: (profile.tyres || {})[profile.active] });
  }, 'go');
  addButton(menu, panel, '◀ BACK', () => showTrackList(menu, profile.lastCat || catOf(level)));
}

/**
 * TEST MODE step 2 (spec §4): the match setup of a level - solo or VS AI, laps, difficulty, the
 * car picker and LAUNCH.
 * @param {object} menu the menu context
 * @param {object} level the chosen level
 */
export function showSetup(menu, level) {
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
  showCarPicker(menu, panel);
  addLaunchButtons(menu, panel, level, state);
}
