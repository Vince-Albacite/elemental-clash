const DEFAULT_BOT_PROFILE = { actDelayMs: [900, 2200], randomness: 0.5, riskTolerance: 0.5, riskMinNumber: 6 };
function getBotProfile(player) { return player.profile || DEFAULT_BOT_PROFILE; }
/* Element logic reads scoringPrev (a 0 card clears it), the number rule reads last. */
function isCounterCard(state, card) { return !!state.scoringPrev && isBoostedDraw(state.scoringPrev, card); }
function isWeaknessCard(state, card) { return !!state.scoringPrev && isWeaknessDraw(state.scoringPrev, card); }
function hasUsableCounter(state, hand) {
  if (!state.scoringPrev) return true;
  return hand.some(function (c) { return isCounterCard(state, c) && isThrowAllowed(c, state.last); });
}
/* Safe pick: best scoring legal card; weakness draws (they feed the previous owner) only when includeWeakness. */
function pickBestCardId(state, pid, includeWeakness) {
  const noise = getBotProfile(state.players[pid]).randomness * CARD_NUMBER_MAX;
  let best = null, bestScore = -1;
  state.players[pid].hand.forEach(function (card) {
    if (!isThrowAllowed(card, state.last) || (!includeWeakness && isWeaknessCard(state, card))) return;
    const score = scoreThrow(state.scoringPrev, card, pid).gain + Math.random() * noise;
    if (score > bestScore) { bestScore = score; best = card; }
  });
  return best ? best.id : -1;
}
/* Risk throw: hand at the limit, no card in hand counters the last element, and the bot holds plain or weakness-draw
   cards numbered riskMinNumber or more. riskTolerance (0..1) is the chance it gambles on the biggest one. */
function findRiskThrow(state, pid) {
  const player = state.players[pid], profile = getBotProfile(player), hand = player.hand;
  if (!state.scoringPrev || hand.length < HAND_SIZE) return -1;
  if (hand.some(function (c) { return isCounterCard(state, c); })) return -1;
  const minNumber = Math.min(profile.riskMinNumber, CARD_NUMBER_MAX);
  const big = hand.filter(function (c) { return isThrowAllowed(c, state.last) && c.n >= minNumber; });
  if (big.length === 0 || Math.random() >= profile.riskTolerance) return -1;
  return big.reduce(function (a, b) { return b.n > a.n ? b : a; }).id;
}
/* Without a usable counter and with room left, bots draw to hunt for one (less often when more random). */
function decideBotMove(state, pid) {
  const player = state.players[pid], full = player.hand.length >= HAND_SIZE, riskId = findRiskThrow(state, pid);
  if (riskId >= 0) return { draw: false, id: riskId };
  const hunting = !hasUsableCounter(state, player.hand) && !full && Math.random() > getBotProfile(player).randomness * 0.5;
  if (hunting) return { draw: true, id: -1 };
  let id = pickBestCardId(state, pid, false);
  if (id < 0) id = pickBestCardId(state, pid, true);
  return id >= 0 ? { draw: false, id: id } : { draw: true, id: -1 };
}
function scheduleNextBotAction(player, nowMs) {
  const d = getBotProfile(player).actDelayMs;
  player.nextActAt = nowMs + d[0] + Math.random() * (d[1] - d[0]);
}
function stepBots(state, nowMs, requestThrow, requestDraw) {
  if (nowMs < state.startAt) return;
  state.players.forEach(function (player, pid) {
    if (!player.isBot || nowMs < player.nextActAt) return;
    scheduleNextBotAction(player, nowMs);
    const move = decideBotMove(state, pid);
    if (move.draw) requestDraw(pid); else requestThrow(pid, move.id, nowMs);
  });
}
/* Random roster pick that avoids names already in the room whenever the roster is big enough. */
function pickRandomBotProfile(usedNames) {
  const free = BOT_PROFILES.filter(function (p) { return usedNames.indexOf(p.name) < 0; }), pool = free.length ? free : BOT_PROFILES;
  return pool[pickRandomInt(pool.length)];
}
function createRandomBotSeat(usedNames) {
  const p = pickRandomBotProfile(usedNames);
  return { name: p.name, icon: cleanIcon(p.icon), isBot: true, profile: p };
}
