// node tools/rendermap.mjs src/render.ts --out tools/survey-phase4.md
// Survey of src/render.ts, to plan splitting it: the module-level items, the items inside the one big
// closure createRenderer(canvas), which inner function reads or writes which shared closure variable,
// the inner call graph and a proposed split into layers. Report only; writes nothing but --out.
// Limits: references are found by name and scope (names declared by enclosing functions/blocks), good
// enough for a survey. A WRITE is an assignment, ++/--, or a property/element assignment or a mutating
// method call (.set .push .clear ...) on the variable itself, marked (m); a write through an alias
// (const e = cache.get(k); e.x = 1) is not seen. "Calls" are all references to an inner function
// (called or passed). Users of the returned keys are found by grepping src for `renderer.<key>`.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, join, sep } from 'node:path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const outFile = oi >= 0 ? args[oi + 1] : null;
const pick = (a, i) => !a.startsWith('--') && i !== oi + 1;
const target = resolve(args.find(pick) || 'src/render.ts');
const OPTS = { ecmaVersion: 'latest', sourceType: 'module', locations: true };
const MUT = new Set(['set', 'push', 'pop', 'shift', 'unshift', 'splice', 'clear', 'delete', 'add',
  'sort', 'reverse', 'fill', 'copyWithin']);

const src = readFileSync(target, 'utf8');
const lines = src.split(/\r?\n/);
const comments = [];
const ast = acorn.parse(src, { ...OPTS, onComment: comments });

function patNames(p, out = []) {
  if (!p) return out;
  if (p.type === 'Identifier') out.push(p.name);
  else if (p.type === 'ObjectPattern') {
    for (const q of p.properties) patNames(q.type === 'RestElement' ? q.argument : q.value, out);
  } else if (p.type === 'ArrayPattern') for (const q of p.elements) patNames(q, out);
  else if (p.type === 'RestElement') patNames(p.argument, out);
  else if (p.type === 'AssignmentPattern') patNames(p.left, out);
  return out;
}

// ---- banners: own-line comments "// ----", "// ====" or ALL-CAPS, at the closure's indent (2)
const banners = [];
for (const c of comments) {
  if (c.type !== 'Line' || c.loc.start.column !== 2) continue;
  const ln = c.loc.start.line;
  const text = lines[ln - 1].trim();
  if (!text.startsWith('//')) continue;
  const body = text.replace(/^\/\/\s*/, '');
  const caps = /[A-Z]{3}/.test(body) && !/[a-z]/.test(body);
  if (!/^(----|====)/.test(body) && !caps) continue;
  const label = body.replace(/^[-=\s]+/, '').replace(/[-=\s]+$/, '');
  if (label) banners.push({ line: ln, text: label });
}
const bannerFor = (line) => {
  let b = null;
  for (const x of banners) { if (x.line < line) b = x; else break; }
  return b;
};

// ---- the closure and the module-level items
let rfn = null, rnode = null;
for (const n of ast.body) {
  const d = n.type === 'ExportNamedDeclaration' ? n.declaration : n;
  if (d && d.type === 'FunctionDeclaration' && d.id.name === 'createRenderer') { rfn = d; rnode = n; }
}
if (!rfn) throw new Error('createRenderer not found in ' + target);

const modItems = [];
const modByName = new Map();
for (const node of ast.body) {
  if (node === rnode) continue;
  if (node.type === 'ImportDeclaration') {
    for (const s of node.specifiers) modByName.set(s.local.name, null);
    continue;
  }
  const exported = node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration';
  const d = exported && node.declaration ? node.declaration : node;
  const it = { exported, start: node.loc.start.line, end: node.loc.end.line, names: [], kind: 'expression' };
  if (d.type === 'FunctionDeclaration') it.kind = 'function';
  else if (d.type === 'ClassDeclaration') it.kind = 'class';
  else if (d.type === 'VariableDeclaration') it.kind = d.kind;
  if (d.type === 'VariableDeclaration') it.names = d.declarations.flatMap((x) => patNames(x.id));
  else if (d.id) it.names = [d.id.name];
  it.count = it.end - it.start + 1;
  it.label = it.names.length ? it.names.join(', ') : '(' + d.type + ')';
  modItems.push(it);
  for (const n of it.names) modByName.set(n, it);
}

// ---- inner items: the direct children of the closure body
const isFnInit = (e) => !!e && (e.type === 'ArrowFunctionExpression' || e.type === 'FunctionExpression');
const inner = [];       // listed items, file order
const units = [];       // every owner of references: the items plus the final return
const innerByName = new Map();
function addItem(names, kind, node, range, st, isFn) {
  const it = {
    name: names.join(', '), names, kind, start: node.loc.start.line, end: node.loc.end.line,
    range, st, isFn, uses: new Map(),
  };
  it.count = it.end - it.start + 1;
  it.banner = bannerFor(it.start);
  inner.push(it); units.push(it);
  for (const n of names) innerByName.set(n, it);
}
for (const st of rfn.body.body) {
  if (st.type === 'FunctionDeclaration') addItem([st.id.name], 'function', st, st, st, true);
  else if (st.type === 'ClassDeclaration') addItem([st.id.name], 'class', st, st, st, false);
  else if (st.type === 'VariableDeclaration') {
    for (const d of st.declarations) {
      const fnl = st.kind === 'const' && isFnInit(d.init);
      addItem(patNames(d.id), fnl ? 'arrow' : st.kind, st.declarations.length > 1 ? d : st, d, st, fnl);
    }
  } else if (st.type === 'ReturnStatement') {
    units.push({ name: '(return)', range: st, st, isFn: false });
  } else addItem(['(stmt L' + st.loc.start.line + ')'], 'statement', st, st, st, false);
}

// ---- scope: names declared by an enclosing function / block / loop (cached per node)
const declCache = new Map();
function declSet(node) {
  let s = declCache.get(node);
  if (s) return s;
  s = new Set();
  const addDecls = (stmts) => {
    for (const x of stmts) {
      if (x.type === 'VariableDeclaration' && x.kind !== 'var') {
        for (const d of x.declarations) patNames(d.id).forEach((n) => s.add(n));
      } else if (x.type === 'FunctionDeclaration' || x.type === 'ClassDeclaration') s.add(x.id.name);
    }
  };
  if (/Function/.test(node.type)) {
    for (const p of node.params) patNames(p).forEach((n) => s.add(n));
    if (node.type === 'FunctionExpression' && node.id) s.add(node.id.name);
    if (node.body.type === 'BlockStatement') {
      walk.simple(node.body, {
        VariableDeclaration(v) {
          if (v.kind === 'var') for (const d of v.declarations) patNames(d.id).forEach((n) => s.add(n));
        },
      }, { ...walk.base, Function() {} });
    }
  } else if (node.type === 'CatchClause') patNames(node.param).forEach((n) => s.add(n));
  else if (node.type === 'BlockStatement' || node.type === 'StaticBlock') addDecls(node.body);
  else if (node.type === 'SwitchStatement') for (const c of node.cases) addDecls(c.consequent);
  else if (/^For(In|Of)?Statement$/.test(node.type)) {
    const h = node.type === 'ForStatement' ? node.init : node.left;
    if (h && h.type === 'VariableDeclaration' && h.kind !== 'var') {
      for (const d of h.declarations) patNames(d.id).forEach((n) => s.add(n));
    }
  }
  declCache.set(node, s);
  return s;
}
// the closure itself and its body are where the shared names live: they never shadow them
const shadowed = (anc, name) => anc.some((a) => a.type !== 'Program' && a !== rfn && a !== rfn.body && declSet(a).has(name));

// ---- how an identifier is used: null (a declaration/key), r, w (rebinding), rw, m (mutates what it holds)
function classify(anc) {
  const n = anc.length;
  const node = anc[n - 1];
  let i = n - 1, child = node, p = anc[i - 1], wrapped = false;
  while (p) {
    const wrap = p.type === 'ArrayPattern' || p.type === 'ObjectPattern' || p.type === 'RestElement'
      || (p.type === 'AssignmentPattern' && p.left === child)
      || (p.type === 'Property' && p.value === child && anc[i - 2] && anc[i - 2].type === 'ObjectPattern');
    if (!wrap) break;
    wrapped = true; child = p; i--; p = anc[i - 1];
  }
  if (!p) return 'r';
  if (p.type === 'Property' && p.key === node && !p.computed && !p.shorthand) return null;
  if (p.type === 'MemberExpression' && p.property === node && !p.computed) return null;
  if (p.type === 'VariableDeclarator' && p.id === child) return null;
  if (/Function/.test(p.type) && (p.id === child || p.params.includes(child))) return null;
  if (/^Class/.test(p.type) && p.id === child) return null;
  if (p.type === 'CatchClause' && p.param === child) return null;
  if (p.type === 'AssignmentExpression' && p.left === child) return p.operator === '=' ? 'w' : 'rw';
  if (p.type === 'UpdateExpression') return 'rw';
  if ((p.type === 'ForInStatement' || p.type === 'ForOfStatement') && p.left === child) return 'w';
  if (wrapped) return 'r';
  let cur = node, j = n - 1;
  while (j > 0 && anc[j - 1].type === 'MemberExpression' && anc[j - 1].object === cur) { cur = anc[j - 1]; j--; }
  if (cur !== node) {
    const q = anc[j - 1];
    if (q) {
      if (q.type === 'AssignmentExpression' && q.left === cur) return 'm';
      if (q.type === 'UpdateExpression') return 'm';
      if (q.type === 'UnaryExpression' && q.operator === 'delete') return 'm';
      if ((q.type === 'ForInStatement' || q.type === 'ForOfStatement') && q.left === cur) return 'm';
      if (q.type === 'CallExpression' && q.callee === cur && !cur.computed && MUT.has(cur.property.name)) return 'm';
    }
  }
  return 'r';
}

// ---- reference pass over every closure statement
const modUsers = new Map();   // module-level name -> Set of inner owner names
for (const st of rfn.body.body) {
  const mine = units.filter((u) => u.st === st);
  walk.fullAncestor(st, (node, _s, anc) => {
    if (node.type !== 'Identifier') return;
    const name = node.name;
    const it = innerByName.get(name);
    if (!it && !modByName.has(name)) return;
    const how = classify(anc);
    if (!how || shadowed(anc, name)) return;
    const owner = mine.find((u) => node.start >= u.range.start && node.end <= u.range.end);
    if (!owner) return;
    if (!it) {
      if (!modUsers.has(name)) modUsers.set(name, new Set());
      modUsers.get(name).add(owner.name);
      return;
    }
    if (owner === it) return;
    let u = it.uses.get(owner.name);
    if (!u) { u = { r: false, w: false, m: false }; it.uses.set(owner.name, u); }
    if (how === 'r' || how === 'rw') u.r = true;
    if (how === 'w' || how === 'rw') u.w = true;
    if (how === 'm') u.m = true;
  });
}

// ---- derived: call graph and shared state
const callsOf = new Map(inner.map((it) => [it.name, new Set()]));
const callersOf = new Map(inner.map((it) => [it.name, new Set()]));
for (const it of inner.filter((x) => x.isFn)) {
  for (const owner of it.uses.keys()) {
    callersOf.get(it.name).add(owner);
    if (callsOf.has(owner)) callsOf.get(owner).add(it.name);
  }
}
const stateItems = inner.filter((it) => {
  if (it.isFn || it.kind === 'class' || it.kind === 'statement') return false;
  if (it.kind === 'let' || it.kind === 'var') return true;
  return [...it.uses.values()].some((u) => u.w || u.m);
});
const readersOf = (it) => [...it.uses].filter(([, u]) => u.r).map(([o]) => o);
const writersOf = (it) => [...it.uses].filter(([, u]) => u.w || u.m).map(([o, u]) => (u.w ? o : o + ' (m)'));


// ---- the returned object: keys and who in src calls them
const ret = rfn.body.body.find((s) => s.type === 'ReturnStatement');
const retKeys = [];
for (const p of ret.argument.properties) {
  const key = p.key.name;
  const how = p.kind === 'get' ? 'getter' : p.method ? 'method' : p.shorthand ? 'shorthand' : 'value';
  retKeys.push({ key, how, start: p.loc.start.line, end: p.loc.end.line });
}
function listSrc(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...listSrc(p));
    else if (/\.(js|ts)$/.test(f)) out.push(p);
  }
  return out;
}
const srcDir = resolve(process.cwd(), 'src');
const relp = (p) => relative(process.cwd(), p).split(sep).join('/');
const srcFiles = listSrc(srcDir).filter((p) => resolve(p) !== target);
const fileText = new Map(srcFiles.map((p) => [relp(p), readFileSync(p, 'utf8')]));
const usersOfKey = (key) => {
  const re = new RegExp('\\b(?:renderer|r)\\.' + key + '\\b|\\b__game\\.renderer\\.' + key + '\\b');
  return [...fileText].filter(([, t]) => re.test(t)).map(([f]) => f);
};
const usersOfExport = (name) => {
  const re = new RegExp('\\b' + name + '\\b');
  const imp = /import\s*\{([^}]*)\}\s*from\s*["'][^"']*render(\.js)?["']/g;
  return [...fileText].filter(([, t]) => [...t.matchAll(imp)].some((m) => re.test(m[1]))).map(([f]) => f);
};

// ---- 6. proposed layers
const NAME_RULES = [
  ['camera', 'cam zoom vZoom pinZoom fly ovCache W H dpr PPM resize follow updateZoom updateFly levelBounds '
    + 'levelOverview roadS0 standInFill thumbnail flyIn paintOverview prefetch snap OV_REPAINT FLY_HOLD '
    + 'FLY_TIME FLY_HANDOVER FLY_PREFETCH OVERVIEW_PX'],
  ['shared', 'mainCtx ctx pcanvas pctx pk realDpr PPMz toScreenX toScreenY roundRect recolour artBase noPatterns '
    + 'speckle lattice SPRITE_PPM'],
  ['ground', 'drawFloor drawZones drawPatches drawCovers drawCoversMerged mergedCovers coverCells cellsPath '
    + 'coverPath drawWear drawBumps drawRunoff drawGround paintLayers PRIM SURFACE_ART PUDDLE_TINT'],
  ['road', 'drawLanes drawTrackRibbon drawLaneDashes drawCurvedKerbs drawPaint drawKerb drawMarks drawSlip '
    + 'forSide MARKS_MAX'],
  ['props', 'drawFence drawBarriers drawProps drawBridge drawGarageRow OVERHEAD drawCones drawTape '
    + 'drawDebris DEBRIS_KINDS objCache objSprite pdisc pixelObjectSprite drawPixelObject'],
  ['hud', 'drawArrows'],
  ['cars', 'wheel DIGITS spriteCache pixelCar crushTop damagedSprite silhouette faceCache ROLL_HP sideSprite '
    + 'underSprite dmgFace rolledFaces drawFaces drawPixelCar drawCar'],
  ['frame', 'frame'],
];
const GUESS = new Set(['drawArrows', 'drawWear', 'drawBumps', 'drawRunoff', 'drawFence', 'thumbnail',
  'levelOverview', 'paintOverview', 'prefetch', 'standInFill', 'roadS0', 'drawLanes', 'drawSlip', 'forSide',
  'speckle', 'lattice', 'drawBridge', 'drawGarageRow', 'drawDebris', 'drawTape', 'snap', 'artBase',
  'recolour', 'noPatterns', 'SPRITE_PPM', 'roundRect', 'pk', 'realDpr', 'ctx', 'mainCtx', 'pcanvas', 'pctx',
  'drawMarks', 'MARKS_MAX']);
const BANNER_RULES = [
  [/floor|lanes|SURFACE|GROUND TILES/, 'ground'], [/ribbon/, 'road'],
  [/scenery|cones|OBJECTS/, 'props'], [/thrown/, 'particles'], [/car/i, 'cars'], [/^frame$/, 'frame'],
];
const layerOf = new Map();
const how = new Map();
for (const it of inner) {
  let lay = null;
  for (const [l, names] of NAME_RULES) if (it.names.some((n) => names.split(' ').includes(n))) lay = l;
  if (lay) how.set(it, GUESS.has(it.names[0]) ? 'guess' : 'name');
  if (!lay && /^\(stmt/.test(it.name)) { lay = 'ground'; how.set(it, 'name'); }
  if (!lay && it.banner) {
    for (const [re, l] of BANNER_RULES) if (!lay && re.test(it.banner.text)) lay = l;
    how.set(it, 'banner');
  }
  if (!lay) {
    const b = inner.filter((x) => x.start < it.start && layerOf.get(x)).pop();
    lay = b ? layerOf.get(b) : 'shared'; how.set(it, 'banner');
  }
  layerOf.set(it, lay);
}
// names with "particles" ownership: the thrown-material block (banner rule above catches most)
const PART = 'puffs MAX_PUFFS emit CONE_DUST BALE_DUST FLUFF_PUFF addPuffs sprayDebt addSpray SMOKE_T SMOKE '
  + 'smokeDebt addSmoke DSMOKE addDamageSmoke chips MAX_CHIPS addChips addSparks drawChips drawPuffs';
for (const it of inner) if (it.names.some((n) => PART.split(' ').includes(n))) { layerOf.set(it, 'particles'); how.set(it, 'name'); }
// a helper used by two or more of the object layers (not ground/road, which share the tile painters) is shared
const unitByName = new Map(inner.map((it) => [it.name, it]));
for (const it of inner) it.layer = layerOf.get(it);
const OBJ = new Set(['camera', 'props', 'particles', 'cars', 'hud']);
const promote = [];
for (const it of inner) {
  if (stateItems.includes(it) || it.kind === 'statement' || !OBJ.has(it.layer) || it.layer === 'camera') continue;
  const ls = new Set();
  for (const o of it.uses.keys()) { const u = unitByName.get(o); if (u && OBJ.has(u.layer) && u.layer !== it.layer) ls.add(u.layer); }
  if (ls.size) promote.push(it);
}
for (const it of promote) { it.layer = 'shared'; how.set(it, 'promoted'); }
const LAYERS = ['camera', 'ground', 'road', 'cars', 'props', 'particles', 'hud', 'debug', 'frame', 'shared'];
const LAYER_TITLE = {
  camera: 'camera (view, zoom, fly-in, overview)', ground: 'ground (floor, zones, surfaces, covers, tiles)',
  road: 'road and marks', cars: 'cars', props: 'props and objects', particles: 'particles',
  hud: 'hud overlays', debug: 'debug overlay', frame: 'frame', shared: 'shared',
};
const layerOfName = (n) => { const u = unitByName.get(n); return u ? u.layer : n === '(return)' ? 'frame' : '?'; };


// ---- the report
const out = [];
const P = (s = '') => out.push(s);
const list = (a) => (a.length ? a.join(', ') : '-');
const rng = (a, b) => (a === b ? 'L' + a : 'L' + a + '-' + b);
const cell = (s) => String(s).replace(/\|/g, '\\|');
const table = (head, rows) => {
  P('| ' + head.join(' | ') + ' |');
  P('|' + head.map(() => '---').join('|') + '|');
  for (const r of rows) P('| ' + r.map(cell).join(' | ') + ' |');
  P();
};
const rel0 = relp(target);
const fns = inner.filter((x) => x.isFn);
P('# Phase 4 survey: ' + rel0);
P();
P('Generated by `node tools/rendermap.mjs ' + rel0 + ' --out tools/survey-phase4.md`. Report only.');
P('Reads/writes are by name and scope; `(m)` = mutated through a property, element or method call'
  + ' (.set .push .clear ...). A write through an alias is not seen.');
P();
P('## 1. Summary');
P();
const kc = {};
for (const it of inner) kc[it.kind] = (kc[it.kind] || 0) + 1;
P('- Lines: ' + lines.length + ' (' + rel0 + ')');
P('- createRenderer: ' + rng(rfn.loc.start.line, rfn.loc.end.line) + ', '
  + (rfn.loc.end.line - rfn.loc.start.line + 1) + ' lines');
P('- Module-level items outside createRenderer: ' + modItems.length + ' (imports: '
  + [...modByName].filter(([, v]) => v === null).length + ' names)');
P('- Inner items: ' + inner.length + ' = ' + fns.length + ' functions ('
  + fns.filter((x) => x.kind === 'function').length + ' declarations, '
  + fns.filter((x) => x.kind === 'arrow').length + ' arrow consts), '
  + inner.filter((x) => x.kind === 'const' && !x.isFn).length + ' other consts, '
  + inner.filter((x) => x.kind === 'let').length + ' lets, '
  + inner.filter((x) => x.kind === 'statement').length + ' bare statements');
P('- Shared state (section 4): ' + stateItems.length + ' variables');
P();
P('### createRenderer returns (' + retKeys.length + ' keys)');
P();
table(['key', 'form', 'lines', 'called from (src, `renderer.key`)'],
  retKeys.map((k) => [k.key, k.how, rng(k.start, k.end), list(usersOfKey(k.key))]));
P('Other exports of the file: ' + modItems.filter((m) => m.exported).map((m) => m.label).join(', ')
  + '. Importers of render.ts: ' + list(srcFiles.map(relp).filter((f) => /from ['"].*render\.js['"]/.test(fileText.get(f)))) + '.');
P();
P('## 2. Module-level items outside createRenderer');
P();
table(['name', 'kind', 'lines', 'exported', 'used by (src files)', 'used inside createRenderer by'],
  modItems.map((m) => {
    const users = m.exported ? m.names.flatMap(usersOfExport) : [];
    const inside = new Set(m.names.flatMap((n) => [...(modUsers.get(n) || [])]));
    return [m.label, m.kind, rng(m.start, m.end), m.exported ? 'yes' : 'no',
      m.exported ? list([...new Set(users)]) : '-', inside.size ? inside.size + ' inner items' : '-'];
  }));
P('## 3. Inner items in file order');
P();
let lastB = undefined;
for (const it of inner) {
  const bt = it.banner ? it.banner.text + ' (L' + it.banner.line + ')' : '(before the first banner)';
  if (bt !== lastB) {
    if (lastB !== undefined) P();
    P('### ' + bt);
    P();
    P('| name | kind | lines | count |');
    P('|---|---|---|---|');
    lastB = bt;
  }
  P('| ' + cell(it.name) + ' | ' + it.kind + ' | ' + rng(it.start, it.end) + ' | ' + it.count + ' |');
}
P();
P('## 4. Shared state');
P();
P('Every inner let, plus every inner const that is mutated. R = readers, W = writers.');
P();
table(['variable', 'kind', 'line', 'READ by', 'WRITTEN by'],
  stateItems.map((it) => [it.name, it.kind, 'L' + it.start, list(readersOf(it)), list(writersOf(it))]));
P('## 5. Call graph');
P();
P('Inner functions only. "calls" = inner functions this one refers to; "called by" = who refers to it'
  + ' (`(return)` = the returned object).');
P();
table(['function', 'calls', 'called by'],
  fns.map((it) => [it.name, list([...callsOf.get(it.name)]), list([...callersOf.get(it.name)])]));


P('## 6. Proposed layers');
P();
P('Assignment rule: by name first (marked `?` where it is a guess), else the nearest banner comment, else'
  + ' the previous item. A helper used by two or more layers is promoted to `shared`. The debug overlay has no'
  + ' inner items: its code is the `debug*` keys of the returned object (and `(return)` getters).');
P();
const byLayer = new Map(LAYERS.map((l) => [l, inner.filter((x) => x.layer === l)]));
const mark = (it) => (how.get(it) === 'guess' || how.get(it) === 'banner' || how.get(it) === 'promoted' ? '?' : '');
P('### Layer table');
P();
table(['layer', 'lines', 'items', 'functions'], LAYERS.map((l) => {
  const its = byLayer.get(l);
  return [LAYER_TITLE[l], its.reduce((s, x) => s + x.count, 0), its.length, its.filter((x) => x.isFn).length];
}));
P('### Items per layer (`?` = guess)');
P();
for (const l of LAYERS) {
  const its = byLayer.get(l);
  P('- **' + l + '** (' + its.length + '): ' + (its.length ? its.map((x) => x.name + mark(x)).join(', ') : '-'));
}
P();
const stateLayers = (it, pick) => {
  const s = new Set();
  for (const [o, u] of it.uses) if (pick(u)) s.add(layerOfName(o));
  return s;
};
const isW = (u) => u.w || u.m;
const isR = (u) => u.r;
P('### Per layer: shared state and calls into other layers');
P();
for (const l of LAYERS) {
  const its = byLayer.get(l);
  const names = new Set(its.map((x) => x.name));
  const rd = [], wr = [];
  for (const s of stateItems) {
    if (s.layer === l) continue;
    if ([...s.uses].some(([o, u]) => names.has(o) && isR(u))) rd.push(s.name);
    if ([...s.uses].some(([o, u]) => names.has(o) && isW(u))) wr.push(s.name);
  }
  const own = stateItems.filter((s) => s.layer === l).map((s) => s.name);
  const into = new Map();
  for (const it of its) {
    if (!it.isFn) continue;
    for (const c of callsOf.get(it.name)) {
      const t = unitByName.get(c);
      if (t.layer !== l) {
        if (!into.has(t.layer)) into.set(t.layer, new Set());
        into.get(t.layer).add(c);
      }
    }
  }
  P('#### ' + l + ' (' + its.reduce((s, x) => s + x.count, 0) + ' lines)');
  P();
  P('- owns state: ' + list(own));
  P('- reads state owned elsewhere: ' + list(rd));
  P('- writes state owned elsewhere: ' + list(wr));
  P('- calls into: ' + (into.size ? [...into].map(([t, s]) => t + ' (' + [...s].join(', ') + ')').join('; ') : '-'));
  P();
}
P('### Cross-layer state (candidates for a small shared render-context object)');
P();
P('State variables touched from more than one layer (owner layer = where it is declared / mostly used).');
P();
const cross = stateItems.map((s) => {
  const ls = new Set([...stateLayers(s, isR), ...stateLayers(s, isW)]);
  ls.delete('?');
  return { s, ls, w: stateLayers(s, isW) };
}).filter((x) => x.ls.size > 1 || (x.ls.size === 1 && !x.ls.has(x.s.layer)));
table(['variable', 'declared in', 'read by layers', 'written by layers'],
  cross.map((x) => [x.s.name, x.s.layer, list([...stateLayers(x.s, isR)]), list([...x.w])]));
const only = stateItems.filter((s) => !cross.some((x) => x.s === s));
P('State used inside one layer only (stays private to that layer): ' + list(only.map((s) => s.name + ' (' + s.layer + ')')) + '.');
P();
const text = out.join('\n') + '\n';
if (outFile) {
  writeFileSync(resolve(outFile), text);
  console.log('wrote ' + outFile + ' (' + out.length + ' lines)');
} else process.stdout.write(text);

