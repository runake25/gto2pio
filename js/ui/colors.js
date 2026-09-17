"use strict";

/* Action colours, shared by the picker, the grid and the legend.
 *
 * One hue per action kind, plus a ramp over the raise/bet sizes so "R31.5" and
 * "RAI" (or R2.5 / R8 / R31.5) never share a colour. A colour means the same
 * action everywhere on the page.
 *
 * Plain browser script: every module attaches itself to GTO2PIO.ui, so
 * load order in index.html is the only wiring this site needs.
 */
(function (root) {
  const GTO2PIO = (root.GTO2PIO = root.GTO2PIO || {});
  const UI = GTO2PIO.ui || (GTO2PIO.ui = {});

const FAMILY_COLORS = {
  fold: "#5f7a93",
  check: "#3b82f6",
  call: "#22c55e",
  raise: "#d4a72c",
  bet: "#d4a72c",
  allin: "#a855f7",
  unknown: "#8b98a9",
};

/* Aggressive sizes, smallest first: amber -> orange -> vermilion -> rose. */
const SIZE_RAMP = ["#d4a72c", "#e0873a", "#dd5f45", "#c94f6d"];

const FALLBACK = "#8b98a9";
const SIZED_FAMILIES = ["bet", "raise"];

/* "raise:31.5" -> 31.5, so sizes can be ranked without extra result fields. */
function sizeOf(entry) {
  const info = entry || {};
  if (typeof info.betsize === "number" && Number.isFinite(info.betsize)) return info.betsize;
  const text = String(info.id === undefined ? "" : info.id);
  const cut = text.indexOf(":");
  if (cut < 0) return null;
  const size = Number(text.slice(cut + 1));
  return Number.isFinite(size) ? size : null;
}

function familyOf(entry) {
  const family = (entry || {}).family;
  return family === undefined || family === null ? "unknown" : String(family);
}

function familyOfGroup(group) {
  const actions = (group && group.actions) || [];
  for (const action of actions) {
    const family = familyOf(action);
    if (family !== "unknown") return family;
  }
  return actions.length ? familyOf(actions[0]) : "unknown";
}

function colorOfFamily(family) {
  return FAMILY_COLORS[family] || FALLBACK;
}

/* Colour per action and per group: {groups: {id: color}, actions: {id: color}} */
function palette(groups) {
  const list = groups || [];
  const sized = [];
  list.forEach((group) => {
    ((group && group.actions) || []).forEach((action) => {
      const family = familyOf(action);
      if (SIZED_FAMILIES.indexOf(family) < 0) return;
      const size = sizeOf(action);
      if (size !== null) sized.push([action.id, size]);
    });
  });
  sized.sort((left, right) => left[1] - right[1] || String(left[0]).localeCompare(String(right[0])));

  const actionColors = {};
  sized.forEach((entry, index) => {
    actionColors[entry[0]] = SIZE_RAMP[index % SIZE_RAMP.length];
  });

  const groupColors = {};
  list.forEach((group) => {
    const family = familyOfGroup(group);
    if (SIZED_FAMILIES.indexOf(family) < 0) {
      groupColors[group.id] = colorOfFamily(family);
      return;
    }
    // a merged "Raise (all sizes)" group wears the colour of its smallest size
    const members = ((group && group.actions) || []).filter((action) => actionColors[action.id]);
    if (!members.length) {
      groupColors[group.id] = colorOfFamily(family);
      return;
    }
    let smallest = members[0];
    members.forEach((action) => {
      const size = sizeOf(action);
      const best = sizeOf(smallest);
      if (size !== null && (best === null || size < best)) smallest = action;
    });
    groupColors[group.id] = actionColors[smallest.id];
  });

  return { groups: groupColors, actions: actionColors };
}

/* Colour for one action id inside a group (falls back to the group colour). */
function colorForAction(actionId, colors, groupId) {
  const found = (colors && colors.actions ? colors.actions[actionId] : undefined);
  if (found) return found;
  const group = colors && colors.groups ? colors.groups[groupId] : undefined;
  return group || FALLBACK;
}


  UI.colors = {
    FAMILY_COLORS,
    SIZE_RAMP,
    FALLBACK,
    sizeOf,
    familyOf,
    familyOfGroup,
    colorOfFamily,
    palette,
    colorForAction,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
