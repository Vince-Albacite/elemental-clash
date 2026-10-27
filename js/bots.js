function pickBestCardId(state, pid) {
  const hand = state.players[pid].hand;
  let best = hand[0], bestScore = -1;
  hand.forEach(function (card) {
    const score = scoreThrow(state.scoringPrev, card, pid).gain + Math.random();
    if (score > bestScore) { bestScore = score; best = card; }
  });
  return best.id;
}
function scheduleNextBotAction(player, nowMs) { player.nextActAt = nowMs + 900 + Math.random() * 1300; }
function stepBots(state, nowMs, requestThrow, requestDraw) {
  state.players.forEach(function (player, pid) {
    if (!player.isBot || nowMs < player.nextActAt) return;
    scheduleNextBotAction(player, nowMs);
    if (player.hand.length < 6) requestDraw(pid);
    else requestThrow(pid, pickBestCardId(state, pid), nowMs);
  });
}
