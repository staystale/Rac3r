// _mudedges.mjs [level] [tempC] - ?mudwater=1: when do a level's mud pieces' cells dry, and when
// does each piece itself step (its edge strips)? Per piece: cells, the time 50 / 95 / 100 % of
// its cells passed each stage, and when the piece stepped.
const W = new URL('../../src/', import.meta.url).href;
const load = await import(W + 'world/load.ts');
const wear = await import(W + 'world/wear.ts');
const Wx = await import(W + 'world/weather.ts');
const P = await import(W + 'world/puddles.ts');
const field = await import(W + 'world/coverfield.ts');
const mud = await import(W + 'world/levelmud.ts');
const levelId = process.argv[2] || 'bowling-alley', tempC = +(process.argv[3] || 30);
mud.setMudWater(true);
load.initWorld();
load.setLevel(levelId);
Wx.WEATHER.trackC = tempC; Wx.WEATHER.rain = 0; Wx.setWetness(0);
wear.clearWear(); P.resetPuddles(); field.resetCoverField();
const pieces = mud.levelMudPieces().filter((piece) => piece.box.x1 - piece.box.x0 > 20);
// the live pieces are module state: find them again by holder
const live = pieces.map((piece) => ({ holder: piece.holder, was: piece.holder.surface.id }));
const cellsOf = new Map();
for (const item of live) {
  const box = pieces[live.indexOf(item)].box, list = [];
  for (const cell of wear.wearMap.values()) {
    const x = (cell.cx + 0.5) * 1.5, y = (cell.cy + 0.5) * 1.5;
    if (x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1 && cell.orig === item.was) list.push(cell);
  }
  cellsOf.set(item, list);
}
const marks = live.map(() => ({}));
for (let second = 1; second <= 2400; second++) {
  P.stepPuddles(1);
  live.forEach((item, index) => {
    const cells = cellsOf.get(item), done = cells.filter((cell) => cell.base !== item.was).length;
    const share = done / Math.max(1, cells.length), mark = marks[index];
    for (const at of [0.5, 0.95, 1]) if (share >= at && !mark[at]) mark[at] = second;
    if (item.holder.surface.id !== item.was && !mark.step) mark.step = second;
  });
}
live.forEach((item, index) => {
  const mark = marks[index];
  console.log(`${levelId} ${tempC} C ${item.was} piece, ${cellsOf.get(item).length} cells: 50% ${mark[0.5]} s,`
    + ` 95% ${mark[0.95]} s, all ${mark[1]} s, piece stepped ${mark.step} s`);
});
