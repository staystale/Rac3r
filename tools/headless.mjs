// NOTE (2026-10-03): this renders into a STUB canvas and so cannot see NaN, layout or overlap bugs (CLAUDE.md §3).
// Use tools/uicheck.mjs or tools/devshot.mjs, which drive a real browser. Kept only for reference.
// headless test — checks rendering at multiple screen sizes
const mockCtx = {
  save() {}, restore() {}, beginPath() {}, closePath() {},
  moveTo() {}, lineTo() {}, arc() {}, arcTo() {},
  fill() {}, stroke() {}, fillRect() {}, strokeRect() {}, clearRect() {},
  fillText() {}, strokeText() {}, measureText(t) { return { width: t.length * 8 }; },
  rect() {}, drawImage() {}, clip() {}, translate() {}, rotate() {}, scale() {},
  quadraticCurveTo() {}, bezierCurveTo() {}, ellipse() {}, createPattern() { return {}; },
  createLinearGradient() { return { addColorStop() {} }; },
  createRadialGradient() { return { addColorStop() {} }; },
  setTransform() {}, getTransform() { return { a:1,b:0,c:0,d:1,e:0,f:0 }; },
};
let _f='',_s=''; let _lw=1;
Object.defineProperties(mockCtx, {
  fillStyle: { get:()=>_f, set:(v)=>{_f=v} },
  strokeStyle: { get:()=>_s, set:(v)=>{_s=v} },
  lineWidth: { get:()=>_lw, set:(v)=>{_lw=v} },
  font: { get:()=>'', set:()=>{} }, textAlign: { get:()=>'', set:()=>{} },
  textBaseline: { get:()=>'', set:()=>{} }, globalAlpha: { get:()=>1, set:()=>{} },
  globalCompositeOperation: { get:()=>'', set:()=>{} },
});
let CW=844, CH=390;
const mockCanvas = {
  getContext() { return mockCtx; },
  get clientWidth() { return CW; }, get clientHeight() { return CH; },
  width: 0, height: 0,
  addEventListener() {}, setPointerCapture() {},
  getBoundingClientRect() { return { left:0, top:0, width:CW, height:CH }; },
};
globalThis.document = {
  getElementById(id) { return mockCanvas; },
  createElement(tag) {
    if (tag === 'canvas') return { getContext() { return mockCtx; }, width: 1800, height: 1800 };
    return { style: {}, appendChild() {}, remove() {} };
  },
  body: { appendChild() {}, removeChild() {} },
};
globalThis.location = { search: '', href: 'http://localhost:8080' };
globalThis.matchMedia = () => ({ matches: false });
globalThis.devicePixelRatio = 2;
globalThis.performance = { now: () => Date.now() };
globalThis.requestAnimationFrame = () => {};
globalThis.addEventListener = () => {};
globalThis.AudioContext = undefined;
globalThis.window = globalThis;

async function main() {
  await import('../src/main.js');
  const r = globalThis.__game.renderer;
  const game = globalThis.__game;
  for (const [label, w, h] of [['Desktop 1280x720',1280,720],['Phone landscape 844x390',844,390],['Phone portrait 390x844',390,844]]) {
    CW = w; CH = h;
    r.resize();
    const n = r.sy(-10), s = r.sy(10);
    console.log(`${label}: ${r.W}x${r.H} dpr=${r.dpr} PPM=${r.PPM.toFixed(1)} car@(${r.sx(0).toFixed(0)},${r.sy(0).toFixed(0)}) sy:${n.toFixed(0)}/${s.toFixed(0)} ${n<s?'OK':'✗'}`);
  }
  try { r.frame(game, 1/60, Date.now()/1000); console.log('frame renders'); } catch(e) { console.log('frame error:', e.message); }
}
main();