
export const CSS = `
#menu { position: fixed; inset: 0; z-index: 20; display: flex; color: #e8e8ee; \
font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-weight: 700; letter-spacing: .06em; text-transform: uppercase; pointer-events: none; \
align-items: flex-start; }
#menu.gone { display: none; }
#menu .pane { pointer-events: auto; margin: 12px; padding: 14px; background: rgba(20,22,27,.94); \
border: 2px solid #000;
  box-shadow: inset 0 0 0 2px #3a3d48, 6px 6px 0 rgba(0,0,0,.55); display: flex; \
flex-direction: column; gap: 10px;
  max-height: calc(100% - 24px); overflow-y: auto; -webkit-overflow-scrolling: touch; }
#menu h1 { font-size: 26px; letter-spacing: .18em; margin: 2px 0 0; color: #e8a13a; \
text-shadow: 3px 3px 0 #000; }
#menu h2 { font-size: 15px; letter-spacing: .14em; margin: 0; color: #e8a13a; }
#menu .sub { font-size: 11px; opacity: .6; font-weight: 600; }
#menu button { font: inherit; text-transform: inherit; letter-spacing: inherit; color: #e8e8ee; \
background: #2a2d36; border: 2px solid #000;
  box-shadow: inset 0 0 0 2px #444856, 4px 4px 0 #000; padding: 12px 14px; min-height: 44px; \
text-align: left; cursor: pointer; }
#menu button:active { transform: translate(2px,2px); box-shadow: inset 0 0 0 2px #444856, \
2px 2px 0 #000; }
#menu button.go { background: #4cc2a0; color: #0d1a16; box-shadow: inset 0 0 0 2px #7fe0c4, \
4px 4px 0 #000; }
#menu button.on { background: #e8a13a; color: #2a1405; box-shadow: inset 0 0 0 2px #f5c879, \
4px 4px 0 #000; }
#menu button[disabled] { opacity: .38; cursor: default; }
#menu button[disabled]:active { transform: none; }
#menu .tag { font-size: 10px; color: #d8453c; margin-left: 8px; }
#menu .row { display: flex; gap: 8px; align-items: stretch; flex-wrap: wrap; }
#menu .picker { display: flex; flex-direction: column; gap: 6px; padding: 8px; margin: 4px 0 8px; \
background: #17191e; border: 2px solid #000; box-shadow: inset 0 0 0 2px #2a2d36; }
#menu .picker .prow { display: flex; align-items: center; gap: 6px; }
#menu .picker .cap { width: 52px; flex: none; text-align: center; font-size: 10px; \
padding: 5px 0; color: #14161b; border: 2px solid #000; }
#menu .picker button { flex: none; min-width: 40px; min-height: 34px; padding: 0 10px; }
#menu .picker .val { flex: 1; text-align: center; font-size: 12px; line-height: 1.1; }
#menu .picker .val.car { font-size: 15px; display: flex; flex-direction: column; \
align-items: center; }
#menu .picker .val.car span { font-size: 9px; color: #9aa0aa; margin-top: 2px; }
#menu .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); \
gap: 10px; }
#menu .card { display: flex; flex-direction: column; gap: 6px; padding: 8px; }
#menu .card canvas { width: 100%; aspect-ratio: 16 / 10; object-fit: contain; \
background: #111318; border: 2px solid #000; image-rendering: pixelated; }
#menu .card .nm { font-size: 13px; } #menu .card .k { font-size: 10px; opacity: .6; }
#menu .cats { display: flex; flex-direction: column; gap: 8px; }
#menu .cat { display: flex; align-items: center; gap: 12px; padding: 8px 12px 8px 8px; \
min-height: 64px; }
#menu .cat .strip { display: flex; gap: 3px; flex: none; width: 150px; }
#menu .cat .strip canvas { width: 48px; height: 44px; object-fit: cover; background: #111318; \
border: 2px solid #000; image-rendering: pixelated; }
#menu .cat .tx { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
#menu .cat .nm { font-size: 16px; letter-spacing: .12em; } #menu .cat .k { font-size: 10px; \
opacity: .6; text-transform: none; letter-spacing: .04em; }
#menu .cat .n { flex: none; font-size: 18px; color: #e8a13a; min-width: 28px; text-align: right; \
} #menu .cat.on .n { color: #2a1405; }
@media (max-width: 480px) { #menu .cat .strip { width: 99px; } \
#menu .cat .strip canvas:nth-child(3) { display: none; } #menu .cat .nm { font-size: 14px; } }
#menu .stats { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 12px; }
#menu .stats b { color: #4cc2a0; font-weight: 700; }
/* the lift is capped in HEIGHT: photographed in landscape it filled the pane and pushed the \
stats and buttons off screen */
#menu .lift { background: #23262e; border: 2px solid #000; image-rendering: pixelated; \
width: 100%; max-height: 34vh; object-fit: contain; }
#menu .podium { display: flex; gap: 8px; align-items: flex-end; justify-content: center; \
padding-top: 6px; }
#menu .podium > div { display: flex; flex-direction: column; align-items: center; gap: 4px; \
width: 92px; font-size: 11px; }
#menu .podium canvas { image-rendering: pixelated; max-width: 92px; max-height: 120px; \
object-fit: contain; }
#menu .podium .step { width: 100%; background: #2a2d36; border: 2px solid #000; \
box-shadow: inset 0 0 0 2px #444856; display: flex;
  align-items: flex-start; justify-content: center; font-size: 22px; padding-top: 4px; \
color: #e8a13a; }
#menu .res { display: grid; grid-template-columns: repeat(7, auto); justify-content: start; \
gap: 3px 16px; font-size: 12px; align-items: center; }
#menu .res .h { font-size: 9px; opacity: .55; }
#menu .res > div { white-space: nowrap; }
@media (max-width: 480px) { #menu .res { gap: 3px 9px; font-size: 11px; } #menu .res .h { \
font-size: 8px; } } #menu .res .me { color: #4cc2a0; } #menu .res .pen { color: #d8453c; }
#menu .res .sw { width: 12px; height: 12px; border: 2px solid #000; display: inline-block; \
vertical-align: -2px; margin-right: 4px; }
#menu .garage { display: flex; gap: 12px; flex-wrap: wrap; } #menu .garage > * { flex: 1 1 240px; \
min-width: 0; }
#menu .test { background: #17191e; border: 2px solid #000; box-shadow: inset 0 0 0 2px #2a2d36; \
padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; }
#menu .test .nm { font-size: 13px; color: #4cc2a0; } #menu .test .nm span { font-size: 9px; \
opacity: .5; margin-left: 6px; }
#menu .test .ln { font-size: 11px; text-transform: none; letter-spacing: .02em; font-weight: 600; \
line-height: 1.35; } #menu .test .ln b { color: #e8a13a; font-size: 9px; letter-spacing: .1em; \
margin-right: 4px; }
#menu .test .ln.bad b { color: #d8453c; }
`;

// GHOST-CLICK GUARD. MEASURED BUG (portrait, 2026-10-03): tapping the HUD pause chip opened the
// pause pane, and the SAME tap's follow-up click landed on RESUME, which sits right under the
// chip at 390 px — paused and resumed in one tap. Every new screen ignores clicks for GHOST_MS.
export const GHOST_MS = 350;
