import { wearColour, setHealth } from '../physics/tyrewear.ts';
import { COL } from '../world/colours.ts';
import {
  ROSTER, CLASSES, classOf, PALETTE, TYRES, TYRE_BRANDS, TYRE_SURFS, tyreOf, tyreFits,
  fittedTyre,
} from '../cars.ts';
import { CAR_STATS } from '../carstats.ts';
import type { CarStat } from '../ai/types.ts';
import type { Livery } from './profile.ts';
import type { RosterRow } from '../cars.ts';
import { saveProfile } from './profile.ts';
import { addPane, addButton, addElement, drawLift } from './widgets.ts';
import { showMainMenu } from './tracks.ts';
import type { Menu } from '../menu.ts';
import { MENU_COL } from './palette.ts';
import { FIX } from '../core/fixes.ts';


/**
 * CAR PICKER filtered CLASS -> SUBCLASS -> car. Only classes / subclasses you
 * own a car in are offered ('ALL' first); the filter starts on the active car's class.
 * onPick(row) after every change. Used by race setup and the garage.
 * @param menu the menu context
 * @param panel the pane to add the picker to
 * @param onPick called with the car after every change
 */
export function showCarPicker(menu: Menu, panel: HTMLElement,
  onPick: (car: RosterRow) => void = () => {}, pickCar: CarSlot = yourCar(menu)) {
  const owned = () => ROSTER.filter((car) => menu.profile.unlocked.includes(car.id));
  const cur = () => ROSTER.find((car) => car.id === pickCar.get())!;
  let filterClass = cur().cls, filterSub = 'ALL';
  const clsList = () => ['ALL', ...CLASSES.filter((cls) => owned().some((car) => car.cls
    === cls.id)).map((cls) => cls.id)];
  const subList = () => filterClass === 'ALL' ? ['ALL']
    : ['ALL', ...classOf(filterClass)!.subs.filter((sub) => owned().some((car) => car.cls
    === filterClass && car.sub === sub))];
  const cars = () => owned().filter((car) => (filterClass === 'ALL' || car.cls === filterClass)
    && (filterSub === 'ALL' || car.sub === filterSub));
  const step = (list: string[], value: string, delta: number) => list[(list.indexOf(value) + delta
    + list.length) % list.length];
  const fit = () => {
    const list = cars();
  if (!list.some((car) => car.id === pickCar.get())) pickCar.set(list[0].id);
  };
  // one boxed group; each row: TAG (coloured) ◀ value ▶ — the value takes the tag's colour so the
  // three read as a set
  const box = addElement(panel, 'div', '', 'picker');
  const row = (tag: string, col: string, prev: () => void, next: () => void) => {
    const rowEl = addElement(box, 'div', '', 'prow');
    const tagEl = addElement(rowEl, 'div', tag, 'cap');
    tagEl.style.background = col;
    addButton(menu, rowEl, '◀', prev);
    const valEl = addElement(rowEl, 'div', '', 'val');
    valEl.style.color = col;
    addButton(menu, rowEl, '▶', next);
    return valEl;
  };
  const classLabel = row('CLASS', MENU_COL.accent, () => {
    filterClass = step(clsList(), filterClass, -1);
  filterSub = 'ALL';
  fit();
  paint();
  }, () => {
    filterClass = step(clsList(), filterClass, 1);
  filterSub = 'ALL';
  fit();
  paint();
  });
  const subLabel = row('TYPE', MENU_COL.good, () => {
    filterSub = step(subList(), filterSub, -1);
  fit();
  paint();
  }, () => {
    filterSub = step(subList(), filterSub, 1);
  fit();
  paint();
  });
  const lbl = row('CAR', MENU_COL.fg, () => {
    pickCar.set(step(cars().map((car) => car.id), pickCar.get(), -1));
  paint();
  },
    () => {
      pickCar.set(step(cars().map((car) => car.id), pickCar.get(), 1));
    paint();
    });
  lbl.classList.add('car');
  const paint = () => {
    const car = cur(), total = cars().length, index = cars().findIndex((x) => x.id === car.id)
      + 1;
    classLabel.textContent = filterClass === 'ALL' ? 'ALL' : classOf(filterClass)!.name;
    subLabel.textContent = filterSub === 'ALL' ? 'ALL' : filterSub.toUpperCase();
    lbl.innerHTML = car.name + `<span>${index} / ${total}</span>`;
    onPick(car);
  };
  paint();
}

/** Which car a picker moves: get the id, set a new one. */
interface CarSlot { get: () => string; set: (carId: string) => void }
/**
 * Your car: the profile's active car, saved as it changes.
 * @param menu the menu context
 * @returns the slot
 */
const yourCar = (menu: Menu): CarSlot => ({ get: () => menu.profile.active,
  set: (carId) => { menu.profile.active = carId; saveProfile(menu.profile); } });
/**
 * The car the garage shows (?testgarage: the one being looked at, not yet yours), else yours.
 * @param menu the menu context
 * @returns the car id
 */
const garageCarId = (menu: Menu) => (FIX.testGarage && menu.garage ? menu.garage.viewing
  : menu.profile.active);

/**
 * GARAGE (spec §3; user chose: the TOP-DOWN car on a workshop LIFT). Browse owned cars, measured
 * stats.
 * @param menu the menu context
 */
export function showGarage(menu: Menu, back?: () => void) {
  // ?testgarage: opened from test setup it looks at your car, and goes back there
  if (FIX.testGarage && back) menu.garage = { viewing: menu.profile.active, back };
  const session = FIX.testGarage ? menu.garage : null;
  const panel = addPane(menu, true);
  addElement(panel, 'h2', 'GARAGE');
  if (session) addElement(panel, 'div', 'TEST GARAGE · free to try', 'sub');
  const box = addElement(panel, 'div', '', 'garage');
  const left = addElement(box, 'div', ''), right = addElement(box, 'div', '');
  const lift = document.createElement('canvas');
  lift.className = 'lift';
  lift.width = 360;
  lift.height = 150;
  left.appendChild(lift);
  const pick = addElement(left, 'div', '');
  pick.style.marginTop = '8px';
  const stats = addElement(right, 'div', '', 'stats');
  const showStats = () => {
    const car = ROSTER.find((x) => x.id === garageCarId(menu))!,
      spec: Partial<CarStat> = CAR_STATS[car.id] || {};
    drawLift(lift, menu.api.carSprite(car.id, (menu.profile.livery || {})[car.id]));
    const aids = spec.aids ? [spec.aids.abs && 'ABS', spec.aids.tcs
      && 'TCS'].filter(Boolean).join(' + ') || 'NONE' : 'NONE';
    stats.innerHTML = `<span>TOP SPEED</span><b>${spec.topKph ?? '—'} KM/H</b><span>0-100 \
KM/H</span><b>${spec.zeroTo100 != null ? spec.zeroTo100 + ' S' : '—'}</b>`
      + `<span>100-0 BRAKING</span><b>${spec.brake100 ?? '—'} M</b><span>GRIP</span><b>${(() => {
        // the table is measured on the stock set: the fitted set's grip against that
        const tarmacGrip = fittedTyre(car, (menu.profile.tyres || {})[car.id]).grip.tarmac
          / fittedTyre(car).grip.tarmac;
        return spec.gripG == null ? '—' : tarmacGrip === 1 ? spec.gripG + ' G'
          : (spec.gripG * tarmacGrip).toFixed(2) + ' G <span style="color:' + MENU_COL.dim
            + ';font-size:'
            + MENU_COL.small + '">STOCK ' + spec.gripG + '</span>';
      })()}</b>`
      + `<span>WEIGHT</span><b>${spec.massKg} KG</b><span>DRIVE</span><b>${spec.drive}</b><span>\
AIDS</span><b>${aids}</b>`
      + `<span>CLASS</span><b>${classOf(car.cls)!.name} · ${car.sub.toUpperCase()}</b>`
      + (() => {
        const tyre = fittedTyre(car, (menu.profile.tyres || {})[car.id]),
          brand = TYRE_BRANDS.find((x) => x.id === tyre.brand)!;
        return `<span>TYRES</span><b style="color:${brand.col}">${brand.name} \
· ${tyre.name.toUpperCase()}</b>`;
      })();
  };
  const buttonRow = addElement(panel, 'div', '', 'row');
  addButton(menu, buttonRow, 'PAINT', () => showPaintShop(menu));
  addButton(menu, buttonRow, 'TYRES', () => showTyreShop(menu));
  addButton(menu, buttonRow, 'BUY CARS', () => {}, '', true, 'SOON');
  addButton(menu, buttonRow, 'UPGRADES', () => {}, '', true, 'SOON');
  if (session) {
    // SELECT locks the car in as yours (owner 11-03); browsing alone changes nothing
    const row = addElement(panel, 'div', '', 'row');
    const select = addButton(menu, row, 'SELECT ✓', () => {
      if (session.viewing === menu.profile.active) return;
      menu.profile.active = session.viewing;
      saveProfile(menu.profile);
      session.back();
    });
    addButton(menu, row, '◀ BACK', () => session.back());
    const showSelect = () => {
      const yours = session.viewing === menu.profile.active;
      select.textContent = yours ? 'SELECTED ✓' : 'SELECT ✓';
      select.className = yours ? 'on' : 'go';
    };
    showCarPicker(menu, pick, (car) => { showStats(); showSelect(); return car; }, {
      get: () => session.viewing, set: (carId) => { session.viewing = carId; } });
    return;
  }
  addButton(menu, panel, '◀ BACK', () => showMainMenu(menu));
  showCarPicker(menu, pick, showStats);
}

/**
 * PAINT SHOP (requirement: palette + number + preview): BODY and TRIM from the 16-colour
 * PALETTE, a NUMBER 1-99 (or none), the car previewed on the lift as you go; APPLY saves it to
 * the profile, BACK drops the changes, STOCK puts the car's own colours back.
 * @param menu the menu context
 */
function showPaintShop(menu: Menu) {
  const panel = addPane(menu, true), carId = garageCarId(menu),
    car = ROSTER.find((x) => x.id === carId)!;
  const cur: Livery & { paint: string; trim: string; num: number } = { paint: car.paint,
    trim: car.trim, num: 0,
    ...((menu.profile.livery || {})[carId] || {}) };
  addElement(panel, 'h2', 'PAINT · ' + car.name);
  const box = addElement(panel, 'div', '', 'garage'), left = addElement(box, 'div', ''),
    right = addElement(box, 'div', '');
  const lift = document.createElement('canvas');
  lift.className = 'lift';
  lift.width = 360;
  lift.height = 150;
  left.appendChild(lift);
  const showLivery = () => {
    drawLift(lift, menu.api.carSprite(carId, cur));
  numL.textContent = cur.num ? '#' + cur.num : 'NO NUMBER';
    for (const [field, list] of [['paint', bodyB],
      ['trim', trimB]] as ['paint' | 'trim',
        HTMLButtonElement[]][]) for (const button of list) button.style.outline = button.dataset.c
      === cur[field] ? '3px solid ' + MENU_COL.pick : 'none';
  };
  const swatches = (label: string, field: 'paint' | 'trim') => {
    addElement(right, 'div', label, 'sub');
    const grid = addElement(right, 'div', '');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(8,1fr);gap:4px;\
margin-bottom:8px';
    return PALETTE.map((colour) => {
      const swatch = addButton(menu, grid, '', () => {
      cur[field] = colour;
    showLivery();
    });
    swatch.dataset.c = colour;
      swatch.style.cssText = 'background:' + colour
        + ';min-width:0;min-height:0;height:24px;padding:0;box-shadow:none;outline-offset:-1px';
      return swatch;
    });
  };
  const bodyB = swatches('BODY', 'paint'), trimB = swatches('TRIM', 'trim');
  const numRow = addElement(left, 'div', '', 'row');
  numRow.style.marginTop = '8px';
  addButton(menu, numRow, '−10', () => {
    cur.num = Math.max(0, cur.num - 10);
  showLivery();
  });
  addButton(menu, numRow, '−', () => {
    cur.num = Math.max(0, cur.num - 1);
  showLivery();
  });
  const numL = addElement(numRow, 'div', '');
  numL.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;\
font-size:15px';
  addButton(menu, numRow, '+', () => {
    cur.num = Math.min(99, cur.num + 1);
  showLivery();
  });
  addButton(menu, numRow, '+10', () => {
    cur.num = Math.min(99, cur.num + 10);
  showLivery();
  });
  const buttonRow = addElement(panel, 'div', '', 'row');
  addButton(menu, buttonRow, 'STOCK', () => {
    Object.assign(cur, { paint: car.paint, trim: car.trim, num: 0 });
  showLivery();
  });
  addButton(menu, buttonRow, FIX.testGarage ? 'TRY ✓' : 'APPLY ✓', () => {
    menu.profile.livery = menu.profile.livery || {};
  menu.profile.livery[carId] = { ...cur };
  saveProfile(menu.profile);
  showGarage(menu);
  }, 'go');
  if (FIX.testGarage) addButton(menu, buttonRow, 'BUY', () => {}, '', true, 'STORY');
  addButton(menu, panel, '◀ BACK', () => showGarage(menu));
  showLivery();
}

/**
 * How worn a car's set of tyres is: its most worn tyre, 0 new .. 1 bald.
 * @param menu the menu context
 * @param carId the car
 * @returns the wear
 */
function setWear(menu: Menu, carId: string) {
  const wear = (menu.profile.tyreWear || {})[carId];
  return wear ? Math.max(...wear) : 0;
}

/**
 * The fitted set's wear in the tyre shop, and the FIT button's words: a worn fitted
 * set can be swapped for a NEW SET.
 * @param menu the menu context
 * @param carId the car
 * @param fitted whether the tyre shown is the one fitted
 * @param info the shop's info panel
 * @param fitButton the FIT button
 */
function showSetWear(menu: Menu, carId: string, fitted: boolean, info: HTMLElement,
  fitButton: HTMLButtonElement) {
  const worn = setWear(menu, carId);
  fitButton.innerHTML = !fitted ? (FIX.testGarage ? 'TRY ✓' : 'FIT ✓') : worn > 0.02 ? 'NEW SET ✓'
    : (FIX.testGarage ? 'ON THE CAR ✓' : 'FITTED ✓');
  if (!fitted) return;
  // what the wear costs (physics/tyrewear.ts setHealth): grip lost, the puncture chance
  const health = setHealth((menu.profile.tyreWear || {})[carId] || [0, 0, 0, 0]);
  const pct = (share: number) =>
    (share < 0.0005 ? '0' : (share * 100).toFixed(share < 0.1 ? 1 : 0));
  info.innerHTML += `<div class="stats"><span>THIS SET</span>`
    + `<b style="color:${wearColour(worn, COL)}">${Math.round(worn * 100)}% WORN</b>`
    + `<span>GRIP LOST</span><b style="color:${wearColour(worn, COL)}">${pct(health.dryLoss)}% `
    + `DRY · ${pct(health.wetLoss)}% WET</b>`
    + `<span>PUNCTURE RISK</span><b style="color:${wearColour(worn, COL)}">`
    + (health.punctMin > 0 ? `${pct(health.punctMin)}% A MINUTE` : 'NONE (UNDER 70% WORN)')
    + `</b></div>`
    + '<div class="sub" style="text-align:left">Hot tyres (over their window) add to the risk.'
    + '</div>';
}

/**
 * TYRES (user: 4 brands / 15 types, fit by class, prices shown, the effect shown
 * with the stats). FIT saves it to profile.tyres[id].
 * @param menu the menu context
 */
function showTyreShop(menu: Menu) {
  const panel = addPane(menu, true), carId = garageCarId(menu),
    car = ROSTER.find((x) => x.id === carId)!,
    spec: Partial<CarStat> = CAR_STATS[carId] || {};
  let sel = fittedTyre(car, (menu.profile.tyres || {})[carId]).id;
  addElement(panel, 'h2', 'TYRES · ' + car.name);
  const box = addElement(panel, 'div', '', 'garage'), left = addElement(box, 'div', ''),
    right = addElement(box, 'div', '');
  const btns: Record<string, HTMLButtonElement> = {};
  for (const brand of TYRE_BRANDS) {
    const head = addElement(left, 'div', brand.name + ' <span style="color:' + MENU_COL.dim
      + ';font-size:' + MENU_COL.small + '">'
      + brand.blurb + '</span>');
    head.style.cssText = 'margin:6px 0 4px;font-size:12px;color:' + brand.col;
    const group = addElement(left, 'div', '');
    group.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px';
    for (const tyre of TYRES.filter((x) => x.brand === brand.id)) {
      const fits = tyreFits(tyre, car);
      const tyreBtn = addButton(menu, group, tyre.name, () => {
        sel = tyre.id;
      showTyre();
      }, '', !fits, fits ? '' : 'NO FIT');
      tyreBtn.style.cssText = 'min-height:32px;padding:4px 9px;font-size:11px;border-left:5px \
solid ' + brand.col;
      btns[tyre.id] = tyreBtn;
    }
  }
  const info = addElement(right, 'div', '');
  const fitR = addElement(panel, 'div', '', 'row');
  const fitB = addButton(menu, fitR, FIX.testGarage ? 'TRY ✓' : 'FIT ✓', () => {
    menu.profile.tyres = menu.profile.tyres || {};
    menu.profile.tyres[carId] = sel;
    // TYRE WEAR: fitting is a NEW set - the only way to fresh tyres
    menu.profile.tyreWear = menu.profile.tyreWear || {};
    menu.profile.tyreWear[carId] = [0, 0, 0, 0];
    saveProfile(menu.profile);
    showGarage(menu);
  }, 'go');
  // ?testgarage: BUY (keeps it for story) comes with story mode's money - shown, greyed
  if (FIX.testGarage) addButton(menu, fitR, 'BUY', () => {}, '', true, 'STORY');
  addButton(menu, panel, '◀ BACK', () => showGarage(menu));
  const showTyre = () => {
    const tyre = tyreOf(sel), brand = TYRE_BRANDS.find((x) => x.id === tyre.brand)!,
      cur = fittedTyre(car, (menu.profile.tyres || {})[carId]).id === tyre.id;
    for (const [key, tyreBtn] of Object.entries(btns)) tyreBtn.style.outline = key === sel
      ? '3px solid ' + MENU_COL.pick : 'none';
    const bar = (lbl: string, surf: string) => {
      const grip = tyre.grip[surf], percent = Math.round((grip - 1) * 100),
        width = Math.max(4, Math.min(100, grip / 1.6 * 100)),
        tone = grip > 1.001 ? MENU_COL.good : grip < 0.999 ? MENU_COL.bad : MENU_COL.dim;
      return `<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span \
style="width:${MENU_COL.labelW};font-size:${MENU_COL.label}">${lbl}</span>`


            + `<div style="flex:1;height:10px;background:${MENU_COL.well};border:1px solid #000;\
position:relative"><div style="position:absolute;left:62.5%;top:-3px;bottom:-3px;width:2px;\
background:${MENU_COL.fg}"></div><div style="height:100%;width:${width}%;\
background:${tone}"></div></div>`
            + `<span style="width:${MENU_COL.valueW};text-align:right;font-size:${MENU_COL.value};\
color:${tone}">\
${percent > 0 ? '+' : ''}${percent}%</span></div>`;
      };
    const opt = tyre.opt || [65, 110], heat = (tyre.heatHard || 1) > 1.05 ? 'FAST on tarmac'
      : (tyre.heatHard || 1) < 0.95 ? 'slow' : 'normal';
    const tarmacG = spec.gripG ? (spec.gripG * tyre.grip.tarmac).toFixed(2) + ' G' : '—';
    info.innerHTML = `<div style="font-size:15px;color:${brand.col}">${brand.name} \
· ${tyre.name.toUpperCase()}</div>`
      + `<div class="sub" style="margin:2px 0 6px">${tyre.note || ''}</div>`
      + '<div class="sub" style="font-size:' + MENU_COL.note
        + '">white line = STOCK (PRE-SPUN)</div>'
        + TYRE_SURFS.map(([surf, lbl]) => bar(lbl, surf)).join('')
      + `<div class="stats" style="margin-top:6px"><span>GRIP (TARMAC)</span><b>${tarmacG}</b>\
<span>WORKING HEAT</span><b>${opt[0]}-${opt[1]} C</b>`
      + `<span>HEATS UP</span><b>${heat}</b><span>PRICE</span><b>\
£${tyre.price}${tyre.price ? ' · FREE IN TEST' : ''}</b></div>`;
    showSetWear(menu, carId, cur, info, fitB);
  };
  showTyre();
}
