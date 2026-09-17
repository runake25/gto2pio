# GTO Wizard &rarr; PioSOLVER range converter

[![check](https://github.com/runake25/gto2pio/actions/workflows/check.yml/badge.svg)](https://github.com/runake25/gto2pio/actions/workflows/check.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![dependencies: none](https://img.shields.io/badge/dependencies-none-brightgreen.svg)](#architecture--tech-stack)

**Live demo: <https://runake25.github.io/gto2pio/>**

GTO Wizard shows you a solution, PioSOLVER wants a range string. This page does the
conversion in your browser: copy the `spot-solution` JSON out of GTO Wizard, paste it,
tick the actions you want, copy the finished Pio range. Nothing is uploaded - no backend,
no account, no cost.

## Key features

- **Eight payload shapes detected automatically** - GTO Wizard `action_solutions`
  (169-element `strategy` arrays), strategy matrices with a hand axis, hand&rarr;frequencies,
  hand&rarr;action maps, one record per hand, one object per action, single weights, and the
  aggregated per-hand `actions_total_combos` report.
- **Gets the weights right.** GTO Wizard's frequencies are relative to the combos a hand
  still has at that node, its combo totals are absolute - both are combined, and the
  payload's own totals pick the reading. If a range cannot be reproduced from them you get
  an amber warning instead of a silently wrong result.
- **Every action stays separate.** `F`, `C`, `R2.5`, `R31.5`, `RAI` each get their own tick
  box, colour, share and range text - an all-in can never hide inside "raise".
- **Coloured 13&times;13 grid**: every cell is sliced into the action colours in their real
  proportions, with a legend that matches the tick boxes.
- **Output controls**, each with a `?` badge and a concrete example: decimals (0-6), minimum
  weight, suited+offsuit merging on equal weights, and a 0-1 vs 0-100 scale override.
- **Presets**: Raise + Call, Continues (everything but fold), All, None.
- **How to use tab** with a four-step guide and an annotated screenshot of the Network tab.
- **Zero dependencies, zero build step, works offline** - save the files and paste JSON
  without a server; the copy/download and per-action ranges all run locally.
- **Checked on every push**: CI converts the shipped sample in Node and asserts the range
  and the per-action combo totals; a headless-Chrome smoke test drives the real page.

**Limits:** it converts JSON **to** a Pio range (not back), it converts the node you copied
(one street, one player), and frequencies are assumed to be fractions of 1 unless the
payload clearly uses percentages - use **Scale** if the guess is wrong.

## Quickstart

**Use the live page** (<https://runake25.github.io/gto2pio/>):

1. Open the spot you want in GTO Wizard.
2. Press `F12`, click the **Network** tab, and type `spot` in its filter box.
3. Copy the response of the `spot-solution` request (right click &rarr; *Copy*).
4. Paste it into the page, press **Convert**, tick the actions, press **Copy**.

No payload at hand? **Load GTO Wizard sample** converts a real 218 KB response first.

**Run it locally** (under two minutes, nothing to install but Python or Node):

```bash
git clone https://github.com/runake25/gto2pio.git
cd gto2pio
python -m http.server 5099        # or: npx serve .
# open http://127.0.0.1:5099/
```

`index.html` also opens straight from disk; only the *Load sample* button needs a web
server, because browsers block `fetch()` on `file://`.

**Deploy your own copy:** fork the repo, then **Settings &rarr; Pages &rarr; Deploy from a
branch &rarr; `main` / `/ (root)`**. No build step, so it is live within a minute.

## Configuration

**Nothing to configure: no environment variables, no secrets, no API keys, no `.env`** -
the page is static and converts in your browser. The only knobs are files:

| Knob | Where | Value |
|---|---|---|
| Sample payload | `samples/gw_action_solutions.json` | shipped real GTO Wizard response (218 KB) |
| Cache-busting version | `?v=` on all 13 assets in `index.html` + `GTO2PIO.VERSION` | `0.3.7` - bump both on every release |
| Local port | the `python -m http.server <port>` command | `5099` (any free port) |
| Conversion options | the **Options** card in the UI | merge: no, decimals: 2, min weight: 0, scale: auto |
| How-to guide text | `index.html`, inside `<section class="tut">` | plain HTML, edit freely |

GitHub Pages caches these files for 10 minutes, and the page plus its scripts are cached
separately - so a visitor can run an older script against a newer page. That is why the
`?v=` query is bumped on every asset in `index.html` at release time; the page also
detects the mismatch and shows a red "hard-refresh" banner instead of failing.

## Architecture / tech stack

| Piece | Detail |
|---|---|
| Runtime | Static HTML + CSS + JavaScript: plain `<script>` tags on one `GTO2PIO` namespace. No build step, no bundler, no framework, no CDN, no dependency |
| Backend | None. Nothing to host, nothing to pay for; GitHub Pages serves the files (`.nojekyll`, so no Jekyll pass) |
| Converter | `js/lib/*` - pure logic, no DOM: `schema.js` detects the payload shape, `parser.js` builds the result, `pio.js` writes the range, `hands.js`/`actions.js`/`common.js` support them |
| Page | `js/ui/*` - one file per concern: `dom.js` state, `colors.js` palette, `render.js` drawing, `files.js` copy + sample, `main.js` wiring, tabs and presets |
| Data | `samples/gw_action_solutions.json` - the real response the **Load sample** button converts |
| Quality gates | `.github/workflows/check.yml` (Node 20: syntax check + converts the sample and asserts the per-action combos 534.49 / 491.45 / 91.01) and a headless-Chrome smoke test kept in the author's dev tree |

```
index.html      the app: converter panel + How-to-use tab
css/style.css   styling (dark by default)
js/lib/         the converter (no DOM)
js/ui/          the page
assets/         favicon + the annotated Network-tab screenshot
samples/        the shipped GTO Wizard payload
```

## License & contributing

[MIT](LICENSE) &copy; 2026 runake25. Not affiliated with GTO Wizard or PioSOLVER - both are
trademarks of their owners; this tool only reads the JSON you paste and writes plain text.

Found a payload that converts wrongly, or have an idea? Open an issue at
<https://github.com/runake25/gto2pio/issues> with the shape you pasted (trim anything
private) and what you expected instead. Pull requests are welcome: keep the
zero-dependency, no-build-step constraint and the existing structure, and CI will check
your push with `check.yml`.

