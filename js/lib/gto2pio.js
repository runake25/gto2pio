"use strict";

/* The public API of the converter.
 *
 * The modules above stay separate for readability; this file re-exports
 * the names the page and the tests use, so `GTO2PIO.analyze(...)` keeps
 * working exactly like the single-file build. VERSION is reported by the
 * UI badge and by the CI smoke test.
 */
(function (root) {
  const GTO2PIO = (root.GTO2PIO = root.GTO2PIO || {});

  GTO2PIO.VERSION = "0.3.4";

  Object.assign(GTO2PIO, {
    // hands
    PIO_ORDER: GTO2PIO.hands.PIO_ORDER,
    HAND_INDEX: GTO2PIO.hands.HAND_INDEX,
    RANK_CHARS: GTO2PIO.hands.RANK_CHARS,
    handType: GTO2PIO.hands.handType,
    comboCount: GTO2PIO.hands.comboCount,
    canonicalHand: GTO2PIO.hands.canonicalHand,
    canonicalFromCombo: GTO2PIO.hands.canonicalFromCombo,
    expandHandToken: GTO2PIO.hands.expandHandToken,
    isHandToken: GTO2PIO.hands.isHandToken,
    isComboToken: GTO2PIO.hands.isComboToken,
    // actions
    normalizeAction: GTO2PIO.actions.normalizeAction,
    actionLabel: GTO2PIO.actions.actionLabel,
    actionCode: GTO2PIO.actions.actionCode,
    labelForId: GTO2PIO.actions.labelForId,
    // pio
    formatPioRange: GTO2PIO.pio.formatPioRange,
    rangeStats: GTO2PIO.pio.rangeStats,
    // schema
    detect: GTO2PIO.schema.detect,
    describe: GTO2PIO.schema.describe,
    gwHandOrder: GTO2PIO.schema.gwHandOrder,
    // parser
    analyze: GTO2PIO.parser.analyze,
    // common
    ParseError: GTO2PIO.common.ParseError,
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
