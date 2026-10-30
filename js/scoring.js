function roundToOneDecimal(x) { return Math.round(x * 10) / 10; }
function buildScoreResult(gain, bonus, bonusTo, weakness, boost, wild) {
  return { gain: gain, bonus: bonus, bonusTo: bonusTo, weakness: weakness, boost: boost === true, wild: wild === true };
}
function rollWildPoints() {
  return ZERO_WILD_VALUE.enabled ? ZERO_WILD_VALUE.min + pickRandomInt(ZERO_WILD_VALUE.max - ZERO_WILD_VALUE.min + 1) : 0;
}
/* Weakness draw: the next element is weak to the previous one (previous beats next). */
function isWeaknessDraw(prev, next) { return WEAKNESS_OF[next.e] === prev.e; }
/* Boosted draw: the next element beats the previous one. */
function isBoostedDraw(prev, next) { return WEAKNESS_OF[prev.e] === next.e; }
function getElementShift(prev, next) { return isBoostedDraw(prev, next) ? BOOST_POINTS : 0; }
function calcCounteredPoints(prev, next) { return Math.abs(prev.n - next.n); }
function calcPlainPoints(prev, next) { return next.n + getElementShift(prev, next); }
function calcBonusForPreviousOwner(prev, next) { return roundToOneDecimal(Math.abs(prev.n - next.n) * WEAKNESS_BONUS_MULTIPLIER); }
function scoreThrow(prev, next, throwerId) {
  if (next.n === 0) return buildScoreResult(rollWildPoints(), 0, -1, false, false, true);
  if (!prev) return buildScoreResult(next.n, 0, -1, false);
  if (isWeaknessDraw(prev, next)) {
    const bonusTo = prev.owner === throwerId ? -1 : prev.owner;
    const bonus = bonusTo < 0 ? 0 : calcBonusForPreviousOwner(prev, next);
    return buildScoreResult(calcCounteredPoints(prev, next), bonus, bonusTo, true);
  }
  return buildScoreResult(calcPlainPoints(prev, next), 0, -1, false, isBoostedDraw(prev, next));
}
/* Throw restriction: equal or higher number, a zero, or a weakness draw. */
function isThrowAllowed(card, last) { return !last || card.n === 0 || card.n >= last.n || isWeaknessDraw(last, card); }
