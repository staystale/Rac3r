import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a.slice(0, 80));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/core/fixes.ts', [['export const FIX = {\n};', `export const FIX = {
  // ?resetin=1: a mid-race RESET puts the car all four wheels on the road (was: its centre on the
  // edge, half on half off - a low car like the F1 sat in the gravel) (game/session.ts)
  resetIn: atLoad('resetin'),
};`]]);
edit('src/game/session.ts', [
  ["export const RESET_ANG = [5, 15];     // deg back toward the road, random in this range",
    "export const RESET_ANG = [5, 15];     // deg back toward the road, random in this range\n"
    + "// ?resetin (owner 11-03: \"place cars just a tiny bit more on the road / track so f1 cars don't\n"
    + "// get stuck after resetting\"): the centre moves in from the edge so all four wheels stand on the\n"
    + "// road - half the car's track, plus its rear's swing out at the reset angle, plus this margin\n"
    + "const RESET_IN_MARGIN = 0.15;\n\n"
    + "/**\n * How far in from the road's edge a reset puts the car's centre (?resetin), else 0 (on it).\n"
    + " * @param ang the reset angle, rad\n * @returns m in from the edge\n */\n"
    + "function resetInset(ang: number): number {\n"
    + "  if (!FIX.resetIn) return 0;\n"
    + "  const spec = game.car.spec;\n"
    + "  return (spec.trackWidth || 1.5) / 2 + spec.lr * Math.sin(ang) + RESET_IN_MARGIN;\n"
    + "}"],
  // joker: the angle first, then the inset edge
  ["  const along = Math.max(0, spot.along - RESET_BACK), pose = lanePose(lane, along);\n"
    + "  // the lane's +normal is (-ty, tx); a heading turned positive turns the nose toward it\n"
    + "  const x = pose.x - pose.ty * side * half, y = pose.y + pose.tx * side * half;\n"
    + "  const ang = (RESET_ANG[0] + Math.random() * (RESET_ANG[1] - RESET_ANG[0])) * Math.PI / 180;",
  "  const along = Math.max(0, spot.along - RESET_BACK), pose = lanePose(lane, along);\n"
    + "  const ang = (RESET_ANG[0] + Math.random() * (RESET_ANG[1] - RESET_ANG[0])) * Math.PI / 180;\n"
    + "  const off = Math.max(0, half - resetInset(ang));\n"
    + "  // the lane's +normal is (-ty, tx); a heading turned positive turns the nose toward it\n"
    + "  const x = pose.x - pose.ty * side * off, y = pose.y + pose.tx * side * off;"],
  // circuit
  ["  const point = onTrack(sub, dist, side * sub.width / 2, {});\n"
    + "  const ang = (RESET_ANG[0] + Math.random() * (RESET_ANG[1] - RESET_ANG[0])) * Math.PI / 180;",
  "  const ang = (RESET_ANG[0] + Math.random() * (RESET_ANG[1] - RESET_ANG[0])) * Math.PI / 180;\n"
    + "  const point = onTrack(sub, dist, side * Math.max(0, sub.width / 2 - resetInset(ang)), {});"],
]);
let s = fs.readFileSync('src/game/session.ts', 'utf8');
s = s.replace("import { resetTrackside } from \"../world/barriers.ts\";", "import { resetTrackside } from \"../world/barriers.ts\";\nimport { FIX } from '../core/fixes.ts';");
fs.writeFileSync('src/game/session.ts', s);
console.log('ok');
