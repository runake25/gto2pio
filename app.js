"use strict";

/* GTO Wizard -> PioSOLVER range UI. Vanilla JS, no build step, no CDN, no server.
 *
 * The conversion itself lives in core.js (GTO2PIO.analyze); this file owns the
 * DOM. Layout of this file (keep the order - and never insert by line number):
 *   1. state + element lookups
 *   2. status / error feedback helpers
 *   3. analyze(): calls GTO2PIO.analyze in this page
 *   4. render* helpers (actions, range, chips, notes, per-action, grid)
 *   5. copy / download / presets / samples / file loading
 *   6. init() + DOMContentLoaded
 */

const RANKS = "AKQJT98765432";
const $ = (id) => document.getElementById(id);

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

function analyze({ resetSelection = false } = {}) {
  const text = el.json.value;
  if (!text.trim()) {
    showError("The JSON box is empty - paste a GTO Wizard payload first.");
    return;
  }
  if (resetSelection) state.include = null;

  el.button.disabled = true;
  setStatus("working...");
  setInlineStatus(
    "Converting " + Math.round(text.length / 1024) + " KB of JSON, please wait...",
    "working"
  );

  try {
    // everything happens right here in the page - no upload, no round trip
    const data = GTO2PIO.analyze(text, optionsPayload());

    clearError();
    state.result = data;
    try {
      renderResult(data);
    } catch (error) {
      showError("The result could not be displayed: " + error);
      return;
    }

    setStatus("ok - " + data.detection.format_label, "ok");
    setInlineStatus(
      "Range ready: " + data.detection.hand_count + " hands, selected " +
        (data.included.join(" + ") || "nothing") + ", " + data.stats.combos +
        " combos (" + data.stats.percent.toFixed(2) + "% of all combos)." +
        "\nCopy it from the Pio range box on the right.",
      "ok"
    );
    scrollToOutput();
  } catch (error) {
    if (error instanceof GTO2PIO.ParseError) {
      showError(error.message, error.diagnostics);
    } else {
      showError(
        "This payload could not be converted: " +
          (error && error.message ? error.message : String(error))
      );
    }
  } finally {
    el.button.disabled = false;
  }
}

function renderResult(data) {
  el.hint.textContent = data.detection.hand_count + " hands - " + data.detection.format_id;
  renderActions(data);
  el.range.value = data.range_text || "";
  renderChips(data);
  renderNotes(data);
  renderPerGroup(data);
  renderGrid(data);
  el.inspect.textContent = JSON.stringify(data.detection, null, 2);
}

function renderActions(data) {
  el.actions.innerHTML = "";
  el.placeholder.hidden = data.groups.length > 0;

  data.groups.forEach((group) => {
    const row = document.createElement("label");
    row.className = "action-row";

    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = data.included.includes(group.id);
    box.dataset.group = group.id;
    box.addEventListener("change", () => {
      state.include = currentSelection();
      analyze();
    });

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = group.label;

    const share = document.createElement("span");
    share.className = "share";
    share.textContent = group.share.toFixed(2) + "%";

    row.append(box, name, share);
    el.actions.appendChild(row);

    if (group.actions.length > 1) {
      const detail = document.createElement("p");
      detail.className = "action-sub";
      detail.textContent = group.actions
        .map((action) => action.label + " (" + action.share.toFixed(2) + "%)")
        .join("   |   ");
      el.actions.appendChild(detail);
    }
  });
}

function currentSelection() {
  return Array.from(el.actions.querySelectorAll('input[type="checkbox"]'))
    .filter((box) => box.checked)
    .map((box) => box.dataset.group);
}

function renderChips(data) {
  el.chips.innerHTML = "";
  const items = [
    ["hands", data.stats.hands],
    ["combos", data.stats.combos],
    ["% of all 1326", data.stats.percent.toFixed(2) + "%"],
    ["selected", data.included.join(" + ") || "none"],
  ];
  items.forEach((item) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = item[0] + ": ";
    const strong = document.createElement("b");
    strong.textContent = String(item[1]);
    chip.appendChild(strong);
    el.chips.appendChild(chip);
  });
}

function renderNotes(data) {
  el.notes.innerHTML = "";
  el.warnings.innerHTML = "";
  (data.notes || []).forEach((note) => {
    const item = document.createElement("li");
    item.textContent = note;
    el.notes.appendChild(item);
  });
  (data.warnings || []).forEach((warning) => {
    const item = document.createElement("li");
    item.textContent = warning;
    el.warnings.appendChild(item);
  });
  el.notesCard.hidden = !(data.notes || []).length && !(data.warnings || []).length;
}

function renderPerGroup(data) {
  el.perGroupBox.innerHTML = "";
  const ids = Object.keys(data.per_group || {});
  if (!ids.length) {
    el.perGroupBox.textContent = "No per-action data.";
    return;
  }
  ids.forEach((id) => {
    const entry = data.per_group[id];
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent =
      entry.label + " - " + entry.stats.hands + " hands / " +
      entry.stats.percent.toFixed(2) + "%";
    const textarea = document.createElement("textarea");
    textarea.readOnly = true;
    textarea.value = entry.range_text || "";
    details.append(summary, textarea);
    el.perGroupBox.appendChild(details);
  });
}

function canonicalHand(row, column) {
  if (row === column) return RANKS[row] + RANKS[row];
  if (row < column) return RANKS[row] + RANKS[column] + "s";
  return RANKS[column] + RANKS[row] + "o";
}

function renderGrid(data) {
  const table = document.createElement("div");
  table.className = "grid";
  for (let row = 0; row < 13; row += 1) {
    for (let column = 0; column < 13; column += 1) {
      const hand = canonicalHand(row, column);
      const weight = Number((data.grid || {})[hand] || 0);
      const cell = document.createElement("div");
      cell.className = "cell" + (weight > 0 ? " on" : "");
      cell.textContent = hand;
      cell.title = hand + " - " + (weight * 100).toFixed(1) + "%";
      if (weight > 0) {
        const alpha = (0.18 + 0.82 * Math.min(1, weight)).toFixed(3);
        cell.style.background = "rgba(47,129,247," + alpha + ")";
      }
      table.appendChild(cell);
    }
  }
  el.gridBox.innerHTML = "";
  el.gridBox.appendChild(table);
}

async function copyRange() {
  const text = el.range.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    el.range.select();
    document.execCommand("copy");
  }
  const button = $("copy-btn");
  const original = button.textContent;
  button.textContent = "Copied!";
  window.setTimeout(() => {
    button.textContent = original;
  }, 1200);
}

function downloadRange() {
  const text = el.range.value;
  if (!text) return;
  const selected = state.result && state.result.included.length
    ? "_" + state.result.included.join("-")
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

function setSelection(ids) {
  state.include = ids;
  el.actions.querySelectorAll('input[type="checkbox"]').forEach((box) => {
    box.checked = ids.includes(box.dataset.group);
  });
  analyze();
}

function presetRaiseCall() {
  if (!state.result) {
    setInlineStatus("Convert something first, then pick actions.", "working");
    return;
  }
  const wanted = ["raise", "bet", "call"];
  const ids = state.result.groups
    .map((group) => group.id)
    .filter((id) => wanted.includes(id));
  if (!ids.length) {
    setStatus("no raise/bet/call group in this payload", "err");
    return;
  }
  setSelection(ids);
}

function presetAll() {
  if (!state.result) return;
  setSelection(state.result.groups.map((group) => group.id));
}

function presetNone() {
  setSelection([]);
}

function bindToggle(buttonId, box) {
  $(buttonId).addEventListener("click", () => {
    box.hidden = !box.hidden;
  });
}

function loadSamples() {
  SAMPLES.forEach((sample) => {
    const option = document.createElement("option");
    option.value = sample.file;
    option.textContent = sample.label;
    el.sampleSelect.appendChild(option);
  });
}

async function loadSample(file) {
  try {
    const response = await fetch("samples/" + encodeURIComponent(file));
    if (!response.ok) {
      showError(
        "Could not load " + file + " (HTTP " + response.status + "). " +
          "If you opened this page from disk, run it through a local web server instead."
      );
      return;
    }
    const text = await response.text();
    try {
      el.json.value = JSON.stringify(JSON.parse(text), null, 2);
    } catch (error) {
      el.json.value = text; // keep the raw text
    }
    analyze({ resetSelection: true });
  } catch (error) {
    showError("Could not load the sample: " + error);
  }
}

function loadExample() {
  el.json.value = EXAMPLE_PAYLOAD;
  analyze({ resetSelection: true });
}

function clearAll() {
  el.json.value = "";
  el.range.value = "";
  el.actions.innerHTML = "";
  el.placeholder.hidden = false;
  el.chips.innerHTML = "";
  el.gridBox.innerHTML = "";
  el.perGroupBox.innerHTML = "";
  el.inspect.textContent = "";
  el.hint.textContent = "";
  el.sampleSelect.value = "";
  state.result = null;
  state.include = null;
  clearError();
  setInlineStatus("");
  setStatus("idle");
}

function init() {
  if (!window.GTO2PIO) {
    showError(
      "core.js did not load, so there is no converter in this page. " +
        "Refresh with Ctrl+F5, or check that core.js sits next to index.html."
    );
    setStatus("error", "err");
    return;
  }
  if ($("version")) $("version").textContent = "v" + GTO2PIO.VERSION;

  $("analyze-btn").addEventListener("click", () => analyze({ resetSelection: true }));
  $("example-btn").addEventListener("click", loadExample);
  $("copy-btn").addEventListener("click", copyRange);
  $("download-btn").addEventListener("click", downloadRange);
  $("preset-raisecall").addEventListener("click", presetRaiseCall);
  $("preset-all").addEventListener("click", presetAll);
  $("preset-none").addEventListener("click", presetNone);
  $("clear-btn").addEventListener("click", clearAll);

  el.sampleSelect.addEventListener("change", (event) => {
    if (event.target.value) loadSample(event.target.value);
  });

  $("file-input").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      el.json.value = String(reader.result);
      analyze({ resetSelection: true });
    };
    reader.onerror = () => showError("Could not read " + file.name);
    reader.readAsText(file);
    event.target.value = "";
  });

  ["opt-merge", "opt-allin", "opt-combine", "opt-combos", "opt-scale",
   "opt-decimals", "opt-min-weight"].forEach((id) => {
    $(id).addEventListener("change", () => {
      if (el.json.value.trim()) analyze({ resetSelection: true });
    });
  });

  el.json.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      analyze({ resetSelection: true });
    }
  });

  bindToggle("grid-toggle", el.gridBox);
  bindToggle("per-group-toggle", el.perGroupBox);
  $("inspect-toggle").addEventListener("click", () => {
    el.inspect.hidden = !el.inspect.hidden;
  });

  // never fail silently: surface any script error in the UI
  window.addEventListener("error", (event) => {
    showError("JavaScript error: " + (event.message || "unknown"));
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    showError(
      "JavaScript error: " + (reason && reason.message ? reason.message : String(reason))
    );
  });

  loadSamples();
  setStatus("idle");
}

document.addEventListener("DOMContentLoaded", init);



