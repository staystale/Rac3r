# Rac3r

A browser-based top-down racing / rally car sim.

## Run it

Needs [Node.js](https://nodejs.org/).

```
node serve.mjs
```

Then open http://localhost:8080 in your browser (set the `PORT` environment variable to use a different port).

## Layout

- `index.html` - entry page
- `src/` - game code
- `art/` - sprites
- `tools/` - test and check scripts (`node tools/<name>.mjs`); one-off scripts are in `tools/scratch/`
- `ENGINE.md` - architecture overview: module map, one frame, the car model, drawing
- `CLAUDE.md` - how to work on this project and the code standards
- `TODO.md` - open work
- `BRIEF.md`, `PLAN.md`, `SPECS-2026-10-03.md`, `docs/specs/` - the original design brief, plan and specs

## Check it

```
npm install
npm run verify   # syntax, encoding, TypeScript, lint
npm run suite    # the quick regression checks (pass / fail)
```

See `CONTRIBUTING.md` for the standards and how to prove a change.
