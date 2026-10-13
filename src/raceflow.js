// raceflow.js — AI STAGE 4: HOW A RACE ENDS (2026-10-04). Pure bookkeeping on the sim step;
// main.js feeds it, hud.js draws the flag,
// menu.js shows the podium + results.
//
// USER SPEC (2026-10-04): a CHEQUERED FLAG sweeps the WHOLE screen for the winner and when the
// event ends; once the TOP 3 have finished
// the race is CUT SHORT and everyone else takes their running position; RESULTS (positions, times,
// gaps, best lap, penalties incl. joker)
// with Restart / Track select / Menu. DECIDED (user): a SHORT GRACE for the player once the top 3
// are home — "but this might introduce
// logical flaws for timed events like rallycross / rally — make sure that's caught and works like
// real life — maybe simulate / estimate".
// PODIUM first, then the table. LAPS chosen in setup.
//
// So the classification is ON TIME, like a real timed event, never on road position alone:
// * a finished car: its race time + penalties (RX joker: none taken = +penalty, each extra =
// +penalty);
// * a car still running when the race is cut: an ESTIMATE = now + the distance it has left / its
// pace (its last full lap, else its
// average so far), marked "~" in the table. RX: a car that has NOT taken its joker and still has
// more than JOKER_LEFT laps to go is
// assumed to take it (+ the joker's estimated cost), not penalised — it still had the chance; on
// its final stretch without it, the
//     penalty applies, as it would at the flag.
// * a car that will be lapped simply estimates long — the order comes out the same as "laps, then
// time".
// States: 'racing' -> (top 3 home) 'grace' (player still running, GRACE s) -> 'done'. The player
// finishing ends the grace at once; a
// player who finished in the top 3 waits at most WAIT_TOP3 s for the rest of the top 3.
export const GRACE = 5, WAIT_TOP3 = 15, JOKER_LEFT = 0.6, DNF_X = 2, STAGE_WAIT = 10;
// RALLY STAGE mode (stage = { finish }: user, 2026-10-04: "like real life — a time trial with
// staggered starts, each timed from their own
// start, so you can catch the car ahead or be caught"): a car's time runs from crossing the start
// line (progress 0) to the finish
// distance. The event ends when YOU are through the finish and the rest are too, or STAGE_WAIT s
// later; a car still on the stage is
// ESTIMATED from its pace so far (elapsed / fraction of the stage done).

// cars: [{ car, player }]; total: lap length (m); laps; joker: LEVEL.joker or null
export function createRaceFlow({ cars, total, laps, joker = null, stage = null }) {
  const entries = cars.map(({ car, player }) =>
    ({ car, player: !!player, lapDone: 0, lapT0: 0, laps: [], best: null, finish: null,
    start: stage && car._stageStart != null ? car._stageStart : null }));
  const flow = { state: 'racing', t: 0, laps, entries: entries, flags: [], endT: null,
    results: null, graceT: null, firstHome: null };
  const pen = (entry) => {
    const cut = entry.car._cutPen || 0;   // TRACK CUTS (main.js trackCut): seconds, RX only
    if (!joker) return cut;
    const j = entry.car._jokers || 0;
    return cut + joker.penalty * (j === 0 ? 1 : j - 1);
  };
  const progOf = (entry) => (entry.car._prog === undefined ? -Infinity : entry.car._prog);
  flow.stage = stage;
  flow.step = (dt) => {
    if (flow.state === 'done') return;
    flow.t += dt;
    if (stage) {
      for (const entry of entries) {
        const prog = progOf(entry); if (!isFinite(prog)) continue;
        if (entry.start == null && prog >= 0) entry.start = flow.t;
        if (entry.start != null && entry.finish == null && prog >= stage.finish) {
          entry.finish = flow.t;
          entry.time = entry.finish - entry.start;
          entry.lapDone = 1;
          if (entry.player || flow.firstHome == null) {
            if (flow.firstHome == null) flow.firstHome = flow.t;
          }
          if (entry.player) flow.flags.push(flow.t);
        }
      }
      const myEntry = entries.find((entry) => entry.player);
      if (myEntry && myEntry.finish != null && (entries.every((entry) => entry.finish != null)
        || flow.t - myEntry.finish >= STAGE_WAIT)) end();
      return;
    }
    for (const entry of entries) {
      if (entry.finish != null) continue;
      const prog = progOf(entry); if (!isFinite(prog)) continue;
      const done = Math.floor(prog / total);
      // a lap completed: lap 1 runs from the green (the grid sits just behind the line, at
      // negative progress)
      if (done > entry.lapDone) {
        const lapTime = flow.t - entry.lapT0;
        entry.laps.push(lapTime);
        if (entry.best == null || lapTime < entry.best) entry.best = lapTime;
        entry.lapDone = done; entry.lapT0 = flow.t;
        // the chequered flag is for YOU crossing the line (user, 2026-10-04: "only when you finish
        // a race"), with your place on it
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
    const home = entries.filter((entry) => entry.finish != null),
      need = Math.min(3, entries.length), myEntry = entries.find((entry) => entry.player);
    if (flow.state === 'racing' && home.length >= need) {
      flow.state = 'grace'; flow.graceT = flow.t;
    }
    if (flow.state === 'grace') {
      const meHome = !myEntry || myEntry.finish != null;
      // ALWAYS wait for the player (user, 2026-10-04: "races should always wait for the player to
      // finish but cut the AI short as now");
      // was: GRACE s after the top 3, then your time was estimated
      if (meHome) end();
    // you won; the rest of the top 3 are far behind
    } else if (myEntry && myEntry.finish != null && flow.t - myEntry.finish >= WAIT_TOP3) end();
  };
  function estimate(entry) {
    if (stage) {
      // under a quarter of the way (or not started: a later starter): its PREDICTED stage time
      // (main.js, lineRun), else its pace so far
      const prog = progOf(entry);
      if (entry.start == null || !(prog > 0.25 * stage.finish)) return { t: entry.car._predT
        || Infinity, extra: entry.car._cutPen || 0 };
      return { t: (flow.t - entry.start) * stage.finish / prog, extra: entry.car._cutPen || 0 };
    }
    const prog = progOf(entry), left = Math.max(0, laps * total - prog);
    const pace = entry.laps.length ? total / entry.laps[entry.laps.length - 1] : Math.max(1,
      prog) / Math.max(1, flow.t);
    let estT = flow.t + left / Math.max(1, pace), extra = pen(entry);
    if (joker && (entry.car._jokers || 0) === 0 && left > JOKER_LEFT * total) {
      extra = entry.car._cutPen || 0;
      estT += joker.estCost || 5;
    }
    return { t: estT, extra };
  }
  function end() {
    flow.state = 'done'; flow.endT = flow.t;
    const rows = entries.map((entry) => {
      const est = entry.finish == null, outcome = est
        ? estimate(entry) : { t: stage ? entry.time : entry.finish, extra: pen(entry) };
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
    rows.sort((rowA, rowB) => (rowA.dnf - rowB.dnf)
      || (rowA.dnf ? rowB.laps - rowA.laps : rowA.total - rowB.total));
    rows.forEach((row, i) => { row.pos = i + 1; row.gap = row.total - rows[0].total; });
    flow.results = rows;
  }
  flow.end = end;
  return flow;
}
