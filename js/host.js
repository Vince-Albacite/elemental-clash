let hostState = null, hostTickId = 0, lastPushAt = 0, throwQueue = [], flushScheduled = false;
let peerChannels = [null, null, null, null], playerChannels = [], pidOfSeat = {};
let lobbySeats = [null, null, null, null], pendingInvite = null, peerPcs = [null, null, null, null], inviteToken = 0;
function isChannelOpen(ch) { return !!ch && ch.readyState === 'open'; }
let pushScheduled = false;
/* Full-state snapshots: if a client's send buffer is backed up, skip this one (the next replaces it) instead of queuing a burst. */
function sendSnapshotTo(ch, snap) {
  if (!isChannelOpen(ch)) return;
  if (ch.bufferedAmount > MAX_BUFFERED_BYTES && !snap.over) return;
  ch.send(JSON.stringify({ t: 'snap', s: snap }));
}
function pushSnapshots() {
  lastPushAt = Date.now(); pushScheduled = false;
  hostState.players.forEach(function (p, pid) {
    const snap = makeSnapshotFor(hostState, pid);
    if (pid === 0) renderSnapshot(snap); else sendSnapshotTo(playerChannels[pid], snap);
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
  batch.forEach(function (q) { if (applyThrow(hostState, q.pid, q.cardId, q.t)) pushSnapshots(); });
}
function enqueueThrow(pid, cardId, arrivalMs) {
  throwQueue.push({ pid: pid, cardId: cardId, t: arrivalMs });
  if (!flushScheduled) { flushScheduled = true; setTimeout(flushThrowQueue, TIE_WINDOW_MS); }
}
function drawForPlayer(pid) {
  if (!applyDraw(hostState, pid, Date.now())) return;
  if (hostState.players[pid].isBot) requestSnapshotPush(); else pushSnapshots(); /* humans see their draw at once, bot draws are merged */
}
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
  hostState = createGameState(seats, seconds); lastSeenEventSeq = 0; throwQueue = [];
  sendIntentToHost = function (intent) { receiveIntentFromPlayer(0, intent); };
  pushSnapshots(); hostTickId = setInterval(runHostTick, 100);
}
function listUsedNames() { return lobbySeats.filter(Boolean).map(function (s) { return s.name; }); }
function startSinglePlayerGame(profile, seconds, botProfiles) {
  sessionMode = 'single'; playerChannels = []; pidOfSeat = {};
  const seats = [{ name: profile.name, icon: profile.icon, isBot: false }];
  botProfiles.forEach(function (p) { seats.push({ name: p.name, icon: cleanIcon(p.icon), isBot: true, profile: p }); });
  startHostGame(seats, seconds);
}
function publicLobbyView() {
  return lobbySeats.map(function (s) { return s ? { name: s.name, icon: s.icon, ready: s.ready, bot: !!s.bot } : null; });
}
function broadcastLobby(isBack) {
  const view = publicLobbyView(); renderLobby(view, 0, true);
  for (let i = 1; i < 4; i++) sendJson(peerChannels[i], { t: 'lobby', seats: view, you: i, back: isBack === true });
}
/* Closes and forgets the connection that belongs to one seat. */
function releaseSeatConnection(seat) {
  const pc = peerPcs[seat], ch = peerChannels[seat]; peerPcs[seat] = null; peerChannels[seat] = null;
  if (ch) ch.close();
  if (pc) pc.close();
}
function releaseAllConnections() { for (let i = 1; i < 4; i++) releaseSeatConnection(i); pendingInvite = null; inviteToken++; }
function openHostLobby(profile) {
  sessionMode = 'host'; hostState = null; lastSeenEventSeq = 0; releaseAllConnections();
  lobbySeats = [{ name: profile.name, icon: profile.icon, ready: true }, null, null, null];
  getEl('invite_offer').value = ''; getEl('invite_answer').value = ''; getEl('lobby_status').textContent = '';
  showScreen('lobby'); broadcastLobby(); refreshInvite();
}
function nextFreeSeat() { for (let i = 1; i < 4; i++) if (!lobbySeats[i] && !peerChannels[i]) return i; return -1; }
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
function handleChannelClosed(seat, ch, deliberate) {
  if (peerChannels[seat] !== ch) return;
  const name = lobbySeats[seat] ? lobbySeats[seat].name : 'A player', verb = deliberate ? ' left the room' : ' disconnected';
  if (pendingInvite && pendingInvite.seat === seat) pendingInvite = null;
  releaseSeatConnection(seat);
  if (hostState) {
    if (pidOfSeat[seat] !== undefined) hostState.players[pidOfSeat[seat]].isBot = true;
    showNotice(name + verb + ', a bot took the seat');
  } else { lobbySeats[seat] = null; broadcastLobby(); showNotice(name + verb); ensureInvite(); }
}
function receiveClientMessage(seat, raw, ch) {
  const msg = parseIncomingJson(raw); if (!msg || peerChannels[seat] !== ch) return;
  if (msg.t === 'leave') { handleChannelClosed(seat, ch, true); ch.close(); }
  else if (msg.t === 'hello' && !hostState) { lobbySeats[seat] = { name: cleanName(msg.name), icon: cleanIcon(msg.icon), ready: false }; getEl('lobby_status').textContent = ''; broadcastLobby(); }
  else if (msg.t === 'ready' && lobbySeats[seat] && !hostState) { lobbySeats[seat].ready = msg.v === true; broadcastLobby(); }
  else if (hostState && (msg.t === 'throw' || msg.t === 'draw') && pidOfSeat[seat] !== undefined) receiveIntentFromPlayer(pidOfSeat[seat], msg);
}
function ensureInvite() { if (sessionMode === 'host' && !hostState && !pendingInvite) refreshInvite(); }
/* Keeps exactly one UNANSWERED offer alive. Answered offers are never reused and never closed here, so earlier players stay connected. */
async function refreshInvite() {
  if (pendingInvite) { const old = pendingInvite; pendingInvite = null; releaseSeatConnection(old.seat); }
  const seat = nextFreeSeat(), token = ++inviteToken;
  if (seat < 0) { getEl('invite_offer').value = ''; getEl('lobby_status').textContent = 'Room is full'; return; }
  getEl('invite_offer').value = 'Preparing code...'; getEl('invite_answer').value = '';
  const h = await createHostOffer();
  if (token !== inviteToken || sessionMode !== 'host' || hostState || peerChannels[seat] || lobbySeats[seat]) { h.pc.close(); return; }
  commitInvite(seat, h);
}
function commitInvite(seat, h) {
  pendingInvite = { seat: seat, pc: h.pc, ch: h.ch, answered: false }; peerChannels[seat] = h.ch; peerPcs[seat] = h.pc;
  h.ch.onmessage = function (ev) { receiveClientMessage(seat, ev.data, h.ch); };
  h.ch.onclose = function () { handleChannelClosed(seat, h.ch); };
  getEl('invite_offer').value = h.code; getEl('lobby_status').textContent = 'Waiting for the next player...';
}
/* A seat whose handshake never finished (wrong or stale code) is freed after 20 s. */
function releaseStalledSeat(seat, ch) {
  if (peerChannels[seat] !== ch || ch.readyState === 'open') return;
  releaseSeatConnection(seat); showNotice('A join attempt timed out'); ensureInvite();
}
async function submitInviteAnswer() {
  const inv = pendingInvite; if (!inv || inv.answered) return;
  inv.answered = true;
  try {
    await finishHostHandshake(inv.pc, getEl('invite_answer').value);
    if (pendingInvite === inv) pendingInvite = null; /* this offer is used up */
    getEl('lobby_status').textContent = 'Connecting...'; getEl('invite_answer').value = '';
    setTimeout(function () { releaseStalledSeat(inv.seat, inv.ch); }, 20000);
    refreshInvite(); /* fresh code for the next device */
  } catch (e) { inv.answered = false; getEl('lobby_status').textContent = 'Invalid answer code'; }
}
function startGameFromLobby(seconds) {
  if (!isLobbyStartable(publicLobbyView())) return;
  if (pendingInvite) { releaseSeatConnection(pendingInvite.seat); pendingInvite = null; inviteToken++; }
  const seats = []; playerChannels = []; pidOfSeat = {};
  lobbySeats.forEach(function (s, i) {
    if (!s) return;
    pidOfSeat[i] = seats.length; playerChannels.push(i === 0 ? null : peerChannels[i]);
    seats.push({ name: s.name, icon: s.icon, isBot: !!s.bot, profile: s.profile || null });
  });
  startHostGame(seats, seconds);
}
function returnHostToLobby() {
  hostState = null; throwQueue = []; lastSeenEventSeq = 0;
  for (let i = 1; i < 4; i++) {
    const s = lobbySeats[i];
    if (!s || s.bot) continue;
    if (isChannelOpen(peerChannels[i])) s.ready = false; else { lobbySeats[i] = null; releaseSeatConnection(i); }
  }
  showScreen('lobby'); broadcastLobby(true); ensureInvite();
}
function returnToMenuKeepingProfile() { hostState = null; showScreen('menu'); }
function closeHostRoom() {
  for (let i = 1; i < 4; i++) if (isChannelOpen(peerChannels[i])) sendJson(peerChannels[i], { t: 'closed' });
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
  switchMusicToElement(hostState.last ? hostState.last.e : pickRandomInt(ELEMENT_COUNT));
  pushSnapshots();
}
function quitPausedGame() { clearInterval(hostTickId); getEl('pause_box').hidden = true; returnToMenuKeepingProfile(); }
