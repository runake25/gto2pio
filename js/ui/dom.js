"use strict";

/* DOM lookups, shared UI state, and status/error feedback.
 *
 * Plain browser script: every module attaches itself to GTO2PIO.ui, so
 * load order in index.html is the only wiring this site needs.
 */
(function (root) {
  const GTO2PIO = (root.GTO2PIO = root.GTO2PIO || {});
  const UI = GTO2PIO.ui || (GTO2PIO.ui = {});

const $ = (id) => document.getElementById(id);

const state = { include: null, result: null };

const el = {
  json: $("json-input"),
  status: $("status"),
  inline: $("inline-status"),
  error: $("error-box"),
  actions: $("action-list"),
  placeholder: $("actions-placeholder"),
  range: $("range-output"),
  chips: $("stats-chips"),
  notesCard: $("notes-card"),
  notes: $("notes-list"),
  warnings: $("warnings-list"),
  gridBox: $("grid-box"),
  perGroupBox: $("per-group-box"),
  inspect: $("inspect-out"),
  hint: $("detected-hint"),
  sampleSelect: $("sample-select"),
  button: $("analyze-btn"),
};

function optionsPayload() {
  return {
    include: state.include,
    merge_sizes: $("opt-merge").checked,
    allin_as_raise: $("opt-allin").checked,
    combine_suited_offsuit: $("opt-combine").checked,
    aggregate_combos: $("opt-combos").checked,
    decimals: Number($("opt-decimals").value || 0),
    min_weight: Number($("opt-min-weight").value || 0),
    scale: $("opt-scale").value,
  };
}

function setStatus(text, kind = "") {
  el.status.textContent = text;
  el.status.className = "status" + (kind ? " " + kind : "");
}

function setInlineStatus(text, kind) {
  if (!el.inline) return;
  if (!text) {
    el.inline.hidden = true;
    el.inline.textContent = "";
    return;
  }
  el.inline.className = "inline-status" + (kind ? " " + kind : "");
  el.inline.textContent = text;
  el.inline.hidden = false;
}

function scrollToOutput() {
  const panel = document.getElementById("output-panel");
  if (panel && panel.scrollIntoView) {
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function shortMessage(text, limit) {
  const flat = String(text || "").replace(/\s+/g, " ").trim();
  return flat.length > limit ? flat.slice(0, limit) + " ..." : flat;
}

function showError(message, diagnostics) {
  let text = message || "unknown error";
  if (diagnostics && Object.keys(diagnostics).length) {
    text += "\n\nWhat was detected in your JSON:\n" + JSON.stringify(diagnostics, null, 2);
  }
  el.error.textContent = text;
  el.error.hidden = false;
  setStatus("error", "err");
  setInlineStatus(
    "Nothing converted - " + shortMessage(message, 220) +
      "\nMore detail is in the red box on the right, full structure in the Inspector at the bottom.",
    "err"
  );
  scrollToOutput();
}

function clearError() {
  el.error.hidden = true;
  el.error.textContent = "";
}


  UI.dom = {
    $,
    state,
    el,
    optionsPayload,
    setStatus,
    setInlineStatus,
    scrollToOutput,
    shortMessage,
    showError,
    clearError,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
