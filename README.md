# GTO Wizard &rarr; PioSOLVER range converter

[![check](https://github.com/runake25/gto2pio/actions/workflows/check.yml/badge.svg)](https://github.com/runake25/gto2pio/actions/workflows/check.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![no dependencies](https://img.shields.io/badge/dependencies-none-brightgreen.svg)](#why-there-is-no-backend)

**Use it here: <https://runake25.github.io/gto2pio/>**

Paste a **GTO Wizard solution JSON**, tick the actions you want to keep
(raise + call by default), and copy a ready-to-paste **PioSOLVER range string**:

```
AA,KK,QQ:0.45,JJ:0.45,TT:0.45,99:0.45,88,77,66,55,44,33,22,AK,AQ,AJ,AT,A9:0.45,...
```

Everything happens inside your browser tab: **your hands are never uploaded**, and
there is no server to go down or to pay for.

## Why there is no backend

The whole converter is JavaScript under `js/lib` - no dependencies, no build
step, no CDN. That is what makes this site hostable for free on GitHub Pages, and
it means you can save the files and use the tool offline as well.

## What it does

* **Auto-detects seven payload shapes** instead of demanding one exact layout -
  including the real GTO Wizard `/solution/` response with 169-element
  `strategy` arrays (see [Supported payloads](#supported-payloads)).
* **Gets the hand axis right.** GTO Wizard's strategy arrays are not in the order
  the 169-hand grid is usually drawn in, so the axis is read from the payload
  itself (`players_info[].simple_hand_counters`) and then **cross-checked against
  the payload's own `total_combos`**. When the numbers disagree you get an
  explicit warning instead of a silently wrong range.
* **Pick exactly what goes into the range**: fold / check / call / bet / raise /
  all-in, with raise sizes merged or kept separate and all-in counted as a raise
  or as its own action.
* **Output controls**: decimals (0-6), minimum weight, suited+offsuit merging on
  equal weights (`AK` instead of `AKs,AKo`), and a 0-1 vs 0-100 frequency scale
  override.
* **Feedback you can trust**: combo count and % of all 1326 combos shown as
  chips, a 13x13 weighted grid, a range per action, and a 13x13 preview. When
  something could not be confirmed (for example a hand axis that does not match
  the payload's own combo counts) you get an amber warning next to the **Convert**
  button instead of a silently wrong range - the details are in the Inspector.

## Supported payloads

| # | Shape | Example |
|---|-------|---------|
| 1 | GTO Wizard `action_solutions` (`strategy` arrays) | `{"action_solutions": [{"action": {"code": "R2.5"}, "strategy": [...169...], "total_combos": 138.4}]}` |
| 2 | strategy matrix + hand axis (either orientation) | `{"hands": ["AA", "KK"], "strategy": [[1, 0], [0.5, 0.5]]}` |
| 3 | hand &rarr; frequency list | `{"AA": [0.6, 0.4], "KK": [1.0, 0.0]}` |
| 4 | hand &rarr; action map | `{"AA": {"RAISE": 0.6, "CALL": 0.4}}` |
| 5 | one record per hand | `[{"hand": "AA", "actions": [{"action": "R", "frequency": 0.6}]}]` |
| 6 | one object per action | `[{"action": {"code": "R"}, "strategy": {"AA": 0.5, "KK": 1.0}}]` |
| 7 | single weight per hand (no action axis) | `{"AA": 0.5, "KK": 1.0}` |

Frequencies may be numbers, numeric strings (`"45"`, `"45%"`) or
`{"frequency": 0.5}` objects. Combo-level payloads (`AhAd`) are averaged into
their hand class, which is how PioSOLVER applies one weight to every combo.
Trailing commas and `const data = {...};` wrapping are tolerated too.

## Run it locally

```bash
git clone https://github.com/runake25/gto2pio.git
cd gto2pio
python -m http.server 8000        # or: npx serve .
```

Then open <http://localhost:8000>. Opening `index.html` straight from disk also
works (the **Example** button is built in); only the *Load sample* dropdown needs
a web server, because browsers block `fetch()` on `file://`.

## Deploy your own copy

Fork this repo, then **Settings &rarr; Pages &rarr; Build and deployment &rarr;
Deploy from a branch &rarr; `main` / `/ (root)`**. There is no build step, so the
site is live within a minute and every commit redeploys it. Jekyll processing is
off (`.nojekyll`).

## Files

```
index.html            one page, no framework
js/lib/               the converter (no DOM in here)
  common.js             shared helpers, python-compatible rounding, ParseError
  hands.js              the 169 hand classes, combo counts, canonicalisation
  actions.js            action codes and words -> families and labels
  pio.js                Pio range emission and combo statistics
  schema.js             detection of a pasted payload (the seven shapes)
  parser.js             analyze(): detected strategy -> ready-to-use result
  gto2pio.js            the public API (GTO2PIO.analyze, GTO2PIO.VERSION, ...)
js/ui/                the page, one file per concern
  dom.js                element lookups, UI state, status/error feedback
  render.js             drawing a result: actions, range, chips, grid, panels
  files.js              copy/download, samples, the file input
  main.js               analyze() wiring, presets, disclosures, init()
css/style.css         styling (no framework, dark by default)
assets/favicon.ico    site icon
samples/              example payloads (gw_action_solutions.json is synthetic)
```

Every file is a plain `<script>`: each one attaches itself to the `GTO2PIO`
namespace, so the load order in `index.html` is the only wiring this site needs.

## How this was verified

* The JavaScript converter is a port of a Python implementation that came with 90
  unit tests, and the port was checked against it over **112 (payload x option)
  combinations** - identical `range_text`, per-action ranges, combo statistics,
  notes and warnings on every one, including a real 177 KB GTO Wizard payload.
  That reference implementation and its harness stay in the author's working tree,
  because this repository is deliberately just the deployable site.
* A headless-browser smoke test drives the page the way a user does: paste a
  169-hand payload, click **Convert**, then assert the range, the stats chips, the
  169-cell grid, the per-action panels, the empty-box and unrecognised-payload
  error paths, and that no JavaScript error was logged.
* CI (`.github/workflows/check.yml`) syntax-checks both scripts and converts the
  shipped sample in Node on every push.

## Limitations

* It converts JSON **to** a Pio range, not the other way round.
* Frequencies are assumed to be fractions of 1 unless the payload clearly uses
  percentages; use the **Scale** option if the auto-detection guesses wrong.
* If a payload carries a hand axis in an order that neither its own combo
  counters nor GTO Wizard's implied order reproduces, you get a warning telling
  you the axis could not be confirmed - the range may be wrong then, so check it.
* Only what you paste is converted: pick the right node in GTO Wizard (one
  street, one player) before copying the JSON.

## License

[MIT](LICENSE) &copy; 2026 runake25.

Not affiliated with GTO Wizard or PioSOLVER - both are trademarks of their
owners. This tool only reads the JSON you paste into it and writes a plain text
range.
