import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a.slice(0, 80));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/menu/garage.ts', [
  ["row('CLASS', '#e8a13a'", "row('CLASS', MC.accent"],
  ["row('TYPE', '#4cc2a0'", "row('TYPE', MC.good"],
  ["row('CAR', '#e8e8ee'", "row('CAR', MC.fg"],
  ["'3px solid #e8a13a'", "'3px solid ' + MC.pick"],
  ["' G <span style=\"color:#9aa0aa;\\\nfont-size:10px\">STOCK '",
    "' G <span style=\"color:' + MC.dim + ';font-size:'\n            + MC.small + '\">STOCK '"],
  ["' <span style=\"color:#9aa0aa;font-size:10px\">'",
    "' <span style=\"color:' + MC.dim\n      + ';font-size:' + MC.small + '\">'"],
  ['style="width:44px;font-size:10px">${lbl}', 'style="width:44px;font-size:${MC.label}">${lbl}'],
  ['background:#2a2d36;border:1px solid #000;', 'background:${MC.well};border:1px solid #000;'],
  ['background:#e8e8ee"></div><div style="height:100%;', 'background:${MC.fg}"></div><div style="height:100%;'],
  ["grip > 1.001 ? '#4cc2a0' : grip < 0.999 ? '#d8453c' : '#9aa0aa'", 'grip > 1.001 ? MC.good : grip < 0.999 ? MC.bad : MC.dim'],
  ['text-align:right;font-size:11px;', 'text-align:right;font-size:${MC.value};'],
]);
edit('src/menu/widgets.ts', [
  ["ctx.fillStyle = '#23262e';", 'ctx.fillStyle = MC.lift.floor;'],
  ["ctx.fillStyle = '#2b2f39';", 'ctx.fillStyle = MC.lift.panel;'],
  ["ctx.fillStyle = '#e8a13a';", 'ctx.fillStyle = MC.lift.stripe;'],
  ["ctx.fillStyle = '#5a5f6d';", 'ctx.fillStyle = MC.lift.arm;'],
  ["ctx.fillStyle = '#3a3e4a';", 'ctx.fillStyle = MC.lift.post;'],
]);
const slider = ["'flex:1;min-height:34px;accent-color:#e8a13a'", "'flex:1;min-height:34px;accent-color:' + MC.accent"];
edit('src/menu/settings.ts', [slider, ["'text-align:left;color:#e8a13a'", "'text-align:left;color:' + MC.accent"]]);
edit('src/menu/setup.ts', [slider]);
edit('src/menu/race.ts', [slider]);
edit('src/menu/tracks.ts', [["  ctx.fillStyle = '#4cc2a0';\n  ctx.beginPath();", '  ctx.fillStyle = MC.good;\n  ctx.beginPath();']]);
for (const name of ['garage', 'widgets', 'settings', 'setup', 'race', 'tracks']) {
  const path = `src/menu/${name}.ts`;
  const lines = fs.readFileSync(path, 'utf8').split('\n');
  let last = 0;
  lines.forEach((line, i) => { if (/^import /.test(line)) last = i; });
  let i = last;
  while (!/;\s*$/.test(lines[i])) i++;
  lines.splice(i + 1, 0, "import { MC } from './palette.ts';");
  fs.writeFileSync(path, lines.join('\n'));
}
console.log('ok');
