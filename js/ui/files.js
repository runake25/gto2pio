"use strict";

/* Copy/download, the shipped sample and the file input.
 *
 * Plain browser script: every module attaches itself to GTO2PIO.ui, so
 * load order in index.html is the only wiring this site needs.
 */
(function (root) {
  const GTO2PIO = (root.GTO2PIO = root.GTO2PIO || {});
  const UI = GTO2PIO.ui || (GTO2PIO.ui = {});

/* The one shipped sample: a real GTO Wizard /solution/ response
 * (samples/gw_action_solutions.json). Everything else you paste yourself. */
const SAMPLE_FILE = "gw_action_solutions.json";
const SAMPLE_LABEL = "Load GTO Wizard sample";

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

function loadSample() {
  return loadFile(SAMPLE_FILE);
}

async function loadFile(file) {
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


  UI.files = {
    SAMPLE_FILE,
    SAMPLE_LABEL,
    copyRange,
    downloadRange,
    loadSample,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
