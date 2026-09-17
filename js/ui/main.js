"use strict";

/* analyze() wiring, presets, disclosures and init().
 *
 * Plain browser script: every module attaches itself to GTO2PIO.ui, so
 * load order in index.html is the only wiring this site needs.
 */
(function (root) {
  const GTO2PIO = (root.GTO2PIO = root.GTO2PIO || {});
  const UI = GTO2PIO.ui || (GTO2PIO.ui = {});

function analyze({ resetSelection = false } = {}) {
  const text = UI.dom.el.json.value;
  if (!text.trim()) {
    UI.dom.showError("The JSON box is empty - paste a GTO Wizard payload first.");
    return;
  }
  if (resetSelection) UI.dom.state.include = null;

  UI.dom.el.button.disabled = true;
  UI.dom.setStatus("working...");
  UI.dom.setInlineStatus(
    "Converting " + Math.round(text.length / 1024) + " KB of JSON, please wait...",
    "working"
  );

  try {
    // everything happens right here in the page - no upload, no round trip
    const data = GTO2PIO.analyze(text, UI.dom.optionsPayload());

    UI.dom.clearError();
    UI.dom.state.result = data;
    try {
      UI.render.renderResult(data);
    } catch (error) {
      UI.dom.showError("The result could not be displayed: " + error);
      return;
    }

    UI.dom.setStatus("ok - " + data.detection.format_label, "ok");
    UI.dom.setInlineStatus(
      "Range ready: " + data.detection.hand_count + " hands, selected " +
        (data.included.join(" + ") || "nothing") + ", " + data.stats.combos +
        " combos (" + data.stats.percent.toFixed(2) + "% of all combos)." +
        "\nCopy it from the Pio range box on the right.",
      "ok"
    );
    UI.dom.scrollToOutput();
  } catch (error) {
    if (error instanceof GTO2PIO.ParseError) {
      UI.dom.showError(error.message, error.diagnostics);
    } else {
      UI.dom.showError(
        "This payload could not be converted: " +
          (error && error.message ? error.message : String(error))
      );
    }
  } finally {
    UI.dom.el.button.disabled = false;
  }
}

function setSelection(ids) {
  UI.dom.state.include = ids;
  UI.dom.el.actions.querySelectorAll('input[type="checkbox"]').forEach((box) => {
    box.checked = ids.includes(box.dataset.group);
  });
  analyze();
}

function presetRaiseCall() {
  if (!UI.dom.state.result) {
    UI.dom.setInlineStatus("Convert something first, then pick actions.", "working");
    return;
  }
  const wanted = ["raise", "bet", "call"];
  const ids = UI.dom.state.result.groups
    .map((group) => group.id)
    .filter((id) => wanted.includes(id));
  if (!ids.length) {
    UI.dom.setStatus("no raise/bet/call group in this payload", "err");
    return;
  }
  setSelection(ids);
}

function presetAll() {
  if (!UI.dom.state.result) return;
  setSelection(UI.dom.state.result.groups.map((group) => group.id));
}

function presetNone() {
  setSelection([]);
}

function bindToggle(buttonId, box) {
  UI.dom.$(buttonId).addEventListener("click", () => {
    box.hidden = !box.hidden;
  });
}

function clearAll() {
  UI.dom.el.json.value = "";
  UI.dom.el.range.value = "";
  UI.dom.el.actions.innerHTML = "";
  UI.dom.el.placeholder.hidden = false;
  UI.dom.el.chips.innerHTML = "";
  UI.dom.el.gridBox.innerHTML = "";
  UI.dom.el.perGroupBox.innerHTML = "";
  UI.dom.el.inspect.textContent = "";
  UI.dom.el.hint.textContent = "";
  UI.dom.el.sampleSelect.value = "";
  UI.dom.state.result = null;
  UI.dom.state.include = null;
  UI.dom.clearError();
  UI.dom.setInlineStatus("");
  UI.dom.setStatus("idle");
}

function init() {
  if (!window.GTO2PIO || !window.GTO2PIO.analyze) {
    UI.dom.showError(
      "The converter did not load, so this page cannot convert anything. " +
        "Refresh with Ctrl+F5, and make sure the js/lib/*.js files are reachable."
    );
    UI.dom.setStatus("error", "err");
    return;
  }
  if (UI.dom.$("version")) UI.dom.$("version").textContent = "v" + GTO2PIO.VERSION;

  UI.dom.$("analyze-btn").addEventListener("click", () => analyze({ resetSelection: true }));
  UI.dom.$("example-btn").addEventListener("click", UI.files.loadExample);
  UI.dom.$("copy-btn").addEventListener("click", UI.files.copyRange);
  UI.dom.$("download-btn").addEventListener("click", UI.files.downloadRange);
  UI.dom.$("preset-raisecall").addEventListener("click", presetRaiseCall);
  UI.dom.$("preset-all").addEventListener("click", presetAll);
  UI.dom.$("preset-none").addEventListener("click", presetNone);
  UI.dom.$("clear-btn").addEventListener("click", clearAll);

  UI.dom.el.sampleSelect.addEventListener("change", (event) => {
    if (event.target.value) UI.files.loadSample(event.target.value);
  });

  UI.dom.$("file-input").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      UI.dom.el.json.value = String(reader.result);
      analyze({ resetSelection: true });
    };
    reader.onerror = () => UI.dom.showError("Could not read " + file.name);
    reader.readAsText(file);
    event.target.value = "";
  });

  ["opt-merge", "opt-allin", "opt-combine", "opt-combos", "opt-scale",
   "opt-decimals", "opt-min-weight"].forEach((id) => {
    UI.dom.$(id).addEventListener("change", () => {
      if (UI.dom.el.json.value.trim()) analyze({ resetSelection: true });
    });
  });

  UI.dom.el.json.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      analyze({ resetSelection: true });
    }
  });

  bindToggle("grid-toggle", UI.dom.el.gridBox);
  bindToggle("per-group-toggle", UI.dom.el.perGroupBox);
  UI.dom.$("inspect-toggle").addEventListener("click", () => {
    UI.dom.el.inspect.hidden = !UI.dom.el.inspect.hidden;
  });

  // never fail silently: surface any script error in the UI
  window.addEventListener("error", (event) => {
    UI.dom.showError("JavaScript error: " + (event.message || "unknown"));
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    UI.dom.showError(
      "JavaScript error: " + (reason && reason.message ? reason.message : String(reason))
    );
  });

  UI.files.loadSamples();
  UI.dom.setStatus("idle");
}

document.addEventListener("DOMContentLoaded", init);


  UI.main = {
    analyze,
    setSelection,
    presetRaiseCall,
    presetAll,
    presetNone,
    bindToggle,
    clearAll,
    init,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
