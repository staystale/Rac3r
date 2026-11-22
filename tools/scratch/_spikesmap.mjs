// _spikesmap.mjs - SPIKES PEAK's whole road as one picture (world/levels/venues/spikes.ts): the
// course drawn to scale, the start and the summit marked, every hairpin numbered with its radius
// (tools/spikestrace.mjs), the ones pushed apart (would fold) in red. tools/scratch/_spikes-map.png
import { launchBrowser } from '../lib/browser.mjs';
import { SPIKES_ROAD } from '../../src/world/levels/venues/spikes.ts';

const PINS = JSON.parse(process.env.PINS || '[]');   // [[game m, radius, pushed 0/1], ...]
const xs = SPIKES_ROAD.map((pt) => pt[0]), ys = SPIKES_ROAD.map((pt) => pt[1]);
const x0 = Math.min(...xs) - 60, y0 = Math.min(...ys) - 60, w = Math.max(...xs) + 60 - x0,
  h = Math.max(...ys) + 60 - y0, scale = 1400 / h;
const at = (m) => SPIKES_ROAD[Math.min(SPIKES_ROAD.length - 1, Math.round(m / 2))];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w * scale)}" height="1400"
  viewBox="${x0} ${y0} ${w} ${h}" style="background:#d8cfbf">
  <polyline points="${SPIKES_ROAD.map((pt) => pt.join(',')).join(' ')}" fill="none"
    stroke="#333" stroke-width="8.2"/>
  ${PINS.map(([m, r, pushed], i) => `<circle cx="${at(m)[0]}" cy="${at(m)[1]}" r="22" fill="none"
    stroke="${pushed ? '#d22' : '#27a'}" stroke-width="5"/><text x="${at(m)[0] + 28}"
    y="${at(m)[1] + 10}" font-size="42" fill="${pushed ? '#d22' : '#27a'}">${i + 1}: ${r}</text>`)
    .join('')}
  <text x="${SPIKES_ROAD[0][0] - 220}" y="${SPIKES_ROAD[0][1] + 60}" font-size="60">START</text>
  <text x="${at(1e9)[0] + 30}" y="${at(1e9)[1]}" font-size="60">SUMMIT</text></svg>`;
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: Math.ceil(w * scale), height: 1400 } });
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  await page.screenshot({ path: 'tools/scratch/_spikes-map.png' });
  console.log('map', Math.ceil(w * scale), 'x 1400');
} finally {
  await browser.close();
}
