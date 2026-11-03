import type { JokerRule } from './world/types.ts';
// raceflow.ts — AI STAGE 4: HOW A RACE ENDS. Pure bookkeeping on the sim step; main.ts
// feeds it, hud.ts draws the flag, menu.ts shows the podium + results.
//
// USER SPEC: a CHEQUERED FLAG sweeps the WHOLE screen for the winner and when the
// event ends; once the TOP 3 have finished the race is CUT SHORT and everyone else takes their
// running position; RESULTS (positions, times, gaps, best lap, penalties incl. joker) with Restart
// / Track select / Menu. DECIDED (user): a SHORT GRACE for the player once the top 3 are home —
// "but this might introduce logical flaws for timed events like rallycross / rally — make sure
// that's caught and works like real life — maybe simulate / estimate". PODIUM first, then the
// table. LAPS chosen in setup.
//
// So the classification is ON TIME, like a real timed event, never on road position alone:
// * a finished car: its race time + penalties (RX joker: none taken = +penalty, each
//   extra = +penalty);
// * a car still running when the race is cut: an ESTIMATE = now + the distance it has left / its
// pace (its last full lap, else its average so far), marked "~" in the table. RX: a car that has
// NOT taken its joker and still has more than JOKER_LEFT laps to go is assumed to take it (+ the
// joker's estimated cost), not penalised — it still had the chance; on its final stretch without
// it, the
//     penalty applies, as it would at the flag.
// * a car that will be lapped simply estimates long — the order comes out the same as "laps, then
// time". States: 'racing' -> (top 3 home) 'grace' (player still running, GRACE s) -> 'done'. The
// player finishing ends the grace at once; a player who finished in the top 3 waits at most
// WAIT_TOP3 s for the rest of the top 3.
/** A racer's car as the race flow reads it (progress, penalties, the bill). */
export interface FlowCar {
  num?: number; spec: { paint?: string }; dmgBill?: number;
  _jokers?: number; _cutPen?: number;   // jokers taken; track-cut seconds (RX)
  _prog?: number;   // race progress, m (the grid sits at negative progress)
  _stageStart?: number | null;   // a stage car's start time
  _predT?: number;   // a stage car's predicted time (main.ts lineRun)
}
/** One racer's running record. */
export interface FlowEntry {
  car: FlowCar; player: boolean;
  lapDone: number; lapT0: number; laps: number[]; best: number | null;
  finish: number | null; start: number | null; time?: number;   // stage: its own time
}
/** One row of the classified results. */
export interface FlowResult {
  car: FlowCar; player: boolean; num: number; paint?: string;
  time: number; penalty: number; total: number; est: boolean;
  best: number | null; laps: number; jokers: number; bill: number;
  dnf?: boolean; pos?: number; gap?: number;
}
/** A race in progress (or done), as the game, the HUD and the results read it. */
export interface RaceFlow {
  state: string; t: number; laps: number; entries: FlowEntry[];
  flags: number[];   // the times you crossed the line (the chequered flag)
  endT: number | null; results: FlowResult[] | null; graceT: number | null;
  firstHome: number | null; myPlace?: number;
  stage?: { finish: number } | null;
  step: (dt: number) => void; end: () => void;
}
/** What the step functions share: the flow and the race setup. */
interface FlowState {
  flow: RaceFlow; entries: FlowEntry[];
  total: number; laps: number;   // the lap length, m; the laps
  joker: JokerRule | null; stage: { finish: number } | null;
}

export const GRACE = 5, WAIT_TOP3 = 15, JOKER_LEFT = 0.6, DNF_X = 2, STAGE_WAIT = 10;
// RALLY STAGE mode (stage = { finish }) (requirement: like real life — a time trial with staggered
// starts, each timed from their own start, so you can catch the car ahead or be caught): a car's
// time runs from crossing the start line (progress 0) to the finish distance. The event
// ends when YOU are through the finish and the rest are too, or STAGE_WAIT s later; a car still on
// the stage is ESTIMATED from its pace so far (elapsed / fraction of the stage done).

/**
 * Seconds of penalty an entry carries (track cuts, plus RX joker: none taken = +penalty, each
 * extra = +penalty).
 * @param state the race-flow state
 * @param entry the entry
 * @returns penalty seconds
 */
function addPenalty(state: FlowState, entry: FlowEntry) {
  const { joker } = state;
  const cut = entry.car._cutPen || 0;   // TRACK CUTS (main.ts trackCut): seconds, RX only
  if (!joker) return cut;
  const j = entry.car._jokers || 0;
  return cut + joker.penalty * (j === 0 ? 1 : j - 1);
}

/**
 * Race progress of an entry's car (-Infinity when it has none yet).
 * @param entry the entry
 * @returns progress in metres
 */
function raceProgressOf(entry: FlowEntry) {
  return entry.car._prog === undefined ? -Infinity : entry.car._prog;
}

/**
 * One car crosses the stage finish: its time, the first home, and your chequered flag.
 * @param flow the race flow
 * @param entry the finishing entry
 * @returns {void}
 */
function finishStageEntry(flow: RaceFlow, entry: FlowEntry) {
  entry.finish = flow.t;
  entry.time = entry.finish - entry.start!;
  entry.lapDone = 1;
  if (entry.player || flow.firstHome == null) {
    if (flow.firstHome == null) flow.firstHome = flow.t;
  }
  if (entry.player) flow.flags.push(flow.t);
}

/**
 * Rally stage step: start and finish timing for every car, and the end of the event.
 * @param state the race-flow state
 * @returns {void}
 */
function stepStage(state: FlowState) {
  const { flow, entries, stage } = state;
  for (const entry of entries) {
    const prog = raceProgressOf(entry); if (!isFinite(prog)) continue;
    if (entry.start == null && prog >= 0) entry.start = flow.t;
    if (entry.start != null && entry.finish == null && prog >= stage!.finish) {
      finishStageEntry(flow, entry);
    }
  }
  const myEntry = entries.find((entry) => entry.player);
  if (myEntry && myEntry.finish != null && (entries.every((entry) => entry.finish != null)
    || flow.t - myEntry.finish >= STAGE_WAIT)) endRace(state);
}

/**
 * Lap bookkeeping step for a lapped race: lap times, best lap, finishes and flags.
 * @param state the race-flow state
 * @returns {void}
 */
function stepLaps(state: FlowState) {
  const { flow, entries, total, laps } = state;
  for (const entry of entries) {
    if (entry.finish != null) continue;
    const prog = raceProgressOf(entry); if (!isFinite(prog)) continue;
    const done = Math.floor(prog / total);
    // a lap completed: lap 1 runs from the green (the grid sits just behind the line, at
    // negative progress)
    if (done > entry.lapDone) {
      const lapTime = flow.t - entry.lapT0;
      entry.laps.push(lapTime);
      if (entry.best == null || lapTime < entry.best) entry.best = lapTime;
      entry.lapDone = done; entry.lapT0 = flow.t;
      // the chequered flag is for YOU crossing the line (requirement: only when you finish a race),
      // with your place on it
      if (done >= laps) {
        entry.finish = flow.t;
        if (flow.firstHome == null) flow.firstHome = flow.t;
        if (entry.player) {
          flow.myPlace = entries.filter((x) => x.finish != null).length;
          flow.flags.push(flow.t);
        }
      }
    }
  }
}

/**
 * Race state machine step: racing -> grace -> done.
 * @param state the race-flow state
 * @returns {void}
 */
function stepRaceState(state: FlowState) {
  const { flow, entries } = state;
  const home = entries.filter((entry) => entry.finish != null),
    need = Math.min(3, entries.length), myEntry = entries.find((entry) => entry.player);
  if (flow.state === 'racing' && home.length >= need) {
    flow.state = 'grace'; flow.graceT = flow.t;
  }
  if (flow.state === 'grace') {
    const meHome = !myEntry || myEntry.finish != null;
    // ALWAYS wait for the player (requirement: races should always wait for the player to finish
    // but cut the AI short as now); was: GRACE s after the top 3, then your time was estimated
    if (meHome) endRace(state);
  // you won; the rest of the top 3 are far behind
  } else if (myEntry && myEntry.finish != null && flow.t - myEntry.finish >= WAIT_TOP3) {
    endRace(state);
  }
}

/**
 * Advances the race by one sim step.
 * @param state the race-flow state
 * @param dt seconds
 * @returns {void}
 */
function stepRace(state: FlowState, dt: number) {
  const { flow, stage } = state;
  if (flow.state === 'done') return;
  flow.t += dt;
  if (stage) {
    stepStage(state);
    return;
  }
  stepLaps(state);
  stepRaceState(state);
}

/**
 * Estimated finish of an entry still running when the race ends.
 * @param state the race-flow state
 * @param entry the entry
 * @returns {{t: number, extra: number}} time and penalty seconds
 */
function estimateFinish(state: FlowState, entry: FlowEntry) {
  const { flow, stage, total, laps, joker } = state;
  if (stage) {
    // under a quarter of the way (or not started: a later starter): its PREDICTED stage time
    // (main.ts, lineRun), else its pace so far
    const prog = raceProgressOf(entry);
    if (entry.start == null || !(prog > 0.25 * stage.finish)) return { t: entry.car._predT
      || Infinity, extra: entry.car._cutPen || 0 };
    return { t: (flow.t - entry.start) * stage.finish / prog, extra: entry.car._cutPen || 0 };
  }
  const prog = raceProgressOf(entry), left = Math.max(0, laps * total - prog);
  const pace = entry.laps.length ? total / entry.laps[entry.laps.length - 1] : Math.max(1,
    prog) / Math.max(1, flow.t);
  let estT = flow.t + left / Math.max(1, pace), extra = addPenalty(state, entry);
  if (joker && (entry.car._jokers || 0) === 0 && left > JOKER_LEFT * total) {
    extra = entry.car._cutPen || 0;
    estT += joker.estCost || 5;
  }
  return { t: estT, extra };
}

/**
 * Ends the race and builds the classified results table into flow.results.
 * @param state the race-flow state
 * @returns {void}
 */
function endRace(state: FlowState) {
  const { flow, entries, stage } = state;
  flow.state = 'done'; flow.endT = flow.t;
  const rows: FlowResult[] = entries.map((entry) => {
    const est = entry.finish == null, outcome: { t: number; extra: number } = est
      ? estimateFinish(state, entry)
      : { t: (stage ? entry.time : entry.finish)!, extra: addPenalty(state, entry) };
    return { car: entry.car, player: entry.player, num: entry.car.num || 1,
      paint: entry.car.spec.paint, time: outcome.t, penalty: outcome.extra,
      total: outcome.t + outcome.extra, est,
      best: entry.best, laps: entry.lapDone, jokers: entry.car._jokers || 0,
        bill: Math.round(entry.car.dmgBill || 0) };
  });
  // DNF: an estimate more than DNF_X x the winner's time (parked, beached, wrong way) is not a
  // finish — classified last, as in real racing
  const win = Math.min(...rows.filter((row) => !row.est).map((row) => row.total));
  for (const row of rows) row.dnf = row.est
    && (!isFinite(row.total) || (isFinite(win) && row.total > DNF_X * win));
  rows.sort((rowA, rowB) => (Number(rowA.dnf) - Number(rowB.dnf))
    || (rowA.dnf ? rowB.laps - rowA.laps : rowA.total - rowB.total));
  rows.forEach((row, i) => { row.pos = i + 1; row.gap = row.total - rows[0].total; });
  flow.results = rows;
}

// cars: [{ car, player }]; total: lap length (m); laps; joker: LEVEL.joker or null
export function createRaceFlow({ cars, total, laps, joker = null, stage = null }: {
  cars: { car: FlowCar; player?: boolean }[]; total: number; laps: number;
  joker?: JokerRule | null; stage?: { finish: number } | null;
}): RaceFlow {
  const entries: FlowEntry[] = cars.map(({ car, player }) =>
    ({ car, player: !!player, lapDone: 0, lapT0: 0, laps: [], best: null, finish: null,
    start: stage && car._stageStart != null ? car._stageStart : null }));
  const flow = { state: 'racing', t: 0, laps, entries: entries, flags: [], endT: null,
    results: null, graceT: null, firstHome: null } as unknown as RaceFlow;   // step / end below
  // shared by the step functions: the flow object and the race setup
  const state: FlowState = { flow, entries, total, laps, joker, stage };
  flow.stage = stage;
  flow.step = (dt: number) => stepRace(state, dt);
  flow.end = () => endRace(state);
  return flow;
}
