// _stucksum.mjs - BUG 8's CHECK over _stuckai.mjs logs (OUT=<file.json>): per run, the AI's
// episodes with no race progress (longest, how many over 12 s not in a queue); the put-backs by
// rule, and the stuck ones AHEAD of where the car was, ONTO another car (old logs: within 3 m),
// or while the start held it or in a QUEUE (a slow car close in front facing its way, not
// itself stuck); and the highway cars standing stuck (not broken down, at a pump, a police car
// waiting or queued) for over 10 s, and the longest of those in view.
// The check PASSES when none of those counts is above 0.
// node tools/scratch/_stucksum.mjs <log.json> [<log.json> ...]
import { readFileSync } from 'node:fs';

const LONG_S = 12, TRAFFIC_LONG_S = 10, CLOSE_M = 3;
const STUCK_KINDS = new Set(['stayed', 'noProgress', 'stuck3s', 'giveUp', 'other']);
let fails = 0;
for (const file of process.argv.slice(2)) {
  const report = JSON.parse(readFileSync(file, 'utf8'));
  for (const [id, run] of Object.entries(report)) {
    const longest = Math.max(0, ...run.episodes.map((ep) => ep.dur));
    const long = run.episodes.filter((ep) => ep.dur > LONG_S && ep.queue < 0.5).length;
    const kinds = {};
    for (const put of run.resets) kinds[put.kind] = (kinds[put.kind] || 0) + 1;
    const stuckPuts = run.resets.filter((put) => STUCK_KINDS.has(put.kind));
    const ahead = stuckPuts.filter((put) => put.gain !== null && put.gain > 0.5).length;
    const close = stuckPuts.filter((put) => (put.onCar ?? put.nearest < CLOSE_M)).length;
    // (in a queue: a slow car within 12 m in front facing its way, +-60 deg, not itself stuck)
    const inQueue = (put) => put.queued && (put.queued === true || (put.queued.turn < 60
      && put.queued.headStuck <= 1));
    const wrong = stuckPuts.filter((put) => put.held || inQueue(put)).length;
    const blocked = stuckPuts.filter((put) => put.queued && !inQueue(put)).length;
    const standing = run.traffic.filter((ep) => !ep.why && ep.queue < 0.5);
    const trafficLong = standing.filter((ep) => ep.dur > TRAFFIC_LONG_S).length;
    const seenLongest = Math.max(0, ...standing.filter((ep) => ep.seen > 0.5).map((ep) => ep.dur));
    const bad = long + ahead + close + wrong + trafficLong;
    fails += bad;
    console.log(`${id.padEnd(13)} AI ${String(run.ai).padStart(2)} | no progress: longest`
      + ` ${longest.toFixed(1)} s, over ${LONG_S} s ${long} | put-backs ${JSON.stringify(kinds)}`
      + ` ahead ${ahead} close ${close} held/queued ${wrong} (a stuck car or one across in front ${blocked}) | traffic stuck over`
      + ` ${TRAFFIC_LONG_S} s ${trafficLong} (in view longest ${seenLongest.toFixed(1)} s)`
      + ` | ${bad ? 'FAIL' : 'pass'}`);
  }
}
console.log(fails ? `CHECK FAILS (${fails})` : 'CHECK PASSES');
