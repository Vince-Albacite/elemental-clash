# Elemental Clash

Static site: HTML, CSS and plain JavaScript. No build step, no backend, no database, no environment variables.

## Run locally
Open `index.html` in a browser (or `npx serve .`).

## Deploy to Vercel
1. Push this folder to a Git repo, or run `npx vercel` inside the folder.
2. Framework preset: Other. Build command: none. Output directory: `.`
3. `vercel.json` already sets CSP, HSTS, nosniff, no-referrer headers.

## Variables to fill
None. Nothing in this project needs a backend, API route or database. Nothing to fill in any file.

## Local multiplayer (hotspot)
Host: Local Multiplayer > Create Room > Invite Player, send the host code to the joiner.
Joiner: Join Room > paste host code > Make Answer Code, send the answer back to the host.
Host pastes it and presses Connect. Repeat per player (up to 3). Missing seats become computer players.
No STUN or TURN server is used, so all devices must be on the same hotspot or Wi-Fi. If a phone cannot connect, turn off its private/randomized MAC or VPN and retry.

## Rule choices (edit in js/config.js and js/scoring.js)
Chain: brown > blue > green > red. Your spec example (red then green) conflicts with that chain; the code follows the chain.
