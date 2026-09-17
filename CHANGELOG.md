# Changelog

## 0.3.0 - 2026-09-16

* **The converter now runs inside the browser** (`core.js`), which turns the tool
  into a static site that can be hosted on GitHub Pages with no server, no build
  step and no dependencies. Your JSON never leaves the page.
* The JavaScript build is a port of the previous Python/Flask implementation and
  was verified against it: 112 (payload x option) combinations produce identical
  range text, per-action ranges, combo statistics, notes and warnings.
* Hand axis: read from the payload's own `players_info[].simple_hand_counters`
  when present, otherwise GTO Wizard's implied 169-hand order - and always
  cross-checked against the payload's `total_combos`, with a visible warning when
  the numbers disagree.
* UI: version badge, built-in **Example** button that works offline, footer,
  inspector panel, 13x13 weighted grid, per-action ranges, stats chips.
* Fixed two rounding/ordering traps of doing this in JavaScript: Python-style
  round-half-even on the exact decimal value, and JavaScript's reordering of
  integer-like object keys (`"22"`, `"33"`, ...) when reading a hand axis.

## 0.2.0 - 2026-09-15

*(Python/Flask version, kept in the author's local working tree.)*

* Support for the real GTO Wizard `/solution/` payload shape (`action_solutions`
  with 169-element `strategy` arrays), including the hand-axis cross-check.
* Fixed the UI JavaScript so that clicking *Convert* actually runs the
  conversion (a nested-function bug made the button do nothing), and added a
  headless-browser test that drives the real paste-and-click flow.
* Nested action sizes kept (`R2.5` +rarr; `Raise 2.5`), inline status box, red
  error box, auto-scroll, global JS-error reporting.

## 0.1.0 - 2026-09-15

* First working converter: payload auto-detection, action selection (raise +
  call by default), Pio range emission (`AA`, `:0.45`, suited/offsuit merging),
  13x13 preview, Flask UI, 88 unit tests.
