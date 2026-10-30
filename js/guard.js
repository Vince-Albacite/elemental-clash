/* Browsers never let a page disable their own buttons, so during a match we do everything a page can:
   block the shortcuts, trap the Back button, stop pull-to-refresh (CSS .in_match) and ask before reload or close. */
let matchGuardOn = false;
function readKey(e) { return String(e.key || '').toLowerCase(); }
function isReloadShortcut(e) { return readKey(e) === 'f5' || ((e.ctrlKey || e.metaKey) && readKey(e) === 'r'); }
function isBackShortcut(e) { return (e.altKey && readKey(e) === 'arrowleft') || (e.metaKey && (readKey(e) === '[' || readKey(e) === 'arrowleft')); }
function onMatchKeyDown(e) {
  if (!matchGuardOn || !(isReloadShortcut(e) || isBackShortcut(e))) return;
  e.preventDefault(); showNotice('Reload and Back are disabled during a match.');
}
function onMatchPopState() {
  if (!matchGuardOn) return;
  history.pushState({ match: true }, '', location.href); showNotice('Back is disabled during a match.');
}
function onMatchBeforeUnload(e) {
  if (!matchGuardOn) return undefined;
  e.preventDefault(); e.returnValue = ''; return '';
}
function onMatchContextMenu(e) { if (matchGuardOn) e.preventDefault(); }
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
