const playerProfile = { name: 'Player', icon: { c: 0, e: 0, m: 0 } };
function readProfileFromMenu() { playerProfile.name = cleanName(getEl('player_name').value); }
function readDurationSeconds() { return Number(getEl('duration').value); }
function onSinglePlayerClicked() { openSoloSetup(); }
function onCreateRoomClicked() { readProfileFromMenu(); openHostLobby(playerProfile); }
function onIconPartClicked(e) {
  const b = e.currentTarget;
  stepIconPart(playerProfile.icon, b.dataset.part, Number(b.dataset.dir)); renderIconPreview(playerProfile.icon);
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
function onLobbySeatAction(e) {
  const b = e.target.closest('button'); if (!b || sessionMode !== 'host') return;
  const seat = Number(b.dataset.seat);
  if (b.dataset.act === 'add') addBotToSeat(seat); else if (b.dataset.act === 'remove') removeSeat(seat);
}
function onDeckClicked() {
  if (Date.now() < deckReadyAt) return;
  sendIntentToHost({ t: 'draw' }); startDeckCooldownFill();
}
function bindAutoSubmit(id, handler) {
  let lastValue = '';
  getEl(id).addEventListener('input', function (e) {
    const v = e.target.value.trim();
    if (v.length < 60) { lastValue = ''; return; }
    if (v === lastValue) return;
    lastValue = v; handler();
  });
}
function bindClick(id, fn) { getEl(id).addEventListener('click', fn); }
function bindMenuButtons() {
  bindClick('btn_single', onSinglePlayerClicked);
  bindClick('btn_multi', function () { readProfileFromMenu(); showScreen('mp'); });
  bindClick('btn_guide', function () { showScreen('guide'); });
  bindClick('btn_create_room', onCreateRoomClicked);
  bindClick('btn_join_room', function () { readProfileFromMenu(); showScreen('join'); });
  bindClick('btn_results_menu', onResultsButtonClicked);
  bindClick('btn_audio', function () { getEl('audio_panel').hidden = !getEl('audio_panel').hidden; });
  document.querySelectorAll('.back').forEach(function (b) { b.addEventListener('click', function () { showScreen('menu'); }); });
  document.querySelectorAll('.icon_btn').forEach(function (b) { b.addEventListener('click', onIconPartClicked); });
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
  ['invite_offer', 'join_answer'].forEach(function (id) { getEl(id).addEventListener('focus', function (e) { e.target.select(); }); });
}
function bindSoloControls() {
  bindClick('btn_solo_start', startSoloMatch);
  bindClick('bot_picker_close', closeBotPicker);
  bindClick('btn_pause_setup', backToSoloSetupFromPause);
  getEl('solo_seats').addEventListener('click', onSoloSeatAction);
  getEl('bot_picker_list').addEventListener('click', onBotPickerClick);
}
function bindAudioControls() {
  ['master', 'music', 'sfx'].forEach(function (kind) { getEl('vol_' + kind).addEventListener('input', function (e) { setVolume(kind, Number(e.target.value)); }); });
  document.addEventListener('pointerdown', ensureAudioStarted);
  document.addEventListener('click', function (e) { if (e.target.closest('button')) playMenuSfx(); });
}
function main() {
  applyElementColors(); renderIconPreview(playerProfile.icon); bindMenuButtons(); bindLobbyControls(); bindSoloControls(); bindAudioControls(); bindMatchGuard(); attachHandGestures(); buildGuide(); renderMiniCycle();
}
