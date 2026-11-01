let clientPc = null, hostChannel = null;
function sanitizeEvent(rawEvent) {
  return { seq: Number(rawEvent.seq) || 0, playerId: clampIndex(rawEvent.playerId, 4), element: clampIndex(rawEvent.element, ELEMENT_COUNT), gain: Number(rawEvent.gain) || 0,
    bonus: Number(rawEvent.bonus) || 0, bonusTo: clampIndex(rawEvent.bonusTo, 4), weakness: rawEvent.weakness === true, boost: rawEvent.boost === true,
    stack: Math.min(Math.max(1, Number(rawEvent.stack) || 1), ADVANTAGE_STACK_MAX), wild: rawEvent.wild === true };
}
function sanitizeSnapshot(snapshot) {
  snapshot.players = (Array.isArray(snapshot.players) ? snapshot.players : []).slice(0, 4).map(function (playerView) {
    return { name: cleanName(playerView.name), icon: cleanIcon(playerView.icon), points: Number(playerView.points) || 0, used: Array.isArray(playerView.used) ? playerView.used.map(Number) : null };
  });
  snapshot.hand = (Array.isArray(snapshot.hand) ? snapshot.hand : []).slice(0, 40).map(function (card) { return { id: Number(card.id), number: clampIndex(card.number, CARD_NUMBER_MAX + 1), element: clampIndex(card.element, ELEMENT_COUNT) }; });
  snapshot.left = Number(snapshot.left) || 0; snapshot.myPlayerId = clampIndex(snapshot.myPlayerId, 4);
  snapshot.startsInMs = Math.max(0, Number(snapshot.startsInMs) || 0); snapshot.event = snapshot.event ? sanitizeEvent(snapshot.event) : null;
  if (snapshot.last) snapshot.last = { number: clampIndex(snapshot.last.number, CARD_NUMBER_MAX + 1), element: clampIndex(snapshot.last.element, ELEMENT_COUNT), owner: clampIndex(snapshot.last.owner, 4) };
  return snapshot;
}
function sanitizeLobbyView(seats) {
  return seats.slice(0, 4).map(function (seat) { return seat ? { name: cleanName(seat.name), icon: cleanIcon(seat.icon), ready: seat.ready === true, bot: seat.bot === true } : null; });
}
function resetClientForLobby() {
  lastSeenEventSeq = 0; clientReady = false; getEl('btn_ready').textContent = 'Ready'; showScreen('lobby');
}
function receiveHostMessage(raw) {
  const msg = parseIncomingJson(raw); if (!msg) return;
  if (msg.type === 'lobby' && Array.isArray(msg.seats)) { if (msg.back === true) resetClientForLobby(); renderLobby(sanitizeLobbyView(msg.seats), clampIndex(msg.you, 4), false); }
  else if (msg.type === 'snap' && msg.snapshot) renderSnapshot(sanitizeSnapshot(msg.snapshot));
  else if (msg.type === 'closed') leaveToMenuWithNotice('The host closed the room');
  else if (msg.type === 'telegraph') showTelegraphCue(clampIndex(msg.playerId, 4));
}
function resetJoinForm() {
  ['join_offer', 'join_answer'].forEach(function (id) { getEl(id).value = ''; });
  getEl('join_status').textContent = ''; clientReady = false; getEl('btn_ready').textContent = 'Ready';
}
function leaveToMenuWithNotice(text) {
  sessionMode = 'menu'; hostChannel = null; sendIntentToHost = function () {};
  cancelCountdown(); resetJoinForm(); showScreen('menu'); showNotice(text);
}
function leaveClientRoom() {
  const channel = hostChannel, peerConnection = clientPc;
  sessionMode = 'menu'; hostChannel = null; sendIntentToHost = function () {};
  if (channel) sendJson(channel, { type: 'leave' });
  setTimeout(function () { if (channel) channel.close(); if (peerConnection) peerConnection.close(); }, 150);
  resetJoinForm(); showScreen('menu');
}
function initHostChannel(channel) {
  hostChannel = channel; sessionMode = 'client';
  sendIntentToHost = function (intent) { sendJson(channel, intent); };
  sendJson(channel, { type: 'hello', name: playerProfile.name, icon: playerProfile.icon });
  showScreen('lobby');
}
function onHostChannelReady(channel) {
  channel.onmessage = function (messageEvent) { receiveHostMessage(messageEvent.data); };
  channel.onclose = function () { if (sessionMode === 'client') leaveToMenuWithNotice('Disconnected from the host'); };
  channel.onopen = function () { initHostChannel(channel); };
  if (channel.readyState === 'open') initHostChannel(channel);
}
async function makeAnswerForHostCode() {
  const status = getEl('join_status'); status.textContent = 'Working...';
  try {
    const answerResult = await acceptOfferAndCreateAnswer(getEl('join_offer').value, onHostChannelReady);
    clientPc = answerResult.peerConnection; getEl('join_answer').value = answerResult.code; status.textContent = 'Send this answer code to the host.';
  } catch (error) { status.textContent = 'Invalid host code'; }
}
let clientReady = false;
function toggleReadyState() {
  clientReady = !clientReady; getEl('btn_ready').textContent = clientReady ? 'Not Ready' : 'Ready';
  sendIntentToHost({ type: 'ready', isReady: clientReady });
}
