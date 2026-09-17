"use strict";

/* Action normalisation: GTO Wizard codes/words -> families and labels.
 *
 * Attached to the GTO2PIO namespace; no bundler, no build step.
 */
(function (root) {
  const GTO2PIO = (root.GTO2PIO = root.GTO2PIO || {});

  const { formatG, isPlainObject, lookupKey, pyTitle } = GTO2PIO.common;

  const FAMILY_ALIASES = {
    f: "fold", fold: "fold",
    x: "check", check: "check",
    c: "call", call: "call",
    b: "bet", bet: "bet",
    r: "raise", raise: "raise",
    ai: "allin", rai: "allin", allin: "allin",
    "all-in": "allin", all_in: "allin", jam: "allin", shove: "allin",
  };

  const FAMILY_LABELS = {
    fold: "Fold", check: "Check", call: "Call",
    bet: "Bet", raise: "Raise", allin: "All-in",
  };

  const NUMBER_RE = /-?\d+(?:\.\d+)?/;

  const ACTION_KEYS = ["action", "code", "type", "name", "label", "action_type", "actiontype"];

  const SIZE_KEYS = [
    "betsize", "bet_size", "bet size", "amount", "size",
    "raise_size", "raise_size_bb", "to_amount", "value",
  ];

  const POSITION_KEYS = ["position", "player", "actor", "seat"];

  function actionLabel(info) {
    if (info.name) return info.name;
    const base = FAMILY_LABELS[info.family] || pyTitle(info.family);
    if (info.betsize === null || info.betsize === undefined) return base;
    if (info.family === "fold" || info.family === "check" || info.family === "call") return base;
    return `${base} ${formatG(info.betsize)}`;
  }

  function coerceSize(value) {
    if (typeof value === "boolean") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
      const match = NUMBER_RE.exec(value);
      if (match) return parseFloat(match[0]);
    }
    return null;
  }

  /* Map an action code / word onto a family, tolerating embedded sizes. */
  function familyFromText(text) {
    const stripped = String(text).trim();
    if (!stripped) return null;
    const lowered = stripped.toLowerCase();
    const squashed = lowered.replace(/-/g, "").replace(/_/g, "").replace(/ /g, "");
    for (const candidate of [lowered, squashed]) {
      if (Object.prototype.hasOwnProperty.call(FAMILY_ALIASES, candidate)) {
        return FAMILY_ALIASES[candidate];
      }
    }
    const prefix = stripped.split(/[\d.]+/)[0].trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(FAMILY_ALIASES, prefix) ? FAMILY_ALIASES[prefix] : null;
  }

  function makeId(family, size) {
    if (size === null || size === undefined) return family;
    return `${family}:${formatG(size)}`;
  }

  function rawActionText(raw) {
    for (const key of ACTION_KEYS) {
      const value = lookupKey(raw, [key]);
      if (isPlainObject(value)) {
        const code = lookupKey(value, ["code", "type", "action"]);
        const size = lookupKey(value, SIZE_KEYS);
        if (code) return size === null || size === undefined ? String(code) : `${code} ${size}`;
      } else if (typeof value === "string") {
        return value;
      }
    }
    return "";
  }

  /* Best-effort conversion of one raw action into a normalised action. */
  function normalizeAction(raw) {
    if (raw === null || raw === undefined) return null;

    if (typeof raw === "string") {
      const family = familyFromText(raw);
      if (family === null) return null;
      const size = family === "fold" || family === "check" || family === "call" ? null : coerceSize(raw);
      return { id: makeId(family, size), family, betsize: size, position: null, name: null, raw };
    }

    if (isPlainObject(raw)) {
      let family = null;
      let position = null;
      let nestedSize = null;

      for (const key of ACTION_KEYS) {
        const value = lookupKey(raw, [key]);
        if (value === null || typeof value === "number" || typeof value === "boolean") continue;
        if (isPlainObject(value)) {
          const nested = normalizeAction(value);
          if (nested !== null) {
            family = nested.family;
            nestedSize = nested.betsize;
            position = nested.position;
            break;
          }
        } else if (typeof value === "string") {
          family = familyFromText(value);
          if (family) break;
        }
      }

      if (family === null) return null;

      let size = null;
      if (family !== "fold" && family !== "check" && family !== "call" && family !== "allin") {
        size = coerceSize(lookupKey(raw, SIZE_KEYS));
        if (size === null) size = nestedSize;
        if (size === null) {
          for (const key of ACTION_KEYS) {
            const value = lookupKey(raw, [key]);
            if (typeof value === "string") {
              size = coerceSize(value); // "R2.5" -> 2.5
              break;
            }
          }
        }
      }

      const positionValue = lookupKey(raw, POSITION_KEYS);
      if (typeof positionValue === "string") position = positionValue;

      return {
        id: makeId(family, size), family, betsize: size,
        position, name: null, raw: rawActionText(raw),
      };
    }

    return null;
  }

  /* Human label for an action id such as "raise:2.5" or "call". */
  function labelForId(actionId) {
    const text = String(actionId);
    const cut = text.indexOf(":");
    const family = cut < 0 ? text : text.slice(0, cut);
    const sizeText = cut < 0 ? "" : text.slice(cut + 1);
    const base = FAMILY_LABELS[family] || pyTitle(family);
    return sizeText ? `${base} ${sizeText}` : base;
  }


  GTO2PIO.actions = {
    FAMILY_ALIASES,
    FAMILY_LABELS,
    NUMBER_RE,
    ACTION_KEYS,
    SIZE_KEYS,
    POSITION_KEYS,
    actionLabel,
    coerceSize,
    familyFromText,
    makeId,
    rawActionText,
    normalizeAction,
    labelForId,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
