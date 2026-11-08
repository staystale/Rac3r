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
  // the garage GRIP line: stock, then the trial's difference in ember (?testgarage)
  ["        return spec.gripG == null ? '—' : tarmacGrip === 1 ? spec.gripG + ' G'\n",
    "        if (FIX.testGarage && spec.gripG != null && tarmacGrip !== 1) {\n"
    + "          // ?testgarage (owner 11-03): the stock figure, and what the set on it adds or takes,\n"
    + "          // in ember\n"
    + "          const diff = spec.gripG * tarmacGrip - spec.gripG;\n"
    + "          return spec.gripG + ' G <span style=\"color:' + MENU_COL.accent + '\">'\n"
    + "            + (diff > 0 ? '+' : '−') + Math.abs(diff).toFixed(2) + '</span>';\n"
    + "        }\n"
    + "        return spec.gripG == null ? '—' : tarmacGrip === 1 ? spec.gripG + ' G'\n"],
  // the tyre bars: against the car's own stock set (?testgarage), the difference in ember
  ['    const bar = (lbl: string, surf: string) => {\n      const grip = tyre.grip[surf], percent = Math.round((grip - 1) * 100),',
    '    // ?testgarage: against the car\'s own stock set (the Chevvy\'s Polyglass, not Pre-Spun)\n'
    + '    const stockSet = FIX.testGarage ? fittedTyre(car) : null;\n'
    + '    const bar = (lbl: string, surf: string) => {\n'
    + '      const grip = tyre.grip[surf] / (stockSet ? stockSet.grip[surf] : 1),\n'
    + '        percent = Math.round((grip - 1) * 100),'],
  ['color:${tone}">\\\n${percent > 0 ? \'+\' : \'\'}${percent}%</span></div>`;',
    'color:${stockSet && percent !== 0 ? MENU_COL.accent : tone}">\\\n${percent > 0 ? \'+\' : \'\'}${percent}%</span></div>`;'],
  ["        + '\">white line = STOCK (PRE-SPUN)</div>'",
    "        + '\">white line = STOCK (' + (stockSet ? stockSet.name : 'PRE-SPUN').toUpperCase() + ')</div>'"],
]);
console.log('ok');
