let soloSeats = [null, null, null, null], soloPickSeat = -1; /* seat 0 = the player, seats 1-3 = BOT_PROFILES entries or null */
function findBotProfile(name) { return BOT_PROFILES.find(function (p) { return p.name === name; }) || null; }
function listSoloUsedNames() { return soloSeats.filter(Boolean).map(function (p) { return p.name; }).concat([playerProfile.name]); }
function fillSoloSeatsRandomly() { for (let i = 1; i < 4; i++) soloSeats[i] = createRandomBotSeat(listSoloUsedNames()).profile; }
function createSoloPlayerRow() {
  const li = document.createElement('li');
  li.appendChild(createFaceElement(playerProfile.icon)); li.appendChild(createTextElement('span', playerProfile.name + ' (you)', 'grow'));
  return li;
}
function createSoloSeatRow(seat) {
  const li = document.createElement('li'), p = soloSeats[seat];
  if (!p) {
    li.className = 'empty'; li.appendChild(createTextElement('span', 'Open seat', 'grow'));
    li.appendChild(createSeatButton('Random', 'random', seat)); li.appendChild(createSeatButton('Choose', 'choose', seat));
  } else {
    li.appendChild(createFaceElement(p.icon)); li.appendChild(createTextElement('span', p.name, 'grow')); li.appendChild(createTextElement('span', p.personality, 'tag'));
    li.appendChild(createSeatButton('Change', 'choose', seat)); li.appendChild(createSeatButton('Remove', 'remove', seat));
  }
  return li;
}
function renderSoloSetup() {
  const list = getEl('solo_seats'); list.textContent = '';
  list.appendChild(createSoloPlayerRow());
  for (let i = 1; i < 4; i++) list.appendChild(createSoloSeatRow(i));
  getEl('btn_solo_start').disabled = soloSeats.filter(Boolean).length < 1;
}
function setSoloBot(seat, profile) { soloSeats[seat] = profile; renderSoloSetup(); }
function onSoloSeatAction(e) {
  const b = e.target.closest('button'); if (!b) return;
  const seat = Number(b.dataset.seat), act = b.dataset.act;
  if (act === 'random') setSoloBot(seat, createRandomBotSeat(listSoloUsedNames()).profile);
  else if (act === 'remove') setSoloBot(seat, null);
  else if (act === 'choose') openBotPicker(seat);
}
function renderBotPicker() {
  const list = getEl('bot_picker_list'), current = soloSeats[soloPickSeat]; list.textContent = '';
  const taken = listSoloUsedNames().filter(function (n) { return !current || n !== current.name; });
  BOT_PROFILES.forEach(function (p) {
    const li = document.createElement('li'); li.dataset.name = p.name; if (taken.indexOf(p.name) >= 0) li.className = 'taken';
    li.appendChild(createFaceElement(p.icon)); li.appendChild(createTextElement('span', p.name, 'grow')); li.appendChild(createTextElement('span', p.personality, 'tag'));
    list.appendChild(li);
  });
}
function openBotPicker(seat) { soloPickSeat = seat; renderBotPicker(); getEl('bot_picker').hidden = false; }
function closeBotPicker() { getEl('bot_picker').hidden = true; soloPickSeat = -1; }
function onBotPickerClick(e) {
  const li = e.target.closest('li'); if (!li || li.classList.contains('taken')) return;
  setSoloBot(soloPickSeat, findBotProfile(li.dataset.name)); closeBotPicker();
}
/* First visit fills 3 random bots; the choice is kept when coming back from a match or the menu. */
function openSoloSetup() {
  readProfileFromMenu(); sessionMode = 'single';
  if (soloSeats.filter(Boolean).length === 0) fillSoloSeatsRandomly();
  showScreen('solo'); renderSoloSetup();
}
function startSoloMatch() {
  const bots = soloSeats.filter(Boolean);
  if (bots.length > 0) startSinglePlayerGame(playerProfile, readDurationSeconds(), bots);
}
function returnToSoloSetup() { hostState = null; openSoloSetup(); }
function backToSoloSetupFromPause() { clearInterval(hostTickId); getEl('pause_box').hidden = true; returnToSoloSetup(); }
