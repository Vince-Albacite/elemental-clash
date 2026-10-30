let sendIntentToHost = function () {};
let lastSeenEventSeq = 0, dragState = null, sessionMode = 'menu', lastEnvElement = -2, countdownTimers = [], confirmCallback = null, noticeTimerId = 0, deckReadyAt = 0, scoreSignature = '', litTimers = {}, stackOfCard = {}, latestHand = [], pileKey = '', hintTimerId = 0, lastHandCount = -1, lastHeavyEffectAt = 0;
function getEl(id) { return document.getElementById(id); }
function setEnvironmentElement(element) {
  if (element === lastEnvElement) return;
  lastEnvElement = element;
  document.querySelectorAll('.env_layer').forEach(function (layer, i) { layer.classList.toggle('on', i === element); });
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.toggle('on', s.id === id); });
  if (id !== 'game' && id !== 'results') setEnvironmentElement(-1);
  if (id !== 'game') switchMusicToTrack(MENU_TRACK_INDEX);
  if (id === 'game') enableMatchGuard(); else disableMatchGuard();
}
function isScreenShown(id) { return getEl(id).classList.contains('on'); }
function renderIconPreview(icon) { getEl('icon_preview').innerHTML = buildFaceSvg(icon); }
function formatClock(seconds) { return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'); }
function createFaceElement(icon) { const w = document.createElement('span'); w.className = 'face_wrap'; w.innerHTML = buildFaceSvg(cleanIcon(icon)); return w; }
function createTextElement(tag, text, cls) { const el = document.createElement(tag); el.textContent = text; if (cls) el.className = cls; return el; }
function createCardElement(card) {
  const el = document.createElement('div');
  el.className = 'card e' + card.e; el.dataset.id = card.id; el.dataset.n = card.n; el.dataset.e = card.e;
  el.appendChild(createTextElement('span', card.n, 'num'));
  return el;
}
function countCardsInStack(which) { return Object.keys(stackOfCard).filter(function (id) { return stackOfCard[id] === which; }).length; }
function swapStackAssignments() {
  Object.keys(stackOfCard).forEach(function (id) { stackOfCard[id] = stackOfCard[id] === 'front' ? 'back' : 'front'; });
}
/* New cards go to the front row until it holds HAND_STACK_SIZE cards, then to the back row. An empty front row pulls the back row forward. */
function assignCardStacks(hand) {
  const present = {}; hand.forEach(function (c) { present[c.id] = true; });
  Object.keys(stackOfCard).forEach(function (id) { if (!present[id]) delete stackOfCard[id]; });
  hand.forEach(function (c) { if (!stackOfCard[c.id]) stackOfCard[c.id] = countCardsInStack('front') < HAND_STACK_SIZE ? 'front' : 'back'; });
  if (hand.length > 0 && countCardsInStack('front') === 0) swapStackAssignments();
}
function listStackElements() { return Array.from(getEl('hand_front').children).concat(Array.from(getEl('hand_back').children)); }
function removeCardElementsNotInHand(hand) {
  const keep = {}; hand.forEach(function (c) { keep[c.id] = true; });
  listStackElements().forEach(function (el) { if (!keep[el.dataset.id]) el.remove(); });
}
function markCardMoved(el) { el.classList.add('moved'); setTimeout(function () { el.classList.remove('moved'); }, 300); }
function placeCardElements(hand) {
  const have = {}; listStackElements().forEach(function (el) { have[el.dataset.id] = el; });
  hand.forEach(function (c) {
    const el = have[c.id] || createCardElement(c), target = getEl(stackOfCard[c.id] === 'front' ? 'hand_front' : 'hand_back');
    if (el.parentNode === target) return;
    if (el.parentNode) markCardMoved(el);
    target.appendChild(el);
  });
}
function updateLockedCards(last) {
  listStackElements().forEach(function (el) { el.classList.toggle('locked', !isThrowAllowed({ n: Number(el.dataset.n), e: Number(el.dataset.e) }, last)); });
}
function syncHandCards(hand, last) {
  latestHand = hand; assignCardStacks(hand); removeCardElementsNotInHand(hand); placeCardElements(hand); updateLockedCards(last);
}
function swapHandStacks() { swapStackAssignments(); placeCardElements(latestHand); }
/* The pile card is rebuilt only when the last card really changes (not on every snapshot). */
function renderPileCard(last) {
  const pile = getEl('pile'), key = last ? last.n + ':' + last.e : '';
  if (key === pileKey) return;
  pileKey = key; pile.textContent = '';
  if (!last) return;
  const card = createCardElement({ id: 0, n: last.n, e: last.e }); card.classList.add('big'); pile.appendChild(card);
}
function createScoreContainer(player, pid, me) {
  const item = document.createElement('div'); item.className = 'score' + (pid === me ? ' me' : ''); item.dataset.pid = pid;
  item.appendChild(createFaceElement(player.icon)); item.appendChild(createTextElement('span', '0.0', 'pts'));
  return item;
}
function rebuildScoreContainers(players, me) {
  const box = getEl('scores'); box.textContent = '';
  players.forEach(function (p, pid) { box.appendChild(createScoreContainer(p, pid, me)); });
}
/* Containers are kept between snapshots so glow and pop-ups survive; names are intentionally not shown. */
function renderScores(players, me) {
  const signature = me + JSON.stringify(players.map(function (p) { return p.icon; }));
  if (signature !== scoreSignature) { scoreSignature = signature; rebuildScoreContainers(players, me); }
  Array.from(getEl('scores').children).forEach(function (item, pid) { item.lastChild.textContent = Number(players[pid].points).toFixed(1); });
}
function getPileCardRect() {
  const card = document.querySelector('#pile .card');
  return (card || getEl('pile')).getBoundingClientRect();
}
function isPointOutsideRect(x, y, r, margin) { return x < r.left - margin || x > r.right + margin || y < r.top - margin || y > r.bottom + margin; }
function clampToPlayfield(x, y) {
  const maxY = getEl('hand').getBoundingClientRect().top + 20;
  return { x: Math.min(Math.max(x, 24), window.innerWidth - 24), y: Math.min(Math.max(y, 60), maxY) };
}
/* Random point on a ring around the pile card: never over the card, never farther than margin + spread. */
function pickParticleSpawnPoint() {
  const r = getPileCardRect(), cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
  for (let tries = 0; tries < 8; tries++) {
    const a = Math.random() * 6.283, spread = Math.random() * PARTICLE_SPREAD_PX;
    const p = clampToPlayfield(cx + Math.cos(a) * (r.width / 2 + PARTICLE_MARGIN_PX + spread), cy + Math.sin(a) * (r.height / 2 + PARTICLE_MARGIN_PX + spread));
    if (isPointOutsideRect(p.x, p.y, r, PARTICLE_MARGIN_PX / 2)) { p.cx = cx; p.cy = cy; return p; }
  }
  const fallback = clampToPlayfield(cx, r.top - PARTICLE_MARGIN_PX - 20);
  fallback.cx = cx; fallback.cy = cy; return fallback;
}
function getOutwardAngle(spot) { return Math.atan2(spot.y - spot.cy, spot.x - spot.cx); }
function spawnFloatAt(x, y, text, element, rx, ry, extraClass) {
  if (!canSpawnParticle(1)) return;
  const el = createTextElement('div', text, 'float e' + element + (extraClass ? ' ' + extraClass : ''));
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.setProperty('--rx', rx + 'px'); el.style.setProperty('--ry', ry + 'px');
  el.addEventListener('animationend', function () { el.remove(); });
  getEl('fx').appendChild(el);
}
function showScorePopup(pid, text, element) {
  const item = getEl('scores').children[pid]; if (!item) return;
  const r = item.getBoundingClientRect();
  spawnFloatAt(r.left + r.width / 2, Math.max(36, r.top - 22), text, element, 0, -34);
}
function lightUpScoreContainer(pid, element) {
  const item = getEl('scores').children[pid]; if (!item) return;
  for (let i = 0; i < ELEMENT_COUNT; i++) item.classList.remove('e' + i);
  item.classList.add('e' + element, 'lit');
  clearTimeout(litTimers[pid]); litTimers[pid] = setTimeout(function () { item.classList.remove('lit'); }, 1200);
}
function spawnBurstDots(element, spot) {
  if (!canSpawnParticle(6)) return;
  const base = getOutwardAngle(spot);
  for (let i = 0; i < 6; i++) {
    const dot = document.createElement('div'), a = base + (i / 5 - 0.5) * 2;
    dot.className = 'dot e' + element; dot.style.left = spot.x + 'px'; dot.style.top = spot.y + 'px';
    dot.style.setProperty('--dx', Math.round(Math.cos(a) * 45) + 'px'); dot.style.setProperty('--dy', Math.round(Math.sin(a) * 45) + 'px');
    dot.addEventListener('animationend', function () { dot.remove(); });
    getEl('fx').appendChild(dot);
  }
}
function spawnGoldSparkles(spot, stack) {
  if (!canSpawnParticle(6 + stack * 3)) return;
  const base = getOutwardAngle(spot);
  for (let i = 0; i < 6 + stack * 3; i++) {
    const dot = document.createElement('div'), a = base + (Math.random() - 0.5) * 2.4, dist = 30 + Math.random() * 40;
    dot.className = 'dot gold'; dot.style.left = spot.x + 'px'; dot.style.top = spot.y + 'px';
    dot.style.setProperty('--dx', Math.round(Math.cos(a) * dist) + 'px'); dot.style.setProperty('--dy', Math.round(Math.sin(a) * dist) + 'px');
    dot.addEventListener('animationend', function () { dot.remove(); });
    getEl('fx').appendChild(dot);
  }
}
function getPlayerName(players, pid) { return players[pid] ? cleanName(players[pid].name) : 'Player'; }
/* Name + points pop above the container; ADVANTAGE xN appears with the burst near the pile. */
/* Popups and glow always show; sounds and bursts are rate limited so a backlog of events can never freeze a device. */
function showEventEffects(event, players) {
  const name = getPlayerName(players, event.pid), now = performance.now(), heavy = now - lastHeavyEffectAt >= EFFECT_MIN_GAP_MS;
  if (heavy) lastHeavyEffectAt = now;
  switchMusicToElement(event.e);
  showScorePopup(event.pid, name + '\n+' + event.gain, event.e);
  if (event.bonus > 0) showScorePopup(event.bonusTo, getPlayerName(players, event.bonusTo) + '\n+' + event.bonus, event.e);
  if (event.boost) lightUpScoreContainer(event.pid, event.e);
  if (!heavy) return;
  const spot = pickParticleSpawnPoint(), a = getOutwardAngle(spot);
  playElementSfx(event.e); if (event.weakness) playWeaknessSfx();
  spawnBurstDots(event.e, spot);
  if (event.boost) playStackChime(event.stack);
  if (event.boost && event.stack > 1) {
    spawnFloatAt(spot.x, spot.y, name + '\nADVANTAGE\nx' + event.stack, event.e, Math.round(Math.cos(a) * 40), Math.round(Math.sin(a) * 40), 'stack');
    spawnGoldSparkles(spot, event.stack);
  }
}
function handleNewEvent(snap) {
  if (!snap.event || snap.event.seq === lastSeenEventSeq) return;
  lastSeenEventSeq = snap.event.seq; showEventEffects(snap.event, snap.players);
}
function renderDeckButton(handCount) {
  getEl('deck_label').textContent = 'Deck ' + handCount + '/' + HAND_SIZE; getEl('btn_deck').disabled = handCount >= HAND_SIZE;
}
/* Opaque filler drains from full to empty over DRAW_COOLDOWN_MS; empty means the deck is ready. */
function startDeckCooldownFill() {
  const deck = getEl('btn_deck'), fill = getEl('deck_fill');
  deck.classList.remove('cooldown'); void fill.offsetWidth;
  fill.style.animationDuration = DRAW_COOLDOWN_MS + 'ms'; deck.classList.add('cooldown');
  deckReadyAt = Date.now() + DRAW_COOLDOWN_MS;
}
function renderGameScreen(snap) {
  getEl('timer').textContent = formatClock(snap.left); getEl('btn_pause').hidden = sessionMode !== 'single';
  setEnvironmentElement(snap.last ? snap.last.e : -1);
  renderScores(snap.players, snap.me); renderPileCard(snap.last); syncHandCards(snap.hand, snap.last);
  renderDeckButton(snap.hand.length); checkOutOfCardsHint(snap.hand.length); handleNewEvent(snap);
}
function createUsageChips(used) {
  const frag = document.createDocumentFragment();
  ELEMENT_NAMES.forEach(function (name, e) { frag.appendChild(createTextElement('span', name + ' ' + used[e], 'chip e' + e)); });
  return frag;
}
function renderResults(snap) {
  const list = getEl('rank_list'); list.textContent = '';
  getEl('btn_results_menu').textContent = { single: 'Back to Setup', host: 'Back to Lobby' }[sessionMode] || 'Leave Room';
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
  if (snap.over) { cancelCountdown(); renderResults(snap); showScreen('results'); return; }
  if (!isScreenShown('game')) { lastHandCount = -1; pileKey = ''; showScreen('game'); if (snap.startsInMs > 0) startCountdownOverlay(snap.startsInMs); }
  renderGameScreen(snap);
}
function createSeatButton(label, act, seat) {
  const b = createTextElement('button', label, 'small'); b.dataset.act = act; b.dataset.seat = seat; return b;
}
function isLobbyStartable(view) {
  return view.filter(Boolean).length >= 2 && view.every(function (s) { return !s || s.ready; });
}
function appendSeatContent(li, s, i, you) {
  li.appendChild(createFaceElement(s.icon));
  li.appendChild(createTextElement('span', cleanName(s.name) + (i === 0 ? ' (host)' : '') + (i === you ? ' - you' : '')));
  if (i !== 0) li.appendChild(createTextElement('span', s.bot ? 'bot' : (s.ready ? 'ready' : 'waiting'), 'tag'));
}
function renderLobby(view, you, isHost) {
  const list = getEl('lobby_seats'); list.textContent = '';
  view.forEach(function (s, i) {
    const li = document.createElement('li');
    if (!s) { li.className = 'empty'; li.appendChild(createTextElement('span', 'Open seat')); if (isHost) li.appendChild(createSeatButton('Add Bot', 'add', i)); }
    else { appendSeatContent(li, s, i, you); if (isHost && i !== 0) li.appendChild(createSeatButton(s.bot ? 'Remove' : 'Kick', 'remove', i)); }
    list.appendChild(li);
  });
  getEl('btn_start').hidden = !isHost; getEl('invite_box').hidden = !isHost; getEl('btn_ready').hidden = isHost;
  if (isHost) getEl('btn_start').disabled = !isLobbyStartable(view);
}
function resetDraggedCard() {
  if (!dragState) return;
  dragState.el.style.transform = ''; dragState.el.classList.remove('drag'); dragState = null;
}
function markCardSentTemporarily(el) { el.classList.add('sent'); setTimeout(function () { el.classList.remove('sent'); }, 600); }
function shakeCard(el) { el.classList.add('shake'); setTimeout(function () { el.classList.remove('shake'); }, 260); }
function onHandPointerDown(e) {
  if (e.button > 0) return; /* ignore right and middle mouse buttons */
  const card = e.target.closest('.card'); if (!card) return;
  if (dragState) resetDraggedCard(); /* a stale drag must never block a new gesture (this was the freeze) */
  dragState = { el: card, x: e.clientX, y: e.clientY, id: Number(card.dataset.id), pid: e.pointerId };
  card.classList.add('drag');
  try { card.setPointerCapture(e.pointerId); } catch (err) { /* the window listeners still end the drag */ }
}
function onHandPointerMove(e) {
  if (!dragState || e.pointerId !== dragState.pid) return;
  dragState.el.style.transform = 'translate(' + (e.clientX - dragState.x) + 'px,' + Math.min(SWIPE_DOWN_PREVIEW_PX, e.clientY - dragState.y) + 'px)';
}
/* Only unlocked cards of the front row can be thrown; a swipe up on a back row card explains why not. */
function throwDraggedCard(el, id) {
  const row = el.parentNode ? el.parentNode.id : '';
  if (row === 'hand_back') { shakeCard(el); showHint(HINT_TEXTS.backRow); return; }
  if (row !== 'hand_front' || el.classList.contains('locked')) { shakeCard(el); return; }
  markCardSentTemporarily(el); sendIntentToHost({ t: 'throw', id: id });
}
/* Swipe up = throw, swipe down = swap front and back rows. */
function onHandPointerUp(e) {
  if (!dragState || e.pointerId !== dragState.pid) return;
  const dy = e.clientY - dragState.y, id = dragState.id, el = dragState.el;
  resetDraggedCard();
  if (dy < -SWIPE_THROW_PX) throwDraggedCard(el, id); else if (dy > SWIPE_THROW_PX) swapHandStacks();
}
function onHandPointerCancel() { if (dragState) resetDraggedCard(); }
/* Start on the hand, finish on the window, so the drag always ends even if the card element is moved or removed mid-gesture. */
function attachHandGestures() {
  const hand = getEl('hand');
  hand.addEventListener('pointerdown', onHandPointerDown);
  hand.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('pointermove', onHandPointerMove); window.addEventListener('pointerup', onHandPointerUp);
  window.addEventListener('pointercancel', onHandPointerCancel); window.addEventListener('blur', onHandPointerCancel);
  document.addEventListener('visibilitychange', onHandPointerCancel);
}

const GUIDE_THROW_SVG = '<svg viewBox="0 0 330 130" class="guide_svg" aria-hidden="true"><rect x="24" y="44" width="46" height="60" rx="8" class="g_card"/><path d="M47 38V10M38 20l9-10 9 10" class="g_line"/><text x="47" y="124" text-anchor="middle" class="g_label">Up: throw</text><rect x="130" y="20" width="46" height="60" rx="8" class="g_card"/><path d="M153 86v28M144 104l9 10 9-10" class="g_line"/><text x="153" y="124" text-anchor="middle" class="g_label">Down: swap</text><rect x="236" y="44" width="46" height="60" rx="8" class="g_deck"/><text x="259" y="124" text-anchor="middle" class="g_label">Tap: draw</text></svg>';
const GUIDE_SYMBOLS = {
  plain: '<path d="M10 12h28M10 24h28" class="g_line"/>',
  advantage: '<path d="M38 18H12M20 10l-8 8 8 8" class="g_line g_up"/>',
  weakness: '<path d="M10 18h26M28 10l8 8-8 8" class="g_line g_down"/>',
  wild: '<polygon points="24,3 29,13 40,14 32,22 34,33 24,27 14,33 16,22 8,14 19,13" class="g_star"/>',
  locked: '<rect x="14" y="16" width="20" height="16" rx="3" class="g_lock"/><path d="M18 16v-4a6 6 0 0 1 12 0v4" class="g_line"/>'
};
function applyElementColors() {
  ELEMENT_COLORS.forEach(function (pair, i) {
    document.documentElement.style.setProperty('--el' + i + '_a', pair[0]); document.documentElement.style.setProperty('--el' + i + '_b', pair[1]);
  });
}
/* Circle order of the diagram: key order of WEAKNESS_OF_BY_NAME or order of ELEMENT_NAMES (GUIDE_LAYOUT_SOURCE). */
function getGuideElementOrder() {
  const order = GUIDE_LAYOUT_SOURCE === 'weakness'
    ? Object.keys(WEAKNESS_OF_BY_NAME).map(function (n) { return ELEMENT_NAMES.indexOf(n); }).filter(function (i) { return i >= 0; }) : [];
  ELEMENT_NAMES.forEach(function (n, i) { if (order.indexOf(i) < 0) order.push(i); });
  return order;
}
function getCyclePositions() {
  const pos = [];
  getGuideElementOrder().forEach(function (element, slot) {
    const a = -Math.PI / 2 + slot * 2 * Math.PI / ELEMENT_COUNT;
    pos[element] = [Math.round(100 + 72 * Math.cos(a)), Math.round(72 + 48 * Math.sin(a))];
  });
  return pos;
}
function buildArrowMarkup(from, to, markerId) {
  const dx = to[0] - from[0], dy = to[1] - from[1], d = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / d, uy = dy / d;
  return '<line x1="' + (from[0] + ux * 26) + '" y1="' + (from[1] + uy * 26) + '" x2="' + (to[0] - ux * 28) + '" y2="' + (to[1] - uy * 28) + '" class="g_line" marker-end="url(#' + (markerId || 'ah') + ')"/>';
}
/* Arrow = beats (beater to beaten), straight from WEAKNESS_OF. Names, colors and positions come from config.js. */
function buildCycleSvg() {
  const pos = getCyclePositions();
  let s = '<svg viewBox="0 0 200 144" class="guide_svg" aria-hidden="true"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" class="g_head"/></marker></defs>';
  WEAKNESS_OF.forEach(function (beater, victim) { if (beater >= 0 && beater !== victim) s += buildArrowMarkup(pos[beater], pos[victim]); });
  pos.forEach(function (p, i) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="22" class="g_node e' + i + '"/><text x="' + p[0] + '" y="' + (p[1] + 3) + '" text-anchor="middle" class="g_label">' + ELEMENT_NAMES[i] + '</text>'; });
  return s + '</svg>';
}
function createMiniCard(card, locked) {
  const el = createCardElement(card); el.classList.add('mini'); if (locked) el.classList.add('locked'); return el;
}
function createHtmlBlock(html) { const d = document.createElement('div'); d.innerHTML = html; return d; }
function exampleCard(n, e) { return { id: 0, n: Math.min(n, CARD_NUMBER_MAX), e: e }; }
/* First [beater, beaten] pair in WEAKNESS_OF, so every example follows config.js. */
function findWeaknessPair() {
  for (let a = 0; a < ELEMENT_COUNT; a++) { const b = WEAKNESS_OF.indexOf(a); if (b >= 0 && b !== a) return [a, b]; }
  return null;
}
function createChip(text) { return createTextElement('span', text, 'chip chip_plain'); }
function buildSymbolSvg(kind) { return '<svg viewBox="0 0 48 36" class="guide_symbol" aria-hidden="true">' + GUIDE_SYMBOLS[kind] + '</svg>'; }
function buildDrawChips(kind, prev, next) {
  const row = document.createElement('div'); row.className = 'chip_row';
  if (kind === 'wild') row.appendChild(createChip(ZERO_WILD_VALUE.enabled ? ZERO_WILD_VALUE.min + '-' + ZERO_WILD_VALUE.max : '+0'));
  else if (kind !== 'locked') {
    const r = scoreThrow({ n: prev.n, e: prev.e, owner: 0 }, next, 1);
    row.appendChild(createChip('+' + r.gain));
    if (r.bonus > 0) row.appendChild(createChip('prev +' + r.bonus));
    if (kind === 'advantage') row.appendChild(createChip('x' + calcStackMultiplier(2)));
  }
  return row;
}
function createDrawTile(label, kind, prev, next, locked) {
  const tile = document.createElement('div'), row = document.createElement('div');
  tile.className = 'draw_tile'; row.className = 'example';
  row.appendChild(createMiniCard(prev, false)); row.appendChild(createHtmlBlock(buildSymbolSvg(kind))); row.appendChild(createMiniCard(next, locked));
  tile.appendChild(createTextElement('h3', label)); tile.appendChild(row); tile.appendChild(buildDrawChips(kind, prev, next));
  return tile;
}
function buildDrawTiles() {
  const pair = findWeaknessPair(), a = pair ? pair[0] : 0, b = pair ? pair[1] : 0, tiles = [];
  tiles.push(createDrawTile('Plain Draw', 'plain', exampleCard(3, a), exampleCard(5, a), false));
  if (pair) {
    tiles.push(createDrawTile('Advantage Draw', 'advantage', exampleCard(4, b), exampleCard(6, a), false));
    tiles.push(createDrawTile('Weakness Draw', 'weakness', exampleCard(5, a), exampleCard(3, b), false));
  }
  tiles.push(createDrawTile('Wild Draw', 'wild', exampleCard(7, a), exampleCard(0, b), false));
  const lastCard = exampleCard(7, a), nextCard = exampleCard(3, a);
  if (!isThrowAllowed(nextCard, lastCard)) tiles.push(createDrawTile('Locked', 'locked', lastCard, nextCard, true));
  return tiles;
}
function createGuideWide(title, node, caption) {
  const box = document.createElement('div'); box.className = 'draw_tile guide_wide';
  box.appendChild(createTextElement('h3', title)); box.appendChild(node); if (caption) box.appendChild(createTextElement('p', caption));
  return box;
}
function buildGuide() {
  const body = getEl('guide_body'); body.textContent = '';
  body.appendChild(createGuideWide('Throw', createHtmlBlock(GUIDE_THROW_SVG)));
  body.appendChild(createGuideWide('Elements', createHtmlBlock(buildCycleSvg()), 'Arrow = beats'));
  buildDrawTiles().forEach(function (t) { body.appendChild(t); });
}
function cancelCountdown() {
  countdownTimers.forEach(clearTimeout); countdownTimers = [];
  getEl('countdown').hidden = true; getEl('hand').classList.remove('frozen');
}
function showCountdownStage(index) {
  const el = getEl('countdown_text'), isGo = index === COUNTDOWN_STAGES.length - 1;
  el.textContent = COUNTDOWN_STAGES[index].text; el.className = isGo ? 'go' : '';
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  playCountdownHype(index);
  if (isGo) switchMusicToElement(pickRandomInt(ELEMENT_COUNT));
}
function findCurrentCountdownStage(elapsedMs) {
  let current = 0;
  COUNTDOWN_STAGES.forEach(function (s, i) { if (s.at <= elapsedMs) current = i; });
  return current;
}
/* remainingMs comes from the host snapshot, so every device ends the countdown together. */
function startCountdownOverlay(remainingMs) {
  cancelCountdown();
  const elapsed = COUNTDOWN_TOTAL_MS - remainingMs, current = findCurrentCountdownStage(elapsed);
  getEl('countdown').hidden = false; getEl('hand').classList.add('frozen'); silenceMusic(); showCountdownStage(current);
  COUNTDOWN_STAGES.forEach(function (s, i) { if (i > current) countdownTimers.push(setTimeout(function () { showCountdownStage(i); }, s.at - elapsed)); });
  countdownTimers.push(setTimeout(cancelCountdown, remainingMs));
}
function showNotice(text) {
  const n = getEl('notice'); n.textContent = text; n.hidden = false;
  clearTimeout(noticeTimerId); noticeTimerId = setTimeout(function () { n.hidden = true; }, NOTICE_MS);
}
function closeConfirmation() { getEl('confirm_box').hidden = true; confirmCallback = null; }
function askConfirmation(text, onYes) { getEl('confirm_text').textContent = text; confirmCallback = onYes; getEl('confirm_box').hidden = false; }
function acceptConfirmation() { const cb = confirmCallback; closeConfirmation(); if (cb) cb(); }
/* Subtle element diagram under the timer, built from the same config as the guide (arrows = beats). */
function buildMiniCycleSvg() {
  const pos = getCyclePositions();
  let s = '<svg viewBox="0 0 200 144" class="mini_cycle_svg" aria-hidden="true"><defs><marker id="ah_mini" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" class="g_head"/></marker></defs>';
  WEAKNESS_OF.forEach(function (beater, victim) { if (beater >= 0 && beater !== victim) s += buildArrowMarkup(pos[beater], pos[victim], 'ah_mini'); });
  pos.forEach(function (p, i) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="22" class="g_node e' + i + '"/>'; });
  return s + '</svg>';
}
function renderMiniCycle() { getEl('mini_cycle').innerHTML = buildMiniCycleSvg(); }
function canSpawnParticle(count) { return getEl('fx').childElementCount + count <= MAX_PARTICLES; }
/* Semi-opaque hint that fades in over the hand area and fades out by itself. */
function showHint(text) {
  const hint = getEl('hint'); hint.textContent = text; hint.classList.add('show');
  clearTimeout(hintTimerId); hintTimerId = setTimeout(function () { hint.classList.remove('show'); }, HINT_VISIBLE_MS);
}
function checkOutOfCardsHint(handCount) {
  if (handCount === 0 && lastHandCount > 0) showHint(HINT_TEXTS.outOfCards);
  lastHandCount = handCount;
}
