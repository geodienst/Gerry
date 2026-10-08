# Vote slider in chapter 01: plan

Owner decisions of October 8, 2026: national only, 47% to 56% of the two-party vote, start at once.

## Why

The seat counts at the 2016 and 2020 votes (51.8% Democratic) depend on that vote level: the enacted maps have more safe seats than neutral maps, so the drawing effect is 2 seats toward Democrats at 50% and 13 toward Republicans at 53% (check of October 8, scratch scripts `check2022/`). A slider shows this directly and puts the majority thresholds (49.8%, 51.2%, 52.3%) in view.

## Method

- Uniform swing, as for the majority thresholds: the same amount is added to the Democratic share of every district (enacted maps and every neutral plan) and of every state (proportional seats).
- Grid: 47.0% to 56.0% in steps of 0.1 point (91 points), plus the base share itself. All points lie within 5 points of the base share, the range in which the result of the six one-seat states is held fixed (as in `national_majority`).
- Per point: proportional seats (largest remainder per state), neutral median and 5th and 95th percentile (states convolved as independent, as for the national band), enacted seats, and the share of neutral outcomes with more Democratic seats than the enacted maps.
- The base point takes the main numbers (224, 223 with 217 to 229, 213). A district share of exactly one half counts as Republican off the base, as in `seats_at_swing`.
- Checks: every series is non-decreasing in the vote share; the base point equals the main numbers.

## Tasks

1. **Metric** `swing_point` in `pipeline/gerry/metrics.py`, with pytest examples worked out by hand.
2. **Pipeline**: `national_swing` in `03_metrics.py` (grid, base point, checks), `swing` in `NATIONAL_FIELDS`, contract test in `site/js/contract.test.js`, `results.json` regenerated.
3. **View model**: `chapters.js` gives the texts and numbers for each point (rows, effects, band, spread, position, finding, waffle title) and the threshold sentence; at the base point everything equals the current texts. Node tests.
4. **Page**: a range input under the readout of chapter 01 with ticks for the three thresholds, keyboard steps of 0.1 point, an `aria-valuetext`; the rows, the effects, the waffle and the sentences follow it. No square-by-square animation while dragging. Headless checks.
5. **Text**: one paragraph in the method on the slider and uniform swing; README; publish.
