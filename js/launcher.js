const SCREEN_FILES = ['overlays', 'menu', 'mp', 'join', 'lobby', 'solo', 'guide', 'game', 'results'];
function fetchScreenHtml(name) {
  return fetch('screens/' + name + '.html').then(function (response) { if (!response.ok) throw new Error('missing ' + name); return response.text(); });
}
function insertScreens(parts) { getEl('app').innerHTML = parts.join('\n'); }
function showLaunchError() {
  getEl('app').textContent = 'Screens could not be loaded. Open this folder through a web server (npx serve .) or the Vercel link, not by double-clicking index.html.';
}
function launchGame() {
  Promise.all(SCREEN_FILES.map(fetchScreenHtml)).then(function (parts) { insertScreens(parts); main(); }, showLaunchError);
}
launchGame();
