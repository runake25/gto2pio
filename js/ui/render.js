"use strict";

/* Rendering a result: action list, range box, chips, coloured grid, panels.
 *
 * Plain browser script: every module attaches itself to GTO2PIO.ui, so
 * load order in index.html is the only wiring this site needs.
 */
(function (root) {
  const GTO2PIO = (root.GTO2PIO = root.GTO2PIO || {});
  const UI = GTO2PIO.ui || (GTO2PIO.ui = {});

const RANKS = "AKQJT98765432";

function swatch(color, extra) {
  const dot = document.createElement("span");
  dot.className = "swatch" + (extra ? " " + extra : "");
  dot.style.background = color;
  return dot;
}

function groupById(data, id) {
  for (const group of data.groups || []) {
    if (group.id === id) return group;
  }
  return null;
}

function codesOf(group) {
  return (group.actions || [])
    .map((action) => GTO2PIO.actions.actionCode(action))
    .filter((code) => code)
    .join("/");
}

function renderResult(data) {
  const el = UI.dom.el;
  const colors = UI.colors.palette(data.groups);
  if (el.hint) {
    el.hint.textContent = data.detection.hand_count + " hands - " + data.detection.format_id;
  }
  renderActions(data, colors);
  if (el.range) el.range.value = data.range_text || "";
  renderChips(data);
  renderPerGroup(data, colors);
  renderGrid(data, colors);
  // notes and warnings live in the inspector - the panel stays uncluttered
  if (el.inspect) {
    el.inspect.textContent = JSON.stringify(
      Object.assign({}, data.detection, {
        notes: data.notes || [],
        warnings: data.warnings || [],
      }),
      null,
      2
    );
  }
}

function renderActions(data, colors) {
  const list = UI.dom.el.actions;
  if (!list) return;
  list.innerHTML = "";
  if (UI.dom.el.placeholder) UI.dom.el.placeholder.hidden = data.groups.length > 0;

  data.groups.forEach((group) => {
    const color = colors.groups[group.id] || UI.colors.FALLBACK;
    const row = document.createElement("label");
    row.className = "action-row";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = data.included.includes(group.id);
    input.dataset.group = group.id;
    input.addEventListener("change", () => {
      UI.dom.state.include = currentSelection();
      UI.main.analyze();
    });

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = group.label;
    name.style.color = color;

    const codes = document.createElement("span");
    codes.className = "codes";
    codes.textContent = codesOf(group);

    const share = document.createElement("span");
    share.className = "share";
    share.textContent = group.share.toFixed(2) + "%";

    row.append(input, swatch(color), name, codes, share);
    list.appendChild(row);

    if (group.actions.length > 1) {
      const detail = document.createElement("p");
      detail.className = "action-sub";
      group.actions.forEach((action, index) => {
        if (index) detail.appendChild(document.createTextNode("   "));
        detail.appendChild(swatch(UI.colors.colorForAction(action.id, colors, group.id), "small"));
        const text = document.createElement("span");
        text.textContent =
          " " + GTO2PIO.actions.actionCode(action) + " (" + action.share.toFixed(2) + "%)";
        detail.appendChild(text);
      });
      list.appendChild(detail);
    }
  });
}

function currentSelection() {
  return Array.from(UI.dom.el.actions.querySelectorAll('input[type="checkbox"]'))
    .filter((box) => box.checked)
    .map((box) => box.dataset.group);
}

function renderChips(data) {
  const box = UI.dom.el.chips;
  if (!box) return;
  box.innerHTML = "";
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
    box.appendChild(chip);
  });
}

function renderPerGroup(data, colors) {
  const box = UI.dom.el.perGroupBox;
  if (!box) return;
  box.innerHTML = "";
  const ids = Object.keys(data.per_group || {});
  if (!ids.length) {
    box.textContent = "No per-action data.";
    return;
  }
  ids.forEach((id) => {
    const entry = data.per_group[id];
    const color = colors.groups[id] || UI.colors.FALLBACK;
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const text = document.createElement("span");
    text.textContent =
      " " + entry.label + " - " + entry.stats.hands + " hands / " +
      entry.stats.percent.toFixed(2) + "%";
    text.style.color = color;
    summary.append(swatch(color, "small"), text);
    const textarea = document.createElement("textarea");
    textarea.readOnly = true;
    textarea.value = entry.range_text || "";
    details.append(summary, textarea);
    box.appendChild(details);
  });
}

function canonicalHand(row, column) {
  if (row === column) return RANKS[row] + RANKS[row];
  if (row < column) return RANKS[row] + RANKS[column] + "s";
  return RANKS[column] + RANKS[row] + "o";
}

/* Colour key for the grid: one entry per selected action. */
function renderLegend(data, colors) {
  const legend = document.createElement("div");
  legend.className = "legend";
  data.included.forEach((id) => {
    const group = groupById(data, id);
    if (!group) return;
    const item = document.createElement("span");
    item.className = "legend-item";
    const text = document.createElement("span");
    text.textContent = " " + group.label + (codesOf(group) ? " (" + codesOf(group) + ")" : "");
    item.append(swatch(colors.groups[id] || UI.colors.FALLBACK, "small"), text);
    legend.appendChild(item);
  });
  return legend;
}

/* 13x13 grid: every selected action is one vertical slice of a cell, and the
 * slice heights are that hand's frequency split, like GTO Wizard's own grid. */
function renderGrid(data, colors) {
  const box = UI.dom.el.gridBox;
  if (!box) return;
  const grids = data.group_grids || {};
  const perAction = Object.keys(grids).length > 0;

  const table = document.createElement("div");
  table.className = "grid";
  for (let row = 0; row < 13; row += 1) {
    for (let column = 0; column < 13; column += 1) {
      const hand = canonicalHand(row, column);
      const cell = document.createElement("div");
      cell.className = "cell";

      const slices = [];
      if (perAction) {
        data.included.forEach((id) => {
          const weight = Number((grids[id] || {})[hand] || 0);
          if (weight > 0) slices.push([id, weight]);
        });
      } else {
        const weight = Number((data.grid || {})[hand] || 0);
        if (weight > 0) slices.push([null, weight]);
      }
      let total = 0;
      for (const slice of slices) total += slice[1];

      if (total > 0) {
        cell.className = "cell on";
        const lines = [];
        slices.forEach((slice) => {
          const group = slice[0] === null ? null : groupById(data, slice[0]);
          const bar = document.createElement("span");
          bar.className = "slice";
          bar.style.flexGrow = String(slice[1]);
          bar.style.background = group
            ? colors.groups[group.id] || UI.colors.FALLBACK
            : "rgba(47,129,247," + (0.18 + 0.82 * Math.min(1, slice[1])).toFixed(3) + ")";
          cell.appendChild(bar);
          const percent = Math.round((slice[1] / total) * 100);
          const keys = group ? codesOf(group) : "";
          lines.push((group ? group.label : "in range") + (keys ? " (" + keys + ")" : "") + " " + percent + "%");
        });
        cell.title = hand + "\n" + lines.join("\n");
      } else {
        cell.title = hand + " - not in the range";
      }

      const label = document.createElement("b");
      label.className = "hand";
      label.textContent = hand;
      cell.appendChild(label);
      table.appendChild(cell);
    }
  }

  box.innerHTML = "";
  if (data.included.length) box.appendChild(renderLegend(data, colors));
  box.appendChild(table);
}


  UI.render = {
    RANKS,
    renderResult,
    renderActions,
    currentSelection,
    renderChips,
    renderPerGroup,
    renderLegend,
    canonicalHand,
    renderGrid,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
