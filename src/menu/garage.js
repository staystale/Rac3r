import { wearColour } from '../physics/tyrewear.ts';
import { COL } from '../world/colours.ts';
import {
  ROSTER, CLASSES, classOf, PALETTE, TYRES, TYRE_BRANDS, TYRE_SURFS, tyreOf,
} from '../cars.ts';
import { CAR_STATS } from '../carstats.js';
import { saveProfile } from './profile.js';
import { addPane, addButton, addElement, drawLift } from './widgets.js';
import { showMainMenu } from './tracks.js';

/**
 * CAR PICKER filtered CLASS -> SUBCLASS -> car. Only classes / subclasses you
 * own a car in are offered ('ALL' first); the filter starts on the active car's class.
 * onPick(row) after every change. Used by race setup and the garage.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the pane to add the picker to
 * @param {Function} [onPick] called with the car after every change
 */
export function showCarPicker(menu, panel, onPick = () => {}) {
  const owned = () => ROSTER.filter((car) => menu.profile.unlocked.includes(car.id));
  const cur = () => ROSTER.find((car) => car.id === menu.profile.active);
  let filterClass = cur().cls, filterSub = 'ALL';
  const clsList = () => ['ALL', ...CLASSES.filter((cls) => owned().some((car) => car.cls
    === cls.id)).map((cls) => cls.id)];
  const subList = () => filterClass === 'ALL' ? ['ALL']
    : ['ALL', ...classOf(filterClass).subs.filter((sub) => owned().some((car) => car.cls
    === filterClass && car.sub === sub))];
  const cars = () => owned().filter((car) => (filterClass === 'ALL' || car.cls === filterClass)
    && (filterSub === 'ALL' || car.sub === filterSub));
  const step = (list, value, delta) => list[(list.indexOf(value) + delta
    + list.length) % list.length];
  const fit = () => {
    const list = cars();
  if (!list.some((car) => car.id === menu.profile.active)) menu.profile.active = list[0].id;
  saveProfile(menu.profile);
  };
  // one boxed group; each row: TAG (coloured) ◀ value ▶ — the value takes the tag's colour so the
  // three read as a set
  const box = addElement(panel, 'div', '', 'picker');
  const row = (tag, col, prev, next) => {
    const rowEl = addElement(box, 'div', '', 'prow');
    const tagEl = addElement(rowEl, 'div', tag, 'cap');
    tagEl.style.background = col;
    addButton(menu, rowEl, '◀', prev);
    const valEl = addElement(rowEl, 'div', '', 'val');
    valEl.style.color = col;
    addButton(menu, rowEl, '▶', next);
    return valEl;
  };
  const classLabel = row('CLASS', '#e8a13a', () => {
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
  const subLabel = row('TYPE', '#4cc2a0', () => {
    filterSub = step(subList(), filterSub, -1);
  fit();
  paint();
  }, () => {
    filterSub = step(subList(), filterSub, 1);
  fit();
  paint();
  });
  const lbl = row('CAR', '#e8e8ee', () => {
    menu.profile.active = step(cars().map((car) => car.id), menu.profile.active, -1);
  saveProfile(menu.profile);
  paint();
  },
    () => {
      menu.profile.active = step(cars().map((car) => car.id), menu.profile.active, 1);
    saveProfile(menu.profile);
    paint();
    });
  lbl.classList.add('car');
  const paint = () => {
    const car = cur(), total = cars().length, index = cars().findIndex((x) => x.id === car.id)
      + 1;
    classLabel.textContent = filterClass === 'ALL' ? 'ALL' : classOf(filterClass).name;
    subLabel.textContent = filterSub === 'ALL' ? 'ALL' : filterSub.toUpperCase();
    lbl.innerHTML = car.name + `<span>${index} / ${total}</span>`;
    onPick(car);
  };
  paint();
}

/**
 * GARAGE (spec §3; user chose: the TOP-DOWN car on a workshop LIFT). Browse owned cars, measured
 * stats.
 * @param {object} menu the menu context
 */
export function showGarage(menu) {
  const panel = addPane(menu, true);
  addElement(panel, 'h2', 'GARAGE');
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
    const car = ROSTER.find((x) => x.id === menu.profile.active), spec = CAR_STATS[car.id] || {};
    drawLift(lift, menu.api.carSprite(car.id, (menu.profile.livery || {})[car.id]));
    const aids = spec.aids ? [spec.aids.abs && 'ABS', spec.aids.tcs
      && 'TCS'].filter(Boolean).join(' + ') || 'NONE' : 'NONE';
    stats.innerHTML = `<span>TOP SPEED</span><b>${spec.topKph ?? '—'} KM/H</b><span>0-100 \
KM/H</span><b>${spec.zeroTo100 != null ? spec.zeroTo100 + ' S' : '—'}</b>`
      + `<span>100-0 BRAKING</span><b>${spec.brake100 ?? '—'} M</b><span>GRIP</span><b>${(() => {
        const tarmacGrip = tyreOf((menu.profile.tyres || {})[car.id]).grip.tarmac;
        return spec.gripG == null ? '—' : tarmacGrip === 1 ? spec.gripG + ' G'
          : (spec.gripG * tarmacGrip).toFixed(2) + ' G <span style="color:#9aa0aa;\
font-size:10px">STOCK ' + spec.gripG + '</span>';
      })()}</b>`
      + `<span>WEIGHT</span><b>${spec.massKg} KG</b><span>DRIVE</span><b>${spec.drive}</b><span>\
AIDS</span><b>${aids}</b>`
      + `<span>CLASS</span><b>${classOf(car.cls).name} · ${car.sub.toUpperCase()}</b>`
      + (() => {
        const tyre = tyreOf((menu.profile.tyres || {})[car.id]),
          brand = TYRE_BRANDS.find((x) => x.id === tyre.brand);
        return `<span>TYRES</span><b style="color:${brand.col}">${brand.name} \
· ${tyre.name.toUpperCase()}</b>`;
      })();
  };
  const buttonRow = addElement(panel, 'div', '', 'row');
  addButton(menu, buttonRow, 'PAINT', () => showPaintShop(menu));
  addButton(menu, buttonRow, 'TYRES', () => showTyreShop(menu));
  addButton(menu, buttonRow, 'BUY CARS', () => {}, '', true, 'SOON');
  addButton(menu, buttonRow, 'UPGRADES', () => {}, '', true, 'SOON');
  addButton(menu, panel, '◀ BACK', () => showMainMenu(menu));
  showCarPicker(menu, pick, showStats);
}

/**
 * PAINT SHOP (requirement: palette + number + preview): BODY and TRIM from the 16-colour
 * PALETTE, a NUMBER 1-99 (or none), the car previewed on the lift as you go; APPLY saves it to
 * the profile, BACK drops the changes, STOCK puts the car's own colours back.
 * @param {object} menu the menu context
 */
function showPaintShop(menu) {
  const panel = addPane(menu, true), carId = menu.profile.active,
    car = ROSTER.find((x) => x.id === carId);
  const cur = { paint: car.paint, trim: car.trim, num: 0,
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
      ['trim', trimB]]) for (const button of list) button.style.outline = button.dataset.c
      === cur[field] ? '3px solid #e8a13a' : 'none';
  };
  const swatches = (label, field) => {
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
  addButton(menu, buttonRow, 'APPLY ✓', () => {
    menu.profile.livery = menu.profile.livery || {};
  menu.profile.livery[carId] = { ...cur };
  saveProfile(menu.profile);
  showGarage(menu);
  }, 'go');
  addButton(menu, panel, '◀ BACK', () => showGarage(menu));
  showLivery();
}

/**
 * How worn a car's set of tyres is: its most worn tyre, 0 new .. 1 bald.
 * @param {object} menu the menu context
 * @param {string} carId the car
 * @returns {number} the wear
 */
function setWear(menu, carId) {
  const wear = (menu.profile.tyreWear || {})[carId];
  return wear ? Math.max(...wear) : 0;
}

/**
 * The fitted set's wear in the tyre shop, and the FIT button's words: a worn fitted
 * set can be swapped for a NEW SET.
 * @param {object} menu the menu context
 * @param {string} carId the car
 * @param {boolean} fitted whether the tyre shown is the one fitted
 * @param {HTMLElement} info the shop's info panel
 * @param {HTMLElement} fitButton the FIT button
 */
function showSetWear(menu, carId, fitted, info, fitButton) {
  const worn = setWear(menu, carId);
  fitButton.innerHTML = !fitted ? 'FIT ✓' : worn > 0.02 ? 'NEW SET ✓' : 'FITTED ✓';
  if (!fitted) return;
  info.innerHTML += `<div class="stats"><span>THIS SET</span>`
    + `<b style="color:${wearColour(worn, COL)}">${Math.round(worn * 100)}% WORN</b></div>`;
}

/**
 * TYRES (user: 4 brands / 15 types, fit by class, prices shown, the effect shown
 * with the stats). FIT saves it to profile.tyres[id].
 * @param {object} menu the menu context
 */
function showTyreShop(menu) {
  const panel = addPane(menu, true), carId = menu.profile.active,
    car = ROSTER.find((x) => x.id === carId),
    spec = CAR_STATS[carId] || {};
  let sel = tyreOf((menu.profile.tyres || {})[carId]).id;
  addElement(panel, 'h2', 'TYRES · ' + car.name);
  const box = addElement(panel, 'div', '', 'garage'), left = addElement(box, 'div', ''),
    right = addElement(box, 'div', '');
  const btns = {};
  for (const brand of TYRE_BRANDS) {
    const head = addElement(left, 'div', brand.name + ' <span style="color:#9aa0aa;font-size:10px">'
      + brand.blurb + '</span>');
    head.style.cssText = 'margin:6px 0 4px;font-size:12px;color:' + brand.col;
    const group = addElement(left, 'div', '');
    group.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px';
    for (const tyre of TYRES.filter((x) => x.brand === brand.id)) {
      const fits = tyre.fits.includes(car.cls);
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
  const fitB = addButton(menu, fitR, 'FIT ✓', () => {
    menu.profile.tyres = menu.profile.tyres || {};
    menu.profile.tyres[carId] = sel;
    // TYRE WEAR: fitting is a NEW set - the only way to fresh tyres
    menu.profile.tyreWear = menu.profile.tyreWear || {};
    menu.profile.tyreWear[carId] = [0, 0, 0, 0];
    saveProfile(menu.profile);
    showGarage(menu);
  }, 'go');
  addButton(menu, panel, '◀ BACK', () => showGarage(menu));
  const showTyre = () => {
    const tyre = tyreOf(sel), brand = TYRE_BRANDS.find((x) => x.id === tyre.brand),
      cur = tyreOf((menu.profile.tyres || {})[carId]).id === tyre.id;
    for (const [key, tyreBtn] of Object.entries(btns)) tyreBtn.style.outline = key === sel
      ? '3px solid #e8a13a' : 'none';
    const bar = (lbl, surf) => {
      const grip = tyre.grip[surf], percent = Math.round((grip - 1) * 100),
        width = Math.max(4, Math.min(100, grip / 1.6 * 100));
      return `<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span \
style="width:44px;font-size:10px">${lbl}</span>`


            + `<div style="flex:1;height:10px;background:#2a2d36;border:1px solid #000;\
position:relative"><div style="position:absolute;left:62.5%;top:-3px;bottom:-3px;width:2px;\
background:#e8e8ee"></div><div style="height:100%;width:${width}%;\
background:${grip > 1.001 ? '#4cc2a0' : grip < 0.999 ? '#d8453c' : '#9aa0aa'}"></div></div>`
            + `<span style="width:40px;text-align:right;font-size:11px;\
color:${grip > 1.001 ? '#4cc2a0' : grip < 0.999 ? '#d8453c' : '#9aa0aa'}">\
${percent > 0 ? '+' : ''}${percent}%</span></div>`;
      };
    const opt = tyre.opt || [65, 110], heat = (tyre.heatHard || 1) > 1.05 ? 'FAST on tarmac'
      : (tyre.heatHard || 1) < 0.95 ? 'slow' : 'normal';
    const tarmacG = spec.gripG ? (spec.gripG * tyre.grip.tarmac).toFixed(2) + ' G' : '—';
    info.innerHTML = `<div style="font-size:15px;color:${brand.col}">${brand.name} \
· ${tyre.name.toUpperCase()}</div>`
      + `<div class="sub" style="margin:2px 0 6px">${tyre.note || ''}</div>`
      + '<div class="sub" style="font-size:9px">white line = STOCK (PRE-SPUN)</div>'
        + TYRE_SURFS.map(([surf, lbl]) => bar(lbl, surf)).join('')
      + `<div class="stats" style="margin-top:6px"><span>GRIP (TARMAC)</span><b>${tarmacG}</b>\
<span>WORKING HEAT</span><b>${opt[0]}-${opt[1]} C</b>`
      + `<span>HEATS UP</span><b>${heat}</b><span>PRICE</span><b>\
£${tyre.price}${tyre.price ? ' · FREE IN TEST' : ''}</b></div>`;
    showSetWear(menu, carId, cur, info, fitB);
  };
  showTyre();
}
