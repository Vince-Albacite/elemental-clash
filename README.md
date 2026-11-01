# Elemental Clash

Static site: HTML, CSS and plain JavaScript. No build step, no backend, no database, no environment variables.

## Run locally
index.html is only a launcher; each screen is a file in `screens/` that is fetched at start.
Serve the folder over http: `npx serve .` (or `python3 -m http.server`). Double-clicking index.html will not work in most browsers.

## Deploy to Vercel
1. Push this folder to a Git repo, or run `npx vercel` inside the folder.
2. Framework preset: Other. Build command: none. Output directory: `.`
3. `vercel.json` already sets CSP, HSTS, nosniff and no-referrer headers.

## Variables to fill
None. Nothing in this project needs a backend, API route or database.

## Local multiplayer (hotspot)
Codes are now about 100 characters and start the handshake automatically when pasted.
1. Host: Local Multiplayer > Create Room > Invite Player. Send the shown host code to the joiner.
2. Joiner: Join Room > paste the host code. The answer code appears by itself; send it to the host.
3. Host: paste the answer code. It connects by itself.
The host always has one fresh, unused invite code ready; after a player connects a new code appears by itself, so any number of players can join one after another without pressing anything.
Host can Add Bot, Remove or Kick per seat. Empty seats stay empty. A match needs 2 or more seats.
After a match the host presses Back to Lobby and everyone returns with names and icons kept.
No STUN or TURN server is used, so all devices must share the hotspot or Wi-Fi.

## Rule choices (js/config.js, js/scoring.js)
- `WEAKNESS_OF_BY_NAME` in config.js: element -> the element that beats it. Currently red:blue, blue:brown, brown:green, green:red.
- Weakness draw: thrown element is weak to the last card's element. Points = difference of the numbers, previous owner gets `WEAKNESS_BONUS_MULTIPLIER` x the point difference.
- Boost: thrown element beats the last card's element, +1 point (`BOOST_POINTS`).
- Throw rule: equal or higher number, a 0, or a weakness draw. Other cards are dimmed.
- Deck: a failed draw never starts the cooldown; cooldown is `DRAW_COOLDOWN_MS` and shown as a draining filler; the button shows n/HAND_SIZE (10).
- Everything in the How to Play screen (arrows, names, colors, numbers) is generated from js/config.js.
- Colors: ELEMENT_COLORS in config.js. Countdown: COUNTDOWN_STAGES and COUNTDOWN_TOTAL_MS.
- Music: js/audio.js TRACKS. Index 4 is the menu and lobby theme; all tracks are 16 steps of 0.25 s.
- Lobby: Back asks for confirmation; a leaving player triggers a notice on the host.

## Config switches added in this update (js/config.js)
- `BOT_PROFILES`: bot names, icons, reaction speed and randomness. Bots are picked at random without repeats.
- `ZERO_WILD_VALUE`: a thrown 0 card scores a random value min..max (set `enabled: false` for plain 0).
- `ADVANTAGE_STACK_BOOST` / `ADVANTAGE_STACK_MAX`: consecutive advantage draws by one player stack x2, x3 ... up to the cap.
- `GUIDE_LAYOUT_SOURCE`: 'weakness' (key order of WEAKNESS_OF_BY_NAME) or 'elements' (order of ELEMENT_NAMES) for the How to Play diagram.
- Colors, music tracks and sound effects are keyed by element name, so ELEMENT_NAMES can be reordered safely.

## Vs computer and bots
- Play vs Computer opens a setup lobby: pick 1 to 3 bots (Random or Choose from BOT_PROFILES), Start, Back. The match offers Pause (Resume, Back to Setup, Quit to Menu) and ends with Back to Setup.
- Bot risk throw (js/bots.js, numbers in BOT_PROFILES): when a bot's hand is at HAND_SIZE, no card in it counters the last element and it holds plain or weakness-draw cards numbered `riskMinNumber` or higher, it gambles on the biggest one with chance `riskTolerance`.
- Without a usable counter and with room left in the hand, bots draw to hunt for one (less often for more random characters).

## Why invite codes cannot be 6 characters
Two browsers can only connect directly if they swap their ICE credentials, the DTLS certificate fingerprint (SHA-256 = 256 bits) and an address with port. The fingerprint alone is about 43 characters, so the current ~90 character code is already close to the minimum. 6 characters hold about 31 to 36 bits. A 6 character room code only works with a lookup service that stores the full offer under that code (a server plus storage, or a third party broker). That conflicts with the Vercel-only, no-database rule.

## Match guard (js/guard.js)
During a match the page blocks F5, Ctrl+R, Cmd+R, Alt+Left, Cmd+[, traps the Back button, disables pull-to-refresh and shows the browser's leave confirmation on reload or close. The same guard stays on for the results screen and ends when you leave it with the on-screen button. Browsers do not allow a page to truly disable these buttons; the confirmation can always be accepted.

## Performance limits (js/config.js)
MAX_ACTIVE_TRACKS, MUSIC_SWITCH_MIN_MS, MAX_PARTICLES, EFFECT_MIN_GAP_MS, SNAPSHOT_COALESCE_MS, MAX_BUFFERED_BYTES.

## Bot friction (js/config.js, js/bots.js)
- `BOT_PACE_MULTIPLIER`: one number that scales every bot wait (reaction and action). 1 = unchanged, 1.5 = 50% slower, 0.5 = twice as fast.
- Reaction delay: after any card is thrown, each bot waits a random time before it may act. Per bot: `reactionMs: [fastest, slowest]` in `BOT_PROFILES`; bots without it use `BOT_DEFAULT_REACTION_MS`.
- Mistake logic (the unintended twin of the gamble): after a bot picks a throw, normal or gamble, `mistakeChance` (0..1) is the chance it throws a different random legal card instead. Bots without it use `BOT_DEFAULT_MISTAKE_CHANCE`.
- `actDelayMs`, `randomness`, `riskTolerance`, `riskMinNumber` are unchanged.

## Telegraph (the note before a throw)
- A distinct gliding note, one pitch per player seat (`TELEGRAPH_NOTE_SEMITONES`, `TELEGRAPH_BASE_FREQUENCY`), plays on every human device (not the actor's) and the player's score box pulses.
- Bots announce `BOT_TELEGRAPH_MS` before they throw. Humans announce when a swipe up passes the throw distance, before release (`HUMAN_WINDUP_TELEGRAPH`).
- `TELEGRAPH_ON_DECK_DRAW` also announces bot deck draws. `TELEGRAPH_MIN_GAP_MS` limits repeats.

## Code style
No single-letter variable, parameter, object key or property names. Exceptions that are data, not variables: SVG attribute names, CSS custom property names, and the one-letter code tables in net.js that are part of the handshake code format.
