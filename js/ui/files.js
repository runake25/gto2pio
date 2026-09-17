"use strict";

/* Copy/download, the shipped examples and file input.
 *
 * Plain browser script: every module attaches itself to GTO2PIO.ui, so
 * load order in index.html is the only wiring this site needs.
 */
(function (root) {
  const GTO2PIO = (root.GTO2PIO = root.GTO2PIO || {});
  const UI = GTO2PIO.ui || (GTO2PIO.ui = {});

/* Shipped examples (samples/ next to this file). Listed inline so the page
 * needs no directory listing / API. */
const SAMPLES = [
  { file: "gw_action_solutions.json", label: "GTO Wizard action_solutions (169 hands)" },
  { file: "target_example.json", label: "hand -> action frequencies" },
  { file: "hand_records.json", label: "one object per hand" },
];

/* A tiny payload that works offline (file://) and makes the first click useful. */
const EXAMPLE_PAYLOAD = `{
  "BB_vs_SB_3bet": {
    "AA": { "RAISE": 0.8, "CALL": 0.2 },
    "KK": { "RAISE": 0.7, "CALL": 0.3 },
    "QQ": { "RAISE": 0.45, "CALL": 0.55 },
    "JJ": { "RAISE": 0.2, "CALL": 0.8 },
    "TT": { "RAISE": 0.1, "CALL": 0.9 },
    "99": { "CALL": 1 },
    "88": { "CALL": 1 },
    "77": { "RAISE": 0.05, "CALL": 0.95 },
    "AKs": { "RAISE": 0.9, "CALL": 0.1 },
    "AKo": { "RAISE": 0.6, "CALL": 0.4 },
    "AQs": { "RAISE": 0.5, "CALL": 0.5 },
    "AQo": { "RAISE": 0.2, "CALL": 0.8 },
    "AJs": { "RAISE": 0.3, "CALL": 0.7 },
    "ATs": { "CALL": 1 },
    "KQs": { "RAISE": 0.25, "CALL": 0.75 }
  }
}`;

async function copyRange() {
  const text = UI.dom.el.range.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    UI.dom.el.range.select();
    document.execCommand("copy");
  }
  const button = UI.dom.$("copy-btn");
  const original = button.textContent;
  button.textContent = "Copied!";
  window.setTimeout(() => {
    button.textContent = original;
  }, 1200);
}

function downloadRange() {
  const text = UI.dom.el.range.value;
  if (!text) return;
  const selected = UI.dom.state.result && UI.dom.state.result.included.length
    ? "_" + UI.dom.state.result.included.join("-")
    : "";
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = ("pio_range" + selected + ".txt").replace(/[^\w.+-]/g, "_");
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function loadSamples() {
  SAMPLES.forEach((sample) => {
    const option = document.createElement("option");
    option.value = sample.file;
    option.textContent = sample.label;
    UI.dom.el.sampleSelect.appendChild(option);
  });
}

async function loadSample(file) {
  try {
    const response = await fetch("samples/" + encodeURIComponent(file));
    if (!response.ok) {
      UI.dom.showError(
        "Could not load " + file + " (HTTP " + response.status + "). " +
          "If you opened this page from disk, run it through a local web server instead."
      );
      return;
    }
    const text = await response.text();
    try {
      UI.dom.el.json.value = JSON.stringify(JSON.parse(text), null, 2);
    } catch (error) {
      UI.dom.el.json.value = text; // keep the raw text
    }
    UI.main.analyze({ resetSelection: true });
  } catch (error) {
    UI.dom.showError("Could not load the sample: " + error);
  }
}

function loadExample() {
  UI.dom.el.json.value = EXAMPLE_PAYLOAD;
  UI.main.analyze({ resetSelection: true });
}


  UI.files = {
    SAMPLES,
    EXAMPLE_PAYLOAD,
    copyRange,
    downloadRange,
    loadSamples,
    loadSample,
    loadExample,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
