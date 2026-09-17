"use strict";

/* Structural detection of a pasted payload (the supported shapes).
 *
 * Attached to the GTO2PIO namespace; no bundler, no build step.
 */
(function (root) {
  const GTO2PIO = (root.GTO2PIO = root.GTO2PIO || {});

  const { ParseError, fixed, formatG, isPlainObject, lookupKey, pyRound } = GTO2PIO.common;
  const { PIO_ORDER, comboCount, isComboToken, isHandToken } = GTO2PIO.hands;
  const { actionLabel, normalizeAction } = GTO2PIO.actions;

  const HAND_KEYS = [
    "hand", "hand_str", "handstr", "hand_name", "handname", "hand_class",
    "handclass", "combo", "cards", "card", "key", "name",
  ];

  const ACTION_LIST_KEYS = [
    "actions", "available_actions", "action_solutions", "action_list",
    "actions_list", "strategies", "strategy_actions", "action_solution",
  ];

  const FREQ_KEYS = [
    "frequency", "freq", "weight", "probability", "prob", "frequency_pct",
    "pct", "percentage", "value", "action_frequency", "strategy_weight",
  ];

  const STRATEGY_HINT_KEYS = ["strategy", "solution", "hand_actions", "range", "weights"];

  const MIN_HANDS = 1;

  /* Coerce numbers, numeric strings ("45", "45%") and frequency objects. */
  function toNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
      const text = value.trim();
      if (!text) return null;
      if (text.endsWith("%")) {
        const percent = Number(text.slice(0, -1));
        return Number.isFinite(percent) ? percent / 100.0 : null;
      }
      const number = Number(text);
      return Number.isFinite(number) ? number : null;
    }
    if (isPlainObject(value)) {
      const lowered = {};
      for (const key of Object.keys(value)) lowered[String(key).trim().toLowerCase()] = value[key];
      for (const key of FREQ_KEYS) {
        if (Object.prototype.hasOwnProperty.call(lowered, key)) return toNumber(lowered[key]);
      }
    }
    return null;
  }

  /* Breadth-first walk yielding [path, node, parent] in document order. */
  function iterNodes(root) {
    const queue = [["$", root, null]];
    const out = [];
    while (queue.length) {
      const [path, node, parent] = queue.shift();
      out.push([path, node, parent]);
      if (isPlainObject(node)) {
        for (const key of Object.keys(node)) queue.push([`${path}.${key}`, node[key], node]);
      } else if (Array.isArray(node)) {
        node.forEach((value, index) => queue.push([`${path}[${index}]`, value, node]));
      }
    }
    return out;
  }

  function handRatio(values) {
    if (!values.length) return 0.0;
    const hits = values.filter((value) => typeof value === "string" && isHandToken(value)).length;
    return hits / values.length;
  }

  function actionRatio(values) {
    if (!values.length) return 0.0;
    const hits = values.filter((value) => normalizeAction(value) !== null).length;
    return hits / values.length;
  }

  function numericList(values) {
    if (!Array.isArray(values) || !values.length) return null;
    const parsed = [];
    for (const value of values) {
      const number = toNumber(value);
      if (number === null) return null;
      parsed.push(number);
    }
    return parsed;
  }

  function numericMatrix(values) {
    if (!Array.isArray(values) || values.length < 2) return null;
    const rows = [];
    let width = null;
    for (const row of values) {
      const parsed = numericList(row);
      if (parsed === null) return null;
      if (width === null) width = parsed.length;
      else if (parsed.length !== width) return null;
      rows.push(parsed);
    }
    return width ? rows : null;
  }

  function handishKeys(node) {
    return Object.keys(node).filter((key) => isHandToken(key));
  }

  /* A {hand: frequency} map nested directly inside node. */
  function handMapFrom(node) {
    for (const key of Object.keys(node)) {
      const value = node[key];
      if (!isPlainObject(value) || Object.keys(value).length < MIN_HANDS) continue;
      const nestedKeys = handishKeys(value);
      if (nestedKeys.length < Math.max(MIN_HANDS, Math.trunc(0.9 * Object.keys(value).length))) continue;
      const mapping = {};
      for (const hand of nestedKeys) {
        const number = toNumber(value[hand]);
        if (number !== null) mapping[hand] = number;
      }
      if (Object.keys(mapping).length >= MIN_HANDS) return mapping;
    }
    return null;
  }

  /* (key, value) of the hand identifier inside a per-hand record. */
  function recordHandToken(record) {
    const lowered = {};
    for (const key of Object.keys(record)) lowered[String(key).trim().toLowerCase()] = key;
    for (const key of HAND_KEYS) {
      const actual = lowered[key];
      if (actual !== undefined && typeof record[actual] === "string" && isHandToken(record[actual])) {
        return [actual, record[actual]];
      }
    }
    for (const key of Object.keys(record)) {
      if (typeof record[key] === "string" && isHandToken(record[key])) return [key, record[key]];
    }
    return [null, null];
  }

  /* Columns for a list of {"action": ..., <hand map>} objects. */
  function actionHandColumns(node) {
    const columns = [];
    for (const item of node) {
      if (!isPlainObject(item)) return [];
      const action = normalizeAction(item);
      if (action === null) return [];
      const mapping = handMapFrom(item);
      if (mapping === null) return [];
      columns.push([action, mapping]);
    }
    return columns.length >= 2 ? columns : [];
  }

  function synthActions(count, prefix) {
    const label = prefix === undefined ? "Action" : prefix;
    const actions = [];
    for (let index = 0; index < count; index += 1) {
      actions.push({
        id: `action_${index + 1}`, family: "unknown",
        name: `${label} ${index + 1}`, betsize: null, raw: "",
      });
    }
    return actions;
  }

  /* An action list sitting next to the strategy in the same object. */
  function siblingActions(parent, size) {
    if (!isPlainObject(parent)) return null;
    for (const value of Object.values(parent)) {
      if (!Array.isArray(value) || !value.length) continue;
      if (actionRatio(value) < 0.8) continue;
      const actions = value.map((item) => normalizeAction(item));
      if (actions.every((action) => action !== null)) {
        if (size === null || size === undefined || actions.length === size) return actions;
      }
    }
    return null;
  }

  /* A hand axis sitting next to the strategy in the same object. */
  function siblingHands(parent, size) {
    if (!isPlainObject(parent)) return null;
    for (const value of Object.values(parent)) {
      if (
        Array.isArray(value) && value.length &&
        value.every((item) => typeof item === "string") &&
        handRatio(value) >= 0.9 &&
        (size === null || size === undefined || value.length === size)
      ) {
        return value.slice();
      }
    }
    return null;
  }

  function globalActions(found, size) {
    for (const item of found) {
      if (item.kind !== "action_list" || item.node.length !== size) continue;
      const actions = item.node.map((entry) => normalizeAction(entry));
      if (actions.every((action) => action !== null)) return actions;
    }
    return null;
  }

  function globalHands(found, size) {
    for (const item of found) {
      if (item.kind === "hand_list" && item.node.length === size) return item.node.slice();
    }
    return null;
  }

  function collect(doc) {
    const found = [];
    for (const [path, node, parent] of iterNodes(doc)) {
      if (Array.isArray(node) && node.length) {
        if (
          node.length >= 3 &&
          node.every((item) => typeof item === "string") &&
          handRatio(node) >= 0.9
        ) {
          found.push({ kind: "hand_list", path, node, parent, extra: { size: node.length } });
          continue;
        }
        const columns = actionHandColumns(node);
        if (columns.length) {
          found.push({
            kind: "action_hand_maps", path, node, parent,
            extra: { size: columns.length, hands: Object.keys(columns[0][1]).length, columns },
          });
          continue;
        }
        if (node.length >= 2 && actionRatio(node) >= 0.8) {
          found.push({ kind: "action_list", path, node, parent, extra: { size: node.length } });
          continue;
        }
        const matrix = numericMatrix(node);
        if (matrix) {
          found.push({
            kind: "matrix", path, node, parent,
            extra: { rows: matrix.length, cols: matrix[0].length },
          });
          continue;
        }
        const records = node.filter((item) => isPlainObject(item) && recordHandToken(item)[0] !== null);
        if (node.length >= MIN_HANDS && records.length === node.length) {
          found.push({ kind: "hand_records", path, node, parent, extra: { size: node.length } });
        }
        continue;
      }

      if (isPlainObject(node) && Object.keys(node).length >= MIN_HANDS) {
        const keys = Object.keys(node);
        const hands = handishKeys(node);
        if (hands.length >= Math.max(MIN_HANDS, Math.trunc(0.9 * keys.length))) {
          const listKeys = hands.filter((key) => Array.isArray(node[key]));
          const dictKeys = hands.filter((key) => isPlainObject(node[key]));
          if (listKeys.length === hands.length && listKeys.every((key) => numericList(node[key]) !== null)) {
            found.push({ kind: "hand_list_map", path, node, parent, extra: { size: hands.length } });
          } else if (
            dictKeys.length === hands.length &&
            dictKeys.some((key) => Object.values(node[key]).some((item) => toNumber(item) !== null))
          ) {
            found.push({ kind: "hand_dict_map", path, node, parent, extra: { size: hands.length } });
          } else if (keys.length === hands.length && hands.every((key) => toNumber(node[key]) !== null)) {
            found.push({ kind: "hand_num_map", path, node, parent, extra: { size: hands.length } });
          }
        }

        const action = normalizeAction(node);
        if (action !== null) {
          const handMap = handMapFrom(node);
          if (handMap !== null) {
            found.push({
              kind: "action_hand_map", path, node, parent,
              extra: { action, hands: Object.keys(handMap).length },
            });
          }
        }
      }
    }
    return found;
  }

  const GW_STRATEGY_KEYS = [
    "strategy", "strategies", "frequencies", "hand_frequencies",
    "frequency", "weights", "action_frequencies",
  ];

  const GW_COMBO_TOTAL_KEYS = ["total_combos", "total_combo", "combos"];

  /* GTO Wizard's internal order of its 169-element strategy arrays. */
  function gwHandOrder(count) {
    if (count !== PIO_ORDER.length) return null;
    return PIO_ORDER.slice().sort();
  }

  /* Pick the frequency array out of an action entry (never the EV array). */
  function strategyArray(item) {
    const arrays = [];
    for (const key of Object.keys(item)) {
      const parsed = numericList(item[key]);
      if (parsed !== null && parsed.length >= MIN_HANDS) arrays.push([String(key), parsed]);
    }
    if (!arrays.length) return null;
    const lowered = {};
    for (const [key, values] of arrays) lowered[key.trim().toLowerCase()] = [key, values];
    for (const key of GW_STRATEGY_KEYS) {
      if (Object.prototype.hasOwnProperty.call(lowered, key)) return lowered[key];
    }
    for (const [key, values] of arrays) {
      if (values.every((value) => value >= -1e-9 && value <= 1.0 + 1e-9)) return [key, values];
    }
    return null;
  }

  function totalCombos(item) {
    for (const key of GW_COMBO_TOTAL_KEYS) {
      const value = toNumber(lookupKey(item, [key]));
      if (value !== null) return value;
    }
    return null;
  }

  /* Key order of a hand-keyed dict.
   *
   * JavaScript reorders integer-like keys ("22", "33", ... are array indices),
   * so a payload's textual order cannot be read back from Object.keys(). When
   * that happens the order GTO Wizard itself uses (plain string sort) is
   * restored - and the total_combos cross-check in the caller verifies it.
   */
  function axisKeys(node) {
    const keys = Object.keys(node);
    const reordered = keys.some((key) => /^(0|[1-9][0-9]*)$/.test(key));
    return reordered ? keys.slice().sort() : keys;
  }

  /* Hand order read from any hand-keyed dict with exactly count entries. */
  function handAxisDict(found, count) {
    for (const item of found) {
      if (item.kind !== "hand_num_map" && item.kind !== "hand_dict_map" && item.kind !== "hand_list_map") continue;
      if (!isPlainObject(item.node) || Object.keys(item.node).length !== count) continue;
      const keys = handishKeys(item.node);
      if (keys.length === count) return [axisKeys(item.node), item.path];
    }
    return null;
  }

  function columnValues(columns) {
    const values = [];
    for (const entry of columns) {
      for (const value of Object.values(entry[1])) values.push(value);
    }
    return values;
  }

  function scoreColumns(columns, hasActionAxis, handCount) {
    const values = columnValues(columns);
    if (!values.length) return -1000.0;
    let low = values[0];
    let high = values[0];
    for (const value of values) {
      if (value < low) low = value;
      if (value > high) high = value;
    }
    let result = 0.0;
    if (hasActionAxis) result += 40.0;
    if (handCount === 169 || handCount === 1326) result += 12.0;
    if (columns.length >= 1 && columns.length <= 12) result += 6.0;
    if (low >= -1e-9 && high <= 1.0 + 1e-9) result += 20.0;
    else if (low >= -1e-9 && high <= 100.0 + 1e-9) result += 8.0;
    if (low < -1e-9) result -= 60.0;
    if (high > 100.0 + 1e-6) result -= 60.0;
    return result;
  }

  /* Are the frequencies 0-1 fractions or 0-100 percentages? */
  function resolveScale(columns, forced) {
    const values = columnValues(columns);
    if (!values.length) return [1.0, []];
    if (forced === "percent") return [0.01, ["frequencies forced to percent (divided by 100)"]];
    if (forced === "fraction") return [1.0, ["frequencies forced to fractions (used as-is)"]];
    let low = values[0];
    let high = values[0];
    for (const value of values) {
      if (value < low) low = value;
      if (value > high) high = value;
    }
    if (high > 1.0 + 1e-9 && low >= -1e-9 && high <= 100.0 + 1e-6) {
      return [0.01, [`values range up to ${formatG(high)}, read as percentages and divided by 100`]];
    }
    return [1.0, []];
  }

  function zipWeights(hands, values) {
    const mapping = {};
    const size = Math.min(hands.length, values.length);
    for (let index = 0; index < size; index += 1) mapping[hands[index]] = values[index];
    return mapping;
  }

  /* GTO Wizard action_solutions: one action + one frequency array per hand. */
  function fromActionStrategyArrays(found) {
    const candidates = [];

    for (const foundItem of found) {
      if (foundItem.kind !== "action_list" || !Array.isArray(foundItem.node)) continue;
      const node = foundItem.node;

      let entries = [];
      for (const item of node) {
        if (!isPlainObject(item)) {
          entries = [];
          break;
        }
        const action = normalizeAction(item);
        const arrays = strategyArray(item);
        if (action === null || arrays === null) {
          entries = [];
          break;
        }
        entries.push([action, arrays[1], totalCombos(item)]);
      }

      if (entries.length < 2) continue;
      const widths = new Set(entries.map((entry) => entry[1].length));
      if (widths.size !== 1) continue;
      const count = entries[0][1].length;

      const axis = handAxisDict(found, count);
      let hands;
      let axisNote;
      if (axis !== null) {
        hands = axis[0];
        axisNote = `hand order read from ${axis[1]} (${count} hands)`;
      } else {
        const ordered = gwHandOrder(count);
        if (ordered === null) continue; // 1326 combos with no axis to name them
        hands = ordered;
        axisNote = `hand order: GTO Wizard's ${count}-hand order (no explicit axis in the payload)`;
      }

      const columns = entries.map((entry) => [entry[0], zipWeights(hands, entry[1])]);

      const warnings = [];
      let checked = 0;
      for (const entry of entries) {
        const action = entry[0];
        const values = entry[1];
        const total = entry[2];
        if (total === null || total === undefined) continue;
        let weighted = 0;
        for (let index = 0; index < hands.length && index < values.length; index += 1) {
          weighted += values[index] * comboCount(hands[index]);
        }
        checked += 1;
        if (Math.abs(weighted - total) > Math.max(0.05, 0.002 * Math.max(total, 1.0))) {
          warnings.push(
            `${actionLabel(action)}: the payload reports ${fixed(total, 1)} combos but the ` +
            `hand order gives ${fixed(weighted, 1)} - check the hand axis`
          );
        }
      }

      const notes = [
        `GTO Wizard action_solutions: ${entries.length} actions x ${count} hands at ${foundItem.path}`,
        axisNote,
      ];
      if (checked && !warnings.length) {
        notes.push("hand order cross-checked against the payload's total_combos");
      }

      candidates.push({
        kind: "gw_action_solutions",
        label: "GTO Wizard action_solutions (strategy arrays)",
        columns, score: scoreColumns(columns, true, count), notes, warnings,
      });
    }

    return candidates;
  }

  /* {"hands": [...], "strategy": [[freq, ...], ...]} layouts. */
  function fromMatrices(found) {
    const candidates = [];
    for (const item of found) {
      if (item.kind !== "matrix") continue;
      const matrix = numericMatrix(item.node);
      if (matrix === null) continue;
      const rows = matrix.length;
      const cols = matrix[0].length;

      let hands = siblingHands(item.parent, rows);
      let orientation = hands ? "hands_x_actions" : "";
      if (hands === null) {
        hands = siblingHands(item.parent, cols);
        orientation = hands ? "actions_x_hands" : "";
      }
      if (hands === null) {
        hands = globalHands(found, rows);
        orientation = hands ? "hands_x_actions" : "";
      }
      if (hands === null) {
        hands = globalHands(found, cols);
        orientation = hands ? "actions_x_hands" : "";
      }
      if (hands === null) continue;

      const actionCount = orientation === "hands_x_actions" ? cols : rows;
      const actions = siblingActions(item.parent, actionCount) ||
        globalActions(found, actionCount) ||
        synthActions(actionCount);

      const notes = [`hand axis: ${hands.length} entries at ${item.path}`];
      if (orientation === "actions_x_hands") {
        notes.push("strategy matrix transposed (rows = actions, cols = hands)");
      }
      if (actions.every((action) => action.family === "unknown")) {
        notes.push("no action axis found - columns numbered instead");
      }

      const columns = [];
      if (orientation === "hands_x_actions") {
        for (let column = 0; column < cols; column += 1) {
          const mapping = {};
          for (let row = 0; row < rows; row += 1) mapping[hands[row]] = matrix[row][column];
          columns.push([actions[column], mapping]);
        }
      } else {
        for (let row = 0; row < rows; row += 1) {
          const mapping = {};
          for (let column = 0; column < cols; column += 1) mapping[hands[column]] = matrix[row][column];
          columns.push([actions[row], mapping]);
        }
      }

      candidates.push({
        kind: "matrix",
        label: "strategy matrix + hand axis",
        columns,
        score: scoreColumns(columns, actions[0].family !== "unknown", hands.length),
        notes,
      });
    }
    return candidates;
  }

  /* Union of inner keys, ordered by first appearance (widest record first). */
  function orderedActionKeys(node) {
    const records = Object.values(node)
      .filter((value) => isPlainObject(value))
      .sort((left, right) => Object.keys(right).length - Object.keys(left).length);
    const ordered = [];
    const seen = new Set();
    for (const record of records) {
      for (const key of Object.keys(record)) {
        if (!seen.has(key)) {
          seen.add(key);
          ordered.push(key);
        }
      }
    }
    return ordered;
  }

  /* {"AA": [0.5, 0.5], "KK": [1.0, 0.0]} layouts. */
  function fromHandListMaps(found) {
    const candidates = [];
    for (const item of found) {
      if (item.kind !== "hand_list_map") continue;
      const node = item.node;
      const hands = handishKeys(node);
      if (!hands.length) continue;
      let width = 0;
      for (const hand of hands) width = Math.max(width, node[hand].length);
      const actions = siblingActions(item.parent, width) ||
        globalActions(found, width) ||
        synthActions(width);

      const columns = [];
      for (let index = 0; index < width; index += 1) {
        const mapping = {};
        for (const hand of hands) {
          const values = numericList(node[hand]) || [];
          if (index < values.length) mapping[hand] = values[index];
        }
        columns.push([actions[index], mapping]);
      }

      const notes = [`hand -> list map: ${hands.length} hands x ${width} columns at ${item.path}`];
      if (actions.every((action) => action.family === "unknown")) {
        notes.push("no action axis found - columns numbered instead");
      }
      candidates.push({
        kind: "hand_list_map",
        label: "hand -> frequency list",
        columns,
        score: scoreColumns(columns, actions[0].family !== "unknown", hands.length),
        notes,
      });
    }
    return candidates;
  }

  /* {"AA": {"RAISE": 0.5, "CALL": 0.5}, ...} layouts. */
  function fromHandDictMaps(found) {
    const candidates = [];
    for (const item of found) {
      if (item.kind !== "hand_dict_map") continue;
      const node = item.node;
      const hands = handishKeys(node);
      const ordered = orderedActionKeys(node);
      const actions = ordered.map((key) => {
        const info = normalizeAction(key);
        return info !== null
          ? info
          : { id: String(key), family: "unknown", name: String(key), betsize: null, raw: "" };
      });

      const columns = ordered.map((key, index) => {
        const mapping = {};
        for (const hand of hands) {
          const nested = node[hand];
          const value = isPlainObject(nested) ? toNumber(nested[key]) : toNumber(undefined);
          if (value !== null) mapping[hand] = value;
        }
        return [actions[index], mapping];
      });

      candidates.push({
        kind: "hand_dict_map",
        label: "hand -> action frequencies",
        columns,
        score: scoreColumns(columns, actions.every((action) => action.family !== "unknown"), hands.length),
        notes: [`hand -> action map: ${hands.length} hands x ${columns.length} actions at ${item.path}`],
      });
    }
    return candidates;
  }

  const RECORD_CONTAINER_KEYS = [
    "actions", "action_solutions", "strategies", "strategy", "frequencies",
    "weights", "frequencies_list", "action_frequencies",
  ];

  /* GTO Wizard's aggregated report lists combos per action instead of
   * frequencies:
   *
   *   "53o": {
   *     "name": "53o",
   *     "total_combos_available": 12.0, "total_combos": 12.0, "total_frequency": 1.0,
   *     "actions_total_combos": {"F": 12.0, "C": 0.0, "R31.5": 0.0, "RAI": 0.0}
   *   }
   *
   * One key per available action, no merging: 53o here folds 100%, and the
   * other three actions stay as separate entries with a frequency of 0.
   * The combos are divided by total_combos_available - the same denominator
   * GTO Wizard uses for its own total_frequency.
   */
  const RECORD_COMBOS_KEYS = [
    "actions_total_combos", "action_total_combos", "actions_total_combo",
    "action_combos", "actions_combos", "combos_by_action", "total_combos_by_action",
  ];

  const RECORD_AVAILABLE_KEYS = [
    "total_combos_available", "total_combo_available", "combos_available",
    "available_combos", "total_combos",
  ];

  /* The {action: combos} dict of one per-hand record, or null. */
  function actionComboEntries(record) {
    for (const key of RECORD_COMBOS_KEYS) {
      const value = lookupKey(record, [key]);
      if (!isPlainObject(value)) continue;
      const entries = [];
      for (const actionKey of Object.keys(value)) {
        const number = toNumber(value[actionKey]);
        if (number !== null) entries.push([String(actionKey), number]);
      }
      if (entries.length) return entries;
    }
    return null;
  }

  /* [handToken, record] pairs for the containers that can hold such records. */
  function actionComboRows(item) {
    const rows = [];
    if (item.kind === "hand_records") {
      for (const record of item.node) {
        if (isPlainObject(record)) rows.push([recordHandToken(record)[1], record]);
      }
      return rows;
    }
    if (item.kind === "hand_dict_map") {
      for (const key of Object.keys(item.node)) {
        const record = item.node[key];
        if (!isPlainObject(record)) continue;
        const token = recordHandToken(record)[1];
        rows.push([token !== null ? token : (isHandToken(key) ? key : null), record]);
      }
    }
    return rows;
  }

  /* {"53o": {"actions_total_combos": {...}}} layouts. */
  function fromActionComboRecords(found) {
    const candidates = [];
    for (const item of found) {
      const rows = actionComboRows(item);
      if (!rows.length) continue;

      const order = [];
      const seen = new Set();
      const perHand = {};
      let used = 0;
      let renormalised = 0;

      for (const [hand, record] of rows) {
        if (hand === null) continue;
        const entries = actionComboEntries(record);
        if (entries === null) continue;
        used += 1;

        let available = null;
        for (const key of RECORD_AVAILABLE_KEYS) {
          const number = toNumber(lookupKey(record, [key]));
          if (number !== null && number > 0) {
            available = number;
            break;
          }
        }
        let total = 0;
        for (const entry of entries) total += entry[1];
        if (available === null) available = total;
        if (available <= 0) available = 1;
        if (total > available + 1e-9) {
          // inconsistent: more combos than the record admits to having
          available = total;
          renormalised += 1;
        }

        if (!perHand[hand]) perHand[hand] = {};
        const row = perHand[hand];
        for (const entry of entries) {
          const actionKey = entry[0];
          if (!seen.has(actionKey)) {
            seen.add(actionKey);
            order.push(actionKey);
          }
          const frequency = Math.max(0.0, Math.min(entry[1] / available, 1.0));
          if (frequency > 0) row[actionKey] = (row[actionKey] || 0.0) + frequency;
        }
      }

      if (!order.length || !Object.keys(perHand).length) continue;

      const actions = order.map((key) => {
        const info = normalizeAction(key);
        if (info === null) {
          return { id: String(key), family: "unknown", name: String(key), betsize: null, raw: "" };
        }
        // keep the payload's own code (F, C, R31.5, RAI) as the label
        return Object.assign({}, info, { name: String(key) });
      });

      const columns = order.map((key, index) => {
        const mapping = {};
        for (const hand of Object.keys(perHand)) {
          const value = perHand[hand][key];
          if (value !== undefined && value > 0) mapping[hand] = value;
        }
        return [actions[index], mapping];
      });

      const notes = [
        `action combos per hand: ${Object.keys(perHand).length} hands x ${order.length} actions ` +
          `at ${item.path} (${used} rows)`,
        "combos divided by total_combos_available, GTO Wizard's own denominator",
      ];
      if (renormalised) {
        notes.push(`${renormalised} row(s) listed more combos than available - divided by their own sum`);
      }

      candidates.push({
        kind: "gw_action_combos",
        label: "GTO Wizard report (combos per action)",
        columns,
        score: scoreColumns(columns, actions.every((action) => action.family !== "unknown"),
          Object.keys(perHand).length),
        notes,
      });
    }
    return candidates;
  }

  function anyGlobalActions(found) {
    for (const item of found) {
      if (item.kind !== "action_list") continue;
      const actions = item.node.map((entry) => normalizeAction(entry));
      if (actions.length && actions.every((action) => action !== null)) return actions;
    }
    return null;
  }

  /* Flatten one hand record into [key, action, frequency] triples. */
  function recordEntries(record, globalActionsList) {
    const infoSelf = normalizeAction(record);
    const freqSelf = toNumber(record);
    if (infoSelf !== null && freqSelf !== null) return [[infoSelf.id, infoSelf, freqSelf]];

    for (const containerKey of RECORD_CONTAINER_KEYS) {
      const value = lookupKey(record, [containerKey]);
      if (value === null) continue;

      const entries = [];
      if (Array.isArray(value) && value.length) {
        for (const item of value) {
          const info = normalizeAction(item);
          if (info === null) continue;
          let freq = toNumber(item);
          if (freq === null && isPlainObject(item)) freq = toNumber(lookupKey(item, FREQ_KEYS));
          if (freq !== null) entries.push([info.id, info, freq]);
        }
        if (!entries.length && value.every((item) => toNumber(item) !== null)) {
          value.forEach((item, index) => {
            const freq = toNumber(item);
            if (freq === null) return;
            const action = globalActionsList && index < globalActionsList.length
              ? globalActionsList[index]
              : null;
            entries.push([action ? action.id : `action_${index + 1}`, action, freq]);
          });
        }
      } else if (isPlainObject(value)) {
        for (const subKey of Object.keys(value)) {
          const freq = toNumber(value[subKey]);
          if (freq === null) continue;
          const info = normalizeAction(subKey);
          entries.push([info ? info.id : String(subKey), info, freq]);
        }
      }

      if (entries.length) return entries;
    }
    return [];
  }

  /* [{"hand": "AA", "actions": [{"action": "R", "frequency": 0.5}]}, ...] */
  function fromHandRecords(found) {
    const candidates = [];
    const globalActionsList = anyGlobalActions(found);

    for (const item of found) {
      if (item.kind !== "hand_records") continue;
      const records = item.node.filter((record) => isPlainObject(record));
      const handKey = records.length ? recordHandToken(records[0])[0] : null;
      if (handKey === null) continue;

      const order = [];
      const actionsByKey = {};
      const columnsMap = {};

      for (const record of records) {
        const hand = record[handKey];
        if (typeof hand !== "string") continue;
        for (const entry of recordEntries(record, globalActionsList)) {
          const key = entry[0];
          const info = entry[1];
          const freq = entry[2];
          if (!Object.prototype.hasOwnProperty.call(columnsMap, key)) {
            columnsMap[key] = {};
            order.push(key);
            let resolved = info;
            if (resolved === null && key.startsWith("action_") && /^\d+$/.test(key.slice(7))) {
              const index = parseInt(key.slice(7), 10) - 1;
              if (globalActionsList && index < globalActionsList.length) {
                resolved = globalActionsList[index];
              }
            }
            actionsByKey[key] = resolved || { id: key, family: "unknown", name: key, betsize: null, raw: "" };
          }
          columnsMap[key][hand] = (columnsMap[key][hand] || 0.0) + freq;
        }
      }

      if (!order.length) continue;

      const columns = order.map((key) => [actionsByKey[key], columnsMap[key]]);
      const notes = [`hand records: ${records.length} rows x ${order.length} actions at ${item.path}`];
      if (order.every((key) => actionsByKey[key].family === "unknown")) {
        notes.push("no action labels found on the records");
      }
      candidates.push({
        kind: "hand_records",
        label: "one object per hand",
        columns,
        score: scoreColumns(
          columns,
          order.every((key) => actionsByKey[key].family !== "unknown"),
          Object.keys(columnsMap[order[0]]).length
        ),
        notes,
      });
    }
    return candidates;
  }

  /* [{"action": {...}, "strategy": {"AA": 0.5, "KK": 1.0}}, ...] */
  function fromActionHandMaps(found) {
    const columns = [];
    const standalone = [];
    const listContainers = new Set();
    for (const item of found) {
      if (item.kind === "action_hand_maps") listContainers.add(item.node);
    }

    for (const item of found) {
      if (item.kind === "action_hand_maps") {
        for (const column of item.extra.columns || []) columns.push(column);
      } else if (item.kind === "action_hand_map") {
        if (listContainers.has(item.parent)) continue;
        const action = item.extra.action;
        if (!action || !isPlainObject(item.node)) continue;
        const mapping = handMapFrom(item.node);
        if (mapping) standalone.push([action, mapping]);
      }
    }
    for (const column of standalone) columns.push(column);
    if (!columns.length) return [];

    const merged = new Map();
    for (const entry of columns) {
      const action = entry[0];
      const mapping = entry[1];
      if (!merged.has(action.id)) merged.set(action.id, [action, {}]);
      const target = merged.get(action.id)[1];
      for (const hand of Object.keys(mapping)) {
        target[hand] = (target[hand] || 0.0) + mapping[hand];
      }
    }

    const ordered = Array.from(merged.values());
    let handCount = 0;
    for (const entry of ordered) handCount = Math.max(handCount, Object.keys(entry[1]).length);

    return [{
      kind: "action_hand_maps",
      label: "one object per action (hand -> frequency)",
      columns: ordered,
      score: scoreColumns(ordered, true, handCount),
      notes: [`one column per action object (${ordered.length} actions)`],
    }];
  }

  /* Last resort: {"AA": 0.5, "KK": 1.0} with no action axis at all. */
  function fromHandNumMaps(found) {
    const candidates = [];
    for (const item of found) {
      if (item.kind !== "hand_num_map") continue;
      const node = item.node;
      const mapping = {};
      for (const hand of handishKeys(node)) {
        const number = toNumber(node[hand]);
        if (number !== null) mapping[hand] = number;
      }
      if (!Object.keys(mapping).length) continue;
      const action = { id: "weight", family: "unknown", name: "Weight (single value)", betsize: null, raw: "" };
      candidates.push({
        kind: "hand_num_map",
        label: "hand -> single frequency",
        columns: [[action, mapping]],
        score: scoreColumns([[action, mapping]], false, Object.keys(mapping).length) - 15.0,
        notes: [`single weight per hand at ${item.path} (no action axis)`],
        warnings: ["no action axis found; the whole payload is treated as one range"],
      });
    }
    return candidates;
  }

  /* A compact summary of the structures found inside doc (shown in the UI). */
  function describe(doc) {
    const found = collect(doc);
    const summary = {
      root_type: isPlainObject(doc) ? "dict" : Array.isArray(doc) ? "list" : typeof doc,
      root_keys: isPlainObject(doc) ? Object.keys(doc).slice(0, 40) : null,
      hand_lists: [], action_lists: [], matrices: [], hand_list_maps: [],
      hand_dict_maps: [], hand_num_maps: [], hand_records: [], action_hand_maps: [],
    };

    for (const item of found) {
      const node = item.node;
      if (item.kind === "hand_list") {
        summary.hand_lists.push({ path: item.path, size: node.length, sample: node.slice(0, 6) });
      } else if (item.kind === "action_list") {
        const labels = node.map((entry) => {
          const action = normalizeAction(entry);
          return action ? actionLabel(action) : String(entry).slice(0, 20);
        });
        summary.action_lists.push({ path: item.path, size: node.length, labels: labels.slice(0, 10) });
      } else if (item.kind === "matrix") {
        summary.matrices.push({ path: item.path, ...item.extra });
      } else if (item.kind === "hand_list_map") {
        summary.hand_list_maps.push({ path: item.path, ...item.extra });
      } else if (item.kind === "hand_dict_map") {
        summary.hand_dict_maps.push({
          path: item.path, ...item.extra, action_keys: orderedActionKeys(node).slice(0, 10),
        });
      } else if (item.kind === "hand_num_map") {
        summary.hand_num_maps.push({ path: item.path, ...item.extra });
      } else if (item.kind === "hand_records") {
        summary.hand_records.push({ path: item.path, ...item.extra });
      } else if (item.kind === "action_hand_map") {
        const action = item.extra.action;
        summary.action_hand_maps.push({
          path: item.path, action: action ? actionLabel(action) : null, hands: item.extra.hands,
        });
      } else if (item.kind === "action_hand_maps") {
        summary.action_hand_maps.push({
          path: item.path, actions: item.extra.size, hands: item.extra.hands,
          labels: (item.extra.columns || []).map((entry) => actionLabel(entry[0])).slice(0, 10),
        });
      }
    }
    return summary;
  }

  /* Find the strategy inside doc; throws ParseError when clueless. */
  function detect(doc, scaleOption) {
    const scale = scaleOption === undefined ? "auto" : scaleOption;
    if (!isPlainObject(doc) && !Array.isArray(doc)) {
      throw new ParseError(
        `top level JSON is ${typeof doc}, expected an object or array`, describe(doc)
      );
    }

    const found = collect(doc);
    const candidates = [];
    for (const detector of [
      fromActionStrategyArrays, fromMatrices, fromHandListMaps,
      fromHandDictMaps, fromHandRecords, fromActionHandMaps,
    ]) {
      for (const candidate of detector(found)) candidates.push(candidate);
    }
    /* The aggregated combos report is a summary of a solution that was already
     * solved elsewhere, so it only gets a say when nothing better (a real
     * per-action solution) was recognised. That also keeps the payloads the
     * python reference handles on their original path. */
    const CONFIDENT = 70.0;
    if (!candidates.some((candidate) => candidate.score >= CONFIDENT)) {
      for (const candidate of fromActionComboRecords(found)) candidates.push(candidate);
    }
    if (!candidates.length) {
      for (const candidate of fromHandNumMaps(found)) candidates.push(candidate);
    }

    if (!candidates.length) {
      throw new ParseError(
        "no hand/action strategy found in this JSON - check the inspector panel", describe(doc)
      );
    }

    let best = candidates[0];
    for (const candidate of candidates) {
      if (candidate.score > best.score) best = candidate;
    }

    const resolved = resolveScale(best.columns, scale);
    const scaleFactor = resolved[0];
    const scaleNotes = resolved[1];

    const weights = {};
    const actions = [];
    const seenIds = new Set();

    for (const entry of best.columns) {
      const action = entry[0];
      const mapping = entry[1];
      if (!seenIds.has(action.id)) {
        seenIds.add(action.id);
        actions.push(action);
      }
      for (const hand of Object.keys(mapping)) {
        const weighted = Math.max(0.0, Number(mapping[hand]) * scaleFactor);
        if (weighted === 0.0) continue;
        if (!weights[hand]) weights[hand] = {};
        weights[hand][action.id] = (weights[hand][action.id] || 0.0) + weighted;
      }
    }

    if (!Object.keys(weights).length) {
      throw new ParseError(
        "a strategy layout was recognised but every frequency is zero", describe(doc)
      );
    }

    const handCount = Object.keys(weights).length;
    const comboLevel = Object.keys(weights).every((key) => isComboToken(key));

    const ranked = candidates.slice().sort((left, right) => right.score - left.score).slice(0, 6);
    const notes = best.notes.slice().concat(scaleNotes);
    const warnings = best.warnings ? best.warnings.slice() : [];
    if (best.score < 40) {
      warnings.push("low confidence match - check the detected actions and the inspector");
    }
    if (comboLevel) {
      notes.push(`per-combo payload (${handCount} combos) - weights averaged per hand class`);
    }
    if (actions.every((action) => action.family === "unknown")) {
      warnings.push("no action labels could be read; actions are shown as Action 1..N");
    }

    return {
      formatId: best.kind,
      formatLabel: best.label,
      actions,
      weights,
      scale: scaleFactor,
      notes,
      warnings,
      handCount,
      comboLevel,
      diagnostics: {
        detected_format: best.kind,
        score: pyRound(best.score, 1),
        candidates: ranked.map((candidate) => {
          let hands = 0;
          for (const entry of candidate.columns) hands = Math.max(hands, Object.keys(entry[1]).length);
          return {
            kind: candidate.kind, label: candidate.label,
            score: pyRound(candidate.score, 1), actions: candidate.columns.length, hands,
          };
        }),
        structure: describe(doc),
      },
    };
  }


  GTO2PIO.schema = {
    HAND_KEYS,
    ACTION_LIST_KEYS,
    FREQ_KEYS,
    STRATEGY_HINT_KEYS,
    MIN_HANDS,
    toNumber,
    iterNodes,
    handRatio,
    actionRatio,
    numericList,
    numericMatrix,
    handishKeys,
    handMapFrom,
    recordHandToken,
    actionHandColumns,
    synthActions,
    siblingActions,
    siblingHands,
    globalActions,
    globalHands,
    collect,
    GW_STRATEGY_KEYS,
    GW_COMBO_TOTAL_KEYS,
    gwHandOrder,
    strategyArray,
    totalCombos,
    axisKeys,
    handAxisDict,
    columnValues,
    scoreColumns,
    resolveScale,
    zipWeights,
    fromActionStrategyArrays,
    fromMatrices,
    orderedActionKeys,
    fromHandListMaps,
    fromHandDictMaps,
    RECORD_CONTAINER_KEYS,
    RECORD_COMBOS_KEYS,
    RECORD_AVAILABLE_KEYS,
    actionComboEntries,
    actionComboRows,
    fromActionComboRecords,
    anyGlobalActions,
    recordEntries,
    fromHandRecords,
    fromActionHandMaps,
    fromHandNumMaps,
    describe,
    detect,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
