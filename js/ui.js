let sendIntentToHost = function () {};
let lastSeenEventSeq = 0, dragState = null;
function getEl(id) { return document.getElementById(id); }
function showScreen(id) { document.querySelectorAll('.screen').forEach(function (s) { s.classList.toggle('on', s.id === id); }); }
function isScreenShown(id) { return getEl(id).classList.contains('on'); }
function renderIconPreview(icon) { getEl('icon_preview').innerHTML = buildFaceSvg(icon); }
function formatClock(seconds) { return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'); }
function createFaceElement(icon) { const w = document.createElement('span'); w.className = 'face_wrap'; w.innerHTML = buildFaceSvg(cleanIcon(icon)); return w; }
function createTextElement(tag, text, cls) { const el = document.createElement(tag); el.textContent = text; if (cls) el.className = cls; return el; }
function createCardElement(card) {
  const el = document.createElement('div');
  el.className = 'card e' + card.e; el.dataset.id = card.id;
  el.appendChild(createTextElement('span', card.n, 'num'));
  return el;
}
function removeCardsNotInHand(box, hand) {
  const keep = {}; hand.forEach(function (c) { keep[c.id] = true; });
  Array.from(box.children).forEach(function (ch) { if (!keep[ch.dataset.id]) box.removeChild(ch); });
}
function addMissingCards(box, hand) {
  const have = {}; Array.from(box.children).forEach(function (ch) { have[ch.dataset.id] = true; });
  hand.forEach(function (c) { if (!have[c.id]) box.appendChild(createCardElement(c)); });
}
function syncHandCards(hand) { const box = getEl('hand'); removeCardsNotInHand(box, hand); addMissingCards(box, hand); }
function renderPileCard(last) {
  const pile = getEl('pile'); pile.textContent = '';
  if (!last) return;
  const card = createCardElement({ id: 0, n: last.n, e: last.e }); card.classList.add('big'); pile.appendChild(card);
}
function renderScores(players, me) {
  const box = getEl('scores'); box.textContent = '';
  players.forEach(function (p, i) {
    const item = document.createElement('div'); item.className = 'score' + (i === me ? ' me' : '');
    item.appendChild(createFaceElement(p.icon));
    item.appendChild(createTextElement('span', cleanName(p.name) + ' ' + Number(p.points).toFixed(1)));
    box.appendChild(item);
  });
}
function spawnFloatText(text, element) {
  const el = createTextElement('div', text, 'float e' + element);
  el.addEventListener('animationend', function () { el.remove(); });
  getEl('fx').appendChild(el);
}
function spawnBurstDots(element) {
  for (let i = 0; i < 8; i++) {
    const dot = document.createElement('div'); dot.className = 'dot e' + element;
    const angle = (i / 8) * 6.283;
    dot.style.setProperty('--dx', Math.round(Math.cos(angle) * 60) + 'px');
    dot.style.setProperty('--dy', Math.round(Math.sin(angle) * 60) + 'px');
    dot.addEventListener('animationend', function () { dot.remove(); });
    getEl('fx').appendChild(dot);
  }
}
function showEventEffects(event, players) {
  playElementSfx(event.e); switchMusicToElement(event.e);
  if (event.weakness) playWeaknessSfx();
  spawnFloatText('+' + event.gain, event.e); spawnBurstDots(event.e);
  if (event.bonus > 0 && players[event.bonusTo]) spawnFloatText(cleanName(players[event.bonusTo].name) + ' +' + event.bonus, event.e);
}
function handleNewEvent(snap) {
  if (!snap.event || snap.event.seq === lastSeenEventSeq) return;
  lastSeenEventSeq = snap.event.seq; showEventEffects(snap.event, snap.players);
}
function renderGameScreen(snap) {
  getEl('timer').textContent = formatClock(snap.left);
  renderScores(snap.players, snap.me); renderPileCard(snap.last); syncHandCards(snap.hand); handleNewEvent(snap);
}
function createUsageChips(used) {
  const frag = document.createDocumentFragment();
  ['red', 'green', 'blue', 'brown'].forEach(function (name, e) { frag.appendChild(createTextElement('span', name + ' ' + used[e], 'chip e' + e)); });
  return frag;
}
function renderResults(snap) {
  const list = getEl('rank_list'); list.textContent = '';
  snap.players.map(function (p, i) { return { p: p, i: i }; })
    .sort(function (a, b) { return b.p.points - a.p.points; })
    .forEach(function (row, rank) {
      const li = document.createElement('li');
      li.appendChild(createTextElement('span', '#' + (rank + 1)));
      li.appendChild(createFaceElement(row.p.icon));
      li.appendChild(createTextElement('span', cleanName(row.p.name) + ' ' + Number(row.p.points).toFixed(1)));
      if (row.p.used) li.appendChild(createUsageChips(row.p.used));
      list.appendChild(li);
    });
}
function renderSnapshot(snap) {
  if (snap.over) { renderResults(snap); showScreen('results'); return; }
  if (!isScreenShown('game')) showScreen('game');
  renderGameScreen(snap);
}
function renderLobby(view, you, isHost) {
  const list = getEl('lobby_seats'); list.textContent = '';
  view.forEach(function (s, i) {
    const li = document.createElement('li');
    if (!s) { li.className = 'empty'; li.textContent = 'Open seat'; }
    else {
      li.appendChild(createFaceElement(s.icon));
      li.appendChild(createTextElement('span', cleanName(s.name) + (i === 0 ? ' (host)' : '') + (i === you ? ' - you' : '')));
      if (i !== 0) li.appendChild(createTextElement('span', s.ready ? 'ready' : 'waiting', 'tag'));
    }
    list.appendChild(li);
  });
  getEl('btn_start').hidden = !isHost; getEl('invite_box').hidden = !isHost; getEl('btn_ready').hidden = isHost;
  if (isHost) getEl('btn_start').disabled = !view.every(function (s, i) { return i === 0 || !s || s.ready; });
}
function resetDraggedCard() { dragState.el.style.transform = ''; dragState.el.classList.remove('drag'); dragState = null; }
function markCardSentTemporarily(el) { el.classList.add('sent'); setTimeout(function () { el.classList.remove('sent'); }, 600); }
function onHandPointerDown(e) {
  const card = e.target.closest('.card'); if (!card || dragState) return;
  dragState = { el: card, x: e.clientX, y: e.clientY, id: Number(card.dataset.id), pid: e.pointerId };
  card.setPointerCapture(e.pointerId); card.classList.add('drag');
}
function onHandPointerMove(e) {
  if (!dragState || e.pointerId !== dragState.pid) return;
  dragState.el.style.transform = 'translate(' + (e.clientX - dragState.x) + 'px,' + Math.min(0, e.clientY - dragState.y) + 'px)';
}
function onHandPointerUp(e) {
  if (!dragState || e.pointerId !== dragState.pid) return;
  const thrown = e.clientY - dragState.y < -SWIPE_THROW_PX, id = dragState.id, el = dragState.el;
  resetDraggedCard();
  if (thrown) { markCardSentTemporarily(el); sendIntentToHost({ t: 'throw', id: id }); }
}
function onHandPointerCancel() { if (dragState) resetDraggedCard(); }
function attachHandGestures() {
  const hand = getEl('hand');
  hand.addEventListener('pointerdown', onHandPointerDown); hand.addEventListener('pointermove', onHandPointerMove);
  hand.addEventListener('pointerup', onHandPointerUp); hand.addEventListener('pointercancel', onHandPointerCancel);
}
