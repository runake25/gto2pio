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

/* Value/checked readers that survive a missing element (see missingElements). */
function checked(id, fallback) {
  const node = $(id);
  return node ? Boolean(node.checked) : fallback;
}

function value(id, fallback) {
  const node = $(id);
  return node ? node.value : fallback;
}

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
  gridBox: $("grid-box"),
  perGroupBox: $("per-group-box"),
  inspect: $("inspect-out"),
  hint: $("detected-hint"),
  sampleSelect: $("sample-select"),
  button: $("analyze-btn"),
};

function optionsPayload() {
  // Raise/bet/all-in sizes are never merged any more: the picker lists every
  // action the payload carries (F, C, R31.5, RAI, ...) as its own colour,
  // its own frequency and its own range text.
  return {
    include: state.include,
    merge_sizes: false,
    allin_as_raise: false,
    combine_suited_offsuit: checked("opt-combine", true),
    aggregate_combos: checked("opt-combos", true),
    decimals: Number(value("opt-decimals", 2) || 0),
    min_weight: Number(value("opt-min-weight", 0) || 0),
    scale: value("opt-scale", "auto"),
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
      "\nMore detail is in the red box under the Convert button, full structure in the Inspector under the range.",
    "err"
  );
  scrollToOutput();
}

function clearError() {
  el.error.hidden = true;
  el.error.textContent = "";
}

/* Everything this page needs. A script cached from an earlier release looks for
 * ids that a newer page does not have any more (that is what used to fail with
 * "Cannot set properties of null"), so check instead of crashing. */
const REQUIRED_IDS = [
  'json-input', 'status', 'inline-status', 'error-box', 'action-list',
  'actions-placeholder', 'range-output', 'stats-chips', 'grid-box',
  'per-group-box', 'inspect-out', 'detected-hint', 'sample-select', 'analyze-btn',
];

function missingElements() {
  return REQUIRED_IDS.filter((id) => !$(id));
}

function ready() {
  return missingElements().length === 0;
}

/* Say what happened and how to fix it, instead of throwing at the user. */
function showStaleBanner(ids) {
  if ($('stale-banner')) return;
  const missing = ids && ids.length ? ids : missingElements();
  const banner = document.createElement('div');
  banner.id = 'stale-banner';
  banner.className = 'stale-banner';
  banner.textContent =
    'This page mixed a script from an older version with the current page' +
    (missing.length ? ' (missing: ' + missing.join(', ') + ')' : '') +
    '. Press Ctrl+Shift+R (Cmd+Shift+R on macOS) to load the current files.';
  document.body.insertBefore(banner, document.body.firstChild);
}


  UI.dom = {
    $,
    state,
    el,
    optionsPayload,
    checked,
    value,
    setStatus,
    setInlineStatus,
    scrollToOutput,
    shortMessage,
    showError,
    clearError,
    missingElements,
    ready,
    showStaleBanner,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
