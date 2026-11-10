// highway/finish.ts - THE HIGHWAY'S FINISH (?hwfinish=1; owner 11-09: "we should allow highway
// levels to have a distance or timer to end it… or infinit / It should be an option in the menu",
// "Timer or distance - or get away"): ENDLESS (a VS AI race ends on the getaway alone, a solo run
// never), a distance from the start, or a time from the green. The setup picks one
// (menu/finishrow.ts); the race flow ends on it (ai/hwFlow.ts atFinish) - and a VS AI race on the
// getaway as before, whichever comes first.

/** A finish: m from the start, or s from the green; neither: endless. */
export interface HwFinish { m?: number; t?: number }

/** One choice in the setup: its code (remembered), its label and its finish. */
export interface HwFinishChoice { code: string; label: string; finish: HwFinish | null }

// the setup's choices, in the order shown (the distances on one row, the times on the next)
export const HW_FINISHES: HwFinishChoice[] = [
  { code: 'endless', label: 'ENDLESS', finish: null },
  { code: 'km5', label: '5 KM', finish: { m: 5000 } },
  { code: 'km10', label: '10 KM', finish: { m: 10000 } },
  { code: 'km20', label: '20 KM', finish: { m: 20000 } },
  { code: 'min3', label: '3 MIN', finish: { t: 180 } },
  { code: 'min5', label: '5 MIN', finish: { t: 300 } },
  { code: 'min10', label: '10 MIN', finish: { t: 600 } },
];

/**
 * A finish by its code.
 * @param code the setup's code (null / unknown: endless)
 * @returns the finish, or null (endless)
 */
export const finishOf = (code?: string | null): HwFinish | null =>
  HW_FINISHES.find((choice) => choice.code === code)?.finish ?? null;

/**
 * A finish in words, for the results: "10 KM", "5 MIN"; "" for endless.
 * @param finish the finish
 * @returns its label
 */
export function finishLabel(finish?: HwFinish | null): string {
  if (!finish) return '';
  return HW_FINISHES.find((choice) => choice.finish && choice.finish.m === finish.m
    && choice.finish.t === finish.t)?.label ?? (finish.m ? finish.m / 1000 + ' KM'
    : Math.round((finish.t || 0) / 60) + ' MIN');
}
