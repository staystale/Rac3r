import fs from 'node:fs';
function sub(path, a, b, all) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(a)) throw new Error(path + ': ' + a);
  s = all ? s.split(a).join(b) : s.replace(a, b);
  fs.writeFileSync(path, s);
}
const E = 'src/highway/extras.ts';
sub(E, 'function addSlipGate(level: HwLevel, line, mark: Stamp) {', 'function addSlipGate(level: HwLevel, line: Point[], mark: Stamp) {');
sub(E, ` * @param slip {line, lane, slip, putGate, len, dist}: the built slip
 * @returns {void}
 */
function addSlipCut(level: HwLevel, slip: Prop) {`, ` * @param slip the built slip: its line, lane, prop, gate placer, length and road distance
 * @returns {void}
 */
function addSlipCut(level: HwLevel, slip: BuiltSlip) {`);
sub(E, `      lane._segs = null;
      prop._bb = null;`, `      lane._segs = undefined;
      prop._bb = undefined;`);
sub(E, 'function slipCentreline(start: HwPose, len: number, away: number) {', 'function slipCentreline(start: HwPose, len: number, away: number): Point[] {');
sub(E, `    lane = {
      pts: [[lanePt.x, lanePt.y], ...line.slice(1)],`, `    lane: Lane = {
      pts: [[lanePt.x, lanePt.y], ...line.slice(1)],`);
sub(E, `  for (const side of [-1, 1]) {
    const pts = [];
    for (let step = -6; step <= 6; step++) {`, `  for (const side of [-1, 1]) {
    const pts: Point[] = [];
    for (let step = -6; step <= 6; step++) {`);
sub(E, '  if (dist > state.nextBridge - 450) state.nextBridge = dist + 450;', '  if (dist > state.nextBridge! - 450) state.nextBridge = dist + 450;');
sub(E, '  if (dist > state.nextSlip - 400) state.nextSlip = dist + 400;', '  if (dist > state.nextSlip! - 400) state.nextSlip = dist + 400;');
sub(E, '    dist >= state.nextSlip &&', '    dist >= state.nextSlip! &&');
sub(E, '    dist >= state.nextBridge && !state.side', '    dist >= state.nextBridge! && !state.side');
sub(E, '  const wallOff = walled ? level._cfg.wallGap : 0,', '  const wallOff = walled ? level._cfg.wallGap! : 0,');
sub(E, '  const bridge = mark({', '  const bridge = mark({');
let s = fs.readFileSync(E, 'utf8');
s = s.replace(/(  const bridge = mark\(\{[\s\S]*?\n  \}\));/, '$1 as Bridge;');
const i = s.indexOf('/**\n * The gate at the end of a slip');
s = s.slice(0, i) + `/** A slip road once built: its centre line, lane, prop, gate placer, length and road distance. */
interface BuiltSlip {
  line: Point[]; lane: Lane; prop: Prop; putGate: () => void; len: number; dist: number;
}

` + s.slice(i);
fs.writeFileSync(E, s);
sub('src/world/types.ts', `  appW?: number;   // highway.ts bridges: the approaches' width`, `  appW?: number;   // highway.ts bridges: the approaches' width
  type?: string;   // highway.ts slips: 'short', 'long' or 'side'`);
console.log('ok');
