const playerProfile = { name: 'Player', icon: { colorIndex: 0, eyesIndex: 0, mouthIndex: 0 } };
function readProfileFromMenu() { playerProfile.name = cleanName(getEl('player_name').value); }
function readDurationSeconds() { return Number(getEl('duration').value); }
function onSinglePlayerClicked() { openSoloSetup(); }
function onCreateRoomClicked() { readProfileFromMenu(); openHostLobby(playerProfile); }
function onIconPartClicked(clickEvent) {
  const button = clickEvent.currentTarget;
  stepIconPart(playerProfile.icon, button.dataset.part, Number(button.dataset.dir)); renderIconPreview(playerProfile.icon);
}
function onResultsButtonClicked() {
  if (sessionMode === 'host') returnHostToLobby();
  else if (sessionMode === 'single') returnToSoloSetup();
  else leaveClientRoom();
}
function onLeaveLobbyClicked() {
  const isHost = sessionMode === 'host';
  askConfirmation(isHost ? 'Close the room? Everyone will be disconnected.' : 'Leave the room?', isHost ? closeHostRoom : leaveClientRoom);
}
function onLobbySeatAction(clickEvent) {
  const button = clickEvent.target.closest('button'); if (!button || sessionMode !== 'host') return;
  const seat = Number(button.dataset.seat);
  if (button.dataset.act === 'add') addBotToSeat(seat); else if (button.dataset.act === 'remove') removeSeat(seat);
}
function onDeckClicked() {
  if (Date.now() < deckReadyAt) return;
  sendIntentToHost({ type: 'draw' }); startDeckCooldownFill();
}
function bindAutoSubmit(id, handler) {
  let lastValue = '';
  getEl(id).addEventListener('input', function (inputEvent) {
    const pastedText = inputEvent.target.value.trim();
    if (pastedText.length < 60) { lastValue = ''; return; }
    if (pastedText === lastValue) return;
    lastValue = pastedText; handler();
  });
}
function bindClick(id, handler) { getEl(id).addEventListener('click', handler); }
function bindMenuButtons() {
  bindClick('btn_single', onSinglePlayerClicked);
  bindClick('btn_multi', function () { readProfileFromMenu(); showScreen('mp'); });
  bindClick('btn_guide', function () { showScreen('guide'); });
  bindClick('btn_create_room', onCreateRoomClicked);
  bindClick('btn_join_room', function () { readProfileFromMenu(); showScreen('join'); });
  bindClick('btn_results_menu', onResultsButtonClicked);
  bindClick('btn_audio', function () { getEl('audio_panel').hidden = !getEl('audio_panel').hidden; });
  document.querySelectorAll('.back').forEach(function (button) { button.addEventListener('click', function () { showScreen('menu'); }); });
  document.querySelectorAll('.icon_btn').forEach(function (button) { button.addEventListener('click', onIconPartClicked); });
}
function bindLobbyControls() {
  bindClick('btn_make_answer', makeAnswerForHostCode);
  bindClick('btn_invite', refreshInvite);
  bindClick('btn_connect', submitInviteAnswer);
  bindClick('btn_ready', toggleReadyState);
  bindClick('btn_start', function () { startGameFromLobby(readDurationSeconds()); });
  bindClick('btn_leave', onLeaveLobbyClicked);
  bindClick('confirm_yes', acceptConfirmation);
  bindClick('confirm_no', closeConfirmation);
  bindClick('btn_deck', onDeckClicked);
  bindClick('btn_pause', pauseHostGame);
  bindClick('btn_resume', resumeHostGame);
  bindClick('btn_quit', quitPausedGame);
  getEl('lobby_seats').addEventListener('click', onLobbySeatAction);
  bindAutoSubmit('join_offer', makeAnswerForHostCode);
  bindAutoSubmit('invite_answer', submitInviteAnswer);
  ['invite_offer', 'join_answer'].forEach(function (id) { getEl(id).addEventListener('focus', function (focusEvent) { focusEvent.target.select(); }); });
}
function bindSoloControls() {
  bindClick('btn_solo_start', startSoloMatch);
  bindClick('bot_picker_close', closeBotPicker);
  bindClick('btn_pause_setup', backToSoloSetupFromPause);
  getEl('solo_seats').addEventListener('click', onSoloSeatAction);
  getEl('bot_picker_list').addEventListener('click', onBotPickerClick);
}
function bindAudioControls() {
  ['master', 'music', 'sfx'].forEach(function (kind) { getEl('vol_' + kind).addEventListener('input', function (inputEvent) { setVolume(kind, Number(inputEvent.target.value)); }); });
  document.addEventListener('pointerdown', ensureAudioStarted);
  document.addEventListener('click', function (clickEvent) { if (clickEvent.target.closest('button')) playMenuSfx(); });
}
function main() {
  applyElementColors(); renderIconPreview(playerProfile.icon); bindMenuButtons(); bindLobbyControls(); bindSoloControls(); bindAudioControls(); bindMatchGuard(); attachHandGestures(); buildGuide(); renderMiniCycle();
}
