import fs from 'node:fs';
const T = 'src/testlist.js';
let s = fs.readFileSync(T, 'utf8');
if (!s.endsWith('];\n')) throw new Error('end');
s = s.replace(/\n\];\n$/, `
  {
    id: 'smokeover',
    added: '2026-11-02',
    name: 'Some tyre smoke (35 %) and gravel / dirt / sand dust (30 %) drift OVER the cars',
    where: 'Plain link + &smokeover=1: a burnout, a drift; Knobhill RX, Sahara, gravel run-off',
    try: 'Burnout and drift on tarmac; slide on gravel / sand; follow an AI car on dirt.',
    wrong: 'Your car lost in a cloud, or smoke that looks pasted on top of the car.',
  },
  {
    id: 'heatease',
    added: '2026-11-02',
    name: 'Tyres heat 15 % slower from sliding and cornering (cooling unchanged)',
    where: 'Plain link + &heatease=1 (tyre temps on the HUD)',
    try: 'A burnout (smoke from ~7 s, was ~6), a long drift, hard laps.',
    wrong: 'Tyres that never warm up, or still too hot too fast.',
  },
  {
    id: 'flatgrip',
    added: '2026-11-02',
    name: 'Flat tyre: keeps 90 % grip (was 70 % for the whole axle), drags and pulls to its side',
    where: 'Plain link + &flatgrip=1; a puncture (stingers, debris, a big hit), Muscle + Hatch',
    try: 'Pull away and drive on a flat front and a flat rear; let go of the wheel at speed.',
    wrong: 'A flat that feels like nothing, or a pull you cannot hold.',
  },
];
`);
fs.writeFileSync(T, s);
