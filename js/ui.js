let sendIntentToHost = function () {};
let lastSeenEventSeq = 0, dragState = null, sessionMode = 'menu', lastEnvElement = -2, countdownTimers = [], confirmCallback = null, noticeTimerId = 0, deckReadyAt = 0, scoreSignature = '', litTimers = {}, stackOfCard = {}, latestHand = [], pileKey = '', hintTimerId = 0, lastHandCount = -1, lastHeavyEffectAt = 0;
function getEl(id) { return document.getElementById(id); }
function setEnvironmentElement(element) {
  if (element === lastEnvElement) return;
  lastEnvElement = element;
  document.querySelectorAll('.env_layer').forEach(function (layer, layerIndex) { layer.classList.toggle('on', layerIndex === element); });
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function (screenElement) { screenElement.classList.toggle('on', screenElement.id === id); });
  if (id !== 'game' && id !== 'results') setEnvironmentElement(-1);
  if (id !== 'game') switchMusicToTrack(MENU_TRACK_INDEX);
  if (id === 'game' || id === 'results') enableMatchGuard(); else disableMatchGuard();
}
function isScreenShown(id) { return getEl(id).classList.contains('on'); }
function renderIconPreview(icon) { getEl('icon_preview').innerHTML = buildFaceSvg(icon); }
function formatClock(seconds) { return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'); }
function createFaceElement(icon) { const wrapper = document.createElement('span'); wrapper.className = 'face_wrap'; wrapper.innerHTML = buildFaceSvg(cleanIcon(icon)); return wrapper; }
function createTextElement(tag, text, cls) { const textElement = document.createElement(tag); textElement.textContent = text; if (cls) textElement.className = cls; return textElement; }
function createCardElement(card) {
  const cardElement = document.createElement('div');
  cardElement.className = 'card e' + card.element; cardElement.dataset.id = card.id; cardElement.dataset.number = card.number; cardElement.dataset.element = card.element;
  cardElement.appendChild(createTextElement('span', card.number, 'num'));
  return cardElement;
}
function countCardsInStack(which) { return Object.keys(stackOfCard).filter(function (id) { return stackOfCard[id] === which; }).length; }
function swapStackAssignments() {
  Object.keys(stackOfCard).forEach(function (id) { stackOfCard[id] = stackOfCard[id] === 'front' ? 'back' : 'front'; });
}
/* New cards go to the front row until it holds HAND_STACK_SIZE cards, then to the back row. An empty front row pulls the back row forward. */
function assignCardStacks(hand) {
  const present = {}; hand.forEach(function (card) { present[card.id] = true; });
  Object.keys(stackOfCard).forEach(function (id) { if (!present[id]) delete stackOfCard[id]; });
  hand.forEach(function (card) { if (!stackOfCard[card.id]) stackOfCard[card.id] = countCardsInStack('front') < HAND_STACK_SIZE ? 'front' : 'back'; });
  if (hand.length > 0 && countCardsInStack('front') === 0) swapStackAssignments();
}
function listStackElements() { return Array.from(getEl('hand_front').children).concat(Array.from(getEl('hand_back').children)); }
function removeCardElementsNotInHand(hand) {
  const keep = {}; hand.forEach(function (card) { keep[card.id] = true; });
  listStackElements().forEach(function (cardElement) { if (!keep[cardElement.dataset.id]) cardElement.remove(); });
}
function markCardMoved(cardElement) { cardElement.classList.add('moved'); setTimeout(function () { cardElement.classList.remove('moved'); }, 300); }
function placeCardElements(hand) {
  const have = {}; listStackElements().forEach(function (cardElement) { have[cardElement.dataset.id] = cardElement; });
  hand.forEach(function (card) {
    const cardElement = have[card.id] || createCardElement(card), target = getEl(stackOfCard[card.id] === 'front' ? 'hand_front' : 'hand_back');
    if (cardElement.parentNode === target) return;
    if (cardElement.parentNode) markCardMoved(cardElement);
    target.appendChild(cardElement);
  });
}
function updateLockedCards(last) {
  listStackElements().forEach(function (cardElement) { cardElement.classList.toggle('locked', !isThrowAllowed({ number: Number(cardElement.dataset.number), element: Number(cardElement.dataset.element) }, last)); });
}
function syncHandCards(hand, last) {
  latestHand = hand; assignCardStacks(hand); removeCardElementsNotInHand(hand); placeCardElements(hand); updateLockedCards(last);
}
function swapHandStacks() { swapStackAssignments(); placeCardElements(latestHand); }
/* The pile card is rebuilt only when the last card really changes (not on every snapshot). */
function renderPileCard(last) {
  const pile = getEl('pile'), key = last ? last.number + ':' + last.element : '';
  if (key === pileKey) return;
  pileKey = key; pile.textContent = '';
  if (!last) return;
  const card = createCardElement({ id: 0, number: last.number, element: last.element }); card.classList.add('big'); pile.appendChild(card);
}
function createScoreContainer(player, playerId, myPlayerId) {
  const item = document.createElement('div'); item.className = 'score' + (playerId === myPlayerId ? ' me' : ''); item.dataset.playerId = playerId;
  item.appendChild(createFaceElement(player.icon)); item.appendChild(createTextElement('span', '0.0', 'pts'));
  return item;
}
function rebuildScoreContainers(players, myPlayerId) {
  const box = getEl('scores'); box.textContent = '';
  players.forEach(function (player, playerId) { box.appendChild(createScoreContainer(player, playerId, myPlayerId)); });
}
/* Containers are kept between snapshots so glow and pop-ups survive; names are intentionally not shown. */
function renderScores(players, myPlayerId) {
  const signature = myPlayerId + JSON.stringify(players.map(function (player) { return player.icon; }));
  if (signature !== scoreSignature) { scoreSignature = signature; rebuildScoreContainers(players, myPlayerId); }
  Array.from(getEl('scores').children).forEach(function (item, playerId) { item.lastChild.textContent = Number(players[playerId].points).toFixed(1); });
}
function getPileCardRect() {
  const card = document.querySelector('#pile .card');
  return (card || getEl('pile')).getBoundingClientRect();
}
function isPointOutsideRect(pointX, pointY, rect, margin) { return pointX < rect.left - margin || pointX > rect.right + margin || pointY < rect.top - margin || pointY > rect.bottom + margin; }
function clampToPlayfield(pointX, pointY) {
  const maxY = getEl('hand').getBoundingClientRect().top + 20;
  return { screenX: Math.min(Math.max(pointX, 24), window.innerWidth - 24), screenY: Math.min(Math.max(pointY, 60), maxY) };
}
/* Random point on a ring around the pile card: never over the card, never farther than margin + spread. */
function pickParticleSpawnPoint() {
  const pileRect = getPileCardRect(), pileCenterX = (pileRect.left + pileRect.right) / 2, pileCenterY = (pileRect.top + pileRect.bottom) / 2;
  for (let tries = 0; tries < 8; tries++) {
    const angle = Math.random() * 6.283, spread = Math.random() * PARTICLE_SPREAD_PX;
    const point = clampToPlayfield(pileCenterX + Math.cos(angle) * (pileRect.width / 2 + PARTICLE_MARGIN_PX + spread), pileCenterY + Math.sin(angle) * (pileRect.height / 2 + PARTICLE_MARGIN_PX + spread));
    if (isPointOutsideRect(point.screenX, point.screenY, pileRect, PARTICLE_MARGIN_PX / 2)) { point.pileCenterX = pileCenterX; point.pileCenterY = pileCenterY; return point; }
  }
  const fallback = clampToPlayfield(pileCenterX, pileRect.top - PARTICLE_MARGIN_PX - 20);
  fallback.pileCenterX = pileCenterX; fallback.pileCenterY = pileCenterY; return fallback;
}
function getOutwardAngle(spot) { return Math.atan2(spot.screenY - spot.pileCenterY, spot.screenX - spot.pileCenterX); }
function spawnFloatAt(screenX, screenY, text, element, riseX, riseY, extraClass) {
  if (!canSpawnParticle(1)) return;
  const floatElement = createTextElement('div', text, 'float e' + element + (extraClass ? ' ' + extraClass : ''));
  floatElement.style.left = screenX + 'px'; floatElement.style.top = screenY + 'px'; floatElement.style.setProperty('--rx', riseX + 'px'); floatElement.style.setProperty('--ry', riseY + 'px');
  floatElement.addEventListener('animationend', function () { floatElement.remove(); });
  getEl('fx').appendChild(floatElement);
}
function showScorePopup(playerId, text, element) {
  const item = getEl('scores').children[playerId]; if (!item) return;
  const containerRect = item.getBoundingClientRect();
  spawnFloatAt(containerRect.left + containerRect.width / 2, Math.max(36, containerRect.top - 22), text, element, 0, -34);
}
function lightUpScoreContainer(playerId, element) {
  const item = getEl('scores').children[playerId]; if (!item) return;
  for (let elementIndex = 0; elementIndex < ELEMENT_COUNT; elementIndex++) item.classList.remove('e' + elementIndex);
  item.classList.add('e' + element, 'lit');
  clearTimeout(litTimers[playerId]); litTimers[playerId] = setTimeout(function () { item.classList.remove('lit'); }, 1200);
}
function spawnBurstDots(element, spot) {
  if (!canSpawnParticle(6)) return;
  const base = getOutwardAngle(spot);
  for (let dotIndex = 0; dotIndex < 6; dotIndex++) {
    const dot = document.createElement('div'), angle = base + (dotIndex / 5 - 0.5) * 2;
    dot.className = 'dot e' + element; dot.style.left = spot.screenX + 'px'; dot.style.top = spot.screenY + 'px';
    dot.style.setProperty('--dx', Math.round(Math.cos(angle) * 45) + 'px'); dot.style.setProperty('--dy', Math.round(Math.sin(angle) * 45) + 'px');
    dot.addEventListener('animationend', function () { dot.remove(); });
    getEl('fx').appendChild(dot);
  }
}
function spawnGoldSparkles(spot, stack) {
  if (!canSpawnParticle(6 + stack * 3)) return;
  const base = getOutwardAngle(spot);
  for (let sparkleIndex = 0; sparkleIndex < 6 + stack * 3; sparkleIndex++) {
    const dot = document.createElement('div'), angle = base + (Math.random() - 0.5) * 2.4, dist = 30 + Math.random() * 40;
    dot.className = 'dot gold'; dot.style.left = spot.screenX + 'px'; dot.style.top = spot.screenY + 'px';
    dot.style.setProperty('--dx', Math.round(Math.cos(angle) * dist) + 'px'); dot.style.setProperty('--dy', Math.round(Math.sin(angle) * dist) + 'px');
    dot.addEventListener('animationend', function () { dot.remove(); });
    getEl('fx').appendChild(dot);
  }
}
function getPlayerName(players, playerId) { return players[playerId] ? cleanName(players[playerId].name) : 'Player'; }
/* Name + points pop above the container; ADVANTAGE xN appears with the burst near the pile. */
/* Popups and glow always show; sounds and bursts are rate limited so a backlog of events can never freeze a device. */
function showEventEffects(event, players) {
  const name = getPlayerName(players, event.playerId), now = performance.now(), heavy = now - lastHeavyEffectAt >= EFFECT_MIN_GAP_MS;
  if (heavy) lastHeavyEffectAt = now;
  switchMusicToElement(event.element);
  showScorePopup(event.playerId, name + '\n+' + event.gain, event.element);
  if (event.bonus > 0) showScorePopup(event.bonusTo, getPlayerName(players, event.bonusTo) + '\n+' + event.bonus, event.element);
  if (event.boost) lightUpScoreContainer(event.playerId, event.element);
  if (!heavy) return;
  const spot = pickParticleSpawnPoint(), outwardAngle = getOutwardAngle(spot);
  playElementSfx(event.element); if (event.weakness) playWeaknessSfx();
  spawnBurstDots(event.element, spot);
  if (event.boost) playStackChime(event.stack);
  if (event.boost && event.stack > 1) {
    spawnFloatAt(spot.screenX, spot.screenY, name + '\nADVANTAGE\nx' + event.stack, event.element, Math.round(Math.cos(outwardAngle) * 40), Math.round(Math.sin(outwardAngle) * 40), 'stack');
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
  setEnvironmentElement(snap.last ? snap.last.element : -1);
  renderScores(snap.players, snap.myPlayerId); renderPileCard(snap.last); syncHandCards(snap.hand, snap.last);
  renderDeckButton(snap.hand.length); checkOutOfCardsHint(snap.hand.length); handleNewEvent(snap);
}
function createUsageChips(used) {
  const frag = document.createDocumentFragment();
  ELEMENT_NAMES.forEach(function (name, elementIndex) { frag.appendChild(createTextElement('span', name + ' ' + used[elementIndex], 'chip e' + elementIndex)); });
  return frag;
}
function renderResults(snap) {
  const list = getEl('rank_list'); list.textContent = '';
  getEl('btn_results_menu').textContent = { single: 'Back to Setup', host: 'Back to Lobby' }[sessionMode] || 'Leave Room';
  snap.players.map(function (player, playerId) { return { player: player, playerId: playerId }; })
    .sort(function (firstRow, secondRow) { return secondRow.player.points - firstRow.player.points; })
    .forEach(function (row, rank) {
      const listItem = document.createElement('li');
      listItem.appendChild(createTextElement('span', '#' + (rank + 1)));
      listItem.appendChild(createFaceElement(row.player.icon));
      listItem.appendChild(createTextElement('span', cleanName(row.player.name) + ' ' + Number(row.player.points).toFixed(1)));
      if (row.player.used) listItem.appendChild(createUsageChips(row.player.used));
      list.appendChild(listItem);
    });
}
function renderSnapshot(snap) {
  if (snap.over) { cancelCountdown(); renderResults(snap); showScreen('results'); return; }
  if (!isScreenShown('game')) { lastHandCount = -1; pileKey = ''; showScreen('game'); if (snap.startsInMs > 0) startCountdownOverlay(snap.startsInMs); }
  renderGameScreen(snap);
}
function createSeatButton(label, act, seat) {
  const button = createTextElement('button', label, 'small'); button.dataset.act = act; button.dataset.seat = seat; return button;
}
function isLobbyStartable(view) {
  return view.filter(Boolean).length >= 2 && view.every(function (seat) { return !seat || seat.ready; });
}
function appendSeatContent(listItem, seat, seatIndex, you) {
  listItem.appendChild(createFaceElement(seat.icon));
  listItem.appendChild(createTextElement('span', cleanName(seat.name) + (seatIndex === 0 ? ' (host)' : '') + (seatIndex === you ? ' - you' : '')));
  if (seatIndex !== 0) listItem.appendChild(createTextElement('span', seat.bot ? 'bot' : (seat.ready ? 'ready' : 'waiting'), 'tag'));
}
function renderLobby(view, you, isHost) {
  const list = getEl('lobby_seats'); list.textContent = '';
  view.forEach(function (seat, seatIndex) {
    const listItem = document.createElement('li');
    if (!seat) { listItem.className = 'empty'; listItem.appendChild(createTextElement('span', 'Open seat')); if (isHost) listItem.appendChild(createSeatButton('Add Bot', 'add', seatIndex)); }
    else { appendSeatContent(listItem, seat, seatIndex, you); if (isHost && seatIndex !== 0) listItem.appendChild(createSeatButton(seat.bot ? 'Remove' : 'Kick', 'remove', seatIndex)); }
    list.appendChild(listItem);
  });
  getEl('btn_start').hidden = !isHost; getEl('invite_box').hidden = !isHost; getEl('btn_ready').hidden = isHost;
  if (isHost) getEl('btn_start').disabled = !isLobbyStartable(view);
}
function resetDraggedCard() {
  if (!dragState) return;
  dragState.cardElement.style.transform = ''; dragState.cardElement.classList.remove('drag'); dragState = null;
}
function markCardSentTemporarily(cardElement) { cardElement.classList.add('sent'); setTimeout(function () { cardElement.classList.remove('sent'); }, 600); }
function shakeCard(cardElement) { cardElement.classList.add('shake'); setTimeout(function () { cardElement.classList.remove('shake'); }, 260); }
function onHandPointerDown(pointerEvent) {
  if (pointerEvent.button > 0) return; /* ignore right and middle mouse buttons */
  const card = pointerEvent.target.closest('.card'); if (!card) return;
  if (dragState) resetDraggedCard(); /* a stale drag must never block a new gesture (this was the freeze) */
  dragState = { cardElement: card, startX: pointerEvent.clientX, startY: pointerEvent.clientY, id: Number(card.dataset.id), pointerId: pointerEvent.pointerId };
  card.classList.add('drag');
  try { card.setPointerCapture(pointerEvent.pointerId); } catch (err) { /* the window listeners still end the drag */ }
}
function onHandPointerMove(pointerEvent) {
  if (!dragState || pointerEvent.pointerId !== dragState.pointerId) return;
  dragState.cardElement.style.transform = 'translate(' + (pointerEvent.clientX - dragState.startX) + 'px,' + Math.min(SWIPE_DOWN_PREVIEW_PX, pointerEvent.clientY - dragState.startY) + 'px)';
  sendWindupSignalOnce(pointerEvent.clientY - dragState.startY);
}
/* Only unlocked cards of the front row can be thrown; a swipe up on a back row card explains why not. */
function throwDraggedCard(cardElement, id) {
  const row = cardElement.parentNode ? cardElement.parentNode.id : '';
  if (row === 'hand_back') { shakeCard(cardElement); showHint(HINT_TEXTS.backRow); return; }
  if (row !== 'hand_front' || cardElement.classList.contains('locked')) { shakeCard(cardElement); return; }
  markCardSentTemporarily(cardElement); sendIntentToHost({ type: 'throw', id: id });
}
/* Swipe up = throw, swipe down = swap front and back rows. */
function onHandPointerUp(pointerEvent) {
  if (!dragState || pointerEvent.pointerId !== dragState.pointerId) return;
  const deltaY = pointerEvent.clientY - dragState.startY, id = dragState.id, cardElement = dragState.cardElement;
  resetDraggedCard();
  if (deltaY < -SWIPE_THROW_PX) throwDraggedCard(cardElement, id); else if (deltaY > SWIPE_THROW_PX) swapHandStacks();
}
function onHandPointerCancel() { if (dragState) resetDraggedCard(); }
/* Start on the hand, finish on the window, so the drag always ends even if the card element is moved or removed mid-gesture. */
function attachHandGestures() {
  const hand = getEl('hand');
  hand.addEventListener('pointerdown', onHandPointerDown);
  hand.addEventListener('contextmenu', function (contextMenuEvent) { contextMenuEvent.preventDefault(); });
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
  ELEMENT_COLORS.forEach(function (pair, elementIndex) {
    document.documentElement.style.setProperty('--el' + elementIndex + '_a', pair[0]); document.documentElement.style.setProperty('--el' + elementIndex + '_b', pair[1]);
  });
}
/* Circle order of the diagram: key order of WEAKNESS_OF_BY_NAME or order of ELEMENT_NAMES (GUIDE_LAYOUT_SOURCE). */
function getGuideElementOrder() {
  const order = GUIDE_LAYOUT_SOURCE === 'weakness'
    ? Object.keys(WEAKNESS_OF_BY_NAME).map(function (elementName) { return ELEMENT_NAMES.indexOf(elementName); }).filter(function (elementIndex) { return elementIndex >= 0; }) : [];
  ELEMENT_NAMES.forEach(function (elementName, elementIndex) { if (order.indexOf(elementIndex) < 0) order.push(elementIndex); });
  return order;
}
function getCyclePositions() {
  const pos = [];
  getGuideElementOrder().forEach(function (element, slot) {
    const angle = -Math.PI / 2 + slot * 2 * Math.PI / ELEMENT_COUNT;
    pos[element] = [Math.round(100 + 72 * Math.cos(angle)), Math.round(72 + 48 * Math.sin(angle))];
  });
  return pos;
}
function buildArrowMarkup(from, toPoint, markerId) {
  const deltaX = toPoint[0] - from[0], deltaY = toPoint[1] - from[1], distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY) || 1, unitX = deltaX / distance, unitY = deltaY / distance;
  return '<line x1="' + (from[0] + unitX * 26) + '" y1="' + (from[1] + unitY * 26) + '" x2="' + (toPoint[0] - unitX * 28) + '" y2="' + (toPoint[1] - unitY * 28) + '" class="g_line" marker-end="url(#' + (markerId || 'ah') + ')"/>';
}
/* Arrow = beats (beater to beaten), straight from WEAKNESS_OF. Names, colors and positions come from config.js. */
function buildCycleSvg() {
  const pos = getCyclePositions();
  let markup = '<svg viewBox="0 0 200 144" class="guide_svg" aria-hidden="true"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" class="g_head"/></marker></defs>';
  WEAKNESS_OF.forEach(function (beater, victim) { if (beater >= 0 && beater !== victim) markup += buildArrowMarkup(pos[beater], pos[victim]); });
  pos.forEach(function (point, elementIndex) { markup += '<circle cx="' + point[0] + '" cy="' + point[1] + '" r="22" class="g_node e' + elementIndex + '"/><text x="' + point[0] + '" y="' + (point[1] + 3) + '" text-anchor="middle" class="g_label">' + ELEMENT_NAMES[elementIndex] + '</text>'; });
  return markup + '</svg>';
}
function createMiniCard(card, locked) {
  const cardElement = createCardElement(card); cardElement.classList.add('mini'); if (locked) cardElement.classList.add('locked'); return cardElement;
}
function createHtmlBlock(html) { const container = document.createElement('div'); container.innerHTML = html; return container; }
function exampleCard(cardNumber, elementIndex) { return { id: 0, number: Math.min(cardNumber, CARD_NUMBER_MAX), element: elementIndex }; }
/* First [beater, beaten] pair in WEAKNESS_OF, so every example follows config.js. */
function findWeaknessPair() {
  for (let beaterIndex = 0; beaterIndex < ELEMENT_COUNT; beaterIndex++) { const beatenIndex = WEAKNESS_OF.indexOf(beaterIndex); if (beatenIndex >= 0 && beatenIndex !== beaterIndex) return [beaterIndex, beatenIndex]; }
  return null;
}
function createChip(text) { return createTextElement('span', text, 'chip chip_plain'); }
function buildSymbolSvg(kind) { return '<svg viewBox="0 0 48 36" class="guide_symbol" aria-hidden="true">' + GUIDE_SYMBOLS[kind] + '</svg>'; }
function buildDrawChips(kind, prev, next) {
  const row = document.createElement('div'); row.className = 'chip_row';
  if (kind === 'wild') row.appendChild(createChip(ZERO_WILD_VALUE.enabled ? ZERO_WILD_VALUE.min + '-' + ZERO_WILD_VALUE.max : '+0'));
  else if (kind !== 'locked') {
    const scoreResult = scoreThrow({ number: prev.number, element: prev.element, owner: 0 }, next, 1);
    row.appendChild(createChip('player card: +' + scoreResult.gain));
    if (scoreResult.bonus > 0) row.appendChild(createChip('owner of previous card: +' + scoreResult.bonus));
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
  const pair = findWeaknessPair(), beaterIndex = pair ? pair[0] : 0, beatenIndex = pair ? pair[1] : 0, tiles = [];
  tiles.push(createDrawTile('Plain Draw', 'plain', exampleCard(3, beaterIndex), exampleCard(5, beaterIndex), false));
  if (pair) {
    tiles.push(createDrawTile('Advantage Draw', 'advantage', exampleCard(4, beatenIndex), exampleCard(6, beaterIndex), false));
    tiles.push(createDrawTile('Weakness Draw', 'weakness', exampleCard(5, beaterIndex), exampleCard(3, beatenIndex), false));
  }
  tiles.push(createDrawTile('Wild Draw', 'wild', exampleCard(7, beaterIndex), exampleCard(0, beatenIndex), false));
  const lastCard = exampleCard(7, beaterIndex), nextCard = exampleCard(3, beaterIndex);
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
  buildDrawTiles().forEach(function (tile) { body.appendChild(tile); });
}
function cancelCountdown() {
  countdownTimers.forEach(clearTimeout); countdownTimers = [];
  getEl('countdown').hidden = true; getEl('hand').classList.remove('frozen');
}
function showCountdownStage(index) {
  const textElement = getEl('countdown_text'), isGo = index === COUNTDOWN_STAGES.length - 1;
  textElement.textContent = COUNTDOWN_STAGES[index].text; textElement.className = isGo ? 'go' : '';
  textElement.style.animation = 'none'; void textElement.offsetWidth; textElement.style.animation = '';
  playCountdownHype(index);
  if (isGo) switchMusicToElement(pickRandomInt(ELEMENT_COUNT));
}
function findCurrentCountdownStage(elapsedMs) {
  let current = 0;
  COUNTDOWN_STAGES.forEach(function (stage, stageIndex) { if (stage.at <= elapsedMs) current = stageIndex; });
  return current;
}
/* remainingMs comes from the host snapshot, so every device ends the countdown together. */
function startCountdownOverlay(remainingMs) {
  cancelCountdown();
  const elapsed = COUNTDOWN_TOTAL_MS - remainingMs, current = findCurrentCountdownStage(elapsed);
  getEl('countdown').hidden = false; getEl('hand').classList.add('frozen'); silenceMusic(); showCountdownStage(current);
  COUNTDOWN_STAGES.forEach(function (stage, stageIndex) { if (stageIndex > current) countdownTimers.push(setTimeout(function () { showCountdownStage(stageIndex); }, stage.at - elapsed)); });
  countdownTimers.push(setTimeout(cancelCountdown, remainingMs));
}
function showNotice(text) {
  const noticeElement = getEl('notice'); noticeElement.textContent = text; noticeElement.hidden = false;
  clearTimeout(noticeTimerId); noticeTimerId = setTimeout(function () { noticeElement.hidden = true; }, NOTICE_MS);
}
function closeConfirmation() { getEl('confirm_box').hidden = true; confirmCallback = null; }
function askConfirmation(text, onYes) { getEl('confirm_text').textContent = text; confirmCallback = onYes; getEl('confirm_box').hidden = false; }
function acceptConfirmation() { const callback = confirmCallback; closeConfirmation(); if (callback) callback(); }
/* Subtle element diagram under the timer, built from the same config as the guide (arrows = beats). */
function buildMiniCycleSvg() {
  const pos = getCyclePositions();
  let markup = '<svg viewBox="0 0 200 144" class="mini_cycle_svg" aria-hidden="true"><defs><marker id="ah_mini" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" class="g_head"/></marker></defs>';
  WEAKNESS_OF.forEach(function (beater, victim) { if (beater >= 0 && beater !== victim) markup += buildArrowMarkup(pos[beater], pos[victim], 'ah_mini'); });
  pos.forEach(function (point, elementIndex) { markup += '<circle cx="' + point[0] + '" cy="' + point[1] + '" r="22" class="g_node e' + elementIndex + '"/>'; });
  return markup + '</svg>';
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
/* Windup tell: once a swipe up passes the throw distance, the others hear the telegraph before the card is released. */
function sendWindupSignalOnce(swipeDeltaY) {
  if (!HUMAN_WINDUP_TELEGRAPH || dragState.windupSent || swipeDeltaY >= -SWIPE_THROW_PX) return;
  const row = dragState.cardElement.parentNode ? dragState.cardElement.parentNode.id : '';
  if (row !== 'hand_front' || dragState.cardElement.classList.contains('locked')) return;
  dragState.windupSent = true; sendIntentToHost({ type: 'windup' });
}
function showTelegraphCue(playerId) {
  playTelegraphSignal(playerId);
  const scoreContainer = getEl('scores').children[playerId];
  if (!scoreContainer) return;
  scoreContainer.classList.add('telegraph'); setTimeout(function () { scoreContainer.classList.remove('telegraph'); }, 450);
}
