let clientPc = null, hostChannel = null;
function sanitizeEvent(ev) {
  return { seq: Number(ev.seq) || 0, pid: clampIndex(ev.pid, 4), e: clampIndex(ev.e, ELEMENT_COUNT), gain: Number(ev.gain) || 0,
    bonus: Number(ev.bonus) || 0, bonusTo: clampIndex(ev.bonusTo, 4), weakness: ev.weakness === true, boost: ev.boost === true,
    stack: Math.min(Math.max(1, Number(ev.stack) || 1), ADVANTAGE_STACK_MAX), wild: ev.wild === true };
}
function sanitizeSnapshot(s) {
  s.players = (Array.isArray(s.players) ? s.players : []).slice(0, 4).map(function (p) {
    return { name: cleanName(p.name), icon: cleanIcon(p.icon), points: Number(p.points) || 0, used: Array.isArray(p.used) ? p.used.map(Number) : null };
  });
  s.hand = (Array.isArray(s.hand) ? s.hand : []).slice(0, 40).map(function (c) { return { id: Number(c.id), n: clampIndex(c.n, CARD_NUMBER_MAX + 1), e: clampIndex(c.e, ELEMENT_COUNT) }; });
  s.left = Number(s.left) || 0; s.me = clampIndex(s.me, 4);
  s.startsInMs = Math.max(0, Number(s.startsInMs) || 0); s.event = s.event ? sanitizeEvent(s.event) : null;
  if (s.last) s.last = { n: clampIndex(s.last.n, CARD_NUMBER_MAX + 1), e: clampIndex(s.last.e, ELEMENT_COUNT), owner: clampIndex(s.last.owner, 4) };
  return s;
}
function sanitizeLobbyView(seats) {
  return seats.slice(0, 4).map(function (s) { return s ? { name: cleanName(s.name), icon: cleanIcon(s.icon), ready: s.ready === true, bot: s.bot === true } : null; });
}
function resetClientForLobby() {
  lastSeenEventSeq = 0; clientReady = false; getEl('btn_ready').textContent = 'Ready'; showScreen('lobby');
}
function receiveHostMessage(raw) {
  const msg = parseIncomingJson(raw); if (!msg) return;
  if (msg.t === 'lobby' && Array.isArray(msg.seats)) { if (msg.back === true) resetClientForLobby(); renderLobby(sanitizeLobbyView(msg.seats), clampIndex(msg.you, 4), false); }
  else if (msg.t === 'snap' && msg.s) renderSnapshot(sanitizeSnapshot(msg.s));
  else if (msg.t === 'closed') leaveToMenuWithNotice('The host closed the room');
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
  const ch = hostChannel, pc = clientPc;
  sessionMode = 'menu'; hostChannel = null; sendIntentToHost = function () {};
  if (ch) sendJson(ch, { t: 'leave' });
  setTimeout(function () { if (ch) ch.close(); if (pc) pc.close(); }, 150);
  resetJoinForm(); showScreen('menu');
}
function initHostChannel(ch) {
  hostChannel = ch; sessionMode = 'client';
  sendIntentToHost = function (intent) { sendJson(ch, intent); };
  sendJson(ch, { t: 'hello', name: playerProfile.name, icon: playerProfile.icon });
  showScreen('lobby');
}
function onHostChannelReady(ch) {
  ch.onmessage = function (ev) { receiveHostMessage(ev.data); };
  ch.onclose = function () { if (sessionMode === 'client') leaveToMenuWithNotice('Disconnected from the host'); };
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
