let hostState = null, hostTickId = 0, lastPushAt = 0, throwQueue = [], flushScheduled = false;
let peerChannels = [null, null, null, null], playerChannels = [], playerIdOfSeat = {};
let lobbySeats = [null, null, null, null], pendingInvite = null, peerPcs = [null, null, null, null], inviteToken = 0;
function isChannelOpen(channel) { return !!channel && channel.readyState === 'open'; }
let pushScheduled = false;
/* Full-state snapshots: if a client's send buffer is backed up, skip this one (the next replaces it) instead of queuing a burst. */
function sendSnapshotTo(channel, snap) {
  if (!isChannelOpen(channel)) return;
  if (channel.bufferedAmount > MAX_BUFFERED_BYTES && !snap.over) return;
  channel.send(JSON.stringify({ type: 'snap', snapshot: snap }));
}
function pushSnapshots() {
  lastPushAt = Date.now(); pushScheduled = false;
  hostState.players.forEach(function (player, playerId) {
    const snap = makeSnapshotFor(hostState, playerId);
    if (playerId === 0) renderSnapshot(snap); else sendSnapshotTo(playerChannels[playerId], snap);
  });
}
function requestSnapshotPush() {
  if (pushScheduled) return;
  pushScheduled = true;
  setTimeout(function () { if (pushScheduled && hostState) pushSnapshots(); }, SNAPSHOT_COALESCE_MS);
}
function flushThrowQueue() {
  flushScheduled = false;
  const batch = sortSimultaneousThrows(hostState, throwQueue); throwQueue = [];
  batch.forEach(function (queuedThrow) { if (applyThrow(hostState, queuedThrow.playerId, queuedThrow.cardId, queuedThrow.arrivalMs)) pushSnapshots(); });
}
function enqueueThrow(playerId, cardId, arrivalMs) {
  throwQueue.push({ playerId: playerId, cardId: cardId, arrivalMs: arrivalMs });
  if (!flushScheduled) { flushScheduled = true; setTimeout(flushThrowQueue, TIE_WINDOW_MS); }
}
function drawForPlayer(playerId) {
  if (!applyDraw(hostState, playerId, Date.now())) return;
  if (hostState.players[playerId].isBot) requestSnapshotPush(); else pushSnapshots(); /* humans see their draw at once, bot draws are merged */
}
function receiveIntentFromPlayer(playerId, intent) {
  if (!hostState || hostState.over) return;
  if (intent.type === 'throw' && Number.isInteger(intent.id)) enqueueThrow(playerId, intent.id, Date.now());
  else if (intent.type === 'draw') drawForPlayer(playerId);
  else if (intent.type === 'windup' && HUMAN_WINDUP_TELEGRAPH) announceTelegraph(playerId);
}
function finishHostGame() { hostState.over = true; clearInterval(hostTickId); pushSnapshots(); }
const botHandlers = { throwCard: enqueueThrow, drawCard: drawForPlayer, telegraph: announceTelegraph };
function runHostTick() {
  const now = Date.now();
  stepBots(hostState, now, botHandlers);
  if (now >= hostState.endsAt) finishHostGame();
  else if (now - lastPushAt >= 1000) pushSnapshots();
}
function startHostGame(seats, seconds) {
  hostState = createGameState(seats, seconds); lastSeenEventSeq = 0; throwQueue = []; telegraphTimes = {};
  sendIntentToHost = function (intent) { receiveIntentFromPlayer(0, intent); };
  pushSnapshots(); hostTickId = setInterval(runHostTick, 100);
}
function listUsedNames() { return lobbySeats.filter(Boolean).map(function (seat) { return seat.name; }); }
function startSinglePlayerGame(profile, seconds, botProfiles) {
  sessionMode = 'single'; playerChannels = []; playerIdOfSeat = {};
  const seats = [{ name: profile.name, icon: profile.icon, isBot: false }];
  botProfiles.forEach(function (botProfile) { seats.push({ name: botProfile.name, icon: cleanIcon(botProfile.icon), isBot: true, profile: botProfile }); });
  startHostGame(seats, seconds);
}
function publicLobbyView() {
  return lobbySeats.map(function (seat) { return seat ? { name: seat.name, icon: seat.icon, ready: seat.ready, bot: !!seat.bot } : null; });
}
function broadcastLobby(isBack) {
  const view = publicLobbyView(); renderLobby(view, 0, true);
  for (let seatIndex = 1; seatIndex < 4; seatIndex++) sendJson(peerChannels[seatIndex], { type: 'lobby', seats: view, you: seatIndex, back: isBack === true });
}
/* Closes and forgets the connection that belongs to one seat. */
function releaseSeatConnection(seat) {
  const peerConnection = peerPcs[seat], channel = peerChannels[seat]; peerPcs[seat] = null; peerChannels[seat] = null;
  if (channel) channel.close();
  if (peerConnection) peerConnection.close();
}
function releaseAllConnections() { for (let seatIndex = 1; seatIndex < 4; seatIndex++) releaseSeatConnection(seatIndex); pendingInvite = null; inviteToken++; }
function openHostLobby(profile) {
  sessionMode = 'host'; hostState = null; lastSeenEventSeq = 0; releaseAllConnections();
  lobbySeats = [{ name: profile.name, icon: profile.icon, ready: true }, null, null, null];
  getEl('invite_offer').value = ''; getEl('invite_answer').value = ''; getEl('lobby_status').textContent = '';
  showScreen('lobby'); broadcastLobby(); refreshInvite();
}
function nextFreeSeat() { for (let seatIndex = 1; seatIndex < 4; seatIndex++) if (!lobbySeats[seatIndex] && !peerChannels[seatIndex]) return seatIndex; return -1; }
function addBotToSeat(seat) {
  if (seat < 1 || seat > 3 || lobbySeats[seat]) return;
  if (pendingInvite && pendingInvite.seat === seat) { releaseSeatConnection(seat); pendingInvite = null; }
  else if (peerChannels[seat]) return; /* a real player is connecting there */
  const bot = createRandomBotSeat(listUsedNames());
  lobbySeats[seat] = { name: bot.name, icon: bot.icon, ready: true, bot: true, profile: bot.profile }; broadcastLobby(); ensureInvite();
}
function removeSeat(seat) {
  if (seat < 1 || seat > 3 || !lobbySeats[seat]) return;
  lobbySeats[seat] = null; releaseSeatConnection(seat); broadcastLobby(); ensureInvite();
}
function handleChannelClosed(seat, channel, deliberate) {
  if (peerChannels[seat] !== channel) return;
  const name = lobbySeats[seat] ? lobbySeats[seat].name : 'A player', verb = deliberate ? ' left the room' : ' disconnected';
  if (pendingInvite && pendingInvite.seat === seat) pendingInvite = null;
  releaseSeatConnection(seat);
  if (hostState) {
    if (playerIdOfSeat[seat] !== undefined) hostState.players[playerIdOfSeat[seat]].isBot = true;
    showNotice(name + verb + ', a bot took the seat');
  } else { lobbySeats[seat] = null; broadcastLobby(); showNotice(name + verb); ensureInvite(); }
}
function receiveClientMessage(seat, raw, channel) {
  const msg = parseIncomingJson(raw); if (!msg || peerChannels[seat] !== channel) return;
  if (msg.type === 'leave') { handleChannelClosed(seat, channel, true); channel.close(); }
  else if (msg.type === 'hello' && !hostState) { lobbySeats[seat] = { name: cleanName(msg.name), icon: cleanIcon(msg.icon), ready: false }; getEl('lobby_status').textContent = ''; broadcastLobby(); }
  else if (msg.type === 'ready' && lobbySeats[seat] && !hostState) { lobbySeats[seat].ready = msg.isReady === true; broadcastLobby(); }
  else if (hostState && (msg.type === 'throw' || msg.type === 'draw' || msg.type === 'windup') && playerIdOfSeat[seat] !== undefined) receiveIntentFromPlayer(playerIdOfSeat[seat], msg);
}
function ensureInvite() { if (sessionMode === 'host' && !hostState && !pendingInvite) refreshInvite(); }
/* Keeps exactly one UNANSWERED offer alive. Answered offers are never reused and never closed here, so earlier players stay connected. */
async function refreshInvite() {
  if (pendingInvite) { const old = pendingInvite; pendingInvite = null; releaseSeatConnection(old.seat); }
  const seat = nextFreeSeat(), token = ++inviteToken;
  if (seat < 0) { getEl('invite_offer').value = ''; getEl('lobby_status').textContent = 'Room is full'; return; }
  getEl('invite_offer').value = 'Preparing code...'; getEl('invite_answer').value = '';
  const offer = await createHostOffer();
  if (token !== inviteToken || sessionMode !== 'host' || hostState || peerChannels[seat] || lobbySeats[seat]) { offer.peerConnection.close(); return; }
  commitInvite(seat, offer);
}
function commitInvite(seat, offer) {
  pendingInvite = { seat: seat, peerConnection: offer.peerConnection, channel: offer.channel, answered: false }; peerChannels[seat] = offer.channel; peerPcs[seat] = offer.peerConnection;
  offer.channel.onmessage = function (messageEvent) { receiveClientMessage(seat, messageEvent.data, offer.channel); };
  offer.channel.onclose = function () { handleChannelClosed(seat, offer.channel); };
  getEl('invite_offer').value = offer.code; getEl('lobby_status').textContent = 'Waiting for the next player...';
}
/* A seat whose handshake never finished (wrong or stale code) is freed after 20 s. */
function releaseStalledSeat(seat, channel) {
  if (peerChannels[seat] !== channel || channel.readyState === 'open') return;
  releaseSeatConnection(seat); showNotice('A join attempt timed out'); ensureInvite();
}
async function submitInviteAnswer() {
  const inv = pendingInvite; if (!inv || inv.answered) return;
  inv.answered = true;
  try {
    await finishHostHandshake(inv.peerConnection, getEl('invite_answer').value);
    if (pendingInvite === inv) pendingInvite = null; /* this offer is used up */
    getEl('lobby_status').textContent = 'Connecting...'; getEl('invite_answer').value = '';
    setTimeout(function () { releaseStalledSeat(inv.seat, inv.channel); }, 20000);
    refreshInvite(); /* fresh code for the next device */
  } catch (error) { inv.answered = false; getEl('lobby_status').textContent = 'Invalid answer code'; }
}
function startGameFromLobby(seconds) {
  if (!isLobbyStartable(publicLobbyView())) return;
  if (pendingInvite) { releaseSeatConnection(pendingInvite.seat); pendingInvite = null; inviteToken++; }
  const seats = []; playerChannels = []; playerIdOfSeat = {};
  lobbySeats.forEach(function (seat, seatIndex) {
    if (!seat) return;
    playerIdOfSeat[seatIndex] = seats.length; playerChannels.push(seatIndex === 0 ? null : peerChannels[seatIndex]);
    seats.push({ name: seat.name, icon: seat.icon, isBot: !!seat.bot, profile: seat.profile || null });
  });
  startHostGame(seats, seconds);
}
function returnHostToLobby() {
  hostState = null; throwQueue = []; lastSeenEventSeq = 0;
  for (let seatIndex = 1; seatIndex < 4; seatIndex++) {
    const seat = lobbySeats[seatIndex];
    if (!seat || seat.bot) continue;
    if (isChannelOpen(peerChannels[seatIndex])) seat.ready = false; else { lobbySeats[seatIndex] = null; releaseSeatConnection(seatIndex); }
  }
  showScreen('lobby'); broadcastLobby(true); ensureInvite();
}
function returnToMenuKeepingProfile() { hostState = null; showScreen('menu'); }
function closeHostRoom() {
  for (let seatIndex = 1; seatIndex < 4; seatIndex++) if (isChannelOpen(peerChannels[seatIndex])) sendJson(peerChannels[seatIndex], { type: 'closed' });
  releaseAllConnections(); lobbySeats = [null, null, null, null]; hostState = null; sessionMode = 'menu'; showScreen('menu');
}
let pausedAt = 0;
function pauseHostGame() {
  if (sessionMode !== 'single' || !hostState || hostState.over || hostState.paused || Date.now() < hostState.startAt) return;
  hostState.paused = true; pausedAt = Date.now(); clearInterval(hostTickId);
  getEl('pause_box').hidden = false; switchMusicToTrack(MENU_TRACK_INDEX);
}
function resumeHostGame() {
  if (!hostState || !hostState.paused) return;
  shiftMatchClock(hostState, Date.now() - pausedAt); hostState.paused = false;
  getEl('pause_box').hidden = true; hostTickId = setInterval(runHostTick, 100);
  switchMusicToElement(hostState.last ? hostState.last.element : pickRandomInt(ELEMENT_COUNT));
  pushSnapshots();
}
function quitPausedGame() { clearInterval(hostTickId); getEl('pause_box').hidden = true; returnToMenuKeepingProfile(); }
let telegraphTimes = {};
/* Telegraph: tells every human except the actor that this player is about to throw. */
function announceTelegraph(playerId) {
  const nowMs = Date.now();
  if (!hostState || nowMs - (telegraphTimes[playerId] || 0) < TELEGRAPH_MIN_GAP_MS) return;
  telegraphTimes[playerId] = nowMs;
  hostState.players.forEach(function (listener, listenerId) {
    if (listenerId === playerId || listener.isBot) return;
    if (listenerId === 0) showTelegraphCue(playerId);
    else sendJson(playerChannels[listenerId], { type: 'telegraph', playerId: playerId });
  });
}
