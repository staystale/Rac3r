# Surface evolution (owner spec)

Moved here verbatim from TODO.md; open items are listed in TODO.md.

## QUEUED — SURFACE EVOLUTION (user, 2026-10-03, verbatim then read). NOT STARTED — propose a plan first.
> "The grass track track should be a mix of dirt and grass randomly across the course. Also snow should
> compress to ice after several passes. Ice should wear away with heavy braking or sliding and show the
> surface underneath. If the surface under is grass it should behave like grass and turn to mud once exposed
> and then driven over. All surfaces should have unique and noticeable graphics so we can easily and
> instantly tell them apart. They should also keep their surface / driving characteristics etc. Mud turns to
> thick mud / vector dips. Sand and gravel also have the chance to create vector dips. Remember long grass,
> short grass, two types of mud, gravel, sand, snow, ice, puddles on any surface, ice and snow on any surface."
- [ ] Grass Track ribbon: random dirt/grass patches along the course (currently fixed autograss sectors).
      DECIDED (user, 2026-10-03): random, but MOSTLY GRASS on the straights and MOSTLY DIRT in the corners.
      UPDATED (user, later 2026-10-03): "don't forget to do the grass track randomising EVERY LOAD IN" — a new
      random layout on every load (supersedes "fixed per track").
- [ ] Snow -> ice after several passes (EXISTS since 2026-10-02: 4 passes, lab.js wear map — verify it shows).
- [ ] Ice wears away under heavy braking / sliding, revealing what is UNDER it; that base then wears on its
      own rules (grass -> mud). Needs a LAYER model per wear cell: a cover (ice/snow/puddle) over a base.
- [ ] Mud -> thick mud (second mud type) with "vector dips". Sand and gravel can also form them.
      CHECKED 2026-10-03: the user asked whether Gemini/DeepSeek captured their description of "the vector
      system". THEY DID NOT — no doc in either folder mentions it; the only "ruts" are painted wear cells with
      mud grip, no height change. Waiting on the user to re-describe it before designing anything.
- [ ] Every surface instantly distinguishable by its graphics, and keeps its own driving numbers.
- [ ] Cover layers on ANY surface: puddles, snow, ice.
- ORDER (user, 2026-10-03): DISTINCT GRAPHICS FIRST — every surface instantly recognisable, by photo.
- [x] **3. Grass Track random mix — DONE 2026-10-03.** New layout every time the level loads (setLevel -> randomiseGrassTrack).
      MEASURED over 6 loads: corners 73-100% dirt, straights 1-16% dirt, 6 distinct layouts. RESTART keeps the layout.
- [x] Sand + wet tarmac + puddles-on-tarmac looks redone (user did not love them): fine grains + soft ripples; dark glossy asphalt;
      dark mirror water. Puddles tinted by what they lie in.
- [x] **2. Cover layers — DONE 2026-10-03.** snow/ice/puddles on any surface (LEVEL.covers), snow packs to ice,
      ice scrubs through under sliding/locked wheels to whatever is beneath, which then wears on its own rules;
      mud -> thick mud. Proven by tools/wearcheck.mjs. Wear baked into the ground tiles.
- [x] BUG (user, 2026-10-03): "puddles on the grass track don't mix with the mud and vanish when driven over
      and turned dirt into mud" — wear squares were drawn OVER the covers. Now under; puddles tinted by what
      they lie in (brown in dirt/mud); worn cells drawn as soft discs, not squares.
- [x] (user, 2026-10-03) "I don't love how SAND and WET TARMAC / PUDDLES ON TARMAC look" — redone; then wet got
      blue-ish puddles and DRIES where driven; broken tarmac is cracks only.
- [x] (user) puddles churn away and MIX: grass/dirt->mud, sand->gravel, gravel->mud. Ice takes ~3 locked passes.
- [ ] (user) "unless tyres are very hot" — needs the tyre-temperature model (tier 3); scale ICE_SCRUB with heat.
- [x] (user) Grass Track: fixed base (grass straights, dirt corners) + random PATCHES every load.
- [x] (user) Snow packs 4 passes then FREEZES or MELTS (50/50); scrubbed ice leaves WATER, which churns to mud.
- [x] (user) Water dries by TYRE HEAT: puddles/meltwater need hot tyres (or weather, later); wet tarmac forms dry lines
      slowly cold, fast hot. Hot tyres melt ice less. Track sides cleaner (thin fringe, no verge creep).
- [ ] WEATHER must evaporate standing water — until weather exists, puddles only go under hot tyres.
- [x] **1. Distinct graphics — DONE 2026-10-03.** Pattern per surface, thick mud added, long grass + thick mud
      test panels in the lab, ground tiles so it costs nothing (ENGINE.md "Surface graphics + ground tiles").
- Surface list: long grass, short grass, mud, thick mud, gravel, sand, snow, ice, puddles (+ tarmac kinds, dirt).
