function roundToOneDecimal(x) { return Math.round(x * 10) / 10; }
function buildScoreResult(gain, bonus, bonusTo, weakness) { return { gain: gain, bonus: bonus, bonusTo: bonusTo, weakness: weakness }; }
/* Weakness draw: previous element is exactly one rank above the next one. */
function isWeaknessDraw(prev, next) { return prev.e - next.e === 1; }
function getElementShift(prev, next) {
  if (next.e > prev.e) return 1;
  if (next.e < prev.e && !isWeaknessDraw(prev, next)) return -1;
  return 0;
}
function calcCounteredPoints(prev, next) { return Math.abs(prev.n - next.n); }
function calcPlainPoints(prev, next) { return Math.max(0, next.n + getElementShift(prev, next)); }
function calcBonusForPreviousOwner(prev) { return roundToOneDecimal(prev.n * WEAKNESS_BONUS_MULTIPLIER); }
function scoreThrow(prev, next, throwerId) {
  if (!prev) return buildScoreResult(next.n, 0, -1, false);
  if (next.n === 0) return buildScoreResult(0, 0, -1, false);
  if (isWeaknessDraw(prev, next)) {
    const bonusTo = prev.owner === throwerId ? -1 : prev.owner;
    const bonus = bonusTo < 0 ? 0 : calcBonusForPreviousOwner(prev);
    return buildScoreResult(calcCounteredPoints(prev, next), bonus, bonusTo, true);
  }
  return buildScoreResult(calcPlainPoints(prev, next), 0, -1, false);
}
