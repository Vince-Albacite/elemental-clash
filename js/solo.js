let soloSeats = [null, null, null, null], soloPickSeat = -1; /* seat 0 = the player, seats 1-3 = BOT_PROFILES entries or null */
function findBotProfile(name) { return BOT_PROFILES.find(function (profile) { return profile.name === name; }) || null; }
function listSoloUsedNames() { return soloSeats.filter(Boolean).map(function (profile) { return profile.name; }).concat([playerProfile.name]); }
function fillSoloSeatsRandomly() { for (let seatIndex = 1; seatIndex < 4; seatIndex++) soloSeats[seatIndex] = createRandomBotSeat(listSoloUsedNames()).profile; }
function createSoloPlayerRow() {
  const listItem = document.createElement('li');
  listItem.appendChild(createFaceElement(playerProfile.icon)); listItem.appendChild(createTextElement('span', playerProfile.name + ' (you)', 'grow'));
  return listItem;
}
function createSoloSeatRow(seat) {
  const listItem = document.createElement('li'), botProfile = soloSeats[seat];
  if (!botProfile) {
    listItem.className = 'empty'; listItem.appendChild(createTextElement('span', 'Open seat', 'grow'));
    listItem.appendChild(createSeatButton('Random', 'random', seat)); listItem.appendChild(createSeatButton('Choose', 'choose', seat));
  } else {
    listItem.appendChild(createFaceElement(botProfile.icon)); listItem.appendChild(createTextElement('span', botProfile.name, 'grow')); listItem.appendChild(createTextElement('span', botProfile.personality, 'tag'));
    listItem.appendChild(createSeatButton('Change', 'choose', seat)); listItem.appendChild(createSeatButton('Remove', 'remove', seat));
  }
  return listItem;
}
function renderSoloSetup() {
  const list = getEl('solo_seats'); list.textContent = '';
  list.appendChild(createSoloPlayerRow());
  for (let seatIndex = 1; seatIndex < 4; seatIndex++) list.appendChild(createSoloSeatRow(seatIndex));
  getEl('btn_solo_start').disabled = soloSeats.filter(Boolean).length < 1;
}
function setSoloBot(seat, profile) { soloSeats[seat] = profile; renderSoloSetup(); }
function onSoloSeatAction(clickEvent) {
  const button = clickEvent.target.closest('button'); if (!button) return;
  const seat = Number(button.dataset.seat), act = button.dataset.act;
  if (act === 'random') setSoloBot(seat, createRandomBotSeat(listSoloUsedNames()).profile);
  else if (act === 'remove') setSoloBot(seat, null);
  else if (act === 'choose') openBotPicker(seat);
}
function renderBotPicker() {
  const list = getEl('bot_picker_list'), current = soloSeats[soloPickSeat]; list.textContent = '';
  const taken = listSoloUsedNames().filter(function (usedName) { return !current || usedName !== current.name; });
  BOT_PROFILES.forEach(function (profile) {
    const listItem = document.createElement('li'); listItem.dataset.name = profile.name; if (taken.indexOf(profile.name) >= 0) listItem.className = 'taken';
    listItem.appendChild(createFaceElement(profile.icon)); listItem.appendChild(createTextElement('span', profile.name, 'grow')); listItem.appendChild(createTextElement('span', profile.personality, 'tag'));
    list.appendChild(listItem);
  });
}
function openBotPicker(seat) { soloPickSeat = seat; renderBotPicker(); getEl('bot_picker').hidden = false; }
function closeBotPicker() { getEl('bot_picker').hidden = true; soloPickSeat = -1; }
function onBotPickerClick(clickEvent) {
  const listItem = clickEvent.target.closest('li'); if (!listItem || listItem.classList.contains('taken')) return;
  setSoloBot(soloPickSeat, findBotProfile(listItem.dataset.name)); closeBotPicker();
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
