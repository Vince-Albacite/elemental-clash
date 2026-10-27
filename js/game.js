function createPlayer(seat) {
  return { name: seat.name, icon: seat.icon, isBot: seat.isBot, hand: createRandomHand(HAND_SIZE), points: 0,
    used: [0, 0, 0, 0], lastThrowAt: 0, lastDrawAt: 0, nextActAt: Date.now() + 1000 + Math.random() * 1000 };
}
function createGameState(seats, durationSeconds) {
  return { players: seats.map(createPlayer), last: null, scoringPrev: null, event: null, seq: 0, over: false,
    endsAt: Date.now() + durationSeconds * 1000 };
}
function addPointsToPlayer(player, amount) { player.points = roundToOneDecimal(player.points + amount); }
function recordThrownCard(state, pid, card) {
  state.players[pid].used[card.e]++;
  state.last = { n: card.n, e: card.e, owner: pid };
  state.scoringPrev = card.n === 0 ? null : state.last; /* a 0 card dispels the previous element */
}
function applyThrow(state, pid, cardId, nowMs) {
  const player = state.players[pid];
  if (state.over || !player || nowMs - player.lastThrowAt < THROW_COOLDOWN_MS) return false;
  const card = removeCardFromHand(player.hand, cardId);
  if (!card) return false;
  player.lastThrowAt = nowMs;
  const result = scoreThrow(state.scoringPrev, card, pid);
  addPointsToPlayer(player, result.gain);
  if (result.bonusTo >= 0) addPointsToPlayer(state.players[result.bonusTo], result.bonus);
  recordThrownCard(state, pid, card);
  state.event = { seq: ++state.seq, pid: pid, e: card.e, gain: result.gain, bonus: result.bonus, bonusTo: result.bonusTo, weakness: result.weakness };
  return true;
}
function applyDraw(state, pid, nowMs) {
  const player = state.players[pid];
  if (state.over || !player || nowMs - player.lastDrawAt < DRAW_COOLDOWN_MS) return false;
  player.lastDrawAt = nowMs;
  return addRandomCardIfHandNotFull(player.hand);
}
/* Simultaneous-input discriminator: earliest host arrival wins; exact ties go to the player with fewer points, then lower seat. */
function sortSimultaneousThrows(state, queue) {
  return queue.sort(function (a, b) {
    return a.t - b.t || state.players[a.pid].points - state.players[b.pid].points || a.pid - b.pid;
  });
}
function makePublicPlayerView(state, player) {
  return { name: player.name, icon: player.icon, points: player.points, handCount: player.hand.length, used: state.over ? player.used : null };
}
/* Only the receiving player's own hand is ever included. */
function makeSnapshotFor(state, pid) {
  return { me: pid, over: state.over, left: Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000)),
    last: state.last, event: state.event, players: state.players.map(function (p) { return makePublicPlayerView(state, p); }),
    hand: state.players[pid].hand };
}
