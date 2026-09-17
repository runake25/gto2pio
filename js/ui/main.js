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
  if (!UI.dom.ready()) {
    // a script cached from an older release is running against this page
    UI.dom.showStaleBanner();
    UI.dom.setStatus("old script cached", "err");
    UI.dom.setInlineStatus(
      "This page loaded a script from an older version. Press Ctrl+Shift+R " +
        "(Cmd+Shift+R on macOS) and convert again.",
      "err"
    );
    return;
  }
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

    const warnings = data.warnings || [];
    UI.dom.setStatus(
      warnings.length
        ? "ok - " + warnings.length + " warning" + (warnings.length === 1 ? "" : "s")
        : "ok - " + data.detection.format_label,
      warnings.length ? "warn" : "ok"
    );

    const summary =
      "Range ready: " + data.detection.hand_count + " hands, selected " +
      (data.included.join(" + ") || "nothing") + ", " + data.stats.combos +
      " combos (" + data.stats.percent.toFixed(2) + "% of all combos).";
    UI.dom.setInlineStatus(
      warnings.length
        ? summary + "\nCheck this first: " + warnings.join("  |  ") +
          "\n(Details in the Inspector under the range.)"
        : summary + "\nCopy it from the Pio range box on the right.",
      warnings.length ? "warn" : "ok"
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

/* The action families present in a result: a group can hold several sizes
 * (raise:2.5, raise:31.5) or a single action, so presets work on the family. */
function groupFamilies(result) {
  return (result ? result.groups : []).map((group) => {
    let family = "unknown";
    for (const action of group.actions) {
      if (action.family && action.family !== "unknown") {
        family = action.family;
        break;
      }
    }
    return { id: group.id, family };
  });
}

function selectFamilies(wanted, describe) {
  const result = UI.dom.state.result;
  if (!result) {
    UI.dom.setInlineStatus("Convert something first, then pick actions.", "working");
    return;
  }
  const ids = groupFamilies(result)
    .filter((entry) => wanted.indexOf(entry.family) >= 0)
    .map((entry) => entry.id);
  if (!ids.length) {
    UI.dom.setStatus("no " + describe + " action in this payload", "err");
    return;
  }
  setSelection(ids);
}

/* Call + every raise size (R2.5, R31.5, ...), all-in left out. */
function presetRaiseCall() {
  selectFamilies(["raise", "bet", "call"], "raise/call");
}

/* Everything that is not a fold: the range that keeps playing the hand. */
function presetContinues() {
  const result = UI.dom.state.result;
  if (!result) {
    UI.dom.setInlineStatus("Convert something first, then pick actions.", "working");
    return;
  }
  setSelection(
    groupFamilies(result)
      .filter((entry) => entry.family !== "fold")
      .map((entry) => entry.id)
  );
}

function presetAll() {
  if (!UI.dom.state.result) return;
  setSelection(UI.dom.state.result.groups.map((group) => group.id));
}

function presetNone() {
  setSelection([]);
}

/* Two tabs share this page: the converter and the how-to guide. */
function setTab(name) {
  const wanted = name === "tutorial" ? "tutorial" : "converter";
  ["converter", "tutorial"].forEach((key) => {
    const panel = UI.dom.$("panel-" + key);
    if (panel) panel.hidden = key !== wanted;
    document.querySelectorAll('[data-tab="' + key + '"]').forEach((tab) => {
      const active = key === wanted;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
  });
  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, "", wanted === "tutorial" ? "#tutorial" : "#converter");
  }
}

function tabFromHash() {
  return (window.location.hash || "").indexOf("tutorial") >= 0 ? "tutorial" : "converter";
}

function bindToggle(buttonId, box) {
  const button = UI.dom.$(buttonId);
  if (!button || !box) return;
  button.addEventListener("click", () => {
    box.hidden = !box.hidden;
  });
}

/* Bindings that tolerate a missing element (a cached page can lack ids). */
function onClick(id, handler) {
  const node = UI.dom.$(id);
  if (node) node.addEventListener("click", handler);
}

function onChange(id, handler) {
  const node = UI.dom.$(id);
  if (node) node.addEventListener("change", handler);
}

function clearAll() {
  const el = UI.dom.el;
  if (el.json) el.json.value = "";
  if (el.range) el.range.value = "";
  if (el.actions) el.actions.innerHTML = "";
  if (el.placeholder) el.placeholder.hidden = false;
  if (el.chips) el.chips.innerHTML = "";
  if (el.gridBox) el.gridBox.innerHTML = "";
  if (el.perGroupBox) el.perGroupBox.innerHTML = "";
  if (el.inspect) el.inspect.textContent = "";
  if (el.hint) el.hint.textContent = "";
  if (el.sampleSelect) el.sampleSelect.value = "";
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
  // a page whose scripts came from an older release: say so instead of breaking
  if (!UI.dom.ready()) UI.dom.showStaleBanner();

  onClick("analyze-btn", () => analyze({ resetSelection: true }));
  onClick("sample-btn", UI.files.loadSample);
  onClick("copy-btn", UI.files.copyRange);
  onClick("download-btn", UI.files.downloadRange);
  onClick("preset-raisecall", presetRaiseCall);
  onClick("preset-continues", presetContinues);
  onClick("preset-all", presetAll);
  onClick("preset-none", presetNone);
  onClick("clear-btn", clearAll);

  onChange("file-input", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (UI.dom.el.json) UI.dom.el.json.value = String(reader.result);
      analyze({ resetSelection: true });
    };
    reader.onerror = () => UI.dom.showError("Could not read " + file.name);
    reader.readAsText(file);
    event.target.value = "";
  });

  // every option re-runs the conversion, so tweaking stays immediate
  ["opt-combine", "opt-combos", "opt-scale", "opt-decimals", "opt-min-weight"]
    .forEach((id) => {
      onChange(id, () => {
        if (UI.dom.el.json.value.trim()) analyze({ resetSelection: true });
      });
    });

  if (UI.dom.el.json) {
    UI.dom.el.json.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        analyze({ resetSelection: true });
      }
    });
  }

  bindToggle("grid-toggle", UI.dom.el.gridBox);
  bindToggle("per-group-toggle", UI.dom.el.perGroupBox);
  onClick("inspect-toggle", () => {
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

  // tabs: click one, or open the page with #tutorial
  document.querySelectorAll("[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => setTab(tab.dataset.tab));
  });
  window.addEventListener("hashchange", () => setTab(tabFromHash()));
  setTab(tabFromHash());

  UI.dom.setStatus("idle");
}

document.addEventListener("DOMContentLoaded", init);


  UI.main = {
    analyze,
    setSelection,
    presetRaiseCall,
    presetContinues,
    presetAll,
    presetNone,
    setTab,
    bindToggle,
    clearAll,
    init,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
