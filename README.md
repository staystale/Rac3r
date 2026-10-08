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
- `tools/` - test and check scripts (`node tools/<name>.mjs`). Some have a hardcoded `C:/Users/Admin/...` path that needs changing on another machine.
- `BRIEF.md`, `PLAN.md`, `SPECS-2026-10-03.md`, `ENGINE.md` - design brief, plan, specs and engine notes
- `CLAUDE.md`, `HANDOVER.md`, `TODO.md` - project notes and to-do list
