// raceflow.js — AI STAGE 4: HOW A RACE ENDS (2026-10-04). Pure bookkeeping on the sim step; main.js feeds it, hud.js draws the flag,
// menu.js shows the podium + results.
//
// USER SPEC (2026-10-04): a CHEQUERED FLAG sweeps the WHOLE screen for the winner and when the event ends; once the TOP 3 have finished
// the race is CUT SHORT and everyone else takes their running position; RESULTS (positions, times, gaps, best lap, penalties incl. joker)
// with Restart / Track select / Menu. DECIDED (user): a SHORT GRACE for the player once the top 3 are home — "but this might introduce
// logical flaws for timed events like rallycross / rally — make sure that's caught and works like real life — maybe simulate / estimate".
// PODIUM first, then the table. LAPS chosen in setup.
//
// So the classification is ON TIME, like a real timed event, never on road position alone:
//   * a finished car: its race time + penalties (RX joker: none taken = +penalty, each extra = +penalty);
//   * a car still running when the race is cut: an ESTIMATE = now + the distance it has left / its pace (its last full lap, else its
//     average so far), marked "~" in the table. RX: a car that has NOT taken its joker and still has more than JOKER_LEFT laps to go is
//     assumed to take it (+ the joker's estimated cost), not penalised — it still had the chance; on its final stretch without it, the
//     penalty applies, as it would at the flag.
//   * a car that will be lapped simply estimates long — the order comes out the same as "laps, then time".
// States: 'racing' -> (top 3 home) 'grace' (player still running, GRACE s) -> 'done'. The player finishing ends the grace at once; a
// player who finished in the top 3 waits at most WAIT_TOP3 s for the rest of the top 3.
export const GRACE = 5, WAIT_TOP3 = 15, JOKER_LEFT = 0.6, DNF_X = 2, STAGE_WAIT = 10;
// RALLY STAGE mode (stage = { finish }: user, 2026-10-04: "like real life — a time trial with staggered starts, each timed from their own
// start, so you can catch the car ahead or be caught"): a car's time runs from crossing the start line (progress 0) to the finish
// distance. The event ends when YOU are through the finish and the rest are too, or STAGE_WAIT s later; a car still on the stage is
// ESTIMATED from its pace so far (elapsed / fraction of the stage done).

// cars: [{ car, player }]; total: lap length (m); laps; joker: LEVEL.joker or null
export function createRaceFlow({ cars, total, laps, joker = null, stage = null }) {
  const E = cars.map(({ car, player }) => ({ car, player: !!player, lapDone: 0, lapT0: 0, laps: [], best: null, finish: null, start: stage && car._stageStart != null ? car._stageStart : null }));
  const flow = { state: 'racing', t: 0, laps, entries: E, flags: [], endT: null, results: null, graceT: null, firstHome: null };
  const pen = (e) => {
    const cut = e.car._cutPen || 0;   // TRACK CUTS (main.js trackCut): seconds, RX only
    if (!joker) return cut;
    const j = e.car._jokers || 0;
    return cut + joker.penalty * (j === 0 ? 1 : j - 1);
  };
  const progOf = (e) => (e.car._prog === undefined ? -Infinity : e.car._prog);
  flow.stage = stage;
  flow.step = (dt) => {
    if (flow.state === 'done') return;
    flow.t += dt;
    if (stage) {
      for (const e of E) {
        const p = progOf(e); if (!isFinite(p)) continue;
        if (e.start == null && p >= 0) e.start = flow.t;
        if (e.start != null && e.finish == null && p >= stage.finish) { e.finish = flow.t; e.time = e.finish - e.start; e.lapDone = 1; if (e.player || flow.firstHome == null) { if (flow.firstHome == null) flow.firstHome = flow.t; } if (e.player) flow.flags.push(flow.t); }
      }
      const me = E.find((e) => e.player);
      if (me && me.finish != null && (E.every((e) => e.finish != null) || flow.t - me.finish >= STAGE_WAIT)) end();
      return;
    }
    for (const e of E) {
      if (e.finish != null) continue;
      const p = progOf(e); if (!isFinite(p)) continue;
      const done = Math.floor(p / total);
      // a lap completed: lap 1 runs from the green (the grid sits just behind the line, at negative progress)
      if (done > e.lapDone) {
        const lt = flow.t - e.lapT0; e.laps.push(lt); if (e.best == null || lt < e.best) e.best = lt;
        e.lapDone = done; e.lapT0 = flow.t;
        // the chequered flag is for YOU crossing the line (user, 2026-10-04: "only when you finish a race"), with your place on it
        if (done >= laps) { e.finish = flow.t; if (flow.firstHome == null) flow.firstHome = flow.t; if (e.player) { flow.myPlace = E.filter((x) => x.finish != null).length; flow.flags.push(flow.t); } }
      }
    }
    const home = E.filter((e) => e.finish != null), need = Math.min(3, E.length), me = E.find((e) => e.player);
    if (flow.state === 'racing' && home.length >= need) {
      flow.state = 'grace'; flow.graceT = flow.t;
    }
    if (flow.state === 'grace') {
      const meHome = !me || me.finish != null;
      // ALWAYS wait for the player (user, 2026-10-04: "races should always wait for the player to finish but cut the AI short as now");
      // was: GRACE s after the top 3, then your time was estimated
      if (meHome) end();
    } else if (me && me.finish != null && flow.t - me.finish >= WAIT_TOP3) end();   // you won; the rest of the top 3 are far behind
  };
  function estimate(e) {
    if (stage) {
      // under a quarter of the way (or not started: a later starter): its PREDICTED stage time (main.js, lineRun), else its pace so far
      const p = progOf(e);
      if (e.start == null || !(p > 0.25 * stage.finish)) return { t: e.car._predT || Infinity, extra: e.car._cutPen || 0 };
      return { t: (flow.t - e.start) * stage.finish / p, extra: e.car._cutPen || 0 };
    }
    const p = progOf(e), left = Math.max(0, laps * total - p);
    const pace = e.laps.length ? total / e.laps[e.laps.length - 1] : Math.max(1, p) / Math.max(1, flow.t);
    let t = flow.t + left / Math.max(1, pace), extra = pen(e);
    if (joker && (e.car._jokers || 0) === 0 && left > JOKER_LEFT * total) { extra = e.car._cutPen || 0; t += joker.estCost || 5; }
    return { t, extra };
  }
  function end() {
    flow.state = 'done'; flow.endT = flow.t;
    const rows = E.map((e) => {
      const est = e.finish == null, r = est ? estimate(e) : { t: stage ? e.time : e.finish, extra: pen(e) };
      return { car: e.car, player: e.player, num: e.car.num || 1, paint: e.car.spec.paint, time: r.t, penalty: r.extra, total: r.t + r.extra, est,
        best: e.best, laps: e.lapDone, jokers: e.car._jokers || 0, bill: Math.round(e.car.dmgBill || 0) };
    });
    // DNF: an estimate more than DNF_X x the winner's time (parked, beached, wrong way) is not a finish — classified last, as in real racing
    const win = Math.min(...rows.filter((r) => !r.est).map((r) => r.total));
    for (const r of rows) r.dnf = r.est && (!isFinite(r.total) || (isFinite(win) && r.total > DNF_X * win));
    rows.sort((a, b) => (a.dnf - b.dnf) || (a.dnf ? b.laps - a.laps : a.total - b.total));
    rows.forEach((r, i) => { r.pos = i + 1; r.gap = r.total - rows[0].total; });
    flow.results = rows;
  }
  flow.end = end;
  return flow;
}
