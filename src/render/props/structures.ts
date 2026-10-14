// The garage block, the control tower and the hangar painters.
import type { Prop } from '../../world/types.ts';
import type { PropCtx } from './types.ts';

/**
 * Draws the garages prop (garages).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawGarages(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // PIT GARAGES (Thruxton photo): concrete-block units under a red tyre-brand banner. Local
  // +x = along the lane, -y = the lane side. Top-down: the flat roof with a divider per unit,
  // the banner along the front edge. Squares only (pixel rule). First cut (photographed): a
  // light grey roof vanished into the concrete apron and a 1.3 m banner read as a red wall.
  // Now a dark slate roof with an outline, ribbed per unit, and a 0.9 m banner with the brand
  // once, centred.
  const garageW = prop.w! * ppm,
    garageH = prop.h! * ppm,
    unit = 5,
    edge = Math.max(1, 0.25 * ppm);
  view.ctx.fillStyle = 'rgba(10,12,16,0.40)';
  view.ctx.fillRect(-garageW / 2 + 0.6 * ppm, -garageH / 2 + 0.8 * ppm, garageW, garageH);
  view.ctx.fillStyle = '#3b4047';
  view.ctx.fillRect(-garageW / 2, -garageH / 2, garageW, garageH); // outline
  view.ctx.fillStyle = '#5b626b';
  view.ctx.fillRect(
    -garageW / 2 + edge,
    -garageH / 2 + edge,
    garageW - 2 * edge,
    garageH - 2 * edge,
  ); // roof
  view.ctx.fillStyle = '#666d77';
  for (let y = 1; y < 10; y += 2)
    view.ctx.fillRect(
      -garageW / 2 + edge,
      -garageH / 2 + (garageH * y) / 10,
      garageW - 2 * edge,
      Math.max(1, 0.2 * ppm),
    ); // roof ribs
  view.ctx.fillStyle = '#3b4047';
  const units = Math.max(1, Math.round(prop.w! / unit));
  for (let unitIdx = 1; unitIdx < units; unitIdx++)
    view.ctx.fillRect(
      -garageW / 2 + (garageW * unitIdx) / units - edge / 2,
      -garageH / 2,
      edge,
      garageH,
    );
  const bannerH = 0.9 * ppm; // the banner, lane side
  view.ctx.fillStyle = '#c8302c';
  view.ctx.fillRect(-garageW / 2, -garageH / 2, garageW, bannerH);
  if (bannerH >= 8) {
    view.ctx.fillStyle = '#ffffff';
    view.ctx.font = `900 ${Math.round(bannerH * 0.8)}px Impact, ui-sans-serif, sans-serif`;
    view.ctx.textAlign = 'center';
    view.ctx.textBaseline = 'middle';
    view.ctx.fillText(
      prop.brand || 'KUM TYRES',
      0,
      -garageH / 2 + bannerH / 2 + 1,
      garageW * 0.9,
    );
  } else {
    view.ctx.fillStyle = '#ffffff';
    view.ctx.fillRect(
      -garageW * 0.25,
      -garageH / 2 + bannerH * 0.3,
      garageW * 0.5,
      Math.max(1, bannerH * 0.4),
    );
  }
}

/**
 * Draws the tower prop (tower).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawTower(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // CONTROL TOWER: a two-storey block (long shadow = tall) with a small glazed cab on the
  // roof. The first cut — a square with
  // a thick dark band — photographed as a swimming pool.
  const towerSize = (prop.size || 9) * ppm,
    cabSize = towerSize * 0.45;
  view.ctx.fillStyle = 'rgba(10,12,16,0.40)';
  view.ctx.fillRect(
    -towerSize / 2 + 1.6 * ppm,
    -towerSize / 2 + 2.2 * ppm,
    towerSize,
    towerSize,
  );
  view.ctx.fillStyle = '#d9d5cc';
  view.ctx.fillRect(-towerSize / 2, -towerSize / 2, towerSize, towerSize); // flat roof
  view.ctx.fillStyle = '#bdb8ad';
  view.ctx.fillRect(-towerSize / 2, towerSize / 2 - 0.5 * ppm, towerSize, 0.5 * ppm);
  // parapet shade
  view.ctx.fillRect(towerSize / 2 - 0.5 * ppm, -towerSize / 2, 0.5 * ppm, towerSize);
  view.ctx.fillStyle = 'rgba(10,12,16,0.35)';
  // the cab's shadow
  view.ctx.fillRect(-cabSize / 2 + 0.6 * ppm, -cabSize / 2 + 0.8 * ppm, cabSize, cabSize);
  view.ctx.fillStyle = '#2f4656';
  view.ctx.fillRect(-cabSize / 2, -cabSize / 2, cabSize, cabSize); // glazed cab
  view.ctx.fillStyle = '#e9e6df';
  view.ctx.fillRect(
    -cabSize / 2 + 0.35 * ppm,
    -cabSize / 2 + 0.35 * ppm,
    cabSize - 0.7 * ppm,
    cabSize - 0.7 * ppm,
  ); // its roof
  view.ctx.fillStyle = '#5a5e66';
  view.ctx.fillRect(-0.25 * ppm, -0.25 * ppm, 0.5 * ppm, 0.5 * ppm); // mast
}

/**
 * Draws the hangar prop (hangar).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawHangar(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // T2-style hangar: corrugated roof (ribs across), a lighter ridge, dark door end. Squares
  // only.
  const hangarW = prop.w! * ppm,
    hangarH = prop.h! * ppm;
  view.ctx.fillStyle = 'rgba(10,12,16,0.40)';
  view.ctx.fillRect(-hangarW / 2 + 1.2 * ppm, -hangarH / 2 + 1.6 * ppm, hangarW, hangarH);
  view.ctx.fillStyle = '#7b8188';
  view.ctx.fillRect(-hangarW / 2, -hangarH / 2, hangarW, hangarH);
  view.ctx.fillStyle = '#8c929a';
  view.ctx.fillRect(-hangarW / 2, -hangarH / 2, hangarW, hangarH * 0.5);
  view.ctx.fillStyle = '#6a7077';
  for (let x = -prop.w! / 2 + 1; x < prop.w! / 2; x += 1.6)
    view.ctx.fillRect(x * ppm, -hangarH / 2, Math.max(1, 0.18 * ppm), hangarH);
  view.ctx.fillStyle = '#a7adb4';
  view.ctx.fillRect(-hangarW / 2, -Math.max(1, 0.2 * ppm), hangarW, Math.max(2, 0.4 * ppm));
  view.ctx.fillStyle = '#3d4249';
  view.ctx.fillRect(hangarW / 2 - 0.8 * ppm, -hangarH / 2, 0.8 * ppm, hangarH);
}
