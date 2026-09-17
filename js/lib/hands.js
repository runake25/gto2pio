"use strict";

/* The 169 hand classes: canonical tokens, combo counts, expansion.
 *
 * Attached to the GTO2PIO namespace; no bundler, no build step.
 */
(function (root) {
  const GTO2PIO = (root.GTO2PIO = root.GTO2PIO || {});
  const RANK_CHARS = "AKQJT98765432"; // descending, index 0 == Ace

  const VALID_RANKS = new Set(RANK_CHARS.split(""));

  const SUITS = "cdhs";

  const CLASS_COMBOS = { pair: 6, suited: 4, offsuit: 12 };

  const CLASS_RE = /^([AKQJT2-9])([AKQJT2-9])([SO])$/;

  const PAIR_RE = /^([AKQJT2-9])([AKQJT2-9])$/;

  const COMBO_RE = /^([AKQJT2-9])([CDHS])([AKQJT2-9])([CDHS])$/;

  function buildOrder() {
    const order = [];
    for (const hi of RANK_CHARS) order.push(hi + hi);
    for (let i = 0; i < RANK_CHARS.length; i += 1) {
      const hi = RANK_CHARS[i];
      for (let j = i + 1; j < RANK_CHARS.length; j += 1) {
        const lo = RANK_CHARS[j];
        order.push(hi + lo + "s");
        order.push(hi + lo + "o");
      }
    }
    return order;
  }

  const PIO_ORDER = buildOrder();

  const HAND_INDEX = {};
  PIO_ORDER.forEach((hand, index) => {
    HAND_INDEX[hand] = index;
  });

  function handType(token) {
    const t = String(token).trim().toUpperCase();
    if (t.length === 2) return "pair";
    return t.endsWith("S") ? "suited" : "offsuit";
  }

  function comboCount(token) {
    const t = String(token).trim().toUpperCase();
    if (t.length === 2) return t[0] === t[1] ? 6 : 16;
    return CLASS_COMBOS[handType(t)];
  }

  function orderedPair(rankA, rankB) {
    return RANK_CHARS.indexOf(rankA) < RANK_CHARS.indexOf(rankB)
      ? [rankA, rankB]
      : [rankB, rankA];
  }

  function canonicalFromCombo(token) {
    const match = COMBO_RE.exec(String(token).trim().toUpperCase());
    if (!match) return null;
    const [, rankA, suitA, rankB, suitB] = match;
    if (rankA === rankB && suitA === suitB) return null; // same card twice
    if (rankA === rankB) return rankA + rankB;
    const [hi, lo] = orderedPair(rankA, rankB);
    return `${hi}${lo}${suitA === suitB ? "s" : "o"}`;
  }

  /* Canonical *class* token, or null when the token is not a hand. "AK" is
   * deliberately ambiguous (suited + offsuit) and returns null. */
  function canonicalHand(token) {
    if (typeof token !== "string") return null;
    const text = token.trim();
    if (!text) return null;

    if (text.length === 4) return canonicalFromCombo(text);

    const upper = text.toUpperCase();
    if (upper.length === 3) {
      const match = CLASS_RE.exec(upper);
      if (!match) return null;
      const [, rankA, rankB, kind] = match;
      if (rankA === rankB) return rankA + rankB;
      const [hi, lo] = orderedPair(rankA, rankB);
      return `${hi}${lo}${kind.toLowerCase()}`;
    }

    if (upper.length === 2) {
      const match = PAIR_RE.exec(upper);
      if (!match) return null;
      const [, rankA, rankB] = match;
      if (rankA !== rankB) return null;
      return rankA + rankB;
    }

    return null;
  }

  /* "AK" -> ["AKs","AKo"], "AhAd" -> ["AA"], "QQ" -> ["QQ"], junk -> []. */
  function expandHandToken(token) {
    if (typeof token !== "string") return [];
    const text = token.trim();
    if (!text) return [];

    const combo = canonicalFromCombo(text);
    if (combo) return [combo];

    const classToken = canonicalHand(text);
    if (classToken) return [classToken];

    const upper = text.toUpperCase();
    if (upper.length === 2 && VALID_RANKS.has(upper[0]) && VALID_RANKS.has(upper[1])) {
      const [hi, lo] = orderedPair(upper[0], upper[1]);
      return [`${hi}${lo}s`, `${hi}${lo}o`];
    }
    return [];
  }

  function isHandToken(token) {
    return expandHandToken(token).length > 0;
  }

  function isComboToken(token) {
    return typeof token === "string" && COMBO_RE.test(token.trim().toUpperCase());
  }


  GTO2PIO.hands = {
    RANK_CHARS,
    VALID_RANKS,
    SUITS,
    CLASS_COMBOS,
    CLASS_RE,
    PAIR_RE,
    COMBO_RE,
    buildOrder,
    PIO_ORDER,
    HAND_INDEX,
    handType,
    comboCount,
    orderedPair,
    canonicalFromCombo,
    canonicalHand,
    expandHandToken,
    isHandToken,
    isComboToken,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
