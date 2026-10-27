let hostState = null, hostTickId = 0, lastPushAt = 0, throwQueue = [], flushScheduled = false;
let peerChannels = [null, null, null, null], lobbySeats = [null, null, null, null], pendingInvite = null;
function pushSnapshots() {
  lastPushAt = Date.now();
  hostState.players.forEach(function (p, pid) {
    const snap = makeSnapshotFor(hostState, pid);
    if (pid === 0) renderSnapshot(snap); else sendJson(peerChannels[pid], { t: 'snap', s: snap });
  });
}
function flushThrowQueue() {
  flushScheduled = false;
  const batch = sortSimultaneousThrows(hostState, throwQueue); throwQueue = [];
  batch.forEach(function (q) { if (applyThrow(hostState, q.pid, q.cardId, q.t)) pushSnapshots(); });
}
function enqueueThrow(pid, cardId, arrivalMs) {
  throwQueue.push({ pid: pid, cardId: cardId, t: arrivalMs });
  if (!flushScheduled) { flushScheduled = true; setTimeout(flushThrowQueue, TIE_WINDOW_MS); }
}
function drawForPlayer(pid) { if (applyDraw(hostState, pid, Date.now())) pushSnapshots(); }
function receiveIntentFromPlayer(pid, intent) {
  if (!hostState || hostState.over) return;
  if (intent.t === 'throw' && Number.isInteger(intent.id)) enqueueThrow(pid, intent.id, Date.now());
  else if (intent.t === 'draw') drawForPlayer(pid);
}
function finishHostGame() { hostState.over = true; clearInterval(hostTickId); pushSnapshots(); }
function runHostTick() {
  const now = Date.now();
  stepBots(hostState, now, enqueueThrow, drawForPlayer);
  if (now >= hostState.endsAt) finishHostGame();
  else if (now - lastPushAt >= 1000) pushSnapshots();
}
function startHostGame(seats, seconds) {
  hostState = createGameState(seats, seconds); lastSeenEventSeq = 0;
  sendIntentToHost = function (intent) { receiveIntentFromPlayer(0, intent); };
  pushSnapshots(); hostTickId = setInterval(runHostTick, 100);
}
function startSinglePlayerGame(profile, seconds) {
  peerChannels = [null, null, null, null];
  const seats = [{ name: profile.name, icon: profile.icon, isBot: false }];
  for (let i = 1; i < 4; i++) seats.push(createBotSeat(i));
  startHostGame(seats, seconds);
}
function createBotSeat(index) { return { name: BOT_NAMES[index], icon: { c: index + 1, e: index, m: index }, isBot: true }; }
function publicLobbyView() { return lobbySeats.map(function (s) { return s ? { name: s.name, icon: s.icon, ready: s.ready } : null; }); }
function broadcastLobby() {
  const view = publicLobbyView(); renderLobby(view, 0, true);
  for (let i = 1; i < 4; i++) sendJson(peerChannels[i], { t: 'lobby', seats: view, you: i });
}
function openHostLobby(profile) {
  peerChannels = [null, null, null, null]; lobbySeats = [{ name: profile.name, icon: profile.icon, ready: true }, null, null, null];
  hostState = null; showScreen('lobby'); broadcastLobby();
}
function nextFreeSeat() { for (let i = 1; i < 4; i++) if (!lobbySeats[i] && !peerChannels[i]) return i; return -1; }
function handleChannelClosed(seat) {
  peerChannels[seat] = null;
  if (hostState) hostState.players[seat].isBot = true; else { lobbySeats[seat] = null; broadcastLobby(); }
}
function receiveClientMessage(seat, raw) {
  const msg = parseIncomingJson(raw); if (!msg) return;
  if (msg.t === 'hello') { lobbySeats[seat] = { name: cleanName(msg.name), icon: cleanIcon(msg.icon), ready: false }; getEl('lobby_status').textContent = ''; broadcastLobby(); }
  else if (msg.t === 'ready' && lobbySeats[seat]) { lobbySeats[seat].ready = msg.v === true; broadcastLobby(); }
  else if (msg.t === 'throw' || msg.t === 'draw') receiveIntentFromPlayer(seat, msg);
}
async function createInviteForNextSeat() {
  const seat = nextFreeSeat(); if (seat < 0) { getEl('lobby_status').textContent = 'Room is full'; return; }
  const h = await createHostOffer();
  pendingInvite = { seat: seat, pc: h.pc };
  getEl('invite_offer').value = h.code; getEl('invite_answer').value = '';
  h.ch.onopen = function () { peerChannels[seat] = h.ch; };
  h.ch.onmessage = function (ev) { receiveClientMessage(seat, ev.data); };
  h.ch.onclose = function () { handleChannelClosed(seat); };
}
async function submitInviteAnswer() {
  if (!pendingInvite) return;
  try { await finishHostHandshake(pendingInvite.pc, getEl('invite_answer').value); getEl('lobby_status').textContent = 'Connecting...'; }
  catch (e) { getEl('lobby_status').textContent = 'Invalid answer code'; }
}
function buildSeatsFromLobby() {
  return lobbySeats.map(function (s, i) { return s ? { name: s.name, icon: s.icon, isBot: false } : createBotSeat(i); });
}
function startGameFromLobby(seconds) { startHostGame(buildSeatsFromLobby(), seconds); }
