# Changelog

## 0.3.3 - 2026-09-17

* **No more merging.** The "Merge raise/bet/all-in sizes" and "Treat all-in as
  raise" options are gone: every action in the payload is now its own group, so
  `F`, `C`, `R2.5`, `R31.5` and `RAI` are listed, ticked and converted separately.
* **New payload shape**: GTO Wizard's aggregated report
  (`actions_total_combos` per hand) is converted by dividing the combos by
  `total_combos_available`, with one action per key. It is only used when the
  payload has no proper per-action solution block, so real `/solution/` payloads
  keep their existing (python-verified) path.
* **Coloured grid.** The 13x13 grid now draws one vertical slice per selected
  action - heights are that hand's real frequency split, and the colours match
  the picker: F slate, C green, raise sizes on an amber-to-rose ramp, all-in
  purple. A legend above the grid shows the colour key, and the per-action ranges
  carry their colour as well.
* **Tips everywhere.** Every remaining option has a `?` badge explaining what it
  does with a concrete example (hover or tab to it).
* **Stale-cache fix.** Assets now carry a `?v=` query, the page detects a script
  that does not match the page it is running on and shows a red "hard refresh"
  banner, and the renderers no longer write into elements that are not there.
  This is what produced `TypeError: Cannot set properties of null (setting
  'innerHTML')` after the last release, for visitors holding a cached script.
* Version badge reports 0.3.3.

## 0.3.2 - 2026-09-17

* **Layout:** everything that *configures* the conversion now lives in the left
  column - paste JSON, options, `Convert`, then the action picker - so all of it
  can be set up before the first click. The right column is purely the result:
  the 13x13 grid first (collapsed by default), then the range, then the
  per-action ranges and the inspector.
* Removed the separate "Notes" card. Warnings now surface next to the **Convert**
  button in amber, and the notes, warnings and detection details are all in the
  Inspector.
* Version badge reports 0.3.2.

## 0.3.1 - 2026-09-17

* **Reorganised the source** into modules instead of two big files:
  `js/lib/` (common, hands, actions, pio, schema, parser, gto2pio) holds the
  converter and `js/ui/` (dom, render, files, main) holds the page, with
  `css/` and `assets/` for the styling and icon. Nothing was rewritten by hand -
  the mover verified itself by re-assembling the original files byte for byte
  before writing anything, and the refactor was signed off by the 112-case
  parity check plus the headless-browser test.
* No behaviour change: identical output on all 112 payload x option cases.

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
