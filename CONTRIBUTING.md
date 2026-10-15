# Contributing

## Set up

```
npm install
node serve.mjs          # the game on http://localhost:8080
```

Read `CLAUDE.md` (how we work and the code standards) and `ENGINE.md` (the architecture) first.
`TODO.md` is the open work.

## The standards in one screen

The full list is `CLAUDE.md` section 2. The lint gate enforces the measurable ones with no exceptions:

- names of 3 or more characters that say what the thing is (`x`, `y`, `z`, `i`, `j` and the physics
  pairs `dx`, `dy`, `dt`, `vx`, `vy`, `nx`, `ny` are allowed); no shadowed names
- lines of at most 100 characters, one statement per line
- functions of at most 80 lines (aim for 40) and complexity 15
- files of at most 800 lines (aim for 500), one job per file

Also: no hidden globals (only `window.__game`, for the test tools); JSDoc on public functions;
comments explain why and what was measured, never history (dates, task numbers, quotes); no
duplicate systems; no allocation in per-frame code. Every generated or in-game name is a parody pun.

## Checks

```
npm run verify          # syntax, encoding, TypeScript, lint - must print OK
npm run suite           # the quick regression checks, pass / fail (about 8 minutes)
node tools/runall.mjs --full     # adds the slow AI / race / frame-time checks
```

Refactors must not change behaviour. Prove it: on the commit you start from, save the references,
then compare after your change.

```
node tools/worldhash.mjs --highway 20 save   # level data
node tools/simhash.mjs save                  # every car's state over 13 runs
node tools/renderhash.mjs save               # the drawn pixels over 14 runs
# ... make the change ...
npm run suite                                # the three must print SAME
node tools/samecode.mjs                      # for renames / comment-only edits: the built code is identical
```

CI runs `verify` (required before anything reaches `main`) and the suite against the base commit
on every push.

## Commits

One change per commit, a message that says what and why, and the numbers that prove it. Visual and
handling changes are photographed at phone size (844x390 and 390x844) and played on a phone before
they are merged.
