// THE PAUSE CLOCK (default; ?pauseclock=0 off): a bedside alarm clock beside MUTE in the pause
// menu - seven-segment digits in the menu's gold, the unlit segments faintly showing, the season,
// day and (after dark) the moon beside it. It reads the event's game clock (the time the sky
// shows; the clock stands still while paused) and glows once it is dark enough for headlights.
import { CLOCK, calendarAt, hourText, moonName } from '../world/clock.ts';
import { DAYLIGHT, HEADLIGHTS_ON_DARKNESS } from '../world/daylight.ts';
import { SEASON_NAMES } from '../world/weather.ts';

// the seven segments a-g in a 12 x 20 box, as polygons with pointed ends
const SEGMENT_POINTS: Record<string, string> = {
  a: '2.6,1 9.4,1 8.4,2.2 3.6,2.2',
  b: '11,2.6 9.8,3.6 9.8,8.4 11,9.4',
  c: '11,10.6 9.8,11.6 9.8,16.4 11,17.4',
  d: '2.6,19 9.4,19 8.4,17.8 3.6,17.8',
  e: '1,10.6 2.2,11.6 2.2,16.4 1,17.4',
  f: '1,2.6 2.2,3.6 2.2,8.4 1,9.4',
  g: '2.4,10 3.4,9.2 8.6,9.2 9.6,10 8.6,10.8 3.4,10.8',
};
// the segments lit for each digit 0-9
const DIGIT_SEGMENTS = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc',
  'abcdefg', 'abcdfg'];
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * One seven-segment digit, every segment drawn; the digit's own are lit, the rest ghosts.
 * @param digit 0-9
 * @returns the digit
 */
function makeDigit(digit: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 20');
  for (const [name, points] of Object.entries(SEGMENT_POINTS)) {
    const segment = document.createElementNS(SVG_NS, 'polygon');
    segment.setAttribute('points', points);
    segment.setAttribute('class', DIGIT_SEGMENTS[digit].includes(name) ? 'lit' : 'ghost');
    svg.appendChild(segment);
  }
  return svg;
}

/**
 * The colon between the hours and the minutes.
 * @returns the colon
 */
function makeColon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 4 20');
  svg.setAttribute('class', 'colon');
  for (const dotY of [6, 12]) {
    const dot = document.createElementNS(SVG_NS, 'rect');
    for (const [key, value] of [['x', 1], ['y', dotY], ['width', 2], ['height', 2]] as const) {
      dot.setAttribute(key, String(value));
    }
    dot.setAttribute('class', 'lit');
    svg.appendChild(dot);
  }
  return svg;
}

/**
 * Adds the alarm clock to a row of the pause menu (nothing without the game clock).
 * @param row the row it joins (the SOUND row, beside MUTE)
 */
export function addPauseClock(row: HTMLElement): void {
  if (!CLOCK.isOn) return;
  const when = calendarAt(CLOCK.eventS);
  const isNight = DAYLIGHT.darkness >= HEADLIGHTS_ON_DARKNESS;
  const clock = document.createElement('div');
  clock.className = 'pclock' + (isNight ? ' night' : '');
  const time = hourText(when.hour);
  clock.setAttribute('role', 'img');
  clock.setAttribute('aria-label', 'game clock ' + time);
  const digits = document.createElement('div');
  digits.className = 'digits';
  for (const char of time) digits.appendChild(char === ':' ? makeColon() : makeDigit(+char));
  clock.appendChild(digits);
  const side = document.createElement('div');
  side.className = 'side';
  const lines = [SEASON_NAMES[when.season], 'DAY ' + (when.dayInSeason + 1)];
  if (isNight && moonName(when.moon)) lines.push('● ' + moonName(when.moon));
  lines.forEach((text, index) => {
    const line = document.createElement(index ? 'span' : 'b');
    line.textContent = text;
    side.appendChild(line);
  });
  clock.appendChild(side);
  row.appendChild(clock);
}
