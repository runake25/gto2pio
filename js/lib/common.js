"use strict";

/* Shared helpers: object guards, python-compatible rounding and
 * formatting, key lookups, and the ParseError type.
 *
 * Attached to the GTO2PIO namespace; no bundler, no build step.
 */
(function (root) {
  const GTO2PIO = (root.GTO2PIO = root.GTO2PIO || {});
  function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  /* Maps keyed by strings from untrusted input must not inherit from Object.prototype. */
  function emptyMap() {
    return Object.create(null);
  }

  /* Case-insensitive lookup of the first present key (exact key wins). */
  function lookupKey(mapping, keys) {
    const lowered = {};
    for (const key of Object.keys(mapping)) lowered[String(key).trim().toLowerCase()] = mapping[key];
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(mapping, key)) return mapping[key];
      if (Object.prototype.hasOwnProperty.call(lowered, key)) return lowered[key];
    }
    return null;
  }

  /* Python's str.title(): capitalise each run of letters, lower the rest. */
  function pyTitle(text) {
    return String(text).replace(/[A-Za-z]+/g, (run) => run[0].toUpperCase() + run.slice(1).toLowerCase());
  }

  /* Python's "%g": 6 significant digits, trailing zeros stripped. */
  function formatG(value) {
    const v = Number(value);
    if (!isFinite(v)) return String(value);
    if (v === 0) return "0";
    const exp = Math.floor(Math.log10(Math.abs(v)));
    if (exp < -4 || exp >= 6) {
      return v
        .toExponential(5)
        .replace(/\.?0+e/, "e")
        .replace(/e([+-])(\d)$/, "e$10$2");
    }
    let text = v.toFixed(Math.max(0, 5 - exp));
    if (text.indexOf(".") >= 0) text = text.replace(/0+$/, "").replace(/\.$/, "");
    return text;
  }

  /* Python's round(value, decimals): correctly rounded, half-to-even.
   *
   * Rounding the scaled float is not good enough (0.35*10 = 3.5000000000000004
   * would round up, while python rounds the exact value 0.3499... down), so the
   * exact decimal expansion of the double is used instead.
   */
  function pyRound(value, decimals) {
    const v = Number(value);
    if (!Number.isFinite(v)) return v;
    if (!(decimals >= 0 && decimals <= 20)) return Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals);

    const sign = v < 0 ? -1 : 1;
    const text = Math.abs(v).toFixed(20); // 20 decimals see every tie that matters
    const dot = text.indexOf(".");
    const intPart = text.slice(0, dot);
    const fracPart = text.slice(dot + 1);
    const keep = fracPart.slice(0, decimals);
    const rest = fracPart.slice(decimals);

    let digits = Number(intPart + keep);
    const head = rest.charAt(0);
    if (head > "5") digits += 1;
    else if (head === "5") {
      if (/^0*$/.test(rest.slice(1))) {
        if (digits % 2 !== 0) digits += 1; // exact tie -> half to even
      } else {
        digits += 1;
      }
    }

    return (sign * digits) / Math.pow(10, decimals);
  }

  /* Python's f"{value:.{decimals}f}". */
  function fixed(value, decimals) {
    return Number(value).toFixed(decimals);
  }

  class ParseError extends Error {
    constructor(message, diagnostics) {
      super(message);
      this.name = "ParseError";
      this.diagnostics = diagnostics || {};
    }
  }


  GTO2PIO.common = {
    isPlainObject,
    emptyMap,
    lookupKey,
    pyTitle,
    formatG,
    pyRound,
    fixed,
    ParseError,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
