const playerProfile = { name: 'Player', icon: { c: 0, e: 0, m: 0 } };
function readProfileFromMenu() { playerProfile.name = cleanName(getEl('player_name').value); }
function readDurationSeconds() { return Number(getEl('duration').value); }
function onSinglePlayerClicked() { readProfileFromMenu(); startSinglePlayerGame(playerProfile, readDurationSeconds()); }
function onCreateRoomClicked() { readProfileFromMenu(); openHostLobby(playerProfile); }
function onIconPartClicked(e) { cycleIconPart(playerProfile.icon, e.currentTarget.dataset.part); renderIconPreview(playerProfile.icon); }
function onAudioSliderChanged(kind, e) { setVolume(kind, Number(e.target.value)); }
function bindClick(id, fn) { getEl(id).addEventListener('click', fn); }
function bindMenuButtons() {
  bindClick('btn_single', onSinglePlayerClicked);
  bindClick('btn_multi', function () { readProfileFromMenu(); showScreen('mp'); });
  bindClick('btn_create_room', onCreateRoomClicked);
  bindClick('btn_join_room', function () { readProfileFromMenu(); showScreen('join'); });
  bindClick('btn_make_answer', makeAnswerForHostCode);
  bindClick('btn_invite', createInviteForNextSeat);
  bindClick('btn_connect', submitInviteAnswer);
  bindClick('btn_ready', toggleReadyState);
  bindClick('btn_start', function () { startGameFromLobby(readDurationSeconds()); });
  bindClick('btn_deck', function () { sendIntentToHost({ t: 'draw' }); });
  bindClick('btn_results_menu', function () { location.reload(); });
  bindClick('btn_audio', function () { getEl('audio_panel').hidden = !getEl('audio_panel').hidden; });
  document.querySelectorAll('.back').forEach(function (b) { b.addEventListener('click', function () { showScreen('menu'); }); });
  document.querySelectorAll('.icon_btn').forEach(function (b) { b.addEventListener('click', onIconPartClicked); });
}
function bindAudioControls() {
  ['master', 'music', 'sfx'].forEach(function (kind) { getEl('vol_' + kind).addEventListener('input', function (e) { onAudioSliderChanged(kind, e); }); });
  document.addEventListener('pointerdown', ensureAudioStarted);
  document.addEventListener('click', function (e) { if (e.target.closest('button')) playMenuSfx(); });
}
function main() {
  renderIconPreview(playerProfile.icon); bindMenuButtons(); bindAudioControls(); attachHandGestures();
}
main();
