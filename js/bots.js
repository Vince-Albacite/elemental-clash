const DEFAULT_BOT_PROFILE = { actDelayMs: [900, 2200], randomness: 0.5, riskTolerance: 0.5, riskMinNumber: 6 };
function getBotProfile(player) { return player.profile || DEFAULT_BOT_PROFILE; }
function randomBetween(minimum, maximum) { return minimum + Math.random() * (maximum - minimum); }
function getReactionRange(profile) { return profile.reactionMs || BOT_DEFAULT_REACTION_MS; }
function getMistakeChance(profile) { return profile.mistakeChance === undefined ? BOT_DEFAULT_MISTAKE_CHANCE : profile.mistakeChance; }
/* Element logic reads scoringPrev (a 0 card clears it), the number rule reads last. */
function isCounterCard(state, card) { return !!state.scoringPrev && isBoostedDraw(state.scoringPrev, card); }
function isWeaknessCard(state, card) { return !!state.scoringPrev && isWeaknessDraw(state.scoringPrev, card); }
function hasUsableCounter(state, hand) {
  if (!state.scoringPrev) return true;
  return hand.some(function (card) { return isCounterCard(state, card) && isThrowAllowed(card, state.last); });
}
/* Safe pick: best scoring legal card; weakness draws (they feed the previous owner) only when includeWeakness. */
function pickBestCardId(state, playerId, includeWeakness) {
  const noise = getBotProfile(state.players[playerId]).randomness * CARD_NUMBER_MAX;
  let bestCard = null, bestScore = -1;
  state.players[playerId].hand.forEach(function (card) {
    if (!isThrowAllowed(card, state.last) || (!includeWeakness && isWeaknessCard(state, card))) return;
    const score = scoreThrow(state.scoringPrev, card, playerId).gain + Math.random() * noise;
    if (score > bestScore) { bestScore = score; bestCard = card; }
  });
  return bestCard ? bestCard.id : -1;
}
/* Risk throw (gamble): hand at the limit, no card in hand counters the last element, and the bot holds plain or weakness-draw
   cards numbered riskMinNumber or more. riskTolerance (0..1) is the chance it gambles on the biggest one. */
function findRiskThrow(state, playerId) {
  const player = state.players[playerId], profile = getBotProfile(player), hand = player.hand;
  if (!state.scoringPrev || hand.length < HAND_SIZE) return -1;
  if (hand.some(function (card) { return isCounterCard(state, card); })) return -1;
  const minimumNumber = Math.min(profile.riskMinNumber, CARD_NUMBER_MAX);
  const bigCards = hand.filter(function (card) { return isThrowAllowed(card, state.last) && card.number >= minimumNumber; });
  if (bigCards.length === 0 || Math.random() >= profile.riskTolerance) return -1;
  return bigCards.reduce(function (biggestCard, card) { return card.number > biggestCard.number ? card : biggestCard; }).id;
}
/* Mistake logic, the unintended twin of the gamble: after a bot has picked a throw (normal or gamble) there is a
   mistakeChance that it throws a different random legal card instead, weakness draws included. */
function applyMistake(state, playerId, intendedCardId) {
  const player = state.players[playerId];
  if (Math.random() >= getMistakeChance(getBotProfile(player))) return intendedCardId;
  const alternatives = player.hand.filter(function (card) { return card.id !== intendedCardId && isThrowAllowed(card, state.last); });
  return alternatives.length === 0 ? intendedCardId : alternatives[pickRandomInt(alternatives.length)].id;
}
/* Without a usable counter and with room left, bots draw to hunt for one (less often for more random characters). */
function decideBotMove(state, playerId) {
  const player = state.players[playerId], handIsFull = player.hand.length >= HAND_SIZE, riskCardId = findRiskThrow(state, playerId);
  if (riskCardId >= 0) return { draw: false, cardId: applyMistake(state, playerId, riskCardId) };
  const isHunting = !hasUsableCounter(state, player.hand) && !handIsFull && Math.random() > getBotProfile(player).randomness * 0.5;
  if (isHunting) return { draw: true, cardId: -1 };
  let safeCardId = pickBestCardId(state, playerId, false);
  if (safeCardId < 0) safeCardId = pickBestCardId(state, playerId, true);
  return safeCardId >= 0 ? { draw: false, cardId: applyMistake(state, playerId, safeCardId) } : { draw: true, cardId: -1 };
}
/* Reaction delay: any thrown card changes the board; each bot then waits a random reaction time before it may act again. */
function noticeBoardChange(state, player, nowMs) {
  if (player.seenEventSeq === state.seq) return;
  player.seenEventSeq = state.seq;
  const reactionRange = getReactionRange(getBotProfile(player));
  player.reactionReadyAt = nowMs + randomBetween(reactionRange[0], reactionRange[1]) * BOT_PACE_MULTIPLIER;
}
/* Action pace: the wait between two actions of the same bot, scaled by the global BOT_PACE_MULTIPLIER. */
function scheduleNextBotAction(player, nowMs) {
  const delayRange = getBotProfile(player).actDelayMs;
  player.nextActAt = nowMs + randomBetween(delayRange[0], delayRange[1]) * BOT_PACE_MULTIPLIER;
}
function executeBotMove(playerId, move, nowMs, botHandlers) {
  if (move.draw) botHandlers.drawCard(playerId); else botHandlers.throwCard(playerId, move.cardId, nowMs);
}
/* Telegraph: the move is announced (a distinct note on every human device) and carried out BOT_TELEGRAPH_MS later. */
function startBotMove(player, playerId, move, nowMs, botHandlers) {
  const isSignalled = move.draw ? TELEGRAPH_ON_DECK_DRAW : true;
  if (!isSignalled) { executeBotMove(playerId, move, nowMs, botHandlers); return; }
  botHandlers.telegraph(playerId);
  player.pendingMove = { move: move, executeAt: nowMs + BOT_TELEGRAPH_MS };
}
function runPendingMove(player, playerId, nowMs, botHandlers) {
  if (nowMs < player.pendingMove.executeAt) return;
  const move = player.pendingMove.move;
  player.pendingMove = null;
  executeBotMove(playerId, move, nowMs, botHandlers);
}
/* botHandlers = { throwCard(playerId, cardId, nowMs), drawCard(playerId), telegraph(playerId) } */
function stepBots(state, nowMs, botHandlers) {
  if (nowMs < state.startAt) return;
  state.players.forEach(function (player, playerId) {
    if (!player.isBot) return;
    noticeBoardChange(state, player, nowMs);
    if (player.pendingMove) { runPendingMove(player, playerId, nowMs, botHandlers); return; }
    if (nowMs < player.nextActAt || nowMs < player.reactionReadyAt) return;
    scheduleNextBotAction(player, nowMs);
    startBotMove(player, playerId, decideBotMove(state, playerId), nowMs, botHandlers);
  });
}
/* Random roster pick that avoids names already in the room whenever the roster is big enough. */
function pickRandomBotProfile(usedNames) {
  const freeProfiles = BOT_PROFILES.filter(function (profile) { return usedNames.indexOf(profile.name) < 0; });
  const pool = freeProfiles.length ? freeProfiles : BOT_PROFILES;
  return pool[pickRandomInt(pool.length)];
}
function createRandomBotSeat(usedNames) {
  const profile = pickRandomBotProfile(usedNames);
  return { name: profile.name, icon: cleanIcon(profile.icon), isBot: true, profile: profile };
}
