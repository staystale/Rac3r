// testlist.ts — THE TEST QUEUE (requirement: can we have a to test feature list somewhere in the
// pause menu while we are testing it should be updated when we add new features and remove approved
// features). Shown in the PAUSE menu, TEST MODE only (menu.ts pause -> TESTING).
// THE RULE (CLAUDE.md §1): every feature handed over for a phone test gets an entry here IN THE
// SAME TASK; when the user approves it, DELETE the entry (and note the verdict in TODO.md). Keep
// each line short: it is read on a phone, mid-session.
//   id     stable key            added   date it went in (yyyy-mm-dd)
//   where  how to get to it      try     what to do      wrong   what would count as a bug
/** One feature under test, as the pause menu lists it. */
export interface TestEntry {
  id: string; added: string; name: string; where: string; try: string; wrong: string;
}

export const TEST_LIST: TestEntry[] = [
  {
    id: 'aislide',
    added: '2026-11-15',
    name: 'AI slides by the ground, uses kerbs, makes sliding mistakes',
    where: 'Test link + &aislide=1: a slippery stage or track with 2WD AI cars (rear-drive hatch, '
      + 'F2) - gravel or sand (Sweaty Lamb, a rally stage), or snow / ice weather; then a tarmac '
      + 'circuit for the kerbs',
    try: 'Watch the AI through corners: on loose ground and ice they should hold slides and still '
      + 'be quick; on tarmac a wheel on the kerbs; weaker drivers now and then sliding wide.',
    wrong: 'AI slower or spinning off far more on ice / snow, sliding on dry tarmac, cutting '
      + 'across the grass instead of the kerb, or no visible change on gravel.',
  },
  {
    id: 'tiledensity',
    added: '2026-11-15',
    name: 'Ground made at the sharpness the zoom needs: smoother zoomed out, no ground drawing in '
      + 'after the loading bar',
    where: 'Test link + &tiledensity=1&report=1, against the test link + &report=1 back to back on '
      + 'the same phone: the highway flat out (zoomed out) and off the road; a start on a stadium '
      + '(Stade de Prance) and on Spa; on a PC too if one is to hand',
    try: 'Feel for the jerks zoomed out on the highway; watch the ground as the view zooms out '
      + 'with speed and back in as you brake; after the loading bar, watch the fly-in.',
    wrong: 'As jerky or worse; the ground flashing, shifting, going soft or blurry as the zoom '
      + 'changes; road, lines or verges drawing in late after the bar or ahead of the car; any '
      + 'change when zoomed in (slow or stopped).',
  },
];
