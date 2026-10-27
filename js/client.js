let clientPc = null, hostChannel = null;
function sanitizeSnapshot(s) {
  s.players = (Array.isArray(s.players) ? s.players : []).slice(0, 4).map(function (p) {
    return { name: cleanName(p.name), icon: cleanIcon(p.icon), points: Number(p.points) || 0, used: Array.isArray(p.used) ? p.used.map(Number) : null };
  });
  s.hand = (Array.isArray(s.hand) ? s.hand : []).slice(0, 40).map(function (c) { return { id: Number(c.id), n: clampIndex(c.n, 10), e: clampIndex(c.e, ELEMENT_COUNT) }; });
  s.left = Number(s.left) || 0; s.me = clampIndex(s.me, 4);
  if (s.last) s.last = { n: clampIndex(s.last.n, 10), e: clampIndex(s.last.e, ELEMENT_COUNT), owner: clampIndex(s.last.owner, 4) };
  return s;
}
function sanitizeLobbyView(seats) {
  return seats.slice(0, 4).map(function (s) { return s ? { name: cleanName(s.name), icon: cleanIcon(s.icon), ready: s.ready === true } : null; });
}
function receiveHostMessage(raw) {
  const msg = parseIncomingJson(raw); if (!msg) return;
  if (msg.t === 'lobby' && Array.isArray(msg.seats)) renderLobby(sanitizeLobbyView(msg.seats), clampIndex(msg.you, 4), false);
  else if (msg.t === 'snap' && msg.s) renderSnapshot(sanitizeSnapshot(msg.s));
}
function goBackToMenuAfterDisconnect() { location.reload(); }
function initHostChannel(ch) {
  hostChannel = ch;
  sendIntentToHost = function (intent) { sendJson(ch, intent); };
  sendJson(ch, { t: 'hello', name: playerProfile.name, icon: playerProfile.icon });
  showScreen('lobby');
}
function onHostChannelReady(ch) {
  ch.onmessage = function (ev) { receiveHostMessage(ev.data); };
  ch.onclose = goBackToMenuAfterDisconnect;
  ch.onopen = function () { initHostChannel(ch); };
  if (ch.readyState === 'open') initHostChannel(ch);
}
async function makeAnswerForHostCode() {
  const status = getEl('join_status'); status.textContent = 'Working...';
  try {
    const r = await acceptOfferAndCreateAnswer(getEl('join_offer').value, onHostChannelReady);
    clientPc = r.pc; getEl('join_answer').value = r.code; status.textContent = 'Send this answer code to the host.';
  } catch (e) { status.textContent = 'Invalid host code'; }
}
let clientReady = false;
function toggleReadyState() {
  clientReady = !clientReady; getEl('btn_ready').textContent = clientReady ? 'Not Ready' : 'Ready';
  sendIntentToHost({ t: 'ready', v: clientReady });
}
