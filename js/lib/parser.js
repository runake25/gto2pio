"use strict";

/* The analyze() pipeline: detected strategy -> ready-to-use range.
 *
 * Attached to the GTO2PIO namespace; no bundler, no build step.
 */
(function (root) {
  const GTO2PIO = (root.GTO2PIO = root.GTO2PIO || {});

  const { ParseError, emptyMap, isPlainObject, pyRound } = GTO2PIO.common;
  const { PIO_ORDER, canonicalHand, expandHandToken, isComboToken } = GTO2PIO.hands;
  const { actionLabel, labelForId } = GTO2PIO.actions;
  const { formatPioRange, rangeStats } = GTO2PIO.pio;
  const { detect } = GTO2PIO.schema;

  /* Tolerate trailing commas and "const data = {...};" wrapping. */
  function cleanJsonText(text) {
    let stripped = String(text).trim();
    if (!stripped) return stripped;
    if (stripped[0] !== "{" && stripped[0] !== "[") {
      const firstObject = stripped.indexOf("{");
      const firstArray = stripped.indexOf("[");
      const candidates = [firstObject, firstArray].filter((index) => index >= 0);
      if (candidates.length) {
        const start = Math.min.apply(null, candidates);
        const closer = stripped[start] === "{" ? "}" : "]";
        const end = stripped.lastIndexOf(closer);
        if (end > start) stripped = stripped.slice(start, end + 1);
      }
    }
    return stripped.replace(/,\s*(?=[}\]])/g, "");
  }

  /* Accept a JSON string (as pasted) or an already-parsed document. */
  function loadPayload(payload) {
    if (isPlainObject(payload) || Array.isArray(payload)) return payload;
    if (typeof payload !== "string") throw new ParseError(`unsupported payload type: ${typeof payload}`);
    const text = payload.trim();
    if (!text) throw new ParseError("no JSON provided");
    try {
      return JSON.parse(text);
    } catch (firstError) {
      const cleaned = cleanJsonText(text);
      if (cleaned !== text) {
        try {
          return JSON.parse(cleaned);
        } catch (ignored) {
          /* report the original error below */
        }
      }
      throw new ParseError(`invalid JSON: ${firstError.message}`);
    }
  }

  const GROUP_LABELS = {
    fold: "Fold", check: "Check", call: "Call", bet: "Bet", raise: "Raise", allin: "All-in",
  };

  const MERGEABLE_GROUPS = ["bet", "raise", "allin"];

  /* Collapse an action into a selectable group id. */
  function groupKey(action, options) {
    const family = action.family;
    if (family === "unknown") return action.id;
    if (family === "allin") {
      if (options.allinAsRaise) return options.mergeSizes ? "raise" : action.id;
      return options.mergeSizes ? "allin" : action.id;
    }
    if ((family === "bet" || family === "raise") && !options.mergeSizes) return action.id;
    return family;
  }

  function groupLabel(groupId, options) {
    const base = GROUP_LABELS[groupId];
    if (base === undefined) return labelForId(groupId);
    if (options.mergeSizes && MERGEABLE_GROUPS.indexOf(groupId) >= 0) return `${base} (all sizes)`;
    return base;
  }

  function buildGroups(detection, options) {
    const order = [];
    const members = emptyMap();
    const actionGroup = emptyMap();
    for (const action of detection.actions) {
      const groupId = groupKey(action, options);
      actionGroup[action.id] = groupId;
      if (!members[groupId]) {
        members[groupId] = [];
        order.push(groupId);
      }
      members[groupId].push(action);
    }
    return { order, members, actionGroup };
  }

  /* Sum action weights into per-group weights. */
  function sumByGroup(hands, actionGroup) {
    const grouped = emptyMap();
    for (const hand of Object.keys(hands)) {
      const actions = hands[hand];
      for (const actionId of Object.keys(actions)) {
        const groupId = actionGroup[actionId];
        if (groupId === undefined) continue;
        if (!grouped[groupId]) grouped[groupId] = {};
        grouped[groupId][hand] = (grouped[groupId][hand] || 0.0) + Number(actions[actionId]);
      }
    }
    return grouped;
  }

  /* Share of all 1326 combos as a percentage. */
  function share(mapping) {
    return rangeStats(mapping).percent;
  }

  /* Fold combo-level payloads and ambiguous "AK" tokens into hand classes. */
  function normaliseHands(weights, options) {
    const direct = emptyMap();
    const comboAccum = emptyMap();
    const combosPerClass = emptyMap();

    for (const hand of Object.keys(weights)) {
      const actions = weights[hand];
      let handClasses;

      if (isComboToken(hand)) {
        const classToken = canonicalHand(hand);
        if (classToken === null) continue;
        if (options.aggregateCombos) {
          combosPerClass[classToken] = (combosPerClass[classToken] || 0) + 1;
          for (const actionId of Object.keys(actions)) {
            const key = `${classToken}\u0000${actionId}`;
            if (!comboAccum[key]) comboAccum[key] = [];
            comboAccum[key].push(Number(actions[actionId]));
          }
          continue;
        }
        handClasses = [classToken];
      } else {
        handClasses = expandHandToken(hand);
        if (!handClasses.length) continue;
      }

      for (const classToken of handClasses) {
        if (!direct[classToken]) direct[classToken] = {};
        const bucket = direct[classToken];
        for (const actionId of Object.keys(actions)) {
          bucket[actionId] = (bucket[actionId] || 0.0) + Number(actions[actionId]);
        }
      }
    }

    for (const key of Object.keys(comboAccum)) {
      const separator = key.indexOf("\u0000");
      const classToken = key.slice(0, separator);
      const actionId = key.slice(separator + 1);
      const values = comboAccum[key];
      let sum = 0;
      for (const value of values) sum += value;
      const divisor = Math.max(combosPerClass[classToken] || values.length, 1);
      if (!direct[classToken]) direct[classToken] = {};
      direct[classToken][actionId] = (direct[classToken][actionId] || 0.0) + sum / divisor;
    }

    return direct;
  }

  /* UI options -> the internal option shape (mirrors the old API layer). */
  function normalizeOptions(raw) {
    const value = raw || {};
    const pick = (camel, snake, fallback) => {
      if (value[camel] !== undefined) return value[camel];
      if (value[snake] !== undefined) return value[snake];
      return fallback;
    };

    let decimals = Number(pick("decimals", "decimals", 2));
    if (!Number.isFinite(decimals)) decimals = 2;
    decimals = Math.max(0, Math.min(Math.trunc(decimals), 6));

    let minWeight = Number(pick("minWeight", "min_weight", 0));
    if (!Number.isFinite(minWeight)) minWeight = 0;
    minWeight = Math.max(0.0, Math.min(minWeight, 1.0));

    let scale = String(pick("scale", "scale", "auto")).trim().toLowerCase();
    if (["auto", "fraction", "percent"].indexOf(scale) < 0) scale = "auto";

    const include = value.include;
    return {
      include: Array.isArray(include) ? include.map((entry) => String(entry)) : null,
      mergeSizes: Boolean(pick("mergeSizes", "merge_sizes", true)),
      allinAsRaise: Boolean(pick("allinAsRaise", "allin_as_raise", true)),
      decimals,
      minWeight,
      combineSuitedOffsuit: Boolean(pick("combineSuitedOffsuit", "combine_suited_offsuit", true)),
      aggregateCombos: Boolean(pick("aggregateCombos", "aggregate_combos", true)),
      scale,
    };
  }

  function buildGrid(merged) {
    const grid = {};
    for (const hand of PIO_ORDER) {
      const weight = merged[hand] === undefined ? 0.0 : Number(merged[hand]);
      grid[hand] = pyRound(weight, 4);
    }
    return grid;
  }

  /* Convert a GTO Wizard payload into PioSOLVER range text. */
  function analyze(payload, rawOptions) {
    const options = normalizeOptions(rawOptions);
    const detection = detect(loadPayload(payload), options.scale);

    const groups = buildGroups(detection, options);
    const order = groups.order;
    const members = groups.members;
    const hands = normaliseHands(detection.weights, options);
    const grouped = sumByGroup(hands, groups.actionGroup);

    let defaultInclude = order.filter((groupId) => groupId !== "fold");
    if (!defaultInclude.length) defaultInclude = order.slice();
    const requested = options.include === null ? defaultInclude : options.include;
    const requestedSet = new Set(requested);
    let included = order.filter((groupId) => requestedSet.has(groupId));
    if (!included.length) {
      included = requested.filter((groupId) => members[groupId] !== undefined);
    }

    const merged = {};
    for (const groupId of included) {
      const mapping = grouped[groupId] || {};
      for (const hand of Object.keys(mapping)) {
        merged[hand] = Math.min(1.0, (merged[hand] || 0.0) + Number(mapping[hand]));
      }
    }

    const formatOptions = {
      decimals: options.decimals,
      minWeight: options.minWeight,
      combineSuitedOffsuit: options.combineSuitedOffsuit,
    };
    const rangeText = formatPioRange(merged, formatOptions);

    const perGroup = emptyMap();
    const groupGrids = emptyMap();
    for (const groupId of order) {
      const mapping = grouped[groupId] || {};
      // per-action weights per hand: the grid draws one coloured slice per action
      groupGrids[groupId] = buildGrid(mapping);
      perGroup[groupId] = {
        label: groupLabel(groupId, options),
        range_text: formatPioRange(mapping, formatOptions),
        stats: rangeStats(mapping),
      };
    }

    const groupList = [];
    for (const groupId of order) {
      const entries = members[groupId].map((action) => {
        const mapping = {};
        for (const hand of Object.keys(hands)) {
          const row = hands[hand];
          mapping[hand] = row[action.id] === undefined ? 0.0 : row[action.id];
        }
        return {
          id: action.id, label: actionLabel(action),
          family: action.family, share: share(mapping),
        };
      });
      groupList.push({
        id: groupId,
        label: groupLabel(groupId, options),
        selected: included.indexOf(groupId) >= 0,
        share: share(grouped[groupId] || {}),
        actions: entries,
      });
    }

    const stats = rangeStats(merged);
    const notes = detection.notes.slice();
    const warnings = detection.warnings.slice();
    if (!included.length) warnings.push("no actions selected - the range is empty");

    let allGroupsShare = 0;
    for (const groupId of order) allGroupsShare += share(grouped[groupId] || {});

    return {
      range_text: rangeText,
      groups: groupList,
      included,
      stats,
      totals: {
        all_groups_share: pyRound(allGroupsShare, 2),
        included_share: stats.percent,
      },
      per_group: perGroup,
      // one {hand: weight} map per action: the coloured grid is built from these
      group_grids: groupGrids,
      grid: buildGrid(merged),
      detection: {
        format_id: detection.formatId,
        format_label: detection.formatLabel,
        hand_count: detection.handCount,
        combo_level: detection.comboLevel,
        diagnostics: detection.diagnostics,
      },
      notes,
      warnings,
      hand_count: detection.handCount,
    };
  }


  GTO2PIO.parser = {
    cleanJsonText,
    loadPayload,
    GROUP_LABELS,
    MERGEABLE_GROUPS,
    groupKey,
    groupLabel,
    buildGroups,
    sumByGroup,
    share,
    normaliseHands,
    normalizeOptions,
    buildGrid,
    analyze,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
