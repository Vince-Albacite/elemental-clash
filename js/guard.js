/* Browsers never let a page disable their own buttons, so during a match and on the results screen we do everything a page can:
   block the shortcuts, trap the Back button, stop pull-to-refresh (CSS .in_match) and ask before reload or close. */
let matchGuardOn = false;
function readKey(keyEvent) { return String(keyEvent.key || '').toLowerCase(); }
function isReloadShortcut(keyEvent) { return readKey(keyEvent) === 'f5' || ((keyEvent.ctrlKey || keyEvent.metaKey) && readKey(keyEvent) === 'r'); }
function isBackShortcut(keyEvent) { return (keyEvent.altKey && readKey(keyEvent) === 'arrowleft') || (keyEvent.metaKey && (readKey(keyEvent) === '[' || readKey(keyEvent) === 'arrowleft')); }
function onMatchKeyDown(keyEvent) {
  if (!matchGuardOn || !(isReloadShortcut(keyEvent) || isBackShortcut(keyEvent))) return;
  keyEvent.preventDefault(); showNotice('Reload and Back are disabled here. Use the on-screen button to leave.');
}
function onMatchPopState() {
  if (!matchGuardOn) return;
  history.pushState({ match: true }, '', location.href); showNotice('Back is disabled here. Use the on-screen button to leave.');
}
function onMatchBeforeUnload(unloadEvent) {
  if (!matchGuardOn) return undefined;
  unloadEvent.preventDefault(); unloadEvent.returnValue = ''; return '';
}
function onMatchContextMenu(contextMenuEvent) { if (matchGuardOn) contextMenuEvent.preventDefault(); }
function enableMatchGuard() {
  if (matchGuardOn) return;
  matchGuardOn = true;
  if (!(history.state && history.state.match)) history.pushState({ match: true }, '', location.href);
  document.documentElement.classList.add('in_match');
}
function disableMatchGuard() {
  if (!matchGuardOn) return;
  matchGuardOn = false; document.documentElement.classList.remove('in_match');
}
function bindMatchGuard() {
  window.addEventListener('popstate', onMatchPopState); window.addEventListener('beforeunload', onMatchBeforeUnload);
  document.addEventListener('keydown', onMatchKeyDown, true); document.addEventListener('contextmenu', onMatchContextMenu);
}
