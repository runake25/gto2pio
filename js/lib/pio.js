"use strict";

/* PioSOLVER range string emission and combo statistics.
 *
 * Attached to the GTO2PIO namespace; no bundler, no build step.
 */
(function (root) {
  const GTO2PIO = (root.GTO2PIO = root.GTO2PIO || {});

  const { fixed, pyRound } = GTO2PIO.common;
  const { PIO_ORDER, comboCount } = GTO2PIO.hands;

  function weightSuffix(quantized, decimals) {
    if (quantized >= 1.0) return "";
    const text = fixed(quantized, decimals).replace(/0+$/, "").replace(/\.$/, "");
    return `:${text}`;
  }

  /* Render {hand: weight} as a PioSOLVER range string. */
  function formatPioRange(weights, opts) {
    const options = opts || {};
    const decimals = Math.max(0, Math.min(Number(options.decimals === undefined ? 2 : options.decimals), 6));
    const minWeight = options.minWeight === undefined ? 0.0 : Number(options.minWeight);
    const combine = options.combineSuitedOffsuit === undefined ? true : Boolean(options.combineSuitedOffsuit);

    const parts = [];
    const consumed = new Set();
    const weightOf = (hand) => (weights[hand] === undefined ? 0.0 : Number(weights[hand]));

    for (const hand of PIO_ORDER) {
      if (consumed.has(hand)) continue;

      if (combine && hand.endsWith("s")) {
        const offsuit = `${hand.slice(0, -1)}o`;
        const suitedQ = pyRound(weightOf(hand), decimals);
        const offsuitQ = pyRound(weightOf(offsuit), decimals);
        if (suitedQ > 0 && suitedQ < 1.0 && suitedQ === offsuitQ && weightOf(hand) >= minWeight) {
          parts.push(hand.slice(0, -1) + weightSuffix(suitedQ, decimals));
          consumed.add(offsuit);
          continue;
        }
        if (suitedQ >= 1.0 && offsuitQ >= 1.0 && weightOf(hand) >= minWeight) {
          parts.push(hand.slice(0, -1));
          consumed.add(offsuit);
          continue;
        }
      }

      const raw = weightOf(hand);
      const quantized = pyRound(raw, decimals);
      if (quantized <= 0 || raw < minWeight) continue;
      parts.push(hand + weightSuffix(quantized, decimals));
    }

    return parts.join(",");
  }

  /* Weighted combo count / share of all 1326 combos. */
  function rangeStats(weights) {
    let combos = 0;
    let hands = 0;
    for (const hand of Object.keys(weights)) {
      const weight = Number(weights[hand]);
      combos += comboCount(hand) * weight;
      if (weight > 0) hands += 1;
    }
    return {
      hands,
      combos: pyRound(combos, 2),
      percent: pyRound((combos / 1326.0) * 100.0, 2),
    };
  }


  GTO2PIO.pio = {
    weightSuffix,
    formatPioRange,
    rangeStats,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
