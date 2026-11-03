import { TEST_LIST } from '../testlist.ts';
import { addPane, addButton, addElement } from './widgets.ts';
import { showTrackSelect } from './tracks.ts';
import { showMenu, hideMenu } from '../menu.ts';
import { addPauseClock } from './pauseclock.ts';
import { showSettings } from './settings.ts';
import type { Menu } from '../menu.ts';
import type { PauseActions, ResultsActions, ResultRow, ResultsFlow } from './menutypes.ts';

/**
 * IN-SESSION PAUSE (spec §4 step 3): the track and car stay loaded until you leave. Car swap
 * stays on the HUD chip.
 * @param menu the menu context
 * @param act the session actions (resume, restart, guide, exit ...)
 */
export function showPause(menu: Menu, act: PauseActions) {
  menu.root.className = '';
  const panel = addPane(menu, false);
  addElement(panel, 'h2', 'PAUSED');
  addButton(menu, panel, 'RESUME ▶', () => {
    hideMenu(menu);
  act.resume();
  }, 'go');
  // SOUND (requirement: sound needs a volume control / mute button in pause menu too please - kinda
  // high priority): a slider 0-100 % and MUTE; audio.ts remembers both (localStorage rac3r.vol /
  // rac3r.mute)
  if (act.audio) {
    const audio = act.audio, row = addElement(panel, 'div', '', 'row');
    row.style.alignItems = 'center';
    const label = addElement(row, 'div', '');
    label.style.cssText = 'width:96px;font-size:12px';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '5';
    slider.value = String(Math.round(audio.volume * 100));
    slider.style.cssText = 'flex:1;min-height:34px;accent-color:#e8a13a';
    row.appendChild(slider);
    let muteBtn: HTMLButtonElement | null = null;
    const showSound = () => {
      label.textContent = 'SOUND ' + (audio.muted ? 'MUTED' : Math.round(audio.volume * 100)
        + '%');
    if (muteBtn) {
      muteBtn.textContent = audio.muted ? 'UNMUTE' : 'MUTE';
    muteBtn.classList.toggle('on', audio.muted);
    }
    };
    slider.addEventListener('input', () => {
      audio.setVolume(+slider.value / 100);
    if (audio.muted && +slider.value > 0) audio.toggleMute();
    showSound();
    });
    muteBtn = addButton(menu, row, 'MUTE', () => {
      audio.toggleMute();
    showSound();
    });
    showSound();
    addPauseClock(row);   // the alarm clock beside MUTE (menu/pauseclock.ts)
  } else addPauseClock(addElement(panel, 'div', '', 'row'));
  addHudButton(menu, panel, act);
  addButton(menu, panel, 'SETTINGS ›', () => showSettings(menu, () => showPause(menu, act), () => {
    hideMenu(menu);
    act.resume();
  }));
  addButton(menu, panel, 'RESTART SESSION', () => {
    hideMenu(menu);
  act.restart();
  });
  addButton(menu, panel, 'HOW TO PLAY', () => {
    hideMenu(menu);
  act.guide();
  });
  if (act.tests && TEST_LIST.length) addButton(menu, panel, 'TESTING · ' + TEST_LIST.length,
    () => showTesting(menu, act));   // the test queue (src/testlist.ts)
  if (act.rules) addButton(menu, panel, 'EVENT RULES', () => {
    hideMenu(menu);
  act.rules!();
  });   // the walkthrough for THIS event (guide.ts RULES)
  addButton(menu, panel, 'TRACK SELECT', () => {
    act.exit();
  showMenu(menu);
  showTrackSelect(menu);
  });
  addButton(menu, panel, 'MAIN MENU', () => {
    act.exit();
  showMenu(menu);
  });
}

/**
 * Adds the HUD > button (the HUD list: each display piece on / off for this difficulty mode).
 * @param menu the menu context
 * @param panel the pause panel
 * @param act the session actions (hud)
 */
function addHudButton(menu: Menu, panel: HTMLElement, act: PauseActions) {
  if (act.hud) addButton(menu, panel, 'HUD ›', () => showHudMenu(menu, act));
}

/**
 * HUD (owner, approved): one ON / OFF button per display piece, so the player keeps only what they
 * want; each choice is remembered (act.hud). Controls are never in the list.
 * @param menu the menu context
 * @param act the session actions (hud, resume)
 */
function showHudMenu(menu: Menu, act: PauseActions) {
  const panel = addPane(menu, false);
  addElement(panel, 'h2', 'HUD');
  for (const item of act.hud!.items()) {
    // a units row shows its value (KM/H, °F); an on / off row its state
    const label = item.label + ' · '
      + (item.value || (item.locked ? 'OFF IN REAL' : item.on ? 'ON' : 'OFF'));
    const button = addButton(menu, panel, label, () => {
      act.hud!.set(item.id, !item.on);
      showHudMenu(menu, act);
    }, item.on ? 'on' : '', item.locked);
    button.setAttribute('aria-pressed', String(item.on));
  }
  const row = addElement(panel, 'div', '', 'row');
  addButton(menu, row, 'RESUME ▶', () => {
    hideMenu(menu);
    act.resume();
  }, 'go');
  addButton(menu, row, 'BACK', () => showPause(menu, act));
}

/**
 * TESTING: the to-test feature list from src/testlist.ts, newest first. Test
 * mode only.
 * @param menu the menu context
 * @param act the session actions
 */
function showTesting(menu: Menu, act: PauseActions) {
  const panel = addPane(menu, true);
  addElement(panel, 'h2', 'TESTING · ' + TEST_LIST.length + ' TO CHECK');
  addElement(panel, 'div', 'waiting for your verdict: tell Claude "ok" or what is wrong', 'sub');
  for (const test of [...TEST_LIST].reverse()) {
    const card = addElement(panel, 'div', '', 'test');
    addElement(card, 'div', test.name + ' <span>' + test.added + '</span>', 'nm');
    addElement(card, 'div', '<b>WHERE</b> ' + test.where, 'ln');
    addElement(card, 'div', '<b>TRY</b> ' + test.try, 'ln');
    addElement(card, 'div', '<b>WRONG IF</b> ' + test.wrong, 'ln bad');
  }
  const row = addElement(panel, 'div', '', 'row');
  addButton(menu, row, 'RESUME ▶', () => {
    hideMenu(menu);
  act.resume();
  }, 'go');
  addButton(menu, row, 'BACK', () => showPause(menu, act));
}

/**
 * Formats a race time as m:ss.ss.
 * @param time seconds
 * @returns the formatted time
 */
function formatRaceTime(time: number) {
  const mins = Math.floor(time / 60), x = time - mins * 60;
  return mins + ':' + (x < 10 ? '0' : '') + x.toFixed(2);
}

/**
 * The results label of a racer.
 * @param racer a flow result row
 * @returns YOU or #number
 */
function nameRacer(racer: ResultRow) {
  return racer.player ? 'YOU' : '#' + racer.num;
}

/**
 * The HIGHWAY race distance (highwayrace.js): how far up the road a car got.
 * @param metres distance in metres
 * @returns the distance in km
 */
function formatKm(metres: number) {
  return (metres / 1000).toFixed(2) + ' KM';
}

/**
 * Adds the RESTART / TRACK SELECT / MAIN MENU buttons under a results table.
 * @param menu the menu context
 * @param panel the results pane
 * @param act the results actions ({ restart, tracks, menu })
 */
function addResultsButtons(menu: Menu, panel: HTMLElement, act: ResultsActions) {
  addButton(menu, panel, 'RESTART ▶', () => {
    hideMenu(menu);
    act.restart();
  }, 'go');
  const row = addElement(panel, 'div', '', 'row');
  addButton(menu, row, 'TRACK SELECT', () => {
    act.tracks();
    showMenu(menu);
    showTrackSelect(menu);
  });
  addButton(menu, row, 'MAIN MENU', () => {
    act.menu();
    showMenu(menu);
  });
}

/**
 * Adds the player's repair bill line (shown in Test but never charged) when there is a player.
 * @param panel the results pane
 * @param racers the flow results
 */
function addRepairsLine(panel: HTMLElement, racers: ResultRow[]) {
  const player = racers.find((racer) => racer.player);
  if (player) addElement(panel, 'div', 'YOUR REPAIRS £'
    + (player.bill || 0).toLocaleString('en-GB') + ' — TEST MODE: SHOWN, NOT CHARGED', 'sub');
}

/**
 * Adds a racer's POS and CAR cells (colour swatch + name) to a results grid.
 * @param grid the results grid
 * @param racer a flow result row
 * @param cls the row class
 */
function addRacerCells(grid: HTMLElement, racer: ResultRow, cls: string) {
  addElement(grid, 'div', 'P' + racer.pos, cls);
  const cell = addElement(grid, 'div', '', cls);
  const swatch = addElement(cell, 'span', '', 'sw');
  swatch.style.background = racer.paint || '#e8e8ee';
  cell.appendChild(document.createTextNode(nameRacer(racer)));
}

/**
 * The HIGHWAY race results table (highwayrace.js): no laps or times — how far up the road each
 * car got, and the gap in metres to the leader.
 * @param menu the menu context
 * @param flow the race flow (raceflow.ts)
 * @param act the results actions
 */
function showHighwayTable(menu: Menu, flow: ResultsFlow, act: ResultsActions) {
  const racers = flow.results;
  const panel = addPane(menu, true);
  addElement(panel, 'h2', 'RESULTS');
  addElement(panel, 'div', act.name + ' · ROLLING START · ' + formatRaceTime(flow.endT || flow.t),
    'sub');
  const grid = addElement(panel, 'div', '', 'res');
  grid.style.gridTemplateColumns = 'repeat(5, auto)';
  for (const head of ['POS', 'CAR', 'DISTANCE', 'GAP', 'REPAIR']) addElement(grid, 'div', head,
    'h');
  for (const racer of racers) {
    const cls = racer.player ? 'me' : '';
    addRacerCells(grid, racer, cls);
    addElement(grid, 'div', formatKm(racer.dist!), cls);
    addElement(grid, 'div', racer.pos === 1 ? '' : '-' + Math.round(racer.gapM!) + ' m', cls);
    addElement(grid, 'div', racer.bill ? '£' + racer.bill.toLocaleString('en-GB') : '-', cls);
  }
  addElement(panel, 'div', (racers[0] && racers[0].player) ? 'YOU GOT AWAY' : 'THEY GOT AWAY',
    'sub');
  addRepairsLine(panel, racers);
  addResultsButtons(menu, panel, act);
}

/**
 * The footnotes under the results grid: estimated times and time penalties.
 * @param panel the results panel
 * @param flow the race flow
 * @param racers the results
 * @returns {void}
 */
function addResultsNotes(panel: HTMLElement, flow: ResultsFlow, racers: ResultRow[]) {
  if (racers.some((racer) => racer.est)) addElement(panel, 'div', flow.stage
    ? '~ estimated: still on the stage when you finished'
    : '~ estimated: still running when the top 3 were home', 'sub');
  if (racers.some((racer) => racer.penalty)) addElement(panel, 'div',
    'PEN = time penalties (joker rule, track cuts)', 'sub');
}

/**
 * The results table of a lap / stage race: position, time, gap, best lap, penalty, repair bill.
 * @param menu the menu context
 * @param flow the race flow (raceflow.ts)
 * @param act the results actions
 */
function showResultsTable(menu: Menu, flow: ResultsFlow, act: ResultsActions) {
  if (flow.highway) return showHighwayTable(menu, flow, act);
  const racers = flow.results, fmt = formatRaceTime;
  const panel = addPane(menu, true);
  addElement(panel, 'h2', 'RESULTS');
  addElement(panel, 'div', act.name + ' · '
    + (flow.stage ? 'STAGE · STAGGERED STARTS' : flow.laps
    + (flow.laps === 1 ? ' LAP' : ' LAPS')), 'sub');
  const grid = addElement(panel, 'div', '', 'res');
  for (const head of ['POS', 'CAR', 'TIME', 'GAP', 'BEST', 'PEN', 'REPAIR']) addElement(grid,
    'div', head, 'h');
  for (const racer of racers) {
    const cls = racer.player ? 'me' : '';
    addRacerCells(grid, racer, cls);
    addElement(grid, 'div', racer.dnf ? 'DNF' : (racer.est ? '~' : '') + fmt(racer.total), cls);
    addElement(grid, 'div', racer.pos === 1 || racer.dnf ? '' : '+' + racer.gap!.toFixed(2), cls);
    addElement(grid, 'div', racer.best != null ? fmt(racer.best) : '-', cls);
    addElement(grid, 'div', racer.penalty ? '+' + racer.penalty + ' s' : '', 'pen');
    addElement(grid, 'div', racer.bill ? '£' + racer.bill.toLocaleString('en-GB') : '-', cls);
  }
  addResultsNotes(panel, flow, racers);
  // DAMAGE (requirement: counted cost-wise against you at the end of a race in Story mode — shown
  // in Test but never charged)
  addRepairsLine(panel, racers);
  addResultsButtons(menu, panel, act);
}

/**
 * Adds one podium step: the car top-down with its wheels, nose UP the step (requirement: podium
 * looks broken, just use normal top down cars), name, time / distance and the step.
 * @param menu the menu context
 * @param pod the podium element
 * @param flow the race flow
 * @param racer the racer on this step (may be undefined)
 * @param hgt the step height in px
 */
function addPodiumStep(menu: Menu, pod: HTMLElement, flow: ResultsFlow, racer: ResultRow,
  hgt: number) {
  const col = addElement(pod, 'div', '');
  if (!racer) return;
  // WAS: the body-only sprite (drawn nose-RIGHT, no wheels) squeezed into a 40 x 64 portrait box
  // -> squashed sideways.
  const spr = menu.api.carSprite(racer.car.spec, null, true),
    canvas = document.createElement('canvas');
  canvas.width = spr.c.height;
  canvas.height = spr.c.width;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(spr.c, -spr.c.width / 2, -spr.c.height / 2);
  canvas.style.width = Math.round(canvas.width * 2) + 'px';
  canvas.style.height = Math.round(canvas.height * 2) + 'px';
  col.appendChild(canvas);
  addElement(col, 'div', nameRacer(racer), racer.player ? '' : '');
  addElement(col, 'div', flow.highway ? formatKm(racer.dist!) : racer.dnf ? 'DNF'
    : (racer.est ? '~' : '') + formatRaceTime(racer.total));
  const stepEl = addElement(col, 'div', String(racer.pos), 'step');
  stepEl.style.height = hgt + 'px';
}

/**
 * RESULTS (AI stage 4; requirement: podium first, then the table): the PODIUM, 2nd, 1st, 3rd on
 * steps, the car on top; tap or 2.5 s -> the table. flow = raceflow.ts (results sorted on time
 * incl. penalties; est = still running when the race was cut short).
 * @param menu the menu context
 * @param flow the race flow
 * @param act { name, restart, tracks, menu }
 */
export function showResults(menu: Menu, flow: ResultsFlow, act: ResultsActions) {
  menu.root.className = '';
  const racers = flow.results;
  const panel = addPane(menu, false);
  addElement(panel, 'h2', 'RESULTS');
  addElement(panel, 'div', act.name, 'sub');
  const pod = addElement(panel, 'div', '', 'podium');
  for (const [i, hgt] of [[1, 46], [0, 62], [2, 34]]) {
    addPodiumStep(menu, pod, flow, racers[i], hgt);
  }
  const you = racers.find((racer) => racer.player);
  if (you) addElement(panel, 'div', 'YOU: P' + you.pos + ' of ' + racers.length, 'sub');
  let gone = false;
  const next = () => {
    if (gone) return;
    gone = true;
    showResultsTable(menu, flow, act);
  };
  addButton(menu, panel, 'RESULTS ▶', next, 'go');
  setTimeout(next, 2500);
}
