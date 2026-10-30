function isMatchRunning(state, nowMs) { return !state.over && !state.paused && nowMs >= state.startAt; }
function createPlayer(seat, startAt) {
  return { name: seat.name, icon: seat.icon, isBot: seat.isBot, hand: createRandomHand(HAND_SIZE), points: 0,
    used: new Array(ELEMENT_COUNT).fill(0), profile: seat.profile || null, advStreak: 0, lastThrowAt: 0, lastDrawAt: 0, nextActAt: startAt + 1000 + Math.random() * 1000 };
}
/* The match clock starts only after the READY 3 2 1 GO countdown. */
function createGameState(seats, durationSeconds) {
  const startAt = Date.now() + COUNTDOWN_TOTAL_MS;
  return { players: seats.map(function (s) { return createPlayer(s, startAt); }), last: null, scoringPrev: null, event: null, seq: 0, over: false, paused: false,
    startAt: startAt, endsAt: startAt + durationSeconds * 1000 };
}
function addPointsToPlayer(player, amount) { player.points = roundToOneDecimal(player.points + amount); }
function recordThrownCard(state, pid, card) {
  state.players[pid].used[card.e]++;
  state.last = { n: card.n, e: card.e, owner: pid };
  state.scoringPrev = card.n === 0 ? null : state.last; /* a 0 card dispels the previous element */
}
function calcStackMultiplier(streak) { return Math.min(ADVANTAGE_STACK_MAX, (streak - 1) * ADVANTAGE_STACK_BOOST); }
/* Consecutive advantage draws by one player stack; any other draw by that player resets the streak. */
function updateAdvantageStreak(player, result) {
  player.advStreak = result.boost ? player.advStreak + 1 : 0;
  return result.boost ? calcStackMultiplier(player.advStreak) : 1;
}
function applyThrow(state, pid, cardId, nowMs) {
  const player = state.players[pid];
  if (!isMatchRunning(state, nowMs) || !player || nowMs - player.lastThrowAt < THROW_COOLDOWN_MS) return false;
  const peeked = peekCardInHand(player.hand, cardId);
  if (!peeked || !isThrowAllowed(peeked, state.last)) return false;
  const card = removeCardFromHand(player.hand, cardId);
  player.lastThrowAt = nowMs;
  const result = scoreThrow(state.scoringPrev, card, pid);
  const stack = updateAdvantageStreak(player, result), gain = roundToOneDecimal(result.gain * stack);
  addPointsToPlayer(player, gain);
  if (result.bonusTo >= 0) addPointsToPlayer(state.players[result.bonusTo], result.bonus);
  recordThrownCard(state, pid, card);
  state.event = { seq: ++state.seq, pid: pid, e: card.e, gain: gain, bonus: result.bonus, bonusTo: result.bonusTo, weakness: result.weakness, boost: result.boost, stack: stack, wild: result.wild };
  return true;
}
function applyDraw(state, pid, nowMs) {
  const player = state.players[pid];
  if (!isMatchRunning(state, nowMs) || !player || player.hand.length >= HAND_SIZE || nowMs - player.lastDrawAt < DRAW_COOLDOWN_MS) return false;
  player.lastDrawAt = nowMs; /* cooldown only starts after a draw really happened */
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
  return { me: pid, over: state.over, startsInMs: Math.max(0, state.startAt - Date.now()),
    left: Math.max(0, Math.ceil((state.endsAt - Math.max(Date.now(), state.startAt)) / 1000)),
    last: state.last, event: state.event, players: state.players.map(function (p) { return makePublicPlayerView(state, p); }),
    hand: state.players[pid].hand };
}
function shiftMatchClock(state, deltaMs) {
  state.startAt += deltaMs; state.endsAt += deltaMs;
  state.players.forEach(function (p) { p.lastThrowAt += deltaMs; p.lastDrawAt += deltaMs; p.nextActAt += deltaMs; });
}
