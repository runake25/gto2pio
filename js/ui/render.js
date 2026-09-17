"use strict";

/* Rendering a result: action list, range box, chips, grid, panels.
 *
 * Plain browser script: every module attaches itself to GTO2PIO.ui, so
 * load order in index.html is the only wiring this site needs.
 */
(function (root) {
  const GTO2PIO = (root.GTO2PIO = root.GTO2PIO || {});
  const UI = GTO2PIO.ui || (GTO2PIO.ui = {});

const RANKS = "AKQJT98765432";

function renderResult(data) {
  UI.dom.el.hint.textContent = data.detection.hand_count + " hands - " + data.detection.format_id;
  renderActions(data);
  UI.dom.el.range.value = data.range_text || "";
  renderChips(data);
  renderNotes(data);
  renderPerGroup(data);
  renderGrid(data);
  UI.dom.el.inspect.textContent = JSON.stringify(data.detection, null, 2);
}

function renderActions(data) {
  UI.dom.el.actions.innerHTML = "";
  UI.dom.el.placeholder.hidden = data.groups.length > 0;

  data.groups.forEach((group) => {
    const row = document.createElement("label");
    row.className = "action-row";

    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = data.included.includes(group.id);
    box.dataset.group = group.id;
    box.addEventListener("change", () => {
      UI.dom.state.include = currentSelection();
      UI.main.analyze();
    });

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = group.label;

    const share = document.createElement("span");
    share.className = "share";
    share.textContent = group.share.toFixed(2) + "%";

    row.append(box, name, share);
    UI.dom.el.actions.appendChild(row);

    if (group.actions.length > 1) {
      const detail = document.createElement("p");
      detail.className = "action-sub";
      detail.textContent = group.actions
        .map((action) => action.label + " (" + action.share.toFixed(2) + "%)")
        .join("   |   ");
      UI.dom.el.actions.appendChild(detail);
    }
  });
}

function currentSelection() {
  return Array.from(UI.dom.el.actions.querySelectorAll('input[type="checkbox"]'))
    .filter((box) => box.checked)
    .map((box) => box.dataset.group);
}

function renderChips(data) {
  UI.dom.el.chips.innerHTML = "";
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
    UI.dom.el.chips.appendChild(chip);
  });
}

function renderNotes(data) {
  UI.dom.el.notes.innerHTML = "";
  UI.dom.el.warnings.innerHTML = "";
  (data.notes || []).forEach((note) => {
    const item = document.createElement("li");
    item.textContent = note;
    UI.dom.el.notes.appendChild(item);
  });
  (data.warnings || []).forEach((warning) => {
    const item = document.createElement("li");
    item.textContent = warning;
    UI.dom.el.warnings.appendChild(item);
  });
  UI.dom.el.notesCard.hidden = !(data.notes || []).length && !(data.warnings || []).length;
}

function renderPerGroup(data) {
  UI.dom.el.perGroupBox.innerHTML = "";
  const ids = Object.keys(data.per_group || {});
  if (!ids.length) {
    UI.dom.el.perGroupBox.textContent = "No per-action data.";
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
    UI.dom.el.perGroupBox.appendChild(details);
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
  UI.dom.el.gridBox.innerHTML = "";
  UI.dom.el.gridBox.appendChild(table);
}


  UI.render = {
    RANKS,
    renderResult,
    renderActions,
    currentSelection,
    renderChips,
    renderNotes,
    renderPerGroup,
    canonicalHand,
    renderGrid,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
